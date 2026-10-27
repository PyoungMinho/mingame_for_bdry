// src/app/cloudcheck/_client/components/MaskedValue.tsx — 관문 ①: 사용자 데이터를 그리는 유일한 통로(R-12·R-13). 디자인 최종안 §5-1.
//  - plain: 비식별 상수 그대로 / sensitive: 화면은 full, 인쇄·화면 가리기는 masked(CSS 전환 — 이중 렌더) / redacted: 원값은 DOM에 없다.
//  - DisplayValue.full·masked를 읽는 곳은 이 파일뿐이다(가드 R-12/R-13). 값은 텍스트 노드로만 들어간다(innerHTML 0).
//  - 제어·양방향 문자는 엔진이 이미 치환한 값을 그대로 그린다. 속성(aria-label·title 등)에는 값을 넣지 않는다 — 접근 이름이 필요하면 id를 주고 aria-labelledby로 가리킨다.
import type { ReactElement } from "react";
import type { DisplayValue, ValueFlag } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";

export interface MaskedValueProps {
  readonly value: DisplayValue;
  /** aria-labelledby가 가리킬 id(예: [빼기] 버튼 = 자기 id + 파일 이름 id) */
  readonly id?: string;
}

const FLAG_ORDER: readonly ValueFlag[] = ["truncated", "control-chars-replaced", "bidi-replaced"];

export function MaskedValue({ value, id }: MaskedValueProps): ReactElement {
  if (value.kind === "plain") {
    return (
      <bdi id={id} className="cc-mv cc-any" translate="no">
        {value.text}
      </bdi>
    );
  }
  if (value.kind === "redacted") {
    return (
      <span id={id} className="cc-mv cc-mv--redacted" translate="no">
        {t("cc.c.masked.redacted")}
      </span>
    );
  }
  const flags = FLAG_ORDER.filter((f) => value.flags.includes(f));
  return (
    <>
      <span id={id} className="cc-mv cc-any" translate="no">
        <bdi className="cc-mask-full">{value.full}</bdi>
        <bdi className="cc-mask-short">{value.masked}</bdi>
      </span>
      {flags.includes("truncated") ? <span className="cc-mask-full">{` ${t("cc.c.masked.truncated-short")}`}</span> : null}
      {flags.map((f) => (
        <span key={f} className="cc-vh">
          {t(`cc.c.masked.flag.${f}`)}
        </span>
      ))}
    </>
  );
}
