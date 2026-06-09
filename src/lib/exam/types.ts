/**
 * 문제팩토리 — 변형 시험지 생성 SaaS 공용 타입
 * 클라이언트/서버 양쪽에서 import 하므로 외부 의존성 없이 순수 타입만 둔다.
 */

export type Subject = "english" | "math" | "korean" | "science" | "social";
export type Difficulty = "easy" | "medium" | "hard";
export type QuestionType = "multiple_choice" | "short_answer";
export type ExamMode = "live" | "demo";
/** 요금제 — free(학생 자습 /study, Haiku 라우팅) / pro(강사용 /exam, Sonnet) */
export type Tier = "free" | "pro";

export const SUBJECTS: { id: Subject; label: string }[] = [
  { id: "english", label: "영어" },
  { id: "math", label: "수학" },
  { id: "korean", label: "국어" },
  { id: "science", label: "과학" },
  { id: "social", label: "사회" },
];

export const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "하" },
  { id: "medium", label: "중" },
  { id: "hard", label: "상" },
];

export const QUESTION_TYPES: { id: QuestionType; label: string }[] = [
  { id: "multiple_choice", label: "객관식" },
  { id: "short_answer", label: "단답형" },
];

export interface Choice {
  /** 보기 기호: ①②③④⑤ */
  label: string;
  text: string;
}

export interface Variant {
  id: string;
  /** 지문(있을 경우) — 영어 독해·국어 등 */
  passage?: string;
  /** 발문/문제 본문 */
  stem: string;
  type: QuestionType;
  /** 객관식일 때 보기 */
  choices?: Choice[];
  /** 정답 (객관식이면 "③", 단답형이면 정답 텍스트) */
  answer: string;
  /** 해설 */
  explanation: string;
  difficulty: Difficulty;
  subject: Subject;
  /** 배점(2~4). 시험지 배점 표기·총점 계산에 사용 */
  points?: number;
  /** 출제 단원 id (교육과정 정합성). 지정 시 해당 단원으로 출제됨 */
  unitId?: string;
}

export interface GenerateRequestBody {
  /** 원본 문항 텍스트 (이미지만 보낼 경우 빈 문자열 허용) */
  source: string;
  /** 이미지 업로드 시 base64 본문 (data URL의 콤마 뒤 부분) */
  imageBase64?: string;
  /** 이미지 MIME 타입 */
  imageMediaType?: "image/png" | "image/jpeg" | "image/webp";
  subject: Subject;
  difficulty: Difficulty;
  /** 생성할 변형 문항 수 */
  count: number;
  type: QuestionType;
  /** 요금제 — free(Haiku 라우팅) / pro(Sonnet). 미지정 시 pro */
  tier?: Tier;
  /** 교육과정 단원 id(선택) — 지정 시 해당 단원 빈출유형·배점으로 출제 */
  unitId?: string;
}

export interface GenerateResult {
  mode: ExamMode;
  /** 원문항을 어떻게 해석했는지 한 줄 요약 */
  sourceSummary: string;
  variants: Variant[];
}

/** 문제은행에 저장되는 항목 (localStorage 직렬화) */
export interface BankItem extends Variant {
  savedAt: number;
  /** 출처 메모(선택) */
  note?: string;
}
