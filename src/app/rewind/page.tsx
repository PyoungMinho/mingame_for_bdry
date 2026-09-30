'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ENDINGS } from '@/lib/rewind/content';
import { resolveParas } from '@/lib/rewind/engine';
import { MARKET } from '@/lib/rewind/market-data';
import type { AssetId } from '@/lib/rewind/types';
import { AlertCard, Choices, Photo, Sheet, sceneValuation } from './components/common';
import { EndingView, Hud, Result, TimelinePanel, Title, WalletPanel, chapterOfYear } from './components/Screens';
import { Settle } from './components/Settle';
import { useRewindGame } from './lib/useRewindGame';

const noop = () => {};

export default function RewindPage() {
  const g = useRewindGame();
  const [sheet, setSheet] = useState<'timeline' | 'wallet' | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setSheet(null), []);

  const nodeId = g.node?.id;
  const pending = g.pending;
  const settlingYear = g.state?.settling?.year;
  const ended = Boolean(g.state?.final);

  useEffect(() => setSheet(null), [nodeId, settlingYear, ended, g.screen]);
  useEffect(() => {
    if (pending) return;
    window.scrollTo({ top: 0 });
    titleRef.current?.focus({ preventScroll: true });
  }, [nodeId, settlingYear, pending]);
  useEffect(() => {
    if (!pending) return;
    const t = window.setTimeout(() => resultRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 60);
    return () => window.clearTimeout(t);
  }, [pending]);

  if (!g.ready) return <Title saved={null} found={{}} endingsTotal={ENDINGS.length} onStart={noop} onResume={noop} />;
  if (g.screen === 'title' || !g.state) {
    return <Title saved={g.saved} found={g.found} endingsTotal={ENDINGS.length} onStart={g.start} onResume={g.resume} />;
  }
  const s = g.state;
  if (s.final && !pending) {
    return <EndingView state={s} found={g.found} endingsTotal={ENDINGS.length} onRestart={() => g.start(s.gender)} onTitle={g.toTitle} />;
  }

  const node = g.node;
  const view = g.view;
  if (!node || !view) return <div className="rw-boot" />;
  const hudState = pending ? pending.state : view;
  // 방금 체결한 자산은 그 체결가로, 나머지는 장면 날짜 시세로 평가한다
  const traded: Partial<Record<AssetId, number>> = {};
  if (pending) for (const r of pending.delta.trades) if (r.ok) traded[r.asset] = r.price;
  const sceneValue = sceneValuation(MARKET, hudState.wallet, node.date, traded);

  if (s.settling && !pending) {
    const settleChapter = chapterOfYear(s.settling.year);
    return (
      <>
        <Hud state={s} node={node} onTimeline={() => setSheet('timeline')} onWallet={() => setSheet('wallet')} />
        <div className="rw-app">
          <main className="rw-main">
            <Settle key={s.settling.year} state={s} data={MARKET} lastTrade={g.lastTrade} onTrade={g.trade} onRepay={g.repay} onNext={g.nextYear} />
          </main>
          <aside className="rw-side">
            <TimelinePanel state={s} chapter={settleChapter} />
          </aside>
        </div>
        <Sheet title="인생 연표" open={sheet === 'timeline'} onClose={close}>
          <TimelinePanel state={s} chapter={settleChapter} />
        </Sheet>
        <Sheet title="보유 자산" open={sheet === 'wallet'} onClose={close}>
          <WalletPanel state={s} />
        </Sheet>
      </>
    );
  }

  const body = resolveParas(view, node.body, MARKET);
  return (
    <>
      <Hud state={hudState} node={node} value={sceneValue} onTimeline={() => setSheet('timeline')} onWallet={() => setSheet('wallet')} />
      <div className="rw-app">
        <main className="rw-main">
          <Photo scene={node.scene} date={node.date} label={`${node.title} — 장면 삽화`}>
            {node.alert && !pending && <AlertCard key={node.id} alert={node.alert} />}
          </Photo>
          <article key={node.id} className="rw-story">
            <h1 className="rw-story-title" ref={titleRef} tabIndex={-1}>
              {node.title}
            </h1>
            {body.map((p, i) => (
              <p key={i} style={{ ['--i' as string]: i }}>
                {p}
              </p>
            ))}
          </article>
          <div ref={resultRef} className="rw-result-anchor">
            {pending ? <Result res={pending} onContinue={g.advance} /> : <Choices state={view} node={node} data={MARKET} onChoose={g.choose} disabled={sheet !== null} />}
          </div>
        </main>
        <aside className="rw-side">
          <WalletPanel state={hudState} value={sceneValue} />
          <TimelinePanel state={hudState} chapter={node.chapter} />
        </aside>
      </div>
      <Sheet title="인생 연표" open={sheet === 'timeline'} onClose={close}>
        <TimelinePanel state={hudState} chapter={node.chapter} />
      </Sheet>
      <Sheet title="보유 자산" open={sheet === 'wallet'} onClose={close}>
        <WalletPanel state={hudState} value={sceneValue} />
      </Sheet>
    </>
  );
}
