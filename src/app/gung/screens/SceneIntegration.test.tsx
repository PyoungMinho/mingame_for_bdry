// @vitest-environment jsdom
/**
 * 현장 통합(7판 조사 따로 · 프론트팀장) — 실제 GungApp 흐름에 「이동은 다 같이, 살펴보기는 각자」가 제자리에 붙었는지.
 *
 *  - 방장 무대(현장 보기): 맨 위 이동 연출(SceneMove — 장소 그림·이름·이동 한 줄·「각자 폰에서 물건 둘을 살펴보시오」) → 공용 단서.
 *    물건 이름표·관찰 글은 무대 어디에도 없다. 방장 본인 살펴보기는 단서함 「지금 고르기」 시트에서(무대엔 안 뜬다).
 *  - 플레이어: 조사 화면 맨 위 살펴보기(그 조사 이동 장소 그림 + 물건 5) → 라운드당 2번 · 본 관찰은 탭해 보기 + 자동 가림 ·
 *    2번 쓰면 잠금 · 장소를 고르면 마감 · 새로고침 유지 · 단서함 「내가 본 관찰」.
 *  - 큰 화면: 방장 ⋮ 메뉴·S3 초대 화면 → /gung/scene?code=… 주소 시트. 홈에는 /gung/scene 링크.
 *  - 처음으로 → 큰 화면 조사 칩 기록(gu:scene:v2 · 옛 v1)도 지운다.
 *
 * 규약은 기존 화면 테스트와 같다(Date 만 가짜, 사람 탭 = 1초 간격, 실데이터 + 결정론 코드).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GUIDE, guideText, sceneStop } from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';
import { LEGACY_SCENE_STORE_KEY, SCENE_STORE_KEY } from '../lib/sceneStore';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const START = new Date('2026-10-04T21:00:00+09:00');
const CODE = '7F3K5';

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
async function tap(el: Element | null | undefined) {
  if (!el) throw new Error('tap: element not found');
  vi.setSystemTime(new Date(Date.now() + 1000));
  fireEvent.click(el);
  await flush();
}
const btn = (name: RegExp | string) => screen.getByRole('button', { name });
const qbtn = (name: RegExp | string) => screen.queryByRole('button', { name });
const dialog = () => screen.getByRole('dialog');
const qdialog = () => screen.queryByRole('dialog');
const bodyText = () => document.body.textContent ?? '';
const tiles = (cls: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(`button.${cls}`));

const LINES = (c.scenes ?? []).flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id }))));
/** 화면은 「의관: …」을 <b>의관</b> … 로 그리므로 말한 이를 떼고 앞 10자로 찾는다 */
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const lineOf = (id: string, round: number) => probe(LINES.find((l) => l.objectId === id && l.fromRound === round)!.text);
const ALL_PROBES = LINES.map((l) => probe(l.text));
/** 관찰 글이 하나도 없다(속성 포함) */
function expectNoObservation(root: Element, where: string) {
  const html = root.innerHTML;
  for (const p of ALL_PROBES) expect(html.includes(p), `${where}: 관찰 「${p}」`).toBe(false);
}

async function dismissPeekTip() {
  const d = qdialog();
  if (d && d.getAttribute('aria-label') === '몰래 보는 법') await tap(within(d).getByRole('button', { name: '알겠소' }));
}
async function hostRecover(code: string) {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
  await tap(within(dialog()).getByRole('button', { name: '취소' }));
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
/** 방장 — 자기소개에서 「첫째 조사 시작」 → 조사 1 현장 보기 */
async function hostToRound1Scene() {
  await hostRecover(CODE);
  await syncTo(/^자기소개/);
  await tap(btn(/첫째 조사 시작/));
  expect(screen.getByRole('heading', { name: /조사 1 · 현장 보기/ })).toBeInTheDocument();
}
const hostSlot = () => document.querySelector<HTMLElement>('[data-scene-slot="host"]');
const panel = (root: ParentNode = document) => root.querySelector<HTMLElement>('section.gu-examine');
const spot = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`button.gu-scene-spot[data-obj="${id}"]`);
/** 물건을 고르고 「살펴보기 (N번 남음)」 */
async function examine(root: () => ParentNode, id: string) {
  await tap(spot(root(), id));
  await tap(within(panel(root())!).getByRole('button', { name: /^살펴보기 \(\d번 남음\)/ }));
}

describe('방장 — 현장 보기 무대 = 이동 연출(관찰 없음)', () => {
  it('맨 위 이동 연출(그림·장소 이름·이동 한 줄·살펴보기 안내) → 공용 단서 · 물건 이름표·관찰 글 0', async () => {
    await hostToRound1Scene();
    const slot = hostSlot()!;
    const stop = sceneStop(c, 1)!;
    expect(slot.querySelector(`svg.gu-scene-art[data-art="${stop.art}"]`)).not.toBeNull();
    expect(slot.querySelectorAll('button.gu-scene-spot')).toHaveLength(0);
    expect(slot.textContent).toContain('조사 1 · 이동');
    expect(slot.textContent).toContain('동궁전');
    expect(slot.textContent).toContain(stop.cue);
    expect(slot.textContent).toContain(guideText.examineCue(2));
    // 이동 연출이 공용 단서(낭독)보다 앞
    const board = document.querySelector('.gu-publicclue')!;
    expect(board).not.toBeNull();
    expect(slot.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bodyText()).toContain(GUIDE.sceneCue);
    // 방장 무대엔 관찰 글·살펴보기 패널이 없다(조사 1·2·3 어느 줄도)
    expectNoObservation(document.body, '방장 조사 1 현장');
    expect(panel()).toBeNull();
    // 방장 본인 살펴보기·조사는 단서함으로
    expect(btn(GUIDE.hostOwnClueLink)).toBeInTheDocument();
  });

  it('방장 본인 살펴보기 = 단서함 「지금 고르기」 시트(물건 둘) — 본 관찰은 시트·단서함에만, 무대엔 0', async () => {
    await hostToRound1Scene();
    await tap(btn(GUIDE.hostOwnClueLink));
    expect(bodyText()).toContain(`${GUIDE.examineHead} ${guideText.examineLeft(2, 2)}`);
    await tap(btn('지금 고르기'));
    const d = () => dialog();
    expect(d().getAttribute('aria-label')).toBe('조사 1 · 지금 고르기');
    expect(tiles('gu-scene-spot', d())).toHaveLength(5);
    await examine(d, 'OB-DG1');
    expect(d().textContent).toContain(lineOf('OB-DG1', 1));
    await examine(d, 'OB-DG5');
    expect(panel(d())!.dataset.left).toBe('0');
    // 시트에서 장소를 고르면 닫히고, 단서함에 「내가 본 관찰 · 조사 1」(가려진 채)
    await tap(tiles('gu-place-tile', d())[0]);
    await tap(within(d()).getByRole('button', { name: /조사하기/ }));
    expect(qdialog()).toBeNull();
    const mine = screen.getByRole('region', { name: `${GUIDE.obsHead} · 조사 1` });
    expect(mine.querySelectorAll('.gu-obs')).toHaveLength(2);
    expectNoObservation(mine, '단서함(가려짐)');
    // 진행 무대로 돌아가면 관찰 0
    await tap(btn('진행'));
    expectNoObservation(document.body, '방장 무대(살펴본 뒤)');
  });

  it('고르기·토론 무대엔 그림 없음 → 조사 2 현장 = 내의원 이동 · 조사 3 = 동궁전(다시)', async () => {
    await hostToRound1Scene();
    await tap(btn(/고르기 \d+분 시작/));
    expect(document.querySelector('svg.gu-scene-art')).toBeNull();
    expect(hostSlot()).toBeNull();
    await tap(btn(/토론 \d+분 시작/));
    expect(document.querySelector('svg.gu-scene-art')).toBeNull();
    await tap(btn(/둘째 조사 시작/));
    expect(screen.getByRole('heading', { name: /조사 2 · 현장 보기/ })).toBeInTheDocument();
    expect(hostSlot()!.textContent).toContain('내의원');
    expect(hostSlot()!.textContent).toContain(sceneStop(c, 2)!.cue);
    expect(hostSlot()!.querySelector('svg.gu-scene-art[data-art="scene-ny"]')).not.toBeNull();
    expectNoObservation(document.body, '방장 조사 2 현장');
    await tap(btn(/고르기 \d+분 시작/));
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(/셋째 조사 시작/));
    const ok = qbtn('알겠소');
    if (ok) await tap(ok);
    expect(hostSlot()!.textContent).toContain(sceneStop(c, 3)!.cue);
    expect(hostSlot()!.querySelector('svg.gu-scene-art[data-art="scene-dg"]')).not.toBeNull();
    expectNoObservation(document.body, '방장 조사 3 현장');
  });

  it('⋮ › 노트북·TV로 현장 보기 → /gung/scene?code=… 주소 · 복사', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await hostToRound1Scene();
    await tap(btn('메뉴'));
    await tap(btn(GUIDE.bigScreenMenu));
    const d = dialog();
    expect(d.getAttribute('aria-label')).toBe(GUIDE.bigScreenMenu);
    const url = within(d).getByTestId('bigscreen-url').textContent ?? '';
    expect(url).toMatch(new RegExp(`/gung/scene\\?code=${CODE}$`));
    await tap(within(d).getByRole('button', { name: GUIDE.bigScreenCopy }));
    await flush();
    expect(writeText).toHaveBeenCalledWith(url);
    expect(bodyText()).toContain(GUIDE.bigScreenCopied);
  });

  it('처음으로 → 큰 화면 조사 칩 기록(gu:scene:v2)·옛 본 물건 기록(v1)도 지운다', async () => {
    await hostToRound1Scene();
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify({ v: 2, code: CODE, at: Date.now(), round: 2, opened: 2 }));
    window.localStorage.setItem(LEGACY_SCENE_STORE_KEY, JSON.stringify({ v: 1, code: CODE, at: Date.now(), seen: ['OB-DG1@1'], round: 1, opened: 1 }));
    await tap(btn('메뉴'));
    await tap(btn('처음으로'));
    await tap(within(dialog()).getByRole('button', { name: '처음으로' }));
    expect(window.localStorage.getItem(SCENE_STORE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LEGACY_SCENE_STORE_KEY)).toBeNull();
  });
});

describe('플레이어 — 조사 화면 살펴보기(각자 폰, 라운드당 2번)', () => {
  it('맨 위 살펴보기(동궁전 그림 + 물건 5, 2/2) · 고르고 살펴보면 그 줄이 열린다 · 2번 쓰면 잠금 · 새로고침 유지', async () => {
    await joinAsPlayer(CODE, 2);
    await syncTo(/^조사 1/);
    const p = () => panel()!;
    expect(p()).not.toBeNull();
    expect(p().getAttribute('aria-label')).toBe(`${GUIDE.examineHead} · 동궁전`);
    expect(p().querySelector('svg.gu-scene-art[data-art="scene-dg"]')).not.toBeNull();
    expect(tiles('gu-scene-spot', p()).map((b) => b.dataset.obj)).toEqual(['OB-DG1', 'OB-DG2', 'OB-DG3', 'OB-DG4', 'OB-DG5']);
    expect(p().textContent).toContain(guideText.examineLeft(2, 2));
    expect(p().textContent).toContain(GUIDE.examineHint);
    // 살펴보기 패널이 공용 단서·장소 고르기보다 앞
    expect(p().compareDocumentPosition(document.querySelector('.gu-placehint')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bodyText()).toContain(GUIDE.examineCloseNote);
    expectNoObservation(document.body, '살펴보기 전');

    // 고르기만 하면 아직 안 쓴다(2탭) — 다시 누르면 고르기 취소
    await tap(spot(p(), 'OB-DG2'));
    expect(within(p()).getByRole('button', { name: /^살펴보기 \(2번 남음\)/ })).toBeInTheDocument();
    expect(p().textContent).toContain(GUIDE.examineOnce);
    await tap(spot(p(), 'OB-DG2'));
    expect(within(p()).queryByRole('button', { name: /^살펴보기/ })).toBeNull();

    await examine(() => document, 'OB-DG2');
    expect(p().dataset.left).toBe('1');
    const card = p().querySelector<HTMLElement>('.gu-obs[data-obj="OB-DG2"]')!;
    expect(card.hasAttribute('data-open')).toBe(true); // 방금 본 것은 바로 열린다
    expect(card.textContent).toContain(lineOf('OB-DG2', 1));
    expect(card.textContent).toContain(GUIDE.obsShowNote);
    expect(spot(p(), 'OB-DG2')!.hasAttribute('data-seen')).toBe(true);
    // 탭하면 가려진다(글은 DOM 에서 빠진다) · 다시 탭하면 열린다
    await tap(card);
    expect(p().querySelector('.gu-obs[data-obj="OB-DG2"]')!.hasAttribute('data-open')).toBe(false);
    expect(p().innerHTML).not.toContain(lineOf('OB-DG2', 1));
    // 본 물건 이름표를 다시 누르면 그 카드를 연다(횟수는 그대로)
    await tap(spot(p(), 'OB-DG2'));
    expect(p().querySelector('.gu-obs[data-obj="OB-DG2"]')!.hasAttribute('data-open')).toBe(true);
    expect(p().dataset.left).toBe('1');

    await examine(() => document, 'OB-DG4');
    expect(p().dataset.left).toBe('0');
    expect(p().textContent).toContain('0/2번 남음');
    expect(p().textContent).toContain(GUIDE.examineSpent);
    // 남은 물건은 잠긴다 — 눌러도 고를 수 없다
    for (const id of ['OB-DG1', 'OB-DG3', 'OB-DG5']) {
      expect(spot(p(), id)!.hasAttribute('data-locked'), id).toBe(true);
      await tap(spot(p(), id));
      expect(within(p()).queryByRole('button', { name: /^살펴보기/ })).toBeNull();
    }
    // 조사 1 엔 조사 3 줄이 없다(R3 에 같은 물건을 보면 열린다)
    for (const l of LINES.filter((x) => x.fromRound > 1)) expect(document.body.innerHTML).not.toContain(probe(l.text));

    // 새로고침 — 기록이 남는다(이 폰 게임 저장)
    expect(JSON.parse(window.localStorage.getItem('gu:game:v1')!).examined).toEqual({ 1: ['OB-DG2', 'OB-DG4'] });
    cleanup();
    search = `code=${CODE}`;
    render(<GungApp />);
    await flush();
    await dismissPeekTip();
    expect(panel()!.dataset.left).toBe('0');
    expect(tiles('gu-scene-spot', panel()!).filter((b) => b.hasAttribute('data-seen')).map((b) => b.dataset.obj)).toEqual(['OB-DG2', 'OB-DG4']);
    expectNoObservation(document.body, '새로고침 뒤(가려짐)');
  });

  it('장소를 고르면 남은 살펴보기는 마감 · 단서 아래와 단서함에 「내가 본 관찰」(가려진 채) · 조사 2 는 내의원', async () => {
    await joinAsPlayer(CODE, 3);
    await syncTo(/^조사 1/);
    await examine(() => document, 'OB-DG3');
    await tap(tiles('gu-place-tile')[1]);
    await tap(btn(/조사하기/));
    expect(panel()).toBeNull();
    const mine = screen.getByRole('region', { name: `${GUIDE.obsHead} · 조사 1` });
    expect(mine.querySelectorAll('.gu-obs')).toHaveLength(1);
    expect(mine.textContent).toContain('은숟가락');
    expect(mine.textContent).toContain(GUIDE.obsSealed);
    expectNoObservation(mine, '단서 아래(가려짐)');
    await tap(mine.querySelector('.gu-obs'));
    expect(mine.textContent).toContain(lineOf('OB-DG3', 1));
    // 단서함 — 같은 목록, 탭 전환에 가려진다
    await tap(btn(/^단서함/));
    const box = screen.getByRole('region', { name: `${GUIDE.obsHead} · 조사 1` });
    expectNoObservation(box, '단서함(탭 전환으로 가려짐)');
    await tap(box.querySelector('.gu-obs'));
    expect(box.textContent).toContain(lineOf('OB-DG3', 1));
    await tap(btn('지금'));
    // 조사 2 — 모두 내의원으로
    await tap(btn(/2라운드 시작됐어요/));
    await dismissPeekTip();
    expect(panel()!.getAttribute('aria-label')).toBe(`${GUIDE.examineHead} · 내의원`);
    expect(tiles('gu-scene-spot', panel()!).map((b) => b.dataset.obj)).toEqual(['OB-NY1', 'OB-NY2', 'OB-NY3', 'OB-NY4', 'OB-NY5']);
    expect(panel()!.dataset.left).toBe('2');
  });

  it('조사 3 동궁전(다시) — 조사 1 에 본 물건도 다시 고를 수 있고, 조사 1 줄 + 조사 3 줄이 함께 뜬다', async () => {
    await joinAsPlayer(CODE, 4);
    await syncTo(/^조사 3/);
    await examine(() => document, 'OB-DG1');
    const card = panel()!.querySelector<HTMLElement>('.gu-obs[data-obj="OB-DG1"]')!;
    expect(card.textContent).toContain(lineOf('OB-DG1', 1));
    expect(card.textContent).toContain(lineOf('OB-DG1', 3));
    expect(card.querySelectorAll('.gu-obs-line-round')).toHaveLength(2);
  });
});

describe('큰 화면 링크 — 홈 · 초대', () => {
  it('홈에 /gung/scene 링크', async () => {
    render(<GungApp />);
    await flush();
    const link = screen.getByRole('link', { name: new RegExp(GUIDE.bigScreenHomeLink.replace(' ›', '')) });
    expect(link.getAttribute('href')).toBe('/gung/scene');
  });

  it('S3 초대 화면 → 노트북·TV 주소 시트(그 방 코드)', async () => {
    render(<GungApp />);
    await flush();
    await tap(btn(/방 만들기/));
    await tap(tiles('gu-counttile').find((b) => b.textContent?.includes('5'))!);
    await tap(btn(/방 열기/));
    expect(screen.getByRole('heading', { name: '방이 열렸소' })).toBeInTheDocument();
    await tap(btn(new RegExp(GUIDE.bigScreenMenu)));
    const url = within(dialog()).getByTestId('bigscreen-url').textContent ?? '';
    const code = JSON.parse(window.localStorage.getItem('gu:game:v1')!).code as string;
    expect(url.endsWith(`/gung/scene?code=${code}`)).toBe(true);
  });
});
