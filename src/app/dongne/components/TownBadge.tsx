"use client";

import { Home } from "lucide-react";
import type { GameStatus } from "@/lib/dongne/types";

export interface TownBadgeProps {
  /** "playing"이면 이 컴포넌트는 아무것도 렌더하지 않는다(정답 확정 전 노출 = 정답 유출, §9-2 가드) */
  status: GameStatus;
  /** 사용자가 "우리 동네"를 등록했는지 여부 */
  registered: boolean;
  /**
   * registered=true일 때만 의미 있음 — 오늘 정답==내 동네 여부.
   * 페이지가 코드 비교 결과(boolean)만 넘긴다 — 이 컴포넌트는 지역명 자체를 몰라도 된다.
   */
  isMyTownAnswer?: boolean;
  /** 미등록 유도 카드의 "내 동네 설정 →" 탭 핸들러(§4-4 자동완성 인라인 오픈은 페이지 책임) */
  onRegisterClick?: () => void;
  /** 등록됨 상태에서 "내 동네 변경" 링크 탭 핸들러(없으면 링크 미노출) */
  onChangeClick?: () => void;
  /** 64px(결과 기본) vs 40px(축약) */
  compact?: boolean;
  className?: string;
}

/**
 * "우리 동네" 실링 뱃지 + 미등록 유도 카드 (design-final §4-9).
 * - status==="playing"이면 항상 null (정답 확정 이후에만 계산·렌더해야 함).
 * - registered && isMyTownAnswer → 실링 뱃지 + 자랑 카피(승/패 카피 분기).
 * - registered && !isMyTownAnswer → **빈 공간 방치 없이 완전 미렌더**(카드 높이 안 튐).
 * - !registered → 유도 카드(비차단, 건너뛰기 가능 — onRegisterClick 없으면 CTA 자체 미노출).
 */
export default function TownBadge({
  status,
  registered,
  isMyTownAnswer = false,
  onRegisterClick,
  onChangeClick,
  compact = false,
  className = "",
}: TownBadgeProps) {
  if (status === "playing") return null;

  if (registered && isMyTownAnswer) {
    const copy =
      status === "won"
        ? "오늘 정답이 우리 동네였음 ㅋㅋ"
        : "오늘 정답이 우리 동네였는데 못 맞혔어요 ㅠㅠ";
    return (
      <div className={`dn-town-result ${className}`.trim()}>
        <span className="dn-town-seal-wrap" role="img" aria-label="우리 동네 실링 뱃지">
          <span className={`dn-town-seal${compact ? " is-compact" : ""}`} aria-hidden="true">
            <Home size={compact ? 14 : 20} strokeWidth={2.5} />
          </span>
          <span className="dn-town-seal-label" aria-hidden="true">
            우리 동네
          </span>
        </span>
        <div>
          <p className="dn-town-copy">{copy}</p>
          {onChangeClick ? (
            <button type="button" className="dn-town-change-link dn-link" onClick={onChangeClick}>
              내 동네 변경
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (registered) {
    // 등록됐지만 오늘 정답과 불일치 — 빈 공간 없이 완전 미렌더
    return null;
  }

  // 미등록 — 유도 카드(비차단)
  return (
    <div className={`dn-town-invite-card ${className}`.trim()}>
      <p className="dn-town-invite-text">내 동네를 등록하면 정답 일치 시 뱃지를 받아요</p>
      {onRegisterClick ? (
        <button type="button" className="dn-town-invite-cta touch-target" onClick={onRegisterClick}>
          내 동네 설정 →
        </button>
      ) : null}
    </div>
  );
}
