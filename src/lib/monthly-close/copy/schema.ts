/**
 * 월마감 문구 팩 zod 스키마 — D0 동결 (소유: 프론트팀장).
 *
 * 파일: copy/{common,accounting,sales,hr}.json (페이지개발자가 D1에 UX §9 + 디자인 최종 §8을 "옮기기만" 해서 만든다).
 * 근거: 방향서 §6 표(필드·개수·길이·노출 등급) + 디자인 최종 §1-D·§8-2·§8-4·§8-5·§6-2 + UI §4(숨기기 시트 열).
 *
 * 스키마가 직접 잡는 것(G0-6 규칙 2·3 중 기계로 가능한 부분)
 *  - 필드 구조·개수(.strict()라 모르는 키도 거부), 토큰 화이트리스트·필수 토큰
 *  - 길이: 토큰을 TOKEN_LENGTHS로 치환한 뒤 "글자 수"(코드포인트)로 판정 — 디자인 D8
 *  - 금지: 상표어(legal 필드만 예외, D7), 2인칭 "당신", 이모지, "ㅋㅋ", 느낌표 연속, 줄바꿈,
 *          "^^"(도발·박대리 도발만 허용), 등급 0·1 필드의 직급어(디자인 §8-3 기준 5, V24)
 * copy.test.ts(페이지개발자)는 이 스키마로 4개 팩을 parse하고, 필요하면 lineViolations()로 추가 검사를 한다.
 *
 * ── 문서 간 차이 처리 ──
 *  - inputHint 상한: 디자인 B2·§8-4는 14자인데, 같은 문서의 차액 문구 "큰 값에서 작은 값을 뺍니다"가 15자다.
 *    자리는 E13:H13 병합(56px 칸 기준 224px, 12px 글자 약 18자)이라 넘치지 않으므로 상한을 16자로 정했다.
 *  - 검산 부가세 머리글: UX §9 [구분, 공급가, 부가세] → 디자인 §8-2 [구분, 공급가] (2개 고정).
 *  - 검산 입력 행 라벨: UX "부가세(10%)" 등 → 디자인 §8-2 2~3자 + inputHint 분리. rowLabel ≤ 4자.
 *  - 시트 탭 이름: UX §9(손익/단계별/신청…)가 아니라 디자인 B6(회계 월결산/손익/비고, 영업 리드/채널별/목표,
 *    인사 현황/팀별/비고)를 따른다. 값의 문제라 스키마는 4자 상한만 본다.
 *  - 도발: 방향서 §6 "10(최소)" → TAUNT_COUNT(10)로 고정 개수. 와이어가 인덱스(TauntId)라서 개수가 바뀌면 안 된다.
 *  - 경보 토스트·메모·라벨 등 나머지 개수는 방향서 §6의 "최소"를 .min()으로 둔다.
 *  - 문구 팩 JSON 위치: 방향서 §2-Q(docs/design/…) → 디자인 E1·§10-3대로 src/lib/monthly-close/copy/ 한 곳.
 */

import { z } from 'zod';
import { INDUSTRIES, QUIZ_VALUE_COUNT, SHIP_SLOTS, TAUNT_COUNT, type ShipSlot } from '../constants';
import type { EndReason, QuizKind } from '../protocol';

// ─── 토큰과 길이 측정 ───────────────────────────────────────────────────────────

/**
 * 치환 토큰 → 길이 검사용 글자 수(디자인 D8: {c}=2, {상대}=4, {R}=2, {n}=2, {배}=표 이름 최대 8).
 * {배:을}/{배:이}/{배:은}은 pick.ts가 받침으로 조사를 붙인다(D3) → 표 이름 8 + 조사 1.
 */
export const TOKEN_LENGTHS = {
  '{c}': 2, // 좌표 "B7"
  '{좌표}': 2, // 결정타 칸
  '{R}': 2, // 회차
  '{n}': 2, // 파일 버전
  '{n+1}': 2, // 다음 버전(공동 경위서 B)
  '{상대}': 4, // 상대 닉네임 앞 4자
  '{t}': 5, // 남은 시간 "00:14"
  '{배}': 8,
  '{배:을}': 9,
  '{배:이}': 9,
  '{배:은}': 9,
  '{탭}': 4, // 게임 시트 탭 이름(연습 코치)
  '{HH:MM}': 5, // 마지막 저장 시각
  '{date}': 10, // yyyy-mm-dd
  '{문서종류}': 6, // "포상 품의서"
  '{파일명}': 18,
  '{a}': 1, // 내가 종결시킨 수
  '{b}': 1, // 당한 수
  '{결과}': 6, // 공유 2줄 결과 한 단어
  '{경위}': 61, // 공유 3줄: 본문 첫 문장 60자 + "…"
} as const;
export type CopyToken = keyof typeof TOKEN_LENGTHS;

const TOKEN_RE = /\{[^{}]*\}/g;

/** 문장 안의 {…} 토큰 목록(중복 포함, 등장 순서). */
export function findTokens(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/** 토큰을 TOKEN_LENGTHS로 치환한 글자 수(코드포인트). 모르는 토큰은 원문 길이로 센다. */
export function measureCopy(text: string): number {
  let n = 0;
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    n += Array.from(text.slice(last, idx)).length;
    const tok = m[0] as CopyToken;
    n += tok in TOKEN_LENGTHS ? TOKEN_LENGTHS[tok] : Array.from(m[0]).length;
    last = idx + m[0].length;
  }
  return n + Array.from(text.slice(last)).length;
}

// ─── 금지 규칙 ────────────────────────────────────────────────────────────────

/** 상표·제품명(방향서 §6 규칙). legal 필드만 예외. */
export const BRAND_WORDS = [
  'battleship',
  '배틀십',
  '배틀쉽',
  'excel',
  '엑셀',
  'microsoft',
  '마이크로소프트',
  'google',
  '구글',
] as const;
/** 등급 0·1 필드 금지 직급어(디자인 §8-3 기준 5, QA V24). 짧은 이름 "부장"처럼 님 없는 형태도 막는다. */
export const RANK_WORDS = ['부장', '팀장', '본부장', '대표님', '사장님', '과장님', '차장님', '이사님'] as const;
export const SECOND_PERSON_WORDS = ['당신'] as const;

// TS가 target(ES2017) 기준으로 정규식 리터럴의 \p{} 를 거부하므로 생성자로 만든다.
const EMOJI_RE = new RegExp('\\p{Extended_Pictographic}', 'u');
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export type LineGrade = 0 | 1 | 2 | 3;

export interface LineRules {
  /** 노출 등급(UX §8-1). 0·1이면 직급어 금지 */
  readonly grade: LineGrade;
  /** "^^" 허용(도발 계열만) */
  readonly caret?: boolean;
  /** 상표어 허용(legal만) */
  readonly brand?: boolean;
}

/** 길이·토큰 외의 문장 규칙 위반 목록. 빈 배열이면 통과. copy.test.ts에서도 재사용 가능. */
export function lineViolations(text: string, rules: LineRules): string[] {
  const v: string[] = [];
  const lower = text.toLowerCase();
  if (CONTROL_RE.test(text)) v.push('제어문자·줄바꿈');
  if (text !== text.trim()) v.push('앞뒤 공백');
  if (EMOJI_RE.test(text)) v.push('이모지');
  if (text.includes('ㅋㅋ')) v.push('ㅋㅋ');
  if (/[!！]{2,}/.test(text)) v.push('느낌표 연속');
  if (!rules.caret && text.includes('^^')) v.push('^^(도발 외)');
  if (!rules.brand) for (const w of BRAND_WORDS) if (lower.includes(w)) v.push(`상표어:${w}`);
  for (const w of SECOND_PERSON_WORDS) if (text.includes(w)) v.push(`2인칭:${w}`);
  if (rules.grade <= 1) for (const w of RANK_WORDS) if (text.includes(w)) v.push(`등급${rules.grade} 직급어:${w}`);
  return v;
}

interface LineOpts extends Partial<LineRules> {
  readonly max: number;
  readonly min?: number;
  /** 허용 토큰. 없으면 토큰 금지 */
  readonly tokens?: readonly CopyToken[];
  /** 반드시 들어가야 하는 토큰 */
  readonly required?: readonly CopyToken[];
}

/** 문구 한 줄 스키마. 기본 등급은 2(잠깐 노출). */
function line(o: LineOpts) {
  const allowed: ReadonlySet<string> = new Set(o.tokens ?? []);
  const rules: LineRules = { grade: o.grade ?? 2, caret: o.caret, brand: o.brand };
  return z.string().superRefine((s, ctx) => {
    const len = measureCopy(s);
    if (len < (o.min ?? 1)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `길이 ${len} < 최소 ${o.min ?? 1}` });
    if (len > o.max) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `길이 ${len} > 상한 ${o.max}` });
    for (const t of findTokens(s)) {
      if (!allowed.has(t)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `허용되지 않은 토큰 ${t}` });
    }
    for (const t of o.required ?? []) {
      if (!s.includes(t)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `필수 토큰 누락 ${t}` });
    }
    for (const msg of lineViolations(s, rules)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg });
  });
}

/** 길이 상한 모음(방향서 §6 + 디자인 §8). copy.test.ts·QA가 같은 숫자를 쓰도록 노출한다. */
export const COPY_LIMITS = {
  fileName: 18,
  formName: 8,
  tab: 4,
  shipLong: 14,
  shipShortMin: 2,
  shipShortMax: 3,
  shipTable: 8,
  memo: 40,
  quizLabel: 24,
  quizHead: 4,
  quizRowLabel: 4,
  quizInputHint: 16, // 디자인은 14 — 위 머리말 참고
  quizUnit: 4,
  alarm: 20,
  resultBody: 120, // 디자인 D6
  resultLine: 40,
  status: 28,
  banner: 40,
  paneHead: 20,
  deco: 20,
  share: 80,
} as const;

const L = COPY_LIMITS;

// ─── 업종 팩 ──────────────────────────────────────────────────────────────────

/** 항목(배) 이름 3종. long[0]은 고정 노출 후보(회계 L4 = "부장님 법카 내역", 연습·회계 첫 판 — 디자인 D1). */
const shipNamesSchema = z
  .object({
    long: z.array(line({ max: L.shipLong, grade: 3 })).length(3),
    short: line({ min: L.shipShortMin, max: L.shipShortMax, grade: 1 }),
    table: line({ max: L.shipTable, grade: 1 }),
  })
  .strict();

const memoLine = line({ max: L.memo, grade: 2, tokens: ['{c}'] });

const memoSchema = z
  .object({
    /** 해당 없음(빗나감) */
    miss: z.array(memoLine).min(6),
    /** 반려(명중). 디자인 §8-2: 6개 중 2개는 엉뚱한 문구 */
    hit: z.array(memoLine).min(6),
    /** 종결(침몰) 슬롯별 */
    sunk: z.object(slotShape(() => z.array(memoLine).min(2))).strict(),
  })
  .strict();

/** 검산 한 종류. 머리글 수 = 값 칸 수 + 1(첫 칸은 "건명"/"구분" 등). */
function quizKindSchema(kind: QuizKind) {
  return z
    .object({
      /** 라벨 후보(종류마다 7 이상). 서버의 labelSeed % 개수로 고른다 */
      labels: z.array(line({ max: L.quizLabel, grade: 2 })).min(7),
      /** 11행 머리글 */
      colHead: z.array(line({ max: L.quizHead, grade: 1 })).length(QUIZ_VALUE_COUNT[kind] + 1),
      /** A12 값 행 라벨("금액", 인사는 "값") */
      valueLabel: line({ max: L.quizHead, grade: 1 }),
      /** A13 입력 행 라벨(합계/부가세/차액/차이) */
      rowLabel: line({ max: L.quizRowLabel, grade: 1 }),
      /** E13:H13 흐린 안내 */
      inputHint: line({ max: L.quizInputHint, grade: 1 }),
      /** G11:H11 단위. null이면 단위 칸 비움(디자인 D4) */
      unit: line({ max: L.quizUnit, grade: 1 }).nullable(),
    })
    .strict();
}

const resultBody = line({
  max: L.resultBody,
  grade: 3,
  tokens: ['{R}', '{좌표}', '{배}', '{배:을}', '{배:이}', '{배:은}', '{n}', '{n+1}'],
});

const resultSchema = z
  .object({
    /** 시말서(패) 본문 변형 */
    reprimand: z.array(resultBody).min(2),
    /** 포상 품의서(승) 본문 변형 */
    award: z.array(resultBody).min(2),
    /** 공동 경위서(무) 본문 변형 */
    joint: z.array(resultBody).min(2),
    /** 경보 실패한 사람에게만 붙는 한 줄 */
    alarmFail: line({ max: L.resultLine, grade: 3 }),
    /** 결과 상태줄(5초) */
    status: z
      .object({
        win: line({ max: L.status, grade: 2 }),
        lose: line({ max: L.status, grade: 2 }),
        draw: line({ max: L.status, grade: 2 }),
      })
      .strict(),
  })
  .strict();

// 숨기기 시트(등급 0). 열 정의는 UI §4-2~4-4, 행·숫자 규칙은 디자인 §6-2.
const g0 = (max: number, extra?: Omit<LineOpts, 'max' | 'grade'>) => line({ ...extra, max, grade: 0 });

const numRange = z
  .tuple([z.number(), z.number()])
  .refine(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && a <= b, '범위는 [작은 값, 큰 값]');

const disguiseColumnSchema = z
  .object({
    head: g0(8),
    /** px, 8의 배수(UI §4-1: 열마다 다른 폭) */
    width: z
      .number()
      .int()
      .min(40)
      .max(240)
      .refine((w) => w % 8 === 0, '열 폭은 8의 배수'),
    /** 셀 서식: code 가운데 / txt 왼쪽 / num #,##0 / dec1 소수 1자리 / pct 0.0% / date yyyy-mm-dd */
    format: z.enum(['code', 'txt', 'num', 'dec1', 'pct', 'date']),
    /** 열별 최대 글자 수(문구·생성 숫자 검사 기준) */
    maxChars: z.number().int().min(1).max(16),
  })
  .strict();

const disguiseRowSchema = z
  .object({
    /** A열(코드·구분·팀 코드) */
    code: g0(6),
    /** B열(계정과목·채널·부문) */
    name: g0(11),
  })
  .strict();

const disguiseGroupSchema = (rows: number) =>
  z
    .object({
      /** 묶음 이름(예: 판매비와관리비) */
      name: g0(16),
      /** 소계 행 B열 문구 */
      subtotal: g0(11),
      rows: z.array(disguiseRowSchema).length(rows),
    })
    .strict();

/** 숫자 생성 규칙. 계산 방식은 sheet/disguise.ts(컴포넌트개발자)가 kind별로 구현하고, 범위만 데이터로 둔다. */
const disguiseRuleSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('accounting'),
      /** 당월 금액 범위(천원) */
      current: numRange,
      /** 전월 = 당월 ± 이 비율(%) */
      prevDeltaPct: z.number().min(0).max(100),
      /** 예산 = 당월의 이 비율(%) 범위 */
      budgetPct: numRange,
      /** I열 구분 값 */
      classes: z.array(g0(4)).min(2),
      /** J열 담당 코드 */
      owners: z.array(g0(5)).min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal('sales'),
      /** 목표 금액 범위(천원) */
      target: numRange,
      /** 달성률 범위(%) */
      achievePct: numRange,
      /** 건수 범위 */
      count: numRange,
    })
    .strict(),
  z
    .object({
      kind: z.literal('hr'),
      /** 정원 범위 */
      headcount: numRange,
      /** 현원 = 정원 − (0 ~ vacancyMax) */
      vacancyMax: z.number().int().min(0).max(10),
      /** 발생 = 현원 × 이 범위(소수 1자리) */
      accrualPerHead: numRange,
      /** 사용률 범위(%) */
      usagePct: numRange,
    })
    .strict(),
]);

const disguiseSchema = z
  .object({
    /** 1행 표 제목 */
    title: g0(20),
    /** 2행 부제(기간·단위). 인사는 {date} */
    subtitle: g0(32, { tokens: ['{date}'] }),
    /** 정확히 10열(A~J) */
    columns: z.array(disguiseColumnSchema).length(10),
    /** 묶음1 6행 + 묶음2 5행(디자인 B5) */
    groups: z.tuple([disguiseGroupSchema(6), disguiseGroupSchema(5)]),
    /** 17행 합계 B열 문구 */
    totalLabel: g0(11),
    rule: disguiseRuleSchema,
    chart: z
      .object({
        title: g0(16),
        /** 기준선(%), 없으면 null(회계 전월·당월 묶음 막대) */
        baselinePct: z.number().min(0).max(200).nullable(),
      })
      .strict(),
    /** 처음 선택 칸(디자인 §6-1: 회계·영업 D4, 인사 F4) */
    firstCell: z.string().regex(/^[A-J](?:[1-9]|[12]\d|30)$/),
    /** 30행 비고 한 줄 */
    note: g0(40),
  })
  .strict()
  .superRefine((d, ctx) => {
    const [codeCol, nameCol] = d.columns;
    for (const g of d.groups) {
      for (const r of g.rows) {
        if (codeCol && Array.from(r.code).length > codeCol.maxChars) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `A열 "${r.code}"가 열 최대 ${codeCol.maxChars}자 초과` });
        }
        if (nameCol && Array.from(r.name).length > nameCol.maxChars) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `B열 "${r.name}"가 열 최대 ${nameCol.maxChars}자 초과` });
        }
      }
    }
  });

/** 장식 메모 시트(비고·목표). 제목·머리 행은 공통 팩. */
const decoSchema = z
  .object({
    memos: z.array(g0(L.deco)).min(6),
    /** 담당 칸 코드(AC-1~AC-3 등) */
    owners: z.array(g0(5)).min(3),
  })
  .strict();

export const industryPackSchema = z
  .object({
    id: z.enum(INDUSTRIES),
    /** 양식 이름(홈 양식 3장·입장 대화상자): 월마감표 / 실적표 / 연차현황 */
    formName: line({ max: L.formName, grade: 1 }),
    /** 파일명 기본형. {n} = 버전 숫자(v7 → "v{n}") */
    fileName: line({ max: L.fileName, grade: 0, tokens: ['{n}'], required: ['{n}'] }),
    tabs: z
      .object({
        /** 게임 탭(항상 첫 번째, 유일한 복귀 경로) */
        game: line({ max: L.tab, grade: 1 }),
        /** 숨기기 탭 */
        disguise: line({ max: L.tab, grade: 1 }),
        /** 장식 탭 */
        deco: line({ max: L.tab, grade: 1 }),
      })
      .strict(),
    ships: z.object(slotShape(() => shipNamesSchema)).strict(),
    memo: memoSchema,
    quiz: z
      .object({ sum: quizKindSchema('sum'), vat: quizKindSchema('vat'), diff: quizKindSchema('diff') })
      .strict(),
    /** 결재 경보 토스트 문장(+ [Tab] 칩은 공통) */
    alarm: z.array(line({ max: L.alarm, grade: 2 })).min(4),
    result: resultSchema,
    disguise: disguiseSchema,
    deco: decoSchema,
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.disguise.rule.kind !== p.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `disguise.rule.kind(${p.disguise.rule.kind}) ≠ id(${p.id})` });
    }
  });

export type IndustryPack = z.infer<typeof industryPackSchema>;

// ─── 공통 팩 ──────────────────────────────────────────────────────────────────

/**
 * 상태줄 필수 키(UX §9-1 표 + §10 오류 매핑 notYourTurn). 문구는 디자인 §8-2 수정분 반영
 * (selected = "{t} · {c} 선택됨 · Enter로 반영"). 표에 없는 키도 같은 규칙으로 더 둘 수 있다(catchall).
 * 숫자 시계는 {t}, 좌표는 {c}, 상대 닉네임은 {상대}, 버전은 {n}으로 쓴다.
 */
export const STATUS_KEYS = [
  'ready',
  'loading',
  'computing',
  'myTurn',
  'oppTurn',
  'oppHidden',
  'oppOffline',
  'reconnecting',
  'waitingGuest',
  'guestJoined',
  'guestLeft',
  'placing',
  'placeWait',
  'autoPlaced',
  'rangeLen',
  'overlap',
  'outOfBoard',
  'selected',
  'notNow',
  'alreadyDone',
  'badAddr',
  'timeout',
  'timeout2',
  'quiz',
  'quizGot',
  'quizDone',
  'quizClosed',
  'hintPick',
  'hintNone',
  'hintDone',
  'oppShot',
  'oppTaunt',
  'alarmPass',
  'alarmFail',
  'hideBudget',
  'docMade',
  'rematchWait',
  'rematchExpired',
  'rematchDone',
  'copied',
  'copyFail',
  'textCopied',
  'reported',
  'thanks',
  'rate',
  'conflict',
  'wrongPhase',
  'codeInvalid',
  'notYourTurn',
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

const statusLine = line({ max: L.status, grade: 2, tokens: ['{t}', '{c}', '{상대}', '{n}'] });
const statusSchema = z
  .object(Object.fromEntries(STATUS_KEYS.map((k) => [k, statusLine])) as Record<StatusKey, typeof statusLine>)
  .catchall(statusLine);

const END_REASONS = ['sunk2', 'draw', 'cap', 'resign', 'absent'] as const satisfies readonly EndReason[];
const docKinds = <T extends z.ZodTypeAny>(s: () => T) => z.object({ reprimand: s(), award: s(), joint: s() }).strict();

export const commonPackSchema = z
  .object({
    /** 도발(의견 남기기). 인덱스가 와이어 TauntId라 개수 고정. 상대 이름·2인칭 금지, "^^" 허용 */
    taunts: z.array(line({ max: L.memo, grade: 2, caret: true })).length(TAUNT_COUNT),
    practice: z
      .object({
        /** "연습용_사본_v1" */
        fileName: g0(L.fileName),
        /** 연습 상대 표시 이름 "박대리"(성+직급 허용 예외 하나, 디자인 §8-3 기준 1) */
        partnerName: line({ max: 8, grade: 2 }),
        /** 박대리 도발 */
        taunts: z.array(line({ max: L.memo, grade: 2, caret: true })).min(2),
        /** 연습 코치 말풍선·보조 문장(UX §2-5, 컷 순서대로). {탭} = 게임 시트 탭 이름 */
        coach: z.array(line({ max: L.memo, grade: 3, tokens: ['{탭}'] })).min(8),
      })
      .strict(),
    /** 검산 오답 한 줄 메모(H13) */
    quizWrong: z.array(line({ max: L.memo, grade: 2 })).min(3),
    /** 종료 사유(결과 문서·상태줄 겸용) */
    endReasons: z
      .object(Object.fromEntries(END_REASONS.map((k) => [k, line({ max: L.resultLine, grade: 3 })])) as Record<
        EndReason,
        ReturnType<typeof line>
      >)
      .strict(),
    status: statusSchema,
    /** 대화상자·배너(≤40, UX §9-1 "배너") */
    banners: z
      .object({
        full: line({ max: L.banner }),
        otherBrowser: line({ max: L.banner }),
        notFound: line({ max: L.banner }),
        expired: line({ max: L.banner }),
        maintenance: line({ max: L.banner }),
        serverDown: line({ max: L.banner }),
      })
      .strict(),
    toasts: z
      .object({
        /** 경보 토스트 칩: 데스크톱 "[Tab]", 모바일 "[전환]" */
        alarmChipDesktop: line({ max: 6 }),
        alarmChipMobile: line({ max: 6 }),
        /** "v{n} 저장 요청이 도착했습니다." + 칩 "[저장]" */
        rematchRequest: line({ max: L.alarm + 4, tokens: ['{n}'] }),
        rematchChip: line({ max: 6 }),
        /** "문서 1건이 생성되었습니다." + 칩 "[열기]" */
        docMade: line({ max: L.alarm }),
        openChip: line({ max: 6 }),
        /** Ctrl/Cmd+S "저장됨" */
        saved: line({ max: 8, grade: 0 }),
      })
      .strict(),
    /** 창 머리 띠(디자인 §4-2, 등급 0, 닉네임 없음) */
    paneHead: z
      .object({
        left: z
          .object({
            editable: g0(L.paneHead),
            saved: g0(L.paneHead),
            coedit: g0(L.paneHead),
            final: g0(L.paneHead),
          })
          .strict(),
        right: z
          .object({
            waiting: g0(L.paneHead),
            drafting: g0(L.paneHead),
            editable: g0(L.paneHead),
            readonly: g0(L.paneHead),
            offline: g0(L.paneHead),
            final: g0(L.paneHead),
          })
          .strict(),
      })
      .strict(),
    /** 숨기기 레이어 필터 줄(디자인 B4) */
    filterRow: z
      .object({
        view: g0(32),
        lastSaved: g0(16, { tokens: ['{HH:MM}'], required: ['{HH:MM}'] }),
      })
      .strict(),
    /** 장식 메모 시트 공통(디자인 §6-3): 제목 "업무 메모", 머리 행 일자·내용·담당 */
    deco: z
      .object({
        title: g0(12),
        heads: z.tuple([g0(4), g0(4), g0(4)]),
      })
      .strict(),
    resultDocs: z
      .object({
        /** 문서 제목: 시말서 / 포상 품의서 / 공동 경위서 (자간은 CSS, 문구에 띄어 쓰기 넣지 않음 — C19) */
        titles: docKinds(() => line({ max: 6, grade: 3 })),
        /** 결과 시트 탭 이름: 시말서 / 품의서 / 경위서 */
        tabs: docKinds(() => line({ max: L.tab, grade: 1 })),
        /** 결재란 칸 이름(담당·팀장·본부장) — 결과 문서는 등급 3 */
        approvers: z.tuple([line({ max: 4, grade: 3 }), line({ max: 4, grade: 3 }), line({ max: 4, grade: 3 })]),
        /** 공통 꼬리(UX §9-1 "결과 문서 공통 꼬리") */
        tails: z
          .object({
            awardPrize: line({ max: L.resultLine, grade: 3 }),
            awardRoute: line({ max: L.resultLine, grade: 3 }),
            joint: line({ max: L.resultLine, grade: 3 }),
            beta: line({ max: L.resultLine, grade: 3 }),
          })
          .strict(),
      })
      .strict(),
    /** [내용 복사] 공유 텍스트 5줄(디자인 §8-4, UI §5-4) */
    share: z
      .object({
        line1: line({ max: L.share, grade: 3, tokens: ['{문서종류}', '{파일명}'] }),
        line2: line({ max: L.share, grade: 3, tokens: ['{R}', '{a}', '{b}', '{결과}'] }),
        line3: line({ max: L.share, grade: 3, tokens: ['{경위}'] }),
        line4: line({ max: L.share, grade: 3 }),
        line5: line({ max: L.share, grade: 3 }),
        /** {결과}: 결재 완료 / 시말서 작성 / 공동 경위서 */
        results: z
          .object({ win: line({ max: 6, grade: 3 }), lose: line({ max: 6, grade: 3 }), draw: line({ max: 6, grade: 3 }) })
          .strict(),
      })
      .strict(),
    /** 홈 법적 고지 한 줄. 상표어 검사 예외 필드는 이것 하나뿐(디자인 D7) */
    legal: line({ max: 80, grade: 3, brand: true }),
  })
  .strict();

export type CommonPack = z.infer<typeof commonPackSchema>;

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

function slotShape<T extends z.ZodTypeAny>(make: () => T): Record<ShipSlot, T> {
  return Object.fromEntries(SHIP_SLOTS.map((s) => [s, make()])) as Record<ShipSlot, T>;
}
