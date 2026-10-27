// src/app/cloudcheck/_client/screens/shared.tsx — 여러 화면이 같이 쓰는 작은 조각(뒤로 가기 버튼 · 해시 게시 채널 · 오프라인판 블록). 소유: 페이지개발자.
import type { ReactElement } from "react";
import { DocLink } from "../components/DocLink";
import { DownloadLink } from "../components/DownloadLink";
import { Chip } from "../components/Chip";
import { T } from "../components/T";
import { HASH_CHANNELS } from "../config";
import { t } from "../i18n/index";
import type { CatalogKey } from "../../../../lib/cloudcheck/model/report";

/** 화면 위쪽 '← …' 버튼(앱 안 이동이라 href 없는 버튼) */
export function BackButton({ labelKey, onClick }: { readonly labelKey: CatalogKey; readonly onClick: () => void }): ReactElement {
  return (
    <p>
      <button type="button" className="cc-link cc-link--nav" onClick={onClick}>
        {t(labelKey)}
      </button>
    </p>
  );
}

/**
 * 해시 게시 채널 두 곳(저장소 릴리스 · PDF 개정판). 게시 전(null)에는 '준비 중'을 글자로 보인다.
 * 페이지 자신의 SHA-256 값은 파일 안에 적을 수 없으므로 여기에도 값은 없다(디자인 Q1).
 */
export function ChannelRows({ repoLabelKey, pdfLabelKey }: { readonly repoLabelKey: CatalogKey; readonly pdfLabelKey: CatalogKey }): ReactElement {
  const { repo, pdf } = HASH_CHANNELS;
  return (
    <ul className="cc-actions" role="list">
      <li>{repo === null ? <><span>{t(repoLabelKey)}</span> <Chip variant="soon">{t("cc.start.offline.soon")}</Chip></> : <DocLink link={repo} labelKey={repoLabelKey} />}</li>
      <li>
        {pdf === null ? (
          <>
            <span>{t(pdfLabelKey)}</span> <Chip variant="soon">{t("cc.start.offline.soon")}</Chip>
          </>
        ) : (
          <T k="cc.start.offline.pdf" p={{ edition: pdf.edition, page: pdf.page }} />
        )}
      </li>
    </ul>
  );
}

/** 오프라인판 내려받기 블록(V0 A10 · V8 J3). file://로 열렸으면 호출하는 쪽이 통째로 숨긴다 */
export function OfflineDownload({ ctaKey }: { readonly ctaKey: CatalogKey }): ReactElement {
  return <DownloadLink kind="route" labelKey={ctaKey} primary />;
}
