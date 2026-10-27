// src/lib/cloudcheck/qa/raw-mutations.ts — FO-01 원시 파일 '증거 제거' 변이 생성기(테스트가 아니다)
// 원칙: 증거를 줄이는 방향만(값을 '더 안전한 값'으로 바꾸는 변이는 넣지 않는다 — 그것은 사실 변경이라 단조성을 요구할 수 없다).
//  수집기 JSON: 영수증 실패(denied·error·throttled·unsupported, 그 영수증을 가리키는 값은 null) · 잘림(목록 영수증, 목록을 줄이고 count 맞춤)
//   · 필드 부재(ok + 값 null) · 리프 null · 키 삭제 · 열거 원소 삭제(리전·구독 항목, 대상 목록, 영수증) · 섹션 삭제 · 문 건너뜀
//  보고서 CSV: 열 삭제 · 칸 비우기 · 칸에 모르는 값 · 끝 행 중간에서 자르기 · 루트 행 삭제
import { clone, csvRows, csvText, deleteAt, FAIL_CODE, getAt, leafPaths, receiptRefs, sample, setAt } from "./kit";
import type { Json, Path } from "./kit";

export interface Mutation { readonly name: string; readonly apply: () => unknown }

const FAILS = ["denied", "error", "throttled", "unsupported"] as const;
const DOORS = ["mfa", "key", "net", "sto", "log"] as const;

/** 값(value) 또는 목록(items)을 담는 필드 이름 */
const holder = (o: Json): "value" | "items" | null => ("value" in o ? "value" : "items" in o ? "items" : null);

export function jsonMutations(base: Json, opts: { readonly leafSample: number; readonly seed: number }): Mutation[] {
  const out: Mutation[] = [];
  const refs = receiptRefs(base);
  const identityReceipt = base.identity?.receipt as string | undefined;
  const genReceipt = base.data?.credentialReport?.generateReceipt as string | undefined;

  /* 1) 영수증 단위 */
  for (const r of base.receipts as Json[]) {
    if (r.id === identityReceipt) continue;   // 신원 호출이 실패하면 수집기는 파일을 만들지 않는다
    const paths = refs.get(r.id) ?? [];
    const nullOut = (m: Json): void => {
      for (const p of paths) { const o = getAt(m, p); const h = holder(o); if (h !== null) o[h] = null; }
      if (r.id === genReceipt && m.data.credentialReport) m.data.credentialReport.value = null;
    };
    for (const kind of FAILS) {
      out.push({ name: `receipt ${r.id}(${r.call}) → ${kind}`, apply: () => {
        const m = clone(base);
        const rc = (m.receipts as Json[]).find((x) => x.id === r.id);
        rc.result = kind; rc.count = null; rc.errorCode = FAIL_CODE[kind];
        nullOut(m);
        return m;
      } });
    }
    out.push({ name: `receipt ${r.id}(${r.call}) → ok + 값 없음`, apply: () => {
      const m = clone(base);
      const rc = (m.receipts as Json[]).find((x) => x.id === r.id);
      rc.result = "ok"; rc.count = null; rc.errorCode = null;
      nullOut(m);
      return m;
    } });
    // 잘림: 이 영수증이 목록을 담고 있을 때만
    const listPath = paths.find((p) => { const o = getAt(base, p); const h = holder(o); return h !== null && Array.isArray(o[h]); });
    if (listPath !== undefined && (r.result === "ok" || r.result === "empty")) {
      out.push({ name: `receipt ${r.id}(${r.call}) → truncated`, apply: () => {
        const m = clone(base);
        const o = getAt(m, listPath);
        const h = holder(o) as "value" | "items";
        const list = o[h] as unknown[];
        const keep = Math.max(1, list.length - 1);
        o[h] = list.slice(0, keep);
        if (o.budget) o.budget = { ...o.budget, total: keep, collected: Math.min(o.budget.collected, keep) };
        const rc = (m.receipts as Json[]).find((x) => x.id === r.id);
        rc.result = "truncated"; rc.count = keep; rc.errorCode = null;
        return m;
      } });
    }
  }

  /* 2) 섹션 삭제 · 문 건너뜀 */
  for (const sec of Object.keys(base.data ?? {})) out.push({ name: `섹션 삭제 data.${sec}`, apply: () => { const m = clone(base); delete m.data[sec]; return m; } });
  for (const d of DOORS) if (base.run?.doors?.[d] === "collected") out.push({ name: `문 건너뜀 ${d}`, apply: () => { const m = clone(base); m.run.doors[d] = "skipped"; return m; } });

  /* 3) 열거 원소 삭제: 리전·구독 항목, 대상 목록 원소, 영수증 */
  const enumPaths: Path[] = [];
  for (const sec of ["securityGroups", "networkInterfaces", "storageAccounts", "nsgs", "nics", "publicIps", "activityLogExports", "iamGroups"]) {
    const arr = base.data?.[sec];
    if (Array.isArray(arr)) arr.forEach((e: Json, i: number) => {
      enumPaths.push(["data", sec, i]);
      if (Array.isArray(e?.items)) e.items.forEach((_: unknown, k: number) => enumPaths.push(["data", sec, i, "items", k]));
    });
  }
  for (const p of [["data", "iamUsers", "items"], ["data", "buckets", "items"], ["data", "iamRoles", "value"], ["data", "trails", "value"], ["scope", "regions", "value"], ["scope", "subscriptions", "value"]] as Path[]) {
    const arr = getAt(base, p);
    if (Array.isArray(arr)) arr.forEach((_: unknown, i: number) => enumPaths.push([...p, i]));
  }
  (base.receipts as Json[]).forEach((_, i) => enumPaths.push(["receipts", i]));
  for (const p of enumPaths) out.push({ name: `원소 삭제 ${p.join(".")}`, apply: () => { const m = clone(base); deleteAt(m, p); return m; } });

  /* 4) 리프 null · 키 삭제(시드 고정 표본) */
  const leaves = leafPaths(base).filter((p) => p.length > 0);
  for (const p of sample(leaves, opts.leafSample, opts.seed)) out.push({ name: `리프 null ${p.join(".")}`, apply: () => { const m = clone(base); setAt(m, p, null); return m; } });
  const keys = leaves.filter((p) => typeof p[p.length - 1] === "string");
  for (const p of sample(keys, opts.leafSample, opts.seed + 1)) out.push({ name: `키 삭제 ${p.join(".")}`, apply: () => { const m = clone(base); deleteAt(m, p); return m; } });
  return out;
}

export function csvMutations(text: string): Mutation[] {
  const rows = csvRows(text);
  const head = rows[0];
  const out: Mutation[] = [];
  head.forEach((col, ci) => out.push({ name: `열 삭제 ${col}`, apply: () => csvText(rows.map((r) => r.filter((_, k) => k !== ci))) }));
  for (let r = 1; r < rows.length; r++) {
    head.forEach((col, ci) => {
      for (const v of ["", "zzz"]) {
        if (rows[r][ci] === v) continue;
        out.push({ name: `칸 ${v === "" ? "비움" : "모르는 값"} ${rows[r][0]}.${col}`, apply: () => { const m = rows.map((x) => [...x]); m[r][ci] = v; return csvText(m); } });
      }
    });
  }
  const last = text.trimEnd();
  const cut = last.lastIndexOf("\n");
  out.push({ name: "끝 행 중간에서 자름", apply: () => last.slice(0, cut + 1 + Math.floor((last.length - cut - 1) / 2)) });
  const rootIdx = rows.findIndex((r) => r[0] === "<root_account>");
  if (rootIdx > 0) out.push({ name: "루트 행 삭제", apply: () => csvText(rows.filter((_, i) => i !== rootIdx)) });
  return out;
}
