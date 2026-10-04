'use client';

/**
 * 사건 소개 8컷(W02) · 규칙 카드 3장(W03) — 디자인 §5-17.
 *  - 컷 4:3 + 대사창. 탭 = 글자 완성 → 다음 줄 → 다음 컷. [≫ 빠르게]는 1회차에도 항상 있다(그 컷만 즉시 속도). [건너뛰기]는 플레이 1회 뒤부터.
 *  - 건너뛰면 튜토리얼 증거 자동 획득 + 튜토리얼 돌파 처리(엔진 newRun({skipTutorial})) 후 허브 직행.
 *  - 규칙 카드는 1회차에 건너뛸 수 없다. 끝나면 거실(튜토리얼)로 들어간다(무료).
 */
import { ChevronLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';
import { CASE, enterLocation } from '@/lib/witness';
import { TUTORIAL_LOC } from '../lib/format';
import { useWt } from '../lib/context';
import { ArtSlot } from '../components/ArtSlot';
import { DialogueBox } from '../components/DialogueBox';
import { RuleCards } from '../components/Settings';

export function IntroScreen() {
  const { game } = useWt();
  const cuts = CASE.intro;
  const [i, setI] = useState(0);
  const [fast, setFast] = useState<number | null>(null);
  const cut = cuts[i];
  const canSkip = game.meta.plays >= 1;

  const next = () => {
    if (i >= cuts.length - 1) game.anchor({ name: 'rules' });
    else setI(i + 1);
  };

  return (
    <main className="wt-screen wt-intro" aria-label="사건 소개">
      <div className="wt-intro-top">
        <span className="wt-intro-n">
          컷 {i + 1}/{cuts.length}
        </span>
        <span className="wt-grow" />
        <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => setFast(i)} data-testid="intro-fast">
          <ChevronsRight size={16} aria-hidden /> 빠르게
        </button>
        {canSkip && (
          <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => game.startNew({ skipTutorial: true })} data-testid="intro-skip">
            건너뛰기
          </button>
        )}
      </div>
      <div className="wt-intro-art" key={i}>
        <ArtSlot kind="cut" art={cut.art} rain={game.fxMode !== 'reduced'} />
      </div>
      <div className="wt-intro-text">
        <DialogueBox lines={cut.lines} playKey={`intro:${i}`} onDone={next} readKey={`intro${i}`} instant={fast === i} />
      </div>
      <div className="wt-intro-nav">
        <button type="button" className="wt-btn wt-btn--ghost" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
          <ChevronLeft size={16} aria-hidden /> 이전
        </button>
        <span className="wt-dotsrow" aria-hidden>
          {cuts.map((_, k) => (
            <i key={k} data-on={k === i ? '1' : undefined} />
          ))}
        </span>
      </div>
    </main>
  );
}

export function RulesScreen() {
  const { game } = useWt();
  const start = () => {
    const loc = TUTORIAL_LOC;
    if (loc) game.act((r) => enterLocation(r, loc.id));
    else game.anchor({ name: 'hub', tab: 'house' });
  };
  return (
    <main className="wt-screen wt-rules-screen" aria-label="규칙">
      <RuleCards onDone={start} />
    </main>
  );
}
