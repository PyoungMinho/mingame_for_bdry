// @vitest-environment jsdom
/**
 * QA(STEP 5) 잔여 자동 케이스 — UI-01·A11Y-03·HIDE-25(홈 고지), UI-13(검산 입력), UI-15(도발 같은 문장), UI-21(예외 화면),
 * DIS-01(seed 100)·DIS-04(숨기기 시트 문구 0)·DIS-05, LEAK-10(mf- 0), BLD-03(env), COPY-02·05. 제품 코드 무수정.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Home } from '@/app/monthly-close/_screens/Home';
import { GameScreen } from '@/app/monthly-close/_screens/GameScreen';
import { ViewStore } from '@/lib/monthly-close/client/viewStore';
import { createStaticController } from '@/lib/monthly-close/client/staticController';
import { mockPlayingView } from '@/lib/monthly-close/client/mockViews';
import { parseQuizInput } from '@/lib/monthly-close/client/viewModel';
import { COMMON_PACK, INDUSTRY_PACKS, tauntLine } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { buildDisguise, evaluate, ROW, firstSelection, type DisguiseKind } from '@/lib/monthly-close/sheet/disguise';
import { DISGUISE_FIXTURES } from '@/lib/monthly-close/sheet/disguise-fixtures';
import type { RoomControllerState } from '@/lib/monthly-close/client/controller';

const bug = process.env.QA_SHOW_BUGS ? it : it.fails;
function setMobile(on: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: on && q.includes('max-width: 1023px'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  window.matchMedia = globalThis.matchMedia as typeof window.matchMedia;
}
beforeEach(() => {
  setMobile(false);
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, json: async () => ({ db: 'ok' }) })));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('UI-01·A11Y-03 홈', () => {
  it('게임임을 밝힘·규칙 3줄·"회사 규정 확인은 본인 몫"·베타·PC 권장·Tab 키 고지', async () => {
    const r = render(<Home />);
    await act(async () => await new Promise((x) => setTimeout(x, 0)));
    const t = r.container.textContent ?? '';
    expect(t).toContain(UI.home.noticeLead);
    for (const line of UI.home.rules) expect(t).toContain(line);
    expect(t).toMatch(/회사 규정 확인은 본인 몫/);
    expect(t).toContain('베타');
    expect(t).toMatch(/PC에서 더 잘/);
    expect(t).toMatch(/Tab은 시트 전환 키/);
    expect(t).toMatch(/방향키, Enter, \/ 키/);
  });
  it('BUG-12 HIDE-25 미리보기 썸네일(탭 미리보기·앱 전환 화면)은 막을 수 없다는 "완벽하지 않음" 고지가 홈/FAQ에 있어야 한다(방향서 §8 434행)', async () => {
    const r = render(<Home />);
    await act(async () => await new Promise((x) => setTimeout(x, 0)));
    expect(r.container.textContent ?? '').toMatch(/완벽하지 않|미리보기|썸네일|앱 전환/);
  });
});

describe('UI-13 검산 입력 해석', () => {
  it('쉼표·전각·"원"·공백 허용, 소수·문자는 null', () => {
    expect(parseQuizInput('37,000')).toBe(37000);
    expect(parseQuizInput('３７０００원')).toBe(37000);
    expect(parseQuizInput(' 1 2 3 ')).toBe(123);
    expect(parseQuizInput('12.5')).toBeNull();
    expect(parseQuizInput('abc')).toBeNull();
    expect(parseQuizInput('')).toBeNull();
  });
});

describe('UI-15 도발은 업종이 달라도 같은 문장(common.json)', () => {
  it('tauntLine(i)는 업종 팩을 받지 않고 common 문구 10개', () => {
    expect(COMMON_PACK.taunts).toHaveLength(10);
    for (let i = 0; i < 10; i++) expect(tauntLine(i).text).toBe(COMMON_PACK.taunts[i]);
  });
});

describe('UI-21 예외 화면 E2·E3·E4', () => {
  const cases: [RoomControllerState['entry']['kind'], string[], string[]][] = [
    ['full', ['open-practice', 'new-doc'], []],
    ['notFound', ['new-doc'], ['open-practice']],
    ['down', ['open-practice'], ['new-doc']],
  ];
  for (const [kind, has, not] of cases) {
    it(`${kind}: 버튼 ${has.join('·')}, [닫기] 없음, ESC 숨기기 동작`, () => {
      const base = createStaticController(mockPlayingView(0, Date.now()));
      const c = { ...base, kind: 'live' as const, code: '12345', state: { ...base.state, entry: { kind } as RoomControllerState['entry'], view: null } };
      const store = new ViewStore('game');
      const r = render(<GameScreen controller={c} store={store} mode="room" roomCode="12345" onHome={() => undefined} onPractice={() => undefined} />);
      if (store.view === 'disguise') act(() => void (screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement).click());
      const dlg = r.container.querySelector('.mc-dialog') as HTMLElement;
      expect(dlg).not.toBeNull();
      for (const cmd of has) expect(dlg.querySelector(`[data-mc-cmd="${cmd}"]`)).not.toBeNull();
      for (const cmd of not) expect(dlg.querySelector(`[data-mc-cmd="${cmd}"]`)).toBeNull();
      expect(dlg.textContent).not.toMatch(/닫기/);
      act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })));
      expect(store.view).toBe('disguise');
      r.unmount();
    });
  }
});

const KINDS: DisguiseKind[] = ['accounting', 'sales', 'hr'];
describe('DIS-01 합계 정합 seed 100 × 3업종 (기존 8 seed 확장)', () => {
  it('소계·합계 = 데이터 행 합', () => {
    for (const kind of KINDS) {
      for (let i = 0; i < 100; i++) {
        const sheet = evaluate(buildDisguise(DISGUISE_FIXTURES[kind], { seed: `qa-${i}`, asOf: '2026-11-07' }));
        const byR = (r: number) => sheet.rows.find((x) => x.r === r)!;
        const sum = (from: number, n: number, c: number) => Array.from({ length: n }, (_, k) => byR(from + k).cells[c].raw as number).reduce((a, b) => a + b, 0);
        for (let c = 2; c <= 3; c++) {
          const s1 = sum(ROW.g1, 6, c), s2 = sum(ROW.g2, 5, c);
          expect(byR(ROW.sub1).cells[c].raw, `${kind} seed ${i} col ${c} 소계1`).toBe(s1);
          expect(byR(ROW.sub2).cells[c].raw, `${kind} seed ${i} col ${c} 소계2`).toBe(s2);
          expect(byR(ROW.total).cells[c].raw, `${kind} seed ${i} col ${c} 합계`).toBe(s1 + s2);
        }
      }
    }
  });
  it('DIS-05 첫 선택: 회계·영업 D4, 인사 F4', () => {
    // 0기준 좌표: D4 = {c:3,r:3}, F4 = {c:5,r:3}
    expect(firstSelection(DISGUISE_FIXTURES.accounting)).toEqual({ c: 3, r: 3 });
    expect(firstSelection(DISGUISE_FIXTURES.sales)).toEqual({ c: 3, r: 3 });
    expect(firstSelection(DISGUISE_FIXTURES.hr)).toEqual({ c: 5, r: 3 });
  });
});

describe('DIS-04 숨기기·장식 시트 문구 0', () => {
  it('3업종 숨기기 시트·장식 탭 글자에 웃음 문구·직급어·사람 이름 후보 0', () => {
    const banned = /부장님|팀장님|본부장님|대표님|과장님|대리님|사원님|박대리|법카|시말서|좌표|게임|함선|도발|검산|경보/;
    for (const id of [0, 1, 2] as const) {
      const r = render(<GameScreen controller={createStaticController(mockPlayingView(id, Date.now()))} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={id} onHome={() => undefined} />);
      act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })));
      const ds = r.container.querySelector('[data-layer="disguise"]')!.textContent ?? '';
      expect(ds, `업종 ${id}`).not.toMatch(banned);
      act(() => void (screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'deco') as HTMLElement).click());
      const deco = r.container.querySelector('[data-layer="disguise"]')!.textContent ?? '';
      expect(deco, `업종 ${id} 장식`).not.toMatch(banned);
      // 장식 담당 코드
      const pack = INDUSTRY_PACKS[(['accounting', 'sales', 'hr'] as const)[id]];
      expect(pack.deco.memos.length).toBe(6);
      r.unmount();
    }
  });
});

describe('LEAK-10 · BLD-03 정적 검사', () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|css|json)$/.test(f) && !/\.test\.tsx?$/.test(f)) files.push(p);
    }
  };
  ['src/app/monthly-close', 'src/lib/monthly-close', 'src/app/api/monthly-close'].forEach((d) => walk(join(process.cwd(), d)));
  it('LEAK-10 월마감 소스에 mf- 클래스 0', () => {
    const hits = files.filter((f) => /["'\s.]mf-[a-z]/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
  it('BLD-03 process.env 키는 허용 목록뿐', () => {
    const allowed = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL', 'VERCEL_ENV']);
    const found = new Set<string>();
    for (const f of files) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/process\.env\.([A-Z0-9_]+)/g)) found.add(m[1]);
      for (const m of s.matchAll(/\benv\.([A-Z][A-Z0-9_]+)/g)) found.add(m[1]);
    }
    expect([...found].filter((k) => !allowed.has(k) && !k.startsWith('MC_SIM_'))).toEqual([]);
  });
});

describe('COPY-05 결과 문서 길이(최장 닉네임 8자 치환 후 120자 이하)', () => {
  it('3업종 × 시말서/포상/공동 모든 문장', () => {
    const over: string[] = [];
    for (const key of ['accounting', 'sales', 'hr'] as const) {
      const pack = INDUSTRY_PACKS[key];
      const longShip = [...Object.values(pack.ships as unknown as Record<string, { long?: string[]; short?: string } | string[]>)]
        .flatMap((v) => (Array.isArray(v) ? v : [...(v.long ?? []), v.short ?? '']))
        .filter((x): x is string => typeof x === 'string')
        .sort((a, b) => b.length - a.length)[0] ?? '가나다라마바사아';
      for (const kind of ['reprimand', 'award', 'joint'] as const) {
        for (const line of pack.result[kind]) {
          const filled = line.replace(/\{([^{}:]+)(:[을이은])?\}/g, (_m, tok: string) => (/배|항목/.test(tok) ? longShip + '을' : /R|라운드|회차|\d/.test(tok) ? '30' : '가나다라마바사아'));
          if (Array.from(filled).length > 120) over.push(`${key}/${kind}: ${Array.from(filled).length}자`);
        }
      }
    }
    expect(over).toEqual([]);
  });
});

describe('DIS-02 숨기기 시트 seed 고정(같은 탭)', () => {
  it('숨김 → 복귀 → 숨김, 다시 마운트(새로고침 대역)해도 숫자가 같다', () => {
    const grab = () => {
      const r = render(<GameScreen controller={createStaticController(mockPlayingView(0, Date.now()))} store={new ViewStore('game')} mode="practice" roomCode={null} initialIndustry={0} onHome={() => undefined} />);
      act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })));
      const t1 = r.container.querySelector('[data-layer="disguise"]')!.textContent;
      act(() => void (screen.getAllByRole('tab').find((t) => t.getAttribute('data-kind') === 'game') as HTMLElement).click());
      act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true })));
      const t2 = r.container.querySelector('[data-layer="disguise"]')!.textContent;
      r.unmount();
      return [t1, t2];
    };
    const [a1, a2] = grab();
    const [b1] = grab();
    expect(a2).toBe(a1);
    expect(b1).toBe(a1);
  });
});
