// @vitest-environment jsdom
/**
 * 라운드 잠금(원고 3판) · 「R2부터」 배지 · 방장 '내문 출입 타임라인' — 화면 회귀 테스트.
 *
 *  - 조상궁·세자빈의 「R3에 떠오르는 기억」 본문은 그 폰이 조사 3에 들어서기 전엔 DOM 에 한 글자도 없어야 한다
 *    (봉인을 열어도, 쪽을 넘겨도). 조사 3에 들어서면 **모든 역할·모든 기기에 같은** 「셋째 조사 — 각자 내 패를 다시 확인하시오」
 *    배너(QA RISK-04) → 지금 확인하기 → 봉인을 열면 보인다. 기억이 열렸다는 사실은 봉인 속에서만 알 수 있다.
 *  - 4인(둘 다 NPC)·5인(조상궁)·6인(조상궁·세자빈), 플레이어 폰과 방장 폰(자리 1) 모두.
 *  - 타임라인은 PB-2 가 열리는 조사 2 시작부터, PB-3 기록은 조사 3 시작부터 그린다(공용 카드 = 라운드 시작 때 공개, QA BUG-04 결정).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode, roleAtSeat, SEED_ALPHABET, seatOfRole, type PlayerCount } from '@/lib/gung';
import { sejaCase } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

beforeEach(() => {
  search = '';
  window.localStorage.clear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T21:00:00+09:00'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
const tiles = (cls: string) => screen.getAllByRole('button').filter((b) => b.className.includes(cls));

const MEMORY = Object.fromEntries(sejaCase.roles.filter((r) => r.memories?.length).map((r) => [r.id, r.memories!.flatMap((m) => m.lines)])) as Record<string, string[]>;
const ALL_MEMORY_PROBES = Object.values(MEMORY)
  .flat()
  .map((l) => l.slice(0, 14));
const LOCK_HINT = /셋째 조사가 시작되면 떠오르오/;
/** 모든 역할·모든 기기에 같은 알림(역할별 '새 기억' 배너는 없다) */
const NOTICE = /셋째 조사 — 각자 내 패를 다시 확인하시오/;

/** 타임라인 읽기 줄 — 원고 문구가 바뀌어도 따라가게 case-data 의 gateLog 에서 만든다(adapters.gateToView 와 같은 꼴) */
function gateLine(cardId: string, pick: (e: { roleId: string; dir: string }) => boolean): string {
  const card = sejaCase.rounds.flatMap((r) => r.publicCards ?? []).find((c) => c.id === cardId)!;
  const e = card.gateLog!.find(pick)!;
  return `${e.time} · ${e.who} ${e.dir === 'in' ? '入' : '出'}${e.note ? `(${e.note})` : ''}`;
}

/** 지금 DOM 에 기억 본문 조각이 하나라도 있나 */
function leakedNow(): string[] {
  const text = document.body.textContent ?? '';
  return ALL_MEMORY_PROBES.filter((p) => text.includes(p));
}

/** 결정론 코드 탐색 — 그 역할이 원하는 자리(방장=1 / 플레이어=2..n)에 앉는 판 */
function findCode(n: PlayerCount, role: string, where: 'host' | 'player'): { code: string; seat: number } {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 4000; i++) {
    const code = `${A[i % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 7) % 31]}${A[(i * 11 + 5) % 31]}${n}`;
    const a = assignFromCode(sejaCase, code);
    const seat = a && seatOfRole(a, role);
    if (!seat) continue;
    if (where === 'host' ? seat === 1 : seat >= 2) return { code, seat };
  }
  throw new Error(`no code for ${n} ${role} ${where}`);
}

async function dismissPeekTip() {
  const ok = screen.queryByRole('button', { name: '알겠소' });
  if (ok) await tap(ok);
}

async function joinAsPlayer(code: string, seat: number) {
  search = `code=${code}`;
  render(<GungApp />);
  await flush();
  await tap(btn(/입장하기/));
  await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith(String(seat)))!);
  await tap(btn(/자리에 앉기/));
}

/** O1 진행 단계 맞추기 — 두 단계 이상이면 확인 시트까지 */
async function syncTo(label: RegExp, openSheet = true) {
  if (openSheet) await tap(screen.getByRole('button', { name: /진행 단계/ }));
  await tap(screen.getByRole('radio', { name: label }));
  await tap(btn(/^이동/));
  const confirm = screen.queryByRole('button', { name: /가겠소/ });
  if (confirm) await tap(confirm);
}

/** 내 패 › 비밀 섹션을 열고(키보드 = 즉시 열림) 전문을 돌려준다(쪽 나눔 폐지 — 한 번 열면 전부 보인다). 마지막에 다시 봉인 */
async function readSecretPages(alreadyOnCards = false): Promise<string[]> {
  if (!alreadyOnCards) {
    await tap(btn(/내 패/));
    await dismissPeekTip();
    await tap(screen.getByRole('tab', { name: '비밀' }));
  }
  const surface = screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
  fireEvent.keyDown(surface, { key: 'Enter' });
  await flush();
  // D3(QA BUG-01)는 그대로 — 쪽 칩 자체가 없으니 범인만 흘릴 길이 표시도 없다
  expect(document.querySelector('.gu-sealed-pager')).toBeNull();
  const pages = [surface.textContent ?? ''];
  fireEvent.keyUp(surface, { key: 'Enter' });
  await flush();
  return pages;
}

describe('라운드 잠금 — 플레이어 폰', () => {
  for (const [n, role] of [
    [5, 'courtLady'],
    [6, 'courtLady'],
    [6, 'crownPrincess'],
  ] as const) {
    it(`${n}인 ${role}: 조사 2까지 기억 본문 비노출(봉인을 열고 쪽을 다 넘겨도) → 조사 3 진입 알림 → 노출`, async () => {
      const { code, seat } = findCode(n, role, 'player');
      await joinAsPlayer(code, seat);
      await syncTo(/^조사 2/);
      expect(screen.getByRole('heading', { name: /조사 2/ })).toBeInTheDocument();

      // R2 — 봉인을 열어 비밀의 모든 쪽을 읽어도 본문은 없고, 잠김 안내만
      const before = await readSecretPages();
      expect(before.join('\n')).toMatch(LOCK_HINT);
      for (const l of MEMORY[role]) expect(before.join('\n')).not.toContain(l.slice(0, 14));
      expect(leakedNow()).toEqual([]);
      expect(screen.queryByText(NOTICE)).toBeNull();

      // 조사 3 진입(한 단계) — 알림 배너
      await tap(btn('지금'));
      await syncTo(/^조사 3/);
      expect(screen.getByText(NOTICE)).toBeInTheDocument();
      expect(leakedNow()).toEqual([]); // 배너 자체엔 본문이 없다
      await tap(btn(/지금 확인하기/));
      // 내 패 › 비밀의 기억 쪽부터 열린다
      expect(screen.getByRole('tab', { name: '비밀' })).toHaveAttribute('aria-selected', 'true');
      const surface = screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
      fireEvent.keyDown(surface, { key: 'Enter' });
      await flush();
      expect(surface.textContent).toContain(MEMORY[role][0]);
      expect(surface.textContent).not.toMatch(LOCK_HINT);
      fireEvent.keyUp(surface, { key: 'Enter' });
      await flush();
      // 봉인되면 다시 DOM 에서 사라진다
      expect(leakedNow()).toEqual([]);
    });
  }

  it('조사 3에서 되돌아가면(단계 맞추기 → 조사 2) 다시 잠긴다', async () => {
    const { code, seat } = findCode(6, 'crownPrincess', 'player');
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 3/);
    expect(screen.getByText(NOTICE)).toBeInTheDocument(); // 건너뛰기 진입도 알림
    await syncTo(/^조사 2/);
    expect(screen.queryByText(NOTICE)).toBeNull();
    const pages = await readSecretPages();
    expect(pages.join('\n')).toMatch(LOCK_HINT);
    expect(leakedNow()).toEqual([]);
  });

  it('4인(조상궁·세자빈 모두 NPC): 어느 자리에도 잠금 블록이 없다 — 알림은 인원·역할과 무관하게 같은 문구로 뜬다', async () => {
    const code = findCode(4, 'physician', 'player').code;
    const a = assignFromCode(sejaCase, code)!;
    const seat = [2, 3, 4].find((s) => roleAtSeat(a, s) !== 'consort')!;
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 3/);
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    const pages = await readSecretPages();
    expect(pages.join('\n')).not.toMatch(/떠오르는 기억|떠오르오/);
    expect(leakedNow()).toEqual([]);
  });

  it('「물으면 사실대로」의 R2부터·R3부터는 글자 그대로 배지로 — 조사 2면 R2 배지만 지금 적용', async () => {
    const { code, seat } = findCode(5, 'courtLady', 'player');
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 2/);
    await tap(btn(/내 패/));
    await dismissPeekTip();
    await tap(screen.getByRole('tab', { name: '거짓말' }));
    const surface = screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
    fireEvent.keyDown(surface, { key: 'Enter' });
    await flush();
    const badges = Array.from(surface.querySelectorAll('.gu-rtag')).map((b) => `${b.textContent}:${b.getAttribute('data-state')}`);
    const cl = sejaCase.roles.find((r) => r.id === 'courtLady')!;
    // 기대값은 데이터에서: 거짓말 칸 글(둘러대도·물으면·추천 변명)에 적힌 「R?부터」를 순서대로 — 조사 2 기준 R2 이하만 open
    const tags = [...cl.canLie, ...cl.mustTell, ...(cl.lieTips ?? [])].join(' ').match(/R[1-3]부터/g) ?? [];
    expect(tags).toContain('R2부터');
    expect(tags).toContain('R3부터');
    expect(badges).toEqual(tags.map((t) => `${t}:${Number(t[1]) <= 2 ? 'open' : 'locked'}`));
    // 글자는 그대로 — 원문 문장이 그대로 이어 읽힌다
    expect(surface.textContent).toContain(cl.mustTell[0]);
  });
});

describe('라운드 잠금·출입 타임라인 — 방장 폰', () => {
  it('6인 방장(자리 1)=세자빈: 조사 2엔 비노출, 셋째 조사 시작 → (모두와 같은) 알림 → 봉인 속 노출 / 라운드가 시작될 때마다 타임라인이 자란다', async () => {
    const { code } = findCode(6, 'crownPrincess', 'host');
    search = `code=${code}&as=host`;
    render(<GungApp />);
    await flush();
    await tap(btn(/방장으로 입장하기/));
    // 방장 복구 → O1 이 바로 열린다
    await syncTo(/^조사 2/, false);
    // 조사 2 장소 고르기 — 공용 카드(PB-2)는 라운드 시작 때 공개(QA BUG-04 결정) → 타임라인도 바로
    const tl = () => screen.getByRole('list', { name: /내문 출입 기록/ });
    expect(within(tl()).getByText(gateLine('PB-2', (e) => e.roleId === 'consort' && e.dir === 'in'))).toBeInTheDocument();
    expect(within(tl()).queryByText(/^자시|^축시/)).toBeNull();

    // 내 패 — 아직 잠김
    const before = await readSecretPages();
    expect(before.join('\n')).toMatch(LOCK_HINT);
    expect(leakedNow()).toEqual([]);
    await tap(btn('진행'));

    // 토론 — 타임라인 그대로(PB-2만)
    await tap(btn(/토론 \d+분 시작/));
    expect(within(tl()).getByText(gateLine('PB-2', (e) => e.roleId === 'consort' && e.dir === 'in'))).toBeInTheDocument();
    expect(within(tl()).queryByText(/^자시|^축시/)).toBeNull();

    // 셋째 조사 — 알림(모두와 같은 문구) + 장소 고르기부터 PB-3 기록(자시·축시)
    await tap(btn(/셋째 조사 시작/));
    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    expect(screen.queryByText(/새 기억|떠오르는 기억/)).toBeNull(); // 공용 무대엔 역할별 표시가 없다
    expect(within(tl()).getByText(gateLine('PB-3', (e) => e.roleId === 'eunuch' && e.dir === 'in'))).toBeInTheDocument();
    // 개선 묶음 1 G2: 방장 본인 장소 고르기는 무대가 아니라 단서함에서 — 무대엔 장소 타일·봉인 카드가 없다
    expect(tiles('gu-place-tile')).toHaveLength(0);
    expect(document.querySelectorAll('.gu-sealed')).toHaveLength(0);
    await tap(btn(/토론 \d+분 시작/));
    const total = sejaCase.rounds.flatMap((r) => r.publicCards ?? []).reduce((n, c) => n + (c.gateLog?.length ?? 0), 0);
    expect(within(tl()).getAllByRole('listitem')).toHaveLength(total);

    await tap(btn(/지금 확인하기/));
    const surface = screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
    fireEvent.keyDown(surface, { key: 'Enter' });
    await flush();
    expect(surface.textContent).toContain(MEMORY.crownPrincess[0]);
  });

  it('4인 방장: 조사 1엔 타임라인 없음, 둘째 조사가 시작되면(장소 고르기부터) 최종 변론까지 상단에 있다', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    await tap(btn(/4\s*명/));
    await tap(btn(/방 열기/));
    await tap(btn(/대기실로/));
    await tap(btn(/사건 시작/));
    await tap(btn(/시작하겠소/));
    await tap(btn(/다 읽었소/));
    await tap(btn(/다 봤소/));
    await tap(btn(/첫째 조사 시작/));
    expect(screen.getByText(sejaCase.rounds[0].publicCards![0].title)).toBeInTheDocument(); // PB-1 은 라운드 시작 때 공개
    await tap(btn(/토론 \d+분 시작/));
    expect(screen.queryByText(/내문 출입 타임라인/)).toBeNull(); // PB-1 은 출입 기록이 아님
    await tap(btn(/둘째 조사 시작/));
    expect(screen.getByText(/내문 출입 타임라인/)).toBeInTheDocument(); // 조사 2 장소 고르기부터
    await tap(btn(/토론 \d+분 시작/));
    expect(screen.getByText(/내문 출입 타임라인/)).toBeInTheDocument();
    // 막대 위 레인: 기록에 나온 사람(역할 짧은 이름)
    const grid = document.querySelector('.gu-gatetl-grid')!;
    expect(Array.from(grid.querySelectorAll('.gu-gatetl-lane')).map((l) => l.textContent).filter(Boolean)).toEqual(['어의', '내관', '숙의', '세자빈', '조상궁']);
    await tap(btn(/셋째 조사 시작/));
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(/최종 변론으로/));
    expect(screen.getByText(/내문 출입 타임라인/)).toBeInTheDocument();
    // 방장 4인: 잠금 블록 가진 플레이어 역할이 없어도 알림은 같은 문구로 떴다(인원·역할 무관) — 역할별 문구는 없다
    expect(screen.queryByText(/새 기억|떠오르는 기억/)).toBeNull();
  });
});
