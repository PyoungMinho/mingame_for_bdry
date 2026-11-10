/** 배치 검증·자동 배치·발사 판정 보조. 순수 TS. */

import { BOARD_SIZE, SHIP_LENGTH, SHIP_SLOTS, type ShipSlot } from '../constants';
import {
  ALL_CELLS,
  isCellAddr,
  placementCells,
  rangeCells,
  hintRange,
  type CellAddr,
  type HintTarget,
  type ShipPlacement,
} from '../coords';
import type { Rng } from './types';

export type FleetCheck = { ok: true } | { ok: false; reason: 'ships' };

function isPlacementShape(p: unknown): p is ShipPlacement {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.slot === 'string' &&
    (SHIP_SLOTS as readonly string[]).includes(o.slot) &&
    isCellAddr(o.start) &&
    (o.dir === 'h' || o.dir === 'v')
  );
}

/**
 * 배치 초안 검증: 0~3개, 슬롯 중복 없음, 전부 판 안, 겹침 없음(맞닿음은 허용).
 * complete = true면 3개 모두 있어야 한다(배치 완료).
 */
export function checkFleet(ships: readonly unknown[], complete: boolean): FleetCheck {
  if (ships.length > SHIP_SLOTS.length) return { ok: false, reason: 'ships' };
  if (complete && ships.length !== SHIP_SLOTS.length) return { ok: false, reason: 'ships' };
  const slots = new Set<ShipSlot>();
  const used = new Set<CellAddr>();
  for (const p of ships) {
    if (!isPlacementShape(p)) return { ok: false, reason: 'ships' };
    if (slots.has(p.slot)) return { ok: false, reason: 'ships' };
    slots.add(p.slot);
    const cells = placementCells(p);
    if (!cells) return { ok: false, reason: 'ships' };
    for (const c of cells) {
      if (used.has(c)) return { ok: false, reason: 'ships' };
      used.add(c);
    }
  }
  return { ok: true };
}

/** 정규화: 슬롯 순서(L4, L3, L2)로 정렬한 새 배열, 필드만 복사. */
export function normalizeFleet(ships: readonly ShipPlacement[]): ShipPlacement[] {
  return SHIP_SLOTS.flatMap((slot) => {
    const p = ships.find((s) => s.slot === slot);
    return p ? [{ slot: p.slot, start: p.start, dir: p.dir }] : [];
  });
}

function pickInt(rng: Rng, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** 이미 놓인 배를 피해서 남은 슬롯에 무작위로 배를 놓는다. 판이 8×8이라 항상 성공한다. */
export function completeFleet(existing: readonly ShipPlacement[], rng: Rng): ShipPlacement[] {
  const fleet = normalizeFleet(existing);
  const used = new Set<CellAddr>(fleet.flatMap((p) => placementCells(p) ?? []));
  for (const slot of SHIP_SLOTS) {
    if (fleet.some((p) => p.slot === slot)) continue;
    const len = SHIP_LENGTH[slot];
    const options: ShipPlacement[] = [];
    for (const start of ALL_CELLS) {
      for (const dir of ['h', 'v'] as const) {
        const p: ShipPlacement = { slot, start, dir };
        const cells = placementCells(p);
        if (cells && cells.length === len && cells.every((c) => !used.has(c))) options.push(p);
      }
    }
    // 8×8에 3척이므로 options가 비는 일은 없다(최악에도 수십 개).
    const chosen = options[pickInt(rng, options.length)];
    fleet.push(chosen);
    for (const c of placementCells(chosen) ?? []) used.add(c);
  }
  return normalizeFleet(fleet);
}

/** 완전 무작위 배치(자동 배치 버튼·봇). */
export function randomFleet(rng: Rng): ShipPlacement[] {
  return completeFleet([], rng);
}

/** 배 한 척의 칸 집합. */
export function fleetCells(ships: readonly ShipPlacement[]): Set<CellAddr> {
  return new Set(ships.flatMap((p) => placementCells(p) ?? []));
}

/** 힌트 값: 조회 범위 안의 배 칸 수(이미 맞힌 칸 포함). */
export function countShipCellsInHint(ships: readonly ShipPlacement[], target: HintTarget): number {
  const cells = fleetCells(ships);
  let n = 0;
  for (const c of rangeCells(hintRange(target))) if (cells.has(c)) n++;
  return n;
}

export type FireJudgement =
  | { result: 'miss' }
  | { result: 'hit'; ship: ShipPlacement }
  | { result: 'sunk'; ship: ShipPlacement };

/** 발사 판정: alreadyHit = 이 배 칸 중 이미 맞은 칸(이번 발 제외). */
export function judgeFire(target: readonly ShipPlacement[], cell: CellAddr, alreadyHit: ReadonlySet<CellAddr>): FireJudgement {
  for (const ship of target) {
    const cells = placementCells(ship) ?? [];
    if (!cells.includes(cell)) continue;
    const left = cells.filter((c) => c !== cell && !alreadyHit.has(c));
    return left.length === 0 ? { result: 'sunk', ship } : { result: 'hit', ship };
  }
  return { result: 'miss' };
}

export const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;
