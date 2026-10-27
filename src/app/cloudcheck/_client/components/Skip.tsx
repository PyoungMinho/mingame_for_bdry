// src/app/cloudcheck/_client/components/Skip.tsx — 건너뛰기 버튼과 구역 이동. 문서 안 이동에 href="#…"를 쓰지 않는다(URL 해시 불변, Q16) — 버튼 + focus().
import type { ReactElement } from "react";
import type { CatalogKey } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { S_KEY } from "./s-keys";
import "./Skip.css";

export interface SkipButtonProps {
  /** 포커스를 줄 요소(<main tabIndex={-1}>) */
  readonly target: () => HTMLElement | null;
}

/** 첫 번째 포커스 가능 요소. 평소엔 화면 밖, 포커스를 받으면 왼쪽 위에 잉크 반전 블록으로 나타난다 */
export function SkipButton({ target }: SkipButtonProps): ReactElement {
  return (
    <button
      type="button"
      className="cc-skip"
      onClick={() => {
        const el = target();
        if (el !== null) el.focus();
      }}
    >
      {t("cc.hdr.skip")}
    </button>
  );
}

export interface JumpItem {
  readonly labelKey: CatalogKey;
  readonly target: () => HTMLElement | null;
}

export interface JumpNavProps {
  readonly items: readonly JumpItem[];
}

/** V3 구역 이동(키보드 포커스를 받을 때만 보인다). 이동 대상은 tabIndex={-1}인 제목이어야 focus()가 된다 */
export function JumpNav({ items }: JumpNavProps): ReactElement {
  return (
    <nav className="cc-jump" aria-label={t(S_KEY.jumpAria)}>
      {items.map((item) => (
        <button
          key={item.labelKey}
          type="button"
          className="cc-btn cc-btn--sm"
          onClick={() => {
            const el = item.target();
            if (el !== null) el.focus();
          }}
        >
          {t(item.labelKey)}
        </button>
      ))}
    </nav>
  );
}
