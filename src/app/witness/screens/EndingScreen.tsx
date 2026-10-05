'use client';

/**
 * 엔딩(W60) · 수사 배제(W65) · 사이렌(W12) 화면 래퍼 — 표시 컴포넌트는 components/Ending·Overlays.
 * 엔딩 데이터는 진행 중인 판의 결과(메모리)가 있으면 그것, 새로고침 뒤에는 meta.lastEnding(pendingView)에서 복원한다.
 * 되감기(witness-replay.md): 끝난 판이 저장돼 있으면(되감기 선택지가 있을 때) [↺ 직전부터 다시]가 뜨고, 누르면 허브로 돌아간다.
 *  - 지목 되감기 → 지목 직전 허브(미리 채운 칸) · 시간 초과 되감기 → 한 수 전 허브 · 수사 배제 되감기 → 증언 직전.
 *  - 「지목 조건이 다시 닫혔어요」 토스트는 실제로는 수사 배제 되감기에서만 뜬다(시간 초과는 ★<3 에서만 생기고, 지목 직전 스냅샷은 ★ 가 같다 — QA-RP-04).
 *  - 부제는 돌아가는 곳 + 판의 상한(기억 판 B · 그 밖 A): 「지목 직전으로 · 최고 A」(QA-RP-01·UX-5).
 *  - 되감기를 기다리는 판에서는 사건 파일을 잠근다(진상 해설이 되감기 직전 정답이 되지 않게, A2·UX-1).
 *  - 소리: 되감는 순간 종이 넘기는 소리(기존 paper). 사이렌으로 돌아가면 사이렌 연출이 이어진다.
 */
import { useEffect } from 'react';
import { caseFileUnlocked, gradeCapOf, rewind, rewindOption, rewindSlotsLeft, type RewindOption, type RunState } from '@/lib/witness';
import { endingFromLast, endingFromResult } from '../lib/format';
import { REPLAY_TEXT, TOAST } from '../lib/copy';
import { useWt } from '../lib/context';
import { EndingView } from '../components/Ending';
import { ExcludedView } from '../components/Overlays';
import { playSfx } from '../audio/useGameAudio';

/** 되감기 실행(엔딩·배제 화면 공통) — 이벤트를 소리·토스트로 번역한다 */
function useRewind() {
  const { game, toast } = useWt();
  return () => {
    const step = game.act((r) => rewind(r));
    if (step.error === 'stale') return; // 다른 탭의 저장을 다시 읽었다 — 안내는 앱이 한다
    if (step.error) {
      toast({ kind: 'warn', text: '지금은 되감을 수 없다', ms: 1800 });
      return;
    }
    playSfx('paper');
    const ev = step.events.find((e): e is Extract<typeof e, { t: 'rewound' }> => e.t === 'rewound');
    if (ev?.gateClosed) toast({ kind: 'info', text: TOAST.gateClosed, ms: 3200 });
    // 엔딩 화면(view 'ending')에서 눌렀다면 판이 다시 플레이로 돌아온다
    game.setView('play');
  };
}

/** 되감기 부제 — 돌아가는 곳 · 되감은 판의 상한(기억 판 B) · 마지막 1번 */
export function rewindSubOf(run: RunState, opt: RewindOption): string {
  const cap = gradeCapOf({ ...run, rewound: true }) ?? 'A';
  return REPLAY_TEXT.rewindSub(opt.kind, cap, opt.last);
}

export function EndingScreen() {
  const { game, openCollection, openCaseFile, openShare, requestNewRun } = useWt();
  const run = game.run;
  const data = run?.result ? endingFromResult(run.result) : game.meta.lastEnding ? endingFromLast(game.meta.lastEnding) : null;
  const doRewind = useRewind();

  useEffect(() => {
    if (!data) game.setView('title');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;
  // 되감기 선택지는 '이 엔딩이 방금 끝난 판'일 때만(run.result 가 있을 때). 칸을 다 썼으면 「되감기 끝」
  const live = !!run && run.phase === 'ended' && !!run.result;
  const opt = live ? rewindOption(run) : null;
  const solved = data.ending === 'perfect' || data.ending === 'hidden';
  const over = live && !opt && !solved && rewindSlotsLeft(run) <= 0;
  return (
    <main className="wt-screen wt-screen--ending">
      <EndingView
        data={data}
        caseFile={{ unlocked: caseFileUnlocked(game.meta), plays: game.meta.plays }}
        rewind={opt ? { last: opt.last, sub: rewindSubOf(run!, opt) } : null}
        rewindOver={over}
        onRewind={doRewind}
        onShare={() => openShare(data)}
        onAgain={() => requestNewRun({ skipTutorial: game.meta.plays >= 1 })}
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
  const { game, requestNewRun } = useWt();
  const run = game.run;
  const doRewind = useRewind();
  const opt = run ? rewindOption(run) : null;
  return (
    <main className="wt-screen wt-screen--ending">
      <ExcludedView
        rewindSub={run && opt?.kind === 'excluded' ? rewindSubOf(run, opt) : null}
        onRewind={doRewind}
        onNewRun={() => requestNewRun()}
        onTitle={game.toTitle}
      />
    </main>
  );
}
