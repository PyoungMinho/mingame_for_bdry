// REDLINE: 타인 비교/외모 점수 UI 금지
/**
 * 수능 D-day & 일일 학습량 — 학생 동기부여 HUD용 순수 헬퍼(React 비의존).
 *
 * 수능일은 정부가 매 학년도 별도 공고하며 "11월 셋째 목요일" 규칙이 항상 맞지는
 * 않는다(예: 2026학년도 수능은 11월 둘째 주였다). 그래서 자동 계산하지 않고 공식
 * 발표일을 상수로 박아둔다. 학년도가 바뀌면 SUNEUNG 한 곳만 갱신하면 된다.
 */

export const SUNEUNG = {
  /** 학년도(입시 기준 연도) */
  year: 2027,
  /** 시행일 (KST, YYYY-MM-DD) — 공식 발표 기준. 변경 시 이 값만 수정 */
  date: "2026-11-19",
} as const;

/**
 * targetISO(YYYY-MM-DD)까지 남은 일수. 시각은 무시하고 "날짜" 기준으로 센다.
 * 같은 날=0, 미래=양수, 지난 뒤=음수. 클라이언트에서 호출하면 사용자 로컬(KST) 기준.
 */
export function daysUntil(targetISO: string, now: Date): number {
  const [y, m, d] = targetISO.split("-").map(Number);
  const target = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
  const today = new Date(now.getTime()).setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86_400_000);
}

/** now의 로컬 날짜를 "YYYY-MM-DD"로. 일일 카운터 리셋 키. */
export function dateKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export type DailyProgress = { date: string; solved: number };

/**
 * 오늘 푼 문제 수 누적. 날짜가 바뀌면 자동 리셋(add부터 새로 시작).
 * prev가 없거나 다른 날이면 오늘치로 초기화한다.
 */
export function bumpDaily(prev: DailyProgress | null, add: number, now: Date): DailyProgress {
  const key = dateKey(now);
  if (!prev || prev.date !== key) return { date: key, solved: Math.max(0, add) };
  return { date: key, solved: prev.solved + add };
}

/** 두 날짜키(YYYY-MM-DD) 사이의 일수(b - a). 로컬 자정 기준. */
function daysBetween(aISO: string, bISO: string): number {
  const [ay, am, ad] = aISO.split("-").map(Number);
  const [by, bm, bd] = bISO.split("-").map(Number);
  const a = new Date(ay, am - 1, ad).setHours(0, 0, 0, 0);
  const b = new Date(by, bm - 1, bd).setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86_400_000);
}

export type StreakState = { lastDate: string; count: number };

/**
 * 연속 학습일 누적 — 학습 세트를 끝낼 때마다 호출.
 * 오늘 이미 기록했으면 그대로(하루 여러 번 풀어도 +1 한 번), 어제 이어왔으면 +1,
 * 하루 이상 비면 1로 리셋. "본인 기록"만 다루며 타인 비교 없음(REDLINE).
 */
export function bumpStreak(prev: StreakState | null, now: Date): StreakState {
  const today = dateKey(now);
  if (!prev || typeof prev.lastDate !== "string") return { lastDate: today, count: 1 };
  if (prev.lastDate === today) return { lastDate: today, count: Math.max(1, prev.count) };
  const gap = daysBetween(prev.lastDate, today);
  const base = Math.max(1, prev.count);
  return { lastDate: today, count: gap === 1 ? base + 1 : 1 };
}

/**
 * 화면에 표시할 현재 연속일. 오늘·어제까지 이어졌으면 유지, 그보다 오래 비면 0(끊김).
 * 저장값을 건드리지 않고 "지금 보이는 연속일"만 계산한다.
 */
export function streakDisplay(prev: StreakState | null, now: Date): number {
  if (!prev || typeof prev.lastDate !== "string") return 0;
  const gap = daysBetween(prev.lastDate, dateKey(now));
  if (gap <= 0) return Math.max(0, prev.count); // 오늘 기록됨
  if (gap === 1) return Math.max(0, prev.count); // 어제까지 이어짐 — 아직 살아있음
  return 0; // 이틀 이상 비어 끊김
}
