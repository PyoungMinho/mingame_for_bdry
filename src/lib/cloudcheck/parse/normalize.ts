// src/lib/cloudcheck/parse/normalize.ts — buildInput(): 인식한 입력 여러 개를 리포트 1개분의 NormalizedInput으로 합친다 (방향서 §4-8, §5-3)
//  1) 클라우드·계정(테넌트)이 다른 입력은 합치지 않는다(account-mismatch · cloud-mismatch → ok:false, 두 신원을 나란히 보여 줄 수 있게 인식 결과를 돌려준다)
//  2) 같은 수집 실행(runKey)이 두 번이면 내용 지문(원본 바이트의 SHA-256)이 작은 하나만 쓰고 나머지는 superseded(내용이 같으면 먼저 넣은 것)
//  3) 문 단위 선택: 문마다 그 문을 담은 입력 하나만 쓴다 — 수집기 JSON > CSV, 같은 종류끼리는 기준 시각이 최신인 것, 기준 시각까지 같으면(둘 다 없음 포함) 내용 지문이 작은 것
//  판정은 입력을 넣은 순서와 무관하다(STEP 5 N1): 동률은 입력 위치가 아니라 내용으로만 깬다. 순서를 따르는 것은 표시 정보뿐이다 — inputs 목록 순서 · 영수증 ID 접두(0: · 1:) · 신원 출처 입력 번호
//  4) 사실 슬롯 · 모수/범위(sealCoverage) · 비밀 패턴 제거(R-12) · 영수증 색인은 normalize-aws/azure.ts
// 체험 입력(via: "demo")도 같은 길이다. 예외를 던지지 않는다(불변식이 깨지면 해당 슬롯·범위가 미완결로 봉인된다 = fail-closed).
import RELEASES from "../collector/RELEASES.json";
import { NORMALIZED_MODEL } from "../contract/normalized";
import type {
  AsOfFact, AwsNormalizedInput, AzureNormalizedInput, InputFacts, Instant, NormalizedInput, ReceiptFact, ReceiptKey, SectionIssue,
} from "../contract/normalized";
import { DOORS } from "../model/report";
import type { DemoSetId, DoorId, InputRecognition } from "../model/report";
import { readHandle } from "./handle";
import type { CollectorParsed, CsvParsed, ParsedInput } from "./handle";
import { buildAws } from "./normalize-aws";
import { buildAzure } from "./normalize-azure";
import { InputCtx, isUsed } from "./normalize-common";
import { sanitizeInput } from "./sanitize";
import { Redactor } from "./secrets";

type Sel = { readonly state: "selected"; readonly input: number } | { readonly state: "skipped"; readonly inputs: readonly number[] } | { readonly state: "absent" };
interface Acc { readonly index: number; readonly rec: number; readonly p: ParsedInput; readonly dup: boolean }

const idOf = (p: ParsedInput): string | null =>
  p.type === "collector" ? (p.cloud === "aws" ? (p.envelope as { identity: { accountId: string } }).identity.accountId : (p.envelope as { identity: { tenantId: string } }).identity.tenantId.toLowerCase()) : p.identityId;
const demoKey = (p: ParsedInput): string => (p.type === "collector" && p.via === "demo" ? `demo:${String(p.demoSet)}` : "real");

/** 입력이 담고 있는 문과 --doors로 건너뛴 문 */
function doorInfo(p: ParsedInput): { has: ReadonlySet<DoorId>; skipped: ReadonlySet<DoorId> } {
  if (p.type === "csv") {
    const has: DoorId[] = p.kind === "csv-credential-report" ? ["mfa", "key"] : p.kind === "csv-rg-storage" ? ["key", "sto"] : p.kind === "csv-rg-nsg" ? ["net"] : ["mfa"];
    return { has: new Set(has), skipped: new Set() };
  }
  const run = (p.envelope as { run: { doors: Record<DoorId, "collected" | "skipped"> } }).run.doors;
  const has = new Set<DoorId>(), skipped = new Set<DoorId>();
  for (const d of DOORS) {
    if (run[d] === "collected") has.add(d);
    else if (!(p.cloud === "azure" && d === "mfa")) skipped.add(d);   // Azure 수집기는 mfa를 수집하지 않는다(포털 안내) → '건너뜀'이 아니라 '이 입력에 없는 문'
  }
  return { has, skipped };
}

const asOfOf = (p: ParsedInput): AsOfFact | null => p.asOf;

/** 내용 순서(N1): 원본 바이트의 SHA-256이 작은 쪽이 앞이다. 같은 내용이면 0 */
const byContent = (a: ParsedInput, b: ParsedInput): number => (a.digest < b.digest ? -1 : a.digest > b.digest ? 1 : 0);

/**
 * 같은 종류의 두 입력 중 쓸 쪽 — 기준 시각이 더 늦은 쪽, 같으면(둘 다 없음 포함) 내용 지문이 작은 쪽.
 * 내용까지 같으면 어느 쪽을 골라도 판정이 같으므로 onExactTie가 정한다(예전 동작을 지켜 표시 정보가 흔들리지 않게).
 */
function newerOf(b: Acc, c: Acc, onExactTie: "first" | "last"): Acc {
  const tb = asOfOf(b.p)?.at.ms ?? -Infinity, tc = asOfOf(c.p)?.at.ms ?? -Infinity;
  if (tc !== tb) return tc > tb ? c : b;
  const d = byContent(c.p, b.p);
  if (d !== 0) return d < 0 ? c : b;
  return onExactTie === "last" ? c : b;
}

/** InputFacts의 기준 시각 보조 사실: 버린 후보 기록 · 가장 늦은 증거 시각(있을 때만 싣는다) */
const asOfExtras = (p: ParsedInput): { asOfRejected?: NonNullable<ParsedInput["asOfRejected"]>; latestEvidence?: Instant } => ({
  ...(p.asOfRejected ? { asOfRejected: p.asOfRejected } : {}),
  ...(p.latestEvidence ? { latestEvidence: p.latestEvidence } : {}),
});

function deepFreeze<T>(root: T): T {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [root];
  while (stack.length > 0) {
    const x = stack.pop();
    if (typeof x !== "object" || x === null || seen.has(x)) continue;
    seen.add(x);
    if (x instanceof Map) { for (const v of x.values()) stack.push(v); continue; }
    Object.freeze(x);
    for (const v of Object.values(x as Record<string, unknown>)) stack.push(v);
  }
  return root;
}

const knownRelease = (p: CollectorParsed): boolean | null => {
  const c = (p.envelope as { collector: { name: string; version: string; sha256: string | null } }).collector;
  if (c.sha256 === null) return null;
  return (RELEASES.releases as readonly { name: string; version: string; sha256: string }[]).some((r) => r.name === c.name && r.version === c.version && r.sha256 === c.sha256);
};

export function buildInput(recs: readonly InputRecognition[]):
  | { ok: true; input: NormalizedInput; recognitions: InputRecognition[] }
  | { ok: false; recognitions: InputRecognition[] } {
  const out: InputRecognition[] = recs.map((r) => ({ ...r }));
  try {
    return build(recs, out);
  } catch {
    return { ok: false, recognitions: out };   // 예외를 던지지 않는다
  }
}

function build(recs: readonly InputRecognition[], out: InputRecognition[]):
  | { ok: true; input: NormalizedInput; recognitions: InputRecognition[] }
  | { ok: false; recognitions: InputRecognition[] } {
  const demote = (i: number, status: InputRecognition["status"]): void => { out[i] = { ...out[i], status, handle: null, doors: [] }; };

  // 1) 읽을 수 있는 입력(핸들이 살아 있는 것)
  const oks: { rec: number; p: ParsedInput }[] = [];
  recs.forEach((r, i) => {
    if (r.status !== "ok") return;
    const p = readHandle(r.handle);
    if (p === null) { demote(i, "not-cloudcheck"); return; }
    oks.push({ rec: i, p });
  });
  if (oks.length === 0) return { ok: false, recognitions: out };

  // 2) 같은 리포트에 합칠 수 있는가: 클라우드 · 계정(테넌트) · 체험/실제
  const primary = oks.find((o) => idOf(o.p) !== null);
  if (primary === undefined) { for (const o of oks) demote(o.rec, "not-cloudcheck"); return { ok: false, recognitions: out }; }
  let mismatch = false;
  for (const o of oks) {
    if (o === primary) continue;
    const id = idOf(o.p);
    if (o.p.cloud !== primary.p.cloud) { demote(o.rec, "cloud-mismatch"); mismatch = true; }
    else if ((id !== null && id !== idOf(primary.p)) || demoKey(o.p) !== demoKey(primary.p)) { demote(o.rec, "account-mismatch"); mismatch = true; }
  }
  if (mismatch) return { ok: false, recognitions: out };
  const cloud = primary.p.cloud;

  // 3) 같은 수집 실행 중복 → 내용 지문이 가장 작은 하나만 쓰고 나머지는 superseded(리포트에는 '쓰이지 않은 입력'으로 남는다). 입력 위치로 고르지 않는다(N1)
  const runWinner = new Map<string, number>();     // runKey → 쓸 입력의 oks 안 위치(지문이 같으면 먼저 넣은 것)
  oks.forEach((o, i) => {
    if (o.p.type !== "collector") return;
    const w = runWinner.get(o.p.runKey);
    if (w === undefined || byContent(o.p, oks[w].p) < 0) runWinner.set(o.p.runKey, i);
  });
  const acc: Acc[] = oks.map((o, index) => {
    const dup = o.p.type === "collector" && runWinner.get(o.p.runKey) !== index;
    if (dup) out[o.rec] = { ...out[o.rec], status: "superseded", doors: [] };
    return { index, rec: o.rec, p: o.p, dup };
  });

  // 4) 문 단위 선택
  const info = acc.map((a) => doorInfo(a.p));
  const pick = {} as Record<DoorId, Sel>;
  const used = new Map<number, Set<DoorId>>();
  for (const d of DOORS) {
    const cands = acc.filter((a) => !a.dup && info[a.index].has.has(d));
    if (cands.length > 0) {
      const best = cands.reduce((b, c) => {
        const rb = b.p.type === "collector" ? 1 : 0, rc = c.p.type === "collector" ? 1 : 0;
        if (rb !== rc) return rc > rb ? c : b;
        return newerOf(b, c, "last");
      });
      pick[d] = { state: "selected", input: best.index };
      (used.get(best.index) ?? used.set(best.index, new Set()).get(best.index) as Set<DoorId>).add(d);
    } else {
      const sk = acc.filter((a) => !a.dup && info[a.index].skipped.has(d)).map((a) => a.index);
      pick[d] = sk.length > 0 ? { state: "skipped", inputs: sk } : { state: "absent" };
    }
  }

  // 5) 신원 출처: 수집기 JSON 중 기준 시각이 가장 최신인 것, 없으면 CSV 중 가장 최신인 것(중복·미사용 입력은 제외). 기준 시각이 같으면 내용 지문이 작은 것(N1)
  const live = acc.filter((a) => !a.dup && idOf(a.p) !== null);
  const collectorsLive = live.filter((a) => a.p.type === "collector");
  const identityInput = (collectorsLive.length > 0
    ? collectorsLive.reduce((b, c) => newerOf(b, c, "last"))
    : live.length > 0 ? live.reduce((b, c) => newerOf(b, c, "first")) : acc[0]).index;

  // 6) 클라우드별 사실. 입력은 먼저 청소한다(R-12): 모든 문자열 값이 리포트 단위 Redactor를 한 번 거친 복사본만 정규화가 읽는다.
  //    지운 값의 토큰 번호는 처음 본 순서로 매겨지므로 입력을 넣은 순서가 아니라 내용 순서(지문, N1)로 청소한다 — 토큰이 대상 MatchKey에 들어가서다
  const red = new Redactor();
  const issues: SectionIssue[] = [];
  const clean: ParsedInput[] = new Array<ParsedInput>(acc.length);
  for (const a of [...acc].sort((x, y) => byContent(x.p, y.p) || x.index - y.index)) clean[a.index] = sanitizeInput(a.p, red);
  const collectors = new Map<number, InputCtx>();
  const csvs = new Map<number, CsvParsed>();
  for (const a of acc) {
    const cp = clean[a.index];
    if (cp.type === "collector") collectors.set(a.index, new InputCtx(a.index, cp, red, issues));
    else csvs.set(a.index, cp);
  }
  const asOf = (d: DoorId): AsOfFact | null => { const p = pick[d]; return p.state === "selected" ? asOfOf(acc[p.input].p) : null; };
  const args = { pick, asOf, collectors, csvs, red, issues, identityInput };
  const built = cloud === "aws" ? buildAws(args) : buildAzure(args);

  // 7) 영수증 색인(used) · 입력 요약
  const receipts = new Map<ReceiptKey, ReceiptFact>();
  for (const [index, ctx] of collectors) {
    const doors = used.get(index) ?? new Set<DoorId>();
    for (const f of ctx.facts.values()) receipts.set(f.key, { ...f, used: !acc[index].dup && isUsed(f.call, index, doors, identityInput) });
  }
  const inputs: InputFacts[] = acc.map((a): InputFacts => {
    const di = info[a.index];
    const mine = used.get(a.index) ?? new Set<DoorId>();
    const dd = Object.fromEntries(DOORS.map((d) => [d, mine.has(d) ? "used" : di.has.has(d) ? "superseded" : di.skipped.has(d) ? "skipped" : "absent"])) as InputFacts["doors"];
    const p = clean[a.index];
    const rec = recs[a.rec];
    if (p.type === "collector") {
      const e = p.envelope as { collector: { name: "cloudcheck-aws" | "cloudcheck-azure"; version: string; sha256: string | null }; scope: { regions?: { value: unknown }; subscriptions?: { value: unknown } } };
      const scopeProven = (p.cloud === "aws" ? e.scope.regions?.value : e.scope.subscriptions?.value) != null;
      return {
        index: a.index, kind: "collector-json", via: p.via, name: p.name, bytes: p.bytes, asOf: asOfOf(p), ...asOfExtras(p), runKey: p.runKey,
        collector: { name: e.collector.name, version: e.collector.version, sha256: e.collector.sha256, knownRelease: knownRelease(p) },
        schema: { id: p.schemaId, support: p.support }, doors: dd, scopeProven,
      };
    }
    const scopeProven = p.kind === "csv-credential-report" && p.report !== null && p.report.ambiguous.length === 0 && p.report.root !== null && p.report.missingColumns.length === 0 && p.report.duplicateColumns.length === 0;
    return { index: a.index, kind: p.kind, via: p.via, name: p.name, bytes: rec.bytes, asOf: p.asOf, ...asOfExtras(p), runKey: null, collector: null, schema: null, doors: dd, scopeProven };
  });

  // 8) 인식 결과 갱신: 이 입력이 실제로 쓰인 문만 남긴다(디자인 C5)
  for (const a of acc) if (!a.dup) out[a.rec] = { ...out[a.rec], doors: [...(used.get(a.index) ?? [])].sort((x, y) => DOORS.indexOf(x) - DOORS.indexOf(y)) };

  const demo = acc.every((a) => a.p.via === "demo");
  const setId = demo ? ((acc[0].p as CollectorParsed).demoSet as DemoSetId) : null;
  const base = {
    model: NORMALIZED_MODEL, mode: demo && setId ? { kind: "demo" as const, setId } : { kind: "real" as const },
    inputs, receipts, notices: { redactions: red.count, sectionIssues: issues },
  };
  const input = (cloud === "aws"
    ? { ...base, cloud: "aws" as const, identity: (built as ReturnType<typeof buildAws>).identity, doors: (built as ReturnType<typeof buildAws>).doors, coverage: (built as ReturnType<typeof buildAws>).coverage }
    : { ...base, cloud: "azure" as const, identity: (built as ReturnType<typeof buildAzure>).identity, doors: (built as ReturnType<typeof buildAzure>).doors, coverage: (built as ReturnType<typeof buildAzure>).coverage }) as AwsNormalizedInput | AzureNormalizedInput;
  return { ok: true, input: deepFreeze(input), recognitions: out };
}
