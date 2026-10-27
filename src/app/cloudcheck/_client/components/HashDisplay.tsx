// src/app/cloudcheck/_client/components/HashDisplay.tsx — SHA-256 해시 표시(64자). 디자인 최종안 §5-2·UI §4-3.
//  - 8자리씩 <span class="cc-hash__g"> 8개 + <wbr>(공백 문자 없음) — 간격은 CSS margin이라 복사하면 64자가 이어진 그대로 나온다.
//  - 클릭 한 번에 전체 선택(CSS user-select:all), 키보드로 포커스가 들어오면 Selection.selectAllChildren(클립보드 API 아님). 복사 버튼 없음.
//  - aria-label은 고정 문구 'SHA-256 해시, 64자'(role=group)이고 값은 8자리씩 읽을 수 있다. 일치·불일치 판정 UI는 만들지 않는다(Q13).
import { Fragment, useId, type FocusEvent, type ReactElement } from "react";
import { t } from "../i18n/index";
import "./HashDisplay.css";

export interface HashDisplayProps {
  /** 64자 16진 문자열(소문자) */
  readonly hex: string;
  /** 설명을 더하는 다른 요소 id */
  readonly describedBy?: string;
}

export function groupsOf8(hex: string): readonly string[] {
  const out: string[] = [];
  for (let i = 0; i < hex.length; i += 8) out.push(hex.slice(i, i + 8));
  return out;
}

export function HashDisplay({ hex, describedBy }: HashDisplayProps): ReactElement {
  const hintId = useId();
  const groups = groupsOf8(hex);
  return (
    <>
      <code
        className="cc-hash"
        translate="no"
        tabIndex={0}
        role="group"
        aria-label={t("cc.c.hash.aria")}
        aria-describedby={describedBy === undefined ? hintId : `${hintId} ${describedBy}`}
        onFocus={(e: FocusEvent<HTMLElement>) => {
          if (e.currentTarget !== e.target) return;
          const sel = typeof window.getSelection === "function" ? window.getSelection() : null;
          if (sel !== null) sel.selectAllChildren(e.currentTarget);
        }}
      >
        {groups.map((g, i) => (
          <Fragment key={i}>
            <span className="cc-hash__g">{g}</span>
            {i < groups.length - 1 ? <wbr /> : null}
          </Fragment>
        ))}
      </code>
      <p id={hintId} className="cc-hint">
        {t("cc.c.hash.hint")}
      </p>
    </>
  );
}
