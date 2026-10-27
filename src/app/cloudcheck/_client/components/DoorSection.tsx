// src/app/cloudcheck/_client/components/DoorSection.tsx — 문 구역(현관·열쇠·창문·창고·CCTV). 디자인 최종안 §5-2·§7-2.
//  - 머리: DoorIcon + 문 이름 + 용어 + 점검 단위 분포 칩(sm, 0은 생략) + '직접 볼 것 n'(0도 표시). **문 단위 종합 배지는 그리지 않는다**(D2 — worstStatus는 쓰지 않는다).
//  - 수집 줄: 수집됨·일부 수집·수집 안 함(+ 사유 — 상태 글자와 같은 말인 'not-collected' 사유는 빼고 사유 없는 문장으로: shownCollectionReason) / findings-only 문구 / 입력이 2개 이상이면 어느 입력인지.
//  - 본문: 수집하지 않은 문(not-collected)은 NotCollectedGroup 하나, 아니면 RuleRow들(엔진 순서 그대로) → 끝에 NaFold → 그 문의 실제 사례 1건(priority가 가장 작은 incident).
//    D4 통합(프론트팀장): 안내 카드가 있는 점검(entry.guide — AZ-MFA-G)은 문을 수집하지 않아도 일반 RuleRow로 그린다. 엔진은 Azure 현관을 수집 안 함으로 두고
//    AZ-MFA-G를 확인 불가로 주는데, 본인 응답 입력(GuideCard)은 이 행 본문 한 곳뿐이라(디자인 §5-2) 묶음 줄 안에 넣으면 입력할 곳이 사라진다.
//  - DoorView·DoorHandlers는 이 파일이 정의하는 어댑터 타입이다(페이지가 앱 상태 view를 이 모양으로 넘긴다).
import type { ReactElement } from "react";
import type { ExceptionOverlay, InputSummary, IsoDate, ItemResult, RuleCatalogEntry, RuleId, RuleResult, DoorResult } from "../../../../lib/cloudcheck/model/report";
import { t } from "../i18n/index";
import { Chip } from "./Chip";
import { DistributionChips } from "./DistributionChips";
import { DocLink } from "./DocLink";
import { shownCollectionReason } from "./DoorCollectionRow";
import { DoorIcon } from "./DoorIcon";
import { DOM_ID } from "./dom-ids";
import { GuideCard, selfAnswerKey, type SelfAnswer } from "./GuideCard";
import { NaFold, NotCollectedGroup, RuleRow, RuleSummaryRow } from "./RuleRow";
import { TABLE_PAGE_SIZE } from "./TargetTable";
import { Msg, T } from "./T";
import "./DoorSection.css";

/** 문 구역이 읽는 화면 상태(앱 상태 view에서 온다) */
export interface DoorView {
  /** 펼쳐진 점검 */
  readonly openRules: ReadonlySet<RuleId>;
  /** 점검별 대상 표에 보이는 행 수(TABLE_PAGE_SIZE 단위, 없으면 한 쪽) */
  readonly shownRows: Readonly<Partial<Record<RuleId, number>>>;
  /** 예외 폼이 열린 대상(item.id) */
  readonly editingItemId: string | null;
  /** 오늘(KST 로컬 날짜) — 예외 폼의 최소·최대 만료일 기준 */
  readonly today: IsoDate;
  /** 본인 응답(selfAnswerKey(ruleId, stepId) → 응답) */
  readonly selfAnswers: Readonly<Record<string, SelfAnswer>>;
}

/** 문 구역이 올리는 동작(앱 상태를 바꾸는 쪽은 페이지) */
export interface DoorHandlers {
  readonly onToggleRule: (id: RuleId) => void;
  readonly onFix: (id: RuleId) => void;
  readonly onShowManual: () => void;
  readonly onMoreRows: (id: RuleId) => void;
  /** 예외 표시 가능 여부: 위험·주의 대상만(Q9) */
  readonly canMarkException: (item: ItemResult) => boolean;
  readonly onOpenExceptionForm: (itemId: string) => void;
  readonly onCloseExceptionForm: () => void;
  readonly onSaveException: (item: ItemResult, v: { reason: string; until: IsoDate }) => void;
  readonly onRemoveException: (item: ItemResult) => void;
  readonly onSelfAnswer: (ruleId: RuleId, stepId: string, v: SelfAnswer) => void;
}

export interface DoorSectionProps {
  readonly door: DoorResult;
  readonly catalog: ReadonlyMap<RuleId, RuleCatalogEntry>;
  readonly inputs: readonly InputSummary[];
  readonly overlay: ExceptionOverlay | null;
  readonly view: DoorView;
  readonly on: DoorHandlers;
}

function CollectLine({ door, inputs }: { readonly door: DoorResult; readonly inputs: readonly InputSummary[] }): ReactElement {
  const c = door.collection;
  const input = inputs.length >= 2 && c.inputIndex !== null ? inputs.find((i) => i.index === c.inputIndex) : undefined;
  const reason = shownCollectionReason(c.status, c.reason);
  return (
    <p className="cc-door__collect">
      {c.status === "collected" ? (
        <T k="cc.c.dsec.collect.collected" p={{ t: c.asOf === null ? "-" : { t: c.asOf.at } }} />
      ) : c.status === "partial" ? (
        reason === null ? t("cc.c.dsec.collect.partial-bare") : <T k="cc.c.dsec.collect.partial" p={{ reason: <Msg m={reason} short /> }} />
      ) : reason === null ? (
        t("cc.c.dsec.collect.none-bare")
      ) : (
        <T k="cc.c.dsec.collect.none" p={{ reason: <Msg m={reason} short /> }} />
      )}
      {c.judgeLevel === "findings-only" ? ` ${t("cc.c.doorrow.findings-only")}` : ""}
      {input === undefined ? null : (
        <>
          {" "}
          <T k="cc.c.dsec.collect.input" p={{ name: { v: input.name } }} />
        </>
      )}
    </p>
  );
}

/** 그 문의 실제 사례: 구역 안 점검의 incident 중 priority가 가장 작은 것 1건(결정적) */
function pickIncident(rules: readonly RuleResult[], catalog: ReadonlyMap<RuleId, RuleCatalogEntry>): RuleCatalogEntry | null {
  let best: RuleCatalogEntry | null = null;
  for (const r of rules) {
    const e = catalog.get(r.ruleId);
    if (e === undefined || e.incident === null) continue;
    if (best === null || e.priority < best.priority) best = e;
  }
  return best;
}

export function DoorSection({ door, catalog, inputs, overlay, view, on }: DoorSectionProps): ReactElement {
  const name = t(`cc.door.${door.door}.name`);
  const term = t(`cc.door.${door.door}.term`);
  const notCollected = door.collection.status === "not-collected";
  const hasGuide = (r: RuleResult): boolean => (catalog.get(r.ruleId)?.guide ?? null) !== null;
  // 수집 안 한 문: 안내 카드 점검만 행으로, 나머지는 묶음 줄 하나. 수집한 문: 해당 없음 밖은 행으로, 해당 없음은 끝의 접힘으로
  const grouped = notCollected ? door.rules.filter((r) => !hasGuide(r)) : [];
  const live = notCollected ? door.rules.filter(hasGuide) : door.rules.filter((r) => r.status !== "na");
  const na = notCollected ? [] : door.rules.filter((r) => r.status === "na");
  const incident = pickIncident(door.rules, catalog)?.incident ?? null;

  return (
    <section className="cc-door" aria-label={t("cc.door.aria", { name, term })} id={`cc-door-${door.door}`}>
      <div className="cc-door__head">
        <h2 className="cc-door__h" id={DOM_ID.door(door.door)} tabIndex={-1}>
          <DoorIcon door={door.door} size={24} />
          <span>{name}</span> <span className="cc-door__term">{term}</span>
        </h2>
        <div className="cc-door__counts">
          <DistributionChips dist={door.distribution} size="sm" hideZero />
          <Chip variant="strong">{t("cc.c.chip.manual", { n: door.manualCount })}</Chip>
        </div>
      </div>
      <CollectLine door={door} inputs={inputs} />
      {grouped.length === 0 ? null : <NotCollectedGroup rules={grouped} catalog={catalog} />}
      {live.length === 0 ? null : (
        <ul role="list">
          {live.map((rule) => {
            const entry = catalog.get(rule.ruleId);
            if (entry === undefined) return <RuleSummaryRow key={rule.ruleId} rule={rule} />;
            const answersFor: Record<string, SelfAnswer> = {};
            if (entry.guide !== null) {
              for (const s of entry.guide.steps) {
                const a = view.selfAnswers[selfAnswerKey(rule.ruleId, s.id)];
                if (a !== undefined) answersFor[s.id] = a;
              }
            }
            return (
              <RuleRow
                key={rule.ruleId}
                rule={rule}
                entry={entry}
                open={view.openRules.has(rule.ruleId)}
                onToggle={() => on.onToggleRule(rule.ruleId)}
                onFix={() => on.onFix(rule.ruleId)}
                onShowManual={on.onShowManual}
                guide={entry.guide === null ? undefined : <GuideCard entry={entry} answers={answersFor} onAnswer={(stepId, v) => on.onSelfAnswer(rule.ruleId, stepId, v)} />}
                table={{
                  rule,
                  overlay,
                  shown: view.shownRows[rule.ruleId] ?? TABLE_PAGE_SIZE,
                  onMore: () => on.onMoreRows(rule.ruleId),
                  canMark: on.canMarkException,
                  editingId: view.editingItemId,
                  onOpenForm: on.onOpenExceptionForm,
                  onCloseForm: on.onCloseExceptionForm,
                  onSave: on.onSaveException,
                  onRemove: on.onRemoveException,
                  today: view.today,
                }}
              />
            );
          })}
        </ul>
      )}
      {na.length === 0 ? null : <NaFold rules={na} catalog={catalog} />}
      {incident === null ? null : (
        <p className="cc-door__inc">
          <T k="cc.c.dsec.incident" p={{ title: <DocLink link={incident.link} labelKey={incident.titleKey} />, source: incident.sourceName, date: { d: incident.date } }} />
        </p>
      )}
    </section>
  );
}
