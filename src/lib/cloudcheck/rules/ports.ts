// src/lib/cloudcheck/rules/ports.ts — 포트 범위 분류(AWS-NET-1 · AZ-NET-1 공용, 순수 함수)
// 구간 산술만 쓴다(65536칸 배열을 만들지 않는다). 포트는 0~65535 정수.
import { MAIL_PORTS, RISKY_PORTS, WEB_PORTS } from "./params";

export type Interval = readonly [number, number];
const MAX_PORT = 65535;

export interface PortClass {
  /** 범위에 들어 있는 위험 포트(오름차순) */
  readonly risky: readonly number[];
  /** 범위에 들어 있는 메일 포트 */
  readonly mail: readonly number[];
  /** 위험·메일 포트가 아니고 80·443도 아닌 포트가 하나라도 있음 */
  readonly other: boolean;
  /** 1~65535 전체를 연 것(위험으로 본다) */
  readonly all: boolean;
}

const norm = (list: readonly Interval[]): Interval[] => {
  const xs = list.filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b) && a <= b).map(([a, b]): Interval => [Math.max(0, a), Math.min(MAX_PORT, b)])
    .filter(([a, b]) => a <= b).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const out: [number, number][] = [];
  for (const [a, b] of xs) {
    const last = out[out.length - 1];
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
};

export const hasPort = (list: readonly Interval[], p: number): boolean => list.some(([a, b]) => a <= p && p <= b);
const count = (list: readonly Interval[]): number => list.reduce((n, [a, b]) => n + (b - a + 1), 0);

/** a에서 b를 뺀 구간 목록 */
export function subtract(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  let cur = norm(a);
  for (const [bs, be] of norm(b)) {
    const next: Interval[] = [];
    for (const [s, e] of cur) {
      if (be < s || bs > e) { next.push([s, e]); continue; }
      if (s < bs) next.push([s, bs - 1]);
      if (e > be) next.push([be + 1, e]);
    }
    cur = next;
  }
  return cur;
}

export function classifyPorts(list: readonly Interval[]): PortClass {
  const iv = norm(list);
  const risky = RISKY_PORTS.filter((p) => hasPort(iv, p));
  const mail = MAIL_PORTS.filter((p) => hasPort(iv, p));
  const known = norm([...RISKY_PORTS, ...MAIL_PORTS, ...WEB_PORTS].map((p): Interval => [p, p]));
  const rest = subtract(iv, known);
  // 0번 포트를 뺀 1~65535를 모두 덮으면 '전체'
  const all = count(subtract([[1, MAX_PORT]], iv)) === 0;
  return { risky, mail, other: count(rest) > 0, all };
}

/**
 * "22", "1000-2000", "*", "80,443"을 구간으로. 해석하지 못하는 조각이 있으면 ok = false(fail-closed로 쓴다).
 * 목록이 비었거나 빈 조각이 있어도 ok = false다 — 포트 칸이 비었다고 '열린 포트 없음'으로 읽지 않는다(CC-QA-17). 읽은 조각의 구간은 intervals에 남는다(양성 유지용).
 */
export function parsePortSpec(specs: readonly string[]): { readonly ok: boolean; readonly intervals: Interval[] } {
  const out: Interval[] = [];
  let ok = specs.length > 0;
  for (const spec of specs) {
    for (const raw of spec.split(",")) {
      const t = raw.trim();
      if (t === "") { ok = false; continue; }
      if (t === "*") { out.push([0, MAX_PORT]); continue; }
      const m = /^(\d{1,5})(?:\s*-\s*(\d{1,5}))?$/.exec(t);
      if (!m) { ok = false; continue; }
      const a = Number(m[1]);
      const b = m[2] === undefined ? a : Number(m[2]);
      if (a > MAX_PORT || b > MAX_PORT || a > b) { ok = false; continue; }
      out.push([a, b]);
    }
  }
  return { ok, intervals: norm(out) };
}

/** 화면 사실 문구용 포트 표기: "22, 3389" (엔진은 문장을 만들지 않는다. 쉼표 나열만) */
export const portList = (ports: readonly number[]): string => ports.join(", ");
