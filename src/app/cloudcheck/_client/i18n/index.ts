// src/app/cloudcheck/_client/i18n/index.ts — 화면 문구 카탈로그 병합 · 키 타입 · t() · 조립 규약(단일 구현)
// 소유: 프론트팀장. 근거: 디자인 최종안 §5-0(i18n 인터페이스), §8-1(파일 경계·키 규칙 1~13), UX §6-10(표기).
//
// ── 파일 경계(첫 세그먼트로 소유를 가른다) ─────────────────────────────────────────
//  C  ko/components.ts  컴포넌트개발자  cc.{c,status,door,label,band,hdr,ctx,boot,promise,disclaimer}.*
//  S  ko/screens.ts     페이지개발자    cc.{app,start,prep,input,report,fix,compare,demo,catalog,about}.*
//  E  src/lib/cloudcheck/rules/i18n/ko.ts  DB설계자  cc.{reason,banner,time,recog,fact,gcs,rule,ph,basis,incident}.*
//     → D4 통합(프론트팀장)에서 아래 CATALOG에 ENGINE_KO를 병합했다. E 키의 모양은 아래 ENGINE_CHECKED가 컴파일 때 묶는다.
//
// ── 조립 규약 ───────────────────────────────────────────────────────────────────────
//  1) t(key, params)  → 문자열. 속성(aria-label·title·placeholder)·document.title·라이브 영역은 이것만 쓴다.
//     params는 TextParam(수·비식별 문자열·{t}·{d})만 받는다. DisplayValue·{v}는 타입으로 막혀 있고, 런타임에 섞여 들어와도 그리지 않는다.
//  2) <T k p>        → 노드. 사용자 데이터({v} = DisplayValue)가 든 문장은 반드시 이것으로(컴포넌트개발자 구현: T.tsx).
//     segments(key, params)가 내는 조각을 그대로 그린다: text → 글자, {v} → <MaskedValue>, {t} → <time dateTime>+fmtTime(full),
//     ReactElement → 그대로, 나머지(n·c·d·수·문자열) → paramText().
//  3) <Msg m short?> → 엔진 코드(MsgRef). 키는 keyOf(code)(short면 shortKeyOf) 하나로만 만든다(키 규칙 11).
//  4) 문장을 조각으로 잇지 않는다(키 규칙 4). 예외는 상태 칩의 "{상태 글자} {n}"뿐.
//  5) 키 검사: 코드에 적는 C·S 키는 리터럴로 컴파일 검사된다(없는 키 = 타입 오류). 템플릿 리터럴도 유한 유니온이면 검사된다
//     (예: t(`cc.status.${status}`) — 5개 모두 카탈로그에 있어야 통과). 데이터에서 온 키(RuleCatalogEntry.*Key 등 CatalogKey)와
//     E 네임스페이스 키는 그대로 받는다(존재는 DB설계자 registry 테스트 + 가드 테스트가 검사). 카탈로그에 없는 키는 ⟦키⟧로 보인다.
import type { CatalogKey, DisplayValue, IsoDate, IsoUtc, MessageCode, MsgParam, UnknownReason } from "../../../../lib/cloudcheck/model/report";
import { ENGINE_KO } from "../../../../lib/cloudcheck/rules/i18n/ko";
import { COMPONENTS_KO } from "./ko/components";
import { SCREENS_KO } from "./ko/screens";

/* ───────── 네임스페이스(첫 세그먼트) ───────── */
export const C_SEGMENTS = ["c", "status", "door", "label", "band", "hdr", "ctx", "boot", "promise", "disclaimer"] as const;
export const S_SEGMENTS = ["app", "start", "prep", "input", "report", "fix", "compare", "demo", "catalog", "about"] as const;
export const E_SEGMENTS = ["reason", "banner", "time", "recog", "fact", "gcs", "rule", "ph", "basis", "incident"] as const;
export type ComponentsKey = `cc.${(typeof C_SEGMENTS)[number]}.${string}`;
export type ScreensKey = `cc.${(typeof S_SEGMENTS)[number]}.${string}`;
export type EngineKey = `cc.${(typeof E_SEGMENTS)[number]}.${string}`;
export type CatalogFile = "components" | "screens" | "engine";

/** 각 카탈로그 파일이 지켜야 할 모양. 파일 머리에서 `satisfies`로 건다(첫 세그먼트가 다르면 컴파일 오류) */
export type ComponentsCatalog = Readonly<Partial<Record<ComponentsKey, string>>>;
export type ScreensCatalog = Readonly<Partial<Record<ScreensKey, string>>>;
export type EngineCatalog = Readonly<Partial<Record<EngineKey, string>>>;

/** 키 형식(UX 키 규칙 1): cc.<세그먼트>(.<세그먼트>)+, 세그먼트는 소문자·숫자 kebab-case */
export const KEY_RE = /^cc(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){2,}$/;

/* ───────── 병합 ───────── */
/** E 카탈로그의 키가 모두 E 네임스페이스(첫 세그먼트)인지 컴파일 때 묶는다(다르면 type-check 실패). 런타임 경계 검사는 index.test.ts */
const ENGINE_CHECKED = ENGINE_KO satisfies EngineCatalog;
/** 세 파일은 첫 세그먼트가 서로 달라 키가 겹치지 않는다(중복 0은 index.test.ts가 검사) */
const CATALOG = { ...COMPONENTS_KO, ...SCREENS_KO, ...ENGINE_CHECKED };

/** 카탈로그에 실제로 있는 키(리터럴 유니온) */
export type Key = keyof typeof CATALOG;
/** t()·<T>가 받는 키: 있는 C·S 키 리터럴 + E 네임스페이스 */
export type TKey = Key | EngineKey;
/**
 * 키 인자 검사 타입. 리터럴(또는 유한 유니온)이면 TKey에 있어야 하고, 넓은 CatalogKey(데이터에서 온 키)는 그대로 통과한다.
 * <T>·DocLink처럼 키를 받는 컴포넌트도 `function T<K extends CatalogKey>(props: { k: KeyArg<K> })` 형태로 쓴다.
 */
export type KeyArg<K extends CatalogKey> = K extends TKey ? K : CatalogKey extends K ? K : never;

const TABLE: ReadonlyMap<string, string> = new Map(Object.entries(CATALOG));
const FILES: Readonly<Record<CatalogFile, Readonly<Record<string, string>>>> = {
  components: COMPONENTS_KO,
  screens: SCREENS_KO,
  engine: ENGINE_CHECKED,
};

/** 카탈로그 원문 조회(없으면 undefined). 렌더에는 t()·segments()를 쓴다 */
export function lookup(key: string): string | undefined {
  return TABLE.get(key);
}
export function hasKey(key: string): boolean {
  return TABLE.has(key);
}
/** 파일별 키 목록(린트·생성기용) */
export function catalogEntries(file: CatalogFile): readonly (readonly [string, string])[] {
  return Object.entries(FILES[file]);
}
/** E 카탈로그가 병합됐는지(생성기·가드 테스트가 'E 대기' 표시에 쓴다) */
export function engineCatalogMerged(): boolean {
  return Object.keys(FILES.engine).length > 0;
}

/** 키의 첫 세그먼트로 소속 파일을 판정(형식이 아니면 null) */
export function fileOfKey(key: string): CatalogFile | null {
  if (!KEY_RE.test(key)) return null;
  const seg = key.split(".")[1] ?? "";
  if ((C_SEGMENTS as readonly string[]).includes(seg)) return "components";
  if ((S_SEGMENTS as readonly string[]).includes(seg)) return "screens";
  if ((E_SEGMENTS as readonly string[]).includes(seg)) return "engine";
  return null;
}

/* ───────── 파라미터 ───────── */
/** t()가 받는 파라미터. DisplayValue는 받지 않는다(디자인 §5-0, 키 규칙 10) */
export type TextParam = number | string | { readonly t: IsoUtc } | { readonly d: IsoDate };
/** 사용자 데이터가 아닌 MsgParam */
export type MsgTextParam = Exclude<MsgParam, { readonly v: DisplayValue }>;

/** 사용자 데이터가 아닌 파라미터를 글자로. 그 밖의 값(DisplayValue·{v}·모르는 객체)은 빈 문자열(그리지 않는다) */
export function paramText(p: TextParam | MsgTextParam): string {
  if (typeof p === "number") return fmtNum(p);
  if (typeof p === "string") return p;
  if (typeof p !== "object" || p === null) return "";
  if ("n" in p && typeof p.n === "number") return fmtNum(p.n);
  if ("t" in p && typeof p.t === "string") return fmtTime(p.t, "full");
  if ("d" in p && typeof p.d === "string") return p.d;
  if ("c" in p && typeof p.c === "string") return p.c;
  return "";
}

/** MsgParam 판별(T.tsx·Msg가 분기에 쓴다) */
export function isDisplayParam(p: unknown): p is { readonly v: DisplayValue } {
  return typeof p === "object" && p !== null && "v" in p;
}
export function isTimeParam(p: unknown): p is { readonly t: IsoUtc } {
  return typeof p === "object" && p !== null && "t" in p && typeof (p as { t: unknown }).t === "string";
}

/* ───────── 조립 ───────── */
export type Seg<P> =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "param"; readonly name: string; readonly value: P | undefined };

const PARAM_RE = /\{([A-Za-z][A-Za-z0-9]*)\}/g;

/** 카탈로그에 없는 키의 표시(개발 중 눈에 띄게. 렌더 테스트는 ⟦ 0건을 검사한다) */
export function missingText(key: string): string {
  return `⟦${key}⟧`;
}

/** 키의 문장을 조각으로 나눈다. t()와 <T>가 같은 파서를 쓴다(조립 규칙의 단일 구현). 없는 키는 ⟦키⟧ 한 조각 */
export function segments<P, K extends CatalogKey = CatalogKey>(key: KeyArg<K>, params?: Readonly<Record<string, P>>): readonly Seg<P>[] {
  const template = TABLE.get(key);
  if (template === undefined) return [{ kind: "text", text: missingText(key) }];
  return parseTemplate(template, params);
}

/** 문장 템플릿 파서(순수 함수): "{name}"을 파라미터 조각으로 */
export function parseTemplate<P>(template: string, params?: Readonly<Record<string, P>>): readonly Seg<P>[] {
  const out: Seg<P>[] = [];
  let last = 0;
  for (const m of template.matchAll(PARAM_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: "text", text: template.slice(last, at) });
    const name = m[1] ?? "";
    out.push({ kind: "param", name, value: params === undefined ? undefined : params[name] });
    last = at + m[0].length;
  }
  if (last < template.length) out.push({ kind: "text", text: template.slice(last) });
  return out;
}

/** 카탈로그 문자열. 빠진 파라미터는 {이름} 그대로 남긴다(조용히 지우지 않는다) */
export function t<K extends CatalogKey>(key: KeyArg<K>, params?: Readonly<Record<string, TextParam>>): string {
  return joinText(segments<TextParam, K>(key, params));
}

/** 조각 → 문자열(t()의 본체). 파라미터는 paramText()로만 글자가 된다 */
export function joinText(segs: readonly Seg<TextParam>[]): string {
  let s = "";
  for (const seg of segs) s += seg.kind === "text" ? seg.text : seg.value === undefined ? `{${seg.name}}` : paramText(seg.value);
  return s;
}

/* ───────── 엔진 코드 → 키(키 규칙 7·11의 단일 구현) ───────── */
const UNKNOWN_REASON_SET: Readonly<Record<UnknownReason, true>> = {
  denied: true, error: true, throttled: true, truncated: true, unsupported: true, "budget-exceeded": true,
  "region-missing": true, "subscription-missing": true, "scope-unproven": true, "csv-scope-unproven": true, "csv-row-ambiguous": true,
  "field-missing": true, "value-unrecognized": true, "schema-unsupported": true, "parse-failed": true, "not-collected": true,
  "stale-evidence": true, "population-mismatch": true, "clear-without-evidence": true, "no-clear-rule": true, "guide-only": true,
};
/** 확인 불가 공통 사유 21종(모델 UnknownReason과 1:1 — 빠지거나 남으면 위 Record가 컴파일 오류) */
export const UNKNOWN_REASONS = Object.keys(UNKNOWN_REASON_SET) as readonly UnknownReason[];

export function isUnknownReason(code: string): code is UnknownReason {
  return Object.prototype.hasOwnProperty.call(UNKNOWN_REASON_SET, code);
}

/**
 * MsgRef.code → 카탈로그 키.
 *  UnknownReason            → cc.reason.unknown.<code>
 *  isolated-denial · no-targets-proven → cc.reason.<code>
 *  fact:<slug>              → cc.fact.<slug>
 *  <RuleId>:<slug>          → cc.reason.<rule-id 소문자>.<slug>
 */
export function keyOf(code: MessageCode): EngineKey {
  if (isUnknownReason(code)) return `cc.reason.unknown.${code}`;
  const c = code.toLowerCase();
  if (c === "isolated-denial" || c === "no-targets-proven") return `cc.reason.${c}`;
  if (c.startsWith("fact:")) return `cc.fact.${c.slice(5)}`;
  const i = c.indexOf(":");
  return i > 0 ? `cc.reason.${c.slice(0, i)}.${c.slice(i + 1)}` : `cc.reason.${c}`;
}

/** gaps 나열·범위 패널용 짧은 이름: cc.reason.short.<code>(디자인 D13) */
export function shortKeyOf(reason: UnknownReason): EngineKey {
  return `cc.reason.short.${reason}`;
}

/* ───────── 표기(UX §6-10) ───────── */
/** 천 단위 쉼표. Intl을 쓰지 않는다(같은 입력 = 같은 글자) */
export function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const sign = n < 0 ? "-" : "";
  const [int = "0", frac] = Math.abs(n).toString().split(".");
  return sign + int.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (frac === undefined ? "" : `.${frac}`);
}

const ISO_UTC_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-]00:00)$/;
const pad2 = (x: number): string => (x < 10 ? `0${x}` : String(x));

/**
 * UTC 시각 표기. KST는 UTC+9를 산술로 더한다(로케일·Intl 미사용).
 *  full  "2026-10-19 12:12 KST (03:12 UTC)" / short "10-19 12:12 KST" / utc "2026-10-19 03:12 UTC"(호출 기록)
 * 형식이 아닌 값은 그대로 돌려준다(눈에 띄게 실패).
 */
export function fmtTime(at: IsoUtc, form: "full" | "short" | "utc"): string {
  const m = ISO_UTC_RE.exec(at);
  if (m === null) return at;
  const [, y, mo, d, h, mi, s] = m.map(Number) as [number, number, number, number, number, number, number];
  const utc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const kst = new Date(utc.getTime() + 9 * 3_600_000);
  const date = (x: Date): string => `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
  const hm = (x: Date): string => `${pad2(x.getUTCHours())}:${pad2(x.getUTCMinutes())}`;
  if (form === "short") return `${pad2(kst.getUTCMonth() + 1)}-${pad2(kst.getUTCDate())} ${hm(kst)} KST`;
  if (form === "utc") return `${date(utc)} ${hm(utc)} UTC`;
  return `${date(kst)} ${hm(kst)} KST (${hm(utc)} UTC)`;
}

/** 파일 크기: KB / MB, 소수 첫째 자리(1 KB = 1024 B — LIMITS의 MB와 같은 단위) */
export function fmtBytes(bytes: number): string {
  const mb = 1024 * 1024;
  if (bytes >= mb) return `${(Math.round((bytes / mb) * 10) / 10).toFixed(1)} MB`;
  return `${(Math.round((bytes / 1024) * 10) / 10).toFixed(1)} KB`;
}
