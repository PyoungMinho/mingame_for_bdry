// @vitest-environment jsdom
/**
 * 현장 화면 단위(7판 조사 따로) — 이동 연출(SceneMove, 공용) · 살펴보기(ExaminePanel, 개인) · 그림 레지스트리.
 *
 *  - SceneMove: 그림·「조사 N · 이동」·장소 이름·이동 한 줄·살펴보기 안내뿐 — 물건 이름표·관찰 글 0. idScope 로 SVG id 고정.
 *  - ExaminePanel: 2탭(고르기 → 살펴보기) · 횟수 · 잠금 · 마감(closed) · 방금 본 카드는 열리고 10초 뒤 저절로 가려진다 ·
 *    화면이 숨거나(visibilitychange) 상위 봉인 신호(sealEpoch)에 즉시 가려진다 · 가려진 동안 글은 DOM 에 없다.
 *  - 그림: 라운드에 따라 달라지지 않는다(공용 화면에도 뜨므로 관찰 줄의 겉모습을 그리지 않는다 — 원고 10-1 「그림 금지」·10-5).
 *    모든 물건에 자리·짧은 이름표, 375px·320px 폰에서 이름표가 겹치지 않는다.
 *  - 소스 의존: 공용 화면 파일(SceneMove·큰 화면)은 사건 데이터·현장 엔진·배정·봉인·게임 저장을 import 하지 않는다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { sejaCase as c } from '@/lib/gung/case-data';
import { GUIDE, guideText } from '@/lib/gung/guide-data';
import { canExamine, sceneStop, type ExamineLog } from '@/lib/gung/scene';
import { SCENE_ROUTE } from '@/lib/gung/scene-route-data';
import type { RoundNo } from '@/lib/gung/types';
import { SCENE_ARTS, sceneArt } from '../components/scenes';
import { ExaminePanel, OBS_OPEN_MS } from './ExaminePanel';
import { SceneMove } from './SceneMove';

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
const LINES = SCENES.flatMap((s) => s.objects.flatMap((o) => o.lines.map((l) => ({ ...l, objectId: o.id }))));
const probe = (text: string) => text.replace(/^[가-힣 ]{1,6}:\s*/, '').slice(0, 10);
const lineOf = (id: string, round: number) => probe(LINES.find((l) => l.objectId === id && l.fromRound === round)!.text);

/** 엔진처럼 기록을 쥐는 감싸개 — 살펴보기 액션 규칙(canExamine)을 그대로 */
function Harness({ round, closed = false, epoch = 0, init = {} }: { round: RoundNo; closed?: boolean; epoch?: number; init?: ExamineLog }) {
  const [log, setLog] = useState<ExamineLog>(init);
  return (
    <ExaminePanel
      c={c}
      round={round}
      log={log}
      closed={closed}
      sealEpoch={epoch}
      idScope="t"
      onExamine={(id) => setLog((l) => (canExamine(c, l, round, id) ? { ...l, [round]: [...(l[round] ?? []), id] } : l))}
    />
  );
}
const spot = (root: ParentNode, id: string) => root.querySelector<HTMLElement>(`button.gu-scene-spot[data-obj="${id}"]`)!;
async function examine(root: HTMLElement, id: string) {
  fireEvent.click(spot(root, id));
  await flush();
  fireEvent.click(within(root).getByRole('button', { name: /^살펴보기 \(\d번 남음\)/ }));
  await flush();
}

describe('SceneMove — 이동 연출(공용)', () => {
  it.each([1, 2, 3] as const)('조사 %i — 그림·장소 이름·이동 한 줄·살펴보기 안내 · 물건 이름표·관찰 글 0', (round) => {
    const stop = SCENE_ROUTE.find((s) => s.round === round)!;
    const { container } = render(<SceneMove stop={stop} idScope="host" />);
    const sec = container.querySelector('section.gu-move')!;
    expect(sec.getAttribute('aria-label')).toBe(`${GUIDE.sceneLabel} · ${stop.placeName}`);
    expect(container.querySelector(`svg.gu-scene-art[data-art="${stop.art}"]`)?.getAttribute('aria-hidden')).toBe('true');
    expect(sec.textContent).toContain(`조사 ${round} · ${GUIDE.moveTag}`);
    expect(sec.textContent).toContain(stop.placeName);
    expect(sec.textContent).toContain(`「${stop.cue}」`);
    expect(sec.textContent).toContain(guideText.examineCue(stop.examine));
    expect(container.querySelectorAll('button')).toHaveLength(0);
    for (const l of LINES) expect(container.innerHTML.includes(probe(l.text)), l.objectId).toBe(false);
    // 방장 무대(엔진 sceneStop)와 큰 화면(공개 모듈)이 같은 화면
    const fromEngine = render(<SceneMove stop={sceneStop(c, round)} idScope="host" />);
    expect(fromEngine.container.innerHTML).toBe(container.innerHTML);
  });

  it('조사 전(null)이면 그림 없이 한 줄', () => {
    const { container } = render(<SceneMove stop={null} />);
    expect(container.textContent).toContain('조사가 시작되면 현장이 열리오');
    expect(container.querySelector('svg')).toBeNull();
  });

  it('idScope 를 주면 SVG id 가 고정되고, 다른 범위끼리는 겹치지 않는다 · url(#…) 은 제 그림 안을 가리킨다', () => {
    const a = render(<SceneMove stop={SCENE_ROUTE[0]} idScope="host" />);
    const ids = Array.from(a.container.querySelectorAll('svg [id]')).map((e) => e.id);
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((id) => id.startsWith('dg-shost-'))).toBe(true);
    const b = render(<SceneMove stop={SCENE_ROUTE[0]} idScope="big" />);
    const ids2 = Array.from(b.container.querySelectorAll('svg [id]')).map((e) => e.id);
    expect(ids2.some((id) => ids.includes(id))).toBe(false);
    for (const root of [a.container, b.container]) {
      const own = new Set(Array.from(root.querySelectorAll('svg [id]')).map((e) => e.id));
      const refs = [...root.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map((m) => m[1]);
      expect(refs.length).toBeGreaterThan(5);
      for (const r of refs) expect(own.has(r), r).toBe(true);
    }
  });
});

describe('ExaminePanel — 살펴보기(개인)', () => {
  it('2탭(고르기 → 살펴보기) · 남은 횟수 · 2번 쓰면 나머지 잠금 · 본 물건 ✓', async () => {
    const { container } = render(<Harness round={1} />);
    const p = container.querySelector<HTMLElement>('section.gu-examine')!;
    expect(p.dataset.left).toBe('2');
    expect(p.textContent).toContain(guideText.examineLeft(2, 2));
    expect(Array.from(p.querySelectorAll<HTMLElement>('button.gu-scene-spot')).map((b) => b.dataset.obj)).toEqual(['OB-DG1', 'OB-DG2', 'OB-DG3', 'OB-DG4', 'OB-DG5']);
    // 이름표: 그림 레지스트리의 짧은 이름(꿀단지 · 번 나인 둘)
    expect(spot(p, 'OB-DG4').textContent).toBe('꿀단지');
    expect(spot(p, 'OB-DG4').getAttribute('aria-label')).toBe('서온돌 다과상의 꿀단지');
    fireEvent.click(spot(p, 'OB-DG3'));
    await flush();
    expect(spot(p, 'OB-DG3').getAttribute('aria-pressed')).toBe('true');
    expect(p.textContent).toContain(GUIDE.examineOnce);
    expect(p.dataset.left).toBe('2'); // 고르기만으론 안 쓴다
    fireEvent.click(within(p).getByRole('button', { name: '살펴보기 (2번 남음)' }));
    await flush();
    expect(p.dataset.left).toBe('1');
    expect(spot(p, 'OB-DG3').hasAttribute('data-seen')).toBe(true);
    expect(spot(p, 'OB-DG3').getAttribute('aria-label')).toBe('은숟가락, 살펴본 물건');
    await examine(p, 'OB-DG1');
    expect(p.dataset.left).toBe('0');
    expect(p.querySelector('.gu-examine-left')!.hasAttribute('data-spent')).toBe(true);
    for (const id of ['OB-DG2', 'OB-DG4', 'OB-DG5']) {
      expect(spot(p, id).hasAttribute('data-locked'), id).toBe(true);
      expect(spot(p, id).getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(spot(p, id));
      await flush();
      expect(within(p).queryByRole('button', { name: /^살펴보기/ })).toBeNull();
    }
    expect(p.textContent).toContain(GUIDE.examineSpent);
  });

  it('방금 본 카드는 바로 열리고 10초 뒤 저절로 가려진다 — 가려진 동안 글은 DOM 에 없다 · 다시 탭하면 열린다', async () => {
    vi.useFakeTimers();
    const { container } = render(<Harness round={1} />);
    const p = container.querySelector<HTMLElement>('section.gu-examine')!;
    await examine(p, 'OB-DG5');
    const card = () => p.querySelector<HTMLElement>('.gu-obs[data-obj="OB-DG5"]')!;
    expect(card().hasAttribute('data-open')).toBe(true);
    expect(card().textContent).toContain(lineOf('OB-DG5', 1));
    expect(card().textContent).toMatch(/10초 뒤 가려져요/);
    act(() => {
      vi.advanceTimersByTime(OBS_OPEN_MS - 500);
    });
    expect(card().hasAttribute('data-open')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(card().hasAttribute('data-open')).toBe(false);
    expect(p.innerHTML).not.toContain(lineOf('OB-DG5', 1));
    expect(card().textContent).toContain(GUIDE.obsSealed);
    fireEvent.click(card());
    expect(card().textContent).toContain(lineOf('OB-DG5', 1));
    // 본 물건 이름표를 눌러도 그 카드를 연다(횟수는 그대로)
    fireEvent.click(card());
    expect(card().hasAttribute('data-open')).toBe(false);
    fireEvent.click(spot(p, 'OB-DG5'));
    await flush();
    expect(card().hasAttribute('data-open')).toBe(true);
    expect(p.dataset.left).toBe('1');
  });

  it('화면이 숨으면(visibilitychange) · 상위 봉인 신호(sealEpoch)가 바뀌면 즉시 가려진다', async () => {
    const r = render(<Harness round={1} epoch={0} />);
    const p = r.container.querySelector<HTMLElement>('section.gu-examine')!;
    await examine(p, 'OB-DG2');
    expect(p.querySelector('.gu-obs[data-open]')).not.toBeNull();
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    fireEvent(document, new Event('visibilitychange'));
    await flush();
    expect(p.querySelector('.gu-obs[data-open]')).toBeNull();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    fireEvent.click(p.querySelector('.gu-obs')!);
    expect(p.querySelector('.gu-obs[data-open]')).not.toBeNull();
    r.rerender(<Harness round={1} epoch={1} />);
    await flush();
    expect(r.container.querySelector('.gu-obs[data-open]')).toBeNull();
    expect(r.container.innerHTML).not.toContain(lineOf('OB-DG2', 1));
  });

  it('장소를 정하면(closed) 안 본 물건은 모두 잠기고 「살펴보기가 끝났소」 · 본 카드는 그대로 다시 볼 수 있다', async () => {
    const { container } = render(<Harness round={2} closed init={{ 2: ['OB-NY4'] }} />);
    const p = container.querySelector<HTMLElement>('section.gu-examine')!;
    expect(p.getAttribute('aria-label')).toBe(`${GUIDE.examineHead} · 내의원`);
    expect(p.dataset.left).toBe('0');
    expect(p.textContent).toContain(GUIDE.examineClosed);
    for (const id of ['OB-NY1', 'OB-NY2', 'OB-NY3', 'OB-NY5']) expect(spot(p, id).hasAttribute('data-locked'), id).toBe(true);
    expect(spot(p, 'OB-NY4').hasAttribute('data-locked')).toBe(false);
    fireEvent.click(spot(p, 'OB-NY1'));
    await flush();
    expect(within(p).queryByRole('button', { name: /^살펴보기/ })).toBeNull();
    fireEvent.click(spot(p, 'OB-NY4'));
    await flush();
    expect(p.querySelector('.gu-obs[data-obj="OB-NY4"]')!.textContent).toContain(lineOf('OB-NY4', 2));
  });

  it('조사 3 동궁전 — 조사 1 줄 + 조사 3 줄(조사 꼬리표 둘), 조사 1·2 화면엔 조사 3 줄 0', async () => {
    const { container } = render(<Harness round={3} />);
    const p = container.querySelector<HTMLElement>('section.gu-examine')!;
    await examine(p, 'OB-DG4');
    const card = p.querySelector<HTMLElement>('.gu-obs[data-obj="OB-DG4"]')!;
    expect(Array.from(card.querySelectorAll('.gu-obs-line-round')).map((e) => e.textContent)).toEqual(['조사 1', '조사 3']);
    expect(card.textContent).toContain(lineOf('OB-DG4', 3));
    cleanup();
    for (const round of [1, 2] as const) {
      const all = { 1: SCENES.flatMap((s) => s.objects.map((o) => o.id)), 2: SCENES.flatMap((s) => s.objects.map((o) => o.id)) };
      const v = render(<Harness round={round} init={all} />);
      for (const b of Array.from(v.container.querySelectorAll<HTMLElement>('.gu-obs'))) fireEvent.click(b); // 다 열어 본다
      for (const l of LINES.filter((x) => x.fromRound > round)) expect(v.container.innerHTML.includes(probe(l.text)), `R${round} ← ${l.objectId}`).toBe(false);
      v.unmount();
    }
  });
});

describe('그림 레지스트리 — 자리·이름표·라운드 무관', () => {
  it('사건 데이터의 모든 그림 키에 그림이 있고(남는 그림 없음), 모든 물건에 자리·짧은 이름표가 있다', () => {
    expect(Object.keys(SCENE_ARTS).sort()).toEqual(SCENES.map((s) => s.art).sort());
    for (const r of SCENE_ROUTE) expect(sceneArt(r.art), r.art).not.toBeNull();
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
        expect(o.name.includes(label), `${o.id} ${label}`).toBe(true); // 이름표는 데이터 이름을 줄인 말뿐(새 사실 없음)
      }
    }
  });

  it('그림은 조사 라운드에 따라 달라지지 않는다(공용 화면에 뜨므로 관찰의 겉모습을 그리지 않는다)', () => {
    for (const s of SCENES) {
      const Art = sceneArt(s.art)!.Art;
      const html = ([1, 2, 3] as const).map((round) => {
        const { container, unmount } = render(<Art round={round} idScope="x" />);
        const h = container.innerHTML;
        unmount();
        return h;
      });
      expect(html[1], s.art).toBe(html[0]);
      expect(html[2], s.art).toBe(html[0]);
      expect(html[0].includes('data-detail'), s.art).toBe(false);
    }
  });

  /**
   * QA 7판 BUG-V7-01·02 — 살펴보기 캔버스는 카드(.gu-examine) 안쪽이라 폰 폭 − 58px 다(gutter 16×2 + 카드 padding 12×2 + 테두리).
   * 예전 테스트는 6판 무대 폭(343·288)으로 재서 ① 360·375 폰의 이름표가 12px 로 떨어진 것 ② 약절구 56px 터치 칸이
   * 약탕관 이름표를 덮는 것을 못 잡았다. 글자 폭은 Pretendard 실측(한글 0.864em · 공백 0.23em · 이름표 = 글자 + 1.28em, 높이 1.83em).
   *  - 글자 크기: CSS 와 같게 — 캔버스 300px 이상 max(14, 3.8cqw), 그 아래(320 기기) max(12, 3.8cqw).
   *  - 이름표끼리 2px 안쪽으로 붙지 않는다(모든 폭) · 그림 밖으로 나가지 않는다.
   *  - 터치 칸(최소 56×56, 이름표 가운데)이 나중에 그려지는 물건이면 앞 물건 이름표를 덮지 않는다(14px 구간 = 360 폰 이상).
   */
  it('폰 폭 320·360·375·390·412(캔버스 262·302·317·332·354)에서 이름표 14px 바닥 · 이름표끼리 안 겹침 · 남의 터치 칸이 이름표를 안 덮음', () => {
    // CSS 의 14px 바닥 문턱이 360 폰 살펴보기 캔버스(302px) 이하여야 한다(BUG-V7-01: 320 이라 360·375 폰이 12px 였다)
    const css = fs.readFileSync(path.resolve(__dirname, '../gung.css'), 'utf8');
    const floor = /@container \(min-width: (\d+)px\) \{\s*\.gu-scene-spot \{ font-size: clamp\(14px/.exec(css);
    expect(floor, '이름표 14px 바닥 @container 규칙').not.toBeNull();
    expect(Number(floor![1]), '14px 바닥 문턱 ≤ 302(360 폰 캔버스)').toBeLessThanOrEqual(360 - 58);
    // 큰 화면 조사 칩 = 술자리 터치 56px(6판 52px)
    expect(/\.gu-scenebig-chip \{[^}]*height: 56px/.test(css), '큰 화면 조사 칩 56px').toBe(true);
    for (const phone of [320, 360, 375, 390, 412]) {
      const W = phone - 58;
      const H = W * 0.625;
      const f = Math.max(W >= 300 ? 14 : 12, Math.min(26, 0.038 * W));
      if (phone >= 360) expect(f, `${phone}px 폰 이름표 글자`).toBeGreaterThanOrEqual(14);
      const textW = (s: string) => Array.from(s).reduce((a, ch) => a + (ch === ' ' ? 0.23 : ch === '·' ? 0.45 : 0.864) * f, 0);
      for (const s of SCENES) {
        const art = sceneArt(s.art)!;
        const rects = s.objects.map((o) => {
          const label = art.labels[o.id] ?? o.name;
          const w = textW(label) + 1.28 * f;
          const h = 1.83 * f;
          const btnW = Math.max(56, w + 4);
          const btnH = Math.max(56, h);
          const [x, y] = art.anchors[o.id];
          const cx = (x / 100) * W;
          const cy = (y / 100) * H;
          const btnL = Math.min(Math.max(cx - btnW / 2, 6), W - 6 - btnW);
          const left = btnL + (btnW - w) / 2;
          return { id: o.id, l: left, r: left + w, t: cy - h / 2, b: cy + h / 2, bl: btnL, br: btnL + btnW, bt: cy - btnH / 2, bb: cy + btnH / 2 };
        });
        rects.forEach((a, i) => {
          expect(a.l, `${phone} ${a.id} left`).toBeGreaterThanOrEqual(0);
          expect(a.r, `${phone} ${a.id} right`).toBeLessThanOrEqual(W);
          expect(a.t, `${phone} ${a.id} top`).toBeGreaterThanOrEqual(0);
          expect(a.b, `${phone} ${a.id} bottom`).toBeLessThanOrEqual(H);
          rects.forEach((b, j) => {
            if (i === j) return;
            if (i < j) {
              const overlap = a.l < b.r + 2 && b.l < a.r + 2 && a.t < b.b + 2 && b.t < a.b + 2;
              expect(overlap, `${phone}px ${a.id} × ${b.id} 이름표`).toBe(false);
            }
            // 나중 물건(j > i)의 터치 칸이 앞 물건 이름표를 덮으면 앞 물건을 눌러도 뒤 물건이 골린다(살펴보기 1회 낭비)
            // (모서리 2px 이하 스침은 손가락으로 가릴 수 없는 크기라 허용)
            if (phone >= 360 && j > i) {
              const ox = Math.min(a.r, b.br) - Math.max(a.l, b.bl);
              const oy = Math.min(a.b, b.bb) - Math.max(a.t, b.bt);
              expect(ox > 2 && oy > 2, `${phone}px ${b.id} 터치 칸이 ${a.id} 이름표를 덮음(${ox.toFixed(1)}×${oy.toFixed(1)}px)`).toBe(false);
            }
          });
        });
      }
    }
  });
});

describe('소스 의존 — 공용 화면은 관찰·역할을 끌어오지 않는다', () => {
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const importsOf = (src: string) => [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);

  it('SceneMove·큰 화면·조사 칩 기록: 사건 데이터·현장 엔진·배정·봉인·게임 저장·엔진 index 없음', () => {
    const allowed = new Set([
      'react',
      'next',
      'next/navigation',
      '@/lib/gung/types',
      '@/lib/gung/guide-data',
      '@/lib/gung/room',
      '@/lib/gung/scene-route-data',
      '../components/scenes',
      '../components/BottomSheet',
      '../components/GuButton',
      '../lib/useWakeLock',
      '../lib/sceneStore',
      '../screens/SceneMove',
    ]);
    for (const f of ['screens/SceneMove.tsx', 'scene/SceneStandalone.tsx', 'scene/page.tsx', 'lib/sceneStore.ts']) {
      for (const s of importsOf(read(f))) expect(allowed.has(s) || s === './SceneStandalone', `${f} → ${s}`).toBe(true);
      const code = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(code, f).not.toMatch(/\b(sejaCase|case-data|assignFromCode|assignmentOf|getSheet|getClue|clueSeal|sealTable|roleAtSeat|observe|examineObjects)\b/);
      expect(code, f).not.toContain('gu:game');
    }
  });

  it('그림 부품(components/scenes/*)은 엔진·사건 데이터를 import 하지 않는다(프레젠테이션 전용)', () => {
    const dir = path.join(ROOT, 'components/scenes');
    for (const f of fs.readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
      for (const s of importsOf(fs.readFileSync(path.join(dir, f), 'utf8'))) expect(s === 'react' || s.startsWith('./'), `${f} → ${s}`).toBe(true);
    }
  });

  it('ExaminePanel 은 역할·자리·배정을 받지 않는다(사건·조사·이 폰의 기록만)', () => {
    const src = read('screens/ExaminePanel.tsx').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/\b(assignFromCode|assignmentOf|getSheet|getClue|clueSeal|roleAtSeat|roleById|culprit)\b/);
    expect(src).not.toMatch(/\b(seat|role|playerCount|assignment)\??:\s/); // 받는 값(props)에 자리·역할·인원 없음
  });
});
