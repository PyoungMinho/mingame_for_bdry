// @vitest-environment jsdom
/**
 * 공용 화면 역할 독립성 회귀 테스트(QA RISK-04 · BUG-02 우회 · 봉인 화면 D3).
 *
 * 원칙: 공용 화면(방장 '진행' 무대)과 봉인 화면에는 **역할에 따라 달라지는 표시가 하나도 없어야** 한다.
 *  - 같은 인원·같은 진행(같은 탭 순서)으로, 방장(자리 1) 역할만 바꾼 판들의 방장 공용 화면 DOM 이 단계마다 같다.
 *    (방 코드·사건 표식은 코드마다 다르니 자리표시자로 바꾼다. 자기소개 뒤 공개되는 "자리 · 역할명" 표기는 D16 공개 정보라
 *    변론·지목 단계에서만 역할명을 자리표시자로 바꾼다.)
 *  - 조사 3 진입 알림·용어 시트·봉인된 내 패도 역할과 무관하게 같다.
 *  - 플레이어 폰(자리 2)도 역할만 바꿔 같은 비교를 한다.
 * 예전 버그: 방장이 조상궁·세자빈이면 조사 3 진입 때 공용 무대에 「새 기억이 떠올랐소」 배너가 떠 역할이 드러났다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode, castFor, formatRoomCode, GUIDE, parseRoomCode, placeCardsFor, publicSeats, roleAtSeat, sealTable, SEED_ALPHABET, type PlayerCount } from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const START = new Date('2026-10-02T21:00:00+09:00');

beforeEach(() => {
  search = '';
  window.localStorage.clear();
  window.history.replaceState(null, '', '/gung');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}
async function tap(el: HTMLElement) {
  vi.setSystemTime(new Date(Date.now() + 1000));
  fireEvent.click(el);
  await flush();
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const qbtn = (name: RegExp | string) => screen.queryByRole('button', { name });
const dialog = () => screen.getByRole('dialog');

/** 결정론 코드 탐색 — 그 역할이 그 자리에 앉는 판 */
function codeWith(n: PlayerCount, role: string, seat: number): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[i % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 7) % 31]}${A[(i * 11 + 5) % 31]}${n}`;
    const a = assignFromCode(c, code);
    if (a && roleAtSeat(a, seat) === role) return code;
  }
  throw new Error(`no code for ${n} ${role}@${seat}`);
}

/**
 * 향 타이머 표시(남은 시간·막대)는 1초 실시간 인터벌이 다시 그릴 때 바뀐다 — Date 만 가짜인 테스트에서 병렬 부하가 크면
 * 같은 탭 순서라도 06:45 / 07:00 처럼 찍히는 시점이 갈린다(역할과 무관한 타이밍 차이). QA: 비교에서 그 값만 가린다.
 */
function maskTimer(html: string): string {
  return html
    .replace(/(<p class="gu-timer-num[^"]*">)[^<]*(<\/p>)/g, '$1‹TIMER›$2')
    .replace(/(class="gu-timer-stick-fill" style=")[^"]*(")/g, '$1‹PCT›$2')
    .replace(/(class="gu-timer-ember" style=")[^"]*(")/g, '$1‹PCT›$2');
}

/** 코드마다 다른 것(방 코드·사건 표식)만 자리표시자로. roles=true 면 공개된 자리·역할명 표기도 */
function normalize(code: string, roles = false): string {
  const room = parseRoomCode(code)!;
  let html = maskTimer(document.body.innerHTML);
  html = html.replaceAll(formatRoomCode(code), '‹CODE›').replaceAll(room.display, '‹CODE›').replaceAll(code, '‹CODE›').replaceAll(room.tag, '‹TAG›');
  if (roles) {
    const names = publicSeats(c, assignFromCode(c, code)!)
      .flatMap((s) => [s.name, s.shortName])
      .sort((x, y) => y.length - x.length);
    for (const nm of names) html = html.replaceAll(nm, '‹ROLE›');
    // 역할 아이콘(lucide 클래스·도형)도 자리 따라 다르다 — 공개 정보라 지운다(R6 변론 칩 아이콘 포함)
    html = html.replace(/lucide-[a-z0-9-]+/g, 'lucide-‹ICON›');
    html = html.replace(/(<svg[^>]*class="[^"]*gu-icon[^"]*"[^>]*>)[\s\S]*?(<\/svg>)/g, '$1‹ICON›$2');
  }
  return html;
}
/**
 * 「?」 시트(R2) 비교용 — 인물록의 '자리 → 역할'은 자기소개 뒤 공개 정보(D16)라 코드마다 순서가 다르다.
 * 그래서 인물 카드는 자리표시자로 바꾸고, 카드 묶음(자리 번호를 뗀 내용)은 정렬해 따로 붙인다 — 구조·문구·인원 구성은 그대로 비교된다.
 */
function helpSheetSignature(dlg: HTMLElement): string {
  const items = Array.from(dlg.querySelectorAll('.gu-roster-item'))
    .map((e) => (e.textContent ?? '').replace(/^\d+번 · /, ''))
    .sort();
  const clone = dlg.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.gu-roster-item').forEach((e) => (e.textContent = '‹PERSON›'));
  return `${clone.innerHTML.replace(/(<svg[^>]*class="[^"]*gu-icon[^"]*"[^>]*>)[\s\S]*?(<\/svg>)/g, '$1$2')}|${items.join('|')}`;
}

const textOf = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent ?? '';
};

/** 방장(자리 1)으로 대기실부터 지목 준비까지 같은 탭 순서로 밟으며 단계마다 공용 무대 DOM 을 찍는다 */
async function hostRun(code: string): Promise<{ steps: Record<string, string>; sealed: string; terms: string }> {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
  await tap(within(dialog()).getByRole('button', { name: '취소' })); // 복구 직후 열린 O1 닫기
  const steps: Record<string, string> = {};
  const shot = (k: string, roles = false) => {
    expect(screen.queryByRole('dialog')).toBeNull();
    steps[k] = normalize(code, roles);
  };
  shot('lobby');
  await tap(btn(/사건 시작/));
  await tap(within(dialog()).getByRole('button', { name: /시작하겠소/ }));
  shot('briefing');
  await tap(btn(/다 읽었소/));
  shot('cards');
  await tap(btn(/다 봤소/));
  shot('intro');
  await tap(btn(/첫째 조사 시작/));
  shot('r1-select');
  await tap(btn(/토론 \d+분 시작/));
  shot('r1-discuss');
  await tap(btn(/둘째 조사 시작/));
  shot('r2-select');
  await tap(btn(/토론 \d+분 시작/));
  shot('r2-discuss');
  await tap(btn(/셋째 조사 시작/));
  shot('r3-select'); // ← 예전엔 방장이 조상궁·세자빈이면 여기 「새 기억이 떠올랐소」
  // 용어 시트(「?」) — 역할 전용 용어(활맥)가 끼면 목록으로 역할이 드러난다
  await tap(btn('궁 배치도·시각표·인물·용어'));
  const terms = helpSheetSignature(dialog());
  await tap(within(dialog()).getByRole('button', { name: '닫기' }));
  // 알림 → 지금 확인하기 → 봉인된 내 패(비밀 섹션) — 봉인 상태 DOM
  await tap(btn(/지금 확인하기/));
  const ok = qbtn('알겠소');
  if (ok) await tap(ok);
  const sealed = (document.querySelector('.gu-rolecard')?.outerHTML ?? '').replaceAll(code, '‹CODE›');
  await tap(btn('진행'));
  await tap(btn(/토론 \d+분 시작/));
  shot('r3-discuss');
  await tap(btn(/최종 변론으로/));
  shot('defense', true);
  for (let i = 0; i < 10 && qbtn(/^다음 사람/); i++) await tap(btn(/^다음 사람/));
  await tap(btn(/지목하러/));
  shot('vote', true);
  return { steps, sealed, terms };
}

describe('공용 화면 역할 독립성 — 방장 역할만 바꾼 같은 판', () => {
  for (const n of [6, 5, 4] as PlayerCount[]) {
    it(`${n}인: 방장(자리 1)이 어느 역할이든 대기실~지목 공용 무대 DOM·조사 3 알림·용어 시트·봉인된 내 패가 같다`, async () => {
      const roles = castFor(c, n);
      const runs: { role: string; steps: Record<string, string>; sealed: string; terms: string }[] = [];
      for (const role of roles) {
        const code = codeWith(n, role, 1);
        runs.push({ role, ...(await hostRun(code)) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(runs).toHaveLength(n);
      expect(base.sealed).toContain('gu-sealed-surface'); // 탐침 유효성 — 봉인 카드를 실제로 찍었다
      expect(textOf(base.steps['r1-select'])).toContain(c.rounds[0].publicCards![0].title);
      // 조사 3 진입 알림은 모든 역할에 같은 문구 — 역할별 '새 기억' 표시는 없다
      expect(textOf(base.steps['r3-select'])).toContain('셋째 조사 — 각자 내 패를 다시 확인하시오');
      for (const r of runs) {
        for (const html of Object.values(r.steps)) expect(textOf(html)).not.toMatch(/새 기억|떠오르는 기억|떠올랐소/);
        expect(r.terms).not.toContain('활맥');
        // 봉인 상태: 기억 본문·잠김 안내·쪽 수가 DOM 에 없다
        expect(r.sealed).not.toMatch(/떠오르|\d+\/\d+/);
      }
      for (const r of rest) {
        for (const k of Object.keys(base.steps)) {
          // DOM 텍스트가 같고(요구사항), 구조·클래스·속성까지 같다(아이콘·색·배지 차이도 없음)
          expect(textOf(r.steps[k]), `${n}인 방장=${r.role} vs ${base.role} · ${k} 텍스트`).toBe(textOf(base.steps[k]));
          expect(r.steps[k], `${n}인 방장=${r.role} vs ${base.role} · ${k} DOM`).toBe(base.steps[k]);
        }
        expect(r.terms, `${n}인 방장=${r.role} 용어 시트`).toBe(base.terms);
        expect(r.sealed, `${n}인 방장=${r.role} 봉인된 내 패`).toBe(base.sealed);
      }
    }, 60_000);
  }
});

/** 플레이어(자리 2): 조사 2 → 조사 3(게이트 확인) → 알림 → 봉인된 내 패 7섹션 */
async function playerRun(code: string): Promise<{ progress: string; sealed: string[] }> {
  search = `code=${code}`;
  render(<GungApp />);
  await flush();
  await tap(btn(/입장하기/));
  await tap(screen.getAllByRole('button').find((b) => b.className.includes('gu-seat-node') && b.textContent?.startsWith('2'))!);
  await tap(btn(/자리에 앉기/));
  await tap(screen.getByRole('button', { name: /진행 단계/ }));
  await tap(screen.getByRole('radio', { name: /^조사 2/ }));
  await tap(btn(/^이동/));
  await tap(within(dialog()).getByRole('button', { name: /가겠소/ }));
  const tip = qbtn('알겠소');
  if (tip) await tap(tip);
  await tap(screen.getAllByRole('button').find((b) => b.className.includes('gu-place-tile'))!); // 모두 같은 장소
  await tap(btn(/조사하기/));
  await tap(btn(/3라운드 시작됐어요/));
  await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
  const progress = normalize(code);
  await tap(btn(/지금 확인하기/));
  const tip2 = qbtn('알겠소');
  if (tip2) await tap(tip2);
  const sealed: string[] = [];
  for (const tab of screen.getAllByRole('tab')) {
    await tap(tab);
    // 쪽 나눔 폐지 — 탭마다 한 번씩만 찍어도 된다(더는 '다음 쪽'으로 더 볼 쪽이 없다)
    sealed.push(document.querySelector('.gu-rolecard')?.outerHTML ?? '');
  }
  return { progress, sealed };
}

describe('조사 3 진입 알림·봉인 화면 — 플레이어 폰(자리 2), 역할만 바꾼 같은 판', () => {
  it('6인: 자리 2가 어느 역할이든 조사 3 진입 직후 화면 DOM 과 봉인된 내 패(7섹션 × 쪽 넘김)가 같다', async () => {
    const runs: { role: string; progress: string; sealed: string[] }[] = [];
    for (const role of castFor(c, 6)) {
      const code = codeWith(6, role, 2);
      runs.push({ role, ...(await playerRun(code)) });
      cleanup();
      window.localStorage.clear();
      vi.setSystemTime(START);
    }
    const [base, ...rest] = runs;
    expect(runs).toHaveLength(6);
    expect(base.sealed.length).toBeGreaterThanOrEqual(7);
    expect(base.sealed.every((h) => h.includes('gu-sealed-surface'))).toBe(true);
    expect(textOf(base.progress)).toContain('셋째 조사 — 각자 내 패를 다시 확인하시오');
    for (const r of rest) {
      expect(textOf(r.progress), `자리 2=${r.role}`).toBe(textOf(base.progress));
      expect(r.progress, `자리 2=${r.role} DOM`).toBe(base.progress);
      expect(r.sealed, `자리 2=${r.role} 봉인`).toEqual(base.sealed);
    }
  }, 60_000);
});

/**
 * 개선 묶음 1 — 새 화면까지 넓힌 역할 독립성(스펙 '공통 규칙' · R2·R4·R5 수용 기준).
 *  - 자기소개 전 「?」 시트(배치도·시각표·인물 잠김·용어) — 원문 그대로 같다.
 *  - 수첩 탭 머리·표 구조 — 자기소개 전엔 그대로, 뒤엔 역할 표기(D16)만 자리표시자로.
 *  - 공개 단서 보드 — 같은 카드 순서로 인장(코드마다 번호는 다르다)을 넣으면 무대 DOM 이 같다.
 * (G5 진상 대기 화면의 역할 독립성은 Improve.test.tsx — 플레이어 자리 2 역할만 바꾼 판끼리 비교)
 */
describe('개선 묶음 1 — 새 화면 역할 독립성(방장 역할만 바꾼 같은 판)', () => {
  for (const n of [6, 4] as PlayerCount[]) {
    it(`${n}인: 자기소개 전 「?」 시트 · 수첩 탭 · 같은 인장 입력 순서의 공개 단서 보드 무대가 방장 역할과 무관하게 같다`, async () => {
      const cards = placeCardsFor(c, n);
      const picks = [cards.filter((x) => x.round === 1)[0], cards.filter((x) => x.round === 1)[3], cards.filter((x) => x.round === 2)[1]];
      const runs: { role: string; help: string; notesPre: string; notesPost: string; board: string }[] = [];
      for (const role of castFor(c, n)) {
        const code = codeWith(n, role, 1);
        search = `code=${code}&as=host`;
        render(<GungApp />);
        await flush();
        await tap(btn(/방장으로 입장하기/));
        await tap(within(dialog()).getByRole('button', { name: '취소' }));
        await tap(btn(GUIDE.helpLabel));
        const help = dialog().innerHTML;
        await tap(within(dialog()).getByRole('button', { name: '닫기' }));
        await tap(btn('수첩'));
        const notesPre = normalize(code);
        await tap(btn('진행'));
        await tap(screen.getByRole('button', { name: /진행 단계/ }));
        await tap(screen.getByRole('radio', { name: /^조사 2/ }));
        await tap(btn(/^이동/));
        await tap(within(dialog()).getByRole('button', { name: /가겠소/ }));
        await tap(btn(/토론 \d+분 시작/));
        const seals = sealTable(c, n, code);
        for (const card of picks) {
          await tap(btn(GUIDE.boardAdd));
          for (const d of String(seals.get(card.id))) await tap(within(dialog()).getByRole('button', { name: d }));
          await tap(within(dialog()).getByRole('button', { name: '2' }));
          await tap(within(dialog()).getByRole('button', { name: GUIDE.sealPost }));
        }
        expect(screen.queryByRole('dialog')).toBeNull();
        const board = normalize(code, true);
        await tap(btn('수첩'));
        const notesPost = normalize(code, true);
        runs.push({ role, help, notesPre, notesPost, board });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(base.help).toContain(GUIDE.peopleLocked);
      expect(textOf(base.board)).toContain(`공개 단서 보드 (${picks.length}장)`);
      for (const card of picks) expect(textOf(base.board)).toContain(card.title);
      expect(textOf(base.notesPost)).toContain(GUIDE.notesHead);
      for (const r of rest) {
        expect(r.help, `${n}인 방장=${r.role} 「?」 시트(자기소개 전)`).toBe(base.help);
        expect(r.notesPre, `${n}인 방장=${r.role} 수첩(자기소개 전)`).toBe(base.notesPre);
        expect(r.notesPost, `${n}인 방장=${r.role} 수첩(자기소개 뒤)`).toBe(base.notesPost);
        expect(r.board, `${n}인 방장=${r.role} 보드 무대`).toBe(base.board);
      }
    }, 90_000);
  }
});
