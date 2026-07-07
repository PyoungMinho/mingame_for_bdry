"use client";

export interface ProgressBarProps {
  /** 1-based 현재 문항 번호 */
  current: number;
  /** 전체 문항 수 (config.questionCount에서 주입, 하드코딩 금지) */
  total: number;
  /** "N문항 중 N번째" 같은 접근성 라벨. 화면 카피이므로 호출부가 config에서 조합해 전달. */
  ariaLabel?: string;
  className?: string;
}

/**
 * 10칸(가변 total) 세그먼트 진행바. design-final §1 화면2, §4-1 questionCount 기반.
 * role="progressbar" + aria-valuenow/min/max로 스크린리더에 진행률을 알린다.
 */
export default function ProgressBar({
  current,
  total,
  ariaLabel,
  className = "",
}: ProgressBarProps) {
  const segments = Array.from({ length: total }, (_, i) => i < current);

  return (
    <div
      className={`oa-progress ${className}`.trim()}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={ariaLabel ?? `${total}문항 중 ${current}번째`}
    >
      <div className="oa-progress-segments">
        {segments.map((filled, i) => (
          <span
            key={i}
            className={`oa-progress-seg${filled ? " is-filled" : ""}`}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="oa-progress-num" aria-hidden="true">
        {current} / {total}
      </span>
    </div>
  );
}
