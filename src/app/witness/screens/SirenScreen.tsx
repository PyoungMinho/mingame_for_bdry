'use client';

/**
 * 사이렌(W12) — 행동 0 인 행위(장소·세트)를 마치고 나오는 순간. [계속]을 기다린다(자동 진행 없음).
 * [계속] → 허브(새로운 곳은 끝 · 이미 연 곳은 다시 볼 수 있다). ★ ≥ 3 이면 허브에 [지목하기], 아니면 [수사 종료]. 수첩은 이 화면에서도 열린다.
 */
import { canAccuse, continueAfterSiren, starsToGate } from '@/lib/witness';
import { useWt } from '../lib/context';
import { SirenOverlay } from '../components/Overlays';

export function SirenScreen() {
  const { game, openNotebook } = useWt();
  const run = game.run!;
  return (
    <main className="wt-screen wt-screen--siren">
      <SirenOverlay canAccuse={canAccuse(run)} missing={starsToGate(run)} onContinue={() => game.act((r) => continueAfterSiren(r))} onNotebook={() => openNotebook()} />
    </main>
  );
}
