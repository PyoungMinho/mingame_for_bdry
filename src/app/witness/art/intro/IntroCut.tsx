/**
 * 사건 소개 8컷 그림 — 사건 데이터 `CaseFile.intro[].art` 키 → 4:3(800×600) 한 장.
 * 새로 그린 것은 tower · stair · ad-frame(디자인 §10). 나머지는 장면·초상 재조합(UI 스펙 8-1).
 *  tower        타워 외관 + 폭우, 41층 창 한 칸 점등
 *  stair        계단참 어둠 + 나(실루엣)
 *  cop-window   비 오는 창(침수된 강변도로) + 한결(평소)
 *  ad-frame     TV 광고 틀 + 피해자 실루엣 + 네온 유행어
 *  cop-ddobagi  한결(당황) + 또박이 소형
 *  suspects     용의자 실루엣 4(초상 마스킹, 같은 크기·같은 처리) + 또박이 LED
 *  ddobagi      또박이 클로즈업(대기) + 나 실루엣
 *  clock        23:00 시계(허브 태블릿) — HUD 로 넘어가기 직전 컷
 * 장식(aria-hidden) — 컷 문장은 대사창이 읽는다.
 */
import type { ReactNode } from 'react';
import { C, useSvgIds } from '../palette';
import { DdobagiPortrait } from '../portraits/Ddobagi';
import { DetectivePortrait } from '../portraits/Detective';
import { HaneulPortrait } from '../portraits/Haneul';
import { HangyeolPortrait } from '../portraits/Hangyeol';
import { JunhyeokPortrait } from '../portraits/Junhyeok';
import { MisukPortrait } from '../portraits/Misuk';
import { SungangPortrait } from '../portraits/Sungang';
import { CityNight, Glow, RainOnGlass, SceneDefs, SkyGradient } from '../scenes/parts';
import { SpeakerBody, SpeakerDefs } from '../speaker';
import { AdFrameArt, StairArt } from './Pieces';
import { TowerArt } from './Tower';

export type IntroArtKey = 'tower' | 'stair' | 'cop-window' | 'ad-frame' | 'cop-ddobagi' | 'suspects' | 'ddobagi' | 'clock';
export const INTRO_ART_KEYS: readonly IntroArtKey[] = ['tower', 'stair', 'cop-window', 'ad-frame', 'cop-ddobagi', 'suspects', 'ddobagi', 'clock'];

function Frame({ art, className, fit, children }: { art: string; className?: string; fit: 'slice' | 'meet'; children: ReactNode }) {
  return (
    <svg className={className ? `wt-art-scene ${className}` : 'wt-art-scene'} viewBox="0 0 800 600" preserveAspectRatio={`xMidYMid ${fit}`} aria-hidden="true" focusable="false" data-art={art} xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}
/** 초상을 (x, y, w, h) 자리에 놓는 틀(초상은 3:4) */
function Place({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  return (
    <svg x={x} y={y} width={w} height={(w * 4) / 3} viewBox="0 0 600 800" overflow="visible">
      {children}
    </svg>
  );
}

export function IntroCutArt({ art, idScope = 'intro', rain = true, className, fit = 'slice' }: { art: string; idScope?: string; rain?: boolean; className?: string; fit?: 'slice' | 'meet' }) {
  const ids = useSvgIds(`intro-${art}`, idScope);
  const s = `${idScope}${art}`;
  switch (art) {
    case 'tower':
      return <TowerArt idScope={s} rain={rain} className={className} fit={fit} />;
    case 'stair':
      return <StairArt idScope={s} className={className} fit={fit} />;
    case 'ad-frame':
      return <AdFrameArt idScope={s} className={className} fit={fit} />;
    case 'cop-window':
      return (
        <Frame art={art} className={className} fit={fit}>
          <SceneDefs ids={ids}>
            <SkyGradient ids={ids} top="#060B18" bottom="#1B2E52" />
          </SceneDefs>
          <rect width={800} height={600} fill="#0B1222" />
          <CityNight ids={ids} x={0} y={0} w={800} h={600} seed={61} river={0.7} bridge={false} dim />
          {/* 잠긴 강변도로 — 물에 잠긴 가로등 줄 */}
          <path d="M0 440H800" stroke="#24335A" strokeWidth={6} />
          {Array.from({ length: 9 }, (_, i) => (
            <g key={i}>
              <path d={`M${40 + i * 92} 440v-34`} stroke="#3A4870" strokeWidth={3} />
              <circle cx={40 + i * 92} cy={404} r={4} fill={C.amber} opacity={0.6} />
            </g>
          ))}
          <RainOnGlass ids={ids} name="w" x={0} y={0} w={800} h={600} n={44} seed={17} rain={rain} />
          <path d="M0 0H800V18H0zM0 582H800V600H0zM392 0h16v600h-16z" fill="#0A0E1A" />
          <Place x={210} y={70} w={390}>
            <HangyeolPortrait idScope={`${s}c`} decorative />
          </Place>
          <rect width={800} height={600} fill={ids.url('vig')} />
        </Frame>
      );
    case 'cop-ddobagi':
      return (
        <Frame art={art} className={className} fit={fit}>
          <SceneDefs ids={ids}>
            <SpeakerDefs ids={ids} />
          </SceneDefs>
          <rect width={800} height={600} fill="#0E1528" />
          <Glow ids={ids} tone="cyan" cx={610} cy={340} rx={220} ry={200} o={0.35} />
          <path d="M480 470H760L770 484H470Z" fill="#3A2B22" />
          <SpeakerBody ids={ids} x={620} y={330} s={0.46} />
          <Place x={40} y={70} w={390}>
            <HangyeolPortrait face="sweat" idScope={`${s}c`} decorative />
          </Place>
          <rect width={800} height={600} fill={ids.url('vig')} />
        </Frame>
      );
    case 'suspects': {
      const sil = [SungangPortrait, HaneulPortrait, MisukPortrait, JunhyeokPortrait];
      return (
        <Frame art={art} className={className} fit={fit}>
          <SceneDefs ids={ids}>
            <SpeakerDefs ids={ids} />
            {sil.map((P, i) => (
              <mask key={i} id={ids.id(`m${i}`)} maskUnits="userSpaceOnUse" x={0} y={0} width={800} height={600} style={{ maskType: 'alpha' }}>
                <Place x={14 + i * 190} y={110} w={200}>
                  <P idScope={`${s}m${i}`} backlight={false} idle={false} decorative />
                </Place>
              </mask>
            ))}
          </SceneDefs>
          <rect width={800} height={600} fill="#0A0F1E" />
          <Glow ids={ids} tone="violet" cx={400} cy={240} rx={420} ry={220} o={0.2} />
          {sil.map((_, i) => (
            <g key={i}>
              <rect x={0} y={0} width={800} height={600} fill={C.cyan} opacity={0.45} mask={ids.url(`m${i}`)} transform="translate(4 0)" />
              <rect x={0} y={0} width={800} height={600} fill="#0B1020" mask={ids.url(`m${i}`)} />
            </g>
          ))}
          <path d="M0 470H800V600H0Z" fill="#0A0D18" />
          <Glow ids={ids} tone="cyan" cx={400} cy={470} rx={200} ry={90} o={0.5} />
          <SpeakerBody ids={ids} x={400} y={392} s={0.36} />
          <rect width={800} height={600} fill={ids.url('vig')} />
        </Frame>
      );
    }
    case 'ddobagi':
      return (
        <Frame art={art} className={className} fit={fit}>
          <SceneDefs ids={ids} />
          <rect width={800} height={600} fill="#0B1222" />
          <Place x={220} y={-40} w={480}>
            <DdobagiPortrait idScope={`${s}a`} speaking decorative />
          </Place>
          <Place x={-30} y={300} w={300}>
            <DetectivePortrait idScope={`${s}m`} backlight={false} decorative />
          </Place>
          <rect width={800} height={600} fill={ids.url('vig')} />
        </Frame>
      );
    case 'clock':
      return (
        <Frame art={art} className={className} fit={fit}>
          <SceneDefs ids={ids} />
          <rect width={800} height={600} fill="#0A1020" />
          <Glow ids={ids} tone="cyan" cx={400} cy={270} rx={360} ry={220} o={0.35} />
          <rect x={170} y={120} width={460} height={300} rx={28} fill="#0C1426" />
          <rect x={190} y={140} width={420} height={260} rx={14} fill="#06101C" stroke={C.cyan} strokeOpacity={0.35} strokeWidth={2} />
          <text x={400} y={312} textAnchor="middle" fontSize={136} fontWeight={700} fill={C.cyan} style={{ fontFamily: "var(--wt-font-num, 'JetBrains Mono'), ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' }}>
            23:00
          </text>
          <path d="M240 352h320" stroke={C.cyan} strokeWidth={4} opacity={0.3} strokeLinecap="round" />
          <path d="M240 352h40" stroke={C.amber} strokeWidth={4} strokeLinecap="round" />
          <circle cx={400} cy={412} r={4} fill={C.cyan} />
          <rect width={800} height={600} fill={ids.url('vig')} />
        </Frame>
      );
    default:
      return (
        <Frame art={art} className={className} fit={fit}>
          <rect width={800} height={600} fill={C.wall0} />
        </Frame>
      );
  }
}
