// src/lib/cloudcheck/contract/normalized-invariants.ts — NormalizedInput 불변식 검사기(공용 헬퍼)
// normalized.test.ts에 있던 checkInvariants를 그대로 옮겼다(NORMALIZED.md §5: "공용 헬퍼로 옮길 때는 API설계자가 만들고 백엔드팀장이 확인").
// 쓰는 곳: ① contract/normalized.test.ts(두 리터럴) ② parse/ 테스트(buildInput 결과) ③ DB설계자의 micro 픽스처 테스트(원하면).
// 위반 메시지 배열을 돌려준다(빈 배열 = 위반 없음). 예외를 던지지 않는다. 테스트가 아닌 일반 모듈이라 vitest를 import하지 않는다.
import { DOORS } from "../model/report";
import { AWS_FAMILIES, AZURE_FAMILIES, familyDoor } from "./normalized";
import type { FamilyCoverage, FamilyId, NormalizedInput, Src } from "./normalized";

const CANON = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/* ───────── 불변식 검사기(buildInput 결과·micro 픽스처에도 그대로 쓸 수 있다) ───────── */
type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x) && !(x instanceof Map);
const isSrc = (o: Obj): boolean => typeof o.input === "number" && "receipt" in o && "csv" in o;
const isInstant = (o: Obj): boolean => "iso" in o && "ms" in o && Object.keys(o).length === 2;
const SLOT_KINDS: readonly unknown[] = ["value", "partial", "none", "missing"];
const RECEIPT_KEY_RE = /^\d+:r-\d{4,6}$/;

function walk(node: unknown, visit: (o: Obj, path: string) => void, path = "$"): void {
  if (Array.isArray(node)) { node.forEach((x, i) => walk(x, visit, `${path}[${i}]`)); return; }
  if (!isObj(node)) return;
  visit(node, path);
  for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
}

export function checkInvariants(input: NormalizedInput): string[] {
  const out: string[] = [];
  const n = input.inputs.length;
  input.inputs.forEach((f, i) => { if (f.index !== i) out.push(`inputs[${i}].index = ${f.index}`); });

  // 문 선택 ↔ 입력별 문 사용, 그리고 '룰은 자기 문의 입력만'
  for (const door of DOORS) {
    const sel = input.doors[door];
    const usedBy = input.inputs.filter((f) => f.doors[door] === "used").map((f) => f.index);
    if (sel.state === "selected") {
      if (usedBy.length !== 1 || usedBy[0] !== sel.input) out.push(`doors.${door}: selected ${sel.input} ↔ used [${usedBy.join(",")}]`);
      walk(sel.data, (o, p) => { if (isSrc(o) && o.input !== sel.input) out.push(`doors.${door}${p.slice(1)}: 다른 입력(${String(o.input)})의 출처`); });
    } else if (usedBy.length > 0) out.push(`doors.${door}: ${sel.state}인데 used 입력 [${usedBy.join(",")}]`);
    if (sel.state === "skipped" && (sel.inputs.length === 0 || sel.inputs.some((i) => input.inputs[i]?.doors[door] !== "skipped"))) out.push(`doors.${door}: skipped 입력 불일치`);
    if (sel.state === "absent" && input.inputs.some((f) => f.doors[door] === "skipped")) out.push(`doors.${door}: absent인데 skipped 입력 있음`);
  }

  // 봉인된 범위 표: 클라우드 패밀리 전부, 불변식, 문 선택과 같은 입력, 있는 영수증만
  const fams: readonly FamilyId[] = input.cloud === "aws" ? AWS_FAMILIES : AZURE_FAMILIES;
  const table = input.coverage as unknown as Record<string, FamilyCoverage | undefined>;
  if (Object.keys(table).sort().join() !== [...fams].sort().join()) out.push(`coverage 키 ≠ ${input.cloud} 패밀리 목록`);
  for (const f of fams) {
    const c = table[f];
    if (!c) continue;
    if (c.family !== f) out.push(`${f}: family = ${c.family}`);
    if (!Object.isFrozen(c) || !Object.isFrozen(c.gaps) || !Object.isFrozen(c.units)) out.push(`${f}: 봉인(freeze) 안 됨`);
    if (c.complete !== (c.gaps.length === 0) || c.complete !== (c.population !== null)) out.push(`${f}: complete·gaps·population 불일치`);
    if (c.complete && c.population !== c.present) out.push(`${f}: population ≠ present`);
    const sel = input.doors[familyDoor(f)];
    const want = sel.state === "selected" ? sel.input : null;
    if (c.input !== want) out.push(`${f}: input ${String(c.input)} ≠ 문 선택 ${String(want)}`);
    for (const k of [...c.receipts, ...c.units.map((u) => u.receipt)]) if (k !== null && !input.receipts.has(k)) out.push(`${f}: 없는 영수증 ${k}`);
  }

  // 영수증 색인
  for (const [k, r] of input.receipts) {
    if (k !== r.key || !RECEIPT_KEY_RE.test(k) || !k.startsWith(`${r.input}:`) || r.input >= n) out.push(`receipts ${k}: 키·입력 불일치`);
  }

  // 출처·슬롯·시각(신원 + 입력 + 문 + 영수증)
  walk([input.identity, input.inputs, input.doors, [...input.receipts.values()]], (o, p) => {
    if (isSrc(o)) {
      const src = o as unknown as Src;
      if (src.input < 0 || src.input >= n) out.push(`${p}: 입력 범위 밖(${src.input})`);
      if (src.receipt === null && src.csv === null) out.push(`${p}: 출처 없음`);
      if (src.receipt !== null) {
        const r = input.receipts.get(src.receipt);
        if (!r || r.input !== src.input) out.push(`${p}: 영수증 ${src.receipt} 없음 또는 입력 불일치`);
      }
      if (src.csv !== null) {
        const kind = input.inputs[src.input]?.kind;
        if (!(kind === src.csv.kind || (kind === "collector-json" && src.csv.kind === "csv-credential-report"))) out.push(`${p}: CSV 종류 ${src.csv.kind} ≠ 입력 ${String(kind)}`);
      }
    }
    if (SLOT_KINDS.includes(o.k) && o.k !== "missing" && !isObj(o.src)) out.push(`${p}: ${String(o.k)} 슬롯에 출처 없음`);
    if (isInstant(o)) {
      const m = CANON.exec(String(o.iso));
      if (!m) out.push(`${p}: 시각 정규형 아님(${String(o.iso)})`);
      else {
        const [y, mo, d, h, mi, s] = m.slice(1).map(Number);
        if (o.ms !== Date.UTC(y, mo - 1, d, h, mi, s)) out.push(`${p}: ms ≠ iso`);
      }
    }
  });
  return out;
}
