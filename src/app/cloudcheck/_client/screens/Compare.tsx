// src/app/cloudcheck/_client/screens/Compare.tsx — V5 재점검 비교. 디자인 최종안 §6-6(G1~G3), UX §4-6.
//  - 다른 계정·다른 클라우드·같은 수집 결과면 비교를 거부한다(5겹): 확인 불가 톤 블록(도형 없음) + 두 신원 나란히 + [다른 파일로 다시 비교]만.
//  - 개선율·점수 상승·퍼센트 없음. 위험이 확인 불가로 바뀐 점검은 맨 위 묶음 + 강조 줄(BeforeAfterTable). 대상 칸은 숫자 변화만.
import type { ReactElement } from "react";
import { Banner } from "../components/Banner";
import { BeforeAfterTable, IdentityCompare } from "../components/Compare";
import { UnknownTone } from "../components/UnknownTone";
import { t } from "../i18n/index";
import { useApp } from "../state/controller";
import { changedCount } from "../state/screens";
import { BackButton } from "./shared";

export function CompareScreen(): ReactElement | null {
  const { state, actions, catalogById } = useApp();
  const cmp = state.comparison;
  if (cmp === null) return null;
  return (
    <>
      <BackButton labelKey="cc.compare.back" onClick={actions.leaveCompare} />
      <h1 tabIndex={-1}>{t("cc.compare.title")}</h1>

      <section aria-labelledby="cc-compare-id-h" className="cc-stack cc-gap-2">
        <h2 id="cc-compare-id-h">{t("cc.compare.identity.heading")}</h2>
        {/* 같은 계정 여부는 엔진 판정만 쓴다: 성공 또는 '같은 수집 결과' 거부 = 같은 계정(엔진은 클라우드 → 계정 → 스냅샷 순으로 본다) */}
        <IdentityCompare before={cmp.before} after={cmp.after} sameAccount={cmp.ok || cmp.reason === "same-snapshot"} />
        {cmp.ok && cmp.reordered ? <Banner variant="info" title={t("cc.compare.reordered")} /> : null}
        {cmp.ok && cmp.sameCredentialReport ? <Banner variant="info" title={t("cc.compare.same-report")} /> : null}
      </section>

      {cmp.ok ? (
        <section aria-labelledby="cc-compare-sum-h" className="cc-stack cc-gap-2">
          <h2 id="cc-compare-sum-h">{changedCount(cmp) > 0 ? t("cc.compare.summary", { n: changedCount(cmp) }) : t("cc.compare.summary.zero")}</h2>
          <BeforeAfterTable cmp={cmp} catalog={catalogById} />
        </section>
      ) : (
        <UnknownTone>
          <p>{t(`cc.compare.refuse.${cmp.reason}`)}</p>
        </UnknownTone>
      )}

      <div className="cc-actions">
        {cmp.ok ? (
          <button type="button" className="cc-btn cc-btn--primary" onClick={actions.acceptAfter}>
            {t("cc.compare.cta")}
          </button>
        ) : null}
        <button type="button" className="cc-btn" onClick={actions.compareAgain}>
          {t("cc.compare.again")}
        </button>
      </div>
    </>
  );
}
