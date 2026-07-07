/**
 * 직장인 성향 분석기 — 테스트 엔진 데이터 타입 (단일 계약)
 *
 * docs/design/office-archetype-design-final.md §4 스키마와 정확히 일치해야 한다.
 * data/config.json · data/questions.json · data/types.json 은 반드시 이 타입을 만족한다.
 * 후속 시리즈(hsp-test, dating-balance)는 이 타입을 그대로 두고 JSON만 교체해 엔진을 재사용한다.
 *
 * 도메인 하드코딩 금지: 컴포넌트/엔진은 "직장"·"동료" 같은 단어를 문자열로 박지 말고
 * 전부 이 타입을 통해 JSON에서 주입받는다.
 */

/** 판정 축 id. 방향서/디자인 확정: X = work↔relation, Y = lead↔follow. 시리즈 교체 시 다른 축 id 가능. */
export type AxisId = "x" | "y";

/** 축 정의 — pos(양수 방향 라벨) / neg(음수 방향 라벨). 카피/분석용, 판정 로직은 AxisId만 사용.
 *  label은 사람이 읽는 축 설명(예: "일 중심 ↔ 관계 중심") — 선택적, 콘텐츠 확장 필드. */
export interface AxisDefinition {
  id: AxisId;
  pos: string;
  neg: string;
  label?: string;
}

/** 공용 카피/라벨. 화면 텍스트는 전부 여기서 주입 — 컴포넌트에 한글 리터럴 하드코딩 금지.
 *  §4-1 필수 키 + 콘텐츠팀이 자유롭게 추가하는 화면별 카피 키(인덱스 시그니처)를 모두 허용한다. */
export interface ConfigLabels {
  start: string;
  restart: string;
  strengths: string;
  shadows: string;
  match: string;
  shareKakao: string;
  shareStory: string;
  analyzing: string;
  [key: string]: string;
}

/** 사회적 증거(참여자 수) 표시 설정 — 선택적 확장(§1-0 localStorage `oa-count`). */
export interface SocialProofConfig {
  baseCount: number;
  mode: string;
  storageKey: string;
}

/** data/config.json 스키마 (§4-1). 콘텐츠팀이 추가하는 `_meta`/`resolveEngineNote` 등
 *  주석성 필드는 인덱스 시그니처로 허용하되 엔진 로직은 절대 참조하지 않는다(문서용일 뿐). */
export interface OaConfig {
  slug: string;
  title: string;
  subtitle: string;
  questionCount: number;
  axes: AxisDefinition[];
  labels: ConfigLabels;
  resultBasePath: string;
  socialProof?: SocialProofConfig;
  [key: string]: unknown;
}

/** 선택지 1개 — 축별 가감 점수(정수). 축 id는 AxisDefinition.id 와 일치해야 한다. */
export interface QuestionOption {
  id: string;
  text: string;
  scores: Partial<Record<AxisId, number>>;
}

/** 문항 1개 (§4-2). 4지선다(극단2+중도1~2) 고정, 옵션 개수는 데이터가 결정. */
export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
}

/** data/questions.json 스키마. `_meta`/`designNote` 등 콘텐츠팀 주석 필드는 인덱스 시그니처로 허용. */
export interface QuestionsData {
  version: number;
  questions: Question[];
  [key: string]: unknown;
}

/** 강점/그림자 도트 게이지 — 0~5, 자기 유형 내 속성 강조(타 유형 비교 아님, REDLINE 준수) */
export interface TypeGauge {
  strength: number;
  shadow: number;
}

/** 유형 컬러 3톤 — tint(배경) / solid(아이콘·포인트) / deep(강조 텍스트) */
export interface TypeColor {
  tint: string;
  solid: string;
  deep: string;
}

/** 유형이 속한 상한(4상한) 좌표 — 각 축의 pos/neg 라벨 중 하나 */
export interface TypeAxisPosition {
  x: string;
  y: string;
}

/** 유형 1개 (§4-3). 8유형 전량이 이 스키마를 만족.
 *  id === slug === 결과 딥링크 `/result/[typeSlug]`의 typeSlug (design-final D5). */
export interface OaType {
  id: string;
  /** 라우팅용 slug. 콘텐츠 데이터상 id와 항상 동일값이나, 딥링크 매칭엔 이 필드를 우선 사용. */
  slug?: string;
  name: string;
  alias: string;
  axis: TypeAxisPosition;
  tagline: string;
  color: TypeColor;
  /** lucide-react 아이콘 이름(kebab-case) 또는 인라인 SVG 매퍼 키 */
  icon: string;
  gauge: TypeGauge;
  strengths: string[];
  shadows: string[];
  matchBestId: string;
  matchBestReason: string;
  matchWorstId?: string;
}

/** data/types.json 스키마. 콘텐츠팀 주석 필드(`_meta` 등)는 인덱스 시그니처로 허용. */
export interface TypesData {
  version: number;
  types: OaType[];
  [key: string]: unknown;
}

/** 사용자의 답변 1건 — 문항 id + 선택한 옵션 id */
export interface Answer {
  qid: string;
  oid: string;
}

/** 축별 합산 점수 */
export type AxisScores = Record<AxisId, number>;

/** 판정 결과 — 최종 유형 + 산출 근거(디버깅/베타 검증용) */
export interface ResolveResult {
  type: OaType;
  scores: AxisScores;
}

/** sessionStorage 키 (design-final §1-0 상태 목록) */
export const OA_STORAGE_KEYS = {
  answers: "oa-answers",
  result: "oa-result",
} as const;

/** localStorage 키 */
export const OA_LOCAL_KEYS = {
  theme: "oa-theme",
  count: "oa-count",
} as const;

export type OaTheme = "light" | "dark";
