// src/app/cloudcheck/_client/screens/DemoGuide.tsx — 체험 안내 패널 ⟨P1⟩. UX §11-4, 디자인 최종안 §11-4(컷 순서 0.5: D11 화면 가리기 다음).
//  - 체험 V3 상단에 접을 수 있는 패널 "이 회사에서 살펴볼 곳": 세트마다 3줄(cc.demo.guide.<세트>.1~3), 줄마다 [그곳으로 이동] 버튼이 해당 영역으로 포커스를 옮긴다.
//  - 기본은 펼침, 접으면 제목 한 줄. 인쇄에는 나오지 않는다. 컷되면(P1) 카드의 '가르치는 것' 한 줄만 남는다 → 이 파일과 Report.tsx의 한 줄만 지우면 된다.
//  - 이동 대상은 리포트 안 요소의 DOM id(components/dom-ids.ts) 규칙으로 찾는다. 점검 행이면 먼저 펼친 뒤 그 행의 토글 버튼에 포커스를 준다.
import { useId, type ReactElement } from "react";
import type { DemoSetId, Report, RuleId, RuleResult, Status } from "../../../../lib/cloudcheck/model/report";
import { DOM_ID } from "../components/dom-ids";
import { FoldButton, FoldRegion, useFold } from "../components/Fold";
import { t } from "../i18n/index";

export interface GuideTarget {
  /** 포커스를 줄 요소 id */
  readonly id: string;
  /** 먼저 펼칠 점검(있으면) */
  readonly openRule?: RuleId;
}

const DIST_ID = "cc-dist-h";
const LETTER: Readonly<Record<DemoSetId, "a" | "b" | "c" | "d">> = { A: "a", B: "b", C: "c", D: "d" };

const rulesOf = (r: Report): readonly RuleResult[] => r.doors.flatMap((d) => d.rules);
const firstWith = (rules: readonly RuleResult[], status: Status): RuleResult | undefined => rules.find((x) => x.status === status);
const toggleOf = (rule: RuleResult | undefined, fallbackId: string): GuideTarget => (rule === undefined ? { id: fallbackId } : { id: DOM_ID.ruleToggle(rule.ruleId), openRule: rule.ruleId });

/**
 * 세트·줄 번호 → 이동 대상. 세트가 가르치는 상태가 데이터에 없으면 제목 구역으로 돌려 준다(체험 데이터가 요건과 달라도 깨지지 않게).
 *  C 위험은 어떻게 보이나 / D 확인 불가는 왜 생기나 / A 이상 없음과 해당 없음은 어떻게 다른가 / B 주의는 무엇을 묻나
 */
export function guideTarget(set: DemoSetId, line: 1 | 2 | 3, report: Report): GuideTarget {
  const rules = rulesOf(report);
  switch (set) {
    case "C":
      if (line === 1) return { id: DOM_ID.first };
      if (line === 2) return toggleOf(firstWith(rules, "risk"), DOM_ID.first);
      {
        const first = report.firstLook.mode === "findings" ? report.firstLook.ruleIds[0] : undefined;
        return first === undefined ? { id: DOM_ID.first } : { id: DOM_ID.firstFix(first) };
      }
    case "D":
      if (line === 1) return { id: DIST_ID };
      if (line === 2) return toggleOf(firstWith(rules, "unknown"), DIST_ID);
      return { id: DOM_ID.manual };
    case "A": {
      if (line === 1) return toggleOf(firstWith(rules, "clear"), DOM_ID.scope);
      if (line === 2) {
        // 해당 없음 행은 구역 끝 '해당 없음 n개' 접힘 안에 있다 → 그 구역 제목으로
        const na = firstWith(rules, "na");
        return { id: na === undefined ? DOM_ID.scope : DOM_ID.door(na.door) };
      }
      return { id: DOM_ID.scope };
    }
    case "B": {
      if (line === 2) {
        const labelled = rules.find((x) => x.labels.length > 0 || x.items.some((i) => i.labels.length > 0));
        return toggleOf(labelled ?? firstWith(rules, "caution"), DOM_ID.first);
      }
      return toggleOf(firstWith(rules, "caution"), DOM_ID.first);
    }
  }
}

export function DemoGuide({ set, report, onGo }: { readonly set: DemoSetId; readonly report: Report; readonly onGo: (target: GuideTarget) => void }): ReactElement {
  const fold = useFold("demo-guide", true);
  const base = useId();
  const letter = LETTER[set];
  const lines = [
    { n: 1 as const, text: t(`cc.demo.guide.${letter}.1`) },
    { n: 2 as const, text: t(`cc.demo.guide.${letter}.2`) },
    { n: 3 as const, text: t(`cc.demo.guide.${letter}.3`) },
  ];
  return (
    <section className="cc-banner cc-banner--demo cc-noprint" aria-labelledby={`${base}-h`}>
      <h2 id={`${base}-h`} className="cc-banner__t">
        <FoldButton fold={fold}>{t("cc.demo.guide.heading")}</FoldButton>
      </h2>
      <FoldRegion fold={fold}>
        <ol className="cc-ol cc-demo-guide" role="list">
          {lines.map((l) => (
            <li key={l.n}>
              <span id={`${base}-l${l.n}`}>{l.text}</span>{" "}
              <button type="button" id={`${base}-b${l.n}`} className="cc-btn cc-btn--sm" aria-labelledby={`${base}-b${l.n} ${base}-l${l.n}`} onClick={() => onGo(guideTarget(set, l.n, report))}>
                {t("cc.demo.guide.go")}
              </button>
            </li>
          ))}
        </ol>
      </FoldRegion>
    </section>
  );
}
