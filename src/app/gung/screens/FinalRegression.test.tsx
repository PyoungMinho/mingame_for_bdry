// @vitest-environment jsdom
/**
 * @QA실행자 — /gung 최종 회귀(3차) · 이번 수정 핵심을 **화면 레벨에서 독립 재확인**.
 * 기존 RoleNeutral·GungApp.qa 테스트의 코드 탐색식·탭 순서를 쓰지 않는다(시드 난수 코드, 롤콜 전원·자기소개 전원·↶·O1 왕복·
 * 동률 → 재지목 경로). 엔진 레벨 짝: src/lib/gung/final-regression.test.ts
 *
 *  (a) 4·5·6인 × 방장 역할 전부 — 조사 1 ~ 진상 직전(「진상을 공개하겠소?」)까지 방장 공용 화면 텍스트·DOM 이 역할과 무관하게 같다
 *  (b) 봉인 화면 — 범인 자리와 무고 자리가 같다(4·5·6인 × 플레이어 전 자리, 꾹/탭 두 방식, 패 확인·자기소개·단서·조사 3 알림 뒤 / 방장 자리)
 *  (c) 자리 비우기 → 결과 → ↶ 반복 — 범인을 비운 판과 무고를 비운 판이 진상 전까지 화면이 같다(진상 뒤에만 '판결 없음(범인 자리 비움)')
 *  (d) R3 전 기억 비노출 · R3 후 노출 — 4·5·6인(5·6인 기억 보유 역할 플레이어·방장, 4·5인 NPC 진술 ③), O1 앞뒤 이동 포함
 *  (e) 결과 공유 — 카카오 템플릿·Web Share·클립보드·미리보기·프리워밍·OG 이미지 트리에 범인·방 코드 없음
 *
 * 비교 정규화: 코드마다 다른 방 코드·사건 표식만 자리표시자. 자기소개 뒤(D16 공개)엔 "자리 k 의 역할명"을 ‹Rk›로(자리 기준이라
 * 범인과 엮인 표시는 자리가 달라 그대로 걸린다). 공용 카드·출입 타임라인·용어·보너스 보기처럼 인원만으로 정해지는 원문 속 이름은 건드리지 않는다.
 * 토스트는 실제 시간(setTimeout)으로 사라져 시점 비교가 흔들리므로 DOM 비교에서 떼어 두 쪽에 다 있을 때만 글을 비교한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  assignFromCode,
  cardsAtPlace,
  castFor,
  formatRoomCode,
  hash32,
  makeRng,
  parseRoomCode,
  publicSeats,
  roundPlaces,
  SEED_ALPHABET,
  type Assignment,
  type PlayerCount,
  type RoundNo,
} from '@/lib/gung';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GungApp } from './GungApp';

const ogTrees: unknown[] = [];
vi.mock('next/og', () => ({
  ImageResponse: class {
    headers = new Headers();
    constructor(el: unknown) {
      ogTrees.push(el);
    }
  },
}));

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
  vi.unstubAllGlobals();
});

// ─────────────────────────────── 공통 도구 ───────────────────────────────

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
const headerUndo = () => document.querySelector<HTMLElement>('.gu-header-iconbtn[aria-label="되돌리기"]');
const seatNode = (seat: number) => screen.getAllByRole('button').find((b) => b.className.includes('gu-seat-node') && b.textContent?.startsWith(String(seat)));
const sealedSurface = () => document.querySelector<HTMLElement>('.gu-rolecard .gu-sealed-surface');

function resetBetweenRuns() {
  cleanup();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/gung');
  vi.setSystemTime(START);
}

/** 시드 난수 코드 탐색(기존 테스트의 탐색식과 다른 경로) */
function findCode(n: PlayerCount, salt: string, pred: (a: Assignment) => boolean): string {
  const rng = makeRng(hash32(`final-ui:${salt}:${n}`));
  for (let i = 0; i < 60_000; i++) {
    let s = '';
    for (let k = 0; k < 4; k++) s += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
    const code = `${s}${n}`;
    const a = assignFromCode(c, code)!;
    if (pred(a)) return code;
  }
  throw new Error(`no code ${n} ${salt}`);
}
const asg = (code: string) => assignFromCode(c, code)!;

const ROLE_WORDS = [...new Set(c.roles.flatMap((r) => [r.name, r.shortName ?? r.name]))].sort((x, y) => y.length - x.length);
/**
 * 공개 자리 표기(D16: 자기소개 뒤 "N번 · 역할명")가 나오는 곳 — 여기서만 역할명을 자리 기준 ‹Rk›로 바꾼다.
 * 나머지는 원문 그대로 비교한다(정규화를 좁게 할수록 놓치는 게 없다 — 다르면 그대로 걸린다).
 */
const ROLE_LABEL = '.gu-display-xl, .gu-votestepper, .gu-tally, .gu-ballotlist, .gu-h2, .gu-tiedefense, .gu-bonus-row, .gu-defense-chips';
/** ROLE_LABEL 안이라도 원문인 것(보너스 문항 보기 "세자빈·중전·숙의") */
const VERBATIM = '.gu-bonus-legend, .gu-bonus-opt';
/** 인원·장소만으로 정해지는 원문(공용 카드·타임라인·용어·시각표·브리핑·장소 이름/설명·보너스 보기) — "역할명이 없어야 한다" 검사에서 뺀다 */
const FIXED_TEXT =
  '.gu-publicclue, .gu-gatetl, .gu-terms, .gu-timetable, .gu-cluestab-public, .gu-briefing-p, .gu-placegrid, .gu-cluecard-head, .gu-bonus-legend, .gu-bonus-opt, .gu-map, .gu-aliases';
const ROLE_ICON = /lucide-(crown|flower-?2|scroll-text|pill|key-round|user-round)\b/;
const tabBtn = (label: RegExp) => within(screen.getByRole('navigation', { name: '화면 전환' })).getByRole('button', { name: label });
function textOutside(html: string, selector: string): string {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.querySelectorAll(selector).forEach((e) => e.remove());
  return d.textContent ?? '';
}

interface Shot {
  key: string;
  text: string;
  dom: string;
  toast: string | null;
}

/**
 * 지금 화면(document.body) → 비교용 텍스트·DOM.
 * roles: 자기소개 뒤 공개 정보(자리 k 역할명 → ‹Rk›, 역할 아이콘 → <role-icon>)를 정규화할지.
 * seats: 자리 번호까지 지울지(같은 판 자리끼리 비교할 때).
 */
function canon(code: string, opts: { roles?: boolean; seats?: boolean } = {}): Omit<Shot, 'key'> {
  const room = parseRoomCode(code)!;
  const clone = document.body.cloneNode(true) as HTMLElement;
  const toastEls = [...clone.querySelectorAll('.gu-toast')];
  const toast = toastEls.map((e) => e.textContent ?? '').join(' | ') || null;
  for (const e of toastEls) e.remove();
  const codeSubs: [string, string][] = [
    [formatRoomCode(code), '‹CODE›'],
    [room.display, '‹CODE›'],
    [code, '‹CODE›'],
    [room.tag, '‹TAG›'],
  ];
  const roleSubs: [string, string][] = opts.roles
    ? publicSeats(c, asg(code))
        .flatMap((s): [string, string][] => [
          [s.name, `‹R${s.seat}›`],
          [s.shortName, `‹R${s.seat}›`],
        ])
        .sort((x, y) => y[0].length - x[0].length)
    : [];
  const fix = (v: string, label: boolean) => {
    let out = v;
    for (const [a, b] of codeSubs) out = out.split(a).join(b);
    if (label) for (const [a, b] of roleSubs) out = out.split(a).join(b);
    return out;
  };
  const walk = (el: Element, label: boolean) => {
    const lb = (label || el.matches(ROLE_LABEL)) && !el.matches(VERBATIM);
    for (const attr of [...el.attributes]) {
      const next = fix(attr.value, lb);
      if (next !== attr.value) el.setAttribute(attr.name, next);
    }
    for (const child of [...el.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) child.nodeValue = fix(child.nodeValue ?? '', lb);
      else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element, lb);
    }
  };
  walk(clone, false);
  if (opts.roles) {
    for (const svg of [...clone.querySelectorAll('svg')]) {
      if (ROLE_ICON.test(svg.getAttribute('class') ?? '') && svg.closest(ROLE_LABEL)) svg.replaceWith(document.createElement('role-icon'));
    }
    // R2 「?」 시트 인물록 — '자리 → 역할'은 자기소개 뒤 공개 정보(D16)라 코드마다 순서가 다르다. 카드는 자리표시자로,
    // 내용(자리 번호를 뗀 것)은 정렬해 끝에 붙인다 — 인원 구성·문구는 그대로 비교된다
    const roster = [...clone.querySelectorAll('.gu-roster-item')];
    if (roster.length) {
      const sig = roster.map((e) => (e.textContent ?? '').replace(/^\d+번 · /, '')).sort();
      roster.forEach((e) => e.replaceWith(document.createElement('roster-item')));
      const el = document.createElement('roster-sig');
      el.textContent = sig.join('|');
      clone.appendChild(el);
    }
  }
  const post = (s: string) => {
    let out = s.replace(/(‹R\d›)[이가은는을를와과]/g, '$1‹J›');
    if (opts.seats) out = out.replace(/\d+(번)/g, 'N$1');
    return out;
  };
  return { text: post(clone.textContent ?? ''), dom: post(clone.innerHTML), toast: toast && post(fix(toast, false)) };
}

/** 두 문자열이 처음 갈라지는 곳 앞뒤(같으면 '') — 실패 메시지를 읽을 수 있게 */
function firstDiff(x: string, y: string): string {
  if (x === y) return '';
  let i = 0;
  while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return `@${i}: «${x.slice(Math.max(0, i - 60), i + 80)}» ≠ «${y.slice(Math.max(0, i - 60), i + 80)}»`;
}

/** 같은 키끼리 비교 — 텍스트(요구사항)와 DOM(구조·속성·클래스) 모두. 토스트는 둘 다 있을 때만 */
function expectSameShots(label: string, base: Shot[], other: Shot[]) {
  expect(other.map((s) => s.key), `${label} 단계 목록`).toEqual(base.map((s) => s.key));
  for (let i = 0; i < base.length; i++) {
    const b = base[i];
    const o = other[i];
    expect(firstDiff(o.text, b.text), `${label} · ${b.key} 텍스트`).toBe('');
    expect(firstDiff(o.dom, b.dom), `${label} · ${b.key} DOM`).toBe('');
    if (b.toast && o.toast) expect(o.toast, `${label} · ${b.key} 토스트`).toBe(b.toast);
  }
}

/** 이 인원·라운드에서 카드가 1장뿐인 장소(누가 골라도 같은 카드 — 자리별 배분 카드로 인한 차이를 배제) */
function singleCardPlace(n: PlayerCount, round: RoundNo) {
  const p = roundPlaces(c, round).find((x) => cardsAtPlace(c, n, round, x.id).length === 1);
  if (!p) throw new Error(`no single-card place ${n} r${round}`);
  return p;
}
const placeTile = (name: string) => screen.getAllByRole('button').find((b) => b.className.includes('gu-place-tile') && b.textContent?.includes(name));

async function hostEnter(code: string) {
  search = `code=${code}&as=host`;
  render(<GungApp />);
  await flush();
  await tap(btn(/방장으로 입장하기/));
  await tap(within(dialog()).getByRole('button', { name: '취소' })); // 복구 직후 O1
}
async function playerEnter(code: string, seat: number) {
  search = `code=${code}`;
  render(<GungApp />);
  await flush();
  await tap(btn(/^입장하기/));
  await tap(seatNode(seat));
  await tap(btn(/자리에 앉기/));
}
async function o1(label: RegExp) {
  await tap(screen.getByRole('button', { name: /진행 단계/ }));
  await tap(screen.getByRole('radio', { name: label }));
  await tap(btn(/^이동/));
}
async function dismissPeekTip() {
  const d = qdialog();
  if (d && d.getAttribute('aria-label') === '몰래 보는 법') await tap(within(d).getByRole('button', { name: '알겠소' }));
}
/** 지목 스테퍼에서 target 자리 타일 */
async function ballot(target: number) {
  const grid = screen.getByRole('group', { name: '자리 선택' });
  await tap(within(grid).getAllByRole('button').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(`${target}번`)));
}
/** 1차: 1·3→2, 2·4→3, 5→4, 6→1 → 2·3 동률(4·5·6인 모두) */
const FIRST_TIE: Record<number, number> = { 1: 2, 2: 3, 3: 2, 4: 3, 5: 4, 6: 1 };

// ═══════════════════════════════ (a) 방장 공용 화면 역할 독립 ═══════════════════════════════

/**
 * 방장 한 판 — 롤콜 전원 → 브리핑 → 패 확인 → 자기소개 전원 → 조사 1·2·3(장소 고름·토론) — 조사 3 에선 ↶ 왕복과 O1 왕복(확인 시트)·용어 시트 —
 * 최종 변론 전원 → 셋 세기 → 1차 동률 → 동률 변론 타이머 → 재지목 → 「진상을 공개하겠소?」 확인 시트(진상 직전)까지.
 */
async function hostPublicRun(code: string): Promise<{ pre: Shot[]; stage: Shot[] }> {
  const n = asg(code).n;
  await hostEnter(code);
  const pre: Shot[] = [];
  const stage: Shot[] = [];
  const snapPre = (key: string) => pre.push({ key, ...canon(code) });
  const snap = (key: string) => stage.push({ key, ...canon(code, { roles: true }) });

  snapPre('lobby');
  for (let s = 2; s <= n; s++) await tap(seatNode(s));
  snapPre('lobby-rollcall');
  await tap(btn(/사건 시작/));
  expect(qdialog()).toBeNull(); // 전원 확인했으니 확인창 없음
  snapPre('briefing');
  await tap(btn(/다 읽었소/));
  snapPre('cards');
  await tap(btn(/다 봤소/));
  snapPre('intro');
  for (let i = 2; i <= n; i++) {
    await tap(btn(/^다음 사람/));
    snapPre(`intro-${i}`);
  }
  await tap(btn(/첫째 조사 시작/));

  for (const r of [1, 2, 3] as RoundNo[]) {
    snap(`r${r}-select`);
    if (r === 3) {
      await tap(headerUndo()); // ↶ → 조사 2 토론
      snap('r3-undo');
      await tap(btn(/셋째 조사 시작/));
      snap('r3-again');
      await o1(/^조사 2/); // 뒤로 한 단계는 확인 없이
      snap('r3-o1-back');
      await o1(/^조사 3/);
      snap('r3-o1-confirm'); // 조사 진입 확인 시트
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      snap('r3-o1-again');
      await tap(btn('궁 배치도·시각표·인물·용어'));
      snap('r3-terms');
      await tap(within(dialog()).getByRole('button', { name: '닫기' }));
    }
    // 개선 묶음 1 G2: 고르기 타이머는 낭독 뒤 방장이 시작한다(라운드 진입·O1 진입 모두 멈춘 채)
    await tap(btn(/다 읽었소 → 고르기 2분 시작/));
    snap(`r${r}-timer`);
    // G2: 방장 본인 조사는 공용 무대가 아니라 단서함(사적 탭)에서 고른다 — 무대엔 장소 타일·봉인 카드가 없다
    expect(document.querySelectorAll('.gu-sealed, .gu-place-tile')).toHaveLength(0);
    const place = singleCardPlace(n, r);
    await tap(tabBtn(/단서함/));
    const nows = screen.getAllByRole('button', { name: '지금 고르기' });
    await tap(nows[nows.length - 1]);
    await tap(within(dialog()).getAllByRole('button').find((b) => b.className.includes('gu-place-tile') && b.textContent?.includes(place.name)));
    await tap(within(dialog()).getByRole('button', { name: new RegExp(`${place.name} 조사하기`) }));
    await tap(tabBtn(/^진행/));
    snap(`r${r}-picked`);
    await tap(btn(/토론 \d+분 시작/));
    snap(`r${r}-discuss`);
    await tap(btn(r < 3 ? /조사 시작/ : /최종 변론으로/));
  }
  snap('defense-1');
  for (let i = 2; i <= n; i++) {
    await tap(btn(/^다음 사람/));
    snap(`defense-${i}`);
  }
  await tap(btn(/지목하러/));
  snap('vote-ready');
  await tap(btn(/셋 세기 시작/));
  snap('countdown');
  await tap(btn('건너뛰기'));
  snap('vote-input');
  for (let v = 1; v <= n; v++) {
    await ballot(FIRST_TIE[v]);
    snap(`ballot-${v}`);
  }
  snap('tally');
  await tap(btn(/동률 변론 30초 타이머 시작/));
  snap('tie-timer');
  await tap(btn(/재지목 시작/));
  snap('revote');
  for (let v = 1; v <= n; v++) {
    await ballot(v === 2 ? 3 : 2);
    snap(`reballot-${v}`);
  }
  snap('final');
  await tap(btn(/진상 공개/));
  snap('reveal-confirm'); // ← 진상 직전
  return { pre, stage };
}

describe('(a) 방장 공용 화면 — 4·5·6인 × 방장 역할 전부, 조사 1 ~ 진상 직전 텍스트·DOM 동일', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 방장(자리 1) 역할 ${n}가지 — 조사 1 ~ 「진상을 공개하겠소?」까지 단계마다 같다 · 자기소개 전엔 역할명이 아예 없다`, async () => {
      const runs: { role: string; pre: Shot[]; stage: Shot[] }[] = [];
      for (const role of castFor(c, n)) {
        const code = findCode(n, `a-${role}`, (a) => a.seats[0] === role);
        runs.push({ role, ...(await hostPublicRun(code)) });
        resetBetweenRuns();
      }
      expect(runs.map((r) => r.role).sort()).toEqual(castFor(c, n).slice().sort());
      const [base, ...rest] = runs;
      const at = (key: string) => base.stage.find((s) => s.key === key)!.text;
      // 탐침 유효성 — 실제로 그 화면들을 찍었다
      expect(at('r1-select')).toContain(c.rounds[0].publicCards![0].title);
      expect(at('r3-select')).toContain('셋째 조사 — 각자 내 패를 다시 확인하시오');
      expect(at('r3-undo')).not.toContain('셋째 조사 — 각자');
      expect(at('r3-again')).toContain('셋째 조사 — 각자 내 패를 다시 확인하시오');
      expect(at('r3-o1-confirm')).toContain('셋째 조사로 넘어가겠소?');
      expect(at('tally')).toContain('동률');
      expect(at('final')).toContain('재지목 집계');
      // R7: 보너스를 하나도 적지 않은 판이라 진상 직전 확인은 「보너스 없이 공개하겠소?」
      expect(at('reveal-confirm')).toContain('보너스 없이 공개하겠소?');
      expect(at('defense-1')).toContain('‹R1›');
      for (const r of runs) {
        // 자기소개 전 방장 무대엔 역할명이 없다(브리핑 낭독문의 {{cast}} 는 인원별 고정 원문이라 제외)
        for (const s of r.pre) {
          const t = textOutside(s.dom, FIXED_TEXT);
          expect(ROLE_WORDS.filter((w) => t.includes(w)), `${n}인 방장=${r.role} · ${s.key}`).toEqual([]);
        }
        for (const s of r.stage) expect(s.text, `${n}인 방장=${r.role} · ${s.key}`).not.toMatch(/새 기억|떠오르는 기억|떠올랐소|활맥/);
      }
      for (const r of rest) {
        expectSameShots(`${n}인 방장=${r.role} vs ${base.role} (준비)`, base.pre, r.pre);
        expectSameShots(`${n}인 방장=${r.role} vs ${base.role}`, base.stage, r.stage);
      }
    }, 120_000);
  }
});

// ═══════════════════════════════ (b) 봉인 화면 — 범인 = 무고 ═══════════════════════════════

/** 지금 탭의 내 패 7섹션 봉인 화면(쪽 나눔 폐지 — 섹션마다 한 번 열어 전체를 한 번에 본다) */
async function sealedSections(code: string, out: string[], tag: string) {
  for (const tab of ['정체', '신분', '비밀', '그날 밤', '거짓말', '미션', '말투']) {
    await tap(screen.getByRole('tab', { name: tab }));
    out.push(`${tag}/${tab}/0\n${canon(code, { seats: true }).dom}`);
  }
}

async function playerSealedRun(code: string, seat: number): Promise<string[]> {
  const n = asg(code).n;
  const out: string[] = [];
  await playerEnter(code, seat);
  await tap(btn(/사건 시작됐어요/));
  await tap(btn(/내 패 확인하기/));
  await dismissPeekTip();
  await sealedSections(code, out, 'cards-hold');
  // 보기 방식 → 탭(15초)
  await tap(btn('메뉴'));
  await tap(btn(/보기 방식/));
  await sealedSections(code, out, 'cards-tap');
  await tap(btn(/자기소개 시작됐어요/));
  out.push(`intro\n${canon(code, { seats: true }).dom}`);
  await tap(btn(/1라운드 시작됐어요/));
  await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
  const place = singleCardPlace(n, 1);
  await tap(placeTile(place.name));
  await tap(btn(new RegExp(`${place.name} 조사하기`)));
  out.push(`r1-clue\n${canon(code, { seats: true }).dom}`);
  await tap(tabBtn(/단서함/));
  out.push(`r1-cluestab\n${canon(code, { seats: true }).dom}`);
  await tap(tabBtn(/^지금/));
  await o1(/^조사 3/);
  await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
  out.push(`r3-notice\n${canon(code, { seats: true }).dom}`);
  await tap(btn(/지금 확인하기/));
  out.push(`r3-focus\n${canon(code, { seats: true }).dom}`);
  await sealedSections(code, out, 'r3');
  return out;
}

async function hostSealedRun(code: string): Promise<string[]> {
  const out: string[] = [];
  await hostEnter(code);
  await o1(/^패 확인/);
  await tap(within(dialog()).getByRole('button', { name: /가겠소/ }));
  await tap(tabBtn(/^내 패/));
  await dismissPeekTip();
  await sealedSections(code, out, 'host-cards');
  await tap(tabBtn(/^진행/));
  await o1(/^조사 3/);
  await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
  await tap(btn(/지금 확인하기/));
  out.push(`host-r3-focus\n${canon(code).dom}`);
  await sealedSections(code, out, 'host-r3');
  return out;
}

describe('(b) 봉인 화면 — 범인 자리와 무고 자리가 같다', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 플레이어 자리 2..${n}(범인 포함) — 꾹·탭 두 방식 × 7섹션 × 쪽 넘김, 자기소개 카드, 단서 카드, 조사 3 알림·내 패 이동 뒤까지 자리 번호만 빼고 같다`, async () => {
      const code = findCode(n, 'b-player', (a) => a.culpritSeat >= 2 && a.culpritSeat < n);
      const a = asg(code);
      const runs: { seat: number; shots: string[] }[] = [];
      for (let seat = 2; seat <= n; seat++) {
        runs.push({ seat, shots: await playerSealedRun(code, seat) });
        resetBetweenRuns();
      }
      const culprit = runs.find((r) => r.seat === a.culpritSeat)!;
      const innocents = runs.filter((r) => r.seat !== a.culpritSeat);
      // 쪽 나눔 폐지로 섹션당 한 번씩만 찍는다(7섹션 × cards-hold/cards-tap/r3 = 21) + 자기소개·단서·조사3 알림 등
      expect(culprit.shots.length).toBeGreaterThan(20);
      // 탐침 유효성 — 봉인 카드를 실제로 찍었고, 그 안엔 역할 글이 없다
      const sectionShots = culprit.shots.filter((s) => s.slice(0, s.indexOf('\n')).split('/').length >= 3);
      expect(sectionShots.length).toBeGreaterThan(15);
      expect(sectionShots.every((s) => s.includes('gu-sealed-surface'))).toBe(true);
      for (const s of culprit.shots) {
        const t = textOutside(s.slice(s.indexOf('\n') + 1), FIXED_TEXT);
        expect(ROLE_WORDS.filter((w) => t.includes(w)), s.slice(0, s.indexOf('\n'))).toEqual([]);
        expect(t, s.slice(0, s.indexOf('\n'))).not.toMatch(/범인|\d+\/\d+|떠오르/);
      }
      for (const r of innocents) {
        for (let i = 0; i < culprit.shots.length; i++) {
          expect(r.shots[i], `${n}인 무고 ${r.seat}번 vs 범인 ${a.culpritSeat}번 · ${culprit.shots[i].slice(0, culprit.shots[i].indexOf('\n'))}`).toBe(culprit.shots[i]);
        }
        expect(r.shots.length).toBe(culprit.shots.length);
      }
    }, 120_000);

    it(`${n}인: 방장 자리 — 방장이 범인(숙의)인 판과 무고인 판의 '내 패' 봉인 화면(패 확인 · 조사 3 알림 뒤)이 같다`, async () => {
      const guilty = findCode(n, 'b-host-g', (a) => a.culpritSeat === 1);
      const innocent = findCode(n, 'b-host-i', (a) => a.culpritSeat !== 1);
      const g = await hostSealedRun(guilty);
      resetBetweenRuns();
      const i = await hostSealedRun(innocent);
      expect(g.length).toBe(i.length);
      // 쪽 나눔 폐지로 섹션당 한 번씩만 찍는다(7섹션 × host-cards/host-r3 = 14) + r3 알림 포커스
      expect(g.length).toBeGreaterThan(10);
      for (let k = 0; k < g.length; k++) expect(i[k], g[k].slice(0, g[k].indexOf('\n'))).toBe(g[k]);
    }, 60_000);
  }
});

// ═══════════════════════════════ (c) 자리 비우기 · 되돌리기 ═══════════════════════════════

async function absentCycle(code: string, seat: number, shots: Shot[], sheetTexts: string[], tag: string) {
  await tap(btn('메뉴'));
  await tap(btn('자리 비우기'));
  const d = dialog();
  sheetTexts.push(`${tag}/pick ${d.textContent}`);
  await tap(within(d).getAllByRole('button').find((b) => b.className.includes('gu-seatchip') && b.textContent === String(seat)));
  await tap(within(dialog()).getByRole('button', { name: '비우기' }));
  sheetTexts.push(`${tag}/confirm ${dialog().textContent?.split(String(seat)).join('S')}`);
  shots.push({ key: `${tag}/confirm`, ...canon(code, { roles: true }) });
  await tap(within(dialog()).getByRole('button', { name: new RegExp(`${seat}번 비우겠소`) }));
  sheetTexts.push(`${tag}/result ${dialog().textContent?.split(String(seat)).join('S')}`);
  shots.push({ key: `${tag}/result`, ...canon(code, { roles: true }) });
  await tap(within(dialog()).getByRole('button', { name: '알겠소' }));
  shots.push({ key: `${tag}/absent`, ...canon(code, { roles: true }) });
  await tap(headerUndo());
  shots.push({ key: `${tag}/undone`, ...canon(code, { roles: true }) });
}

/** 같은 인원·같은 방장 역할(중전) — 자리 비우기를 단계마다 자리 2..n 전부 2회씩 반복 */
async function absentRepeatRun(code: string): Promise<{ shots: Shot[]; sheets: string[]; savedAbsent: number[]; savedBallots: number }> {
  const n = asg(code).n;
  const shots: Shot[] = [];
  const sheets: string[] = [];
  await hostEnter(code);
  for (let s = 2; s <= n; s++) await tap(seatNode(s));
  await tap(btn(/사건 시작/));
  await tap(btn(/다 읽었소/));
  const cycleAll = async (tag: string) => {
    shots.push({ key: `${tag}/before`, ...canon(code, { roles: true }) });
    for (let rep = 0; rep < 2; rep++) for (let seat = 2; seat <= n; seat++) await absentCycle(code, seat, shots, sheets, `${tag}/${seat}/${rep}`);
  };
  await cycleAll('cards');
  await tap(btn(/다 봤소/));
  await tap(btn(/^다음 사람/));
  await cycleAll('intro');
  await tap(btn(/첫째 조사 시작/));
  await tap(btn(/토론 \d+분 시작/));
  await tap(btn(/둘째 조사 시작/));
  await tap(btn(/토론 \d+분 시작/));
  await cycleAll('r2-discuss');
  await tap(btn(/셋째 조사 시작/));
  await tap(btn(/토론 \d+분 시작/));
  await tap(btn(/최종 변론으로/));
  await tap(btn(/^다음 사람/));
  await cycleAll('defense');
  for (let i = 3; i <= n; i++) await tap(btn(/^다음 사람/));
  await tap(btn(/지목하러/));
  await tap(btn(/셋 세기 시작/));
  await tap(btn('건너뛰기'));
  await ballot(FIRST_TIE[1]);
  await ballot(FIRST_TIE[2]);
  await cycleAll('vote-input');
  for (let v = 3; v <= n; v++) await ballot(FIRST_TIE[v]);
  await cycleAll('vote-tally');
  const saved = JSON.parse(window.localStorage.getItem('gu:game:v1') ?? 'null');
  return { shots, sheets, savedAbsent: saved?.host?.absentSeats ?? null, savedBallots: Object.keys(saved?.host?.vote?.first ?? {}).length };
}

/** 자리 3을 비운 채(되돌리지 않고) 끝까지 — 진상 전 단계 화면 + 진상 비트(범인 비트 전까지) */
async function absentKeepRun(code: string): Promise<{ pre: Shot[]; beats: Shot[]; culpritBeat: string; verdict: string; result: string; shareButtons: number }> {
  const n = asg(code).n;
  const pre: Shot[] = [];
  const beats: Shot[] = [];
  const snap = (key: string) => pre.push({ key, ...canon(code, { roles: true }) });
  await hostEnter(code);
  for (let s = 2; s <= n; s++) await tap(seatNode(s));
  await tap(btn(/사건 시작/));
  await tap(btn(/다 읽었소/));
  await tap(btn(/다 봤소/));
  await tap(btn('메뉴'));
  await tap(btn('자리 비우기'));
  await tap(within(dialog()).getAllByRole('button').find((b) => b.className.includes('gu-seatchip') && b.textContent === '3'));
  await tap(within(dialog()).getByRole('button', { name: '비우기' }));
  await tap(within(dialog()).getByRole('button', { name: /3번 비우겠소/ }));
  snap('absent-result');
  await tap(within(dialog()).getByRole('button', { name: '알겠소' }));
  snap('intro');
  while (qbtn(/^다음 사람/) && !(qbtn(/^다음 사람/) as HTMLButtonElement).disabled) {
    await tap(btn(/^다음 사람/));
    snap(`intro-next-${pre.length}`);
  }
  await tap(btn(/첫째 조사 시작/));
  for (const r of [1, 2, 3] as RoundNo[]) {
    snap(`r${r}-select`);
    await tap(btn(/토론 \d+분 시작/));
    snap(`r${r}-discuss`);
    await tap(btn(r < 3 ? /조사 시작/ : /최종 변론으로/));
  }
  snap('defense');
  while (qbtn(/^다음 사람/)) {
    await tap(btn(/^다음 사람/));
    snap(`defense-${pre.length}`);
  }
  await tap(btn(/지목하러/));
  await tap(btn(/셋 세기 시작/));
  await tap(btn('건너뛰기'));
  snap('vote-input');
  // 3번이 빠진 자리들: 모두 2번을, 2번은 4번을
  for (const v of [1, 2, 4, 5, 6].filter((x) => x <= n)) await ballot(v === 2 ? 4 : 2);
  snap('tally');
  await tap(btn(/진상 공개/));
  snap('reveal-confirm');
  await tap(within(dialog()).getByRole('button', { name: /공개하겠소|그대로 공개/ }));
  // 진상 비트 — 범인 도장 전까지는 범인과 무관해야 한다(역할명 정규화 없이: 낭독문은 원문 그대로)
  for (let i = 0; i < 30 && !document.querySelector('.gu-reveal-culprit'); i++) {
    beats.push({ key: `beat-${i}`, ...canon(code) });
    await tap(btn(/^다음 \(/));
  }
  const culpritBeat = document.querySelector('.gu-reveal-culprit')?.textContent ?? '';
  await tap(btn(/^다음 \(/));
  const verdict = document.querySelector('.gu-reveal-verdict')?.textContent ?? '';
  await tap(btn(/점수 보기/));
  const result = document.body.textContent ?? '';
  const shareButtons = screen.queryAllByRole('button', { name: /카톡으로 결과 공유|링크 복사|이미지 저장/ }).length;
  return { pre, beats, culpritBeat, verdict, result, shareButtons };
}

describe('(c) 자리 비우기 · 되돌리기 반복 — 진상 전 범인 정보 비노출', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인: 범인이 3번인 판 vs 4번인 판 — 단계 5곳 × 자리 2..${n} × 2회 (비우기 → 확인 → 결과 → ↶) 화면이 전부 같고, 시트 문구는 자리 번호만 다르다`, async () => {
      const A = findCode(n, 'c-A', (a) => a.seats[0] === 'queen' && a.culpritSeat === 3);
      const B = findCode(n, 'c-B', (a) => a.seats[0] === 'queen' && a.culpritSeat === 4);
      const ra = await absentRepeatRun(A);
      resetBetweenRuns();
      const rb = await absentRepeatRun(B);
      expect(ra.shots.length).toBeGreaterThan(20 * (n - 1));
      expectSameShots(`${n}인 범인3 vs 범인4`, ra.shots, rb.shots);
      // 같은 판 안에서도: 시트 문구는 자리 번호만 다르다(범인 자리든 무고 자리든)
      for (const run of [ra, rb]) {
        const byStep = new Map<string, Set<string>>();
        for (const line of run.sheets) {
          const [tag, ...rest] = line.split(' ');
          const step = tag.replace(/\/\d+\/\d+\//, '/*/');
          const set = byStep.get(step) ?? new Set<string>();
          set.add(rest.join(' '));
          byStep.set(step, set);
        }
        for (const [step, texts] of byStep) {
          if (step.endsWith('/pick')) continue; // 고르기 화면은 아직 아무 자리도 안 골랐다 — 아래에서 따로
          expect([...texts], step).toHaveLength(1);
        }
        for (const line of run.sheets) expect(line).not.toMatch(/성립하지|범인이 아니|범인이었소|새 방|사건이 끝/);
      }
      // ↶ 반복 뒤 저장 상태: 아무도 안 비었고, 비우기로 지워졌던 그 자리의 표·그 자리로 간 표도 전원 몫(n)이 그대로 돌아왔다
      expect(ra.savedAbsent).toEqual([]);
      expect(rb.savedAbsent).toEqual([]);
      expect(ra.savedBallots).toBe(n);
      expect(rb.savedBallots).toBe(n);
    }, 180_000);

    it(`${n}인: 3번을 비운 채 끝까지 — 범인(3번) 비움 판과 무고(3번) 비움 판이 진상 직전·진상 비트(범인 도장 전)까지 같고, 진상 뒤에만 '판결 없음(범인 자리 비움)'`, async () => {
      const A = findCode(n, 'c-keep-A', (a) => a.seats[0] === 'queen' && a.culpritSeat === 3);
      const B = findCode(n, 'c-keep-B', (a) => a.seats[0] === 'queen' && a.culpritSeat === 4);
      const ra = await absentKeepRun(A);
      resetBetweenRuns();
      const rb = await absentKeepRun(B);
      expectSameShots(`${n}인 3번 비움: 범인 vs 무고`, ra.pre, rb.pre);
      expectSameShots(`${n}인 진상 비트(범인 도장 전)`, ra.beats, rb.beats);
      expect(ra.beats.length).toBeGreaterThanOrEqual(3);
      for (const s of [...ra.pre, ...ra.beats]) expect(s.text, s.key).not.toMatch(/판결 없음|자리를 비워 판결|범인 자리 비움/);
      // 진상 뒤에만 드러난다
      expect(ra.culpritBeat).toContain('3번');
      expect(rb.culpritBeat).toContain('4번');
      expect(ra.verdict).toContain('범인(3번)이 자리를 비워 판결이 없소');
      expect(ra.verdict).toContain('미결');
      expect(rb.verdict).not.toContain('자리를 비워');
      expect(ra.result).toContain('판결 없음(범인 자리 비움)');
      expect(rb.result).not.toContain('판결 없음');
      expect(ra.shareButtons).toBe(0); // 판결 없는 판은 공유 막음
      expect(rb.shareButtons).toBe(3);
    }, 120_000);
  }
});

// ═══════════════════════════════ (d) R3 전 기억 비노출 · R3 후 노출 ═══════════════════════════════

const memLines = (roleId: string) => (c.roles.find((r) => r.id === roleId)?.memories ?? []).flatMap((m) => m.lines);
const ALL_MEM = c.roles.flatMap((r) => memLines(r.id));
const NPC_C = (c.rounds.find((r) => r.no === 3)?.npcCards ?? []).map((x) => ({ id: x.id, roleId: x.roleId, body: x.body }));
/** R1·R2 에 이미 나오는 글(같은 화자의 앞선 진술 머리말 등)과 겹치지 않는 16자 조각 — R3 에서만 나오는 글을 가리키는 탐침 */
const EARLY_TEXT = JSON.stringify(c.rounds.filter((r) => r.no < 3));
function probe(t: string): string {
  for (let i = 0; i + 16 <= t.length; i += 2) {
    const w = t.slice(i, i + 16);
    if (!EARLY_TEXT.includes(w)) return w;
  }
  throw new Error(`no distinct probe: ${t}`);
}

/** 지금 탭 내 패 '비밀' 섹션을 열어 전문을 모은다(쪽 나눔 폐지 — 한 번 열면 전부 보인다. 열기 = Enter 누름, 닫기 = 뗌) */
async function readSecretPages(): Promise<string> {
  await tap(screen.getByRole('tab', { name: '비밀' }));
  const s = sealedSurface()!;
  fireEvent.keyDown(s, { key: 'Enter' });
  await flush();
  const all = document.querySelector('.gu-rolecard')?.textContent ?? '';
  fireEvent.keyUp(sealedSurface()!, { key: 'Enter' });
  await flush();
  return all;
}

describe('(d) R3 전 기억 비노출 · R3 후 노출', () => {
  const expectNoneIn = (html: string, probes: string[], where: string) => expect(probes.filter((p) => html.includes(p)), where).toEqual([]);

  for (const { n, role } of [
    { n: 5 as PlayerCount, role: 'courtLady' },
    { n: 6 as PlayerCount, role: 'courtLady' },
    { n: 6 as PlayerCount, role: 'crownPrincess' },
  ]) {
    it(`${n}인 플레이어(${role}, 자리 ≥2): 패 확인·자기소개·조사 1·2 — 열어 봐도(모든 쪽) 기억 0 · 조사 3 — 열면 기억 전부 · O1 로 조사 2 복귀 시 다시 0`, async () => {
      const code = findCode(n, `d-${role}`, (a) => a.seats.indexOf(role) + 1 >= 2);
      const seat = asg(code).seats.indexOf(role) + 1;
      const mine = memLines(role).map(probe);
      const allProbes = ALL_MEM.map(probe);
      expect(mine.length).toBeGreaterThan(0);
      await playerEnter(code, seat);
      await tap(btn(/사건 시작됐어요/));
      await tap(btn(/내 패 확인하기/));
      await dismissPeekTip();
      expectNoneIn(await readSecretPages(), allProbes, 'cards 열람');
      const lockedHint = document.body.innerHTML;
      expectNoneIn(lockedHint, allProbes, 'cards DOM');
      await tap(btn(/자기소개 시작됐어요/));
      expectNoneIn(document.body.innerHTML, allProbes, 'intro DOM');
      await tap(btn(/1라운드 시작됐어요/));
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      await tap(tabBtn(/^내 패/));
      expectNoneIn(await readSecretPages(), allProbes, 'r1 열람');
      await tap(tabBtn(/^지금/));
      await o1(/^조사 2/);
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      await tap(tabBtn(/^내 패/));
      const r2 = await readSecretPages();
      expectNoneIn(r2, allProbes, 'r2 열람');
      expect(r2).toContain('셋째 조사가 시작되면 떠오르오'); // 잠긴 블록 안내는 열었을 때만(봉인 속)
      await tap(tabBtn(/단서함/));
      expectNoneIn(document.body.innerHTML, [...allProbes, ...NPC_C.map((x) => probe(x.body))], 'r2 단서함');
      await tap(tabBtn(/^지금/));
      const p2 = singleCardPlace(n, 2);
      await tap(placeTile(p2.name));
      await tap(btn(new RegExp(`${p2.name} 조사하기`)));
      await tap(btn(/3라운드 시작됐어요/));
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      expectNoneIn(document.body.innerHTML, allProbes, 'r3 진입 직후(봉인) DOM');
      await tap(btn(/지금 확인하기/));
      const r3 = await readSecretPages();
      for (const p of mine) expect(r3, `r3 열람 — 내 기억 ${p}`).toContain(p);
      expectNoneIn(r3, allProbes.filter((p) => !mine.includes(p)), 'r3 남의 기억');
      // 4·5인 NPC 진술 ③: 5인은 세자빈(NPC) 진술 6C 가 조사 3 단서함에
      await tap(tabBtn(/단서함/));
      const box = document.body.innerHTML;
      for (const x of NPC_C) {
        const isNpc = !castFor(c, n).includes(x.roleId);
        if (isNpc) expect(box, `r3 단서함 ${x.id}`).toContain(probe(x.body));
        else expect(box, `r3 단서함 ${x.id}(플레이어 역할)`).not.toContain(probe(x.body));
      }
      // O1 로 조사 2 로 돌아가면 다시 잠긴다(이 폰의 진행 단계 기준)
      await tap(tabBtn(/^지금/));
      await o1(/^조사 2/);
      await tap(tabBtn(/^내 패/));
      expectNoneIn(await readSecretPages(), allProbes, 'r3 → r2 복귀 열람');
      // 조사 2 → 최종 변론 점프(조사 3 을 지나감)는 확인 시트를 거치고, 지나면 열린다
      await tap(tabBtn(/^지금/));
      await o1(/^최종 변론/);
      expect(dialog().textContent).toContain('셋째 조사로 넘어가겠소?');
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      await tap(tabBtn(/^내 패/));
      const def = await readSecretPages();
      for (const p of mine) expect(def, `defense 열람 — ${p}`).toContain(p);
    }, 60_000);
  }

  for (const n of [4, 5, 6] as PlayerCount[]) {
    it(`${n}인 방장(공용 무대 + 내 패): 조사 1·2 공용 보드·내 패에 R3 기억·R3 NPC 진술 0 → 조사 3 에서 인원대로 노출`, async () => {
      const holder = castFor(c, n).find((r) => memLines(r).length > 0) ?? null; // 4인은 없음
      const code = findCode(n, 'd-host', (a) => (holder ? a.seats[0] === holder : a.culpritSeat !== 1));
      const mine = holder ? memLines(holder).map(probe) : [];
      const allProbes = ALL_MEM.map(probe);
      const npcProbes = NPC_C.map((x) => probe(x.body));
      await hostEnter(code);
      await o1(/^조사 1/);
      await tap(within(dialog()).getByRole('button', { name: /넘어가겠소/ }));
      for (const r of [1, 2] as RoundNo[]) {
        expectNoneIn(document.body.innerHTML, [...allProbes, ...npcProbes], `방장 r${r} 무대`);
        await tap(btn(/토론 \d+분 시작/));
        expectNoneIn(document.body.innerHTML, [...allProbes, ...npcProbes], `방장 r${r} 토론`);
        await tap(tabBtn(/^내 패/));
        await dismissPeekTip();
        expectNoneIn(await readSecretPages(), allProbes, `방장 r${r} 내 패 열람`);
        await tap(tabBtn(/^진행/));
        await tap(btn(r === 1 ? /둘째 조사 시작/ : /셋째 조사 시작/));
      }
      // 조사 3 — 공용 무대: 4인 5C·6C, 5인 6C, 6인 없음 / 내 패: 5·6인 방장(조상궁)은 기억
      const stage = document.body.innerHTML;
      for (const x of NPC_C) {
        const isNpc = !castFor(c, n).includes(x.roleId);
        expect(stage.includes(probe(x.body)), `${n}인 r3 무대 ${x.id}`).toBe(isNpc);
      }
      expectNoneIn(stage, allProbes, 'r3 공용 무대에 기억 본문 없음');
      expect(stage).toContain('셋째 조사 — 각자 내 패를 다시 확인하시오');
      await tap(btn(/지금 확인하기/));
      const r3 = await readSecretPages();
      for (const p of mine) expect(r3).toContain(p);
      if (!holder) expectNoneIn(r3, allProbes, '4인 방장 내 패');
    }, 60_000);
  }
});

// ═══════════════════════════════ (e) 결과 공유 ═══════════════════════════════

interface Captured {
  kakao: unknown[];
  webshare: unknown[];
  clipboard: string[];
  images: string[];
}

function installShareMocks(): Captured {
  const cap: Captured = { kakao: [], webshare: [], clipboard: [], images: [] };
  vi.stubGlobal(
    'Image',
    class {
      set src(v: string) {
        cap.images.push(v);
      }
    },
  );
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t: string) => void cap.clipboard.push(t) } });
  return cap;
}
function setKakao(cap: Captured | null) {
  const w = window as unknown as { Kakao?: unknown };
  if (!cap) delete w.Kakao;
  else w.Kakao = { isInitialized: () => true, init: () => {}, Share: { sendDefault: (t: unknown) => cap.kakao.push(t) } };
}
function setWebShare(cap: Captured | null) {
  Object.defineProperty(navigator, 'share', { configurable: true, value: cap ? async (d: unknown) => void cap.webshare.push(d) : undefined });
}

/** 방장 한 판을 결과까지 — outcome: 'caught' 모두 범인을 / 'escaped' 모두 무고 2번(또는 3번)을 */
async function hostToResult(code: string, outcome: 'caught' | 'escaped') {
  const a = asg(code);
  const n = a.n;
  await hostEnter(code);
  await o1(/^지목/);
  await tap(within(dialog()).getByRole('button', { name: /넘어가겠소|가겠소/ }));
  await tap(btn(/셋 세기 시작/));
  await tap(btn('건너뛰기'));
  const innocent = [2, 3, 4].find((s) => s !== a.culpritSeat)!;
  const other = [2, 3, 4].find((s) => s !== a.culpritSeat && s !== innocent)!;
  const target = outcome === 'caught' ? a.culpritSeat : innocent;
  for (let v = 1; v <= n; v++) await ballot(v === target ? (outcome === 'caught' ? innocent : other) : target);
  await tap(btn(/진상 공개/));
  await tap(within(dialog()).getByRole('button', { name: /공개하겠소|그대로 공개/ }));
  for (let i = 0; i < 30 && !qbtn(/점수 보기/); i++) await tap(btn(/^다음 \(/));
  await tap(btn(/점수 보기/));
}

function forbiddenFor(code: string): string[] {
  const room = parseRoomCode(code)!;
  const a = asg(code);
  return [...ROLE_WORDS, code, room.display, formatRoomCode(code), room.seed, room.tag, `${a.culpritSeat}번`, 'code=', 'as=host'];
}

describe('(e) 결과 공유 — 범인·방 코드 없음', () => {
  for (const n of [4, 5, 6] as PlayerCount[]) {
    for (const outcome of ['caught', 'escaped'] as const) {
      it(`${n}인 ${outcome === 'caught' ? '검거' : '도주'}: 카카오 템플릿·Web Share·클립보드(공유 폴백·링크 복사)·미리보기·프리워밍·이미지 저장·OG 이미지 트리에 범인·방 코드·표식 없음`, async () => {
        const code = findCode(n, `e-${outcome}`, (a) => a.culpritSeat >= 2 && a.culpritSeat <= 4);
        const cap = installShareMocks();
        setKakao(cap);
        setWebShare(null);
        await hostToResult(code, outcome);
        // 결과 화면 자체는 진상 뒤라 범인을 보여 준다(탐침 유효성 — 판결이 났고 공유 버튼이 있다)
        expect(document.body.textContent).toContain(outcome === 'caught' ? '범인 검거' : '범인 도주');
        await tap(btn('카톡으로 결과 공유'));
        setKakao(null);
        setWebShare(cap);
        await tap(btn('카톡으로 결과 공유'));
        setWebShare(null);
        await tap(btn(/링크 복사/));
        await flush();
        await tap(btn('카톡으로 결과 공유')); // → 클립보드 폴백
        await flush();
        const preview = document.querySelector<HTMLImageElement>('.gu-resultpreview img')?.getAttribute('src') ?? '';
        await tap(btn(/이미지 저장/));
        const modalSrcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src') ?? '');
        expect(cap.kakao).toHaveLength(1);
        expect(cap.webshare).toHaveLength(1);
        expect(cap.clipboard.length).toBeGreaterThanOrEqual(2);
        expect(cap.images.length).toBeGreaterThanOrEqual(1);
        expect(preview).toContain('/gung/og/result?');
        const blob = [JSON.stringify(cap), preview, ...modalSrcs].join(' ');
        const leaked = forbiddenFor(code).filter((w) => blob.includes(w));
        expect(leaked, `${code} 범인 ${asg(code).culpritSeat}번`).toEqual([]);
        expect(blob).not.toMatch(/\d+\s*번/);
        // 모든 링크는 /gung(쿼리 없음), 이미지는 7키 OG
        const urls = blob.match(/https?:\/\/[^\s"\\]+/g) ?? [];
        expect(urls.length).toBeGreaterThan(3);
        for (const u of urls) {
          const url = new URL(u);
          if (url.pathname === '/gung/og/result') expect([...url.searchParams.keys()].sort()).toEqual(['d', 'h', 'j', 'm', 'n', 'o', 'r']);
          else {
            expect(url.pathname).toBe('/gung');
            expect(url.search).toBe('');
          }
        }
        // OG 이미지 트리(라우트가 실제로 그릴 글) — 역할명·코드 없음
        const { GET } = await import('../og/result/route');
        vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
        ogTrees.length = 0;
        for (const u of new Set(urls.filter((x) => x.includes('/gung/og/result')))) await GET({ url: u } as never);
        expect(ogTrees.length).toBeGreaterThan(0);
        const tree = JSON.stringify(ogTrees);
        expect(tree).toContain(outcome === 'caught' ? '검거' : '도주');
        expect(forbiddenFor(code).filter((w) => tree.includes(w))).toEqual([]);
      }, 60_000);
    }
  }

  it('범인 자리를 비운(판결 없는) 판은 결과 화면에 공유·저장·복사 버튼도, 미리보기·프리워밍 이미지도 없다', async () => {
    const code = findCode(5, 'e-absent', (a) => a.culpritSeat >= 2);
    const a = asg(code);
    const cap = installShareMocks();
    await hostEnter(code);
    await o1(/^지목/);
    await tap(within(dialog()).getByRole('button', { name: /넘어가겠소|가겠소/ }));
    await tap(btn('메뉴'));
    await tap(btn('자리 비우기'));
    await tap(within(dialog()).getAllByRole('button').find((b) => b.className.includes('gu-seatchip') && b.textContent === String(a.culpritSeat)));
    await tap(within(dialog()).getByRole('button', { name: '비우기' }));
    await tap(within(dialog()).getByRole('button', { name: new RegExp(`${a.culpritSeat}번 비우겠소`) }));
    await tap(within(dialog()).getByRole('button', { name: '알겠소' }));
    await tap(btn(/셋 세기 시작/));
    await tap(btn('건너뛰기'));
    const active = [1, 2, 3, 4, 5].filter((s) => s !== a.culpritSeat);
    const t = active.find((s) => s !== 1)!;
    for (const v of active) await ballot(v === t ? 1 : t);
    await tap(btn(/진상 공개/));
    await tap(within(dialog()).getByRole('button', { name: /공개하겠소|그대로 공개/ }));
    for (let i = 0; i < 30 && !qbtn(/점수 보기/); i++) await tap(btn(/^다음 \(/));
    await tap(btn(/점수 보기/));
    expect(document.body.textContent).toContain('판결 없음(범인 자리 비움)');
    expect(screen.queryAllByRole('button', { name: /카톡으로 결과 공유|링크 복사|이미지 저장/ })).toHaveLength(0);
    expect(document.querySelector('.gu-resultpreview')).toBeNull();
    expect(cap.images).toEqual([]);
  }, 60_000);

  it('플레이어 진상 화면(P9) "다른 모임에 추천하기" — 방 코드·표식·역할명·범인 자리 없음', async () => {
    const code = findCode(6, 'e-player', (a) => a.culpritSeat >= 2);
    const cap = installShareMocks();
    setWebShare(cap);
    await playerEnter(code, 2);
    await o1(/^진상 공개/);
    await tap(within(dialog()).getByRole('button', { name: /가겠소/ }));
    // G5: 진상 대기 → 「범인이 밝혀졌어요」 → 확인 시트 → P9
    await tap(btn(/범인이 밝혀졌어요/));
    await tap(within(dialog()).getByRole('button', { name: '보겠소' }));
    await tap(btn('다른 모임에 추천하기'));
    expect(cap.webshare).toHaveLength(1);
    const blob = JSON.stringify(cap.webshare);
    expect(forbiddenFor(code).filter((w) => blob.includes(w))).toEqual([]);
    expect(blob).not.toMatch(/\d+\s*번/);
  }, 30_000);
});
