'use client';

/**
 * 화면 이동(장소 진입 · 증언 열기 · 나가기) — 엔진 Step 을 토스트·진동·효과음(시계 틱 · 행동 3 경고)·HUD 피드백으로 번역한다.
 * 자동으로 행동을 쓰는 경로는 없다: 유료 대상은 호출 전에 SpendPrompt 를 거친다(호출자 책임).
 */
import { RULES, enterLocation, exit as engineExit, openSet, type EngineEvent, type HubTab, type Step } from '@/lib/witness';
import { TOAST } from './copy';
import { useWt } from './context';
import { VIB } from './fx';
import { playSfx } from '../audio/useGameAudio';

const ERR_TEXT: Record<string, string> = {
  siren: TOAST.sirenLocked,
  locked: '아직 들어갈 수 없다',
  'no-actions': '행동이 모자라요',
  ended: '수사가 끝났다',
};

export function useNav() {
  const { game, toast, vib } = useWt();

  /** spent 이벤트 → 토스트·진동. 행동 3 도달은 사이렌 접근 토스트 */
  const feedback = (events: EngineEvent[], prevActions: number) => {
    for (const e of events) {
      if (e.t !== 'spent') continue;
      toast({ kind: 'cost', text: TOAST.actionUsed(e.left + e.cost, e.left), ms: 1600 });
      vib(VIB.tap);
      if (e.left === 3 && prevActions > 3) {
        toast({ kind: 'danger', text: TOAST.sirenNear, ms: 4000 });
        vib(VIB.action3);
        playSfx('siren');
      } else playSfx('tick');
    }
  };

  const run = (fn: Parameters<typeof game.act>[0]): Step => {
    const prev = game.getRun()?.actions ?? RULES.normal.actions;
    const step = game.act(fn);
    if (step.error) toast({ kind: 'warn', text: ERR_TEXT[step.error] ?? '지금은 할 수 없다', ms: 1600 });
    else feedback(step.events, prev);
    return step;
  };

  return {
    enterLocation: (id: string) => run((r) => enterLocation(r, id)),
    openSet: (id: string) => run((r) => openSet(r, id)),
    exit: (tab?: HubTab) => run((r) => engineExit(r, tab)),
    feedback,
    run,
  };
}
