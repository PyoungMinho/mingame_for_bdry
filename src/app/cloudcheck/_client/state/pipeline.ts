// src/app/cloudcheck/_client/state/pipeline.ts — 파일 → 크기 상한 → 인식 → (목록) → buildInput → judge 의 흐름. 소유: 페이지개발자.
// 근거: 디자인 최종안 §6-0 pipeline 행, UX §6-5(읽기 순서), 방향서 §4-5 ① · §5-3.
//  - UI는 NormalizedInput·ParsedHandle을 열어 보지 않는다. buildInput 결과를 보관했다가 judge·maskedCopy에 그대로 넘긴다.
//  - 크기 상한(LIMITS)은 UI가 file.size로 먼저 본다 → 넘으면 읽지 않고 too-large 행을 직접 만든다(25MB 문자열을 메모리에 올리지 않는다).
//  - 체험: 데이터 블록의 JSON → recognize({ via: "demo", … }) → 실제 점검과 같은 길(Report.mode가 demo가 된다).
//  - 이 파일은 React를 모른다(순수 함수 + Promise). 화면 상태는 controller가 맡는다.
import { LIMITS } from "../../../../lib/cloudcheck/contract/collect-schema";
import { demoInputName } from "../../../../lib/cloudcheck/contract/normalized";
import type { NormalizedInput } from "../../../../lib/cloudcheck/contract/normalized";
import type { Cloud, DemoSetId, DisplayValue, InputKind, InputRecognition, InputVia, Report } from "../../../../lib/cloudcheck/model/report";
import { canCollect, type Availability } from "../config";
import { readDemoText } from "../shell";
import type { EngineDeps } from "./deps";

/** 파일 종류별 크기 상한: .csv는 CSV 상한, 그 밖은 JSON 상한(방향서 §4-5 ①) */
export function sizeLimitFor(name: string): number {
  return name.toLowerCase().endsWith(".csv") ? LIMITS.csvBytes : LIMITS.jsonBytes;
}

/** UI가 직접 만드는 행의 파일 이름 값(사용자 데이터 → sensitive fileName, 가린 모양은 file-<순번>) */
export function fileNameValue(name: string, index: number): DisplayValue {
  return { kind: "sensitive", type: "fileName", full: name, masked: `file-${String(index).padStart(3, "0")}`, flags: [] };
}

/** 붙여넣기 행의 이름(사용자 데이터가 아니다 — 목록은 via로 '붙여넣은 내용 n'을 그린다) */
export const pasteName = (n: number): string => `paste-${n}`;

/** 크기 상한을 넘어 읽지 않은 입력의 인식 결과 */
export function tooLargeRecognition(via: InputVia, name: DisplayValue, bytes: number): InputRecognition {
  return { via, name, bytes, status: "too-large", kind: null, detail: null, identityPreview: null, asOf: null, doors: [], handle: null };
}

/**
 * 화면 갱신이 두 번 일어난 뒤에 이어 간다('읽는 중'을 먼저 그린 뒤 파싱을 시작 — UX §6-5).
 * requestAnimationFrame은 백그라운드 탭·일부 환경에서 멈출 수 있어 타이머와 경주시킨다(어느 쪽이든 먼저 오면 다음으로) — 읽기가 영영 시작되지 않는 일이 없게.
 */
export function nextFrames(n = 2): Promise<void> {
  const once = (): Promise<void> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        resolve();
      };
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(finish);
      setTimeout(finish, 80);
    });
  let chain: Promise<void> = Promise.resolve();
  for (let i = 0; i < n; i += 1) chain = chain.then(once);
  return chain;
}

/** 파일 바이트. Blob.arrayBuffer가 없으면 FileReader. 읽기에 실패하면(폴더·권한) null */
export async function readBytes(file: Blob): Promise<Uint8Array | null> {
  try {
    if (typeof file.arrayBuffer === "function") return new Uint8Array(await file.arrayBuffer());
    return await new Promise<Uint8Array | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = (): void => resolve(reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : null);
      reader.onerror = (): void => resolve(null);
      reader.readAsArrayBuffer(file);
    });
  } catch {
    return null;
  }
}

export interface ReadFilesResult {
  readonly recs: InputRecognition[];
  /** 읽지 못한 항목 수(폴더를 놓은 경우 등 — cc.input.folder) */
  readonly unreadable: number;
}

/** 파일 목록을 차례로 인식한다. startIndex는 지금까지 목록에 있는 행 수(가린 이름의 순번) */
export async function readFiles(files: readonly File[], deps: EngineDeps, startIndex: number): Promise<ReadFilesResult> {
  const recs: InputRecognition[] = [];
  let unreadable = 0;
  for (const file of files) {
    const index = startIndex + recs.length + 1;
    if (file.size > sizeLimitFor(file.name)) {
      recs.push(tooLargeRecognition("file", fileNameValue(file.name, index), file.size));
      continue;
    }
    const bytes = await readBytes(file);
    if (bytes === null) {
      unreadable += 1;
      continue;
    }
    recs.push(deps.recognize({ via: "file", name: file.name, bytes, lastModified: Number.isFinite(file.lastModified) ? file.lastModified : null }));
  }
  return { recs, unreadable };
}

/** 붙여넣은 글자 하나를 인식한다(입력칸에는 남기지 않는다 — PasteBox가 값을 보관하지 않는다) */
export function recognizeText(text: string, deps: EngineDeps, n: number): InputRecognition {
  const bytes = new TextEncoder().encode(text);
  const name = pasteName(n);
  if (bytes.length > LIMITS.jsonBytes) return tooLargeRecognition("paste", { kind: "plain", text: name }, bytes.length);
  return deps.recognize({ via: "paste", name, bytes, lastModified: null });
}

/** 체험 세트 하나를 인식한다. 데이터 블록이 아직 없으면 null */
export function recognizeDemo(deps: EngineDeps, cloud: Cloud, set: DemoSetId): InputRecognition | null {
  const text = readDemoText(cloud, set);
  if (text === null) return null;
  return deps.recognize({ via: "demo", name: demoInputName(set, cloud), bytes: new TextEncoder().encode(text), lastModified: null });
}

export type BuildOutcome =
  | { readonly ok: true; readonly report: Report; readonly input: NormalizedInput }
  | { readonly ok: false; readonly recognitions: InputRecognition[] };

/** 인식 결과들 → 리포트. buildInput이 거부하면(읽을 수 있는 입력이 없음) 갱신된 인식 상태를 돌려준다 */
export function buildReport(deps: EngineDeps, recs: readonly InputRecognition[]): BuildOutcome {
  const built = deps.buildInput(recs);
  if (!built.ok) return { ok: false, recognitions: built.recognitions };
  try {
    return { ok: true, report: deps.judge(built.input), input: built.input };
  } catch {
    // judge는 예외를 던지지 않는 것이 계약이다. 그래도 던지면 리포트를 만들지 않고 V2에 남긴다
    return { ok: false, recognitions: built.recognitions };
  }
}

/** 상태 'ok'인 인식 결과(CTA·계정 줄·문별 수집 줄이 쓴다) */
export const okRecs = (recs: readonly InputRecognition[]): InputRecognition[] => recs.filter((r) => r.status === "ok");

/** 인식 결과들에서 계정 줄에 쓸 신원(ok인 것 중 첫 번째). 섞여 있으면 mixed */
export function identityOf(recs: readonly InputRecognition[]): { readonly preview: NonNullable<InputRecognition["identityPreview"]> | null; readonly mixed: boolean } {
  const oks = okRecs(recs).filter((r) => r.identityPreview !== null);
  const first = oks[0]?.identityPreview ?? null;
  if (first === null) return { preview: null, mixed: false };
  const mixed = oks.some((r) => r.identityPreview !== null && (r.identityPreview.cloud !== first.cloud || r.identityPreview.accountLast4 !== first.accountLast4));
  return { preview: first, mixed };
}

/* ───────── 공개 전 클라우드의 실제 입력 차단(STEP 5 기획팀장 결정 — docs/planning/cloudcheck-qa-decisions.md §8-A) ───────── */
/** 입력 종류만으로 아는 클라우드(수집기 JSON은 종류만으로는 모른다 — 신원 미리보기를 본다) */
const KIND_CLOUD: Readonly<Record<InputKind, Cloud | null>> = {
  "collector-json": null,
  "csv-credential-report": "aws",
  "csv-rg-storage": "azure",
  "csv-rg-nsg": "azure",
  "csv-entra-registration": "azure",
};

/** 인식 결과의 클라우드(신원 미리보기 → 입력 종류 순, 모르면 null) */
export function cloudOfRec(rec: InputRecognition): Cloud | null {
  return rec.identityPreview?.cloud ?? (rec.kind === null ? null : KIND_CLOUD[rec.kind]);
}

/**
 * 실제 점검을 아직 열지 않은 클라우드(config CLOUD_AVAILABILITY가 soon — 지금은 Azure)의 실제 입력이 있으면 그 클라우드, 없으면 null.
 * canCollect(cloud)가 거짓인 동안 V2의 실제 입력(수집기 JSON·Resource Graph CSV 등)으로는 리포트를 만들지 않는다.
 * 읽은(ok) 입력만 본다. 체험(via demo)은 V6 경로라 막지 않는다 — Azure 체험은 계속 공개한다(방향서 D10).
 */
export function uncollectableCloud(recs: readonly InputRecognition[], availability: Availability): Cloud | null {
  for (const r of recs) {
    if (r.status !== "ok" || r.via === "demo") continue;
    const cloud = cloudOfRec(r);
    if (cloud !== null && !canCollect(cloud, availability)) return cloud;
  }
  return null;
}

/**
 * 디자인 결정 D-6(docs/design/cloudcheck-rule-copy-review.md §8-8): 붙여 넣은 CSV는 파일 이름·수정 시각이 없어 기준 시각을 알 수 없다(asOf = null).
 * 기준 시각이 없으면 엔진은 이상 없음·해당 없음을 주지 않으므로(확인 불가), V2의 그 입력 줄 아래에 안내 한 줄을 보인다. 수집기 JSON은 collectedAt이 있어 해당 없음.
 */
export function pastedCsvWithoutAsOf(rec: InputRecognition): boolean {
  return rec.via === "paste" && rec.status === "ok" && rec.kind !== null && rec.kind !== "collector-json" && rec.asOf === null;
}
