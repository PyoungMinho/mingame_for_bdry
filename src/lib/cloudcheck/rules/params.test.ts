// 판정에 쓰는 기준값 — 값이 바뀌면 룰셋이 바뀐 것이다(RULESET_VERSION을 올리고 이 표를 함께 고친다).
// 아래 표는 방향서 §6과 공식 문서(Security Hub IAM.3 · IAM.22 · EC2.18 · EC2.19, CIS v5.0.0 1.11, 자격증명 보고서 4시간 캐시)를 보고 손으로 적은 값이다.
import { describe, expect, it } from "vitest";
import * as P from "./params";
import { RULESET_VERSION } from "./version";

describe("기준값 표", () => {
  it("일수 · 시간 기준", () => {
    expect(P.KEY_MAX_AGE_DAYS).toBe(90);              // IAM.3 (공개 기준)
    expect(P.CREDENTIAL_UNUSED_DAYS).toBe(45);        // IAM.22 · CIS 1.11 (공개 기준)
    expect(P.CREDENTIAL_GRACE_DAYS).toBe(7);          // 도구 기준
    expect(P.ROOT_RECENT_LOGIN_DAYS).toBe(90);        // 도구 기준
    expect(P.AZURE_KEY_ROTATION_DAYS).toBe(90);       // 도구 기준
    expect(P.REPORT_FRESHNESS_MS).toBe((4 * 60 + 5) * 60_000);   // 보고서 4시간 캐시 + 5분
    expect([P.SNAPSHOT_STALE_HOURS, P.SNAPSHOT_VERY_STALE_DAYS, P.GUIDANCE_STALE_DAYS, P.FUTURE_SKEW_MINUTES]).toEqual([24, 7, 180, 5]);
  });
  it("포트 기준: 위험 33개 = EC2.19 24개 − 메일 3개 + 도구 12개", () => {
    expect(P.RISKY_PORTS_EC2_19).toHaveLength(21);
    expect(P.RISKY_PORTS_TOOL).toHaveLength(12);
    expect(P.RISKY_PORTS).toHaveLength(33);
    expect([...P.RISKY_PORTS]).toEqual([...P.RISKY_PORTS].sort((a, b) => a - b));
    expect(P.MAIL_PORTS).toEqual([25, 110, 143]);
    expect(P.WEB_PORTS).toEqual([80, 443]);
    for (const p of [22, 3389, 3306, 5432, 1433, 445, 23, 21]) expect(P.RISKY_PORTS).toContain(p);
  });
  it("넓은 공인 대역 기준(D-1b): IPv4 /8 · IPv6 /16, 사설·예약 대역 9개", () => {
    expect([P.BROAD_IPV4_PREFIX, P.BROAD_IPV6_PREFIX]).toEqual([8, 16]);
    expect([...P.RESERVED_IPV4_RANGES]).toEqual([
      "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4",
    ]);
  });
  it("관리자급 관리형 정책 4종", () => {
    expect([...P.ADMIN_POLICY_NAMES]).toEqual(["AdministratorAccess", "PowerUserAccess", "IAMFullAccess", "AWSOrganizationsFullAccess"]);
  });
  it("버킷 힌트(라벨만, 판정을 바꾸지 않는다)", () => {
    expect([...P.NAME_HINTS]).toEqual(["public", "static", "assets", "cdn"]);
    expect(P.LEGACY_BUCKET_BEFORE).toBe("2023-04-01");
  });
  it("지문 표가 상수와 같다 (다르면 룰셋 버전을 올리라는 신호)", () => {
    expect(P.PARAMS_FINGERPRINT).toEqual({
      keyMaxAgeDays: 90, credentialUnusedDays: 45, credentialGraceDays: 7, rootRecentLoginDays: 90, azureKeyRotationDays: 90,
      reportFreshnessMinutes: 245, snapshotStaleHours: 24, snapshotVeryStaleDays: 7, guidanceStaleDays: 180, futureSkewMinutes: 5,
      riskyPortCount: 33, mailPorts: [25, 110, 143], webPorts: [80, 443],
      broadIpv4Prefix: 8, broadIpv6Prefix: 16,
      reservedIpv4Ranges: ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4"],
      adminPolicies: ["AdministratorAccess", "PowerUserAccess", "IAMFullAccess", "AWSOrganizationsFullAccess"],
    });
  });
  it("룰셋 버전은 semver", () => {
    expect(RULESET_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
