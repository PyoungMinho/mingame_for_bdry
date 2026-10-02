/**
 * §5-20 SealStamp — 인주 도장. '도주'만 먹색 + 끊긴 보더(dasharray). 회전 -6~-8°(모션은 CSS keyframe, §4-4).
 */
/**
 * '미결' = 지목을 마치지 않아 판결 없음(QA BUG-06) — 도주처럼 끊긴 먹색.
 * '결백' = 무고자 '정체' 칸 도장(개선 묶음 1 · G4) — '범인'과 같은 크기·색·회전·자리. 30~50cm 거리에서 '빨간 도장이 떴다/안 떴다'로
 * 범인이 드러나지 않게, 열린 정체 칸의 실루엣을 맞춘다.
 */
export type SealStampText = '공개' | '범인' | '검거' | '도주' | '확정' | '미결' | '결백';

export interface SealStampProps {
  text: SealStampText;
  size?: 56 | 72 | 120 | 140;
  /** 고정 각도를 지정하지 않으면 텍스트별 기본값(-6~-8°) 사용 */
  rotateDeg?: number;
  className?: string;
}

const DEFAULT_ROTATE: Record<SealStampText, number> = {
  공개: -8,
  범인: -6,
  검거: -8,
  도주: -6,
  확정: -6,
  미결: -6,
  결백: -6,
};

export function SealStamp({ text, size = 72, rotateDeg, className }: SealStampProps) {
  const broken = text === '도주' || text === '미결';
  const rotate = rotateDeg ?? DEFAULT_ROTATE[text];
  return (
    <span
      className={['gu-stamp', className ?? ''].filter(Boolean).join(' ')}
      data-broken={broken || undefined}
      role="img"
      aria-label={`도장: ${text}`}
      style={{ width: size, height: size, transform: `rotate(${rotate}deg)`, fontSize: size <= 56 ? 18 : size <= 72 ? 22 : size <= 120 ? 34 : 40 }}
    >
      <span className="gu-stamp-text gu-display">{text}</span>
    </span>
  );
}
