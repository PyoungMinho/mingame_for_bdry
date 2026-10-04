/**
 * 현장(원고 7판 10장 「조사 따로」) — 이동은 다 같이(공용), 살펴보기는 각자(개인).
 *
 *  - 데이터 ↔ 원고: §10-2 이동 표(sceneRoute) · §10-3 관찰 표(scenes) 글자 그대로. 큰 화면 공개 모듈(scene-route-data.ts)은
 *    sceneRoute 와 같고 관찰 글이 없다.
 *  - 공용 화면용 sceneStop 엔 관찰 글이 없다(장소 이름·그림 키·살펴보기 수·이동 한 줄만).
 *  - 살펴보기: 그 조사 이동 장소의 물건만 · 라운드당 examine 번 · 같은 조사에 같은 물건 두 번 금지 · 앞 조사에 본 물건은 다시 가능.
 *  - 라운드 잠금: 조사 N 의 결과엔 R(N+1) 이후 줄의 글자가 없다(위조한 기록으로도).
 *  - 역할 중립: scene.ts 는 types 만 import 하고, 인원·자리·역할을 받지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllSheets, assignFromCode } from './assign';
import { sejaCase } from './case-data';
import { publicBoardUpTo, sharedTerms } from './deck';
import { makeFixtureCase } from './fixtures';
import { SEED_ALPHABET } from './room';
import {
  canExamine,
  EXAMINE_MAX,
  examineLeft,
  examineObjects,
  examinedIn,
  myObservations,
  OBJECT_ID_RE,
  observationsIn,
  observe,
  sceneRound,
  sceneStop,
  sceneStops,
  type ExamineLog,
} from './scene';
import { SCENE_ROUTE } from './scene-route-data';
import { PLAYER_COUNTS, type GungCase, type RoundNo, type SceneDef, type SceneRouteStop } from './types';
import { caseErrors, validateCase } from './validate';

const c = sejaCase;
const DOC = fs.readFileSync(path.resolve(__dirname, '../../../docs/planning/gung-case.md'), 'utf8');
const SCENE_SRC = fs.readFileSync(path.resolve(__dirname, './scene.ts'), 'utf8');
const ROUTE_SRC = fs.readFileSync(path.resolve(__dirname, './scene-route-data.ts'), 'utf8');

const clean = (s: string) =>
  s
    .replace(/<br>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function section(head: string, next: string): string {
  const s = DOC.search(new RegExp(`^### ${head.replace('.', '\\.')}`, 'm'));
  expect(s, `원고 §${head} 없음`).toBeGreaterThan(0);
  const e = DOC.slice(s).search(new RegExp(`^### ${next.replace('.', '\\.')}`, 'm'));
  return DOC.slice(s, s + e);
}

/** 원고 §10-2 이동 표 */
function docRoute(): { round: number; place: string; examine: number; cue: string }[] {
  return section('10-2.', '10-3.')
    .split('\n')
    .filter((l) => /^\| *R[123] *\|/.test(l))
    .map((row) => {
      const [r, place, examine, cue] = row.split('|').slice(1, -1).map((x) => clean(x));
      return { round: Number(r.slice(1)), place, examine: Number(examine), cue };
    });
}

/** 원고 §10-3 관찰 표 데이터 행 */
function docRows(): { id: string; place: string; name: string; pos: [number, number]; r: (string | null)[] }[] {
  return section('10-3.', '10-4.')
    .split('\n')
    .filter((l) => l.startsWith('| OB-'))
    .map((row) => {
      const cells = row.split('|').slice(1, -1).map((x) => x.trim());
      const [id, place, name, pos, r1, r2, r3] = cells;
      const [x, y] = pos.split(',').map((v) => Number(v.trim()));
      const val = (t: string) => (['—', '-', ''].includes(clean(t)) ? null : clean(t));
      return { id, place, name: clean(name), pos: [x, y], r: [val(r1), val(r2), val(r3)] };
    });
}

const allLines = (cs: GungCase = c) =>
  (cs.scenes ?? []).flatMap((sc) => sc.objects.flatMap((o) => o.lines.map((l) => ({ ...l, id: o.id, placeId: sc.placeId }))));
const linesOf = (round: RoundNo) => allLines().filter((l) => l.fromRound === round);
const objectIds = (cs: GungCase = c) => (cs.scenes ?? []).flatMap((s) => s.objects.map((o) => o.id));
/** 한 줄이 새는지 — 말한 이를 떼고 앞 10자 조각으로 본다 */
const probe = (t: string) => t.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
/** 그 조사에 볼 수 있는 물건을 모두 본 기록(횟수 무시 — 위조 기록) */
const everything = (): ExamineLog => ({ 1: objectIds(), 2: objectIds(), 3: objectIds() });

describe('현장 — 데이터 ↔ 원고 §10-2 이동 표', () => {
  it('R1 동궁전 → R2 내의원 → R3 동궁전(다시), 살펴보기 2번씩 · 이동 한 줄 글자 그대로', () => {
    const doc = docRoute();
    expect(doc.map((r) => `${r.round}:${r.place}:${r.examine}`)).toEqual(['1:동궁전:2', '2:내의원:2', '3:동궁전:2']);
    const route = c.sceneRoute ?? [];
    expect(route).toHaveLength(3);
    for (const [i, r] of route.entries()) {
      expect(r).toEqual({ round: doc[i].round, placeId: c.places.find((p) => p.name === doc[i].place)!.id, examine: doc[i].examine, cue: doc[i].cue });
      expect(Array.from(r.cue).length, `R${r.round}`).toBeLessThanOrEqual(40);
    }
  });

  it('큰 화면 공개 모듈(scene-route-data.ts) = sceneRoute + 장소 이름·그림 키 — 관찰 글·카드·역할 없음', () => {
    expect([...SCENE_ROUTE]).toEqual(sceneStops(c));
    const json = JSON.stringify(SCENE_ROUTE);
    for (const l of allLines()) expect(json.includes(probe(l.text)), l.id).toBe(false);
    for (const id of objectIds()) expect(json.includes(id), id).toBe(false);
    for (const r of c.roles) expect(json.includes(r.name), r.name).toBe(false);
    // 타입만 import(사건 데이터·엔진을 끌어오지 않는다 — 큰 화면 번들에 관찰이 실리지 않게)
    expect([...ROUTE_SRC.matchAll(/^import[^;]*from '([^']+)';/gm)].map((m) => m[0])).toEqual(["import type { PublicSceneStop } from './types';"]);
  });
});

describe('현장 — 데이터 ↔ 원고 §10-3 관찰 표', () => {
  it('그림 두 장(동궁전·내의원) · 물건 10 · 관찰 15줄(R1 5 · R2 5 · R3 5) — 원고 10-3·10-4 와 같다', () => {
    const scenes = c.scenes ?? [];
    expect(scenes.map((s) => s.placeId)).toEqual(['dg', 'ny']);
    expect(scenes.map((s) => s.objects.length)).toEqual([5, 5]);
    expect([linesOf(1).length, linesOf(2).length, linesOf(3).length]).toEqual([5, 5, 5]);
    for (const s of scenes) expect(s.art).toBe(`scene-${s.placeId}`);
    expect(DOC).toContain('R1 5(동궁전) · R2 5(내의원) · R3 5(동궁전) = 15줄');
  });

  it('표의 모든 행이 글자 그대로 들어 있다(물건 이름·위치·R1~R3, 「—」 = 줄 없음) · 설계 메모는 없다', () => {
    const rows = docRows();
    expect(rows).toHaveLength(10);
    const byId = new Map((c.scenes ?? []).flatMap((s) => s.objects.map((o) => [o.id, { ...o, placeId: s.placeId }] as const)));
    expect([...byId.keys()].sort()).toEqual(rows.map((r) => r.id).sort());
    for (const row of rows) {
      const o = byId.get(row.id)!;
      expect(c.places.find((p) => p.id === o.placeId)?.name, row.id).toBe(row.place);
      expect(o.name, row.id).toBe(row.name);
      expect(o.pos, row.id).toEqual(row.pos);
      const want = row.r.flatMap((t, i) => (t ? [{ fromRound: (i + 1) as RoundNo, text: t }] : []));
      expect(o.lines, row.id).toEqual(want);
      expect(Object.keys(o).sort(), row.id).toEqual(['id', 'lines', 'name', 'placeId', 'pos']); // 조건·메모 필드 없음
    }
  });

  it('관찰 줄의 라운드 = 그 물건 장소로 이동하는 조사(원고 10-3 「이동 장소가 아닌 물건은 「—」」) · 40자 이내', () => {
    for (const l of allLines()) {
      expect(sceneStop(c, l.fromRound)?.placeId, `${l.id} R${l.fromRound}`).toBe(l.placeId);
      expect(Array.from(l.text).length, `${l.id} R${l.fromRound}`).toBeLessThanOrEqual(40);
    }
  });

  it('범인 이름·호칭은 R1·R2 관찰에 없다(원고 10-4 「숙의를 가리키는 줄 0」)', () => {
    const culprit = c.roles.find((r) => r.id === c.culprit)!;
    const terms = [culprit.name, culprit.shortName!, '숙의', '연씨', '후궁', '숙의방', '꽃님', '취향당'];
    for (const l of [...linesOf(1), ...linesOf(2)]) {
      for (const t of terms) expect(l.text.includes(t), `${l.id} R${l.fromRound} ← ${t}`).toBe(false);
    }
  });

  it('결정 단서는 관찰로 옮기지 않았다(원고 10-4 「옮기지 않은 것」 — 숨길 수 있는 장소 카드에만)', () => {
    // 「쪽지」는 OB-NY3(약장의 중궁전 부자이중탕 쪽지 — NY-2 와 같은 사실, 7판 보정)이라 뺀다. JG-3 쪽지 내용은 관찰에 없다
    const decisive = ['외매듭', '나비매듭', '티끌', '개미', '명주실', '약봉지', '편지', '노리개', '생부자', '수령', '임부', '꽃님'];
    for (const l of allLines()) {
      for (const w of decisive) expect(l.text.includes(w), `${l.id} R${l.fromRound} ← ${w}`).toBe(false);
    }
  });
});

describe('이동(공용) — sceneStop 엔 관찰 글이 없다', () => {
  it('조사마다 장소 이름·그림 키·살펴보기 수·이동 한 줄뿐(물건·관찰 키 없음)', () => {
    for (const r of [1, 2, 3] as const) {
      const s = sceneStop(c, r)!;
      expect(Object.keys(s).sort()).toEqual(['art', 'cue', 'examine', 'placeId', 'placeName', 'round']);
      expect(s.round).toBe(r);
    }
    expect(sceneStop(c, 1)).toMatchObject({ placeId: 'dg', placeName: '동궁전', art: 'scene-dg', examine: 2 });
    expect(sceneStop(c, 2)).toMatchObject({ placeId: 'ny', placeName: '내의원', art: 'scene-ny', examine: 2 });
    expect(sceneStop(c, 3)).toMatchObject({ placeId: 'dg', placeName: '동궁전', art: 'scene-dg', examine: 2 });
    const json = JSON.stringify(sceneStops(c));
    for (const l of allLines()) expect(json.includes(probe(l.text)), l.id).toBe(false);
  });

  it('조사 전(0)·이상한 값·이동 표 없는 사건은 null / 빈 결과', () => {
    for (const r of [0, -1, Number.NaN, 0.5]) {
      expect(sceneStop(c, r), String(r)).toBeNull();
      expect(examineObjects(c, r)).toEqual([]);
      expect(observe(c, r, 'OB-DG1')).toBeNull();
      expect(examineLeft(c, {}, r)).toBe(0);
      expect(myObservations(c, everything(), r)).toEqual([]);
    }
    expect(sceneRound(7)).toBe(3);
    expect(sceneRound(2.9)).toBe(2);
    const bare = makeFixtureCase();
    expect(sceneStop(bare, 1)).toBeNull();
    expect(sceneStops(bare)).toEqual([]);
    expect(examineObjects(bare, 1)).toEqual([]);
  });
});

describe('살펴보기(개인) — 물건 · 횟수 · 결과', () => {
  it('조사마다 그 이동 장소의 물건 5개(이름·자리만, 관찰 글 없음)', () => {
    expect(examineObjects(c, 1).map((o) => o.id)).toEqual(['OB-DG1', 'OB-DG2', 'OB-DG3', 'OB-DG4', 'OB-DG5']);
    expect(examineObjects(c, 2).map((o) => o.id)).toEqual(['OB-NY1', 'OB-NY2', 'OB-NY3', 'OB-NY4', 'OB-NY5']);
    expect(examineObjects(c, 3).map((o) => o.id)).toEqual(['OB-DG1', 'OB-DG2', 'OB-DG3', 'OB-DG4', 'OB-DG5']);
    for (const r of [1, 2, 3] as const) {
      for (const o of examineObjects(c, r)) expect(Object.keys(o).sort()).toEqual(['id', 'name', 'pos']);
      const json = JSON.stringify(examineObjects(c, r));
      for (const l of allLines()) expect(json.includes(probe(l.text)), l.id).toBe(false);
    }
  });

  it('살펴본 물건엔 그 조사까지 열린 줄이 모두(R3 동궁전 = R1 줄 + R3 줄, 오래된 것부터)', () => {
    const dg1 = c.scenes![0].objects[0];
    expect(observe(c, 1, 'OB-DG1')?.lines).toEqual([dg1.lines[0]]);
    expect(observe(c, 3, 'OB-DG1')?.lines).toEqual(dg1.lines);
    expect(observe(c, 3, 'OB-DG1')).toMatchObject({ objectId: 'OB-DG1', round: 3, placeId: 'dg', placeName: '동궁전', name: '탕약 사발' });
    expect(observe(c, 2, 'OB-NY1')?.lines.map((l) => l.fromRound)).toEqual([2]);
    // 그 조사 이동 장소가 아닌 물건은 볼 수 없다
    expect(observe(c, 1, 'OB-NY1')).toBeNull();
    expect(observe(c, 2, 'OB-DG1')).toBeNull();
    expect(observe(c, 3, 'OB-NY5')).toBeNull();
    expect(observe(c, 1, 'OB-ZZ9')).toBeNull();
  });

  it('라운드당 2번 · 같은 조사에 같은 물건 두 번 금지 · 3번째는 막힌다 · 앞 조사에 본 물건은 다시 고를 수 있다', () => {
    let log: ExamineLog = {};
    expect(examineLeft(c, log, 1)).toBe(2);
    expect(canExamine(c, log, 1, 'OB-DG1')).toBe(true);
    log = { 1: ['OB-DG1'] };
    expect(examineLeft(c, log, 1)).toBe(1);
    expect(canExamine(c, log, 1, 'OB-DG1')).toBe(false);
    expect(canExamine(c, log, 1, 'OB-DG4')).toBe(true);
    log = { 1: ['OB-DG1', 'OB-DG4'] };
    expect(examineLeft(c, log, 1)).toBe(0);
    for (const id of objectIds()) expect(canExamine(c, log, 1, id), id).toBe(false);
    // 다른 조사의 기록은 서로 세지 않는다 · 내의원 물건은 조사 1 에 못 본다
    expect(canExamine(c, log, 2, 'OB-NY2')).toBe(true);
    expect(canExamine(c, log, 2, 'OB-DG1')).toBe(false);
    expect(canExamine(c, {}, 1, 'OB-NY2')).toBe(false);
    // R3 동궁전으로 돌아오면 R1 에 본 물건도 다시(새 줄까지)
    expect(canExamine(c, log, 3, 'OB-DG1')).toBe(true);
    expect(examineLeft(c, log, 3)).toBe(2);
    // 이상한 조사 번호
    expect(canExamine(c, {}, 1.5, 'OB-DG1')).toBe(false);
    expect(canExamine(c, {}, 4, 'OB-DG1')).toBe(false);
  });

  it('내가 본 관찰 = 고른 순 · 조사 순, 모르는 id 는 건너뛴다 · 기록 키는 엔진 상수와 맞다', () => {
    const log: ExamineLog = { 1: ['OB-DG5', 'OB-DG2'], 2: ['OB-NY5', 'OB-XX1'], 3: ['OB-DG4'] };
    expect(observationsIn(c, log, 1).map((o) => o.objectId)).toEqual(['OB-DG5', 'OB-DG2']);
    expect(observationsIn(c, log, 2).map((o) => o.objectId)).toEqual(['OB-NY5']);
    expect(myObservations(c, log, 2).map((o) => `${o.round}:${o.objectId}`)).toEqual(['1:OB-DG5', '1:OB-DG2', '2:OB-NY5']);
    expect(myObservations(c, log, 3).map((o) => `${o.round}:${o.objectId}`)).toEqual(['1:OB-DG5', '1:OB-DG2', '2:OB-NY5', '3:OB-DG4']);
    expect(examinedIn(log, 2)).toEqual(['OB-NY5', 'OB-XX1']);
    expect(examinedIn(undefined, 1)).toEqual([]);
    for (const id of objectIds()) expect(OBJECT_ID_RE.test(id), id).toBe(true);
    for (const r of c.sceneRoute ?? []) expect(r.examine).toBeLessThanOrEqual(EXAMINE_MAX);
  });
});

describe('현장 — 라운드 잠금', () => {
  it('조사 N 결과엔 R(N+1) 이후 줄의 글자가 한 조각도 없다 — 모든 물건을 본 위조 기록으로도', () => {
    for (const upTo of [1, 2] as const) {
      const future = allLines().filter((l) => l.fromRound > upTo).map((l) => probe(l.text));
      expect(future.length).toBeGreaterThan(0);
      const json = JSON.stringify([
        sceneStop(c, upTo),
        examineObjects(c, upTo),
        objectIds().map((id) => observe(c, upTo, id)),
        observationsIn(c, everything(), upTo),
        myObservations(c, everything(), upTo),
      ]);
      for (const f of future) expect(json.includes(f), `R${upTo} ← ${f}`).toBe(false);
    }
  });

  it('조사 N 까지 다 본 기록이면 R1..RN 줄이 모두 나온다(빠짐 없음)', () => {
    for (const upTo of [1, 2, 3] as const) {
      const shown = new Set(myObservations(c, everything(), upTo).flatMap((o) => o.lines.map((l) => `${o.objectId}:${l.fromRound}:${l.text}`)));
      const want = allLines()
        .filter((l) => l.fromRound <= upTo)
        .map((l) => `${l.id}:${l.fromRound}:${l.text}`);
      for (const w of want) expect(shown.has(w), w).toBe(true);
    }
  });

  it('R3 관찰은 R1·R2 의 다른 공용 경로(공용 보드·용어·모든 패)에도 섞여 있지 않다', () => {
    const r3 = linesOf(3).map((l) => probe(l.text));
    const A = SEED_ALPHABET;
    for (const n of PLAYER_COUNTS) {
      const a = assignFromCode(c, `${A[3]}${A[7]}${A[11]}${A[13]}${n}`)!;
      for (const upTo of [1, 2] as const) {
        const json = JSON.stringify([publicBoardUpTo(c, n, upTo), sharedTerms(c, n, upTo), getAllSheets(c, a, upTo)]);
        for (const f of r3) expect(json.includes(f), `${n}인 R${upTo} ← ${f}`).toBe(false);
      }
    }
  });
});

describe('현장 — 역할 중립', () => {
  it('scene.ts 는 types 만 import 한다(assign·seal·deck·game 없음 — 방 코드만 가진 화면이 범인을 계산할 수 없게)', () => {
    const imports = [...SCENE_SRC.matchAll(/^import[^;]*from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./types']);
    const code = SCENE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 주석 제외
    for (const w of ['assignmentOf', 'getSheet', 'getClue', 'clueSeal', 'culprit', 'roles', 'seat']) expect(code.includes(w), w).toBe(false);
  });

  it('조회 함수는 인원·자리·역할을 받지 않는다 — 같은 기록이면 언제나 같은 결과', () => {
    expect(sceneStop.length).toBe(2);
    expect(examineObjects.length).toBe(2);
    expect(observe.length).toBe(3);
    expect(canExamine.length).toBe(4);
    expect(examineLeft.length).toBe(3);
    expect(observationsIn.length).toBe(3);
    expect(myObservations.length).toBe(3);
    const log: ExamineLog = { 1: ['OB-DG3', 'OB-DG5'], 3: ['OB-DG4'] };
    expect(JSON.stringify(myObservations(c, log, 3))).toBe(JSON.stringify(myObservations(c, structuredClone(log), 3)));
  });
});

describe('현장 — 무결성 검사(validateCase)', () => {
  const base = makeFixtureCase();
  const scenes: SceneDef[] = [
    {
      placeId: 'hall',
      art: 'scene-hall',
      objects: [
        { id: 'OB-H1', name: '사발', pos: [10, 50], lines: [{ fromRound: 1, text: '[픽스처] 사발' }, { fromRound: 3, text: '[픽스처] 사발 R3' }] },
        { id: 'OB-H2', name: '문', pos: [80, 40], lines: [{ fromRound: 1, text: '[픽스처] 문' }] },
        { id: 'OB-H3', name: '병풍', pos: [50, 40], lines: [{ fromRound: 3, text: '[픽스처] 병풍 R3' }] },
      ],
    },
    {
      placeId: 'clinic',
      art: 'scene-clinic',
      objects: [
        { id: 'OB-C1', name: '장부', pos: [30, 50], lines: [{ fromRound: 2, text: '[픽스처] 장부' }] },
        { id: 'OB-C2', name: '약장', pos: [60, 50], lines: [{ fromRound: 2, text: '[픽스처] 약장' }] },
      ],
    },
  ];
  const route: SceneRouteStop[] = [
    { round: 1, placeId: 'hall', examine: 1, cue: '모두 전각으로' },
    { round: 2, placeId: 'clinic', examine: 1, cue: '모두 약방으로' },
    { round: 3, placeId: 'hall', examine: 2, cue: '다시 전각으로' },
  ];
  const mk = (sc: SceneDef[], rt?: SceneRouteStop[]): GungCase => ({ ...base, scenes: sc, ...(rt ? { sceneRoute: rt } : {}) });

  it('정상 데이터·현장이 없는 사건은 오류 0 · 픽스처로도 이동·살펴보기가 돈다', () => {
    expect(caseErrors(mk(scenes, route))).toEqual([]);
    expect(caseErrors(base)).toEqual([]);
    const f = mk(scenes, route);
    expect(examineObjects(f, 1).map((o) => o.id)).toEqual(['OB-H1', 'OB-H2']); // 병풍은 R3 줄뿐 — R1 엔 고를 거리가 아니다
    expect(examineObjects(f, 3).map((o) => o.id)).toEqual(['OB-H1', 'OB-H2', 'OB-H3']);
    expect(examineLeft(f, { 1: ['OB-H2'] }, 1)).toBe(0);
    expect(observe(f, 3, 'OB-H1')?.lines.map((l) => l.text)).toEqual(['[픽스처] 사발', '[픽스처] 사발 R3']);
  });

  it('관찰: 없는 장소 · 중복 id(카드 id 포함) · 위치 범위 밖 · 줄 없음 · 라운드 역순/중복 · 빈 줄 · 그림 키 없음은 오류', () => {
    const g = scenes[0];
    const o = g.objects[0];
    const bad: [string, SceneDef[]][] = [
      ['없는 장소', [{ ...g, placeId: 'ghost' }]],
      ['장소 중복', [g, { ...g, objects: [{ ...o, id: 'OB-H9' }] }]],
      ['id 중복', [{ ...g, objects: [o, { ...o }] }]],
      ['카드 id 와 겹침', [{ ...g, objects: [{ ...o, id: 'PB-1' }] }]],
      ['위치', [{ ...g, objects: [{ ...o, pos: [101, 5] }] }]],
      ['줄 없음', [{ ...g, objects: [{ ...o, lines: [] }] }]],
      ['역순', [{ ...g, objects: [{ ...o, lines: [{ fromRound: 2, text: 'a' }, { fromRound: 1, text: 'b' }] }] }]],
      ['라운드 중복', [{ ...g, objects: [{ ...o, lines: [{ fromRound: 1, text: 'a' }, { fromRound: 1, text: 'b' }] }] }]],
      ['빈 줄', [{ ...g, objects: [{ ...o, lines: [{ fromRound: 1, text: '  ' }] }] }]],
      ['그림 키 없음', [{ ...g, art: '' }]],
    ];
    for (const [label, sc] of bad) expect(caseErrors(mk(sc)).length, label).toBeGreaterThan(0);
  });

  it('이동 표: 없는 장소 · 살펴보기 0/4 · 조사 중복 · 빈 이동 한 줄 · 이동 장소 아닌 물건의 줄 · 고를 거리 없음은 오류', () => {
    const bad: [string, SceneDef[], SceneRouteStop[]][] = [
      ['없는 장소', scenes, [{ ...route[0], placeId: 'ghost' }, route[1], route[2]]],
      ['살펴보기 0', scenes, [{ ...route[0], examine: 0 }, route[1], route[2]]],
      ['살펴보기 4', scenes, [{ ...route[0], examine: 4 }, route[1], route[2]]],
      ['조사 중복', scenes, [route[0], { ...route[1], round: 1 }, route[2]]],
      ['빈 이동 한 줄', scenes, [{ ...route[0], cue: ' ' }, route[1], route[2]]],
      ['이동 장소 아닌 물건의 줄', scenes, [route[0], { ...route[1], placeId: 'hall' }, route[2]]],
      ['고를 거리 없음(물건 2 ≤ 살펴보기 2)', scenes, [{ ...route[0], examine: 2 }, route[1], route[2]]],
    ];
    for (const [label, sc, rt] of bad) expect(caseErrors(mk(sc, rt)).length, label).toBeGreaterThan(0);
  });

  it('40자 넘는 관찰 줄·이동 한 줄은 경고(길이류)', () => {
    const long = [{ ...scenes[0], objects: [{ ...scenes[0].objects[0], lines: [{ fromRound: 1 as RoundNo, text: '가'.repeat(41) }] }, ...scenes[0].objects.slice(1)] }, scenes[1]];
    const warns = validateCase(mk(long, [{ ...route[0], cue: '나'.repeat(41) }, route[1], route[2]])).filter((i) => i.level === 'warn');
    expect(warns.some((w) => /관찰 41자 > 40/.test(w.msg))).toBe(true);
    expect(warns.some((w) => /이동 한 줄 41자 > 40/.test(w.msg))).toBe(true);
  });
});
