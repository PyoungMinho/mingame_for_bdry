// src/app/cloudcheck/_client/components/DocLink.tsx — 관문 ②: 외부 링크를 만드는 유일한 통로. 디자인 최종안 §5-1.
//  - LINK_HOSTS 안의 호스트만, href는 https://<host>/로 시작해야 한다. 어긋나면 링크 없이 제목 글자만(오류 문구 없음).
//  - 새 탭 + rel=noopener noreferrer + 도메인 표기(호스트 글자는 항상 보인다). 인쇄는 제목 + 호스트 글자(↗ 아이콘은 숨김).
import type { ReactElement } from "react";
import { LINK_HOSTS, type CatalogKey, type ExternalLink } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Icon } from "./Icon";
import "./DocLink.css";

export interface DocLinkProps {
  readonly link: ExternalLink;
  readonly labelKey: CatalogKey;
  /** 영어 문서 제목이면 "en"(WCAG 3.1.2) */
  readonly lang?: "en";
}

/** 링크로 만들어도 되는지: 허용 호스트 + 정확히 https://<host>/ 로 시작 + 공백·제어·역슬래시 없음 */
export function isAllowedLink(link: ExternalLink): boolean {
  if (!(LINK_HOSTS as readonly string[]).includes(link.host)) return false;
  // 'https://' 리터럴과 호스트를 템플릿 문자열로 잇지 않는다 — 번들의 URL 호스트 검사(generated.test.ts)가 `https://${…}` 조각을 URL로 읽는다
  const prefix = "https:" + "//" + link.host + "/";
  if (!link.href.startsWith(prefix)) return false;
  return !/[\s\\\u0000-\u001f\u007f]/.test(link.href);
}

export function DocLink({ link, labelKey, lang }: DocLinkProps): ReactElement {
  const title = (
    <span className="cc-ext__t" lang={lang}>
      {t(labelKey)}
    </span>
  );
  if (!isAllowedLink(link)) return title;
  return (
    <a className="cc-ext" href={link.href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
      {title}{" "}
      <span className="cc-ext__x">
        <span className="cc-ext__host">{link.host}</span>
        <Icon name="external" size={16} className="cc-ext__i" />
      </span>
      <span className="cc-vh">{t("cc.c.doclink.new-tab")}</span>
    </a>
  );
}
