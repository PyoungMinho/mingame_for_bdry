// src/app/cloudcheck/_client/components/ScopePanel.tsx — 조회 범위 패널(접을 수 없음, R-03). 디자인 최종안 §5-2·§7-1.
//  - 행: 신원 · 범위 · 수집 · 권한 · 문별 수집 + 못 보는 것 7가지(전부 노출). 판정을 읽기 전에 '어디까지 봤는지'를 먼저 보이는 영역이다.
//  - 신원은 '별칭 + ••••끝4자리'(전체 계정 ID는 그리지 않는다, D4). 사용자 데이터는 모두 MaskedValue/T로 — 속성에는 한 글자도 넣지 않는다.
//  - 거부된 호출·권한 해제 힌트는 각각 상위 3개를 바로 보이고 나머지는 접힘(인쇄 펼침, 버튼은 인쇄에서 숨김). '호출 기록 자세히'는 접힘(인쇄 숨김).
//  - 권한 해제 힌트는 UnknownTone(할 일 톤, 도형·'확인 불가' 글자 없음).
//  - 콘솔 사용자가 0명이라 IdP MFA를 못 본 경우(직접 볼 목록에 AWS-MFA-2 auto-notice)에는 '못 보는 것'의 IdP 줄을 굵게 하고 설명을 붙인다.
import { Fragment, type ReactElement, type ReactNode } from "react";
import {
  DOORS,
  type CollectionBlock,
  type DeniedCall,
  type IdentityBlock,
  type InputSummary,
  type PermissionHint,
  type ReceiptResult,
  type Report,
  type ScopeBlock,
} from "../../../../lib/cloudcheck/model/report";
import { fmtBytes, fmtNum, fmtTime, t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { DoorCollectionRow } from "./DoorCollectionRow";
import { DOM_ID } from "./dom-ids";
import { FoldButton, FoldRegion, useFold } from "./Fold";
import { MaskedValue } from "./MaskedValue";
import { CLOUD_NAME } from "./names";
import { Msg, T } from "./T";
import { UnknownTone } from "./UnknownTone";
import "./actions.css";
import "./ScopePanel.css";

export interface ScopePanelProps {
  readonly report: Report;
  /** 직접 볼 목록으로 이동(IdP MFA 설명 줄의 버튼) */
  readonly onShowManual: () => void;
  /** '못 막는 경로 4가지 →'(V8) — 앱 안 이동이라 버튼. 없으면 그리지 않는다 */
  readonly onShowPaths?: () => void;
}

const TOP = 3;
const RECEIPT_KINDS: readonly ReceiptResult[] = ["ok", "empty", "notconfigured", "denied", "error", "throttled", "truncated", "unsupported"];

function Row({ label, children }: { readonly label: string; readonly children: ReactNode }): ReactElement {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Code({ children }: { readonly children: string }): ReactElement {
  return <code className="cc-mono">{children}</code>;
}

/* ───────── 신원 ───────── */
function IdentityRow({ identity }: { readonly identity: IdentityBlock }): ReactElement {
  return (
    <ul className="cc-stack cc-gap-2" role="list">
      <li>
        <AccountLabel alias={identity.alias} last4={identity.accountLast4} /> · {CLOUD_NAME[identity.cloud]}
      </li>
      <li>
        <T
          k="cc.c.scope.run-as"
          p={{ type: t(`cc.c.scope.principal.${identity.principalType}`), name: identity.principalName === null ? "" : { v: identity.principalName } }}
        />
      </li>
      {identity.currentSubscription === null ? null : (
        <li>
          <T k="cc.c.scope.current-sub" p={{ sub: { v: identity.currentSubscription } }} />
        </li>
      )}
      <li className="cc-small cc-muted">
        {t(`cc.c.scope.id-source.${identity.source}`)} · {t(`cc.c.scope.confirmed.${identity.confirmed ?? "none"}`)}
      </li>
    </ul>
  );
}

/* ───────── 범위 ───────── */
function RangeRow({ scope }: { readonly scope: ScopeBlock }): ReactElement {
  const fold = useFold("scope-subs", false);
  const line =
    scope.unit === "region"
      ? t("cc.c.scope.range.region", { checked: scope.checked ?? 0, visible: scope.visible ?? 0 })
      : scope.unit === "subscription"
        ? t("cc.c.scope.range.subscription", { checked: scope.checked ?? 0, visible: scope.visible ?? 0 })
        : t("cc.c.scope.range.none");
  const missingKey = scope.unit === "subscription" ? "cc.c.scope.range.missing-subscription" : "cc.c.scope.range.missing-region";
  return (
    <div className="cc-stack cc-gap-2">
      <p>{line}</p>
      {scope.missing.length === 0 ? null : (
        <p>
          <T
            k={missingKey}
            p={{
              names: (
                <>
                  {scope.missing.map((m, i) => (
                    <Fragment key={i}>
                      {i > 0 ? ", " : ""}
                      <MaskedValue value={m.name} />(<Msg m={{ code: m.reason }} short />)
                    </Fragment>
                  ))}
                </>
              ),
            }}
          />
        </p>
      )}
      {scope.outOfScope.length === 0 ? null : (
        <p>
          <T
            k="cc.c.scope.range.out-of-scope"
            p={{
              names: (
                <>
                  {scope.outOfScope.map((o, i) => (
                    <Fragment key={i}>
                      {i > 0 ? ", " : ""}
                      <MaskedValue value={o.name} />({t(`cc.c.scope.oos.${o.reason}`)})
                    </Fragment>
                  ))}
                </>
              ),
            }}
          />
        </p>
      )}
      {scope.proven ? null : (
        <p>
          <strong>{t("cc.c.scope.range.unproven")}</strong>
        </p>
      )}
      {scope.subscriptions.length === 0 ? null : (
        <div>
          <FoldButton fold={fold}>{t("cc.c.scope.subs.heading")}</FoldButton>
          <FoldRegion fold={fold} print="expand">
            <ul className="cc-stack cc-gap-2 cc-small" role="list">
              {scope.subscriptions.map((s, i) => (
                <li key={i}>
                  <MaskedValue value={s.name} /> · <MaskedValue value={s.id} /> · {s.state} · {t(`cc.c.scope.subs.${s.queried}`)}
                </li>
              ))}
            </ul>
          </FoldRegion>
        </div>
      )}
    </div>
  );
}

/* ───────── 수집 ───────── */
function inputLines(inputs: readonly InputSummary[]): ReactElement {
  return (
    <ul className="cc-stack cc-gap-2" role="list">
      {inputs.map((input) => (
        <li key={input.index}>
          <div>
            <MaskedValue value={input.name} /> · {t(`cc.c.rlist.kind.${input.kind}`)} · {t(`cc.c.scope.inputs.via.${input.via}`)} · {fmtBytes(input.bytes)}
          </div>
          <div className="cc-small">
            {input.asOf === null ? null : <time dateTime={input.asOf.at}>{fmtTime(input.asOf.at, "full")}</time>}
            {input.collector === null ? null : (
              <>
                {" · "}
                <span className="cc-mono">{`${input.collector.name} ${input.collector.version}`}</span>
                {input.collector.knownRelease === null ? "" : ` (${t(input.collector.knownRelease ? "cc.c.scope.inputs.known-release" : "cc.c.scope.inputs.unknown-release")})`}
              </>
            )}
            {input.schema === null ? null : (
              <>
                {" · "}
                <span className="cc-mono">{input.schema.id}</span>
                {input.schema.support === "exact" ? "" : ` (${t(input.schema.support === "newer-minor" ? "cc.c.scope.inputs.schema-newer" : "cc.c.scope.inputs.schema-older")})`}
              </>
            )}
            {" · "}
            {t(input.scopeProven ? "cc.c.scope.inputs.proven" : "cc.c.scope.inputs.unproven")}
          </div>
          <div className="cc-small cc-muted">
            {DOORS.map((d) => `${t(`cc.door.${d}.name`)} ${t(`cc.c.scope.inputs.door-${input.doors[d]}`)}`).join(" · ")}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CollectRow({ report }: { readonly report: Report }): ReactElement {
  const fold = useFold("scope-collect-detail", false);
  const c: CollectionBlock = report.collection;
  const r = c.receipts;
  const versions = [...new Set(c.inputs.flatMap((i) => (i.collector === null ? [] : [i.collector.version])))];
  const demo = report.mode.kind === "demo";
  const cred = c.credentialReport;
  return (
    <div className="cc-stack cc-gap-2">
      {versions.length > 0 ? (
        <p>
          <T
            k="cc.c.scope.collect.line"
            p={{
              t: c.asOf === null ? "-" : { t: c.asOf.at },
              version: versions.join(", "),
              ok: r.ok + r.empty + r.notconfigured,
              denied: r.denied,
              error: r.error + r.unsupported + r.throttled,
              truncated: r.truncated,
            }}
          />
        </p>
      ) : (
        <>
          <p>{t("cc.c.scope.collect.no-receipts")}</p>
          {c.asOf === null ? null : (
            <p>
              <T k="cc.ctx.asof" p={{ t: { t: c.asOf.at } }} />
            </p>
          )}
        </>
      )}
      {c.asOfRange === null ? null : (
        <p>
          <T k="cc.c.scope.collect.range" p={{ oldest: { t: c.asOfRange.oldest }, newest: { t: c.asOfRange.newest } }} />
        </p>
      )}
      {cred === null ? null : (
        <p>
          <T
            k="cc.c.scope.collect.credential"
            p={{ t: cred.generatedAt === null ? "-" : { t: cred.generatedAt }, source: t(`cc.c.scope.collect.credential-source.${cred.source}`) }}
          />
        </p>
      )}
      {demo ? <p className="cc-small cc-muted">{t("cc.c.scope.demo-fixed-time")}</p> : null}
      <div>
        <FoldButton fold={fold} noPrint>
          {t("cc.c.scope.collect.detail")}
        </FoldButton>
        <FoldRegion fold={fold} print="hide">
          <div className="cc-stack cc-gap-2">
            <table>
              <tbody>
                {RECEIPT_KINDS.map((kind) => (
                  <tr key={kind}>
                    <th scope="row">{t(`cc.c.scope.receipt.${kind}`)}</th>
                    <td>{fmtNum(r[kind])}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>{t("cc.c.scope.receipt.total", { n: r.total })}</td>
                </tr>
              </tfoot>
            </table>
            <h3>{t("cc.c.scope.inputs.heading")}</h3>
            {inputLines(c.inputs)}
          </div>
        </FoldRegion>
      </div>
    </div>
  );
}

/* ───────── 권한 ───────── */
function DeniedLine({ d }: { readonly d: DeniedCall }): ReactElement {
  return (
    <li>
      <T
        k="cc.c.scope.perm.denied-line"
        p={{ call: <Code>{d.call}</Code>, scope: { v: d.scope }, errorCode: d.errorCode, times: d.times, rules: d.ruleIds.length }}
      />
      {d.permission !== null && d.permission !== d.call ? (
        <>
          {" "}
          <span className="cc-small cc-muted">
            <T k="cc.c.scope.perm.need" p={{ permission: <Code>{d.permission}</Code> }} />
          </span>
        </>
      ) : null}
    </li>
  );
}

function HintTone({ h }: { readonly h: PermissionHint }): ReactElement {
  return (
    <UnknownTone as="p">
      <T k="cc.c.scope.perm.hint" p={{ permission: <Code>{h.permission}</Code>, rules: h.unlocks.length, items: h.total }} />
    </UnknownTone>
  );
}

function PermRow({ report }: { readonly report: Report }): ReactElement {
  const deniedFold = useFold("scope-denied-more", false);
  const hintFold = useFold("scope-hints-more", false);
  const { denied, unlockHints } = report.permissions;
  const hintTop = unlockHints.slice(0, TOP);
  const hintRest = unlockHints.slice(TOP);
  return (
    <div className="cc-stack cc-gap-2">
      {hintTop.map((h) => (
        <HintTone key={h.permission} h={h} />
      ))}
      {hintRest.length === 0 ? null : (
        <div>
          <FoldButton fold={hintFold} noPrint>
            {t("cc.c.scope.perm.more-hints", { n: hintRest.length })}
          </FoldButton>
          <FoldRegion fold={hintFold} print="expand">
            <div className="cc-stack cc-gap-2">
              {hintRest.map((h) => (
                <HintTone key={h.permission} h={h} />
              ))}
            </div>
          </FoldRegion>
        </div>
      )}
      {denied.length === 0 ? (
        <p>{t("cc.c.scope.perm.none")}</p>
      ) : (
        <>
          <p>
            <strong>{t("cc.c.scope.perm.denied-heading", { n: denied.length })}</strong>
          </p>
          <ul className="cc-stack cc-gap-2 cc-small" role="list">
            {denied.slice(0, TOP).map((d, i) => (
              <DeniedLine key={i} d={d} />
            ))}
          </ul>
          {denied.length <= TOP ? null : (
            <div>
              <FoldButton fold={deniedFold} noPrint>
                {t("cc.c.scope.perm.more", { n: denied.length - TOP })}
              </FoldButton>
              <FoldRegion fold={deniedFold} print="expand">
                <ul className="cc-stack cc-gap-2 cc-small" role="list">
                  {denied.slice(TOP).map((d, i) => (
                    <DeniedLine key={i} d={d} />
                  ))}
                </ul>
              </FoldRegion>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── 패널 ───────── */
export function ScopePanel({ report, onShowManual, onShowPaths }: ScopePanelProps): ReactElement {
  const idpEmphasis = report.manualChecklist.some((m) => m.origin === "auto-notice" && m.ruleId === "AWS-MFA-2");
  return (
    <section className="cc-scope" aria-labelledby={DOM_ID.scope} id="cc-scope">
      <h2 id={DOM_ID.scope} tabIndex={-1}>
        {t("cc.c.scope.heading")}
      </h2>
      <p className="cc-hint">{t("cc.c.scope.fixed-note")}</p>
      <dl className="cc-scope__dl">
        <Row label={t("cc.c.scope.identity")}>
          <IdentityRow identity={report.identity} />
        </Row>
        <Row label={t("cc.c.scope.range")}>
          <RangeRow scope={report.scope} />
        </Row>
        <Row label={t("cc.c.scope.collect")}>
          <CollectRow report={report} />
        </Row>
        <Row label={t("cc.c.scope.perm")}>
          <PermRow report={report} />
        </Row>
        <Row label={t("cc.c.scope.doors-label")}>
          <DoorCollectionRow
            rows={report.doors.map((d) => ({ door: d.door, status: d.collection.status, judgeLevel: d.collection.judgeLevel, reason: d.collection.reason }))}
          />
        </Row>
      </dl>
      <div className="cc-stack cc-gap-2">
        <div className="cc-hrow">
          <h3>{t("cc.c.scope.cannot-heading")}</h3>
          {onShowPaths === undefined ? null : (
            <button type="button" className="cc-link cc-noprint" onClick={onShowPaths}>
              {t("cc.c.scope.paths-link")}
            </button>
          )}
        </div>
        <ul className="cc-scope__cannot" role="list">
          {report.cannotSee.map((code) => (
            <li key={code}>
              {code === "idp-mfa" && idpEmphasis ? (
                <>
                  <strong>{t(`cc.gcs.${code}`)}</strong> {t("cc.gcs.idp-mfa.emphasis")}{" "}
                  <button type="button" className="cc-link cc-noprint" onClick={onShowManual}>
                    {t("cc.c.rule.manual")}
                  </button>
                </>
              ) : (
                t(`cc.gcs.${code}`)
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
