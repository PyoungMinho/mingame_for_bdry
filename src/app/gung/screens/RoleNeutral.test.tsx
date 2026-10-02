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
import { assignFromCode, castFor, formatRoomCode, parseRoomCode, publicSeats, roleAtSeat, SEED_ALPHABET, type PlayerCount } from '@/lib/gung';
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

/** 코드마다 다른 것(방 코드·사건 표식)만 자리표시자로. roles=true 면 공개된 자리·역할명 표기도 */
function normalize(code: string, roles = false): string {
  const room = parseRoomCode(code)!;
  let html = document.body.innerHTML;
  html = html.replaceAll(formatRoomCode(code), '‹CODE›').replaceAll(room.display, '‹CODE›').replaceAll(code, '‹CODE›').replaceAll(room.tag, '‹TAG›');
  if (roles) {
    const names = publicSeats(c, assignFromCode(c, code)!)
      .flatMap((s) => [s.name, s.shortName])
      .sort((x, y) => y.length - x.length);
    for (const nm of names) html = html.replaceAll(nm, '‹ROLE›');
    // 역할 아이콘(lucide 클래스)도 자리 따라 다르다 — 공개 정보라 지운다
    html = html.replace(/lucide-[a-z-]+/g, 'lucide-‹ICON›');
  }
  return html;
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
  await tap(btn('용어 풀이·시각표'));
  const terms = dialog().textContent ?? '';
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
