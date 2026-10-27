// @vitest-environment jsdom
// QA IN-07 — 키 파일 거부 (설계서 §4-4, CR-16)
// AWS credentials INI · config(aws_session_token) · export AWS_… · IAM 콘솔 새 액세스 키 CSV · sts assume-role JSON · az ad sp create-for-rbac JSON · PEM ·
// GCP 서비스 계정 JSON · 연결 문자열 · SAS URL · .env · az account get-access-token JSON — 파일 · 붙여넣기 두 경로.
// 기대: credentials-file, 값이 DOM · 속성 · 제목 · 라이브 영역에 없음, 붙여넣기 칸 빈 값, assertive 낭독.
// CC-QA-18(수정·검증됨 2026-10-20): 수정 전에는 get-access-token JSON이 not-cloudcheck, 표준 순서 SAS(sig 맨 끝)가 wrong-type이었다(누출은 없었다). 지금은 회귀 시험.
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recognize } from "../parse/recognize";
import { REAL_DEPS } from "../../../app/cloudcheck/_client/state/deps.real";
import { mount, uploadFiles } from "../../../app/cloudcheck/_client/screens/__tests__/harness";
import { enc } from "./kit";
import { AWS_DOC_SECRET, FAKE_AZURE_ACCOUNT_KEY, FAKE_AZURE_CONNECTION_STRING, FAKE_JWT_RS256, FAKE_SAS_SIGNATURE, FAKE_SESSION_PREFIX, FAKE_SESSION_TOKEN, FAKE_SESSION_TOKEN_LONG, FAKE_STS_KEY_ID, pemBlock, sasUrl } from "./fake-secrets";

// 비밀 모양 값은 qa/fake-secrets.ts가 실행 중에 조립한다(공개 저장소 푸시 보호 대비 — 소스에 완성된 비밀 모양을 두지 않는다). AWS 문서 예시 키 쌍만 그대로 쓴다
const SECRET = AWS_DOC_SECRET;
const JWT = FAKE_JWT_RS256;
const FILES: readonly (readonly [string, string, string])[] = [
  ["AWS credentials INI", "credentials", `[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = ${SECRET}\n`],
  ["AWS config(session token)", "config", `[profile x]\nregion = ap-northeast-2\naws_session_token = ${FAKE_SESSION_TOKEN_LONG}\n`],
  ["export AWS_…", "env.sh", `export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nexport AWS_SECRET_ACCESS_KEY=${SECRET}\n`],
  ["IAM 콘솔 새 액세스 키 CSV", "accessKeys.csv", `Access key ID,Secret access key\nAKIAIOSFODNN7EXAMPLE,${SECRET}\n`],
  ["sts assume-role JSON", "assume.json", JSON.stringify({ Credentials: { AccessKeyId: FAKE_STS_KEY_ID, SecretAccessKey: SECRET, SessionToken: FAKE_SESSION_TOKEN, Expiration: "2026-10-19T04:00:00Z" }, AssumedRoleUser: { AssumedRoleId: "AROA:x", Arn: "arn:aws:sts::111122223333:assumed-role/x/y" } })],
  ["az ad sp create-for-rbac JSON", "sp.json", JSON.stringify({ appId: "00000000-0000-0000-0000-0000000000aa", displayName: "cc-sp", password: "Qx8~Abcdefghijklmnopqrstuvwxyz0123", tenant: "00000000-0000-0000-0000-000000000001" })],
  ["PEM 개인 키", "id_rsa", pemBlock("RSA ", "MIIEowIBAAKCAQEAexample")],
  ["GCP 서비스 계정 JSON", "gcp.json", JSON.stringify({ type: "service_account", project_id: "p", private_key_id: "abc", private_key: pemBlock("", "MIIEexample"), client_email: "x@p.iam.gserviceaccount.com" })],
  ["Azure 연결 문자열", "conn.txt", `${FAKE_AZURE_CONNECTION_STRING}\n`],
  ["SAS URL(sig 뒤에 se)", "sas.txt", sasUrl("https://stx.blob.core.windows.net/c?", FAKE_SAS_SIGNATURE, "&sv=2021-08-06&se=2026-10-20T00:00:00Z\n")],
  [".env", ".env", `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=${SECRET}\n`],
];
const TOKEN_JSON = JSON.stringify({ accessToken: JWT, expiresOn: "2026-10-19 13:00:00.000000", expires_on: 1792368000, subscription: "00000000-0000-0000-0000-0000000000b1", tenant: "00000000-0000-0000-0000-000000000001", tokenType: "Bearer" }, null, 2);

describe("IN-07 recognize: 파일 · 붙여넣기 모두 credentials-file", () => {
  for (const [title, name, text] of FILES) {
    it(`${title}`, () => {
      expect(recognize({ via: "file", name, bytes: enc(text), lastModified: null }).status).toBe("credentials-file");
      expect(recognize({ via: "paste", name: "붙여넣기", bytes: enc(text), lastModified: null }).status).toBe("credentials-file");
    });
  }
  it("[CC-QA-18] 표준 순서 SAS URL(포털·SDK가 만드는 모양: …&se=…&sig=… — sig가 맨 끝)도 credentials-file이어야 한다(수정 전: wrong-type)", () => {
    const sas = sasUrl("https://stx.blob.core.windows.net/c?sp=r&st=2026-10-19T00:00:00Z&se=2026-10-20T00:00:00Z&spr=https&sv=2022-11-02&sr=b&", FAKE_SAS_SIGNATURE, "\n");
    expect(recognize({ via: "paste", name: "붙여넣기", bytes: enc(sas), lastModified: null }).status).toBe("credentials-file");
  });
  it("[CC-QA-18] az account get-access-token JSON(accessToken: eyJ…)도 credentials-file이어야 한다(수정 전: not-cloudcheck)", () => {
    expect(recognize({ via: "file", name: "token.json", bytes: enc(TOKEN_JSON), lastModified: null }).status).toBe("credentials-file");
  });
  it("대조: 토큰 JSON · 표준 순서 SAS는 파일 · 붙여넣기 모두 거부되고 인식 결과에 토큰 · sig 값이 실리지 않는다(누출 없음)", () => {
    const sas = sasUrl("https://stx.blob.core.windows.net/c?sv=2022-11-02&ss=b&srt=co&sp=rl&se=2026-10-20T00:00:00Z&spr=https&", FAKE_SAS_SIGNATURE);
    for (const via of ["file", "paste"] as const) {
      const t = recognize({ via, name: via === "file" ? "token.json" : "붙여넣기", bytes: enc(TOKEN_JSON), lastModified: null });
      expect(t.status).toBe("credentials-file");
      expect(JSON.stringify(t)).not.toContain(JWT.slice(0, 20));
      const u = recognize({ via, name: via === "file" ? "sas.txt" : "붙여넣기", bytes: enc(sas), lastModified: null });
      expect(u.status).toBe("credentials-file");
      expect(JSON.stringify(u)).not.toContain("abcdefghijklmnop");
    }
  });
});

/* ───────── 화면(실엔진): 값 미표시 · 붙여넣기 칸 빈 값 · assertive ───────── */
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };
const everywhere = (): string => [document.body.textContent ?? "", document.title, ...Array.from(document.querySelectorAll("*")).flatMap((el) => Array.from(el.attributes).map((a) => a.value))].join("\n");
const VALUES = ["AKIAIOSFODNN7EXAMPLE", SECRET, FAKE_SESSION_PREFIX, "Qx8~Abcdef", "MIIE", FAKE_AZURE_ACCOUNT_KEY.slice(0, 12), sasUrl("", "abcdef")];

describe("IN-07 실제 화면(V2)", () => {
  for (const [title, name, text] of FILES.filter((x) => ["AWS credentials INI", "sts assume-role JSON", "Azure 연결 문자열", "IAM 콘솔 새 액세스 키 CSV"].includes(x[0]))) {
    it(`파일: ${title} → 거부 안내 + 값 0 + assertive`, async () => {
      window.history.replaceState(null, "");
      const h = mount({ deps: REAL_DEPS, clock: CLOCK });
      await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
      const fname = /\.(json|csv)$/.test(name) ? name : `${name.replace(/^\./, "")}.json`;      // 파일 선택창 accept(.json,.csv) 때문에 확장자를 붙인다
      await uploadFiles(h, [new File([text], fname, { type: "application/json" })]);
      await waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent ?? "").not.toBe(""));
      expect(VALUES.filter((v) => everywhere().includes(v))).toEqual([]);
      expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
    });
  }
  it("붙여넣기: AWS credentials INI → 거부 + 붙여넣기 칸 빈 값 + 값 0 + assertive", async () => {
    window.history.replaceState(null, "");
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    await h.user.click(screen.getByRole("tab", { name: "붙여넣기" }));
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.paste(ta, { clipboardData: { getData: (t: string) => (t === "text/plain" ? FILES[0][2] : ""), files: [], types: ["text/plain"] } });
    await waitFor(() => expect(document.querySelector('[role="alert"]')?.textContent ?? "").not.toBe(""));
    expect(ta.value).toBe("");
    expect(VALUES.filter((v) => everywhere().includes(v))).toEqual([]);
  });
});
