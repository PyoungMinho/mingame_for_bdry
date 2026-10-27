// src/lib/cloudcheck/collector/collector.aws.test.ts — AWS 수집기 shim 실행 테스트 (G4: 가짜 CLI shim 실행, 시나리오 16종)
// 실제 bash(이 맥은 3.2)로 cloudcheck-aws.sh를 PATH 맨 앞의 가짜 aws/date/sleep 위에서 돌린다. 시나리오 밖 호출은 실패한다.
// 모든 시나리오 공통: 호출된 명령이 전부 카탈로그에 속함 · 금지 플래그 0 · 호출마다 영수증 1건 · 결과가 collect-schema(strict)를 통과 · 키 ID 전체 0.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AWS_CALLS } from "../contract/calls";
import { AWS_BUCKET_ASSETS, AWS_BUCKET_LOGS, AWS_REPORT_CSV, AWS_TRAIL_ARN, POISON_MARKERS, awsBase, awsCase } from "./__scenarios__";
import { awsFail, out, withScenario } from "./__scenarios__/types";
import { commonProblems, realCalls } from "./testcommon";
import { SCRIPT_PATH, commandOf, runCollector } from "./testkit";
import type { RunResult } from "./testkit";

vi.setConfig({ testTimeout: 180_000 });

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const cache = new Map<string, RunResult>();
const run = (id: string): RunResult => {
  let r = cache.get(id);
  if (!r) { const c = awsCase(id); r = runCollector({ cloud: "aws", scenario: c.scenario, args: c.args, withoutTools: c.withoutTools }); cache.set(id, r); }
  return r;
};
const data = (r: RunResult): Json => (r.output as Json).data as Json;
const receipts = (r: RunResult): Json[] => (r.output as Json).receipts as Json[];
const rcOf = (r: RunResult, id: string): Json => receipts(r).find((x) => x.id === id) as Json;
const calls = (r: RunResult, cli: string): ReturnType<typeof realCalls> => realCalls(r).filter((c) => commandOf(c) === cli);

describe("AWS 수집기 — 시나리오 공통 검사(계약 스키마·카탈로그·영수증)", () => {
  for (const id of ["aws-01-normal", "aws-02-denied-all", "aws-03-region-denied", "aws-04-buckets-truncated", "aws-05-throttled", "aws-06-old-cli-252", "aws-07-not-json", "aws-08-isolated-denial", "aws-09-report-timeout", "aws-10-poison", "aws-13-doors-net", "aws-15-injection-names", "aws-16-users-200"]) {
    it(`${id}: 공통 위반 0`, () => {
      const r = run(id);
      expect(r.status, r.stderr).toBe(0);
      expect(commonProblems(r, "aws")).toEqual([]);
    });
  }
});

describe("① 정상", () => {
  const r = (): RunResult => run("aws-01-normal");
  it("결과 파일 1개, 이름은 계정 끝 4자리 + UTC 시각, 화면에는 안내만(표준 출력 비어 있음)", () => {
    expect(r().outputName).toBe("cloudcheck-aws-3333-20261019T031200Z.json");
    expect(r().files).toEqual([r().outputName]);
    expect(r().stdout).toBe("");
    expect(r().stderr).toContain("계정 ID   : 111122223333");
    expect(r().stderr).toContain("결과 파일: cloudcheck-aws-3333-20261019T031200Z.json");
  });
  it("봉투: 스키마 ID, 수집기 이름·버전·도구, 확인 방식, 문 5개 모두 수집", () => {
    const o = r().output as Json;
    expect(o.schema).toBe("cloudcheck.collect/1.0");
    expect(o.collector).toMatchObject({ name: "cloudcheck-aws", version: "1.0.0" });
    expect(o.collector.tools.cli).toBe("aws-cli/2.17.0");
    expect(o.collector.tools.jq).toMatch(/^jq-/);
    expect(o.collectedAt).toBe("2026-10-19T03:12:00Z");
    expect(o.run).toEqual({ finishedAt: "2026-10-19T03:12:00Z", confirmed: "flag-yes", doors: { mfa: "collected", key: "collected", net: "collected", sto: "collected", log: "collected" } });
  });
  it("collector.sha256 = 실행한 스크립트 파일의 SHA-256(버전 확인용)", () => {
    const want = createHash("sha256").update(readFileSync(SCRIPT_PATH.aws)).digest("hex");
    expect((r().output as Json).collector.sha256).toBe(want);
  });
  it("신원: 계정 ID 전체 · 주체 유형·이름 · 별칭. 세션 이름(이메일)은 어디에도 없다", () => {
    const id = (r().output as Json).identity;
    expect(id).toMatchObject({ accountId: "111122223333", partition: "aws", principalType: "assumed-role", principalName: "SecurityAuditRole", alias: { value: "example-corp" } });
    expect(r().outputText).not.toContain("kim@example.com");
  });
  it("호출 수 = 영수증 수, 26종 호출이 모두 쓰였고 카탈로그 밖 호출은 0", () => {
    const used = new Set(realCalls(r()).map(commandOf));
    expect([...used].sort()).toEqual(Object.values(AWS_CALLS).map((m) => m.cli).sort());
    expect(receipts(r())).toHaveLength(realCalls(r()).length);
  });
  it("보고서 생성 폴링: STARTED → INPROGRESS → COMPLETE (sleep 2번), 마지막 영수증이 generateReceipt", () => {
    expect(r().sleeps).toBe(2);
    expect(calls(r(), "aws iam generate-credential-report")).toHaveLength(3);
    expect(data(r()).credentialReport.generateReceipt).toBe("r-0006");
    expect(data(r()).credentialReport.value).toEqual({ generatedTime: "2026-10-19T03:11:58+00:00", format: "text/csv", csv: AWS_REPORT_CSV });
  });
  it("계정 요약은 7개 키만, 활성 리전·사용자는 이름순", () => {
    expect(data(r()).accountSummary.value).toEqual({ Users: 2, Groups: 1, Roles: 2, AccountMFAEnabled: 1, AccountAccessKeysPresent: 0, AccountSigningCertificatesPresent: 0, MFADevicesInUse: 1 });
    expect((r().output as Json).scope).toEqual({ regions: { receipt: "r-0003", value: ["ap-northeast-2", "us-east-1"] }, regionsRequested: null });
    expect(data(r()).iamUsers.items.map((u: Json) => u.userName)).toEqual(["alice", "build-bot"]);
    expect(data(r()).iamUsers.budget).toEqual({ limit: 150, total: 2, collected: 2 });
  });
  it("액세스 키는 상태·생성일·끝 4자리만(전체 ID 0)", () => {
    const bot = data(r()).iamUsers.items.find((u: Json) => u.userName === "build-bot");
    expect(bot.accessKeys.value).toEqual([{ status: "Active", createDate: "2026-01-05T00:00:00+00:00", idSuffix: "MPLE" }]);
    expect(bot.mfaDevices.value).toEqual({ count: 0 });
    expect(r().outputText).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });
  it("역할 신뢰 정책: 주체 값과 조건 키 이름만(조건 값 없음)", () => {
    const roles = data(r()).iamRoles.value as Json[];
    const partner = roles.find((x) => x.roleName === "partner-readonly") as Json;
    expect(partner.trust[0].principal.aws).toEqual(["arn:aws:iam::444455556666:root"]);
    expect(partner.trust[0].conditionKeys).toEqual(["StringEquals:sts:ExternalId"]);
    expect(r().outputText).not.toContain("POISON-external-id-value");
  });
  it("보안 그룹 · 네트워크 인터페이스: 규칙은 포트·CIDR만, ENI는 공인 IP 유무만", () => {
    const sg = data(r()).securityGroups as Json[];
    expect(sg.map((x) => x.region)).toEqual(["ap-northeast-2", "us-east-1"]);
    const bastion = sg[0].items.find((x: Json) => x.groupName === "bastion-ssh");
    expect(bastion.ingress).toEqual([{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["0.0.0.0/0"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }]);
    const eni = (data(r()).networkInterfaces as Json[])[0].items[0];
    expect(eni).toEqual({ eniId: "eni-0f00ba12", groupIds: ["sg-0a1b2c3d"], hasPublicIp: true, hasIpv6: false, interfaceType: "interface", status: "in-use", requesterManaged: false });
  });
  it("S3: '설정 없음'은 notconfigured 영수증 + value null, 버킷마다 6개 칸, 공개 후보(assets)는 ACL·웹사이트가 보인다", () => {
    const acct = data(r()).accountPublicAccessBlock;
    expect(acct.value).toBeNull();
    expect(rcOf(r(), acct.receipt)).toMatchObject({ call: "s3:GetAccountPublicAccessBlock", result: "notconfigured", errorCode: "NoSuchPublicAccessBlockConfiguration", count: null });
    const items = data(r()).buckets.items as Json[];
    expect(items.map((b) => b.name)).toEqual([AWS_BUCKET_ASSETS, AWS_BUCKET_LOGS]);
    const assets = items[0];
    expect(assets.region.value).toBe("us-east-1");   // 목록에 리전이 없어 get-bucket-location(null = us-east-1)으로 보충
    expect(assets.region.source).toBe("location");
    expect(rcOf(r(), assets.region.receipt)).toMatchObject({ call: "s3:GetBucketLocation", result: "ok", resource: AWS_BUCKET_ASSETS });
    expect((items[1] as Json).region).toEqual({ value: "ap-northeast-2", source: "list", receipt: null });
    expect(assets.acl.value).toEqual({ publicGrants: [{ grantee: "AllUsers", permission: "READ" }] });
    expect(assets.website.value).toEqual({ enabled: true });
    const logs = items[1];
    expect(logs.policyStatus.value).toBeNull();
    expect(rcOf(r(), logs.policyStatus.receipt)).toMatchObject({ result: "notconfigured", errorCode: "NoSuchBucketPolicy", resource: AWS_BUCKET_LOGS, region: "ap-northeast-2" });
  });
  it("CloudTrail: trail 1개, 상태와 이벤트 선택기(데이터 이벤트 대상 ARN은 버림)", () => {
    const t = (data(r()).trails.value as Json[])[0];
    expect(t).toMatchObject({ name: "main-trail", homeRegion: "ap-northeast-2", isMultiRegion: true, logFileValidationEnabled: true, hasCloudWatchLogs: false });
    expect(t.status.value).toEqual({ isLogging: true, hasDeliveryError: false });
    expect(t.selectors.value).toEqual({ basic: [{ readWriteType: "All", includeManagementEvents: true }], advanced: [] });
    expect(r().outputText).not.toContain("POISON");
  });
  it("영수증 필드: 항목 단위 호출에는 resource, 리전 단위 호출에는 region, 시각은 date shim 고정값", () => {
    const rcs = receipts(r());
    const acl = rcs.filter((x) => x.call === "s3:GetBucketAcl");
    expect(acl.map((x) => [x.resource, x.region])).toEqual([[AWS_BUCKET_ASSETS, "us-east-1"], [AWS_BUCKET_LOGS, "ap-northeast-2"]]);
    expect(rcs.filter((x) => x.call === "iam:ListMFADevices").map((x) => x.resource)).toEqual(["alice", "build-bot"]);
    expect(rcs.every((x) => x.at === "2026-10-19T03:12:00Z")).toBe(true);
  });
  it("--print: 결과 JSON을 표준 출력에도 낸다(안내는 표준 오류)", () => {
    const c = awsCase("aws-01-normal");
    const p = runCollector({ cloud: "aws", scenario: c.scenario, args: [...c.args, "--print"] });
    expect(p.status).toBe(0);
    expect(p.stdout).toBe(p.outputText);
    expect(p.stderr).not.toContain('{"schema"');
  });
});

describe("② 신원 외 전부 거부", () => {
  const r = (): RunResult => run("aws-02-denied-all");
  it("모든 문의 영수증이 denied(AccessDenied)이고 값은 null, 항목별 호출은 하나도 나가지 않는다", () => {
    const rcs = receipts(r()).slice(2);
    expect(rcs.every((x) => x.result === "denied" && x.errorCode === "AccessDenied" && x.count === null)).toBe(true);
    expect(calls(r(), "aws iam list-access-keys")).toHaveLength(0);
    expect(calls(r(), "aws s3api get-bucket-acl")).toHaveLength(0);
    expect(data(r()).iamUsers).toMatchObject({ items: null, budget: { total: 0, collected: 0 } });
    expect(data(r()).credentialReport.value).toBeNull();
    expect(data(r()).buckets.items).toBeNull();
    expect(data(r()).trails.value).toBeNull();
  });
  it("리전 목록이 거부되면 범위 미증명: regions.value = null, 보안 그룹 조회 0건", () => {
    expect((r().output as Json).scope.regions.value).toBeNull();
    expect(calls(r(), "aws ec2 describe-security-groups")).toHaveLength(0);
    expect(data(r()).securityGroups).toEqual([]);
  });
  it("오류 메시지 원문(ARN·이메일)은 어디에도 저장하지 않는다", () => {
    expect(r().outputText).not.toContain("is not authorized");
    expect(r().outputText).not.toContain("kim@example.com");
  });
});

describe("③ 리전 하나만 UnauthorizedOperation", () => {
  it("그 리전의 보안 그룹만 denied + items null, 나머지는 정상", () => {
    const sg = data(run("aws-03-region-denied")).securityGroups as Json[];
    const east = sg.find((x) => x.region === "us-east-1") as Json;
    expect(east.items).toBeNull();
    expect(rcOf(run("aws-03-region-denied"), east.receipt)).toMatchObject({ result: "denied", errorCode: "UnauthorizedOperation", region: "us-east-1", count: null });
    expect((sg.find((x) => x.region === "ap-northeast-2") as Json).items).toHaveLength(2);
    expect((data(run("aws-03-region-denied")).networkInterfaces as Json[]).every((x) => x.items !== null)).toBe(true);
  });
});

describe("④ list-buckets에 ContinuationToken", () => {
  it("영수증은 truncated(받은 만큼 count, errorCode 없음)이고 받은 버킷은 그대로 쓴다", () => {
    const r = run("aws-04-buckets-truncated");
    const b = data(r).buckets;
    expect(rcOf(r, b.receipt)).toMatchObject({ call: "s3:ListAllMyBuckets", result: "truncated", count: 2, errorCode: null });
    expect(b.items).toHaveLength(2);
    expect(r.outputText).not.toContain("POISON-next-page-token");
  });
});

describe("⑤ Throttling · ⑥ 종료 코드 252 · ⑦ JSON 아님", () => {
  it("ThrottlingException·SlowDown → throttled, 값 null", () => {
    const r = run("aws-05-throttled");
    const logs = (data(r).buckets.items as Json[]).find((b) => b.name === AWS_BUCKET_LOGS) as Json;
    expect(logs.acl.value).toBeNull();
    expect(rcOf(r, logs.acl.receipt)).toMatchObject({ result: "throttled", errorCode: "ThrottlingException", count: null });
    expect(rcOf(r, logs.website.receipt)).toMatchObject({ result: "throttled", errorCode: "SlowDown" });
  });
  it("종료 코드 252 → unsupported / cli-exit-252", () => {
    const r = run("aws-06-old-cli-252");
    const logs = (data(r).buckets.items as Json[]).find((b) => b.name === AWS_BUCKET_LOGS) as Json;
    expect(rcOf(r, logs.ownership.receipt)).toMatchObject({ result: "unsupported", errorCode: "cli-exit-252" });
    expect(logs.ownership.value).toBeNull();
  });
  it("표준 출력이 JSON이 아니면 error / output-not-json, 그 목록에서 파생되는 사용자별 호출은 0", () => {
    const r = run("aws-07-not-json");
    expect(rcOf(r, data(r).iamUsers.receipt)).toMatchObject({ call: "iam:ListUsers", result: "error", errorCode: "output-not-json" });
    expect(data(r).iamUsers.items).toBeNull();
    expect(calls(r, "aws iam list-access-keys")).toHaveLength(0);
    expect(data(r).iamGroups).toEqual([]);
    expect(r.outputText).not.toContain("Traceback");
  });
});

describe("⑧ 버킷 3개 중 1개만 ACL·정책 상태 거부 (INV-7 재료)", () => {
  it("거부 영수증에 resource(버킷 이름)가 있고 같은 계열 다른 버킷은 성공했다", () => {
    const r = run("aws-08-isolated-denial");
    const acl = receipts(r).filter((x) => x.call === "s3:GetBucketAcl");
    expect(acl.map((x) => [x.resource, x.result])).toEqual([["amzn-s3-demo-assets", "ok"], ["amzn-s3-demo-data", "denied"], ["amzn-s3-demo-logs", "ok"]]);
    const ps = receipts(r).filter((x) => x.call === "s3:GetBucketPolicyStatus");
    expect(ps.filter((x) => x.result === "denied").map((x) => x.resource)).toEqual(["amzn-s3-demo-data"]);
    const dataBucket = (data(r).buckets.items as Json[]).find((b) => b.name === "amzn-s3-demo-data") as Json;
    expect(dataBucket.acl.value).toBeNull();
    expect(dataBucket.policyStatus.value).toBeNull();
    expect(dataBucket.publicAccessBlock.value).not.toBeNull();
  });
});

describe("⑨ 리포트 폴링 시간 초과", () => {
  it("생성 요청을 10번 하고 sleep 10번 뒤 보고서 받기는 ReportInProgress(error)로 남는다", () => {
    const r = run("aws-09-report-timeout");
    expect(calls(r, "aws iam generate-credential-report")).toHaveLength(10);
    expect(r.sleeps).toBe(10);
    const cr = data(r).credentialReport;
    expect(cr.value).toBeNull();
    expect(rcOf(r, cr.receipt)).toMatchObject({ call: "iam:GetCredentialReport", result: "error", errorCode: "ReportInProgress" });
    expect(cr.generateReceipt).toBe("r-0013");
  });
});

describe("⑩ 독이 든 응답", () => {
  it("태그·정책 전문·전체 키 ID·비밀 모양 문자열·IP·XSS·이메일이 출력에 하나도 없다", () => {
    const r = run("aws-10-poison");
    for (const m of POISON_MARKERS) expect(r.outputText, m).not.toContain(m);
    expect(r.outputText).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(r.outputText).not.toContain("Tags");
    expect(r.outputText).not.toContain("PolicyDocument");
  });
  it("허용 필드는 그대로 나온다(독이 든 응답 속에서도 판정 재료는 유지)", () => {
    const r = run("aws-10-poison");
    const bot = (data(r).iamUsers.items as Json[]).find((u) => u.userName === "build-bot") as Json;
    expect(bot.accessKeys.value[0].idSuffix).toBe("MPLE");
    const logs = (data(r).buckets.items as Json[]).find((b) => b.name === AWS_BUCKET_LOGS) as Json;
    expect(logs.acl.value).toEqual({ publicGrants: [{ grantee: "AuthenticatedUsers", permission: "READ_ACP" }] });
    // 전송 오류 글자는 버리고 '오류 기록이 있다'만 남는다(D-2)
    expect(((data(r).trails.value as Json[])[0].status as Json).value).toEqual({ isLogging: true, hasDeliveryError: true });
  });
  it("원본 응답에는 독이 실제로 들어 있었다(테스트 자체의 유효성)", () => {
    const c = awsCase("aws-10-poison");
    const text = JSON.stringify(c.scenario);
    for (const m of ["POISON", "wJalrXUtnFEMI", "BEGIN PRIVATE KEY", "203.0.113.", "onerror"]) expect(text).toContain(m);
  });
});

describe("⑪ jq 없음 · ⑫ aws 없음 · ⑭ 비대화형 --yes 없음", () => {
  it("jq가 없으면 클라우드 호출 0건으로 끝난다(종료 코드 4, 파일 없음)", () => {
    const r = run("aws-11-no-jq");
    expect(r.status).toBe(4);
    expect(r.calls).toHaveLength(0);
    expect(r.outputName).toBeNull();
    expect(r.stderr).toContain("jq");
  });
  it("aws가 없으면 호출 0건으로 끝난다", () => {
    const r = run("aws-12-no-aws");
    expect(r.status).toBe(4);
    expect(r.calls).toHaveLength(0);
    expect(r.stderr).toContain("aws");
  });
  it("대화형이 아니고 --yes도 없으면 신원 확인 호출 2건 뒤 종료 코드 3, 결과 파일 없음", () => {
    const r = run("aws-14-no-yes");
    expect(r.status).toBe(3);
    expect(realCalls(r).map(commandOf)).toEqual(["aws sts get-caller-identity", "aws iam list-account-aliases"]);
    expect(r.outputName).toBeNull();
    expect(r.files).toEqual([]);
    expect(r.stderr).toContain("--yes");
    expect(r.stderr).toContain("111122223333");
  });
});

describe("버킷 리전 보충(get-bucket-location)", () => {
  it("EU → eu-west-1, 호출이 거부되면 region.value = null이고 이후 호출은 us-east-1로 간다", () => {
    const sc = withScenario(awsBase(), {
      "s3api list-buckets": out({ Buckets: [
        { Name: "amzn-s3-demo-eu", CreationDate: "2022-05-01T00:00:00+00:00" },
        { Name: "amzn-s3-demo-gone", CreationDate: "2022-05-02T00:00:00+00:00" },
      ] }),
      "s3api get-bucket-location#amzn-s3-demo-eu": out({ LocationConstraint: "EU" }),
      "s3api get-bucket-location#amzn-s3-demo-gone": awsFail("AccessDenied", "GetBucketLocation"),
      ...Object.fromEntries(["get-public-access-block", "get-bucket-policy-status", "get-bucket-acl", "get-bucket-ownership-controls", "get-bucket-website"].flatMap((op) => [
        [`s3api ${op}#amzn-s3-demo-eu@eu-west-1`, awsFail("AccessDenied", op)], [`s3api ${op}#amzn-s3-demo-gone@us-east-1`, awsFail("AccessDenied", op)],
      ])),
    });
    const r = runCollector({ cloud: "aws", scenario: sc, args: ["--yes", "--doors", "sto"] });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "aws")).toEqual([]);
    const items = data(r).buckets.items as Json[];
    expect(items[0].region).toMatchObject({ value: "eu-west-1", source: "location" });
    expect(items[1].region).toMatchObject({ value: null, source: "location" });
    expect(rcOf(r, items[1].region.receipt)).toMatchObject({ result: "denied", errorCode: "AccessDenied", call: "s3:GetBucketLocation" });
    expect(rcOf(r, items[0].acl.receipt).region).toBe("eu-west-1");
    expect(rcOf(r, items[1].acl.receipt).region).toBe("us-east-1");
  });
});

describe("⑬ --doors net", () => {
  it("신원·범위·net 호출만 나가고, run.doors와 data 섹션이 그에 맞다", () => {
    const r = run("aws-13-doors-net");
    expect(realCalls(r).map(commandOf)).toEqual([
      "aws sts get-caller-identity", "aws iam list-account-aliases", "aws ec2 describe-regions",
      "aws ec2 describe-security-groups", "aws ec2 describe-network-interfaces", "aws ec2 describe-security-groups", "aws ec2 describe-network-interfaces",
    ]);
    expect((r.output as Json).run.doors).toEqual({ mfa: "skipped", key: "skipped", net: "collected", sto: "skipped", log: "skipped" });
    expect(Object.keys(data(r)).sort()).toEqual(["networkInterfaces", "securityGroups"]);
    expect(r.sleeps).toBe(0);
  });
  it("--doors mfa: 자격증명 보고서·요약·사용자·MFA 장치만 부르고 키 칸은 빈 칸(목록 영수증을 가리킨다)", () => {
    const c = awsCase("aws-01-normal");
    const r = runCollector({ cloud: "aws", scenario: c.scenario, args: ["--yes", "--doors", "mfa"] });
    expect(commonProblems(r, "aws")).toEqual([]);
    const used = new Set(realCalls(r).map(commandOf));
    expect(used.has("aws iam list-mfa-devices")).toBe(true);
    for (const never of ["aws iam list-access-keys", "aws iam list-attached-user-policies", "aws iam list-groups-for-user", "aws iam list-roles", "aws ec2 describe-security-groups", "aws s3api list-buckets", "aws cloudtrail describe-trails"]) expect(used.has(never), never).toBe(false);
    const u = (data(r).iamUsers.items as Json[])[0];
    expect(u.accessKeys).toEqual({ receipt: data(r).iamUsers.receipt, value: null });
    expect(u.mfaDevices.receipt).not.toBe(data(r).iamUsers.receipt);
    expect(data(r).iamRoles).toBeUndefined();
    expect(data(r).iamGroups).toBeUndefined();
  });
});

describe("⑮ 명령 주입을 노린 이름", () => {
  it("$(touch PWNED) · 세미콜론 · 백틱 이름을 데이터로만 다룬다(PWNED 파일이 생기지 않는다)", () => {
    const r = run("aws-15-injection-names");
    expect(r.files.some((f) => f.includes("PWNED"))).toBe(false);
    expect(r.files).toHaveLength(1);
    const names = (data(r).iamUsers.items as Json[]).map((u) => u.userName);
    expect(names).toEqual(["$(touch PWNED)", "`touch PWNED`", "a b;touch PWNED"]);
    expect(calls(r, "aws iam list-access-keys").map((c) => c.args[c.args.indexOf("--user-name") + 1])).toEqual(names);
    expect((data(r).buckets.items as Json[])[0].name).toBe("$(touch PWNED)");
    expect(r.outputText).toContain("$(touch PWNED)");
  });
});

describe("⑯ 사용자 200명 → 예산 150", () => {
  it("처음 150명만 조회하고 나머지 50명은 영수증 없이(목록 영수증을 가리키는 빈 칸) 남는다", () => {
    const r = run("aws-16-users-200");
    const iu = data(r).iamUsers;
    expect(iu.budget).toEqual({ limit: 150, total: 200, collected: 150 });
    expect(iu.items).toHaveLength(200);
    expect(calls(r, "aws iam list-mfa-devices")).toHaveLength(150);
    expect(iu.items[149].mfaDevices.receipt).not.toBe(iu.receipt);
    expect(iu.items[150].mfaDevices).toEqual({ receipt: iu.receipt, value: null });
    expect(iu.items[199].userName).toBe("user-199");
    expect(r.stderr).toContain("200명 중 최대 150명");
    expect(r.stderr).toContain("호출 100건째");
  });
});

describe("옵션·환경", () => {
  const base = awsCase("aws-01-normal").scenario;
  it("--regions: 요청 리전만 보고, regionsRequested에 기록한다", () => {
    const r = runCollector({ cloud: "aws", scenario: base, args: ["--yes", "--doors", "net", "--regions", "ap-northeast-2"] });
    expect(r.status, r.stderr).toBe(0);
    expect((r.output as Json).scope.regionsRequested).toEqual(["ap-northeast-2"]);
    expect(calls(r, "aws ec2 describe-security-groups")).toHaveLength(1);
    expect(realCalls(r).find((c) => c.args[1] === "describe-security-groups")?.args).toContain("ap-northeast-2");
  });
  it("리전 목록이 거부되면 AWS_REGION 한 곳만 본다(범위 미증명으로 남는다)", () => {
    const sc = withScenario(base, { "ec2 describe-regions": awsFail("UnauthorizedOperation", "DescribeRegions") });
    const r = runCollector({ cloud: "aws", scenario: sc, args: ["--yes", "--doors", "net"], env: { AWS_REGION: "us-east-1" } });
    expect((r.output as Json).scope.regions.value).toBeNull();
    expect(calls(r, "aws ec2 describe-security-groups")).toHaveLength(1);
    expect((data(r).securityGroups as Json[]).map((x) => x.region)).toEqual(["us-east-1"]);
  });
  it("루트 자격증명이면 경고하고 진행, 상용 파티션이 아니면 호출 없이 중단", () => {
    const root = runCollector({ cloud: "aws", scenario: withScenario(base, { "sts get-caller-identity": out({ UserId: "111122223333", Account: "111122223333", Arn: "arn:aws:iam::111122223333:root" }) }), args: ["--yes", "--doors", "net"] });
    expect(root.stderr).toContain("루트 자격증명");
    expect((root.output as Json).identity).toMatchObject({ principalType: "root", principalName: null });
    const cn = runCollector({ cloud: "aws", scenario: withScenario(base, { "sts get-caller-identity": out({ UserId: "X", Account: "111122223333", Arn: "arn:aws-cn:sts::111122223333:assumed-role/R/s" }) }), args: ["--yes"] });
    expect(cn.status).toBe(4);
    expect(cn.outputName).toBeNull();
    expect(realCalls(cn).map(commandOf)).toEqual(["aws sts get-caller-identity"]);
  });
  it("신원 호출이 실패하면 아무것도 수집하지 않는다(종료 코드 4)", () => {
    const r = runCollector({ cloud: "aws", scenario: withScenario(base, { "sts get-caller-identity": awsFail("ExpiredToken", "GetCallerIdentity", "The security token included in the request is expired") }), args: ["--yes"] });
    expect(r.status).toBe(4);
    expect(realCalls(r)).toHaveLength(1);
    expect(r.stderr).toContain("ExpiredToken");
    expect(r.outputName).toBeNull();
  });
  it("--version · --help는 호출 없이 끝나고, 알 수 없는 인자·잘못된 값은 종료 코드 2", () => {
    const v = runCollector({ cloud: "aws", scenario: base, args: ["--version"] });
    expect([v.status, v.stdout.trim(), v.calls.length]).toEqual([0, "cloudcheck-aws 1.0.0", 0]);
    const h = runCollector({ cloud: "aws", scenario: base, args: ["--help"] });
    expect(h.status).toBe(0);
    expect(h.stdout).toContain("--doors");
    for (const bad of [["--nope"], ["--doors", "mfa,foo"], ["--doors"], ["--regions", "mars-1"], ["--regions", "ap-northeast-2,"]]) {
      const r = runCollector({ cloud: "aws", scenario: base, args: ["--yes", ...bad] });
      expect(r.status, bad.join(" ")).toBe(2);
      expect(r.calls.length, bad.join(" ")).toBe(0);
      expect(r.outputName).toBeNull();
    }
  });
  it("실행 환경에 실제 자격증명이 있어도(AWS_ACCESS_KEY_ID) 출력에 나오지 않는다", () => {
    const r = runCollector({ cloud: "aws", scenario: base, args: ["--yes", "--doors", "net"], env: { AWS_ACCESS_KEY_ID: "AKIAIOSFODNN7EXAMPLE", AWS_SECRET_ACCESS_KEY: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", AWS_SESSION_TOKEN: "FwoGZXIvYXdzEXAMPLE" } });
    expect(r.outputText).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(r.outputText).not.toContain("wJalr");
    expect(r.stderr + r.stdout).not.toContain("wJalr");
  });
  it("엔드포인트 고정: 실행 환경에 AWS_ENDPOINT_URL·AWS_ENDPOINT_URL_S3가 있어도 수집기는 AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true로 무력화한다(백엔드팀장 STEP 4)", () => {
    const r = runCollector({ cloud: "aws", scenario: base, args: ["--yes", "--doors", "net"], env: { AWS_ENDPOINT_URL: "http://203.0.113.9:4566", AWS_ENDPOINT_URL_S3: "http://203.0.113.9:4566", AWS_IGNORE_CONFIGURED_ENDPOINT_URLS: "false" } });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "aws")).toEqual([]);
    expect(r.unexpected).toEqual([]);
  });
  it("대조군: 고정 줄을 빼면 shim이 모든 aws 호출을 거부하고 시나리오 밖 호출로 잡힌다(2차 방어가 실제로 동작)", () => {
    const text = readFileSync(SCRIPT_PATH.aws, "utf8").replace(" AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true", "");
    const r = runCollector({ cloud: "aws", scenario: base, args: ["--yes", "--doors", "net"], scriptText: text });
    expect(r.unexpected).toContain("endpoint-guard-missing");
    expect(r.outputName).toBeNull();
  });
  it("호출 순서가 결정적이다: 같은 시나리오를 두 번 돌리면 결과 파일이 바이트 단위로 같다", () => {
    const c = awsCase("aws-13-doors-net");
    const a = runCollector({ cloud: "aws", scenario: c.scenario, args: c.args });
    expect(a.outputText).toBe(run("aws-13-doors-net").outputText);
  });
});

describe("수집기가 실제 호출 기록과 일치하는 발자국을 낸다", () => {
  it("정상 시나리오의 호출 수 = 영수증 수 = shim 로그 수, 문 단위 호출은 카탈로그 phases에 속한다", () => {
    const r = run("aws-01-normal");
    const phasesOf = (cli: string): readonly string[] => Object.values(AWS_CALLS).find((m) => m.cli === cli)?.phases ?? [];
    const perDoor = (door: string): string[] => [...new Set(realCalls(awsRun()).map(commandOf))].filter((c) => phasesOf(c).includes(door as never));
    function awsRun(): RunResult { return r; }
    expect(perDoor("net").sort()).toEqual(["aws ec2 describe-network-interfaces", "aws ec2 describe-security-groups"]);
    expect(perDoor("log").sort()).toEqual(["aws cloudtrail describe-trails", "aws cloudtrail get-event-selectors", "aws cloudtrail get-trail-status"]);
    expect(awsBase()).toBeTruthy();
  });
});

describe("⑰ 고급 이벤트 선택기 투영(STEP 5 CC-QA-07②)", () => {
  const KEY = `cloudtrail get-event-selectors#${AWS_TRAIL_ARN}@ap-northeast-2`;
  const advanced = (...selectors: unknown[][]): ReturnType<typeof out> => out({ TrailARN: AWS_TRAIL_ARN, AdvancedEventSelectors: selectors.map((FieldSelectors, i) => ({ Name: `sel-${i}`, FieldSelectors })) });
  const advancedOf = (r: RunResult): Json[] => ((((data(r).trails as Json).value as Json[])[0].selectors as Json).value as Json).advanced as Json[];
  it("Equals만 있는 필드는 값을 싣고, Equals 밖 연산자(NotEquals·StartsWith …)가 섞인 필드는 값을 비워(빈 목록) '읽을 수 없는 선택기'로 표시하며, eventCategory·readOnly 밖 필드는 버린다", () => {
    const sc = withScenario(awsCase("aws-01-normal").scenario, { [KEY]: advanced(
      [{ Field: "eventCategory", Equals: ["Management"] }, { Field: "readOnly", Equals: ["false"] }, { Field: "eventName", Equals: ["PutObject"] }],
      [{ Field: "eventCategory", Equals: ["Management"] }, { Field: "readOnly", NotEquals: ["true"] }],
      [{ Field: "eventCategory", Equals: ["Management"], NotEquals: ["Data"] }, { Field: "readOnly", StartsWith: ["f"] }, { Field: "readOnly", Equals: ["false"], NotEndsWith: ["x"] }],
    ) });
    const r = runCollector({ cloud: "aws", scenario: sc, args: ["--yes", "--doors", "log"] });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "aws")).toEqual([]);
    expect(advancedOf(r)).toEqual([
      { fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: ["false"] }] },
      { fields: [{ field: "eventCategory", equals: ["Management"] }, { field: "readOnly", equals: [] }] },
      { fields: [{ field: "eventCategory", equals: [] }, { field: "readOnly", equals: [] }, { field: "readOnly", equals: [] }] },
    ]);
  });
  it("빈 연산자 배열(NotEquals: [])은 연산자가 없는 것과 같다 — Equals 값을 그대로 싣는다", () => {
    const sc = withScenario(awsCase("aws-01-normal").scenario, { [KEY]: advanced([{ Field: "readOnly", Equals: ["true"], NotEquals: [] }]) });
    const r = runCollector({ cloud: "aws", scenario: sc, args: ["--yes", "--doors", "log"] });
    expect(advancedOf(r)).toEqual([{ fields: [{ field: "readOnly", equals: ["true"] }] }]);
  });
  it("기본 선택기(EventSelectors)는 그대로다", () => {
    const r = runCollector({ cloud: "aws", scenario: awsCase("aws-01-normal").scenario, args: ["--yes", "--doors", "log"] });
    const sel = ((((data(r).trails as Json).value as Json[])[0].selectors as Json).value) as Json;
    expect(sel.basic).toEqual([{ readWriteType: "All", includeManagementEvents: true }]);
    expect(sel.advanced).toEqual([]);
  });
});

describe("⑱ CloudTrail 전송 오류 투영(STEP 5 D-2: LatestDeliveryError)", () => {
  const KEY = `cloudtrail get-trail-status#${AWS_TRAIL_ARN}@ap-northeast-2`;
  const BASE = { IsLogging: true, LatestDeliveryTime: "2026-10-19T02:00:00+00:00" };
  const statusFor = (resp: Record<string, unknown>): { r: RunResult; value: Json } => {
    const sc = withScenario(awsCase("aws-01-normal").scenario, { [KEY]: out(resp) });
    const r = runCollector({ cloud: "aws", scenario: sc, args: ["--yes", "--doors", "log"] });
    expect(r.status, r.stderr).toBe(0);
    expect(commonProblems(r, "aws")).toEqual([]);
    return { r, value: (((data(r).trails as Json).value as Json[])[0].status as Json).value as Json };
  };
  it("오류가 없는 모양은 모두 '오류 없음': 키가 없다(정상 trail의 CLI 출력) · null · 빈 문자열", () => {
    expect(statusFor({ ...BASE }).value).toEqual({ isLogging: true, hasDeliveryError: false });
    expect(statusFor({ ...BASE, LatestDeliveryError: null }).value).toEqual({ isLogging: true, hasDeliveryError: false });
    expect(statusFor({ ...BASE, LatestDeliveryError: "" }).value).toEqual({ isLogging: true, hasDeliveryError: false });
  });
  it("오류 글자가 있으면 '오류 기록 있음'이고, 그 글자(버킷 이름 · 주소 …)는 출력에 실리지 않는다", () => {
    const msg = "Access Denied for bucket: example-trail-bucket-0001. Please check the permissions on the bucket.";
    const { r, value } = statusFor({ ...BASE, LatestDeliveryError: msg });
    expect(value).toEqual({ isLogging: true, hasDeliveryError: true });
    expect(r.outputText).not.toContain("example-trail-bucket-0001");
    expect(r.outputText).not.toContain("Access Denied for bucket");
  });
  it("기록 중지 여부와 전송 오류는 따로 읽는다", () => {
    expect(statusFor({ IsLogging: false, LatestDeliveryError: "" }).value).toEqual({ isLogging: false, hasDeliveryError: false });
    expect(statusFor({ IsLogging: false, LatestDeliveryError: "NoSuchBucket" }).value).toEqual({ isLogging: false, hasDeliveryError: true });
    expect(statusFor({ LatestDeliveryError: "NoSuchBucket" }).value).toEqual({ isLogging: false, hasDeliveryError: true });          // IsLogging 키가 없으면 기록 중지로 본다(예전 동작 그대로)
  });
});
