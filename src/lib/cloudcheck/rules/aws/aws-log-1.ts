// AWS-LOG-1 CloudTrail 기록 설정 — CCTV · priority 160 · 최고 주의
// 구성원: 계정의 trail 구성 전체를 한 대상으로(aws.log.account) + 필요한 패밀리: trail 목록(aws.log.trails).
//  - 주의: trail 없음 / 조건을 다 갖춘 trail이 없을 때 그중 가장 나은 trail의 빈틈(기록 중지 · 로그 전달 오류 기록 · 다중 리전 아님 · 관리 이벤트 쓰기 미포함 · 로그 파일 검증 꺼짐)
//  - 이상 없음: 다중 리전 + 기록 중 + 관리 이벤트(쓰기 포함) + 로그 파일 검증을 모두 갖추고 로그 전달 오류 기록이 없는 trail이 있음
//  - 로그 전달 오류(결정 D-2, CC-QA-08): 기록 중이어도 LatestDeliveryError 기록(status.hasDeliveryError)이 있으면 그 trail의 빈틈 trail-delivery-error다(주의). 빈틈 순서는 '기록 중지' 바로 다음.
//    '지금 실패 중'이라고 단정하지 않는다 — 오류 기록이 회복 뒤에도 남는지는 미확인이다. 오류 없이 조건을 다 갖춘 다른 trail이 있으면 이상 없음 그대로.
//  - 확인 불가: 조회 거부·오류, 상태·선택기를 읽지 못한 trail이 '갖췄을 수도' 있는 경우(조직 trail 상태 조회 불가 등)
//  - 문구 규칙: 'trail 없음 = 로그 없음'이라고 쓰지 않는다. 이벤트 기록(90일)은 기본으로 남는다 [확인: 2026-10-19, view-cloudtrail-events].
import type { AwsLogData, AwsTrail } from "../../contract/normalized";
import type { Ev, Member, RMsg, RuleCtx } from "../../engine/types";
import type { FactCode, UnknownReason } from "../../model/report";
import { awsAccountRes, buildSpec, defineRule, evs, fact, findings, mCaution, mClear, mUnknown, read, reasons, reuseWhy, write } from "../kit";
import { reasonOf } from "./creds";

const ID = "AWS-LOG-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_CREATE = "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html";

export const spec = buildSpec({
  id: ID, door: "log", maxStatus: "caution", allowsClear: true, priority: 160,
  cond: ["caution", "clear", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "low", prodImpact: false,
    observe: {
      doc: "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html",
      commands: [read("aws", "aws cloudtrail get-trail-status --name [[trail-name]]")],
    },
    change: {
      property: "IsMultiRegionTrail · LogFileValidationEnabled · IsLogging",
      doc: "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail-by-using-the-aws-cli-update-trail.html",
      commands: [
        write("aws", "aws cloudtrail update-trail --name [[trail-name]] --is-multi-region-trail --enable-log-file-validation"),
        write("aws", "aws cloudtrail start-logging --name [[trail-name]]"),
      ],
    },
    revert: { commands: [write("aws", "aws cloudtrail update-trail --name [[trail-name]] --no-is-multi-region-trail --no-enable-log-file-validation")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "create-trail", url: DOC_CREATE, kind: "doc" },
    { name: "event-history", url: "https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html", kind: "doc" },
    { name: "securityhub-cloudtrail", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/cloudtrail-controls.html", kind: "benchmark" },
  ],
  incident: null,
  lastVerified: "2026-10-20",
  families: { item: "aws.log.account", needs: ["aws.log.trails"] },
  calls: ["cloudtrail:DescribeTrails", "cloudtrail:GetTrailStatus", "cloudtrail:GetEventSelectors"],
  reasons: {
    "no-trail": [], "trail-not-logging": [], "trail-delivery-error": [], "trail-single-region": [], "trail-no-write-events": [], "trail-no-validation": [], "trail-ok": [],
  },
  facts: { "trail-name": ["name"], "trail-multi-region": [], "trail-single-region": [], "trail-logging": [], "trail-stopped": [], "trail-validation-on": [], "trail-validation-off": [], "trail-write-events": [], "trail-no-write-events": [], "trail-delivery-error": [] },
  how: true,
  fixtures: {
    pass: "micro/AWS-LOG-1/pass",
    violate: ["micro/AWS-LOG-1/no-trail", "micro/AWS-LOG-1/stopped", "micro/AWS-LOG-1/delivery-error"],
    denied: { call: "cloudtrail:DescribeTrails", expect: "unknown" },
    truncated: { call: "cloudtrail:DescribeTrails", expect: "unknown" },
    missingField: { path: "doors.log.data.trails", expect: "unknown" },
    versionMismatch: "auto",
  },
});

interface TrailEval { readonly t: AwsTrail; readonly issues: readonly string[]; readonly gap: UnknownReason | null; readonly srcs: Ev[] }

/**
 * 이 trail이 관리 이벤트의 쓰기를 기록하는가: 예 · 아니오 · 모름(null).
 * 모르는 값은 '예'로 접지 않는다(P3, CC-QA-07): 기본 선택기의 ReadWriteType은 All · WriteOnly(쓰기 포함) · ReadOnly(쓰기 제외)만 알고,
 * 고급 선택기의 readOnly 조건은 Equals 값이 'true'/'false'뿐이어야 한다(값이 비었거나 그 밖의 값이면 — NotEquals를 수집기가 버린 모양 포함 — 모름).
 * 쓰기를 기록하는 선택기가 하나라도 확인되면 예, 확인된 것이 없고 모르는 선택기가 있으면 모름, 모두 쓰기를 제외하면 아니오.
 */
function managementWrite(t: AwsTrail): boolean | null {
  const sel = t.selectors;
  if (sel.k !== "value") return null;
  const { basic, advanced } = sel.value;
  if (basic.length === 0 && advanced.length === 0) return !t.hasCustomEventSelectors;     // 선택기가 비어 있고 사용자 지정이 없으면 기본(관리 이벤트 전체)
  let unknown = false;
  for (const b of basic) {
    if (!b.includeManagementEvents) continue;
    const rw = b.readWriteType.trim().toLowerCase();
    if (rw === "all" || rw === "writeonly") return true;
    if (rw !== "readonly") unknown = true;
  }
  for (const a of advanced) {
    const cat = a.fields.find((f) => f.field === "eventCategory");
    if (cat === undefined || !cat.equals.some((v) => v.toLowerCase() === "management")) continue;
    const ro = a.fields.find((f) => f.field === "readOnly");
    if (ro === undefined) return true;                                                      // 읽기 · 쓰기 구분 없이 관리 이벤트 전체
    const vals = ro.equals.map((v) => v.trim().toLowerCase());
    if (vals.length === 0 || vals.some((v) => v !== "true" && v !== "false")) { unknown = true; continue; }
    if (vals.includes("false")) return true;
  }
  return unknown ? null : false;
}

function evalTrail(t: AwsTrail): TrailEval {
  const issues: string[] = [];
  let gap: UnknownReason | null = null;
  if (!t.isMultiRegion) issues.push("trail-single-region");
  if (t.status.k === "value") {
    if (!t.status.value.isLogging) issues.push("trail-not-logging");
    if (t.status.value.hasDeliveryError) issues.push("trail-delivery-error");           // 기록 중이어도 로그 파일이 버킷에 닿지 못한 기록이 있다(D-2)
  } else gap = reasonOf(t.status);
  const w = managementWrite(t);
  if (w === null) gap = gap ?? reasonOf(t.selectors); else if (!w) issues.push("trail-no-write-events");
  if (!t.logFileValidationEnabled) issues.push("trail-no-validation");
  return { t, issues, gap, srcs: evs(t.src, t.status.src, t.selectors.src) };
}

const trailFacts = (e: TrailEval): RMsg<FactCode>[] => [
  fact("trail-name", { name: { raw: { type: "resourceName", value: e.t.name, prefix: "trail" } } }),
  fact(e.t.isMultiRegion ? "trail-multi-region" : "trail-single-region"),
  ...(e.t.status.k === "value" ? [fact(e.t.status.value.isLogging ? "trail-logging" : "trail-stopped")] : []),
  fact(e.t.logFileValidationEnabled ? "trail-validation-on" : "trail-validation-off"),
  ...(managementWrite(e.t) === null ? [] : [fact(managementWrite(e.t) ? "trail-write-events" : "trail-no-write-events")]),
  ...(e.t.status.k === "value" && e.t.status.value.hasDeliveryError ? [fact("trail-delivery-error")] : []),
];

function evaluate(ctx: RuleCtx<AwsLogData>) {
  const res = awsAccountRes(ctx.accountId);
  const trails = ctx.data.trails;
  if (trails.k !== "value" && trails.k !== "partial") return { members: [mUnknown(res, reasonOf(trails), evs(trails.src))], coverage: ctx.scope };
  if (trails.k === "partial") return { members: [mUnknown(res, trails.why, evs(trails.src))], coverage: ctx.scope };
  const list = trails.value;
  if (list.length === 0) return { members: [mCaution(res, F("no-trail"), evs(trails.src))], coverage: ctx.scope };
  const evals = list.map(evalTrail);
  const good = evals.find((e) => e.issues.length === 0 && e.gap === null);
  const m: Member[] = [];
  if (good !== undefined) {
    m.push(mClear(res, R("trail-ok"), good.srcs, { facts: trailFacts(good) }));
  } else {
    // 갖췄을 수도 있는데(알려진 빈틈 없음) 일부 값을 읽지 못한 trail이 있으면 단정하지 않는다
    const maybe = evals.find((e) => e.issues.length === 0 && e.gap !== null);
    if (maybe !== undefined) {
      m.push(mUnknown(res, maybe.gap ?? "value-unrecognized", maybe.srcs, { facts: trailFacts(maybe) }));
    } else {
      const best = [...evals].sort((a, b) => a.issues.length - b.issues.length || (a.gap === null ? 0 : 1) - (b.gap === null ? 0 : 1))[0];
      const ORDER = ["trail-not-logging", "trail-delivery-error", "trail-single-region", "trail-no-write-events", "trail-no-validation"];
      const first = ORDER.find((s) => best.issues.includes(s)) ?? best.issues[0];
      m.push(mCaution(res, F(first), best.srcs, { facts: trailFacts(best) }));
    }
  }
  return { members: m, coverage: ctx.scope };
}

export const AWS_LOG_1 = defineRule<"aws", "log">({
  spec, evaluate,
  explain: (x) => (x.status === "clear" ? { msg: R("trail-ok") } : { msg: reuseWhy(x.members[0]) }),
});
