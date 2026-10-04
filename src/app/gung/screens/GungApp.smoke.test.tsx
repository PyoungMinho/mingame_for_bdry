// @vitest-environment jsdom
/**
 * 런타임 스모크 + 프론트팀장 리뷰 회귀 테스트(QA팀의 정식 테스트 설계를 대신하지 않는다).
 *
 * 클릭 사이 시간: 진행 버튼은 600ms 재입력 무시(취객 더블탭 가드, §10-2)가 **단계를 넘어서도** 유지돼야 한다.
 * 그래서 사람처럼 누르는 tap() 은 Date 를 1초씩 앞으로 보낸 뒤 클릭하고, 더블탭 회귀 테스트는 시간을 멈춘 채 두 번 누른다.
 * (Date 만 가짜로 — setTimeout 등은 진짜라 컴포넌트 타이머 동작은 그대로다.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { assignFromCode } from '@/lib/gung';
import { sejaCase } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

// jsdom엔 scrollIntoView가 없다(RevealScroll이 두루마리 자동 스크롤에 쓴다) — 실제 브라우저에는 있다.
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

/** 사람 속도로 누르기 — 직전 탭과 1초 간격 */
async function tap(el: HTMLElement) {
  vi.setSystemTime(new Date(Date.now() + 1000));
  fireEvent.click(el);
  await flush();
}

const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const tiles = (cls: string) => screen.getAllByRole('button').filter((b) => b.className.includes(cls));

async function createRoom(n: 4 | 5 | 6) {
  render(<GungApp />);
  await flush();
  await tap(btn(/방 만들기/));
  await tap(btn(new RegExp(`${n}\\s*명`)));
  await tap(btn(/방 열기/));
  await tap(btn(/대기실로/));
}

/** 개선 묶음 1 G2: 방장 본인 조사는 무대가 아니라 단서함 「지금 고르기」로(무대엔 봉인 카드가 없다) */
async function hostPick(index = 0) {
  await tap(btn(/내 조사는 단서함에서/));
  const nows = screen.getAllByRole('button', { name: '지금 고르기' });
  await tap(nows[nows.length - 1]);
  const sheet = screen.getByRole('dialog');
  await tap(within(sheet).getAllByRole('button').filter((b) => b.className.includes('gu-place-tile'))[index]);
  await tap(within(sheet).getByRole('button', { name: /조사하기/ }));
}

/** 6판: 대기실 「사건 시작」은 1탭(확인 시트 없음) · 조사 라운드는 현장 보기부터 */
async function hostToRound1() {
  await tap(btn(/사건 시작/));
  await tap(btn(/다 읽었소/));
  await tap(btn(/다 봤소/));
  await tap(btn(/첫째 조사 시작/));
}

/** 현장 보기 → 장소 고르기(고르기 타이머가 저절로 돈다) */
async function sceneToSelect() {
  await tap(btn(/고르기 \d+분 시작/));
}

describe('GungApp 런타임 스모크', () => {
  it('홈 → 방 만들기(5인) → 초대 → 대기실 → 브리핑 → 패 확인 → 자기소개 → 조사1까지 크래시 없이 진행된다', async () => {
    render(<GungApp />);
    await flush();

    expect(await screen.findByText('세자 독살 사건')).toBeInTheDocument();
    await tap(btn(/방 만들기/));
    expect(screen.getByText('오늘 몇 명이오?')).toBeInTheDocument();
    await tap(btn(/5\s*명/));
    await tap(btn(/방 열기/));

    // S3 초대 — 사건 표식이 씨앗(4자)이 아니라 단어쌍이어야 한다
    expect(screen.getByText('방이 열렸소')).toBeInTheDocument();
    expect(screen.getByText(/사건 표식 「\S+ \S+」/)).toBeInTheDocument();
    await tap(btn(/대기실로/));

    // H1 대기실 — 6판: 표식 한 번에 외치기 · 진행표 · 롤콜이 덜 돼도 확인 시트 없이 바로 시작
    expect(screen.getByText('오늘의 순서')).toBeInTheDocument();
    expect(screen.getByText(/약 3\d분/)).toBeInTheDocument();
    await tap(btn(/사건 시작/));
    expect(screen.queryByRole('dialog')).toBeNull();

    // H2 브리핑
    await tap(btn(/다 읽었소/));
    // H3 패 확인 — 6판: 자기소개 건너뛰기는 ⋮ 메뉴로 옮겼다
    expect(screen.queryByRole('button', { name: /자기소개 건너뛰기/ })).toBeNull();
    await tap(btn('메뉴'));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: '자기소개 건너뛰기' })).toBeInTheDocument();
    await tap(within(screen.getByRole('dialog')).getByRole('button', { name: '닫기' }));
    await tap(btn(/다 봤소/));

    // H4 자기소개 — 6판: 「다음 사람」 없음
    expect(screen.queryByRole('button', { name: /다음 사람/ })).toBeNull();
    await tap(btn(/첫째 조사 시작/));

    // H5a 조사1 현장 보기 — 무대엔 봉인 카드가 없고(방장 조사는 단서함), 고르기 타이머는 현장 → 고르기 전진 때 저절로 돈다
    expect(screen.getByRole('heading', { name: /조사 1 · 현장 보기/ })).toBeInTheDocument();
    expect(document.querySelectorAll('.gu-sealed')).toHaveLength(0);
    expect(tiles('gu-place-tile')).toHaveLength(0);
    await sceneToSelect();
    expect(screen.getByRole('heading', { name: /조사 1 · 장소 고르기/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /고르기 \d+분 시작/ })).toBeNull();
    await hostPick(0);

    // 장소를 고르면 단서함에 ClueCard(봉인)
    expect(screen.getByText(/꾹 누르고 있으면 보여요/)).toBeInTheDocument();

    await tap(btn('진행'));
    await tap(btn(/토론 \d+분 시작/));
    expect(screen.getByRole('heading', { name: /조사 1 · 토론/ })).toBeInTheDocument();

    // 탭 전환 — 내 패 / 단서함도 크래시 없이 뜬다
    await tap(btn(/내 패/));
    expect(screen.getByRole('tablist', { name: '내 패 섹션' })).toBeInTheDocument();
    await tap(btn(/단서함/));
    await tap(btn('진행'));
    expect(screen.getByRole('heading', { name: /조사 1 · 토론/ })).toBeInTheDocument();
  });

  it('플레이어: 코드로 참가 → 자리 고르기 → 대기 화면까지 크래시 없이 진행된다', async () => {
    const { unmount } = render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    await tap(btn(/6\s*명/));
    await tap(btn(/방 열기/));
    const saved = JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null');
    expect(saved?.code).toBeTruthy();
    const code: string = saved.code;
    unmount();
    window.localStorage.removeItem('gu:game:v1');

    render(<GungApp />);
    await flush();
    await tap(btn(/코드로 참가하기/));
    for (let i = 0; i < code.length; i++) {
      const input = screen.getByLabelText(i === 4 ? '인원 수' : new RegExp(`${i + 1}번째 글자`));
      fireEvent.change(input, { target: { value: code[i] } });
    }
    await flush();

    // S5 랜딩
    expect(await screen.findByText(/입장하기/)).toBeInTheDocument();
    await tap(btn(/입장하기/));

    // S6 자리 고르기 — 2번 자리를 고른다
    const seatButtons = tiles('gu-seat-node');
    expect(seatButtons.length).toBe(6);
    await tap(seatButtons.find((b) => b.textContent?.startsWith('2'))!);
    await tap(btn(/자리에 앉기/));

    // P1 대기 — 사건 표식이 보인다
    expect(screen.getByText(/2번 자리로 들었소/)).toBeInTheDocument();
    expect(screen.getByText(/사건 표식/)).toBeInTheDocument();
  });

  it('방장: 4인 전체 플레이(조사3·최종변론·지목·진상·결과)까지 크래시 없이 끝까지 간다', async () => {
    await createRoom(4);
    await hostToRound1();

    for (const label of [/둘째 조사 시작/, /셋째 조사 시작/, /최종 변론으로/]) {
      await sceneToSelect();
      await hostPick(0);
      await tap(btn('진행'));
      await tap(btn(/토론 \d+분 시작/));
      await tap(btn(label));
    }

    // H7 최종 변론 — "다음 사람" 세 번, 그다음 "지목하러"
    for (let i = 0; i < 3; i++) await tap(btn(/다음 사람/));
    await tap(btn(/지목하러/));

    // H8 준비 → 카운트다운(건너뛰기) → 스테퍼
    await tap(btn(/셋 세기 시작/));
    await tap(btn(/건너뛰기/));
    for (let i = 0; i < 4; i++) await tap(tiles('gu-seatgrid-tile')[0]);

    // H8 집계 — 1→2, 2·3·4→1 이라 단독 1위(1번). 표 목록과 최다 지목 줄이 보인다
    expect(screen.getByText(/최다 지목:/)).toBeInTheDocument();
    // 6판: 보너스 0개 확인 시트 대신 인라인 경고 · 진상 공개는 1탭
    expect(screen.getByText('보너스 없이 가면 점수 없이 셈하오')).toBeInTheDocument();
    await tap(btn(/진상 공개/));
    expect(screen.queryByRole('dialog')).toBeNull();

    // H9 진상 — "다음 (k/N)"/"점수 보기"를 끝까지
    for (let i = 0; i < 30; i++) {
      const next = screen.queryByRole('button', { name: /^(다음|점수 보기)/ });
      if (!next) break;
      await tap(next);
    }

    // H10 결과 — 미션 판정 세그가 역할마다 있다(구술 판정 미션)
    expect(screen.getByText(/범인 검거|범인 도주/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '성공' }).length).toBeGreaterThan(0);
    await tap(btn(/처음으로/));
    await tap(within(screen.getByRole('dialog')).getByRole('button', { name: /처음으로/ }));
    expect(screen.getByText('세자 독살 사건')).toBeInTheDocument();
    // 지운 게임의 '이어하기'가 남아 있으면 안 된다
    expect(screen.queryByRole('button', { name: /이어하기/ })).toBeNull();
  });
});

describe('리뷰 회귀', () => {
  it('진행 버튼 더블탭(600ms 이내)은 한 단계만 전진한다', async () => {
    await createRoom(4);
    await tap(btn(/사건 시작/));
    // 브리핑에서 "다 읽었소"를 같은 시각에 두 번 — 두 번째는 '다 봤소'(같은 자리)로 새면 안 된다
    const b = btn(/다 읽었소/);
    vi.setSystemTime(new Date(Date.now() + 1000));
    fireEvent.click(b);
    await flush();
    fireEvent.click(screen.getByRole('button', { name: /다 봤소/ }));
    await flush();
    expect(screen.getByRole('heading', { name: /패 확인/ })).toBeInTheDocument();
  });

  it('단서 카드는 처음 열 때(openClue 저장) 닫히지 않고 손을 뗄 때까지 열려 있다', async () => {
    await createRoom(4);
    await hostToRound1();
    await sceneToSelect();
    await hostPick(0);
    const surface = screen.getByRole('button', { name: /단서 — 비밀 정보/ });
    expect(surface.textContent).not.toMatch(/손을 떼면/);
    fireEvent.pointerDown(surface, { pointerId: 1 });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 450));
    });
    // 열림 + openClue 저장 이후에도 같은 카드가 열린 채여야 한다
    expect(screen.getByText(/손을 떼면 바로 가려져요/)).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null');
    expect(saved.rounds['1'].opened).toBe(true);
    fireEvent.pointerUp(surface, { pointerId: 1 });
    await flush();
    expect(screen.queryByText(/손을 떼면 바로 가려져요/)).toBeNull();
  });

  it('방을 만들면 주소창에 ?code= 가 실려 새로고침이 홈이 아니라 자동 복원으로 간다', async () => {
    await createRoom(4);
    const code = JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null').code as string;
    expect(window.location.search).toBe(`?code=${code}`);
  });

  it('새로고침 복원 시 이어하는 중 토스트가 뜨고 봉인은 닫혀 있다', async () => {
    await createRoom(5);
    const code = JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null').code as string;
    cleanup();
    search = `code=${code}`;
    render(<GungApp />);
    await flush();
    expect(screen.getByText(/이어하는 중 · 1번 자리/)).toBeInTheDocument();
  });

  it('플레이어: 지목 확정 후 진상 게이트는 1탭(6판 — 대기 화면은 범인을 안 보인다), 범인 보기는 확인 시트를 거쳐 P9·P10', async () => {
    // 고정 코드 + 범인이 아닌 자리(결정론 — 같은 코드면 매번 같은 배정)
    const code = '7F3K5';
    const a = assignFromCode(sejaCase, code)!;
    const mySeat = [2, 3, 4, 5].find((s) => s !== a.culpritSeat)!;
    search = `code=${code}`;
    render(<GungApp />);
    await flush();
    await tap(btn(/입장하기/));
    await tap(tiles('gu-seat-node').find((b) => b.textContent?.startsWith(String(mySeat)))!);
    await tap(btn(/자리에 앉기/));

    // O1 로 지목 단계까지(두 단계 이상 → 확인 시트)
    await tap(screen.getByRole('button', { name: /진행 단계/ }));
    await tap(screen.getByRole('radio', { name: /^지목/ }));
    await tap(btn(/^이동/));
    await tap(within(screen.getByRole('dialog')).getByRole('button', { name: /가겠소/ }));

    // P8 — 2탭: 선택 → 확정
    const seatTiles = tiles('gu-seatgrid-tile');
    expect(seatTiles.some((t) => t.textContent?.startsWith(String(mySeat)))).toBe(false); // 내 자리는 없다
    await tap(seatTiles[0]);
    await tap(btn(/지목 확정/));
    expect(screen.getByText('나의 지목')).toBeInTheDocument();

    await tap(btn(/진상 공개 시작됐어요/));
    expect(screen.queryByRole('dialog')).toBeNull();
    // G5 P9-0 — 대기 화면: 범인 없음. 방장 「범인이 밝혀졌소」 뒤 확인 시트를 거쳐야 P9
    expect(screen.queryByText(new RegExp(`${a.culpritSeat}번 · `))).toBeNull();
    await tap(btn(/범인이 밝혀졌어요/));
    await tap(within(screen.getByRole('dialog')).getByRole('button', { name: '보겠소' }));
    // P9 — 빈 화면이 아니라 진상 전문 + 내 지목 칩
    expect(screen.getAllByText('그날 밤의 진상').length).toBeGreaterThan(0);
    expect(screen.getByText(/내 지목:/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${a.culpritSeat}번 · `))).toBeInTheDocument();
    await tap(btn(/모두의 패 보기/));
    expect(screen.getByText('모두의 패')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: false }).length + screen.getAllByRole('button', { expanded: true }).length).toBe(5);
  });
});
