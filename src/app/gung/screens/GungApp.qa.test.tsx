// @vitest-environment jsdom
/**
 * @QA실행자 — 화면 통합(I 레벨) 신규 케이스. 설계서 docs/qa/gung-test-plan.md §3·§8-1 의 I 항목.
 *
 * 규약(기존 스모크와 같다): next/navigation 만 갈아 끼우고, Date 만 가짜(사람 탭 = 1초 간격). 홀드·타이머 케이스만
 * setTimeout·rAF·performance 까지 가짜로 돌린다. 실데이터(sejaCase) + 결정론 코드.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, createEvent, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode, getSheet, roleAtSeat, SEED_ALPHABET, seatOfRole, type PlayerCount } from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { circledNum } from '../components';
import { useWakeLock } from '../lib/useWakeLock';
import { GungApp } from './GungApp';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const ALL_FAKE = ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] as const;
const START = new Date('2026-10-02T21:00:00+09:00');

let played: HTMLMediaElement[] = [];
beforeEach(() => {
  search = '';
  window.localStorage.clear();
  window.history.replaceState(null, '', '/gung');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  played = [];
  // jsdom 은 미디어 재생이 없다 — 화면 꺼짐 방지 폴백 비디오가 어떤 엘리먼트로 재생됐는지 기록만
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    played.push(this);
    return Promise.resolve();
  });
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
/** setTimeout·rAF·performance 까지 가짜로 — 이미 Date 만 가짜인 상태에선 vitest 가 재설치를 무시하므로 먼저 해제 */
function fakeAllTimers() {
  vi.useRealTimers();
  vi.useFakeTimers({ toFake: [...ALL_FAKE] });
  vi.setSystemTime(START);
}
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const qbtn = (name: RegExp | string) => screen.queryByRole('button', { name });
const tiles = (cls: string) => screen.getAllByRole('button').filter((b) => b.className.includes(cls));
const dialog = () => screen.getByRole('dialog');
const bodyText = () => document.body.textContent ?? '';
const saved = () => JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null');
/** 조사 3 진입 알림 — 모든 역할·모든 기기에 같은 문구(QA RISK-04) */
const RECHECK = /셋째 조사 — 각자 내 패를 다시 확인하시오/;

/** 결정론 코드 탐색 */
function findCode(n: PlayerCount, pred: (code: string) => boolean): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[i % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 7) % 31]}${A[(i * 11 + 5) % 31]}${n}`;
    if (pred(code)) return code;
  }
  throw new Error('no code');
}
const asg = (code: string) => assignFromCode(c, code)!;

async function dismissPeekTip() {
  const ok = qbtn('알겠소');
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

async function syncTo(label: RegExp, openSheet = true) {
  if (openSheet) await tap(screen.getByRole('button', { name: /진행 단계/ }));
  await tap(screen.getByRole('radio', { name: label }));
  await tap(btn(/^이동/));
  const confirm = qbtn(/가겠소/);
  if (confirm) await tap(confirm);
}

/** 플레이어: 게이트로 대기 → 개요 → 내 패 확인 */
async function playerToCards(code: string, seat: number) {
  await joinAsPlayer(code, seat);
  await tap(btn(/사건 시작됐어요/));
  await tap(btn(/내 패 확인하기/));
  await dismissPeekTip();
}

async function hostRecover(code: string) {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
}

async function createRoom(n: PlayerCount) {
  render(<GungApp />);
  await flush();
  await tap(btn(/방 만들기/));
  await tap(btn(new RegExp(`${n}\\s*명`)));
  await tap(btn(/방 열기/));
}

const sealedSurface = () => screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
const isOpen = () => Boolean(screen.queryByText(/손을 떼면 바로 가려져요|탭으로 열림|다시 탭하면 가려져요/));
async function keyOpen(el: HTMLElement) {
  fireEvent.keyDown(el, { key: 'Enter' });
  await flush();
}
async function keyClose(el: HTMLElement) {
  fireEvent.keyUp(el, { key: 'Enter' });
  await flush();
}

/** 역할 시트의 모든 글(비밀 포함)을 12자 조각으로 — DOM 누출 탐침 */
function probesOf(code: string, seat: number, round = 3): string[] {
  const sh = getSheet(c, asg(code), seat, round)!;
  const texts = [
    sh.identity.headline,
    sh.identity.body ?? '',
    sh.profile,
    ...sh.glance,
    ...sh.secrets,
    ...sh.night.map((l) => l.text),
    ...sh.canLie,
    ...sh.mustTell,
    ...sh.lieTips,
    ...sh.missions.map((m) => m.text),
    ...sh.speech,
    ...sh.memories.flatMap((m) => (m.unlocked ? m.lines : [])),
  ];
  return texts.filter((t) => t.length >= 6).map((t) => t.slice(0, 12));
}
const SECTION_TABS = ['정체', '신분', '비밀', '그날 밤', '거짓말', '미션', '말투'];

// ═══════════════════════════════ 3-D SEAL ═══════════════════════════════

describe('SEAL — 비밀 카드 봉인', () => {
  it('SEAL-01 봉인 상태: 6역할 × 7섹션 — DOM(aria-label 포함)에 그 역할 패의 글이 한 조각도 없다 / 열면 보인다', async () => {
    for (const role of ['queen', 'consort', 'eunuch', 'physician', 'courtLady', 'crownPrincess']) {
      const code = findCode(6, (k) => (seatOfRole(asg(k), role) ?? 1) >= 2);
      const seat = seatOfRole(asg(code), role)!;
      await playerToCards(code, seat);
      const probes = probesOf(code, seat, 0);
      for (const tab of SECTION_TABS) {
        await tap(screen.getByRole('tab', { name: tab }));
        const html = document.body.innerHTML;
        const leaked = probes.filter((p) => html.includes(p));
        expect(leaked, `${role} ${tab} sealed`).toEqual([]);
        // 탐침이 의미 있는지 — 열면 이 섹션의 글이 실제로 나온다
        await keyOpen(sealedSurface());
        expect(probes.some((p) => document.body.innerHTML.includes(p)), `${role} ${tab} open`).toBe(true);
        await keyClose(sealedSurface());
        expect(probes.filter((p) => document.body.innerHTML.includes(p))).toEqual([]);
      }
      cleanup();
      window.localStorage.clear();
    }
  }, 60_000);

  it('SEAL-09 [BUG-01] D3: 같은 판 자리 2~6(범인 포함) — 7섹션 봉인 화면 DOM 이 자리 번호만 빼고 완전히 같다(쪽 나눔 없음)', async () => {
    const code = findCode(6, (k) => asg(k).culpritSeat >= 2);
    const snaps: Record<number, string[]> = {};
    for (let seat = 2; seat <= 6; seat++) {
      await playerToCards(code, seat);
      const shots: string[] = [];
      for (const tab of SECTION_TABS) {
        await tap(screen.getByRole('tab', { name: tab }));
        shots.push(document.body.innerHTML.replace(/\d+번/g, 'N번'));
      }
      snaps[seat] = shots;
      cleanup();
      window.localStorage.clear();
    }
    const culprit = asg(code).culpritSeat;
    for (let seat = 2; seat <= 6; seat++) {
      snaps[seat].forEach((html, i) => expect(html, `seat ${seat}${seat === culprit ? '(범인)' : ''} shot ${i}`).toBe(snaps[2][i]));
    }
    // 재현 케이스(설계서): 22225 2번(범인) '거짓말' — 쪽 나눔 폐지로 쪽 칩 자체가 DOM 에 없다(봉인·열림 둘 다)
    const sh225 = getSheet(c, asg('22225'), 2, 3)!;
    const expectedLieCount = sh225.canLie.length + sh225.mustTell.length + sh225.lieTips.length;
    expect(expectedLieCount).toBeGreaterThan(1); // 탐침 유효성 — 예전엔 이게 여러 쪽으로 쪼개졌다
    await playerToCards('22225', 2);
    await tap(screen.getByRole('tab', { name: '거짓말' }));
    expect(document.querySelector('.gu-sealed-pager')).toBeNull();
    // 연 동안엔(손으로 가린 채) 항목 전부가 ①②③… 번호 목록으로 한 화면에 — 쪽을 넘기지 않아도 끝까지 다 보인다
    await keyOpen(sealedSurface());
    expect(document.querySelector('.gu-sealed-pager')).toBeNull();
    const marks = Array.from(document.querySelectorAll('.gu-rolecard .gu-numitem-mark')).map((m) => m.textContent);
    expect(marks).toEqual(Array.from({ length: expectedLieCount }, (_, i) => circledNum(i + 1)));
  }, 60_000);

  it('SEAL-02·03 홀드 400ms 경계(399 안 열림·401 열림) · 손 떼기 4종(up·cancel·lostcapture·leave) 즉시 봉인', async () => {
    fakeAllTimers();
    await playerToCards('7F3K5', 3);
    for (const release of ['pointerUp', 'pointerCancel', 'lostPointerCapture', 'pointerLeave'] as const) {
      const s = sealedSurface();
      fireEvent.pointerDown(s, { pointerId: 1, isPrimary: true });
      await advance(399);
      expect(isOpen(), `${release} 399`).toBe(false);
      await advance(2);
      expect(isOpen(), `${release} 401`).toBe(true);
      fireEvent[release](sealedSurface(), { pointerId: 1 });
      await flush();
      expect(isOpen(), `${release} released`).toBe(false);
    }
    // 399ms 에 떼면 그 뒤 시간이 흘러도 열리지 않는다
    fireEvent.pointerDown(sealedSurface(), { pointerId: 1 });
    await advance(399);
    fireEvent.pointerUp(sealedSurface(), { pointerId: 1 });
    await advance(1000);
    expect(isOpen()).toBe(false);
  });

  it('SEAL-04 연 채로 앱 전환(visibilitychange hidden)·blur·pagehide → 즉시 봉인', async () => {
    await playerToCards('7F3K5', 3);
    const hidden = vi.spyOn(document, 'hidden', 'get');
    for (const fire of [
      () => {
        hidden.mockReturnValue(true);
        document.dispatchEvent(new Event('visibilitychange'));
      },
      () => window.dispatchEvent(new Event('blur')),
      () => window.dispatchEvent(new Event('pagehide')),
    ]) {
      hidden.mockReturnValue(false);
      await keyOpen(sealedSurface());
      expect(isOpen()).toBe(true);
      await act(async () => fire());
      expect(isOpen()).toBe(false);
    }
  });

  it('SEAL-05 연 채로 섹션 칩·탭 전환·메뉴 열기·단계 변경 → 즉시 봉인', async () => {
    await playerToCards('7F3K5', 3);
    await keyOpen(sealedSurface());
    await tap(screen.getByRole('tab', { name: '비밀' }));
    expect(isOpen()).toBe(false);

    await keyOpen(sealedSurface());
    await tap(btn('메뉴'));
    expect(isOpen()).toBe(false);
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));

    await keyOpen(sealedSurface());
    await tap(btn('단서함'));
    await tap(btn('내 패'));
    expect(isOpen()).toBe(false);

    await keyOpen(sealedSurface());
    await syncTo(/^자기소개/);
    expect(isOpen()).toBe(false);
  });

  it('SEAL-06 탭 모드: 탭 → 15초 자동 봉인 · 남은 초 표시 · 다시 탭 = 즉시 봉인', async () => {
    fakeAllTimers();
    await playerToCards('7F3K5', 3);
    await tap(btn('메뉴'));
    await tap(btn(/보기 방식/));
    expect(screen.getByRole('button', { name: /탭하면 잠시 표시/ })).toBeInTheDocument();
    fireEvent.click(sealedSurface());
    await flush();
    expect(screen.getByText(/탭으로 열림 · 남음 15초/)).toBeInTheDocument();
    await advance(14_000);
    expect(isOpen()).toBe(true);
    await advance(1_100);
    expect(isOpen()).toBe(false);
    fireEvent.click(sealedSurface());
    await flush();
    expect(isOpen()).toBe(true);
    fireEvent.click(sealedSurface());
    await flush();
    expect(isOpen()).toBe(false);
  });

  it('SEAL-07 키보드: 반복 keydown 은 무시, keyup 에 봉인 / SEAL-08 두 번째 손가락·마우스 오른쪽 버튼은 무시', async () => {
    fakeAllTimers();
    await playerToCards('7F3K5', 3);
    fireEvent.keyDown(sealedSurface(), { key: 'Enter', repeat: true });
    await flush();
    expect(isOpen()).toBe(false);
    await keyOpen(sealedSurface());
    fireEvent.keyDown(sealedSurface(), { key: 'Enter', repeat: true });
    await flush();
    expect(isOpen()).toBe(true);
    await keyClose(sealedSurface());
    expect(isOpen()).toBe(false);

    const second = createEvent.pointerDown(sealedSurface(), { pointerId: 2 });
    Object.defineProperty(second, 'isPrimary', { value: false });
    fireEvent(sealedSurface(), second);
    await advance(600);
    expect(isOpen()).toBe(false);
    const right = createEvent.pointerDown(sealedSurface(), { pointerId: 3, button: 2 });
    Object.defineProperty(right, 'pointerType', { value: 'mouse' });
    Object.defineProperty(right, 'button', { value: 2 });
    fireEvent(sealedSurface(), right);
    await advance(600);
    expect(isOpen()).toBe(false);
  });

  it('SEAL-15 범인 도장은 범인 자리 · 정체 섹션이 열렸을 때만', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat >= 2);
    const culprit = asg(code).culpritSeat;
    await playerToCards(code, culprit);
    expect(screen.queryByRole('img', { name: '도장: 범인' })).toBeNull();
    await keyOpen(sealedSurface());
    expect(screen.getByRole('img', { name: '도장: 범인' })).toBeInTheDocument();
    await keyClose(sealedSurface());
    for (const tab of SECTION_TABS.slice(1)) {
      await tap(screen.getByRole('tab', { name: tab }));
      await keyOpen(sealedSurface());
      expect(screen.queryByRole('img', { name: '도장: 범인' }), tab).toBeNull();
      await keyClose(sealedSurface());
    }
    cleanup();
    window.localStorage.clear();
    await playerToCards(code, [2, 3, 4, 5].find((s) => s !== culprit)!);
    await keyOpen(sealedSurface());
    expect(screen.queryByRole('img', { name: '도장: 범인' })).toBeNull();
  });

  it('SEAL-01b 단서 카드: 미결정·비공개 봉인 상태엔 본문이 DOM 에 없다 / 공개하면 전문', async () => {
    const code = '7F3K5';
    await joinAsPlayer(code, 3);
    await syncTo(/^조사 1/);
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    const card = c.rounds[0].clues[c.rounds[0].placeIds[0]].find(() => true)!;
    const probe = card.body.slice(0, 12);
    expect(document.body.innerHTML).not.toContain(probe);
    const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
    await keyOpen(surface);
    expect(document.body.innerHTML).toContain(probe);
    await keyClose(surface);
    await tap(btn('비공개'));
    expect(document.body.innerHTML).not.toContain(probe);
    await tap(btn('공개'));
    expect(document.body.innerHTML).toContain(probe);
  });
});

// ═══════════════════════════════ ASG-08 / BRD-07 — 남의 비밀·메타 누설 ═══════════════════════════════

describe('ASG-08·BRD-07 — 플레이어 화면에 남의 비밀·구성표가 없다', () => {
  it('6인·4인 플레이어: 대기~지목 모든 단계 × (진행·내 패·단서함) 화면 텍스트에 다른 역할의 비밀 조각 0 · "빠진 역할" 0', async () => {
    for (const n of [6, 4] as PlayerCount[]) {
      const code = findCode(n, (k) => asg(k).culpritSeat !== 3);
      const a = asg(code);
      const mine = roleAtSeat(a, 3)!;
      // 공개 정보(브리핑·공용/NPC 카드)에 같은 글이 있으면 비밀이 아니다 → 탐침에서 뺀다
      const publicText = JSON.stringify([c.briefing, c.rounds.map((r) => [r.publicCards, r.npcCards])]);
      const others = c.roles
        .filter((r) => r.id !== mine)
        .flatMap((r) => [...r.glance, ...r.secrets, r.crime ?? '', ...(r.lieTips ?? []), ...r.canLie, ...r.mustTell, ...(r.memories ?? []).flatMap((m) => m.lines)])
        .filter((t) => t.length >= 8)
        .map((t) => t.slice(0, 12))
        .filter((p) => !publicText.includes(p));
      await joinAsPlayer(code, 3);
      await dismissPeekTip();
      for (const phase of [/^대기/, /^사건 개요/, /^패 확인/, /^자기소개/, /^조사 1/, /^조사 2/, /^조사 3/, /^최종 변론/, /^지목/]) {
        if (!/대기/.test(String(phase))) await syncTo(phase);
        await dismissPeekTip();
        for (const tab of ['지금', '내 패', '단서함']) {
          await tap(btn(tab));
          await dismissPeekTip();
          const text = bodyText();
          const leak = others.filter((p) => text.includes(p));
          expect(leak, `${n}인 ${phase} ${tab}`).toEqual([]);
          expect(text).not.toMatch(/빠진 역할|구성표/);
        }
      }
      cleanup();
      window.localStorage.clear();
    }
  }, 60_000);
});

// ═══════════════════════════════ 3-L RVL ═══════════════════════════════

const CULPRIT_TOKENS = ['숙의', '연씨'];

describe('RVL — 진상 공개 순서·스포일러', () => {
  it('RVL-01·02 지목 → 진상: 암전 → 정황 10 → "그 꿀에 독을 탄 자는…" 까지 방장 화면 전체에 범인 토큰 0 → 범인 도장(자리·이름·자백) → 판결', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    // 1→2, 2→1, 3→2, 4→2 : 2번(범인) 검거
    for (const t of [2, 1, 2, 2]) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
    expect(screen.getByText(/최다 지목:/)).toBeInTheDocument();
    await tap(btn(/진상 공개/));
    await tap(within(dialog()).getByRole('button', { name: /공개하겠소/ }));

    const seen: string[] = [];
    for (let i = 0; i < 20; i++) {
      const text = bodyText();
      const kind = screen.queryByText('그날 밤…')
        ? 'dark'
        : screen.queryByText(c.truth.culpritLine)
          ? 'line'
          : screen.queryByRole('img', { name: '도장: 범인' })
            ? 'culprit'
            : screen.queryByRole('img', { name: /도장: (검거|도주|미결)/ })
              ? 'verdict'
              : 'story';
      seen.push(kind);
      if (kind === 'culprit') {
        expect(text).toContain('2번 · 숙의');
        expect(text).toContain(c.truth.confession.slice(0, 20));
      } else if (kind !== 'verdict') {
        for (const t of CULPRIT_TOKENS) expect(text, `${kind} #${i}`).not.toContain(t);
        expect(text).not.toMatch(/2번[^]{0,6}범인|범인[^]{0,6}2번/);
      }
      const next = qbtn(/^(다음|점수 보기)/);
      if (!next) break;
      if (kind === 'verdict') break;
      await tap(next);
    }
    expect(seen).toEqual(['dark', ...Array(c.truth.beats.length).fill('story'), 'line', 'culprit', 'verdict']);
    expect(screen.getByRole('img', { name: '도장: 검거' })).toBeInTheDocument();
  });

  it('RVL-04 [BUG-15] 전체 한 번에 보기: 확인 시트 → 범인 도장·자백 비트 → 다음 탭에 판결', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 3);
    await hostRecover(code);
    await syncTo(/^진상 공개/, false);
    await tap(btn(/전체 한 번에 보기/));
    expect(within(dialog()).getByText(/정황을 건너뛰고 범인을 밝히겠소/)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: /범인을 밝히겠소/ }));
    expect(screen.getByRole('img', { name: '도장: 범인' })).toBeInTheDocument();
    expect(bodyText()).toContain(c.truth.confession.slice(0, 20));
    expect(qbtn(/전체 한 번에 보기/)).toBeNull();
    await tap(btn(/^다음/));
    expect(screen.getByRole('img', { name: /도장: (검거|도주|미결)/ })).toBeInTheDocument();
  });

  it('RVL-09·VOTE-14 [BUG-06] 지목 없이 진상·결과로 건너뛰면 "도주"가 아니라 판결 없음 — 결과 공유 버튼도 없다', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^진상 공개/, false);
    await tap(btn(/전체 한 번에 보기/));
    await tap(within(dialog()).getByRole('button', { name: /범인을 밝히겠소/ }));
    await tap(btn(/^다음/));
    expect(screen.getByRole('img', { name: '도장: 미결' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '도장: 도주' })).toBeNull();
    expect(bodyText()).toMatch(/판결이 없소/);
    await tap(btn(/점수 보기/));
    expect(bodyText()).toMatch(/판결 없음\(지목 미완료\)/);
    expect(bodyText()).not.toMatch(/범인 도주|완전범죄/);
    expect(qbtn(/카톡으로 결과 공유/)).toBeNull();
    expect(qbtn(/링크 복사/)).toBeNull();
    expect(document.querySelector('.gu-resultpreview')).toBeNull();
  });
});

// ═══════════════════════════════ BRD — 공용 카드 ═══════════════════════════════

describe('BRD — 공용·NPC 카드', () => {
  it('BRD-02 [BUG-04 결정: 원고 1-7·4-1 — 라운드 시작 때 공개] 방장: 장소 고르기 화면부터 그 라운드 공용·NPC 카드가 보이고 토론까지 그대로, 다음 라운드 것은 없다', async () => {
    const code = findCode(4, () => true);
    await hostRecover(code);
    await syncTo(/^조사 1/, false);
    const pb = c.rounds[0].publicCards![0].body.slice(0, 14);
    const npc = c.rounds[0].npcCards![0].body.slice(0, 14);
    const pb2 = c.rounds[1].publicCards![0].body.slice(0, 14);
    expect(bodyText()).toContain(pb); // 장소 고르기(라운드 시작)
    expect(bodyText()).toContain(npc); // 4인 = NPC 증언 포함
    expect(bodyText()).toContain('추가 증언');
    expect(bodyText()).not.toContain(pb2);
    expect(qbtn(/공용 단서 펼치기/)).toBeNull();
    await tap(btn(/토론 \d+분 시작/));
    expect(bodyText()).toContain(pb);
    expect(bodyText()).not.toContain(pb2);
  });

  it('BRD-03 [BUG-04 결정] 플레이어 단서함도 조사 1 장소 고르기 때부터 그 라운드 공용·NPC 카드를 보인다(방장 화면과 같은 시점)', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat !== 2);
    await joinAsPlayer(code, 2);
    await syncTo(/^조사 1/);
    await tap(btn('단서함'));
    const text = bodyText();
    expect(text).toContain(c.rounds[0].publicCards![0].title);
    for (const npc of c.rounds[0].npcCards!) expect(text).toContain(npc.title);
    expect(text).not.toContain(c.rounds[1].publicCards![0].title); // 다음 라운드 것은 없다
  });
});

// ═══════════════════════════════ LOCK ═══════════════════════════════

describe('LOCK — R3 기억 조기 해제', () => {
  it('LOCK-06 [BUG-05] 조사 2 게이트 "3라운드 시작됐어요" 1탭으로는 안 넘어간다 — 확인 시트 → 취소면 그대로(기억 잠김), 확정해야 조사 3·모두와 같은 알림', async () => {
    const code = findCode(6, (k) => (seatOfRole(asg(k), 'courtLady') ?? 1) >= 2);
    const seat = seatOfRole(asg(code), 'courtLady')!;
    const memory = c.roles.find((r) => r.id === 'courtLady')!.memories![0].lines[0].slice(0, 14);
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 2/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    await tap(btn(/3라운드 시작됐어요/));
    expect(within(dialog()).getByText(/셋째 조사로 넘어가겠소/)).toBeInTheDocument();
    expect(saved().phase).toBe('r2');
    await tap(within(dialog()).getByRole('button', { name: /아직이오/ }));
    expect(saved().phase).toBe('r2');
    expect(screen.queryByText(RECHECK)).toBeNull();
    expect(bodyText()).not.toContain(memory);
    await tap(btn(/3라운드 시작됐어요/));
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
    expect(saved().phase).toBe('r3');
    expect(screen.getByText(RECHECK)).toBeInTheDocument();
    expect(bodyText()).not.toContain(memory); // 봉인 속에서만
    expect(bodyText()).not.toMatch(/새 기억|떠오르는 기억/);
  });

  it('LOCK-06c [BUG-05 우회] 진행 단계 맞추기로 조사 2→3(한 단계)도 게이트와 같은 확인을 거친다 — 취소면 그대로', async () => {
    const code = findCode(6, (k) => (seatOfRole(asg(k), 'courtLady') ?? 1) >= 2);
    const seat = seatOfRole(asg(code), 'courtLady')!;
    const memory = c.roles.find((r) => r.id === 'courtLady')!.memories![0].lines[0].slice(0, 14);
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 2/);
    await dismissPeekTip();
    expect(saved().phase).toBe('r2');
    await tap(screen.getByRole('button', { name: /진행 단계/ }));
    await tap(screen.getByRole('radio', { name: /^조사 3/ }));
    await tap(btn(/^이동/));
    // 게이트(「3라운드 시작됐어요」)와 같은 제목·같은 본문
    expect(within(dialog()).getByText(/셋째 조사로 넘어가겠소/)).toBeInTheDocument();
    expect(within(dialog()).getByText(/방장이 '셋째 조사를 시작하오'라고 외쳤을 때만 누르시오/)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: /아직이오/ }));
    expect(saved().phase).toBe('r2');
    expect(bodyText()).not.toContain(memory);
    // 변론으로 건너뛰어도(조사 3을 지나침) 같은 확인
    await tap(screen.getByRole('button', { name: /진행 단계/ }));
    await tap(screen.getByRole('radio', { name: /^최종 변론/ }));
    await tap(btn(/^이동/));
    expect(within(dialog()).getByText(/셋째 조사로 넘어가겠소/)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
    expect(saved().phase).toBe('defense');
    expect(screen.getByText(RECHECK)).toBeInTheDocument();
  });

  it('LOCK-06d 조사 1 진입(자기소개 게이트)도 같은 확인 — 1탭이면 그대로 자기소개', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat !== 2);
    await joinAsPlayer(code, 2);
    await syncTo(/^자기소개/);
    await dismissPeekTip();
    await tap(btn(/1라운드 시작됐어요/));
    expect(saved().phase).toBe('intro');
    expect(within(dialog()).getByText(/첫째 조사로 넘어가겠소/)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
    expect(saved().phase).toBe('r1');
  });

  it('LOCK-06b 확인 시트 문구는 모든 역할에 같다(기억 보유 역할만 다른 시트를 띄우면 역할이 드러난다) · 조사 1→2 도 같은 확인', async () => {
    const code = findCode(6, (k) => asg(k).seats.indexOf('queen') + 1 >= 2);
    const seat = seatOfRole(asg(code), 'queen')!;
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 1/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    await tap(btn(/2라운드 시작됐어요/));
    expect(within(dialog()).getByText(/둘째 조사로 넘어가겠소/)).toBeInTheDocument();
    expect(within(dialog()).queryByText(/기억/)).toBeNull();
  });

  it('BUG-20 이미 내 패 탭에 있을 때 알림의 「지금 확인하기」를 눌러도 비밀 › 기억 쪽으로 간다', async () => {
    const code = findCode(6, (k) => (seatOfRole(asg(k), 'crownPrincess') ?? 1) >= 2);
    const seat = seatOfRole(asg(code), 'crownPrincess')!;
    const memory = c.roles.find((r) => r.id === 'crownPrincess')!.memories![0].lines[0];
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 2/);
    await tap(btn('내 패'));
    await dismissPeekTip();
    await syncTo(/^조사 3/); // 단계 변경 → 진행 탭으로 돌아감
    await tap(btn('내 패'));
    expect(screen.getByRole('tab', { name: '정체' })).toHaveAttribute('aria-selected', 'true');
    await tap(btn(/지금 확인하기/));
    expect(screen.getByRole('tab', { name: '비밀' })).toHaveAttribute('aria-selected', 'true');
    await keyOpen(sealedSurface());
    expect(sealedSurface().textContent).toContain(memory);
  });
});

// ═══════════════════════════════ 3-B JOIN (화면) ═══════════════════════════════

describe('JOIN — 입장·코드 입력', () => {
  it('JOIN-04 ?r=7F3K5 → 홈(S1)', async () => {
    search = 'r=7F3K5';
    render(<GungApp />);
    await flush();
    expect(btn(/방 만들기/)).toBeInTheDocument();
    expect(qbtn(/입장하기/)).toBeNull();
  });

  it('JOIN-03 ?code=7F3O5 → "코드가 맞지 않소" → 처음으로 = 홈', async () => {
    search = 'code=7F3O5';
    render(<GungApp />);
    await flush();
    expect(screen.getByRole('heading', { name: '코드가 맞지 않소' })).toBeInTheDocument();
    await tap(btn('처음으로'));
    expect(btn(/방 만들기/)).toBeInTheDocument();
  });

  it('JOIN-05 &v=2 이면 S5 경고 배너, &v=1(지금 번들)이면 없음', async () => {
    search = `code=7F3K5&v=${c.version + 1}`;
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/사건 버전이 달라요/)).toBeInTheDocument();
    cleanup();
    search = `code=7F3K5&v=${c.version}`;
    render(<GungApp />);
    await flush();
    expect(screen.queryByText(/사건 버전이 달라요/)).toBeNull();
  });

  it('JOIN-09 코드 칸: 자동 대문자·다음 칸 · 0·한글 무시 · 5번째 칸은 4~6만', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/코드로 참가하기/));
    screen.getByLabelText('코드 1번째 글자').focus();
    for (const ch of ['7', 'f', '0', '한', '3', 'K', '9', '5']) {
      fireEvent.change(document.activeElement as HTMLInputElement, { target: { value: ch } });
      await flush();
    }
    expect(screen.getByText(/방 코드 7F3K-5 · 5인/)).toBeInTheDocument();
  });

  it('JOIN-10 붙여넣기: "7F3K-5"·" 7f3k5 " → 5칸 분배 후 자동 진행', async () => {
    for (const text of ['7F3K-5', ' 7f3k5 ']) {
      render(<GungApp />);
      await flush();
      await tap(btn(/코드로 참가하기/));
      fireEvent.paste(screen.getByLabelText('코드 1번째 글자'), { clipboardData: { getData: () => text } });
      await flush();
      expect(screen.getByText(/방 코드 7F3K-5 · 5인/), text).toBeInTheDocument();
      cleanup();
    }
  });

  it('JOIN-11 [BUG-11] 초대 URL 붙여넣기 → 그 안의 7F3K5 로 입장(HTTP-5 아님) / 코드 없는 링크는 칸을 채우지 않고 안내', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/코드로 참가하기/));
    fireEvent.paste(screen.getByLabelText('코드 1번째 글자'), { clipboardData: { getData: () => 'https://project-orsrw.vercel.app/gung?code=7F3K5&v=1' } });
    await flush();
    expect(screen.getByText(/방 코드 7F3K-5 · 5인/)).toBeInTheDocument();
    expect(bodyText()).not.toMatch(/HTTP/);
    cleanup();

    render(<GungApp />);
    await flush();
    await tap(btn(/코드로 참가하기/));
    fireEvent.paste(screen.getByLabelText('코드 1번째 글자'), { clipboardData: { getData: () => 'https://project-orsrw.vercel.app/gung' } });
    await flush();
    expect(screen.getByText(/링크에 방 코드가 없소/)).toBeInTheDocument();
    expect((screen.getByLabelText('코드 1번째 글자') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: /코드를 넣으시오/ })).toBeInTheDocument();
  });

  it('JOIN-14 O9: 진행 중(A) + 다른 코드 링크(B) → 이어하기 = A 복원·URL A / 새 사건 = 확인 → 저장 삭제 → B 랜딩', async () => {
    await joinAsPlayer('7F3K5', 3);
    cleanup();
    search = 'code=22226';
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/진행 중인 사건\(7F3K-5/)).toBeInTheDocument();
    await tap(btn('이어하기'));
    expect(screen.getByText(/3번 자리로 들었소/)).toBeInTheDocument();
    expect(window.location.search).toBe('?code=7F3K5');
    cleanup();
    render(<GungApp />);
    await flush();
    await tap(btn('새 사건으로 입장'));
    await tap(within(dialog()).getByRole('button', { name: /지우고 입장/ }));
    expect(screen.getByText(/방 코드 2222-6 · 6인/)).toBeInTheDocument();
    expect(saved()).toBeNull();
  });

  it('JOIN-18·19 ?as=host: 저장 없으면 방장 입장 → 대기실 + O1 자동 / 같은 코드 플레이어 저장이 있으면 플레이어로 복원', async () => {
    await hostRecover('7F3K5');
    expect(screen.getByRole('dialog', { name: /지금 어디까지 왔소/ })).toBeInTheDocument();
    expect(saved()).toMatchObject({ role: 'host', seat: 1, phase: 'lobby' });
    cleanup();
    window.localStorage.clear();
    await joinAsPlayer('7F3K5', 4);
    cleanup();
    search = 'code=7F3K5&as=host';
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/4번 자리로 들었소/)).toBeInTheDocument();
    expect(saved().role).toBe('player');
  });
});

// ═══════════════════════════════ 3-E FLOW ═══════════════════════════════

describe('FLOW — 진행·되돌리기·새로고침', () => {
  it('FLOW-03 플레이어 게이트 더블탭(600ms 이내)도 한 단계만', async () => {
    await joinAsPlayer('7F3K5', 3);
    vi.setSystemTime(new Date(Date.now() + 1000));
    fireEvent.click(btn(/사건 시작됐어요/));
    await flush();
    fireEvent.click(btn(/내 패 확인하기/));
    await flush();
    expect(saved().phase).toBe('briefing');
  });

  it('FLOW-08·TMR-10 [BUG-07] 방장 복구 → O1 조사 2: 타이머 시작 버튼 → 2:00 / 최종 변론도 같은 방식', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^조사 2/, false);
    expect(screen.queryByText(/^\d\d:\d\d$/)).toBeNull();
    await tap(btn(/장소 고르기 타이머 시작/));
    expect(screen.getByText('02:00')).toBeInTheDocument();
    await syncTo(/^최종 변론/);
    await tap(btn(/변론 타이머 시작/));
    expect(screen.getByText('01:00')).toBeInTheDocument();
  });

  it('FLOW-12 [BUG-09] 전진 토스트 뒤에 다른 기록(다음 사람)이 쌓이면 토스트의 되돌리기가 사라진다 — 엉뚱한 기록을 되돌리지 않는다', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^패 확인/, false);
    await tap(btn(/다 봤소/));
    expect(document.querySelector('.gu-toast-action')).not.toBeNull();
    await tap(btn(/다음 사람/));
    expect(document.querySelector('.gu-toast-action')).toBeNull();
    expect(saved()).toMatchObject({ phase: 'intro' });
    expect(saved().host.introCurrent).toBe(2);
    // 토스트가 남아 있을 때(다른 기록 없음)는 그 전진을 되돌린다
    await tap(btn(/첫째 조사 시작/));
    await tap(document.querySelector('.gu-toast-action') as HTMLElement);
    expect(saved().phase).toBe('intro');
  });

  it('FLOW-13 [BUG-08] 결과 화면: 미션 판정 → ↶ → 점수 보기 — 판정이 그대로 남아 있다', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    for (const t of [2, 1, 2, 2]) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
    await tap(btn(/진상 공개/));
    await tap(within(dialog()).getByRole('button', { name: /공개하겠소/ }));
    for (let i = 0; i < 30 && qbtn(/^(다음|점수 보기)/); i++) await tap(btn(/^(다음|점수 보기)/));
    const ok = screen.getAllByRole('button', { name: '성공' });
    await tap(ok[0]);
    await tap(ok[1]);
    const before = saved().host.missions;
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await tap(within(screen.getByRole('banner')).getByRole('button', { name: '되돌리기' }));
    await tap(btn(/점수 보기/));
    expect(saved().host.missions).toEqual(before);
    expect(screen.getAllByRole('button', { name: '성공' }).filter((b) => b.getAttribute('aria-pressed') === 'true').length).toBe(2);
  });

  it('FLOW-09 플레이어 새로고침 복원(조사 2 · 장소 고름 · 공개 표시): 같은 단계·장소·공개 여부 + 토스트 + 봉인 닫힘', async () => {
    await joinAsPlayer('7F3K5', 3);
    await syncTo(/^조사 2/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[2]);
    await tap(btn(/조사하기/));
    const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
    await keyOpen(surface);
    await keyClose(surface);
    await tap(btn('공개'));
    const before = saved();
    cleanup();
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/이어하는 중 · 3번 자리 · 조사 2/)).toBeInTheDocument();
    expect(saved().rounds).toEqual(before.rounds);
    expect(screen.getByRole('img', { name: '도장: 공개' })).toBeInTheDocument();
    expect(isOpen()).toBe(false);
  });

  it('FLOW-15 하드웨어 뒤로: 시트 열림 → 시트만 닫힘 / 인게임 → 토스트 + 게임 유지 / S3 초대 화면 → 대기실 안내(BUG-22)', async () => {
    await createRoom(4);
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.getByText(/대기실로 →」를 누르시오/)).toBeInTheDocument();
    await tap(btn(/대기실로/));
    await tap(btn('메뉴'));
    expect(screen.getByRole('dialog', { name: '메뉴' })).toBeInTheDocument();
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.queryByRole('dialog', { name: '메뉴' })).toBeNull();
    await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
    expect(screen.getByText(/나가려면 ⋮ › 처음으로/)).toBeInTheDocument();
    expect(saved().phase).toBe('lobby');
  });

  it('FLOW-19 ⋮ › 처음으로 → 확인 → 저장 삭제·URL /gung·홈', async () => {
    await joinAsPlayer('7F3K5', 3);
    await tap(btn('메뉴'));
    await tap(btn('처음으로'));
    await tap(within(dialog()).getByRole('button', { name: '처음으로' }));
    expect(saved()).toBeNull();
    expect(window.location.pathname + window.location.search).toBe('/gung');
    expect(btn(/방 만들기/)).toBeInTheDocument();
  });

  it('STO-04 [BUG-19] UI: 지목 단계인데 vote 가 null 인 방장 저장 → 에러 화면 없이 지목 준비 화면', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^지목/, false);
    const raw = saved();
    raw.host.vote = null;
    window.localStorage.setItem('gu:game:v1', JSON.stringify(raw));
    cleanup();
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    expect(btn(/셋 세기 시작/)).toBeInTheDocument();
  });
});

// ═══════════════════════════════ 3-G CLUE ═══════════════════════════════

describe('CLUE — 장소·단서', () => {
  it('CLUE-02 [BUG-17] 장소 되돌리기 토스트는 단서를 열면 사라진다(죽은 버튼 금지) / 열기 전엔 되돌린다', async () => {
    await joinAsPlayer('7F3K5', 3);
    await syncTo(/^조사 1/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    await tap(document.querySelector('.gu-toast-action') as HTMLElement);
    expect(saved().rounds['1']).toBeUndefined();
    expect(screen.getByText('어디를 조사하겠소?')).toBeInTheDocument();
    await tap(tiles('gu-place-tile')[1]);
    await tap(btn(/조사하기/));
    expect(document.querySelector('.gu-toast-action')).not.toBeNull();
    await keyOpen(screen.getByRole('button', { name: /단서 — 비밀 정보/ }));
    expect(document.querySelector('.gu-toast-action')).toBeNull();
    expect(saved().rounds['1'].opened).toBe(true);
  });

  it('CLUE-08 단서함 "지금 고르기": 지난 라운드 미선택 → 시트 2탭 → 결정론 단서', async () => {
    await joinAsPlayer('7F3K5', 3);
    await syncTo(/^조사 2/);
    await dismissPeekTip();
    await tap(btn('단서함'));
    expect(screen.getByText('조사 1 · 아직 고르지 않음')).toBeInTheDocument();
    await tap(screen.getAllByRole('button', { name: '지금 고르기' })[0]);
    const sheet = dialog();
    await tap(within(sheet).getAllByRole('button').filter((b) => b.className.includes('gu-place-tile'))[3]);
    await tap(within(sheet).getByRole('button', { name: /조사하기/ }));
    expect(saved().rounds['1'].placeId).toBe(c.rounds[0].placeIds[3]);
    expect(screen.queryByText('조사 1 · 아직 고르지 않음')).toBeNull();
  });

  it('CLUE-04 [BUG-25] 4인 R1 후원 연못 교체 카드는 머리에 "HW-1b" 가 아니라 "HW-1"', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat !== 2);
    await joinAsPlayer(code, 2);
    await syncTo(/^조사 1/);
    await dismissPeekTip();
    const hw = c.places.find((p) => p.id === 'hw')!;
    await tap(tiles('gu-place-tile').find((t) => t.textContent?.includes(hw.name))!);
    await tap(btn(/조사하기/));
    const id = document.querySelector('.gu-cluecard-id')!.textContent;
    expect(id).toBe('HW-1');
    expect(bodyText()).not.toContain('HW-1b');
  });
});

// ═══════════════════════════════ 3-I TMR ═══════════════════════════════

describe('TMR — 타이머·화면 꺼짐 방지', () => {
  it('TMR-03·09 [BUG-16] 0초: 진동 [200,100,200] 정확히 1번, "끝!", 멈춤/재개 버튼 없음(+30초만)', async () => {
    fakeAllTimers();
    const vib = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    await hostRecover('7F3K5');
    await syncTo(/^조사 1/, false);
    await tap(btn(/장소 고르기 타이머 시작/));
    await advance(119_000);
    expect(vib).not.toHaveBeenCalledWith([200, 100, 200]);
    await advance(2_000);
    expect(screen.getByText('끝!')).toBeInTheDocument();
    await advance(5_000);
    expect(vib.mock.calls.filter((cl) => JSON.stringify(cl[0]) === '[200,100,200]')).toHaveLength(1);
    expect(qbtn('재개')).toBeNull();
    expect(qbtn('멈춤')).toBeNull();
    await tap(btn('+30초'));
    expect(screen.getByText('00:30')).toBeInTheDocument();
  });

  it('TMR-12 [BUG-10] Wake Lock 없는 브라우저의 방장: 초대 → 대기실 뒤에도 화면에 있는 폴백 <video> 가 재생 중이고 헤더 🕯', async () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    try {
      await createRoom(5);
      await flush();
      expect(played).toContain(document.querySelector('video')!);
      await tap(btn(/대기실로/));
      await flush();
      // 재현 메모: 지금 트리에선 초대·본 화면의 <video> 가 형제 순번이 같아 React 가 **같은 엘리먼트를 재사용**한다 →
      // 설계서가 말한 "새 <video> 미재생"은 이 구성에선 일어나지 않는다. 아래 하네스로 엘리먼트가 실제로 바뀌는 경우를 따로 본다.
      expect(played).toContain(document.querySelector('video')!);
      expect(document.querySelector('.gu-header-wake[data-on]')).not.toBeNull();
    } finally {
      delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    }
  });

  it('TMR-12b [BUG-10 방어] useWakeLock 폴백: <video> 엘리먼트가 바뀌면(key 교체) 새 엘리먼트를 재생한다', async () => {
    Object.defineProperty(navigator, 'wakeLock', { value: undefined, configurable: true });
    try {
      function Harness({ k }: { k: number }) {
        const w = useWakeLock(true, true);
        return (
          <div>
            <video key={k} ref={w.videoRef} data-k={k} />
            <span data-testid="wake">{w.status}</span>
          </div>
        );
      }
      const { rerender } = render(<Harness k={1} />);
      await flush();
      const v1 = document.querySelector('video[data-k="1"]')!;
      expect(played).toContain(v1);
      rerender(<Harness k={2} />);
      await flush();
      const v2 = document.querySelector('video[data-k="2"]')!;
      expect(v2).not.toBe(v1);
      expect(played).toContain(v2);
      expect(screen.getByTestId('wake').textContent).toBe('on');
      // 재생이 거부되면 'on' 으로 남지 않는다
      vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(() => Promise.reject(new Error('NotAllowedError')));
      rerender(<Harness k={3} />);
      await flush();
      await flush();
      expect(screen.getByTestId('wake').textContent).toBe('off');
    } finally {
      delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
    }
  });
});

// ═══════════════════════════════ 3-J VOTE / 3-K SCR (화면) ═══════════════════════════════

describe('VOTE·SCR — 지목 입력·집계·판정 화면', () => {
  it('VOTE-01·02·03 카운트다운 건너뛰기(onDone 1번) → 스테퍼(자기 제외·600ms 재탭 무시·이전 사람) → 집계에 범인 표시 0 · 행 탭 = 그 사람부터', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat === 4);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await tap(btn(/셋 세기 시작/));
    const skip = btn('건너뛰기');
    fireEvent.click(skip);
    fireEvent.click(skip);
    await flush();
    expect(saved().host.vote.sub).toBe('input');
    // 1번 차례 — 1번 타일은 없다
    expect(qbtn(/^1번/)).toBeNull();
    vi.setSystemTime(new Date(Date.now() + 1000));
    fireEvent.click(btn(/^3번/));
    await flush();
    fireEvent.click(btn(/^4번/)); // 같은 시각 재탭 → 무시
    await flush();
    expect(saved().host.vote.first).toEqual({ 1: 3 });
    await tap(btn(/이전 사람/));
    expect(saved().host.vote.first).toEqual({});
    for (const t of [4, 4, 4, 1, 4]) await tap(btn(new RegExp(`^${t}번`)));
    expect(saved().host.vote.sub).toBe('tally');
    // 집계 화면에 범인 여부 표시가 없다(보너스 안내의 일반 문장 "범인의 답은 점수에 들어가지 않소"만 예외)
    expect(bodyText().replace('범인의 답은 점수에 들어가지 않소', '')).not.toMatch(/범인/);
    expect(screen.queryByRole('img', { name: /도장/ })).toBeNull();
    await tap(btn('3번의 지목 고치기'));
    expect(saved().host.vote.sub).toBe('input');
    expect(screen.getByRole('heading', { name: /^3번/ })).toBeInTheDocument();
  });

  it('SCR-05 보너스 입력: 동률 아님 → 펼침 → 범인 포함 활성 전원 행이 있다(스포일러 방지)', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 3);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    for (const t of [3, 3, 1, 3]) await tap(btn(new RegExp(`^${t}번`)));
    const groups = screen.getAllByRole('group').filter((g) => /독이 든 음식은/.test(g.getAttribute('aria-label') ?? ''));
    expect(groups.map((g) => g.getAttribute('aria-label')!.split(' — ')[0].split(' ')[0])).toEqual(['1번', '2번', '3번', '4번']);
  });

  it('SCR-06 미션 판정 중엔 자리 순 고정, 미판정 0 이 되면 점수순', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    for (const t of [2, 1, 2, 2]) await tap(btn(new RegExp(`^${t}번`)));
    await tap(btn(/진상 공개/));
    await tap(within(dialog()).getByRole('button', { name: /공개하겠소/ }));
    for (let i = 0; i < 30 && qbtn(/^(다음|점수 보기)/); i++) await tap(btn(/^(다음|점수 보기)/));
    const order = () => Array.from(document.querySelectorAll('.gu-scorerow-who')).map((e) => Number(/(\d+)번/.exec(e.textContent ?? '')![1]));
    expect(order()).toEqual([1, 2, 3, 4]);
    // 남은 수동 미션(비밀 유지·어의 Q1 등)을 전부 판정 — 4번만 실패
    for (let g = 0; g < 20; g++) {
      const pending = Array.from(document.querySelectorAll('.gu-scorerow')).find((row) =>
        Array.from(row.querySelectorAll('button')).some((b) => b.textContent === '성공' && b.getAttribute('aria-pressed') !== 'true' && !row.querySelector('button[aria-pressed="true"]')),
      );
      if (!screen.queryByText(/아직 판정 안 한 미션/)) break;
      const rows = Array.from(document.querySelectorAll('.gu-scorerow'));
      const target = pending ?? rows.find((r) => r.querySelector('button'));
      const seat = Number(/(\d+)번/.exec(target!.querySelector('.gu-scorerow-who')!.textContent ?? '')![1]);
      const buttons = Array.from(target!.querySelectorAll('button')).filter((b) => (seat === 4 ? b.textContent === '실패' : b.textContent === '성공') && b.getAttribute('aria-pressed') !== 'true');
      if (!buttons.length) break;
      await tap(buttons[0] as HTMLElement);
    }
    expect(screen.queryByText(/아직 판정 안 한 미션/)).toBeNull();
    const scores = Array.from(document.querySelectorAll('.gu-scorerow-score')).map((e) => Number((e.textContent ?? '').replace('점', '')));
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });
});

// ═══════════════════════════════ O8 자리 비우기 ═══════════════════════════════

describe('O8 자리 비우기', () => {
  const SPOIL = /사건이 성립하지 않소|범인이 아니라는 뜻|계속할 수 있소|범인이었소|범인이 아니|새 방을 여는 걸 권/;
  /** 자리 비우기 시트를 끝까지 밟고, 확인·반영 단계의 시트 글을 자리 번호만 지워 모은다 */
  async function absentFlow(seat: number): Promise<string[]> {
    const texts: string[] = [];
    const norm = () => (dialog().textContent ?? '').replaceAll(String(seat), '#');
    await tap(btn('메뉴'));
    await tap(btn('자리 비우기'));
    await tap(within(dialog()).getByRole('button', { name: String(seat) }));
    await tap(within(dialog()).getByRole('button', { name: '비우기' }));
    texts.push(norm());
    await tap(within(dialog()).getByRole('button', { name: new RegExp(`${seat}번 비우겠소`) }));
    texts.push(norm());
    return texts;
  }

  it('BUG-02 확인 전에 닫으면 아무 흔적 없음·범인 여부 미노출', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat === 3);
    await hostRecover(code);
    await syncTo(/^조사 1/, false);
    for (const seat of [2, 3, 4, 5]) {
      await tap(btn('메뉴'));
      await tap(btn('자리 비우기'));
      await tap(within(dialog()).getByRole('button', { name: String(seat) }));
      await tap(within(dialog()).getByRole('button', { name: '비우기' }));
      expect(within(dialog()).getByText(/정말 자리를 떠났소/)).toBeInTheDocument();
      expect(bodyText()).not.toMatch(SPOIL);
      await tap(within(dialog()).getByRole('button', { name: '닫기' }));
      expect(saved().host.absentSeats).toEqual([]);
      expect(bodyText()).not.toMatch(SPOIL);
    }
  });

  it('BUG-02 우회 차단: 비운 뒤 결과 화면도 범인 자리·무고 자리가 자리 번호만 빼고 똑같다 → ↶ 반복으로 캐낼 게 없다 · 범인 부재는 진상 판결에서만', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat === 3);
    await hostRecover(code);
    await syncTo(/^조사 1/, false);
    const histBefore = saved().host.history.length;
    const byseat: Record<number, string[]> = {};
    for (const seat of [2, 3, 4, 5]) {
      byseat[seat] = await absentFlow(seat);
      expect(saved().host.absentSeats).toEqual([seat]);
      expect(saved().host.history.length).toBe(histBefore + 1); // 되돌리기 스택에 기록
      expect(bodyText()).not.toMatch(SPOIL);
      await tap(within(dialog()).getByRole('button', { name: '알겠소' }));
      expect(bodyText()).not.toMatch(SPOIL);
      // ↶ 로 되돌려도 남는 정보가 없다
      await tap(within(screen.getByRole('banner')).getByRole('button', { name: '되돌리기' }));
      expect(saved().host.absentSeats).toEqual([]);
      expect(bodyText()).not.toMatch(SPOIL);
    }
    // 범인 자리(3)와 무고 자리(2·4·5)의 시트 글이 전 단계 같다
    for (const seat of [2, 4, 5]) expect(byseat[seat]).toEqual(byseat[3]);

    // 범인 자리를 실제로 비운 채 진상까지 가면, 그때(판결 비트)에야 '판결 없음(범인 자리 비움)'
    await absentFlow(3);
    await tap(within(dialog()).getByRole('button', { name: '알겠소' }));
    await syncTo(/^진상 공개/);
    await tap(btn(/전체 한 번에 보기/));
    await tap(within(dialog()).getByRole('button', { name: /범인을 밝히겠소/ }));
    await tap(btn(/^다음/));
    expect(screen.getByRole('img', { name: '도장: 미결' })).toBeInTheDocument();
    expect(bodyText()).toMatch(/범인\(3번\)이 자리를 비워 판결이 없소/);
    await tap(btn(/점수 보기/));
    expect(bodyText()).toMatch(/판결 없음\(범인 자리 비움\)/);
    expect(qbtn(/카톡으로 결과 공유/)).toBeNull();
  });
});

// ═══════════════════════════════ 셋업·저장 장애·기타 P1/P2 ═══════════════════════════════

describe('셋업·저장·기타', () => {
  it('ROOM-03 crypto 없음: 방 열기 → 크래시 없이 "방을 만들지 못했소" 토스트 · Math.random 미사용', async () => {
    const realRandom = Math.random.bind(Math);
    const stacks: string[] = [];
    const rnd = vi.spyOn(Math, 'random').mockImplementation(() => {
      stacks.push(new Error().stack ?? '');
      return realRandom();
    });
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    await tap(btn(/5\s*명/));
    const savedCrypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      await tap(btn(/방 열기/));
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: savedCrypto, configurable: true });
    }
    expect(screen.getByText(/방을 만들지 못했소/)).toBeInTheDocument();
    expect(saved()).toBeNull();
    // React act() 내부(enqueueTask)가 Math.random 을 부르는 건 테스트 도구 몫 — 앱 코드(src/**/gung, 테스트 파일 제외) 프레임만 본다
    const fromApp = stacks.filter((st) =>
      st
        .split('\n')
        .slice(2)
        .some((f) => /src\/(lib|app)\/gung\//.test(f) && !/\.test\.tsx?/.test(f)),
    );
    expect(fromApp).toEqual([]);
    expect(rnd).toBeDefined();
  });

  it('ROOM-11 방 열기 더블탭(600ms 이내) → 방은 1개(두 번째 코드로 덮어쓰지 않음)', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    await tap(btn(/6\s*명/));
    vi.setSystemTime(new Date(Date.now() + 1000));
    const b = btn(/방 열기/);
    fireEvent.click(b);
    await flush();
    const first = saved().code;
    if (b.isConnected) fireEvent.click(b);
    await flush();
    expect(saved().code).toBe(first);
    expect(screen.getByText('방이 열렸소')).toBeInTheDocument();
  });

  it('ROOM-12 진행 중 게임이 있는데 방 만들기 → O3(danger) 확인 → 취소하면 저장 유지', async () => {
    await joinAsPlayer('7F3K5', 3);
    cleanup();
    search = '';
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/진행 중인 사건 · 7F3K-5 · 3번 자리/)).toBeInTheDocument();
    await tap(btn(/방 만들기/));
    expect(within(dialog()).getByText(/새 방을 열겠소/)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: '아직이오' }));
    expect(saved().code).toBe('7F3K5');
  });

  it('JOIN-06 S6: 1번 자리는 방장 — 눌러도 선택되지 않는다', async () => {
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    await tap(btn(/입장하기/));
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('1'))!);
    expect(qbtn(/1번 자리에 앉기/)).toBeNull();
    expect(btn('자리를 고르시오')).toBeDisabled();
  });

  it('JOIN-13 코드 입력에 내 저장 게임과 같은 코드 → 자동 이어하기 + 토스트', async () => {
    await joinAsPlayer('7F3K5', 3);
    cleanup();
    search = '';
    render(<GungApp />);
    await flush();
    await tap(btn(/코드로 참가하기/));
    fireEvent.paste(screen.getByLabelText('코드 1번째 글자'), { clipboardData: { getData: () => '7F3K5' } });
    await flush();
    expect(screen.getByText(/3번 자리로 들었소/)).toBeInTheDocument();
    expect(screen.getByText(/이어하는 중 · 3번 자리/)).toBeInTheDocument();
  });

  it('JOIN-15 O9 충돌 화면에서 12시간이 지나 이어하기 → 무반응이 아니라 홈', async () => {
    await joinAsPlayer('7F3K5', 3);
    cleanup();
    search = 'code=22226';
    render(<GungApp />);
    await flush();
    vi.setSystemTime(new Date(Date.now() + 12 * 3600_000 + 5_000));
    fireEvent.click(btn('이어하기'));
    await flush();
    expect(btn(/방 만들기/)).toBeInTheDocument();
  });

  it('STO-02 저장 차단(setItem throw): 메모리 폴백 + 배너 1회 + 진행 가능', async () => {
    const orig = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
      throw new DOMException('blocked', 'SecurityError');
    });
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/이 브라우저는 저장이 안 돼요/)).toBeInTheDocument();
    await tap(btn(/코드로 참가하기/));
    fireEvent.paste(screen.getByLabelText('코드 1번째 글자'), { clipboardData: { getData: () => '7F3K5' } });
    await flush();
    await tap(btn(/입장하기/));
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('2'))!);
    await tap(btn(/자리에 앉기/));
    await tap(btn(/사건 시작됐어요/));
    expect(screen.getByRole('heading', { name: /사건 개요/ })).toBeInTheDocument();
    Storage.prototype.setItem = orig;
  });

  it('TMR-04 새로고침: 돌던 타이머는 남은 시간(endsAt − now)으로 이어지고, 이미 끝난 타이머는 "끝!" + 진동 없음', async () => {
    const vib = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vib, configurable: true });
    await hostRecover('7F3K5');
    await syncTo(/^조사 1/, false);
    await tap(btn(/장소 고르기 타이머 시작/));
    cleanup();
    vi.setSystemTime(new Date(Date.now() + 45_000));
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    expect(screen.getByText('01:15')).toBeInTheDocument();
    cleanup();
    vi.setSystemTime(new Date(Date.now() + 10 * 60_000));
    render(<GungApp />);
    await flush();
    expect(screen.getByText('끝!')).toBeInTheDocument();
    expect(vib).not.toHaveBeenCalledWith([200, 100, 200]);
  });

  it('VOTE-11 P9 적중 칩: 범인 본인은 칩 없이 "당신이 범인이었소", 무고자는 ✓ 적중 / ✗', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat >= 3);
    const culprit = asg(code).culpritSeat;
    await joinAsPlayer(code, culprit);
    await syncTo(/^지목/);
    await tap(tiles('gu-seatgrid-tile')[0]);
    await tap(btn(/지목 확정/));
    await tap(btn(/진상 공개 시작됐어요/));
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
    expect(screen.getByText(/당신이 범인이었소/)).toBeInTheDocument();
    expect(screen.queryByText(/내 지목:/)).toBeNull();
    cleanup();
    window.localStorage.clear();
    await joinAsPlayer(code, 2);
    await syncTo(/^지목/);
    await tap(btn(new RegExp(`^${culprit}번`)));
    await tap(btn(/지목 확정/));
    await tap(btn(/진상 공개 시작됐어요/));
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
    expect(screen.getByText(new RegExp(`내 지목: ${culprit}번 ✓ 적중`))).toBeInTheDocument();
  });

  it('SCR-08 도주 판결: MVP 문구 "오늘의 주인공: 범인" / SHR-08 결과 화면 진입 시 OG 이미지 1회 프리워밍', async () => {
    const images: string[] = [];
    const OrigImage = window.Image;
    // @ts-expect-error 테스트용 대체
    window.Image = class {
      set src(v: string) {
        images.push(v);
      }
    };
    try {
      const code = findCode(4, (k) => asg(k).culpritSeat === 2);
      await hostRecover(code);
      await syncTo(/^지목/, false);
      await tap(btn(/셋 세기 시작/));
      await tap(btn('건너뛰기'));
      for (const t of [3, 3, 1, 3]) await tap(btn(new RegExp(`^${t}번`))); // 3번(무고) 지목 → 도주
      await tap(btn(/진상 공개/));
      await tap(within(dialog()).getByRole('button', { name: /공개하겠소/ }));
      for (let i = 0; i < 30 && qbtn(/^(다음|점수 보기)/); i++) await tap(btn(/^(다음|점수 보기)/));
      expect(screen.getByText(/오늘의 주인공: 범인/)).toBeInTheDocument();
      expect(screen.getByText(/범인 도주 · 2번 숙의/)).toBeInTheDocument();
      const og = images.filter((u) => u.includes('/gung/og/result?'));
      expect(og).toHaveLength(1);
      expect(og[0]).toMatch(/^https:\/\/project-orsrw\.vercel\.app\/gung\/og\/result\?o=e&n=4&h=0&j=3&m=\d+&r=0&d=\d{8}$/);
      expect(btn(/카톡으로 결과 공유/)).toBeInTheDocument();
    } finally {
      window.Image = OrigImage;
    }
  });

  it('CLUE-10 단서함 뱃지 = 공개 여부 미결정 단서 수, 정하면 줄어든다', async () => {
    await joinAsPlayer('7F3K5', 3);
    await syncTo(/^조사 1/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    const badge = () => document.querySelector('.gu-tab-badge')?.textContent ?? '';
    expect(badge()).toBe('1');
    await keyOpen(screen.getByRole('button', { name: /단서 — 비밀 정보/ }));
    await keyClose(screen.getByRole('button', { name: /단서 — 비밀 정보/ }));
    await tap(btn('비공개'));
    expect(badge()).toBe('');
  });

});
