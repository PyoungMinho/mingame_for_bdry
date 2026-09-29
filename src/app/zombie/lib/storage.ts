/**
 * localStorage 래퍼 — 시크릿 모드·차단된 사이트 데이터·용량 초과에서도 절대 throw 하지 않는다.
 * 저장이 안 돼도 게임은 그 판 안에서는 정상 진행된다(새로고침 시 이어하기만 불가).
 */
export const KEYS = {
  run: 'zb:run:v1',
  endings: 'zb:endings:v1',
} as const;

export function readJSON(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* 무시 */
  }
}
