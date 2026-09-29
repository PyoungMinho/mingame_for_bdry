'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { formatClock, infectionLeft, resolveParas } from '@/lib/zombie/engine';
import { AlertOverlay } from './components/AlertOverlay';
import { ChoiceList } from './components/ChoiceList';
import { EndingScreen } from './components/EndingScreen';
import { Hud } from './components/Hud';
import { BagPanel, Drawer, MapPanel } from './components/Panels';
import { ResultPanel } from './components/ResultPanel';
import { SceneFrame, type FrameFx } from './components/SceneFrame';
import { TitleScreen } from './components/TitleScreen';
import { useZombieGame } from './lib/useZombieGame';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const noop = () => {};

export default function ZombiePage() {
  const g = useZombieGame();
  const [drawer, setDrawer] = useState<'map' | 'bag' | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  const nodeId = g.node?.id;
  const pending = g.pending;
  const ended = Boolean(g.state?.ending);

  // 장면·화면·엔딩이 바뀌면 열려 있던 드로어는 닫는다 (새 판에 이전 드로어가 되살아나지 않게)
  useEffect(() => {
    setDrawer(null);
  }, [nodeId, g.screen, ended]);

  // 새 장면 → 문서 맨 위로 + 제목에 포커스(스크린리더가 새 장면을 읽도록), 결과 등장 → 결과가 보이게
  useEffect(() => {
    if (!nodeId || pending) return;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    titleRef.current?.focus({ preventScroll: true });
  }, [nodeId, pending]);
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => {
      resultRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [pending]);

  // 저장소를 읽기 전(서버 렌더·하이드레이션 직후)에도 타이틀은 그대로 그릴 수 있다 — 빈 화면 대신
  if (!g.ready) {
    return <TitleScreen saved={null} found={{}} storageOk onStart={noop} onResume={noop} onViewEnding={noop} />;
  }

  if (g.screen === 'title' || !g.state) {
    return (
      <TitleScreen
        saved={g.saved}
        found={g.found}
        storageOk={g.storageOk}
        onStart={g.start}
        onResume={g.resume}
        onViewEnding={g.viewEnding}
      />
    );
  }

  if (g.state.ending && !pending && g.ending) {
    return <EndingScreen state={g.state} ending={g.ending} found={g.found} onRestart={g.start} onTitle={g.toTitle} />;
  }

  const node = g.node;
  const view = g.view;
  if (!node || !view) return <div className="zb-boot" />;

  // HUD 는 선택 직후의 상태(스탯 바가 변화를 따라 움직이도록), 장면·본문은 고른 순간의 상태
  const hudState = pending ? pending.state : view;
  let fx: FrameFx = null;
  if (pending) {
    const d = pending.delta;
    if (d.infected) fx = 'infect';
    else if (d.hp + d.upkeep.hp <= -10) fx = 'hit';
    else if (d.mental + d.upkeep.mental <= -10) fx = 'shock';
  }
  const body = resolveParas(view, node.body);

  return (
    <>
      <Hud state={hudState} node={node} onMap={() => setDrawer('map')} onBag={() => setDrawer('bag')} />
      <div className="zb-app">
        <main className="zb-main">
          <SceneFrame
            scene={node.scene}
            label={`${node.title} — 장면 삽화`}
            chapter={node.chapter}
            location={node.location}
            hpLow={hudState.stats.hp <= 25}
            mentalLow={hudState.stats.mental <= 25}
            infected={infectionLeft(hudState) !== null}
            fx={fx}
            fxKey={hudState.history.length}
          >
            {node.alert && !pending && <AlertOverlay key={node.id} alert={node.alert} time={formatClock(view.clock).split(' ')[1]} />}
          </SceneFrame>

          <article key={node.id} className="zb-story">
            <h1 className="zb-story-title" ref={titleRef} tabIndex={-1}>
              {node.title}
            </h1>
            <div className="zb-story-body">
              {body.map((p, i) => (
                <p key={i} style={{ ['--i' as string]: i }}>
                  {p}
                </p>
              ))}
            </div>
          </article>

          <div ref={resultRef} className="zb-result-anchor">
            {pending ? (
              <ResultPanel key={`r-${hudState.history.length}`} res={pending} onContinue={g.advance} />
            ) : (
              <ChoiceList state={view} node={node} onChoose={g.choose} disabled={drawer !== null} />
            )}
          </div>
        </main>

        <aside className="zb-side" aria-label="지도와 가방">
          <MapPanel state={hudState} current={node.location} chapter={node.chapter} />
          <BagPanel state={hudState} />
        </aside>
      </div>

      <Drawer title="지도 · 기록" open={drawer === 'map'} onClose={closeDrawer}>
        <MapPanel state={hudState} current={node.location} chapter={node.chapter} />
      </Drawer>
      <Drawer title="가방 · 동료" open={drawer === 'bag'} onClose={closeDrawer}>
        <BagPanel state={hudState} />
      </Drawer>
    </>
  );
}
