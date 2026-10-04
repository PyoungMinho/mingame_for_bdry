// @vitest-environment jsdom
/**
 * 현장 보기 통합(프론트팀장) — 실제 GungApp 흐름에 현장 그림이 제자리에 붙었는지.
 *
 *  - 방장: 조사 라운드 첫 하위 단계(현장 보기) 무대 맨 위에 현장 그림(SceneView) → 그 아래 공용 단서. 그 라운드 줄만 DOM 에 있다.
 *  - 장소 이름 → 궁 배치도 펼치기 → 배치도의 장소를 누르면 그 현장으로(배치도 탭 이동).
 *  - 고르기·토론: 무대엔 그림이 없고 「현장 다시 보기」 시트로 언제든(그 폰이 들어선 라운드까지만).
 *  - 플레이어: 장소 고르기 위 「현장 그림은 방장 화면에서」 + 내 폰으로 현장 보기 시트(라운드 잠금 그대로).
 *  - 큰 화면: 방장 ⋮ 메뉴·S3 초대 화면 → /gung/scene?code=… 주소 시트. 홈에는 /gung/scene 링크.
 *  - 처음으로 → 본 물건 기록(gu:scene:v1)도 지운다.
 *
 * 규약은 기존 화면 테스트와 같다(Date 만 가짜, 사람 탭 = 1초 간격, 실데이터 + 결정론 코드).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GUIDE, scenesFor } from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';
import { SCENE_STORE_KEY } from './SceneView';

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
const bodyText = () => document.body.textContent ?? '';
const tiles = (cls: string) => Array.from(document.querySelectorAll<HTMLElement>(`button.${cls}`));

const LINES = (c.scenes ?? []).flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id }))));
/** 화면은 「의관: …」을 <b>의관</b> … 로 그리므로 말한 이를 떼고 앞 10자로 찾는다 */
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const futureOf = (round: number) => LINES.filter((l) => l.fromRound > round).map((l) => probe(l.text));

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
const placeNameIn = (root: ParentNode) => root.querySelector('.gu-scene-pagename')?.textContent ?? '';

describe('방장 — 조사 라운드 현장 보기 무대', () => {
  it('현장 그림이 무대 맨 위(공용 단서보다 앞) · 물건을 누르면 관찰 카드 · 그 라운드 줄만', async () => {
    await hostToRound1Scene();
    const slot = hostSlot()!;
    expect(slot).not.toBeNull();
    const first = scenesFor(c, 1)[0];
    expect(slot.querySelector(`svg.gu-scene-art[data-art="${first.art}"]`)).not.toBeNull();
    expect(slot.querySelectorAll('button.gu-scene-spot')).toHaveLength(first.objects.length);
    // 그림이 공용 단서(낭독)보다 앞
    const board = document.querySelector('.gu-publicclue')!;
    expect(board).not.toBeNull();
    expect(slot.compareDocumentPosition(board) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bodyText()).toContain(GUIDE.sceneCue);

    await tap(within(slot).getByRole('button', { name: /탕약 사발/ }));
    const card = within(slot).getByRole('region', { name: '관찰' });
    expect(card.textContent).toContain(probe(LINES.find((l) => l.objectId === 'OB-DG1' && l.fromRound === 1)!.text));
    // 라운드 잠금 — 조사 2·3 줄은 무대 어디에도 없다
    for (const p of futureOf(1)) expect(bodyText(), p).not.toContain(p);
    // 본 물건 기록은 현장 키에만(게임 저장과 별개)
    expect(JSON.parse(window.localStorage.getItem(SCENE_STORE_KEY)!).seen).toContain('OB-DG1@1');
  });

  it('장소 이름 → 궁 배치도 → 배치도의 장소를 누르면 그 현장으로 간다', async () => {
    await hostToRound1Scene();
    const slot = hostSlot()!;
    const toggle = within(slot).getByRole('button', { name: new RegExp(GUIDE.sceneMapToggle) });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(slot.querySelector('.gu-scene-mappanel')).toBeNull();
    await tap(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = slot.querySelector<HTMLElement>('.gu-scene-mappanel')!;
    expect(panel.textContent).toContain(GUIDE.sceneMapHint);
    // 7곳 모두 단추, 지금 장소(동궁전)만 눌림 표시
    const places = within(panel).getAllByRole('button');
    expect(places).toHaveLength(7);
    expect(within(panel).getByRole('button', { name: '동궁전 현장' }).getAttribute('aria-pressed')).toBe('true');
    await tap(within(panel).getByRole('button', { name: /^서고/ }));
    expect(placeNameIn(slot)).toBe('서고');
    expect(slot.querySelector('.gu-scene-mappanel')).toBeNull();
    // 키보드(Enter)로도 — 서쪽 묶음(작은 상자)
    await tap(within(slot).getByRole('button', { name: new RegExp(GUIDE.sceneMapToggle) }));
    fireEvent.keyDown(within(slot.querySelector<HTMLElement>('.gu-scene-mappanel')!).getByRole('button', { name: '내의원 현장' }), { key: 'Enter' });
    await flush();
    expect(placeNameIn(slot)).toBe('내의원');
  });

  it('고르기·토론 무대엔 그림이 없고 「현장 다시 보기」 시트 — 그 라운드까지만, 다음 라운드 현장엔 「새」', async () => {
    await hostToRound1Scene();
    await tap(btn(/고르기 \d+분 시작/));
    expect(document.querySelector('svg.gu-scene-art')).toBeNull();
    expect(hostSlot()).toBeNull();
    await tap(btn(GUIDE.sceneAgainLink));
    const d = dialog();
    expect(d.getAttribute('aria-label')).toBe(GUIDE.sceneLabel);
    expect(d.querySelector('svg.gu-scene-art')).not.toBeNull();
    for (const p of futureOf(1)) expect(d.textContent, p).not.toContain(p);
    await tap(within(d).getByRole('button', { name: '닫기' }));
    expect(qdialog()).toBeNull();

    await tap(btn(/토론 \d+분 시작/));
    expect(qbtn(GUIDE.sceneAgainLink)).not.toBeNull();
    await tap(btn(/둘째 조사 시작/));
    expect(screen.getByRole('heading', { name: /조사 2 · 현장 보기/ })).toBeInTheDocument();
    const slot = hostSlot()!;
    // 이번 조사 새 관찰 목록(방장이 소리 내어 읽는다) — 그 라운드에 새로 열린 줄 수만큼
    const fresh = within(slot).getByRole('region', { name: new RegExp(GUIDE.sceneNewHead) });
    expect(within(fresh).getAllByRole('button')).toHaveLength(LINES.filter((l) => l.fromRound === 2).length);
    for (const p of futureOf(2)) expect(bodyText(), p).not.toContain(p);
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

  it('처음으로 → 본 물건 기록(gu:scene:v1)도 지운다', async () => {
    await hostToRound1Scene();
    await tap(within(hostSlot()!).getByRole('button', { name: /은숟가락/ }));
    expect(window.localStorage.getItem(SCENE_STORE_KEY)).not.toBeNull();
    await tap(btn('메뉴'));
    await tap(btn('처음으로'));
    await tap(within(dialog()).getByRole('button', { name: '처음으로' }));
    expect(window.localStorage.getItem(SCENE_STORE_KEY)).toBeNull();
  });
});

describe('플레이어 — 장소 고르기 위 현장 안내 · 내 폰으로 현장 보기', () => {
  it('「현장 그림은 방장 화면에서」 + 시트(라운드 잠금 그대로) · 장소를 고른 뒤에도 다시 보기', async () => {
    await joinAsPlayer(CODE, 2);
    await syncTo(/^조사 1/);
    expect(bodyText()).toContain(GUIDE.scenePlayerHint);
    await tap(btn(GUIDE.sceneOpenLink));
    const d = dialog();
    expect(d.querySelector('svg.gu-scene-art')).not.toBeNull();
    expect(d.querySelectorAll('button.gu-scene-spot').length).toBe(scenesFor(c, 1)[0].objects.length);
    for (const p of futureOf(1)) expect(d.textContent, p).not.toContain(p);
    await tap(within(d).getByRole('button', { name: '닫기' }));
    // 장소를 고른 뒤(단서 화면)에도 다시 보기 링크
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    expect(qbtn(GUIDE.sceneAgainLink)).not.toBeNull();
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
