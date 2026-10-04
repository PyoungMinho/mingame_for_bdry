// @vitest-environment jsdom
/**
 * QA 'PM 결정 필요' 항목·남은 P3 — 결정한 동작을 화면에서 고정한다(docs/qa/gung-bug-report.md '결정').
 *
 *  - BUG-28: 패 확인 3분(원고 1-8 ②) · 동률자 30초 추가 변론(원고 8-1)
 *  - SCR-10: MVP 호칭 = 명판관(원고 8-4)
 *  - 판결 화면 결말 → 요약(원고 7-2 ④→⑤) — 방장 판결 비트 · 플레이어 P9
 *  - BUG-12: S2 인원별 등장인물 목록 없음(원고 1-3)
 *  - BUG-27: 용어 「?」(기본 용어 + 공용 카드 용어) · 카드 연동 용어는 카드 봉인 속 · 역할 용어는 내 패 봉인 속 · 시각표(원고 1-5·1-6)
 *  - BUG-21: 셋업 화면 하드웨어 뒤로 = 이전 셋업 단계(§12-4)
 *  - BUG-23: 늦게 온 사람 → O1 자동 오픈(§2-E)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode, getClue, GUIDE, roundPlaces, SEED_ALPHABET, seatOfRole, type PlayerCount } from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  search = '';
  window.localStorage.clear();
  window.history.replaceState(null, '', '/gung');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T21:00:00+09:00'));
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
async function back() {
  await act(async () => {
    window.dispatchEvent(new PopStateEvent('popstate'));
    await Promise.resolve();
  });
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const qbtn = (name: RegExp | string) => screen.queryByRole('button', { name });
const dialog = () => screen.getByRole('dialog');
const bodyText = () => document.body.textContent ?? '';
const saved = () => JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null');
const tiles = (cls: string) => screen.getAllByRole('button').filter((b) => b.className.includes(cls));

function findCode(n: PlayerCount, pred: (code: string) => boolean): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[i % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 7) % 31]}${A[(i * 11 + 5) % 31]}${n}`;
    if (pred(code)) return code;
  }
  throw new Error('no code');
}
const asg = (code: string) => assignFromCode(c, code)!;

async function hostRecover(code: string) {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
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
async function dismissPeekTip() {
  const ok = qbtn('알겠소');
  if (ok) await tap(ok);
}
/** 방장 지목: 셋 세기 건너뛰고 자리 순으로 표를 넣는다 */
async function hostVotes(targets: number[]) {
  await tap(btn(/셋 세기 시작/));
  await tap(btn('건너뛰기'));
  for (const t of targets) await tap(screen.getByRole('button', { name: new RegExp(`^${t}번`) }));
}

describe('BUG-28 결정 — 패 확인(6판: 2분 — UX 스펙 §2-3이 3분 결정을 대체) · 동률 변론 30초', () => {
  it('H3 패 확인: 브리핑에서 넘어오면 2분 카운트다운이 바로 돈다 · 단계 맞추기로 왔으면 시작 버튼 · 안내 불릿·건너뛰기 링크 없음', async () => {
    await hostRecover(findCode(5, () => true));
    await syncTo(/^사건 개요/, false);
    await tap(btn(/다 읽었소/));
    expect(screen.getByText('02:00')).toBeInTheDocument();
    expect(qbtn(/자기소개 건너뛰기/)).toBeNull(); // ⋮ 메뉴로 옮겼다
    expect(document.querySelector('.gu-plainlist')).toBeNull();
    await tap(within(screen.getByRole('banner')).getByRole('button', { name: '되돌리기' }));
    await syncTo(/^패 확인/);
    await tap(btn(/패 확인 2분 타이머 시작/));
    expect(screen.getByText('02:00')).toBeInTheDocument();
  });

  it('H8 동률: 동률자 추가 변론 30초 타이머(다음 사람 다시) → 재지목 시작하면 사라진다 · 동률이 아니면 없다', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 3);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await hostVotes([2, 1, 2, 1]); // 1·2 동률
    expect(screen.getByText(/동률자 추가 변론/)).toBeInTheDocument();
    expect(qbtn(/다음 사람 30초/)).toBeNull();
    await tap(btn(/동률 변론 30초 타이머 시작/));
    expect(screen.getByText('00:30')).toBeInTheDocument();
    expect(saved().host.timer).toMatchObject({ kind: 'tie', totalMs: 30_000 });
    vi.setSystemTime(new Date(Date.now() + 29_000));
    await tap(btn(/다음 사람 30초 다시/));
    expect(saved().host.timer.endsAt - Date.now()).toBe(30_000);
    await tap(btn(/재지목 시작/));
    expect(screen.queryByText(/동률자 추가 변론/)).toBeNull();
    expect(saved().host.timer).toBeNull();
    // 단독 1위면 동률 변론 칸이 없다
    cleanup();
    window.localStorage.clear();
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await hostVotes([3, 3, 1, 3]);
    expect(screen.queryByText(/동률자 추가 변론/)).toBeNull();
  });
});

describe('SCR-10 명판관 · 결말 → 요약(원고 7-2)', () => {
  it('방장: 판결 비트에서 결말이 요약보다 먼저, 결과 화면 MVP 는 「오늘의 명판관」', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 2);
    await hostRecover(code);
    await syncTo(/^지목/, false);
    await hostVotes([2, 1, 2, 2]); // 2번(범인) 검거
    // 6판: 진상 공개는 1탭 — 보너스를 하나도 안 적었으면 버튼 위 인라인 경고만
    expect(bodyText()).toContain(GUIDE.bonusZeroInline);
    await tap(btn(/진상 공개/));
    expect(screen.queryByRole('dialog')).toBeNull();
    for (let i = 0; i < 30 && !screen.queryByRole('img', { name: /도장: (검거|도주|미결)/ }); i++) await tap(btn(/^다음/));
    expect(screen.getByRole('img', { name: '도장: 검거' })).toBeInTheDocument();
    const text = bodyText();
    const ep = text.indexOf(c.truth.epilogue!.slice(0, 20));
    const sum = text.indexOf(c.truth.summary!.slice(0, 20));
    expect(ep).toBeGreaterThan(-1);
    expect(sum).toBeGreaterThan(ep);
    await tap(btn(/점수 보기/));
    expect(screen.getByText(/오늘의 명판관/)).toBeInTheDocument();
    expect(bodyText()).not.toContain('명탐정');
  });

  it('플레이어 P9(6판): 결론(⑤ 요약)만 펼치고, 비트·자백·④ 결말은 「진상 전문 ▸」 접힘 — 결론 ≤ 200자', async () => {
    const code = findCode(4, (k) => asg(k).culpritSeat !== 2);
    await joinAsPlayer(code, 2);
    await syncTo(/^진상 공개/);
    // G5: 진상 대기 → 방장 「범인이 밝혀졌소」 → 확인 시트 → P9
    await tap(btn(/범인이 밝혀졌어요/));
    await tap(within(dialog()).getByRole('button', { name: '보겠소' }));
    const full = document.querySelector<HTMLDetailsElement>('details.gu-ptruth-full')!;
    expect(full).not.toBeNull();
    expect(full.open).toBe(false);
    expect(full.querySelector('summary')?.textContent).toBe(GUIDE.truthFullFold);
    expect(full.textContent).toContain(c.truth.epilogue!.slice(0, 20));
    expect(full.textContent).toContain(c.truth.confession.slice(0, 20));
    expect(full.textContent).not.toContain(c.truth.summary!.slice(0, 20));
    const outside = bodyText().replace(full.textContent ?? '', '');
    expect(outside).toContain(c.truth.summary!);
    expect(Array.from(c.truth.summary!).length).toBeLessThanOrEqual(200);
  });
});

describe('BUG-12 결정 — S2 인원별 등장인물 목록 없음(원고 1-3)', () => {
  it('4·5·6명을 눌러 봐도 역할 이름·구성 목록이 뜨지 않는다', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    for (const n of [4, 5, 6, 4]) {
      await tap(btn(new RegExp(`${n}\\s*명`)));
      expect(bodyText()).not.toMatch(/등장인물|중전|숙의|내관|어의|조상궁|세자빈|상궁/);
    }
  });
});

describe('BUG-27 결정 — 용어 「?」·시각표', () => {
  it('헤더 「?」 시트: 시각표 + 기본 용어 + 들어선 라운드 공용 카드 용어 · 역할 전용 용어(활맥)는 없다 · 브리핑 화면의 「배치도 · 시각표 ›」도 같은 시트', async () => {
    const code = findCode(6, (k) => seatOfRole(asg(k), 'physician') === 1); // 방장 = 어의(역할 용어 보유)
    await hostRecover(code);
    await syncTo(/^사건 개요/, false);
    // 6판: 시각표는 개요 화면에 상시로 두지 않고 링크 한 줄 → 「?」 시트
    expect(screen.queryByRole('region', { name: '시각표' })).toBeNull();
    await tap(btn(GUIDE.helpLink));
    expect(within(dialog()).getByRole('region', { name: '시각표' })).toBeInTheDocument();
    expect(dialog().textContent).toContain('19~21시');
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await syncTo(/^조사 1/);
    await tap(btn('궁 배치도·시각표·인물·용어'));
    const sheet = dialog().textContent ?? '';
    expect(sheet).toContain('술시');
    expect(sheet).toContain('19~21시');
    const glossary = c.glossary ?? [];
    for (const id of c.baseTerms ?? []) expect(sheet).toContain(glossary.find((g) => g.id === id)!.term);
    for (const id of (c.rounds[0].publicCards ?? []).flatMap((p) => p.terms ?? [])) expect(sheet).toContain(glossary.find((g) => g.id === id)!.term);
    expect(sheet).not.toContain('활맥');
  });

  it('장소 카드 용어는 그 카드를 연 동안만(봉인 속), 역할 용어(활맥)는 내 패 비밀 봉인 속에만', async () => {
    const code = findCode(5, (k) => (seatOfRole(asg(k), 'physician') ?? 1) >= 2);
    const seat = seatOfRole(asg(code), 'physician')!;
    const a = asg(code);
    const places = roundPlaces(c, 1);
    const idx = places.findIndex((p) => (getClue(c, a, 1, p.id, seat)?.terms.length ?? 0) > 0);
    expect(idx).toBeGreaterThanOrEqual(0);
    const term = getClue(c, a, 1, places[idx].id, seat)!.terms[0].term;
    await joinAsPlayer(code, seat);
    await syncTo(/^조사 1/);
    await dismissPeekTip();
    await tap(tiles('gu-place-tile')[idx]);
    await tap(btn(/조사하기/));
    expect(bodyText()).not.toContain(term); // 봉인 중
    const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
    // 쪽 나눔 폐지 — 한 번 열면 전문이 다 보인다(더는 '다음 쪽'으로 찾아다니지 않는다)
    fireEvent.keyDown(surface, { key: 'Enter' });
    await flush();
    const found = bodyText().includes(term);
    expect(found).toBe(true);
    fireEvent.keyUp(surface, { key: 'Enter' });
    await flush();
    expect(bodyText()).not.toContain(term);

    // 용어 시트엔 활맥이 없고, 내 패 › 비밀(봉인 속)엔 있다
    await tap(btn('궁 배치도·시각표·인물·용어'));
    expect(dialog().textContent).not.toContain('활맥');
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await tap(btn('내 패'));
    await dismissPeekTip();
    await tap(screen.getByRole('tab', { name: '비밀' }));
    expect(bodyText()).not.toContain('활맥');
    const card = screen.getByRole('button', { name: /자리의 패 — 비밀 정보/ });
    // 쪽 나눔 폐지 — 비밀 섹션을 한 번 열면 역할 용어(활맥)까지 전부 같은 화면에 보인다
    fireEvent.keyDown(card, { key: 'Enter' });
    await flush();
    const seen = card.textContent ?? '';
    fireEvent.keyUp(card, { key: 'Enter' });
    await flush();
    expect(seen).toContain('활맥');
  });
});

describe('BUG-21 셋업 화면 하드웨어 뒤로 = 이전 셋업 단계(§12-4)', () => {
  it('방 만들기 → 뒤로 = 홈 · 코드 입력 → 뒤로 = 홈', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    expect(screen.getByText('오늘 몇 명이오?')).toBeInTheDocument();
    await back();
    expect(btn(/코드로 참가하기/)).toBeInTheDocument();
    await tap(btn(/코드로 참가하기/));
    expect(screen.getByText(/방장에게 받은 코드를 넣으시오/)).toBeInTheDocument();
    await back();
    expect(btn(/방 만들기/)).toBeInTheDocument();
  });

  it('초대 링크: 자리 고르기 → 뒤로 = 랜딩 → 뒤로 = 홈 · 셋업에서 연 시트는 뒤로로 먼저 닫힌다', async () => {
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    await tap(btn(/하는 법 ›/));
    expect(dialog()).toBeInTheDocument();
    await back();
    expect(screen.queryByRole('dialog')).toBeNull();
    await tap(btn(/입장하기/));
    expect(screen.getByText('나는 몇 번 자리요?')).toBeInTheDocument();
    await back();
    expect(btn(/입장하기/)).toBeInTheDocument();
    await back();
    expect(btn(/방 만들기/)).toBeInTheDocument();
  });
});

describe('BUG-23 늦게 온 사람 — O1 자동 오픈(§2-E)', () => {
  it('자리 고르기에서 「늦게 왔으면」 → 앉자마자 진행 단계 맞추기 시트 → 조사 2 로(조사 진입 확인)', async () => {
    search = 'code=7F3K5';
    render(<GungApp />);
    await flush();
    await tap(btn(/입장하기/));
    expect(qbtn(/늦게 왔으면/)).toBeNull(); // 자리를 고르기 전엔 없다
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith('3'))!);
    await tap(btn(/늦게 왔으면/));
    expect(within(dialog()).getByText(/지금 어디까지 왔소/)).toBeInTheDocument();
    expect(saved().seat).toBe(3);
    await syncTo(/^조사 2/, false);
    expect(saved().phase).toBe('r2');
  });

  it('제때 온 사람(「자리에 앉기」)은 시트 없이 대기 화면', async () => {
    await joinAsPlayer('7F3K5', 3);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(/3번 자리로 들었소/)).toBeInTheDocument();
  });
});
