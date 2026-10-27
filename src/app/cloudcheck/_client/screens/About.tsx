// src/app/cloudcheck/_client/screens/About.tsx — V8 이 도구에 대해. 디자인 최종안 §6-9(J1~J8), UX §4-9. 번역을 허용하는 화면이다.
//  - J1: 약속·고지·면책 전문·인증 아님(허용 키 2개가 모두 이 화면에 있다). J3: 오프라인판 + 게시 채널(해시 값은 쓰지 않는다 — Q1, file://면 내려받기 숨김).
//  - J5 '못 막는 경로 4가지'의 외부 안내 링크는 LINK_HOSTS 안 URL을 확인할 때까지 글자만(링크 없음).
import type { ReactElement } from "react";
import { Disclaimer } from "../components/Disclaimer";
import { DocLink } from "../components/DocLink";
import { PromiseBlock } from "../components/PromiseBlock";
import { T } from "../components/T";
import { PAGE_VERSION, REPO_URL } from "../config";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { ALL_CANNOT_SEE, CLICKFIX_LINK } from "./constants";
import { BackButton, ChannelRows, OfflineDownload } from "./shared";

export function AboutScreen(): ReactElement {
  const { state, actions, offline, deps } = useApp();
  const ruleset = state.report === null ? deps.rulesetVersion : state.report.engine.rulesetVersion;
  return (
    <>
      <BackButton labelKey="cc.app.back" onClick={actions.back} />
      <h1 tabIndex={-1}>{t("cc.about.title")}</h1>

      <section aria-labelledby="cc-about-promise-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-promise-h">{t("cc.about.promise.heading")}</h2>
        <PromiseBlock variant="full" onVerify={() => document.getElementById("cc-about-verify-h")?.focus()} />
        <Disclaimer />
        <p>{t("cc.about.not-certification")}</p>
      </section>

      <section aria-labelledby="cc-about-verify-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-verify-h" tabIndex={-1}>
          {t("cc.about.verify.heading")}
        </h2>
        <ol className="cc-prose cc-ol" role="list">
          <li>{t("cc.about.verify.1")}</li>
          <li>{t("cc.about.verify.2")}</li>
          <li>{t("cc.about.verify.3")}</li>
        </ol>
      </section>

      <section aria-labelledby="cc-about-offline-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-offline-h">{t("cc.about.offline.heading")}</h2>
        {offline ? null : <OfflineDownload ctaKey="cc.about.offline.cta" />}
        <ChannelRows repoLabelKey="cc.start.offline.repo" pdfLabelKey="cc.prep.hash.row.pdf" />
        <p>{t("cc.about.offline.why")}</p>
      </section>

      <section aria-labelledby="cc-about-cannot-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-cannot-h">{t("cc.about.cannot.heading")}</h2>
        <ol className="cc-prose cc-ol" role="list">
          {ALL_CANNOT_SEE.map((code) => (
            <li key={code}>
              <T k={`cc.gcs.${code}`} />
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="cc-about-paths-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-paths-h">{t("cc.about.paths.heading")}</h2>
        <ul className="cc-prose cc-ul" role="list">
          <li>{t("cc.about.paths.keys")}</li>
          <li>{t("cc.about.paths.partner")}</li>
          <li>{t("cc.about.paths.vuln")}</li>
          <li>{t("cc.about.paths.phish")}</li>
        </ul>
      </section>

      <section aria-labelledby="cc-about-clickfix-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-clickfix-h">{t("cc.about.clickfix.heading")}</h2>
        <ul className="cc-prose cc-ul" role="list">
          <li>{t("cc.prep.clickfix.1")}</li>
          <li>{t("cc.prep.clickfix.2")}</li>
          <li>{t("cc.prep.clickfix.3")}</li>
        </ul>
        <p>
          <DocLink link={CLICKFIX_LINK} labelKey="cc.prep.clickfix.link" />
        </p>
      </section>

      <section aria-labelledby="cc-about-grad-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-grad-h">{t("cc.about.grad.heading")}</h2>
        <p>{t("cc.c.grad.line")}</p>
      </section>

      <section aria-labelledby="cc-about-meta-h" className="cc-stack cc-gap-2">
        <h2 id="cc-about-meta-h">{t("cc.about.meta.heading")}</h2>
        <ul className="cc-prose cc-ul" role="list">
          <li>{t("cc.app.footer.versions", { page: PAGE_VERSION, ruleset })}</li>
          <li>{t("cc.app.footer.made-by")}</li>
          <li>{t("cc.about.oss")}</li>
          <li>{t("cc.about.meta.lang")}</li>
          {REPO_URL === null ? null : (
            <li>
              <DocLink link={REPO_URL} labelKey="cc.about.meta.feedback" />
            </li>
          )}
        </ul>
      </section>
    </>
  );
}
