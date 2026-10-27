// src/app/cloudcheck/_client/screens/Start.tsx — V0 시작. 디자인 최종안 §6-1(A1~A11), UX §4-1.
//  - 정적 셸(템플릿)과 같은 상단 구조·같은 글자: h1 → tagline → p.cc-display(한 줄 약속). 부팅 때 밀림(CLS)이 없다.
//  - 열린 리포트(A3)·새로고침 복구(A3')는 h1 위 알림. 체험 리포트는 A3을 띄우지 않는다(실제 리포트만).
//  - Azure가 준비 중이면 버튼은 '펼침 버튼'(aria-expanded)이다: 누르면 같은 자리에 안내 + [Azure 체험 보기]. aria-disabled를 단 채 클릭에 반응하는 모호한 패턴을 쓰지 않는다.
//  - 오프라인판 SHA-256 값은 쓰지 않는다(Q1) — 게시 채널과 sha256sum 대조법만. file://로 열렸으면 A10 전체를 숨긴다.
import { useId, useRef, type ReactElement } from "react";
import { Banner } from "../components/Banner";
import { Chip } from "../components/Chip";
import { DoorIcon } from "../components/DoorIcon";
import { FoldButton, FoldRegion, useFold } from "../components/Fold";
import { PromiseBlock } from "../components/PromiseBlock";
import { T } from "../components/T";
import { canCollect } from "../config";
import { t } from "../i18n/index";
import { DOORS, type GlobalCannotSee } from "../../../../lib/cloudcheck/model/report";
import { useApp } from "../state/controller";
import { MORE_CANNOT_SEE, START_CANNOT_SEE } from "./constants";
import { ChannelRows, OfflineDownload } from "./shared";

const gcs = (code: GlobalCannotSee): `cc.gcs.${GlobalCannotSee}` => `cc.gcs.${code}`;

export function StartScreen(): ReactElement {
  const { state, actions, availability, offline } = useApp();
  const real = state.report !== null && state.report.mode.kind === "real";
  const azureSoon = !canCollect("azure", availability);
  const azureOpen = state.view.azureOpen;
  const azureNoteId = useId();
  const verifyRef = useRef<HTMLHeadingElement>(null);
  const more = useFold("start-cannot-more", false);

  return (
    <>
      {real ? (
        <Banner
          variant="info"
          title={t("cc.start.resume.title")}
          body={
            <>
              <p>{t("cc.start.resume.body")}</p>
              <button type="button" className="cc-btn" onClick={actions.resume}>
                {t("cc.start.resume.cta")}
              </button>
            </>
          }
        />
      ) : null}
      {state.recovered && !real ? (
        <Banner
          variant="info"
          title={t("cc.start.recover.title")}
          body={
            <>
              <p>{t("cc.start.recover.body")}</p>
              <button type="button" className="cc-btn" onClick={actions.haveFile}>
                {t("cc.start.recover.cta")}
              </button>
            </>
          }
        />
      ) : null}

      <h1 tabIndex={-1}>{t("cc.start.title")}</h1>
      <p>{t("cc.start.tagline")}</p>
      <p className="cc-display">{t("cc.promise.line")}</p>

      <section aria-labelledby="cc-start-doors-h">
        <h2 id="cc-start-doors-h">{t("cc.start.doors.heading")}</h2>
        <ul className="cc-doors" role="list">
          {DOORS.map((door) => (
            <li key={door} className="cc-doors__i">
              <DoorIcon door={door} size={32} />
              <strong>{t(`cc.door.${door}.name`)}</strong>
              <span className="cc-muted cc-small">{t(`cc.door.${door}.term`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div role="group" aria-label={t("cc.start.cta.group")} className="cc-start__cta">
        <button type="button" className="cc-btn cc-btn--primary" onClick={() => actions.startCollect("aws")}>
          {t("cc.start.cta.aws")}
        </button>
        {azureSoon ? (
          <button type="button" className="cc-btn" aria-expanded={azureOpen} aria-controls={azureNoteId} onClick={actions.toggleAzureNote}>
            {t("cc.start.cta.azure")}
            <Chip variant="soon">{t("cc.start.cta.azure-soon")}</Chip>
          </button>
        ) : (
          <button type="button" className="cc-btn" onClick={() => actions.startCollect("azure")}>
            {t("cc.start.cta.azure")}
          </button>
        )}
        <button type="button" className="cc-btn" onClick={actions.startDemoFlow}>
          {t("cc.start.cta.demo")}
        </button>
        <button type="button" className="cc-btn" onClick={actions.haveFile}>
          {t("cc.start.cta.have-file")}
        </button>
      </div>
      <div id={azureNoteId} hidden={!(azureSoon && azureOpen)}>
        <Banner
          variant="demo"
          title={t("cc.start.azure-soon.note")}
          body={
            <button type="button" className="cc-btn" onClick={actions.azureDemo}>
              {t("cc.start.azure-soon.demo")}
            </button>
          }
        />
      </div>

      <PromiseBlock variant="full" hideLine onVerify={() => verifyRef.current?.focus()} />

      <section aria-labelledby="cc-start-cannot-h">
        <h2 id="cc-start-cannot-h">{t("cc.start.cannot.heading")}</h2>
        <ul className="cc-prose cc-ul" role="list">
          {START_CANNOT_SEE.map((code) => (
            <li key={code}>
              <T k={gcs(code)} />
            </li>
          ))}
        </ul>
        <FoldButton fold={more} noPrint>
          {t("cc.start.cannot.more")}
        </FoldButton>
        <FoldRegion fold={more} print="expand">
          <ul className="cc-prose cc-ul" role="list">
            {MORE_CANNOT_SEE.map((code) => (
              <li key={code}>
                <T k={gcs(code)} />
              </li>
            ))}
          </ul>
        </FoldRegion>
      </section>

      <section aria-labelledby="cc-start-verify-h">
        <h2 id="cc-start-verify-h" ref={verifyRef} tabIndex={-1}>
          {t("cc.start.verify.heading")}
        </h2>
        <ol className="cc-prose cc-ol" role="list">
          <li>{t("cc.start.verify.1")}</li>
          <li>{t("cc.start.verify.2")}</li>
          <li>{t("cc.start.verify.3")}</li>
        </ol>
      </section>

      {offline ? null : (
        <section aria-labelledby="cc-start-offline-h" className="cc-stack cc-gap-2">
          <h2 id="cc-start-offline-h">{t("cc.start.offline.heading")}</h2>
          <p>{t("cc.start.offline.body")}</p>
          <OfflineDownload ctaKey="cc.start.offline.cta" />
          <ChannelRows repoLabelKey="cc.start.offline.repo" pdfLabelKey="cc.prep.hash.row.pdf" />
          <p className="cc-small cc-muted">{t("cc.start.offline.hash-note")}</p>
        </section>
      )}
    </>
  );
}
