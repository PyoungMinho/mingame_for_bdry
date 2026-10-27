// src/lib/cloudcheck/collector/footprint.test.ts — 예상 발자국 표 ↔ 수집기 실제 호출(shim 실행 기록) 대조
// 표(카탈로그에서 생성)와 스크립트가 어긋나면 실패한다: 문별 호출 집합, 호출 횟수 추정, 예산 상수.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import { DOORS } from "../model/report";
import type { DoorId } from "../model/report";
import { BUDGET, callsForDoors, estimateCalls, footprintRows, renderFootprintMarkdown } from "./footprint";
import { SCRIPT_PATH, runCollector } from "./testkit";
import { awsCase, azureCase } from "./__scenarios__";

vi.setConfig({ testTimeout: 120_000 });
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const calledIds = (output: unknown): string[] => [...new Set(((output as Json).receipts as { call: string }[]).map((r) => r.call))].sort();

describe("발자국 표 생성", () => {
  it("카탈로그와 1:1: AWS 26행 · Azure 9행, 쓰기 호출은 생성 요청 1건", () => {
    expect(footprintRows("aws")).toHaveLength(26);
    expect(footprintRows("azure")).toHaveLength(9);
    expect(footprintRows("aws").map((r) => r.id)).toEqual(Object.keys(AWS_CALLS));
    expect(footprintRows("azure").map((r) => r.id)).toEqual(Object.keys(AZURE_CALLS));
    expect([...footprintRows("aws"), ...footprintRows("azure")].filter((r) => !r.readOnly).map((r) => r.id)).toEqual(["iam:GenerateCredentialReport"]);
  });
  it("CloudTrail 이벤트: AWS는 소스·이름이 있고(ListAllMyBuckets → ListBuckets 예외), Azure는 null", () => {
    const aws = Object.fromEntries(footprintRows("aws").map((r) => [r.id, `${r.eventSource}/${r.eventName}`]));
    expect(aws["iam:ListUsers"]).toBe("iam.amazonaws.com/ListUsers");
    expect(aws["s3:ListAllMyBuckets"]).toBe("s3.amazonaws.com/ListBuckets");
    expect(aws["sts:GetCallerIdentity"]).toBe("sts.amazonaws.com/GetCallerIdentity");
    expect(aws["cloudtrail:GetEventSelectors"]).toBe("cloudtrail.amazonaws.com/GetEventSelectors");
    expect(footprintRows("azure").every((r) => r.eventSource === null && r.eventName === null)).toBe(true);
  });
  it("마크다운 표: 모든 명령과 권한이 들어 있고 생성 요청 행이 표시된다", () => {
    for (const cloud of ["aws", "azure"] as const) {
      const md = renderFootprintMarkdown(cloud);
      for (const r of footprintRows(cloud)) { expect(md).toContain(`\`${r.cli}\``); if (r.permission) expect(md).toContain(`\`${r.permission}\``); }
      expect(md.split("\n")).toHaveLength(2 + footprintRows(cloud).length);
    }
    expect(renderFootprintMarkdown("aws")).toContain("생성 요청(유일한 비조회 호출)");
    expect(renderFootprintMarkdown("aws")).toContain("(권한 필요 없음)");
  });
  it("예산 상수는 수집기 스크립트의 LIM_* 값과 같다", () => {
    const val = (cloud: "aws" | "azure", name: string): number => Number(new RegExp(`\\b${name}=(\\d+)`).exec(readFileSync(SCRIPT_PATH[cloud], "utf8"))?.[1]);
    expect(val("aws", "LIM_USERS")).toBe(BUDGET.awsUsers);
    expect(val("aws", "LIM_BUCKETS")).toBe(BUDGET.awsBuckets);
    expect(val("azure", "LIM_SUBS")).toBe(BUDGET.azureSubscriptions);
    expect(val("azure", "LIM_ACCTS")).toBe(BUDGET.azureStorageAccounts);
  });
});

describe("문별 호출 집합: 표 = 실제 호출", () => {
  const aws = awsCase("aws-01-normal");
  for (const door of ["mfa", "key", "net", "sto", "log"] as const) {
    it(`AWS --doors ${door}: 신원·범위 + ${door} 단계 호출만`, () => {
      const r = runCollector({ cloud: "aws", scenario: aws.scenario, args: ["--yes", "--doors", door] });
      expect(r.status, r.stderr).toBe(0);
      expect(r.unexpected).toEqual([]);
      expect(calledIds(r.output)).toEqual([...callsForDoors("aws", [door])].sort());
    });
  }
  const az = azureCase("az-01-normal");
  for (const door of ["key", "net", "sto", "log"] as const) {
    it(`Azure --doors ${door}: 신원·범위 + ${door} 단계 호출만`, () => {
      const r = runCollector({ cloud: "azure", scenario: az.scenario, args: ["--yes", "--doors", door] });
      expect(r.status, r.stderr).toBe(0);
      expect(r.unexpected).toEqual([]);
      expect(calledIds(r.output)).toEqual([...callsForDoors("azure", [door])].sort());
    });
  }
  it("callsForDoors는 문 여러 개의 합집합이고, 아무 문도 없으면 신원·범위만", () => {
    expect(callsForDoors("aws", [])).toEqual(["sts:GetCallerIdentity", "iam:ListAccountAliases", "ec2:DescribeRegions"]);
    expect(callsForDoors("azure", [])).toEqual(["azure:account.show", "azure:account.list"]);
    const all = callsForDoors("aws", [...DOORS] as DoorId[]);
    expect(new Set(all).size).toBe(26);
  });
});

describe("호출 횟수 추정 = 실제 영수증 수", () => {
  it("AWS 정상 시나리오(사용자 2 · 그룹 1 · 리전 2 · 버킷 2(리전 없는 1) · trail 1 · 폴링 3회)", () => {
    const c = awsCase("aws-01-normal");
    const r = runCollector({ cloud: "aws", scenario: c.scenario, args: c.args });
    const est = estimateCalls("aws", { users: 2, groups: 1, regions: 2, buckets: 2, bucketsWithoutRegion: 1, trails: 1, reportPolls: 3 });
    const byCall: Record<string, number> = {};
    for (const x of (r.output as Json).receipts as { call: string }[]) byCall[x.call] = (byCall[x.call] ?? 0) + 1;
    expect(est.byCall).toEqual(byCall);
    expect(est.total).toBe(((r.output as Json).receipts as unknown[]).length);
  });
  it("AWS 예산: 사용자 200명이어도 상세 조회는 150명까지만 센다", () => {
    expect(estimateCalls("aws", { doors: ["mfa"], users: 200 }).byCall["iam:ListMFADevices"]).toBe(150);
    expect(estimateCalls("aws", { doors: ["sto"], buckets: 1000 }).byCall["s3:GetBucketAcl"]).toBe(300);
  });
  it("Azure 정상 시나리오(구독 1 · 스토리지 계정 2)", () => {
    const c = azureCase("az-01-normal");
    const r = runCollector({ cloud: "azure", scenario: c.scenario, args: c.args });
    const est = estimateCalls("azure", { subscriptions: 1, storageAccountsPerSubscription: 2 });
    const byCall: Record<string, number> = {};
    for (const x of (r.output as Json).receipts as { call: string }[]) byCall[x.call] = (byCall[x.call] ?? 0) + 1;
    expect(est.byCall).toEqual(byCall);
    expect(est.total).toBe(11);
  });
  it("Azure 예산: 구독 20 · 구독당 계정 100", () => {
    const e = estimateCalls("azure", { doors: ["sto"], subscriptions: 50, storageAccountsPerSubscription: 500 });
    expect(e.byCall["azure:storage.account.list"]).toBe(20);
    expect(e.byCall["azure:storage.container-rm.list"]).toBe(2000);
  });
});
