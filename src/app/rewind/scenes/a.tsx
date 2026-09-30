/**
 * 씬 그룹 A — 2000년대 초반 (초1~초3, 복권방). 톤: 세피아·호박 + 브라운관 청광.
 * classroom_2000 · pc_bang · worldcup_2002 · lotto_shop
 */
import type { ComponentType } from 'react';
import { Glow, Haze, Kid, PAL, Person, SceneSvg, Skyline, Sky, Tree, Vignette, rng } from './primitives';

// ───────────── 로컬 도형 ─────────────

/** 교실 나무 책상 + 의자 (정면 약간 위에서). (x, y) = 책상 앞다리 바닥 중앙 */
function Desk({ x, y, s = 1, fill }: { x: number; y: number; s?: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={fill}>
      <rect x={-34} y={-44} width={68} height={7} rx={1.5} />
      <rect x={-30} y={-37} width={60} height={12} />
      <rect x={-31} y={-25} width={3.5} height={25} />
      <rect x={27.5} y={-25} width={3.5} height={25} />
    </g>
  );
}

/** 브라운관 모니터 (정면). 화면엔 추상 전략게임 — 미니맵 + 유닛 점 */
function Crt({ x, y, s = 1, seed, dim = 1 }: { x: number; y: number; s?: number; seed: number; dim?: number }) {
  const r = rng(seed);
  const dots = Array.from({ length: 6 }, (_, i) => (
    <rect key={i} x={-14 + r() * 30} y={-40 + r() * 18} width={2.4} height={2.4} fill={i % 2 ? '#FFD86A' : '#9FE8FF'} />
  ));
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={dim}>
      <rect x={-30} y={-54} width={60} height={50} rx={6} fill="#0C1418" />
      <rect x={-25} y={-49} width={50} height={38} rx={4} fill="#1E5A8C" />
      <rect x={-25} y={-49} width={50} height={9} fill="#3C8AC8" opacity={0.55} />
      <rect x={-23} y={-24} width={13} height={11} fill="#0B2A1C" stroke="#7FE0A0" strokeWidth={0.8} />
      <rect x={-20} y={-21} width={3} height={3} fill="#FF5A4E" />
      <rect x={-15} y={-18} width={2.5} height={2.5} fill="#7FE0A0" />
      {dots}
      <rect x={-9} y={-4} width={18} height={6} fill="#0C1418" />
    </g>
  );
}

/** 불꽃놀이 — 방사선 + 점 */
function Burst({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const n = 14;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    d += `M${(x + Math.cos(a) * r * 0.35).toFixed(1)} ${(y + Math.sin(a) * r * 0.35).toFixed(1)} L${(x + Math.cos(a) * r).toFixed(1)} ${(y + Math.sin(a) * r).toFixed(1)} `;
  }
  return <path d={d} stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.9} />;
}

/** 태극기(단순화). (x, y) = 깃발 왼쪽 위 */
function Flag({ x, y, w }: { x: number; y: number; w: number }) {
  const h = w * (2 / 3);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const R = h / 4;
  const bar = (bx: number, by: number, rot: number) => (
    <g transform={`rotate(${rot} ${bx} ${by})`} fill="#141414">
      <rect x={bx - w * 0.07} y={by - h * 0.09} width={w * 0.14} height={h * 0.045} />
      <rect x={bx - w * 0.07} y={by - h * 0.02} width={w * 0.14} height={h * 0.045} />
      <rect x={bx - w * 0.07} y={by + h * 0.05} width={w * 0.14} height={h * 0.045} />
    </g>
  );
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#F2EDE4" />
      <path d={`M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy} A${R / 2} ${R / 2} 0 0 1 ${cx} ${cy} A${R / 2} ${R / 2} 0 0 0 ${cx - R} ${cy} Z`} fill="#D32A2E" />
      <path d={`M${cx - R} ${cy} A${R} ${R} 0 0 0 ${cx + R} ${cy} A${R / 2} ${R / 2} 0 0 0 ${cx} ${cy} A${R / 2} ${R / 2} 0 0 1 ${cx - R} ${cy} Z`} fill="#1F4DA8" />
      {bar(x + w * 0.17, y + h * 0.2, -56)}
      {bar(x + w * 0.83, y + h * 0.8, -56)}
      {bar(x + w * 0.83, y + h * 0.2, 56)}
      {bar(x + w * 0.17, y + h * 0.8, 56)}
    </g>
  );
}

// ───────────── classroom_2000 ─────────────

function Classroom2000() {
  return (
    <SceneSvg>
      <Sky id="rs-classroom_2000-wall" stops={[[0, '#2E2014'], [0.5, '#5A4026'], [1, '#3A2716']]} />
      <rect x={0} y={318} width={800} height={132} fill="#4A3218" />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M0 ${326 + i * 22} H800`} stroke="#000" strokeOpacity={0.14} />
      ))}

      {/* 창밖 — 흙 운동장과 아침 햇살 */}
      <Sky id="rs-classroom_2000-out" x={24} y={56} w={236} h={190} stops={[[0, '#F8E3B0'], [0.55, '#F0C47C'], [0.56, '#D8A868'], [1, '#C08A50']]} />
      <Tree x={60} y={162} s={0.9} fill="#B08850" />
      <Tree x={214} y={160} s={0.8} fill="#B08850" />
      <path d="M150 190 V168 H206 V190 M150 168 L158 176 H198 L206 168" stroke="#8A6438" strokeWidth={2.4} fill="none" />
      <rect x={96} y={120} width={2} height={70} fill="#8A6438" />
      <rect x={98} y={121} width={16} height={10} fill="#B8423A" opacity={0.8} />
      <Glow id="rs-classroom_2000-sun" cx={150} cy={130} r={260} color="#FFD08A" opacity={0.55} />
      <g fill="#2A1A0E">
        <rect x={16} y={48} width={252} height={10} />
        <rect x={16} y={244} width={252} height={12} />
        <rect x={16} y={48} width={9} height={206} />
        <rect x={259} y={48} width={9} height={206} />
        <rect x={138} y={48} width={8} height={206} />
        <rect x={16} y={146} width={252} height={6} />
      </g>

      {/* 햇살 줄기 */}
      <g className="zs-glow">
        <polygon points="30,60 140,60 470,420 210,440" fill="#FFD89A" opacity={0.1} />
        <polygon points="148,60 262,60 640,410 430,430" fill="#FFD89A" opacity={0.08} />
      </g>

      {/* 칠판 */}
      <rect x={326} y={62} width={400} height={148} fill="#5A3C20" />
      <rect x={334} y={70} width={384} height={132} fill="#1D3526" />
      <rect x={334} y={70} width={384} height={132} fill="url(#rs-classroom_2000-board)" />
      <defs>
        <radialGradient id="rs-classroom_2000-board" cx="0.2" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#FFE0A0" stopOpacity={0.22} />
          <stop offset="1" stopColor="#FFE0A0" stopOpacity={0} />
        </radialGradient>
      </defs>
      <text x={526} y={126} textAnchor="middle" fontSize={34} fontWeight={800} fill="#F1EADA" opacity={0.92}>
        2000년 3월 2일 (목)
      </text>
      <text x={526} y={170} textAnchor="middle" fontSize={20} fontWeight={700} fill="#F6D27A" opacity={0.85}>
        입학을 축하합니다 ♡ 1학년 2반
      </text>
      <rect x={330} y={208} width={392} height={6} fill="#6A4A28" />
      <rect x={380} y={204} width={14} height={4} fill="#F1EADA" />
      <rect x={640} y={204} width={10} height={4} fill="#E8A0A0" />

      {/* 게시판 — 우리 반 그림 */}
      <rect x={738} y={70} width={62} height={140} fill="#6E4A26" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={746 + (i % 2) * 26} y={80 + Math.floor(i / 2) * 44 + (i % 2) * 6} width={22} height={34} fill={['#E9DDC2', '#F0C47C', '#C9D9A8', '#E8B0A0'][i]} opacity={0.7} />
      ))}
      <text x={769} y={200} textAnchor="middle" fontSize={11} fontWeight={800} fill="#F1EADA" opacity={0.7}>
        우리 반
      </text>

      <Haze id="rs-classroom_2000-dust" y={200} h={140} color="#FFD89A" opacity={0.14} />

      {/* 책상 줄 — 뒤→앞 */}
      {[360, 470, 580, 690].map((x) => (
        <Desk key={x} x={x} y={286} s={0.72} fill="#3A2614" />
      ))}
      {[380, 500, 620].map((x, i) => (
        <Kid key={x} x={x - 14} y={276} s={0.72} pose="sit" fill="#20140A" pack={false} flip={i === 1} />
      ))}
      {[300, 450, 600, 750].map((x) => (
        <Desk key={x} x={x} y={338} s={0.95} fill="#24170C" />
      ))}
      <Kid x={432} y={326} s={0.95} pose="sit" fill="#120B06" pack={false} />
      <Kid x={588} y={326} s={0.95} pose="sit" fill="#120B06" pack={false} />

      {/* 주인공 — 책가방 메고 교실 뒤에 선 여덟 살 */}
      <Glow id="rs-classroom_2000-rim" cx={318} cy={350} r={130} color="#FFC870" opacity={0.5} />
      <Kid x={320} y={432} s={2} pose="stand" fill="#0A0604" />
      <path d="M306 318 C300 310 304 300 314 298" stroke="#FFD89A" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Kid x={48} y={470} s={2.4} pose="stand" fill={PAL.ink} flip />
      <Desk x={730} y={480} s={2} fill="#0B0704" />

      <Vignette id="rs-classroom_2000-vig" strength={0.66} />
    </SceneSvg>
  );
}

// ───────────── pc_bang ─────────────

function PcBang() {
  const rowBack = [60, 160, 260, 360, 460, 560, 660, 760];
  const rowMid = [70, 220, 370];
  return (
    <SceneSvg>
      <Sky id="rs-pc_bang-wall" stops={[[0, '#0E0804'], [0.45, '#2A1A0C'], [0.75, '#1A1008'], [1, '#080503']]} />

      {/* 천장 형광등 — 담배연기에 누렇게 뜬 빛 */}
      <g className="zs-flicker">
        {[
          [130, 22, 190],
          [400, 22, 240],
          [670, 22, 190],
        ].map(([x, y, w], i) => (
          <rect key={i} x={x - w / 2} y={y} width={w} height={6} rx={2} fill="#FFE6B8" opacity={0.8} />
        ))}
      </g>
      <Glow id="rs-pc_bang-ceil" cx={400} cy={20} r={380} color="#E8A860" opacity={0.3} />

      {/* 벽 네온 간판 */}
      <Glow id="rs-pc_bang-sign" cx={150} cy={96} r={120} color="#FF6A3A" opacity={0.35} />
      <rect x={62} y={70} width={176} height={46} rx={5} fill="#1A0804" stroke="#FF7A4A" strokeWidth={2} />
      <text x={150} y={102} textAnchor="middle" fontSize={24} fontWeight={800} fill="#FF8A5A">
        24시 PC방
      </text>
      <text x={150} y={138} textAnchor="middle" fontSize={13} fontWeight={700} fill="#FFD89A" opacity={0.75}>
        1시간 1,000원
      </text>

      {/* 뒷줄 모니터 + 뒤통수 */}
      {rowBack.map((x, i) => (
        <Crt key={x} x={x} y={222} s={0.58} seed={10 + i} dim={0.75} />
      ))}
      {rowBack.map((x, i) => (
        <Person key={x} x={x + 2} y={252} s={0.52} pose="sit" pack={false} fill="#140C06" flip={i % 2 === 1} />
      ))}
      <rect x={0} y={236} width={800} height={30} fill="#120A05" />

      <Haze id="rs-pc_bang-smoke1" y={140} h={140} color="#C8965A" opacity={0.28} />

      {/* 가운뎃줄 — 등 돌린 형들 (재떨이 연기) */}
      {rowMid.map((x, i) => (
        <g key={x}>
          <Glow id={`rs-pc_bang-m${i}`} cx={x} cy={262} r={80} color="#5AA8FF" opacity={0.4} />
          <Crt x={x} y={300} s={0.95} seed={30 + i} />
        </g>
      ))}
      <rect x={0} y={296} width={480} height={10} fill="#0C0704" />
      {rowMid.map((x, i) => (
        <g key={x}>
          <Person x={x - 4} y={346} s={0.85} pose="sit" pack={false} fill="#070403" flip={i % 2 === 0} />
          <path d={`M${x - 22} 380 V334 C${x - 22} 325 ${x + 22} 325 ${x + 22} 334 V380 Z`} fill="#050302" />
        </g>
      ))}
      <path d="M252 294 C244 276 262 266 252 246 C244 228 262 216 254 190" stroke="#E8D2B0" strokeOpacity={0.3} strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={253} cy={296} r={2.4} fill="#FF7A4A" />

      <Haze id="rs-pc_bang-smoke2" y={230} h={130} color="#B88A58" opacity={0.26} className="zs-drift" />

      {/* 앞 — 주인공(초등학생)이 브라운관 앞에 앉아 화면을 본다 */}
      <Glow id="rs-pc_bang-front" cx={620} cy={320} r={230} color="#6AB8FF" opacity={0.6} className="zs-glow" />
      <rect x={548} y={392} width={252} height={58} fill="#0A0604" />
      <rect x={548} y={390} width={252} height={4} fill="#5A7A96" opacity={0.7} />
      <Crt x={650} y={396} s={2.4} seed={77} />
      <rect x={556} y={383} width={60} height={8} rx={2} fill="#1C262C" />
      <rect x={440} y={430} width={90} height={20} fill="#050302" />
      <path d="M452 432 L446 330 C446 318 470 316 472 330 L476 432 Z" fill="#0A0604" />
      <g opacity={0.75}>
        <Kid x={505} y={432} s={2.5} pose="sit" pack={false} fill="#8FCBFF" />
      </g>
      <Kid x={502} y={433} s={2.5} pose="sit" pack={false} fill="#030201" />

      {/* 컵라면 */}
      <g>
        <path d="M728 390 L733 352 H781 L786 390 Z" fill="#E9DDC2" />
        <rect x={731} y={348} width={53} height={6} rx={2} fill="#C8322A" />
        <text x={757} y={378} textAnchor="middle" fontSize={10} fontWeight={800} fill="#B8322A">
          컵라면
        </text>
        <path d="M750 344 L768 312" stroke="#EDE6D2" strokeWidth={2.4} strokeLinecap="round" />
      </g>

      <Vignette id="rs-pc_bang-vig" strength={0.75} />
    </SceneSvg>
  );
}

// ───────────── worldcup_2002 ─────────────

function Worldcup2002() {
  const r = rng(2002);
  const back = Array.from({ length: 34 }, (_, i) => ({ x: i * 24 + r() * 10, s: 0.34 + r() * 0.08 }));
  const mid = Array.from({ length: 16 }, (_, i) => ({ x: 10 + i * 52 + r() * 14, s: 0.72 + r() * 0.12 }));
  return (
    <SceneSvg>
      <Sky id="rs-worldcup_2002-sky" stops={[[0, '#12081C'], [0.45, '#4A1424'], [0.75, '#A8341E'], [1, '#2A0808']]} />
      <Skyline base={260} minH={60} maxH={150} seed={21} fill="#1A0A10" win="#FFB060" litRatio={0.06} />

      {/* 폭죽 */}
      <g className="zs-glow">
        <Burst x={150} y={80} r={46} color="#FFD27A" />
        <Burst x={640} y={64} r={56} color="#FFC870" />
        <Burst x={520} y={120} r={30} color="#FF8A5A" />
        <Glow id="rs-worldcup_2002-fw" cx={640} cy={64} r={90} color="#FFC870" opacity={0.35} />
      </g>

      {/* 대형 전광판 */}
      <Glow id="rs-worldcup_2002-screen" cx={400} cy={170} r={300} color="#FF6A3A" opacity={0.5} />
      <rect x={300} y={96} width={200} height={124} fill="#0A0406" />
      <rect x={308} y={104} width={184} height={104} fill="#2E8A4A" />
      <path d="M400 104 V208 M308 156 H492" stroke="#E6F4E0" strokeOpacity={0.5} strokeWidth={1.5} />
      <circle cx={400} cy={156} r={16} stroke="#E6F4E0" strokeOpacity={0.5} strokeWidth={1.5} fill="none" />
      <circle cx={430} cy={146} r={4} fill="#fff" />
      <rect x={308} y={104} width={184} height={20} fill="#0A1A30" opacity={0.85} />
      <text x={400} y={119} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
        대한민국 2 : 1 이탈리아
      </text>
      <rect x={396} y={220} width={8} height={50} fill="#0A0406" />

      <Haze id="rs-worldcup_2002-haze" y={200} h={120} color="#FF4A2A" opacity={0.3} />

      {/* 뒤 군중 — 붉은 물결 */}
      <rect x={0} y={292} width={800} height={160} fill="#3A0A0C" />
      {back.map((p, i) => (
        <Person key={i} x={p.x} y={300} s={p.s} pose={i % 3 ? 'cheer' : 'stand'} pack={false} fill="#5A1014" />
      ))}
      <Flag x={640} y={206} w={60} />
      <rect x={637} y={206} width={3} height={90} fill="#1A0606" />

      <Haze id="rs-worldcup_2002-haze2" y={270} h={80} color="#FF3A2A" opacity={0.28} />

      {/* 가운데 군중 */}
      {mid.map((p, i) => (
        <Person key={i} x={p.x} y={372} s={p.s} pose={i % 4 === 1 ? 'stand' : 'cheer'} pack={false} fill="#2A0508" flip={i % 2 === 0} />
      ))}
      <rect x={470} y={298} width={170} height={30} fill="#C8141C" />
      <text x={555} y={320} textAnchor="middle" fontSize={20} fontWeight={800} fill="#fff">
        대~한민국!
      </text>

      {/* 앞 — 아빠 옆에서 만세하는 아이, 태극기 */}
      <Glow id="rs-worldcup_2002-rim" cx={424} cy={370} r={120} color="#FFB060" opacity={0.45} />
      <rect x={0} y={420} width={800} height={30} fill="#080203" />
      <Person x={120} y={470} s={1.55} pose="cheer" pack={false} fill="#0C0203" />
      <Person x={700} y={470} s={1.6} pose="cheer" pack={false} fill="#0C0203" flip />
      <Person x={470} y={460} s={1.35} pose="stand" pack={false} fill="#090102" />
      <Kid x={420} y={455} s={1.6} pose="cheer" fill="#060101" pack={false} />
      <rect x={222} y={250} width={3} height={200} fill="#0C0203" />
      <Flag x={225} y={250} w={78} />

      <Vignette id="rs-worldcup_2002-vig" strength={0.7} />
    </SceneSvg>
  );
}

// ───────────── lotto_shop ─────────────

function LottoShop() {
  return (
    <SceneSvg>
      <Sky id="rs-lotto_shop-sky" stops={[[0, '#05070C'], [0.6, '#10141C'], [1, '#0A0A0C']]} />
      <rect x={0} y={360} width={800} height={90} fill="#0C0B0A" />

      {/* 골목 양옆 건물 */}
      <path d="M0 0 H170 V360 H0 Z M660 30 H800 V360 H660 Z" fill="#0A0C10" />
      <rect x={30} y={60} width={40} height={30} fill="#FFD48A" opacity={0.35} />
      <rect x={700} y={100} width={36} height={28} fill="#9FD4FF" opacity={0.2} />
      <path d="M0 40 C120 60 170 64 180 64 M0 58 C120 80 170 84 180 84" stroke="#050608" strokeWidth={1.4} fill="none" />

      {/* 가게 건물 */}
      <rect x={180} y={50} width={470} height={310} fill="#15130F" />

      {/* 노란 간판 */}
      <Glow id="rs-lotto_shop-signglow" cx={415} cy={120} r={290} color="#FFC830" opacity={0.5} className="zs-glow" />
      <rect x={220} y={80} width={390} height={86} rx={4} fill="#FFD23A" />
      <rect x={228} y={88} width={374} height={70} rx={3} fill="none" stroke="#C8322A" strokeWidth={2.5} />
      <text x={415} y={144} textAnchor="middle" fontSize={56} fontWeight={800} fill="#B8221E" style={{ letterSpacing: '0.3em' }}>
        복권
      </text>
      <circle cx={264} cy={123} r={18} fill="#C8322A" />
      <text x={264} y={130} textAnchor="middle" fontSize={18} fontWeight={800} fill="#FFD23A">
        ★
      </text>

      {/* 현수막 */}
      <rect x={210} y={176} width={410} height={34} fill="#C8141C" />
      <text x={415} y={200} textAnchor="middle" fontSize={20} fontWeight={800} fill="#FFF2B0">
        1등 당첨 명당 · 1등 7회 배출
      </text>

      {/* 유리문 + 창 — 형광등 실내 */}
      <Glow id="rs-lotto_shop-inside" cx={415} cy={300} r={240} color="#F4F0C8" opacity={0.35} />
      <rect x={220} y={220} width={390} height={140} fill="#E6E8C8" />
      <rect x={220} y={220} width={390} height={140} fill="url(#rs-lotto_shop-in)" />
      <defs>
        <linearGradient id="rs-lotto_shop-in" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
          <stop offset="1" stopColor="#A89A60" stopOpacity={0.6} />
        </linearGradient>
      </defs>
      <rect x={236} y={226} width={120} height={4} fill="#fff" />
      <rect x={470} y={226} width={120} height={4} fill="#fff" />
      {/* 카운터 + 점원 */}
      <rect x={430} y={300} width={170} height={60} fill="#6A5A38" />
      <Person x={520} y={330} s={0.9} pose="stand" pack={false} fill="#3A3424" flip />
      {/* 번호 용지 붙은 창 */}
      <g>
        {Array.from({ length: 3 }, (_, i) => (
          <g key={i} transform={`translate(${244 + i * 36} 256)`}>
            <rect width={30} height={44} fill="#FFF6D8" stroke="#E08A8A" />
            <path d="M4 10 H26 M4 18 H26 M4 26 H26 M4 34 H26" stroke="#E07070" strokeWidth={0.8} />
            <rect x={8} y={14} width={4} height={3} fill="#1A1A1A" />
            <rect x={18} y={22} width={4} height={3} fill="#1A1A1A" />
          </g>
        ))}
        <text x={298} y={249} textAnchor="middle" fontSize={12} fontWeight={800} fill="#8A2A1A">
          자동 · 수동
        </text>
      </g>
      <g fill="#241C10">
        <rect x={214} y={214} width={402} height={7} />
        <rect x={400} y={214} width={8} height={146} />
        <rect x={214} y={214} width={7} height={146} />
        <rect x={610} y={214} width={7} height={146} />
      </g>

      {/* 바닥 빛 반사 */}
      <polygon points="220,360 610,360 720,450 110,450" fill="#FFD23A" opacity={0.12} />
      <ellipse cx={420} cy={410} rx={180} ry={12} fill="#FFD23A" opacity={0.14} />

      <Haze id="rs-lotto_shop-haze" y={300} h={120} color="#FFC830" opacity={0.08} />

      {/* 줄 선 사람들 */}
      <Person x={344} y={368} s={1.05} pose="stand" pack={false} fill="#0A0806" flip />
      <Person x={290} y={384} s={1.2} pose="stand" pack={false} fill="#070504" flip />
      <Person x={220} y={404} s={1.4} pose="walk" pack={false} fill="#050403" flip />
      <Glow id="rs-lotto_shop-rim" cx={180} cy={360} r={110} color="#FFC830" opacity={0.2} />
      <Person x={110} y={440} s={1.75} pose="stand" pack={false} fill={PAL.ink} flip />
      <Kid x={164} y={440} s={1.5} pose="stand" fill={PAL.ink} flip />
      <rect x={712} y={0} width={14} height={440} fill="#050608" />
      <rect x={690} y={60} width={58} height={6} fill="#050608" />
      <path d="M690 64 C600 90 400 96 170 70 M748 64 C770 80 790 84 800 86" stroke="#050608" strokeWidth={1.6} fill="none" />
      <rect x={700} y={170} width={38} height={60} fill="#1A1812" />
      <text x={719} y={196} textAnchor="middle" fontSize={10} fontWeight={800} fill="#FFD23A" opacity={0.6}>
        전단
      </text>

      <Vignette id="rs-lotto_shop-vig" strength={0.78} />
    </SceneSvg>
  );
}

export const sceneGroupA: Record<string, ComponentType> = {
  classroom_2000: Classroom2000,
  pc_bang: PcBang,
  worldcup_2002: Worldcup2002,
  lotto_shop: LottoShop,
};
