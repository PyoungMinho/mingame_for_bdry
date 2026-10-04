'use client';

/**
 * 사이렌(W12) — 행동 0 인 행위(장소·세트)를 마치고 나오는 순간. [계속]을 기다린다(자동 진행 없음).
 * ★ ≥ 3: 강제 지목(W50, 경고 생략) / ★ < 3: 「시간 초과」 엔딩. 수첩은 이 화면에서도 열린다.
 */
import { canAccuse, continueAfterSiren } from '@/lib/witness';
import { useWt } from '../lib/context';
import { SirenOverlay } from '../components/Overlays';

export function SirenScreen() {
  const { game, openNotebook } = useWt();
  const run = game.run!;
  return (
    <main className="wt-screen wt-screen--siren">
      <SirenOverlay canAccuse={canAccuse(run)} onContinue={() => game.act((r) => continueAfterSiren(r))} onNotebook={() => openNotebook()} />
    </main>
  );
}
