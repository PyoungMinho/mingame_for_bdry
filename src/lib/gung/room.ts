/**
 * 방 코드 — 생성·정규화·파싱·검증 + 사건 표식(단어쌍) + 입장 URL. (디자인 스펙 §7-1)
 *
 * 형식   : 4자 시드 + 1자 인원 → 저장/URL '7F3K5', 표시 '7F3K-5'
 * 시드   : 23456789ABCDEFGHJKMNPQRSTUVWXYZ (31종, 0 O 1 I L 제외) → 31⁴ ≈ 92만
 * 생성   : crypto.getRandomValues (방장 폰에서만, Math.random 금지). 모듈로 편향 없는 거절 샘플링.
 * 표식   : caseTag(code) — 방장 화면과 대조해 코드 오타를 잡는 단어쌍("달빛 매화"). 시드 + 인원 둘 다 반영
 */
import { hash32 } from './rng';
import type { PlayerCount } from './types';

export const ROUTE_PATH = '/gung';
export const SEED_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const SEED_LENGTH = 4;
export const CODE_LENGTH = SEED_LENGTH + 1;
export const CODE_RE = /^[2-9A-HJKMNP-Z]{4}[4-6]$/;

/** 사건 표식 단어 — 순서가 바뀌면 같은 코드의 표식이 바뀐다(=기기 간 불일치). 절대 재정렬 금지. */
export const TAG_A = [
  '달빛', '새벽', '안개', '촛불', '비단', '옥빛', '서리', '먹빛',
  '단풍', '청자', '봉황', '대숲', '눈발', '금박', '연기', '은장',
] as const;
export const TAG_B = [
  '매화', '난초', '국화', '대나무', '학', '나비', '거북', '사슴',
  '연꽃', '모란', '소나무', '까치', '두루미', '석류', '목련', '해태',
] as const;

export interface RoomCode {
  /** 저장·URL 형 '7F3K5' */
  code: string;
  /** 앞 4자 '7F3K' — 배정·단서 시드 */
  seed: string;
  n: PlayerCount;
  /** 표시형 '7F3K-5' */
  display: string;
  /** 사건 표식 '달빛 매화' */
  tag: string;
}

export type RandomBytes = (length: number) => Uint8Array;

/** 기본 난수원 — Web Crypto. 없으면 throw(Math.random 대체 금지). */
export const cryptoBytes: RandomBytes = (length) => {
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('crypto.getRandomValues unavailable');
  const out = new Uint8Array(length);
  c.getRandomValues(out);
  return out;
};

export function isPlayerCount(v: unknown): v is PlayerCount {
  return v === 4 || v === 5 || v === 6;
}

/** 시드 4자를 무편향으로 뽑는다. 248(=31×8) 이상 바이트는 버린다. */
export function generateSeed(bytes: RandomBytes = cryptoBytes): string {
  const limit = 256 - (256 % SEED_ALPHABET.length); // 248
  let out = '';
  let guard = 0;
  while (out.length < SEED_LENGTH) {
    const buf = bytes(8);
    for (let i = 0; i < buf.length && out.length < SEED_LENGTH; i++) {
      if (buf[i] < limit) out += SEED_ALPHABET[buf[i] % SEED_ALPHABET.length];
    }
    if (++guard > 1000) throw new Error('random source exhausted');
  }
  return out;
}

export function generateRoomCode(n: PlayerCount, bytes: RandomBytes = cryptoBytes): RoomCode {
  if (!isPlayerCount(n)) throw new Error(`invalid player count ${String(n)}`);
  const room = parseRoomCode(generateSeed(bytes) + String(n));
  if (!room) throw new Error('generated invalid code');
  return room;
}

/** 대문자화 + 하이픈·공백·점·밑줄 제거. 검증은 하지 않는다. */
export function normalizeCode(input: string): string {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[\s\-_.·‐‑‒–—―]/g, '');
}

/**
 * CodeInput(§5-24)용 — 허용 문자만 자리별로 걸러 최대 5자. 붙여넣기 분배에도 쓴다.
 * 앞 4자는 시드 문자, 5번째는 4~6만 받는다. 그 외 문자는 조용히 무시.
 */
export function filterCodeInput(raw: string): string {
  let out = '';
  for (const ch of normalizeCode(raw)) {
    if (out.length >= CODE_LENGTH) break;
    if (out.length < SEED_LENGTH) {
      if (SEED_ALPHABET.includes(ch)) out += ch;
    } else if (ch === '4' || ch === '5' || ch === '6') {
      out += ch;
    }
  }
  return out;
}

export function isValidRoomCode(input: string): boolean {
  return CODE_RE.test(normalizeCode(input));
}

export function parseRoomCode(input: string): RoomCode | null {
  const code = normalizeCode(input);
  if (!CODE_RE.test(code)) return null;
  const seed = code.slice(0, SEED_LENGTH);
  const n = Number(code[SEED_LENGTH]) as PlayerCount;
  return { code, seed, n, display: `${seed}-${n}`, tag: caseTag(code) };
}

/** '7F3K5' → '7F3K-5'. 형식이 틀리면 정규화한 원문 그대로. */
export function formatRoomCode(code: string): string {
  const c = normalizeCode(code);
  return CODE_RE.test(c) ? `${c.slice(0, SEED_LENGTH)}-${c.slice(SEED_LENGTH)}` : c;
}

/**
 * 인원 자리(5번째 글자)별 표식 밀기 — 16 을 법으로 서로 다른 값이어서, 같은 시드라도 4·5·6인 표식은 **두 단어 모두** 다르다.
 * → 인원 숫자 하나만 잘못 친 코드(7F3K5 ↔ 7F3K6)도 표식 대조에서 반드시 걸린다(QA BUG-03).
 * 5인 = 0 이라 5인 표식(과 시드만 준 caseTag)은 예전 값 그대로다.
 */
const TAG_SHIFT: Record<PlayerCount, number> = { 4: 11, 5: 0, 6: 5 };

/**
 * caseTag(code) = A[(h + s) % 16] + ' ' + B[((h >>> 4) + s) % 16], h = hash32('gung:tag:' + seed), s = TAG_SHIFT[n]
 * 시드 4자만 주면 s = 0(5인과 같은 값). 표시용일 뿐 배정·단서 시드에는 쓰지 않는다.
 */
export function caseTag(codeOrSeed: string): string {
  const norm = normalizeCode(codeOrSeed);
  const h = hash32('gung:tag:' + norm.slice(0, SEED_LENGTH));
  const nChar = Number(norm[SEED_LENGTH]);
  const s = isPlayerCount(nChar) ? TAG_SHIFT[nChar] : 0;
  return `${TAG_A[(h + s) % 16]} ${TAG_B[((h >>> 4) + s) % 16]}`;
}

/**
 * 붙여넣은 글(코드 · 초대 문구 · 초대 URL)에서 방 코드 하나를 뽑는다(QA BUG-11).
 *  - `code=` 파라미터가 있으면 그것만 본다(URL 의 'https'·'gung' 글자가 코드 칸으로 새지 않게).
 *  - URL 처럼 보이는데 code= 가 없으면 null.
 *  - 그 밖엔 글 안에서 **형식이 맞는** 코드(하이픈·공백 허용)를 찾는다. 없으면 null.
 */
export function extractRoomCode(text: string): string | null {
  const raw = String(text ?? '');
  const param = /[?&#]code=([^&#\s]*)/i.exec(raw);
  if (param) {
    let v = param[1];
    try {
      v = decodeURIComponent(v);
    } catch {
      /* 깨진 퍼센트 인코딩은 원문 그대로 */
    }
    const room = parseRoomCode(v);
    return room ? room.code : null;
  }
  if (/[a-z]+:\/\/|www\.|\/gung/i.test(raw)) return null;
  const whole = parseRoomCode(raw);
  if (whole) return whole.code;
  const m = /(?:^|[^0-9A-Z])([2-9A-HJKMNP-Z]{4})[\s\-_.·‐‑‒–—―]?([4-6])(?![0-9A-Z])/i.exec(raw.toUpperCase());
  return m ? m[1] + m[2] : null;
}

// ─────────────────────────────── URL ───────────────────────────────

function trimOrigin(origin: string): string {
  return origin.replace(/\/+$/, '');
}

/** 초대 링크 — `${origin}/gung?code=7F3K5&v=1` */
export function buildJoinUrl(origin: string, code: string, caseVersion?: number): string {
  const q = new URLSearchParams({ code: normalizeCode(code) });
  if (caseVersion !== undefined) q.set('v', String(caseVersion));
  return `${trimOrigin(origin)}${ROUTE_PATH}?${q.toString()}`;
}

/** 방장 복구 링크(폰 교체·외부 브라우저 전환) — `${origin}/gung?code=7F3K5&as=host` */
export function buildHostRecoveryUrl(origin: string, code: string): string {
  const q = new URLSearchParams({ code: normalizeCode(code), as: 'host' });
  return `${trimOrigin(origin)}${ROUTE_PATH}?${q.toString()}`;
}

export interface EntryParams {
  /** 유효한 코드면 파싱 결과 */
  room: RoomCode | null;
  /** URL 에 code 가 있었지만 형식이 틀림 */
  invalidCode: boolean;
  asHost: boolean;
  /** &v= 사건 버전(없거나 숫자가 아니면 null) */
  caseVersion: number | null;
}

/** `?code=7F3K5&as=host&v=1` 해석. URLSearchParams·검색 문자열·Next useSearchParams 모두 받는다. */
export function parseEntryParams(search: string | { get(name: string): string | null }): EntryParams {
  const q = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) : search;
  const raw = q.get('code');
  const room = raw ? parseRoomCode(raw) : null;
  const vRaw = q.get('v');
  const v = vRaw !== null && /^\d{1,4}$/.test(vRaw) ? Number(vRaw) : null;
  return {
    room,
    invalidCode: Boolean(raw) && !room,
    asHost: q.get('as') === 'host',
    caseVersion: v,
  };
}
