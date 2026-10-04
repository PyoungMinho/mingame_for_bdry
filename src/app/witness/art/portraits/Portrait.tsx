/**
 * 화자 id → 초상 컴포넌트 하나(무대·지목 카드·아바타 공용).
 */
import type { Speaker } from '@/lib/witness/types';
import { DdobagiPortrait } from './Ddobagi';
import { DetectivePortrait } from './Detective';
import { HaneulPortrait } from './Haneul';
import { HangyeolPortrait, type TrustLevel } from './Hangyeol';
import { JunhyeokPortrait } from './Junhyeok';
import { MisukPortrait } from './Misuk';
import type { PortraitProps } from './parts';
import { SungangPortrait } from './Sungang';

/** 초상이 있는 화자(NARR·DEV 는 초상 없음) */
export type PortraitWho = Extract<Speaker, 'S1' | 'S2' | 'S3' | 'S4' | 'AI' | 'COP' | 'ME'>;

export const PORTRAIT_WHO: readonly PortraitWho[] = ['S1', 'S2', 'S3', 'S4', 'COP', 'AI', 'ME'];

export function hasPortrait(who: Speaker): who is PortraitWho {
  return (PORTRAIT_WHO as readonly string[]).includes(who);
}

/** 화자 id 로 초상 하나 — 무대·지목 카드·아바타 공용 */
export function Portrait({
  who,
  trust,
  speaking,
  ...p
}: PortraitProps & { who: PortraitWho; trust?: TrustLevel; speaking?: boolean }) {
  switch (who) {
    case 'S1':
      return <SungangPortrait {...p} />;
    case 'S2':
      return <HaneulPortrait {...p} />;
    case 'S3':
      return <MisukPortrait {...p} />;
    case 'S4':
      return <JunhyeokPortrait {...p} />;
    case 'COP':
      return <HangyeolPortrait {...p} trust={trust} />;
    case 'AI':
      return <DdobagiPortrait {...p} speaking={speaking} />;
    case 'ME':
      return <DetectivePortrait {...p} />;
  }
}
