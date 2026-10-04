// @vitest-environment jsdom
/**
 * QA 실행자 독립 검증 — 개선 묶음 1(docs/planning/gung-improve-spec.md) 전 흐름 스윕.
 *
 * 개발 쪽 테스트(RoleNeutral·Improve)와 다른 길로 같은 불변을 다시 확인한다.
 *  - 방장 스윕: 4·5·6인 × 자리 1 의 모든 역할. 대기실 → 브리핑 → 패 확인 → 자기소개 → 조사 1~3(고르기 타이머 시작 전·후, 토론)
 *    → 변론 → 지목 준비 → 지목 입력 → 집계(보너스 펼침) → 0개 확인 시트 → 진상 첫 비트까지 **같은 탭 순서**로 밟고,
 *    단계마다 공용 무대 DOM 을 찍어 역할끼리 비교한다(자기소개 뒤 역할 표기·아이콘은 D16 공개 정보라 자리표시자).
 *    모든 무대 스냅샷에서 .gu-sealed 0개(G2), 진상 전 무대에 범인 전용 문자열 0개.
 *  - 플레이어 스윕: 4·5·6인 × 자리 2 의 모든 역할. 게이트 버튼으로만(단계 맞추기 없이) 대기실 → … → 진상 대기(G5).
 *    단계마다 진행 화면 DOM·수첩 탭·「?」 시트를 찍어 역할끼리 비교 + 범인 전용 문자열 누출 검사.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode, castFor, formatRoomCode, GUIDE, parseRoomCode, publicSeats, roleAtSeat, roleById, SEED_ALPHABET, type PlayerCount } from '@/lib/gung';
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
async function tap(el: HTMLElement | null | undefined) {
  if (!el) throw new Error('tap: element not found');
  vi.setSystemTime(new Date(Date.now() + 1000));
  fireEvent.click(el);
  await flush();
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const qbtn = (name: RegExp | string) => screen.queryByRole('button', { name });
const dialog = () => screen.getByRole('dialog');
const qdialog = () => screen.queryByRole('dialog');
const tiles = (cls: string, root: HTMLElement | Document = document) => Array.from(root.querySelectorAll<HTMLElement>(`button.${cls}`));
const tabBtn = (label: string) => within(screen.getByRole('navigation', { name: '화면 전환' })).getByRole('button', { name: label });

function codeWith(n: PlayerCount, role: string, seat: number): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[(i * 3 + 1) % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 13) % 31]}${A[(i * 5 + 2) % 31]}${n}`;
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

/** 코드마다 다른 것(방 코드·사건 표식) + (roles) 자기소개 뒤 공개되는 자리·역할 표기·역할 아이콘을 자리표시자로 */
function normalize(html: string, code: string, roles: boolean): string {
  const room = parseRoomCode(code)!;
  let out = maskTimer(html).replaceAll(formatRoomCode(code), '‹CODE›').replaceAll(room.display, '‹CODE›').replaceAll(code, '‹CODE›').replaceAll(room.tag, '‹TAG›');
  if (roles) {
    const names = publicSeats(c, assignFromCode(c, code)!)
      .flatMap((s) => [s.name, s.shortName])
      .sort((x, y) => y.length - x.length);
    for (const nm of names) out = out.replaceAll(nm, '‹ROLE›');
    // 역할명 받침에 따라 붙는 조사(중전이 / 숙의가)는 공개된 역할명의 일부 — 함께 자리표시자로
    out = out.replace(/‹ROLE›(이|가)(?=[\s<])/g, '‹ROLE›‹이가›');
    out = out.replace(/lucide-[a-z0-9-]+/g, 'lucide-‹ICON›');
    out = out.replace(/(<svg[^>]*class="[^"]*gu-icon[^"]*"[^>]*>)[\s\S]*?(<\/svg>)/g, '$1‹ICON›$2');
  }
  return out;
}
const textOf = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  return d.textContent ?? '';
};

/** 진상 공개 전 공용·플레이어 진행 화면에 나오면 안 되는 범인 전용 문자열 */
function culpritOnlyStrings(): string[] {
  const ids = Array.isArray(c.culprit) ? c.culprit : [c.culprit];
  const out = [c.truth.confession, c.truth.culpritLine, '당신이 범인', '도장: 범인', '도장: 결백', '✓ 적중'];
  for (const id of ids) {
    const crime = (roleById(c, id) as { crime?: string } | undefined)?.crime;
    if (crime) out.push(crime);
  }
  expect(out.length).toBeGreaterThanOrEqual(7); // 탐침 유효성 — crime 문장까지 실제로 넣었다
  return out.filter(Boolean);
}

// ═══════════════════════════════ 방장 스윕 ═══════════════════════════════

async function hostSweep(code: string, n: PlayerCount): Promise<Record<string, string>> {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
  await tap(within(dialog()).getByRole('button', { name: '취소' }));
  const snaps: Record<string, string> = {};
  const shot = (k: string, roles = false) => {
    const html = document.body.innerHTML;
    // G2: 공용 무대(진행 탭)엔 봉인 카드가 하나도 없다
    expect(document.querySelectorAll('.gu-sealed').length, `${k} .gu-sealed`).toBe(0);
    snaps[k] = normalize(html, code, roles);
  };
  shot('lobby');
  await tap(btn(/사건 시작/)); // 6판: 확인 시트 없음
  shot('briefing');
  await tap(btn(/다 읽었소 → 패 확인/));
  shot('cards');
  await tap(btn(/다 봤소/));
  shot('intro');
  await tap(btn(/첫째 조사 시작/));
  // 6판: 현장 보기(조용한 1분 타이머가 이미 돈다) → 고르기(고르기 타이머가 저절로 돈다) — 시작 버튼은 단계 맞추기 때만
  expect(qbtn(GUIDE.selectTimerStart), 'r1 현장 — 타이머 시작 버튼 없음').toBeNull();
  shot('r1-scene', true);
  await tap(btn(/고르기 \d+분 시작/));
  expect(qbtn(GUIDE.selectTimerStart)).toBeNull();
  shot('r1-select', true);
  await tap(btn(/토론 \d+분 시작/));
  shot('r1-discuss', true);
  for (const [next, label] of [
    [/둘째 조사 시작/, 'r2'],
    [/셋째 조사 시작/, 'r3'],
  ] as const) {
    await tap(btn(next));
    shot(`${label}-scene`, true);
    await tap(btn(/고르기 \d+분 시작/));
    expect(qbtn(GUIDE.selectTimerStart), `${label} 고르기 타이머 시작 버튼 없음`).toBeNull();
    shot(`${label}-select`, true);
    await tap(btn(/토론 \d+분 시작/));
    shot(`${label}-discuss`, true);
  }
  await tap(btn(/최종 변론으로/));
  shot('defense', true);
  for (let i = 0; i < 10 && qbtn(/^다음 사람 → \d/); i++) await tap(btn(/^다음 사람 → \d/));
  shot('defense-last', true);
  await tap(btn(/지목하러/));
  shot('vote-ready', true);
  await tap(btn(/셋 세기 시작/));
  await tap(btn('건너뛰기'));
  shot('vote-input', true);
  // 자리 1 → 2, 자리 2 → 3, 나머지 → 2 (모든 판 같은 표)
  const targets = Array.from({ length: n }, (_, i) => (i === 1 ? 3 : 2));
  for (const t of targets) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
  // 6판: 보너스 0개 확인 시트 대신 인라인 경고 — 진상 공개는 1탭
  expect(screen.getByText(GUIDE.bonusZeroInline)).toBeInTheDocument();
  shot('vote-tally-bonus', true);
  await tap(btn(/진상 공개/));
  expect(qdialog()).toBeNull();
  expect(document.querySelector('.gu-reveal-dark')).not.toBeNull();
  shot('reveal-dark', true);
  return snaps;
}

describe('QA 독립 스윕 — 방장 역할만 바꾼 같은 판, 대기실 ~ 진상 첫 비트', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 공용 무대 DOM 이 방장 역할과 무관하게 단계마다 같고, .gu-sealed 0 · 범인 전용 문자열 0`, async () => {
      const banned = culpritOnlyStrings();
      const prompts = (c.bonusQuestions ?? []).map((q) => q.prompt);
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        const code = codeWith(n, role, 1);
        runs.push({ role, snaps: await hostSweep(code, n) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(Object.keys(base.snaps)).toHaveLength(19);
      for (const r of runs) {
        for (const [k, html] of Object.entries(r.snaps)) {
          const t = textOf(html);
          for (const s of banned) expect(t, `${n}인 방장=${r.role} ${k}: 「${s.slice(0, 20)}」`).not.toContain(s);
          // R7: 보너스 문항은 집계(판결 확정 뒤) 전엔 무대에 없다
          if (!['vote-tally-bonus', 'reveal-dark'].includes(k)) for (const p of prompts) expect(t, `${k} 보너스 문항`).not.toContain(p);
        }
      }
      for (const r of rest) {
        for (const k of Object.keys(base.snaps)) {
          if (process.env.QA_DEBUG && textOf(r.snaps[k]) !== textOf(base.snaps[k])) {
            const a = textOf(base.snaps[k]);
            const b = textOf(r.snaps[k]);
            let i = 0;
            while (i < a.length && a[i] === b[i]) i++;
            console.log('DIFF', n, k, base.role, r.role, '\nA:', a.slice(Math.max(0, i - 80), i + 200), '\nB:', b.slice(Math.max(0, i - 80), i + 200));
          }
          expect(textOf(r.snaps[k]), `${n}인 방장=${r.role} vs ${base.role} · ${k} 텍스트`).toBe(textOf(base.snaps[k]));
          expect(r.snaps[k], `${n}인 방장=${r.role} vs ${base.role} · ${k} DOM`).toBe(base.snaps[k]);
        }
      }
    }, 120_000);
  }
});

// ═══════════════════════════════ 플레이어 스윕 ═══════════════════════════════

async function dismissPeekTip() {
  const d = qdialog();
  if (d && d.getAttribute('aria-label') === '몰래 보는 법') await tap(within(d).getByRole('button', { name: '알겠소' }));
}

async function playerSweep(code: string): Promise<Record<string, string>> {
  search = `code=${code}`;
  render(<GungApp />);
  await flush();
  await tap(btn(/입장하기/));
  await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('2')));
  await tap(btn(/자리에 앉기/));
  const snaps: Record<string, string> = {};
  const shot = (k: string, roles = false) => {
    expect(qdialog(), `${k}: 열린 시트 없음`).toBeNull();
    snaps[k] = normalize(document.body.innerHTML, code, roles);
  };
  const helpSheet = async (k: string, roles: boolean) => {
    await tap(btn(GUIDE.helpLabel));
    const d = dialog().cloneNode(true) as HTMLElement;
    // 인물록은 자리 → 역할(D16 공개)이 판마다 다르다 — 카드는 정렬해 비교
    const items = Array.from(d.querySelectorAll('.gu-roster-item'))
      .map((e) => (e.textContent ?? '').replace(/^\d+번 · /, ''))
      .sort();
    d.querySelectorAll('.gu-roster-item').forEach((e) => (e.textContent = '‹PERSON›'));
    snaps[k] = `${normalize(d.innerHTML, code, roles)}|${items.join('|')}`;
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
  };
  const notesTab = async (k: string, roles: boolean) => {
    await tap(tabBtn('수첩'));
    shot(k, roles);
    await tap(tabBtn('지금'));
  };
  shot('lobby');
  await tap(btn(/사건 시작됐어요/));
  shot('briefing');
  await helpSheet('help-briefing', false);
  await tap(btn(/내 패 확인하기/));
  await dismissPeekTip();
  shot('cards');
  await tap(btn(/자기소개 시작됐어요/));
  shot('intro');
  await notesTab('notes-intro', true);
  await tap(btn(/1라운드 시작됐어요/)); // 6판: 조사 1·2 진입은 1탭(풀리는 잠금 기억 없음)
  await dismissPeekTip();
  shot('r1-select', true);
  for (const r of [1, 2, 3] as const) {
    if (r > 1) {
      await tap(btn(new RegExp(`${r}라운드 시작됐어요`)));
      // 잠금 기억이 풀리는 조사 3만 확인 시트(데이터 판정 — 모든 역할 같은 시트)
      if (r === 3) await tap(within(dialog()).getByRole('button', { name: '넘어가겠소' }));
      await dismissPeekTip();
      // R3 진입 알림은 모든 역할 같은 문구
      shot(`r${r}-select`, true);
    }
    // 모든 판 같은 장소(첫 타일)
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    shot(`r${r}-picked`, true);
  }
  await notesTab('notes-r3', true);
  await helpSheet('help-r3', true);
  await tap(btn(/최종 변론 시작됐어요/));
  shot('defense', true);
  await tap(btn(/지목 시작됐어요/));
  shot('vote-pre', true);
  await tap(tiles('gu-seatgrid-tile').find((b) => b.textContent?.trim().startsWith('3')));
  await tap(btn(/지목 확정/));
  // 보너스 문항은 「보너스 문항 보기」로 열어야 보인다(연 뒤엔 지목 변경 불가)
  await tap(btn(/보너스 문항 보기/)); // 6판: 확인 시트 대신 버튼 아래 한 줄(지목 잠김)
  shot('vote-post', true);
  await tap(btn(/진상 공개 시작됐어요/)); // 6판: 1탭 — 대기 화면은 범인을 안 보인다
  shot('reveal-wait', true);
  return snaps;
}

describe('QA 독립 스윕 — 플레이어(자리 2) 역할만 바꾼 같은 판, 게이트 버튼만으로 대기실 ~ 진상 대기', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 진행 화면·수첩·「?」 시트 DOM 이 역할과 무관하게 같고, 진상 대기까지 범인 전용 문자열 0`, async () => {
      const banned = culpritOnlyStrings();
      const prompts = (c.bonusQuestions ?? []).map((q) => q.prompt);
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        const code = codeWith(n, role, 2);
        runs.push({ role, snaps: await playerSweep(code) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      // 탐침 유효성: 실제로 그 화면을 찍었다
      expect(textOf(base.snaps['reveal-wait'])).toContain(GUIDE.truthWaitTitle);
      expect(textOf(base.snaps['vote-post'])).toContain(GUIDE.bonusPlayerHead);
      expect(textOf(base.snaps['defense'])).toContain(GUIDE.defenseFrame[0]);
      expect(textOf(base.snaps['r1-picked'])).toContain(GUIDE.clueMicro);
      expect(textOf(base.snaps['notes-r3'])).toContain(GUIDE.notesHead);
      for (const r of runs) {
        for (const [k, html] of Object.entries(r.snaps)) {
          const t = textOf(html);
          for (const s of banned) expect(t, `${n}인 자리2=${r.role} ${k}: 「${s.slice(0, 20)}」`).not.toContain(s);
          if (k !== 'vote-post') for (const p of prompts) expect(t, `${k} 보너스 문항`).not.toContain(p);
        }
        // G3: 자기소개 단계 DOM 에 그 역할 말투 예시 없음(봉인 상태에서도 DOM 금지 — 열린 상태는 개발 테스트가 검증)
        const role = roleById(c, roleAtSeat(assignFromCode(c, codeWith(n, r.role, 2))!, 2)!)!;
        for (const s of role.speech ?? []) expect(textOf(r.snaps.intro)).not.toContain(s);
      }
      for (const r of rest) {
        for (const k of Object.keys(base.snaps)) {
          expect(textOf(r.snaps[k]), `${n}인 자리2=${r.role} vs ${base.role} · ${k} 텍스트`).toBe(textOf(base.snaps[k]));
          expect(r.snaps[k], `${n}인 자리2=${r.role} vs ${base.role} · ${k} DOM`).toBe(base.snaps[k]);
        }
      }
    }, 120_000);
  }
});

// ═══════════════════════════════ QA 수정 회귀(개선 묶음 1 검증 중 고친 것) ═══════════════════════════════

async function syncTo(label: RegExp) {
  const rail = qbtn(/진행 단계/);
  if (rail) await tap(rail);
  else {
    await tap(btn('메뉴'));
    await tap(btn('진행 단계 맞추기'));
  }
  await tap(screen.getByRole('radio', { name: label }));
  await tap(btn(/^이동/));
  const confirm = qbtn(/가겠소/);
  if (confirm) await tap(confirm);
  await dismissPeekTip();
}

describe('QA 수정 회귀 — 큰 지도 · 진상 무대의 지난 조사 알림 · 봉인 카드 14px 바닥 · 토스트', () => {
  it('QA-01 큰 지도: 배치도 시트와 「?」 시트의 배치도는 1.4배(좌우로 밀기) — 6판: 개요 화면엔 인라인 지도 대신 「배치도 · 시각표 ›」 링크', async () => {
    search = `code=${codeWith(6, 'queen', 1)}&as=host`;
    render(<GungApp />);
    await flush();
    await tap(btn(/방장으로 입장하기/));
    await tap(within(dialog()).getByRole('button', { name: '취소' }));
    await tap(btn(/사건 시작/));
    // 6판: 방장 개요 화면엔 시각표·지도가 상시로 없다 — 링크 한 줄이 「?」 시트(큰 지도)를 연다
    expect(document.querySelector('figure.gu-map')).toBeNull();
    expect(document.querySelector('.gu-timetable')).toBeNull();
    await tap(btn(GUIDE.helpLink));
    const sheet = dialog();
    expect(sheet.getAttribute('aria-label')).toBe(GUIDE.helpSheetTitle);
    const big = sheet.querySelector('figure.gu-map')!;
    expect(big.classList.contains('gu-map--zoom')).toBe(true);
    expect(big.querySelectorAll('.gu-map-pan > svg.gu-map-svg')).toHaveLength(2); // 지도 2장 모두 밀어 보는 틀 안
    expect(sheet.textContent).toContain(GUIDE.mapPanHint);
    await tap(within(sheet).getByRole('button', { name: '닫기' }));
    cleanup();
    window.localStorage.clear();
    // 플레이어 개요의 「🗺 궁 배치도 보기」 = 배치도만 담은 시트(같은 큰 지도)
    search = `code=${codeWith(6, 'queen', 2)}`;
    render(<GungApp />);
    await flush();
    await tap(btn(/입장하기/));
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('2')));
    await tap(btn(/자리에 앉기/));
    await tap(btn(/사건 시작됐어요/));
    expect(document.querySelector('figure.gu-map')).toBeNull();
    await tap(btn(GUIDE.mapLink));
    expect(dialog().getAttribute('aria-label')).toBe(GUIDE.mapSection);
    expect(dialog().querySelector('figure.gu-map.gu-map--zoom')).not.toBeNull();
    expect(dialog().querySelectorAll('.gu-map-pan > svg.gu-map-svg')).toHaveLength(2);
  });

  it('QA-02 진상·결과 단계엔 「셋째 조사 — 각자 내 패를 다시 확인하시오」를 남기지 않는다(조사 3·변론에선 그대로)', async () => {
    const NOTICE = '셋째 조사 — 각자 내 패를 다시 확인하시오';
    // 플레이어: 조사 3 → 변론(유지) → 지목 → 진상 대기(없음)
    search = `code=${codeWith(6, 'eunuch', 2)}`;
    render(<GungApp />);
    await flush();
    await tap(btn(/입장하기/));
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('2')));
    await tap(btn(/자리에 앉기/));
    await syncTo(/^조사 3/);
    expect(document.body.textContent).toContain(NOTICE);
    await syncTo(/^최종 변론/);
    expect(document.body.textContent).toContain(NOTICE);
    await tap(btn(/지목 시작됐어요/));
    await tap(btn(/폰 지목 없이 진상으로/)); // 6판: 1탭
    expect(document.body.textContent).toContain(GUIDE.truthWaitTitle);
    expect(document.body.textContent).not.toContain(NOTICE);
    // 되돌아가면(단계 맞추기 → 지목) 다시 보인다 — 알림 자체는 지우지 않았다
    await syncTo(/^지목/);
    expect(document.body.textContent).toContain(NOTICE);
    cleanup();
    window.localStorage.clear();
    // 방장: 조사 3 → … → 진상 전체화면 무대에 없음
    search = `code=${codeWith(6, 'queen', 1)}&as=host`;
    render(<GungApp />);
    await flush();
    await tap(btn(/방장으로 입장하기/));
    await tap(within(dialog()).getByRole('button', { name: '취소' }));
    await syncTo(/^조사 3/);
    expect(document.body.textContent).toContain(NOTICE);
    await syncTo(/^진상/);
    expect(document.querySelector('.gu-reveal-dark')).not.toBeNull();
    expect(document.body.textContent).not.toContain(NOTICE);
  });

  it('QA-03 봉인 카드 안 새 문구(거짓말 규칙 상자·말투 머리)는 축소돼도 14px 아래로 안 내려간다 · 토스트 「되돌리기」는 한 줄', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const css = readFileSync(resolve(__dirname, '../gung.css'), 'utf8');
    const rule = (sel: string) => {
      const i = css.indexOf(`${sel} {`);
      expect(i, sel).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    expect(rule('.gu-sealed-paper .gu-lierules-list')).toContain('max(14px, calc(var(--gu-fs-small) * var(--gu-seal-scale, 1)))');
    expect(rule('.gu-hopae-speech-head')).toContain('max(14px, calc(var(--gu-fs-small) * var(--gu-seal-scale, 1)))');
    expect(rule('.gu-toast-action')).toMatch(/white-space:\s*nowrap/);
    expect(rule('.gu-map--zoom .gu-map-svg')).toContain('width: 448px'); // 320 × 1.4 — 가장 작은 지도 글자 10 → 14px
  });
});
