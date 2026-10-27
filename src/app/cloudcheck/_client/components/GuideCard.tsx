// src/app/cloudcheck/_client/components/GuideCard.tsx — AZ-MFA-G(Entra MFA 포털 확인) 가이드 카드. 점검 행 본문(대상 표 자리)에 들어간다. 디자인 최종안 §5-2·UX §10-1.
//  - 상태는 항상 확인 불가(자동 판정하지 않는 점검). 단계마다 질문 + 문서 링크 + 본인 응답 라디오(처음엔 아무것도 고르지 않음).
//  - 본인 응답은 검증하지 않는다 — 고른 뒤에도 상태·분포·먼저 볼 3개는 바뀌지 않는다(INV-8). 라벨 '본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지'만 붙는다.
//  - 입력은 이 한 곳뿐이다(직접 볼 목록의 guide-card 행은 라디오 없이 단계 요약 + 본인 응답 라벨만).
//  - 모델 타입 GuideCard와 이름이 겹치므로 엔진 타입은 import type { GuideCard as GuideCardData }로 가져온다.
import { useId, type ReactElement } from "react";
import type { GuideCard as GuideCardData, RuleCatalogEntry, RuleId } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Chip } from "./Chip";
import { DocLink } from "./DocLink";
import { S_KEY } from "./s-keys";
import "./actions.css";
import "./steps.css";
import "./UnknownTone.css"; // .cc-untone을 .cc-guide보다 먼저
import "./GuideCard.css";

/** 본인 응답(예·아니요·모름) */
export type SelfAnswer = "yes" | "no" | "unknown";
export const SELF_ANSWERS: readonly SelfAnswer[] = ["yes", "no", "unknown"];

/** 앱 상태(selfAnswers)의 키: 점검 ID + 단계 ID. 페이지·ManualCheckList·DoorSection이 같은 함수를 쓴다 */
export function selfAnswerKey(ruleId: RuleId, stepId: string): string {
  return `${ruleId}:${stepId}`;
}

export interface GuideCardProps {
  /** entry.guide가 non-null인 점검(AZ-MFA-G) */
  readonly entry: RuleCatalogEntry;
  /** 단계 ID → 응답(없으면 아직 고르지 않음) */
  readonly answers: Readonly<Record<string, SelfAnswer>>;
  readonly onAnswer: (stepId: string, v: SelfAnswer) => void;
}

export function GuideCard({ entry, answers, onAnswer }: GuideCardProps): ReactElement | null {
  const group = useId();
  const guide: GuideCardData | null = entry.guide;
  if (guide === null) return null;
  return (
    <section className="cc-untone cc-hatch cc-guide cc-stack">
      <p>
        <strong>{t("cc.c.guide.badge-note")}</strong>
      </p>
      <p>{t("cc.c.guide.asymmetry")}</p>
      <ol className="cc-steps" role="list">
        {guide.steps.map((step, i) => {
          const qid = `${group}-q${i}`;
          const answer = answers[step.id];
          return (
            <li key={step.id}>
              <p id={qid}>
                {t(step.textKey)}
                {step.doc === null ? null : (
                  <>
                    {" "}
                    <DocLink link={step.doc} labelKey={S_KEY.fixDoc} />
                  </>
                )}
              </p>
              <fieldset aria-describedby={qid}>
                <legend className="cc-small">{t("cc.c.self.legend")}</legend>
                <div className="cc-actions">
                  {SELF_ANSWERS.map((a) => (
                    <label key={a} className="cc-opt">
                      <input type="radio" name={`${group}-${i}`} value={a} checked={answer === a} onChange={() => onAnswer(step.id, a)} />
                      {t(`cc.c.self.${a}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              {answer === undefined ? null : <Chip>{t("cc.label.self-answer", { answer: t(`cc.c.self.${answer}`) })}</Chip>}
            </li>
          );
        })}
      </ol>
      <p className="cc-small">{t("cc.c.self.note")}</p>
    </section>
  );
}
