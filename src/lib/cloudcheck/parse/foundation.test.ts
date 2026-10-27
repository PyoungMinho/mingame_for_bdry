// src/lib/cloudcheck/parse/foundation.test.ts — 파서 기반 모듈: 엄격한 시각 · CSV · JSON 문법 위치 · 비밀 패턴 · DisplayValue · 자격증명 보고서 · Resource Graph
import { describe, expect, it } from "vitest";
import { REDACTED_PREFIX, isRedacted } from "../contract/normalized";
import { parseCsv } from "./csv";
import { REPORT_REQUIRED, boolCell, isCredentialReportHeader, readCredentialReport, timeCell } from "./credential-report";
import { cleanText, maskedFor, sensitive } from "./display";
import { arrayCell, detectRg, readRg, tristateCell } from "./rg-csv";
import { jsonSyntaxError, locate, maxJsonDepth } from "./scan";
import { Redactor, findSecret, looksLikeKeyFile } from "./secrets";
import { instantFromMs, parseInstant, timeFromFileName } from "./strict-time";
import { REPORT_HEADER, RG_NSG_HEADER, RG_STORAGE_HEADER, SELF, SUB, TENANT, reportCsv, rgNsgCsv, rgStorageCsv } from "./testdata";
import { readEntra, isEntraHeader } from "./entra-csv";

// 가짜 비밀 모양 값은 실행 중에 조각을 이어 붙여 만든다(공개 저장소 푸시 보호: 소스 바이트에 완성된 비밀 모양을 남기지 않는다). 값은 예전 리터럴과 글자 하나까지 같다.
// AWS 문서가 공개한 예시(AKIAIOSFODNN7EXAMPLE · wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY)는 예외로 그대로 둔다.
const j = (...parts: readonly string[]): string => parts.join("");
const pemHead = (label = ""): string => j("-----BEGIN ", label, "PRIVATE", " KEY", "-----");
const jwtOf = (head: string, body: string, sig: string): string => j("ey", "J", head, ".", "ey", "J", body, ".", sig);

describe("엄격한 UTC 시각(strict-time)", () => {
  it("Z·+00:00·소수 초 1~9자리를 받고 정규형(초 단위 Z)으로 바꾼다", () => {
    expect(parseInstant("2026-10-19T03:12:00Z")).toEqual({ iso: "2026-10-19T03:12:00Z", ms: Date.UTC(2026, 9, 19, 3, 12, 0) });
    expect(parseInstant("2026-10-19T03:12:00+00:00")?.iso).toBe("2026-10-19T03:12:00Z");
    expect(parseInstant("2026-10-19T03:12:00.1234567Z")?.iso).toBe("2026-10-19T03:12:00Z");
    expect(parseInstant("2026-10-19T03:12:00.123456789-00:00")?.iso).toBe("2026-10-19T03:12:00Z");
  });
  it("달력에 없는 날짜·범위 밖 값·다른 오프셋·공백은 거부한다(Date.parse가 받아 주는 것도 거부)", () => {
    for (const bad of ["2026-02-30T00:00:00Z", "2026-13-01T00:00:00Z", "2026-10-19T24:00:00Z", "2026-10-19T03:60:00Z", "2026-10-19T03:12:60Z", "2026-10-19 03:12:00Z", "2026-10-19T03:12:00+09:00", "2026-10-19T03:12:00", "1969-12-31T23:59:59Z", "2201-01-01T00:00:00Z", "2026-10-19", "", "N/A", "2026-10-19T03:12:00.Z"])
      expect(parseInstant(bad), bad).toBeNull();
    expect(parseInstant("2028-02-29T00:00:00Z")).not.toBeNull();   // 윤년
    expect(parseInstant("2026-02-29T00:00:00Z")).toBeNull();
  });
  it("instantFromMs: 1000의 배수만, 범위 안만", () => {
    expect(instantFromMs(1792379520000)?.iso).toBe("2026-10-19T03:12:00Z");
    expect(instantFromMs(1792379520123)).toBeNull();
    expect(instantFromMs(Number.NaN)).toBeNull();
    expect(instantFromMs(-1000)).toBeNull();
  });
  it("파일 이름의 UTC 시각(끝의 Z 필수): 콜론 대신 밑줄·하이픈·점도 받는다", () => {
    expect(timeFromFileName("status_reports_2026-10-18T22_15_00Z.csv")?.iso).toBe("2026-10-18T22:15:00Z");
    expect(timeFromFileName("report-2026-10-18T22-15-00Z.csv")?.iso).toBe("2026-10-18T22:15:00Z");
    expect(timeFromFileName("cloudcheck-aws-3333-20261019T031200Z.json")?.iso).toBe("2026-10-19T03:12:00Z");
    expect(timeFromFileName("report_2026-10-18T22_15_00.csv")).toBeNull();   // Z 없음 → 지역 시각일 수 있다
    expect(timeFromFileName("report.csv")).toBeNull();
    expect(timeFromFileName("report_2026-02-31T22_15_00Z.csv")).toBeNull();
  });
});

describe("CSV(RFC 4180)", () => {
  it("따옴표·이스케이프된 따옴표·따옴표 안의 쉼표·줄바꿈·CRLF를 읽는다", () => {
    const r = parseCsv('a,b,c\r\n1,"x,y",3\r\n"q""r","line1\nline2",z\n');
    expect(r.ok && r.table.header).toEqual(["a", "b", "c"]);
    expect(r.ok && r.table.rows).toEqual([["1", "x,y", "3"], ['q"r', "line1\nline2", "z"]]);
  });
  it("BOM 제거 · 빈 줄은 건너뛰되 행 번호는 센다 · 마지막 줄에 줄바꿈이 없어도 읽는다", () => {
    const r = parseCsv("\uFEFFa,b\n\n1,2\n3,4");
    expect(r.ok && r.table.rows).toEqual([["1", "2"], ["3", "4"]]);
    expect(r.ok && r.table.rowNumbers).toEqual([3, 4]);
  });
  it("열 개수가 머리글과 다른 행도 그대로 돌려준다(추측해서 맞추지 않는다)", () => {
    const r = parseCsv("a,b,c\n1,2\n1,2,3,4\n");
    expect(r.ok && r.table.rows.map((x) => x.length)).toEqual([2, 4]);
  });
  it("닫히지 않은 따옴표는 시작 위치와 함께 실패 · 빈 입력은 empty", () => {
    expect(parseCsv('a,b\n1,"oops\n2,3')).toEqual({ ok: false, reason: "unterminated-quote", line: 2, col: 3 });
    expect(parseCsv("")).toMatchObject({ ok: false, reason: "empty" });
    expect(parseCsv("\n\n")).toMatchObject({ ok: false, reason: "empty" });
  });
  it("쉼표가 들어간 IAM 사용자 이름(따옴표로 감싼 값)을 한 칸으로 읽는다", () => {
    const r = parseCsv('user,arn\n"a,b",arn:aws:iam::123456789012:user/a,b\n');
    expect(r.ok && r.table.rows[0].length).toBe(3);   // 따옴표 밖의 쉼표 때문에 열이 늘어난 행은 '모호한 행'이 된다
    const ok = parseCsv('user,arn\n"a,b",arn:aws:iam::123456789012:user/x\n');
    expect(ok.ok && ok.table.rows[0]).toEqual(["a,b", "arn:aws:iam::123456789012:user/x"]);
  });
});

describe("JSON 깊이 · 문법 오류 위치", () => {
  it("깊이를 반복문으로 센다: 문자열 안의 괄호는 무시, 상한을 넘으면 바로 멈춘다", () => {
    expect(maxJsonDepth('{"a":[{"b":"{{{{["}]}', 32)).toEqual({ depth: 3, exceeded: false });
    expect(maxJsonDepth("[".repeat(40), 32)).toMatchObject({ exceeded: true });
    expect(maxJsonDepth("[".repeat(32) + "]".repeat(32), 32).exceeded).toBe(false);
    expect(maxJsonDepth("[".repeat(33) + "]".repeat(33), 32).exceeded).toBe(true);
    expect(maxJsonDepth('"\\"[[[["', 32).depth).toBe(0);
  });
  it("jsonSyntaxError: 올바른 JSON은 null, 깨진 곳은 위치", () => {
    expect(jsonSyntaxError('{"a":[1,2,{"b":null}],"c":"d\\n\\u00e9"}')).toBeNull();
    expect(jsonSyntaxError("[1, 2, 3]  \n")).toBeNull();
    expect(jsonSyntaxError('{"a":1,}')).toBe(7);
    expect(jsonSyntaxError('{"a" 1}')).toBe(5);
    expect(jsonSyntaxError("[1 2]")).toBe(3);
    expect(jsonSyntaxError('{"a":tru}')).toBe(5);
    expect(jsonSyntaxError("{'a':1}")).toBe(1);
    expect(jsonSyntaxError('{"a":1} x')).toBe(8);
    expect(jsonSyntaxError('{"a":"x\ty"}')).toBe(7);
  });
  it("끝에서 끊긴 입력(붙여넣기 잘림)은 위치 = 입력 길이", () => {
    for (const cut of ['{"a":[1,2', '{"a":"abc', '{"a":', '{"a', '[', '{"a":tr', '{"a":1']) expect(jsonSyntaxError(cut), cut).toBe(cut.length);
  });
  it("locate: 문자 위치 → 줄·칸(1부터)", () => {
    expect(locate("ab\ncd\nef", 0)).toEqual({ line: 1, col: 1 });
    expect(locate("ab\ncd\nef", 4)).toEqual({ line: 2, col: 2 });
    expect(locate("ab\ncd\nef", 99)).toEqual({ line: 3, col: 3 });
  });
  it("JSON.parse가 받아 주는 입력은 모두 문법 오류가 없다(속성: 임의 구조)", () => {
    const samples = [{}, [], [[]], { a: { b: [1, "x", null, true, 1.5e10, -0] } }, "s", 1, null];
    for (const s of samples) expect(jsonSyntaxError(JSON.stringify(s))).toBeNull();
  });
});

describe("비밀 패턴(R-12)", () => {
  it("값 안의 키 ID · 개인 키 · JWT · 연결 문자열 · SAS · 토큰을 찾는다", () => {
    const hits: Record<string, string> = {
      "aws-access-key-id": "AKIAIOSFODNN7EXAMPLE", "private-key": pemHead("RSA "), jwt: jwtOf("hbGciOiJIUzI1NiJ9", "zdWIiOiIxMjM0NTY3ODkwIn0", "abcdefghij"),
      "connection-string": "DefaultEndpointsProtocol=https;AccountName=x", "sas-token": j("https://x.blob.core.windows.net/c?sv=2022&", "si", "g=", "AbCdEfGhIjKlMnOpQrStUvWx%3D", "&se=2027"), "secret-assignment": "aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      "github-token": `ghp_${"a".repeat(36)}`, "slack-token": j("xo", "xb-", "1234567890-abcdef"), "google-api-key": `AIza${"A".repeat(35)}`, "secret-key-token": `sk-${"a".repeat(24)}`, "azure-storage-key": `${"A".repeat(86)}==`,
    };
    for (const [name, v] of Object.entries(hits)) expect(findSecret(v), name).toBe(name);
  });
  it("평범한 이름·ARN·ID·해시·시각은 비밀이 아니다(오탐 없음)", () => {
    for (const v of ["alice", "arn:aws:iam::123456789012:role/vendor-access", "amzn-s3-demo-bucket", "sg-0a1b2c3d4e5f60718", "AIDAEXAMPLEEXAMPLE01", "AROAEXAMPLEEXAMPLE02",
      "d3511f62fe871413431d4cf5150d6ab4d31f08c19183ed1e0b34c670d9578f16", "2026-10-19T03:12:00Z", "/subscriptions/00000000-0000-0000-0000-00000000a011/resourceGroups/rg/providers/Microsoft.Storage/storageAccounts/st1", "AKIA-not-a-key", "ASIA short"])
      expect(findSecret(v), v).toBeNull();
  });
  it("키 파일 판별: credentials 파일 · 환경변수 내보내기 · 새 액세스 키 CSV · sts 출력 · az 서비스 주체 출력 · PEM · 연결 문자열", () => {
    const keyFiles = [
      "[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n",
      "export AWS_SECRET_ACCESS_KEY=abc\n", "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE\nAWS_SECRET_ACCESS_KEY=x\n",
      "User name,Password,Access key ID,Secret access key,Console login link\nalice,,AKIAIOSFODNN7EXAMPLE,wJalr,https://x\n",
      "Access key ID,Secret access key\nAKIAIOSFODNN7EXAMPLE,wJalr\n",
      '{"Credentials":{"AccessKeyId":"ASIAEXAMPLE","SecretAccessKey":"abc","SessionToken":"xyz"}}',
      '{"appId":"00000000-0000-0000-0000-000000000000","displayName":"sp","password":"abcdefgh12345678","tenant":"x"}',
      '{"clientId":"x","clientSecret":"abc"}', j(pemHead("OPENSSH "), "\nxxx"), j("DefaultEndpointsProtocol=https;AccountName=a;", "Account", "Key=", "abcdefghijklmnop1234", "==", ";EndpointSuffix=core.windows.net"),
    ];
    for (const k of keyFiles) expect(looksLikeKeyFile(k), k.slice(0, 40)).toBe(true);
    for (const ok of ["user,arn,password_enabled\nalice,arn:aws:iam::123456789012:user/alice,true\n", '{"schema":"cloudcheck.collect/1.0"}', "ccQuery,tenantId\ncc-rg-storage/1,x\n"]) expect(looksLikeKeyFile(ok)).toBe(false);
  });
  it("Redactor: 같은 원문은 같은 토큰(조인 유지), 다른 값은 다른 토큰, 개수는 서로 다른 값의 수", () => {
    const r = new Redactor();
    const a = r.fix("AKIAIOSFODNN7EXAMPLE"), b = r.fix("ghp_" + "b".repeat(36));
    expect(r.fix("AKIAIOSFODNN7EXAMPLE")).toBe(a);
    expect(a).not.toBe(b);
    expect([isRedacted(a), isRedacted(b), isRedacted("alice")]).toEqual([true, true, false]);
    expect(a.startsWith(REDACTED_PREFIX)).toBe(true);
    expect(r.fix("alice")).toBe("alice");
    expect(r.count).toBe(2);
  });
});

describe("DisplayValue(입력 인식용)", () => {
  it("제어·양방향·zero-width 문자를 바꾸고 256자로 자르고 flags로 알린다", () => {
    const raw = `a\u0007b${String.fromCodePoint(0x202e)}c${String.fromCodePoint(0x200b)}d${"x".repeat(300)}`;
    const c = cleanText(raw);
    expect(c.text.startsWith("a�b�c�d")).toBe(true);
    expect([...c.text]).toHaveLength(256);
    expect([...c.flags].sort()).toEqual(["bidi-replaced", "control-chars-replaced", "truncated"]);
    expect(cleanText("정상 이름").flags).toEqual([]);
  });
  it("masked 형식 v1: *Id는 ••••+끝 4자리, 이름은 <유형>-<3자리>, 파일은 file-<순번>, 자유 텍스트는 •••", () => {
    expect(maskedFor("accountId", "123456789012", 1)).toBe("••••9012");
    expect(maskedFor("userName", "alice", 3)).toBe("user-003");
    expect(maskedFor("fileName", "x.json", 1)).toBe("file-001");
    expect(maskedFor("freeText", "abc", 1)).toBe("•••");
    expect(sensitive("alias", "acme-prod")).toEqual({ kind: "sensitive", type: "alias", full: "acme-prod", masked: "alias-001", flags: [] });
  });
});

describe("자격증명 보고서 읽기", () => {
  it("머리글 판별과 행 해석(루트·사용자·계정 ID)", () => {
    const csv = parseCsv(reportCsv());
    expect(csv.ok && isCredentialReportHeader(csv.table.header)).toBe(true);
    if (!csv.ok) return;
    const t = readCredentialReport(csv.table);
    expect(t.rows.map((r) => r.user)).toEqual(["<root_account>", "jane.doe", "ci-deployer"]);
    expect([t.accountId, t.totalRows, t.ambiguous, t.missingColumns, t.hasAdditionalColumn, t.root?.rowNumber]).toEqual([SELF, 3, [], [], false, 2]);
    expect(t.rows[2].get("access_key_1_last_used_region")).toBe("ap-northeast-2");
  });
  it("열 순서가 달라도 헤더 이름으로 매핑한다 · 대소문자 무시", () => {
    const reordered = "ARN,User,password_enabled,mfa_active\narn:aws:iam::123456789012:user/a,a,true,false\n";
    const csv = parseCsv(reordered);
    if (!csv.ok) throw new Error("csv");
    const t = readCredentialReport(csv.table);
    expect(t.rows[0].user).toBe("a");
    expect(t.rows[0].get("mfa_active")).toBe("false");
    expect(t.missingColumns).toContain("user_creation_time");
  });
  it("필드 수가 머리글과 다른 행은 모호한 행(행 번호로 기록) · 필수 열이 없으면 missingColumns", () => {
    const csv = parseCsv(`${REPORT_HEADER}\nbad-row,only,three\n`);
    if (!csv.ok) throw new Error("csv");
    const t = readCredentialReport(csv.table);
    expect(t.rows).toHaveLength(0);
    expect(t.ambiguous).toEqual([2]);
    expect(REPORT_REQUIRED).toHaveLength(12);
  });
  it("additional_credentials_info 열이 있으면 hasAdditionalColumn", () => {
    const csv = parseCsv(`${REPORT_HEADER},additional_credentials_info\n`);
    if (!csv.ok) throw new Error("csv");
    expect(readCredentialReport(csv.table).hasAdditionalColumn).toBe(true);
  });
  it("셀 해석: TRUE/FALSE 대소문자 무시, 그 밖(not_supported)은 해석 불가", () => {
    expect([boolCell("TRUE"), boolCell("false"), boolCell("True"), boolCell("not_supported"), boolCell(""), boolCell(undefined)]).toEqual([true, false, true, undefined, undefined, undefined]);
    expect(timeCell("2026-10-19T03:12:00+00:00", ["N/A"])).toMatchObject({ kind: "time" });
    expect(timeCell("N/A", ["N/A"])).toEqual({ kind: "none" });
    expect(timeCell("no_information", ["N/A", "no_information"])).toEqual({ kind: "none" });
    expect(timeCell("not_supported", ["N/A"])).toEqual({ kind: "bad" });
    expect(timeCell("2026-02-30T00:00:00Z", [])).toEqual({ kind: "bad" });
  });
});

describe("Resource Graph CSV", () => {
  it("ccQuery 값으로 쿼리 종류를 판별한다 · 다른 버전은 other-version · 표식 없음은 unknown", () => {
    const st = parseCsv(rgStorageCsv());
    const ns = parseCsv(rgNsgCsv());
    if (!st.ok || !ns.ok) throw new Error("csv");
    expect(detectRg(st.table)).toEqual({ status: "ok", kind: "csv-rg-storage", queryId: "cc-rg-storage/1" });
    expect(detectRg(ns.table)).toEqual({ status: "ok", kind: "csv-rg-nsg", queryId: "cc-rg-nsg/1" });
    const v2 = parseCsv(rgStorageCsv([`cc-rg-storage/2,${TENANT},x,${SUB},rg,n,k,l,,,,,,`]));
    if (!v2.ok) throw new Error("csv");
    expect(detectRg(v2.table)).toEqual({ status: "other-version", kind: "csv-rg-storage", version: 2 });
    const other = parseCsv(rgStorageCsv([`something,${TENANT},x,${SUB},rg,n,k,l,,,,,,`]));
    if (!other.ok) throw new Error("csv");
    expect(detectRg(other.table)).toEqual({ status: "not-ours" });
    const noMarker = parseCsv("id,name\n1,a\n");
    if (!noMarker.ok) throw new Error("csv");
    expect(detectRg(noMarker.table)).toEqual({ status: "unknown" });
  });
  it("행 읽기: 테넌트 소문자화 · 모호한 행 · 핵심 열 누락", () => {
    const csv = parseCsv(rgStorageCsv([`cc-rg-storage/1,${TENANT.toUpperCase()},/subscriptions/x,${SUB},rg,n,k,l,,true,,,,`, "too,few"]));
    if (!csv.ok) throw new Error("csv");
    const t = readRg(csv.table, "csv-rg-storage");
    expect([t.tenantId, t.rows.length, t.ambiguous, t.totalRows, t.missingColumns]).toEqual([TENANT, 1, [3], 2, []]);
    const bare = parseCsv("ccQuery,id\ncc-rg-storage/1,x\n");
    if (!bare.ok) throw new Error("csv");
    expect(readRg(bare.table, "csv-rg-storage").missingColumns).toContain("tenantId");
    expect(RG_STORAGE_HEADER.split(",")[0]).toBe("ccQuery");
    expect(RG_NSG_HEADER.split(",")).toHaveLength(17);
  });
  it("셀 해석: 불리언은 대소문자 무시·빈 칸 = 미설정(null), 배열 칸은 JSON 문자열 배열만", () => {
    expect([tristateCell("True"), tristateCell("FALSE"), tristateCell(""), tristateCell("maybe")]).toEqual([true, false, null, undefined]);
    expect([arrayCell(""), arrayCell("[]"), arrayCell('["a","b"]'), arrayCell("[1]"), arrayCell("not json"), arrayCell("null")]).toEqual([[], [], ["a", "b"], null, null, []]);
  });
});

describe("Entra 포털 CSV(조건부)", () => {
  it("느슨한 열 이름 매칭 · 불리언 · 모호한 행", () => {
    const text = "User principal name,Name,Is admin,Is MFA registered,Is MFA capable\nuser1@example.com,User One,TRUE,false,Yes\nbad,row\n";
    const csv = parseCsv(text);
    if (!csv.ok) throw new Error("csv");
    expect(isEntraHeader(csv.table.header)).toBe(true);
    const t = readEntra(csv.table);
    expect(t.rows).toHaveLength(1);
    expect(t.rows[0]).toMatchObject({ user: "user1@example.com", isAdmin: true, mfaRegistered: false, mfaCapable: true });
    expect(t.ambiguous).toEqual([3]);
    expect(isEntraHeader(["a", "b"])).toBe(false);
  });
});
