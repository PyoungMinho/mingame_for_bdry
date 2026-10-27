// src/app/cloudcheck/_client/components/Disclaimer.tsx — 면책 전문(금지어 키 허용 cc.disclaimer.body). V3 분포 아래 + 인쇄 마지막 바닥 + V8. 도장·서명란은 만들지 않는다.
import type { ReactElement } from "react";
import { t } from "../i18n/index";
import "./Disclaimer.css";

export function Disclaimer(): ReactElement {
  return <p className="cc-disc">{t("cc.disclaimer.body")}</p>;
}
