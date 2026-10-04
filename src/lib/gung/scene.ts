/**
 * 현장 — 이동은 다 같이, 살펴보기는 각자(원고 7판 10장 · PM 결정 「조사 따로」).
 *
 *  - **이동(공용)**: 조사마다 모두 sceneRoute 의 한 장소로 옮겨 간다. 공용 화면(방장 무대·큰 화면)은 sceneStop() 만 쓴다 —
 *    장소 이름·그림 키·살펴보기 수·이동 한 줄뿐, 관찰 글은 결과 어디에도 없다.
 *  - **살펴보기(개인)**: 각자 폰에서 그 장소 물건을 라운드당 examine 번(7판: 2) 고른다. 고른 물건엔 그 조사까지 열린 줄이 모두
 *    뜬다(R3 동궁전 물건 = R1 줄 + R3 줄). 기록(ExamineLog)은 그 폰 게임 저장에만 있다(game.ts 'examine').
 *    한 번 본 건 되돌릴 수 없고, 한 조사에 같은 물건을 두 번 고를 수 없다. 앞 조사에서 본 물건은 다시 골라도 된다.
 *    장소 고르기를 확정하면 그 조사의 남은 살펴보기는 사라진다(마감 판정은 game.ts — 이 모듈은 횟수·물건만 본다).
 *  - **역할 무관**: 이 모듈은 **types 만** import 한다 — 인원·자리·역할을 받지 않으므로 같은 기록이면 누구에게나 같은 결과다.
 *  - **라운드 잠금**: 조사 r 의 관찰은 fromRound ≤ r 줄만. 미래 라운드 줄의 글자는 결과 어디에도 실리지 않는다.
 */
import type { GungCase, ObservationLineDef, PlaceId, PublicSceneStop, RoundNo, SceneObjectDef } from './types';

/** 이동 한 곳(공용) — 장소 이름·그림 키·살펴보기 수·이동 한 줄. 관찰 글 없음 */
export type SceneStop = PublicSceneStop;

/** 살펴볼 수 있는 물건(핫스팟) — 이름·자리만(관찰 글 없음) */
export interface ExamineObject {
  id: string;
  name: string;
  /** 그림 안 핫스팟 중심 [가로 %, 세로 %] */
  pos: [number, number];
}

/** 살펴본 물건 하나의 관찰(그 사람 폰에만) */
export interface ObservationView {
  objectId: string;
  /** 살펴본 조사 */
  round: RoundNo;
  placeId: PlaceId;
  placeName: string;
  name: string;
  /** 그 조사까지 열린 줄(오래된 것부터) */
  lines: { fromRound: RoundNo; text: string }[];
}

/** 조사 → 그 조사에 살펴본 물건 id(고른 순서). 게임 저장 GameState.examined 와 같은 꼴 */
export type ExamineLog = Partial<Record<RoundNo, string[]>>;

/** 한 조사 살펴보기 최대 횟수(원고 10-2 검사 ⓑ) — 저장 검증 상한 */
export const EXAMINE_MAX = 3;
/** 물건 id 형식('OB-DG1') — 저장 검증 */
export const OBJECT_ID_RE = /^OB-[A-Z]{2}\d{1,2}$/;

/** 0..3 밖·소수는 잘라 조사 라운드로(0 = 조사 전) */
export function sceneRound(upTo: number): 0 | RoundNo {
  if (!Number.isFinite(upTo) || upTo < 1) return 0;
  return Math.min(3, Math.floor(upTo)) as RoundNo;
}

function placeName(c: GungCase, placeId: PlaceId): string {
  return c.places.find((p) => p.id === placeId)?.name ?? placeId;
}

function artOf(c: GungCase, placeId: PlaceId): string {
  return (c.scenes ?? []).find((s) => s.placeId === placeId)?.art ?? `scene-${placeId}`;
}

// ─────────────────────────────── 이동(공용) ───────────────────────────────

/** 그 조사의 이동 한 곳 — 조사 전이거나 이동 표가 없으면 null. 공용 화면은 이것만 쓴다 */
export function sceneStop(c: GungCase, upTo: number): SceneStop | null {
  const round = sceneRound(upTo);
  if (!round) return null;
  const r = (c.sceneRoute ?? []).find((x) => x.round === round);
  if (!r) return null;
  return { round, placeId: r.placeId, placeName: placeName(c, r.placeId), art: artOf(c, r.placeId), examine: r.examine, cue: r.cue };
}

/** 이동 표 전부(조사 순) — 큰 화면 공개 모듈(scene-route-data.ts) 대조용 */
export function sceneStops(c: GungCase): SceneStop[] {
  return ([1, 2, 3] as RoundNo[]).map((r) => sceneStop(c, r)).filter((s): s is SceneStop => s !== null);
}

// ─────────────────────────────── 살펴보기(개인) ───────────────────────────────

function hasLineBy(o: SceneObjectDef, round: RoundNo): boolean {
  return o.lines.some((l) => l.fromRound <= round);
}

function linesBy(lines: readonly ObservationLineDef[], round: RoundNo): { fromRound: RoundNo; text: string }[] {
  return lines
    .filter((l) => l.fromRound <= round)
    .sort((x, y) => x.fromRound - y.fromRound)
    .map((l) => ({ fromRound: l.fromRound, text: l.text }));
}

/** 조사 round 에 살펴볼 수 있는 물건 — 그 조사 이동 장소의 물건 가운데 그 조사까지 열린 줄이 있는 것(이름·자리만) */
export function examineObjects(c: GungCase, round: number): ExamineObject[] {
  const stop = sceneStop(c, round);
  if (!stop || stop.round !== round) return [];
  const def = (c.scenes ?? []).find((s) => s.placeId === stop.placeId);
  if (!def) return [];
  return def.objects.filter((o) => hasLineBy(o, stop.round)).map((o): ExamineObject => ({ id: o.id, name: o.name, pos: [o.pos[0], o.pos[1]] }));
}

/** 조사 round 에 그 물건을 살펴본 결과 — 그 조사 이동 장소의 물건이 아니면 null. 줄은 fromRound ≤ round 만 */
export function observe(c: GungCase, round: number, objectId: string): ObservationView | null {
  const stop = sceneStop(c, round);
  if (!stop || stop.round !== round) return null;
  const def = (c.scenes ?? []).find((s) => s.placeId === stop.placeId);
  const o = def?.objects.find((x) => x.id === objectId);
  if (!o || !hasLineBy(o, stop.round)) return null;
  return { objectId: o.id, round: stop.round, placeId: stop.placeId, placeName: stop.placeName, name: o.name, lines: linesBy(o.lines, stop.round) };
}

/** 그 조사에 살펴본 물건 id(기록에 있는 그대로, 고른 순) */
export function examinedIn(log: ExamineLog | undefined, round: RoundNo): string[] {
  return log?.[round]?.slice() ?? [];
}

/** 그 조사에 남은 살펴보기 횟수(0 이상). 이동 표가 없는 조사는 0 */
export function examineLeft(c: GungCase, log: ExamineLog | undefined, round: number): number {
  const stop = sceneStop(c, round);
  if (!stop || stop.round !== round) return 0;
  const valid = new Set(examineObjects(c, round).map((o) => o.id));
  const used = examinedIn(log, stop.round).filter((id) => valid.has(id)).length;
  return Math.max(0, stop.examine - used);
}

/** 이 물건을 지금 살펴볼 수 있나 — 그 조사 물건이고, 그 조사에 아직 안 골랐고, 횟수가 남았다(장소 확정 마감은 game.ts) */
export function canExamine(c: GungCase, log: ExamineLog | undefined, round: number, objectId: string): boolean {
  const r = sceneRound(round);
  if (!r || r !== round) return false;
  if (!examineObjects(c, r).some((o) => o.id === objectId)) return false;
  if (examinedIn(log, r).includes(objectId)) return false;
  return examineLeft(c, log, r) > 0;
}

/** 그 조사에 내가 본 관찰(고른 순) — 모르는 id 는 건너뛴다 */
export function observationsIn(c: GungCase, log: ExamineLog | undefined, round: RoundNo): ObservationView[] {
  return examinedIn(log, round)
    .map((id) => observe(c, round, id))
    .filter((v): v is ObservationView => v !== null);
}

/** 단서함 「내가 본 관찰」 — 이 폰이 들어선 조사(upTo)까지, 조사 순 · 고른 순 */
export function myObservations(c: GungCase, log: ExamineLog | undefined, upTo: number): ObservationView[] {
  const reached = sceneRound(upTo);
  return ([1, 2, 3] as RoundNo[]).filter((r) => r <= reached).flatMap((r) => observationsIn(c, log, r));
}
