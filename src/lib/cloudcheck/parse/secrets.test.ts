// src/lib/cloudcheck/parse/secrets.test.ts — 비밀 값 세기(CC-QA-19) · 키 파일 판별 보강(CC-QA-18)
import { describe, expect, it } from "vitest";
import { REDACTED_PREFIX } from "../contract/normalized";
import { Redactor, findSecret, looksLikeKeyFile, secretValues } from "./secrets";

// 비밀 모양 값은 실행 중에 조각을 이어 만든다 — 공개 저장소 푸시 보호 · 외부 스캐너가 소스 리터럴을 실제 비밀로 보지 않게(2026-10-20 QA, 값은 예전과 같다)
const AKIA = "AKIA" + "ZZZZZZZZZZZZZZZZ";
const SIG = "si" + "g=";
const SAS_NAME = "c?sv=2021-08-06&" + SIG + "abcdefghijklmnopqrstuvwxyz0123";
const JWT = ["ey", "JhbGciOiJIUzI1NiJ9", ".", "ey", "JzdWIiOiIxMjM0In0", ".", "abcdefghijk"].join("");
const AZKEY = ["Ab3dEf6hIj9lMn2pQr5tUv", "8xYz1bCd4fGh7jKl0nOp3r", "St6vWx9zAb2dEf5hIj8lMn", "1pQr4tUv7xYz0bCd3fGH", "=", "="].join("");
const STS_ID = "AS" + "IA" + "Y34FZKBOKMUTVV7A";
const SLACK = "xo" + "xb-" + "123456789012-abcdefghijkl";
const SAS_SIG = "abcdefghijklmnopqrstuvwxyz" + "0123456789ABCD%3D";
const PEM_RSA = "-----BEGIN RSA " + "PRIVATE KEY-----\nMIIE\n-----END RSA " + "PRIVATE KEY-----\n";

describe("secretValues — 비밀 모양 값 자체", () => {
  it("값만 돌려준다: 이름이 든 ARN 안에서도 같은 값", () => {
    expect(secretValues(AKIA)).toEqual([AKIA]);
    expect(secretValues(`arn:aws:iam::111122223333:user/${AKIA}`)).toEqual([AKIA]);
    expect(secretValues(`x ${AKIA} y ${AKIA}`)).toEqual([AKIA]);
  });
  it("한 문자열에 서로 다른 비밀이 둘이면 둘", () => {
    expect(secretValues(`${AKIA} ${JWT}`).sort()).toEqual([AKIA, JWT].sort());
  });
  it("비밀이 없거나 짧은 문자열은 빈 배열", () => {
    expect(secretValues("alice")).toEqual([]);
    expect(secretValues("arn:aws:iam::111122223333:root")).toEqual([]);
    expect(secretValues("short")).toEqual([]);
  });
  it("Azure 스토리지 키는 앞 경계 문자를 떼고 센다", () => {
    expect(secretValues(` ${AZKEY}`)).toEqual([AZKEY]);
  });
});

describe("Redactor — 지운 개수 = 서로 다른 비밀 값의 수", () => {
  it("같은 비밀이 이름 칸과 ARN 칸에 나와도 1개, 같은 원문은 같은 토큰", () => {
    const r = new Redactor();
    const a = r.fix(AKIA);
    const b = r.fix(`arn:aws:iam::111122223333:user/${AKIA}`);
    expect(a.startsWith(REDACTED_PREFIX)).toBe(true);
    expect(b.startsWith(REDACTED_PREFIX)).toBe(true);
    expect(a).not.toBe(b);                          // 문자열이 다르니 토큰은 다르다(조인 키는 원문 단위)
    expect(r.fix(AKIA)).toBe(a);
    expect(r.count).toBe(1);
  });
  it("서로 다른 비밀은 각각 센다(9종 표본)", () => {
    const r = new Redactor();
    for (const v of [AKIA, STS_ID, SAS_NAME, `ghp_${"a1B2c3D4e5".repeat(4)}`, AZKEY, `AIza${"Sy0123456789abcdefghijklmnopqrstuvw".slice(0, 35)}`, "sk-proj0123456789abcdefghij", JWT, SLACK]) r.fix(v);
    expect(r.count).toBe(9);
  });
  it("비밀이 없는 문자열은 그대로이고 세지 않는다", () => {
    const r = new Redactor();
    expect(r.fix("alice")).toBe("alice");
    expect(r.fix("arn:aws:iam::111122223333:root")).toBe("arn:aws:iam::111122223333:root");
    expect(r.count).toBe(0);
  });
  it("한 문자열 안의 비밀 둘 = 2", () => {
    const r = new Redactor();
    r.fix(`${AKIA}/${JWT}`);
    expect(r.count).toBe(2);
  });
});

describe("looksLikeKeyFile — CC-QA-18", () => {
  it("az account get-access-token JSON · MSAL 토큰 응답은 키 파일이다", () => {
    expect(looksLikeKeyFile(JSON.stringify({ accessToken: JWT, expiresOn: "2026-10-19 13:00:00.000000", tokenType: "Bearer" }, null, 2))).toBe(true);
    expect(looksLikeKeyFile(JSON.stringify({ access_token: JWT, token_type: "Bearer" }))).toBe(true);
    expect(looksLikeKeyFile(JSON.stringify({ refresh_token: JWT }))).toBe(true);
  });
  it("accessToken 필드라도 JWT 모양이 아니면(빈 값 · 일반 글) 키 파일로 보지 않는다", () => {
    expect(looksLikeKeyFile(JSON.stringify({ accessToken: "", note: "x" }))).toBe(false);
    expect(looksLikeKeyFile(JSON.stringify({ accessToken: "none" }))).toBe(false);
  });
  it("SAS URL은 sig=와 만료(se=)·정책(si=)이 함께 있으면 순서와 상관없이 키 파일이다", () => {
    const sigLast = "https://stx.blob.core.windows.net/c?sp=r&st=2026-10-19T00:00:00Z&se=2026-10-20T00:00:00Z&spr=https&sv=2022-11-02&sr=b&" + SIG + SAS_SIG;
    const sigFirst = "https://stx.blob.core.windows.net/c?" + SIG + SAS_SIG + "&sv=2021-08-06&se=2026-10-20T00:00:00Z";
    const policy = "https://stx.blob.core.windows.net/c?sv=2021-08-06&si=policy1&sr=c&" + SIG + SAS_SIG;
    for (const s of [sigLast, sigFirst, policy]) expect(looksLikeKeyFile(s), s.slice(0, 50)).toBe(true);
  });
  it("sv= 하나와 sig만 든 조각(사용자 이름 칸의 비밀 모양)은 파일째 거부하지 않는다 — 그 값만 지운다", () => {
    expect(looksLikeKeyFile(JSON.stringify({ userName: SAS_NAME }))).toBe(false);
    expect(findSecret(SAS_NAME)).not.toBeNull();
  });
  it("원래 거부하던 것은 그대로 거부한다", () => {
    for (const s of ["[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n", PEM_RSA, "DefaultEndpointsProtocol=https;AccountName=stx;AccountKey=abc"]) expect(looksLikeKeyFile(s)).toBe(true);
  });
});
