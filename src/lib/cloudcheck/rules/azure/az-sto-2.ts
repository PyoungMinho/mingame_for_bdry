// AZ-STO-2 컨테이너 공개 상태 — 창고 · priority 20 · 최고 위험
// 구성원: Blob 컨테이너(azure.sto.containers) + 필요한 패밀리: 스토리지 계정(azure.sto.storage-accounts). 컨테이너 목록은 관리 평면(container-rm)으로만 읽는다.
//  - 위험: 계정의 allowBlobPublicAccess가 false가 아니고(true·미설정) 컨테이너 publicAccess가 Blob·Container이며 $web이 아님
//  - 주의: $web 컨테이너(정적 웹사이트 = 의도된 공개 후보. 계정 설정과 무관하게 공개된다) / 공개 컨테이너인데 계정 설정을 확인하지 못함 / INV-7: 다른 계정은 조회됐는데 이 계정의 컨테이너 목록만 거부됨(core)
//  - 이상 없음: 계정 설정이 false(컨테이너 설정을 무력화) 이거나 컨테이너가 공개가 아님(publicAccess = "None")
//  - 확인 불가: publicAccess 값이 없음(null). 관리 평면 API는 비공개를 "None" 문자열로 준다 — null은 '비공개'가 아니라 '값을 읽지 못함'이다
//    (수집기 투영은 필드가 없으면 null을 넣는다. 출력 모양이 다르면 공개 컨테이너가 이상 없음이 되는 fail-open을 막는다. 2026-10-19 백엔드팀장)
//  - 해당 없음: 컨테이너 0개(목록이 완결일 때)
import type { AzureContainer, AzureStorageAccount, AzureStoData } from "../../contract/normalized";
import type { Member, ResourceDesc, RuleCtx } from "../../engine/types";
import { N, buildSpec, defineRule, evs, fact, findings, inSubscription, mCaution, mClear, mRisk, mUnknown, reasons, write } from "../kit";
import { storageAccountRes, why } from "./common";

const ID = "AZ-STO-2" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_PREVENT = "https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent";
const DOC_CONFIGURE = "https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-configure";

export const spec = buildSpec({
  id: ID, door: "sto", maxStatus: "risk", allowsClear: true, priority: 20,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "medium", prodImpact: true,
    observe: { doc: DOC_PREVENT, commands: [] },
    change: {
      property: "publicAccess (container)",
      doc: DOC_CONFIGURE,
      commands: [write("az", "az storage container-rm update --storage-account [[storage-account-name]] --name [[container-name]] --public-access off")],
    },
    revert: { commands: [write("az", "az storage container-rm update --storage-account [[storage-account-name]] --name [[container-name]] --public-access [[previous-access-level]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "anonymous-read-access", url: DOC_PREVENT, kind: "doc" },
    { name: "configure-anonymous-access", url: DOC_CONFIGURE, kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.sto.containers", needs: ["azure.sto.storage-accounts"] },
  calls: ["azure:account.list", "azure:storage.account.list", "azure:storage.container-rm.list"],
  isolatedDenial: ["azure:storage.container-rm.list"],
  reasons: {
    "containers-public": ["n"], "containers-attention": ["n"], "all-private": ["n"], "na-no-containers": [],
    "container-public": [], "web-container": [], "public-unconfirmed": [], "account-blocks": [], "container-private": [],
  },
  facts: { "container-access-private": [], "container-access-blob": [], "container-access-container": [], "anon-allowed": [], "anon-unset": [], "anon-blocked": [], "static-website-container": [] },
  how: true,
  fixtures: {
    pass: "micro/AZ-STO-2/pass",
    violate: ["micro/AZ-STO-2/public-container", "micro/AZ-STO-2/web-container"],
    denied: { call: "azure:storage.container-rm.list", expect: "unknown" },
    truncated: { call: "azure:storage.container-rm.list", expect: "unknown" },
    missingField: { path: "doors.sto.data.storageAccounts[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

const isPublicLevel = (v: string | null): boolean => v !== null && (v.toLowerCase() === "blob" || v.toLowerCase() === "container");
/** 컨테이너 접근 수준 사실: 화면 용어(Private · Blob · Container)로 값마다 따로 둔다(원시 값을 문장에 넣지 않는다 · 디자인 검수 K-5) */
const accessFact = (level: string) => fact(level === "blob" ? "container-access-blob" : level === "container" ? "container-access-container" : "container-access-private");

function containerRes(sa: AzureStorageAccount, c: AzureContainer): ResourceDesc {
  return { type: "blob-container", name: { type: "resourceName", value: c.name }, where: inSubscription(sa.subscription), id: `${sa.id}/${c.name}` };
}

function evalAccount(sa: AzureStorageAccount): Member[] {
  const list = sa.containers;
  // none = 빈 목록 + 값 없음(컨테이너 0개를 정상으로 돌려줌): 패밀리(범위 증명)도 0개 완결로 센다 — 계정 단위 확인 불가로 만들지 않는다(CC-QA-23)
  if (list.k === "none") return [];
  if (list.k !== "value" && list.k !== "partial") return [mUnknown(storageAccountRes(sa), why(list), evs(sa.src, list.src))];
  const allow = sa.allowBlobPublicAccess;
  return list.value.map((c): Member => {
    const res = containerRes(sa, c);
    const level = c.publicAccess === null ? "none" : c.publicAccess.toLowerCase();
    const base = evs(sa.src, list.src);
    if (c.name === "$web") {
      return mCaution(res, F("web-container"), evs(sa.src, list.src), { facts: [fact("static-website-container")], labels: [{ kind: "intended-public-candidate", basis: "web-container" }] });
    }
    // 아는 값(None · Blob · Container)만 해석한다. null·모르는 값은 확인 불가(P3)
    if (c.publicAccess === null || !(c.publicAccess.toLowerCase() === "none" || isPublicLevel(c.publicAccess))) return mUnknown(res, "value-unrecognized", base);
    if (!isPublicLevel(c.publicAccess)) return mClear(res, R("container-private"), base, { facts: [accessFact(level)] });
    if (allow.k !== "value") return mCaution(res, F("public-unconfirmed"), evs(sa.src, list.src, allow.src), { facts: [accessFact(level)] });
    if (allow.value === false) return mClear(res, R("account-blocks"), evs(sa.src, list.src, allow.src), { facts: [accessFact(level), fact("anon-blocked")] });
    return mRisk(res, F("container-public"), evs(sa.src, list.src, allow.src), { facts: [accessFact(level), fact(allow.value === null ? "anon-unset" : "anon-allowed")] });
  });
}

function evaluate(ctx: RuleCtx<AzureStoData>) {
  const members: Member[] = [];
  for (const per of ctx.data.storageAccounts) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sa of per.items.value) members.push(...evalAccount(sa));
  }
  return { members, coverage: ctx.scope };
}

export const AZ_STO_2 = defineRule<"azure", "sto">({
  spec, evaluate,
  explain: (x) => {
    if (x.status === "na") return { msg: R("na-no-containers") };
    if (x.status === "clear") return { msg: R("all-private", { n: N(x.applicable ?? x.members.length) }) };
    return { msg: x.status === "risk" ? R("containers-public", { n: N(x.members.length) }) : R("containers-attention", { n: N(x.members.length) }) };
  },
});
