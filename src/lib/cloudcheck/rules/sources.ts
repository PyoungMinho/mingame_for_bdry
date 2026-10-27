// src/lib/cloudcheck/rules/sources.ts — 인바운드 출발지 해석(AWS-NET-1 · AZ-NET-1 공용, 순수 함수)
// 결정 D-1 · D-3 · D-4(docs/planning/cloudcheck-qa-decisions.md §2): 출발지를 문자열이 아니라 주소 범위로 본다.
//  - 앞뒤 공백은 trim한 뒤 해석한다. 호스트 비트가 켜진 값은 네트워크 주소로 맞춘다(10.1.2.3/8 → 10.0.0.0/8).
//  - 규칙 하나 안의 출발지 합집합이 IPv4 또는 IPv6 공간 전체를 빈틈없이 덮으면 '인터넷 전체'다(0.0.0.0/1 + 128.0.0.0/1 = 0.0.0.0/0).
//  - 넓은 공인 대역: IPv4 접두 ≤ /8(사설·예약 대역 안에 다 들어가는 값 제외), IPv6 접두 ≤ /16(공인 대역 2000::/3과 겹치는 값).
//  - 내용을 모르는 출발지: AWS 프리픽스 리스트, Azure 서비스 태그(VirtualNetwork · AzureLoadBalancer 제외).
//  - 내부 · 좁음(판정 제외): 그 밖의 CIDR · 단일 IP, 보안 그룹 참조(sgRefCount), ASG, VirtualNetwork, AzureLoadBalancer.
//  - 해석 불가: CIDR · IP · 태그 모양이 아닌 값, AWS에서 접두가 없는 값, 출발지가 하나도 없는 규칙. 다른 출발지에서 찾은 발견은 유지하고(INV-4) 이 플래그는 별도로 남는다.
// IPv6는 BigInt로 계산한다(esbuild target es2020). 현재 시각 · 난수 · 환경을 쓰지 않는다(INV-9).
import { BROAD_IPV4_PREFIX, BROAD_IPV6_PREFIX, RESERVED_IPV4_RANGES } from "./params";

/** IPv4 주소 범위(양 끝 포함). 접두 길이는 해석한 값 */
export interface Range4 { readonly lo: number; readonly hi: number; readonly prefix: number }
/** IPv6 주소 범위(양 끝 포함) */
export interface Range6 { readonly lo: bigint; readonly hi: bigint; readonly prefix: number }

const MAX4 = 2 ** 32 - 1;
const ZERO = BigInt(0);
const ONE = BigInt(1);
const SIXTEEN = BigInt(16);
const MAX6 = (ONE << BigInt(128)) - ONE;

/* ───────── 해석 ───────── */
const V4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/;

/** "a.b.c.d/n"(옥텟 0~255, n 0~32). allowBare면 접두 없는 단일 주소를 /32로 받는다. 모르는 모양이면 null */
export function parseV4(text: string, allowBare: boolean): Range4 | null {
  const m = V4_RE.exec(text.trim());
  if (m === null) return null;
  const o = [m[1], m[2], m[3], m[4]].map(Number);
  if (o.some((x) => x > 255)) return null;
  let prefix: number;
  if (m[5] === undefined) {
    if (!allowBare) return null;
    prefix = 32;
  } else {
    prefix = Number(m[5]);
    if (prefix > 32) return null;
  }
  const ip = ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
  const size = 2 ** (32 - prefix);
  const lo = Math.floor(ip / size) * size;
  return { lo, hi: lo + size - 1, prefix };
}

function groupsOf(part: string, allowV4Tail: boolean): number[] | null {
  if (part === "") return [];
  const items = part.split(":");
  const out: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const g = items[i];
    if (/^[0-9A-Fa-f]{1,4}$/.test(g)) { out.push(parseInt(g, 16)); continue; }
    if (allowV4Tail && i === items.length - 1 && /^\d{1,3}(\.\d{1,3}){3}$/.test(g)) {
      const o = g.split(".").map(Number);
      if (o.some((x) => x > 255)) return null;
      out.push(o[0] * 256 + o[1], o[2] * 256 + o[3]);
      continue;
    }
    return null;
  }
  return out;
}

/** IPv6 주소 하나를 128비트 정수로. 8그룹 또는 `::` 압축, 끝의 IPv4 꼬리를 받는다. 모르는 모양이면 null */
function parseV6Address(addr: string): bigint | null {
  if (!/^[0-9A-Fa-f:.]+$/.test(addr)) return null;
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = groupsOf(halves[0], halves.length === 1);
  if (head === null) return null;
  let groups: number[];
  if (halves.length === 1) {
    if (head.length !== 8) return null;
    groups = head;
  } else {
    const tail = groupsOf(halves[1], true);
    if (tail === null || head.length + tail.length > 7) return null;
    groups = [...head, ...new Array<number>(8 - head.length - tail.length).fill(0), ...tail];
  }
  let v = ZERO;
  for (const g of groups) v = (v << SIXTEEN) | BigInt(g);
  return v;
}

/** "주소/n"(n 0~128). allowBare면 접두 없는 단일 주소를 /128로 받는다. 모르는 모양이면 null */
export function parseV6(text: string, allowBare: boolean): Range6 | null {
  const t = text.trim();
  const slash = t.indexOf("/");
  const addr = slash < 0 ? t : t.slice(0, slash);
  let prefix: number;
  if (slash < 0) {
    if (!allowBare) return null;
    prefix = 128;
  } else {
    const pre = t.slice(slash + 1);
    if (!/^\d{1,3}$/.test(pre)) return null;
    prefix = Number(pre);
    if (prefix > 128) return null;
  }
  const value = parseV6Address(addr);
  if (value === null) return null;
  const mask = (ONE << BigInt(128 - prefix)) - ONE;
  const lo = value - (value & mask);
  return { lo, hi: lo | mask, prefix };
}

/* ───────── 합집합 · 넓은 대역 ───────── */
/** 구간들의 합집합이 IPv4 공간 전체(0.0.0.0 ~ 255.255.255.255)를 빈틈없이 덮는가 */
export function coversAll4(ranges: readonly Range4[]): boolean {
  let reach = -1;
  for (const r of [...ranges].sort((a, b) => a.lo - b.lo)) {
    if (r.lo > reach + 1) return false;
    if (r.hi > reach) reach = r.hi;
  }
  return reach >= MAX4;
}
/** 구간들의 합집합이 IPv6 공간 전체를 빈틈없이 덮는가 */
export function coversAll6(ranges: readonly Range6[]): boolean {
  let reach = -ONE;
  for (const r of [...ranges].sort((a, b) => (a.lo < b.lo ? -1 : a.lo > b.lo ? 1 : 0))) {
    if (r.lo > reach + ONE) return false;
    if (r.hi > reach) reach = r.hi;
  }
  return reach >= MAX6;
}

function mergeRanges4(ranges: readonly Range4[]): Range4[] {
  const out: Range4[] = [];
  for (const r of [...ranges].sort((a, b) => a.lo - b.lo)) {
    const last = out[out.length - 1];
    if (last !== undefined && r.lo <= last.hi + 1) out[out.length - 1] = { lo: last.lo, hi: Math.max(last.hi, r.hi), prefix: 0 };
    else out.push(r);
  }
  return out;
}
const RESERVED4: readonly Range4[] = mergeRanges4(RESERVED_IPV4_RANGES.flatMap((c) => { const r = parseV4(c, false); return r === null ? [] : [r]; }));
/** 2000::/3 — 지금 공인 주소로 배정되는 IPv6 대역 */
const GLOBAL6: Range6 = parseV6("2000::/3", false) ?? { lo: ZERO, hi: ZERO, prefix: 3 };

/** 이 구간이 사설·예약 대역 안에 다 들어가는가 */
export const withinReserved4 = (r: Range4): boolean => RESERVED4.some((x) => x.lo <= r.lo && r.hi <= x.hi);
/** 넓은 공인 IPv4 대역: 접두 ≤ /8이면서 사설·예약 대역 안에 다 들어가지 않는 값 */
export const isBroad4 = (r: Range4): boolean => r.prefix <= BROAD_IPV4_PREFIX && !withinReserved4(r);
/** 넓은 공인 IPv6 대역: 접두 ≤ /16이면서 공인 대역(2000::/3)과 겹치는 값 */
export const isBroad6 = (r: Range6): boolean => r.prefix <= BROAD_IPV6_PREFIX && r.lo <= GLOBAL6.hi && r.hi >= GLOBAL6.lo;

/* ───────── 표시 문자열 ───────── */
/** 정규형(네트워크 주소/접두) IPv4 문자열 */
export function text4(r: Range4): string {
  const ip = r.lo;
  return `${Math.floor(ip / 16_777_216) % 256}.${Math.floor(ip / 65_536) % 256}.${Math.floor(ip / 256) % 256}.${ip % 256}/${r.prefix}`;
}
/** 접두 ≤ /16인 IPv6 값의 문자열(첫 그룹만 남고 나머지는 0이라 `<그룹>::/n` 꼴). 그보다 긴 접두는 쓰지 않는다 */
export function text6(r: Range6): string {
  const g0 = Number(r.lo >> BigInt(112));
  return g0 === 0 ? `::/${r.prefix}` : `${g0.toString(16)}::/${r.prefix}`;
}

const uniq = (xs: readonly string[]): string[] => [...new Set(xs)];
const FACT_PIECES = 3;

/* ───────── AWS 규칙 하나의 출발지 ───────── */
export interface AwsRuleSources {
  /** 합집합이 IPv4 전체 · IPv6 전체를 덮는가 */
  readonly whole4: boolean;
  readonly whole6: boolean;
  /** 전체일 때 사실 줄에 보일 값: 실제 출발지 가운데 접두 ≤ /8(IPv6 /16)인 조각을 최대 3개, 없으면 0.0.0.0/0 · ::/0 */
  readonly wholeText4: readonly string[];
  readonly wholeText6: readonly string[];
  /** 전체가 아닌 쪽의 넓은 공인 대역(IPv4 · IPv6, 정규형) */
  readonly broad: readonly string[];
  /** 프리픽스 리스트 ID(내용은 읽지 않는다) */
  readonly prefixLists: readonly string[];
  /** 해석하지 못한 값이 있거나 출발지가 하나도 없는 규칙 */
  readonly unrecognized: boolean;
}

export interface AwsSourceInput {
  readonly cidrs: readonly string[];
  readonly ipv6Cidrs: readonly string[];
  readonly prefixListIds: readonly string[];
  readonly sgRefCount: number;
}

export function classifyAwsSources(rule: AwsSourceInput): AwsRuleSources {
  let unrecognized = false;
  const v4: Range4[] = [];
  const v6: Range6[] = [];
  for (const c of rule.cidrs) { const r = parseV4(c, false); if (r === null) unrecognized = true; else v4.push(r); }
  for (const c of rule.ipv6Cidrs) { const r = parseV6(c, false); if (r === null) unrecognized = true; else v6.push(r); }
  const lists: string[] = [];
  for (const id of rule.prefixListIds) { const t = id.trim(); if (t === "") unrecognized = true; else lists.push(t); }
  if (rule.cidrs.length === 0 && rule.ipv6Cidrs.length === 0 && rule.prefixListIds.length === 0 && rule.sgRefCount === 0) unrecognized = true;
  const whole4 = v4.length > 0 && coversAll4(v4);
  const whole6 = v6.length > 0 && coversAll6(v6);
  const pieces4 = uniq(v4.filter((r) => r.prefix <= BROAD_IPV4_PREFIX).map(text4)).slice(0, FACT_PIECES);
  const pieces6 = uniq(v6.filter((r) => r.prefix <= BROAD_IPV6_PREFIX).map(text6)).slice(0, FACT_PIECES);
  const broad = [
    ...(whole4 ? [] : uniq(v4.filter(isBroad4).map(text4))),
    ...(whole6 ? [] : uniq(v6.filter(isBroad6).map(text6))),
  ];
  return {
    whole4, whole6,
    wholeText4: pieces4.length > 0 ? pieces4 : ["0.0.0.0/0"],
    wholeText6: pieces6.length > 0 ? pieces6 : ["::/0"],
    broad, prefixLists: uniq(lists), unrecognized,
  };
}

/* ───────── Azure 보안 규칙 하나의 출발지 ───────── */
export interface AzureRuleSources {
  /** *·Internet·Any 또는 합집합이 IPv4 전체 · IPv6 전체를 덮음 */
  readonly whole: boolean;
  /** 전체일 때 사실 줄에 보일 값: 와일드카드 글자가 있으면 "*", 합집합이면 접두 ≤ /8(IPv6 /16)인 조각을 최대 3개(없으면 "*") */
  readonly wholeText: readonly string[];
  readonly broad: readonly string[];
  /** 서비스 태그(VirtualNetwork · AzureLoadBalancer 제외, 쓴 그대로의 이름) */
  readonly tags: readonly string[];
  readonly unrecognized: boolean;
}

/** 서비스 태그 모양: 영문자로 시작하고 영문·숫자·점만 있는 80자 이하 */
export const SERVICE_TAG_RE = /^[A-Za-z][A-Za-z0-9.]{0,79}$/;
const WHOLE_WORDS: ReadonlySet<string> = new Set(["*", "internet", "any"]);
const INTERNAL_TAGS: ReadonlySet<string> = new Set(["virtualnetwork", "azureloadbalancer"]);

export function classifyAzureSources(prefixes: readonly string[], asgCount: number | null): AzureRuleSources {
  let unrecognized = false;
  let word = false;
  const v4: Range4[] = [];
  const v6: Range6[] = [];
  const tags: string[] = [];
  for (const raw of prefixes) {
    const p = raw.trim();
    const l = p.toLowerCase();
    if (WHOLE_WORDS.has(l)) { word = true; continue; }
    if (INTERNAL_TAGS.has(l)) continue;
    const a = parseV4(p, true);
    if (a !== null) { v4.push(a); continue; }
    const b = parseV6(p, true);
    if (b !== null) { v6.push(b); continue; }
    if (SERVICE_TAG_RE.test(p)) { tags.push(p); continue; }
    unrecognized = true;
  }
  // 출발지가 하나도 없는 규칙: 접두 0개이고 ASG도 없거나 모름(보고서 CSV 경로의 ASG 개수 모름 포함)
  if (prefixes.length === 0 && (asgCount === null || asgCount === 0)) unrecognized = true;
  const whole4 = v4.length > 0 && coversAll4(v4);
  const whole6 = v6.length > 0 && coversAll6(v6);
  const pieces = [
    ...uniq(v4.filter((r) => r.prefix <= BROAD_IPV4_PREFIX).map(text4)),
    ...uniq(v6.filter((r) => r.prefix <= BROAD_IPV6_PREFIX).map(text6)),
  ].slice(0, FACT_PIECES);
  const broad = [
    ...(whole4 ? [] : uniq(v4.filter(isBroad4).map(text4))),
    ...(whole6 ? [] : uniq(v6.filter(isBroad6).map(text6))),
  ];
  return {
    whole: word || whole4 || whole6,
    wholeText: word || pieces.length === 0 ? ["*"] : pieces,
    broad, tags: uniq(tags), unrecognized,
  };
}
