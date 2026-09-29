/**
 * 레퍼런스 씬 — balcony_view. 다른 씬들이 따라야 할 품질·구성의 기준.
 *
 * 레이어 순서(뒤→앞): 하늘 → 태양 광원 → 원경 스카이라인 + 연기 기둥 → 연무 → 먼 동(흐리게)
 * → 지면(놀이터·주차장·인물 — 이야기가 벌어지는 곳) → 가까운 동(어둡게) → 근경 연무
 * → 전경(베란다 샷시·난간·화분) → 비네트.
 * 이야기의 핵심(달아나는 사람, 쫓는 좀비, 불타는 차)은 전경에 가리지 않는 높이에 둔다.
 */
import type { ComponentType } from 'react';
import type { SceneId } from '@/lib/zombie/types';
import { ApartmentBlock, Car, Fire, Glow, Haze, PAL, Person, SceneSvg, Skyline, Sky, Smoke, Vignette, Zombie } from './primitives';

function BalconyView() {
  return (
    <SceneSvg>
      <Sky
        id="zs-balc-sky"
        stops={[
          [0, '#0C0607'],
          [0.28, '#2E0B09'],
          [0.5, '#7A2312'],
          [0.62, '#C4501F'],
          [0.72, '#E8862E'],
        ]}
      />
      <Glow id="zs-balc-sun" cx={520} cy={228} r={170} color="#FFB06A" opacity={0.6} />
      <circle cx={520} cy={228} r={28} fill="#FFD29A" opacity={0.6} />

      <Skyline base={268} minH={14} maxH={58} seed={11} fill="#5A2414" tower={430} />
      <Smoke x={140} y={262} s={1.7} color="#140706" opacity={0.85} />
      <Smoke x={700} y={266} s={1.25} color="#140706" opacity={0.75} lean={-1} />
      <Haze id="zs-balc-haze1" y={214} h={84} color="#D0622A" opacity={0.5} className="zs-drift" />

      {/* 먼 동 — 대기원근으로 밝고 붉게 */}
      <ApartmentBlock x={318} y={290} w={150} h={132} floors={15} cols={6} number="103" fill="#3A150E" line="rgba(255,190,140,0.07)" seed={5} litRatio={0.06} numberColor="rgba(255,210,170,0.22)" />

      {/* 지면 — 단지 안마당 */}
      <path d="M0 300 L800 296 L800 450 L0 450 Z" fill="#170806" />
      <path d="M0 300 L800 296" stroke="#7A2A14" strokeWidth={2} opacity={0.6} />
      <path d="M180 360 C300 340 460 338 640 352" stroke="#2B100B" strokeWidth={14} fill="none" />

      {/* 놀이터: 미끄럼틀 + 그네 */}
      <g stroke="#080303" strokeWidth={3} fill="none">
        <path d="M214 346 V318 H240 V346" />
        <path d="M240 320 L276 346" strokeWidth={5} />
        <path d="M290 346 L300 312 H330 L340 346" />
        <path d="M306 312 V334 M322 312 V336" strokeWidth={1.5} />
      </g>
      <Zombie x={232} y={352} s={0.36} pose="shamble" fill="#080303" className="zs-sway" />
      <Zombie x={272} y={356} s={0.36} pose="reach" fill="#080303" />
      <Zombie x={318} y={358} s={0.37} pose="reach" fill="#080303" className="zs-sway" />
      <Person x={372} y={360} s={0.37} pose="run" fill="#080303" />

      {/* 주차장 — 불타는 차 */}
      <Car x={432} y={372} s={0.62} fill="#090303" />
      <Smoke x={548} y={356} s={0.75} color="#0B0403" opacity={0.9} />
      <Car x={514} y={374} s={0.64} fill="#090303" />
      <Fire id="zs-balc-fire" x={548} y={364} s={0.75} />
      <Car x={596} y={376} s={0.64} fill="#090303" flip />
      <Zombie x={668} y={378} s={0.38} pose="lurch" fill="#080303" className="zs-sway" />

      {/* 가까운 동 — 어둡고 크게, 화면 양옆을 붙잡는다 */}
      <ApartmentBlock x={-24} y={330} w={214} h={236} floors={15} cols={7} number="102" fill="#120706" seed={3} litRatio={0.09} />
      <ApartmentBlock x={624} y={336} w={210} h={250} floors={15} cols={7} number="104" fill="#110605" seed={9} litRatio={0.1} />

      <Haze id="zs-balc-haze2" y={330} h={70} color="#8E3417" opacity={0.3} />

      {/* 전경: 베란다 샷시 + 난간 + 화분 */}
      <g fill={PAL.ink}>
        <rect x={0} y={0} width={22} height={450} />
        <rect x={778} y={0} width={22} height={450} />
        <rect x={0} y={0} width={800} height={14} />
        <rect x={0} y={392} width={800} height={7} />
        <rect x={0} y={432} width={800} height={18} />
        {Array.from({ length: 23 }, (_, i) => (
          <rect key={i} x={26 + i * 34} y={398} width={3.5} height={36} />
        ))}
        <path d="M56 432 L50 398 H100 L94 432 Z" />
        <path d="M74 398 C62 370 42 366 34 348 C52 354 64 360 72 378 C70 348 80 328 96 318 C88 342 84 366 82 398 Z" />
        <path d="M76 398 C88 376 110 370 124 356 C116 376 100 386 86 398 Z" />
      </g>
      <Vignette id="zs-balc-vig" strength={0.78} />
    </SceneSvg>
  );
}

export const sceneReference: Partial<Record<SceneId, ComponentType>> = {
  balcony_view: BalconyView,
};
