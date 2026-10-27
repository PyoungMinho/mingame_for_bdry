// STEP 5 QA 2라운드(DB설계자) — CC-QA-04 · 14(출발지 해석: 합집합 · 넓은 공인 대역 · 프리픽스 리스트 · 서비스 태그), CC-QA-08(로그 전달 오류), 디자인 §8 문구.
// 기대값은 결정 문서(docs/planning/cloudcheck-qa-decisions.md §2 · §3)와 디자인 문구 검수(docs/design/cloudcheck-rule-copy-review.md §8)에서 먼저 썼다. 엔진 출력에서 복사하지 않는다.
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import { MICRO, resolveFixture } from "../fixtures/micro";
import { renderMsg } from "../fixtures/render";
import type { ItemResult, MsgRef, Report, RuleId, RuleResult } from "../model/report";
import { findBanned } from "../model/banned-words";
import { ENGINE_KO } from "./i18n/ko";
import { RULES } from "./registry";

const KO: Readonly<Record<string, string>> = ENGINE_KO;
const specOf = (id: RuleId) => (RULES.find((m) => m.spec.ruleId === id) as (typeof RULES)[number]).spec;
const reportOf = (ref: string): Report => judge(resolveFixture(ref));
const ruleOf = (ref: string): RuleResult => {
  const id = ref.split("/")[1];
  const r = reportOf(ref).doors.flatMap((d) => d.rules).find((x) => x.ruleId === id);
  if (r === undefined) throw new Error(`${ref}: 리포트에 ${id}가 없다`);
  return r;
};
const only = (r: RuleResult): ItemResult => {
  expect(r.items).toHaveLength(1);
  return r.items[0];
};
const facts = (i: ItemResult): string[] => i.facts.map((f) => renderMsg(f));
const nOf = (m: MsgRef): number | undefined => {
  const p = m.params?.n;
  return p !== undefined && "n" in p ? p.n : undefined;
};

describe("AWS-NET-1: 합쳐서 전체인 출발지는 인터넷 전체와 같은 경로·문구다 (D-1a)", () => {
  it("0.0.0.0/1 + 128.0.0.0/1 + 공인 IP ENI → 위험, 사유 · 룰 사유는 '인터넷 전체' 문구 그대로", () => {
    const r = ruleOf("micro/AWS-NET-1/split-world");
    expect(r.status).toBe("risk");
    expect(r.why.code).toBe("AWS-NET-1:exposed-with-public-ip");
    expect(renderMsg(r.why)).toBe("공인 IP가 붙은 곳에 22 포트가 인터넷 전체로 열려 있음: 보안 그룹 1개");
    const i = only(r);
    expect(renderMsg(i.why)).toBe("공인 IP가 붙은 곳에 22 포트가 인터넷 전체로 열려 있음");
    // 사실 줄에는 실제 출발지 가운데 접두 /8 이하 조각을 보인다(§2-3 ⑫)
    expect(facts(i)).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 0.0.0.0/1", "22 포트 · 출발지 128.0.0.0/1", "공인 IP 연결됨"]);
  });
  it("조각이 셋이어도 최대 3개까지 그대로, 공백이 붙어도 같다", () => {
    expect(facts(only(ruleOf("micro/AWS-NET-1/split-world-three")))).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 0.0.0.0/2", "22 포트 · 출발지 64.0.0.0/2", "22 포트 · 출발지 128.0.0.0/1", "공인 IP 연결됨"]);
    expect(ruleOf("micro/AWS-NET-1/split-world-spaces").status).toBe("risk");
  });
  it("전체 × 메일 포트도 같은 경로: 주의 sg-mail / 연결이 없으면 sg-unattached", () => {
    expect(only(ruleOf("micro/AWS-NET-1/split-world-mail")).why.code).toBe("AWS-NET-1:sg-mail");
    expect(only(ruleOf("micro/AWS-NET-1/split-world-unattached")).why.code).toBe("AWS-NET-1:sg-unattached");
  });
  it("빈틈이 있는 합집합(마지막 1/4가 빠짐)은 전체가 아니라 넓은 공인 대역이다", () => {
    expect(only(ruleOf("micro/AWS-NET-1/split-incomplete")).why.code).toBe("AWS-NET-1:sg-source-broad");
  });
});

describe("AWS-NET-1: 넓은 공인 대역 · 프리픽스 리스트 × 위험 포트 → 주의 (D-1b · D-4)", () => {
  it("넓은 공인 대역: 사유 · 룰 사유 · 사실 줄 문구, 연결 정보 없이 보안 그룹 증거만", () => {
    const r = ruleOf("micro/AWS-NET-1/broad-v4");
    expect(r.status).toBe("caution");
    expect(r.why.code).toBe("AWS-NET-1:open-unclear-source");
    expect(nOf(r.why)).toBe(1);
    expect(renderMsg(r.why)).toBe("넓은 공인 IP 대역이나 프리픽스 리스트에 위험 포트를 연 보안 그룹 1개");
    const i = only(r);
    expect(renderMsg(i.why)).toBe("22 포트가 넓은 공인 IP 대역에 열려 있음(인터넷 전체는 아님)");
    expect(facts(i)).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 12.0.0.0/8"]);
    expect(i.status === "caution" && i.evidence.map((e) => e.receipt?.call)).toEqual(["ec2:DescribeSecurityGroups"]);
  });
  it("전체 포트(-1)에 열어도 같다: 포트는 0-65535로 적는다", () => {
    const i = only(ruleOf("micro/AWS-NET-1/broad-v4-all-traffic"));
    expect(renderMsg(i.why)).toBe("0-65535 포트가 넓은 공인 IP 대역에 열려 있음(인터넷 전체는 아님)");
  });
  it("IPv6 넓은 공인 대역(2000::/3)", () => {
    expect(facts(only(ruleOf("micro/AWS-NET-1/broad-v6")))).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 2000::/3"]);
  });
  it("프리픽스 리스트: 사유와 사실 줄(ID는 사용자 데이터), 위험이 아니라 주의", () => {
    const r = ruleOf("micro/AWS-NET-1/prefix-list");
    expect(r.status).toBe("caution");
    const i = only(r);
    expect(i.status).toBe("caution");
    expect(renderMsg(i.why)).toBe("22 포트가 프리픽스 리스트 출발지에 열려 있음(목록 안의 주소는 이 도구가 읽지 않음)");
    expect(facts(i)).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 프리픽스 리스트: ⟨값⟩"]);
    const f = i.facts.find((x) => x.code === "fact:port-prefix-list");
    expect(f?.params?.port).toEqual({ c: "22" });
    expect(f?.params?.list).toMatchObject({ v: { kind: "sensitive", full: "pl-0abc0001", masked: "prefix-list-001" } });
  });
  it("메일 · 그 밖의 포트 · 80·443은 넓은 대역과 프리픽스 리스트에서 판정에서 뺀다(이상 없음)", () => {
    for (const name of ["broad-v4-mail", "broad-v4-other-port", "broad-v4-web", "prefix-list-web", "prefix-list-mail", "prefix-list-icmp"]) {
      const r = ruleOf(`micro/AWS-NET-1/${name}`);
      expect(r.status, name).toBe("clear");
    }
  });
  it("사설·예약 대역 · 좁은 공인 대역 · 호스트 비트가 켜진 사설 대역 · 보안 그룹 참조는 넓어도·좁아도 판정에서 뺀다", () => {
    for (const name of ["private-wide", "narrow-public", "host-bits-private", "sg-ref-only"]) expect(ruleOf(`micro/AWS-NET-1/${name}`).status, name).toBe("clear");
  });
  it("출발지가 하나도 없는 규칙은 포트와 무관하게 해석 불가", () => {
    for (const name of ["no-source", "no-source-web"]) {
      const r = ruleOf(`micro/AWS-NET-1/${name}`);
      expect(r.status, name).toBe("unknown");
      expect(only(r).why.code).toBe("value-unrecognized");
    }
  });
  it("대상 사유는 가장 앞선 발견이다: 전체 × 위험 > 넓은 대역 > 프리픽스 리스트 > 전체 × 메일", () => {
    expect(only(ruleOf("micro/AWS-NET-1/world-and-prefix-list")).why.code).toBe("AWS-NET-1:sg-public");
    expect(only(ruleOf("micro/AWS-NET-1/broad-and-prefix-list")).why.code).toBe("AWS-NET-1:sg-source-broad");
    const m = only(ruleOf("micro/AWS-NET-1/mail-and-prefix-list"));
    expect(m.why.code).toBe("AWS-NET-1:sg-source-prefix-list");
    // 두 발견의 사실 줄이 모두 보인다: 앞선 발견(프리픽스 리스트)이 먼저
    expect(facts(m)).toEqual(["보안 그룹 이름: ⟨값⟩", "22 포트 · 출발지 프리픽스 리스트: ⟨값⟩", "25 포트 · 출발지 0.0.0.0/0"]);
  });
  it("룰 수준 사유: 주의 범주가 '출발지 확인' 하나뿐이면 open-unclear-source, 다른 범주가 섞이면 주의 전체 개수를 open-review로", () => {
    const only1 = ruleOf("micro/AWS-NET-1/source-only-caution");
    expect(only1.why.code).toBe("AWS-NET-1:open-unclear-source");
    expect(nOf(only1.why)).toBe(2);
    expect(renderMsg(only1.why)).toBe("넓은 공인 IP 대역이나 프리픽스 리스트에 위험 포트를 연 보안 그룹 2개");
    const mixed = ruleOf("micro/AWS-NET-1/source-and-unattached");
    expect(mixed.why.code).toBe("AWS-NET-1:open-review");
    expect(nOf(mixed.why)).toBe(2);
    expect(renderMsg(mixed.why)).toBe("열린 인바운드 규칙을 확인해야 하는 보안 그룹 2개");
  });
  it("루트 시험: 기존 micro 결과는 그대로다(모든 룰 수준 {n}은 같은 상태 대상 수)", () => {
    for (const name of Object.keys(MICRO["AWS-NET-1"])) {
      const r = ruleOf(`micro/AWS-NET-1/${name}`);
      if (r.status === "caution") expect(nOf(r.why), name).toBe(r.items.filter((i) => i.status === "caution").length);
    }
  });
});

describe("AZ-NET-1: 출발지 해석 (D-1 · D-3)", () => {
  it("서비스 태그 × 위험 포트 → 주의, 태그 이름을 보인다", () => {
    const r = ruleOf("micro/AZ-NET-1/service-tag");
    expect(r.status).toBe("caution");
    expect(r.why.code).toBe("AZ-NET-1:open-unclear-source");
    expect(renderMsg(r.why)).toBe("넓은 공인 IP 대역이나 서비스 태그에 위험 포트를 연 NSG 1개");
    const i = only(r);
    expect(renderMsg(i.why)).toBe("22 포트가 서비스 태그 AzureCloud에 열려 있음(태그에 든 실제 주소 범위는 이 도구가 읽지 않음)");
    expect(facts(i)).toEqual(["NSG 이름: ⟨값⟩", "22 포트 · 출발지 AzureCloud"]);
    expect(renderMsg(only(ruleOf("micro/AZ-NET-1/service-tag-regional")).why)).toBe("3389 포트가 서비스 태그 Storage.KoreaCentral에 열려 있음(태그에 든 실제 주소 범위는 이 도구가 읽지 않음)");
  });
  it("메일 · 80·443 · 위험 포트가 아닌 구간(GatewayManager 65200-65535)은 태그에서 판정에서 뺀다", () => {
    for (const name of ["service-tag-mail", "service-tag-web", "gateway-manager", "broad-source-mail"]) expect(ruleOf(`micro/AZ-NET-1/${name}`).status, name).toBe("clear");
  });
  it("내부 출발지(VirtualNetwork · AzureLoadBalancer · ASG)와 좁은 출발지는 판정에서 뺀다", () => {
    for (const name of ["virtual-network-source", "load-balancer-source", "asg-source", "private-wide-source", "bare-ip-source"]) expect(ruleOf(`micro/AZ-NET-1/${name}`).status, name).toBe("clear");
  });
  it("출발지가 하나도 없는 Allow 규칙 · 모르는 모양의 출발지는 해석 불가", () => {
    for (const name of ["no-source", "garbage-source", "csv-no-source"]) {
      const r = ruleOf(`micro/AZ-NET-1/${name}`);
      expect(r.status, name).toBe("unknown");
    }
  });
  it("알아본 전체(*)가 함께 있으면 모르는 값이 섞여도 위험은 유지한다(양성 유지)", () => {
    expect(ruleOf("micro/AZ-NET-1/world-with-garbage").status).toBe("risk");
  });
  it("넓은 공인 대역 → 주의 nsg-source-broad", () => {
    expect(renderMsg(only(ruleOf("micro/AZ-NET-1/broad-source")).why)).toBe("22 포트가 넓은 공인 IP 대역에 열려 있음(인터넷 전체는 아님)");
  });
  it("합쳐서 전체인 출발지는 위험(공인 IP NIC), 사실 줄에는 /8 이하 조각", () => {
    const r = ruleOf("micro/AZ-NET-1/split-world");
    expect(r.status).toBe("risk");
    expect(facts(only(r))).toEqual(["NSG 이름: ⟨값⟩", "22 포트 · 출발지 0.0.0.0/1", "22 포트 · 출발지 128.0.0.0/1", "공인 IP 연결됨"]);
  });
  it("Deny: 출발지 전체(합집합 포함)만 포트를 뺀다 — 넓은 대역 · 태그 Deny는 위험을 지우지 못하고, 전체 Deny는 태그 Allow도 막는다", () => {
    expect(ruleOf("micro/AZ-NET-1/split-deny").status).toBe("clear");
    expect(ruleOf("micro/AZ-NET-1/tag-blocked-by-world-deny").status).toBe("clear");
    expect(ruleOf("micro/AZ-NET-1/broad-deny").status).toBe("risk");
    expect(ruleOf("micro/AZ-NET-1/tag-deny").status).toBe("risk");
  });
  it("전체와 태그가 함께 있으면 전체 × 위험이 사유, 사실 줄은 전체가 먼저", () => {
    const r = ruleOf("micro/AZ-NET-1/tag-and-world");
    expect(r.status).toBe("risk");
    expect(facts(only(r))).toEqual(["NSG 이름: ⟨값⟩", "22 포트 · 출발지 *", "3389 포트 · 출발지 AzureCloud", "공인 IP 연결됨"]);
  });
  it("Internet · Any는 대소문자와 앞뒤 공백을 가리지 않는다", () => {
    expect(ruleOf("micro/AZ-NET-1/internet-case-trim").status).toBe("risk");
  });
  it("룰 수준 사유: 출발지 확인 범주 하나뿐이면 open-unclear-source, 연결 없음이 섞이면 open-review", () => {
    const a = ruleOf("micro/AZ-NET-1/source-only-caution");
    expect(a.why.code).toBe("AZ-NET-1:open-unclear-source");
    expect(nOf(a.why)).toBe(2);
    expect(renderMsg(a.why)).toBe("넓은 공인 IP 대역이나 서비스 태그에 위험 포트를 연 NSG 2개");
    const b = ruleOf("micro/AZ-NET-1/source-and-unattached");
    expect(b.why.code).toBe("AZ-NET-1:open-review");
    expect(nOf(b.why)).toBe(2);
    expect(renderMsg(b.why)).toBe("열린 인바운드 규칙을 확인해야 하는 NSG 2개");
  });
  it("보고서 CSV 경로에서도 찾은 태그 주의는 남는다(없음은 만들지 않는다)", () => {
    expect(only(ruleOf("micro/AZ-NET-1/csv-service-tag")).why.code).toBe("AZ-NET-1:nsg-source-service-tag");
  });
});

describe("AWS-LOG-1: 로그 전달 오류 기록이 있는 trail은 갖춘 trail이 아니다 (D-2)", () => {
  it("기록 중이어도 오류 기록이 있으면 주의, 사유와 사실 줄 문구(지금 실패 중이라고 단정하지 않는다)", () => {
    const r = ruleOf("micro/AWS-LOG-1/delivery-error");
    expect(r.status).toBe("caution");
    expect(r.why.code).toBe("AWS-LOG-1:trail-delivery-error");
    expect(renderMsg(r.why)).toBe("trail이 있지만 로그 파일을 S3 버킷에 전달하지 못한 오류 기록이 있음");
    expect(facts(only(r))).toContain("로그 전달 오류 기록 있음");
    expect(renderMsg(r.why)).not.toMatch(/지금|실패 중|현재/);
  });
  it("빈틈 순서: 기록 중지 > 전달 오류 > 다중 리전 아님", () => {
    expect(ruleOf("micro/AWS-LOG-1/delivery-error-and-stopped").why.code).toBe("AWS-LOG-1:trail-not-logging");
    expect(ruleOf("micro/AWS-LOG-1/delivery-error-and-single-region").why.code).toBe("AWS-LOG-1:trail-delivery-error");
  });
  it("오류 없이 조건을 다 갖춘 다른 trail이 있으면 이상 없음 그대로", () => {
    const r = ruleOf("micro/AWS-LOG-1/delivery-error-plus-good");
    expect(r.status).toBe("clear");
    expect(renderMsg(r.why)).toBe("다중 리전 · 기록 중 · 관리 이벤트 쓰기 · 로그 파일 검증을 갖추고 전달 오류 기록이 없는 trail이 있음");
  });
});

describe("룰 데이터: 새 사유 · 사실 · 기준값 · 못 보는 것 · 읽기 명령 (디자인 §8-9)", () => {
  it("AWS-NET-1: 사유 3개 · 사실 1개 · 기준값 2개 · 못 보는 것 6개 · 확인일 2026-10-20", () => {
    const s = specOf("AWS-NET-1");
    expect(s.reasons["sg-source-broad"]).toEqual(["ports"]);
    expect(s.reasons["sg-source-prefix-list"]).toEqual(["ports"]);
    expect(s.reasons["open-unclear-source"]).toEqual(["n"]);
    expect(s.facts["port-prefix-list"]).toEqual(["port", "list"]);
    expect(s.cannotSee).toHaveLength(6);
    expect(s.params.map((p) => [p.key, p.value, p.basis])).toEqual([
      ["cc.rule.aws-net-1.param.risky-ports", s.params[0].value, "tool-default"],
      ["cc.rule.aws-net-1.param.mail-ports", [25, 110, 143], "tool-default"],
      ["cc.rule.aws-net-1.param.web-ports", [80, 443], "public-standard"],
      ["cc.rule.aws-net-1.param.broad-prefix", [8, 16], "tool-default"],
      ["cc.rule.aws-net-1.param.reserved-ranges", ["0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4", "240.0.0.0/4"], "public-standard"],
    ]);
    expect(s.lastVerified).toBe("2026-10-20");
  });
  it("AWS-NET-1: 먼저 확인 읽기 명령 둘 — 두 번째가 프리픽스 리스트 항목 조회(수집기 호출이 아니라 사용자가 직접 실행하는 명령)", () => {
    const s = specOf("AWS-NET-1");
    const cmds = s.fix?.observe.commands ?? [];
    expect(cmds).toHaveLength(2);
    expect(cmds.every((c) => c.kind === "read")).toBe(true);
    expect(cmds[1].segments).toEqual([
      { t: "text", v: "aws ec2 get-managed-prefix-list-entries --prefix-list-id " },
      { t: "ph", key: "cc.ph.prefix-list-id" },
    ]);
    expect(KO["cc.ph.prefix-list-id"]).toBe("프리픽스리스트ID");
    expect(s.calls).not.toContain("ec2:GetManagedPrefixListEntries");
  });
  it("AZ-NET-1: 사유 3개 · 기준값 2개 · 못 보는 것 7개 · 확인일 2026-10-20", () => {
    const s = specOf("AZ-NET-1");
    expect(s.reasons["nsg-source-broad"]).toEqual(["ports"]);
    expect(s.reasons["nsg-source-service-tag"]).toEqual(["ports", "tag"]);
    expect(s.reasons["open-unclear-source"]).toEqual(["n"]);
    expect(s.cannotSee).toHaveLength(7);
    expect(s.params.slice(-2).map((p) => [p.key, p.basis])).toEqual([["cc.rule.az-net-1.param.broad-prefix", "tool-default"], ["cc.rule.az-net-1.param.reserved-ranges", "public-standard"]]);
    expect(s.lastVerified).toBe("2026-10-20");
  });
  it("AWS-LOG-1: 새 사유 trail-delivery-error와 확인일", () => {
    const s = specOf("AWS-LOG-1");
    expect(s.reasons["trail-delivery-error"]).toEqual([]);
    expect(s.lastVerified).toBe("2026-10-20");
  });
  it("AWS-MFA-1 제목은 '루트 사용자 자격증명'(기획팀장 X4)이고 AWS-KEY-1 요약의 교차 참조도 같다", () => {
    expect(KO[specOf("AWS-MFA-1").titleKey]).toBe("루트 사용자 자격증명");
    expect(KO["cc.rule.aws-key-1.summary"]).toContain("'루트 사용자 자격증명' 점검");
    expect(JSON.stringify(KO)).not.toContain("루트 계정 설정");
  });
});

describe("디자인 §8 문구 반영: 새 E 키 19개 · 바꾼 기존 키 24개 · 의견 5개", () => {
  const NEW: Readonly<Record<string, string>> = {
    "cc.reason.aws-net-1.sg-source-broad": "{ports} 포트가 넓은 공인 IP 대역에 열려 있음(인터넷 전체는 아님)",
    "cc.reason.aws-net-1.sg-source-prefix-list": "{ports} 포트가 프리픽스 리스트 출발지에 열려 있음(목록 안의 주소는 이 도구가 읽지 않음)",
    "cc.reason.aws-net-1.open-unclear-source": "넓은 공인 IP 대역이나 프리픽스 리스트에 위험 포트를 연 보안 그룹 {n}개",
    "cc.fact.port-prefix-list": "{port} 포트 · 출발지 프리픽스 리스트: {list}",
    "cc.rule.aws-net-1.cannot.6": "여러 규칙에 나눠 적은 출발지의 합(규칙마다 따로 봄)",
    "cc.reason.az-net-1.nsg-source-broad": "{ports} 포트가 넓은 공인 IP 대역에 열려 있음(인터넷 전체는 아님)",
    "cc.reason.az-net-1.nsg-source-service-tag": "{ports} 포트가 서비스 태그 {tag}에 열려 있음(태그에 든 실제 주소 범위는 이 도구가 읽지 않음)",
    "cc.reason.az-net-1.open-unclear-source": "넓은 공인 IP 대역이나 서비스 태그에 위험 포트를 연 NSG {n}개",
    "cc.rule.az-net-1.cannot.6": "서비스 태그에 든 실제 주소 범위(위험 포트에 쓰이면 주의로 표시)",
    "cc.rule.az-net-1.cannot.7": "사용자 정의 경로로 VirtualNetwork 태그에 더해지는 주소 범위(기본 경로가 들어갈 수도 있음)",
    "cc.reason.aws-log-1.trail-delivery-error": "trail이 있지만 로그 파일을 S3 버킷에 전달하지 못한 오류 기록이 있음",
    "cc.fact.manual-rest": "보지 못한 나머지 대상",
    "cc.banner.as-of-before-evidence.title": "기준 시각보다 늦은 기록이 파일 안에 있습니다",
  };
  it.each(Object.entries(NEW))("%s", (k, v) => expect(KO[k]).toBe(v));

  it("기준값 설명 4개(AWS · Azure 같은 문장)", () => {
    const broad = "넓은 공인 IP 대역 기준: IPv4 접두 /8 이하(사설·예약 대역 안에 다 들어가는 값 제외), IPv6 접두 /16 이하(공인 대역 2000::/3과 겹치는 값)";
    const reserved = "넓어도 판정에서 빼는 사설·예약 대역(RFC 1918·6598 등)";
    for (const id of ["aws-net-1", "az-net-1"]) {
      expect(KO[`cc.rule.${id}.param.broad-prefix`]).toBe(broad);
      expect(KO[`cc.rule.${id}.param.reserved-ranges`]).toBe(reserved);
    }
  });
  const CHANGED: Readonly<Record<string, string>> = {
    "cc.rule.aws-net-1.summary": "보안 그룹이 관리용·DB용 포트를 인터넷 전체(0.0.0.0/0, ::/0)나 넓은 공인 IP 대역·프리픽스 리스트에 열어 두었는지, 그 보안 그룹이 공인 IP가 붙은 곳에 연결돼 있는지 봅니다.",
    "cc.rule.aws-net-1.cannot.4": "프리픽스 리스트 안의 주소(위험 포트에 쓰이면 주의로 표시)",
    "cc.reason.aws-net-1.open-review": "열린 인바운드 규칙을 확인해야 하는 보안 그룹 {n}개",
    "cc.rule.aws-net-1.impact": "공인 IP가 있는 곳에 이 규칙이 적용되면, 출발지 범위(인터넷 전체나 넓은 대역) 안의 누구나 이 포트로 접속을 시도할 수 있습니다.",
    "cc.rule.az-net-1.summary": "네트워크 보안 그룹(NSG)이 관리용·DB용 포트를 인터넷 전체나 넓은 공인 IP 대역·서비스 태그에 열어 두었는지, 그 NSG가 공인 IP가 붙은 곳에 연결돼 있는지 봅니다.",
    "cc.reason.az-net-1.open-review": "열린 인바운드 규칙을 확인해야 하는 NSG {n}개",
    "cc.rule.aws-log-1.cond.clear": "다중 리전, 기록 중, 관리 이벤트(쓰기 포함), 로그 파일 검증을 모두 갖추고 로그 파일 전달 오류 기록이 없는 trail이 있습니다.",
    "cc.reason.aws-log-1.trail-ok": "다중 리전 · 기록 중 · 관리 이벤트 쓰기 · 로그 파일 검증을 갖추고 전달 오류 기록이 없는 trail이 있음",
    "cc.reason.short.stale-evidence": "증거·시각 불일치",
    "cc.reason.unknown.stale-evidence": "증거가 서로 맞지 않거나 기준 시각과 맞지 않아 판단하지 못했습니다. 다시 수집하세요. 설정을 방금 바꿨다면 시간이 지난 뒤에, 컴퓨터 시계가 어긋났다면 시계를 맞춘 뒤에 수집하세요.",
    // §8-6 의견 5개
    "cc.fact.acl-in-use-bucket-owner-preferred": "ACL 켜짐(객체 소유권: Bucket owner preferred)",
    "cc.fact.acl-in-use-object-writer": "ACL 켜짐(객체 소유권: Object writer)",
    "cc.fact.acl-in-use-unset": "객체 소유권 설정 없음(ACL이 켜진 것으로 봄)",
    "cc.fact.acl-in-use-other": "객체 소유권 값을 해석하지 못함(ACL이 켜진 것으로 봄)",
    "cc.fact.evidence-later-than-as-of": "기준 시각({reference})보다 늦은 기록: {evidence}",
  };
  it.each(Object.entries(CHANGED))("%s", (k, v) => expect(KO[k]).toBe(v));

  it("덧붙인 문장 4곳은 기존 문장 뒤(또는 마지막 문장 앞)에 붙었다", () => {
    expect(KO["cc.rule.aws-net-1.fix.change"]).toMatch(/로드밸런서 뒤로 옮기고 80·443으로만 받는 방법이 있습니다\. 출발지가 넓은 대역이면 지우는 명령의 0\.0\.0\.0\/0 자리에 그 대역을 넣고, 프리픽스 리스트라면 목록에서 넓은 대역을 빼거나 규칙의 출발지를 좁힙니다\.$/);
    expect(KO["cc.rule.az-net-1.fix.observe"]).toMatch(/합친 결과를 볼 수 있습니다\. 서비스 태그에 든 주소 범위는 Azure CLI의 az network list-service-tags로 볼 수 있습니다\. 아래 명령은 NSG의 규칙을 보여 줍니다\.$/);
    expect(KO["cc.rule.aws-log-1.impact"]).toMatch(/확인할 수 없습니다\. 로그 파일 전달 오류가 있었다면 그동안의 로그 파일이 버킷에 없을 수 있습니다\.$/);
    expect(KO["cc.rule.aws-log-1.fix.change"]).toMatch(/저장 비용이 생길 수 있습니다\. 로그 파일 전달 오류 기록이 있으면 버킷 정책이 CloudTrail의 쓰기를 허용하는지 확인해 고치거나, 새 버킷을 만들어 trail이 그 버킷을 쓰도록 바꿉니다\(update-trail\)\. 고친 뒤 다시 수집해 결과를 확인하세요\.$/);
    expect(KO["cc.rule.aws-net-1.fix.observe"]).toContain("아래 첫 번째 명령은 이 보안 그룹이 연결된 네트워크 인터페이스를, 두 번째 명령은 출발지가 프리픽스 리스트일 때 그 목록에 든 주소를 보여 줍니다.");
  });
  it("금지어(시간 약속 · '통과' · '인증' · '안전')가 새 문구에 한 군데도 없다", () => {
    const keys = [...Object.keys(NEW), ...Object.keys(CHANGED), "cc.banner.as-of-before-evidence.body", "cc.rule.aws-net-1.cond.caution", "cc.rule.aws-net-1.cond.clear", "cc.rule.az-net-1.cond.caution", "cc.rule.az-net-1.cond.clear",
      "cc.rule.aws-net-1.question", "cc.rule.az-net-1.question", "cc.rule.az-net-1.impact", "cc.rule.aws-log-1.cond.caution", "cc.rule.aws-log-1.fix.observe"];
    expect(keys.flatMap((k) => findBanned(KO[k] ?? "").map((h) => `${k}: ${h.label}`))).toEqual([]);
  });
});
