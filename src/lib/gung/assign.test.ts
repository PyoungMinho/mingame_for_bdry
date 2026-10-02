import { describe, expect, it } from 'vitest';
import {
  assignFromCode,
  assignSeats,
  castFor,
  getAllSheets,
  getSheet,
  npcRolesFor,
  publicSeats,
  roleAtSeat,
  seatOfRole,
  SHEET_SECTIONS,
} from './assign';
import { getClue, roundDef } from './deck';
import { makeFixtureCase, makeVariantCase } from './fixtures';
import { parseRoomCode, SEED_ALPHABET } from './room';
import { PLAYER_COUNTS, type GungCase, type PlayerCount, type RoundNo } from './types';
import { caseErrors, validateCase } from './validate';

/** 결정론적으로 서로 다른 코드 i 번째 */
function codeAt(i: number, n: PlayerCount): string {
  const A = SEED_ALPHABET;
  const L = A.length;
  const s = A[i % L] + A[Math.floor(i / L) % L] + A[Math.floor(i / L ** 2) % L] + A[(i * 7 + 3) % L];
  return s + n;
}

const room = (code: string) => parseRoomCode(code)!;

describe('assign — 고정 코드 스냅샷(커밋 간 불변)', () => {
  const c = makeFixtureCase();
  it.each([
    ['7F3K5', ['consort', 'queen', 'courtLady', 'eunuch', 'physician'], 1],
    ['22225', ['queen', 'consort', 'eunuch', 'courtLady', 'physician'], 2],
    ['ZZZZ6', ['queen', 'physician', 'crownPrincess', 'consort', 'courtLady', 'eunuch'], 4],
    ['ABCD4', ['consort', 'queen', 'eunuch', 'physician'], 1],
    ['7F3K4', ['queen', 'eunuch', 'consort', 'physician'], 3],
  ] as const)('%s', (code, seats, culpritSeat) => {
    const a = assignSeats(c, room(code));
    expect(a.seats).toEqual(seats);
    expect(a.culpritSeat).toBe(culpritSeat);
    expect(a.culpritRole).toBe('consort');
  });

  it('자리별 배분 카드 스냅샷(약방 1라운드 2장)', () => {
    const r = room('7F3K5');
    expect([1, 2, 3, 4, 5].map((s) => getClue(c, r, 1, 'clinic', s)!.id)).toEqual(['F1-CLI-B', 'F1-CLI-A', 'F1-CLI-A', 'F1-CLI-B', 'F1-CLI-B']);
  });
});

describe('assign — 결정론: 같은 코드·자리 = 어느 기기에서나 같은 역할·카드', () => {
  it('사건 객체를 새로 만들어도(=다른 기기), JSON 왕복해도 결과가 같다', () => {
    const deviceA = makeFixtureCase();
    const deviceB = JSON.parse(JSON.stringify(makeFixtureCase())) as GungCase;
    for (let i = 0; i < 300; i++) {
      for (const n of PLAYER_COUNTS) {
        const code = codeAt(i, n);
        const a = assignSeats(deviceA, room(code));
        const b = assignSeats(deviceB, room(code));
        expect(b).toEqual(a);
        for (let seat = 1; seat <= n; seat++) {
          expect(getSheet(deviceB, b, seat)).toEqual(getSheet(deviceA, a, seat));
          for (const r of [1, 2, 3] as RoundNo[]) {
            for (const pid of roundDef(deviceA, r).placeIds) {
              expect(getClue(deviceB, room(code), r, pid, seat)).toEqual(getClue(deviceA, room(code), r, pid, seat));
            }
          }
        }
      }
    }
  });

  it('assignFromCode 는 하이픈·소문자를 받아도 같은 배정, 잘못된 코드는 null', () => {
    const c = makeFixtureCase();
    expect(assignFromCode(c, '7f3k-5')).toEqual(assignSeats(c, room('7F3K5')));
    expect(assignFromCode(c, '7F3K9')).toBeNull();
  });

  it('사건 id 가 다르면 같은 코드라도 배정이 다를 수 있다(시드에 caseId 포함)', () => {
    const a = makeFixtureCase();
    const b = { ...makeFixtureCase(), id: 'other-case' };
    let differ = 0;
    for (let i = 0; i < 50; i++) {
      if (JSON.stringify(assignSeats(a, room(codeAt(i, 6))).seats) !== JSON.stringify(assignSeats(b, room(codeAt(i, 6))).seats)) differ++;
    }
    expect(differ).toBeGreaterThan(30);
  });
});

describe('assign — 불변식: 모든 인원에서 범인 포함, 역할 중복 없음, 우선순위 1~N 만', () => {
  const c = makeFixtureCase();
  it('cast·NPC 구분', () => {
    expect(castFor(c, 4)).toEqual(['queen', 'consort', 'eunuch', 'physician']);
    expect(castFor(c, 5)).toEqual(['queen', 'consort', 'eunuch', 'physician', 'courtLady']);
    expect(castFor(c, 6)).toHaveLength(6);
    expect(npcRolesFor(c, 4)).toEqual(['courtLady', 'crownPrincess']);
    expect(npcRolesFor(c, 5)).toEqual(['crownPrincess']);
    expect(npcRolesFor(c, 6)).toEqual([]);
  });

  it.each(PLAYER_COUNTS)('%i인 — 2000개 코드', (n) => {
    const cast = castFor(c, n);
    const culpritSeats: Record<number, number> = {};
    for (let i = 0; i < 2000; i++) {
      const a = assignSeats(c, room(codeAt(i, n)));
      expect(a.seats).toHaveLength(n);
      expect(new Set(a.seats).size).toBe(n); // 중복 없음
      expect(a.seats.slice().sort()).toEqual(cast.slice().sort()); // 우선순위 1~N 역할의 순열
      expect(a.seats).toContain(a.culpritRole); // 범인은 반드시 플레이어
      expect(roleAtSeat(a, a.culpritSeat)).toBe(a.culpritRole);
      expect(seatOfRole(a, a.culpritRole)).toBe(a.culpritSeat);
      culpritSeats[a.culpritSeat] = (culpritSeats[a.culpritSeat] ?? 0) + 1;
    }
    // 범인 자리는 자리마다 고르게(방장 자리 1 고정 아님) — 기대값 2000/n 의 절반 이상
    for (let s = 1; s <= n; s++) expect(culpritSeats[s] ?? 0).toBeGreaterThan(2000 / n / 2);
  });

  it('범인 변주(배열) — 후보 중 1명, 결정론, 후보가 고르게 뽑힌다', () => {
    const v = makeVariantCase();
    const seen: Record<string, number> = {};
    for (let i = 0; i < 900; i++) {
      for (const n of PLAYER_COUNTS) {
        const a = assignSeats(v, room(codeAt(i, n)));
        expect(['queen', 'consort', 'eunuch']).toContain(a.culpritRole);
        expect(a.seats).toContain(a.culpritRole);
        expect(assignSeats(v, room(codeAt(i, n)))).toEqual(a);
        seen[a.culpritRole] = (seen[a.culpritRole] ?? 0) + 1;
      }
    }
    for (const id of ['queen', 'consort', 'eunuch']) expect(seen[id]).toBeGreaterThan(500);
  });
});

describe('assign — 내 패(역할 시트)', () => {
  const c = makeFixtureCase();
  const a = assignSeats(c, room('7F3K5')); // 자리1 = consort(범인)

  it('범인과 무고자의 섹션 구조가 같고 정체 텍스트만 다르다(D3)', () => {
    const culprit = getSheet(c, a, 1)!;
    const innocent = getSheet(c, a, 2)!;
    expect(culprit.isCulprit).toBe(true);
    expect(innocent.isCulprit).toBe(false);
    expect(Object.keys(culprit).sort()).toEqual(Object.keys(innocent).sort());
    expect(culprit.identity.headline).toBe('당신이 범인이오.');
    expect(culprit.identity.body).toBe('[픽스처] 꿀단지에 독을 넣었다.');
    expect(innocent.identity.headline).toBe('당신은 범인이 아니오. 진범을 찾으시오.');
    expect(SHEET_SECTIONS.map((s) => s.label)).toEqual(['정체', '신분', '비밀', '그날 밤', '거짓말', '미션', '말투']);
  });

  it('내 자리 데이터만 담는다(다른 역할 이름·비밀 없음)', () => {
    const mine = getSheet(c, a, 2)!; // queen
    const json = JSON.stringify(mine);
    for (const k of [2, 3, 4, 5, 6]) {
      expect(json).not.toContain(`역할${k} 비밀`);
      expect(json).not.toContain(`역할${k} 한눈에`);
      expect(json).not.toContain(`역할${k} 동선`);
    }
    expect(json).not.toContain('꿀단지에 독을 넣었다'); // 범인의 범행문
    expect(mine.roleId).toBe('queen');
  });

  it('인원별 덮어쓰기·역할 전용 용어·범인 변주 덮어쓰기', () => {
    const a4 = assignSeats(c, room('7F3K4'));
    const phys4 = getSheet(c, a4, seatOfRole(a4, 'physician')!)!;
    expect(phys4.secrets).toEqual(['4인 판 전용 비밀']);
    expect(phys4.terms.map((t) => t.id)).toEqual(['t-pulse']);
    const phys5 = getSheet(c, a, seatOfRole(a, 'physician')!)!;
    expect(phys5.secrets).toEqual(['역할4 비밀 ①', '역할4 비밀 ②']);

    const v = makeVariantCase();
    const va = assignSeats(v, room('7F3K5')); // 변주: queen 범인
    expect(va.culpritRole).toBe('queen');
    const q = getSheet(v, va, va.culpritSeat)!;
    expect(q.identity.body).toBe('[변주] 역할1 이 범인일 때의 범행');
  });

  it('없는 자리는 null, 모두의 패/공개 자리 정보', () => {
    expect(getSheet(c, a, 0)).toBeNull();
    expect(getSheet(c, a, 6)).toBeNull();
    expect(getAllSheets(c, a)).toHaveLength(5);
    expect(publicSeats(c, a).map((s) => s.roleId)).toEqual(a.seats);
    expect(publicSeats(c, a)[0]).toEqual({ seat: 1, roleId: 'consort', name: '역할2', shortName: '역2', icon: 'flower' });
  });
});

describe('validate — 사건 데이터 검사', () => {
  it('픽스처는 error 0', () => {
    expect(caseErrors(makeFixtureCase())).toEqual([]);
    expect(caseErrors(makeVariantCase())).toEqual([]);
  });

  it('범인이 priority 5(4인 판 NPC) 면 error', () => {
    const c = makeFixtureCase();
    c.culprit = 'courtLady';
    c.roles.find((r) => r.id === 'courtLady')!.crime = 'x';
    expect(caseErrors(c).some((e) => e.where === 'culprit' && e.msg.includes('priority 5'))).toBe(true);
  });

  it('범인 후보에 crime 이 없으면 error · priority 중복/결번 error', () => {
    const c = makeFixtureCase();
    delete c.roles.find((r) => r.id === 'consort')!.crime;
    expect(caseErrors(c).some((e) => e.msg.includes('crime'))).toBe(true);

    const d = makeFixtureCase();
    d.roles[5].priority = 5;
    expect(caseErrors(d).some((e) => e.msg.includes('중복'))).toBe(true);
  });

  it('어떤 인원에서 장소 카드가 비면 error(교체 카드 누락)', () => {
    const c = makeFixtureCase();
    c.rounds[0].clues.pond = c.rounds[0].clues.pond.filter((x) => x.id !== 'F1-POND-B');
    const errs = caseErrors(c);
    expect(errs.some((e) => e.msg.includes('4인 판 1라운드 "pond"'))).toBe(true);
    expect(errs.some((e) => e.msg.includes('5인 판 1라운드 "pond"'))).toBe(true);
    expect(errs.some((e) => e.msg.includes('6인 판'))).toBe(false);
  });

  it('없는 용어·장소·카드 id 중복은 error, 늘 플레이어인 NPC 카드·범인 이름 스포일러는 warn', () => {
    const c = makeFixtureCase();
    c.rounds[1].clues.hall[0].terms = ['nope'];
    c.rounds[2].placeIds.push('ghost');
    c.rounds[2].clues.kitchen[0].id = 'F1-HALL';
    c.rounds[0].npcCards!.push({ id: 'N1', roleId: 'queen', title: 't', body: 'b' });
    c.truth.beats[0].text = '역할2 가 범인이었다';
    const issues = validateCase(c);
    expect(issues.some((e) => e.level === 'error' && e.msg.includes('없는 용어 "nope"'))).toBe(true);
    expect(issues.some((e) => e.level === 'error' && e.msg.includes('없는 장소 "ghost"'))).toBe(true);
    expect(issues.some((e) => e.level === 'error' && e.msg.includes('"F1-HALL" 중복'))).toBe(true);
    expect(issues.some((e) => e.level === 'warn' && e.msg.includes('영영 안 열림'))).toBe(true);
    expect(issues.some((e) => e.level === 'warn' && e.msg.includes('스포일러'))).toBe(true);
  });
});
