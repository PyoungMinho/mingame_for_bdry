// src/app/cloudcheck/_client/components/Banner.tsx — 알림 4변형: strong(항상 펼침) · info · exception · demo. 닫기 버튼 없음. 디자인 최종안 §5-2.
//  - strong: role="note"로 항상 읽힌다(7일 초과·비밀 패턴 감지 두 가지뿐). 잉크 반전, 인쇄는 이중 테두리.
//  - info·exception: foldId가 있으면 제목이 토글 버튼·본문이 접힘 영역(인쇄 펼침), 없으면 제목·본문이 모두 보인다(V0 A3·A3', V4 F3').
//  - demo: 체험 안내·Azure 준비 중. 모델 타입 Banner와 이름이 겹치므로 엔진 타입은 `import type { Banner as EngineBanner }`로 가져온다.
import type { ReactElement, ReactNode } from "react";
import { t } from "../i18n/index";
import { cx } from "./cx";
import { FoldButton, FoldRegion, useFold } from "./Fold";
import "./Banner.css";

export interface BannerProps {
  readonly variant: "strong" | "info" | "exception" | "demo";
  readonly title: ReactNode;
  readonly body?: ReactNode;
  /** 접을 수 있는 알림이면 접힘 상태의 키(리포트 안에서 안정적인 값) */
  readonly foldId?: string;
  /** 접근 이름(예: 중요한 알림). 강한 공지에 쓴다 */
  readonly ariaLabel?: string;
}

function FoldedBanner({ variant, title, body, foldId }: BannerProps & { readonly foldId: string }): ReactElement {
  const fold = useFold(foldId, false);
  return (
    <div className={cx("cc-banner", `cc-banner--${variant}`)} role="note">
      <FoldButton fold={fold}>
        <span className="cc-banner__t">{title}</span>
        <span className="cc-small cc-noprint">{fold.open ? t("cc.c.banner.collapse") : t("cc.c.banner.details")}</span>
      </FoldButton>
      <FoldRegion fold={fold} print="expand" className="cc-banner__b">
        {body}
      </FoldRegion>
    </div>
  );
}

export function Banner(props: BannerProps): ReactElement {
  const { variant, title, body, foldId, ariaLabel } = props;
  if (foldId !== undefined && variant !== "strong") return <FoldedBanner {...props} foldId={foldId} />;
  return (
    <div className={cx("cc-banner", `cc-banner--${variant}`)} role="note" aria-label={ariaLabel}>
      <div className="cc-banner__t">{title}</div>
      {body === undefined || body === null ? null : <div className="cc-banner__b">{body}</div>}
    </div>
  );
}
