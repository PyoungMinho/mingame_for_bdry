// AZ-KEY-1 스토리지 공유 키 회전 — 열쇠 · priority 130 · 최고 주의
// 구성원: 스토리지 계정(azure.key.storage-accounts). 키 값은 읽지 않는다(수집기 L-06: 키를 반환하는 명령 금지) — 생성 시각(keyCreationTime)만 본다.
//  - 이상 없음: allowSharedKeyAccess = false(Entra 인증만 사용) / 공유 키를 허용하지만 두 키 모두 90일 안에 회전
//  - 주의: 공유 키 허용(true 또는 미설정 null) + 키 하나라도 90일 넘게 회전하지 않았거나 keyCreationTime 기록이 없음
//  - 90일은 도구 기준이다. Microsoft 문서는 정기 회전을 권고하고 일수를 정하지 않는다 [확인: 2026-10-19, storage-account-keys-manage].
//  - 시각 역전: 키 생성 시각이 수집 시각(사용자 PC 시계)보다 허용치를 넘게 늦으면 나이를 말할 수 없다 → 확인 불가(stale-evidence) + 시각 역전 사실(CC-QA-01). 다른 키가 오래됐으면 주의는 그대로 유지한다.
//    같은 입력의 어느 계정이든(parse의 latestEvidence 포함) 키 생성 시각이 수집 시각보다 늦으면 수집 시각이 틀린 것이라 '90일 안에 회전'(이상 없음)을 내지 않는다.
import type { AzureKeyData, AzureStorageAccount, Instant, Slot, Src } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { AZURE_KEY_ROTATION_DAYS } from "../params";
import { C, N, ageMs, buildSpec, defineRule, evs, fact, findings, inputEvidence, laterThanAsOfFact, mCaution, mClear, mUnknown, olderThanDays, reasons, reversedIn, uniqFacts, wholeDays, write } from "../kit";
import { storageAccountRes, why } from "./common";

const ID = "AZ-KEY-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_KEYS = "https://learn.microsoft.com/en-us/azure/storage/common/storage-account-keys-manage";
const DOC_SHARED = "https://learn.microsoft.com/en-us/azure/storage/common/shared-key-authorization-prevent";

export const spec = buildSpec({
  id: ID, door: "key", maxStatus: "caution", allowsClear: true, priority: 130,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [{ name: "rotation-days", value: AZURE_KEY_ROTATION_DAYS, basis: "tool-default" }],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "high", prodImpact: true,
    observe: { doc: DOC_SHARED, commands: [] },
    change: {
      property: "allowSharedKeyAccess · keyPolicy.keyExpirationPeriodInDays",
      doc: DOC_KEYS,
      commands: [
        write("az", "az storage account keys renew --resource-group [[resource-group-name]] --account-name [[storage-account-name]] --key primary"),
        write("az", "az storage account update --name [[storage-account-name]] --resource-group [[resource-group-name]] --key-exp-days [[rotation-days]]"),
      ],
    },
    revert: { commands: [write("az", "az storage account update --name [[storage-account-name]] --resource-group [[resource-group-name]] --allow-shared-key-access true")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "manage-keys", url: DOC_KEYS, kind: "doc" },
    { name: "prevent-shared-key", url: DOC_SHARED, kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.key.storage-accounts", needs: [] },
  calls: ["azure:account.list", "azure:storage.account.list"],
  reasons: {
    "keys-stale": ["n", "days"], "all-ok": ["n", "days"], "na-no-storage-accounts": [],
    "key-not-rotated": ["days"], "key-no-record": [], "shared-key-off": [], "keys-rotated": ["days"],
  },
  facts: { "shared-key-allowed": [], "shared-key-unset": [], "azure-key-age": ["key", "n"], "azure-key-no-record": ["key"], "key-expiration-policy": ["n"], "evidence-later-than-as-of": ["evidence", "reference"] },
  how: true,
  fixtures: {
    pass: "micro/AZ-KEY-1/pass",
    violate: ["micro/AZ-KEY-1/old-key", "micro/AZ-KEY-1/no-record"],
    denied: { call: "azure:storage.account.list", expect: "unknown" },
    truncated: { call: "azure:storage.account.list", expect: "unknown" },
    missingField: { path: "doors.key.data.storageAccounts[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evalAccount(ctx: RuleCtx<AzureKeyData>, sa: AzureStorageAccount, skew: Instant | null): Member {
  const res = storageAccountRes(sa);
  const shared = sa.allowSharedKeyAccess;
  if (shared.k !== "value") return mUnknown(res, why(shared), evs(sa.src, shared.src));
  if (shared.value === false) return mClear(res, R("shared-key-off"), evs(sa.src, shared.src));
  const sharedFact = fact(shared.value === null ? "shared-key-unset" : "shared-key-allowed");
  const policy = sa.keyExpirationPeriodInDays;
  const policyFacts = policy.k === "value" && policy.value !== null ? [fact("key-expiration-policy", { n: N(policy.value) })] : [];
  const keys: readonly [string, Slot<Instant | null>][] = [["key1", sa.key1CreatedAt], ["key2", sa.key2CreatedAt]];
  const stale: ReturnType<typeof fact>[] = [];
  let noRecord = false;
  let old = false;
  let gap: ReturnType<typeof why> | null = null;
  const reversed: ReturnType<typeof fact>[] = [];
  for (const [name, slot] of keys) {
    if (slot.k !== "value") { gap = gap ?? why(slot); continue; }
    if (slot.value === null) { noRecord = true; stale.push(fact("azure-key-no-record", { key: C(name) })); continue; }
    if (ctx.asOf === null) { gap = gap ?? "field-missing"; continue; }
    const age = ageMs(ctx.asOf, slot.value, slot.src);
    if (age === null) { gap = gap ?? "stale-evidence"; reversed.push(laterThanAsOfFact(ctx.asOf, slot.value)); continue; }
    if (olderThanDays(age, AZURE_KEY_ROTATION_DAYS)) { old = true; stale.push(fact("azure-key-age", { key: C(name), n: N(wholeDays(age)) })); }
  }
  const e = evs(sa.src, shared.src, keys[0][1].src, keys[1][1].src);
  const facts = [sharedFact, ...stale, ...policyFacts];
  if (old) return mCaution(res, F("key-not-rotated", { days: N(AZURE_KEY_ROTATION_DAYS) }), e, { facts });
  if (noRecord) return mCaution(res, F("key-no-record"), e, { facts });
  if (gap !== null) return mUnknown(res, gap, e, { facts: [sharedFact, ...uniqFacts(reversed), ...policyFacts] });
  // 다른 계정의 키 시각이 수집 시각보다 늦으면 수집 시각이 이른 것이다(PC 시계가 늦음): 이 계정의 '최근에 회전했다'도 확정하지 못한다
  if (skew !== null && ctx.asOf !== null) return mUnknown(res, "stale-evidence", e, { facts: [sharedFact, laterThanAsOfFact(ctx.asOf, skew), ...policyFacts] });
  return mClear(res, R("keys-rotated", { days: N(AZURE_KEY_ROTATION_DAYS) }), e, { facts: [sharedFact, ...policyFacts] });
}

function evaluate(ctx: RuleCtx<AzureKeyData>) {
  const members: Member[] = [];
  const times: { t: Instant; src: Src | null }[] = [];
  for (const per of ctx.data.storageAccounts) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sa of per.items.value) for (const slot of [sa.key1CreatedAt, sa.key2CreatedAt]) if (slot.k === "value" && slot.value !== null) times.push({ t: slot.value, src: slot.src });
  }
  const skew = reversedIn(ctx.asOf, [...times, ...inputEvidence(ctx)]);
  for (const per of ctx.data.storageAccounts) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sa of per.items.value) members.push(evalAccount(ctx, sa, skew));
  }
  return { members, coverage: ctx.scope };
}

export const AZ_KEY_1 = defineRule<"azure", "key">({
  spec, evaluate,
  explain: (x) => {
    const days = { days: N(AZURE_KEY_ROTATION_DAYS) };
    if (x.status === "na") return { msg: R("na-no-storage-accounts") };
    if (x.status === "clear") return { msg: R("all-ok", { n: N(x.applicable ?? x.members.length), ...days }) };
    return { msg: R("keys-stale", { n: N(x.members.length), ...days }) };
  },
});
