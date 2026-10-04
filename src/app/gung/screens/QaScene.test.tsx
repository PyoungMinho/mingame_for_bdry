// @vitest-environment jsdom
/**
 * QA 독립 검증(7판 조사 따로) — 「이동은 다 같이(공용), 살펴보기는 각자(개인)」.
 *
 * 개발 쪽 테스트(SceneIntegration·Examine·RoleNeutral)와 다른 길로 같은 불변을 다시 확인한다.
 *  1. 방장 스윕: 4·5·6인 × 자리 1 의 모든 역할. 조사 1~3 현장 보기(이동 연출) → 방장 본인 살펴보기(단서함 「지금 고르기」 시트,
 *     물건 둘) → 장소 → 무대로 돌아와 고르기·토론. 단계마다 DOM 을 찍어 역할끼리 비교 + **공용 무대에 관찰 글 0**(어느 라운드 줄도,
 *     방장이 살펴본 뒤에도) + 물건 이름표 0 + 범인 전용 문자열 0 + .gu-sealed 0.
 *  2. 플레이어 스윕: 4·5·6인 × 자리 2 의 모든 역할. 게이트 버튼만으로 조사 1~3, 매 조사 살펴보기 전·하나 본 뒤·소진·장소 고른 뒤
 *     「내가 본 관찰」을 찍어 역할끼리 비교(역할과 무관하게 같은 구조) + 라운드 잠금 + 범인 전용 문자열 0.
 *  3. 뒤로 가기·봉인: 단계 맞추기로 조사 3 → 1 이면 조사 3 줄이 다시 숨는다. 관찰 카드는 시트가 열리면 즉시 가려진다.
 *  4. 큰 화면(/gung/scene): 4·5·6인 × 범인 자리 전부의 코드로 열어도 DOM 이 같다(코드·표식만 다름). 관찰 글·물건 이름표 0.
 *     gu:game:v1 은 읽지도 쓰지도 않는다. ②③ 은 확인을 거쳐야 열린다. 조사 칩 기록은 그 방 코드에만.
 *  5. 공유·의존: 큰 화면 보내기 문구에 관찰·역할·결과 글자 0. /gung/scene 의 import 그래프에 사건 데이터·현장 엔진이 없다.
 *  6. 술자리 가독성(CSS 바닥).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  assignFromCode,
  castFor,
  formatRoomCode,
  GUIDE,
  guideText,
  parseRoomCode,
  publicSeats,
  roleAtSeat,
  roleById,
  scenePayload,
  sceneStop,
  SEED_ALPHABET,
  type PlayerCount,
} from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';
import { SceneStandalone } from '../scene/SceneStandalone';
import { clearSceneStore, SCENE_STORE_KEY } from '../lib/sceneStore';

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
    .replace(/(<p class="gu-timer-num[^"]*">)끝!(<\/p>)/g, '$1‹TIMER›$2')
    // 관찰 카드 자동 가림 남은 초(실시간 인터벌) — 역할과 무관
    .replace(/\d+초 뒤 가려져요/g, '‹N›초 뒤 가려져요');
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
/** 토스트(실시간 6초)는 빼고 찍는다 — 역할과 무관한 타이밍 차이 */
function htmlOf(root: Element): string {
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('.gu-toast').forEach((e) => e.remove());
  return clone.innerHTML;
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

/** 관찰 줄 전부 + 탐침(말한 이를 뗀 앞 10자) */
const LINES = (c.scenes ?? []).flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id, placeId: s.placeId }))));
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const futureOf = (round: number) => LINES.filter((l) => l.fromRound > round).map((l) => probe(l.text));
const OBJECT_NAMES = (c.scenes ?? []).flatMap((s) => s.objects.map((o) => o.name));

/** 공용 화면: 관찰 글(어느 라운드 줄도) 0 · 물건 이름표 0 */
function expectPublicClean(root: Element, where: string) {
  const html = root.innerHTML;
  for (const l of LINES) expect(html.includes(probe(l.text)), `${where}: 관찰 「${probe(l.text)}」`).toBe(false);
  expect(root.querySelectorAll('.gu-scene-spot, .gu-obs, section.gu-examine').length, `${where}: 물건·관찰 카드`).toBe(0);
}
/** 라운드 잠금 — root 의 HTML(속성 포함)에 미래 줄 글자 0 */
function expectRoundLocked(root: Element, round: number, where: string) {
  const html = root.innerHTML;
  for (const p of futureOf(round)) expect(html.includes(p), `${where}: 조사 ${round} 에 미래 줄 「${p}」`).toBe(false);
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
const panelIn = (root: ParentNode) => root.querySelector<HTMLElement>('section.gu-examine')!;
/** 물건을 고르고 「살펴보기 (N번 남음)」 — root 는 매번 다시 찾는다(다시 그려진다) */
async function examineIn(root: () => ParentNode, id: string) {
  await tap(panelIn(root()).querySelector(`button.gu-scene-spot[data-obj="${id}"]`));
  await tap(within(panelIn(root())).getByRole('button', { name: /^살펴보기 \(\d번 남음\)/ }));
}
/** 그 조사에 고르는 물건(역할 무관 고정) — 첫 물건 + 마지막 물건 */
const pickOf = (round: number) => {
  const objs = (c.scenes ?? []).find((s) => s.placeId === sceneStop(c, round)!.placeId)!.objects;
  return [objs[0].id, objs[objs.length - 1].id];
};
/** 살펴본 카드에 그 조사까지의 줄만(빠짐·미래 없음) */
function expectCardLines(card: Element, objectId: string, round: number, where: string) {
  for (const l of LINES.filter((x) => x.objectId === objectId)) {
    expect(card.textContent!.includes(probe(l.text)), `${where} ${objectId} R${l.fromRound}`).toBe(l.fromRound <= round);
  }
}

// ═══════════════════════════════ 1. 방장 스윕 ═══════════════════════════════

async function hostSweep(code: string): Promise<Record<string, string>> {
  await hostRecover(code);
  const snaps: Record<string, string> = {};
  const shot = (k: string, root: Element = document.body) => {
    expect(document.querySelectorAll('.gu-sealed').length, `${k} .gu-sealed`).toBe(0);
    snaps[k] = normalize(htmlOf(root), code, true);
  };
  await tap(btn(/사건 시작/));
  await tap(btn(/다 읽었소 → 패 확인/));
  await tap(btn(/다 봤소/));
  await tap(btn(/첫째 조사 시작/));
  for (const r of [1, 2, 3] as const) {
    const stop = sceneStop(c, r)!;
    expect(screen.getByRole('heading', { name: new RegExp(`조사 ${r} · 현장 보기`) })).toBeInTheDocument();
    expect(hostSlot().textContent).toContain(stop.placeName);
    expect(hostSlot().textContent).toContain(stop.cue);
    expect(hostSlot().textContent).toContain(guideText.examineCue(stop.examine));
    expect(hostSlot().querySelector(`svg.gu-scene-art[data-art="${stop.art}"]`)).not.toBeNull();
    expectPublicClean(document.body, `방장 r${r} 현장`);
    shot(`r${r}-scene`);
    // 방장 본인 살펴보기 — 단서함 「지금 고르기」 시트(자기 폰을 가리고)
    await tap(btn(GUIDE.hostOwnClueLink));
    await tap(screen.getAllByRole('button', { name: '지금 고르기' })[0]);
    expect(dialog().getAttribute('aria-label')).toBe(`조사 ${r} · 지금 고르기`);
    expectRoundLocked(dialog(), r, `방장 r${r} 시트`);
    snaps[`r${r}-own-before`] = normalize(htmlOf(panelIn(dialog())), code, true);
    const [a, b] = pickOf(r);
    await examineIn(dialog, a);
    await examineIn(dialog, b);
    expect(panelIn(dialog()).dataset.left).toBe('0');
    expectCardLines(panelIn(dialog()).querySelector(`.gu-obs[data-obj="${b}"]`)!, b, r, `방장 r${r}`);
    snaps[`r${r}-own-after`] = normalize(htmlOf(panelIn(dialog())), code, true);
    await tap(tiles('gu-place-tile', dialog())[0]);
    await tap(within(dialog()).getByRole('button', { name: /조사하기/ }));
    expect(qdialog()).toBeNull();
    snaps[`r${r}-own-obs`] = normalize(screen.getByRole('region', { name: `${GUIDE.obsHead} · 조사 ${r}` }).outerHTML, code, true);
    await tap(btn('진행'));
    // 방장이 살펴본 뒤에도 공용 무대엔 관찰 0
    expectPublicClean(document.body, `방장 r${r} 현장(살펴본 뒤)`);
    shot(`r${r}-scene-after`);
    await tap(btn(/고르기 \d+분 시작/));
    expect(document.querySelector('svg.gu-scene-art'), `r${r} 고르기 무대엔 그림 없음`).toBeNull();
    expectPublicClean(document.body, `방장 r${r} 고르기`);
    shot(`r${r}-select`);
    await tap(btn(/토론 \d+분 시작/));
    expectPublicClean(document.body, `방장 r${r} 토론`);
    shot(`r${r}-discuss`);
    if (r < 3) await tap(btn(r === 1 ? /둘째 조사 시작/ : /셋째 조사 시작/));
  }
  await tap(btn('메뉴'));
  await tap(btn(GUIDE.bigScreenMenu));
  expectPublicClean(dialog(), '큰 화면 주소 시트');
  shot('bigscreen-sheet', dialog());
  return snaps;
}

describe('QA7-1 방장 스윕 — 방장 역할만 바꾼 같은 판, 조사 1~3 이동 연출 · 본인 살펴보기 · 고르기 · 토론', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: DOM 이 방장 역할과 무관하게 같고, 공용 무대 관찰 글 0 · 범인 전용 문자열 0 · .gu-sealed 0`, async () => {
      const banned = culpritOnlyStrings();
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        runs.push({ role, snaps: await hostSweep(codeWith(n, role, 1)) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(Object.keys(base.snaps).length).toBe(3 * 7 + 1);
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

// ═══════════════════════════════ 2. 플레이어 스윕 ═══════════════════════════════

async function playerSweep(code: string): Promise<Record<string, string>> {
  await joinAsPlayer(code, 2);
  const snaps: Record<string, string> = {};
  const shotPanel = (k: string) => (snaps[k] = normalize(htmlOf(panelIn(document)), code, true));
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
    const stop = sceneStop(c, r)!;
    expect(panelIn(document).getAttribute('aria-label')).toBe(`${GUIDE.examineHead} · ${stop.placeName}`);
    expect(panelIn(document).dataset.left).toBe('2');
    for (const l of LINES) expect(document.body.innerHTML.includes(probe(l.text)), `플레이어 r${r} 살펴보기 전 「${probe(l.text)}」`).toBe(false);
    shotPanel(`r${r}-before`);
    const [a, b] = pickOf(r);
    await examineIn(() => document, a);
    expectCardLines(panelIn(document).querySelector(`.gu-obs[data-obj="${a}"]`)!, a, r, `플레이어 r${r}`);
    expectRoundLocked(document.body, r, `플레이어 r${r} 하나 본 뒤`);
    shotPanel(`r${r}-one`);
    await examineIn(() => document, b);
    expectCardLines(panelIn(document).querySelector(`.gu-obs[data-obj="${b}"]`)!, b, r, `플레이어 r${r}`);
    expect(panelIn(document).dataset.left).toBe('0');
    expect(panelIn(document).querySelectorAll('.gu-scene-spot[data-locked]')).toHaveLength(3);
    expectRoundLocked(document.body, r, `플레이어 r${r} 소진`);
    shotPanel(`r${r}-spent`);
    await tap(tiles('gu-place-tile')[0]);
    await tap(btn(/조사하기/));
    const mine = screen.getByRole('region', { name: `${GUIDE.obsHead} · 조사 ${r}` });
    expect(mine.querySelectorAll('.gu-obs')).toHaveLength(2);
    for (const l of LINES) expect(mine.innerHTML.includes(probe(l.text)), `r${r} 단서 아래(가려짐) 「${probe(l.text)}」`).toBe(false);
    snaps[`r${r}-clue-obs`] = normalize(mine.outerHTML, code, true);
  }
  await tap(btn(/^단서함/));
  snaps['clues-obs'] = Array.from(document.querySelectorAll('.gu-obslist'))
    .map((e) => normalize(e.outerHTML, code, true))
    .join('\n');
  expect(document.querySelectorAll('.gu-obslist')).toHaveLength(3);
  return snaps;
}

describe('QA7-2 플레이어 스윕 — 자리 2 역할만 바꾼 같은 판, 게이트 버튼만으로 조사 1~3 살펴보기', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 살펴보기 전·후·소진·「내가 본 관찰」 DOM 이 역할과 무관하게 같고, 범인 전용 문자열 0 · 라운드 잠금`, async () => {
      const banned = culpritOnlyStrings();
      const runs: { role: string; snaps: Record<string, string> }[] = [];
      for (const role of castFor(c, n)) {
        runs.push({ role, snaps: await playerSweep(codeWith(n, role, 2)) });
        cleanup();
        window.localStorage.clear();
        vi.setSystemTime(START);
      }
      const [base, ...rest] = runs;
      expect(Object.keys(base.snaps)).toHaveLength(3 * 4 + 1);
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

// ═══════════════════════════════ 3. 뒤로 가기 · 봉인 ═══════════════════════════════

describe('QA7-3 뒤로 가면 그 라운드로 — 조사 3 줄이 다시 숨는다 · 관찰 카드는 시트가 열리면 즉시 가려진다', () => {
  it('플레이어: 조사 3 에서 꿀단지를 본 뒤 단계 맞추기로 조사 1 → 조사 3 줄 0 · 다시 조사 3 이면 그 기록 그대로', async () => {
    await joinAsPlayer(codeWith(5, 'consort', 2), 2);
    await syncTo(/^조사 3/);
    await examineIn(() => document, 'OB-DG4');
    const r3 = probe(LINES.find((l) => l.objectId === 'OB-DG4' && l.fromRound === 3)!.text);
    expect(document.body.innerHTML).toContain(r3);
    await syncTo(/^조사 1/);
    expectRoundLocked(document.body, 1, '플레이어 조사 3 → 1');
    expect(panelIn(document).dataset.left).toBe('2'); // 조사 1 기록은 따로
    await tap(btn(/^단서함/));
    expect(document.querySelectorAll('.gu-obslist')).toHaveLength(0);
    expectRoundLocked(document.body, 1, '플레이어 조사 3 → 1 단서함');
    await tap(btn('지금'));
    await syncTo(/^조사 3/);
    expect(panelIn(document).dataset.left).toBe('1');
    const card = panelIn(document).querySelector('.gu-obs[data-obj="OB-DG4"]')!;
    expect(card.hasAttribute('data-open')).toBe(false);
    await tap(card);
    expect(panelIn(document).innerHTML).toContain(r3);
  });

  it('방장: 조사 2 현장 → ↶ → 조사 1 토론 · 단계 맞추기 조사 3 → 1 어디에도 관찰 글 0', async () => {
    await hostRecover(codeWith(6, 'queen', 1));
    await syncTo(/^자기소개/);
    await tap(btn(/첫째 조사 시작/));
    await tap(btn(/고르기 \d+분 시작/));
    await tap(btn(/토론 \d+분 시작/));
    await tap(btn(/둘째 조사 시작/));
    expect(hostSlot().textContent).toContain('내의원');
    await tap(document.querySelector('.gu-header-left button[aria-label="되돌리기"]'));
    expect(screen.getByRole('heading', { name: /조사 1 · 토론/ })).toBeInTheDocument();
    expectPublicClean(document.body, '↶ 뒤 조사 1 토론');
    await syncTo(/^조사 3/);
    expectPublicClean(document.body, '단계 맞추기 조사 3');
    await syncTo(/^조사 1/);
    expectPublicClean(document.body, '단계 맞추기 조사 3 → 1');
  });

  it('관찰 카드가 열린 채 배치도 시트를 열면 즉시 가려지고(글 DOM 0), 닫아도 가려진 채다', async () => {
    await joinAsPlayer(codeWith(6, 'eunuch', 2), 2);
    await syncTo(/^조사 1/);
    await examineIn(() => document, 'OB-DG5');
    const line = probe(LINES.find((l) => l.objectId === 'OB-DG5' && l.fromRound === 1)!.text);
    expect(document.querySelector('.gu-obs[data-open]')).not.toBeNull();
    expect(document.body.innerHTML).toContain(line);
    await tap(btn(GUIDE.mapLink));
    expect(qdialog()).not.toBeNull();
    expect(document.querySelector('.gu-obs[data-open]')).toBeNull();
    expect(document.body.innerHTML).not.toContain(line);
    await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    expect(document.querySelector('.gu-obs[data-open]')).toBeNull();
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
  const check = (r: 1 | 2 | 3, where: string) => {
    const stop = sceneStop(c, r)!;
    expect(btn(['첫째', '둘째', '셋째'][r - 1] + ' 조사').getAttribute('aria-pressed'), where).toBe('true');
    expect(root().querySelector(`section.gu-move[data-round="${r}"]`), where).not.toBeNull();
    expect(root().textContent).toContain(stop.placeName);
    expect(root().textContent).toContain(stop.cue);
    expectPublicClean(document.body, where);
  };
  // 큰 화면엔 방 코드·자리·역할이 없다(표식만)
  expect(root().textContent).not.toContain(code ?? '§');
  check(1, `큰 화면 ${code} r1`);
  snaps.r1 = norm(document.body.innerHTML);
  // ② 확인 — 「아직이오」면 그대로 조사 1
  await tap(btn('둘째 조사'));
  expect(dialog().textContent).toContain('둘째 조사 현장을 열겠소?');
  await tap(within(dialog()).getByRole('button', { name: '아직이오' }));
  check(1, `큰 화면 ${code} 아직이오`);
  // ③ 바로 열기도 확인
  await tap(btn('셋째 조사'));
  await tap(within(dialog()).getByRole('button', { name: '열겠소' }));
  check(3, `큰 화면 ${code} r3`);
  snaps.r3 = norm(document.body.innerHTML);
  // 이미 연 라운드 이하는 확인 없이
  await tap(btn('둘째 조사'));
  expect(qdialog()).toBeNull();
  check(2, `큰 화면 ${code} r3 → r2`);
  snaps.r2 = norm(document.body.innerHTML);
  return snaps;
}

describe('QA7-4 큰 화면(/gung/scene) — 코드만 다른 모든 판에서 같은 이동 연출 · 관찰 0 · 게임 저장 무관', () => {
  it('4·5·6인 × 범인 자리 전부(코드 18개)에서 DOM 이 같고, 관찰 글·물건 이름표·범인 전용 문자열·역할명 0, gu:game:v1 무접촉', async () => {
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
      const game = JSON.stringify({ v: 1, code, phase: 'r3', role: 'host', examined: { 1: ['OB-DG1'] } });
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
        for (const nm of roleNames) expect(t, `${codes[i]} ${k} 역할명 ${nm}`).not.toContain(nm);
        for (const nm of OBJECT_NAMES) expect(t, `${codes[i]} ${k} 물건 ${nm}`).not.toContain(nm);
      }
      for (const k of Object.keys(runs[0])) expect(r[k], `${codes[i]} vs ${codes[0]} · ${k}`).toBe(runs[0][k]);
    }
  }, 240_000);

  it('코드 없이 열어도 이동 연출은 같고 사건 표식만 없다 · 틀린 코드는 안내 한 줄', async () => {
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
    expect(document.querySelector('svg.gu-scene-art')).not.toBeNull();
  });
});

describe('QA7-4b 큰 화면 조사 칩 기록은 그 방 코드에만 — 다른 판(코드 없음 ↔ 코드)으로 넘어가면 조사 1 부터 확인을 다시 거친다', () => {
  async function openBig(code: string | null) {
    search = code ? `code=${code}` : '';
    render(<SceneStandalone />);
    await flush();
  }
  async function toRound3() {
    await tap(btn('셋째 조사'));
    await tap(within(dialog()).getByRole('button', { name: '열겠소' }));
    expect(btn('셋째 조사').getAttribute('aria-pressed')).toBe('true');
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
      expect(document.querySelector('section.gu-move[data-round="1"]')).not.toBeNull();
      await tap(btn('둘째 조사'));
      expect(qdialog(), '②는 다시 확인').not.toBeNull();
    });
  }
  it('같은 코드로 다시 열면(새로고침) 연 조사가 그대로 · 깨진 기록은 버린다', async () => {
    clearSceneStore();
    await openBig('7F3K5');
    await toRound3();
    cleanup();
    await openBig('7F3K5');
    expect(btn('셋째 조사').getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(window.localStorage.getItem(SCENE_STORE_KEY)!)).toMatchObject({ v: 2, code: '7F3K5', round: 3, opened: 3 });
    cleanup();
    clearSceneStore();
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify({ v: 2, code: '7F3K5', at: Date.now(), round: 3, opened: 2 })); // round > opened
    await openBig('7F3K5');
    expect(btn('첫째 조사').getAttribute('aria-pressed')).toBe('true');
  });
});

// ═══════════════════════════════ 5. 공유·의존 ═══════════════════════════════

/** 로컬 import 그래프(정적 분석) — '@/…'·상대 경로만 따라간다 */
function importGraph(entry: string): Set<string> {
  const SRC = resolve(__dirname, '../../..');
  const seen = new Set<string>();
  const resolveSpec = (from: string, spec: string): string | null => {
    let base: string;
    if (spec.startsWith('@/')) base = resolve(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
    else return null;
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (existsSync(cand) && !cand.endsWith('/')) {
        try {
          readFileSync(cand, 'utf8');
          return cand;
        } catch {
          /* 디렉터리 */
        }
      }
    }
    return null;
  };
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/^(?:import|export)\s+(type\s+)?[^;]*?from\s+'([^']+)';/gm)) {
      if (m[1]) continue; // 타입만 import 는 번들에 실리지 않는다
      const next = resolveSpec(file, m[2]);
      if (next) walk(next);
    }
  };
  walk(entry);
  return seen;
}

describe('QA7-5 큰 화면 공유 문구 · /gung/scene 의존 그래프', () => {
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

  it('/gung/scene 페이지가 끌어오는 모듈에 사건 데이터·현장 엔진·배정·봉인·게임 저장이 없다(관찰 누출 차단)', () => {
    const files = [...importGraph(resolve(__dirname, '../scene/page.tsx'))].map((f) => f.split('/src/')[1]);
    expect(files).toContain('app/gung/scene/SceneStandalone.tsx');
    expect(files).toContain('app/gung/screens/SceneMove.tsx');
    expect(files).toContain('lib/gung/scene-route-data.ts');
    for (const bad of ['lib/gung/case-data.ts', 'lib/gung/scene.ts', 'lib/gung/index.ts', 'lib/gung/assign.ts', 'lib/gung/seal.ts', 'lib/gung/game.ts', 'lib/gung/storage.ts', 'lib/gung/deck.ts', 'lib/gung/case-extras.ts', 'app/gung/screens/ExaminePanel.tsx']) {
      expect(files, bad).not.toContain(bad);
    }
  });
});

// ═══════════════════════════════ 6. 술자리 가독성(CSS 바닥) ═══════════════════════════════

describe('QA7-6 현장 글자 14px 바닥 · 터치 56px', () => {
  const css = readFileSync(resolve(__dirname, '../gung.css'), 'utf8');
  const rule = (sel: string, from = 0) => {
    const i = css.indexOf(`${sel} {`, from);
    expect(i, sel).toBeGreaterThanOrEqual(0);
    return css.slice(i, css.indexOf('}', i));
  };
  it('그림 이름표: 캔버스 300px 이상이면 14px 바닥(360 폰 살펴보기 캔버스 302px 포함) · 핫스팟 56px', () => {
    // QA 7판 BUG-V7-01: 문턱이 320px 이면 360·375 폰(살펴보기 캔버스 302·317px)이 12px 로 떨어진다
    const at = css.indexOf('@container (min-width: 300px)');
    expect(at).toBeGreaterThan(0);
    expect(rule('.gu-scene-spot', at)).toContain('clamp(14px, 3.8cqw, 26px)');
    expect(rule('.gu-scene-spot')).toContain('min-width: 56px; min-height: 56px');
  });
  it('관찰 카드 줄 18px · 장소·조사 꼬리표·남은 횟수·이동 안내는 14px 이상 · 큰 화면 시트 안내 14px 바닥', () => {
    expect(rule('.gu-obs-line-text')).toContain('font-size: 18px');
    for (const sel of ['.gu-obs-where', '.gu-obs-line-round', '.gu-examine-kicker', '.gu-move-kicker', '.gu-obs-foot']) {
      expect(rule(sel), sel).toContain('font-size: var(--gu-fs-caption)'); // 14px
    }
    for (const sel of ['.gu-examine-left', '.gu-move-examine', '.gu-obs-sealed', '.gu-examine-hint']) {
      expect(rule(sel), sel).toContain('font-size: var(--gu-fs-small)'); // 15px
    }
    expect(css).toContain('--gu-fs-caption: 14px;');
    expect(rule('.gu-bigscreen-note')).toContain('max(14px');
    expect(rule('.gu-examine-act')).toContain('min-height: 56px');
  });
});
