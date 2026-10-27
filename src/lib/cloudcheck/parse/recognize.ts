// src/lib/cloudcheck/parse/recognize.ts — 입력 1개 인식 (방향서 §4-5, 디자인 V2 오류 패널)
// 순서: 빈 파일 → 크기 상한 → UTF-8 디코딩 → 키 파일 거부 → 종류 판별 → (JSON) 깊이 상한·문법·스키마 우선·봉투 검증·섹션별 검증 / (CSV) 머리글로 종류 판별·신원.
// 예외를 던지지 않는다: 예상 밖 오류는 wrong-type으로 접는다(fail-closed). 키 파일은 어떤 값도 결과에 싣지 않는다.
import { DEMO_NAME_RE } from "../contract/normalized";
import type { CsvKind } from "../contract/normalized";
import { LIMITS, SCHEMA_RE, SUPPORTED, runKey } from "../contract/collect-schema";
import type { CollectFile } from "../contract/collect-schema";
import { EXCEPTIONS_SCHEMA_ID } from "../contract/exceptions-schema";
import { DOORS } from "../model/report";
import type { AsOf, Cloud, DemoSetId, DisplayValue, DoorId, InputRecognition, InputVia, IsoUtc, MsgParam, RecognitionStatus } from "../model/report";
import { parseCsv } from "./csv";
import { isCredentialReportHeader, readCredentialReport } from "./credential-report";
import { detectRg, readRg } from "./rg-csv";
import { isEntraHeader, readEntra } from "./entra-csv";
import { chooseAsOf, latestOf, reportLatestEvidence, rgLatestEvidence } from "./as-of";
import { sha256Hex } from "./digest";
import { plain, redacted, sensitive } from "./display";
import { jsonSyntaxError, locate, maxJsonDepth } from "./scan";
import { findSecret, looksLikeKeyFile } from "./secrets";
import { makeSchemas } from "./schemas";
import type { CollectorParsed, CsvParsed, SectionResult } from "./handle";
import { makeHandle } from "./handle";
import { instantFromMs, parseInstant, timeFromFileName } from "./strict-time";
import type { AsOfFact, Instant } from "../contract/normalized";

export interface RecognizeSource { readonly via: InputVia; readonly name: string; readonly bytes: Uint8Array; readonly lastModified: number | null }

const MAX_BYTES = Math.max(LIMITS.jsonBytes, LIMITS.csvBytes);
const TAIL_CHARS = 40;

function firstByte(b: Uint8Array): number {
  let i = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i++;
  return b[i] ?? 0;
}

/** 입력 끝 40자를 비밀 검사를 거쳐 DisplayValue로(디자인 Q17). 파일 어디에든 비밀 모양이 있으면 redacted */
function tailOf(text: string): DisplayValue {
  const t = text.trimEnd().slice(-TAIL_CHARS);
  if (findSecret(text) !== null) return redacted("secret-pattern");
  return sensitive("freeText", t);
}

export function recognize(src: RecognizeSource): InputRecognition {
  const nameValue: DisplayValue = src.via === "file" ? (findSecret(src.name) !== null ? redacted("secret-pattern") : sensitive("fileName", src.name)) : plain(src.name);
  const bytes = src.bytes.length;
  const base = { via: src.via, name: nameValue, bytes };
  const fail = (status: RecognitionStatus, detail: Readonly<Record<string, MsgParam>> | null = null): InputRecognition =>
    ({ ...base, status, kind: null, detail, identityPreview: null, asOf: null, doors: [], handle: null });
  try {
    if (bytes === 0) return fail("empty");
    if (bytes > MAX_BYTES) return fail("too-large");
    const looksJson = firstByte(src.bytes) === 0x7b || firstByte(src.bytes) === 0x5b;
    if (bytes > (looksJson ? LIMITS.jsonBytes : LIMITS.csvBytes)) return fail("too-large");
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(src.bytes); } catch { return fail("wrong-type"); }
    if (text.trim() === "") return fail("empty");
    if (text.includes("\u0000")) return fail("wrong-type");
    if (looksLikeKeyFile(text)) return fail("credentials-file");
    return looksJson ? recognizeJson(src, text, base, fail) : recognizeCsv(src, text, base, fail);
  } catch {
    return fail("wrong-type");
  }
}

type Base = { readonly via: InputVia; readonly name: DisplayValue; readonly bytes: number };
type Fail = (status: RecognitionStatus, detail?: Readonly<Record<string, MsgParam>> | null) => InputRecognition;

/** Azure 수집기: 저장소 계정 키 생성 시각(key1·key2) 중 가장 늦은 것 */
function azureKeyEvidence(sections: ReadonlyMap<string, SectionResult>): Instant | null {
  const sec = sections.get("storageAccounts");
  if (!sec || !sec.ok) return null;
  const times: (Instant | null)[] = [];
  for (const e of sec.value as readonly { items: readonly { keyCreationTime: { key1: string | null; key2: string | null } | null }[] | null }[]) {
    for (const it of e.items ?? []) {
      if (it.keyCreationTime === null) continue;
      for (const v of [it.keyCreationTime.key1, it.keyCreationTime.key2]) times.push(v === null ? null : parseInstant(v));
    }
  }
  return latestOf(times);
}

/* ───────── JSON ───────── */
function recognizeJson(src: RecognizeSource, text: string, base: Base, fail: Fail): InputRecognition {
  const { exceeded } = maxJsonDepth(text, LIMITS.jsonDepth);
  if (exceeded) return fail("too-deep");
  let root: unknown;
  try { root = JSON.parse(text); } catch {
    const pos = jsonSyntaxError(text) ?? 0;
    const { line, col } = locate(text, pos);
    const trimmed = text.trimEnd();
    const maybeTruncated = pos >= text.length || !(trimmed.endsWith("}") || trimmed.endsWith("]"));
    const detail: Record<string, MsgParam> = { line: { n: line }, col: { n: col }, tail: { v: tailOf(text) } };
    if (maybeTruncated) detail.maybeTruncated = { n: 1 };
    return fail("parse-error", detail);
  }
  if (typeof root !== "object" || root === null || Array.isArray(root)) return fail("not-cloudcheck");
  const obj = root as Record<string, unknown>;
  const sid = obj.schema;
  if (typeof sid !== "string" || !SCHEMA_RE.test(sid)) {
    const exceptionsLike = sid === EXCEPTIONS_SCHEMA_ID || (sid === undefined && Array.isArray(obj.entries));
    return fail("not-cloudcheck", exceptionsLike ? { hint: { c: "exceptions-file" } } : null);
  }
  const m = SCHEMA_RE.exec(sid) as RegExpExecArray;
  const major = Number(m[1]), minor = Number(m[2]);
  if (major !== SUPPORTED.major) return fail("schema-major", { major: { n: major } });
  const support = minor === SUPPORTED.maxMinor ? "exact" : minor > SUPPORTED.maxMinor ? "newer-minor" : "older-minor";
  const mode = support === "newer-minor" ? "strip" : "strict";
  const cloud = obj.cloud === "aws" ? "aws" : obj.cloud === "azure" ? "azure" : null;
  if (cloud === null) return fail("not-cloudcheck");
  const schemas = makeSchemas(cloud, mode);
  const env = schemas.envelope.safeParse(obj);
  if (!env.success) return fail("not-cloudcheck");
  const file = env.data as CollectFile & { data: Record<string, unknown> };
  // 영수증 ID 중복 · 수집기 이름 ↔ 클라우드 불일치는 파일 전체를 거부한다
  const ids = file.receipts.map((r) => r.id);
  if (new Set(ids).size !== ids.length) return fail("not-cloudcheck");
  if (file.collector.name !== (cloud === "aws" ? "cloudcheck-aws" : "cloudcheck-azure")) return fail("not-cloudcheck");
  const collectedAt = parseInstant(file.collectedAt);
  const finishedAt = parseInstant(file.run.finishedAt);
  if (!collectedAt || !finishedAt) return fail("not-cloudcheck");
  for (const r of file.receipts) if (!parseInstant(r.at)) return fail("not-cloudcheck");
  // 체험 입력은 이름 규약을 지켜야 한다(세트는 이름에서 읽는다)
  let demoSet: DemoSetId | null = null;
  if (src.via === "demo") {
    const dm = DEMO_NAME_RE.exec(src.name);
    if (!dm || dm[2] !== cloud) return fail("not-cloudcheck");
    demoSet = dm[1] as DemoSetId;
  }
  // data 섹션별 검증. 모르는 섹션은 strict에서 파일 거부, strip에서 무시
  const sections = new Map<string, SectionResult>();
  for (const [key, value] of Object.entries(file.data)) {
    const schema = schemas.sections.get(key);
    if (!schema) { if (mode === "strict") return fail("not-cloudcheck"); continue; }
    const r = schema.safeParse(value);
    sections.set(key, r.success ? { ok: true, value: r.data } : { ok: false });
  }
  const accountId = file.cloud === "aws" ? file.identity.accountId : file.identity.tenantId.toLowerCase();
  const alias = file.cloud === "aws" ? file.identity.alias.value : null;
  // 기준 시각 = 수집 시각. 2000년 이전이면 시계가 초기화된 기기에서 돌린 것이라 버린다(CC-QA-01). 증거 시각은 Azure만 계산한다(키 생성 시각 — AWS는 서버 시각인 보고서 생성 시각이 기준)
  const decision = chooseAsOf([{ at: collectedAt, source: "collected-at" }]);
  const asOf: AsOf | null = decision.asOf ? { at: decision.asOf.at.iso as IsoUtc, source: decision.asOf.source } : null;
  const displayName = src.via === "demo" ? `cloudcheck-demo.${cloud}.json` : src.name;
  const parsed: CollectorParsed = {
    type: "collector", cloud, via: src.via, name: displayName, bytes: base.bytes, digest: sha256Hex(src.bytes), demoSet, schemaId: sid, support,
    envelope: file, collectedAt, asOf: decision.asOf, ...(decision.rejected ? { asOfRejected: decision.rejected } : {}),
    latestEvidence: cloud === "azure" ? azureKeyEvidence(sections) : null, runKey: runKey(file), sections,
  };
  const doors: DoorId[] = DOORS.filter((d) => file.run.doors[d] === "collected");
  return {
    ...base, status: "ok", kind: "collector-json", detail: null,
    identityPreview: { cloud, accountLast4: accountId.slice(-4), alias: alias === null || alias === "" ? null : findSecret(alias) !== null ? redacted("secret-pattern") : sensitive("alias", alias) },
    asOf, doors, handle: makeHandle(parsed),
  };
}

/* ───────── CSV ───────── */
function recognizeCsv(src: RecognizeSource, text: string, base: Base, fail: Fail): InputRecognition {
  const csv = parseCsv(text);
  if (!csv.ok) {
    if (csv.reason === "empty") return fail("empty");
    return fail("parse-error", { line: { n: csv.line }, col: { n: csv.col }, maybeTruncated: { n: 1 }, tail: { v: tailOf(text) } });
  }
  const t = csv.table;
  if (t.header.length < 2) return fail("wrong-type");
  // 기준 시각 후보: 파일 이름 시각 > 파일 수정 시각. 2000년 이전 값(0 = 1970, FAT·ZIP 1980)은 '시각 없음'과 같아 버린다(CC-QA-01)
  const asOfDecision = (): ReturnType<typeof chooseAsOf> => {
    const fromName = src.via === "file" ? timeFromFileName(src.name) : null;
    let fromTime: AsOfFact | null = null;
    if (src.via === "file" && src.lastModified !== null) {
      const inst = instantFromMs(Math.floor(src.lastModified / 1000) * 1000);
      if (inst) fromTime = { at: inst, source: "file-time" };
    }
    return chooseAsOf([fromName ? { at: fromName, source: "filename" } : null, fromTime]);
  };
  const finish = (p: Omit<CsvParsed, "type" | "via" | "name" | "bytes" | "digest" | "asOf" | "asOfRejected" | "latestEvidence">, doors: DoorId[], cloud: Cloud, accountLast4: string | null): InputRecognition => {
    const decision = asOfDecision();
    const latestEvidence = p.report !== null ? reportLatestEvidence(p.report) : p.rg !== null ? rgLatestEvidence(p.rg) : null;
    const parsed: CsvParsed = { type: "csv", via: src.via, name: src.name, bytes: base.bytes, digest: sha256Hex(src.bytes), asOf: decision.asOf, ...(decision.rejected ? { asOfRejected: decision.rejected } : {}), latestEvidence, ...p };
    return {
      ...base, status: "ok", kind: p.kind, detail: null,
      identityPreview: accountLast4 === null ? null : { cloud, accountLast4, alias: null },
      asOf: decision.asOf ? { at: decision.asOf.at.iso as IsoUtc, source: decision.asOf.source } : null, doors, handle: makeHandle(parsed),
    };
  };
  const kind = (k: CsvKind): CsvKind => k;

  if (isCredentialReportHeader(t.header)) {
    const report = readCredentialReport(t);
    if (report.accountId === null) return fail("not-cloudcheck");
    return finish({ kind: kind("csv-credential-report"), cloud: "aws", report, rg: null, entra: null, identityId: report.accountId }, ["mfa", "key"], "aws", report.accountId.slice(-4));
  }
  if (t.header.includes("ccQuery")) {
    const d = detectRg(t);
    if (d.status === "other-version") return fail("schema-major", { major: { n: d.version } });
    if (d.status !== "ok") return fail("not-cloudcheck");
    if (t.rows.length === 0) return fail("empty");
    const rg = readRg(t, d.kind);
    if (rg.tenantId === null) return fail("not-cloudcheck");
    return finish({ kind: kind(d.kind), cloud: "azure", report: null, rg, entra: null, identityId: rg.tenantId }, d.kind === "csv-rg-storage" ? ["key", "sto"] : ["net"], "azure", rg.tenantId.slice(-4));
  }
  if (isEntraHeader(t.header)) {
    if (t.rows.length === 0) return fail("empty");
    return finish({ kind: kind("csv-entra-registration"), cloud: "azure", report: null, rg: null, entra: readEntra(t), identityId: null }, ["mfa"], "azure", null);
  }
  return fail("wrong-type");
}
