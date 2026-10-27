// src/app/cloudcheck/_client/components/LiveRegions.tsx — 라이브 영역 둘(WCAG 4.1.3): polite(상태 알림) · assertive(즉시 알릴 거부). 앱 루트 첫머리에 둔다.
//  - 보이는 패널에는 aria-live를 붙이지 않는다(중복 낭독 방지). 글자는 페이지가 t()로 만들어 넘긴다("완료"를 쓰지 않는다).
import type { ReactElement } from "react";

export interface LiveRegionsProps {
  readonly polite: string;
  readonly assertive: string;
}

export function LiveRegions({ polite, assertive }: LiveRegionsProps): ReactElement {
  return (
    <>
      <div role="status" className="cc-vh">
        {polite}
      </div>
      <div role="alert" className="cc-vh">
        {assertive}
      </div>
    </>
  );
}
