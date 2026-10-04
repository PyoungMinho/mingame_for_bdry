/**
 * L5 손님방(잠김 → 해금). 어두운 인디고 + 노트북의 그린 글로우, 빗물 흐르는 창.
 * 침대 위 똑같은 회색 후드티 일곱 벌(같은 모양 반복 — 웃음 포인트), 책상 위 노트북(검은 화면에 초록 줄 — 글자 아닌 막대),
 * 열린 여행 가방(빨간 줄이 쳐진 종이 느낌의 흰 사각).
 * 노트북 화면은 두 칸: 왼쪽 상태 창(h2) · 오른쪽 아래 긴 입력 기록 창(h3) — D10 좌표 분리.
 *
 * 핫스팟: h1 여행 가방 (75,70) · h2 노트북 화면 (38,44) · h3 노트북 입력 기록 (54,52, 정밀) · h4 후드티 더미 (20,60)
 */
import { C, useSvgIds } from '../palette';
import { Bars, CityNight, CoveLed, Glow, HubTablet, LedDot, RainOnGlass, SceneDefs, SceneSvg, SkyGradient, Vignette } from './parts';
import type { SceneArtDef, SceneArtProps } from './types';

const HOOD = '#7F8AA3';
const HOOD_D = '#5D6780';

export function GuestArt({ idScope, rain = true, className, fit }: SceneArtProps) {
  const ids = useSvgIds('guest', idScope);
  return (
    <SceneSvg art="guest" className={className} fit={fit}>
      <SceneDefs ids={ids}>
        <SkyGradient ids={ids} top="#060B1A" bottom="#152040" />
        <linearGradient id={ids.id('wall')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0B1126" />
          <stop offset="1" stopColor="#141C38" />
        </linearGradient>
        <linearGradient id={ids.id('floor')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#141426" />
          <stop offset="1" stopColor="#222036" />
        </linearGradient>
        <linearGradient id={ids.id('screen')} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#04100C" />
          <stop offset="1" stopColor="#061A12" />
        </linearGradient>
        {/* 펼쳐 놓은 후드티 한 벌 — 7번 반복(똑같은 모양) */}
        <g id={ids.id('hoodie')}>
          <path d="M-20 -14l-14 40l11 4l9 -24zM20 -14l14 40l-11 4l-9 -24z" fill={HOOD_D} />
          <path d="M-20 -16q20 -6 40 0l2 46q-22 6 -44 0z" fill={HOOD} />
          <ellipse cx={0} cy={-20} rx={15} ry={12} fill={HOOD_D} />
          <ellipse cx={0} cy={-18} rx={9} ry={7} fill="#3E4660" />
          <path d="M-12 12h24v12q-12 4 -24 0z" fill={HOOD_D} />
          <path d="M-4 -9v14M4 -9v12" stroke="#EEF1F8" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M20 -14l2 44" stroke="#A3ADC4" strokeWidth={2} opacity={0.6} />
        </g>
      </SceneDefs>

      {/* 벽 · 바닥 */}
      <rect width={1500} height={1000} fill={ids.url('wall')} />
      <rect width={1500} height={28} fill="#060A18" />
      <CoveLed ids={ids} x={0} y={24} w={1500} />
      <path d="M0 800H1500V1000H0Z" fill={ids.url('floor')} />
      <path d="M0 796H1500" stroke="#070A16" strokeWidth={8} />
      <path d="M220 1000L420 840H1180L1360 1000Z" fill="#1E1A30" />

      {/* 빗물 흐르는 창(오른쪽 뒤) */}
      <CityNight ids={ids} x={1040} y={90} w={400} h={380} seed={51} river={0.74} />
      <RainOnGlass ids={ids} name="win" x={1040} y={90} w={400} h={380} n={26} seed={33} o={0.6} rain={rain} />
      <path d="M1080 100c4 60 -6 120 2 200c4 50 -4 90 0 160M1180 96c-4 70 8 140 0 220M1330 100c6 80 -4 160 4 240c2 40 -2 80 0 120" stroke="#CFE6FF" strokeWidth={3} opacity={0.18} fill="none" />
      <g fill="#0A0E1C">
        <rect x={1028} y={80} width={424} height={14} />
        <rect x={1028} y={466} width={424} height={22} />
        <rect x={1028} y={80} width={14} height={408} />
        <rect x={1438} y={80} width={14} height={408} />
        <rect x={1234} y={80} width={10} height={408} />
      </g>

      {/* 허브 태블릿(벽) */}
      <HubTablet ids={ids} x={960} y={250} w={52} h={72} />

      {/* 노트북 그린 글로우 */}
      <Glow ids={ids} tone="green" cx={680} cy={450} rx={460} ry={300} o={0.32} />

      {/* 책상 */}
      <g>
        <ellipse cx={700} cy={800} rx={340} ry={14} fill="#000" opacity={0.45} />
        <path d="M384 598H1012L1026 622H370Z" fill="#3A3048" />
        <rect x={370} y={622} width={656} height={20} fill="#2A2236" />
        <rect x={392} y={642} width={16} height={156} fill="#1E1828" />
        <rect x={988} y={642} width={16} height={156} fill="#1E1828" />
        <path d="M384 598H1012" stroke={C.green} strokeWidth={2} opacity={0.35} />
      </g>

      {/* 노트북 — 화면 두 칸 */}
      <g>
        <rect x={410} y={300} width={540} height={286} rx={12} fill="#14161E" />
        <rect x={422} y={312} width={516} height={262} rx={4} fill={ids.url('screen')} />
        {/* h2 왼쪽 상태 창 (38,44) */}
        <rect x={432} y={326} width={276} height={228} rx={4} fill="#071F16" stroke={C.green} strokeOpacity={0.35} strokeWidth={2} />
        <rect x={432} y={326} width={276} height={18} rx={4} fill={C.green} opacity={0.25} />
        <circle cx={444} cy={335} r={3.5} fill={C.green} />
        <Bars x={448} y={366} w={200} rows={4} gap={16} th={5} c={C.green} o={0.55} seed={61} />
        <rect x={448} y={436} width={150} height={34} rx={5} fill={C.green} opacity={0.85} />
        <path d="M460 453h18M486 453h26M520 453h40M568 453h14" stroke="#04100C" strokeWidth={6} strokeLinecap="round" />
        <rect x={448} y={484} width={244} height={10} rx={5} fill="#0E3A28" />
        <rect x={448} y={484} width={244} height={10} rx={5} fill={C.green} opacity={0.9} />
        <Bars x={448} y={516} w={180} rows={2} gap={16} th={5} c={C.green} o={0.4} seed={62} />
        {/* 오른쪽 위 작은 창(장식) */}
        <rect x={718} y={326} width={210} height={112} rx={4} fill="#06160F" stroke={C.green} strokeOpacity={0.2} strokeWidth={2} />
        <path d="M730 420l24 -20l20 10l26 -36l22 22l26 -14l24 18l22 -26" stroke={C.green} strokeWidth={3} fill="none" opacity={0.55} />
        {/* h3 오른쪽 아래 긴 입력 기록 창 (54,52) */}
        <rect x={718} y={448} width={210} height={116} rx={4} fill="#06160F" stroke={C.green} strokeOpacity={0.35} strokeWidth={2} />
        <Bars x={730} y={462} w={184} rows={7} gap={13} th={4} c={C.green} o={0.8} seed={63} />
        <path d="M730 462h6M730 475h6M730 488h6M730 501h6M730 514h6M730 527h6M730 540h6" stroke="#A8FFD6" strokeWidth={4} strokeLinecap="round" />
        <rect className="wt-art-cursor" x={792} y={546} width={10} height={12} fill={C.green} />
        {/* 키보드 몸체 */}
        <path d="M392 586H968L1000 608H360Z" fill="#2A2C38" />
        <path d="M430 592H930" stroke="#3E4152" strokeWidth={6} strokeLinecap="round" strokeDasharray="10 4" />
        <path d="M600 600H760" stroke="#3E4152" strokeWidth={5} strokeLinecap="round" />
        <path d="M950 300v286" stroke={C.cyan} strokeWidth={3} opacity={0.2} />
        <LedDot ids={ids} x={680} y={306} tone="green" r={2} />
      </g>

      {/* 의자(책상 앞, 등받이만) */}
      <g>
        <path d="M600 800V690q0 -24 24 -26h120q24 2 24 26v110z" fill="#1A1626" />
        <path d="M612 800V696q0 -18 18 -20h108q18 2 18 20v104z" fill="#262036" />
        <path d="M768 690v110" stroke={C.green} strokeWidth={2} opacity={0.3} />
      </g>

      {/* 싱글 침대 + h4 후드티 일곱 벌 (20,60) — 나란히 줄 세움 */}
      <g>
        <rect x={0} y={420} width={420} height={250} rx={10} fill="#2A2440" />
        <rect x={14} y={434} width={392} height={210} rx={8} fill="#342C50" />
        <path d="M-20 560H440L470 712H-40Z" fill="#A7AEC2" />
        <path d="M-20 560H440" stroke="#E6EAF2" strokeWidth={3} />
        <path d="M-40 712H470V800H-40Z" fill="#767D94" />
        <path d="M-40 712H470" stroke="#E6EAF2" strokeWidth={3} />
        <path d="M-40 770H470" stroke="#6E7488" strokeWidth={3} />
        <rect x={24} y={540} width={110} height={36} rx={16} fill="#E6EAF2" />
        {[0, 1, 2, 3, 4, 5, 6].map((k) => (
          <g key={k}>
            <ellipse cx={168 + k * 44} cy={634} rx={22} ry={5} fill="#000" opacity={0.2} />
            <use href={ids.href('hoodie')} x={168 + k * 44} y={604} />
          </g>
        ))}
        <path d="M470 560v240" stroke={C.cyan} strokeWidth={3} opacity={0.2} />
      </g>

      {/* h1 열린 여행 가방 (75,70) — 빨간 줄 쳐진 흰 사각(글자 없음) */}
      <g>
        <ellipse cx={1130} cy={812} rx={190} ry={16} fill="#000" opacity={0.5} />
        {/* 뚜껑(뒤로 젖힘) */}
        <path d="M980 700L1010 560H1250L1280 700Z" fill="#2E3A5E" />
        <path d="M996 694L1022 574H1238L1264 694Z" fill="#24304E" />
        <path d="M1040 600H1220M1030 640H1230" stroke="#3A4870" strokeWidth={4} />
        {/* 몸통 */}
        <path d="M968 700H1292L1280 800H980Z" fill="#3A4A76" />
        <path d="M982 704H1278L1270 760H990Z" fill="#1C2440" />
        {/* 옷 · 종이 */}
        <path d="M994 716q40 -18 90 -6q30 -16 70 0q40 -10 100 4l-6 38H1000z" fill="#5A6280" />
        <g transform="rotate(-6 1130 712)">
          <rect x={1076} y={682} width={110} height={70} rx={2} fill="#F2EFE8" />
          <path d="M1088 696h76M1088 708h84M1088 720h66M1088 732h80" stroke="#A9A39A" strokeWidth={3} strokeLinecap="round" />
          <path d="M1084 700h88M1084 724h70M1084 736h86" stroke="#E5484D" strokeWidth={3} strokeLinecap="round" opacity={0.9} />
        </g>
        <rect x={1100} y={790} width={60} height={10} rx={4} fill="#1C2440" />
        <path d="M1292 700L1280 800" stroke={C.cyan} strokeWidth={3} opacity={0.25} />
      </g>

      <Glow ids={ids} tone="green" cx={680} cy={600} rx={360} ry={60} o={0.25} />
      <Vignette ids={ids} />
    </SceneSvg>
  );
}

export const sceneGuest: SceneArtDef = {
  key: 'guest',
  name: '손님방',
  Art: GuestArt,
  anchors: { 'L5.h1': [75, 70], 'L5.h2': [38, 44], 'L5.h3': [54, 52], 'L5.h4': [20, 60] },
  tone: '#0F1630',
};
