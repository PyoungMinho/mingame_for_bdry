/**
 * 또박이 본체 — 장면(거실 선반)과 초상이 같은 모양을 쓴다(UI 스펙 6-5).
 *
 *  - 살짝 테이퍼진 원통(높이:지름 ≈ 1.5:1), 매트 그래파이트. 윗면은 평평하고 마이크 버튼 + 작은 점 3개.
 *  - LED 는 윗면 테두리가 아니라 **몸통 허리 벨트**(폭 약 12%). 시판 스피커의 윗면 링 형태를 쓰지 않는다.
 *  - 앞면 하단 헥스 도트 메시, 그 위 이퀄라이저 바 5개(말할 때 움직임 — .wt-art-eq).
 *  - 가상 「도진」 마크(원 + 점)만. 원점 = 윗면 타원 중심, 단위 높이 300.
 */
import { C, type SvgIds } from './palette';
import { DojinMark } from './scenes/parts';

/** alarm(앰버)은 숨은 엔딩 키아트 전용 */
export type LedState = 'standby' | 'process' | 'refuse' | 'correct' | 'alarm' | 'off';

export const LED_COLOR: Record<LedState, string> = {
  standby: C.cyan,
  process: C.yellow,
  refuse: C.red,
  correct: C.violet,
  alarm: C.amber,
  off: '#2B3550',
};

const RT = 88; // 윗면 반지름
const RB = 100; // 바닥 반지름
const HT = 300;
const rAt = (y: number) => RT + ((RB - RT) * y) / HT;
const ryAt = (y: number) => 20 + (2 * y) / HT;

/** 몸통 가로 띠(y1~y2) 앞면 경로 */
function band(y1: number, y2: number) {
  const a = rAt(y1);
  const b = rAt(y2);
  return `M${-a} ${y1}A${a} ${ryAt(y1)} 0 0 0 ${a} ${y1}L${b} ${y2}A${b} ${ryAt(y2)} 0 0 1 ${-b} ${y2}Z`;
}

export function SpeakerDefs({ ids }: { ids: SvgIds }) {
  return (
    <>
      <linearGradient id={ids.id('spk-body')} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor={C.graphite3} />
        <stop offset="0.28" stopColor={C.graphite2} />
        <stop offset="0.7" stopColor={C.graphite1} />
        <stop offset="1" stopColor={C.graphite0} />
      </linearGradient>
      <linearGradient id={ids.id('spk-belt')} x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#000" stopOpacity="0.55" />
        <stop offset="0.3" stopColor="#000" stopOpacity="0" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.6" />
      </linearGradient>
      <radialGradient id={ids.id('spk-run')} cx="50%" cy="50%" r="50%">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <pattern id={ids.id('spk-hex')} width="12" height="10.4" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="2.6" r="1.7" fill="#0E1328" />
        <circle cx="9" cy="7.8" r="1.7" fill="#0E1328" />
      </pattern>
    </>
  );
}

/**
 * 본체 그리기. (x, y) = 윗면 타원 중심, s = 배율(1 → 높이 300).
 * led 색은 벨트·윗면 반사·바닥 빛에 쓰인다. glow 는 바깥 빛 웅덩이(장면 · 무대).
 */
export function SpeakerBody({
  ids,
  x,
  y,
  s = 1,
  led = 'standby',
  speaking = false,
  glow = true,
}: {
  ids: SvgIds;
  x: number;
  y: number;
  s?: number;
  led?: LedState;
  speaking?: boolean;
  glow?: boolean;
}) {
  const c = LED_COLOR[led];
  const beltY1 = 150;
  const beltY2 = 186;
  const eq = [14, 26, 38, 24, 12];
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} className="wt-art-spk" data-led={led} data-speaking={speaking ? 'on' : 'off'}>
      {/* 그림자 */}
      <ellipse cx={0} cy={HT + 4} rx={RB * 1.25} ry={26} fill="#000" opacity={0.45} />
      {glow && led !== 'off' && (
        <ellipse className="wt-art-led-glow" cx={0} cy={beltY1 + 20} rx={RB * 2.3} ry={RB * 1.7} fill={ids.url('spk-halo')} opacity={0.5} />
      )}
      {/* 몸통 */}
      <path d={band(0, HT)} fill={ids.url('spk-body')} />
      {/* 림(오른쪽 시안) */}
      <path d={`M${RT - 3} 2L${RB - 3} ${HT - 2}`} stroke={C.cyan} strokeWidth={4} opacity={0.5} strokeLinecap="round" />
      {/* 도진 마크 */}
      <DojinMark x={0} y={92} s={11} c={C.graphite3} />
      {/* LED 벨트 */}
      <path d={band(beltY1, beltY2)} fill="#0C1022" />
      <path className="wt-art-led" d={band(beltY1 + 4, beltY2 - 4)} fill={c} />
      {(led === 'process' || led === 'correct' || led === 'refuse') && (
        <g clipPath={ids.url('spk-beltclip')}>
          <ellipse className={led === 'process' ? 'wt-art-led-run' : undefined} cx={-40} cy={beltY1 + 26} rx={36} ry={16} fill={ids.url('spk-run')} opacity={led === 'process' ? 0.85 : 0} />
        </g>
      )}
      <path d={band(beltY1 + 4, beltY2 - 4)} fill={ids.url('spk-belt')} />
      <path d={`M${-rAt(beltY1 + 4) + 6} ${beltY1 + 9}A${rAt(beltY1 + 4)} ${ryAt(beltY1)} 0 0 0 ${rAt(beltY1 + 4) - 6} ${beltY1 + 9}`} stroke="#FFFFFF" strokeWidth={2} opacity={0.35} fill="none" />
      <defs>
        <clipPath id={ids.id('spk-beltclip')}>
          <path d={band(beltY1 + 4, beltY2 - 4)} />
        </clipPath>
        <radialGradient id={ids.id('spk-halo')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor={c} stopOpacity="0.55" />
          <stop offset="0.4" stopColor={c} stopOpacity="0.18" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* 이퀄라이저 5 */}
      <g className="wt-art-eq" fill={c} opacity={led === 'off' ? 0.2 : 0.9}>
        {eq.map((h, i) => (
          <rect key={i} className={`wt-art-eq${i}`} x={-34 + i * 15} y={236 - h} width={8} height={h} rx={3} />
        ))}
      </g>
      {/* 메시 */}
      <path d={band(246, HT - 10)} fill={ids.url('spk-hex')} opacity={0.85} />
      {/* 윗면 */}
      <ellipse cx={0} cy={0} rx={RT} ry={20} fill={C.graphite2} />
      <ellipse cx={0} cy={1} rx={RT - 6} ry={16} fill="#323D60" />
      <ellipse cx={0} cy={-1} rx={RT - 2} ry={18} fill="none" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={2} />
      <ellipse cx={-8} cy={0} rx={15} ry={5.5} fill={C.graphite0} />
      <ellipse cx={-8} cy={-1} rx={11} ry={3.6} fill={C.graphite3} />
      {[22, 34, 46].map((dx) => (
        <ellipse key={dx} cx={dx} cy={1} rx={2.6} ry={1.4} fill="#141A30" />
      ))}
      {/* LED 가 윗면 가장자리에 비치는 반사 */}
      <path d={`M${-RT + 8} 4A${RT} 20 0 0 0 ${RT - 8} 4`} stroke={c} strokeWidth={2} opacity={led === 'off' ? 0 : 0.3} fill="none" />
    </g>
  );
}
