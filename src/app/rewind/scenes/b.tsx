/**
 * 씬 그룹 B — 2000년대 중반~2008: 미니홈피 방, 증권사 객장, 모델하우스 줄, 여의도 폭락의 밤.
 * 톤: "추억 앨범" 실루엣 듀오톤. 시장 신호는 한국식(상승 빨강 ▲ · 하락 파랑 ▼).
 * 실존 상표·로고 없음 — 화면·전광판은 모두 추상 형태.
 */
import type { ComponentType } from 'react';
import { ApartmentBlock, Glow, Haze, Kid, Lamp, PAL, Person, SceneSvg, Skyline, Sky, Tree, Vignette, rng } from './primitives';

const UP = '#FF5A4E';
const DOWN = '#4E8CFF';

// ─────────────────────────── cyworld_room ───────────────────────────
/** 2000년대 중반 10대의 방 — 파스텔 미니홈피 화면이 방을 물들인다 */
function CyworldRoom() {
  const tabs = ['#8FD3F4', '#FFB3CF', '#FFE08A', '#B9E5A6'];
  return (
    <SceneSvg>
      <Sky id="rs-cy-wall" stops={[[0, '#150F1C'], [0.6, '#2A1E2E'], [1, '#1A1219']]} />
      <defs>
        <linearGradient id="rs-cy-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A2624" />
          <stop offset="1" stopColor="#120A0C" />
        </linearGradient>
      </defs>
      <rect x={0} y={352} width={800} height={98} fill="url(#rs-cy-floor)" />
      <rect x={0} y={352} width={800} height={4} fill="#3A2820" />

      {/* 창밖 — 저녁 노을 단지 */}
      <defs>
        <linearGradient id="rs-cy-dusk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3B3160" />
          <stop offset="0.55" stopColor="#C0677A" />
          <stop offset="1" stopColor="#F3A86A" />
        </linearGradient>
      </defs>
      <rect x={40} y={70} width={210} height={190} fill="url(#rs-cy-dusk)" />
      <ApartmentBlock x={50} y={262} w={80} h={110} floors={11} cols={4} fill="#2B2238" seed={21} litRatio={0.28} win="#FFD48A" number="203" />
      <ApartmentBlock x={150} y={262} w={96} h={82} floors={8} cols={5} fill="#241C30" seed={22} litRatio={0.22} win="#FFD48A" />
      <g fill="#1A1016">
        <rect x={32} y={62} width={226} height={10} />
        <rect x={32} y={258} width={226} height={12} />
        <rect x={32} y={62} width={10} height={206} />
        <rect x={248} y={62} width={10} height={206} />
        <rect x={142} y={62} width={6} height={206} />
      </g>
      <path d="M24 56 C40 140 30 220 46 290 L10 290 L10 56 Z" fill="#3A2436" opacity={0.9} />
      <Glow id="rs-cy-sun" cx={150} cy={250} r={200} color="#F3A86A" opacity={0.28} />

      {/* 벽 포스터 */}
      <g transform="rotate(-3 318 120)">
        <rect x={282} y={70} width={74} height={100} fill="#E8B7C8" opacity={0.75} />
        <circle cx={319} cy={108} r={22} fill="#7A4A66" opacity={0.7} />
        <text x={319} y={158} textAnchor="middle" fontSize={14} fontWeight={800} fill="#5A2A44" opacity={0.85}>
          ★ LIVE
        </text>
      </g>
      <rect x={372} y={92} width={46} height={62} fill="#9CC8E4" opacity={0.55} />
      <path d="M380 140 L394 108 L408 140 Z" fill="#35536A" opacity={0.6} />

      {/* 모니터 광 */}
      <Glow id="rs-cy-pink" cx={590} cy={210} r={260} color="#FF9CC6" opacity={0.42} className="zs-glow" />
      <Glow id="rs-cy-blue" cx={650} cy={230} r={170} color="#8FD3F4" opacity={0.3} />

      {/* 책상 */}
      <g fill="#140C10">
        <rect x={410} y={290} width={380} height={12} />
        <rect x={420} y={300} width={10} height={54} />
        <rect x={760} y={300} width={10} height={54} />
        <rect x={660} y={302} width={100} height={46} />
      </g>
      <rect x={410} y={290} width={380} height={2} fill="#FFB3CF" opacity={0.35} />

      {/* 브라운관 모니터 + 추상 미니홈피 */}
      <rect x={512} y={146} width={196} height={146} rx={12} fill="#1C1418" />
      <rect x={582} y={284} width={56} height={8} fill="#1C1418" />
      <rect x={524} y={156} width={172} height={120} rx={8} fill="#FCE8F0" />
      <rect x={530} y={162} width={50} height={108} rx={4} fill="#FFFFFF" />
      <rect x={536} y={170} width={38} height={38} fill="#FFD1E0" />
      <circle cx={555} cy={184} r={7} fill="#6A4A5A" />
      <path d="M545 204 C545 194 565 194 565 204 Z" fill="#6A4A5A" />
      <path d="M536 218 H574 M536 226 H568 M536 234 H572" stroke="#C99AB0" strokeWidth={2} />
      <text x={555} y={256} textAnchor="middle" fontSize={7} fontWeight={700} fill="#E0689A">
        TODAY 12
      </text>
      <rect x={586} y={162} width={96} height={108} rx={4} fill="#FFFFFF" />
      <text x={592} y={175} fontSize={8} fontWeight={800} fill="#6A8FB0">
        오늘 기분 ☆
      </text>
      <path d="M634 198 L674 218 L634 238 L594 218 Z" fill="#CDE9F7" />
      <path d="M594 218 L634 198 L634 186 L594 206 Z" fill="#FFE3EC" />
      <path d="M634 198 L674 218 L674 206 L634 186 Z" fill="#FFF3C8" />
      <rect x={610} y={212} width={10} height={8} fill="#E88AAE" />
      <rect x={640} y={216} width={12} height={6} fill="#8FB8E0" />
      <circle cx={630} cy={226} r={3} fill="#6A4A5A" />
      <rect x={627} y={229} width={6} height={6} fill="#FF9CC6" />
      <path d="M592 250 H676 M592 258 H660" stroke="#E6D2DC" strokeWidth={2.4} />
      {tabs.map((c, i) => (
        <rect key={c} x={682} y={168 + i * 16} width={11} height={13} rx={2} fill={c} />
      ))}

      {/* 폴더폰 — 열린 채 문자 대기 */}
      <g transform="rotate(-10 724 280)">
        <rect x={712} y={266} width={24} height={20} rx={3} fill="#2A2026" />
        <rect x={712} y={240} width={24} height={26} rx={3} fill="#2A2026" />
        <rect x={716} y={244} width={16} height={16} rx={1} fill="#9FE3FF" />
      </g>
      <Glow id="rs-cy-phone" cx={722} cy={252} r={30} color="#9FE3FF" opacity={0.5} />

      {/* 의자 + 10대 주인공 (분홍 림라이트) */}
      <rect x={388} y={226} width={16} height={100} rx={6} fill="#0E0A0C" />
      <rect x={388} y={318} width={80} height={10} rx={4} fill="#0E0A0C" />
      <path d="M430 328 V352 M404 352 H456" stroke="#0E0A0C" strokeWidth={6} />
      <Person x={432} y={326} s={1.6} pose="sit" fill="#FFA8CE" pack={false} />
      <Person x={429} y={328} s={1.6} pose="sit" fill="#0B0709" pack={false} />

      {/* 전경 — 침대 모서리와 베개 */}
      <path d="M0 382 H250 C270 382 278 392 278 404 V450 H0 Z" fill="#0A0609" />
      <rect x={20} y={362} width={110} height={30} rx={14} fill="#1C1018" />
      <path d="M150 384 C190 396 230 392 262 400" stroke="#FF9CC6" strokeOpacity={0.22} strokeWidth={2} fill="none" />
      <Glow id="rs-cy-pool" cx={560} cy={380} r={170} color="#FF9CC6" opacity={0.16} />
      <path d="M0 384 H250" stroke="#FF9CC6" strokeOpacity={0.18} strokeWidth={2} />

      <Haze id="rs-cy-haze" y={250} h={140} color="#FF9CC6" opacity={0.08} />
      <Vignette id="rs-cy-vig" strength={0.75} />
    </SceneSvg>
  );
}

// ─────────────────────────── stock_floor ───────────────────────────
/** 증권사 객장 — 벽 전체 시세판의 빨강·파랑 빛 아래 어르신들 */
function StockFloor() {
  const r = rng(301);
  const names = ['전기전자', '건설', '철강금속', '화학', '운수창고', '은행', '증권', '음식료', '섬유의복', '유통', '통신', '보험', '기계', '의약품', '종이목재', '서비스'];
  const cells = names.map((n, i) => {
    const up = r() < 0.58;
    const price = Math.round((800 + r() * 9000) / 10) * 10;
    const diff = Math.round((10 + r() * 400) / 5) * 5;
    return { n, up, col: i % 4, row: Math.floor(i / 4), price, diff };
  });
  return (
    <SceneSvg>
      <Sky id="rs-sf-bg" stops={[[0, '#050507'], [0.6, '#0C0B10'], [1, '#07070A']]} />
      {/* 시세 전광판 */}
      <rect x={24} y={34} width={752} height={236} fill="#030304" stroke="#1A1A22" strokeWidth={4} />
      <rect x={32} y={42} width={736} height={28} fill="#0B0B12" />
      <text x={44} y={62} fontSize={16} fontWeight={800} fill="#FFC870">
        업종 시세
      </text>
      <text x={400} y={62} textAnchor="middle" fontSize={16} fontWeight={800} fill={UP}>
        종합 ▲ 12.40
      </text>
      <text x={756} y={62} textAnchor="end" fontSize={15} fontWeight={700} fill="#FFC870">
        14:52
      </text>
      <g className="zs-flicker">
        {cells.map((c) => {
          const x = 44 + c.col * 184;
          const y = 104 + c.row * 44;
          const color = c.up ? UP : DOWN;
          return (
            <g key={c.n}>
              <text x={x} y={y} fontSize={14} fontWeight={700} fill="#E8D6A8" opacity={0.8}>
                {c.n}
              </text>
              <text x={x + 176} y={y} textAnchor="end" fontSize={17} fontWeight={800} fill={color}>
                {`${c.up ? '▲' : '▼'}${c.diff}`}
              </text>
              <text x={x + 116} y={y} textAnchor="end" fontSize={13} fontWeight={700} fill={color} opacity={0.75}>
                {c.price.toLocaleString('ko-KR')}
              </text>
            </g>
          );
        })}
      </g>
      <path d="M32 82 H768" stroke="#1A1A22" strokeWidth={1.5} />

      {/* 전광판 빛 — 빨강 왼쪽, 파랑 오른쪽 */}
      <Glow id="rs-sf-red" cx={220} cy={250} r={300} color={UP} opacity={0.3} />
      <Glow id="rs-sf-blue" cx={600} cy={250} r={280} color={DOWN} opacity={0.28} className="zs-glow" />

      {/* 바닥 */}
      <defs>
        <linearGradient id="rs-sf-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2A1C24" />
          <stop offset="1" stopColor="#060508" />
        </linearGradient>
      </defs>
      <rect x={0} y={300} width={800} height={150} fill="url(#rs-sf-floor)" />
      <Haze id="rs-sf-haze" y={250} h={110} color="#B48AC8" opacity={0.14} />

      {/* 뒷줄 의자 + 어르신 (작고 흐리게) */}
      {[120, 200, 280, 470, 550, 630].map((x, i) => (
        <g key={x}>
          <rect x={x - 8} y={296} width={8} height={30} rx={2} fill="#1A1420" />
          <rect x={x - 8} y={318} width={44} height={6} fill="#1A1420" />
          <Person x={x + 4} y={326} s={0.8} pose="sit" fill={i < 3 ? '#2A1A22' : '#1A1C2C'} pack={false} />
        </g>
      ))}

      {/* 앞줄 의자 + 어르신 (크고 진하게, 림라이트) */}
      {[
        { x: 70, rim: UP },
        { x: 210, rim: UP },
        { x: 520, rim: DOWN },
      ].map(({ x, rim }) => (
        <g key={x}>
          <rect x={x - 14} y={322} width={12} height={52} rx={3} fill="#0A080C" />
          <rect x={x - 14} y={368} width={72} height={9} fill="#0A080C" />
          <path d={`M${x + 20} 377 V420`} stroke="#0A080C" strokeWidth={6} />
          <Person x={x + 1.5} y={376} s={1.32} pose="sit" fill={rim} pack={false} />
          <Person x={x} y={377} s={1.32} pose="sit" fill={PAL.ink} pack={false} />
          <path d={`M${x - 9} ${377 - 1.32 * 70} q10 -8 22 0 l6 2 h-30 Z`} fill={PAL.ink} />
        </g>
      ))}

      {/* 신문 든 어르신 — 서서 전광판을 본다 */}
      <Person x={362} y={432} s={2.0} pose="stand" fill={UP} pack={false} />
      <Person x={359} y={434} s={2.0} pose="stand" fill={PAL.ink} pack={false} />
      <path d="M346 250 q14 -12 30 -2 l8 3 h-40 Z" fill={PAL.ink} />
      <g transform="rotate(-6 404 300)">
        <rect x={378} y={268} width={62} height={70} fill="#D8CDB2" opacity={0.88} />
        <rect x={384} y={275} width={50} height={7} fill="#3A2A1A" opacity={0.65} />
        <path d="M384 292 H434 M384 300 H428 M384 308 H432 M384 316 H422 M384 324 H430" stroke="#3A2A1A" strokeOpacity={0.45} strokeWidth={1.6} />
      </g>
      <rect x={373} y={296} width={12} height={10} rx={4} fill={PAL.ink} />

      <Vignette id="rs-sf-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ─────────────────────────── model_house ───────────────────────────
/** 2006년 모델하우스 — 분양 현수막, 풍선 아치, 오후 햇살 속 긴 줄 */
function ModelHouse() {
  const balloons = Array.from({ length: 17 }, (_, i) => {
    const a = Math.PI - (i / 16) * Math.PI;
    return { cx: 600 + Math.cos(a) * 74, cy: 330 - Math.sin(a) * 84, c: ['#E8423A', '#FFD34E', '#FFF4E0'][i % 3] };
  });
  const queue = [
    { x: 548, y: 336, s: 0.62 }, { x: 526, y: 338, s: 0.64 }, { x: 503, y: 341, s: 0.67 }, { x: 478, y: 344, s: 0.7 },
    { x: 452, y: 348, s: 0.74 }, { x: 424, y: 353, s: 0.78 }, { x: 393, y: 359, s: 0.83 }, { x: 358, y: 366, s: 0.89 },
    { x: 318, y: 374, s: 0.96 }, { x: 272, y: 384, s: 1.04 }, { x: 220, y: 396, s: 1.14 }, { x: 162, y: 410, s: 1.26 },
  ];
  return (
    <SceneSvg>
      <Sky id="rs-mh-sky" stops={[[0, '#6E5A62'], [0.45, '#D99A55'], [0.8, '#F4C77A'], [1, '#F8DC9A']]} />
      <Glow id="rs-mh-sun" cx={170} cy={150} r={260} color="#FFE2A0" opacity={0.85} />

      {/* 원경 — 올라가는 아파트와 타워크레인 */}
      <Skyline base={318} minH={40} maxH={110} seed={62} fill="#B98A5C" />
      <g stroke="#9A6E48" strokeWidth={3} fill="none">
        <path d="M110 318 V150 M60 160 H200 M110 150 L80 160 M110 150 L180 160" />
        <path d="M300 318 V176 M262 184 H372 M300 176 L372 184" />
      </g>
      <Haze id="rs-mh-haze1" y={250} h={90} color="#F8DC9A" opacity={0.5} />

      {/* 모델하우스 건물 */}
      <rect x={380} y={140} width={400} height={200} fill="#2C1C12" />
      <rect x={380} y={132} width={400} height={10} fill="#3E2A1A" />
      <rect x={380} y={256} width={400} height={84} fill="#3A2616" />
      {[400, 460, 680, 740].map((x) => (
        <rect key={x} x={x} y={266} width={40} height={64} fill="#FFD48A" opacity={0.3} />
      ))}
      {/* 대형 현수막 */}
      <rect x={410} y={152} width={350} height={92} fill="#FFF4E0" />
      <rect x={410} y={152} width={350} height={8} fill="#E8423A" />
      <text x={522} y={228} textAnchor="middle" fontSize={68} fontWeight={800} fill="#D0302A" style={{ letterSpacing: '0.08em' }}>
        분양
      </text>
      <text x={690} y={192} textAnchor="middle" fontSize={17} fontWeight={800} fill="#2C1C12">
        푸른마을
      </text>
      <text x={690} y={216} textAnchor="middle" fontSize={15} fontWeight={700} fill="#2C1C12">
        3차 34평형
      </text>
      <text x={690} y={236} textAnchor="middle" fontSize={11} fontWeight={700} fill="#D0302A">
        선착순 계약
      </text>
      {/* 세로 깃발 */}
      {[392, 772].map((x) => (
        <g key={x}>
          <rect x={x - 1.5} y={70} width={3} height={270} fill="#1E140C" />
          <rect x={x + 1.5} y={74} width={20} height={80} fill="#E8423A" />
          <text x={x + 11.5} y={96} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFF4E0">
            오
          </text>
          <text x={x + 11.5} y={114} textAnchor="middle" fontSize={13} fontWeight={800} fill="#FFF4E0">
            픈
          </text>
        </g>
      ))}

      {/* 만국기 줄 */}
      <path d="M394 72 Q582 120 774 72" stroke="#1E140C" strokeWidth={1.5} fill="none" />
      {Array.from({ length: 14 }, (_, i) => {
        const x = 408 + i * 26;
        const t = (x - 394) / 380;
        const y = 72 + 4 * t * (1 - t) * 24;
        return <path key={i} d={`M${x - 7} ${y} L${x + 7} ${y} L${x} ${y + 14} Z`} fill={['#E8423A', '#FFD34E', '#4E8CFF', '#FFF4E0'][i % 4]} />;
      })}

      {/* 입구 + 풍선 아치 */}
      <rect x={566} y={272} width={68} height={68} fill="#FFE2A0" opacity={0.75} />
      <g className="zs-bob">
        {balloons.map((b, i) => (
          <circle key={i} cx={b.cx} cy={b.cy} r={10} fill={b.c} opacity={0.95} />
        ))}
      </g>

      {/* 바닥 */}
      <defs>
        <linearGradient id="rs-mh-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8A5A34" />
          <stop offset="1" stopColor="#2A1A0E" />
        </linearGradient>
      </defs>
      <rect x={0} y={338} width={800} height={112} fill="url(#rs-mh-ground)" />

      {/* 길게 늘어선 줄 — 멀수록 작고 밝게 */}
      {queue.map((q, i) => {
        const t = i / (queue.length - 1);
        const shade = `rgb(${Math.round(92 - t * 80)}, ${Math.round(60 - t * 52)}, ${Math.round(38 - t * 32)})`;
        return <Person key={i} x={q.x} y={q.y} s={q.s} pose={i === 6 ? 'cheer' : i % 4 === 1 ? 'walk' : 'stand'} fill={shade} pack={i % 3 === 0} />;
      })}
      {/* 앞쪽 — 엄마 손 잡은 열세 살 주인공 */}
      <Person x={70} y={446} s={1.55} pose="stand" fill="#FFC870" pack={false} />
      <Person x={67} y={448} s={1.55} pose="stand" fill="#140C08" pack={false} />
      <Kid x={112} y={446} s={1.55} pose="stand" fill="#FFC870" />
      <Kid x={109} y={448} s={1.55} pose="stand" fill={PAL.ink} />
      <path d="M84 383 Q94 392 102 404" stroke="#140C08" strokeWidth={5} fill="none" strokeLinecap="round" />

      <Haze id="rs-mh-haze2" y={320} h={100} color="#FFD48A" opacity={0.22} />
      <Vignette id="rs-mh-vig" strength={0.55} />
    </SceneSvg>
  );
}

// ─────────────────────────── yeouido_crash ───────────────────────────
/** 2008년 가을 밤 여의도 — 빌딩 전광판의 파란 숫자, 넥타이 푼 직장인, 낙엽 */
function YeouidoCrash() {
  const r = rng(808);
  const leaves = Array.from({ length: 16 }, () => ({ x: 20 + r() * 760, y: 40 + r() * 380, a: r() * 180, s: 0.7 + r() * 0.8 }));
  return (
    <SceneSvg>
      <Sky id="rs-yc-sky" stops={[[0, '#03060E'], [0.6, '#0A1830'], [1, '#12284A']]} />
      <Skyline base={330} minH={120} maxH={260} seed={2008} fill="#0C1A30" win="#7FA8E0" litRatio={0.06} />
      <Haze id="rs-yc-haze1" y={230} h={120} color="#3D6AB0" opacity={0.3} />

      {/* 전광판 빌딩 */}
      <rect x={150} y={20} width={400} height={330} fill="#060B16" />
      <rect x={172} y={60} width={356} height={200} fill="#02050C" />
      <Glow id="rs-yc-board" cx={350} cy={170} r={300} color={DOWN} opacity={0.5} className="zs-glow" />
      <rect x={178} y={66} width={344} height={30} fill="#0A1A3A" />
      <text x={190} y={88} fontSize={17} fontWeight={800} fill="#DDE8FF">
        종합주가지수
      </text>
      <text x={512} y={88} textAnchor="end" fontSize={14} fontWeight={700} fill="#DDE8FF" opacity={0.8}>
        10.24
      </text>
      <text x={190} y={150} fontSize={50} fontWeight={800} fill={DOWN}>
        938.75
      </text>
      <text x={190} y={184} fontSize={22} fontWeight={800} fill={DOWN}>
        ▼ 110.96
      </text>
      <text x={190} y={210} fontSize={18} fontWeight={800} fill={DOWN} opacity={0.85}>
        -10.57%
      </text>
      <path d="M380 110 L402 120 L420 116 L440 140 L456 150 L470 190 L486 184 L500 236 L516 248" stroke={DOWN} strokeWidth={4} fill="none" strokeLinejoin="round" />
      <path d="M380 110 L380 248 M380 248 H516" stroke="#2A3A5A" strokeWidth={1.5} />
      <text x={350} y={250} textAnchor="middle" fontSize={11} fontWeight={700} fill="#8FB0E8" opacity={0.7}>
        1000선 붕괴
      </text>

      {/* 오른쪽 빌딩 — 꺼져가는 창 */}
      <ApartmentBlock x={600} y={350} w={180} h={300} floors={22} cols={8} fill="#08111F" seed={24} litRatio={0.1} win="#8FB8F0" line="rgba(143,184,240,0.06)" />

      {/* 거리 */}
      <defs>
        <linearGradient id="rs-yc-road" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#15284A" />
          <stop offset="1" stopColor="#03060C" />
        </linearGradient>
      </defs>
      <rect x={0} y={348} width={800} height={102} fill="url(#rs-yc-road)" />
      <path d="M0 352 H800" stroke="#4E8CFF" strokeOpacity={0.35} strokeWidth={2} />
      <Tree x={70} y={352} s={1.3} fill="#050A14" />
      <Tree x={520} y={352} s={1.1} fill="#060C18" />
      <Lamp x={120} y={352} h={170} lit color="#CFE0FF" fill="#050A14" />

      {/* 퇴근길 행인들 — 작게, 흐리게 */}
      <Person x={260} y={358} s={0.6} pose="walk" fill="#0C1830" pack={false} />
      <Person x={300} y={360} s={0.64} pose="walk" fill="#0A1528" pack={false} flip />
      <Person x={440} y={362} s={0.7} pose="stand" fill="#0A1426" pack={false} />

      {/* 넥타이 푼 채 멍하니 선 직장인 — 파란 림라이트 */}
      <Person x={612} y={440} s={2.3} pose="stand" fill="#6FA0FF" pack={false} flip />
      <Person x={616} y={442} s={2.3} pose="stand" fill="#03050A" pack={false} flip />
      <path d="M607 270 L615 278 L612 300 L615 324" stroke="#3E63AA" strokeWidth={5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={574} y={346} width={32} height={26} rx={3} fill="#03050A" stroke="#6FA0FF" strokeOpacity={0.7} strokeWidth={1.5} />
      <path d="M584 346 V340 H596 V346" stroke="#03050A" strokeWidth={3} fill="none" />

      {/* 떨어지는 은행잎 */}
      <g className="zs-drift">
        {leaves.map((l, i) => (
          <ellipse key={i} cx={l.x} cy={l.y} rx={5 * l.s} ry={2.6 * l.s} fill="#D8A63C" opacity={0.75} transform={`rotate(${l.a.toFixed(0)} ${l.x.toFixed(1)} ${l.y.toFixed(1)})`} />
        ))}
      </g>

      <Haze id="rs-yc-haze2" y={330} h={110} color="#4E8CFF" opacity={0.12} />
      <Vignette id="rs-yc-vig" strength={0.8} />
    </SceneSvg>
  );
}

export const sceneGroupB: Record<string, ComponentType> = {
  cyworld_room: CyworldRoom,
  stock_floor: StockFloor,
  model_house: ModelHouse,
  yeouido_crash: YeouidoCrash,
};
