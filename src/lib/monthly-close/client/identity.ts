/**
 * 브라우저 신원과 로컬 기억 (방향서 §4-3, 디자인 A11·A12).
 *  - 비밀키: localStorage `mc:key`, crypto.getRandomValues 16바이트 → 소문자 hex 32자(MC_KEY_RE). URL·로그에 절대 넣지 않는다.
 *  - 테스트 표시: localStorage `mc:test`가 있으면 헤더 x-mc-test: 1.
 *  - 저장소를 못 쓰는 환경(사생활 보호 모드)이면 메모리에만 둔다.
 */

import { MC_KEY_RE } from '../protocol';
import { NICKNAME_MAX, INDUSTRIES, type IndustryId } from '../constants';

const mem = new Map<string, string>();

function read(storage: 'local' | 'session', key: string): string | null {
  try {
    const s = storage === 'local' ? window.localStorage : window.sessionStorage;
    return s.getItem(key) ?? mem.get(`${storage}:${key}`) ?? null;
  } catch {
    return mem.get(`${storage}:${key}`) ?? null;
  }
}
function write(storage: 'local' | 'session', key: string, value: string): void {
  mem.set(`${storage}:${key}`, value);
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    /* 메모리 폴백 */
  }
}
function remove(storage: 'local' | 'session', key: string): void {
  mem.delete(`${storage}:${key}`);
  try {
    (storage === 'local' ? window.localStorage : window.sessionStorage).removeItem(key);
  } catch {
    /* 무시 */
  }
}

/** crypto.getRandomValues가 없는 환경(아주 오래된 브라우저 등). 비밀키를 만들지 않고 오류 화면(E4)으로 간다 */
export class NoCryptoError extends Error {
  constructor() {
    super('crypto.getRandomValues unavailable');
    this.name = 'NoCryptoError';
  }
}

export function cryptoAvailable(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function';
}

/**
 * 안전한 난수 hex. crypto.getRandomValues로만 만든다(D3 백엔드 요청: Math.random 대체 경로 제거 — 예측 가능한 비밀키 방지).
 * crypto가 없으면 NoCryptoError를 던진다.
 */
export function randomHex(bytes: number): string {
  if (!cryptoAvailable()) throw new NoCryptoError();
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** 비밀키(없으면 만든다). crypto가 없으면 NoCryptoError — api.ts가 SERVICE_DOWN(E4)으로 바꾼다 */
export function getPlayerKey(): string {
  const cur = read('local', 'mc:key');
  if (cur && MC_KEY_RE.test(cur)) return cur;
  const fresh = randomHex(16);
  write('local', 'mc:key', fresh);
  return fresh;
}

export function isTestMode(): boolean {
  return read('local', 'mc:test') !== null;
}

/** 요청 중복 제거 키(≤ ACTION_ID_MAX 64) */
export function newActionId(): string {
  return randomHex(12);
}

// ── 입력 기억 ──
export function getLastIndustry(): IndustryId {
  const v = Number(read('local', 'mc:industry'));
  return v === 1 || v === 2 ? v : 0;
}
export function setLastIndustry(id: IndustryId): void {
  write('local', 'mc:industry', String(id));
}
export function getSavedNickname(): string | null {
  const v = read('local', 'mc:nick');
  return v ? Array.from(v).slice(0, NICKNAME_MAX).join('') : null;
}
export function setSavedNickname(n: string): void {
  write('local', 'mc:nick', n);
}
/** 기본 닉네임 "편집자37" 같은 표시용 이름 */
export function defaultNickname(): string {
  return `편집자${10 + Math.floor(Math.random() * 90)}`;
}

export function isPracticeDone(): boolean {
  return read('local', 'mc:practiceDone') !== null;
}
export function setPracticeDone(): void {
  write('local', 'mc:practiceDone', '1');
}

// ── 최근 문서(홈 표) ──
export interface RecentDoc {
  readonly code: string;
  readonly industry: IndustryId;
  /** 마지막 입장 시각 ms */
  readonly at: number;
}
export function getRecentDocs(now: number): RecentDoc[] {
  try {
    const raw = read('local', 'mc:recent');
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((x): x is RecentDoc => !!x && typeof x.code === 'string' && typeof x.at === 'number' && INDUSTRIES[x.industry as number] !== undefined)
      .filter((x) => now - x.at < 30 * 60_000)
      .slice(0, 5);
  } catch {
    return [];
  }
}
export function addRecentDoc(doc: RecentDoc): void {
  const rest = getRecentDocs(doc.at).filter((d) => d.code !== doc.code);
  write('local', 'mc:recent', JSON.stringify([doc, ...rest].slice(0, 5)));
}
export function clearRecentDoc(code: string): void {
  const rest = getRecentDocs(Date.now()).filter((d) => d.code !== code);
  if (rest.length === 0) remove('local', 'mc:recent');
  else write('local', 'mc:recent', JSON.stringify(rest));
}

// ── 방금 만든 방 (디자인 A9 예외) ──
/**
 * A9 "자리가 있는 방은 항상 숨김으로 시작"은 새로고침·다시 열기용이다. 홈에서 [새 문서]로 방을 만든 직후의
 * 첫 진입은 다시 열기가 아니므로(공유 패널을 바로 봐야 한다) 한 번만 게임 화면으로 연다.
 * sessionStorage에 남기고 첫 진입에서 지운다 → 그 뒤 새로고침은 다시 숨김으로 시작.
 */
export function markFreshRoom(code: string): void {
  write('session', `mc:fresh:${code}`, '1');
}
/** 지우지 않고 보기만(첫 sync가 보고할 화면 상태를 정할 때 — 지우는 건 GameScreen의 takeFreshRoom) */
export function peekFreshRoom(code: string): boolean {
  return read('session', `mc:fresh:${code}`) !== null;
}
export function takeFreshRoom(code: string): boolean {
  const k = `mc:fresh:${code}`;
  const v = read('session', k) !== null;
  if (v) remove('session', k);
  return v;
}

// ── 숨기기 시트 seed (방 번호 + 비밀키 앞부분, sessionStorage 보존) ──
export function getDisguiseSeed(code: string | null): string {
  const k = `mc:seed:${code ?? 'practice'}`;
  const cur = read('session', k);
  if (cur) return cur;
  // seed는 비밀이 아니다(숫자 모양만 정함). crypto가 없어도 화면은 그려야 하므로 시각으로 대신한다
  let fresh: string;
  try {
    fresh = `${code ?? 'practice'}:${getPlayerKey().slice(0, 8)}:${randomHex(4)}`;
  } catch {
    fresh = `${code ?? 'practice'}:${Date.now().toString(16)}`;
  }
  write('session', k, fresh);
  return fresh;
}
