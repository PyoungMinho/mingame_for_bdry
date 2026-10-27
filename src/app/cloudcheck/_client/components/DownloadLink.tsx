// src/app/cloudcheck/_client/components/DownloadLink.tsx — 부속 관문: 내려받기(방향서 §2-4 "href는 DocLink·다운로드 관문에서만"). 디자인 최종안 §5-1.
//  - route: 오프라인판 /cloudcheck/download 일반 <a download>. 스크립트가 늦어도 동작한다. file://로 열렸으면 그리지 않는다(이미 파일이다).
//  - blob: <button> → Blob → URL.createObjectURL → 임시 <a download> 클릭 → 다음 틱에 revokeObjectURL. location 대입·window.open 0.
//  - 성공·실패 낭독은 페이지가 onResult를 받아 cc.app.live.downloaded / cc.app.download.fail로 한다(페이지는 내려받기 '시작'만 알 수 있다).
import type { ReactElement } from "react";
import type { CatalogKey } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { cx } from "./cx";

/** 오프라인판 경로(두 라우트가 같은 바이트를 낸다 — 방향서 §2-2). 정적 셸의 링크와 같은 값 */
export const DOWNLOAD_ROUTE = "/cloudcheck/download";

export type DownloadLinkProps =
  | { readonly kind: "route"; readonly labelKey: CatalogKey; readonly primary?: boolean } // 오프라인판 /cloudcheck/download
  | {
      readonly kind: "blob";
      readonly labelKey: CatalogKey;
      readonly fileName: string;
      readonly mime: string;
      readonly bytes: () => string | Uint8Array;
      readonly primary?: boolean;
      readonly onResult?: (ok: boolean) => void;
    };

function isFileProtocol(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "file:";
}

/** Blob을 만들어 내려받기를 시작한다. 예외가 나면 false */
export function startBlobDownload(data: string | Uint8Array, fileName: string, mime: string): boolean {
  try {
    const part = typeof data === "string" ? data : new Uint8Array(data);
    const url = URL.createObjectURL(new Blob([part], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return true;
  } catch {
    return false;
  }
}

export function DownloadLink(props: DownloadLinkProps): ReactElement | null {
  const className = cx("cc-btn", props.primary === true && "cc-btn--primary");
  if (props.kind === "route") {
    if (isFileProtocol()) return null;
    return (
      <a className={className} href={DOWNLOAD_ROUTE} download>
        {t(props.labelKey)}
      </a>
    );
  }
  const { bytes, fileName, mime, onResult } = props;
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        let ok = false;
        try {
          ok = startBlobDownload(bytes(), fileName, mime);
        } catch {
          ok = false;
        }
        if (onResult !== undefined) onResult(ok);
      }}
    >
      {t(props.labelKey)}
    </button>
  );
}
