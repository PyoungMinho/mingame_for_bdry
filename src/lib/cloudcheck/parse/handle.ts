// src/lib/cloudcheck/parse/handle.ts — ParsedHandle 뒤의 내부 데이터 (방향서 §5-3: UI는 핸들의 내용을 열어 보지 않는다)
// recognize()가 입력 1개를 읽고 만든 검증 결과를 보관하고, buildInput()이 핸들로 되찾아 간다. 핸들 자체는 속이 빈 동결 객체다(WeakMap 키).
import type { AsOfFact, AsOfRejected, CsvKind, Instant } from "../contract/normalized";
import type { AwsCollect, AzureCollect } from "../contract/collect-schema";
import type { Cloud, DemoSetId, InputVia, ParsedHandle } from "../model/report";
import type { ReportTable } from "./credential-report";
import type { EntraTable } from "./entra-csv";
import type { RgTable } from "./rg-csv";

export type SectionResult = { readonly ok: true; readonly value: unknown } | { readonly ok: false };
export type Envelope = Omit<AwsCollect, "data"> | Omit<AzureCollect, "data">;

export interface CollectorParsed {
  readonly type: "collector";
  readonly cloud: Cloud;
  readonly via: InputVia;
  /** 표시용 이름(체험 입력은 세트 글자 없는 이름) */
  readonly name: string;
  readonly bytes: number;
  /** 원본 바이트의 SHA-256(소문자 16진수). buildInput이 동률을 입력 위치가 아니라 내용으로 깰 때 쓴다(N1) */
  readonly digest: string;
  readonly demoSet: DemoSetId | null;
  readonly schemaId: string;
  readonly support: "exact" | "newer-minor" | "older-minor";
  readonly envelope: Envelope;
  readonly collectedAt: Instant;
  /** 기준 시각: 수집 시각(collected-at). 2000년 이전이면 null(asOfRejected에 기록) */
  readonly asOf: AsOfFact | null;
  readonly asOfRejected?: AsOfRejected;
  /** Azure 수집기: 저장소 키 생성 시각 중 가장 늦은 것(AWS 수집기는 계산하지 않는다) */
  readonly latestEvidence: Instant | null;
  readonly runKey: string;
  /** data 섹션별 safeParse 결과. 파일에 없는 섹션은 들어 있지 않다 */
  readonly sections: ReadonlyMap<string, SectionResult>;
}
export interface CsvParsed {
  readonly type: "csv";
  readonly kind: CsvKind;
  readonly cloud: Cloud;
  readonly via: InputVia;
  readonly name: string;
  readonly bytes: number;
  /** 원본 바이트의 SHA-256(소문자 16진수). 동률 깨기용(N1) */
  readonly digest: string;
  readonly asOf: AsOfFact | null;
  readonly asOfRejected?: AsOfRejected;
  /** 이 CSV 안의 가장 늦은 증거 시각(보고서·저장소 RG CSV). 없으면 null */
  readonly latestEvidence: Instant | null;
  readonly report: ReportTable | null;
  readonly rg: RgTable | null;
  readonly entra: EntraTable | null;
  /** 신원: AWS 계정 ID(12자리) 또는 Azure 테넌트 ID(소문자). Entra CSV는 null */
  readonly identityId: string | null;
}
export type ParsedInput = CollectorParsed | CsvParsed;

const store = new WeakMap<object, ParsedInput>();
export function makeHandle(p: ParsedInput): ParsedHandle {
  const h = Object.freeze({}) as ParsedHandle;
  store.set(h, p);
  return h;
}
export function readHandle(h: unknown): ParsedInput | null {
  return typeof h === "object" && h !== null ? store.get(h) ?? null : null;
}
