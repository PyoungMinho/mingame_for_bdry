// src/app/cloudcheck/_client/components/Print.tsx — 인쇄 옵션(PrintOptions)과 인쇄 머리(PrintHead). 디자인 최종안 §4-4·§5-2.
//  - PrintOptions: 범위 라디오(전체/직접 볼 목록만) + '이름·ID 표시' 체크(기본 꺼짐) + [인쇄 창 열기]. 옵션은 인쇄 버튼 흐름에서만 루트 클래스로 쓰인다(state/print.ts) —
//    브라우저 메뉴(Ctrl+P) 인쇄는 언제나 전체 리포트 + 마스킹. 이 사실을 cc.c.print.unmask-scope로 알린다.
//  - PrintHead: 화면에서는 숨고(cc-print-only) 인쇄 첫 쪽에만 나온다. 전체/목록 두 벌(.cc-phead--full|--list)을 둘 다 그리면 print.css가 루트 클래스로 고른다.
//    도장·서명란·'확인자'·'판정' 칸은 만들지 않는다(인증서로 오용되지 않게). 마스킹 안내는 cc-mask-short/full 이중 렌더로 cc-print-unmask에 따라 바뀐다.
import { useState, type ReactElement } from "react";
import type { Report } from "../../../../lib/cloudcheck/model/report";
import { fmtTime, t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { cx } from "./cx";
import { MaskedValue } from "./MaskedValue";
import { CLOUD_NAME } from "./names";
import { S_KEY } from "./s-keys";
import { T } from "./T";
import "./actions.css";
import "./PrintOptions.css";

export interface PrintRequest {
  readonly scope: "full" | "list";
  readonly unmask: boolean;
}

export interface PrintOptionsProps {
  readonly onPrint: (o: PrintRequest) => void;
}

export function PrintOptions({ onPrint }: PrintOptionsProps): ReactElement {
  const [scope, setScope] = useState<PrintRequest["scope"]>("full");
  const [unmask, setUnmask] = useState(false);
  return (
    <fieldset className="cc-popt">
      <legend>{t("cc.c.print.heading")}</legend>
      <label className="cc-opt">
        <input type="radio" name="cc-print-scope" value="full" checked={scope === "full"} onChange={() => setScope("full")} />
        {t("cc.c.print.scope.full")}
      </label>
      <label className="cc-opt">
        <input type="radio" name="cc-print-scope" value="list" checked={scope === "list"} onChange={() => setScope("list")} />
        {t("cc.c.print.scope.list")}
      </label>
      <label className="cc-opt">
        <input type="checkbox" checked={unmask} onChange={(e) => setUnmask(e.target.checked)} />
        {t("cc.c.print.unmask")}
      </label>
      <p className="cc-hint">
        {t("cc.c.print.unmask-note")} {t("cc.c.print.unmask-scope")}
      </p>
      <button type="button" className="cc-btn" onClick={() => onPrint({ scope, unmask })}>
        {t("cc.c.print.go")}
      </button>
    </fieldset>
  );
}

export interface PrintHeadProps {
  readonly report: Report;
  readonly kind: "full" | "list";
  /** 페이지 버전(config.ts PAGE_VERSION). 없으면 '-' */
  readonly pageVersion?: string;
}

function rangeLine(report: Report): string {
  const s = report.scope;
  return s.unit === "region"
    ? t("cc.c.scope.range.region", { checked: s.checked ?? 0, visible: s.visible ?? 0 })
    : s.unit === "subscription"
      ? t("cc.c.scope.range.subscription", { checked: s.checked ?? 0, visible: s.visible ?? 0 })
      : t("cc.c.scope.range.none");
}

export function PrintHead({ report, kind, pageVersion }: PrintHeadProps): ReactElement {
  const full = kind === "full";
  const d = report.distribution.rules;
  const at = report.collection.asOf;
  const versions = Array.from(new Set(report.collection.inputs.flatMap((i) => (i.collector === null ? [] : [i.collector.version]))));
  return (
    <div className={cx("cc-print-only", `cc-phead--${kind}`)}>
      <p>
        <strong>{t(full ? "cc.c.print.header" : "cc.c.print.header-list")}</strong>
      </p>
      {report.mode.kind === "demo" ? <p className="cc-print-demo">{t("cc.c.print.demo-header")}</p> : null}
      <p>
        <AccountLabel alias={report.identity.alias} last4={report.identity.accountLast4} /> · {CLOUD_NAME[report.identity.cloud]}
        {full ? ` · ${rangeLine(report)}` : ""}
      </p>
      <p>
        {at === null ? null : (
          <>
            <time dateTime={at.at}>{fmtTime(at.at, "full")}</time>
            {versions.length === 0 ? "" : ` · ${versions.join(", ")}`}
          </>
        )}
        {full ? (
          <>
            {report.collection.inputs.length === 0 ? null : " · "}
            {report.collection.inputs.map((input, i) => (
              <span key={input.index}>
                {i > 0 ? ", " : ""}
                <MaskedValue value={input.name} />
              </span>
            ))}
          </>
        ) : null}
        {" · "}
        {t(S_KEY.footerVersions, { page: pageVersion ?? "-", ruleset: report.engine.rulesetVersion })}
      </p>
      <p>
        <span className="cc-mask-short">{t("cc.c.print.masked-note")}</span>
        <span className="cc-mask-full">{t("cc.c.print.unmasked-note")}</span>
      </p>
      {full ? null : (
        <>
          <p>
            <T k="cc.c.dist.sentence" p={{ total: d.total, risk: d.risk, caution: d.caution, unknown: d.unknown, clear: d.clear, na: d.na }} />
          </p>
          <p>{t("cc.c.print.list-note")}</p>
        </>
      )}
    </div>
  );
}
