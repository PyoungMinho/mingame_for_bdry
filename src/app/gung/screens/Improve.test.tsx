// @vitest-environment jsdom
/**
 * 개선 묶음 1(docs/planning/gung-improve-spec.md) — 화면 수용 기준(G1~G5 · R1~R7 · M1·M2).
 * 역할 중립 비교(방장 역할만 바꾼 판)는 RoleNeutral.test.tsx 에 함께 있다.
 *
 * 규약(기존 화면 테스트와 같다): next/navigation 만 갈아 끼우고 Date 만 가짜(사람 탭 = 1초 간격). 60초 수첩 복귀·인장 잠금만
 * setTimeout 까지 가짜로 돌린다. 실데이터(sejaCase) + 결정론 코드.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  assignFromCode,
  castFor,
  clueSeal,
  getClue,
  getSheet,
  GUIDE,
  guideText,
  newPlayerGame,
  PALACE_MAP_NOTE,
  placeCardsFor,
  publicSeats,
  roleById,
  roundDef,
  roundPlaces,
  SEED_ALPHABET,
  sealTable,
  type GameState,
  type PlayerCount,
  type RoundNo,
} from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';
import { HOST_CUE } from './HostScreens';
import { PlayerPlayArea, type PlayerAreaProps } from './PlayerScreens';
import { gateCaption, hostCaption, hostSignal, PHASE_SIGNAL, SKIP_INTRO_NOTE } from './signals';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const START = new Date('2026-10-02T21:00:00+09:00');
const ALL_FAKE = ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] as const;

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
const dialog = () => screen.getByRole('dialog');
const qdialog = () => screen.queryByRole('dialog');
const tiles = (cls: string, root: HTMLElement | Document = document) => Array.from(root.querySelectorAll<HTMLElement>(`button.${cls}`));
const tabBtn = (label: RegExp | string) => within(screen.getByRole('navigation', { name: '화면 전환' })).getByRole('button', { name: label });
const bodyText = () => document.body.textContent ?? '';
const caption = () => document.querySelector('.gu-actionbar-caption')?.textContent ?? null;
const savedNote = () => JSON.parse(window.localStorage.getItem('gu:note:v1') ?? 'null');

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
  const d = qdialog();
  if (d && d.getAttribute('aria-label') === '몰래 보는 법') await tap(within(d).getByRole('button', { name: '알겠소' }));
}
async function hostRecover(code: string) {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
  await tap(within(dialog()).getByRole('button', { name: '취소' })); // 복구 직후 열린 O1
}
async function joinAsPlayer(code: string, seat: number) {
  search = `code=${code}`;
  render(<GungApp />);
  await flush();
  await tap(btn(/입장하기/));
  await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith(String(seat))));
  await tap(btn(/자리에 앉기/));
}
async function syncTo(label: RegExp) {
  // 진상·결과 단계엔 헤더 기둥(레일)이 없다 — 메뉴 › 진행 단계 맞추기
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
async function keyOpen(el: HTMLElement) {
  fireEvent.keyDown(el, { key: 'Enter' });
  await flush();
}
async function keyClose(el: HTMLElement) {
  fireEvent.keyUp(el, { key: 'Enter' });
  await flush();
}
/** 방장 본인 조사(G2) — 단서함 「지금 고르기」 */
async function hostPickInClues(placeName?: string) {
  await tap(tabBtn('단서함'));
  const nows = screen.getAllByRole('button', { name: '지금 고르기' });
  await tap(nows[nows.length - 1]);
  const sheet = dialog();
  const ts = tiles('gu-place-tile', sheet);
  await tap(placeName ? ts.find((t) => t.textContent?.includes(placeName)) : ts[0]);
  await tap(within(sheet).getByRole('button', { name: /조사하기/ }));
}
/** 인장 키패드에 4자리 */
async function typeSeal(digits: string) {
  for (const d of digits) await tap(within(dialog()).getByRole('button', { name: d }));
}
const sigOf = (cap: string | null | undefined) => (cap ? /'(.+)'/.exec(cap)?.[1] ?? null : null);

// ═══════════════════════════════ G1 외칠 말 ═══════════════════════════════

describe('G1 방장 「외칠 말」 — 신호표 단일 출처', () => {
  function playerCaption(phase: GameState['phase'], opts: { picked?: boolean; voted?: boolean } = {}): string | undefined {
    const code = '7F3K5';
    const base = newPlayerGame(c, code, 2, START.getTime())!;
    const state: GameState = { ...base, phase };
    if (opts.picked) state.rounds = { 1: { placeId: 'dg', pickedAt: 0, opened: true, disclosure: 'private' }, 2: { placeId: 'dg', pickedAt: 0, opened: true, disclosure: 'private' }, 3: { placeId: 'dg', pickedAt: 0, opened: true, disclosure: 'private' } };
    if (opts.voted) state.myVote = { seat: 3, at: 0 };
    const noop = () => {};
    const props: PlayerAreaProps = {
      c,
      state,
      a: asg(code),
      sealEpoch: 0,
      revealMode: 'hold',
      activeTab: 'progress',
      dispatch: noop,
      onToast: noop,
      onConfirm: noop,
      onGoTab: noop,
      draftPlace: null,
      setDraftPlace: noop,
      draftVote: null,
      setDraftVote: noop,
      truthView: 'wait',
      setTruthView: noop,
      onShareGeneric: noop,
      map: { maps: [], placeIcons: {}, note: '' },
      onOpenMap: noop,
      sealOf: () => null,
    };
    return PlayerPlayArea(props).gateCaption;
  }

  it('표의 모든 단계: hostSignal(phase, sub) = 같은 단계 플레이어 게이트 캡션의 신호(글자 하나까지) · 하위 전진엔 신호 없음', () => {
    const table: [GameState['phase'], Parameters<typeof hostSignal>[1], { picked?: boolean; voted?: boolean }][] = [
      ['lobby', null, {}],
      ['briefing', null, {}],
      ['cards', null, {}],
      ['intro', null, {}],
      ['r1', 'discuss', { picked: true }],
      ['r2', 'discuss', { picked: true }],
      ['r3', 'discuss', { picked: true }],
      ['defense', 'last', {}],
      ['vote', 'decided', { voted: true }],
      ['reveal', 'culprit', {}],
    ];
    const expected = ['사건을 시작하겠소', '각자 자기 패를 몰래 보시오', '1번부터 신분을 밝히시오', '첫째 조사를 시작하오', '둘째 조사를 시작하오', '셋째 조사를 시작하오', '최종 변론이오', '지목하겠소', '그날 밤의 진상을 밝히겠소', '범인이 밝혀졌소'];
    table.forEach(([phase, sub, opts], i) => {
      const host = hostSignal(phase, sub);
      const cap = playerCaption(phase, opts);
      expect(host, phase).toBe(expected[i]);
      expect(cap, phase).toBe(gateCaption(host!));
      expect(sigOf(cap), phase).toBe(host);
      expect(PHASE_SIGNAL[phase]).toBe(host);
    });
    for (const [phase, sub] of [
      ['r1', 'select'],
      ['defense', 'next'],
      ['vote', 'pending'],
      ['reveal', 'beat'],
    ] as const) {
      expect(hostSignal(phase, sub), `${phase}/${sub}`).toBeNull();
    }
    expect(hostCaption('사건을 시작하겠소')).toBe("누르고 외치시오: '사건을 시작하겠소'");
    expect(SKIP_INTRO_NOTE).toBe("건너뛰면 외치시오: '첫째 조사를 시작하오' — 모두 두 번 눌러야 하오");
  });

  it('방장 진행 탭: 단계 전진 버튼에만 「누르고 외치시오」, 내 패·단서함·수첩 탭엔 없음 · 전진 토스트에 신호', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    expect(caption()).toBe(hostCaption('사건을 시작하겠소'));
    for (const tab of ['내 패', '단서함', '수첩']) {
      await tap(tabBtn(tab));
      await dismissPeekTip();
      expect(caption(), tab).toBeNull();
    }
    await tap(tabBtn('진행'));
    await tap(btn(/사건 시작/));
    await tap(within(dialog()).getByRole('button', { name: /시작하겠소/ }));
    expect(document.querySelector('.gu-toast')?.textContent).toContain("넘어갔소 → 사건 개요 · 준비 · 📣 '사건을 시작하겠소'");
    expect(caption()).toBe(hostCaption('각자 자기 패를 몰래 보시오'));
    await tap(btn(/다 읽었소/));
    expect(caption()).toBe(hostCaption('1번부터 신분을 밝히시오'));
    expect(bodyText()).toContain(SKIP_INTRO_NOTE);
    await tap(btn(/다 봤소/));
    expect(caption()).toBe(hostCaption('첫째 조사를 시작하오'));
    await tap(btn(/첫째 조사 시작/));
    expect(caption()).toBeNull(); // 장소 고르기 → 토론은 하위 전진
    await tap(btn(/토론 \d+분 시작/));
    expect(caption()).toBe(hostCaption('둘째 조사를 시작하오'));
    await syncTo(/^최종 변론/);
    expect(caption()).toBeNull(); // 변론 다음 사람은 하위 전진
    for (let i = 0; i < 3; i++) await tap(btn(/^다음 사람/));
    expect(caption()).toBe(hostCaption('지목하겠소'));
    await tap(btn(/지목하러/));
    expect(caption()).toBeNull();
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    for (const t of [2, 1, 2, 2]) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
    expect(caption()).toBe(hostCaption('그날 밤의 진상을 밝히겠소'));
    await tap(btn(/진상 공개/));
    await tap(within(dialog()).getByRole('button', { name: /공개하겠소|그대로 공개/ }));
    for (let i = 0; i < 30 && !document.querySelector('.gu-reveal-culprit'); i++) {
      expect(caption()).toBeNull();
      await tap(btn(/^다음 \(/));
    }
    expect(caption()).toBe(hostCaption('범인이 밝혀졌소'));
  });
});

// ═══════════════════════════════ G2 낭독 먼저 · 무대에 봉인 카드 없음 ═══════════════════════════════

describe('G2 방장 무대 — 봉인 카드 0 · 고르기 타이머 수동 · 방장 조사는 단서함', () => {
  it('방장 진행 탭 DOM 에 lobby~result 어느 단계에서도 .gu-sealed 가 0개', async () => {
    const code = findCode(5, () => true);
    await hostRecover(code);
    const check = (where: string) => expect(document.querySelectorAll('.gu-sealed'), where).toHaveLength(0);
    check('lobby');
    await tap(btn(/사건 시작/));
    await tap(within(dialog()).getByRole('button', { name: /시작하겠소/ }));
    check('briefing');
    await tap(btn(/다 읽었소/));
    check('cards');
    await tap(btn(/다 봤소/));
    check('intro');
    await tap(btn(/첫째 조사 시작/));
    for (const r of [1, 2, 3]) {
      check(`r${r}-select`);
      await hostPickInClues();
      await tap(tabBtn('진행'));
      check(`r${r}-select(picked)`);
      await tap(btn(/토론 \d+분 시작/));
      check(`r${r}-discuss`);
      await tap(btn(r < 3 ? /조사 시작/ : /최종 변론으로/));
    }
    check('defense');
    await syncTo(/^지목/);
    check('vote');
    await syncTo(/^진상 공개/);
    check('reveal');
    await syncTo(/^결과/);
    check('result');
  });

  it('조사 진입 직후 타이머 없음 → 「다 읽었소 → 고르기 2분 시작」 → 2:00 · 무대 문구', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^조사 1/);
    expect(screen.getByText(`「${GUIDE.selectCue}」`)).toBeInTheDocument();
    expect(bodyText()).toContain(GUIDE.publicAlsoInPhones);
    expect(screen.queryByText(/^\d\d:\d\d$/)).toBeNull();
    await tap(btn(GUIDE.selectTimerStart));
    expect(screen.getByText('02:00')).toBeInTheDocument();
    expect(btn(GUIDE.hostOwnClueLink)).toBeInTheDocument();
    // 무대 순서: 공용 단서(낭독) → 타이머 → 내 조사 버튼
    const html = document.body.innerHTML;
    expect(html.indexOf(c.rounds[0].publicCards![0].title)).toBeLessThan(html.indexOf('02:00'));
    expect(html.indexOf('02:00')).toBeLessThan(html.indexOf(GUIDE.hostOwnClueLink));
  });

  it('방장이 단서함에서 고르면 pickPlace 기록 + 6초 되돌리기 토스트, 단서를 열면 토스트를 거둔다(BUG-17)', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^조사 1/);
    await tap(btn(GUIDE.hostOwnClueLink));
    expect(within(screen.getByRole('navigation', { name: '화면 전환' })).getByRole('button', { name: '단서함' })).toHaveAttribute('aria-current', 'page');
    await hostPickInClues('서고');
    const saved = JSON.parse(window.localStorage.getItem('gu:game:v1')!);
    expect(saved.rounds['1'].placeId).toBe('sg');
    expect(document.querySelector('.gu-toast')?.textContent).toMatch(/서고에 갔소.*되돌리기/);
    await keyOpen(screen.getByRole('button', { name: /단서 — 비밀 정보/ }));
    expect(document.querySelector('.gu-toast')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem('gu:game:v1')!).rounds['1'].opened).toBe(true);
  });
});

// ═══════════════════════════════ G3 · G4 · R1 — 내 패 ═══════════════════════════════

describe('G3·G4·R1 — 자기소개 카드 · 정체 도장 · 거짓말 규칙 · 말투 머리 · 꼭 볼 3칸', () => {
  it('4·5·6인 × 플레이어 자리 전부: 자기소개 카드(P4) DOM 에 그 역할의 말투 예시가 없다(열어도)', async () => {
    for (const n of [4, 5, 6] as PlayerCount[]) {
      const code = findCode(n, () => true);
      for (let seat = 2; seat <= n; seat++) {
        await joinAsPlayer(code, seat);
        await syncTo(/^자기소개/);
        const speech = getSheet(c, asg(code), seat, 0)!.speech;
        expect(bodyText()).toContain(GUIDE.introPlayer);
        const card = screen.getByRole('button', { name: /자리의 신분/ });
        await keyOpen(card);
        expect(bodyText()).toContain(getSheet(c, asg(code), seat, 0)!.profile.slice(0, 20)); // 열렸다
        for (const s of speech) expect(document.body.innerHTML, `${n}인 ${seat}번`).not.toContain(s.slice(0, 14));
        await keyClose(card);
        cleanup();
        window.localStorage.clear();
      }
    }
  }, 60_000);

  it('하는 법 시트 첫 섹션 = 거짓말 규칙 상자 · ③ 말투 자유 · 방장 자기소개 큐에 「필수」 없음', async () => {
    await hostRecover('7F3K5');
    await tap(btn('메뉴'));
    await tap(btn('하는 법'));
    const content = dialog().querySelector('.gu-sheet-content')!;
    expect(content.firstElementChild?.classList.contains('gu-lierules')).toBe(true);
    expect(content.firstElementChild?.textContent).toContain(GUIDE.lieRules[3]);
    expect(dialog().textContent).toContain(GUIDE.rulesIntroStep);
    expect(dialog().textContent).not.toContain('필수');
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await syncTo(/^자기소개/);
    expect(HOST_CUE.intro).toBe(GUIDE.introCue);
    expect(bodyText()).toContain(GUIDE.introCue);
    expect(bodyText()).not.toContain('필수');
  });

  it('6역할: 정체 도장 1개(범인 「범인」·무고 「결백」 같은 크기·회전·클래스) · 거짓말 첫 블록 동일 · 말투 첫 줄 동일 · 패 확인 칩 위 「꼭 볼 3칸」', async () => {
    const stamps: { role: string; label: string; width: string; transform: string; cls: string }[] = [];
    const lieBoxes: string[] = [];
    const speechHeads: string[] = [];
    const hints: string[] = [];
    for (const role of castFor(c, 6)) {
      const code = findCode(6, (k) => (asg(k).seats.indexOf(role) + 1) >= 2);
      const seat = asg(code).seats.indexOf(role) + 1;
      await joinAsPlayer(code, seat);
      await tap(btn(/사건 시작됐어요/));
      await tap(btn(/내 패 확인하기/));
      await dismissPeekTip();
      hints.push(document.querySelector('.gu-rolecard-hint')?.textContent ?? '');
      const surface = () => screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
      await keyOpen(surface()); // 정체
      const st = document.querySelectorAll<HTMLElement>('.gu-hopae-stamp');
      expect(st, role).toHaveLength(1);
      stamps.push({ role, label: st[0].getAttribute('aria-label') ?? '', width: st[0].style.width, transform: st[0].style.transform, cls: st[0].className });
      await keyClose(surface());
      await tap(screen.getByRole('tab', { name: '거짓말' }));
      await keyOpen(surface());
      const first = document.querySelector('.gu-hopae-content > :nth-child(2)');
      expect(first?.classList.contains('gu-lierules'), role).toBe(true);
      lieBoxes.push(first?.textContent ?? '');
      await keyClose(surface());
      await tap(screen.getByRole('tab', { name: '말투' }));
      await keyOpen(surface());
      speechHeads.push(document.querySelector('.gu-hopae-content > :nth-child(2)')?.textContent ?? '');
      await keyClose(surface());
      // R1 P1: 한 번 연 칩엔 점 — 접근성 이름은 그대로
      expect(screen.getByRole('tab', { name: '정체' }).querySelector('.gu-chip-seen')).not.toBeNull();
      expect(screen.getByRole('tab', { name: '신분' }).querySelector('.gu-chip-seen')).toBeNull();
      cleanup();
      window.localStorage.clear();
    }
    const culprit = stamps.find((s) => s.role === 'consort')!;
    expect(culprit.label).toBe('도장: 범인');
    for (const s of stamps) {
      if (s.role !== 'consort') expect(s.label, s.role).toBe('도장: 결백');
      expect([s.width, s.transform, s.cls], s.role).toEqual([culprit.width, culprit.transform, culprit.cls]);
    }
    expect(new Set(lieBoxes).size).toBe(1);
    expect(lieBoxes[0]).toContain(GUIDE.lieRulesTitle);
    expect(lieBoxes[0]).toContain(GUIDE.lieRulesShort); // 봉인 패 안은 한 줄 요약(QA F-1), 전문은 하는 법 시트
    expect(new Set(speechHeads)).toEqual(new Set([GUIDE.speechHead]));
    expect(new Set(hints)).toEqual(new Set([GUIDE.cardsMustSee]));
  }, 60_000);
});

// ═══════════════════════════════ G5 진상 2단 ═══════════════════════════════

describe('G5 플레이어 진상 2단 공개', () => {
  async function toWait(code: string, seat: number, voteFor: number) {
    await joinAsPlayer(code, seat);
    await syncTo(/^지목/);
    await tap(tiles('gu-seatgrid-tile').find((t) => t.textContent?.startsWith(String(voteFor))));
    await tap(btn(/지목 확정/));
    await tap(btn(/진상 공개 시작됐어요/));
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
  }

  it('4·5·6인 × 범인 자리 조합: 대기 화면에 범인 자리·역할명·도장·「당신이 범인이었소」·적중이 없고, 역할만 바꾼 플레이어끼리 DOM 이 같다', async () => {
    for (const n of [4, 5, 6] as PlayerCount[]) {
      const shots: { role: string; html: string }[] = [];
      for (const role of castFor(c, n)) {
        const code = findCode(n, (k) => asg(k).seats[1] === role);
        const a = asg(code);
        await toWait(code, 2, a.culpritSeat === 2 ? 3 : a.culpritSeat); // 무고자는 범인을 짚고, 범인은 3번
        const html = document.body.innerHTML;
        const text = bodyText();
        const cul = publicSeats(c, a).find((s) => s.seat === a.culpritSeat)!;
        expect(text, `${n}인 ${role}`).not.toContain(`${a.culpritSeat}번 · `);
        expect(text).not.toContain(cul.shortName);
        expect(text).not.toContain(roleById(c, a.culpritRole)!.name);
        expect(html).not.toContain('도장: 범인');
        expect(text).not.toMatch(/당신이 범인이었소|✓ 적중|✗/);
        expect(text).toContain(GUIDE.truthWaitBody);
        expect(caption()).toBe(gateCaption('범인이 밝혀졌소'));
        const room = code;
        shots.push({
          role,
          html: html
            .replaceAll(room, '‹CODE›')
            .replace(/내 지목: \d+번/g, '내 지목: ‹N›번'),
        });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      for (const s of shots.slice(1)) expect(s.html, `${n}인 ${s.role} vs ${shots[0].role}`).toBe(shots[0].html);
    }
  }, 90_000);

  it('확인 시트를 거친 뒤에야 진상 전문 → 모두의 패 · reveal 에서 새로고침하면 대기 화면부터 · result 직행은 진상 전문', async () => {
    const code = findCode(5, (k) => asg(k).culpritSeat !== 2);
    const a = asg(code);
    await toWait(code, 2, a.culpritSeat);
    expect(screen.queryByText(c.truth.confession.slice(0, 20))).toBeNull();
    await tap(btn(GUIDE.truthWaitButton));
    expect(within(dialog()).getByText(GUIDE.truthConfirmTitle)).toBeInTheDocument();
    expect(dialog().textContent).toContain(GUIDE.truthConfirmBody);
    await tap(within(dialog()).getByRole('button', { name: '아직이오' }));
    expect(screen.queryByText(c.truth.confession.slice(0, 20))).toBeNull();
    await tap(btn(GUIDE.truthWaitButton));
    await tap(within(dialog()).getByRole('button', { name: GUIDE.truthConfirmOk }));
    expect(bodyText()).toContain(c.truth.confession.slice(0, 20));
    expect(bodyText()).toContain(`내 지목: ${a.culpritSeat}번 ✓ 적중`);
    // 새로고침 — 대기 화면부터
    cleanup();
    search = `code=${code}`;
    render(<GungApp />);
    await flush();
    expect(bodyText()).toContain(GUIDE.truthWaitBody);
    expect(screen.queryByText(c.truth.confession.slice(0, 20))).toBeNull();
    // 결과로 직행 — 진상 전문
    await syncTo(/^결과/);
    expect(bodyText()).toContain(c.truth.confession.slice(0, 20));
    // M2 모두 펼치기
    await tap(btn(/모두의 패 보기/));
    await tap(btn(GUIDE.expandAll));
    expect(document.querySelectorAll('.gu-allsheets-head[aria-expanded="true"]')).toHaveLength(5);
    await tap(btn(GUIDE.collapseAll));
    expect(document.querySelectorAll('.gu-allsheets-head[aria-expanded="true"]')).toHaveLength(0);
  });
});

// ═══════════════════════════════ R2 배치도 · 인물록 ═══════════════════════════════

describe('R2 「?」 시트(배치도·시각표·인물·용어) · 장소 고르기 배치도 링크', () => {
  it('제목·섹션 순서 · 자기소개 전엔 인물 잠김 · 뒤엔 자리 수만큼 · 4·5인만 「이 자리에 없으나」 · 지도 아이콘 = places[].icon', async () => {
    for (const n of [4, 5, 6] as PlayerCount[]) {
      const code = findCode(n, () => true);
      await hostRecover(code);
      await tap(btn(GUIDE.helpLabel));
      expect(within(dialog()).getByRole('heading', { name: GUIDE.helpSheetTitle })).toBeInTheDocument();
      const t0 = dialog().querySelector('.gu-sheet-content')?.textContent ?? '';
      expect(t0).toContain(GUIDE.peopleLocked);
      expect(dialog().querySelectorAll('.gu-roster-item')).toHaveLength(0);
      expect(t0).not.toContain(GUIDE.peopleAbsentHead);
      // 섹션 순서: 배치도 → 시각표 → 인물 → 용어
      const order = [GUIDE.mapSection, '시각표', GUIDE.peopleSection, GUIDE.termsSection].map((w) => t0.indexOf(w));
      expect(order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1]))).toBe(true);
      expect(t0).toContain(PALACE_MAP_NOTE);
      for (const node of dialog().querySelectorAll('.gu-map-node[data-place]')) {
        const id = node.getAttribute('data-place')!;
        expect(node.getAttribute('data-icon'), id).toBe(c.places.find((p) => p.id === id)!.icon);
      }
      expect(dialog().querySelectorAll('.gu-map-node[data-place]')).toHaveLength(c.places.length);
      await tap(within(dialog()).getByRole('button', { name: '닫기' }));
      await syncTo(/^조사 1/);
      await tap(btn(GUIDE.helpLabel));
      const items = dialog().querySelectorAll('.gu-roster-item');
      expect(items).toHaveLength(n + (6 - n));
      const head = (dialog().textContent ?? '').includes(GUIDE.peopleAbsentHead);
      expect(head, `${n}인 NPC 머리`).toBe(n < 6);
      expect(dialog().innerHTML.includes('이 자리에 없으나')).toBe(n < 6);
      expect(dialog().textContent).not.toMatch(/NPC|빠진/);
      cleanup();
      window.localStorage.clear();
    }
  }, 60_000);

  it('플레이어 장소 고르기·방장 단서함 지금 고르기 위에 「🗺 궁 배치도 보기」 → 배치도 시트', async () => {
    await joinAsPlayer('7F3K5', 2);
    await syncTo(/^조사 1/);
    expect(bodyText()).toContain(GUIDE.placeHint);
    await tap(btn(GUIDE.mapLink));
    expect(within(dialog()).getByRole('heading', { name: GUIDE.mapSection })).toBeInTheDocument();
    expect(dialog().querySelectorAll('svg.gu-map-svg')).toHaveLength(2);
    expect(dialog().textContent).toContain('취향당(숙의 처소)');
    cleanup();
    window.localStorage.clear();
    await hostRecover('7F3K5');
    await syncTo(/^조사 1/);
    await tap(tabBtn('단서함'));
    await tap(screen.getAllByRole('button', { name: '지금 고르기' })[0]);
    await tap(within(dialog()).getByRole('button', { name: GUIDE.mapLink }));
    expect(screen.getAllByRole('dialog').some((d) => d.querySelector('svg.gu-map-svg'))).toBe(true);
  });

  it('브리핑(방장·플레이어)에 배치도 — 누르면 큰 시트', async () => {
    await hostRecover('7F3K5');
    await tap(btn(/사건 시작/));
    await tap(within(dialog()).getByRole('button', { name: /시작하겠소/ }));
    expect(document.querySelectorAll('.gu-map svg.gu-map-svg')).toHaveLength(2);
    await tap(screen.getByRole('button', { name: GUIDE.mapTapHint }));
    expect(within(dialog()).getByRole('heading', { name: GUIDE.mapSection })).toBeInTheDocument();
  });
});

// ═══════════════════════════════ R3 공용 단서 상시 열람 ═══════════════════════════════

describe('R3 공용 단서 상시 열람 — 라운드 게이팅 그대로', () => {
  // 조각은 끝부분에서 — 같은 역할의 R1·R3 진술은 첫머리(「해시 정, …)가 같을 수 있다
  const R3_TEXT = [...(roundDef(c, 3).publicCards ?? []), ...(roundDef(c, 3).npcCards ?? [])].map((x) => x.body.slice(-24));

  it('r1·r2 방장(무대·접힘 펼침)·플레이어(이번 조사 공용 단서·단서함) DOM 에 PB-3·R3 추가 증언 본문이 없다 · r2 타임라인은 PB-2 기록뿐', async () => {
    const code = findCode(4, () => true);
    await hostRecover(code);
    for (const r of [1, 2]) {
      await syncTo(new RegExp(`^조사 ${r}`));
      for (const d of document.querySelectorAll('details')) d.setAttribute('open', '');
      for (const t of R3_TEXT) expect(document.body.innerHTML, `방장 r${r}`).not.toContain(t);
      if (r === 2) expect(bodyText()).toContain('지난 공용 단서 (조사 1)');
      await tap(btn(/토론 \d+분 시작/));
      for (const t of R3_TEXT) expect(document.body.innerHTML, `방장 r${r} 토론`).not.toContain(t);
    }
    // 탐침 유효성 — 조사 3에 들어서면 그 조각들이 실제로 보인다(4인: PB-3 + 추가 증언)
    await syncTo(/^조사 3/);
    for (const t of R3_TEXT) expect(document.body.innerHTML, '방장 r3').toContain(t);
    cleanup();
    window.localStorage.clear();
    await joinAsPlayer(code, 2);
    await syncTo(/^조사 2/);
    const fold = screen.getByText(GUIDE.publicThisRound).closest('details')!;
    expect(fold.textContent).toContain(roundDef(c, 2).publicCards![0].title);
    expect(fold.textContent).not.toContain(roundDef(c, 1).publicCards![0].title);
    for (const t of R3_TEXT) expect(document.body.innerHTML).not.toContain(t);
    await tap(tabBtn('단서함'));
    const pb2 = roundDef(c, 2).publicCards![0].gateLog!.length;
    expect(screen.getByRole('list', { name: /내문 출입 기록/ }).querySelectorAll('li')).toHaveLength(pb2);
    expect(bodyText()).toContain('시각 어림 — 술시 초 19시');
    for (const t of R3_TEXT) expect(document.body.innerHTML).not.toContain(t);
  });

  it('변론·지목 준비 화면에서 PB-1~3 이 「공용 단서 전체 ▸」 접힘 안에 · 공개 단서 보드도 접힘', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^최종 변론/);
    for (const where of ['defense', 'vote']) {
      if (where === 'vote') await syncTo(/^지목/);
      const fold = screen.getByText(GUIDE.publicAll).closest('details')!;
      expect(fold.hasAttribute('open')).toBe(false);
      for (const r of [0, 1, 2]) expect(fold.textContent, where).toContain(c.rounds[r].publicCards![0].title);
      expect(screen.getByText(/공개 단서 보드 \(0장\) ▸/).closest('details')!.hasAttribute('open')).toBe(false);
    }
  });
});

// ═══════════════════════════════ R4 개인 추리 수첩 ═══════════════════════════════

describe('R4 개인 추리 수첩', () => {
  it('탭 바는 모든 역할·인원에서 4개 · 행 = n−1(내 자리 없음) · 칸 순환 · 저장', async () => {
    for (const n of [4, 6] as PlayerCount[]) {
      const code = findCode(n, () => true);
      await joinAsPlayer(code, 2);
      expect(within(screen.getByRole('navigation', { name: '화면 전환' })).getAllByRole('button')).toHaveLength(4);
      await tap(tabBtn('수첩'));
      expect(bodyText()).toContain(GUIDE.notesHead);
      expect(bodyText()).toContain(GUIDE.notesLegend);
      const rows = document.querySelectorAll('.gu-notes-row[data-seat]');
      expect(rows).toHaveLength(n - 1);
      expect([...rows].map((r) => Number(r.getAttribute('data-seat')))).not.toContain(2);
      const cell = () => document.querySelector<HTMLElement>('.gu-notes-cell[data-seat="3"][data-col="means"]')!;
      expect(cell().getAttribute('data-mark')).toBe('');
      await tap(cell());
      expect(cell().getAttribute('data-mark')).toBe('o');
      expect(savedNote().marks).toEqual({ 3: { means: 'o' } });
      await tap(cell());
      expect(cell().getAttribute('data-mark')).toBe('x');
      await tap(cell());
      expect(cell().getAttribute('data-mark')).toBe('');
      expect(savedNote().marks).toEqual({});
      fireEvent.change(screen.getByRole('textbox', { name: `3번 ${GUIDE.notesLinePlaceholder}` }), { target: { value: '서고 쪽 동선이 이상함' } });
      await flush();
      expect(savedNote().lines).toEqual({ 3: '서고 쪽 동선이 이상함' });
      // 수첩 비우기
      await tap(btn(GUIDE.notesClear));
      await tap(within(dialog()).getByRole('button', { name: GUIDE.notesClearOk }));
      expect(savedNote()).toBeNull();
      cleanup();
      window.localStorage.clear();
    }
    await hostRecover('7F3K5');
    expect(within(screen.getByRole('navigation', { name: '화면 전환' })).getAllByRole('button')).toHaveLength(4);
    await tap(tabBtn('수첩'));
    expect(document.querySelectorAll('.gu-notes-row[data-seat]')).toHaveLength(4);
    expect(document.querySelector('.gu-notes-row[data-seat="1"]')).toBeNull();
  });

  it('자동 추론 없음: 단서를 열고·공개하고·조사 3·지목까지 가도 수첩 표시는 빈 채 · 수첩 DOM 에 보너스 문항·보기 없음', async () => {
    const code = findCode(5, () => true);
    await joinAsPlayer(code, 3);
    await tap(tabBtn('수첩'));
    const noteBefore = document.querySelector('.gu-notes')!.innerHTML;
    await tap(tabBtn('지금'));
    for (const r of [1, 2, 3] as RoundNo[]) {
      await syncTo(new RegExp(`^조사 ${r}`));
      await tap(tiles('gu-place-tile')[r]);
      await tap(btn(/조사하기/));
      const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
      await keyOpen(surface);
      await keyClose(surface);
      await tap(btn('공개'));
    }
    await syncTo(/^지목/);
    await tap(tiles('gu-seatgrid-tile')[0]);
    await tap(btn(/지목 확정/));
    await tap(tabBtn('수첩'));
    const st = savedNote();
    expect(st === null || (Object.keys(st.marks).length === 0 && Object.keys(st.lines).length === 0 && st.free === '')).toBe(true);
    expect(document.querySelectorAll('.gu-notes-cell[data-mark="o"], .gu-notes-cell[data-mark="x"]')).toHaveLength(0);
    // 보너스 문항·보기 — 역할 표기(D16 공개 정보)는 자리표시자로 바꾼 뒤 본다
    let html = document.querySelector('.gu-notes')!.innerHTML;
    for (const s of publicSeats(c, asg(code))) html = html.replaceAll(s.name, '‹R›').replaceAll(s.shortName, '‹R›');
    for (const q of c.bonusQuestions ?? []) {
      expect(html).not.toContain(q.prompt);
      for (const o of q.options) expect(html, o).not.toContain(o);
    }
    // 구조는 조사 전과 같다(행·열·문구) — 자기소개 전엔 자리 번호만
    expect(noteBefore).toContain('gu-notes-row');
    expect(noteBefore).not.toMatch(/번 · /);
  });

  it('60초 무입력 → 진행 탭으로 · 입력하면 다시 센다 · 단계가 바뀌면 진행 탭', async () => {
    fakeAllTimers();
    await joinAsPlayer('7F3K5', 2);
    await tap(tabBtn('수첩'));
    await advance(59_000);
    expect(tabBtn('수첩')).toHaveAttribute('aria-current', 'page');
    fireEvent.pointerDown(document.querySelector('.gu-notes-cell')!);
    await advance(59_000);
    expect(tabBtn('수첩')).toHaveAttribute('aria-current', 'page');
    await advance(1_500);
    expect(tabBtn('지금')).toHaveAttribute('aria-current', 'page');
    expect(document.querySelector('.gu-notes')).toBeNull();
    await tap(tabBtn('수첩'));
    await syncTo(/^사건 개요/);
    expect(tabBtn('지금')).toHaveAttribute('aria-current', 'page');
  });

  it('변론·지목 화면에 「📓 수첩」 바로가기', async () => {
    await joinAsPlayer('7F3K5', 2);
    await syncTo(/^최종 변론/);
    await tap(btn(GUIDE.notesShortcut));
    expect(bodyText()).toContain(GUIDE.notesHead);
    await tap(tabBtn('지금'));
    await syncTo(/^지목/);
    expect(btn(GUIDE.notesShortcut)).toBeInTheDocument();
  });
});

// ═══════════════════════════════ R5 공개 단서 인장 보드 ═══════════════════════════════

describe('R5 공개 단서 인장 보드', () => {
  it('플레이어: 카드가 public 일 때만 인장 숫자가 DOM 에 · 공개 토스트에 인장 · 안내 문구', async () => {
    const code = '7F3K5';
    const a = asg(code);
    await joinAsPlayer(code, 2);
    await syncTo(/^조사 1/);
    const place = roundPlaces(c, 1)[0];
    await tap(tiles('gu-place-tile').find((t) => t.textContent?.includes(place.name)));
    await tap(btn(/조사하기/));
    const clue = getClue(c, a, 1, place.id, 2)!;
    const seal = clueSeal(c, a.n, code, clue.id)!;
    const sealRe = new RegExp(`(?<!\\d)${seal}(?!\\d)`);
    expect(document.body.innerHTML).not.toMatch(sealRe);
    expect(bodyText()).toContain(GUIDE.clueMicro);
    const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
    await keyOpen(surface);
    await keyClose(surface);
    await tap(btn('비공개'));
    expect(document.body.innerHTML).not.toMatch(sealRe);
    // 비공개 → 공개는 막혀 있지 않다(공개 → 비공개만 불가)
    await tap(btn('공개'));
    expect(document.querySelector('.gu-cluecard-seal-num')?.textContent).toBe(String(seal));
    expect(bodyText()).toContain(`인장 ${seal} — 방장에게 불러 주면 공용 보드에 그대로 올라가오`);
    expect(document.querySelector('.gu-toast')?.textContent).toContain(guideText.sealToast(seal));
    expect(guideText.sealToast(seal)).toMatch(new RegExp(`^공개했소 — 인장 ${seal}[을를] 방장에게 불러 주고, 소리 내어 읽으시오$`));
    // 다음 라운드 고르기: 지난 방문 꼬리표
    await syncTo(/^조사 2/);
    const tile = tiles('gu-place-tile').find((t) => t.textContent?.includes(place.name));
    expect(tile?.textContent).toContain('조사 1에 감');
  });

  it('방장 r2: R1·R2 인장은 받고(누가 밝혔소 → 보드), R3 인장은 틀린 번호와 같은 문구·DOM 으로 거절 · 중복은 새 자리만', async () => {
    const code = findCode(6, () => true);
    const n = 6;
    await hostRecover(code);
    await syncTo(/^조사 2/);
    await tap(btn(/토론 \d+분 시작/));
    expect(bodyText()).toContain(GUIDE.boardEmpty);
    const cards = placeCardsFor(c, n);
    const r1 = cards.find((x) => x.round === 1)!;
    const r2 = cards.find((x) => x.round === 2)!;
    const r3 = cards.find((x) => x.round === 3)!;
    const seals = sealTable(c, n, code);
    const used = new Set(seals.values());
    let wrong = 1000;
    while (used.has(wrong)) wrong++;

    await tap(btn(GUIDE.boardAdd));
    expect(within(dialog()).getByRole('heading', { name: GUIDE.keypadTitle })).toBeInTheDocument();
    await typeSeal(String(seals.get(r3.id)));
    const futureDom = dialog().innerHTML;
    expect(dialog().textContent).toContain(GUIDE.sealReject);
    await typeSeal(String(wrong));
    expect(dialog().innerHTML).toBe(futureDom); // 미래 라운드와 틀린 번호가 같은 DOM
    await typeSeal(String(seals.get(r1.id)));
    expect(dialog().textContent).toContain(GUIDE.sealWho);
    await tap(within(dialog()).getByRole('button', { name: '2' }));
    await tap(within(dialog()).getByRole('button', { name: GUIDE.sealPost }));
    const board = () => document.querySelector('section.gu-board')!;
    expect(board().textContent).toContain(`조사 1 · ${r1.placeName} · ${r1.id.replace(/[a-z]+$/, '')} ${r1.title}`);
    expect(board().textContent).toContain(r1.body.slice(0, 20));
    expect(board().textContent).toContain('2번 공개');
    expect(board().textContent).toContain(GUIDE.boardFooter);
    expect(bodyText()).toContain('공개 단서 보드 (1장)');
    // 중복 — 「이미 올린 단서요」 + 새 자리만
    await tap(btn(GUIDE.boardAdd));
    await typeSeal(String(seals.get(r1.id)));
    expect(dialog().textContent).toContain(GUIDE.sealDuplicate);
    expect(within(dialog()).getByRole('button', { name: '2' })).toBeDisabled();
    await tap(within(dialog()).getByRole('button', { name: '4' }));
    await tap(within(dialog()).getByRole('button', { name: GUIDE.sealPost }));
    expect(board().textContent).toContain('4번 공개');
    expect(bodyText()).toContain('공개 단서 보드 (1장)');
    // R2 카드 — 건너뛰기(자리 없이)
    await tap(btn(GUIDE.boardAdd));
    await typeSeal(String(seals.get(r2.id)));
    await tap(within(dialog()).getByRole('button', { name: GUIDE.sealSkip }));
    expect(bodyText()).toContain('공개 단서 보드 (2장)');
    // ↶ 로 되돌리기 → 「내리기」
    await tap(document.querySelector<HTMLElement>('.gu-header-iconbtn[aria-label="되돌리기"]'));
    expect(bodyText()).toContain('공개 단서 보드 (1장)');
    await tap(within(board() as HTMLElement).getByRole('button', { name: GUIDE.unpost }));
    expect(within(dialog()).getByText(GUIDE.unpostTitle)).toBeInTheDocument();
    await tap(within(dialog()).getByRole('button', { name: GUIDE.unpostOk }));
    expect(bodyText()).toContain('공개 단서 보드 (0장)');
    // 저장 JSON 엔 본문이 없다
    expect(window.localStorage.getItem('gu:game:v1')).not.toContain(r1.body.slice(0, 12));
  });

  it('3회 연속 오답 → 10초 잠금(닫았다 열어도 유지) → 풀린다', async () => {
    fakeAllTimers();
    const code = '7F3K5';
    const seals = sealTable(c, 5, code);
    const used = new Set(seals.values());
    const wrongs: number[] = [];
    for (let w = 1000; wrongs.length < 3; w++) if (!used.has(w)) wrongs.push(w);
    await hostRecover(code);
    await syncTo(/^조사 1/);
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(GUIDE.boardAdd));
    for (const w of wrongs) await typeSeal(String(w));
    expect(dialog().textContent).toContain(GUIDE.sealLocked);
    expect(within(dialog()).getByRole('button', { name: '1' })).toBeDisabled();
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await tap(btn(GUIDE.boardAdd));
    expect(within(dialog()).getByRole('button', { name: '1' })).toBeDisabled();
    await advance(10_100);
    expect(within(dialog()).getByRole('button', { name: '1' })).not.toBeDisabled();
    const r1 = placeCardsFor(c, 5).find((x) => x.round === 1)!;
    await typeSeal(String(seals.get(r1.id)));
    expect(dialog().textContent).toContain(GUIDE.sealWho);
  });

  it('인원별 교체 카드 HW-1b 는 보드에 HW-1 로 표시된다(교체 사실 비노출)', async () => {
    const code = findCode(4, () => true);
    const card = placeCardsFor(c, 4).find((x) => x.id === 'HW-1b')!;
    expect(card).toBeTruthy();
    await hostRecover(code);
    await syncTo(/^조사 1/);
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(GUIDE.boardAdd));
    await typeSeal(String(clueSeal(c, 4, code, 'HW-1b')));
    await tap(within(dialog()).getByRole('button', { name: GUIDE.sealSkip }));
    const text = document.querySelector('section.gu-board')!.textContent ?? '';
    expect(text).toContain(`HW-1 ${card.title}`);
    expect(text).not.toContain('HW-1b');
  });
});

// ═══════════════════════════════ R6 · R7 · M1 ═══════════════════════════════

describe('R6 최종 변론 3칸 틀', () => {
  it('무대·플레이어의 3칸 문자열이 같다 · 자기소개 뒤 변론 칩에 역할 아이콘', async () => {
    await hostRecover('7F3K5');
    await syncTo(/^최종 변론/);
    const stage = [...document.querySelectorAll('.gu-defframe-item')].map((e) => e.textContent?.replace(/^\d/, ''));
    expect(stage).toEqual([...GUIDE.defenseFrame]);
    expect(bodyText()).toContain(GUIDE.defenseCue);
    expect(document.querySelectorAll('.gu-defense-chip svg.gu-icon')).toHaveLength(5);
    cleanup();
    window.localStorage.clear();
    await joinAsPlayer('7F3K5', 3);
    await syncTo(/^최종 변론/);
    const player = [...document.querySelectorAll('.gu-defframe-item')].map((e) => e.textContent?.replace(/^\d/, ''));
    expect(player).toEqual(stage);
    expect(bodyText()).toContain('최종 변론 · 1번부터 1분씩');
  });
});

describe('R7 보너스 문항 정식 단계', () => {
  const prompts = (c.bonusQuestions ?? []).map((q) => q.prompt);

  it('지목 전 모든 단계 DOM 에 문항이 없다 · 플레이어 P8 은 지목 확정 뒤에만 · 방장 집계엔 details 없이 펼친 격자', async () => {
    expect(prompts.length).toBe(2);
    await joinAsPlayer('7F3K5', 2);
    for (const label of [/^사건 개요/, /^패 확인/, /^자기소개/, /^조사 1/, /^조사 2/, /^조사 3/, /^최종 변론/, /^지목/]) {
      await syncTo(label);
      for (const p of prompts) expect(document.body.innerHTML, String(label)).not.toContain(p);
    }
    await tap(tiles('gu-seatgrid-tile')[0]);
    for (const p of prompts) expect(document.body.innerHTML).not.toContain(p); // 고르기만 했을 땐 아직
    await tap(btn(/지목 확정/));
    for (const p of prompts) expect(document.body.innerHTML).not.toContain(p); // 확정만으론 아직 — 「보너스 문항 보기」로 열어야(연 뒤엔 지목 변경 불가)
    expect(btn(/지목 바꾸기/)).toBeTruthy();
    await tap(btn(/보너스 문항 보기/));
    await tap(within(dialog()).getByRole('button', { name: '열겠소' }));
    for (const p of prompts) expect(bodyText()).toContain(p);
    expect(bodyText()).toContain(GUIDE.bonusPlayerHead);
    expect(screen.queryByRole('button', { name: /지목 바꾸기/ })).toBeNull();
    cleanup();
    window.localStorage.clear();

    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^지목/);
    for (const p of prompts) expect(document.body.innerHTML).not.toContain(p);
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    for (const t of [2, 1, 2, 2]) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
    expect(document.querySelector('details.gu-bonus')).toBeNull();
    expect(document.querySelector('section.gu-bonus')).not.toBeNull();
    expect(bodyText()).toContain(GUIDE.bonusHostHead);
    expect(bodyText()).toContain(GUIDE.bonusHostGuide);
    expect(document.querySelectorAll('.gu-bonus-q')).toHaveLength(2);
    // Q1 → Q2 순서
    const html = document.body.innerHTML;
    expect(html.indexOf(prompts[0])).toBeLessThan(html.indexOf(prompts[1]));
    // 0개 → 「보너스 없이 공개하겠소?」
    await tap(btn(/진상 공개/));
    expect(within(dialog()).getByText(GUIDE.bonusZeroTitle)).toBeInTheDocument();
    expect(dialog().textContent).toContain(GUIDE.bonusZeroBody);
    await tap(within(dialog()).getByRole('button', { name: '아직이오' }));
    // 하나라도 적으면 원래 확인
    await tap(screen.getAllByRole('button', { name: /^2번 / })[0]);
    await tap(btn(/진상 공개/));
    expect(within(dialog()).getByText('진상을 공개하겠소?')).toBeInTheDocument();
  });
});

describe('M1 문구 정정', () => {
  it('홈 「약 60분」 · 결과 「같은 사건, 다른 모임용 새 방 ›」 + 확인 시트', async () => {
    render(<GungApp />);
    await flush();
    expect(screen.getByText(GUIDE.homeMinutes)).toBeInTheDocument();
    expect(screen.queryByText('약 50분')).toBeNull();
    cleanup();
    await hostRecover('7F3K5');
    await syncTo(/^결과/);
    await tap(btn(GUIDE.sameCaseNewRoom));
    expect(within(dialog()).getByText(GUIDE.sameCaseTitle)).toBeInTheDocument();
    expect(dialog().textContent).toContain(GUIDE.sameCaseBody);
    expect(within(dialog()).getByRole('button', { name: GUIDE.sameCaseOk })).toBeInTheDocument();
    expect(screen.queryByText(/새 사건\(새 방\)/)).toBeNull();
  });
});
