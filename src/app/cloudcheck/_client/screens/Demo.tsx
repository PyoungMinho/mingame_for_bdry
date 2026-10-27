// src/app/cloudcheck/_client/screens/Demo.tsx — V6 체험 모드. 디자인 최종안 §6-7(H0~H2), UX §4-7.
//  - 체험 표식은 이 화면부터(띠·프레임은 App이 그린다). 카드 순서 C → D → A → B, 세트 글자(A~D)는 화면에 쓰지 않는다. 카드 4장이 동등해 주 버튼은 없다.
//  - 클라우드 라디오는 고르기만 한다(WCAG 3.2.2 — 선택해도 이동하지 않는다). Azure 실점검이 준비 중이어도 Azure 체험은 공개한다.
//  - 카드 버튼 → pipeline 체험 경로(recognize via demo → buildInput → judge) → V3(mode: demo).
import type { ReactElement } from "react";
import { Banner } from "../components/Banner";
import { CloudRadio, DemoCards } from "../components/Demo";
import { canCollect } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { BackButton } from "./shared";

export function DemoScreen(): ReactElement {
  const { state, actions, availability } = useApp();
  const azureSoon = state.demoCloud === "azure" && !canCollect("azure", availability);
  const building = state.busy === "building";
  return (
    <>
      <BackButton labelKey="cc.prep.back" onClick={() => actions.show("start")} />
      <h1 tabIndex={-1}>{t("cc.demo.title")}</h1>
      <p>{t("cc.demo.sub")}</p>
      <CloudRadio value={state.demoCloud} onChange={actions.setDemoCloud} />
      {azureSoon ? <Banner variant="demo" title={t("cc.demo.azure-note")} /> : null}
      {building ? (
        <p className="cc-hint" aria-busy="true">
          {t("cc.input.building")}
        </p>
      ) : null}
      <DemoCards cloud={state.demoCloud} onOpen={(set) => void actions.openDemo(set)} />
    </>
  );
}
