// src/app/cloudcheck/_client/state/clock.ts — 현재 시각을 읽는 유일한 곳. 소유: 페이지개발자. 근거: 디자인 최종안 §6-0 clock 행.
//  - nowIso()    → timeNotices(report, now)에 넘기는 UTC 시각(초 단위, Z)
//  - todayLocal() → overlayExceptions(report, file, today)와 예외 폼 min/max에 쓰는 사용자 기기의 오늘 날짜(YYYY-MM-DD)
// 테스트는 vi.setSystemTime으로 시험한다. 엔진·계약은 시각을 읽지 않는다(INV-9) — 읽는 쪽은 여기뿐이다.
import type { IsoDate, IsoUtc } from "../../../../lib/cloudcheck/model/report";

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** 지금 시각(UTC, 소수 초 없음) */
export function nowIso(): IsoUtc {
  return new Date().toISOString().replace(/\.\d+Z$/, "Z") as IsoUtc;
}

/** 사용자 기기의 오늘 날짜(로컬 시간대 기준 — 예외 만료일은 사용자가 보는 날짜로 센다) */
export function todayLocal(): IsoDate {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` as IsoDate;
}

const DAY_MS = 86_400_000;
const parseDay = (s: string): number => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

/** 날짜에 n일을 더한다(YYYY-MM-DD, 시간대 영향 없음 — UTC 산술) */
export function addDays(date: IsoDate, n: number): IsoDate {
  const d = new Date(parseDay(date) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}` as IsoDate;
}

/** a부터 b까지 며칠(b - a). 형식이 아니면 NaN */
export function daysBetween(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY_MS);
}

/** YYYY-MM-DD 형식과 실제 달력 날짜인지 */
export function isIsoDate(s: string): s is IsoDate {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s)) return false;
  const d = new Date(parseDay(s));
  return d.getUTCFullYear() === Number(s.slice(0, 4)) && d.getUTCMonth() === Number(s.slice(5, 7)) - 1 && d.getUTCDate() === Number(s.slice(8, 10));
}
