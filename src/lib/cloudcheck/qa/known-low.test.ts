// QA — 낮음 · 결정 필요 항목의 재현 시험(설계서 §6 CR-07① · CR-12 · CR-15 · CR-17 + 실행 중 찾은 MatchKey 불안정)
// 2026-10-20 재검증: 버그 시험은 모두 회귀 시험(it)이 됐고, 결정 대기였던 D-2 · D-4는 결정대로 시험한다(CC-QA-22는 qa/ui/static-shell.test.ts).
import { describe, expect, it } from "vitest";
import { overlayExceptions } from "../engine/exceptions";
import type { IsoDate } from "../model/report";
import { parseExceptions } from "../parse/exceptions";
import { companyJson, itemsOf, label, nameText, okReport, receiptById, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";

describe("[CC-QA-13] AWS-NET-1: ENI 목록이 잘렸는데 '연결된 인터페이스 없음'으로 단정(E-18, CR-12)", () => {
  /** C의 KR ENI 목록을 잘린 것으로 — 공인 IP ENI(bastion 연결)가 잘려 나간 경우 */
  const truncated = (): Json => {
    const f = companyJson("aws", "C");
    const kr = (f.data.networkInterfaces as Json[]).find((p) => p.region === "ap-northeast-2");
    kr.items = (kr.items as Json[]).filter((e) => !e.groupIds.includes("sg-0c0ffee1"));
    const rc = receiptById(f, kr.receipt);
    rc.result = "truncated"; rc.count = kr.items.length;
    return f;
  };
  it("전제: 상태는 주의(위험을 확정하지 못함)이고 이상 없음은 아니다", () => {
    const st = ruleOf(okReport(runJson(truncated())), "AWS-NET-1").items.find((i) => nameText(i) === "sg-0c0ffee1")?.status;
    expect(st).toBe("caution");
  });
  it("[CC-QA-13] 사유는 '연결 확인 못 함'(sg-eni-unknown)이어야 한다 (수정 전: '연결된 인터페이스 없음' sg-unattached)", () => {
    const why = ruleOf(okReport(runJson(truncated())), "AWS-NET-1").items.find((i) => nameText(i) === "sg-0c0ffee1")?.why.code;
    expect(why).toBe("AWS-NET-1:sg-eni-unknown");
  });
});

describe("[CC-QA-16] AWS-STO-2: 버킷 리전을 못 읽으면 MatchKey가 바뀌어 예외 표시·전후 비교가 끊긴다", () => {
  const keyOf = (f: Json, name: string): string => ruleOf(okReport(runJson(f)), "AWS-STO-2").items.find((i) => nameText(i) === name)?.resource.key as string;
  const NAME = "amzn-s3-demo-acme-customer-export";
  const regionless = (): Json => {
    const f = companyJson("aws", "C");
    (f.data.buckets.items as Json[]).find((b) => b.name === NAME).region = { value: null, source: "list", receipt: null };
    return f;
  };
  it("[CC-QA-16] 같은 버킷은 리전 조회 성공·실패와 무관하게 같은 MatchKey여야 한다(S3 버킷 이름은 전역에서 유일)", () => {
    expect(keyOf(regionless(), NAME)).toBe(keyOf(companyJson("aws", "C"), NAME));
  });
  it("[CC-QA-16] 지난번에 표시한 예외가 리전 조회 실패 때도 그 버킷에 붙어야 한다(수정 전: unmatched)", () => {
    const key = keyOf(companyJson("aws", "C"), NAME);
    const parsed = parseExceptions(JSON.stringify({ schema: "cloudcheck.exceptions/1.0", entries: [{ ruleId: "AWS-STO-2", resource: key, reason: "QA", until: "2026-11-01", createdAt: "2026-10-19" }] }));
    if (!parsed.ok) throw new Error("parse");
    expect(overlayExceptions(okReport(runJson(regionless())), parsed.file, "2026-10-20" as IsoDate).counts.active).toBe(1);
  });
});

describe("[CC-QA-23] AZ-STO-2: 컨테이너 목록 슬롯 none(빈 목록 + null)을 룰은 계정 단위 확인 불가, 패밀리는 0개 완결로 봐서 거짓 확인 불가(CR-15)", () => {
  const withContainers = (result: "empty", value: null | []): Json => {
    const f = companyJson("azure", "A");
    const acct = (f.data.storageAccounts as Json[])[0].items[0];
    const rc = receiptById(f, acct.containers.receipt);
    rc.result = result; rc.count = 0; acct.containers.value = value;
    return f;
  };
  it("대조: 빈 목록([])이면 그 계정은 컨테이너 0개로 보고 룰은 이상 없음", () => {
    expect(label(ruleOf(okReport(runJson(withContainers("empty", []))), "AZ-STO-2"))).toBe("clear");
  });
  it("[CC-QA-23] none(빈 목록 + null)도 0개로 보아 룰이 확인 불가가 되지 않아야 한다(안전한 방향이지만 거짓 확인 불가)", () => {
    const r = ruleOf(okReport(runJson(withContainers("empty", null))), "AZ-STO-2");
    expect([label(r), itemsOf(r).join(" | ")]).toEqual(["clear", expect.any(String)]);
  });
});

describe("결정 반영(docs/planning/cloudcheck-qa-decisions.md D-2 · D-4 · CC-QA-22) — 수정 전 '현재 동작' 시험을 결정대로 바꿨다", () => {
  it("[CC-QA-08 · D-2] CloudTrail 기록 중 + 전송 오류(hasDeliveryError)인 trail은 주의(trail-delivery-error), 사실 줄은 그대로 남는다", () => {
    const f = companyJson("aws", "A");
    f.data.trails.value[0].status.value.hasDeliveryError = true;
    const r = ruleOf(okReport(runJson(f)), "AWS-LOG-1");
    expect(r.status).toBe("caution");
    expect(r.why.code).toBe("AWS-LOG-1:trail-delivery-error");
    expect(r.items[0].facts.map((x) => x.code)).toContain("fact:trail-delivery-error");
  });
  it("[CC-QA-08 · D-2] 대조: 전송 오류가 없는 trail은 그대로 이상 없음(정상 trail에 거짓 주의 없음)", () => {
    expect(ruleOf(okReport(runJson(companyJson("aws", "A"))), "AWS-LOG-1").status).toBe("clear");
  });
  it("[CC-QA-08 · D-2] 조건을 다 갖춘 다른 trail이 있으면 이상 없음(룰 의미는 그대로)", () => {
    const f = companyJson("aws", "A");
    const first = f.data.trails.value[0];
    const arn = "arn:aws:cloudtrail:ap-northeast-2:111122223333:trail/second-trail";
    const second = JSON.parse(JSON.stringify(first));
    second.name = "second-trail";
    second.trailArn = arn;
    second.status.receipt = "r-9031";
    second.selectors.receipt = "r-9032";
    first.status.value.hasDeliveryError = true;
    f.data.trails.value.push(second);
    receiptById(f, f.data.trails.receipt).count = 2;
    for (const [id, call] of [["r-9031", "cloudtrail:GetTrailStatus"], ["r-9032", "cloudtrail:GetEventSelectors"]] as const) {
      (f.receipts as Json[]).push({ id, call, region: "ap-northeast-2", resource: arn, result: "ok", count: null, errorCode: null, at: "2026-10-19T03:15:00Z" });
    }
    expect(ruleOf(okReport(runJson(f)), "AWS-LOG-1").status).toBe("clear");
  });
  it("[CC-QA-14 · D-4] 위험 포트(22) + 출발지가 프리픽스 리스트뿐이면 주의(sg-source-prefix-list) — 위험은 아니다(E-25)", () => {
    const f = companyJson("aws", "C");
    const sg = (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === "sg-0c0ffee1");
    sg.ingress = [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: [], ipv6Cidrs: [], prefixListIds: ["pl-0123abcd"], sgRefCount: 0 }];
    const it_ = ruleOf(okReport(runJson(f)), "AWS-NET-1").items.find((i) => nameText(i) === "sg-0c0ffee1");
    expect(it_?.status).toBe("caution");
    expect(it_?.why.code).toBe("AWS-NET-1:sg-source-prefix-list");
    expect(it_?.facts.map((x) => x.code)).toContain("fact:port-prefix-list");
  });
  it("[CC-QA-14 · D-4] 대조: 프리픽스 리스트 출발지가 80·443 · 메일 포트만이면 판정에서 뺀다(이상 없음)", () => {
    for (const [from, to] of [[443, 443], [80, 80], [25, 25]] as const) {
      const f = companyJson("aws", "C");
      const sg = (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === "sg-0c0ffee1");
      sg.ingress = [{ protocol: "tcp", fromPort: from, toPort: to, cidrs: [], ipv6Cidrs: [], prefixListIds: ["pl-0123abcd"], sgRefCount: 0 }];
      expect(ruleOf(okReport(runJson(f)), "AWS-NET-1").items.find((i) => nameText(i) === "sg-0c0ffee1")?.status, `${from}`).toBe("clear");
    }
  });
});

describe("[CC-QA-24] AWS-NET-1: 0~255 밖의 프로토콜 번호는 모르는 값(P3 — 2026-10-20 재검증에서 찾음 · 같은 날 수정, 수정 전: '포트 없는 프로토콜'로 보고 건너뜀)", () => {
  const bastionWith = (protocol: string): string | undefined => {
    const f = companyJson("aws", "C");
    const sg = (f.data.securityGroups as Json[]).flatMap((p) => p.items ?? []).find((s: Json) => s.groupId === "sg-0c0ffee1");
    sg.ingress = [{ protocol, fromPort: 22, toPort: 22, cidrs: ["0.0.0.0/0"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }];
    return ruleOf(okReport(runJson(f)), "AWS-NET-1").items.find((i) => nameText(i) === "sg-0c0ffee1")?.status;
  };
  it("대조: 실제 번호 1(ICMP) · 50(ESP) · 58(ICMPv6)은 포트가 없어 이상 없음이 맞고, 6(tcp)은 위험이다", () => {
    for (const p of ["1", "50", "58"]) expect(bastionWith(p), p).toBe("clear");
    expect(bastionWith("6")).toBe("risk");
  });
  it("[CC-QA-24] 프로토콜 번호 256 · 999(IP 프로토콜 번호는 0~255)와 앞자리 0 표기(006)는 모르는 값이라 확인 불가여야 한다(수정 전: 건너뛰어 이상 없음)", () => {
    for (const p of ["256", "999", "006"]) expect(bastionWith(p), p).toBe("unknown");
  });
});
