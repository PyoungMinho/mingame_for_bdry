"use client";

export interface StreakChipProps {
  /** 현재 플레이 스트릭 일수. 0이면 회색 다운그레이드로 끊김 표현(§4-8) */
  streak: number;
  /** "label" variant에서만 사용 — 최고 스트릭 */
  maxStreak?: number;
  /** "compact" = 28px pill(아이콘+숫자). "label" = 결과 카드 문장형(F11 확정 문구) */
  variant?: "compact" | "label";
  className?: string;
}

/**
 * 스트릭 표시 (design-final §4-8, F11 확정).
 * - compact: "🔥 N일" pill. 어디서든(헤더 근처 등) 붙여 쓸 수 있는 컴팩트 형태.
 * - label: 결과 카드 안에서 쓰는 문장형 "🔥 플레이 스트릭 N일 (최고 M일)" + 보조 캡션.
 */
export default function StreakChip({
  streak,
  maxStreak,
  variant = "compact",
  className = "",
}: StreakChipProps) {
  if (variant === "label") {
    return (
      <div className={`dn-streak-label ${className}`.trim()}>
        <p className="dn-streak-label-main dn-text-body">
          🔥 플레이 스트릭 <span className="dn-text-mono-num">{streak}</span>일
          {typeof maxStreak === "number" ? (
            <span className="dn-text-body-sm">
              {" "}
              (최고 <span className="dn-text-mono-num">{maxStreak}</span>일)
            </span>
          ) : null}
        </p>
        <p className="dn-streak-label-caption dn-text-body-sm">플레이하면 이어져요(정답 못 맞혀도 유지)</p>
      </div>
    );
  }

  return (
    <span
      className={`dn-streak-chip${streak === 0 ? " is-zero" : ""} ${className}`.trim()}
      role="img"
      aria-label={`플레이 스트릭 ${streak}일`}
    >
      <span className="dn-streak-chip-icon" aria-hidden="true">
        🔥
      </span>
      <span className="dn-streak-chip-num dn-text-mono-num" aria-hidden="true">
        {streak}일
      </span>
    </span>
  );
}
