import Link from 'next/link';

export interface DongneHeaderProps {
  /** 있으면 "#N" 회차 배지 노출(게임 화면 전용) */
  gameNo?: number;
  /** 있으면 좌측이 "← {backLabel}"로 대체(뒤로가기 모드) — 아카이브/정적/해설 화면 */
  backHref?: string;
  backLabel?: string;
  /** 우측 "아카이브" 링크 숨김 — 아카이브 목록 페이지 자기 자신일 때만 true */
  hideArchiveLink?: boolean;
}

/**
 * 전 화면 공통 헤더 (design-final §1-2·§4-1).
 * 좌: 워드마크+회차배지(게임 화면) 또는 "← 뒤로"(그 외 화면) · 우: "아카이브" 텍스트 링크만
 * (다크토글·아이콘버튼 없음, F5). 48px content + safe-area-inset-top은 dongne.css가 담당한다.
 *
 * ⚠ 통합 메모: 이 파일은 `src/app/dongne/components/`(컴포넌트개발자 소유) 밖의
 * `src/app/dongne/lib/`에 있다 — 헤더/푸터 같은 순수 라우팅 셸은 §4 컴포넌트 목록에 없어
 * 페이지개발자가 직접 조립했다. 클래스명(`dn-header*`)은 아직 dongne.css에 없는 신규
 * 제안이므로 팀장 통합 시 스타일 추가가 필요하다(하단 페이지 파일들의 통합 메모 참고).
 */
export default function DongneHeader({
  gameNo,
  backHref,
  backLabel = '동네고수',
  hideArchiveLink = false,
}: DongneHeaderProps) {
  return (
    <header className="dn-header">
      <div className="dn-header-left">
        {backHref ? (
          <Link href={backHref} className="dn-header-back dn-link">
            ← {backLabel}
          </Link>
        ) : (
          <Link href="/dongne" className="dn-header-wordmark-link">
            <span className="dn-header-wordmark dn-text-h1">동네고수</span>
            {typeof gameNo === 'number' && gameNo >= 1 ? (
              <span className="dn-header-badge">#{gameNo}</span>
            ) : null}
          </Link>
        )}
      </div>
      {!hideArchiveLink ? (
        <Link href="/dongne/archive" className="dn-header-archive-link dn-link">
          아카이브
        </Link>
      ) : null}
    </header>
  );
}
