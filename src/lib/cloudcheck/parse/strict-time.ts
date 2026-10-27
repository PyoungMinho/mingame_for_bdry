// src/lib/cloudcheck/parse/strict-time.ts — 엄격한 UTC 시각 파서 (방향서 §4-2 P6)
// Date.parse는 쓰지 않는다: 엔진마다 해석이 다르고(소수 초 자릿수, 오프셋, 월·일 넘침), 같은 파일이 환경에 따라 다른 나이를 만들면 INV-9가 깨진다.
// Instant = { iso: 초 단위 정규형 "YYYY-MM-DDTHH:MM:SSZ"(소수 초는 버림), ms: 같은 순간의 epoch 밀리초(1000의 배수) }
import type { Instant } from "../contract/normalized";
import type { IsoUtc } from "../model/report";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]00:00)$/;
const MIN_YEAR = 1970, MAX_YEAR = 2200;

const pad = (n: number, w = 2): string => String(n).padStart(w, "0");
/** epoch 밀리초(1000의 배수) → Instant. 범위를 벗어나면 null */
export function instantFromMs(ms: number): Instant | null {
  if (!Number.isFinite(ms) || ms % 1000 !== 0) return null;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  if (y < MIN_YEAR || y > MAX_YEAR) return null;
  return { iso: `${pad(y, 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}Z` as IsoUtc, ms };
}

/** "2026-10-19T03:12:00Z" · "2026-10-19T03:12:00.1234567+00:00" 형태만 받는다. 달력에 없는 날짜(2월 30일 등)·범위 밖 연도는 null */
export function parseInstant(s: string): Instant | null {
  const m = ISO_RE.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, se] = [m[1], m[2], m[3], m[4], m[5], m[6]].map(Number);
  if (y < MIN_YEAR || y > MAX_YEAR || mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59 || se > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi, se);
  const dt = new Date(ms);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return instantFromMs(ms);
}

/** 파일 이름에 들어 있는 UTC 시각(끝의 Z가 있는 것만): 2026-10-18T22_15_00Z(콜론 대신 밑줄·하이픈·점 허용) · 20261018T221500Z */
export function timeFromFileName(name: string): Instant | null {
  const a = /(\d{4})-(\d{2})-(\d{2})T(\d{2})[_:.-](\d{2})[_:.-](\d{2})Z/.exec(name);
  const b = /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(name);
  const m = a ?? b;
  if (!m) return null;
  return parseInstant(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
}
