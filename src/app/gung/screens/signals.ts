/**
 * 구두 신호표(개선 묶음 1 · G1) — 디자인 스펙 §2-C 구두 신호 지도의 단일 출처.
 *
 * 서버가 없으니 폰끼리의 동기화는 방장 목소리뿐이다. 플레이어 게이트 캡션(「방장이 '…'라고 외치면 누르세요」)과
 * 방장 캡션(「누르고 외치시오: '…'」)이 **같은 함수**에서 문구를 받는다 — 글자 하나라도 다르면 '너 아직 1라운드야?'가 생긴다.
 * 방장 캡션은 그 단계의 **전진 버튼**에만 붙는다. 하위 단계 전진(장소 고르기→토론, 변론 다음 사람, 지목 입력)에는 붙이지 않는다.
 * 문구는 단계로만 정해진다(역할 무관 — 불변 1).
 */
import type { Phase, RoundNo } from '@/lib/gung';

const ROUND_WORD: Record<RoundNo, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };

/** 방장이 외치는 조사 시작 신호 */
export function roundSignal(round: RoundNo): string {
  return `${ROUND_WORD[round]} 조사를 시작하오`;
}

/** 단계 → 그 단계를 끝내며(다음으로 넘어가며) 외치는 신호 */
export const PHASE_SIGNAL: Readonly<Partial<Record<Phase, string>>> = {
  lobby: '사건을 시작하겠소',
  briefing: '각자 자기 패를 몰래 보시오',
  cards: '1번부터 신분을 밝히시오',
  intro: roundSignal(1),
  r1: roundSignal(2),
  r2: roundSignal(3),
  r3: '최종 변론이오',
  defense: '지목하겠소',
  vote: '그날 밤의 진상을 밝히겠소',
  reveal: '범인이 밝혀졌소',
};

/** 플레이어 게이트가 기다리는 신호(없으면 null) */
export function gateSignal(phase: Phase): string | null {
  return PHASE_SIGNAL[phase] ?? null;
}

/**
 * 방장 하위 상태 — 신호가 붙는 전진 버튼인지 가르는 데만 쓴다.
 *  - 조사: 'discuss'(토론 → 다음 조사/변론) 에만. 'select'(장소 고르기 → 토론)는 하위 전진.
 *  - 변론: 'last'(마지막 사람 → 지목) 에만. 'next'(다음 사람)는 하위 전진.
 *  - 지목: 'decided'(판결 확정 → 진상 공개) 에만. 준비·입력·동률 재지목은 하위 단계.
 *  - 진상: 'culprit'(범인 도장 비트) 에만 — G5 플레이어 「범인이 밝혀졌어요」 게이트.
 */
export type HostSignalSub = 'select' | 'discuss' | 'last' | 'next' | 'decided' | 'pending' | 'culprit' | 'beat' | null;

export function hostSignal(phase: Phase, sub: HostSignalSub = null): string | null {
  switch (phase) {
    case 'lobby':
    case 'briefing':
    case 'cards':
    case 'intro':
      return PHASE_SIGNAL[phase] ?? null;
    case 'r1':
    case 'r2':
    case 'r3':
      return sub === 'discuss' ? PHASE_SIGNAL[phase] ?? null : null;
    case 'defense':
      return sub === 'last' ? PHASE_SIGNAL.defense ?? null : null;
    case 'vote':
      return sub === 'decided' ? PHASE_SIGNAL.vote ?? null : null;
    case 'reveal':
      return sub === 'culprit' ? PHASE_SIGNAL.reveal ?? null : null;
    default:
      return null;
  }
}

/** 플레이어 게이트 캡션 고정 문법(§2-C) */
export const gateCaption = (signal: string) => `방장이 '${signal}'라고 외치면 누르세요`;
/** 방장 캡션 문법(G1) */
export const hostCaption = (signal: string) => `누르고 외치시오: '${signal}'`;
/** 방장 전진 토스트(G1) — 신호가 없는 하위 전진은 단계명만 */
export const advanceToast = (label: string, signal: string | null) => (signal ? `넘어갔소 → ${label} · 📣 '${signal}'` : `넘어갔소 → ${label}`);
/** 자기소개 건너뛰기 링크 아래(G1) */
export const SKIP_INTRO_NOTE = `건너뛰면 외치시오: '${roundSignal(1)}' — 모두 두 번 눌러야 하오`;
