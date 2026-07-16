/**
 * 동네고수 share.ts — 공유 텍스트 색블록/스포일러 가드 (QA 플랜 §6 치명 가드 C-01~04)
 *
 * ⚠ C-01b 함정: share.ts *소스*를 grep하면 doc-comment의 "🟩🟨🟥 사용 금지" 문구가 매치되어
 * 거짓 실패한다. 반드시 buildShareText()의 **런타임 반환 문자열**만 스캔한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildShareText, SHARE_URL } from './share';
import type { Guess } from './types';

/** Wordle 계열 색타일 이모지 전량 (트레이드드레스 금지 대상) */
const COLOR_BLOCK_RE = /[\u{1F7E5}-\u{1F7EB}\u{2B1B}\u{2B1C}]/u; // 🟥🟧🟨🟩🟦🟪🟫 ⬛⬜

const WON_GUESSES: Guess[] = [
  { code: '11010', distanceKm: 182, direction: 'NE', proximity: 41, correct: false },
  { code: '21010', distanceKm: 67, direction: 'SE', proximity: 78, correct: false },
  { code: '32010', distanceKm: 0, direction: null, proximity: 100, correct: true },
];

const LOST_GUESSES: Guess[] = [
  { code: '11010', distanceKm: 182, direction: 'NE', proximity: 41, correct: false },
  { code: '21010', distanceKm: 67, direction: 'SE', proximity: 78, correct: false },
  { code: '22010', distanceKm: 210, direction: 'NW', proximity: 33, correct: false },
  { code: '23010', distanceKm: 88, direction: 'W', proximity: 71, correct: false },
  { code: '24010', distanceKm: 45, direction: 'SW', proximity: 85, correct: false },
  { code: '25010', distanceKm: 31, direction: 'N', proximity: 90, correct: false },
];

describe('§6 공유 텍스트 색블록 가드', () => {
  it('C-01 성공 공유 텍스트 출력에 색블록 이모지 0개', () => {
    const out = buildShareText({ gameNo: 123, status: 'won', guesses: WON_GUESSES, streak: 5 });
    expect(COLOR_BLOCK_RE.test(out)).toBe(false);
  });

  it('C-01 실패 공유 텍스트 출력에 색블록 이모지 0개', () => {
    const out = buildShareText({ gameNo: 123, status: 'lost', guesses: LOST_GUESSES, streak: 5 });
    expect(COLOR_BLOCK_RE.test(out)).toBe(false);
  });

  it('C-01b [함정 검증] share.ts *소스*에는 색블록이 존재하지만(doc-comment), *출력*에는 없다', () => {
    const source = readFileSync(path.resolve(__dirname, 'share.ts'), 'utf8');
    // 소스 grep 은 false-positive (문서 주석) — 이 자체는 참임을 명시적으로 고정
    expect(COLOR_BLOCK_RE.test(source)).toBe(true);
    // 런타임 출력은 무조건 clean
    const out = buildShareText({ gameNo: 1, status: 'won', guesses: WON_GUESSES, streak: 1 });
    expect(COLOR_BLOCK_RE.test(out)).toBe(false);
  });

  it('C-02 방위는 텍스트 화살표(↑↗→↘↓↙←↖)만, 색타일 없음', () => {
    const out = buildShareText({ gameNo: 5, status: 'lost', guesses: LOST_GUESSES, streak: 2 });
    // 각 오답 행에 화살표 1개
    expect(out).toMatch(/↗/);
    expect(out).toMatch(/↘/);
    expect(out).toMatch(/↖/);
    // 허용되지 않은 색이모지 부재
    expect(COLOR_BLOCK_RE.test(out)).toBe(false);
  });

  it('C-03 정답 지역명 미포함(스포일러 프리) & 정답행="정답!"', () => {
    const out = buildShareText({ gameNo: 123, status: 'won', guesses: WON_GUESSES, streak: 5 });
    // 정답 코드/지명 문자열이 출력에 없어야 함
    expect(out).not.toContain('32010');
    expect(out).toContain('정답!');
    // 정답행에는 거리/근접도 수치가 붙지 않음
    expect(out).toMatch(/3️⃣ 정답!/);
    // 헤드라인 = "{N}/6 🎯"
    expect(out).toContain('3/6 🎯');
    expect(out).toContain(`▶ ${SHARE_URL}`);
  });

  it('C-03 실패 헤드라인 = "6/6 😢", 지명 없음', () => {
    const out = buildShareText({ gameNo: 123, status: 'lost', guesses: LOST_GUESSES, streak: 5 });
    expect(out).toContain('6/6 😢');
    expect(out).not.toMatch(/정답!/); // 실패엔 정답행 없음
  });

  it('C-04 share.ts 는 색 토큰/CSS/컴포넌트를 import 하지 않는다 (물리적 분리)', () => {
    const source = readFileSync(path.resolve(__dirname, 'share.ts'), 'utf8');
    const importLines = source.split('\n').filter((l) => /^\s*import\s/.test(l));
    for (const line of importLines) {
      expect(line).not.toMatch(/\.css/);
      expect(line).not.toMatch(/--dn-|dn-prox/);
      expect(line).not.toMatch(/components?\//);
      expect(line).not.toMatch(/dongne\.css/);
    }
    // 실제 import 는 ./queue(DIRECTION_ARROW) 와 ./types 만
    expect(importLines.length).toBeGreaterThan(0);
    expect(importLines.every((l) => /'\.\/queue'|'\.\/types'/.test(l))).toBe(true);
  });

  it('공유 포맷 바이트 정합 — design-final §6 성공 예시', () => {
    const out = buildShareText({
      gameNo: 123,
      status: 'won',
      guesses: [
        { code: 'a', distanceKm: 182, direction: 'NE', proximity: 41, correct: false },
        { code: 'b', distanceKm: 67, direction: 'SE', proximity: 78, correct: false },
        { code: 'c', distanceKm: 0, direction: null, proximity: 100, correct: true },
      ],
      streak: 5,
    });
    expect(out).toBe(
      ['동네고수 #123', '3/6 🎯', '1️⃣ 182km ↗ 41%', '2️⃣ 67km ↘ 78%', '3️⃣ 정답!', '🔥 스트릭 5일', `▶ ${SHARE_URL}`].join(
        '\n',
      ),
    );
  });
});
