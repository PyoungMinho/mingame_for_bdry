// src/lib/cloudcheck/rules/rule-schema.ts — 룰 정적 데이터의 zod 스키마 (registry.test.ts가 18장 전부에 적용한다)
// 강제하는 것: 키 형식(코디네이터 규약: cc.<reason|banner|time|recog|fact|gcs|rule|ph|basis|incident>.…) · 근거 링크 허용 도메인 ·
//             쓰기 명령의 자리표시자 ≥ 1 · lastVerified 날짜 · 6케이스 픽스처 선언(성립하지 않는 케이스는 이유를 적는다) ·
//             가이드 룰의 고정 규칙 · 사유/사실 코드 slug 형식.
import { z } from "zod";
import { DOORS, RULE_IDS } from "../model/report";
import { AWS_CALL_IDS, AZURE_CALL_IDS } from "../contract/calls";

/** 근거·고치는 법 링크가 허용되는 호스트(방향서 §6: 룰 근거는 클라우드 사업자 공식 문서만) */
export const RULE_DOC_HOSTS = ["docs.aws.amazon.com", "aws.amazon.com", "learn.microsoft.com"] as const;
/** E 카탈로그(rules/i18n/ko.ts)가 쓸 수 있는 키의 첫 세그먼트(프론트 i18n의 E 네임스페이스) */
export const E_NAMESPACES = ["reason", "banner", "time", "recog", "fact", "gcs", "rule", "ph", "basis", "incident"] as const;
/** 카탈로그 키 형식: 'cc' + 점으로 구분된 소문자·숫자·하이픈 마디 2개 이상 */
export const KEY_RE = /^cc(?:\.[a-z0-9]+(?:-[a-z0-9]+)*){2,}$/;

export const CatalogKeyZ = z.string().regex(KEY_RE).refine((k) => (E_NAMESPACES as readonly string[]).includes(k.split(".")[1]), "E 네임스페이스 밖의 키");
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const ParamName = z.string().regex(/^[a-z][a-z0-9]*$/);

const Link = z.object({ href: z.string().url(), host: z.string() }).strict().superRefine((l, ctx) => {
  let host = "";
  try { const u = new URL(l.href); host = u.hostname; if (u.protocol !== "https:") ctx.addIssue({ code: "custom", message: "https만" }); } catch { ctx.addIssue({ code: "custom", message: "URL 아님" }); }
  if (!(RULE_DOC_HOSTS as readonly string[]).includes(host)) ctx.addIssue({ code: "custom", message: `근거 링크 도메인 허용 목록 밖: ${host}` });
  if (host !== l.host) ctx.addIssue({ code: "custom", message: "host 필드가 href와 다름" });
});

const Segment = z.union([
  z.object({ t: z.literal("text"), v: z.string().min(1) }).strict(),
  z.object({ t: z.literal("ph"), key: CatalogKeyZ.refine((k) => k.startsWith("cc.ph."), "자리표시자 키는 cc.ph.*") }).strict(),
]);
const Cli = (kind: "read" | "write") => z.object({ kind: z.literal(kind), shell: z.enum(["aws", "az"]), segments: z.array(Segment).min(1) }).strict().superRefine((c, ctx) => {
  const phs = c.segments.filter((s) => s.t === "ph").length;
  if (kind === "write" && phs < 1) ctx.addIssue({ code: "custom", message: "쓰기 명령에는 자리표시자가 1개 이상 있어야 한다(R-11)" });
  const first = c.segments[0];
  if (first.t !== "text" || !first.v.startsWith(c.shell === "aws" ? "aws " : "az ")) ctx.addIssue({ code: "custom", message: "명령은 셸 이름으로 시작해야 한다" });
});

const Fix = z.object({
  impact: z.enum(["low", "medium", "high"]), prodImpact: z.boolean(),
  observe: z.object({ textKey: CatalogKeyZ, doc: Link.nullable(), commands: z.array(Cli("read")) }).strict(),
  change: z.object({ textKey: CatalogKeyZ, property: z.string().min(1), doc: Link, commands: z.array(Cli("write")) }).strict(),
  revert: z.object({ textKey: CatalogKeyZ, commands: z.array(Cli("write")) }).strict(),
  runbook: Link.nullable(),
}).strict();

const Na = z.object({ na: z.string().min(8) }).strict();      // 해당 케이스가 성립하지 않는 이유를 반드시 적는다
const FixtureRef = z.string().regex(/^micro\/[A-Za-z0-9-]+\/[a-z0-9-]+$/);
const Expect = z.enum(["unknown", "caution", "risk"]);
const CallZ = z.enum([...AWS_CALL_IDS, ...AZURE_CALL_IDS] as [string, ...string[]]);

const Fixtures = z.object({
  pass: z.union([FixtureRef, Na]),
  violate: z.union([z.array(FixtureRef).min(1), Na]),
  denied: z.union([z.object({ call: CallZ, resource: z.string().optional(), region: z.string().optional(), expect: Expect }).strict(), Na]),
  truncated: z.union([z.object({ call: CallZ, expect: Expect }).strict(), Na]),
  missingField: z.union([z.object({ path: z.string().regex(/^doors\.(mfa|key|net|sto|log)\.data\.[A-Za-z0-9_.[\]]+$/), expect: Expect }).strict(), Na]),
  versionMismatch: z.literal("auto"),
}).strict();

const ParamView = z.object({
  key: CatalogKeyZ, value: z.union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))]), basis: z.enum(["public-standard", "tool-default"]),
}).strict();

const Family = z.string().regex(/^(aws|azure)\.(mfa|key|net|sto|log)\.[a-z]+(-[a-z]+)*$/);

export const RuleSpecSchema = z.object({
  ruleId: z.enum(RULE_IDS), cloud: z.enum(["aws", "azure"]), door: z.enum(DOORS), kind: z.enum(["auto", "guide", "conditional"]),
  released: z.boolean(),
  titleKey: CatalogKeyZ, summaryKey: CatalogKeyZ,
  maxStatus: z.enum(["risk", "caution", "unknown"]), allowsClear: z.boolean(), priority: z.number().int().min(1).max(999),
  conditionKeys: z.record(z.enum(["risk", "caution", "clear", "unknown", "na"]), CatalogKeyZ),
  impactKey: CatalogKeyZ.nullable(), questionKey: CatalogKeyZ.nullable(),
  paths: z.array(z.enum(["csv", "collector", "portal-csv", "guide"])).min(1),
  permissions: z.array(z.string()),
  params: z.array(ParamView),
  cannotSee: z.array(CatalogKeyZ).min(1),
  falsePositiveKeys: z.array(CatalogKeyZ),
  fix: Fix.nullable(),
  guide: z.object({ steps: z.array(z.object({ id: Slug, textKey: CatalogKeyZ, doc: Link.nullable() }).strict()).min(1) }).strict().nullable(),
  basis: z.array(z.object({ titleKey: CatalogKeyZ, link: Link, kind: z.enum(["doc", "benchmark", "regulator", "incident", "advisory"]) }).strict()).min(1),
  incident: z.object({ titleKey: CatalogKeyZ, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), link: z.object({ href: z.string().url(), host: z.string() }).strict(), sourceName: z.string().min(1) }).strict().nullable(),
  lastVerified: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/),
  asOfBasis: z.enum(["door", "credential-report"]),
  families: z.object({ item: Family, needs: z.array(Family) }).strict().nullable(),
  calls: z.array(CallZ),
  isolatedDenial: z.object({ calls: z.array(CallZ).min(1) }).strict().nullable(),
  reasons: z.record(Slug, z.array(ParamName)),
  facts: z.record(Slug, z.array(ParamName)),
  manualHowKey: CatalogKeyZ.nullable(),
  autoNotice: z.object({ what: z.string().regex(/^fact:[a-z0-9-]+$/), howKey: CatalogKeyZ }).strict().nullable(),
  fixtures: Fixtures,
}).strict().superRefine((r, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: "custom", message });
  if ((r.cloud === "aws") !== r.ruleId.startsWith("AWS-")) bad("ruleId 접두와 cloud 불일치");
  if (r.kind === "guide") {
    if (r.maxStatus !== "unknown" || r.allowsClear || r.families !== null || r.guide === null) bad("가이드 룰은 확인 불가 고정·이상 없음 없음·패밀리 없음·가이드 카드 필수");
  } else {
    if (r.families === null) bad("자동 룰은 패밀리 선언 필수");
    if (r.guide !== null) bad("가이드 카드는 가이드 룰만");
    if (r.released && typeof r.fixtures.pass !== "string") bad("출시 룰은 통과 픽스처 필수");
    if (r.released && !Array.isArray(r.fixtures.violate) && r.maxStatus !== "unknown") bad("위험·주의를 낼 수 있는 룰은 위반 픽스처 필수");
  }
  if (r.maxStatus === "unknown" && r.allowsClear) bad("확인 불가 고정 룰은 이상 없음을 줄 수 없다");
  if (r.families !== null && r.families.item.split(".")[1] !== r.door) bad("아이템 패밀리가 룰의 문과 다르다");
  if (r.families !== null && r.families.needs.some((f) => f.split(".")[1] !== r.door || !f.startsWith(r.cloud === "aws" ? "aws." : "azure."))) bad("필요한 패밀리가 룰의 문·클라우드와 다르다");
  if (r.kind !== "guide" && r.released && r.fix === null && r.maxStatus !== "unknown") bad("위험·주의를 낼 수 있는 출시 룰은 고치는 법 3단계가 있어야 한다");
  if (!r.released && r.kind === "auto") bad("자동 룰은 released: true");
  if (r.basis.every((b) => b.kind === "incident")) bad("근거에 사례만 있다");
});
export type RuleSpecInput = z.input<typeof RuleSpecSchema>;
