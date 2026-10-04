/**
 * 현장 관찰(원고 6판 10장) — 다 같이 보는 장소 그림 · 그림 속 물건 · 라운드별 관찰 한 줄.
 *
 *  - 공용 정보다: 인원(4·5·6)·역할·자리와 무관하게 같다(원고 10-1 「중립」). 그래서 이 모듈은 **types 만** import 한다 —
 *    assign·seal·getSheet·getClue 를 쓰지 않으므로, 방 코드만 가진 큰 화면 기기도 범인을 계산할 수 없다(UX 스펙 S5).
 *  - 라운드 잠금: 관찰 줄은 fromRound 조사부터 보인다. 인자는 이 기기가 들어선 조사 라운드(reachedRound(phase), 0..3).
 *    0(조사 전)이면 아무것도 없다. 미래 라운드 줄의 글자는 결과 어디에도 실리지 않는다.
 *  - 「새」 표시: 이번 조사(upTo)에 새 줄이 열린 물건. R1 은 모두 처음이라 표시하지 않는다(원고 10-1 — R2 5줄·R3 7줄).
 *  - 본 물건 기록 키(seenKey)는 `물건id@마지막 줄 라운드` — 새 라운드에 새 줄이 붙으면 키가 바뀌어 다시 「새」가 된다.
 *  - 장소 카드(몰래·숨기기 가능)와는 별개다: 여기서 본 것은 단서함에 들어가지 않고, 장소 카드 본문은 여기 없다.
 */
import type { GungCase, ObservationLineDef, PlaceId, RoundNo, SceneDef, SceneObjectDef } from './types';

/** 화면에 내리는 관찰 한 줄 */
export interface SceneLine {
  fromRound: RoundNo;
  text: string;
  /** 이번 조사(upTo)에 열린 줄 */
  isNew: boolean;
}

/** 화면에 내리는 물건(핫스팟) 하나 — upTo 까지 열린 줄이 하나라도 있는 물건만 */
export interface SceneObject {
  id: string;
  placeId: PlaceId;
  name: string;
  /** 그림 안 핫스팟 중심 [가로 %, 세로 %] */
  pos: [number, number];
  /** upTo 까지 열린 줄(오래된 것부터) */
  lines: SceneLine[];
  /** 「새」 표시 — upTo ≥ 2 이고 이번 조사에 새 줄이 열렸다 */
  isNew: boolean;
  /** 본 물건 기록 키 `OB-DG1@3` */
  seenKey: string;
}

/** 장소 그림 한 장(그 라운드 기준) */
export interface SceneView {
  placeId: PlaceId;
  /** 장소 이름('동궁전') */
  placeName: string;
  /** 배경 그림 키('scene-dg') */
  art: string;
  round: RoundNo;
  objects: SceneObject[];
  /** 「새」 표시가 붙은 물건 수 */
  newCount: number;
}

/** 이번 조사에 새로 열린 관찰(방장이 소리 내어 읽는 목록 — 원고 10-1 「놓치지 않게」) */
export interface NewObservation {
  objectId: string;
  placeId: PlaceId;
  placeName: string;
  name: string;
  text: string;
  round: RoundNo;
}

/** 0..3 밖·소수는 잘라 조사 라운드로(0 = 조사 전) */
export function sceneRound(upTo: number): 0 | RoundNo {
  if (!Number.isFinite(upTo) || upTo < 1) return 0;
  return Math.min(3, Math.floor(upTo)) as RoundNo;
}

/** 본 물건 기록 키 — 물건 id + 그 물건에 마지막으로 열린 줄의 라운드 */
export function observationSeenKey(objectId: string, lastLineRound: RoundNo): string {
  return `${objectId}@${lastLineRound}`;
}

/** 이 라운드에 열린 장소 순서(원고 배치 순). 라운드 정의가 없으면 장소 목록 순 */
function placeOrder(c: GungCase, round: RoundNo): PlaceId[] {
  const r = c.rounds.find((x) => x.no === round);
  return r ? r.placeIds.slice() : c.places.map((p) => p.id);
}

function visibleLines(lines: readonly ObservationLineDef[], round: RoundNo): SceneLine[] {
  return lines
    .filter((l) => l.fromRound <= round)
    .sort((x, y) => x.fromRound - y.fromRound)
    .map((l) => ({ fromRound: l.fromRound, text: l.text, isNew: l.fromRound === round }));
}

function viewObject(placeId: PlaceId, o: SceneObjectDef, round: RoundNo): SceneObject | null {
  const lines = visibleLines(o.lines, round);
  if (!lines.length) return null;
  const last = lines[lines.length - 1].fromRound;
  return {
    id: o.id,
    placeId,
    name: o.name,
    pos: [o.pos[0], o.pos[1]],
    lines,
    isNew: round >= 2 && lines.some((l) => l.isNew),
    seenKey: observationSeenKey(o.id, last),
  };
}

function viewScene(c: GungCase, def: SceneDef, round: RoundNo): SceneView {
  const objects = def.objects.map((o) => viewObject(def.placeId, o, round)).filter((o): o is SceneObject => o !== null);
  return {
    placeId: def.placeId,
    placeName: c.places.find((p) => p.id === def.placeId)?.name ?? def.placeId,
    art: def.art,
    round,
    objects,
    newCount: objects.filter((o) => o.isNew).length,
  };
}

/** 장소 그림 한 장 — 조사 전이거나 그 라운드에 열리지 않은 장소·그림이 없는 장소면 null */
export function sceneAt(c: GungCase, upTo: number, placeId: PlaceId): SceneView | null {
  const round = sceneRound(upTo);
  if (!round || !placeOrder(c, round).includes(placeId)) return null;
  const def = (c.scenes ?? []).find((s) => s.placeId === placeId);
  return def ? viewScene(c, def, round) : null;
}

/** 이 라운드의 장소 그림 전부(그 라운드 장소 순 — 동궁전부터). 조사 전이면 빈 배열 */
export function scenesFor(c: GungCase, upTo: number): SceneView[] {
  const round = sceneRound(upTo);
  if (!round) return [];
  return placeOrder(c, round)
    .map((pid) => sceneAt(c, round, pid))
    .filter((v): v is SceneView => v !== null && v.objects.length > 0);
}

/**
 * 이번 조사에 새로 열린 관찰 줄(장소·물건 순). R1 은 전부 처음이라 빈 배열 — 방장은 R2·R3 에 이 목록을 PB 에 이어 읽는다.
 */
export function newObservations(c: GungCase, upTo: number): NewObservation[] {
  const reached = sceneRound(upTo);
  if (reached < 2) return [];
  const round = reached as RoundNo;
  const out: NewObservation[] = [];
  for (const v of scenesFor(c, round)) {
    for (const o of v.objects) {
      for (const l of o.lines) {
        if (l.isNew) out.push({ objectId: o.id, placeId: v.placeId, placeName: v.placeName, name: o.name, text: l.text, round });
      }
    }
  }
  return out;
}

/** 물건 id 로 찾기(그 라운드 기준 — 아직 줄이 없으면 null) */
export function sceneObjectById(c: GungCase, upTo: number, objectId: string): SceneObject | null {
  for (const v of scenesFor(c, upTo)) {
    const o = v.objects.find((x) => x.id === objectId);
    if (o) return o;
  }
  return null;
}
