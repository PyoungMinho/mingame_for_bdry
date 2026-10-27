// src/app/cloudcheck/_client/components/CliBlock.tsx — 관문 ④: 명령·쿼리·직접 입력 줄. 복사 버튼은 어디에도 없다(R-11, ClickFix 방어). 디자인 최종안 §5-1.
//  - read: 읽기 명령(조회용 예시) / write: 쓰기 명령(두꺼운 잉크 테두리 + 반전 머리표, V4에서만 나온다) / kql: Resource Graph 쿼리 / typed: V1의 직접 입력 두 줄.
//  - 자리표시자(ph)는 <span class="cc-ph">&lt;이름&gt;</span> — 꺾쇠를 그대로 둬서 복사해 붙여 넣어도 실행되지 않는다. 숨김 낭독 글자를 넣지 않는다(복사 결과가 깨진다).
//  - 블록은 래퍼 <div class="cc-cmdw">로 묶는다: 기준안의 .cc-cmd{margin:0}이 .cc-stack의 간격(같은 구체성, 뒤에 선언)을 지워 설명 문단과 블록이 붙어 버리므로, 간격은 래퍼가 받는다.
//  - 전체 선택(user-select:all)은 KQL 블록뿐(CSS). 키보드로 포커스가 들어오면 Selection API로 전체를 고른다(클립보드 API 아님).
import { useId, useRef, type FocusEvent, type ReactElement } from "react";
import type { CliTemplate } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { cx } from "./cx";
import "./CliBlock.css";

export type CliBlockProps =
  | { readonly cmd: CliTemplate; readonly demo?: boolean } // cmd.kind로 읽기/쓰기를 정한다. 쓰기 블록은 V4에서만 나온다
  | { readonly kql: { readonly id: string; readonly text: string } } // contract/rg-queries.ts(Azure CSV 경로)
  | { readonly typed: string }; // V1의 직접 입력 두 줄(sha256sum·bash)

/** 현재 선택을 요소 안 전체로(키보드 포커스용). 클립보드를 만지지 않는다 */
function selectAllChildren(el: HTMLElement): void {
  const sel = typeof window.getSelection === "function" ? window.getSelection() : null;
  if (sel !== null) sel.selectAllChildren(el);
}

export function CliBlock(props: CliBlockProps): ReactElement {
  const hintId = useId();
  const codeRef = useRef<HTMLElement>(null);

  if ("kql" in props) {
    return (
      <div className="cc-cmdw">
        <figure className="cc-cmd cc-cmd--kql" translate="no">
          <figcaption className="cc-cmd__cap">{t("cc.c.cli.kql-head")}</figcaption>
          <pre
            className="cc-cmd__pre"
            tabIndex={0}
            aria-describedby={hintId}
            onFocus={(e: FocusEvent<HTMLPreElement>) => {
              if (codeRef.current !== null && e.currentTarget === e.target) selectAllChildren(codeRef.current);
            }}
          >
            <code ref={codeRef}>{props.kql.text}</code>
          </pre>
        </figure>
        <p id={hintId} className="cc-hint">
          {t("cc.c.cli.select-hint")}
        </p>
      </div>
    );
  }

  if ("typed" in props) {
    return (
      <div className="cc-cmdw">
        <figure className="cc-cmd cc-cmd--typed" translate="no">
          <figcaption className="cc-cmd__cap">{t("cc.c.cli.typed-head")}</figcaption>
          <pre className="cc-cmd__pre" tabIndex={0}>
            <code>{props.typed}</code>
          </pre>
        </figure>
      </div>
    );
  }

  const { cmd, demo = false } = props;
  const isWrite = cmd.kind === "write";
  const hasPlaceholder = cmd.segments.some((s) => s.t === "ph");
  return (
    <div className="cc-cmdw">
      {isWrite && demo ? <p className="cc-hint">{t("cc.c.cli.demo-note")}</p> : null}
      <figure className={cx("cc-cmd", isWrite ? "cc-cmd--write" : "cc-cmd--read")} translate="no">
        <figcaption className="cc-cmd__cap">{t(isWrite ? "cc.c.cli.write-head" : "cc.c.cli.read-head")}</figcaption>
        <pre className="cc-cmd__pre" tabIndex={0}>
          <code>
            {cmd.segments.map((seg, i) =>
              seg.t === "text" ? (
                seg.v
              ) : (
                <span key={i} className="cc-ph">
                  {`<${t(seg.key)}>`}
                </span>
              ),
            )}
          </code>
        </pre>
      </figure>
      {hasPlaceholder ? <p className="cc-hint">{t("cc.c.cli.placeholder-note")}</p> : null}
      {isWrite ? <p className="cc-hint">{t("cc.c.cli.no-copy")}</p> : null}
    </div>
  );
}
