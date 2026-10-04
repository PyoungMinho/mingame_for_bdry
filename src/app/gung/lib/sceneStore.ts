'use client';

/**
 * 큰 화면(/gung/scene) 조사 칩 기록 — localStorage `gu:scene:v2`(12시간, 다른 방 코드면 새 기록, 저장소가 막히면 메모리).
 *
 * 7판(조사 따로): 공용 화면엔 관찰이 없으니 「본 물건」 기록(v1 의 seen)도 없다 — 지금 보는 조사와 확인을 거쳐 연 조사만 남긴다.
 * 게임 저장 `gu:game:v1` 은 읽지도 쓰지도 않는다(큰 화면은 게임 상태와 무관). 옛 v1 기록은 지울 때 함께 지운다.
 */
import { useCallback, useEffect, useState } from 'react';

export const SCENE_STORE_KEY = 'gu:scene:v2';
/** 6판 기록(본 물건 ✓ 포함) — 더는 쓰지 않는다. clearSceneStore 가 함께 지운다 */
export const LEGACY_SCENE_STORE_KEY = 'gu:scene:v1';
export const SCENE_STORE_TTL_MS = 12 * 60 * 60 * 1000;
const CODE_RE = /^[2-9A-HJKMNP-Z]{4}[4-6]$/;

type Round = 1 | 2 | 3;

export interface SceneStoreData {
  v: 2;
  /** 방 코드(없으면 null — 큰 화면을 코드 없이 연 경우) */
  code: string | null;
  /** 마지막으로 쓴 시각(ms) */
  at: number;
  /** 지금 보는 조사 */
  round: Round;
  /** 확인을 거쳐 연 가장 높은 조사 — ②③ 확인은 처음 한 번만 */
  opened: Round;
}

let memoryStore: SceneStoreData | null = null;

function asRound(v: unknown): Round | null {
  return v === 1 || v === 2 || v === 3 ? v : null;
}

/** 화이트리스트 파서 — 모양이 하나라도 어긋나면 null(깨진 기록은 버린다) */
export function parseSceneStore(raw: string | null): SceneStoreData | null {
  if (!raw) return null;
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const d = o as Record<string, unknown>;
  if (d.v !== 2 || typeof d.at !== 'number' || !Number.isFinite(d.at)) return null;
  const code = d.code === null ? null : typeof d.code === 'string' && CODE_RE.test(d.code) ? d.code : undefined;
  const round = asRound(d.round);
  const opened = asRound(d.opened);
  if (code === undefined || !round || !opened || round > opened) return null;
  return { v: 2, code, at: d.at, round, opened };
}

function emptyStore(code: string | null, now: number): SceneStoreData {
  return { v: 2, code, at: now, round: 1, opened: 1 };
}

/** 지금 기기에 남은 기록 — 12시간 지났거나 다른 방 코드면 새것(코드 없음도 하나의 '판') */
export function readSceneStore(code: string | null, now = Date.now()): SceneStoreData {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SCENE_STORE_KEY);
  } catch {
    raw = null;
  }
  const d = parseSceneStore(raw) ?? memoryStore;
  if (!d || now - d.at > SCENE_STORE_TTL_MS || d.at > now + 60_000) return emptyStore(code, now);
  if ((code ?? null) !== (d.code ?? null)) return emptyStore(code, now);
  return d;
}

function writeSceneStore(d: SceneStoreData): void {
  memoryStore = d;
  try {
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify(d));
  } catch {
    /* 저장소가 막혀도 메모리로 이번 화면은 유지 */
  }
}

/** 새 판·처음으로·새 방에서 부른다(수첩 지우기와 같은 자리) — 옛 v1 기록도 */
export function clearSceneStore(): void {
  memoryStore = null;
  for (const key of [SCENE_STORE_KEY, LEGACY_SCENE_STORE_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }
}

export interface BigScreenRoundApi {
  /** 마운트 뒤 기록을 읽었는가(SSR·첫 프레임엔 false) */
  ready: boolean;
  round: Round;
  opened: Round;
  setRound: (round: Round) => void;
}

/** 큰 화면 조사 칩 기록 훅 — 저장 실패에도 화면은 돈다 */
export function useBigScreenRound(code: string | null): BigScreenRoundApi {
  const [data, setData] = useState<SceneStoreData | null>(null);
  useEffect(() => {
    setData(readSceneStore(code));
  }, [code]);
  const setRound = useCallback(
    (round: Round) =>
      setData((prev) => {
        const base = prev ?? readSceneStore(code);
        const next: SceneStoreData = { ...base, round, opened: Math.max(base.opened, round) as Round, at: Date.now() };
        writeSceneStore(next);
        return next;
      }),
    [code],
  );
  return { ready: data !== null, round: data?.round ?? 1, opened: data?.opened ?? 1, setRound };
}
