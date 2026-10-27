// src/app/cloudcheck/_client/screens/Prep.tsx — V1 수집 준비. 디자인 최종안 §6-2(B0~B14), UX §4-2. 번역을 허용하는 화면이다(명령·해시·원문 블록만 translate="no").
//  - 방법 ②(수집기, 권장): 8단계를 모두 보인다. 스크립트 원문 → 예상 호출 → 필요한 권한 → 해시(이 페이지 값 + 페이지 밖 채널) → 실행 권한 → 내려받기 → 셸에서 직접 입력하는 두 줄 → 결과 받기 → 정리 → 넣기.
//  - 방법 ①(파일 하나만): AWS는 IAM 자격증명 보고서 CSV, Azure는 Resource Graph 쿼리 두 개(읽기 전용 쿼리 — 선택하면 전체 선택, 복사 버튼 없음).
//  - 이 화면에서는 쓰기 명령이 나오지 않는다(V4에만). 복사 버튼은 어디에도 없다: 셸에 입력하는 두 줄은 직접 입력하게 한다(ClickFix 방어).
//  - 해시 대조 입력칸은 만들지 않는다(Q13). 오프라인판·수집기의 값은 페이지 밖(저장소·PDF)과 대조하라고 안내만 한다.
import { useRef, type ReactElement, type ReactNode } from "react";
import { AWS_CALLS, AZURE_CALLS } from "../../../../lib/cloudcheck/contract/calls";
import { RG_QUERIES } from "../../../../lib/cloudcheck/contract/rg-queries";
import { AccountLabel } from "../components/AccountLabel";
import { Banner } from "../components/Banner";
import { Chip } from "../components/Chip";
import { CliBlock } from "../components/CliBlock";
import { DocLink } from "../components/DocLink";
import { DownloadLink } from "../components/DownloadLink";
import { FootprintTable } from "../components/FootprintTable";
import { HashDisplay } from "../components/HashDisplay";
import { PathChooser } from "../components/PathChooser";
import { ScriptViewer } from "../components/ScriptViewer";
import { T } from "../components/T";
import { canCollect, COLLECTOR_FLAGS, HASH_CHANNELS, SCRIPT_NOTES, SCRIPT_SECTION_RE } from "../config";
import { t } from "../i18n/index";
import { readCollectorMeta, readCollectorSource } from "../shell";
import { useApp } from "../state/controller";
import type { Cloud } from "../../../../lib/cloudcheck/model/report";
import { CLICKFIX_LINK, COLLECTOR_FILE, COLLECTOR_MIME } from "./constants";
import { BackButton } from "./shared";

const STEPS = ["cc.prep.step.1", "cc.prep.step.2", "cc.prep.step.3", "cc.prep.step.4", "cc.prep.step.5", "cc.prep.step.6", "cc.prep.step.7", "cc.prep.step.8"] as const;
const CSV_AWS_STEPS = ["cc.prep.csv.aws.1", "cc.prep.csv.aws.2", "cc.prep.csv.aws.3", "cc.prep.csv.aws.4"] as const;
const CSV_AZURE_STEPS = ["cc.prep.csv.azure.1", "cc.prep.csv.azure.2", "cc.prep.csv.azure.3"] as const;

/** 호출 카탈로그의 권한 이름(중복 없이, 호출 카탈로그 순서 그대로) */
function permissionsOf(cloud: Cloud): readonly string[] {
  const calls = Object.values(cloud === "aws" ? AWS_CALLS : AZURE_CALLS);
  const seen = new Set<string>();
  for (const c of calls) if (c.permission !== null) seen.add(c.permission);
  return [...seen];
}

function Soon(): ReactElement {
  return <Chip variant="soon">{t("cc.start.offline.soon")}</Chip>;
}

export function PrepScreen(): ReactElement {
  const { state, actions, availability } = useApp();
  const cloud: Cloud = state.cloud ?? "aws";
  const path = state.view.prepPath;
  const base = state.compareBase;
  const bothClouds = canCollect("aws", availability) && canCollect("azure", availability);
  const source = readCollectorSource(cloud);
  const meta = readCollectorMeta(cloud);
  const file = meta === null ? COLLECTOR_FILE[cloud] : meta.file;
  const refs = useRef<(HTMLElement | null)[]>([]);
  const heading = (i: number): ((el: HTMLElement | null) => void) => (el) => {
    refs.current[i] = el;
  };
  const focusStep = (i: number): void => refs.current[i]?.focus();

  return (
    <>
      <BackButton labelKey="cc.prep.back" onClick={() => actions.show("start")} />
      <h1 tabIndex={-1}>{t("cc.prep.title")}</h1>
      <p className="cc-prep__cloud">
        {t("cc.prep.cloud")}: <strong>{t(cloud === "aws" ? "cc.app.cloud.aws" : "cc.app.cloud.azure")}</strong>{" "}
        {bothClouds ? (
          <button type="button" className="cc-link" onClick={actions.changeCloud}>
            {t("cc.prep.cloud-change")}
          </button>
        ) : null}
      </p>
      <p className="cc-prep__mobile cc-hint">{t("cc.prep.mobile-note")}</p>
      {base === null ? null : (
        <Banner
          variant="info"
          title={t("cc.prep.recollect.note")}
          body={
            <div className="cc-stack cc-gap-2">
              <p>
                <T k="cc.prep.recollect.account" p={{ account: <AccountLabel alias={base.identity.alias} last4={base.identity.accountLast4} /> }} />
              </p>
              {cloud === "aws" ? <p>{t("cc.prep.recollect.cache")}</p> : null}
            </div>
          }
        />
      )}

      {/* B1 방법 선택 — 선택은 이동이 아니다(WCAG 3.2.2) */}
      <PathChooser cloud={cloud} value={path} onChange={actions.setPrepPath} />

      {path === "csv" ? (
        <CsvPath cloud={cloud} collectable={canCollect(cloud, availability)} onNext={actions.toInput} />
      ) : (
        <>
          {/* B2 하는 일 */}
          <section aria-labelledby="cc-prep-what-h" className="cc-stack cc-gap-2">
            <h2 id="cc-prep-what-h">{t("cc.prep.what.heading")}</h2>
            <p>{t(cloud === "aws" ? "cc.prep.what.body.aws" : "cc.prep.what.body.azure")}</p>
          </section>

          {/* B3 순서 */}
          <nav aria-labelledby="cc-prep-steps-h" className="cc-stack cc-gap-2">
            <h2 id="cc-prep-steps-h">{t("cc.prep.steps.heading")}</h2>
            <ol className="cc-ol" role="list">
              {STEPS.map((k, i) => (
                <li key={k}>
                  <button type="button" className="cc-link" onClick={() => focusStep(i)}>
                    {t(k)}
                  </button>
                </li>
              ))}
            </ol>
            <p>
              <button type="button" className="cc-btn" onClick={actions.toInput}>
                {t("cc.prep.next.cta")}
              </button>
            </p>
          </nav>

          <ol className="cc-steps cc-prep__steps" role="list">
            {/* 1 스크립트를 읽습니다(B4~B6) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(0)} tabIndex={-1}>
                {t("cc.prep.step.1")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <h3>{t("cc.prep.script.heading")}</h3>
                <p>{t("cc.prep.script.note")}</p>
                {source === null ? <Soon /> : <ScriptViewer fileName={file} source={source} sectionRe={SCRIPT_SECTION_RE} />}
                <h3>{t("cc.prep.fp.heading")}</h3>
                <p>{t("cc.prep.fp.note")}</p>
                <FootprintTable cloud={cloud} />
                {source !== null && source.includes(SCRIPT_NOTES[cloud].token) ? (
                  <p className="cc-hint">
                    <T k={SCRIPT_NOTES[cloud].key} p={{ code: <code className="cc-mono cc-any" translate="no">{SCRIPT_NOTES[cloud].token}</code> }} />
                  </p>
                ) : null}
                <h3>{t("cc.prep.perm.heading")}</h3>
                <p>
                  {permissionsOf(cloud).map((p) => (
                    <code key={p} className="cc-pm" translate="no">
                      {p}
                    </code>
                  ))}
                </p>
                <p>{t("cc.prep.perm.body")}</p>
              </div>
            </li>

            {/* 2 확인할 해시 값을 봅니다(B7) — 값은 이 페이지 밖(저장소·PDF)과 꼭 대조 */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(1)} tabIndex={-1}>
                {t("cc.prep.step.2")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <p>{t("cc.prep.hash.body")}</p>
                <dl className="cc-stack cc-gap-2">
                  <div>
                    <dt className="cc-lab">{t("cc.prep.hash.row.page")}</dt>
                    <dd>{meta === null ? <Soon /> : <HashDisplay hex={meta.sha256} />}</dd>
                  </div>
                  <div>
                    <dt className="cc-lab">{t("cc.prep.hash.row.repo")}</dt>
                    <dd>{HASH_CHANNELS.repo === null ? <Chip variant="soon">{t("cc.prep.hash.row.soon")}</Chip> : <DocLink link={HASH_CHANNELS.repo} labelKey="cc.prep.hash.row.repo-link" />}</dd>
                  </div>
                  <div>
                    <dt className="cc-lab">{t("cc.prep.hash.row.pdf")}</dt>
                    <dd>
                      {HASH_CHANNELS.pdf === null ? (
                        <Chip variant="soon">{t("cc.prep.hash.row.soon")}</Chip>
                      ) : (
                        <T k="cc.prep.hash.row.pdf-where" p={{ edition: HASH_CHANNELS.pdf.edition, page: HASH_CHANNELS.pdf.page }} />
                      )}
                    </dd>
                  </div>
                </dl>
                <p>{t("cc.prep.hash.independence")}</p>
                <p>
                  <strong>{t("cc.prep.hash.rule")}</strong>
                </p>
                <p>{t("cc.prep.hash.mismatch")}</p>
              </div>
            </li>

            {/* 3 실행할 권한을 정합니다(B8) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(2)} tabIndex={-1}>
                {t("cc.prep.step.3")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <h3>{t("cc.prep.identity.heading")}</h3>
                <ul className="cc-ul" role="list">
                  <li>{t("cc.prep.identity.audit")}</li>
                  <li>{t("cc.prep.identity.self")}</li>
                </ul>
                <p>{t("cc.prep.identity.account")}</p>
              </div>
            </li>

            {/* 4 수집기를 내려받습니다(B9) — Blob 바이트 = 데이터 블록 원문 = 저장소 파일. MIME은 COLLECTOR_MIME(octet-stream — Safari .txt 덧붙임 방지) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(3)} tabIndex={-1}>
                {t("cc.prep.step.4")}
              </h2>
              <div className="cc-stack cc-gap-2">
                {source === null ? (
                  <Soon />
                ) : (
                  <DownloadLink kind="blob" labelKey="cc.prep.download.cta" fileName={file} mime={COLLECTOR_MIME} primary bytes={() => source} onResult={actions.downloaded} />
                )}
                <p className="cc-small">{t("cc.prep.download.file", { file })}</p>
                {state.downloadFailed ? (
                  <p className="cc-err" role="note">
                    {t("cc.app.download.fail")}
                  </p>
                ) : null}
              </div>
            </li>

            {/* 5 셸에서 확인하고 실행합니다(B10) — 사용자가 직접 입력하는 줄은 두 줄뿐 */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(4)} tabIndex={-1}>
                {t("cc.prep.shell.heading")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <p>{t("cc.prep.shell.upload")}</p>
                <Typed label={t("cc.prep.shell.line1.label")} command={`sha256sum ${file}`} after={t("cc.prep.shell.line1.after")} />
                <Typed label={t("cc.prep.shell.line2.label")} command={`bash ${file}`} after={t("cc.prep.shell.line2.after")} />
                <p>{t("cc.prep.shell.typed-note")}</p>
                <p>{t("cc.prep.shell.doors")}</p>
              </div>
            </li>

            {/* 6 결과 파일을 내려받습니다(B11) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(5)} tabIndex={-1}>
                {t("cc.prep.result.heading")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <p>{t("cc.prep.result.body")}</p>
                <p>{t("cc.prep.result.toolbar")}</p>
                <h3>{t("cc.prep.paste.heading")}</h3>
                <p>{t("cc.prep.paste.body", { flag: COLLECTOR_FLAGS.print })}</p>
              </div>
            </li>

            {/* 7 남은 파일을 지웁니다(B12, 선택 · 마지막 단계) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(6)} tabIndex={-1}>
                {t("cc.prep.cleanup.heading")}
              </h2>
              <div className="cc-stack cc-gap-2">
                <p>{t("cc.prep.cleanup.body")}</p>
                <p>{t("cc.prep.cleanup.manual")}</p>
                <p>{t("cc.prep.cleanup.warn")}</p>
              </div>
            </li>

            {/* 8 이 페이지에 결과 파일을 넣습니다(B13) */}
            <li className="cc-stack cc-gap-2">
              <h2 ref={heading(7)} tabIndex={-1}>
                {t("cc.prep.next.heading")}
              </h2>
              <p>
                <button type="button" className="cc-btn cc-btn--primary" onClick={actions.toInput}>
                  {t("cc.prep.next.cta")}
                </button>
              </p>
            </li>
          </ol>
        </>
      )}

      {/* B14 ClickFix 교육 카드 */}
      <Banner
        variant="info"
        title={<h2 id="cc-prep-clickfix-h">{t("cc.prep.clickfix.heading")}</h2>}
        body={
          <div className="cc-stack cc-gap-2">
            <ul className="cc-ul" role="list">
              <li>{t("cc.prep.clickfix.1")}</li>
              <li>{t("cc.prep.clickfix.2")}</li>
              <li>{t("cc.prep.clickfix.3")}</li>
            </ul>
            <p>
              <DocLink link={CLICKFIX_LINK} labelKey="cc.prep.clickfix.link" />
            </p>
          </div>
        }
      />
    </>
  );
}

/** 사용자가 셸에 직접 입력하는 한 줄: 머리 글자 + 입력 줄(복사 버튼 없음) + 나온 값을 보는 법 */
function Typed({ label, command, after }: { readonly label: string; readonly command: string; readonly after: ReactNode }): ReactElement {
  return (
    <div className="cc-stack cc-gap-2">
      <p>
        <strong>{label}</strong>
      </p>
      <CliBlock typed={command} />
      <p>{after}</p>
    </div>
  );
}

/** 방법 ①: 파일 하나만 내려받기 */
function CsvPath({ cloud, collectable, onNext }: { readonly cloud: Cloud; readonly collectable: boolean; readonly onNext: () => void }): ReactElement {
  return (
    <section aria-labelledby="cc-prep-csv-h" className="cc-stack cc-gap-2">
      <h2 id="cc-prep-csv-h">{t("cc.prep.path1.title")}</h2>
      {cloud === "aws" ? (
        <>
          <ol className="cc-steps" role="list">
            {CSV_AWS_STEPS.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
          <ul className="cc-ul" role="list">
            <li>{t("cc.prep.csv.aws.cache")}</li>
            <li>{t("cc.prep.csv.aws.alias")}</li>
            <li>{t("cc.prep.csv.aws.perm")}</li>
          </ul>
        </>
      ) : collectable ? (
        <>
          <ol className="cc-steps" role="list">
            {CSV_AZURE_STEPS.map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ol>
          <p>{t("cc.prep.csv.azure.unproven")}</p>
          {RG_QUERIES.map((q) => (
            <div key={q.id} className="cc-stack cc-gap-2">
              <h3>{t(q.kind === "csv-rg-storage" ? "cc.prep.csv.azure.kql-storage" : "cc.prep.csv.azure.kql-nsg")}</h3>
              <CliBlock kql={{ id: q.id, text: q.kql }} />
            </div>
          ))}
        </>
      ) : null}
      <p>
        <button type="button" className="cc-btn cc-btn--primary" onClick={onNext}>
          {t("cc.prep.next.cta")}
        </button>
      </p>
    </section>
  );
}
