// src/app/cloudcheck/_client/mocks/inputs.ts — 목업 InputRecognition(V2 화면). 소유: 프론트팀장.
// RecognitionStatus 12종을 하나씩 둔다. detail의 모양(hint·tail·line·col·major)은 디자인 Q17·§7-3의 요청안이고, 진짜 모양은 API설계자 recognize()가 정한다.
// handle은 불투명 핸들이다(UI는 열지 않는다). status = ok일 때만 non-null.
import type { InputRecognition, ParsedHandle, RecognitionStatus } from "../../../../lib/cloudcheck/model/report";
import { c, collectedAt, iso, n, plain, sens, v } from "./build";

const HANDLE = {} as ParsedHandle;
const AS = collectedAt("2026-10-19T03:12:00Z");

const base = (status: RecognitionStatus, name: string, masked: string, bytes: number): InputRecognition => ({
  via: "file", name: sens("fileName", name, masked), bytes, status, kind: null, detail: null, identityPreview: null, asOf: null, doors: [], handle: null,
});

export const RECOG_OK_AWS: InputRecognition = {
  ...base("ok", "cloudcheck-result.json", "file-001", 48_213),
  kind: "collector-json",
  identityPreview: { cloud: "aws", accountLast4: "3333", alias: sens("alias", "halfseen-prod", "alias-001") },
  asOf: AS,
  doors: ["mfa", "key", "net", "sto"],
  handle: HANDLE,
};
export const RECOG_OK_CSV: InputRecognition = {
  ...base("ok", "status_reports_2026-10-19.csv", "file-002", 2_406),
  kind: "csv-credential-report",
  identityPreview: { cloud: "aws", accountLast4: "3333", alias: null },
  asOf: { at: iso("2026-10-19T02:00:00Z"), source: "filename" },
  doors: ["mfa", "key"],
  handle: HANDLE,
};
export const RECOG_OK_PASTE: InputRecognition = { ...RECOG_OK_AWS, via: "paste", name: plain("paste-1"), bytes: 31_002 };

export const RECOG_EMPTY: InputRecognition = base("empty", "empty.json", "file-003", 0);
export const RECOG_WRONG_TYPE: InputRecognition = base("wrong-type", "notes.docx", "file-004", 18_220);
export const RECOG_PARSE_ERROR: InputRecognition = {
  ...base("parse-error", "cloudcheck-result-cut.json", "file-005", 1_048_576),
  detail: { line: n(1042), col: n(17), maybeTruncated: c("yes"), tail: v(sens("freeText", '"region":"ap-northeast-2","items":[{"gro', "•••")) },
};
export const RECOG_NOT_CLOUDCHECK: InputRecognition = { ...base("not-cloudcheck", "cloudcheck-exceptions.json", "file-006", 812), detail: { hint: c("exceptions-file") } };
export const RECOG_SCHEMA_MAJOR: InputRecognition = { ...base("schema-major", "cloudcheck-result-v2.json", "file-007", 50_120), kind: "collector-json", detail: { major: c("2") } };
export const RECOG_CREDENTIALS_FILE: InputRecognition = { ...base("credentials-file", "credentials", "file-008", 116), via: "paste", name: plain("paste-2") };
export const RECOG_TOO_LARGE: InputRecognition = base("too-large", "huge-export.json", "file-009", 27_262_976);
export const RECOG_TOO_DEEP: InputRecognition = base("too-deep", "nested.json", "file-010", 4_096);
export const RECOG_ACCOUNT_MISMATCH: InputRecognition = {
  ...base("account-mismatch", "cloudcheck-result-other.json", "file-011", 47_000),
  kind: "collector-json",
  identityPreview: { cloud: "aws", accountLast4: "9999", alias: sens("alias", "other-prod", "alias-002") },
  asOf: AS,
  doors: ["mfa", "key", "net", "sto", "log"],
};
export const RECOG_CLOUD_MISMATCH: InputRecognition = {
  ...base("cloud-mismatch", "cloudcheck-azure-result.json", "file-012", 22_310),
  kind: "collector-json",
  identityPreview: { cloud: "azure", accountLast4: "0000", alias: null },
  asOf: AS,
  doors: ["key", "net", "sto", "log"],
};
export const RECOG_SUPERSEDED: InputRecognition = {
  ...RECOG_OK_AWS,
  name: sens("fileName", "cloudcheck-result-old.json", "file-013"),
  status: "superseded",
  asOf: collectedAt("2026-10-12T03:00:00Z"),
  handle: null,
};

/** 상태 12종 + ok 변형 3개(V2 목록 렌더·실패 패널 개발용) */
export const MOCK_RECOGNITIONS: readonly InputRecognition[] = [
  RECOG_OK_AWS, RECOG_OK_CSV, RECOG_OK_PASTE, RECOG_EMPTY, RECOG_WRONG_TYPE, RECOG_PARSE_ERROR, RECOG_NOT_CLOUDCHECK, RECOG_SCHEMA_MAJOR,
  RECOG_CREDENTIALS_FILE, RECOG_TOO_LARGE, RECOG_TOO_DEEP, RECOG_ACCOUNT_MISMATCH, RECOG_CLOUD_MISMATCH, RECOG_SUPERSEDED,
];
