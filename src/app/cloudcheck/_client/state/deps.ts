// src/app/cloudcheck/_client/state/deps.ts — 엔진·파서 주입 계약(EngineDeps). 소유: 페이지개발자.
// 방향서 §5-3 'UI가 부르는 함수'의 시그니처를 한 인터페이스로 묶는다. reducer·화면·파이프라인은 이 인터페이스에만 의존한다(실제 lib 모듈을 직접 import하지 않는다).
//  - 목업 구현: state/deps.mock.ts(테스트·미리보기 전용. 운영 번들에 넣지 않는다)
//  - 실제 구현: state/deps.real.ts(parse·engine·rules 모듈이 레포에 생긴 뒤 연결. 통합은 프론트팀장)
// 이 파일은 타입만 담는다(값 import 0 → 번들에 목업이나 엔진이 딸려 오지 않는다).
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { NormalizedInput } from "../../../../lib/cloudcheck/contract/normalized";
import type {
  Comparison,
  ExceptionOverlay,
  InputRecognition,
  InputVia,
  IsoDate,
  IsoUtc,
  Report,
  RuleCatalogEntry,
  TimeNotice,
} from "../../../../lib/cloudcheck/model/report";

/** recognize()의 입력(방향서 §5-3). 크기 상한은 UI가 file.size로 먼저 본다(§4-5 ①) */
export interface RecognizeSource {
  readonly via: InputVia;
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly lastModified: number | null;
}

/** buildInput() 결과(§5-3). recognitions는 superseded·계정 불일치를 반영한 새 목록이다 */
export type BuildInputResult =
  | { readonly ok: true; readonly input: NormalizedInput; readonly recognitions: InputRecognition[] }
  | { readonly ok: false; readonly recognitions: InputRecognition[] };

/** parseExceptions() 결과(§5-3). issues는 코드 문자열 "format"|"reason"|"until"|"span"|"rule"|"too-many"(디자인 X10) */
export type ParseExceptionsResult =
  | { readonly ok: true; readonly file: ExceptionsFile }
  | { readonly ok: false; readonly issues: string[] };

export interface EngineDeps {
  /** parse/recognize.ts — 예외를 던지지 않는다 */
  recognize(src: RecognizeSource): InputRecognition;
  /** parse/normalize.ts */
  buildInput(recs: readonly InputRecognition[]): BuildInputResult;
  /** engine/judge.ts — 순수 함수. now·예외 파일·본인 응답은 인자가 아니다 */
  judge(input: NormalizedInput): Report;
  /** engine/time.ts — 체험 모드면 [] */
  timeNotices(report: Report, now: IsoUtc): TimeNotice[];
  /** engine/exceptions.ts — 상태는 바꾸지 않고 라벨만 덧씌운다(INV-8) */
  overlayExceptions(report: Report, file: ExceptionsFile | null, today: IsoDate): ExceptionOverlay;
  /** engine/compare.ts — 수집 시각 순으로 자동 정렬, 다른 계정·클라우드면 거부 */
  compare(a: Report, b: Report): Comparison;
  /** parse/mask.ts — R-13 마스킹 사본(결정적 가명화 JSON 텍스트) */
  maskedCopy(input: NormalizedInput): string;
  /** parse/exceptions.ts */
  parseExceptions(text: string): ParseExceptionsResult;
  serializeExceptions(file: ExceptionsFile): string;
  /** rules/catalog.ts RULE_CATALOG — 18장. released = false는 리포트·분포에 넣지 않는다 */
  readonly catalog: readonly RuleCatalogEntry[];
  /** 룰셋 버전(바닥 줄·V8). 리포트가 없을 때도 보여야 해서 리포트 밖 상수로 받는다 */
  readonly rulesetVersion: string;
}
