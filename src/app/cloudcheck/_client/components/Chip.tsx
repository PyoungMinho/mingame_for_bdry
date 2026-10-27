// src/app/cloudcheck/_client/components/Chip.tsx — 칩 4종: Chip · LabelChip · ExceptionLabel · ImpactChip. 디자인 최종안 §5-2.
//  - 상태 색을 쓰지 않는다(상태는 StatusBadge뿐). 예외(파랑)는 ExceptionLabel 전용. 신호등 색 금지(ImpactChip은 테두리 굵기로 차등).
import type { ReactElement, ReactNode } from "react";
import type { FixGuide, Label } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { cx } from "./cx";
import { T } from "./T";
import "./Chip.css";

export interface ChipProps {
  /** hint = 확정이 아닌 추정(점선) / strong = '못 본 것 n'·'직접 볼 것 n'(잉크 테두리) / inv = '권장'(잉크 채움, 한 화면 1개 이하) / soon = 준비 중(점선 + 흐린 글자) */
  readonly variant?: "hint" | "strong" | "inv" | "soon";
  readonly children: ReactNode;
}

export function Chip({ variant, children }: ChipProps): ReactElement {
  return <span className={cx("cc-chip", variant !== undefined && `cc-chip--${variant}`)}>{children}</span>;
}

type NonExceptionLabel = Exclude<Label, { kind: "exception" }>;
type ExceptionLabelData = Extract<Label, { kind: "exception" }>;

export interface LabelChipProps {
  readonly label: NonExceptionLabel;
}

/** 이름 힌트·오래된 버킷 힌트는 추정이라 점선(--hint), 나머지는 실선 */
export function LabelChip({ label }: LabelChipProps): ReactElement {
  switch (label.kind) {
    case "intended-public-candidate":
      return <Chip>{t("cc.label.intended-public-candidate")}</Chip>;
    case "name-hint":
      return <Chip variant="hint">{t("cc.label.name-hint", { hint: label.hint })}</Chip>;
    case "legacy-hint":
      return <Chip variant="hint">{t("cc.label.legacy-hint")}</Chip>;
    case "unusual-characters":
      return <Chip>{t("cc.label.unusual-characters")}</Chip>;
  }
}

export interface ExceptionLabelProps {
  readonly label: ExceptionLabelData;
}

/** 예외 표시: 상태는 그대로(고위험 #12). 사유는 엔진이 정리한 DisplayValue(MaskedValue로) */
export function ExceptionLabel({ label }: ExceptionLabelProps): ReactElement {
  const expired = label.state === "expired";
  return (
    <span className={cx("cc-excl", expired && "cc-excl--expired")}>
      {expired ? <T k="cc.label.exception-expired" p={{ until: { d: label.until } }} /> : <T k="cc.label.exception-active" p={{ reason: { v: label.reason }, until: { d: label.until } }} />}
    </span>
  );
}

export interface ImpactChipProps {
  readonly impact: FixGuide["impact"];
  readonly prodImpact: boolean;
}

export function ImpactChip({ impact, prodImpact }: ImpactChipProps): ReactElement {
  return (
    <>
      <span className={cx("cc-impact", `cc-impact--${impact}`)}>{t(`cc.c.chip.impact.${impact}`)}</span>
      {prodImpact ? <span className="cc-impact cc-impact--medium">{t("cc.c.chip.prod-impact")}</span> : null}
    </>
  );
}
