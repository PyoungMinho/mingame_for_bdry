// src/app/cloudcheck/_client/components/AppHeader.tsx — 머리: 워드마크 + 메뉴 2개(판정 규칙·이 도구에 대해). 스티키 아님. 디자인 최종안 §5-2.
//  - 앱 안 이동은 href 없는 <button>이다(워드마크·메뉴 모두, 방향서 §2-4: href는 DocLink·DownloadLink 관문에서만). 현재 화면은 aria-current="page".
//  - 정적 셸(_build/template.mjs)의 머리와 같은 클래스·같은 글자·같은 높이(.cc-hdr > .cc-hdr__in.cc-wrap > .cc-hdr__brand)라 부팅 때 밀림(CLS)이 없다.
//  - file://로 열렸으면(offline) 머리 아래 한 줄로 알린다.
import type { ReactElement } from "react";
import { t } from "../i18n/index";
import "./AppHeader.css";

/** 화면 ID(디자인 최종안 §0-1). state/screens.ts의 ScreenId와 같은 유니온 */
export type ScreenId = "start" | "prep" | "input" | "report" | "fix" | "compare" | "demo" | "catalog" | "about";
export type HeaderNavTarget = "start" | "catalog" | "about";

export interface AppHeaderProps {
  readonly current: ScreenId;
  readonly offline: boolean;
  readonly onNav: (s: HeaderNavTarget) => void;
}

export function AppHeader({ current, offline, onNav }: AppHeaderProps): ReactElement {
  return (
    <header className="cc-hdr">
      <nav className="cc-hdr__in cc-wrap" aria-label={t("cc.hdr.nav-aria")}>
        <button type="button" className="cc-hdr__brand" aria-current={current === "start" ? "page" : undefined} onClick={() => onNav("start")}>
          {t("cc.hdr.home")}
        </button>
        <div className="cc-hdr__nav">
          <button type="button" className="cc-link cc-link--nav" aria-current={current === "catalog" ? "page" : undefined} onClick={() => onNav("catalog")}>
            {t("cc.hdr.rules")}
          </button>
          <button type="button" className="cc-link cc-link--nav" aria-current={current === "about" ? "page" : undefined} onClick={() => onNav("about")}>
            {t("cc.hdr.about")}
          </button>
        </div>
      </nav>
      {offline ? <p className="cc-hdr__off">{t("cc.hdr.offline")}</p> : null}
    </header>
  );
}
