'use client';

/**
 * 엔딩(W60) · 수사 배제(W65) · 사이렌(W12) 화면 래퍼 — 표시 컴포넌트는 components/Ending·Overlays.
 * 엔딩 데이터는 진행 중인 판의 결과(메모리)가 있으면 그것, 새로고침 뒤에는 meta.lastEnding(pendingView)에서 복원한다.
 */
import { useEffect } from 'react';
import { caseFileUnlocked, rewind } from '@/lib/witness';
import { endingFromLast, endingFromResult } from '../lib/format';
import { useWt } from '../lib/context';
import { EndingView } from '../components/Ending';
import { ExcludedView } from '../components/Overlays';

export function EndingScreen() {
  const { game, openCollection, openCaseFile, openShare } = useWt();
  const run = game.run;
  const data = run?.result ? endingFromResult(run.result) : game.meta.lastEnding ? endingFromLast(game.meta.lastEnding) : null;

  useEffect(() => {
    if (!data) game.setView('title');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;
  return (
    <main className="wt-screen wt-screen--ending">
      <EndingView
        data={data}
        caseFile={{ unlocked: caseFileUnlocked(game.meta), plays: game.meta.plays }}
        onShare={() => openShare(data)}
        onAgain={() => game.startNew({ skipTutorial: game.meta.plays >= 1 })}
        onCollection={openCollection}
        onCaseFile={openCaseFile}
        onTitle={() => {
          game.leaveEnding();
          game.toTitle();
        }}
      />
    </main>
  );
}

export function ExcludedScreen() {
  const { game } = useWt();
  const run = game.run;
  return (
    <main className="wt-screen wt-screen--ending">
      <ExcludedView
        canRewind={!!run?.checkpoint}
        onRewind={() => game.act((r) => rewind(r))}
        onNewRun={() => game.startNew()}
        onTitle={game.toTitle}
      />
    </main>
  );
}
