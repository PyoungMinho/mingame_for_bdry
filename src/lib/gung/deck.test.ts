import { describe, expect, it } from 'vitest';
import {
  baseTerms,
  cardsAtPlace,
  estimateReadMinutes,
  getClue,
  getNpcCards,
  getPublicCards,
  getRoundBoard,
  isPlaceInRound,
  joinCastNames,
  publicBoardUpTo,
  resolveBriefing,
  roundPlaces,
  visibleTerms,
} from './deck';
import { makeFixtureCase } from './fixtures';
import { parseRoomCode, SEED_ALPHABET } from './room';
import { PLAYER_COUNTS, type PlayerCount } from './types';

const c = makeFixtureCase();
const room = (code: string) => parseRoomCode(code)!;

describe('deck — 장소', () => {
  it('라운드마다 열리는 장소(데이터 주도)', () => {
    expect(roundPlaces(c, 1).map((p) => p.id)).toEqual(['hall', 'kitchen', 'clinic', 'pond']);
    expect(roundPlaces(c, 2).map((p) => p.id)).toEqual(['hall', 'kitchen', 'pond']);
    expect(isPlaceInRound(c, 2, 'clinic')).toBe(false);
    expect(getClue(c, room('7F3K5'), 2, 'clinic', 1)).toBeNull();
    expect(getClue(c, room('7F3K5'), 1, 'nowhere', 1)).toBeNull();
  });
});

describe('deck — 인원별 교체 카드', () => {
  it('onlyWhen: 6인(역할6 플레이어) = 원본, 4·5인(역할6 NPC) = 대체', () => {
    expect(cardsAtPlace(c, 6, 1, 'pond').map((x) => x.id)).toEqual(['F1-POND']);
    expect(cardsAtPlace(c, 5, 1, 'pond').map((x) => x.id)).toEqual(['F1-POND-B']);
    expect(cardsAtPlace(c, 4, 1, 'pond').map((x) => x.id)).toEqual(['F1-POND-B']);
  });

  it('forCount: 4인 전용 / 5·6인 전용', () => {
    expect(cardsAtPlace(c, 4, 2, 'kitchen').map((x) => x.id)).toEqual(['F2-KIT-4']);
    expect(cardsAtPlace(c, 5, 2, 'kitchen').map((x) => x.id)).toEqual(['F2-KIT']);
    expect(cardsAtPlace(c, 6, 2, 'kitchen').map((x) => x.id)).toEqual(['F2-KIT']);
  });

  it('교체 카드는 받은 카드에 "교체"·인원 정보를 싣지 않는다', () => {
    const card = getClue(c, room('7F3K4'), 1, 'pond', 2)!;
    expect(Object.keys(card).sort()).toEqual(['body', 'id', 'kind', 'placeId', 'round', 'terms', 'title']);
  });
});

describe('deck — 같은 장소 = 같은 카드 / 여러 장 = 자리별 결정론 배분', () => {
  it('1장짜리 장소는 모든 자리가 같은 카드', () => {
    for (const n of PLAYER_COUNTS) {
      const r = room(`7F3K${n}`);
      const ids = new Set(Array.from({ length: n }, (_, i) => getClue(c, r, 1, 'hall', i + 1)!.id));
      expect([...ids]).toEqual(['F1-HALL']);
    }
  });

  it('2장짜리 장소는 같은 코드·자리면 늘 같은 카드, 코드 전체로 보면 두 장 모두 나온다', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const n = PLAYER_COUNTS[i % 3] as PlayerCount;
      const r = room(SEED_ALPHABET[i % 31] + SEED_ALPHABET[(i * 5) % 31] + '7K' + n);
      for (let s = 1; s <= n; s++) {
        const a = getClue(c, r, 1, 'clinic', s)!;
        const b = getClue(makeFixtureCase(), r, 1, 'clinic', s)!;
        expect(b).toEqual(a);
        seen.add(a.id);
      }
    }
    expect([...seen].sort()).toEqual(['F1-CLI-A', 'F1-CLI-B']);
  });
});

describe('deck — 공용 카드·NPC 증언', () => {
  it('공용(PB) 카드는 라운드별로', () => {
    expect(getPublicCards(c, 5, 1).map((x) => x.id)).toEqual(['PB-1']);
    expect(getPublicCards(c, 5, 2)[0]).toMatchObject({ kind: 'public', id: 'PB-2', round: 2 });
  });

  it('NPC 카드: 4인 = 5·6번, 5인 = 6번만, 6인 = 없음', () => {
    expect(getNpcCards(c, 4, 1).map((x) => x.id)).toEqual(['N5-1', 'N6-1']);
    expect(getNpcCards(c, 5, 2).map((x) => x.id)).toEqual(['N6-2']);
    expect(getNpcCards(c, 6, 3)).toEqual([]);
    expect(getNpcCards(c, 4, 3)[0]).toMatchObject({ kind: 'npc', roleId: 'courtLady', round: 3 });
  });

  it('라운드 보드 묶음 제목은 "추가 증언"(빠진 역할이라는 말 금지)', () => {
    const b = getRoundBoard(c, 4, 2);
    expect(b.npcHeading).toBe('추가 증언');
    expect(b.publicCards.map((x) => x.id)).toEqual(['PB-2']);
    expect(b.npcCards.map((x) => x.id)).toEqual(['N5-2', 'N6-2']);
    expect(JSON.stringify(b)).not.toContain('빠진');
  });

  it('단서함 공용 목록은 지난 라운드까지만', () => {
    expect(publicBoardUpTo(c, 5, 0)).toEqual([]);
    expect(publicBoardUpTo(c, 5, 2).map((x) => x.id)).toEqual(['PB-1', 'N6-1', 'PB-2', 'N6-2']);
    expect(publicBoardUpTo(c, 6, 3).map((x) => x.id)).toEqual(['PB-1', 'PB-2', 'PB-3']);
  });
});

describe('deck — 용어', () => {
  it('기본 용어는 처음부터, 카드 연동 용어는 그 카드를 열었을 때만(중복 제거)', () => {
    expect(baseTerms(c).map((t) => t.id)).toEqual(['t-base']);
    const hall = getClue(c, room('7F3K5'), 1, 'hall', 1)!;
    const pb2 = getPublicCards(c, 5, 2)[0];
    expect(hall.terms.map((t) => t.id)).toEqual(['t-poison']);
    expect(visibleTerms(c, []).map((t) => t.id)).toEqual(['t-base']);
    expect(visibleTerms(c, [hall, pb2, hall]).map((t) => t.id)).toEqual(['t-base', 't-poison', 't-honey']);
  });
});

describe('deck — 브리핑 렌더', () => {
  it('6인: {{npcs}} 문단은 통째로 빠지고 호명은 priority 순', () => {
    const b = resolveBriefing(c, 6);
    expect(b.paragraphs).toEqual([
      '[픽스처] 그날 밤 일이 있었다.',
      '모인 이들: 역할1. 역할2. 역할3. 역할4. 역할5. 그리고 역할6.',
      '규칙 하나.',
    ]);
    expect(b.heading).toBe('그날 밤');
    expect(b.hostCue).toBe('모두 들으시오');
  });

  it('4인: NPC 이름이 들어가고 토큰이 남지 않는다', () => {
    const b = resolveBriefing(c, 4);
    expect(b.paragraphs[1]).toBe('모인 이들: 역할1. 역할2. 역할3. 그리고 역할4.');
    expect(b.paragraphs[2]).toBe('그리고 이 자리에 없으나 증언을 남긴 이: 역할5, 역할6.');
    expect(b.paragraphs.join('')).not.toContain('{{');
    expect(b.readMinutes).toBe(1);
  });

  it('보조 함수', () => {
    expect(joinCastNames([])).toBe('');
    expect(joinCastNames(['가'])).toBe('가.');
    expect(joinCastNames(['가', '나'])).toBe('가. 그리고 나.');
    expect(estimateReadMinutes(['가'.repeat(301)])).toBe(2);
  });
});
