// src/app/cloudcheck/_client/components/PromiseBlock.tsx — 약속·고지 블록. 디자인 최종안 §5-2.
//  - full(V0·V8): 한 줄 약속 + 무전송 약속 + 직접 확인하는 방법 링크 + 고지 / short(V2): 무전송 약속 + 고지. **고지(caveat)는 약속 바로 아래 항상.**
//  - '직접 확인하는 방법 3가지 →'는 앱 안 이동이라 href 없는 버튼이다 → onVerify가 있을 때만 그린다(V0는 A9로 포커스, V2·V8은 화면 이동 — 동작은 페이지가 정한다).
//  - V0는 A4의 큰 글자(.cc-display)가 한 줄 약속을 이미 그리므로 hideLine으로 중복을 막는다(.cc-display는 V0 한 곳에만 쓴다).
import type { ReactElement } from "react";
import { t } from "../i18n/index";
import "./PromiseBlock.css";

export interface PromiseBlockProps {
  readonly variant: "full" | "short";
  /** '직접 확인하는 방법 3가지 →' 버튼의 동작(앱 안 이동). 없으면 버튼을 그리지 않는다 */
  readonly onVerify?: () => void;
  /** full에서 한 줄 약속을 그리지 않는다(V0 A4가 이미 그림) */
  readonly hideLine?: boolean;
}

export function PromiseBlock({ variant, onVerify, hideLine = false }: PromiseBlockProps): ReactElement {
  return (
    <div className="cc-promise">
      {variant === "full" && !hideLine ? (
        <p>
          <strong>{t("cc.promise.line")}</strong>
        </p>
      ) : null}
      <p>
        {t("cc.promise.no-send")}
        {onVerify === undefined ? null : (
          <>
            {" "}
            <button type="button" className="cc-link" onClick={onVerify}>
              {t("cc.promise.verify-link")}
            </button>
          </>
        )}
      </p>
      <p className="cc-caveat">{t("cc.promise.caveat")}</p>
    </div>
  );
}
