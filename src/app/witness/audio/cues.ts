/**
 * 소리 신호(순수 함수) — 게임 상태 → 곡 · 긴장 레이어 · 판정 효과음 · 대사음 음색.
 *
 * 스포일러 규칙(디자인 「소리」 절): 여기 들어오는 값은 전부 '플레이어 화면에 이미 보이는 것'뿐이다.
 *  - 진상(범인 · 깰 수 있는 줄 · 정답 카드)은 입력에 없다. 이 파일은 사건 데이터(CASE)를 import 하지 않는다.
 *  - 증언 곡은 세트 종류(대질 여부 — 대질 진입 연출로 이미 보인다)와 '이번 방문에서 이미 돌파를 봤는지'로만 정한다.
 *  - 대사음은 화자 '종류'(또박이 · 사람 · 나 · 기기)로만 정한다. 용의자 넷은 같은 음색이다.
 *  - 판정음은 판정 종류로만 정하고, 판정이 화면에 뜨는 순간(VerdictFx 의 impact)에만 쏜다.
 * 엔진(engine.ts)은 첫 제스처 뒤에 지연 로딩되므로, 이 파일은 작게 유지한다(타입만 가져온다).
 */
import type { EndingId, Phase, ScreenName, SetKind, Speaker } from '@/lib/witness';

export type TrackId = 'title' | 'investigate' | 'testimony' | 'pursuit' | 'accuse' | 'ending_good' | 'ending_bad' | 'ending_hidden';
export const TRACK_IDS: readonly TrackId[] = ['title', 'investigate', 'testimony', 'pursuit', 'accuse', 'ending_good', 'ending_bad', 'ending_hidden'];

export type SfxId =
  | 'type_ai'
  | 'type_person'
  | 'type_me'
  | 'type_dev'
  | 'tap'
  | 'press'
  | 'present'
  | 'break'
  | 'breakMinor'
  | 'half'
  | 'redirect'
  | 'wrong'
  | 'trustDown'
  | 'star'
  | 'tick'
  | 'pickup'
  | 'unlock'
  | 'siren'
  | 'paper'
  | 'accuse'
  | 'slotOk'
  | 'stamp';
export const SFX_IDS: readonly SfxId[] = [
  'type_ai',
  'type_person',
  'type_me',
  'type_dev',
  'tap',
  'press',
  'present',
  'break',
  'breakMinor',
  'half',
  'redirect',
  'wrong',
  'trustDown',
  'star',
  'tick',
  'pickup',
  'unlock',
  'siren',
  'paper',
  'accuse',
  'slotOk',
  'stamp',
];

/** 지금 화면에 보이는 장면(연출 중이면 잡아 둔 화면 기준) */
export interface Scene {
  /** 저장을 읽기 전(스켈레톤) — 무음 */
  ready: boolean;
  view: 'title' | 'play' | 'ending';
  screen?: ScreenName;
  /** 증언 화면이면 세트 id(같은 세트 안에서만 추격 곡을 이어 간다) */
  setId?: string;
  setKind?: SetKind;
  phase?: Phase;
  actions?: number;
  /** 엔딩 화면이 떠 있을 때만 */
  ending?: EndingId | null;
}

export interface Cue {
  track: TrackId | null;
  /** 남은 행동 ≤ 3 — 지금 곡 위에 심장박동·저음 드론만 더한다(곡 교체 아님) */
  tension: boolean;
}

/** 엔딩 종류 → 엔딩 곡(엔딩 화면에서만 쓴다) */
export function endingTrack(e: EndingId | null | undefined): TrackId {
  if (e === 'hidden') return 'ending_hidden';
  if (e === 'perfect' || e === 'short') return 'ending_good';
  return 'ending_bad';
}

const TENSE_TRACKS: readonly TrackId[] = ['investigate', 'testimony', 'pursuit'];

/**
 * 장면 → 곡. pursuitSet = 이번 방문에서 돌파(화면에 이미 뜬 판정)를 본 증언 세트 id.
 * 인트로 컷은 타이틀 곡, 규칙 카드는 수사 곡, 사이렌은 지목 곡(가장 가까운 곡).
 */
export function cueFor(s: Scene, pursuitSet: string | null = null): Cue {
  if (!s.ready) return { track: null, tension: false };
  if (s.view === 'title') return { track: 'title', tension: false };
  if (s.view === 'ending') return { track: endingTrack(s.ending), tension: false };
  let track: TrackId;
  switch (s.screen) {
    case 'intro':
      track = 'title';
      break;
    case 'testimony':
      track = s.setKind === 'confront' || (!!s.setId && s.setId === pursuitSet) ? 'pursuit' : 'testimony';
      break;
    case 'accuse':
    case 'siren':
      track = 'accuse';
      break;
    case 'ending':
      track = endingTrack(s.ending);
      break;
    default:
      track = 'investigate';
  }
  // 사이렌 뒤(새로운 곳은 끝, 이미 연 곳 재방문)도 긴장 유지 — 허브로 돌아와도 곡이 느슨해지지 않게
  const tension = ((s.phase === 'play' && typeof s.actions === 'number' && s.actions <= 3) || s.phase === 'siren') && TENSE_TRACKS.includes(track);
  return { track, tension };
}

export type VerdictSound = 'BREAK' | 'HALF' | 'REDIRECT' | 'WRONG';

export interface VerdictCue {
  sfx: SfxId;
  /** cut = BGM 정지 → 스팅어 → 정적 → 재진입 · dip = 짧게 덕킹 */
  duck: 'cut' | 'dip' | null;
  /** 뒤따르는 효과음(오답의 신뢰 감소 둔탁음) */
  follow?: SfxId;
  /** 정적 길이(초, cut 일 때) */
  silence?: number;
}

/** 판정 종류 → 소리. 어느 줄·어느 카드였는지는 입력에 없다 */
export function verdictCue(kind: VerdictSound, tier?: 'star' | 'minor', tutorial?: boolean): VerdictCue {
  if (kind === 'BREAK') return tier === 'minor' ? { sfx: 'breakMinor', duck: 'cut', silence: 0.9 } : { sfx: 'break', duck: 'cut', silence: 1.2 };
  if (kind === 'HALF') return { sfx: 'half', duck: null };
  if (kind === 'REDIRECT') return { sfx: 'redirect', duck: null };
  return tutorial ? { sfx: 'wrong', duck: 'dip' } : { sfx: 'wrong', duck: 'dip', follow: 'trustDown' };
}

/** 화자 → 대사음. 내레이션은 소리 없음. 용의자·형사는 같은 '사람' 음색(범인 여부와 무관) */
export function blipFor(who: Speaker): SfxId | null {
  if (who === 'AI') return 'type_ai';
  if (who === 'DEV') return 'type_dev';
  if (who === 'ME') return 'type_me';
  if (who === 'NARR') return null;
  return 'type_person';
}

/** 글자 몇 자마다 대사음 한 번(보통 2자 · 빠름 3자). 즉시는 소리 없음 */
export function blipEvery(speed: 'normal' | 'fast' | 'instant'): number {
  return speed === 'normal' ? 2 : speed === 'fast' ? 3 : 0;
}

/** 설정 단계 → 게인(0=끔 · 1=작게 · 2=보통 · 3=크게) */
export const LEVEL_GAIN: readonly number[] = [0, 0.35, 0.6, 0.9];
export function levelGain(level: number): number {
  return LEVEL_GAIN[Math.max(0, Math.min(3, Math.round(level)))] ?? 0;
}
