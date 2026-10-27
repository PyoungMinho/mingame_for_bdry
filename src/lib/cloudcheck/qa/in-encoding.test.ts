// QA IN-05 — 인코딩 (설계서 §4-4)
// 잘못된 UTF-8 · UTF-16 LE/BE(BOM 포함·없음) · NUL 바이트 = wrong-type, UTF-8 BOM = 정상,
// JSON 이스케이프 짝 없는 서로게이트("\ud800") 이름 = V2(입력 인식 미리보기)·V3(리포트) 모두 redacted(invalid-encoding).
import { describe, expect, it } from "vitest";
import { recognize } from "../parse/recognize";
import { companyJson, nameText, okReport, ruleOf, runJson } from "./kit";
import type { Json } from "./kit";

const json = JSON.stringify(companyJson("aws", "A"));
const r = (bytes: Uint8Array, name = "cloudcheck-aws.json") => recognize({ via: "file", name, bytes, lastModified: null });
const utf16 = (s: string, le: boolean, bom: boolean): Uint8Array => {
  const out: number[] = bom ? (le ? [0xff, 0xfe] : [0xfe, 0xff]) : [];
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); if (le) out.push(c & 0xff, c >> 8); else out.push(c >> 8, c & 0xff); }
  return new Uint8Array(out);
};

describe("IN-05 바이트 인코딩", () => {
  it("잘못된 UTF-8 → wrong-type", () => {
    const b = new TextEncoder().encode(json);
    const bad = new Uint8Array([...b.slice(0, 50), 0xc3, 0x28, ...b.slice(50)]);
    expect(r(bad).status).toBe("wrong-type");
  });
  it("UTF-16 LE/BE(BOM 있음·없음) → wrong-type", () => {
    for (const [le, bom] of [[true, true], [false, true], [true, false], [false, false]] as const) expect(r(utf16(json, le, bom)).status, `le=${le} bom=${bom}`).toBe("wrong-type");
  });
  it("UTF-8 BOM은 정상으로 읽는다(JSON · CSV)", () => {
    expect(r(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(json)])).status).toBe("ok");
    const csv = "user,arn,user_creation_time,password_enabled,password_last_used,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date\n<root_account>,arn:aws:iam::111122223333:root,2019-04-02T01:00:00+00:00,not_supported,N/A,true,false,N/A,N/A,false,N/A,N/A\n";
    expect(r(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(csv)]), "credential-report.csv").status).toBe("ok");
  });
  it("NUL 바이트가 있으면 → wrong-type", () => {
    const b = new TextEncoder().encode(json);
    expect(r(new Uint8Array([...b.slice(0, 100), 0x00, ...b.slice(100)])).status).toBe("wrong-type");
  });
});

describe("IN-05 짝 없는 서로게이트(JSON 이스케이프)", () => {
  it("V3: 사용자 이름에 '\\ud800'이 있으면 리포트 이름은 redacted(invalid-encoding)", () => {
    const f = companyJson("aws", "C");
    const lone = "ex\ud800employee";
    const u = (f.data.iamUsers.items as Json[]).find((x) => x.userName === "ex-employee");
    u.userName = lone;
    f.data.credentialReport.value.csv = (f.data.credentialReport.value.csv as string).split("ex-employee,").join(`${lone},`).split("user/ex-employee").join(`user/${lone}`);
    for (const x of f.receipts as Json[]) if (x.resource === "ex-employee") x.resource = lone;
    const rep = okReport(runJson(JSON.stringify(f)));     // JSON.stringify는 짝 없는 서로게이트를 \ud800 이스케이프로 쓴다
    const item = ruleOf(rep, "AWS-MFA-2").items.find((i) => i.resource.name.kind === "redacted");
    expect(item?.resource.name).toEqual({ kind: "redacted", why: "invalid-encoding" });
    expect(ruleOf(rep, "AWS-MFA-2").items.some((i) => nameText(i).includes("\ud800"))).toBe(false);
  });
  it("[CC-QA-09] V2: 계정 별칭에 '\\ud800'이 있으면 입력 인식 미리보기도 redacted(invalid-encoding)여야 한다(수정 전: 원값 그대로)", () => {
    const f = companyJson("aws", "A");
    f.identity.alias.value = "acme\ud800prod";
    const rec = recognize({ via: "file", name: "cloudcheck-aws.json", bytes: new TextEncoder().encode(JSON.stringify(f)), lastModified: null });
    expect(rec.status).toBe("ok");
    expect(rec.identityPreview?.alias).toEqual({ kind: "redacted", why: "invalid-encoding" });
  });
  it("대조: 같은 별칭은 V3 리포트(신원 블록)에서 redacted(invalid-encoding)다", () => {
    const f = companyJson("aws", "A");
    f.identity.alias.value = "acme\ud800prod";
    expect(okReport(runJson(JSON.stringify(f))).identity.alias).toEqual({ kind: "redacted", why: "invalid-encoding" });
  });
});
