'use client';

/**
 * 그림 자리표시(예비) — 최종 아트(src/app/witness/art)가 없을 때 ArtSlot.tsx 가 이 구현으로 되돌아간다.
 * (ArtSlot.tsx 의 한 줄 re-export 를 이 컴포넌트로 바꾸면 된다. 평소에는 쓰이지 않는다.)
 *
 * 계약(최종 아트와 같은 props):
 *  - kind="scene"    art = Location.art 키(living·kitchen·study·utility·roof·guest). viewBox 1500×1000, 부모 크기에 맞춰 채운다.
 *  - kind="portrait" who = Speaker | 'VICTIM'. face = normal|sweat|shock|angry|break. crop='head' 는 원형 아바타용 머리 크롭.
 *                    viewBox 600×800, 표정은 같은 SVG 안에서 전환(재마운트 금지).
 *  - kind="cut"      art = IntroCut.art 키(tower·stair·cop-window·ad-frame·cop-ddobagi·suspects·ddobagi·clock). 4:3.
 *  - kind="ending"   ending = EndingId. 16:10 키아트.
 *
 * 핫스팟 점·비·역광은 이 컴포넌트 밖(SceneView·RainLayer·CharacterStage)에서 얹는다 — 그림은 배경만 그린다.
 * 단색 실루엣 버전이라 읽히는 글자·시신·혈흔은 없다.
 */
import { useId } from 'react';
import type { EndingId, Face, Speaker } from '@/lib/witness';

export type ArtPortraitWho = Speaker | 'VICTIM';

export type ArtProps =
  | { kind: 'scene'; art: string; className?: string }
  | { kind: 'portrait'; who: ArtPortraitWho; face?: Face; crop?: 'bust' | 'head'; className?: string; title?: string }
  | { kind: 'cut'; art: string; className?: string }
  | { kind: 'ending'; ending: EndingId; className?: string };

const WHO_COLOR: Record<string, string> = {
  S1: '#B5BCD6',
  S2: '#FF8FB8',
  S3: '#C5E86C',
  S4: '#E6D9BD',
  COP: '#7CB8FF',
  AI: '#3DE0F7',
  ME: '#EAF1FF',
  VICTIM: '#8392B5',
  NARR: '#8392B5',
  DEV: '#8392B5',
};

const SCENE_HUE: Record<string, [string, string]> = {
  living: ['#0B1426', '#2A1F1A'],
  kitchen: ['#2A2318', '#151B2B'],
  study: ['#141B33', '#2A1F18'],
  utility: ['#10222A', '#18222B'],
  roof: ['#0A0F24', '#1B1636'],
  guest: ['#0F1630', '#10201F'],
  tower: ['#060913', '#0F1C3A'],
  stair: ['#0A0F1C', '#1A1F30'],
  'cop-window': ['#0B1426', '#1B2E52'],
  'ad-frame': ['#14101E', '#2A1030'],
  'cop-ddobagi': ['#0B1426', '#12304A'],
  suspects: ['#0A0F1C', '#1A2540'],
  ddobagi: ['#060913', '#0E2A3A'],
  clock: ['#0A0F1C', '#243256'],
};

function hueFor(key: string): [string, string] {
  return SCENE_HUE[key] ?? ['#0B1020', '#1A2540'];
}

function Dev({ label }: { label: string }) {
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <text x="24" y="976" fill="#8392B5" fontSize="28" opacity="0.5" fontFamily="monospace">
      {`art:${label}`}
    </text>
  );
}

function Scene({ art, className }: { art: string; className?: string }) {
  const gid = useId();
  const [top, bottom] = hueFor(art);
  return (
    <svg className={['wt-art wt-art--scene', className].filter(Boolean).join(' ')} viewBox="0 0 1500 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${gid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={`${gid}-glow`} cx="0.5" cy="0.35" r="0.6">
          <stop offset="0" stopColor="#3DE0F7" stopOpacity="0.16" />
          <stop offset="1" stopColor="#3DE0F7" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1500" height="1000" fill={`url(#${gid}-bg)`} />
      <rect width="1500" height="1000" fill={`url(#${gid}-glow)`} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={120 + i * 270} y="80" width="190" height="330" rx="6" fill="#FFFFFF" opacity="0.04" />
      ))}
      <rect x="0" y="690" width="1500" height="310" fill="#000000" opacity="0.28" />
      <line x1="0" y1="690" x2="1500" y2="690" stroke="#A0C4FF" strokeOpacity="0.18" strokeWidth="3" />
      <Dev label={art} />
    </svg>
  );
}

function Portrait({ who, face = 'normal', crop = 'bust', className, title }: { who: ArtPortraitWho; face?: Face; crop?: 'bust' | 'head'; className?: string; title?: string }) {
  const gid = useId();
  const c = WHO_COLOR[who] ?? '#8392B5';
  const led = face === 'sweat' ? '#FFD23F' : face === 'angry' ? '#FF5A5F' : face === 'shock' || face === 'break' ? '#A98BFF' : '#3DE0F7';
  const vb = crop === 'head' ? '150 100 300 300' : '0 0 600 800';
  const eyeY = 255;
  const mouth =
    face === 'sweat' ? 'M270 330 q30 -10 60 0' : face === 'shock' ? 'M285 325 q15 22 30 0' : face === 'angry' ? 'M268 336 q32 -18 64 0' : face === 'break' ? 'M268 326 q32 22 64 -6' : 'M270 328 q30 14 60 0';
  return (
    <svg className={['wt-art wt-art--portrait', className].filter(Boolean).join(' ')} viewBox={vb} role="img" aria-label={title ?? ''} data-face={face} focusable="false">
      <defs>
        <radialGradient id={`${gid}-g`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor={c} stopOpacity="0.28" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="300" cy="360" rx="280" ry="340" fill={`url(#${gid}-g)`} />
      {who === 'AI' ? (
        <g>
          <rect x="210" y="230" width="180" height="440" rx="70" fill="#1A2540" stroke="#3DE0F7" strokeOpacity="0.4" strokeWidth="4" />
          <ellipse cx="300" cy="520" rx="100" ry="26" fill="none" stroke={led} strokeWidth="14" />
          <ellipse cx="300" cy="260" rx="70" ry="16" fill="#243256" />
        </g>
      ) : (
        <g>
          <path d="M70 800 C70 600 190 530 300 530 C410 530 530 600 530 800 Z" fill={c} opacity="0.55" />
          <rect x="262" y="440" width="76" height="110" rx="30" fill={c} opacity="0.7" />
          <circle cx="300" cy="270" r="112" fill={c} opacity={who === 'VICTIM' ? 0.25 : 0.9} />
          {who !== 'VICTIM' && (
            <g stroke="#0A0F1C" strokeWidth="9" strokeLinecap="round" fill="none">
              <path d={`M246 ${eyeY} h28`} />
              <path d={`M326 ${eyeY} h28`} />
              <path d={mouth} />
            </g>
          )}
          {face === 'sweat' && who !== 'VICTIM' && <path d="M392 190 q14 24 0 40 q-14 -16 0 -40z" fill="#9EDCFF" />}
          {face === 'shock' && who !== 'VICTIM' && <path d="M410 170 l22 -22 M425 200 h30 M410 232 l22 22" stroke="#FFD76A" strokeWidth="8" strokeLinecap="round" />}
          {face === 'angry' && who !== 'VICTIM' && <path d="M236 232 l44 14 M364 232 l-44 14" stroke="#FF5A5F" strokeWidth="9" strokeLinecap="round" />}
        </g>
      )}
    </svg>
  );
}

function Cut({ art, className }: { art: string; className?: string }) {
  return (
    <div className={['wt-art-cut', className].filter(Boolean).join(' ')} data-art={art}>
      <Scene art={art} />
    </div>
  );
}

function Ending({ ending, className }: { ending: EndingId; className?: string }) {
  const key = ending === 'perfect' ? 'living' : ending === 'hidden' ? 'ddobagi' : ending === 'timeout' ? 'cop-window' : ending === 'excluded' ? 'stair' : ending === 'short' ? 'utility' : 'suspects';
  return (
    <div className={['wt-art-ending', className].filter(Boolean).join(' ')} data-ending={ending}>
      <Scene art={key} />
    </div>
  );
}

export function ArtPlaceholder(props: ArtProps) {
  switch (props.kind) {
    case 'scene':
      return <Scene art={props.art} className={props.className} />;
    case 'portrait':
      return <Portrait who={props.who} face={props.face} crop={props.crop} className={props.className} title={props.title} />;
    case 'cut':
      return <Cut art={props.art} className={props.className} />;
    default:
      return <Ending ending={props.ending} className={props.className} />;
  }
}
