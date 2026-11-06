import type { CharId, Mood } from '@/lib/liar/types';

interface Look {
  skin: string;
  suit: string;
  shirt: string;
  tie?: string;
  hair: string;
  glasses?: string;
}

const LOOKS: Record<CharId, Look> = {
  bujang: { skin: '#e8b98f', suit: '#4a4f58', shirt: '#eef0ef', tie: '#b23a32', hair: '#2b2622', glasses: '#26231f' },
  ogwajang: { skin: '#f0c9a6', suit: '#27375a', shirt: '#f4f1ea', hair: '#1c1a1f', glasses: '#8c2f2a' },
  seoyun: { skin: '#f3cfae', suit: '#c9b491', shirt: '#fbf7ec', hair: '#3a2820' },
  insa: { skin: '#e4b48b', suit: '#1e2126', shirt: '#e9ebea', tie: '#3b4656', hair: '#15151a' },
  sangmu: { skin: '#e2ae85', suit: '#2c2a33', shirt: '#f4f1ea', tie: '#7d6420', hair: '#d6d4cf', glasses: '#b08f3c' },
  client: { skin: '#dba67c', suit: '#6a4a33', shirt: '#efe7d6', tie: '#2f5b4f', hair: '#2d2722' },
  junior: { skin: '#f2cca9', suit: '#59708a', shirt: '#59708a', hair: '#32261f' },
  it: { skin: '#eac09c', suit: '#3e4a44', shirt: '#2c3430', hair: '#1f1c1a' },
  chairman: { skin: '#deaa82', suit: '#15171c', shirt: '#f2efe6', tie: '#6b1f22', hair: '#ecebe6', glasses: '#1b1a18' },
  heir: { skin: '#f4d2b2', suit: '#3a3f6b', shirt: '#f7f7f2', hair: '#20191a' },
  director: { skin: '#e9bd98', suit: '#32363d', shirt: '#eaecec', tie: '#44505e', hair: '#5a5550', glasses: '#3a3a3a' },
};

function Hair({ id, color }: { id: CharId; color: string }) {
  switch (id) {
    case 'bujang':
      return <path d="M36 50c-2-16 4-24 9-25M84 50c2-16-4-24-9-25" stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" />;
    case 'ogwajang':
      return <path d="M32 72c-6-34 8-52 28-52s34 18 28 52l-9-3c3-16-3-30-19-32-10 8-20 12-22 32z" fill={color} />;
    case 'seoyun':
      return (
        <g fill={color}>
          <path d="M34 54c-3-24 10-36 26-36s29 12 26 36c-6-14-18-20-26-20s-20 6-26 20z" />
          <path className="lr-sway" d="M84 34c14 4 18 24 10 44-2-14-6-24-14-32z" />
        </g>
      );
    case 'insa':
      return <path d="M35 52c-4-22 9-34 25-34s29 12 25 34c-3-11-9-18-25-18s-22 7-25 18z" fill={color} />;
    case 'sangmu':
      return <path d="M34 52c-5-22 8-34 26-34 19 0 31 12 26 34-5-12-12-17-20-18-12 4-26 4-32 18z" fill={color} />;
    case 'client':
      return <path d="M36 46c-2-18 10-28 24-28s26 10 24 28c-6-8-14-12-24-12s-18 4-24 12z" fill={color} />;
    case 'junior':
      return (
        <g fill={color}>
          <circle cx="40" cy="36" r="10" />
          <circle cx="52" cy="26" r="11" />
          <circle cx="66" cy="25" r="11" />
          <circle cx="79" cy="35" r="10" />
        </g>
      );
    case 'chairman':
      return <path d="M36 44c2-18 12-26 24-26s22 8 24 26c-6-5-14-8-24-8s-18 3-24 8z" fill={color} />;
    case 'heir':
      return <path d="M34 54c-5-24 10-38 28-38 17 0 29 14 24 34-4-9-10-14-16-15-10 7-26 7-36 19z" fill={color} />;
    case 'director':
      return <path d="M35 50c-3-20 9-31 25-31s28 11 25 31c-5-10-13-15-25-15s-20 5-25 15z" fill={color} />;
    case 'it':
      return (
        <g>
          <path d="M35 50c-3-22 9-32 25-32s28 10 25 32c-7-9-15-13-25-13s-18 4-25 13z" fill={color} />
          <path d="M33 56c0-26 12-40 27-40s27 14 27 40" fill="none" stroke="#111614" strokeWidth="4" />
          <rect x="27" y="52" width="9" height="16" rx="4" fill="#111614" />
          <rect x="84" y="52" width="9" height="16" rx="4" fill="#111614" />
        </g>
      );
  }
}

function Mouth({ mood, talking }: { mood: Mood; talking: boolean }) {
  if (talking) return <ellipse className="lr-talk" cx="60" cy="74" rx="6" ry="4" fill="#6d2a25" />;
  if (mood === 'happy') return <path d="M50 71q10 11 20 0z" fill="#6d2a25" />;
  if (mood === 'angry') return <path d="M50 77q10-8 20 0" fill="none" stroke="#5a2420" strokeWidth="3" strokeLinecap="round" />;
  if (mood === 'sus') return <path d="M52 75q8-3 16 2" fill="none" stroke="#5a2420" strokeWidth="3" strokeLinecap="round" />;
  return <path d="M52 74h16" stroke="#5a2420" strokeWidth="3" strokeLinecap="round" />;
}

function Brows({ mood }: { mood: Mood }) {
  const c = '#2a2320';
  if (mood === 'angry')
    return (
      <g stroke={c} strokeWidth="4" strokeLinecap="round">
        <path d="M41 46l14 5" />
        <path d="M79 46l-14 5" />
      </g>
    );
  if (mood === 'sus')
    return (
      <g stroke={c} strokeWidth="4" strokeLinecap="round">
        <path d="M41 49h14" />
        <path d="M65 44l14-3" />
      </g>
    );
  if (mood === 'happy')
    return (
      <g stroke={c} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M41 47q7-5 14 0" />
        <path d="M65 47q7-5 14 0" />
      </g>
    );
  return (
    <g stroke={c} strokeWidth="4" strokeLinecap="round">
      <path d="M42 47h13" />
      <path d="M65 47h13" />
    </g>
  );
}

/** 대사 중인 인물 상반신. 눈 깜빡임과 입 움직임은 CSS로 움직인다. */
export function Person({ id, mood = 'calm', talking = false }: { id: CharId; mood?: Mood; talking?: boolean }) {
  const look = LOOKS[id];
  const happy = mood === 'happy';
  return (
    <svg className={`lr-person lr-mood-${mood}`} viewBox="0 0 120 150" aria-hidden="true">
      {/* 몸 */}
      <path d="M12 150c0-34 18-54 48-54s48 20 48 54z" fill={look.suit} />
      <path d="M46 96l14 26 14-26z" fill={look.shirt} />
      {look.tie ? <path d="M56 104h8l3 28-7 10-7-10z" fill={look.tie} /> : null}
      <path d="M46 96l14 26-9 10-13-30zM74 96l-14 26 9 10 13-30z" fill={look.suit} opacity="0.75" />
      {/* 목과 머리 */}
      <rect x="50" y="80" width="20" height="22" rx="8" fill={look.skin} />
      <rect x="35" y="24" width="50" height="66" rx="24" fill={look.skin} />
      <circle cx="34" cy="58" r="5" fill={look.skin} />
      <circle cx="86" cy="58" r="5" fill={look.skin} />
      <Hair id={id} color={look.hair} />
      {/* 얼굴 */}
      <Brows mood={mood} />
      <g className="lr-eyes">
        {happy ? (
          <g fill="none" stroke="#231e1b" strokeWidth="3.4" strokeLinecap="round">
            <path d="M43 58q5-6 10 0" />
            <path d="M67 58q5-6 10 0" />
          </g>
        ) : (
          <g fill="#231e1b">
            <circle cx="48" cy="57" r={mood === 'sus' ? 3 : 3.6} />
            <circle cx="72" cy="57" r={mood === 'sus' ? 3 : 3.6} />
          </g>
        )}
      </g>
      {look.glasses ? (
        <g fill="none" stroke={look.glasses} strokeWidth="2.6">
          <rect x="38" y="49" width="20" height="16" rx="5" />
          <rect x="62" y="49" width="20" height="16" rx="5" />
          <path d="M58 56h4" />
        </g>
      ) : null}
      {id === 'client' ? <path d="M48 67q6-5 12 0q6-5 12 0q-6 5-12 2q-6 3-12-2z" fill={look.hair} /> : null}
      <path d="M60 60v6" stroke="#b98a67" strokeWidth="2" strokeLinecap="round" />
      <Mouth mood={mood} talking={talking} />
    </svg>
  );
}
