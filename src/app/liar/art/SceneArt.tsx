import type { ReactNode } from 'react';
import type { ArtId } from '@/lib/liar/types';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg className="lr-scene-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    {children}
  </svg>
);

const Room = ({ wall, floor, line = 170 }: { wall: string; floor: string; line?: number }) => (
  <>
    <rect width="400" height="240" fill={wall} />
    <rect y={line} width="400" height={240 - line} fill={floor} />
  </>
);

const Light = ({ x, w = 110, y = 12 }: { x: number; w?: number; y?: number }) => (
  <g className="lr-flicker">
    <path d={`M${x} ${y + 6}L${x - 34} 190H${x + w + 34}L${x + w} ${y + 6}z`} fill="#f7f7de" opacity="0.1" />
    <rect x={x} y={y} width={w} height="7" rx="2" fill="#fbfbe8" />
  </g>
);

const Monitor = ({ x, y, glow = '#9dc2d8' }: { x: number; y: number; glow?: string }) => (
  <g>
    <rect x={x} y={y} width="62" height="42" rx="3" fill="#20242a" />
    <rect className="lr-screen" x={x + 4} y={y + 4} width="54" height="33" fill={glow} />
    <rect x={x + 26} y={y + 42} width="10" height="9" fill="#20242a" />
    <rect x={x + 15} y={y + 50} width="32" height="4" rx="2" fill="#20242a" />
  </g>
);

const Steam = ({ x, y }: { x: number; y: number }) => (
  <g fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round">
    <path className="lr-steam" d={`M${x} ${y}q-6-9 0-17q6-9 0-17`} />
    <path className="lr-steam lr-d2" d={`M${x + 11} ${y}q-6-9 0-17q6-9 0-17`} />
  </g>
);

function Hoesik() {
  return (
    <Svg>
      <Room wall="#6e3c24" floor="#3a2118" line={150} />
      <rect x="24" y="44" width="104" height="58" fill="#f3e6c6" />
      <g fill="#8c2f22" fontSize="14" fontWeight="800" fontFamily="serif">
        <text x="34" y="67">삼겹살 1인분</text>
        <text x="34" y="89">소주 5,000원</text>
      </g>
      <g className="lr-sway">
        <path d="M284 0v30" stroke="#2a2a2a" strokeWidth="5" />
        <path d="M264 30h40l22 56h-84z" fill="#a9acae" />
        <path d="M242 86h84v7h-84z" fill="#7d8285" />
      </g>
      <circle cx="94" cy="118" r="3" fill="#ffd77a" className="lr-glow" />
      <rect x="0" y="176" width="400" height="64" fill="#7a5233" />
      <rect x="0" y="176" width="400" height="7" fill="#94673f" />
      <ellipse cx="284" cy="178" rx="72" ry="14" fill="#1f1d1d" />
      <ellipse cx="284" cy="174" rx="62" ry="11" fill="#47413e" />
      <g fill="#c86a4e" stroke="#7d3421" strokeWidth="2">
        <rect x="248" y="166" width="30" height="10" rx="3" transform="rotate(-6 248 166)" />
        <rect x="288" y="168" width="30" height="10" rx="3" transform="rotate(5 288 168)" />
      </g>
      <ellipse cx="284" cy="178" rx="44" ry="6" fill="#ff7b31" opacity="0.28" className="lr-glow" />
      <g className="lr-smoke">
        <circle cx="262" cy="150" r="14" fill="#fff" opacity="0.22" />
        <circle cx="296" cy="136" r="19" fill="#fff" opacity="0.18" />
        <circle cx="276" cy="112" r="16" fill="#fff" opacity="0.14" />
      </g>
      <g>
        <rect x="46" y="134" width="18" height="46" rx="4" fill="#3d8a58" />
        <rect x="51" y="118" width="8" height="18" fill="#3d8a58" />
        <rect x="50" y="146" width="10" height="20" fill="#e9f0dd" />
        <path d="M86 160h20l-3 21H89z" fill="#dfeee9" opacity="0.8" />
        <path d="M88 168h16l-1 12H90z" fill="#fff" opacity="0.7" />
      </g>
    </Svg>
  );
}

function Office() {
  return (
    <Svg>
      <Room wall="#c8cdc9" floor="#7f8681" line={168} />
      <Light x={46} />
      <Light x={244} />
      <rect x="304" y="44" width="70" height="72" fill="#f5f4ec" stroke="#858b86" strokeWidth="3" />
      <text x="339" y="66" textAnchor="middle" fontSize="11" fill="#b43229" fontWeight="800">
        월요일
      </text>
      <text x="339" y="100" textAnchor="middle" fontSize="30" fill="#32373b" fontWeight="800">
        8:52
      </text>
      <g fill="#9ba39d">
        <rect x="0" y="108" width="132" height="68" />
        <rect x="134" y="108" width="132" height="68" />
      </g>
      <rect y="170" width="400" height="9" fill="#62483a" />
      <Monitor x={36} y={118} />
      <Monitor x={170} y={118} glow="#c4d1b4" />
      <g transform="translate(286 150)">
        <rect width="20" height="24" rx="3" fill="#f4f1e6" />
        <path d="M20 6h7v10h-7" fill="none" stroke="#f4f1e6" strokeWidth="4" />
      </g>
      <Steam x={292} y={145} />
      <g fill="#f4f1e6">
        <rect x="118" y="146" width="36" height="28" />
        <rect x="122" y="139" width="36" height="28" fill="#e6e1d0" />
      </g>
    </Svg>
  );
}

function Excel() {
  const cols = [30, 90, 150, 210, 270, 330];
  const rows = [46, 70, 94, 118, 142, 166, 190];
  return (
    <Svg>
      <rect width="400" height="240" fill="#f8f9f6" />
      <rect width="400" height="30" fill="#1c6b41" />
      <text x="14" y="21" fontSize="14" fontWeight="700" fill="#fff">
        정산_최종_(수정).xlsx
      </text>
      <g stroke="#cfd6d0" strokeWidth="1">
        {cols.map((x) => (
          <path key={x} d={`M${x} 30v210`} />
        ))}
        {rows.map((y) => (
          <path key={y} d={`M0 ${y}h400`} />
        ))}
      </g>
      <g fontSize="13" fontWeight="700" fontFamily="monospace">
        <text className="lr-pop" x="38" y="64" fill="#333">
          1,204
        </text>
        <text className="lr-pop lr-d1" x="98" y="88" fill="#c62f26">
          #REF!
        </text>
        <text className="lr-pop lr-d2" x="158" y="64" fill="#c62f26">
          #N/A
        </text>
        <text className="lr-pop lr-d3" x="218" y="112" fill="#c62f26">
          #VALUE!
        </text>
        <text className="lr-pop lr-d1" x="278" y="136" fill="#c62f26">
          #REF!
        </text>
        <text className="lr-pop lr-d2" x="98" y="160" fill="#c62f26">
          #DIV/0!
        </text>
        <text className="lr-pop lr-d3" x="218" y="184" fill="#c62f26">
          #####
        </text>
      </g>
      <rect className="lr-cell" x="150" y="94" width="60" height="24" fill="none" stroke="#1c6b41" strokeWidth="3" />
    </Svg>
  );
}

function Phone() {
  return (
    <Svg>
      <rect width="400" height="240" fill="#2a3038" />
      <g className="lr-tremble">
        <rect x="104" y="8" width="192" height="300" rx="20" fill="#0f1114" />
        <rect x="112" y="18" width="176" height="290" rx="10" fill="#a5bfd6" />
        <rect x="112" y="18" width="176" height="26" fill="#94afc7" />
        <text x="200" y="36" textAnchor="middle" fontSize="11" fontWeight="700" fill="#26313b">
          영업2팀 (7)
        </text>
        <rect x="122" y="54" width="102" height="28" rx="8" fill="#fff" />
        <text x="130" y="72" fontSize="10" fill="#333">
          이번 주 주간 보고 부탁
        </text>
        <rect className="lr-send" x="146" y="102" width="134" height="56" rx="8" fill="#ffe34f" />
        <text className="lr-send" x="154" y="122" fontSize="10.5" fontWeight="700" fill="#2b2b22">
          부장님 오늘도 아들
        </text>
        <text className="lr-send" x="154" y="140" fontSize="10.5" fontWeight="700" fill="#2b2b22">
          서울대 얘기함. 네 번째
        </text>
        <text className="lr-blink" x="130" y="154" fontSize="11" fontWeight="800" fill="#d9b92c">
          5
        </text>
        <rect x="122" y="178" width="60" height="20" rx="8" fill="#fff" />
        <circle className="lr-dot" cx="138" cy="188" r="3" fill="#777" />
        <circle className="lr-dot lr-d1" cx="151" cy="188" r="3" fill="#777" />
        <circle className="lr-dot lr-d2" cx="164" cy="188" r="3" fill="#777" />
      </g>
    </Svg>
  );
}

function Groupware() {
  return (
    <Svg>
      <rect width="400" height="240" fill="#e7e9ec" />
      <rect width="400" height="32" fill="#23395f" />
      <text x="14" y="21" fontSize="13" fontWeight="700" fill="#fff">
        무궁상사 전자결재
      </text>
      <rect x="40" y="48" width="320" height="170" fill="#fff" stroke="#b9bfc8" />
      <text x="56" y="76" fontSize="15" fontWeight="800" fill="#25303e">
        휴가 신청서
      </text>
      <g fontSize="12" fill="#4a5462">
        <text x="56" y="106">
          종류
        </text>
        <text x="120" y="106" fontWeight="700">
          연차 (1일)
        </text>
        <text x="56" y="134">
          일자
        </text>
        <text x="120" y="134" fontWeight="700">
          금요일
        </text>
        <text x="56" y="162">
          사유
        </text>
      </g>
      <rect x="116" y="148" width="226" height="24" fill="#fbf6d6" stroke="#b9a94b" />
      <rect className="lr-caret" x="124" y="152" width="2" height="16" fill="#25303e" />
      <rect x="278" y="186" width="64" height="24" rx="3" fill="#b23a32" />
      <text x="310" y="203" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
        상신
      </text>
      <g className="lr-cursor">
        <path d="M300 118l0 26 7-6 5 12 6-3-5-12 9-1z" fill="#111" stroke="#fff" strokeWidth="1.5" />
      </g>
    </Svg>
  );
}

function Mountain() {
  return (
    <Svg>
      <defs>
        <linearGradient id="lr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc6df" />
          <stop offset="1" stopColor="#e9e3c7" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#lr-sky)" />
      <g className="lr-drift" fill="#fff" opacity="0.8">
        <ellipse cx="74" cy="42" rx="34" ry="10" />
        <ellipse cx="312" cy="30" rx="44" ry="11" />
      </g>
      <path d="M0 170L90 74l58 58 72-102 104 118 76-44v136H0z" fill="#6d8b64" />
      <path d="M0 200L112 124l74 44 90-52 124 76v48H0z" fill="#b8693a" />
      <path d="M0 226l130-40 110 22 160-30v62H0z" fill="#8c4f2b" />
      <g transform="translate(244 112)">
        <path d="M0 0v62" stroke="#3b3128" strokeWidth="3" />
        <path className="lr-flag" d="M1 2h52v30H1z" fill="#c8352b" />
        <text x="27" y="22" textAnchor="middle" fontSize="13" fontWeight="800" fill="#fff">
          1조
        </text>
      </g>
      <g className="lr-climb" fill="none" stroke="#1f2329" strokeLinecap="round">
        <circle cx="242" cy="164" r="8" fill="#f0c9a6" strokeWidth="0" />
        <path d="M242 172l-6 22M236 194l-8 14M236 194l8 14M238 180l8-8" strokeWidth="5" />
      </g>
      <path className="lr-sweat" d="M254 158q4 5 0 8q-4-3 0-8z" fill="#5fb0d8" />
    </Svg>
  );
}

function Wedding() {
  return (
    <Svg>
      <Room wall="#efe4dd" floor="#c79a93" line={172} />
      <g fill="#fbfaf4">
        <path d="M46 172V58q44-50 88 0v114z" opacity="0.9" />
        <path d="M268 172V58q44-50 88 0v114z" opacity="0.9" />
      </g>
      <g fill="#e78fa3" className="lr-sway">
        <circle cx="90" cy="48" r="9" />
        <circle cx="72" cy="58" r="7" />
        <circle cx="108" cy="58" r="7" />
        <circle cx="312" cy="48" r="9" />
        <circle cx="294" cy="58" r="7" />
        <circle cx="330" cy="58" r="7" />
      </g>
      <rect x="110" y="176" width="180" height="64" fill="#f7f4ea" />
      <rect x="124" y="150" width="152" height="80" rx="3" fill="#fbfbf7" stroke="#caa" className="lr-float" />
      <text x="200" y="185" textAnchor="middle" fontSize="19" fontWeight="800" fill="#282424" fontFamily="serif">
        祝 結婚
      </text>
      <text x="200" y="212" textAnchor="middle" fontSize="11" fill="#666">
        5만 원? 10만 원?
      </text>
    </Svg>
  );
}

function Meeting() {
  return (
    <Svg>
      <Room wall="#3c424c" floor="#2a2d33" line={176} />
      <rect x="86" y="18" width="228" height="116" fill="#eef1f3" />
      <rect x="100" y="30" width="200" height="16" fill="#23395f" />
      <g className="lr-bars">
        <rect x="118" y="100" width="28" height="24" fill="#6d94b6" />
        <rect x="160" y="86" width="28" height="38" fill="#6d94b6" />
        <rect x="202" y="72" width="28" height="52" fill="#6d94b6" />
        <rect x="244" y="54" width="28" height="70" fill="#c8352b" />
      </g>
      <path className="lr-flicker" d="M200 240L86 134h228z" fill="#fff" opacity="0.06" />
      <rect x="20" y="186" width="360" height="54" rx="6" fill="#664a35" />
      <rect x="20" y="186" width="360" height="7" fill="#7e5d43" />
      <rect x="182" y="170" width="36" height="20" rx="3" fill="#191b1f" />
      <circle className="lr-blink" cx="200" cy="180" r="3" fill="#7fe08a" />
      <g fill="#f4f1e6">
        <rect x="64" y="194" width="52" height="30" />
        <rect x="286" y="194" width="52" height="30" />
      </g>
    </Svg>
  );
}

function Hr() {
  return (
    <Svg>
      <Room wall="#59626a" floor="#30353b" line={162} />
      <g className="lr-flicker">
        <path d="M200 0L110 170h180z" fill="#fff5c4" opacity="0.14" />
      </g>
      <rect x="28" y="28" width="74" height="140" fill="#3f474e" />
      <g fill="#83888a">
        <rect x="36" y="38" width="58" height="36" />
        <rect x="36" y="82" width="58" height="36" />
        <rect x="36" y="126" width="58" height="36" />
      </g>
      <g fill="#30353a">
        <rect x="56" y="52" width="18" height="5" />
        <rect x="56" y="96" width="18" height="5" />
        <rect x="56" y="140" width="18" height="5" />
      </g>
      <rect x="298" y="30" width="80" height="58" fill="#e7e2cf" />
      <text x="338" y="56" textAnchor="middle" fontSize="11" fill="#333" fontWeight="700">
        경조 기록
      </text>
      <text x="338" y="76" textAnchor="middle" fontSize="11" fill="#b43229" fontWeight="800">
        열람 중
      </text>
      <rect x="20" y="182" width="360" height="58" fill="#55392a" />
      <rect x="20" y="182" width="360" height="7" fill="#6f4c38" />
      <g className="lr-float">
        <rect x="150" y="168" width="100" height="18" fill="#f6f1e2" />
        <rect x="158" y="160" width="100" height="18" fill="#ebe3cf" />
      </g>
    </Svg>
  );
}

function Lobby() {
  return (
    <Svg>
      <Room wall="#d7d2c5" floor="#9d9486" line={178} />
      <rect x="130" y="34" width="140" height="144" fill="#8fb4c5" />
      <rect x="130" y="34" width="140" height="144" fill="none" stroke="#464a4c" strokeWidth="6" />
      <g className="lr-door">
        <rect x="197" y="34" width="6" height="144" fill="#464a4c" />
        <rect x="130" y="102" width="140" height="6" fill="#464a4c" />
      </g>
      <rect x="20" y="20" width="92" height="30" fill="#23395f" />
      <text x="66" y="41" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="serif">
        무궁상사
      </text>
      <rect x="296" y="132" width="88" height="46" fill="#775338" />
      <rect x="296" y="126" width="88" height="8" fill="#916949" />
      <rect x="320" y="104" width="38" height="22" fill="#20242a" />
      <g fill="#527a50">
        <path d="M56 178V112q-14-10-22-26q18 2 22 18q4-18 24-24q-8 18-24 28z" />
      </g>
      <rect x="44" y="164" width="24" height="16" fill="#6d4a33" />
    </Svg>
  );
}

function Receipt() {
  return (
    <Svg>
      <rect width="400" height="240" fill="#403a35" />
      <rect y="0" width="400" height="60" fill="#524a43" />
      <g className="lr-float">
        <path d="M112 16h176v206l-14 10-14-10-15 10-14-10-15 10-15-10-14 10-15-10-14 10-14-10-14 10-18-10z" fill="#f8f5e8" />
        <g fontFamily="monospace" fill="#2c2c28">
          <text x="200" y="44" textAnchor="middle" fontSize="15" fontWeight="800">
            왕곱창 본점
          </text>
          <path d="M128 54h144" stroke="#2c2c28" strokeDasharray="4 3" />
          <text x="128" y="74" fontSize="11">
            토요일 23:04
          </text>
          <text x="128" y="98" fontSize="12">
            곱창 2인분
          </text>
          <text x="272" y="98" textAnchor="end" fontSize="12">
            58,000
          </text>
          <text x="128" y="118" fontSize="12">
            소주 3병
          </text>
          <text x="272" y="118" textAnchor="end" fontSize="12">
            24,000
          </text>
          <path d="M128 130h144" stroke="#2c2c28" strokeDasharray="4 3" />
          <text x="128" y="152" fontSize="13" fontWeight="800">
            합계
          </text>
          <text x="272" y="152" textAnchor="end" fontSize="13" fontWeight="800">
            82,000
          </text>
          <text x="128" y="178" fontSize="11">
            법인카드 ****-1042
          </text>
        </g>
        <ellipse className="lr-circle" cx="200" cy="174" rx="82" ry="17" fill="none" stroke="#c8352b" strokeWidth="3" />
      </g>
    </Svg>
  );
}

function Dinner() {
  return (
    <Svg>
      <Room wall="#8d6f4d" floor="#4e3a2a" line={146} />
      <g stroke="#6d5238" strokeWidth="4">
        {[30, 70, 110, 150, 250, 290, 330, 370].map((x) => (
          <path key={x} d={`M${x} 0v146`} />
        ))}
        <path d="M0 40h400M0 92h400" />
      </g>
      <rect x="168" y="20" width="64" height="104" fill="#eee4cb" />
      <path d="M186 110q10-58 28-74M190 78q14-6 28-2M186 96q14-4 20 2" stroke="#3a342c" strokeWidth="3" fill="none" />
      <rect y="170" width="400" height="70" fill="#2f1e15" />
      <rect y="170" width="400" height="7" fill="#472d20" />
      <g>
        <ellipse cx="120" cy="184" rx="30" ry="8" fill="#f2efe4" />
        <ellipse cx="120" cy="182" rx="20" ry="4" fill="#a7482b" />
        <ellipse cx="282" cy="184" rx="30" ry="8" fill="#f2efe4" />
        <ellipse cx="282" cy="182" rx="20" ry="4" fill="#d8b24e" />
        <ellipse cx="200" cy="196" rx="38" ry="10" fill="#26211e" />
        <ellipse cx="200" cy="192" rx="28" ry="6" fill="#8d5a2c" />
      </g>
      <Steam x={194} y={186} />
    </Svg>
  );
}

function Review() {
  return (
    <Svg>
      <Room wall="#2d3644" floor="#1a2029" line={170} />
      <rect x="130" y="20" width="140" height="42" fill="#c9ad66" />
      <text x="200" y="48" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2b2415" fontFamily="serif">
        인사위원회
      </text>
      <rect y="178" width="400" height="62" fill="#4f3324" />
      <rect y="178" width="400" height="7" fill="#6c4733" />
      <g className="lr-float">
        <rect x="130" y="186" width="140" height="44" fill="#f6f2e5" />
        <text x="200" y="206" textAnchor="middle" fontSize="12" fontWeight="700" fill="#333">
          인사 평가서
        </text>
        <circle className="lr-seal" cx="248" cy="212" r="13" fill="none" stroke="#c8352b" strokeWidth="3" />
      </g>
      <g fill="#b9bdc4" opacity="0.4">
        <rect x="24" y="72" width="60" height="96" />
        <rect x="316" y="72" width="60" height="96" />
      </g>
    </Svg>
  );
}

function Box() {
  return (
    <Svg>
      <Room wall="#7c858a" floor="#454b50" line={166} />
      <Light x={150} />
      <rect x="262" y="50" width="88" height="120" fill="#2d3136" />
      <rect x="270" y="58" width="72" height="112" fill="#d9e0e2" />
      <text x="306" y="42" textAnchor="middle" fontSize="12" fontWeight="800" fill="#d4383a">
        EXIT 비상구
      </text>
      <g className="lr-walk">
        <path d="M70 150h100l-8 72H78z" fill="#b48a58" />
        <path d="M70 150l14-10h72l14 10z" fill="#caa06f" />
        <rect x="90" y="118" width="22" height="30" fill="#527a50" />
        <path d="M100 118q-16-14-14-30M102 118q10-14 24-16" stroke="#527a50" strokeWidth="5" fill="none" />
        <rect x="124" y="122" width="26" height="26" fill="#f4f1e6" stroke="#666" />
        <text x="137" y="141" textAnchor="middle" fontSize="11" fontWeight="800" fill="#333">
          명패
        </text>
      </g>
    </Svg>
  );
}

function Dusty() {
  return (
    <Svg>
      <Room wall="#a8aca3" floor="#6c7067" line={166} />
      <Light x={140} />
      <g className="lr-cal" transform="translate(286 34)">
        <rect width="78" height="76" fill="#f3f1e8" stroke="#6e6f68" strokeWidth="2" />
        <rect width="78" height="20" fill="#c8352b" />
        <text x="39" y="56" textAnchor="middle" fontSize="28" fontWeight="800" fill="#2f2f2f">
          N년
        </text>
      </g>
      <rect y="166" width="400" height="12" fill="#5c4333" />
      <Monitor x={84} y={112} glow="#8c9a8e" />
      <rect x="182" y="130" width="94" height="36" fill="#d9d6c7" />
      <rect x="196" y="116" width="66" height="14" fill="#c3c0b1" />
      <text x="229" y="152" textAnchor="middle" fontSize="11" fontWeight="700" fill="#4c4a40">
        터줏대감
      </text>
      <g className="lr-dust" fill="#fff">
        <circle cx="70" cy="60" r="2" />
        <circle cx="150" cy="90" r="2" />
        <circle cx="220" cy="42" r="2" />
        <circle cx="260" cy="88" r="2" />
      </g>
    </Svg>
  );
}

function Promotion() {
  const bits = [40, 88, 132, 182, 236, 284, 334, 372];
  return (
    <Svg>
      <Room wall="#23395f" floor="#16233b" line={170} />
      <g className="lr-rays" fill="#f2d26f" opacity="0.12">
        <path d="M200 120L40 -20h70z" />
        <path d="M200 120L170 -20h60z" />
        <path d="M200 120L290 -20h70z" />
      </g>
      <rect x="110" y="96" width="180" height="62" fill="#3a2517" />
      <rect x="118" y="104" width="164" height="46" fill="#d7b65d" />
      <text x="200" y="136" textAnchor="middle" fontSize="23" fontWeight="800" fill="#2a210f" fontFamily="serif">
        대표이사 김정직
      </text>
      <rect y="158" width="400" height="82" fill="#56392a" />
      <g>
        {bits.map((x, i) => (
          <rect
            key={x}
            className={`lr-confetti lr-d${i % 3}`}
            x={x}
            y={-12}
            width="8"
            height="12"
            fill={['#f2d26f', '#e15a4e', '#7fc7dc'][i % 3]}
          />
        ))}
      </g>
    </Svg>
  );
}

function Gift() {
  return (
    <Svg>
      <Room wall="#d8c9a8" floor="#8b6a45" line={170} />
      <rect x="24" y="24" width="120" height="62" fill="#b23a32" />
      <text x="84" y="50" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="serif">
        추석 선물
      </text>
      <text x="84" y="72" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffe7b5">
        산지 직송 효자 사과
      </text>
      <g className="lr-float">
        {[0, 1, 2].map((row) =>
          [0, 1, 2, 3].map((col) => (
            <g key={`${row}-${col}`} transform={`translate(${52 + col * 76 + (row % 2) * 12} ${172 - row * 40})`}>
              <rect width="70" height="38" fill="#c8a06c" stroke="#8a6a3e" />
              <circle cx="24" cy="19" r="9" fill="#cf3a30" />
              <circle cx="44" cy="19" r="9" fill="#d94b3c" />
            </g>
          )),
        )}
      </g>
    </Svg>
  );
}

function Blind() {
  return (
    <Svg>
      <rect width="400" height="240" fill="#242a33" />
      <g className="lr-tremble">
        <rect x="104" y="8" width="192" height="300" rx="20" fill="#0f1114" />
        <rect x="112" y="18" width="176" height="290" rx="10" fill="#f1f2f4" />
        <rect x="112" y="18" width="176" height="28" fill="#c8352b" />
        <text x="200" y="37" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">
          익명 게시판
        </text>
        <text x="124" y="66" fontSize="10" fill="#8a8f96">
          무궁상사 · 익명 · 방금
        </text>
        <text x="124" y="88" fontSize="12.5" fontWeight="800" fill="#20242a">
          K 팀장 이야기 좀 하자
        </text>
        <rect x="124" y="98" width="150" height="6" fill="#c9ccd1" />
        <rect x="124" y="110" width="130" height="6" fill="#c9ccd1" />
        <rect x="124" y="122" width="142" height="6" fill="#c9ccd1" />
        <text className="lr-blink" x="124" y="152" fontSize="12" fontWeight="800" fill="#c8352b">
          추천 412
        </text>
        <text x="190" y="152" fontSize="12" fill="#6d727a">
          댓글 98
        </text>
        <rect className="lr-send" x="124" y="166" width="150" height="26" rx="6" fill="#fff" stroke="#d5d7da" />
        <text className="lr-send" x="132" y="183" fontSize="10.5" fill="#333">
          ㄴ 혹시 그 할머니 많은 분?
        </text>
      </g>
    </Svg>
  );
}

function Wreath() {
  return (
    <Svg>
      <Room wall="#ece4d2" floor="#a49479" line={176} />
      <rect x="270" y="40" width="96" height="136" fill="#7a5a3a" />
      <rect x="280" y="50" width="76" height="126" fill="#8c6a48" />
      <circle cx="344" cy="116" r="4" fill="#d7b65d" />
      <g className="lr-sway">
        <path d="M150 176l-36 56M150 176l36 56M150 176v60" stroke="#6a533a" strokeWidth="5" />
        <circle cx="150" cy="96" r="72" fill="#f4f3ec" />
        <circle cx="150" cy="96" r="72" fill="none" stroke="#d9d7ca" strokeWidth="14" strokeDasharray="10 8" />
        <circle cx="150" cy="96" r="42" fill="#ece4d2" />
        <rect x="136" y="56" width="28" height="118" fill="#20242a" />
        <text fill="#fff" fontSize="13" fontWeight="800" textAnchor="middle">
          <tspan x="150" y="80">
            삼
          </tspan>
          <tspan x="150" y="100">
            가
          </tspan>
          <tspan x="150" y="120">
            고
          </tspan>
          <tspan x="150" y="140">
            인
          </tspan>
        </text>
      </g>
      <g className="lr-float">
        <rect x="26" y="120" width="70" height="44" rx="4" fill="#fbfbf4" stroke="#b9b3a1" />
        <text x="61" y="139" textAnchor="middle" fontSize="10" fontWeight="800" fill="#333">
          노래교실
        </text>
        <text x="61" y="155" textAnchor="middle" fontSize="10" fill="#b23a32">
          오늘 2시
        </text>
      </g>
    </Svg>
  );
}

function Golf() {
  return (
    <Svg>
      <defs>
        <linearGradient id="lr-golf-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2c9a0" />
          <stop offset="1" stopColor="#d8e6cf" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#lr-golf-sky)" />
      <path d="M0 120q90-46 190-14t210-22v156H0z" fill="#79a76b" />
      <path d="M0 176q120-40 240-10t160-12v86H0z" fill="#5f9456" />
      <g fill="#2f5b3a">
        <path d="M34 130l26-66 26 66zM70 134l22-54 22 54zM108 128l18-44 18 44z" />
      </g>
      <g transform="translate(300 112)">
        <path d="M0 0v58" stroke="#f4f1e6" strokeWidth="3" />
        <path className="lr-flag" d="M2 2h38l-10 11 10 11H2z" fill="#c8352b" />
        <ellipse cx="0" cy="60" rx="20" ry="5" fill="#4a7a43" />
      </g>
      <circle className="lr-ball" cx="170" cy="196" r="5" fill="#fff" />
      <path className="lr-lost" d="M170 196q-70-140-132-66" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="4 6" />
    </Svg>
  );
}

function Board() {
  const seats = [64, 128, 200, 272, 336];
  return (
    <Svg>
      <Room wall="#1d2433" floor="#10151f" line={150} />
      <g fill="#34405a">
        <rect x="30" y="20" width="70" height="100" />
        <rect x="165" y="20" width="70" height="100" />
        <rect x="300" y="20" width="70" height="100" />
      </g>
      <g fill="#6f88ad" opacity="0.5" className="lr-glow">
        <rect x="38" y="28" width="54" height="84" />
        <rect x="173" y="28" width="54" height="84" />
        <rect x="308" y="28" width="54" height="84" />
      </g>
      {seats.map((x) => (
        <g key={x} fill="#0c0f16">
          <circle cx={x} cy="122" r="17" />
          <path d={`M${x - 28} 172q0-34 28-34t28 34z`} />
        </g>
      ))}
      <path d="M0 170h400l-30 70H30z" fill="#4b2f20" />
      <path d="M0 170h400l-3 7H3z" fill="#684530" />
      <g className="lr-float">
        <rect x="150" y="186" width="100" height="42" fill="#f6f2e5" />
        <text x="200" y="204" textAnchor="middle" fontSize="11" fontWeight="800" fill="#b23a32">
          압수
        </text>
        <text x="200" y="220" textAnchor="middle" fontSize="11" fontWeight="700" fill="#333">
          거짓말 장부
        </text>
      </g>
    </Svg>
  );
}

function Chicken() {
  return (
    <Svg>
      <Room wall="#f1c75b" floor="#a8703a" line={178} />
      <rect x="44" y="18" width="312" height="52" rx="4" fill="#c8352b" />
      <text className="lr-glow" x="200" y="55" textAnchor="middle" fontSize="28" fontWeight="800" fill="#fff4cf" fontFamily="serif">
        정직치킨
      </text>
      <rect x="70" y="84" width="110" height="94" fill="#8fb9cc" stroke="#6a4a2a" strokeWidth="5" />
      <path d="M125 84v94M70 130h110" stroke="#6a4a2a" strokeWidth="3" />
      <rect x="232" y="118" width="110" height="60" fill="#b9bcbd" />
      <rect x="244" y="104" width="86" height="16" fill="#8d9091" />
      <g fill="#d38a34">
        <ellipse cx="268" cy="104" rx="14" ry="9" />
        <ellipse cx="300" cy="102" rx="14" ry="9" />
      </g>
      <Steam x={278} y={94} />
      <rect x="216" y="178" width="140" height="62" fill="#7c4e27" />
      <text x="286" y="214" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffe7b5">
        국내산 (진짜)
      </text>
    </Svg>
  );
}

function Jail() {
  const flashes = [60, 340, 110, 290];
  return (
    <Svg>
      <rect width="400" height="240" fill="#14171d" />
      <rect x="60" y="30" width="280" height="150" fill="#2b313c" />
      <text x="200" y="66" textAnchor="middle" fontSize="19" fontWeight="800" fill="#c9cfd8" fontFamily="serif">
        서울중앙지방검찰청
      </text>
      <path d="M150 180h100v60H150z" fill="#1e2026" />
      <circle cx="200" cy="130" r="26" fill="#d8ad88" />
      <path d="M154 182q0-30 46-30t46 30z" fill="#1e2026" />
      <path d="M170 124h60" stroke="#111" strokeWidth="9" />
      <g fill="#20252d">
        <rect x="0" y="196" width="400" height="44" />
      </g>
      {flashes.map((x, i) => (
        <circle key={x} className={`lr-flash lr-d${i % 3}`} cx={x} cy={200} r="22" fill="#fff" />
      ))}
      <path d="M126 214h148" stroke="#f4d23c" strokeWidth="6" strokeDasharray="14 8" />
    </Svg>
  );
}

const SCENES: Record<ArtId, () => JSX.Element> = {
  hoesik: Hoesik,
  office: Office,
  excel: Excel,
  phone: Phone,
  groupware: Groupware,
  mountain: Mountain,
  wedding: Wedding,
  meeting: Meeting,
  hr: Hr,
  lobby: Lobby,
  receipt: Receipt,
  dinner: Dinner,
  review: Review,
  box: Box,
  dusty: Dusty,
  promotion: Promotion,
  gift: Gift,
  blind: Blind,
  wreath: Wreath,
  golf: Golf,
  board: Board,
  chicken: Chicken,
  jail: Jail,
};

export function SceneArt({ id }: { id: ArtId }) {
  const Comp = SCENES[id];
  return <Comp />;
}
