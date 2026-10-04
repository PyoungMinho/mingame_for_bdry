/**
 * 개선 묶음 1(docs/planning/gung-improve-spec.md) — 엔진·데이터 수용 기준.
 *  G2 라운드 진입 타이머 · G4 무고자 정체 본문 · R2 배치도·호칭표·인물록 · R3 시각 어림 · R4 수첩 저장 · R5 인장·보드 ·
 *  공통 규칙(새 안내 문구 금칙어 · 공유 출력에 인장·카드 id·수첩 없음).
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import {
  ALIAS_TABLE,
  PALACE_MAP_NOTE,
  PALACE_MAPS,
  palaceMapTexts,
  peopleRoster,
} from './case-extras';
import { publicBoardUpTo, roundDef, timeHint, timeTable, TIME_TABLE_NOTE } from './deck';
import { assignFromCode, castFor, getAllSheets, getSheet, publicSeats, roleById, type Assignment } from './assign';
import {
  BOARD_LIMIT,
  applyAction,
  assignmentOf,
  isQuietTimer,
  newHostGame,
  reachedRound,
  resultOf,
  type GameAction,
  type GameState,
} from './game';
import { GUIDE, GUIDE_BANNED_WORDS, GUIDE_COPY, guideText, objectParticle } from './guide-data';
import {
  NOTE_FREE_MAX,
  NOTE_KEY,
  NOTE_LINE_MAX,
  NOTE_TTL_MS,
  clearNote,
  cycleMark,
  emptyNote,
  loadNote,
  nextMark,
  noteRows,
  sanitizeNote,
  saveNote,
  setFree,
  setLine,
} from './notes';
import { hash32, makeRng } from './rng';
import { SEED_ALPHABET } from './room';
import { clueBySeal, clueSeal, displayCardId, parseSeal, placeCardsFor, sealTable } from './seal';
import { ogResultUrl, resultPayload, resultShareInput } from './share';
import { loadGame, memoryStorage, saveGame, type StorageLike } from './storage';
import { DEFAULT_INNOCENT_BODY, PLAYER_COUNTS, type PlayerCount, type RoundNo } from './types';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);

function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}
const adv = (k: number): GameAction[] => Array.from({ length: k }, () => ({ type: 'advance' }) as GameAction);

function randomCodes(count: number, n: PlayerCount, salt: string): string[] {
  const rng = makeRng(hash32(`improve:${salt}:${n}`));
  const out = new Set<string>();
  while (out.size < count) {
    let s = '';
    for (let k = 0; k < 4; k++) s += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
    out.add(`${s}${n}`);
  }
  return [...out];
}
function findCode(n: PlayerCount, pred: (a: Assignment) => boolean): string {
  for (const code of randomCodes(4000, n, 'find')) if (pred(assignFromCode(c, code)!)) return code;
  throw new Error('no code');
}

// ─────────────────────────────── G2 ───────────────────────────────

describe('G2 → 6판 현장 보기 — 조사 라운드에 들어서면 현장(조용한 1분)부터, 고르기 타이머는 현장 → 고르기 때 돈다', () => {
  it('세 진입 경로(자기소개→조사1 · 토론→다음 조사 · 자기소개 건너뛰기)는 roundSub=scene + 현장 타이머 1:00 실행', () => {
    const h = newHostGame(c, '7F3K5', T0)!;
    const viaIntro = run(h, adv(4));
    const viaDiscuss = run(viaIntro, adv(3));
    const viaSkip = run(run(h, adv(2)), [{ type: 'skipIntro' }]);
    for (const [label, s, phase] of [
      ['intro→r1', viaIntro, 'r1'],
      ['discuss→r2', viaDiscuss, 'r2'],
      ['skipIntro', viaSkip, 'r1'],
    ] as const) {
      expect(s.phase, label).toBe(phase);
      expect(s.host!.roundSub, label).toBe('scene');
      expect(s.host!.timer, label).toMatchObject({ kind: 'scene', running: true, totalMs: 60_000 });
      expect(isQuietTimer(s.host!.timer!.kind), label).toBe(true);
      // 현장 → 고르기: 고르기 1:00 이 바로 돈다(별도 시작 버튼 없음)
      const select = applyAction(s, { type: 'advance' }, { c, now: T0 + 99_000 });
      expect(select.host!.roundSub, label).toBe('select');
      expect(select.host!.timer, label).toMatchObject({ kind: 'select', running: true, totalMs: 60_000, endsAt: T0 + 99_000 + 60_000 });
      expect(isQuietTimer(select.host!.timer!.kind), label).toBe(false);
    }
  });

  it('진행 단계 맞추기(복구 경로)로 들어오면 장소 고르기부터 · 타이머 꺼짐 · 다시 시작하면 1:00', () => {
    const viaSync = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'syncPhase', phase: 'r3' }]);
    expect(viaSync.host!.roundSub).toBe('select');
    expect(viaSync.host!.timer).toBeNull();
    const started = applyAction(viaSync, { type: 'timer', op: 'restart' }, { c, now: T0 + 99_000 });
    expect(started.host!.timer).toMatchObject({ kind: 'select', running: true, totalMs: 60_000, endsAt: T0 + 99_000 + 60_000 });
    const discuss = applyAction(started, { type: 'advance' }, { c, now: T0 + 100_000 });
    expect(discuss.host!.timer).toMatchObject({ kind: 'discuss', totalMs: 300_000 });
  });
});

// ─────────────────────────────── G4 ───────────────────────────────

describe('G4 정체 칸 — 범인·무고자 모두 머리 + 한 문단', () => {
  it('모든 인원·모든 자리에서 identity.body 가 비어 있지 않다(무고자 = DEFAULT_INNOCENT_BODY)', () => {
    for (const n of PLAYER_COUNTS) {
      const code = findCode(n, () => true);
      const a = assignFromCode(c, code)!;
      for (const sh of getAllSheets(c, a)) {
        expect(sh.identity.body, `${n}인 ${sh.roleId}`).toBeTruthy();
        if (!sh.isCulprit) expect(sh.identity.body).toBe(DEFAULT_INNOCENT_BODY);
      }
    }
  });
});

// ─────────────────────────────── 공통 규칙 · R1 · R6 ───────────────────────────────

describe('공통 규칙 — 새 안내 문구에 사건 고유어 0개', () => {
  it('GUIDE_COPY(규칙 상자·큐·변론 틀·수첩 범례·인장 문구…) × 금칙어 = 0', () => {
    expect(GUIDE_COPY.length).toBeGreaterThan(60);
    const hits = GUIDE_COPY.flatMap((t) => GUIDE_BANNED_WORDS.filter((w) => t.includes(w)).map((w) => `${w} ← ${t}`));
    expect(hits).toEqual([]);
    expect(DEFAULT_INNOCENT_BODY).toBeTruthy();
    expect(GUIDE_BANNED_WORDS.filter((w) => DEFAULT_INNOCENT_BODY.includes(w))).toEqual([]);
  });

  it('R6 변론 3칸에 「노린」「독이 든」이 없다 · R1 토론 한 줄은 질문 주제를 제안하지 않는다(사건 고유어 없음)', () => {
    expect(GUIDE.defenseFrame).toHaveLength(3);
    for (const line of [...GUIDE.defenseFrame, GUIDE.discussAskLine]) {
      expect(line).not.toMatch(/노린|독이 든/);
      expect(GUIDE_BANNED_WORDS.filter((w) => line.includes(w))).toEqual([]);
    }
    expect(GUIDE.lieRules).toHaveLength(5);
  });
});

// ─────────────────────────────── R2 ───────────────────────────────

describe('R2 궁 배치도 · 호칭표 · 인물록', () => {
  const mapText = palaceMapTexts().join('\n');

  it('배치도 글자: 7곳 이름 · 취향당(숙의 처소) · 동궁 내문 · 후원 협문(그 밤 안에서 빗장) · 주석 원문', () => {
    for (const p of c.places) expect(mapText, p.name).toContain(p.name);
    for (const t of ['취향당', '(숙의 처소)', '동궁 내문', '후원 협문(그 밤 안에서 빗장)', '서쪽 ◀', '▶ 동쪽', '갈림길', '큰길 ▶', '북↑']) expect(mapText).toContain(t);
    expect(palaceMapTexts()).toContain(PALACE_MAP_NOTE);
    expect(PALACE_MAP_NOTE).toBe('※ 동궁 침전을 드나드는 길은 내문 하나다. 서쪽(내관 처소·내의원)과 후원 연못은 갈림길에서 정반대 방향이다.');
  });

  it('배치도 금지어(사람·동선·시각·물건) 0 · 숙의 외 역할명 0(「내관 처소」는 장소 이름)', () => {
    for (const w of ['다과상', '꿀', '약봉지', '노리개', '매듭', '번', '나인', '해시', '자시', '술시']) expect(mapText, w).not.toContain(w);
    const roleWords = c.roles.flatMap((r) => [r.name, r.shortName ?? r.name]).filter((w) => w !== '숙의' && w !== '숙의 연씨' && w !== '내관');
    expect(roleWords.filter((w) => mapText.includes(w))).toEqual([]);
    // '내관'은 장소 「내관 처소」 안에서만
    expect(mapText.replaceAll('내관 처소', '')).not.toContain('내관');
  });

  it('배치도 장소 상자의 placeId 는 사건 장소 7곳과 1:1(아이콘은 places[].icon 에서)', () => {
    const ids = PALACE_MAPS.flatMap((m) => m.items).flatMap((it) => (it.kind === 'box' && it.placeId ? [it.placeId] : []));
    expect(ids.slice().sort()).toEqual(c.places.map((p) => p.id).sort());
  });

  it('호칭표의 모든 별칭은 공개 텍스트(브리핑 ∪ 공개 프로필 ∪ 공용·장소·추가 증언 카드 본문 ∪ 현장 관찰)에 실제로 있다', () => {
    const pub: string[] = [...c.briefing.paragraphs, ...c.roles.map((r) => r.profile)];
    // 6판: 현장 관찰(공용 화면)도 공개 텍스트다
    for (const sc of c.scenes ?? []) for (const o of sc.objects) pub.push(o.name, ...o.lines.map((l) => l.text));
    for (const rd of c.rounds) {
      for (const card of rd.publicCards ?? []) pub.push(card.title, card.body);
      for (const card of rd.npcCards ?? []) pub.push(card.title, card.body);
      for (const list of Object.values(rd.clues)) for (const card of list) pub.push(card.title, card.body);
    }
    const all = pub.join('\n');
    for (const row of ALIAS_TABLE) {
      for (const alias of row.aliases) expect(all, `${row.who} = ${alias}`).toContain(alias);
    }
  });

  it('인물록: 착석 n명(자리 순) + 4·5인만 「이 자리에 없으나」 NPC, 6인은 0', () => {
    for (const n of PLAYER_COUNTS) {
      const a = assignFromCode(c, findCode(n, () => true))!;
      const r = peopleRoster(c, a);
      expect(r.seated.map((p) => p.seat)).toEqual(publicSeats(c, a).map((s) => s.seat));
      expect(r.absent).toHaveLength(6 - n);
      for (const p of [...r.seated, ...r.absent]) expect(p.profile.length).toBeGreaterThan(20);
    }
  });
});

// ─────────────────────────────── R3 ───────────────────────────────

describe('R3 시각 어림 · 공용 단서 라운드 게이팅', () => {
  it('시각 어림 한 줄은 timeTable(c) 의 초·정·말과 어긋나지 않는다(하드코딩 아님)', () => {
    const hint = timeHint(c);
    expect(hint).toBe('시각 어림 — 술시 초 19시 · 해시 초 21시 · 자시 초 23시 · 축시 초 1시 · 정은 초에서 1시간 뒤 · 말은 1시간 반 넘어 · 반 시진 ≈ 1시간');
    const rows = timeTable(c).filter((r) => r.parts);
    expect(rows.length).toBe(c.gateAxis!.watches.length);
    for (const r of rows) {
      const [cho, jeong, mal] = r.parts!.split(' · ');
      const h = Number(/초≈(\d+)시/.exec(cho)![1]);
      expect(hint).toContain(`${r.name} 초 ${h}시`);
      // 정 = 초 + 1시간, 말 = 초 + 1시간 반 넘어
      expect(jeong).toBe(`정≈${(h + 1) % 24 === 0 ? '자정' : `${(h + 1) % 24}시`}`);
      expect(mal).toBe(`말≈${(h + 1) % 24}시 반 넘어`);
    }
    expect(hint.endsWith(TIME_TABLE_NOTE)).toBe(true);
  });

  it('공용 단서 목록은 이 폰이 들어선 라운드까지만 — r1·r2 목록에 PB-3·R3 추가 증언이 없다', () => {
    for (const n of PLAYER_COUNTS) {
      const r3 = [...(roundDef(c, 3).publicCards ?? []), ...(roundDef(c, 3).npcCards ?? [])].map((x) => x.id);
      for (const upTo of [1, 2]) expect(publicBoardUpTo(c, n, upTo).filter((x) => r3.includes(x.id))).toEqual([]);
    }
  });
});

// ─────────────────────────────── R4 ───────────────────────────────

function throwingStorage(): StorageLike {
  return {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
    removeItem: () => {
      throw new Error('blocked');
    },
  };
}

describe('R4 개인 추리 수첩 — 순수 파서·저장', () => {
  it('행 = 착석 자리 중 내 자리를 뺀 모두(4·5·6인 × 모든 자리)', () => {
    for (const n of PLAYER_COUNTS) {
      for (let seat = 1; seat <= n; seat++) {
        const rows = noteRows(n, seat);
        expect(rows).toHaveLength(n - 1);
        expect(rows).not.toContain(seat);
      }
    }
  });

  it('칸 순환: 빈칸 → ○ → ✕ → 빈칸 · 한 줄 40자 · 자유 300자', () => {
    expect([nextMark(undefined), nextMark('o'), nextMark('x')]).toEqual(['o', 'x', undefined]);
    let n = emptyNote('7F3K5', 2, T0);
    n = cycleMark(n, 3, 'means', T0);
    expect(n.marks).toEqual({ 3: { means: 'o' } });
    n = cycleMark(n, 3, 'means', T0);
    expect(n.marks).toEqual({ 3: { means: 'x' } });
    n = cycleMark(n, 3, 'means', T0);
    expect(n.marks).toEqual({});
    n = setLine(n, 4, '가'.repeat(80), T0);
    expect(Array.from(n.lines[4])).toHaveLength(NOTE_LINE_MAX);
    n = setFree(n, '나'.repeat(999), T0);
    expect(Array.from(n.free)).toHaveLength(NOTE_FREE_MAX);
  });

  it('저장 키 gu:note:v1 하나 · 화이트리스트 복사 · 다른 code·seat 는 읽지 않고 지운다 · TTL 12시간 · 저장소가 throw 해도 죽지 않는다', () => {
    const st = memoryStorage();
    let n = cycleMark(emptyNote('7F3K5', 2, T0), 4, 'opp', T0);
    n = setLine(n, 3, '해시 무렵 동선 확인', T0);
    expect(saveNote(st, n)).toBe(true);
    expect(NOTE_KEY).toBe('gu:note:v1');
    expect(loadNote(st, T0 + 1000, { code: '7F3K5', seat: 2 })).toEqual(n);
    // 모르는 필드·내 자리 행·잘못된 표시는 저장에 실리지 않는다
    expect(sanitizeNote({ ...n, extra: 'x', marks: { 2: { means: 'o' } } })).toBeNull();
    expect(sanitizeNote({ ...n, marks: { 3: { means: '?' } } })).toBeNull();
    expect(JSON.parse(st.getItem(NOTE_KEY)!)).not.toHaveProperty('extra');
    // 다른 자리 → 지움
    expect(loadNote(st, T0, { code: '7F3K5', seat: 3 })).toBeNull();
    expect(st.getItem(NOTE_KEY)).toBeNull();
    // 다른 방 → 지움
    saveNote(st, n);
    expect(loadNote(st, T0, { code: '22225', seat: 2 })).toBeNull();
    expect(st.getItem(NOTE_KEY)).toBeNull();
    // TTL
    saveNote(st, n);
    expect(loadNote(st, n.updatedAt + NOTE_TTL_MS + 1, { code: '7F3K5', seat: 2 })).toBeNull();
    expect(st.getItem(NOTE_KEY)).toBeNull();
    // 깨진 저장
    st.setItem(NOTE_KEY, '{oops');
    expect(loadNote(st, T0, { code: '7F3K5', seat: 2 })).toBeNull();
    // throw 하는 저장소
    const bad = throwingStorage();
    expect(() => saveNote(bad, n)).not.toThrow();
    expect(saveNote(bad, n)).toBe(false);
    expect(() => loadNote(bad, T0, { code: '7F3K5', seat: 2 })).not.toThrow();
    expect(() => clearNote(bad)).not.toThrow();
  });

  it('수첩은 게임 상태(gu:game:v1)와 섞이지 않는다 — 게임 저장 JSON 에 수첩 필드가 없다', () => {
    const st = memoryStorage();
    saveNote(st, setFree(emptyNote('7F3K5', 1, T0), '비밀 추리 메모', T0));
    saveGame(st, newHostGame(c, '7F3K5', T0)!);
    expect(st.getItem('gu:game:v1')).not.toContain('비밀 추리 메모');
    expect(loadGame(st, T0).state!.code).toBe('7F3K5');
  });
});

// ─────────────────────────────── R5 ───────────────────────────────

describe('R5 인장 — 결정론·유일성·라운드 게이팅', () => {
  it('무작위 방 코드 500개 × 4·5·6인: 방 안 인장이 모두 다르고 4자리, 같은 입력이면 같은 값', () => {
    for (const n of PLAYER_COUNTS) {
      const cards = placeCardsFor(c, n);
      expect(cards.length).toBeGreaterThanOrEqual(21);
      for (const code of randomCodes(500, n, 'seal')) {
        const t = sealTable(c, n, code);
        const vals = [...t.values()];
        expect(vals).toHaveLength(cards.length);
        expect(new Set(vals).size).toBe(vals.length);
        for (const v of vals) expect(String(v)).toMatch(/^[1-9]\d{3}$/);
        const probe = cards[Math.floor(hash32(code) % cards.length)].id;
        expect(clueSeal(c, n, code, probe)).toBe(t.get(probe));
      }
    }
    // 결정론 — 캐시를 거치지 않은 다른 사건 객체 사본에서도 같다
    const copy = JSON.parse(JSON.stringify(c));
    expect([...sealTable(copy, 6, 'K7QZ6')]).toEqual([...sealTable(c, 6, 'K7QZ6')]);
  });

  it('공용 카드(PB)·추가 증언엔 인장이 없다', () => {
    for (const rd of c.rounds) {
      for (const card of [...(rd.publicCards ?? []), ...(rd.npcCards ?? [])]) expect(clueSeal(c, 4, '7F3K4', card.id)).toBeNull();
    }
  });

  it('r2 방장: R1·R2 카드 인장은 받고, R3 카드 인장은 틀린 번호와 똑같이 null(신탁 방지)', () => {
    const code = '7F3K6';
    const n = 6;
    for (const card of placeCardsFor(c, n)) {
      const seal = clueSeal(c, n, code, card.id)!;
      const got = clueBySeal(c, n, code, seal, 2);
      if (card.round <= 2) expect(got?.id).toBe(card.id);
      else expect(got).toBeNull();
      expect(clueBySeal(c, n, code, String(seal), 3)?.id).toBe(card.id);
    }
    const used = new Set(sealTable(c, n, code).values());
    let wrong = 1000;
    while (used.has(wrong)) wrong++;
    expect(clueBySeal(c, n, code, wrong, 3)).toBeNull();
    expect(clueBySeal(c, n, code, '12a4', 3)).toBeNull();
    expect(parseSeal('0999')).toBeNull();
    expect(parseSeal(' 4321 ')).toBe(4321);
  });

  it('공개 토스트 조사는 숫자 읽기에 맞춘다 — 스펙 예시 1234 는 「를」, 9680·1001 은 「을」', () => {
    expect(guideText.sealToast(1234)).toBe('공개했소 — 인장 1234를 방장에게 불러 주고, 소리 내어 읽으시오');
    expect(guideText.sealToast(9680)).toBe('공개했소 — 인장 9680을 방장에게 불러 주고, 소리 내어 읽으시오');
    expect([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010].map(objectParticle).join('')).toBe('을를을를를을을을를을');
    expect(guideText.sealLine(1234)).toBe('인장 1234 — 방장에게 불러 주면 공용 보드에 그대로 올라가오');
  });

  it('표시 id 는 BUG-25 규칙 — HW-1b → HW-1', () => {
    expect(displayCardId('HW-1b')).toBe('HW-1');
    expect(displayCardId('DG-2')).toBe('DG-2');
  });
});

describe('R5 공개 단서 보드 — 엔진 상태·되돌리기·저장', () => {
  const code = '7F3K5';
  const n = 5;
  const at = (round: RoundNo) => run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: round === 1 ? 'r1' : round === 2 ? 'r2' : 'r3' }]);
  const cardOf = (round: RoundNo) => placeCardsFor(c, n).find((x) => x.round === round)!;

  it('postClue: 들어선 라운드 카드만 · 이미 오른 카드는 새 자리만 덧붙임 · 장소 카드가 아니거나 자리가 틀리면 거부', () => {
    const s2 = at(2);
    const r1 = cardOf(1);
    const r3 = cardOf(3);
    let s = applyAction(s2, { type: 'postClue', id: r1.id, seats: [3, 2, 3] }, { c, now: T0 });
    expect(s.host!.board).toEqual([{ id: r1.id, round: 1, seats: [2, 3] }]);
    expect(applyAction(s, { type: 'postClue', id: r3.id, seats: [] }, { c, now: T0 })).toBe(s); // 미래 라운드
    expect(applyAction(s, { type: 'postClue', id: 'PB-1', seats: [] }, { c, now: T0 })).toBe(s); // 공용 카드
    expect(applyAction(s, { type: 'postClue', id: r1.id, seats: [9] }, { c, now: T0 })).toBe(s); // 없는 자리
    expect(applyAction(s, { type: 'postClue', id: r1.id, seats: [2] }, { c, now: T0 })).toBe(s); // 새 자리 없음
    s = applyAction(s, { type: 'postClue', id: r1.id, seats: [5] }, { c, now: T0 });
    expect(s.host!.board).toEqual([{ id: r1.id, round: 1, seats: [2, 3, 5] }]);
    // 플레이어 상태엔 보드가 없다
    const p = { ...s, role: 'player' as const, seat: 2, host: undefined };
    expect(applyAction(p, { type: 'postClue', id: cardOf(2).id, seats: [] }, { c, now: T0 })).toBe(p);
  });

  it('↶ 로 되돌려지고 「내리기」로도 지워진다 · 저장했다가 복원해도 같고, 저장 JSON 에 카드 본문이 없다', () => {
    const s2 = at(2);
    const r1 = cardOf(1);
    const r2 = cardOf(2);
    let s = run(s2, [
      { type: 'postClue', id: r1.id, seats: [2] },
      { type: 'postClue', id: r2.id, seats: [] },
    ]);
    expect(s.host!.board.map((e) => e.id)).toEqual([r1.id, r2.id]);
    const undone = applyAction(s, { type: 'undo' }, { c, now: T0 + 9000 });
    expect(undone.host!.board.map((e) => e.id)).toEqual([r1.id]);
    const down = applyAction(s, { type: 'unpostClue', id: r1.id }, { c, now: T0 + 9000 });
    expect(down.host!.board.map((e) => e.id)).toEqual([r2.id]);
    expect(applyAction(down, { type: 'undo' }, { c, now: T0 + 9500 }).host!.board.map((e) => e.id)).toEqual([r1.id, r2.id]);

    const st = memoryStorage();
    expect(saveGame(st, s)).toBe(true);
    const raw = st.getItem('gu:game:v1')!;
    for (const card of [r1, r2]) {
      expect(raw).not.toContain(card.body.slice(0, 12));
      expect(raw).not.toContain(card.title);
    }
    expect(loadGame(st, T0 + 10_000).state!.host!.board).toEqual(s.host!.board);
  });

  it('예전(개선 묶음 1 이전) 저장엔 board 가 없어도 빈 보드로 읽고, 깨진 줄은 그 줄만 버린다(최대 21·중복 제거)', () => {
    const s = at(1);
    const st = memoryStorage();
    saveGame(st, s);
    const old = JSON.parse(st.getItem('gu:game:v1')!);
    delete old.host.board;
    for (const h of old.host.history) delete h.host.board;
    st.setItem('gu:game:v1', JSON.stringify(old));
    expect(loadGame(st, T0).state!.host!.board).toEqual([]);

    const r1 = cardOf(1);
    old.host.board = [
      { id: r1.id, round: 1, seats: [2, 2, 4] },
      { id: r1.id, round: 1, seats: [3] },
      { id: 'PB<1>', round: 1, seats: [] },
      { id: 'DG-2', round: 7, seats: [] },
      { id: 'DG-3', round: 3, seats: [99] },
      ...Array.from({ length: 30 }, (_, i) => ({ id: `ZZ-${i}`, round: 2, seats: [] })),
    ];
    st.setItem('gu:game:v1', JSON.stringify(old));
    const board = loadGame(st, T0).state!.host!.board;
    expect(board[0]).toEqual({ id: r1.id, round: 1, seats: [2, 4] });
    expect(board.filter((e) => e.id === r1.id)).toHaveLength(1);
    expect(board.some((e) => e.id === 'PB<1>' || e.id === 'DG-3' || e.round > 3)).toBe(false);
    expect(board.length).toBeLessThanOrEqual(BOARD_LIMIT);
  });
});

// ─────────────────────────────── 공유(불변 2) ───────────────────────────────

describe('공통 규칙 — 결과 공유·OG 에 수첩·인장·카드 id·범인 없음', () => {
  it('보드에 카드를 올린 판의 resultShareInput·resultPayload·ogResultUrl 에 카드 id 형식·이 방 인장이 없다', () => {
    for (const n of PLAYER_COUNTS) {
      const code = findCode(n, (a) => a.culpritSeat !== 1);
      const a = assignmentOf(c, { code });
      let s = run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: 'r3' }]);
      for (const card of placeCardsFor(c, n).slice(0, 6)) s = applyAction(s, { type: 'postClue', id: card.id, seats: [2] }, { c, now: T0 });
      expect(s.host!.board.length).toBeGreaterThan(0);
      s = run(s, [{ type: 'syncPhase', phase: 'vote' }, ...adv(1)], T0 + 60_000);
      const others = Array.from({ length: n }, (_, i) => i + 1);
      for (const v of others) s = applyAction(s, { type: 'ballot', voter: v, target: v === a.culpritSeat ? (v === 1 ? 2 : 1) : a.culpritSeat }, { c, now: T0 + 70_000 });
      s = run(s, [{ type: 'syncPhase', phase: 'result' }], T0 + 80 * 60_000);
      const result = resultOf(c, s)!;
      expect(result.decided).toBe(true);
      const input = resultShareInput(result, n, '20261002');
      const payload = resultPayload({ ...input, origin: 'https://project-orsrw.vercel.app' });
      // 카카오 템플릿의 이미지 크기(1200×630)는 형식 상수라 빼고 본다
      const blob = JSON.stringify({ input, payload, og: ogResultUrl(input) }).replace(/"image(Width|Height)":\d+/g, '');
      expect(blob).not.toMatch(/\b[A-Z]{2,3}-\d/);
      for (const seal of sealTable(c, n, code).values()) expect(blob).not.toMatch(new RegExp(`(?<!\\d)${seal}(?!\\d)`));
      expect(blob).not.toContain(code);
      expect(blob).not.toMatch(/(?<!\d)\d{4}(?!\d)/); // 4자리 단독 숫자 자체가 없다(날짜는 8자리)
      for (const r of castFor(c, n)) expect(blob).not.toContain(roleById(c, r)!.name);
    }
  });
});

describe('보조 — reachedRound 기준 sheet 는 그대로(회귀)', () => {
  it('getSheet 무고자 정체 본문은 라운드와 무관', () => {
    const a = assignFromCode(c, '7F3K5')!;
    const seat = [1, 2, 3, 4, 5].find((s) => s !== a.culpritSeat)!;
    for (const r of [0, 1, 2, 3]) expect(getSheet(c, a, seat, r)!.identity.body).toBe(DEFAULT_INNOCENT_BODY);
    expect(reachedRound('defense')).toBe(3);
  });
});
