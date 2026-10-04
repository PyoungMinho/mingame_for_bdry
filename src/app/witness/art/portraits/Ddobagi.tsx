/**
 * 또박이(AI 스피커, 증인) — 초상 대신 본체 + LED 상태(UI 스펙 6-5). 표정 = LED.
 *  normal  → 대기(시안, 숨쉬기 3.2s)
 *  sweat   → 처리 중(노랑, 허리 벨트를 도는 밝은 구간 1.2s)
 *  shock   → 정정(보라, 본체 점프)
 *  break   → 정정(보라, 느리게 깜빡이며 절반 어두움)
 *  angry   → 권한 거부(빨강, 600ms 짧은 점멸 2회 후 고정)
 *  smirk   → 대기(또박이는 비웃지 않는다)
 * 색만으로 전하지 않는다: 화면은 LED 상태 라벨(대기·처리 중·권한 거부·정정)을 함께 단다(디자인 §4-2).
 */
import { SPK, useSvgIds } from '../palette';
import { SpeakerBody, SpeakerDefs, type LedState } from '../speaker';
import { Backlight, PortraitDefs, PortraitSvg, Sparks, type ArtFace, type PortraitProps } from './parts';

/** Face → LED 상태(엔진 types.ts 주석과 같은 규칙) */
export function ledOf(face: ArtFace = 'normal'): LedState {
  switch (face) {
    case 'sweat':
      return 'process';
    case 'shock':
    case 'break':
      return 'correct';
    case 'angry':
      return 'refuse';
    default:
      return 'standby';
  }
}

export function DdobagiPortrait({
  face = 'normal',
  crop,
  backlight = true,
  idle = true,
  title,
  decorative,
  idScope,
  className,
  speaking = false,
  led,
}: PortraitProps & {
  /** 말하는 중 — 이퀄라이저 바가 움직인다 */
  speaking?: boolean;
  /** LED 상태 직접 지정(refusal 줄 등). 없으면 face 로 정한다 */
  led?: LedState;
}) {
  const ids = useSvgIds('p-ai', idScope);
  const state = led ?? ledOf(face);
  return (
    <PortraitSvg name="또박이" face={face} crop={crop} headBox="120 330 360 360" idle={idle} title={title} decorative={decorative} className={className}>
      <PortraitDefs ids={ids} spk={SPK.AI} />
      <defs>
        <SpeakerDefs ids={ids} />
      </defs>
      <Backlight ids={ids} on={backlight} />
      {/* 선반 */}
      <path d="M40 704H560L580 722H20Z" fill="#3A2B22" />
      <path d="M20 722H580V738H20Z" fill="#241A15" />
      <path d="M40 704H560" stroke="#5A4434" strokeWidth={3} />
      <g className="wt-art-figure">
        <g opacity={face === 'break' ? 0.82 : 1}>
          <SpeakerBody ids={ids} x={300} y={344} s={1.2} led={state} speaking={speaking} />
        </g>
      </g>
      <Sparks on={face === 'shock'} x={430} y={330} />
    </PortraitSvg>
  );
}
