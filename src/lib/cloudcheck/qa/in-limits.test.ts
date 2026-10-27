// QA IN-03 · IN-04 · IN-09 — 크기 · 깊이 · 긴 이름 경계 (설계서 §4-4)
// IN-03: JSON 정확히 25 MiB(끝 공백) = 인식 진행, +1바이트 = too-large / CSV 20 MiB · +1 / 이름이 .csv인 JSON · .json인 CSV / 붙여넣기 25 MiB+1
//        UI 경로(state/pipeline: file.size 선검사, 이름 확장자 기준)와 recognize 경로(내용 기준) 둘 다.
// IN-04: 깊이 32 = 진행, 33 = too-deep, 문자열 안 괄호 1만 개는 무시, 알려진 섹션 안 깊은 중첩.
// IN-09: 스키마 상한 길이 이름(사용자 128 · 버킷 63 · ARN 2048 · NSG 80 · 구독 이름 256) → 판정 정상, 256자 넘으면 truncated 플래그.
import { describe, expect, it, vi } from "vitest";
import { LIMITS } from "../contract/collect-schema";
import type { DisplayValue } from "../model/report";
import { companyJson, enc, nameText, okReport, recOf, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";
import { sizeLimitFor } from "../../../app/cloudcheck/_client/state/pipeline";

vi.setConfig({ testTimeout: 60_000 });
const MiB = 1024 * 1024;

/** 정확히 n바이트가 되도록 끝을 공백으로 채운 원문 */
const padTo = (text: string, n: number): Uint8Array => {
  const b = enc(text);
  if (b.length > n) throw new Error("원문이 더 크다");
  const out = new Uint8Array(n);
  out.set(b);
  out.fill(0x20, b.length);
  return out;
};
const rec = (bytes: Uint8Array, name: string, via: "file" | "paste" = "file") => recOf({ content: new TextDecoder().decode(bytes), name, via, lastModified: Date.UTC(2026, 9, 19) });

describe("IN-03 크기 경계(recognize 경로)", () => {
  const json = JSON.stringify(companyJson("aws", "A"));
  it("JSON 정확히 25 MiB = 인식 진행(ok), 25 MiB + 1바이트 = too-large", () => {
    expect(rec(padTo(json, LIMITS.jsonBytes), "cloudcheck-aws.json").status).toBe("ok");
    expect(rec(padTo(json, LIMITS.jsonBytes + 1), "cloudcheck-aws.json").status).toBe("too-large");
  });
  it("CSV 정확히 20 MiB = 인식 진행, + 1바이트 = too-large", () => {
    const csv = (s: string) => `user,arn,user_creation_time,password_enabled,password_last_used,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date\n<root_account>,arn:aws:iam::111122223333:root,2019-04-02T01:00:00+00:00,not_supported,N/A,true,false,N/A,N/A,false,N/A,N/A\n${s}`;
    expect(rec(padTo(csv(""), LIMITS.csvBytes), "credential-report.csv").status).toBe("ok");
    expect(rec(padTo(csv(""), LIMITS.csvBytes + 1), "credential-report.csv").status).toBe("too-large");
  });
  it("이름이 .csv인 JSON은 내용(JSON) 기준 25 MiB 상한, 이름이 .json인 CSV는 내용(CSV) 기준 20 MiB 상한", () => {
    expect(rec(padTo(json, 22 * MiB), "result.csv").status).toBe("ok");
    expect(rec(padTo("user,arn,password_enabled\n", 21 * MiB), "report.json").status).toBe("too-large");
  });
  it("붙여넣기 25 MiB + 1바이트 = too-large", () => {
    expect(rec(padTo(json, LIMITS.jsonBytes + 1), "pasted", "paste").status).toBe("too-large");
  });
});

describe("IN-03 크기 경계(UI 경로: file.size 선검사)", () => {
  it("UI 상한은 이름 확장자로 정한다: .csv = 20 MiB, 그 밖 = 25 MiB", () => {
    expect(sizeLimitFor("x.csv")).toBe(LIMITS.csvBytes);
    expect(sizeLimitFor("X.CSV")).toBe(LIMITS.csvBytes);
    expect(sizeLimitFor("x.json")).toBe(LIMITS.jsonBytes);
    expect(sizeLimitFor("x")).toBe(LIMITS.jsonBytes);
  });
  it("두 경로가 어긋나는 쪽은 모두 '거부' 방향이다: 22 MiB JSON을 .csv 이름으로 넣으면 UI가 먼저 거부(recognize는 받는다) — 정보", () => {
    expect(22 * MiB > sizeLimitFor("result.csv")).toBe(true);
    expect(22 * MiB <= LIMITS.jsonBytes).toBe(true);
  });
});

/* ───────── IN-04 깊이 ───────── */
const nest = (depth: number, inner = "1"): string => "[".repeat(depth) + inner + "]".repeat(depth);
describe("IN-04 깊이 경계", () => {
  it("깊이 32는 too-deep이 아니고(봉투 검증으로 not-cloudcheck), 33은 too-deep", () => {
    expect(rec(enc(nest(32)), "x.json").status).toBe("not-cloudcheck");
    expect(rec(enc(nest(33)), "x.json").status).toBe("too-deep");
    expect(rec(enc(`{"a":${nest(31)}}`), "x.json").status).toBe("not-cloudcheck");
    expect(rec(enc(`{"a":${nest(32)}}`), "x.json").status).toBe("too-deep");
  });
  it("문자열 안의 괄호 1만 개는 깊이로 세지 않는다(정상 파일의 사용자 이름에 넣어도 인식된다)", () => {
    const f = companyJson("aws", "A");
    f.identity.principalName = "[".repeat(10_000).slice(0, 128);
    f.data.iamRoles.value[0].path = `/${"{[".repeat(250)}/`;   // 512자 상한 안
    expect(recOf({ content: JSON.stringify(f), name: "cloudcheck-aws.json", via: "file", lastModified: null }).status).toBe("ok");
    expect(rec(enc(JSON.stringify({ schema: "x", s: "[".repeat(10_000) })), "x.json").status).toBe("not-cloudcheck");
  });
  it("알려진 섹션 안의 깊은 중첩(33단)은 파일 전체 too-deep으로 막힌다(판정 0)", () => {
    const f = companyJson("aws", "A");
    f.data.trails.value[0].selectors.value.advanced = [{ fields: [{ field: "x", equals: [] }] }];
    let deep: Json = "x";
    for (let i = 0; i < 40; i++) deep = [deep];
    f.data.extra = deep;
    expect(recOf({ content: JSON.stringify(f), name: "cloudcheck-aws.json", via: "file", lastModified: null }).status).toBe("too-deep");
  });
});

/* ───────── IN-09 아주 긴 이름 ───────── */
const flagsOf = (v: DisplayValue): readonly string[] => (v.kind === "sensitive" ? v.flags : []);
describe("IN-09 스키마 상한 길이의 이름", () => {
  it("사용자 128자 · 버킷 63자 · 역할 64자 · 외부 주체 ARN 2048자: 정상 판정, ARN(256자 초과)만 truncated 플래그", () => {
    const f = companyJson("aws", "C");
    const user = (f.data.iamUsers.items as Json[]).find((u) => u.userName === "ex-employee");
    const longUser = `u${"x".repeat(127)}`;
    user.userName = longUser;
    f.data.credentialReport.value.csv = (f.data.credentialReport.value.csv as string).split("ex-employee,").join(`${longUser},`).split("user/ex-employee").join(`user/${longUser}`);
    for (const r of f.receipts as Json[]) if (r.resource === "ex-employee") r.resource = longUser;
    const longBucket = `amzn-s3-demo-${"b".repeat(50)}`;
    const b = (f.data.buckets.items as Json[]).find((x) => x.name === "amzn-s3-demo-acme-logs");
    for (const r of f.receipts as Json[]) if (r.resource === b.name) r.resource = longBucket;
    b.name = longBucket;
    const role = (f.data.iamRoles.value as Json[]).find((r) => r.roleName === "vendor-access");
    const longArn = `arn:aws:iam::999988887777:role/${"r".repeat(2048 - 31)}`;
    role.trust[0].principal.aws = [longArn];
    const r = okReport(runJson(f));
    expect(longUser.length).toBe(128);
    expect(longBucket.length).toBe(63);
    expect(longArn.length).toBe(2048);
    expect(ruleOf(r, "AWS-MFA-2").items.find((i) => nameText(i) === longUser)?.status).toBe("risk");
    expect(ruleOf(r, "AWS-STO-2").items.find((i) => nameText(i) === longBucket)?.status).toBe("clear");
    const vendor = ruleOf(r, "AWS-KEY-4").items.find((i) => nameText(i) === "vendor-access");
    expect(vendor?.status).toBe("caution");
    const principal = vendor?.facts.flatMap((x) => Object.values(x.params ?? {})).find((p) => "v" in p);
    expect(principal && "v" in principal ? flagsOf(principal.v) : []).toContain("truncated");
  });
  it("NSG 이름 80자 · 구독 이름 256자: 정상 판정, 256자 구독 이름은 잘리지 않는다(상한 = 256)", () => {
    const f = companyJson("azure", "C");
    const nsg = (f.data.nsgs as Json[]).flatMap((p) => p.items ?? []).find((n: Json) => n.name === "nsg-acme-dev");
    nsg.name = `nsg-${"n".repeat(76)}`;
    const sub = (f.scope.subscriptions.value as Json[])[1];
    sub.name = "구".repeat(256);
    const r = okReport(runJson(f));
    expect(ruleOf(r, "AZ-NET-1").items.find((i) => nameText(i) === nsg.name)?.status).toBe("clear");
    const subItem = ruleOf(r, "AZ-LOG-1").items.find((i) => nameText(i) === sub.name);
    expect(subItem?.status).toBe("caution");
    expect(subItem ? flagsOf(subItem.resource.name) : ["없음"]).toEqual([]);
  });
});
