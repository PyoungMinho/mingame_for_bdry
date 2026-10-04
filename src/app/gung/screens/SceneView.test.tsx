// @vitest-environment jsdom
/**
 * 현장 보기(SceneView · 장소 그림 7장 · 큰 화면 /gung/scene) — 렌더 스모크 · 라운드 잠금 · 역할 무관 · 본 물건 기록 · 그림 자리.
 *
 *  - 스모크: 조사 1~3 모든 장소가 자기 그림(data-art)으로 그려지고, 물건 수만큼 핫스팟 버튼이 있고, 누르면 관찰 카드가 뜬다.
 *  - 라운드 잠금: fromRound > upTo 줄의 글자는 장소를 다 돌고 물건을 다 열어도 DOM 어디에도 없다. 그림의 R2 겉모습(data-detail="r2")도
 *    조사 1엔 없다.
 *  - 역할 무관: 현장 파일들은 assign·seal·deck·game·storage·엔진 index 를 import 하지 않는다(소스 검사). 방 코드(인원·범인 자리)가
 *    달라도 화면 DOM 이 같다. 게임 저장 gu:game:v1 은 건드리지 않는다.
 *  - 그림 자리: 모든 물건에 그림 자리(anchor)·짧은 이름표가 있고, 375px 폰(캔버스 343px)에서 이름표끼리 겹치지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { sejaCase as c } from '@/lib/gung/case-data';
import { scenesFor } from '@/lib/gung/scene';
import { SCENE_ARTS, sceneArt } from '../components/scenes';
import { clearSceneStore, parseSceneStore, SCENE_STORE_KEY, SCENE_STORE_TTL_MS, SceneView } from './SceneView';

let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
}));

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

beforeEach(() => {
  search = '';
  window.localStorage.clear();
  clearSceneStore();
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

const SCENES = c.scenes ?? [];
const ALL_LINES = SCENES.flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id, placeId: s.placeId }))));
/** 화면은 「의관: …」을 <b>의관</b> … 로 그리므로 말한 이를 떼고 앞 10자로 찾는다 */
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const spots = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('button.gu-scene-spot'));
const placeName = (root: HTMLElement) => root.querySelector('.gu-scene-pagename')?.textContent ?? '';
const spot = (id: string) => document.querySelector<HTMLButtonElement>(`button.gu-scene-spot[data-obj="${id}"]`)!;

/** 그 라운드의 장소를 처음부터 끝까지 넘기며, 물건을 하나씩 다 열어 보고 그때마다 cb */
async function visitEverything(root: HTMLElement, cb: (where: string) => void) {
  const n = root.querySelectorAll('.gu-scene-pagebtn').length ? scenesFor(c, 3).length : 1;
  for (let i = 0; i < n; i++) {
    cb(`place ${placeName(root)}`);
    for (const b of spots(root)) {
      fireEvent.click(b);
      await flush();
      cb(`${placeName(root)} · ${b.dataset.obj}`);
    }
    fireEvent.click(screen.getByRole('button', { name: /^다음 장소/ }));
    await flush();
  }
}

describe('렌더 스모크', () => {
  it.each([1, 2, 3])('조사 %i — 7곳 모두 자기 그림 + 물건 수만큼 핫스팟, 누르면 관찰 카드', async (round) => {
    const { container } = render(<SceneView c={c} upTo={round} />);
    await flush();
    const views = scenesFor(c, round);
    expect(views).toHaveLength(7);
    for (const v of views) {
      expect(placeName(container)).toBe(v.placeName);
      expect(container.querySelector(`svg.gu-scene-art[data-art="${v.art}"]`)).not.toBeNull();
      expect(container.querySelector('svg.gu-scene-art')?.getAttribute('aria-hidden')).toBe('true');
      expect(spots(container).map((b) => b.dataset.obj)).toEqual(v.objects.map((o) => o.id));
      const first = v.objects[0];
      fireEvent.click(spots(container)[0]);
      await flush();
      const card = screen.getByRole('region', { name: '관찰' });
      expect(within(card).getByRole('heading').textContent).toBe(first.name);
      expect(card.textContent).toContain(probe(first.lines[first.lines.length - 1].text));
      fireEvent.click(screen.getByRole('button', { name: /^다음 장소/ }));
      await flush();
    }
    expect(placeName(container)).toBe(views[0].placeName);
  });

  it('카드는 ✕·Esc 로 닫히고, 빈 카드는 안내 한 줄', async () => {
    render(<SceneView c={c} upTo={1} />);
    await flush();
    expect(screen.getByRole('region', { name: '관찰' }).textContent).toContain('그림 속 물건을 누르시오');
    fireEvent.click(screen.getByRole('button', { name: /탕약 사발/ }));
    await flush();
    expect(screen.getByRole('button', { name: /탕약 사발/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: '관찰 닫기' }));
    await flush();
    expect(screen.getByRole('region', { name: '관찰' }).textContent).toContain('그림 속 물건을 누르시오');
    fireEvent.click(screen.getByRole('button', { name: /은숟가락/ }));
    await flush();
    fireEvent.keyDown(screen.getByRole('region', { name: '관찰' }), { key: 'Escape' });
    await flush();
    expect(screen.getByRole('region', { name: '관찰' }).textContent).toContain('그림 속 물건을 누르시오');
  });

  it('조사 전(0)이면 그림 없이 한 줄', () => {
    const { container } = render(<SceneView c={c} upTo={0} />);
    expect(container.textContent).toContain('조사가 시작되면 현장이 열리오');
    expect(spots(container)).toHaveLength(0);
  });

  it('조사 2 — 「새」 물건과 이번 조사 새 관찰 5줄, 목록을 누르면 그 장소로 가서 연다', async () => {
    const { container } = render(<SceneView c={c} upTo={2} />);
    await flush();
    const list = screen.getByRole('region', { name: /이번 조사 새 관찰/ });
    const items = within(list).getAllByRole('button');
    expect(items).toHaveLength(5);
    fireEvent.click(items.find((b) => b.textContent?.includes('수라간'))!);
    await flush();
    expect(placeName(container)).toBe('수라간');
    const card = screen.getByRole('region', { name: '관찰' });
    expect(card.textContent).toContain('새 · 조사 2');
    expect(card.textContent).toContain(probe(ALL_LINES.find((l) => l.objectId === 'OB-SR3' && l.fromRound === 2)!.text));
    expect(spots(container).find((b) => b.dataset.obj === 'OB-SR3')!.hasAttribute('data-seen')).toBe(true);
  });

  it('조사 1 엔 「새」 표시·새 관찰 목록이 없다', async () => {
    const { container } = render(<SceneView c={c} upTo={1} />);
    await flush();
    expect(container.querySelector('[data-new]')).toBeNull();
    expect(screen.queryByRole('region', { name: /이번 조사 새 관찰/ })).toBeNull();
  });
});

describe('라운드 잠금', () => {
  it.each([1, 2])('조사 %i — 미래 라운드 관찰 줄은 장소·물건을 다 열어도 DOM 에 없다', async (upTo) => {
    const future = ALL_LINES.filter((l) => l.fromRound > upTo).map((l) => probe(l.text));
    expect(future.length).toBeGreaterThan(0);
    const { container } = render(<SceneView c={c} upTo={upTo} />);
    await flush();
    await visitEverything(container, (where) => {
      const html = container.innerHTML;
      for (const p of future) expect(html, `${where}: ${p}`).not.toContain(p);
    });
  });

  it('그림의 R2 겉모습(연잎 위 하얀 것·화로 종잇조각·장부 먹물·보퉁이 끝)은 조사 2부터', async () => {
    const seenDetail = (upTo: number) => {
      const found = new Set<string>();
      const { container, unmount } = render(<SceneView c={c} upTo={upTo} />);
      return { container, found, unmount };
    };
    for (const upTo of [1, 2]) {
      const { container, found, unmount } = seenDetail(upTo);
      await flush();
      for (let i = 0; i < 7; i++) {
        if (container.querySelector('[data-detail="r2"]')) found.add(container.querySelector('.gu-scene-canvas')!.getAttribute('data-place')!);
        fireEvent.click(screen.getByRole('button', { name: /^다음 장소/ }));
        await flush();
      }
      expect([...found].sort()).toEqual(upTo === 1 ? [] : ['hw', 'jg', 'ng', 'ny']);
      unmount();
    }
  });
});

describe('역할 무관', () => {
  const ROOT = path.resolve(__dirname, '..');
  const files = [
    path.join(ROOT, 'screens/SceneView.tsx'),
    ...fs.readdirSync(path.join(ROOT, 'components/scenes')).map((f) => path.join(ROOT, 'components/scenes', f)),
    ...fs.readdirSync(path.join(ROOT, 'scene')).map((f) => path.join(ROOT, 'scene', f)),
  ].filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));
  const ALLOWED = new Set([
    'react',
    'lucide-react',
    'next',
    'next/navigation',
    '@/lib/gung/scene',
    '@/lib/gung/types',
    '@/lib/gung/guide-data',
    '@/lib/gung/room',
    '@/lib/gung/case-data',
  ]);

  it('현장 파일은 역할·배정·봉인·게임 상태 모듈을 import 하지 않는다', () => {
    expect(files.length).toBeGreaterThanOrEqual(11);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      const specs = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
      for (const s of specs) {
        const ok = ALLOWED.has(s) || s.startsWith('./') || ['../components/scenes', '../components/BottomSheet', '../components/GuButton', '../components/PalaceMap', '../lib/useWakeLock', '../screens/SceneView'].includes(s);
        expect(ok, `${path.basename(f)} → ${s}`).toBe(true);
      }
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, path.basename(f)).not.toMatch(/\b(assignFromCode|assignmentOf|getSheet|getClue|clueSeal|sealTable|roleAtSeat)\b/);
      expect(code, path.basename(f)).not.toContain('gu:game');
    }
  });

  it('방 코드(인원·범인 자리)가 달라도 화면 DOM 이 같다', async () => {
    const dom = async (code: string) => {
      // idScope 고정 → SVG id 까지 렌더마다 같다(정규화 없이 innerHTML 그대로 비교)
      const { container, unmount } = render(<SceneView c={c} upTo={3} code={code} idScope="host" />);
      await flush();
      const parts: string[] = [];
      await visitEverything(container, () => parts.push(container.innerHTML));
      unmount();
      window.localStorage.clear();
      clearSceneStore();
      return parts;
    };
    const a = await dom('7F3K4');
    const b = await dom('Q9ZM6');
    const d = await dom('22225');
    expect(b).toEqual(a);
    expect(d).toEqual(a);
  });

  it('idScope 를 주면 SVG id 가 고정되고, 다른 범위끼리는 겹치지 않는다', () => {
    const a = render(<SceneView c={c} upTo={1} idScope="host" />);
    const ids = Array.from(a.container.querySelectorAll('svg [id]')).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((id) => id.startsWith('dg-shost-'))).toBe(true);
    const b = render(<SceneView c={c} upTo={1} idScope="sheet" />);
    const ids2 = Array.from(b.container.querySelectorAll('svg [id]')).map((e) => e.id);
    expect(ids2.some((id) => ids.includes(id))).toBe(false);
    // 그림 안 url(#…) 참조는 모두 같은 그림 안 id 를 가리킨다
    for (const root of [a.container, b.container]) {
      const own = new Set(Array.from(root.querySelectorAll('svg [id]')).map((e) => e.id));
      const refs = [...root.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(5);
      for (const r of refs) expect(own.has(r), r).toBe(true);
    }
  });

  it('게임 저장(gu:game:v1)은 읽지도 쓰지도 않는다', async () => {
    window.localStorage.setItem('gu:game:v1', 'SENTINEL');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    const set = vi.spyOn(Storage.prototype, 'setItem');
    render(<SceneView c={c} upTo={2} code="7F3K5" />);
    await flush();
    fireEvent.click(spots(document.body)[0]);
    await flush();
    expect(get.mock.calls.map((x) => x[0])).not.toContain('gu:game:v1');
    expect(set.mock.calls.map((x) => x[0])).toEqual(expect.not.arrayContaining(['gu:game:v1']));
    expect(set.mock.calls.every((x) => x[0] === SCENE_STORE_KEY)).toBe(true);
    expect(window.localStorage.getItem('gu:game:v1')).toBe('SENTINEL');
  });
});

describe('본 물건 기록(gu:scene:v1)', () => {
  it('열어 본 물건은 ✓ — 다시 그려도 남고, 다른 방 코드면 지운다', async () => {
    const first = render(<SceneView c={c} upTo={3} code="7F3K5" />);
    await flush();
    fireEvent.click(spot('OB-DG1'));
    await flush();
    const saved = parseSceneStore(window.localStorage.getItem(SCENE_STORE_KEY));
    expect(saved?.seen).toEqual(['OB-DG1@3']);
    expect(saved?.code).toBe('7F3K5');
    first.unmount();

    render(<SceneView c={c} upTo={3} code="7F3K5" />);
    await flush();
    expect(spot('OB-DG1').getAttribute('aria-label')).toContain('본 물건');
    expect(spot('OB-DG2').getAttribute('aria-label')).toContain('새 관찰');
    cleanup();

    render(<SceneView c={c} upTo={3} code="Q9ZM6" />);
    await flush();
    expect(spot('OB-DG1').getAttribute('aria-label')).not.toContain('본 물건');
  });

  it('새 라운드에 새 줄이 붙으면 다시 「새」(seenKey 가 라운드를 담는다)', async () => {
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify({ v: 1, code: '7F3K5', at: Date.now(), seen: ['OB-DG1@1'], round: 1, opened: 1 }));
    render(<SceneView c={c} upTo={3} code="7F3K5" />);
    await flush();
    expect(spot('OB-DG1').getAttribute('aria-label')).toBe('탕약 사발, 새 관찰');
  });

  it('깨진 기록·12시간 지난 기록·이상한 값은 버린다', () => {
    expect(parseSceneStore('{oops')).toBeNull();
    expect(parseSceneStore(JSON.stringify({ v: 2, code: null, at: 1, seen: [], round: 1, opened: 1 }))).toBeNull();
    expect(parseSceneStore(JSON.stringify({ v: 1, code: 'nope', at: 1, seen: [], round: 1, opened: 1 }))).toBeNull();
    expect(parseSceneStore(JSON.stringify({ v: 1, code: null, at: 1, seen: [], round: 4, opened: 1 }))).toBeNull();
    expect(parseSceneStore(JSON.stringify({ v: 1, code: null, at: 1, seen: ['OB-DG1@3', '<script>', 7], round: 2, opened: 3 }))?.seen).toEqual(['OB-DG1@3']);
  });

  it('12시간 지나면 새 기록', async () => {
    window.localStorage.setItem(SCENE_STORE_KEY, JSON.stringify({ v: 1, code: '7F3K5', at: Date.now() - SCENE_STORE_TTL_MS - 1000, seen: ['OB-DG1@1'], round: 1, opened: 1 }));
    render(<SceneView c={c} upTo={1} code="7F3K5" />);
    await flush();
    expect(spot('OB-DG1').getAttribute('aria-label')).toBe('탕약 사발');
  });

  it('저장소가 막혀도 화면은 돈다(메모리)', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<SceneView c={c} upTo={1} />);
    await flush();
    fireEvent.click(spot('OB-DG1'));
    await flush();
    expect(spot('OB-DG1').getAttribute('aria-label')).toContain('본 물건');
  });
});

describe('그림 자리·이름표', () => {
  it('사건 데이터의 모든 그림 키에 그림이 있고, 모든 물건에 자리가 있다', () => {
    expect(Object.keys(SCENE_ARTS).sort()).toEqual(SCENES.map((s) => s.art).sort());
    for (const s of SCENES) {
      const art = sceneArt(s.art)!;
      expect(Object.keys(art.anchors).sort(), s.art).toEqual(s.objects.map((o) => o.id).sort());
      for (const o of s.objects) {
        const [x, y] = art.anchors[o.id];
        expect(x, o.id).toBeGreaterThanOrEqual(6);
        expect(x, o.id).toBeLessThanOrEqual(94);
        expect(y, o.id).toBeGreaterThanOrEqual(8);
        expect(y, o.id).toBeLessThanOrEqual(93);
        const label = art.labels[o.id] ?? o.name;
        expect(Array.from(label).length, `${o.id} ${label}`).toBeLessThanOrEqual(6);
        // 이름표는 데이터 이름을 줄인 말뿐(새 사실 없음)
        expect(o.name.includes(label), `${o.id} ${label}`).toBe(true);
      }
    }
  });

  it('375px 폰(캔버스 343px)·320px(288px)에서 이름표끼리 겹치지 않는다', () => {
    for (const W of [343, 288]) {
      const H = W * 0.625;
      const f = Math.max(12, Math.min(26, 0.038 * W));
      const textW = (s: string) => Array.from(s).reduce((a, ch) => a + (ch === ' ' ? 0.3 : ch === '·' ? 0.45 : 1) * f, 0);
      for (const s of SCENES) {
        const art = sceneArt(s.art)!;
        const rects = s.objects.map((o) => {
          const label = art.labels[o.id] ?? o.name;
          const w = textW(label) + 1.28 * f;
          const h = 1.15 * f + 0.68 * f;
          const btnW = Math.max(56, w + 4);
          const [x, y] = art.anchors[o.id];
          const cx = (x / 100) * W;
          const left = Math.min(Math.max(cx - btnW / 2, 6), W - 6 - btnW) + (btnW - w) / 2;
          const top = (y / 100) * H - h / 2;
          return { id: o.id, l: left, r: left + w, t: top, b: top + h };
        });
        for (const a of rects) {
          expect(a.l, `${W} ${a.id} left`).toBeGreaterThanOrEqual(0);
          expect(a.r, `${W} ${a.id} right`).toBeLessThanOrEqual(W);
          expect(a.b, `${W} ${a.id} bottom`).toBeLessThanOrEqual(H);
          for (const b of rects) {
            if (a.id >= b.id) continue;
            const overlap = a.l < b.r + 2 && b.l < a.r + 2 && a.t < b.b + 2 && b.t < a.b + 2;
            expect(overlap, `${W}px ${a.id} × ${b.id}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('큰 화면 /gung/scene', () => {
  it('사건 표식을 보이고, ②는 확인 한 번 뒤에 열린다. 게임 저장은 무변경', async () => {
    const { SceneStandalone } = await import('../scene/SceneStandalone');
    search = 'code=7F3K5';
    window.localStorage.setItem('gu:game:v1', 'SENTINEL');
    render(<SceneStandalone />);
    await flush();
    expect(document.body.textContent).toContain('사건 표식 · ');
    expect(document.body.textContent).not.toContain('7F3K');
    expect(screen.getByRole('button', { name: '첫째 조사' }).getAttribute('aria-pressed')).toBe('true');
    const r2Probe = probe(ALL_LINES.find((l) => l.fromRound === 2)!.text);
    expect(document.body.innerHTML).not.toContain(r2Probe);

    fireEvent.click(screen.getByRole('button', { name: '둘째 조사' }));
    await flush();
    const dialog = screen.getByRole('dialog', { name: '둘째 조사 현장을 열겠소?' });
    expect(dialog.textContent).toContain("방장이 '둘째 조사를 시작하오'라고 한 뒤에만 누르시오.");
    fireEvent.click(within(dialog).getByRole('button', { name: '아직이오' }));
    await flush();
    expect(screen.getByRole('button', { name: '첫째 조사' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: '둘째 조사' }));
    await flush();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '열겠소' }));
    await flush();
    expect(screen.getByRole('button', { name: '둘째 조사' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('region', { name: /이번 조사 새 관찰/ })).toBeTruthy();

    // 한 번 연 조사는 다시 확인하지 않는다
    fireEvent.click(screen.getByRole('button', { name: '첫째 조사' }));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: '둘째 조사' }));
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(window.localStorage.getItem('gu:game:v1')).toBe('SENTINEL');
  });

  it('코드가 없어도·틀려도 그림은 뜬다(현장은 인원과 무관)', async () => {
    const { SceneStandalone } = await import('../scene/SceneStandalone');
    search = 'code=zzz';
    render(<SceneStandalone />);
    await flush();
    expect(document.body.textContent).toContain('방 코드를 알아볼 수 없소');
    expect(document.querySelector('svg.gu-scene-art')).not.toBeNull();
  });
});
