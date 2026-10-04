'use client';

/**
 * 초상 무대(디자인 §5-9, UI 5-6) — 1인 / 대질 2인. 말하는 쪽은 밝게(scale 1.03), 듣는 쪽은 어둡게.
 * 또박이는 초상에 LED 상태 아이콘 + 라벨을 단다(색에 의존하지 않는다): 대기·처리 중·권한 거부·정정.
 */
import { Loader, Radio, RefreshCw, ShieldOff } from 'lucide-react';
import type { Face, Speaker } from '@/lib/witness';
import { LED_LABEL, ledOf, nameOf, type Led } from '../lib/format';
import { ArtSlot } from './ArtSlot';

const LED_ICON: Record<Led, React.ReactNode> = {
  standby: <Radio size={14} aria-hidden />,
  process: <Loader size={14} aria-hidden />,
  refuse: <ShieldOff size={14} aria-hidden />,
  correct: <RefreshCw size={14} aria-hidden />,
};

export function LedBadge({ face }: { face?: Face }) {
  const led = ledOf(face);
  return (
    <span className="wt-led" data-led={led}>
      {LED_ICON[led]}
      <span>{LED_LABEL[led]}</span>
    </span>
  );
}

export interface CharacterStageProps {
  speakers: Speaker[];
  /** 지금 말하는 사람(없으면 모두 같은 밝기) */
  active?: Speaker | null;
  faces: Partial<Record<Speaker, Face>>;
  /** 대사가 나오는 중(또박이 이퀄라이저) */
  talking?: boolean;
  /** 비웃음을 덧씌울 인물(오답 리액션) */
  smirk?: Speaker | null;
  className?: string;
}

export function CharacterStage({ speakers, active, faces, talking, smirk, className }: CharacterStageProps) {
  const two = speakers.length > 1;
  return (
    <div className={['wt-stage', two ? 'wt-stage--two' : '', className].filter(Boolean).join(' ')} data-two={two ? '1' : undefined}>
      <div className="wt-stage-glow" aria-hidden />
      {speakers.map((s, i) => {
        const dim = !!active && active !== s && two;
        const speaking = active === s;
        return (
          <div key={s} className="wt-stage-slot" data-spk={s} data-dim={dim ? '1' : undefined} data-speaking={speaking ? '1' : undefined}>
            <ArtSlot kind="portrait" who={s} face={faces[s] ?? 'normal'} smirk={smirk === s} speaking={!!talking && speaking} title={nameOf(s)} />
            {s === 'AI' && <LedBadge face={faces[s]} />}
            {two && <span className="wt-stage-name">{nameOf(s)}</span>}
            {i === 0 && two && <span className="wt-stage-vs" aria-hidden>대질</span>}
          </div>
        );
      })}
    </div>
  );
}
