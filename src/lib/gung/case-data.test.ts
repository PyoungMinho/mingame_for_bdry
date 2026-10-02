/**
 * 사건 데이터 무결성 — `case-data.ts`(sejaCase)가 `docs/planning/gung-case.md` 원고와
 * 카드 수·id·본문이 한 치도 다르지 않은지, 그리고 엔진 규칙(범인 항상 플레이어, 인원별 카드 1장)이
 * 실제 데이터로도 성립하는지. (rewind `src/lib/rewind/data.test.ts` 선례 — docs 파일을 읽어 대조)
 *
 * 원고가 바뀌면: `scratchpad/gung/to-ts.py`(세션 scratchpad, 레포 밖)를 다시 돌려
 * `case-data.ts`를 재생성한 뒤 이 테스트를 돌린다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { castFor, culpritCandidates, isPlayerRole, sortedRoles } from './assign';
import { sejaCase } from './case-data';
import { cardsAtPlace } from './deck';
import { PLAYER_COUNTS, type RoundNo } from './types';
import { caseErrors, validateCase } from './validate';

const DOC_PATH = path.resolve(__dirname, '../../../docs/planning/gung-case.md');
const doc = fs.readFileSync(DOC_PATH, 'utf8');

function cleanDocText(s: string): string {
  return s
    .replace(/<br>/g, ' ')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 원고 §4-3·§5-2 표의 데이터 행에서 id/장소·대상/R/제목/본문을 뽑는다(헤더·구분선 제외). */
function parseDocTable(startMarker: string, endMarker: string): string[][] {
  const start = doc.indexOf(startMarker);
  expect(start, `원고에서 "${startMarker}" 를 못 찾음 — 섹션 번호가 바뀌었나?`).toBeGreaterThanOrEqual(0);
  const end = doc.indexOf(endMarker, start);
  expect(end, `원고에서 "${endMarker}" 를 못 찾음`).toBeGreaterThan(start);
  const body = doc.slice(start, end);
  return body
    .split('\n')
    .filter((l) => l.startsWith('| '))
    .slice(1) // 헤더 행만 제거(구분선 "|---|" 행은 "| " 로 시작하지 않아 이미 제외됨)
    .map((row) =>
      row
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim()),
    );
}

const docCardRows = parseDocTable('### 4-3. 전체 카드 표', '\n\n## 5. NPC');
const docNpcRows = parseDocTable('### 5-2. NPC 카드 표', '\n\n## 6. 추리');

function allSejaCards() {
  const out: { id: string; title: string; body: string }[] = [];
  for (const r of sejaCase.rounds) {
    for (const cards of Object.values(r.clues)) out.push(...cards);
    out.push(...(r.publicCards ?? []));
    out.push(...(r.npcCards ?? []));
  }
  return out;
}

describe('원고 ↔ sejaCase 대조', () => {
  it('원고 머리말이 말하는 카드 31장과 역할 6·장소 7이 실제로 맞다', () => {
    expect(doc).toContain('카드 31장');
    const cards = allSejaCards();
    expect(cards.length).toBe(31);
    expect(new Set(cards.map((c) => c.id)).size).toBe(31); // id 중복 없음
    expect(sejaCase.roles.length).toBe(6);
    expect(sejaCase.places.length).toBe(7);
  });

  it('§4-3 전체 카드 표의 모든 id가 sejaCase에 그대로(본문 포함) 있다', () => {
    expect(docCardRows.length).toBeGreaterThan(0);
    const byId = new Map(allSejaCards().map((c) => [c.id, c]));
    for (const row of docCardRows) {
      const [id, , , title, body] = row;
      const card = byId.get(id);
      expect(card, `sejaCase에 카드 "${id}" 없음`).toBeDefined();
      if (!card) continue;
      const docTitle = cleanDocText(title.replace(/\(`onlyWhen:[^`]+`[^)]*\)/, ''));
      const docBody = cleanDocText(body);
      expect(card.title, id).toBe(docTitle);
      expect(card.body, id).toBe(docBody);
    }
  });

  it('§5-2 NPC 카드 표의 모든 id가 sejaCase npcCards에 그대로 있다', () => {
    expect(docNpcRows.length).toBeGreaterThan(0);
    const byId = new Map(allSejaCards().map((c) => [c.id, c]));
    for (const row of docNpcRows) {
      const [id, , , title, body] = row;
      const card = byId.get(id);
      expect(card, `sejaCase에 NPC 카드 "${id}" 없음`).toBeDefined();
      if (!card) continue;
      expect(card.title, id).toBe(cleanDocText(title));
      expect(card.body, id).toBe(cleanDocText(body));
    }
  });

  it('§1-3 표대로 범인은 2번 숙의 연씨, priority 1..6이 역할 6장과 1:1', () => {
    expect(doc).toContain('중전 서씨 (계비)'.replace(' (계비)', '')); // 느슨한 smoke — 이름이 원고에 실존
    expect(sejaCase.culprit).toBe('consort');
    const sorted = sortedRoles(sejaCase);
    expect(sorted.map((r) => r.priority)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(sorted.find((r) => r.id === 'consort')?.name).toContain('숙의');
  });

  it('§8-3 비밀 유지 판정 한 줄이 역할마다 들어있다(secretLine)', () => {
    for (const r of sejaCase.roles) {
      expect(r.secretLine, r.id).toBeTruthy();
    }
  });
});

describe('엔진 규칙이 실제 데이터로도 성립한다', () => {
  it('validateCase(sejaCase) 에 error 가 0 — 실제 사건 데이터는 깨지면 안 된다', () => {
    const errors = caseErrors(sejaCase);
    expect(errors, JSON.stringify(errors, null, 2)).toEqual([]);
  });

  it('범인은 모든 인원 구성(4/5/6)에서 항상 플레이어다', () => {
    for (const n of PLAYER_COUNTS) {
      const candidates = culpritCandidates(sejaCase);
      for (const id of candidates) {
        expect(isPlayerRole(sejaCase, n, id), `${n}인 판에서 ${id}`).toBe(true);
      }
      // cast 는 정확히 priority 1..n
      expect(castFor(sejaCase, n).length).toBe(n);
    }
  });

  it('인원별로 매 라운드·매 장소에 "보이는 카드"가 정확히 1장이다(0장·중복 아님)', () => {
    for (const n of PLAYER_COUNTS) {
      for (const round of [1, 2, 3] as RoundNo[]) {
        for (const place of sejaCase.places) {
          const cards = cardsAtPlace(sejaCase, n, round, place.id);
          expect(cards.length, `${n}인 R${round} ${place.id}`).toBe(1);
        }
      }
    }
  });

  it('후원 연못 R1 교체 카드(HW-1 ↔ HW-1b)는 세자빈이 플레이어인지에 따라 정확히 갈린다', () => {
    for (const n of PLAYER_COUNTS) {
      const cards = cardsAtPlace(sejaCase, n, 1, 'hw');
      expect(cards.length).toBe(1);
      const isPlayer = isPlayerRole(sejaCase, n, 'crownPrincess');
      expect(cards[0].id, `${n}인`).toBe(isPlayer ? 'HW-1' : 'HW-1b');
    }
  });

  it('validateCase 경고(스타일 상한)는 있을 수 있지만 전부 길이류 — 구조 오류는 아니다', () => {
    const warns = validateCase(sejaCase).filter((i) => i.level === 'warn');
    for (const w of warns) {
      expect(w.msg, w.where).toMatch(/자 >/);
    }
  });
});
