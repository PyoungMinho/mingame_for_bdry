"use client";

import type { ReactNode } from "react";

export interface ResultCardProps {
  status: "won" | "lost";
  /** 성공: 1~6, 실패: 6 */
  attemptsUsed: number;
  /** 실패("lost")일 때만 사용 — 정답 확정 후의 정답 지역명. "won"이면 전달해도 렌더하지 않는다(스포일러 가드) */
  answerName?: string;
  /** §2-B 순서 2) 스트릭 — 보통 `<StreakChip variant="label" .../>` */
  streakSlot: ReactNode;
  /** §2-B 순서 3) "우리 동네" 뱃지/유도카드 — `<TownBadge .../>`. 조건부라 생략 가능 */
  townBadgeSlot?: ReactNode;
  /** §2-B 순서 4~5) 공유 버튼 — `<ShareButtons .../>` */
  shareSlot: ReactNode;
  /** §2-B 순서 6) 카운트다운 — `<CountdownChip .../>` */
  countdownSlot: ReactNode;
  /** §2-B 순서 7) "어제 정답 알아보기 →" 링크. href 없으면 미노출(예: 첫 회차) */
  archiveHref?: string;
  archiveLabel?: string;
  /** §2-B 순서 8) 통계 아코디언 — `<StatsHistogram .../>`. localStorage 불가 시 페이지가 생략 */
  statsSlot?: ReactNode;
  /** §2-B 순서 9) 푸터(소개·개인정보·문의) — 페이지가 조립해서 전달 */
  footerSlot?: ReactNode;
  className?: string;
}

/**
 * 결과 카드 — 인라인 아코디언 (design-final §4-7, §2-B 순서 1~9 고정).
 * 게임→결과는 별도 라우팅 없이 같은 페이지에서 마운트되는 것만으로 확장되므로
 * 브라우저 히스토리 스택을 쌓지 않는다(페이지가 조건부 렌더로 마운트/언마운트만 하면 자동 충족).
 *
 * 각 슬롯은 이미 완성된 하위 컴포넌트(StreakChip/TownBadge/ShareButtons/CountdownChip/
 * StatsHistogram)를 페이지가 조립해서 전달한다 — 이 컴포넌트는 표시 순서(1~9)와 헤드라인만
 * 소유하는 headless 컨테이너다.
 */
export default function ResultCard({
  status,
  attemptsUsed,
  answerName,
  streakSlot,
  townBadgeSlot,
  shareSlot,
  countdownSlot,
  archiveHref,
  archiveLabel = "어제 정답 알아보기 →",
  statsSlot,
  footerSlot,
  className = "",
}: ResultCardProps) {
  return (
    <div className={`dn-result-card ${className}`.trim()} role="region" aria-label="오늘의 결과">
      {status === "won" ? (
        <h2 className="dn-result-headline dn-text-hero">🎉 {attemptsUsed}/6 만에 맞혔어요!</h2>
      ) : (
        <h2 className="dn-result-headline is-fail dn-text-hero">
          6/6 — 아쉬워요!{answerName ? ` 정답은 ${answerName}였어요` : ""}
        </h2>
      )}

      <div className="dn-result-slot">{streakSlot}</div>

      {townBadgeSlot ? <div className="dn-result-slot">{townBadgeSlot}</div> : null}

      <div className="dn-result-slot">{shareSlot}</div>

      <div className="dn-result-slot">{countdownSlot}</div>

      {archiveHref ? (
        <a className="dn-result-archive-link dn-link" href={archiveHref}>
          {archiveLabel}
        </a>
      ) : null}

      {statsSlot ? <div className="dn-result-slot">{statsSlot}</div> : null}

      {footerSlot ? <div className="dn-result-footer">{footerSlot}</div> : null}
    </div>
  );
}
