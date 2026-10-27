// src/app/cloudcheck/_client/components/FileRecognitionList.tsx — 읽은 파일 목록(V2 C4). 디자인 최종안 §5-2·UX §4-3.
//  - 표(cc-fr cc-ct) 7열: 파일 · 종류 · 계정 · 수집 시각 · 담긴 곳 · 상태 · [빼기]. 이름은 MaskedValue(붙여넣기는 '붙여넣은 내용 n'), 정상 행은 무채색 글자 '읽었습니다'(초록 아님).
//  - 실패 행 아래 줄에 확인 불가 톤 패널(UnknownTone — 도형·'확인 불가' 글자 없음): 제목(굵게) → 이유 → 이런 경우가 많습니다 → 다음 행동. detail의 파라미터(line·col·tail·major)를 그대로 넘긴다.
//  - 비교 모드(compareLast4)에서는 계정 칸에 '비교 대상과 같은/다른 계정입니다'. [빼기]의 접근 이름 = 버튼 글자 + 파일 이름(aria-labelledby — 이름을 속성에 넣지 않는다).
//  - DOM id에는 파일 이름을 넣지 않는다(행 번호로만).
import { Fragment, useId, type ReactElement, type ReactNode } from "react";
import type { DoorId, InputRecognition, MsgParam } from "../../../../lib/cloudcheck/model/report";
import { fmtBytes, fmtTime, t } from "../i18n/index";
import { AccountLabel } from "./AccountLabel";
import { cx } from "./cx";
import { Icon } from "./Icon";
import { MaskedValue } from "./MaskedValue";
import { CLOUD_NAME } from "./names";
import { T } from "./T";
import { UnknownTone } from "./UnknownTone";
import "./table-card.css";
import "./FileRecognitionList.css";

export interface FileRecognitionListProps {
  readonly recs: readonly InputRecognition[];
  readonly onRemove: (index: number) => void;
  /** 비교 모드: 비교 대상 계정의 끝 4자리. 아니면 null */
  readonly compareLast4: string | null;
  /** 읽은(ok) 줄 바로 아래에 보일 안내 한 줄(없으면 null). 글자는 페이지가 만든다(예: D-6 붙여 넣은 CSV의 기준 시각 안내) */
  readonly rowNote?: (rec: InputRecognition, index: number) => ReactNode | null;
}

const COL_COUNT = 7;

/** 실패(읽지 못함·거부·쓰지 않음) 패널의 이유 줄 */
function ReasonLine({ rec }: { readonly rec: InputRecognition }): ReactElement {
  const d = rec.detail ?? undefined;
  const status = rec.status;
  if (status === "parse-error" && d !== undefined && "maybeTruncated" in d && "tail" in d) {
    return <T k="cc.recog.parse-error.reason-truncated" p={d} />;
  }
  if (status === "not-cloudcheck" && d !== undefined && hintIs(d.hint, "exceptions-file")) {
    return <T k="cc.recog.not-cloudcheck.exceptions-file" />;
  }
  return <T k={`cc.recog.${status}.reason`} p={d} />;
}

function hintIs(p: MsgParam | undefined, value: string): boolean {
  return p !== undefined && "c" in p && p.c === value;
}

function Doors({ doors }: { readonly doors: readonly DoorId[] }): ReactElement {
  return <>{doors.map((d) => t(`cc.door.${d}.name`)).join(" ")}</>;
}

export function FileRecognitionList({ recs, onRemove, compareLast4, rowNote }: FileRecognitionListProps): ReactElement {
  const tid = useId();
  return (
    <section>
      <h2>{t("cc.c.rlist.heading")}</h2>
      {recs.length === 0 ? (
        <p>{t("cc.c.rlist.empty")}</p>
      ) : (
        <table className="cc-fr cc-ct" role="table">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.file")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.kind")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.account")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.asof")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.doors")}
              </th>
              <th scope="col" role="columnheader">
                {t("cc.c.rlist.col.status")}
              </th>
              <th scope="col" role="columnheader">
                <span className="cc-vh">{t("cc.c.rlist.remove")}</span>
              </th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {recs.map((rec, i) => {
              const nameId = `${tid}-n${i}`;
              const btnId = `${tid}-b${i}`;
              const ok = rec.status === "ok";
              const approx = rec.asOf !== null && (rec.asOf.source === "filename" || rec.asOf.source === "file-time");
              const preview = rec.identityPreview;
              const note = ok && rowNote !== undefined ? rowNote(rec, i) : null;
              return (
                <Fragment key={i}>
                  <tr role="row" className={cx("cc-fr__row", rec.status === "superseded" && "cc-fr__row--superseded")}>
                    <td role="cell" data-label={t("cc.c.rlist.col.file")}>
                      <Icon name="file" size={20} />{" "}
                      <span id={nameId}>{rec.via === "paste" ? t("cc.c.rlist.via.paste", { n: i + 1 }) : <MaskedValue value={rec.name} />}</span>{" "}
                      <span className="cc-fr__size">{fmtBytes(rec.bytes)}</span>
                    </td>
                    <td role="cell" data-label={t("cc.c.rlist.col.kind")}>
                      {rec.kind === null ? null : t(`cc.c.rlist.kind.${rec.kind}`)}
                    </td>
                    <td role="cell" data-label={t("cc.c.rlist.col.account")}>
                      {preview === null ? null : (
                        <>
                          <AccountLabel alias={preview.alias} last4={preview.accountLast4} /> · {CLOUD_NAME[preview.cloud]}
                          {compareLast4 === null ? null : (
                            <>
                              <br />
                              {t(preview.accountLast4 === compareLast4 ? "cc.c.rlist.compare-same" : "cc.c.rlist.compare-diff")}
                            </>
                          )}
                        </>
                      )}
                    </td>
                    <td role="cell" data-label={t("cc.c.rlist.col.asof")}>
                      {rec.asOf === null ? null : (
                        <>
                          <time dateTime={rec.asOf.at}>{fmtTime(rec.asOf.at, "full")}</time>
                          {approx ? <span className="cc-small cc-muted"> {t("cc.c.rlist.asof-approx")}</span> : null}
                        </>
                      )}
                    </td>
                    <td role="cell" data-label={t("cc.c.rlist.col.doors")}>
                      <Doors doors={rec.doors} />
                    </td>
                    <td role="cell" data-label={t("cc.c.rlist.col.status")}>
                      {ok ? t("cc.c.rlist.ok") : t(`cc.recog.${rec.status}.title`)}
                    </td>
                    <td role="cell">
                      <button type="button" id={btnId} className="cc-btn cc-btn--ghost cc-btn--sm" aria-labelledby={`${btnId} ${nameId}`} onClick={() => onRemove(i)}>
                        <Icon name="close" size={16} /> {t("cc.c.rlist.remove")}
                      </button>
                    </td>
                  </tr>
                  {note === null || note === undefined ? null : (
                    <tr role="row">
                      <td role="cell" colSpan={COL_COUNT} className="cc-fr__panel">
                        <p className="cc-hint">{note}</p>
                      </td>
                    </tr>
                  )}
                  {ok ? null : (
                    <tr role="row">
                      <td role="cell" colSpan={COL_COUNT} className="cc-fr__panel">
                        <UnknownTone>
                          <p>
                            <strong>{t(`cc.recog.${rec.status}.title`)}</strong>
                          </p>
                          <p>
                            <ReasonLine rec={rec} />
                          </p>
                          <p>
                            <span className="cc-small">{t("cc.c.rlist.often")}</span> {t(`cc.recog.${rec.status}.hint`)}
                          </p>
                          <p>
                            <span className="cc-small">{t("cc.c.rlist.next")}</span> {t(`cc.recog.${rec.status}.next`)}
                          </p>
                        </UnknownTone>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
