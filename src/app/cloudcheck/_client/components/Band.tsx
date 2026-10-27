// src/app/cloudcheck/_client/components/Band.tsx — 띠(베타/체험)와 체험 프레임. 닫기·펼치기 버튼 없음. 디자인 최종안 §5-2(C19·C20).
//  - 태그·줄·보조 3키(cc.band.<beta|demo>.<tag|row|more>). 스크롤하면 <html>의 cc-compact가 보조 줄만 접는다(max-height:0이라 스크린리더에는 계속 읽힌다).
//  - 정적 셸의 띠와 같은 구조(aside.cc-band > .cc-band__tag + .cc-band__row + 공백 + .cc-band__more)라 부팅 때 밀림이 없다.
//  - 띠 선택 규칙(디자인 §3-1)은 호출하는 쪽: 체험 화면(V6, V3·V4의 체험 리포트)이면 demo, 그 밖은 beta. 둘을 쌓지 않는다.
import type { ReactElement } from "react";
import { t } from "../i18n/index";
import { cx } from "./cx";
import "./Band.css";

export interface BandProps {
  readonly kind: "beta" | "demo";
}

export function Band({ kind }: BandProps): ReactElement {
  const demo = kind === "demo";
  return (
    <aside className={cx("cc-band", demo && "cc-band--demo")} aria-label={t("cc.band.aria")}>
      <span className="cc-band__tag">{demo ? t("cc.band.demo.tag") : t("cc.band.beta.tag")}</span>
      <span className="cc-band__row">{demo ? t("cc.band.demo.row") : t("cc.band.beta.row")}</span> <span className="cc-band__more">{demo ? t("cc.band.demo.more") : t("cc.band.beta.more")}</span>
    </aside>
  );
}

/** 체험 모드의 안쪽 4px 프레임(클릭을 막지 않는다, 인쇄에서는 숨김). 색만으로 전하지 않도록 띠·맥락 줄 글자가 함께 간다 */
export function DemoFrame(): ReactElement {
  return <div className="cc-demo-frame" aria-hidden="true" />;
}
