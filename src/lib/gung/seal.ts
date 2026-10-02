/**
 * 공개 단서 인장(개선 묶음 1 · R5) — 장소 카드마다 방 안에서 겹치지 않는 4자리 번호.
 *
 * 원고 공통 규칙 3(원고 1-7 = 플레이어 뷰 2-4): 공개 = 방장 폰 공용 보드에 올림. 서버가 없으니 공개한 사람이 인장 번호를
 * 불러 주고 방장이 그 번호를 넣어 보드에 올린다. 번호는 `rng.ts` 해시로 `방코드|카드id|salt` 를 해시한 결정론 값이라
 * 같은 방이면 어느 폰에서나 같다.
 *
 * 인장은 보안 장치가 아니다 — 카드 본문은 이미 번들에 있다. **오탭·훑어보기 방지 장치**다: 방장이 장소·라운드를 골라
 * 아무 카드나 띄우는 경로(간편 모드)를 두지 않아, 숨긴 카드가 한 번의 오탭으로 전원에게 펼쳐지지 않게 한다.
 *
 * 규칙
 *  - 대상: 그 판 인원에 보이는 장소 카드 전체(id 정렬). 공용 카드(PB)·추가 증언에는 인장이 없다(이미 보드에 있다).
 *  - 범위: 1000~9999. 방 안에서 겹치면 salt 를 올려 다시 뽑는다.
 *  - clueBySeal 은 틀린 번호와 아직 들어서지 않은 라운드의 번호를 **같은 값(null)** 으로 돌려준다 — 어느 쪽인지 알려 주면
 *    번호의 유효성을 캐내는 신탁이 된다.
 */
import { cardsAtPlace, placeById, roundDef } from './deck';
import { hash32 } from './rng';
import type { CardId, GungCase, PlaceId, PlayerCount, RoundNo } from './types';

export const SEAL_MIN = 1000;
export const SEAL_MAX = 9999;
const SEAL_SPAN = SEAL_MAX - SEAL_MIN + 1;

/** 보드·인장이 가리키는 장소 카드 한 장(본문은 언제나 사건 데이터에서 다시 읽는다 — 저장하지 않는다) */
export interface PlaceCardRef {
  id: CardId;
  round: RoundNo;
  placeId: PlaceId;
  placeName: string;
  title: string;
  body: string;
}

const tableCache = new WeakMap<GungCase, Map<string, PlaceCardRef[]>>();

/** 그 판 인원에 보이는 장소 카드 전체 — id 정렬(인장 배정 순서의 기준) */
export function placeCardsFor(c: GungCase, n: PlayerCount): PlaceCardRef[] {
  let m = tableCache.get(c);
  if (!m) tableCache.set(c, (m = new Map()));
  const hit = m.get(String(n));
  if (hit) return hit;
  const out: PlaceCardRef[] = [];
  const seen = new Set<string>();
  for (const round of [1, 2, 3] as RoundNo[]) {
    for (const placeId of roundDef(c, round).placeIds) {
      for (const card of cardsAtPlace(c, n, round, placeId)) {
        if (seen.has(card.id)) continue;
        seen.add(card.id);
        out.push({ id: card.id, round, placeId, placeName: placeById(c, placeId)?.name ?? placeId, title: card.title, body: card.body });
      }
    }
  }
  out.sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  m.set(String(n), out);
  return out;
}

export function placeCardById(c: GungCase, n: PlayerCount, id: string): PlaceCardRef | null {
  return placeCardsFor(c, n).find((x) => x.id === id) ?? null;
}

const sealCache = new WeakMap<GungCase, Map<string, Map<CardId, number>>>();

/** 방 하나의 인장표(카드 id → 4자리). 결정론 — 같은 (사건, 인원, 코드) 면 어느 기기에서나 같다 */
export function sealTable(c: GungCase, n: PlayerCount, roomCode: string): Map<CardId, number> {
  let m = sealCache.get(c);
  if (!m) sealCache.set(c, (m = new Map()));
  const key = `${n}|${roomCode}`;
  const hit = m.get(key);
  if (hit) return hit;
  const used = new Set<number>();
  const table = new Map<CardId, number>();
  for (const card of placeCardsFor(c, n)) {
    let salt = 0;
    let seal = SEAL_MIN + (hash32(`${roomCode}|${card.id}|${salt}`) % SEAL_SPAN);
    while (used.has(seal)) {
      salt += 1;
      seal = SEAL_MIN + (hash32(`${roomCode}|${card.id}|${salt}`) % SEAL_SPAN);
    }
    used.add(seal);
    table.set(card.id, seal);
  }
  m.set(key, table);
  return table;
}

/** 그 카드의 인장 — 장소 카드가 아니면(공용·추가 증언·없는 id) null */
export function clueSeal(c: GungCase, n: PlayerCount, roomCode: string, cardId: string): number | null {
  return sealTable(c, n, roomCode).get(cardId) ?? null;
}

/** 4자리 숫자 문자열/수 → 인장 수(형식이 틀리면 null) */
export function parseSeal(v: string | number): number | null {
  const s = typeof v === 'number' ? String(v) : v.trim();
  if (!/^\d{4}$/.test(s)) return null;
  const x = Number(s);
  return x >= SEAL_MIN && x <= SEAL_MAX ? x : null;
}

/**
 * 인장 → 카드. upToRound = 방장 폰이 들어선 조사 라운드(reachedRound(phase)).
 * 없는 번호와 아직 들어서지 않은 라운드의 번호는 똑같이 null(신탁 방지).
 */
export function clueBySeal(c: GungCase, n: PlayerCount, roomCode: string, seal: string | number, upToRound: number): PlaceCardRef | null {
  const want = parseSeal(seal);
  if (want === null) return null;
  for (const [id, s] of sealTable(c, n, roomCode)) {
    if (s !== want) continue;
    const card = placeCardById(c, n, id);
    return card && card.round <= upToRound ? card : null;
  }
  return null;
}

/** 표시 id — 인원별 교체 카드의 꼬리 글자(HW-1b 의 b)는 교체 사실을 드러내므로 떼고 보인다(QA BUG-25) */
export function displayCardId(id: string): string {
  return id.replace(/[a-z]+$/, '');
}
