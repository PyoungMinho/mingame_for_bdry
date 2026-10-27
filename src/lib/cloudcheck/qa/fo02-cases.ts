// src/lib/cloudcheck/qa/fo02-cases.ts — FO-02 변이 생성·실행(테스트가 아니다). fo-unexpected-values.test.ts와 레포 밖 요약 스크립트가 함께 쓴다.
// 설계서 §4-1 FO-02 '열거형 필드 목록'의 값마다 ① 앞뒤 공백 ② 빈 문자열 ③ 모르는 토큰 ④ 숫자 -1·65536·from/to 맞바꿈 ⑤ 수집 시각 + 2년을 넣는다.
import { clone, companyCsv, companyJson, csvRows, csvText, getAt, monotoneViolations, okReport, pathsMatching, runCsv, runJson, setAt, SETS } from "./kit";
import type { CloudId, Path } from "./kit";

/** 필드 패턴 · 이름(버그 분류 키) · 변조 값 */
export interface Field { readonly cloud: CloudId; readonly name: string; readonly pattern: Path; readonly kind: "str" | "num" | "time" }
const S = "*";
export const FIELDS: readonly Field[] = [
  // AWS
  { cloud: "aws", name: "sg.ingress.protocol", pattern: ["data", "securityGroups", S, "items", S, "ingress", S, "protocol"], kind: "str" },
  { cloud: "aws", name: "sg.ingress.fromPort", pattern: ["data", "securityGroups", S, "items", S, "ingress", S, "fromPort"], kind: "num" },
  { cloud: "aws", name: "sg.ingress.toPort", pattern: ["data", "securityGroups", S, "items", S, "ingress", S, "toPort"], kind: "num" },
  { cloud: "aws", name: "sg.ingress.cidrs", pattern: ["data", "securityGroups", S, "items", S, "ingress", S, "cidrs", S], kind: "str" },
  { cloud: "aws", name: "sg.ingress.ipv6Cidrs", pattern: ["data", "securityGroups", S, "items", S, "ingress", S, "ipv6Cidrs", S], kind: "str" },
  { cloud: "aws", name: "eni.groupIds", pattern: ["data", "networkInterfaces", S, "items", S, "groupIds", S], kind: "str" },
  { cloud: "aws", name: "role.trust.effect", pattern: ["data", "iamRoles", "value", S, "trust", S, "effect"], kind: "str" },
  { cloud: "aws", name: "role.trust.actions", pattern: ["data", "iamRoles", "value", S, "trust", S, "actions", S], kind: "str" },
  { cloud: "aws", name: "role.trust.principal.aws", pattern: ["data", "iamRoles", "value", S, "trust", S, "principal", "aws", S], kind: "str" },
  { cloud: "aws", name: "role.trust.conditionKeys", pattern: ["data", "iamRoles", "value", S, "trust", S, "conditionKeys", S], kind: "str" },
  { cloud: "aws", name: "role.path", pattern: ["data", "iamRoles", "value", S, "path"], kind: "str" },
  { cloud: "aws", name: "bucket.acl.grantee", pattern: ["data", "buckets", "items", S, "acl", "value", "publicGrants", S, "grantee"], kind: "str" },
  { cloud: "aws", name: "bucket.ownership", pattern: ["data", "buckets", "items", S, "ownership", "value", "objectOwnership"], kind: "str" },
  { cloud: "aws", name: "trail.basic.readWriteType", pattern: ["data", "trails", "value", S, "selectors", "value", "basic", S, "readWriteType"], kind: "str" },
  { cloud: "aws", name: "trail.advanced.field", pattern: ["data", "trails", "value", S, "selectors", "value", "advanced", S, "fields", S, "field"], kind: "str" },
  { cloud: "aws", name: "trail.advanced.equals", pattern: ["data", "trails", "value", S, "selectors", "value", "advanced", S, "fields", S, "equals", S], kind: "str" },
  { cloud: "aws", name: "user.accessKeys.status", pattern: ["data", "iamUsers", "items", S, "accessKeys", "value", S, "status"], kind: "str" },
  { cloud: "aws", name: "time.accessKey.createDate", pattern: ["data", "iamUsers", "items", S, "accessKeys", "value", S, "createDate"], kind: "time" },
  { cloud: "aws", name: "time.user.createDate", pattern: ["data", "iamUsers", "items", S, "createDate"], kind: "time" },
  { cloud: "aws", name: "time.user.passwordLastUsed", pattern: ["data", "iamUsers", "items", S, "passwordLastUsed"], kind: "time" },
  // Azure
  { cloud: "azure", name: "container.publicAccess", pattern: ["data", "storageAccounts", S, "items", S, "containers", "value", S, "publicAccess"], kind: "str" },
  { cloud: "azure", name: "blobDiag.category", pattern: ["data", "storageAccounts", S, "items", S, "blobDiagnostics", "value", S, "logs", S, "category"], kind: "str" },
  { cloud: "azure", name: "blobDiag.categoryGroup", pattern: ["data", "storageAccounts", S, "items", S, "blobDiagnostics", "value", S, "logs", S, "categoryGroup"], kind: "str" },
  { cloud: "azure", name: "activityLog.category", pattern: ["data", "activityLogExports", S, "items", S, "logs", S, "category"], kind: "str" },
  { cloud: "azure", name: "activityLog.categoryGroup", pattern: ["data", "activityLogExports", S, "items", S, "logs", S, "categoryGroup"], kind: "str" },
  { cloud: "azure", name: "nsg.rule.direction", pattern: ["data", "nsgs", S, "items", S, "rules", S, "direction"], kind: "str" },
  { cloud: "azure", name: "nsg.rule.access", pattern: ["data", "nsgs", S, "items", S, "rules", S, "access"], kind: "str" },
  { cloud: "azure", name: "nsg.rule.protocol", pattern: ["data", "nsgs", S, "items", S, "rules", S, "protocol"], kind: "str" },
  { cloud: "azure", name: "nsg.rule.priority", pattern: ["data", "nsgs", S, "items", S, "rules", S, "priority"], kind: "num" },
  { cloud: "azure", name: "nsg.rule.sourcePrefixes", pattern: ["data", "nsgs", S, "items", S, "rules", S, "sourcePrefixes", S], kind: "str" },
  { cloud: "azure", name: "nsg.rule.destPortRanges", pattern: ["data", "nsgs", S, "items", S, "rules", S, "destPortRanges", S], kind: "str" },
  { cloud: "azure", name: "time.storage.keyCreation", pattern: ["data", "storageAccounts", S, "items", S, "keyCreationTime", S], kind: "time" },
];
/** 수집 시각 + 2년(미래 시각) */
const FUTURE = "2028-10-19T03:15:00+00:00";
const strVariants = (v: string): string[] => [`${v} `, ` ${v}`, "", "zzz", "Allowed", "Inbound "];
const numVariants = (): number[] => [-1, 65536];

export interface Viol { readonly field: string; readonly where: string; readonly msg: string }

/** 수집기 JSON 변이 전수 */
export function jsonViolations(): { viols: Viol[]; runs: number; accepted: number; fields: Set<string> } {
  const viols: Viol[] = [];
  const fields = new Set<string>();
  let runs = 0, accepted = 0;
  for (const cloud of ["aws", "azure"] as const) {
    for (const set of SETS) {
      const base = companyJson(cloud, set);
      const before = okReport(runJson(base), `${cloud}-${set}`);
      for (const f of FIELDS.filter((x) => x.cloud === cloud)) {
        for (const p of pathsMatching(base, f.pattern)) {
          const old = getAt(base, p);
          const variants: unknown[] = f.kind === "num" ? numVariants() : f.kind === "time" ? (old === null ? [] : [FUTURE]) : typeof old === "string" ? strVariants(old) : [];
          // from/to 맞바꿈(포트 범위가 거꾸로)
          if (f.name === "sg.ingress.fromPort") {
            const rule = getAt(base, p.slice(0, -1));
            if (typeof rule.fromPort === "number" && typeof rule.toPort === "number" && rule.fromPort !== rule.toPort) variants.push("swap");
            if (typeof rule.fromPort === "number" && rule.fromPort === rule.toPort) variants.push("swap+3389");
          }
          for (const v of variants) {
            const m = clone(base);
            if (v === "swap") { const r = getAt(m, p.slice(0, -1)); [r.fromPort, r.toPort] = [r.toPort, r.fromPort]; }
            else if (v === "swap+3389") { const r = getAt(m, p.slice(0, -1)); r.fromPort = 3389; }
            else setAt(m, p, v);
            runs++;
            const res = runJson(m);
            if (res.kind !== "ok") continue;
            accepted++;
            fields.add(f.name);
            for (const msg of monotoneViolations(before, res.report)) viols.push({ field: f.name, where: `${cloud}-${set} ${p.join(".")}=${JSON.stringify(v)}`, msg });
          }
        }
      }
    }
  }
  return { viols, runs, accepted, fields };
}

/** 보고서 CSV 칸 변이: 불리언 칸 · 날짜 칸 */
const BOOL_COLS = ["password_enabled", "mfa_active", "access_key_1_active", "access_key_2_active"];
const DATE_COLS = ["user_creation_time", "password_last_used", "access_key_1_last_rotated", "access_key_1_last_used_date", "access_key_2_last_rotated", "access_key_2_last_used_date"];
/** 같은 뜻의 표기 변형(대소문자·앞 공백)과 모르는 토큰. TRUE↔FALSE 뒤집기는 값 변경이라 넣지 않는다 */
const boolVariants = (v: string): string[] => {
  const t = v.trim().toLowerCase();
  const same = t === "true" ? ["True", " TRUE"] : t === "false" ? ["False", " FALSE"] : [];
  return [...same, "yes", "1", "not_supported", "", "zzz"];
};
export function csvViolations(): { viols: Viol[]; runs: number; accepted: number; fields: Set<string> } {
  const viols: Viol[] = [];
  const fields = new Set<string>();
  let runs = 0, accepted = 0;
  for (const set of SETS) {
    const text = companyCsv(set);
    const before = okReport(runCsv(text), `csv-${set}`);
    const rows = csvRows(text);
    const head = rows[0];
    for (let r = 1; r < rows.length; r++) {
      const cols: [string, string[]][] = [
        ...BOOL_COLS.map((c): [string, string[]] => [c, boolVariants(rows[r][head.indexOf(c)] ?? "")]),
        ...DATE_COLS.map((c): [string, string[]] => [c, /^\d{4}-/.test(rows[r][head.indexOf(c)] ?? "") ? ["2028-10-19T03:15:00+00:00", ""] : []]),
      ];
      for (const [c, vs] of cols) {
        const ci = head.indexOf(c);
        if (ci < 0) continue;
        for (const v of vs) {
          if (v === rows[r][ci]) continue;
          const m = rows.map((x) => [...x]);
          m[r][ci] = v;
          runs++;
          const res = runCsv(csvText(m));
          if (res.kind !== "ok") continue;
          accepted++;
          const field = DATE_COLS.includes(c) && v.startsWith("2028") ? "time.csv" : `csv.${c}`;
          fields.add(field);
          for (const msg of monotoneViolations(before, res.report)) viols.push({ field, where: `csv-${set} row ${r + 1} ${c}=${JSON.stringify(v)}`, msg });
        }
      }
    }
  }
  return { viols, runs, accepted, fields };
}

