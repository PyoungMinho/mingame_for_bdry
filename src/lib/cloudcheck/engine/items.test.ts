// 구성원 → 대상(ItemResult) 변환: 매치 키 이스케이프, 위치 · 이름 마스킹, 상태별 모양, 엔진이 채우는 파라미터
import { describe, expect, it } from "vitest";
import type { ReceiptFact, ReceiptKey } from "../contract/normalized";
import { createDisplay } from "./display";
import { matchKeyOf, toEvidence, toItem, toMsgRef, toResourceRef, unknownParams } from "./items";
import type { BuildCtx } from "./items";
import type { Member, ResourceDesc } from "./types";

type Reported = Exclude<Member, { s: "excluded" }>;

const receipts = new Map<ReceiptKey, ReceiptFact>();
const fact = (key: string, call: string, result: ReceiptFact["result"], errorCode: string | null = null): ReceiptFact => {
  const f = { key, input: 0, call, region: "ap-northeast-2", subscription: null, resource: null, result, count: result === "ok" ? 1 : null, errorCode, at: { iso: "2026-10-19T03:15:01Z", ms: Date.UTC(2026, 9, 19, 3, 15, 1) }, used: true } as unknown as ReceiptFact;
  receipts.set(key as ReceiptKey, f);
  return f;
};
const ok = fact("0:r-0001", "s3:ListAllMyBuckets", "ok");
const denied = fact("0:r-0002", "s3:GetBucketAcl", "denied", "AccessDenied");
const unsupported = fact("0:r-0003", "ec2:DescribeSecurityGroups", "unsupported", "UnsupportedOperation");
const ctx = (): BuildCtx => ({ cloud: "aws", accountKey: "111122223333", display: createDisplay(), receipts, doorState: () => "selected" });
const bucket = (name: string, where: ResourceDesc["where"] = { kind: "region", value: "ap-northeast-2" }): ResourceDesc => ({ type: "s3-bucket", name: { type: "resourceName", value: name }, where, id: name });
const src = (key: string) => ({ input: 0, receipt: key as ReceiptKey, csv: null });

describe("matchKeyOf", () => {
  it("<cloud>|<계정>|<유형>|<위치 또는 ->|<고유 ID> 이고 구분자(|)와 %는 이스케이프한다", () => {
    expect(matchKeyOf("aws", "111122223333", bucket("amzn-s3-demo-a"))).toBe("aws|111122223333|s3-bucket|ap-northeast-2|amzn-s3-demo-a");
    expect(matchKeyOf("aws", "111122223333", bucket("a|b%c", { kind: "global", value: "global" }))).toBe("aws|111122223333|s3-bucket|-|a%7Cb%25c");
    expect(matchKeyOf("azure", "t|1", { ...bucket("x", null), type: "storage-account" })).toBe("azure|t%7C1|storage-account|-|x");
  });
  it("keyWhere가 있으면 키의 위치 마디는 where가 아니라 keyWhere를 따른다 — 화면 위치(where)는 그대로 둔다 (S3 버킷: 리전 조회 성공 · 실패와 무관하게 같은 키)", () => {
    const withRegion: ResourceDesc = { ...bucket("amzn-s3-demo-a"), keyWhere: { kind: "global", value: "global" } };
    const noRegion: ResourceDesc = { ...bucket("amzn-s3-demo-a", null), keyWhere: { kind: "global", value: "global" } };
    expect(matchKeyOf("aws", "111122223333", withRegion)).toBe("aws|111122223333|s3-bucket|-|amzn-s3-demo-a");
    expect(matchKeyOf("aws", "111122223333", noRegion)).toBe(matchKeyOf("aws", "111122223333", withRegion));
    // keyWhere를 생략하면 where 그대로
    expect(matchKeyOf("aws", "111122223333", bucket("amzn-s3-demo-a"))).toBe("aws|111122223333|s3-bucket|ap-northeast-2|amzn-s3-demo-a");
    const ref = toResourceRef(withRegion, ctx());
    expect(ref.location).toMatchObject({ kind: "region" });
    expect(ref.key).toBe("aws|111122223333|s3-bucket|-|amzn-s3-demo-a");
  });
  it("같은 대상은 항상 같은 키다 (Before/After · 예외 파일의 열쇠)", () => {
    expect(matchKeyOf("aws", "1", bucket("a"))).toBe(matchKeyOf("aws", "1", bucket("a")));
    expect(matchKeyOf("aws", "1", bucket("a"))).not.toBe(matchKeyOf("aws", "1", bucket("b")));
  });
});

describe("toResourceRef", () => {
  it("이름은 가림 대상 DisplayValue, 위치는 리전 · 구독 · 전역 구분", () => {
    const c = ctx();
    const r = toResourceRef(bucket("amzn-s3-demo-a"), c);
    expect(r.name).toMatchObject({ kind: "sensitive", full: "amzn-s3-demo-a", masked: "bucket-001" });
    expect(r.location).toEqual({ kind: "region", value: { kind: "plain", text: "ap-northeast-2" } });
    expect(toResourceRef(bucket("x", { kind: "subscription", value: "00000000-0000-0000-0000-0000000000b1" }), c).location).toMatchObject({ kind: "subscription", value: { kind: "sensitive", masked: "••••00b1" } });
    expect(toResourceRef({ type: "root", name: { plain: "root" }, where: { kind: "global", value: "global" }, id: "root" }, c).name).toEqual({ kind: "plain", text: "root" });
    expect(toResourceRef(bucket("y", null), c).location).toBeNull();
  });
});

describe("toItem", () => {
  const res = bucket("amzn-s3-demo-a");
  it("위험 · 주의는 증거를 싣고, 이상 없음은 증거 1개 이상이며, 확인 불가는 해소법을 싣는다", () => {
    const c = ctx();
    const risk = toItem({ s: "risk", res, why: { code: "AWS-STO-2:bucket-public-policy" }, ev: [{ src: src("0:r-0001") }] } as Reported, "AWS-STO-2", "sto", c, "id1");
    expect(risk).toMatchObject({ status: "risk", id: "id1", ruleId: "AWS-STO-2", why: { code: "AWS-STO-2:bucket-public-policy" } });
    expect(risk.status === "risk" && risk.evidence).toHaveLength(1);
    const clear = toItem({ s: "clear", res, why: { code: "AWS-STO-2:not-public" }, ev: [{ src: src("0:r-0001") }, { src: src("0:r-0002") }] } as Reported, "AWS-STO-2", "sto", c, "id2");
    expect(clear.status === "clear" && clear.evidence).toHaveLength(2);
    const unknown = toItem({ s: "unknown", res, why: { code: "denied" }, ev: [{ src: src("0:r-0002") }] } as Reported, "AWS-STO-2", "sto", c, "id3");
    expect(unknown.status === "unknown" && unknown.resolution).toEqual({ kind: "permission", permissions: ["s3:GetBucketAcl"] });
    expect(unknown.status === "unknown" && unknown.why.params).toEqual({ permission: { c: "s3:GetBucketAcl" } });
  });
  it("파라미터와 사실이 값으로 변환된다: 사용자 데이터는 가림 대상, 상수는 정리", () => {
    const c = ctx();
    const it = toItem({
      s: "caution", res, why: { code: "AWS-STO-2:website-public" }, ev: [{ src: src("0:r-0001") }],
      facts: [{ code: "fact:acl-public-grant", params: { grantee: { c: "AllUsers" }, who: { raw: { type: "userName", value: "alice" } }, n: { n: 2 } } }],
    } as Reported, "AWS-STO-2", "sto", c, "id");
    expect(it.facts[0].params).toEqual({ grantee: { c: "AllUsers" }, n: { n: 2 }, who: { v: { kind: "sensitive", type: "userName", full: "alice", masked: "user-001", flags: [] } } });
  });
  it("이름에 제어 · 양방향 문자가 있으면 '이상한 문자' 라벨이 붙는다", () => {
    const c = ctx();
    const it = toItem({ s: "caution", res: bucket("evil" + String.fromCharCode(0x202e) + "name"), why: { code: "AWS-STO-2:website-public" }, ev: [{ src: src("0:r-0001") }] } as Reported, "AWS-STO-2", "sto", c, "id");
    expect(it.labels).toContainEqual({ kind: "unusual-characters" });
  });
  it("룰이 준 라벨은 그대로 두고, 같은 라벨을 두 번 붙이지 않는다", () => {
    const c = ctx();
    const it = toItem({ s: "caution", res: bucket("evil" + String.fromCharCode(0x202e)), why: { code: "AWS-STO-2:website-public" }, ev: [{ src: src("0:r-0001") }], labels: [{ kind: "unusual-characters" }, { kind: "legacy-hint", basis: "created-before-2023-04" }] } as Reported, "AWS-STO-2", "sto", c, "id");
    expect(it.labels.filter((l) => l.kind === "unusual-characters")).toHaveLength(1);
    expect(it.labels).toContainEqual({ kind: "legacy-hint", basis: "created-before-2023-04" });
  });
});

describe("toEvidence · toMsgRef · unknownParams", () => {
  it("영수증 증거는 호출 · 범위 · 결과 · 시각을 싣고, 없는 영수증은 null이다", () => {
    const c = ctx();
    const e = toEvidence({ src: src("0:r-0002") }, c);
    expect(e.receipt).toMatchObject({ id: "0:r-0002", call: "s3:GetBucketAcl", result: "denied", errorCode: "AccessDenied", at: "2026-10-19T03:15:01Z" });
    expect(toEvidence({ src: src("0:r-9999") }, c).receipt).toBeNull();
    const csv = toEvidence({ src: { input: 0, receipt: null, csv: { kind: "csv-credential-report", row: 3, column: "mfa_active" } } }, c);
    expect(csv.csv).toEqual({ kind: "csv-credential-report", column: "mfa_active", row: 3 });
  });
  it("파라미터가 없으면 code만, 있으면 키 이름순으로 정렬해 담는다", () => {
    const c = ctx();
    expect(toMsgRef({ code: "denied" }, c)).toEqual({ code: "denied" });
    expect(Object.keys(toMsgRef({ code: "AWS-KEY-1:key-recent", params: { z: { n: 1 }, a: { n: 2 } } }, c).params ?? {})).toEqual(["a", "z"]);
  });
  it("거부는 권한 이름을, 오류 · 미지원은 오류 코드를 엔진이 채운다. 없으면 '-'", () => {
    expect(unknownParams("denied", [denied])).toEqual({ permission: { c: "s3:GetBucketAcl" } });
    expect(unknownParams("denied", [])).toEqual({ permission: { c: "-" } });
    expect(unknownParams("unsupported", [unsupported])).toEqual({ errorCode: { c: "UnsupportedOperation" } });
    expect(unknownParams("error", [ok])).toEqual({ errorCode: { c: "-" } });
    expect(unknownParams("truncated", [ok])).toBeUndefined();
  });
});
