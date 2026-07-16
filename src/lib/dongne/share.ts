/**
 * 동네고수 — 공유 텍스트 포매터 (design-final §6 최종 포맷 고정, 방향서 §2 공유 아티팩트 경계)
 *
 * ⚠⚠ 이 모듈은 근접도 색 토큰(`--dn-prox-*` 등 어떤 CSS/디자인 토큰도)을 **절대 import하지 않는다**.
 * 온스크린 색과 공유 텍스트는 코드 레벨에서 물리적으로 분리되어야 한다(필수 가드 #1, 방향서 §2
 * "공유 파일 격리"). 이 파일에 CSS/컴포넌트 import를 추가하지 말 것 — 리뷰 시 이 규칙 위반 여부만
 * 확인해도 트레이드드레스 리스크를 원천 차단할 수 있다.
 *
 * 색블록·색이모지(🟩🟨🟥 등) 사용 금지. 근접도는 숫자 %로만, 방향은 텍스트 화살표로만 표기한다.
 */

import { DIRECTION_ARROW } from './queue';
import type { Guess } from './types';

const NUMBER_EMOJI = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'] as const;

/** v1 URL — 자체 도메인 이전 후 `dongne.kr`로 교체(design-final F12) */
export const SHARE_URL = 'project-orsrw.vercel.app/dongne';

export interface ShareTextInput {
  gameNo: number;
  status: 'won' | 'lost';
  /** 이번 라운드에서 실제로 시도한 추측들(순서대로). 성공 시 마지막 원소가 정답(correct:true). */
  guesses: Guess[];
  /** 공유엔 짧게 "플레이 스트릭"만(design-final F11) */
  streak: number;
}

/**
 * 공유 텍스트 조립 — design-final §6 예시와 바이트 단위로 동일한 포맷을 유지한다.
 *
 * 성공:
 * 동네고수 #123
 * 3/6 🎯
 * 1️⃣ 182km ↗ 41%
 * 2️⃣ 67km ↘ 78%
 * 3️⃣ 정답!
 * 🔥 스트릭 5일
 * ▶ project-orsrw.vercel.app/dongne
 */
export function buildShareText({ gameNo, status, guesses, streak }: ShareTextInput): string {
  const lines: string[] = [];
  lines.push(`동네고수 #${gameNo}`);
  lines.push(status === 'won' ? `${guesses.length}/6 🎯` : '6/6 😢');

  guesses.forEach((g, i) => {
    const num = NUMBER_EMOJI[i] ?? `${i + 1}.`;
    if (g.correct) {
      lines.push(`${num} 정답!`);
      return;
    }
    const arrow = g.direction ? DIRECTION_ARROW[g.direction] : '';
    lines.push(`${num} ${g.distanceKm}km ${arrow} ${g.proximity}%`);
  });

  lines.push(`🔥 스트릭 ${streak}일`);
  lines.push(`▶ ${SHARE_URL}`);
  return lines.join('\n');
}

/** 클립보드 복사 1차(F3: 버튼 라벨 전환 피드백은 UI 컴포넌트 책임) */
export async function copyShareText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function canWebShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Web Share 2차 병행(지원 기기만, F3) — 사용자 취소도 실패로 취급해 조용히 무시 */
export async function webShareText(text: string): Promise<boolean> {
  if (!canWebShare()) return false;
  try {
    await navigator.share({ text });
    return true;
  } catch {
    return false;
  }
}
