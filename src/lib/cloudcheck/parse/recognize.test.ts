// src/lib/cloudcheck/parse/recognize.test.ts — 입력 인식(V2 오류 패널의 12개 상태) · 예외를 던지지 않음 · 키 파일 거부
import { describe, expect, it } from "vitest";
import { LIMITS } from "../contract/collect-schema";
import { demoInputName } from "../contract/normalized";
import { recognize } from "./recognize";
import { readHandle } from "./handle";
import { buildInput } from "./normalize";
import { awsFile, azureFile, enc, rec, recCsv, reportCsv, rgNsgCsv, rgStorageCsv, SELF, TENANT } from "./testdata";

const get = (b: Uint8Array, name = "x.bin") => recognize({ via: "file", name, bytes: b, lastModified: null });

// 가짜 비밀 모양 값은 실행 중에 조각을 이어 붙여 만든다(공개 저장소 푸시 보호: 소스 바이트에 완성된 비밀 모양을 남기지 않는다). 값은 예전 리터럴과 글자 하나까지 같다.
// AWS 문서가 공개한 예시(AKIAIOSFODNN7EXAMPLE · wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY)는 예외로 그대로 둔다.
const j = (...parts: readonly string[]): string => parts.join("");
const pemHead = (label = ""): string => j("-----BEGIN ", label, "PRIVATE", " KEY", "-----");
const pemFoot = (label = ""): string => j("-----END ", label, "PRIVATE", " KEY", "-----");
/** 40자 비밀 키 모양(본문 두 조각) */
const SECRET40 = j("abcdefghijklmnopqrstuvwxyz", "0123456789ABCD");

describe("정상 인식", () => {
  it("AWS 수집기 JSON: 종류 · 신원 미리보기(끝 4자리, 별칭) · 기준 시각 · 담긴 문 · 불투명 핸들", () => {
    const r = rec(awsFile().file, { name: "cloudcheck-aws-9012-20261019T031200Z.json" });
    expect([r.status, r.kind, r.detail, r.via]).toEqual(["ok", "collector-json", null, "file"]);
    expect(r.identityPreview).toMatchObject({ cloud: "aws", accountLast4: "9012", alias: { kind: "sensitive", type: "alias", full: "acme-prod", masked: "alias-001" } });
    expect(r.asOf).toEqual({ at: "2026-10-19T03:12:00Z", source: "collected-at" });
    expect(r.doors).toEqual(["mfa", "key", "net", "sto", "log"]);
    expect(r.name).toMatchObject({ kind: "sensitive", type: "fileName", masked: "file-001" });
    expect(r.bytes).toBe(enc(awsFile().file).length);
    expect(r.handle).not.toBeNull();
    expect(Object.keys(r.handle as object)).toEqual([]);              // 핸들은 속이 빈 객체다(UI는 내용을 볼 수 없다)
    expect(Object.isFrozen(r.handle)).toBe(true);
    expect(readHandle(r.handle)).not.toBeNull();
    expect(readHandle({})).toBeNull();
  });
  it("Azure 수집기 JSON: 신원 미리보기는 테넌트 끝 4자리, 별칭 없음, mfa는 수집기 대상이 아니라 doors에 없다", () => {
    const r = rec(azureFile().file);
    expect(r.status).toBe("ok");
    expect(r.identityPreview).toEqual({ cloud: "azure", accountLast4: TENANT.slice(-4), alias: null });
    expect(r.doors).toEqual(["key", "net", "sto", "log"]);
  });
  it("--doors로 건너뛴 문은 doors에서 빠진다", () => {
    expect(rec(awsFile({ doors: { net: "skipped", log: "skipped" } }).file).doors).toEqual(["mfa", "key", "sto"]);
  });
  it("UTF-8 BOM · 앞뒤 공백이 있어도 읽는다", () => {
    const text = `\ufeff \n${JSON.stringify(awsFile().file)}\n\n`;
    expect(rec(text).status).toBe("ok");
  });
  it("붙여넣기(via: paste)는 이름이 평문이고, 체험(via: demo)은 이름 규약을 지켜야 한다", () => {
    const p = rec(awsFile().file, { via: "paste", name: "붙여넣은 내용 1" });
    expect(p.name).toEqual({ kind: "plain", text: "붙여넣은 내용 1" });
    const d = rec(awsFile().file, { via: "demo", name: demoInputName("C", "aws") });
    expect([d.status, d.via, d.name]).toEqual(["ok", "demo", { kind: "plain", text: "cloudcheck-demo-C.aws.json" }]);
    expect(rec(awsFile().file, { via: "demo", name: "아무 이름.json" }).status).toBe("not-cloudcheck");
    expect(rec(awsFile().file, { via: "demo", name: demoInputName("C", "azure") }).status).toBe("not-cloudcheck");
    expect(rec(awsFile().file, { via: "demo", name: "cloudcheck-demo-E.aws.json" }).status).toBe("not-cloudcheck");
  });
});

describe("실패 상태 12종 중 입력 단계의 것", () => {
  it("empty: 0바이트 · 공백뿐 · 머리글만 있는 Resource Graph CSV", () => {
    expect(get(new Uint8Array(0)).status).toBe("empty");
    expect(get(enc("  \n\t\r\n")).status).toBe("empty");
    expect(recCsv(rgStorageCsv([])).status).toBe("empty");
  });
  it("too-large: JSON 25MB · CSV 20MB 상한(경계 포함)", () => {
    const big = (n: number, first: string): Uint8Array => { const b = new Uint8Array(n).fill(0x20); b[0] = first.charCodeAt(0); return b; };
    expect(get(big(LIMITS.jsonBytes + 1, "{")).status).toBe("too-large");
    expect(get(big(LIMITS.csvBytes + 1, "a")).status).toBe("too-large");
    expect(get(big(LIMITS.jsonBytes, "{")).status).not.toBe("too-large");
    expect(get(big(LIMITS.csvBytes, "a")).status).not.toBe("too-large");
    expect(get(new Uint8Array(LIMITS.jsonBytes + LIMITS.csvBytes)).status).toBe("too-large");
  });
  it("wrong-type: 잘못된 UTF-8 · PDF · NUL 문자 · 한 줄짜리 글 · 모르는 CSV", () => {
    expect(get(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])).status).toBe("wrong-type");
    expect(get(enc("%PDF-1.4\n1 0 obj\n<<>>\nendobj")).status).toBe("wrong-type");
    expect(get(enc("a,b\u0000c\n1,2")).status).toBe("wrong-type");
    expect(get(enc("그냥 글입니다")).status).toBe("wrong-type");
    expect(get(enc("a,b,c\n1,2,3\n")).status).toBe("wrong-type");
  });
  it("too-deep: 중첩 33단계부터(재귀 없이 세므로 아주 깊어도 안전)", () => {
    expect(get(enc("[".repeat(33) + "]".repeat(33))).status).toBe("too-deep");
    expect(get(enc("[".repeat(200_000))).status).toBe("too-deep");
    expect(get(enc("[".repeat(32) + "]".repeat(32))).status).toBe("not-cloudcheck");
  });
  it("parse-error(잘림): 줄·칸 · maybeTruncated · 끝 40자(tail)를 담는다", () => {
    const text = JSON.stringify(awsFile().file, null, 2);
    const cut = text.slice(0, 700);
    const r = rec(cut);
    expect(r.status).toBe("parse-error");
    expect(r.detail).toMatchObject({ line: { n: cut.split("\n").length }, maybeTruncated: { n: 1 } });
    const tail = (r.detail as Record<string, { v: { kind: string; full?: string } }>).tail.v;
    expect(tail.kind).toBe("sensitive");
    expect(tail.full).toBe(cut.trimEnd().slice(-40).replace(/\n/g, "\ufffd"));   // 제어 문자(줄바꿈)는 정리 규칙대로 바뀐다
    expect(r.handle).toBeNull();
  });
  it("parse-error(중간에 오타): 닫는 괄호가 있으면 잘림으로 보지 않는다", () => {
    const r = rec('{"schema": "cloudcheck.collect/1.0",\n  "collector": {,}\n}');
    expect(r.status).toBe("parse-error");
    expect(r.detail).toMatchObject({ line: { n: 2 }, col: { n: 17 } });
    expect(r.detail).not.toHaveProperty("maybeTruncated");
  });
  it("parse-error의 tail에 비밀 모양이 있으면 redacted — 파일 어디에든 있으면 끝 40자가 아니어도 가린다", () => {
    const r = rec('{"x": "AKIAIOSFODNN7EXAMPLE", "y": [1, 2, 3');
    expect(r.status).toBe("parse-error");
    expect((r.detail as Record<string, { v: unknown }>).tail.v).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(JSON.stringify(r)).not.toContain("AKIA");
  });
  it("not-cloudcheck: 배열 · schema 없음 · schema 형식 오류 · 봉투 오류 · 영수증 ID 중복 · 클라우드/이름 불일치 · 모르는 data 섹션", () => {
    for (const bad of ["[1,2,3]", '{"hello":"world"}', '{"schema":"other/1.0"}', '{"schema":"cloudcheck.collect/1"}']) expect(rec(bad).status, bad).toBe("not-cloudcheck");
    for (const bare of ['"just a string"', "42", "true", "null"]) expect(rec(bare).status, bare).toBe("wrong-type");   // JSON 객체·배열로 시작하지 않으면 글/CSV로 본다
    const f = awsFile().file;
    expect(rec({ ...f, extra: 1 }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, collectedAt: "2026-02-30T00:00:00Z" }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, receipts: [...f.receipts, f.receipts[0]] }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, receipts: f.receipts.map((r: { at: string }, i: number) => (i === 0 ? { ...r, at: "2026-02-30T00:00:00Z" } : r)) }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, collector: { ...f.collector, name: "cloudcheck-azure" } }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, data: { ...f.data, secrets: {} } }).status).toBe("not-cloudcheck");
    expect(rec({ ...f, cloud: "gcp" }).status).toBe("not-cloudcheck");
  });
  it("예외 파일을 결과 파일 자리에 넣으면 not-cloudcheck + hint: exceptions-file", () => {
    const ex = { schema: "cloudcheck.exceptions/1.0", entries: [] };
    expect(rec(ex).detail).toEqual({ hint: { c: "exceptions-file" } });
    expect(rec({ entries: [] }).detail).toEqual({ hint: { c: "exceptions-file" } });
    expect(rec({ schema: "other/1" }).detail).toBeNull();
  });
  it("schema-major: 메이저가 1이 아니면 리포트를 만들지 않는다(detail.major) · Resource Graph 쿼리 v2도 같다", () => {
    const r = rec({ ...awsFile().file, schema: "cloudcheck.collect/2.0" });
    expect([r.status, r.detail]).toEqual(["schema-major", { major: { n: 2 } }]);
    expect(rec({ schema: "cloudcheck.collect/0.9" }).detail).toEqual({ major: { n: 0 } });
    expect(recCsv(rgStorageCsv([`cc-rg-storage/3,${TENANT},x,y,z,n,k,l,,,,,,`])).detail).toEqual({ major: { n: 3 } });
  });
});

describe("키 파일 거부(B7): 어떤 값도 결과에 싣지 않는다", () => {
  const files: Record<string, string> = {
    "credentials 파일": "[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
    "환경변수 내보내기": "export AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
    "새 액세스 키 CSV": "Access key ID,Secret access key\nAKIAIOSFODNN7EXAMPLE,wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
    "sts 출력": `{"Credentials":{"AccessKeyId":"${j("AS", "IA", "IOSFODNN7EXAMPLE")}","SecretAccessKey":"wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY","SessionToken":"${j("FwoGZXIv", "YXdz")}"}}`,
    "az 서비스 주체 출력": '{"appId":"00000000-0000-0000-0000-000000000000","displayName":"sp","password":"Abcdefgh~12345678","tenant":"11111111-2222-3333-4444-555555555555"}',
    "PEM": j(pemHead("RSA "), "\nMIIEowIBAAKCAQEAexample\n", pemFoot("RSA "), "\n"),
    "연결 문자열": j("DefaultEndpointsProtocol=https;AccountName=acct;", "Account", "Key=", SECRET40, "==", ";EndpointSuffix=core.windows.net"),
  };
  for (const [name, text] of Object.entries(files)) {
    it(`${name} → credentials-file, 핸들·detail·tail 없음, 결과 어디에도 키 값이 없다`, () => {
      const r = get(enc(text), "creds.txt");
      expect(r.status).toBe("credentials-file");
      expect([r.handle, r.detail, r.kind, r.identityPreview, r.asOf, r.doors]).toEqual([null, null, null, null, null, []]);
      const dump = JSON.stringify(r);
      for (const secret of ["AKIAIOSFODNN7EXAMPLE", "wJalr", "FwoGZ", "Abcdefgh~", "MIIEow", SECRET40]) expect(dump, secret).not.toContain(secret);
    });
  }
  it("정상 결과 파일 안에 키 ID가 섞여 있어도 파일 거부가 아니라 값만 지운다(배너) — 인식은 ok", () => {
    const f = awsFile({ mutate: (x) => { x.data.iamUsers.items[0].userName = "AKIAIOSFODNN7EXAMPLE"; } }).file;
    expect(rec(f).status).toBe("ok");
  });
});

describe("CSV 인식", () => {
  const ms = Date.UTC(2026, 9, 18, 22, 15, 0) + 456;
  it("자격증명 보고서: 계정은 ARN에서, 기준 시각은 파일 이름 > lastModified > 없음, 담긴 문은 mfa·key", () => {
    const a = recCsv(reportCsv(), "status_reports_2026-10-18T22_15_00Z.csv", ms);
    expect([a.status, a.kind, a.doors]).toEqual(["ok", "csv-credential-report", ["mfa", "key"]]);
    expect(a.identityPreview).toEqual({ cloud: "aws", accountLast4: "9012", alias: null });
    expect(a.asOf).toEqual({ at: "2026-10-18T22:15:00Z", source: "filename" });
    expect(recCsv(reportCsv(), "credential_report.csv", ms).asOf).toEqual({ at: "2026-10-18T22:15:00Z", source: "file-time" });
    expect(recCsv(reportCsv(), "credential_report.csv", null).asOf).toBeNull();
    expect(recognize({ via: "paste", name: "붙여넣은 내용 1", bytes: enc(reportCsv()), lastModified: 123456789000 }).asOf).toBeNull();
  });
  it("BOM · CRLF · 열 순서 · 대소문자가 달라도 읽는다", () => {
    expect(recCsv(`\ufeff${reportCsv().replace(/\n/g, "\r\n")}`).status).toBe("ok");
  });
  it("보고서에서 계정을 알 수 없으면(ARN 없음) 거부한다 · 닫히지 않은 따옴표는 parse-error", () => {
    expect(recCsv(`${reportCsv().split("\n")[0]}\n`).status).toBe("not-cloudcheck");
    const r = recCsv(`user,arn,password_enabled\n"alice,arn:aws:iam::123456789012:user/alice,true\n`);
    expect(r.status).toBe("parse-error");
    expect(r.detail).toMatchObject({ line: { n: 2 }, col: { n: 1 }, maybeTruncated: { n: 1 } });
  });
  it("Resource Graph: 스토리지(key·sto) · NSG(net), 신원은 tenantId 열(끝 4자리)", () => {
    const s = recCsv(rgStorageCsv(), "cc-rg-storage.csv");
    expect([s.status, s.kind, s.doors]).toEqual(["ok", "csv-rg-storage", ["key", "sto"]]);
    expect(s.identityPreview).toEqual({ cloud: "azure", accountLast4: TENANT.slice(-4), alias: null });
    const n = recCsv(rgNsgCsv(), "cc-rg-nsg.csv");
    expect([n.status, n.kind, n.doors]).toEqual(["ok", "csv-rg-nsg", ["net"]]);
  });
  it("Resource Graph CSV에 ccQuery 상수 열이 없으면 쿼리 버전을 알 수 없다 → wrong-type", () => {
    expect(recCsv(rgStorageCsv().replace("ccQuery,", "").replace(/cc-rg-storage\/1,/, "")).status).toBe("wrong-type");
  });
  it("Entra 등록 CSV(조건부): 인식은 되지만 신원이 없다", () => {
    const r = recCsv("User principal name,Is MFA registered\nuser1@example.com,true\n");
    expect([r.status, r.kind, r.identityPreview, r.doors]).toEqual(["ok", "csv-entra-registration", null, ["mfa"]]);
  });
});

describe("minor가 더 높은 파일은 strip으로 읽는다(INV-10)", () => {
  it("1.1 파일의 모르는 필드는 버리고 읽는다 · 1.0 파일의 모르는 필드는 그 섹션만 쓰지 못한다", () => {
    const withExtra = (schema: string) => awsFile({ mutate: (f) => { f.schema = schema; f.data.iamUsers.items[0].Tags = [{ Key: "k" }]; f.extraTop = 1; } }).file;
    const newer = rec(withExtra("cloudcheck.collect/1.1"));
    expect(newer.status).toBe("ok");
    const b = buildInput([newer]);
    expect(b.ok && b.input.inputs[0].schema).toEqual({ id: "cloudcheck.collect/1.1", support: "newer-minor" });
    expect(b.ok && b.input.notices.sectionIssues).toEqual([]);
    const strict = rec(withExtra("cloudcheck.collect/1.0"));
    expect(strict.status).toBe("not-cloudcheck");   // 최상위 모르는 키는 strict에서 파일 거부
    const sectionOnly = rec(awsFile({ mutate: (f) => { f.data.iamUsers.items[0].Tags = [{ Key: "k" }]; } }).file);
    expect(sectionOnly.status).toBe("ok");
    const b2 = buildInput([sectionOnly]);
    expect(b2.ok && b2.input.notices.sectionIssues.map((i) => `${i.door}/${i.section}/${i.reason}`).sort()).toEqual(["key/iamUsers/schema-section", "mfa/iamUsers/schema-section"]);
  });
});

describe("예외를 던지지 않는다", () => {
  it("잘린 정상 파일: 어느 위치에서 잘라도 ok가 되지 않고 예외도 없다", () => {
    const text = JSON.stringify(awsFile({ doors: { net: "skipped", sto: "skipped", log: "skipped" } }).file);
    for (let cut = 1; cut < text.length; cut += Math.max(1, Math.floor(text.length / 120))) {
      const r = rec(text.slice(0, cut));
      expect(r.status, `cut ${cut}`).not.toBe("ok");
      expect(r.handle).toBeNull();
    }
    expect(rec(text).status).toBe("ok");
  });
  it("무작위 바이트 · 이상한 JSON · 거대한 문자열", () => {
    let seed = 12345;
    const rnd = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed; };
    for (let i = 0; i < 200; i++) {
      const n = rnd() % 300;
      const b = new Uint8Array(n);
      for (let k = 0; k < n; k++) b[k] = rnd() & 0xff;
      expect(() => get(b), `fuzz ${i}`).not.toThrow();
    }
    for (const s of ['{"schema":"cloudcheck.collect/1.0","cloud":"aws","receipts":{}}', '{"__proto__":{"x":1}}', '{"schema":{"toString":1}}', "null", "true", '""', "-", "{", "}", "[", '{"a":', "\"\\ud800\"", '{"a":"\\u0000"}'])
      expect(() => rec(s), s).not.toThrow();
    expect(rec('"' + "a".repeat(1_000_000) + '"').status).toBe("wrong-type");
  });
  it("__proto__ 키가 있는 JSON은 strict 봉투에서 거부된다(프로토타입 오염 없음)", () => {
    const polluted = '{"schema":"cloudcheck.collect/1.0","__proto__":{"polluted":true}}';
    expect(rec(polluted).status).toBe("not-cloudcheck");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
