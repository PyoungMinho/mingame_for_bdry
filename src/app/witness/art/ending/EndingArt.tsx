/**
 * 엔딩 키아트(16:10, 1600×1000) — 포트레이트 + 장소 + 컬러 그레이딩 재조합(UI 스펙 8-3).
 *  perfect     거실 + 지목된 인물 무너짐 초상(culprit prop) + 한결·나 / 새벽 청색 + 가장자리 적·청 경광등(정적)
 *  hidden      또박이 클로즈업(앰버 LED) + 알람 카드(시계 + 07:00 + 「취소할까요?」 버튼 모양)
 *  short       한결(당황) + 문 앞 실루엣 2 / 차가운 형광등 화이트
 *  wrong-Sx    지목된 인물(당황) + 소품 카드(헤드라인 · 책 표지+띠지 · 영수증+쿠폰 · 일정표) / 화자색 역광, 채도 낮춤
 *  timeout     거실 창 + 경광등 적·청 교대(0.8Hz, 줄이기에서 정적)
 *  excluded    증거 봉투에 담긴 수첩 + 한결(무너짐) / 슬레이트 저채도
 *
 * 스포일러 규칙: 이 파일은 범인을 모른다. perfect 의 인물은 화면이 `culprit`(엔진 Solution.culprit)으로 넘긴다.
 * 오인 체포 4종은 같은 구도·같은 처리(카드만 다름). 소품 카드에는 실존 매체명·제호·읽히는 글자를 쓰지 않는다.
 */
import type { ReactNode } from 'react';
import type { EndingId, SuspectId } from '@/lib/witness/types';
import { C, SPK, useSvgIds } from '../palette';
import { DdobagiPortrait } from '../portraits/Ddobagi';
import { DetectivePortrait } from '../portraits/Detective';
import { HaneulPortrait } from '../portraits/Haneul';
import { HangyeolPortrait } from '../portraits/Hangyeol';
import { JunhyeokPortrait } from '../portraits/Junhyeok';
import { MisukPortrait } from '../portraits/Misuk';
import type { ArtFace } from '../portraits/parts';
import { SungangPortrait } from '../portraits/Sungang';
import { LivingArt } from '../scenes/Living';
import { Bars, Glow, SceneDefs } from '../scenes/parts';

const SUSPECT = { S1: SungangPortrait, S2: HaneulPortrait, S3: MisukPortrait, S4: JunhyeokPortrait } as const;

function Frame({ ending, className, children }: { ending: string; className?: string; children: ReactNode }) {
  return (
    <svg className={className ? `wt-art-scene ${className}` : 'wt-art-scene'} viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" data-ending={ending} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}
function Place({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  return (
    <svg x={x} y={y} width={w} height={(w * 4) / 3} viewBox="0 0 600 800" overflow="visible">
      {children}
    </svg>
  );
}
/** 거실 그림을 (dx, dy, s) 로 옮겨 깐다 */
function LivingBg({ s, dx, dy, id }: { s: number; dx: number; dy: number; id: string }) {
  return (
    <g transform={`scale(${s}) translate(${dx} ${dy})`}>
      <svg width={1500} height={1000}>
        <LivingArt idScope={id} rain={false} />
      </svg>
    </g>
  );
}
/** 가장자리 적·청 경광등(정적 그라디언트, live=true 면 0.8Hz 교대 — 줄이기에서 정지) */
function PoliceEdges({ ids, live = false, o = 0.55 }: { ids: ReturnType<typeof useSvgIds>; live?: boolean; o?: number }) {
  return (
    <g>
      <defs>
        <linearGradient id={ids.id('pl')} x1="0" x2="1">
          <stop offset="0" stopColor={C.red} stopOpacity="0.85" />
          <stop offset="1" stopColor={C.red} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.id('pr')} x1="1" x2="0">
          <stop offset="0" stopColor="#3D7BFF" stopOpacity="0.85" />
          <stop offset="1" stopColor="#3D7BFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className={live ? 'wt-art-siren-a' : undefined} x={0} y={0} width={360} height={1000} fill={ids.url('pl')} opacity={o} />
      <rect className={live ? 'wt-art-siren-b' : undefined} x={1240} y={0} width={360} height={1000} fill={ids.url('pr')} opacity={o} />
    </g>
  );
}

/** 오인 체포 소품 카드 4종 — 같은 크기·같은 기울기, 글자 대신 줄무늬 */
function PropCard({ who }: { who: SuspectId }) {
  const card = (children: ReactNode, bg = '#F2EFE8') => (
    <g transform="translate(1040 300) rotate(6)">
      <rect x={6} y={10} width={380} height={480} rx={10} fill="#000" opacity={0.35} />
      <rect x={0} y={0} width={380} height={480} rx={10} fill={bg} />
      {children}
    </g>
  );
  switch (who) {
    case 'S1': // 헤드라인 카드
      return card(
        <g>
          <rect x={24} y={24} width={332} height={50} rx={4} fill="#22262F" />
          <Bars x={40} y={100} w={300} rows={2} gap={30} th={18} c="#22262F" seed={71} />
          <rect x={24} y={170} width={150} height={150} rx={4} fill="#9AA3B6" />
          <path d="M99 200c22 0 32 18 30 38c-2 14 -8 24 -14 30l2 10c20 4 34 14 38 30h-112c4 -16 18 -26 38 -30l2 -10c-6 -6 -12 -16 -14 -30c-2 -20 8 -38 30 -38z" fill="#5D6780" />
          <Bars x={192} y={182} w={150} rows={9} gap={16} th={6} c="#7A7E88" seed={72} />
          <Bars x={30} y={348} w={320} rows={7} gap={18} th={6} c="#7A7E88" seed={73} />
        </g>,
      );
    case 'S2': // 책 표지 + 띠지
      return card(
        <g>
          <rect x={0} y={0} width={380} height={480} rx={10} fill="#2A1E3E" />
          <circle cx={260} cy={150} r={90} fill={C.pink} opacity={0.35} />
          <path d="M40 300q80 -120 160 -60t160 -40" stroke="#FFD9E8" strokeWidth={4} fill="none" opacity={0.6} />
          <Bars x={40} y={60} w={240} rows={2} gap={36} th={22} c="#F4E9F0" seed={74} />
          <rect x={0} y={350} width={380} height={86} fill={C.amber} />
          <Bars x={30} y={378} w={300} rows={2} gap={26} th={10} c="#3A2410" seed={75} />
        </g>,
        '#2A1E3E',
      );
    case 'S3': // 영수증 + 쿠폰
      return (
        <g>
          {card(
            <g>
              <path d="M0 470l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10l20 10l20 -10" stroke="#C9C2B4" strokeWidth={3} fill="none" />
              <Bars x={40} y={40} w={180} rows={1} gap={20} th={14} c="#3A3A44" seed={76} />
              <Bars x={40} y={90} w={300} rows={12} gap={24} th={6} c="#7A7E88" seed={77} />
              <path d="M40 390h300" stroke="#3A3A44" strokeWidth={3} strokeDasharray="8 6" />
              <Bars x={200} y={420} w={140} rows={1} gap={20} th={14} c="#3A3A44" seed={78} />
            </g>,
          )}
          <g transform="translate(940 640) rotate(-8)">
            <rect x={0} y={0} width={260} height={130} rx={12} fill="#FFE2A8" stroke="#C98A2E" strokeWidth={4} strokeDasharray="12 8" />
            <path d="M60 80c-10 -30 10 -50 34 -44c18 4 22 24 12 36l20 24l-12 10l-22 -22c-12 6 -26 4 -32 -4z" fill="#C98A2E" />
            <Bars x={150} y={44} w={90} rows={3} gap={22} th={10} c="#8A5A1E" seed={79} />
          </g>
        </g>
      );
    default: // S4 — 일정표 카드
      return card(
        <g>
          <rect x={0} y={0} width={380} height={64} rx={10} fill="#15161C" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i}>
              <rect x={36} y={100 + i * 52} width={24} height={24} rx={4} fill="none" stroke="#3A3D48" strokeWidth={3} />
              {i < 4 && <path d={`M40 ${112 + i * 52}l6 6l12 -14`} stroke={C.green} strokeWidth={4} fill="none" strokeLinecap="round" />}
            </g>
          ))}
          <Bars x={80} y={110} w={260} rows={7} gap={52} th={8} c="#7A7E88" seed={80} />
        </g>,
      );
  }
}

export function EndingArt({ ending, culprit, idScope = 'end', className }: { ending: EndingId | string; culprit?: SuspectId; idScope?: string; className?: string }) {
  const ids = useSvgIds(`end-${ending}`, idScope);
  const s = `${idScope}${ending}`;

  if (ending === 'perfect') {
    const P = culprit ? SUSPECT[culprit] : null;
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <LivingBg s={1.07} dx={0} dy={-10} id={`${s}bg`} />
        {/* 새벽 청색 */}
        <rect width={1600} height={1000} fill="#6FA8FF" opacity={0.14} />
        <rect width={1600} height={1000} fill={C.ink} opacity={0.35} />
        <PoliceEdges ids={ids} o={0.4} />
        <Place x={-10} y={420} w={420}>
          <DetectivePortrait idScope={`${s}m`} backlight={false} idle={false} decorative />
        </Place>
        {P && (
          <Place x={540} y={210} w={520}>
            <P face="break" idScope={`${s}c`} idle={false} decorative />
          </Place>
        )}
        <Place x={1160} y={330} w={460}>
          <HangyeolPortrait face="normal" idScope={`${s}h`} idle={false} decorative />
        </Place>
        <Glow ids={ids} tone="white" cx={800} cy={60} rx={700} ry={140} o={0.18} />
      </Frame>
    );
  }
  if (ending === 'hidden') {
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <rect width={1600} height={1000} fill="#0C0A10" />
        <Glow ids={ids} tone="amber" cx={560} cy={520} rx={560} ry={420} o={0.35} />
        <Place x={180} y={-60} w={760}>
          <DdobagiPortrait led="alarm" idScope={`${s}a`} backlight={false} decorative />
        </Place>
        {/* 알람 카드 — 시계 아이콘 + 07:00 + 「취소할까요?」 버튼 모양 */}
        <g transform="translate(980 300)">
          <rect x={0} y={0} width={480} height={300} rx={28} fill="#151820" stroke={C.amber} strokeOpacity={0.5} strokeWidth={3} />
          <circle cx={78} cy={92} r={40} fill="none" stroke={C.amber} strokeWidth={8} />
          <path d="M78 66v28l18 12" stroke={C.amber} strokeWidth={8} fill="none" strokeLinecap="round" />
          <text x={150} y={124} fontSize={92} fontWeight={700} fill="#FFE7B0" style={{ fontFamily: "var(--wt-font-num, 'JetBrains Mono'), ui-monospace, monospace" }}>
            07:00
          </text>
          <rect x={40} y={190} width={400} height={74} rx={37} fill={C.amber} />
          <text x={240} y={240} textAnchor="middle" fontSize={34} fontWeight={800} fill="#1A1206" style={{ fontFamily: "var(--wt-font-body, 'Pretendard Variable'), sans-serif" }}>
            취소할까요?
          </text>
        </g>
        <rect width={1600} height={1000} fill={ids.url('vig')} />
      </Frame>
    );
  }
  if (ending === 'short') {
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <rect width={1600} height={1000} fill="#1A2630" />
        {/* 열린 문 + 복도의 차가운 빛 + 실루엣 2 */}
        <rect x={880} y={120} width={420} height={800} fill="#0C1218" />
        <rect x={900} y={140} width={380} height={780} fill="#DFF7F3" opacity={0.85} />
        <path d="M900 920L700 1000H1500L1280 920Z" fill="#DFF7F3" opacity={0.25} />
        {[990, 1130].map((x, i) => (
          <path
            key={x}
            transform={`translate(${x} ${i ? 330 : 310})`}
            d="M50 0c24 0 38 20 36 46c-2 18 -10 30 -18 38l3 14c32 6 54 20 62 42c8 22 10 70 12 150v300h-190v-300c2 -80 4 -128 12 -150c8 -22 30 -36 62 -42l3 -14c-8 -8 -16 -20 -18 -38c-2 -26 12 -46 36 -46z"
            fill="#16222A"
          />
        ))}
        <rect x={860} y={100} width={460} height={20} fill="#0C1218" />
        <rect x={860} y={100} width={20} height={820} fill="#0C1218" />
        <rect x={1300} y={100} width={20} height={820} fill="#0C1218" />
        <Glow ids={ids} tone="white" cx={1090} cy={500} rx={420} ry={460} o={0.3} />
        <Place x={140} y={260} w={560}>
          <HangyeolPortrait face="sweat" idScope={`${s}h`} idle={false} decorative />
        </Place>
        <rect width={1600} height={1000} fill="#DFF7F3" opacity={0.06} />
        <rect width={1600} height={1000} fill={ids.url('vig')} />
      </Frame>
    );
  }
  if (ending === 'timeout') {
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <LivingBg s={1.6} dx={-300} dy={-20} id={`${s}bg`} />
        <rect width={1600} height={1000} fill={C.ink} opacity={0.3} />
        <PoliceEdges ids={ids} live o={0.7} />
        <rect width={1600} height={1000} fill={ids.url('vig')} />
      </Frame>
    );
  }
  if (ending === 'excluded') {
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <rect width={1600} height={1000} fill="#1C2028" />
        {/* 증거 봉투 속 수첩(글자 없음) */}
        <g transform="translate(900 250) rotate(-6)">
          <rect x={0} y={0} width={480} height={560} rx={16} fill="#C9D3E6" opacity={0.22} />
          <rect x={0} y={0} width={480} height={36} rx={10} fill="#C9D3E6" opacity={0.45} />
          <path d="M0 36H480" stroke="#E6ECF6" strokeWidth={3} opacity={0.6} />
          <rect x={110} y={120} width={260} height={340} rx={10} fill="#2C3E66" />
          <rect x={124} y={134} width={232} height={312} rx={6} fill="#3A4E7A" />
          {[150, 200, 250, 300, 350, 400].map((y) => (
            <path key={y} d={`M104 ${y}h-14`} stroke="#C9D0DC" strokeWidth={6} strokeLinecap="round" />
          ))}
          <rect x={300} y={480} width={140} height={50} rx={6} fill="#A33A3E" opacity={0.85} />
          <path d="M40 80l60 400" stroke="#FFFFFF" strokeWidth={10} opacity={0.08} />
        </g>
        <Place x={120} y={240} w={580}>
          <HangyeolPortrait face="break" idScope={`${s}h`} idle={false} decorative />
        </Place>
        <rect width={1600} height={1000} fill="#5A6070" opacity={0.18} />
        <rect width={1600} height={1000} fill={ids.url('vig')} />
      </Frame>
    );
  }
  if (ending.startsWith('wrong-')) {
    const who = ending.slice(6) as SuspectId;
    const P = SUSPECT[who] ?? SungangPortrait;
    const face: ArtFace = 'sweat';
    return (
      <Frame ending={ending} className={className}>
        <SceneDefs ids={ids} />
        <rect width={1600} height={1000} fill="#121826" />
        <Glow ids={ids} tone="white" cx={500} cy={500} rx={520} ry={500} o={0.08} />
        <ellipse cx={520} cy={540} rx={460} ry={520} fill={SPK[who] ?? SPK.S1} opacity={0.14} />
        <Place x={200} y={180} w={620}>
          <P face={face} idScope={`${s}p`} backlight={false} idle={false} decorative />
        </Place>
        <PropCard who={who} />
        {/* 채도 낮춤 */}
        <rect width={1600} height={1000} fill="#4A5060" opacity={0.22} />
        <rect width={1600} height={1000} fill={ids.url('vig')} />
      </Frame>
    );
  }
  return (
    <Frame ending={ending} className={className}>
      <rect width={1600} height={1000} fill={C.wall0} />
    </Frame>
  );
}
