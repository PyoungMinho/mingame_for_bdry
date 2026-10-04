/**
 * L2 서재. 인디고 책장 벽 + 원목 책상과 서류 더미(글자 없는 줄무늬), 문 옆 조명 패널(토글 점 앰버),
 * 책상 아래 종이가 물린 파쇄기, 빗줄기 창, 똑같은 새 책 30권이 줄지은 칸(웃음 포인트).
 *
 * 핫스팟: h1 조명 패널 (12,40) · h2 책상 위 메모 (55,55) · h3 파쇄기 (60,80, 정밀) · h4 책장 (85,35)
 */
import type { ReactElement } from 'react';
import { C, rng, useSvgIds } from '../palette';
import { CityNight, CoveLed, Glow, HubTablet, LedDot, RainOnGlass, SceneDefs, SceneSvg, SkyGradient, Vignette } from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

const BOOK = ['#7A3B3B', '#2F5A6E', '#8A7444', '#4B3E6E', '#3E6B4E', '#9A5A3A', '#5A6578', '#6E3050', '#B08A4A'];

/** 책 한 칸 — 높이·색 무작위(결정론). 바이트 절약을 위해 색별로 경로 하나 */
function Books({ x, y, w, seed }: { x: number; y: number; w: number; seed: number }) {
  const rnd = rng(seed);
  const byColor: string[] = BOOK.map(() => '');
  let band = '';
  let cx = x;
  while (cx < x + w - 14) {
    const bw = 12 + Math.floor(rnd() * 12);
    const bh = 56 + Math.floor(rnd() * 30);
    if (rnd() < 0.08 && cx > x + 20) {
      cx += 16;
      continue;
    }
    const ci = Math.floor(rnd() * BOOK.length);
    if (rnd() < 0.06 && cx + bh < x + w) {
      byColor[ci] += `M${cx} ${y - bw}h${bh}v${bw}h${-bh}z`;
      cx += bh + 2;
      continue;
    }
    byColor[ci] += `M${cx} ${y - bh}h${bw}v${bh}h${-bw}z`;
    band += `M${cx + 2} ${y - bh + 8}h${bw - 4}v3h${-(bw - 4)}z`;
    cx += bw + 1;
  }
  return (
    <g>
      {byColor.map((d, i) => (d ? <path key={i} d={d} fill={BOOK[i]} /> : null))}
      <path d={band} fill="#000" opacity={0.25} />
    </g>
  );
}

export function StudyArt({ idScope, rain = true, className, fit }: SceneArtProps) {
  const ids = useSvgIds('study', idScope);
  const rowsY = [190, 295, 395, 495, 595, 695];
  return (
    <SceneSvg art="study" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <SkyGradient ids={ids} top="#070D1C" bottom="#18264A" />
        <linearGradient id={ids.id('wall')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0E1430" />
          <stop offset="1" stopColor="#1A2142" />
        </linearGradient>
        <linearGradient id={ids.id('desk')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#6E4A2E" />
          <stop offset="1" stopColor="#3E2818" />
        </linearGradient>
        <linearGradient id={ids.id('floor')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#141428" />
          <stop offset="1" stopColor="#22203A" />
        </linearGradient>
      </SceneDefs>

      {/* 벽 · 바닥 */}
      <rect width={1500} height={1000} fill={ids.url('wall')} />
      <rect width={1500} height={30} fill="#070A18" />
      <CoveLed ids={ids} x={0} y={26} w={1500} />
      <path d="M0 780H1500V1000H0Z" fill={ids.url('floor')} />
      <path d="M180 1000L330 820H1170L1320 1000Z" fill="#2B2244" opacity={0.8} />
      <path d="M330 820H1170" stroke="#3E3260" strokeWidth={3} />
      <path d="M0 776H1500" stroke="#070A18" strokeWidth={10} />

      {/* ① 빗줄기 창(가운데) */}
      <CityNight ids={ids} x={560} y={90} w={420} h={330} seed={41} river={0.7} />
      <RainOnGlass ids={ids} name="win" x={560} y={90} w={420} h={330} n={22} seed={12} rain={rain} />
      <g fill="#120F1C">
        <rect x={548} y={80} width={444} height={14} />
        <rect x={548} y={416} width={444} height={20} />
        <rect x={548} y={80} width={14} height={356} />
        <rect x={978} y={80} width={14} height={356} />
        <rect x={764} y={80} width={10} height={356} />
      </g>
      {/* 커튼 */}
      <path d="M520 70q20 200 -4 380h40q-12 -190 10 -380z" fill="#2A2350" />
      <path d="M1020 70q-20 200 4 380h-40q12 -190 -10 -380z" fill="#2A2350" />

      {/* 문 + h1 조명 패널 (12,40) */}
      <g>
        <rect x={10} y={150} width={140} height={630} fill="#07091A" />
        <rect x={22} y={162} width={118} height={614} fill="#3A2716" />
        <rect x={34} y={180} width={94} height={260} rx={3} fill="#4A321C" />
        <rect x={34} y={470} width={94} height={280} rx={3} fill="#4A321C" />
        <circle cx={128} cy={470} r={7} fill="#C9A86A" />
        <path d="M150 150V780" stroke={C.cyan} strokeWidth={3} opacity={0.25} />
        {/* 패널 */}
        <Glow ids={ids} tone="amber" cx={180} cy={400} rx={70} ry={70} o={0.35} />
        <rect x={156} y={354} width={48} height={92} rx={7} fill="#E7E2D6" />
        <rect x={162} y={360} width={36} height={80} rx={4} fill="#CFC8B9" />
        {[372, 392, 412].map((y, i) => (
          <g key={y}>
            <rect x={168} y={y} width={24} height={12} rx={6} fill="#9E9686" />
            <circle cx={i === 1 ? 174 : 186} cy={y + 6} r={4.5} fill={i === 1 ? '#6E6A62' : C.amber} />
          </g>
        ))}
        <circle cx={180} cy={432} r={2.5} fill={C.cyan} />
      </g>

      {/* 왼쪽 책장(장식) */}
      <g>
        <rect x={210} y={70} width={310} height={706} fill="#0B0F24" />
        <rect x={222} y={82} width={286} height={694} fill="#141B33" />
        {rowsY.map((y, i) => (
          <g key={y}>
            <Books x={230} y={y} w={272} seed={100 + i} />
            <rect x={222} y={y} width={286} height={10} fill="#5A3E26" />
          </g>
        ))}
        <rect x={222} y={82} width={286} height={694} fill="#1A2350" opacity={0.25} />
      </g>

      {/* h4 오른쪽 책장 (85,35) — 똑같은 새 책 30권 칸 */}
      <g>
        <rect x={1060} y={60} width={420} height={716} fill="#0B0F24" />
        <rect x={1072} y={72} width={396} height={704} fill="#141B33" />
        {rowsY.map((y, i) =>
          i === 2 ? (
            <g key={y}>
              <path d={Array.from({ length: 30 }, (_, k) => `M${(1082 + k * 12.8).toFixed(1)} ${y - 82}h11.6v82h-11.6z`).join('')} fill="#C23B4A" />
              <path d={Array.from({ length: 30 }, (_, k) => `M${(1082 + k * 12.8).toFixed(1)} ${y - 70}h11.6v5h-11.6zM${(1082 + k * 12.8).toFixed(1)} ${y - 20}h11.6v3h-11.6z`).join('')} fill="#F2D27A" />
              <rect x={1080} y={y - 82} width={386} height={82} fill="#FFFFFF" opacity={0.06} />
              <rect x={1072} y={y} width={396} height={10} fill="#6A4A2C" />
            </g>
          ) : (
            <g key={y}>
              <Books x={1080} y={y} w={380} seed={200 + i} />
              <rect x={1072} y={y} width={396} height={10} fill="#5A3E26" />
            </g>
          ),
        )}
        <rect x={1072} y={72} width={396} height={704} fill="#1A2350" opacity={0.2} />
        <path d="M1480 64V776" stroke={C.cyan} strokeWidth={3} opacity={0.2} />
      </g>

      {/* 허브 태블릿(벽, 창 오른쪽) */}
      <HubTablet ids={ids} x={1004} y={462} w={46} h={64} lit />

      {/* 의자(책상 뒤) */}
      <g>
        <path d="M738 590V400q0 -40 50 -44h44q50 4 50 44v190z" fill="#1C1A26" />
        <path d="M752 590V410q0 -30 40 -34h36q40 4 40 34v180z" fill="#2B2838" />
        <path d="M872 400v190" stroke={C.cyan} strokeWidth={3} opacity={0.25} />
      </g>

      {/* 스탠드 빛 */}
      <Glow ids={ids} tone="amber" cx={640} cy={520} rx={330} ry={200} o={0.5} />

      {/* 책상 */}
      <g>
        <ellipse cx={790} cy={872} rx={330} ry={18} fill="#000" opacity={0.45} />
        <path d="M500 548H1080L1100 584H480Z" fill="#8A6040" />
        <path d="M500 548H1080" stroke="#C49A6A" strokeWidth={2} />
        <rect x={480} y={584} width={620} height={26} fill={ids.url('desk')} />
        {/* 왼쪽 서랍장 + 오른쪽 다리 */}
        <rect x={492} y={610} width={170} height={252} fill="#3E2818" />
        <rect x={502} y={620} width={150} height={74} rx={3} fill="#4C3220" />
        <rect x={502} y={702} width={150} height={74} rx={3} fill="#4C3220" />
        <rect x={502} y={784} width={150} height={70} rx={3} fill="#4C3220" />
        {[656, 738, 818].map((y) => (
          <rect key={y} x={556} y={y} width={42} height={6} rx={3} fill="#C9A86A" />
        ))}
        <rect x={1068} y={610} width={22} height={252} fill="#3E2818" />
        <rect x={662} y={610} width={406} height={30} fill="#2A1A0E" />
        {/* 스탠드 */}
        <g>
          <ellipse cx={600} cy={556} rx={34} ry={7} fill="#2A2A30" />
          <path d="M600 554L586 468L648 438" stroke="#3A3A44" strokeWidth={6} fill="none" strokeLinecap="round" />
          <path d="M636 428l30 -6l22 40l-58 12z" fill="#C9A86A" />
          <path d="M630 474l58 -12" stroke="#FFE9C2" strokeWidth={6} strokeLinecap="round" />
        </g>
        {/* 서류 더미 + h2 회장 메모 (55,55) */}
        <g>
          <path d="M704 560l120 -10l16 30l-124 10z" fill="#D7D2C6" />
          <path d="M700 552l122 -10l14 30l-124 10z" fill="#E8E4DA" />
          <path d="M696 544l122 -10l14 30l-124 10z" fill="#F4F1EA" />
          <path d="M720 548l90 -8M724 556l86 -8M728 564l70 -6" stroke="#A9A39A" strokeWidth={3} strokeLinecap="round" />
          <path d="M800 538l66 -10l12 34l-66 10z" fill="#FFF0A8" />
          <path d="M812 540l42 -6M815 549l38 -6M818 558l26 -4" stroke="#9C8A50" strokeWidth={3} strokeLinecap="round" />
          <path d="M936 556l100 -6l10 24l-104 8z" fill="#E8E4DA" />
          <path d="M932 548l100 -6l10 24l-104 8z" fill="#F4F1EA" />
          <path d="M950 554l70 -4M952 562l60 -4" stroke="#A9A39A" strokeWidth={3} strokeLinecap="round" />
          <rect x={890} y={516} width={24} height={36} rx={4} fill="#2F3A56" />
          <path d="M896 516l-4 -22M904 516l2 -24M910 516l6 -18" stroke="#D9C08A" strokeWidth={3} strokeLinecap="round" />
        </g>
        {/* h3 파쇄기 (60,80) — 입에 종이 끝, 글자 없음 */}
        <g>
          <ellipse cx={900} cy={866} rx={74} ry={10} fill="#000" opacity={0.5} />
          <rect x={846} y={752} width={108} height={112} rx={8} fill="#2C3040" />
          <rect x={846} y={752} width={108} height={14} rx={6} fill="#40465A" />
          <rect x={862} y={756} width={76} height={5} rx={2} fill="#0B0D14" />
          <path d="M870 758l6 -46l52 6l-6 42z" fill="#F4F1EA" />
          <path d="M880 726l38 4M878 738l36 4" stroke="#B5AFA4" strokeWidth={3} strokeLinecap="round" />
          <path d="M876 712l52 6" stroke="#FFFFFF" strokeWidth={2} />
          <path d="M858 790h84" stroke="#1C1F2A" strokeWidth={2} />
          <rect x={858} y={800} width={84} height={52} rx={4} fill="#3A4050" opacity={0.8} />
          <path d="M866 816h24M896 822h32M870 836h40" stroke="#6E7488" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
          <LedDot ids={ids} x={940} y={772} tone="red" r={3} />
        </g>
      </g>

      <Glow ids={ids} tone="violet" cx={1300} cy={120} rx={300} ry={120} o={0.18} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneStudy: SceneArtDef = {
  key: 'study',
  name: '서재',
  Art: StudyArt,
  anchors: { 'L2.h1': [12, 40], 'L2.h2': [55, 55], 'L2.h3': [60, 80], 'L2.h4': [85, 35] },
  tone: '#141B33',
};
