// @vitest-environment jsdom
/**
 * QA 실행자 독립 검증(6판) — 현장 보기 통합 + 진행 압축.
 *
 * 개발 쪽 테스트(SceneIntegration·SceneView·RoleNeutral)와 다른 길로 같은 불변을 다시 확인한다.
 *  1. 방장 현장 스윕: 4·5·6인 × 자리 1 의 모든 역할. 조사 1~3 현장 보기에서 **7곳 × 모든 물건**을 차례로 눌러 관찰 카드를 열고,
 *     배치도 패널을 펼치고, 고르기·토론에서 「현장 다시 보기」 시트를 열고, ⋮ › 노트북·TV 시트까지 같은 탭 순서로 밟는다.
 *     단계마다 DOM 을 찍어 역할끼리 비교 + 범인 전용 문자열 0 + .gu-sealed 0 + 라운드 잠금(미래 줄 글자·R2 그림 디테일 0).
 *  2. 플레이어 현장 스윕: 4·5·6인 × 자리 2 의 모든 역할. 게이트 버튼만으로 조사 1~3, 매 라운드 「내 폰으로 현장 보기」 시트에서
 *     7곳 × 모든 물건을 열고, 장소를 고른 뒤 「현장 다시 보기」도 연다. 같은 비교·누출·잠금 검사.
 *  3. 뒤로 가기 라운드 잠금: 방장 ↶ · 단계 맞추기, 플레이어 단계 맞추기로 조사 1 로 돌아가면 미래 줄·R2 디테일이 다시 숨는다.
 *  4. 큰 화면(/gung/scene): 4·5·6인 × 범인 자리 전부의 코드로 열어도 DOM 이 같다(코드·표식만 다름). gu:game:v1 은 읽지도
 *     쓰지도 않는다. ②③ 은 확인을 거쳐야 열리고, 확인 전엔 미래 줄이 DOM 에 없다.
 *  5. 공유: 큰 화면 보내기 문구·주소에 관찰·역할·결과 글자 0.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assignFromCode,
  castFor,
  formatRoomCode,
  GUIDE,
  parseRoomCode,
  publicSeats,
  roleAtSeat,
  roleById,
  scenePayload,
  scenesFor,
  SEED_ALPHABET,
  type PlayerCount,
} from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';
import { SceneStandalone } from '../scene/SceneStandalone';
import { clearSceneStore, SCENE_STORE_KEY } from './SceneView';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

const START = new Date('2026-10-04T21:00:00+09:00');

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
const tiles = (cls: string, root: ParentNode = document) => Array.from(root.querySelectorAll<HTMLElement>(`button.${cls}`));

function codeWith(n: PlayerCount, role: string, seat: number): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[(i * 7 + 3) % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 11) % 31]}${A[(i * 5 + 4) % 31]}${n}`;
    const a = assignFromCode(c, code);
    if (a && roleAtSeat(a, seat) === role) return code;
  }
  throw new Error(`no code for ${n} ${role}@${seat}`);
}

function maskTimer(html: string): string {
  return html
    .replace(/(<p class="gu-timer-num[^"]*">)[^<]*(<\/p>)/g, '$1‹TIMER›$2')
    .replace(/(class="gu-timer-stick-fill" style=")[^"]*(")/g, '$1‹PCT›$2')
    .replace(/(class="gu-timer-ember" style=")[^"]*(")/g, '$1‹PCT›$2')
    .replace(/(<span class="gu-timer-mini-num[^"]*">)[^<]*(<\/span>)/g, '$1‹TIMER›$2')
    .replace(/\d{2}:\d{2}/g, '‹MMSS›')
    // 타이머 낭독 상태(30초 남았소·마지막 1분·시간이 다 됐소)도 실시간 인터벌이 다시 그릴 때만 바뀐다 — 역할과 무관
    .replace(/(<span class="gu-sr" role="status">)[^<]*(<\/span>)/g, '$1‹ANNOUNCE›$2')
    .replace(/ data-(low|critical)=""/g, '')
    .replace(/(<p class="gu-timer-num[^"]*">)끝!(<\/p>)/g, '$1‹TIMER›$2');
}
function normalize(html: string, code: string, roles: boolean): string {
  const room = parseRoomCode(code)!;
  let out = maskTimer(html).replaceAll(formatRoomCode(code), '‹CODE›').replaceAll(room.display, '‹CODE›').replaceAll(code, '‹CODE›').replaceAll(room.tag, '‹TAG›');
  if (roles) {
    const names = publicSeats(c, assignFromCode(c, code)!)
      .flatMap((s) => [s.name, s.shortName])
      .sort((x, y) => y.length - x.length);
    for (const nm of names) out = out.replaceAll(nm, '‹ROLE›');
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

function culpritOnlyStrings(): string[] {
  const ids = Array.isArray(c.culprit) ? c.culprit : [c.culprit];
  const out = [c.truth.confession, c.truth.culpritLine, '당신이 범인', '도장: 범인', '도장: 결백', '✓ 적중'];
  for (const id of ids) {
    const crime = (roleById(c, id) as { crime?: string } | undefined)?.crime;
    if (crime) out.push(crime);
  }
  expect(out.filter(Boolean).length).toBeGreaterThanOrEqual(7);
  return out.filter(Boolean);
}

/** 관찰 줄 전부 + 라운드 잠금 탐침(말한 이를 뗀 앞 10자) */
const LINES = (c.scenes ?? []).flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id, placeId: s.placeId }))));
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const futureOf = (round: number) => LINES.filter((l) => l.fromRound > round).map((l) => probe(l.text));
const linesUpTo = (round: number) => LINES.filter((l) => l.fromRound <= round);

/** 라운드 잠금 — root 의 HTML(속성 포함)에 미래 줄 글자 0, R1 이면 R2 그림 디테일 0 */
function expectRoundLocked(root: Element, round: number, where: string) {
  const html = root.innerHTML;
  for (const p of futureOf(round)) expect(html.includes(p), `${where}: 조사 ${round} 에 미래 줄 「${p}」`).toBe(false);
  if (round < 2) expect(root.querySelectorAll('[data-detail="r2"]').length, `${where}: R1 에 R2 그림 디테일`).toBe(0);
}

/**
 * 현장(SceneView) 하나를 7곳 × 모든 물건 다 눌러 본다. 장소마다 관찰 카드 글자를 모은다.
 * 반환: 연 관찰 카드 글자 목록(장소·물건 순) + 장소 이름 순서.
 */
async function walkScene(root: () => Element, round: number): Promise<{ cards: string[]; places: string[] }> {
  const expected = scenesFor(c, round);
  const cards: string[] = [];
  const places: string[] = [];
  for (let i = 0; i < expected.length; i++) {
    const r = root();
    const name = r.querySelector('.gu-scene-pagename')?.textContent ?? '';
    places.push(name);
    const spots = Array.from(r.querySelectorAll<HTMLButtonElement>('button.gu-scene-spot'));
    const view = expected.find((v) => v.placeName === name);
    expect(view, `장소 ${name}`).toBeTruthy();
    expect(spots.map((s) => s.dataset.obj)).toEqual(view!.objects.map((o) => o.id));
    for (const s of spots) {
      await tap(root().querySelector(`button.gu-scene-spot[data-obj="${s.dataset.obj}"]`));
      const card = root().querySelector('.gu-scene-card');
      // 열린 관찰 카드 하나하나에 미래 줄 0(카드는 장소를 옮기면 닫히므로 연 그 자리에서 본다)
      expect(card?.getAttribute('data-empty'), `${name} ${s.dataset.obj} 카드 열림`).toBeNull();
      for (const p of futureOf(round)) expect(card!.innerHTML.includes(p), `${name} ${s.dataset.obj}: 조사 ${round} 카드에 미래 줄 「${p}」`).toBe(false);
      cards.push(card?.textContent ?? '');
    }
    await tap(root().querySelector('button.gu-scene-pagebtn[aria-label^="다음 장소"]'));
  }
  // 7곳을 돌아 제자리
  return { cards, places };
}

/** 그 라운드까지 열린 관찰 줄이 카드 어딘가에 모두 실렸다(완전성 — 공용 단서를 현장에서 놓칠 수 없다) */
function expectAllLinesShown(cards: string[], round: number, where: string) {
  const all = cards.join('\n');
  for (const l of linesUpTo(round)) expect(all.includes(probe(l.text)), `${where}: 「${probe(l.text)}」 카드에 없음`).toBe(true);
}

async function dismissPeekTip() {
  const d = qdialog();
  if (d && d.getAttribute('aria-label') === '몰래 보는 법') await tap(within(d).getByRole('button', { name: '알겠소' }));
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
const hostSlot = () => document.querySelector('[data-scene-slot="host"]')!;

// ═══════════════════════════════ 1. 방장 현장 스윕 ═══════════════════════════════

async function hostSceneSweep(code: string): Promise<Record<string, string>> {
  await hostRecover(code);
  const snaps: Record<string, string> = {};
  const shot = (k: string, root: Element = document.body) => {
    expect(document.querySelectorAll('.gu-sealed').length, `${k} .gu-sealed`).toBe(0);
    snaps[k] = normalize(root.innerHTML, code, true);
  };
  await tap(btn(/사건 시작/));
  await tap(btn(/다 읽었소 → 패 확인/));
  await tap(btn(/다 봤소/));
  await tap(btn(/첫째 조사 시작/));
  for (const r of [1, 2, 3] as const) {
    expect(screen.getByRole('heading', { name: new RegExp(`조사 ${r} · 현장 보기`) })).toBeInTheDocument();
    expectRoundLocked(document.body, r, `방장 r${r} 현장 첫 화면`);
    shot(`r${r}-scene-first`);
    // 배치도 패널: 7곳, 지금 장소만 눌림
    await tap(within(hostSlot() as HTMLElement).getByRole('button', { name: new RegExp(GUIDE.sceneMapToggle) }));
    const panel = hostSlot().querySelector('.gu-scene-mappanel')!;
    expect(within(panel as HTMLElement).getAllByRole('button')).toHaveLength(7);
    shot(`r${r}-scene-map`, hostSlot());
    await tap(within(hostSlot() as HTMLElement).getByRole('button', { name: new RegExp(GUIDE.sceneMapToggle) }));
    const walk = await walkScene(hostSlot, r);
    expectAllLinesShown(walk.cards, r, `방장 r${r}`);
    expectRoundLocked(document.body, r, `방장 r${r} 현장 전부 연 뒤`);
    snaps[`r${r}-scene-cards`] = walk.cards.join('\n');
    shot(`r${r}-scene-walked`);
    await tap(btn(/고르기 \d+분 시작/));
    expect(document.querySelector('svg.gu-scene-art'), `r${r} 고르기 무대엔 그림 없음`).toBeNull();
    await tap(btn(GUIDE.sceneAgainLink));
    const d1 = dialog();
    expect(d1.getAttribute('aria-label')).toBe(GUIDE.sceneLabel);
    expectRoundLocked(d1, r, `방장 r${r} 고르기 현장 시트`);
    const sheetWalk = await walkScene(() => dialog(), r);
    expectAllLinesShown(sheetWalk.cards, r, `방장 r${r} 시트`);
    shot(`r${r}-select-sheet`, dialog());
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(GUIDE.sceneAgainLink));
    expectRoundLocked(dialog(), r, `방장 r${r} 토론 현장 시트`);
    shot(`r${r}-discuss-sheet`, dialog());
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    if (r < 3) await tap(btn(r === 1 ? /둘째 조사 시작/ : /셋째 조사 시작/));
  }
  await tap(btn('메뉴'));
  await tap(btn(GUIDE.bigScreenMenu));
  shot('bigscreen-sheet', dialog());
  return snaps;
}

describe('QA6-1 방장 현장 스윕 — 방장 역할만 바꾼 같은 판, 조사 1~3 현장 7곳 × 모든 물건 · 시트 · 큰 화면 주소', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: DOM 이 방장 역할과 무관하게 같고, 범인 전용 문자열 0 · .gu-sealed 0 · 라운드 잠금`, async () => {
      const banned = culpritOnlyStrings();
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        runs.push({ role, snaps: await hostSceneSweep(codeWith(n, role, 1)) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(Object.keys(base.snaps).length).toBe(3 * 6 + 1);
      for (const r of runs) {
        for (const [k, html] of Object.entries(r.snaps)) {
          const t = textOf(html);
          for (const s of banned) expect(t, `${n}인 방장=${r.role} ${k}: 「${s.slice(0, 20)}」`).not.toContain(s);
        }
      }
      for (const r of rest) {
        for (const k of Object.keys(base.snaps)) {
          expect(textOf(r.snaps[k]), `${n}인 방장=${r.role} vs ${base.role} · ${k} 텍스트`).toBe(textOf(base.snaps[k]));
          expect(r.snaps[k], `${n}인 방장=${r.role} vs ${base.role} · ${k} DOM`).toBe(base.snaps[k]);
        }
      }
    }, 240_000);
  }
});

// ═══════════════════════════════ 2. 플레이어 현장 스윕 ═══════════════════════════════

async function playerSceneSweep(code: string): Promise<Record<string, string>> {
  await joinAsPlayer(code, 2);
  const snaps: Record<string, string> = {};
  await tap(btn(/사건 시작됐어요/));
  await tap(btn(/내 패 확인하기/));
  await dismissPeekTip();
  await tap(btn(/자기소개 시작됐어요/));
  await tap(btn(/1라운드 시작됐어요/));
  await dismissPeekTip();
  for (const r of [1, 2, 3] as const) {
    if (r > 1) {
      await tap(btn(new RegExp(`${r}라운드 시작됐어요`)));
      if (r === 3) await tap(within(dialog()).getByRole('button', { name: '넘어가겠소' }));
      await dismissPeekTip();
    }
    // 장소 고르기 위 안내(모든 역할 같은 문구)
    expect(document.body.textContent).toContain(GUIDE.scenePlayerHint);
    snaps[`r${r}-prompt`] = normalize(document.querySelector('.gu-scene-prompt')!.outerHTML, code, true);
    await tap(btn(GUIDE.sceneOpenLink));
    expect(dialog().getAttribute('aria-label')).toBe(GUIDE.sceneLabel);
    expectRoundLocked(dialog(), r, `플레이어 r${r} 현장 시트`);
    const walk = await walkScene(() => dialog(), r);
    expectAllLinesShown(walk.cards, r, `플레이어 r${r}`);
    expectRoundLocked(dialog(), r, `플레이어 r${r} 현장 시트(전부 연 뒤)`);
    snaps[`r${r}-cards`] = walk.cards.join('\n');
    snaps[`r${r}-sheet`] = normalize(dialog().innerHTML, code, true);
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    await tap(btn(GUIDE.sceneAgainLink));
    expectRoundLocked(dialog(), r, `플레이어 r${r} 단서 뒤 현장 시트`);
    snaps[`r${r}-again`] = normalize(dialog().innerHTML, code, true);
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
  }
  return snaps;
}

describe('QA6-2 플레이어 현장 스윕 — 자리 2 역할만 바꾼 같은 판, 게이트 버튼만으로 조사 1~3', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 현장 안내·현장 시트 DOM 이 역할과 무관하게 같고, 범인 전용 문자열 0 · 라운드 잠금`, async () => {
      const banned = culpritOnlyStrings();
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        runs.push({ role, snaps: await playerSceneSweep(codeWith(n, role, 2)) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(Object.keys(base.snaps)).toHaveLength(12);
      for (const r of runs) {
        for (const [k, html] of Object.entries(r.snaps)) {
          for (const s of banned) expect(textOf(html), `${n}인 자리2=${r.role} ${k}`).not.toContain(s);
        }
      }
      for (const r of rest) {
        for (const k of Object.keys(base.snaps)) {
          expect(r.snaps[k], `${n}인 자리2=${r.role} vs ${base.role} · ${k}`).toBe(base.snaps[k]);
        }
      }
    }, 240_000);
  }
});

// ═══════════════════════════════ 3. 뒤로 가기 라운드 잠금 ═══════════════════════════════

describe('QA6-3 뒤로 가면 현장도 그 라운드로 — 미래 줄·R2 그림 디테일이 다시 숨는다', () => {
  it('방장: 조사 2 현장 → ↶ → 조사 1 토론의 현장 시트엔 조사 2 줄·디테일 0 · 조사 3 에서 단계 맞추기로 조사 1 → 같음', async () => {
    await hostRecover(codeWith(6, 'queen', 1));
    await syncTo(/^자기소개/);
    await tap(btn(/첫째 조사 시작/));
    await tap(btn(/고르기 \d+분 시작/));
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(/둘째 조사 시작/));
    // 조사 2 현장 — R2 디테일이 실제로 그려지는 장소(후원 연못)까지 가 본다(탐침 유효성)
    for (let i = 0; i < 7 && hostSlot().querySelector('.gu-scene-pagename')?.textContent !== '후원 연못'; i++) {
      await tap(hostSlot().querySelector('button.gu-scene-pagebtn[aria-label^="다음 장소"]'));
    }
    expect(hostSlot().querySelectorAll('[data-detail="r2"]').length).toBeGreaterThan(0);
    expect(document.body.innerHTML).toContain(probe(LINES.find((l) => l.fromRound === 2)!.text));
    await tap(document.querySelector('.gu-header-left button[aria-label="되돌리기"]'));
    expect(screen.getByRole('heading', { name: /조사 1 · 토론/ })).toBeInTheDocument();
    await tap(btn(GUIDE.sceneAgainLink));
    // 후원 연못으로
    for (let i = 0; i < 7 && dialog().querySelector('.gu-scene-pagename')?.textContent !== '후원 연못'; i++) {
      await tap(dialog().querySelector('button.gu-scene-pagebtn[aria-label^="다음 장소"]'));
    }
    expect(dialog().querySelector('.gu-scene-pagename')?.textContent).toBe('후원 연못');
    expectRoundLocked(dialog(), 1, '↶ 뒤 조사 1 시트');
    expectRoundLocked(document.body, 1, '↶ 뒤 조사 1 전체');
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await syncTo(/^조사 3/);
    await syncTo(/^조사 1/);
    await tap(btn(GUIDE.sceneAgainLink));
    expectRoundLocked(document.body, 1, '단계 맞추기 조사 3 → 1');
  });

  it('플레이어: 조사 3 까지 갔다가 단계 맞추기로 조사 1 → 현장 시트엔 조사 1 줄만', async () => {
    await joinAsPlayer(codeWith(5, 'consort', 2), 2);
    await syncTo(/^조사 3/);
    await tap(btn(GUIDE.sceneOpenLink));
    expect(dialog().innerHTML).toContain(probe(LINES.find((l) => l.fromRound === 3)!.text));
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    await syncTo(/^조사 1/);
    await tap(btn(GUIDE.sceneOpenLink));
    expectRoundLocked(dialog(), 1, '플레이어 조사 3 → 1');
    const walk = await walkScene(() => dialog(), 1);
    expectAllLinesShown(walk.cards, 1, '플레이어 조사 3 → 1');
  });

  it('현장 시트를 열면 열려 있던 봉인(단서)이 즉시 닫힌다', async () => {
    await joinAsPlayer(codeWith(6, 'eunuch', 2), 2);
    await syncTo(/^조사 1/);
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    const surface = document.querySelector<HTMLElement>('.gu-sealed-surface');
    expect(surface).not.toBeNull();
    // 키보드 꾹(Enter 누른 채) = 열림
    fireEvent.keyDown(surface!, { key: 'Enter' });
    await flush();
    expect(document.querySelector('.gu-sealed[data-open]'), '탐침 유효성: 열림').not.toBeNull();
    expect(document.querySelector('.gu-sealed-paper')).not.toBeNull();
    // 손을 떼지 않은 채 현장 시트를 연다 → 즉시 닫힘(본문 DOM 0)
    await tap(btn(GUIDE.sceneAgainLink));
    expect(dialog().getAttribute('aria-label')).toBe(GUIDE.sceneLabel);
    expect(document.querySelector('.gu-sealed[data-open]')).toBeNull();
    expect(document.querySelector('.gu-sealed-paper')).toBeNull();
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    expect(document.querySelector('.gu-sealed[data-open]')).toBeNull();
  });
});

// ═══════════════════════════════ 4. 큰 화면(/gung/scene) ═══════════════════════════════

async function bigSweep(code: string | null): Promise<Record<string, string>> {
  search = code ? `code=${code}` : '';
  render(<SceneStandalone />);
  await flush();
  const snaps: Record<string, string> = {};
  const norm = (h: string) => (code ? normalize(h, code, false) : h);
  const root = () => document.querySelector('.gu-scenebig')!;
  // 큰 화면엔 방 코드·자리·역할이 없다(표식만)
  expect(root().textContent).not.toContain(code ?? '§');
  expectRoundLocked(document.body, 1, `큰 화면 ${code} r1`);
  const w1 = await walkScene(() => root(), 1);
  expectAllLinesShown(w1.cards, 1, `큰 화면 ${code} r1`);
  expectRoundLocked(document.body, 1, `큰 화면 ${code} r1 전부 연 뒤`);
  snaps.r1 = norm(document.body.innerHTML);
  // ② 확인 — 「아직이오」면 그대로 조사 1
  await tap(btn('둘째 조사'));
  expect(dialog().textContent).toContain('둘째 조사 현장을 열겠소?');
  expectRoundLocked(document.body, 1, `큰 화면 ${code} ② 확인 중`);
  await tap(within(dialog()).getByRole('button', { name: '아직이오' }));
  expect(btn('첫째 조사').getAttribute('aria-pressed')).toBe('true');
  expectRoundLocked(document.body, 1, `큰 화면 ${code} 아직이오`);
  // ③ 바로 열기도 확인
  await tap(btn('셋째 조사'));
  await tap(within(dialog()).getByRole('button', { name: '열겠소' }));
  expect(btn('셋째 조사').getAttribute('aria-pressed')).toBe('true');
  const w3 = await walkScene(() => root(), 3);
  expectAllLinesShown(w3.cards, 3, `큰 화면 ${code} r3`);
  snaps.r3 = norm(document.body.innerHTML);
  // 이미 연 라운드 이하는 확인 없이
  await tap(btn('둘째 조사'));
  expect(qdialog()).toBeNull();
  expectRoundLocked(document.body, 2, `큰 화면 ${code} r3 → r2`);
  snaps.r2 = norm(document.body.innerHTML);
  return snaps;
}

describe('QA6-4 큰 화면(/gung/scene) — 코드만 다른 모든 판에서 같은 화면 · 게임 저장 무관', () => {
  it('4·5·6인 × 범인 자리 전부(코드 18개)에서 DOM 이 같고, 범인 전용 문자열·역할명 0, gu:game:v1 무접촉', async () => {
    const banned = culpritOnlyStrings();
    const getSpy = vi.spyOn(Storage.prototype, 'getItem');
    const setSpy = vi.spyOn(Storage.prototype, 'setItem');
    const codes: string[] = [];
    for (const n of [4, 5, 6] as PlayerCount[]) {
      const culprit = Array.isArray(c.culprit) ? c.culprit[0] : c.culprit;
      for (let seat = 1; seat <= n; seat++) codes.push(codeWith(n, culprit, seat));
    }
    const runs: Record<string, string>[] = [];
    for (const code of codes) {
      // 같은 브라우저에 방장 판이 조사 3 으로 저장돼 있어도 따라가지 않는다
      const game = JSON.stringify({ v: 1, code, phase: 'r3', role: 'host' });
      window.localStorage.setItem('gu:game:v1', game);
      getSpy.mockClear();
      setSpy.mockClear();
      runs.push(await bigSweep(code));
      expect(getSpy.mock.calls.some(([k]) => k === 'gu:game:v1'), `${code}: gu:game:v1 읽음`).toBe(false);
      expect(setSpy.mock.calls.some(([k]) => k === 'gu:game:v1'), `${code}: gu:game:v1 씀`).toBe(false);
      expect(window.localStorage.getItem('gu:game:v1')).toBe(game);
      expect(JSON.parse(window.localStorage.getItem(SCENE_STORE_KEY)!).code).toBe(code);
      cleanup();
      window.localStorage.clear();
      vi.setSystemTime(START);
    }
    const roleNames = c.roles.map((r) => r.name);
    for (const [i, r] of runs.entries()) {
      for (const [k, html] of Object.entries(r)) {
        const t = textOf(html);
        for (const s of banned) expect(t, `${codes[i]} ${k}`).not.toContain(s);
        expect(t).not.toMatch(/범인|결백|자리 \d|\d번 자리/);
        // 역할 '이름표'(패 제목)는 큰 화면 크롬에 없다 — 관찰 줄 속 호칭(숙의마마 등)은 공개 문장이라 제외하고 헤더만 검사
        const head = (() => {
          const d = document.createElement('div');
          d.innerHTML = html;
          return d.querySelector('.gu-scenebig-head')?.textContent ?? '';
        })();
        for (const nm of roleNames) expect(head, `${codes[i]} 헤더에 역할명 ${nm}`).not.toContain(nm);
      }
      for (const k of Object.keys(runs[0])) expect(r[k], `${codes[i]} vs ${codes[0]} · ${k}`).toBe(runs[0][k]);
    }
  }, 240_000);

  it('코드 없이 열어도 그림·관찰은 같고 사건 표식만 없다 · 틀린 코드는 안내 한 줄', async () => {
    const noCode = await bigSweep(null);
    expect(document.querySelector('.gu-scenebig-tag')).toBeNull();
    cleanup();
    window.localStorage.clear();
    clearSceneStore();
    const withCode = await bigSweep(codeWith(6, 'queen', 3));
    // 머리(표식·안내)만 빼면 같다
    const body = (h: string) => {
      const d = document.createElement('div');
      d.innerHTML = h;
      d.querySelectorAll('.gu-scenebig-head, .gu-scenebig-note').forEach((e) => e.remove());
      return d.innerHTML;
    };
    for (const k of ['r1', 'r2', 'r3']) expect(body(withCode[k])).toBe(body(noCode[k]));
    cleanup();
    window.localStorage.clear();
    search = 'code=ZZ11';
    render(<SceneStandalone />);
    await flush();
    expect(document.body.textContent).toContain('방 코드를 알아볼 수 없소');
    expect(document.querySelectorAll('button.gu-scene-spot').length).toBeGreaterThan(0);
  });
});

describe('QA6-4b 큰 화면 기록은 그 방 코드에만 — 다른 판(코드 없음 ↔ 코드)으로 넘어가면 조사 1 부터 확인을 다시 거친다', () => {
  async function openBig(code: string | null) {
    search = code ? `code=${code}` : '';
    render(<SceneStandalone />);
    await flush();
  }
  async function toRound3() {
    await tap(btn('셋째 조사'));
    await tap(within(dialog()).getByRole('button', { name: '열겠소' }));
    expect(btn('셋째 조사').getAttribute('aria-pressed')).toBe('true');
    await tap(document.querySelector('button.gu-scene-spot'));
  }
  for (const [from, to] of [
    [null, '7F3K5'],
    ['7F3K5', null],
    ['7F3K5', 'C2DB6'],
  ] as const) {
    it(`${from ?? '코드 없음'} 에서 조사 3 까지 연 기기로 ${to ?? '코드 없음'} 을 열면 조사 1 · ②③ 확인 다시`, async () => {
      clearSceneStore();
      await openBig(from);
      await toRound3();
      cleanup(); // 같은 기기·같은 저장소(localStorage 그대로)에서 새 판 주소를 연다
      await openBig(to);
      expect(btn('첫째 조사').getAttribute('aria-pressed'), '새 판은 조사 1 부터').toBe('true');
      expectRoundLocked(document.body, 1, `${from} → ${to}`);
      expect(document.querySelectorAll('.gu-scene-spot[data-seen]').length, '앞 판의 본 표시').toBe(0);
      await tap(btn('둘째 조사'));
      expect(qdialog(), '②는 다시 확인').not.toBeNull();
    });
  }
  it('같은 코드로 다시 열면(새로고침) 연 조사·본 표시가 그대로', async () => {
    clearSceneStore();
    await openBig('7F3K5');
    await toRound3();
    cleanup();
    await openBig('7F3K5');
    expect(btn('셋째 조사').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.gu-scene-spot[data-seen]').length).toBe(1);
  });
});

// ═══════════════════════════════ 5. 공유·의존 ═══════════════════════════════

describe('QA6-5 큰 화면 공유 문구 · 현장 모듈 의존', () => {
  it('scenePayload: 주소는 /gung/scene?code=… 하나, 문구에 관찰·역할·결과 글자 0', () => {
    const code = codeWith(6, 'consort', 1);
    const p = scenePayload({ code, origin: 'https://project-orsrw.vercel.app' });
    expect(p.url).toBe(`https://project-orsrw.vercel.app/gung/scene?code=${code}`);
    expect(p.copyText).toBe(p.url);
    const all = JSON.stringify(p);
    for (const l of LINES) expect(all).not.toContain(probe(l.text));
    for (const r of c.roles) expect(all).not.toContain(r.name);
    for (const s of culpritOnlyStrings()) expect(all).not.toContain(s);
    expect(all).not.toMatch(/범인|적중|잡았|놓쳤/);
  });

  it('큰 화면·현장 화면 소스는 배정·봉인·게임 저장을 import 하지 않는다', () => {
    const files = ['../scene/SceneStandalone.tsx', './SceneView.tsx', '../../../lib/gung/scene.ts', '../../../lib/gung/room.ts'];
    for (const f of files) {
      const src = readFileSync(resolve(__dirname, f), 'utf8');
      const imports = src.split('\n').filter((l) => /^\s*import\b/.test(l) || /from '/.test(l));
      for (const l of imports) {
        expect(l, `${f}: ${l}`).not.toMatch(/assign|seal|useGungGame|storage'|['/]game'|deck|case-extras|@\/lib\/gung'/);
      }
    }
  });
});

// ═══════════════════════════════ 6. 술자리 가독성(CSS 바닥) ═══════════════════════════════

describe('QA6-02 현장 글자 14px 바닥 · ‹ › 56px (실브라우저 실측으로 찾은 것의 회귀)', () => {
  const css = readFileSync(resolve(__dirname, '../gung.css'), 'utf8');
  const rule = (sel: string, from = 0) => {
    const i = css.indexOf(`${sel} {`, from);
    expect(i, sel).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };
  it('그림 이름표: 캔버스 320px 이상이면 14px 바닥(폰 360·375 실측 12.4·13px 였다)', () => {
    const at = css.indexOf('@container (min-width: 320px)');
    expect(at).toBeGreaterThan(0);
    expect(rule('.gu-scene-spot', at)).toContain('clamp(14px, 3.8cqw, 26px)');
    expect(rule('.gu-scene-tag-new')).toContain('max(12px, 0.86em)');
  });
  it('관찰 카드 장소·조사 꼬리표, 새 관찰 목록 장소, 큰 화면 시트 안내는 14px 이상 · ‹ › 단추는 56px', () => {
    for (const sel of ['.gu-scene-card-place', '.gu-scene-line-round', '.gu-scene-new-where']) {
      const m = /font-size:\s*(\d+)px/.exec(rule(sel));
      expect(Number(m?.[1]), sel).toBeGreaterThanOrEqual(14);
    }
    expect(rule('.gu-bigscreen-note')).toContain('max(14px');
    expect(rule('.gu-scene-pagebtn')).toMatch(/width: 56px; height: 56px/);
    expect(rule('.gu-scene-pager')).toContain('grid-template-columns: 56px minmax(0, 1fr) 56px');
  });
});
