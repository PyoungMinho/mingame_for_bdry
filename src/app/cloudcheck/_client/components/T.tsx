// src/app/cloudcheck/_client/components/T.tsx — 카탈로그 문장을 노드로 그리는 <T>와 엔진 코드(MsgRef)를 그리는 <Msg>. 디자인 최종안 §5-0(i18n 인터페이스).
//  - <T k p>: segments(k, p)가 낸 조각을 그대로 그린다(조립 규칙의 단일 구현은 i18n/index.ts).
//      text → 글자 / {v} → <MaskedValue> / {t} → <time dateTime>+fmtTime(full) / ReactElement → 그대로 / 그 밖(n·c·d·수·문자열) → paramText().
//    사용자 데이터가 든 문장은 반드시 이것으로(t()는 DisplayValue를 받지 않는다 — 속성·document.title·라이브 영역은 t()만).
//  - <Msg m short?>: 키는 keyOf(m.code) 또는 shortKeyOf(code)(gaps 나열·범위 패널의 짧은 이름) 하나로만 만든다(키 규칙 11).
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import type { CatalogKey, MsgParam, MsgRef } from "../../../../lib/cloudcheck/model/report";
import {
  fmtTime,
  isDisplayParam,
  isTimeParam,
  isUnknownReason,
  keyOf,
  paramText,
  segments,
  shortKeyOf,
  type KeyArg,
  type MsgTextParam,
  type Seg,
  type TextParam,
} from "../i18n/index";
import { MaskedValue } from "./MaskedValue";

/** <T>의 파라미터: 엔진 MsgParam + 화면이 직접 만든 수·문자열·노드 */
export type TParam = MsgParam | TextParam | ReactElement;

export interface TProps<K extends CatalogKey> {
  readonly k: KeyArg<K>;
  readonly p?: Readonly<Record<string, TParam>>;
}

function renderSeg(seg: Seg<TParam>): ReactNode {
  if (seg.kind === "text") return seg.text;
  const v = seg.value;
  if (v === undefined) return `{${seg.name}}`; // 빠진 파라미터는 조용히 지우지 않는다
  if (isValidElement(v)) return v;
  if (isDisplayParam(v)) return <MaskedValue value={v.v} />;
  if (isTimeParam(v)) return <time dateTime={v.t}>{fmtTime(v.t, "full")}</time>;
  return paramText(v as TextParam | MsgTextParam);
}

export function T<K extends CatalogKey>({ k, p }: TProps<K>): ReactElement {
  const segs = segments<TParam, K>(k, p);
  return (
    <>
      {segs.map((seg, i) => (
        <Fragment key={i}>{renderSeg(seg)}</Fragment>
      ))}
    </>
  );
}

export interface MsgProps {
  readonly m: MsgRef;
  /** cc.reason.short.<코드>(확인 불가 사유의 짧은 이름). 사유 코드가 아니면 일반 문장 */
  readonly short?: boolean;
}

export function Msg({ m, short = false }: MsgProps): ReactElement {
  const key = short && isUnknownReason(m.code) ? shortKeyOf(m.code) : keyOf(m.code);
  return <T k={key} p={m.params} />;
}
