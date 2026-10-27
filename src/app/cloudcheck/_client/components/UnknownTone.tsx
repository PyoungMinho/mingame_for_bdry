// src/app/cloudcheck/_client/components/UnknownTone.tsx — 확인 불가 톤 블록: 회색 바탕 + 실선 + 6px 빗금 띠. 디자인 최종안 §5-2.
//  - 상태 도형(■)과 '확인 불가' 글자를 쓰지 않는다 — 판정의 '확인 불가'와 헷갈리는 두 신호를 뺀 '탓이 아닌 할 일' 톤이다.
//  - 쓰는 곳: 미판정 줄·권한 해제 힌트·입력 읽기 실패 패널·비교 거부.
import type { ReactElement, ReactNode } from "react";
import "./UnknownTone.css";

export interface UnknownToneProps {
  readonly children: ReactNode;
  readonly as?: "div" | "p";
}

export function UnknownTone({ children, as = "div" }: UnknownToneProps): ReactElement {
  const Tag = as;
  return <Tag className="cc-untone cc-hatch">{children}</Tag>;
}
