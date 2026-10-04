/**
 * 현장 관찰(원고 6판 10장) — 데이터 ↔ 원고 §10-3 대조 · 라운드 잠금 · 「새」 표시 · 역할 중립 · 무결성 검사.
 *
 *  - 관찰은 다 같이 보는 공용 화면이다: 인원·역할·자리와 무관(scene.ts 는 types 만 import).
 *  - 관찰 줄은 fromRound 조사부터 — 조사 N 화면엔 R(N+1) 이후 줄의 글자가 한 조각도 없다.
 *  - 결정 단서(외매듭·티끌·명주실·약봉지·편지·쪽지·노리개…)는 관찰로 옮기지 않았다(원고 10-4) — 숨길 수 있는 장소 카드에만.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAllSheets, assignFromCode } from './assign';
import { sejaCase } from './case-data';
import { publicBoardUpTo, sharedTerms } from './deck';
import { makeFixtureCase } from './fixtures';
import { SEED_ALPHABET } from './room';
import { newObservations, observationSeenKey, sceneAt, sceneObjectById, sceneRound, scenesFor } from './scene';
import { PLAYER_COUNTS, type GungCase, type RoundNo, type SceneDef } from './types';
import { caseErrors, validateCase } from './validate';

const c = sejaCase;
const DOC = fs.readFileSync(path.resolve(__dirname, '../../../docs/planning/gung-case.md'), 'utf8');
const SCENE_SRC = fs.readFileSync(path.resolve(__dirname, './scene.ts'), 'utf8');

const clean = (s: string) =>
  s
    .replace(/<br>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** 원고 §10-3 관찰 표 데이터 행 */
function docRows(): { id: string; place: string; name: string; pos: [number, number]; r: (string | null)[] }[] {
  const s = DOC.indexOf('### 10-3.');
  const e = DOC.indexOf('\n### 10-4.', s);
  expect(s, '원고 §10-3 없음').toBeGreaterThan(0);
  return DOC.slice(s, e)
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

const allLines = (cs: GungCase = c) => (cs.scenes ?? []).flatMap((sc) => sc.objects.flatMap((o) => o.lines.map((l) => ({ ...l, id: o.id }))));
const linesOf = (round: RoundNo) => allLines().filter((l) => l.fromRound === round);
/** 한 줄이 새는지 — 앞 12자 조각으로 본다 */
const probe = (t: string) => t.slice(0, 12);

describe('현장 관찰 — 데이터 ↔ 원고 §10-3', () => {
  it('장소 그림 7장 · 물건 28 · 관찰 40줄(R1 28 · R2 5 · R3 7) — 원고 머리말·10-1 과 같다', () => {
    expect(DOC).toContain('현장 관찰 물건 28(관찰 40줄)');
    const scenes = c.scenes ?? [];
    expect(scenes.map((s) => s.placeId)).toEqual(c.places.map((p) => p.id));
    expect(scenes.flatMap((s) => s.objects)).toHaveLength(28);
    expect([linesOf(1).length, linesOf(2).length, linesOf(3).length]).toEqual([28, 5, 7]);
    for (const s of scenes) expect(s.art).toBe(`scene-${s.placeId}`);
  });

  it('표의 모든 행이 글자 그대로 들어 있다(물건 이름·위치·R1~R3, 「—」 = 줄 없음) · 설계 메모는 없다', () => {
    const rows = docRows();
    expect(rows).toHaveLength(28);
    const byId = new Map((c.scenes ?? []).flatMap((s) => s.objects.map((o) => [o.id, { ...o, placeId: s.placeId }] as const)));
    for (const row of rows) {
      const o = byId.get(row.id);
      expect(o, row.id).toBeDefined();
      if (!o) continue;
      expect(c.places.find((p) => p.id === o.placeId)?.name, row.id).toBe(row.place);
      expect(o.name, row.id).toBe(row.name);
      expect(o.pos, row.id).toEqual(row.pos);
      const want = row.r.flatMap((t, i) => (t ? [{ fromRound: (i + 1) as RoundNo, text: t }] : []));
      expect(o.lines, row.id).toEqual(want);
      expect(Object.keys(o).sort(), row.id).toEqual(['id', 'lines', 'name', 'placeId', 'pos']); // 조건·메모 필드 없음
    }
  });

  it('관찰 한 줄은 40자 이내(공백 포함, 원고 10-3) · 모든 물건에 R1 줄이 있다(처음부터 그림에 보인다)', () => {
    for (const l of allLines()) expect(Array.from(l.text).length, `${l.id} R${l.fromRound}`).toBeLessThanOrEqual(40);
    for (const s of c.scenes ?? []) for (const o of s.objects) expect(o.lines[0]?.fromRound, o.id).toBe(1);
  });

  it('범인 이름·호칭은 R1·R2 관찰에 없다(원고 10-4 「숙의를 가리키는 줄 0개」 · R2 는 엉뚱한 사람을 겨누는 미끼)', () => {
    const culprit = c.roles.find((r) => r.id === c.culprit)!;
    const terms = [culprit.name, culprit.shortName!, '숙의', '연씨', '후궁', '숙의방', '꽃님', '취향당'];
    for (const l of [...linesOf(1), ...linesOf(2)]) {
      for (const t of terms) expect(l.text.includes(t), `${l.id} R${l.fromRound} ← ${t}`).toBe(false);
    }
  });

  it('결정 단서는 관찰로 옮기지 않았다(원고 10-4 「옮기지 않은 것」 — 숨길 수 있는 장소 카드에만)', () => {
    const decisive = ['외매듭', '나비매듭', '티끌', '개미', '명주실', '약봉지', '편지', '쪽지', '노리개', '생부자', '수령', '임부'];
    for (const l of allLines()) {
      for (const w of decisive) expect(l.text.includes(w), `${l.id} R${l.fromRound} ← ${w}`).toBe(false);
    }
  });
});

describe('현장 관찰 — 라운드 잠금', () => {
  it('조사 전(0)·이상한 값은 아무것도 없다', () => {
    for (const r of [0, -1, Number.NaN, 0.5]) {
      expect(scenesFor(c, r), String(r)).toEqual([]);
      expect(newObservations(c, r)).toEqual([]);
      expect(sceneAt(c, r, 'dg')).toBeNull();
    }
    expect(sceneRound(7)).toBe(3);
    expect(sceneRound(2.9)).toBe(2);
  });

  it('조사 N 화면엔 R(N+1) 이후 줄의 글자가 한 조각도 없다(현장·새 관찰·물건 찾기 모두)', () => {
    for (const upTo of [1, 2] as const) {
      const future = allLines().filter((l) => l.fromRound > upTo).map((l) => probe(l.text));
      expect(future.length).toBeGreaterThan(0);
      const json = JSON.stringify([
        scenesFor(c, upTo),
        newObservations(c, upTo),
        c.places.map((p) => sceneAt(c, upTo, p.id)),
        allLines().map((l) => sceneObjectById(c, upTo, l.id)),
      ]);
      for (const f of future) expect(json.includes(f), `R${upTo} ← ${f}`).toBe(false);
    }
  });

  it('조사 N 화면엔 R1..RN 줄이 모두, 오래된 것부터 있다', () => {
    for (const upTo of [1, 2, 3] as const) {
      const shown = scenesFor(c, upTo).flatMap((v) => v.objects.flatMap((o) => o.lines.map((l) => `${o.id}:${l.fromRound}:${l.text}`)));
      const want = allLines()
        .filter((l) => l.fromRound <= upTo)
        .map((l) => `${l.id}:${l.fromRound}:${l.text}`);
      expect(shown.slice().sort()).toEqual(want.slice().sort());
      for (const v of scenesFor(c, upTo)) for (const o of v.objects) expect(o.lines.map((l) => l.fromRound)).toEqual([...o.lines.map((l) => l.fromRound)].sort());
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

describe('현장 관찰 — 「새」 표시 · 본 물건 키 · 순서', () => {
  it('R1 은 「새」 없음, R2 는 새 줄이 열린 5개, R3 는 7개 — 새 관찰 목록도 같은 줄', () => {
    const fresh = (r: RoundNo) =>
      scenesFor(c, r)
        .flatMap((v) => v.objects)
        .filter((o) => o.isNew)
        .map((o) => o.id)
        .sort();
    expect(fresh(1)).toEqual([]);
    expect(fresh(2)).toEqual(linesOf(2).map((l) => l.id).sort());
    expect(fresh(3)).toEqual(linesOf(3).map((l) => l.id).sort());
    expect(newObservations(c, 1)).toEqual([]);
    for (const r of [2, 3] as const) {
      const list = newObservations(c, r);
      expect(list.map((x) => x.text).sort()).toEqual(linesOf(r).map((l) => l.text).sort());
      expect(list.every((x) => x.round === r && x.placeName && x.name)).toBe(true);
      expect(scenesFor(c, r).reduce((sum, v) => sum + v.newCount, 0)).toBe(list.length);
    }
  });

  it('본 물건 키 = 물건id@마지막 줄 라운드 — 새 줄이 붙어야 키가 바뀐다', () => {
    const key = (r: RoundNo, id: string) => sceneObjectById(c, r, id)!.seenKey;
    expect([key(1, 'OB-SG1'), key(2, 'OB-SG1'), key(3, 'OB-SG1')]).toEqual(['OB-SG1@1', 'OB-SG1@1', 'OB-SG1@1']);
    expect([key(1, 'OB-DG1'), key(2, 'OB-DG1'), key(3, 'OB-DG1')]).toEqual(['OB-DG1@1', 'OB-DG1@1', 'OB-DG1@3']);
    expect([key(1, 'OB-NY2'), key(2, 'OB-NY2'), key(3, 'OB-NY2')]).toEqual(['OB-NY2@1', 'OB-NY2@2', 'OB-NY2@2']);
    expect(observationSeenKey('OB-X1', 2)).toBe('OB-X1@2');
  });

  it('장소 순서 = 그 라운드 장소 순(동궁전부터 — 원고 10-1 「R1엔 동궁전부터」) · 장소 이름·그림 키 동봉', () => {
    for (const r of [1, 2, 3] as const) {
      const v = scenesFor(c, r);
      expect(v.map((x) => x.placeId)).toEqual(c.rounds[r - 1].placeIds);
      expect(v[0]).toMatchObject({ placeId: 'dg', placeName: '동궁전', art: 'scene-dg', round: r });
    }
    expect(sceneAt(c, 1, 'nowhere')).toBeNull();
  });
});

describe('현장 관찰 — 역할 중립', () => {
  it('scene.ts 는 types 만 import 한다(assign·seal·deck·game 없음 — 방 코드만 가진 큰 화면이 범인을 계산할 수 없게, UX 스펙 S5)', () => {
    const imports = [...SCENE_SRC.matchAll(/^import[^;]*from '([^']+)';/gm)].map((m) => m[1]);
    expect(imports).toEqual(['./types']);
    const code = SCENE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // 주석 제외
    for (const w of ['assignmentOf', 'getSheet', 'getClue', 'clueSeal', 'culprit', 'roles']) expect(code.includes(w), w).toBe(false);
  });

  it('조회 함수는 인원·자리를 받지 않는다 — 같은 라운드면 언제나 같은 결과', () => {
    expect(scenesFor.length).toBe(2);
    expect(newObservations.length).toBe(2);
    expect(sceneAt.length).toBe(3);
    expect(JSON.stringify(scenesFor(c, 3))).toBe(JSON.stringify(scenesFor(c, 3)));
  });
});

describe('현장 관찰 — 무결성 검사(validateCase)', () => {
  const base = makeFixtureCase();
  const good: SceneDef[] = [
    {
      placeId: 'hall',
      art: 'scene-hall',
      objects: [
        { id: 'OB-H1', name: '사발', pos: [10, 50], lines: [{ fromRound: 1, text: '[픽스처] 사발' }, { fromRound: 3, text: '[픽스처] 사발 R3' }] },
        { id: 'OB-H2', name: '문', pos: [80, 40], lines: [{ fromRound: 1, text: '[픽스처] 문' }] },
      ],
    },
  ];
  const withScenes = (scenes: SceneDef[]): GungCase => ({ ...base, scenes });

  it('정상 데이터·현장이 없는 사건은 오류 0 — 현장이 없으면 조회 결과도 비어 있다', () => {
    expect(caseErrors(withScenes(good))).toEqual([]);
    expect(caseErrors(base)).toEqual([]);
    expect(scenesFor(base, 3)).toEqual([]);
    expect(scenesFor(withScenes(good), 1).map((v) => v.objects.map((o) => o.lines.length))).toEqual([[1, 1]]);
  });

  it('없는 장소 · 중복 id(카드 id 포함) · 위치 범위 밖 · 줄 없음 · 라운드 역순/중복 · 빈 줄은 오류', () => {
    const o = good[0].objects[0];
    const bad: [string, SceneDef[]][] = [
      ['없는 장소', [{ ...good[0], placeId: 'ghost' }]],
      ['장소 중복', [good[0], { ...good[0], objects: [{ ...o, id: 'OB-H9' }] }]],
      ['id 중복', [{ ...good[0], objects: [o, { ...o }] }]],
      ['카드 id 와 겹침', [{ ...good[0], objects: [{ ...o, id: 'PB-1' }] }]],
      ['위치', [{ ...good[0], objects: [{ ...o, pos: [101, 5] }] }]],
      ['줄 없음', [{ ...good[0], objects: [{ ...o, lines: [] }] }]],
      ['역순', [{ ...good[0], objects: [{ ...o, lines: [{ fromRound: 2, text: 'a' }, { fromRound: 1, text: 'b' }] }] }]],
      ['라운드 중복', [{ ...good[0], objects: [{ ...o, lines: [{ fromRound: 1, text: 'a' }, { fromRound: 1, text: 'b' }] }] }]],
      ['빈 줄', [{ ...good[0], objects: [{ ...o, lines: [{ fromRound: 1, text: '  ' }] }] }]],
      ['그림 키 없음', [{ ...good[0], art: '' }]],
    ];
    for (const [label, scenes] of bad) expect(caseErrors(withScenes(scenes)).length, label).toBeGreaterThan(0);
  });

  it('40자 넘는 줄은 경고(길이류)', () => {
    const long = [{ ...good[0], objects: [{ ...good[0].objects[0], lines: [{ fromRound: 1 as RoundNo, text: '가'.repeat(41) }] }] }];
    const warns = validateCase(withScenes(long)).filter((i) => i.level === 'warn');
    expect(warns.some((w) => /관찰 41자 > 40/.test(w.msg))).toBe(true);
  });
});
