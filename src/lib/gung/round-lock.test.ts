/**
 * 라운드 잠금(원고 3판 「라운드 잠금」) + 방장 '내문 출입 타임라인' 회귀 테스트.
 *
 *  - 조상궁·세자빈 패의 「R3에 떠오르는 기억」은 R3 시작 전엔 getSheet 결과 어디에도(문자열 한 조각도) 없어야 한다.
 *    서버가 없으므로 기준은 그 폰의 로컬 진행 단계(reachedRound(phase)).
 *  - 4·5·6인 전부, 모든 자리(방장 자리 1 포함), 여러 방 코드로 확인한다.
 *  - 출입 타임라인은 열린 공용 카드(PB-2·PB-3 — 라운드 시작 때 공개) 본문의 출입 줄만 그린다 — 진상·추론은 넣지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { assignFromCode, getAllSheets, getSheet, memoriesUnlockedBetween, memoryRounds, recheckRoundBetween, roleAtSeat, seatOfRole } from './assign';
import { sejaCase } from './case-data';
import { gateTimeline } from './deck';
import { examineObjects, myObservations, sceneStop, type ExamineLog } from './scene';
import { emptyHost, gateRoundsShown, PHASES, reachedRound, type GameState, type Phase } from './game';
import { SEED_ALPHABET } from './room';
import { PLAYER_COUNTS, type GungCase, type PlayerCount, type RoundNo } from './types';
import { caseErrors } from './validate';

const DOC = fs.readFileSync(path.resolve(__dirname, '../../../docs/planning/gung-case.md'), 'utf8');

/** 잠금 블록의 모든 줄 — 앞 14자만 잘라 "한 조각이라도" 새는지 본다 */
const MEMORY_LINES = sejaCase.roles.flatMap((r) => (r.memories ?? []).flatMap((m) => m.lines));
const MEMORY_PROBES = MEMORY_LINES.map((l) => l.slice(0, 14));

function leaks(obj: unknown): string[] {
  const json = JSON.stringify(obj);
  return MEMORY_PROBES.filter((p) => json.includes(p));
}

/** 결정론 방 코드 몇 개(인원별) — 자리 배정이 서로 다른 판을 두루 본다 */
function codes(n: PlayerCount, count = 24): string[] {
  const A = SEED_ALPHABET;
  return Array.from({ length: count }, (_, i) => `${A[i % A.length]}${A[(i * 7 + 3) % A.length]}${A[(i * 13 + 5) % A.length]}${A[(i * 17 + 11) % A.length]}${n}`);
}

function cleanDoc(s: string): string {
  return s
    .replace(/<br>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 원고 역할 k 섹션의 「R3에 떠오르는 기억」 '· ' 줄들 */
function docMemoryLines(roleNo: number): string[] {
  const start = DOC.indexOf(`### 역할 ${roleNo}.`);
  const end = DOC.indexOf('\n### ', start + 5);
  const block = DOC.slice(start, end < 0 ? undefined : end);
  const at = block.indexOf('**R3에 떠오르는 기억**');
  if (at < 0) return [];
  const after = block.slice(at).split('\n').slice(1);
  const out: string[] = [];
  for (const line of after) {
    if (line.startsWith('**')) break;
    if (line.startsWith('· ')) out.push(cleanDoc(line.slice(2)));
  }
  return out;
}

describe('라운드 잠금 — 데이터', () => {
  it('원고의 「R3에 떠오르는 기억」 블록(조상궁·세자빈)이 memories{fromRound:3} 로 글자 그대로 들어있다', () => {
    const courtLady = sejaCase.roles.find((r) => r.id === 'courtLady')!;
    const crownPrincess = sejaCase.roles.find((r) => r.id === 'crownPrincess')!;
    expect(docMemoryLines(5).length).toBeGreaterThan(0);
    expect(docMemoryLines(6).length).toBeGreaterThan(0);
    expect(courtLady.memories).toEqual([{ fromRound: 3, heading: 'R3에 떠오르는 기억', lines: docMemoryLines(5) }]);
    expect(crownPrincess.memories).toEqual([{ fromRound: 3, heading: 'R3에 떠오르는 기억', lines: docMemoryLines(6) }]);
  });

  it('잠금 블록 본문은 secrets·glance·night·mustTell 등 늘 보이는 칸 어디에도 섞여 있지 않다(옛 변환의 "(R3에 떠오르는 기억) …" 줄 금지)', () => {
    for (const r of sejaCase.roles) {
      const { memories, ...alwaysVisible } = r;
      void memories;
      expect(leaks(alwaysVisible), r.id).toEqual([]);
      for (const s of r.secrets) expect(s).not.toMatch(/떠오르는 기억\)/);
    }
  });

  it('잠금 블록이 있는 역할은 조상궁·세자빈 둘뿐이고, 둘 다 「물으면 사실대로」의 R3부터 표기가 글자 그대로 남아 있다', () => {
    expect(sejaCase.roles.filter((r) => r.memories?.length).map((r) => r.id)).toEqual(['courtLady', 'crownPrincess']);
    for (const id of ['courtLady', 'crownPrincess']) {
      const r = sejaCase.roles.find((x) => x.id === id)!;
      expect(r.mustTell.join(' ')).toMatch(/R3부터/);
      expect(r.glance.join(' ')).toMatch(/R3부터/);
    }
  });
});

describe('라운드 잠금 — getSheet(…, upToRound) (4·5·6인, 모든 자리)', () => {
  for (const n of PLAYER_COUNTS) {
    it(`${n}인: R3 전(라운드 0·1·2)엔 어느 자리 패에도 기억 본문이 없고, R3부터는 그 역할 패에만 있다`, () => {
      for (const code of codes(n)) {
        const a = assignFromCode(sejaCase, code)!;
        for (let seat = 1; seat <= n; seat++) {
          const role = sejaCase.roles.find((r) => r.id === roleAtSeat(a, seat))!;
          const has = Boolean(role.memories?.length);
          for (const r of [0, 1, 2] as const) {
            const sheet = getSheet(sejaCase, a, seat, r)!;
            expect(leaks(sheet), `${code} ${seat}번 R${r}`).toEqual([]);
            expect(sheet.memories.every((m) => !m.unlocked && !('lines' in m)), `${code} ${seat}번 R${r}`).toBe(true);
            expect(sheet.memories.length).toBe(has ? 1 : 0);
          }
          const r3 = getSheet(sejaCase, a, seat, 3)!;
          if (has) {
            expect(r3.memories).toEqual([{ fromRound: 3, heading: 'R3에 떠오르는 기억', unlocked: true, lines: role.memories![0].lines }]);
          } else {
            expect(r3.memories).toEqual([]);
            expect(leaks(r3)).toEqual([]);
          }
        }
      }
    });
  }

  it('upToRound 를 빠뜨리면(기본값) 잠긴 쪽으로 계산한다 — 호출부 실수로 새지 않게', () => {
    const code = codes(6).find((c) => seatOfRole(assignFromCode(sejaCase, c)!, 'courtLady'))!;
    const a = assignFromCode(sejaCase, code)!;
    const seat = seatOfRole(a, 'courtLady')!;
    expect(leaks(getSheet(sejaCase, a, seat))).toEqual([]);
    expect(getSheet(sejaCase, a, seat)!.round).toBe(0);
  });

  it('인원별 잠금 블록 보유 자리 수: 4인 0 · 5인 1(조상궁) · 6인 2(조상궁·세자빈)', () => {
    const expected: Record<PlayerCount, string[]> = { 4: [], 5: ['courtLady'], 6: ['courtLady', 'crownPrincess'] };
    for (const n of PLAYER_COUNTS) {
      const a = assignFromCode(sejaCase, codes(n)[0])!;
      const holders = getAllSheets(sejaCase, a)
        .filter((s) => s.memories.length)
        .map((s) => s.roleId)
        .sort();
      expect(holders, `${n}인`).toEqual(expected[n].slice().sort());
    }
  });

  it('진행 단계 → 잠금: 조사 3 이전 단계는 전부 잠김, 조사 3·최종 변론·지목·진상·결과는 열림', () => {
    const a = assignFromCode(sejaCase, codes(6)[1])!;
    const seat = seatOfRole(a, 'crownPrincess')!;
    const unlockedAt = (p: Phase) => getSheet(sejaCase, a, seat, reachedRound(p))!.memories[0].unlocked;
    const open = PHASES.filter(unlockedAt);
    expect(open).toEqual(['r3', 'defense', 'vote', 'reveal', 'result']);
  });

  it('모두의 패(getAllSheets, 게임 끝)는 기억까지 전부 보여 준다', () => {
    const a = assignFromCode(sejaCase, codes(6)[2])!;
    const json = JSON.stringify(getAllSheets(sejaCase, a));
    for (const l of MEMORY_LINES) expect(json).toContain(l);
  });

  it('「다시 확인하시오」 알림 판정(recheckRoundBetween) — 역할·인원과 무관, 넘어간 순간(2→3, 단계 맞추기로 0·1→3)에만', () => {
    expect(memoryRounds(sejaCase)).toEqual([3]);
    expect(recheckRoundBetween(sejaCase, 2, 3)).toBe(3);
    expect(recheckRoundBetween(sejaCase, 0, 3)).toBe(3);
    expect(recheckRoundBetween(sejaCase, 1, 2)).toBeNull();
    expect(recheckRoundBetween(sejaCase, 3, 3)).toBeNull();
    expect(recheckRoundBetween(sejaCase, 3, 2)).toBeNull();
    // 인원별 덮어쓰기·범인 덮어쓰기의 잠금 블록도 합친다(어느 역할이 가졌든 같은 라운드에 모두에게)
    const c2 = JSON.parse(JSON.stringify(sejaCase)) as GungCase;
    c2.roles.find((r) => r.id === 'queen')!.byCount = { 4: { memories: [{ fromRound: 2, heading: 'x', lines: ['y'] }] } };
    expect(memoryRounds(c2)).toEqual([2, 3]);
    expect(recheckRoundBetween(c2, 1, 2)).toBe(2);
    expect(recheckRoundBetween(c2, 1, 3)).toBe(3);
  });

  it('(역할별 잠금 블록 해제 — 내 패 봉인 속 표시용) 넘어간 순간에만, 뒤로 가거나 제자리면 없음', () => {
    const a = assignFromCode(sejaCase, codes(5)[3])!;
    const seat = seatOfRole(a, 'courtLady')!;
    expect(memoriesUnlockedBetween(sejaCase, a, seat, 2, 3).map((m) => m.heading)).toEqual(['R3에 떠오르는 기억']);
    expect(memoriesUnlockedBetween(sejaCase, a, seat, 0, 3)).toHaveLength(1);
    expect(memoriesUnlockedBetween(sejaCase, a, seat, 1, 2)).toEqual([]);
    expect(memoriesUnlockedBetween(sejaCase, a, seat, 3, 3)).toEqual([]);
    expect(memoriesUnlockedBetween(sejaCase, a, seat, 3, 2)).toEqual([]);
    // 잠금 블록이 없는 역할(어의)은 언제나 빈 배열
    const phys = seatOfRole(a, 'physician')!;
    expect(memoriesUnlockedBetween(sejaCase, a, phys, 2, 3)).toEqual([]);
  });

  it('validateCase: 잠금 블록이 secrets 에 섞이거나 fromRound 가 1~3 밖이면 error', () => {
    const bad = (patch: (c: GungCase) => void) => {
      const c = JSON.parse(JSON.stringify(sejaCase)) as GungCase;
      patch(c);
      return caseErrors(c);
    };
    expect(caseErrors(sejaCase)).toEqual([]);
    expect(
      bad((c) => {
        const r = c.roles.find((x) => x.id === 'courtLady')!;
        r.secrets.push(`(R3에 떠오르는 기억) ${r.memories![0].lines[0]}`);
      }).map((e) => e.where),
    ).toContain('roles.courtLady.secrets');
    expect(
      bad((c) => {
        c.roles.find((x) => x.id === 'crownPrincess')!.memories![0].fromRound = 4 as RoundNo;
      }).length,
    ).toBeGreaterThan(0);
  });
});

// ─────────────────────────────── 내문 출입 타임라인 ───────────────────────────────

function hostState(phase: Phase, opened: Partial<Record<RoundNo, boolean>>): Pick<GameState, 'phase' | 'host'> {
  return { phase, host: { ...emptyHost(), publicClueOpened: opened } };
}

describe('내문 출입 타임라인 — 데이터·엔진', () => {
  const pb = (id: string) => sejaCase.rounds.flatMap((r) => r.publicCards ?? []).find((c) => c.id === id)!;

  it('출입 기록은 PB-2·PB-3에만 있고, 모든 줄이 그 카드 본문(※ 앞 수문 기록)에 글자 그대로 있다', () => {
    const withLog = sejaCase.rounds.flatMap((r) => r.publicCards ?? []).filter((c) => c.gateLog?.length);
    expect(withLog.map((c) => c.id)).toEqual(['PB-2', 'PB-3']);
    for (const card of withLog) {
      const record = card.body.split('※')[0];
      for (const e of card.gateLog!) {
        // 같은 시각 줄이 여럿일 수 있다(해시 초 ×2) — 이름·入出·덧말이 모두 들어 있는 줄이 하나는 있어야 한다
        const lines = record.split('· ').filter((b) => b.startsWith(`${e.time}:`));
        const hit = lines.find(
          (b) => b.includes(e.who) && b.includes(e.dir === 'in' ? '入' : '出') && (!e.note || b.includes(`(${e.note})`)),
        );
        expect(hit, `${card.id} ${e.time} ${e.who} ${e.dir}`).toBeDefined();
      }
    }
  });

  it('PB-2 기록(술시·해시)을 순서대로 옮겼다 — 숙의 入 해시 초 → 出 해시 정, 빈궁·조상궁은 같은 순번(동시)', () => {
    expect(pb('PB-2').gateLog!.map((e) => `${e.seq}|${e.time}|${e.roleId}|${e.dir}`)).toEqual([
      '1|술시 정|physician|out',
      '2|해시 초|eunuch|out',
      '3|해시 초|consort|in',
      '4|해시 정|consort|out',
      '5|해시 정|crownPrincess|out',
      '5|해시 정|courtLady|out',
    ]);
    expect(pb('PB-3').gateLog!.map((e) => `${e.seq}|${e.time}|${e.roleId}|${e.dir}`)).toEqual([
      '1|자시 초|eunuch|in',
      '2|자시 정|eunuch|out',
      '3|자시 말|physician|in',
      '3|자시 말|eunuch|in',
      '4|자시 말|crownPrincess|in',
      '4|자시 말|courtLady|in',
      '5|축시 초|physician|out',
      '6|축시 초|physician|in',
    ]);
  });

  it('열린 라운드가 없거나 PB-1(출입 없음)뿐이면 그리지 않는다', () => {
    for (const n of PLAYER_COUNTS) {
      expect(gateTimeline(sejaCase, n, [])).toBeNull();
      expect(gateTimeline(sejaCase, n, [1])).toBeNull();
    }
  });

  it('R2(PB-2)만 열렸을 땐 자시·축시 기록이 하나도 없다 — 아직 안 열린 PB-3를 미리 그리지 않는다', () => {
    for (const n of PLAYER_COUNTS) {
      const t = gateTimeline(sejaCase, n, [1, 2])!;
      expect(t.marks.every((m) => m.cardId === 'PB-2')).toBe(true);
      expect(t.marks).toHaveLength(6);
      expect(t.marks.some((m) => /^(자시|축시)/.test(m.time))).toBe(false);
    }
  });

  it('눈금: 술시~축시 × 초·정·말 = 12, 시각 → 눈금 번호, 같은 눈금은 적힌 순서대로 왼→오', () => {
    const t = gateTimeline(sejaCase, 6, [2, 3])!;
    expect(t.ticks).toBe(12);
    expect(t.watches).toEqual(['술시', '해시', '자시', '축시']);
    expect(t.parts).toEqual(['초', '정', '말']);
    const at = (role: string, time: string, dir: 'in' | 'out') => t.marks.find((m) => m.roleId === role && m.time === time && m.dir === dir)!;
    expect(at('physician', '술시 정', 'out').tick).toBe(1);
    expect(at('consort', '해시 초', 'in').tick).toBe(3);
    expect(at('physician', '축시 초', 'out').tick).toBe(9);
    // 해시 초: 내관 出 → 숙의 入 (원고: 꿀단지는 내관이 나간 뒤 들어옴)
    expect(at('eunuch', '해시 초', 'out').pos).toBeLessThan(at('consort', '해시 초', 'in').pos);
    // 동시(같은 순번)는 같은 자리
    expect(at('crownPrincess', '해시 정', 'out').pos).toBe(at('courtLady', '해시 정', 'out').pos);
    // 축시 초 어의: 出 다음 入
    expect(at('physician', '축시 초', 'out').pos).toBeLessThan(at('physician', '축시 초', 'in').pos);
  });

  it('레인은 기록에 처음 나온 순서(범인·우선순위 순 아님), 이름은 역할 짧은 이름', () => {
    const t = gateTimeline(sejaCase, 4, [2, 3])!;
    expect(t.lanes.map((l) => l.roleId)).toEqual(['physician', 'eunuch', 'consort', 'crownPrincess', 'courtLady']);
    expect(t.lanes.map((l) => l.label)).toEqual(['어의', '내관', '숙의', '세자빈', '조상궁']);
  });

  it('막대(체류)는 기록에 入→出 이 둘 다 있을 때만 — 기록 밖 체류는 추론하지 않는다', () => {
    const t = gateTimeline(sejaCase, 5, [2, 3])!;
    const spans = t.spans.map((s) => `${s.roleId}:${Math.floor(s.from)}-${Math.floor(s.to)}`).sort();
    expect(spans).toEqual(['consort:3-4', 'eunuch:6-7', 'physician:8-9'].sort());
    const only2 = gateTimeline(sejaCase, 5, [2])!;
    expect(only2.spans.map((s) => s.roleId)).toEqual(['consort']);
  });

  it('진상 전용 정보(연못·약봉지·꿀단지·독)는 타임라인 어디에도 없다', () => {
    const json = JSON.stringify(gateTimeline(sejaCase, 6, [2, 3]));
    for (const w of ['연못', '약봉지', '꿀', '생부자', '독', '범인', '노리개']) expect(json).not.toContain(w);
  });

  it('gateRoundsShown [BUG-04 결정: 공용 카드는 라운드 시작 때 공개]: 들어선 라운드 전부, 아직 안 온 라운드는 절대 아님', () => {
    expect(gateRoundsShown(hostState('r1', {}))).toEqual([1]);
    expect(gateRoundsShown(hostState('r2', {}))).toEqual([1, 2]);
    expect(gateRoundsShown(hostState('r3', {}))).toEqual([1, 2, 3]);
    expect(gateRoundsShown(hostState('defense', {}))).toEqual([1, 2, 3]);
    // 되돌리기로 조사 2에 돌아왔는데 3라운드 열림 표시가 남아 있어도 PB-3는 그리지 않는다
    expect(gateRoundsShown(hostState('r2', { 2: true, 3: true }))).toEqual([1, 2]);
    expect(gateRoundsShown(hostState('intro', { 1: true, 2: true }))).toEqual([]);
  });

  it('validateCase: 눈금 밖 시각·본문에 없는 출입은 error', () => {
    const c = JSON.parse(JSON.stringify(sejaCase)) as GungCase;
    const card = c.rounds[1].publicCards![0];
    card.gateLog![0] = { ...card.gateLog![0], time: '인시 초' };
    card.gateLog![1] = { ...card.gateLog![1], who: '중전 서씨' };
    const where = caseErrors(c).map((e) => e.msg);
    expect(where.some((m) => m.includes('눈금 밖 시각'))).toBe(true);
    expect(where.some((m) => m.includes('카드 본문에 없는 출입'))).toBe(true);
  });
});

describe('라운드 잠금 — 현장(7판 10장 조사 따로, 방장 진행 단계 기준)', () => {
  const objs = (sejaCase.scenes ?? []).flatMap((sc) => sc.objects);
  const lines = objs.flatMap((o) => o.lines);
  /** 모든 조사에 모든 물건을 본 위조 기록 — 그래도 들어선 라운드 뒤 줄은 안 나와야 한다 */
  const all: ExamineLog = { 1: objs.map((o) => o.id), 2: objs.map((o) => o.id), 3: objs.map((o) => o.id) };

  it('모든 단계에서 그 단계가 들어선 라운드 뒤의 관찰 줄은 이동·살펴보기·내 관찰 어디에도 없다', () => {
    for (const phase of PHASES) {
      const reached = reachedRound(phase);
      const json = JSON.stringify([sceneStop(sejaCase, reached), examineObjects(sejaCase, reached), myObservations(sejaCase, all, reached)]);
      for (const l of lines) {
        if (l.fromRound > reached) expect(json.includes(l.text), `${phase}(R${reached}) ← R${l.fromRound} ${l.text.slice(0, 12)}`).toBe(false);
      }
    }
  });

  it('6판 R3 공용 관찰(의관·번 나인)은 7판 R3 동궁전 살펴보기 줄 — 조사 3 전엔 어떤 기록으로도 나오지 않는다', () => {
    const moved = lines.filter((l) => l.fromRound === 3);
    expect(moved.length).toBe(5);
    const json = JSON.stringify(myObservations(sejaCase, all, 2));
    for (const l of moved) expect(json.includes(l.text), l.text.slice(0, 12)).toBe(false);
  });
});
