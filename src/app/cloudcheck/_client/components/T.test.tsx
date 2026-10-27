// @vitest-environment jsdom
// <T>·<Msg> — 카탈로그 문장 조립의 렌더 쪽 단일 구현. {v}는 MaskedValue, {t}는 <time>, 노드는 그대로, 수는 천 단위 쉼표, 빠진 파라미터는 {이름}, 없는 키는 ⟦키⟧.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IsoDate, IsoUtc, MsgRef } from "../../../../lib/cloudcheck/model/report";
import { missingText } from "../i18n/index";
import { sens } from "../mocks/build";
import { Msg, T } from "./T";
import { attrValues } from "./__tests__/render";

const at = "2026-10-19T03:12:00Z" as IsoUtc;

describe("<T>", () => {
  it("글자 + 수(천 단위 쉼표) + 비식별 문자열", () => {
    const { container } = render(<T k="cc.c.scope.collect.line" p={{ t: "-", version: "1.0.0", ok: 12345, denied: 3, error: 0, truncated: 1 }} />);
    expect(container.textContent).toBe("수집: - · 수집기 1.0.0 · 호출 성공 12,345 · 거부 3 · 오류 0 · 잘림 1");
  });

  it("{t} → <time dateTime> + KST 전체 표기", () => {
    const { container } = render(<T k="cc.ctx.asof" p={{ t: { t: at } }} />);
    const time = container.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe(at);
    expect(container.textContent).toBe("2026-10-19 12:12 KST (03:12 UTC) 기준");
  });

  it("{v} → MaskedValue(이중 렌더), 사용자 데이터가 속성에 새지 않는다", () => {
    const { container } = render(<T k="cc.c.exc.title" p={{ target: { v: sens("resourceName", "acme-secret-bucket", "bucket-001") } }} />);
    expect(container.querySelector(".cc-mask-full")?.textContent).toBe("acme-secret-bucket");
    expect(container.querySelector(".cc-mask-short")?.textContent).toBe("bucket-001");
    expect(attrValues(container).some((v) => v.includes("acme-secret"))).toBe(false);
  });

  it("{d} → 날짜 글자, {c} → 비식별 상수, {n} → 수", () => {
    const { container } = render(<T k="cc.c.scope.perm.denied-line" p={{ call: { c: "s3:GetBucketAcl" }, scope: { c: "ap-northeast-2" }, errorCode: "AccessDenied", times: { n: 1000 }, rules: 2 }} />);
    expect(container.textContent).toBe("s3:GetBucketAcl · ap-northeast-2 — AccessDenied (1,000회, 점검 2개에 영향)");
    const d = render(<T k="cc.c.rule.last-verified" p={{ d: { d: "2026-10-19" as IsoDate } }} />);
    expect(d.container.textContent).toBe("마지막 확인일 2026-10-19");
  });

  it("ReactElement 파라미터는 그대로 끼운다(순서 보존)", () => {
    const { container } = render(<T k="cc.c.scope.perm.need" p={{ permission: <code className="cc-mono">s3:GetBucketAcl</code> }} />);
    expect(container.textContent).toBe("필요한 권한: s3:GetBucketAcl");
    expect(container.querySelector("code.cc-mono")?.textContent).toBe("s3:GetBucketAcl");
  });

  it("빠진 파라미터는 {이름} 그대로(조용히 지우지 않는다), 없는 키는 ⟦키⟧", () => {
    const { container } = render(<T k="cc.c.dist.lead" />);
    expect(container.textContent).toBe("점검 {total}개");
    const key = "cc.c.nope-nope" as const;
    const miss = render(<T k={key as `cc.${string}`} />);
    expect(miss.container.textContent).toBe(missingText(key));
  });
});

describe("<Msg>", () => {
  const E_MISS = (key: string): RegExp => new RegExp(`^(⟦${key.replace(/[.-]/g, "\\$&")}⟧|[^⟦]+)$`);
  it("엔진 코드 → keyOf 키(E 카탈로그가 병합되기 전에는 ⟦키⟧, 병합 뒤에는 문장)", () => {
    const m: MsgRef = { code: "AWS-MFA-2:console-no-mfa", params: { n: { n: 3 } } };
    const { container } = render(<Msg m={m} />);
    expect(container.textContent ?? "").toMatch(E_MISS("cc.reason.aws-mfa-2.console-no-mfa"));
  });

  it("short: 확인 불가 사유는 cc.reason.short.<코드>, 그 밖의 코드는 일반 키", () => {
    const a = render(<Msg m={{ code: "denied" }} short />);
    expect(a.container.textContent ?? "").toMatch(E_MISS("cc.reason.short.denied"));
    const b = render(<Msg m={{ code: "isolated-denial" }} short />);
    expect(b.container.textContent ?? "").toMatch(E_MISS("cc.reason.isolated-denial"));
  });

  it("{v} 파라미터가 든 코드도 MaskedValue로(글자 조립은 T가 한다) — 어떤 문장이든 값이 속성에 새지 않는다", () => {
    const m: MsgRef = { code: "unknown-x" as MsgRef["code"], params: { value: { v: sens("userName", "dev-kim", "user-001") } } };
    const { container } = render(<Msg m={m} />);
    expect(attrValues(container).some((v) => v.includes("dev-kim"))).toBe(false);
  });
});
