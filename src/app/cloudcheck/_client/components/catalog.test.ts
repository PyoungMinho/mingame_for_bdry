// C 카탈로그(i18n/ko/components.ts) 점검 — 디자인 최종안 §8-2 반영(변경·추가·삭제), 키 수, 금지어, 컴포넌트 사용처, s-keys.ts의 S 키 형식.
// (키 형식·파일 경계·중복·상수 숫자 일치는 i18n/index.test.ts가 이미 C·S 전체에 건다. 여기서는 C를 소유자 관점에서 한 번 더 못 박는다.)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { findBanned } from "../../../../lib/cloudcheck/model/banned-words";
import { C_SEGMENTS, catalogEntries, fileOfKey, KEY_RE } from "../i18n/index";
import { allSKeys } from "./s-keys";

const entries = catalogEntries("components");
const keys = entries.map(([k]) => k);
const value = (k: string): string | undefined => entries.find(([key]) => key === k)?.[1];
const HERE = __dirname;

describe("C 카탈로그 — 디자인 최종안 §8-2", () => {
  it("키 수: 380(= UX 319 + 추가 68 − 삭제 7) + 컴포넌트개발자 추가 2(cc.c.dist.lead · cc.c.rule.evidence.count) + 프론트팀장 D4 통합 추가 2(cc.c.dsec.collect.partial-bare · none-bare) + STEP 5 QA 추가 3(cc.c.rule.coverage.unproven · cc.c.rule.tail-scope · cc.boot.download-note)", () => {
    expect(keys).toHaveLength(387);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("삭제 7키가 없다(띠 5 · placeholder-aria · irreversible)", () => {
    for (const k of ["cc.band.beta", "cc.band.beta-short", "cc.band.demo", "cc.band.demo-short", "cc.band.expand-aria", "cc.c.cli.placeholder-aria", "cc.c.cli.irreversible"]) {
      expect(value(k), k).toBeUndefined();
    }
  });

  it("변경 5키가 최종 문구다", () => {
    expect(value("cc.label.exception-active")).toBe("예외 표시(상태는 그대로) · {reason} · {until}까지");
    expect(value("cc.label.exception-expired")).toBe("예외 표시 만료되어 해제됨 · 만료일 {until}");
    expect(value("cc.label.self-answer")).toBe("본인 응답: {answer}(검증 안 됨) · 상태는 확인 불가 유지");
    expect(value("cc.c.scope.perm.denied-line")).toBe("{call} · {scope} — {errorCode} ({times}회, 점검 {rules}개에 영향)");
    expect(value("cc.c.exc.summary")).toBe("예외 {active}건 적용 · 만료되어 해제 {expired}건 · 대상 없음 {unmatched}건");
  });

  it("띠 3키 구조(태그·줄·보조) × 베타·체험, 프론트팀장이 미리 넣은 9키가 남아 있다", () => {
    for (const kind of ["beta", "demo"]) for (const part of ["tag", "row", "more"]) expect(value(`cc.band.${kind}.${part}`), `${kind}.${part}`).toBeTruthy();
    for (const k of ["cc.band.aria", "cc.band.beta.tag", "cc.band.beta.row", "cc.band.beta.more", "cc.hdr.home", "cc.promise.line", "cc.boot.failed", "cc.boot.noscript", "cc.boot.download"]) {
      expect(value(k), k).toBeTruthy();
    }
  });

  it("대상 종류 17종(ResourceType)이 모두 있다", () => {
    const types = ["aws-account", "root", "iam-user", "access-key", "iam-role", "region", "security-group", "eni", "s3-bucket", "trail", "entra-tenant", "entra-user", "subscription", "storage-account", "blob-container", "nsg", "nic"];
    expect(types.filter((t) => value(`cc.c.rtype.${t}`) === undefined)).toEqual([]);
  });

  it("호출 카탈로그 단위 9종 · 영수증 결과 8종 · 인식 종류 5종 · 본인 응답 3종 · 상태 5종 · 문 5종 문구가 있다", () => {
    const need = [
      ...["account", "region", "user", "group", "bucket", "trail", "subscription", "storage-account", "local"].map((u) => `cc.c.fp.unit.${u}`),
      ...["ok", "empty", "notconfigured", "denied", "error", "throttled", "truncated", "unsupported"].map((r) => `cc.c.scope.receipt.${r}`),
      ...["collector-json", "csv-credential-report", "csv-rg-storage", "csv-rg-nsg", "csv-entra-registration"].map((k) => `cc.c.rlist.kind.${k}`),
      ...["yes", "no", "unknown"].map((a) => `cc.c.self.${a}`),
      ...["risk", "caution", "clear", "unknown", "na"].flatMap((s) => [`cc.status.${s}`, `cc.status.desc.${s}`]),
      ...["mfa", "key", "net", "sto", "log"].flatMap((d) => [`cc.door.${d}.name`, `cc.door.${d}.term`]),
    ];
    expect(need.filter((k) => value(k) === undefined)).toEqual([]);
  });

  it("모든 키는 C 네임스페이스(첫 세그먼트)이고 형식이 맞다", () => {
    for (const k of keys) {
      expect(KEY_RE.test(k), k).toBe(true);
      expect(fileOfKey(k), k).toBe("components");
      expect((C_SEGMENTS as readonly string[]).includes(k.split(".")[1] ?? ""), k).toBe(true);
    }
  });

  it("금지어 0 — findBanned 하나로 C 전체(키 단위 허용은 cc.disclaimer.body뿐)", () => {
    const hits = entries.filter(([k]) => k !== "cc.disclaimer.body").flatMap(([k, v]) => findBanned(v).map((h) => `${k}: ${h.label} '${h.match}'`));
    expect(hits).toEqual([]);
    const disclaimerLabels = new Set(findBanned(value("cc.disclaimer.body") ?? "").map((h) => h.label));
    for (const l of disclaimerLabels) expect(["인증·보증·보장", "적합·준수"]).toContain(l);
  });

  it("시간 약속(숫자 + 분/초)·퍼센트가 없다(Q2) — 상수 문구(25MB·20MB·90일)만 숫자를 가진다", () => {
    for (const [k, v] of entries) {
      expect(/\d+\s?(분|초)/.test(v), k).toBe(false);
      expect(v.includes("%"), k).toBe(false);
    }
  });
});

describe("C 카탈로그 — 사용처", () => {
  /** 컴포넌트 소스에서 cc.* 문자열/템플릿 리터럴을 모은다 */
  function referenced(): { lits: Set<string>; pats: RegExp[] } {
    const lits = new Set<string>();
    const pats: RegExp[] = [];
    for (const f of readdirSync(HERE).filter((x) => /\.(tsx?)$/.test(x) && !/\.test\.|\.typetest\./.test(x))) {
      const text = readFileSync(path.join(HERE, f), "utf8");
      const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const visit = (n: ts.Node): void => {
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.startsWith("cc.")) lits.add(n.text);
        if (ts.isTemplateExpression(n)) {
          let s = n.head.text;
          for (const sp of n.templateSpans) s += `\u0000${sp.literal.text}`;
          if (s.startsWith("cc.")) pats.push(new RegExp(`^${s.split("\u0000").map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[a-z0-9.-]+")}$`));
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
    return { lits, pats };
  }

  /** 컴포넌트가 그리지 않는 C 키: 이유를 적는다(새 키가 사용처 없이 늘어나는 것을 막는다) */
  const NOT_DRAWN_HERE: Readonly<Record<string, string>> = {
    "cc.boot.failed": "정적 셸(_build/template.mjs)이 빌드 때 가져다 쓴다",
    "cc.boot.noscript": "정적 셸 <noscript>",
    "cc.boot.download": "정적 셸 부팅 대체 안내 링크",
    "cc.boot.download-note": "정적 셸 부팅 대체 안내·<noscript>의 링크 아래 줄(file:// 오프라인판 — STEP 5 QA CC-QA-22)",
    "cc.label.exception-unmatched": "대상 없음은 예외 요약 접힘(cc.c.exc.unmatched-line)이 대신한다",
    "cc.c.rlist.remove-aria": "R1: 이름이 든 aria-label은 쓰지 않는다 — [빼기]는 aria-labelledby(버튼 글자 + 파일 이름)",
    "cc.c.path.selected-aria": "네이티브 라디오의 checked 상태가 낭독한다",
    "cc.c.dist.heading": "D5 제목(h2)은 페이지가 그린다",
    "cc.c.dist.unresolved": "D5 '아직 판단하지 못한 점검' 줄은 페이지가 UnknownTone으로 그린다",
    "cc.c.dist.unresolved-cta": "같은 줄의 [직접 볼 목록으로 이동] 버튼(페이지)",
    "cc.c.rule.expand-aria": "점검 행 토글의 접근 이름은 배지 글자 + 제목이 만든다",
    "cc.c.disclosure.open": "V7·V8 <details> 요약(페이지)이 쓰는 공용 글자",
    "cc.c.disclosure.close": "V7·V8 <details> 요약(페이지)이 쓰는 공용 글자",
  };

  it("모든 C 키는 컴포넌트가 그리거나, 그리지 않는 이유가 위 표에 적혀 있다", () => {
    const { lits, pats } = referenced();
    const orphans = keys.filter((k) => !lits.has(k) && !pats.some((p) => p.test(k)) && NOT_DRAWN_HERE[k] === undefined);
    expect(orphans).toEqual([]);
  });

  it("'그리지 않는다'고 적은 키가 실제로는 쓰이고 있지 않다(표가 낡지 않게)", () => {
    const { lits, pats } = referenced();
    const stale = Object.keys(NOT_DRAWN_HERE).filter((k) => lits.has(k) || pats.some((p) => p.test(k)));
    expect(stale).toEqual([]);
  });
});

describe("s-keys.ts — 컴포넌트가 그리는 S(화면) 키", () => {
  it("전부 형식이 맞고 S 네임스페이스다(C·E 키가 섞이지 않는다)", () => {
    const s = allSKeys();
    expect(s.length).toBeGreaterThan(40);
    for (const k of s) {
      expect(KEY_RE.test(k), k).toBe(true);
      expect(fileOfKey(k), k).toBe("screens");
    }
  });
  it("S 키 이름은 UX 카피 덱(§7-3)에 있는 이름뿐 — 카피 덱 원문과 대조한다", () => {
    const ux = path.join(HERE, "../../../../../docs/design/cloudcheck-ux-spec.md");
    if (!existsSync(ux)) return; // 문서가 없는 환경(배포 번들 검사 등)에서는 건너뛴다
    const deck = new Set([...readFileSync(ux, "utf8").matchAll(/^\| (cc\.[a-z0-9.-]+) \| S \|/gm)].map((m) => m[1]));
    expect(allSKeys().filter((k) => !deck.has(k))).toEqual([]);
  });
});
