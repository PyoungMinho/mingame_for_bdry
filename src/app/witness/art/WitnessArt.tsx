'use client';

/**
 * 최종 아트 진입점 — components/ArtSlot.tsx(자리표시)와 **같은 props 계약**의 상위 호환.
 * 통합: ArtSlot.tsx 의 구현을 `export { WitnessArt as ArtSlot } from '../art/WitnessArt'` 한 줄로 바꾸면 된다.
 *
 *  kind="scene"    art = Location.art(living·kitchen·study·utility·roof·guest) → 1500×1000(3:2), 부모를 채움(slice)
 *  kind="portrait" who = Speaker | 'VICTIM', face = Face | 'smirk', crop = 'bust'(=full) | 'head'
 *                  + smirk(오답 비웃음) · trust(한결 신뢰 5단계) · speaking(또박이 이퀄라이저) · backlight
 *  kind="cut"      art = IntroCut.art(tower·stair·cop-window·ad-frame·cop-ddobagi·suspects·ddobagi·clock) → 4:3
 *  kind="ending"   ending = EndingId (+ culprit: 완벽 해결 키아트의 인물 — 엔진 Solution.culprit 을 넘긴다) → 16:10
 *
 * DOM 은 자리표시와 같다: svg.wt-art.wt-art--scene|--portrait, cut/ending 은 div.wt-art-cut|wt-art-ending 래퍼.
 * 그림 전용 스타일(art.css — 비·LED·컷인·도장 키프레임, 전부 .wt-shell 스코프)은 여기서 한 번 import 한다.
 */
import './art.css';
import type { EndingId, Speaker, SuspectId } from '@/lib/witness/types';
import { EndingArt } from './ending/EndingArt';
import { IntroCutArt } from './intro/IntroCut';
import { VictimFrame } from './intro/Pieces';
import { hasPortrait, Portrait } from './portraits/Portrait';
import type { TrustLevel } from './portraits/Hangyeol';
import type { ArtFace } from './portraits/parts';
import { sceneArt, SceneFallbackArt } from './scenes/index';

export type WitnessArtProps =
  | { kind: 'scene'; art: string; className?: string; rain?: boolean; idScope?: string }
  | {
      kind: 'portrait';
      who: Speaker | 'VICTIM';
      face?: ArtFace;
      smirk?: boolean;
      crop?: 'bust' | 'full' | 'head';
      className?: string;
      title?: string;
      trust?: TrustLevel;
      speaking?: boolean;
      backlight?: boolean;
      idle?: boolean;
      decorative?: boolean;
      idScope?: string;
    }
  | { kind: 'cut'; art: string; className?: string; rain?: boolean }
  | { kind: 'ending'; ending: EndingId; culprit?: SuspectId; className?: string };

const SCENE_CLS = 'wt-art wt-art--scene';
const PORTRAIT_CLS = 'wt-art wt-art--portrait';

export function WitnessArt(props: WitnessArtProps) {
  switch (props.kind) {
    case 'scene': {
      const def = sceneArt(props.art);
      const cls = props.className ? `${SCENE_CLS} ${props.className}` : SCENE_CLS;
      if (!def) return <SceneFallbackArt className={cls} />;
      return <def.Art className={cls} rain={props.rain} idScope={props.idScope} />;
    }
    case 'portrait': {
      const { who, crop, className, kind: _k, ...rest } = props;
      const cls = className ? `${PORTRAIT_CLS} ${className}` : PORTRAIT_CLS;
      const c = crop === 'head' ? 'head' : 'full';
      if (who === 'VICTIM') return <VictimFrame className={cls} decorative={false} />;
      if (!hasPortrait(who)) return <svg className={cls} viewBox="0 0 600 800" aria-hidden="true" focusable="false" />;
      return <Portrait who={who} crop={c} className={cls} {...rest} />;
    }
    case 'cut':
      return (
        <div className={['wt-art-cut', props.className].filter(Boolean).join(' ')} data-art={props.art}>
          <IntroCutArt art={props.art} className={SCENE_CLS} rain={props.rain} />
        </div>
      );
    default:
      return (
        <div className={['wt-art-ending', props.className].filter(Boolean).join(' ')} data-ending={props.ending}>
          <EndingArt ending={props.ending} culprit={props.culprit} className={SCENE_CLS} />
        </div>
      );
  }
}
