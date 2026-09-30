/**
 * 레퍼런스 씬 — crt_living (2000년 1월, 우리 집 거실). 다른 씬이 따라야 할 톤의 기준.
 *
 * 톤: "추억 앨범" — 좀비 터지면의 실루엣 듀오톤을 따르되 따뜻한 세피아·호박색 조명,
 * 브라운관의 차가운 청백광이 대비. 시장 신호는 한국식(상승 빨강 ▲, 하락 파랑 ▼).
 * 레이어: 벽·바닥(장판) → 창밖 겨울밤 단지 → 스탠드 광원 → 가구 → 인물 → TV 광원 → 비네트.
 */
import type { ComponentType } from 'react';
import { ApartmentBlock, Glow, Haze, Kid, PAL, Person, SceneSvg, Sky, Vignette } from './primitives';

const UP = '#FF5A4E';
const DOWN = '#4E8CFF';

function CrtLiving() {
  return (
    <SceneSvg>
      {/* 벽 + 장판 바닥 */}
      <Sky id="rs-crt-wall" stops={[[0, '#1C130C'], [0.55, '#3A2819'], [1, '#2A1C11']]} />
      <rect x={0} y={330} width={800} height={120} fill="#3E2C15" />
      <rect x={0} y={330} width={800} height={120} fill="url(#rs-crt-floor)" />
      <defs>
        <linearGradient id="rs-crt-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8A6A30" stopOpacity={0.35} />
          <stop offset="1" stopColor="#1A1208" stopOpacity={0.9} />
        </linearGradient>
      </defs>
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M0 ${345 + i * 16} H800`} stroke="#000" strokeOpacity={0.12} strokeWidth={1} />
      ))}

      {/* 창밖 — 2000년 겨울밤 아파트 단지 */}
      <rect x={70} y={60} width={220} height={170} fill="#0E1624" />
      <ApartmentBlock x={80} y={230} w={90} h={120} floors={12} cols={5} number="104" fill="#16202E" seed={4} litRatio={0.3} win="#FFD48A" numberColor="rgba(255,255,255,0.12)" />
      <ApartmentBlock x={190} y={230} w={100} h={100} floors={10} cols={5} fill="#131B28" seed={8} litRatio={0.25} win="#FFD48A" />
      <g fill="#241810">
        <rect x={62} y={52} width={236} height={10} />
        <rect x={62} y={228} width={236} height={12} />
        <rect x={62} y={52} width={10} height={186} />
        <rect x={288} y={52} width={10} height={186} />
        <rect x={176} y={52} width={7} height={186} />
      </g>

      {/* 벽 달력 2000 */}
      <g>
        <rect x={352} y={70} width={66} height={84} fill="#E9DDC2" opacity={0.85} />
        <rect x={352} y={70} width={66} height={20} fill="#B8322A" opacity={0.85} />
        <text x={385} y={85} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
          2000
        </text>
        <text x={385} y={122} textAnchor="middle" fontSize={26} fontWeight={800} fill="#3A2A1A" opacity={0.85}>
          1
        </text>
        <text x={385} y={144} textAnchor="middle" fontSize={9} fill="#3A2A1A" opacity={0.7}>
          밀레니엄
        </text>
      </g>

      {/* 스탠드 조명 */}
      <Glow id="rs-crt-lamp" cx={120} cy={250} r={230} color="#FFB864" opacity={0.55} />
      <g fill={PAL.ink2}>
        <rect x={117} y={262} width={5} height={78} />
        <path d="M98 262 L141 262 L132 232 L107 232 Z" fill="#6A4A22" />
        <ellipse cx={119.5} cy={342} rx={16} ry={4} />
      </g>

      {/* 소파 + 증권면 읽는 아빠 */}
      <g fill="#2A1A10">
        <rect x={170} y={268} width={250} height={62} rx={14} />
        <rect x={162} y={250} width={30} height={80} rx={12} />
        <rect x={398} y={250} width={30} height={80} rx={12} />
        <rect x={180} y={228} width={230} height={46} rx={16} />
      </g>
      <Person x={262} y={318} s={1.12} pose="sit" fill="#0B0705" pack={false} />
      <g transform="rotate(-8 300 262)">
        <rect x={276} y={236} width={58} height={46} fill="#D8CDB2" opacity={0.9} />
        <rect x={281} y={242} width={48} height={5} fill="#3A2A1A" opacity={0.6} />
        <path d="M282 256 H328 M282 262 H320 M282 268 H326 M282 274 H316" stroke="#3A2A1A" strokeOpacity={0.45} strokeWidth={1.4} />
        <path d="M312 270 L318 260 L324 266 L330 252" stroke={UP} strokeWidth={2} fill="none" />
      </g>

      {/* TV 장식장 + 브라운관 */}
      <rect x={520} y={288} width={230} height={50} fill="#20150D" />
      <rect x={520} y={288} width={230} height={5} fill="#3A2818" />
      <Glow id="rs-crt-tvglow" cx={636} cy={218} r={240} color="#8FC4FF" opacity={0.42} className="zs-glow" />
      <g>
        <rect x={548} y={150} width={176} height={138} rx={16} fill="#15110E" />
        <rect x={562} y={162} width={136} height={104} rx={14} fill="#0E2238" />
        <g className="zs-flicker">
          <rect x={566} y={166} width={128} height={18} fill="#1B3A63" />
          <text x={572} y={179} fontSize={11} fontWeight={800} fill="#fff">
            증권 속보
          </text>
          <path d="M572 236 L590 214 L606 222 L622 200 L640 206 L656 190 L672 196 L690 182" stroke={UP} strokeWidth={2.4} fill="none" />
          <rect x={566} y={246} width={128} height={16} fill="#061426" />
          <text x={570} y={258} fontSize={9.5} fontWeight={700} fill={UP}>
            코스닥 ▲ 3.2%
          </text>
          <text x={636} y={258} fontSize={9.5} fontWeight={700} fill={DOWN}>
            환율 ▼
          </text>
        </g>
        <rect x={704} y={180} width={10} height={6} rx={2} fill="#3A2F24" />
        <rect x={704} y={196} width={10} height={6} rx={2} fill="#3A2F24" />
        <path d="M620 150 L596 118 M652 150 L676 116" stroke="#15110E" strokeWidth={3} />
      </g>

      {/* 주인공 — 여덟 살의 몸, TV 앞 장판에 앉아 */}
      <Glow id="rs-crt-kidrim" cx={600} cy={330} r={80} color="#8FC4FF" opacity={0.25} />
      <Kid x={548} y={384} s={1.35} pose="sit" fill="#0A0605" />

      <Haze id="rs-crt-haze" y={300} h={120} color="#FFB864" opacity={0.08} />
      <Vignette id="rs-crt-vig" strength={0.72} />
    </SceneSvg>
  );
}

export const sceneReference: Record<string, ComponentType> = {
  crt_living: CrtLiving,
};
