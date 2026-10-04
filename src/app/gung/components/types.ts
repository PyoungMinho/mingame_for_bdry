/**
 * 프레젠테이션 전용 타입 — `src/lib/gung`(결정론 엔진)을 import 하지 않는다.
 * `docs/design/gung-design-final.md` §7-3 데이터 구조 "가정"과 구조적으로만 호환되게 맞춘 로컬 타입이며,
 * 실제 사건 본문(`gung-case.md`)은 이 타입에 맞는 값을 나중에 채워 넣는다 — 여기엔 문구를 하드코딩하지 않는다.
 */
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';

// ── 아이콘 키 (§5-21 매핑표) ──────────────────────────────────────────
export type RoleIconKey = 'crown' | 'flower' | 'scroll' | 'pill' | 'key' | 'sword' | 'person';
export type PlaceIconKey = 'bed' | 'pot' | 'flask' | 'trees' | 'hall' | 'door' | 'flame' | 'waves' | 'book' | 'warehouse' | 'pin';

// ── 내 패 섹션 (D3: 칩 고정 — 범인·무고 화면이 픽셀 단위로 동일) ──────────
// 6판 압축(UX 스펙 §2-2 다): 내 패 칩 7 → 6. '말투'는 자기소개에서 읽지 않기로 했으므로(G3) 칩에서 빼고,
// 게임이 끝난 뒤 '모두의 패'에서만 보인다. SectionKey 에는 남겨 둔다(모두의 패·옛 상태 호환).
export type SectionKey = 'identity' | 'profile' | 'secret' | 'night' | 'lies' | 'mission' | 'speech';

export const SECTION_ORDER: readonly SectionKey[] = ['identity', 'profile', 'secret', 'night', 'lies', 'mission'];

export const SECTION_LABEL: Record<SectionKey, string> = {
  identity: '정체',
  profile: '신분',
  secret: '비밀',
  night: '그날 밤',
  lies: '거짓말',
  mission: '미션',
  speech: '말투',
};

export interface NightBeat {
  time: string;
  text: string;
}

/**
 * 라운드 잠금 블록(「R3에 떠오르는 기억」) — '비밀' 섹션 끝 쪽(들)로 그린다.
 * 잠긴 동안엔 lines 가 없다(본문은 이 객체에도 안 들어온다) → lockedHint 만 보인다.
 */
export interface MemoryContent {
  title: string;
  round: number;
  lines?: string[];
  lockedHint?: string;
}

/** RoleCard 본문 — RoleSheet(§7-3)과 구조만 호환. 섹션별로 미리 렌더 가능한 노드/텍스트로 해석되어 들어온다. */
export interface RoleCardContent {
  seatLabel: string; // '3번 자리의 패'
  roleName: string;
  icon: RoleIconKey;
  identity: string; // 범인/무고 문구는 이미 해석되어 들어온다(D3)
  isCulprit?: boolean; // '정체' 섹션이 열렸을 때만 '범인' 도장 표시(§5-8)
  profile: string;
  secret: string;
  night: NightBeat[];
  lies: string[];
  /** 미션 ①②③… — 이전엔 한 문단으로 이어 붙였으나(쪽 나눔 폐지로) 거짓말·말투처럼 항목별로 보인다 */
  mission: string[];
  speech: string[];
  /** 이 폰의 지금 조사 라운드(0 = 조사 전) — 「R2부터」 배지의 '지금 적용' 표시 */
  round?: number;
  /** 라운드 잠금 블록 — '비밀' 섹션 뒤쪽에 붙는다 */
  memories?: MemoryContent[];
}

export function sectionText(content: RoleCardContent, section: SectionKey): { title: string; body?: string; list?: string[]; night?: NightBeat[] } {
  switch (section) {
    case 'identity':
      return { title: SECTION_LABEL.identity, body: content.identity };
    case 'profile':
      return { title: SECTION_LABEL.profile, body: content.profile };
    case 'secret':
      return { title: SECTION_LABEL.secret, body: content.secret };
    case 'night':
      return { title: SECTION_LABEL.night, night: content.night };
    case 'lies':
      return { title: SECTION_LABEL.lies, list: content.lies };
    case 'mission':
      return { title: SECTION_LABEL.mission, list: content.mission };
    case 'speech':
      return { title: SECTION_LABEL.speech, list: content.speech };
  }
}

// ── 용어 풀이 · 시각표(원고 1-5·1-6) ───────────────────────────────────
export interface TermItem {
  term: string; // '부자(附子)·초오(草烏)'
  desc: string;
}

export interface WatchRowView {
  name: string; // '술시'
  hanja: string; // '戌時'
  span: string; // '19~21시'
  parts?: string; // '초≈19시 · 정≈20시 · 말≈20시 반 넘어'
}

// ── 장소 ───────────────────────────────────────────────────────────
export interface PlaceSummary {
  id: string;
  name: string;
  sub?: string;
  icon: PlaceIconKey;
}

// ── 자리(원형 레일 / 그리드) ──────────────────────────────────────────
export type SeatNodeState = 'default' | 'selected' | 'checked' | 'current' | 'done' | 'disabled' | 'absent';

export interface SeatRingItem {
  seat: number;
  label?: string; // intro 이후 역할명(§3 D16)
  state: SeatNodeState;
}

export interface SeatGridItem {
  seat: number;
  roleName?: string;
  icon?: RoleIconKey;
}

// ── 타이머 ────────────────────────────────────────────────────────
export interface IncenseTimerValue {
  remainingMs: number;
  totalMs: number;
  running: boolean;
}

// ── 진행 레일 ─────────────────────────────────────────────────────
export type RailStep = 'prep' | 1 | 2 | 3 | 'defense' | 'vote';
export const RAIL_STEPS: readonly RailStep[] = ['prep', 1, 2, 3, 'defense', 'vote'] as const; // prep 제외 5기둥(§5-3)

// ── 공개 여부 ─────────────────────────────────────────────────────
export type Disclosure = 'undecided' | 'public' | 'private';

// ── 꾹 누르기 — 인터랙션 소유권은 상위 훅(useHoldReveal)에 있다 ───────────
// 이 바인딩 객체는 컴포넌트가 "props 만" 받아 봉인 영역에 그대로 spread 하기 위한 계약이다.
export type SealMode = 'hold' | 'tap';

export interface PressBind {
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp?: (e: PointerEvent<HTMLElement>) => void;
  onPointerCancel?: (e: PointerEvent<HTMLElement>) => void;
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void;
  onLostPointerCapture?: (e: PointerEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  onKeyUp?: (e: KeyboardEvent<HTMLElement>) => void;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void;
}
