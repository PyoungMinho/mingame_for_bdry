"use client";

/**
 * 무료 자습 모드 — 학생이 공부할 주제를 넣으면 수능형 문제를 워크북처럼 풀이.
 * 답 선택/입력 → 즉시 채점 → 해설 → 점수 집계. 광고(무료) 기반.
 * 생성은 기존 /api/exam/generate 재사용(데모/라이브 동일).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sigma,
  Sparkles,
  Check,
  X,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  GraduationCap,
  Loader2,
  BookOpen,
  Trophy,
  PenLine,
  CalendarDays,
  Flame,
} from "lucide-react";
import {
  SUBJECTS,
  DIFFICULTIES,
  QUESTION_TYPES,
  type Difficulty,
  type ExamMode,
  type GenerateResult,
  type QuestionType,
  type Subject,
  type Variant,
} from "@/lib/exam/types";
import { AdUnit } from "@/app/_components/AdUnit";
import { AD_SLOTS } from "@/lib/ads";
import UnitPicker from "@/components/exam/UnitPicker";
import { CircledWord } from "@/app/_components/RedPenCircle";
import { answersMatch } from "@/lib/grading";
import {
  daysUntil,
  dateKey,
  bumpDaily,
  bumpStreak,
  streakDisplay,
  SUNEUNG,
  type DailyProgress,
  type StreakState,
} from "@/lib/dday";

type Phase = "setup" | "solve" | "result";

const STUDY_STATS_KEY = "munje-factory:study:v1";
type StudyStats = { totalSolved: number; totalCorrect: number; sets: number };
const EMPTY_STATS: StudyStats = { totalSolved: 0, totalCorrect: 0, sets: 0 };

function loadStats(): StudyStats {
  if (typeof window === "undefined") return EMPTY_STATS;
  try {
    const raw = localStorage.getItem(STUDY_STATS_KEY);
    if (!raw) return EMPTY_STATS;
    const p = JSON.parse(raw);
    return {
      totalSolved: Number(p?.totalSolved) || 0,
      totalCorrect: Number(p?.totalCorrect) || 0,
      sets: Number(p?.sets) || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

// 오늘 푼 문제 수(날짜 바뀌면 자동 리셋) — D-day HUD용. 통계와 분리된 로컬 키.
const STUDY_DAILY_KEY = "munje-factory:study:daily:v1";

function loadDaily(): DailyProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDY_DAILY_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.date !== "string") return null;
    return { date: p.date, solved: Number(p?.solved) || 0 };
  } catch {
    return null;
  }
}

// 연속 학습일(streak) — 매일 한 세트씩 풀면 이어진다. 통계/일일과 분리된 로컬 키.
const STUDY_STREAK_KEY = "munje-factory:study:streak:v1";

function loadStreak(): StreakState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STUDY_STREAK_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.lastDate !== "string") return null;
    return { lastDate: p.lastDate, count: Number(p?.count) || 0 };
  } catch {
    return null;
  }
}

function isCorrect(v: Variant, userAnswer: string | undefined): boolean {
  if (!userAnswer) return false;
  if (v.type === "multiple_choice") return userAnswer === v.answer;
  // 단답형: 숫자는 수치 동치(1.5 = 1.50), 그 외는 정규화 텍스트 비교 (@/lib/grading)
  return answersMatch(v.answer, userAnswer);
}

/** 광고 자리 — 실제 애드센스 연동 전 placeholder(레이아웃·면적 확보) */
function AdSlot({ label = "광고 영역", slot }: { label?: string; slot?: string }) {
  return <AdUnit slot={slot} label={label} className="my-6" />;
}

export default function StudyPage() {
  const [mode, setMode] = useState<ExamMode | null>(null);
  const [phase, setPhase] = useState<Phase>("setup");

  // 설정
  const [subject, setSubject] = useState<Subject>("korean");
  const [unitId, setUnitId] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [count, setCount] = useState(5);
  const [topic, setTopic] = useState("");

  // 풀이
  const [variants, setVariants] = useState<Variant[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [graded, setGraded] = useState<Record<string, boolean>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<StudyStats>(EMPTY_STATS);
  const [dday, setDday] = useState<number | null>(null);
  const [daily, setDaily] = useState<DailyProgress | null>(null);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const committedRef = useRef(false);

  useEffect(() => {
    fetch("/api/exam/generate")
      .then((r) => r.json())
      .then((d) => setMode(d?.mode === "live" ? "live" : "demo"))
      .catch(() => setMode("demo"));
    setStats(loadStats());
    // D-day·오늘 카운터는 클라이언트 로컬시간 기준 → SSR/하이드레이션 불일치 방지 위해 effect에서 계산
    setDday(daysUntil(SUNEUNG.date, new Date()));
    setDaily(loadDaily());
    setStreak(loadStreak());
  }, []);

  const current = variants[index];
  const correctCount = useMemo(
    () => variants.filter((v) => graded[v.id] && isCorrect(v, answers[v.id])).length,
    [variants, graded, answers]
  );
  const gradedCount = useMemo(
    () => variants.filter((v) => graded[v.id]).length,
    [variants, graded]
  );
  // 오늘 푼 문제 수 — daily가 오늘 날짜일 때만 유효(어제 기록이면 0으로 표시)
  const todaySolved = useMemo(
    () => (daily && daily.date === dateKey(new Date()) ? daily.solved : 0),
    [daily]
  );
  // 연속 학습일 — 어제까지 이어졌으면 유지, 그보다 오래 비면 0(끊김)
  const streakDays = useMemo(() => streakDisplay(streak, new Date()), [streak]);

  async function start() {
    setError(null);
    if (!topic.trim()) {
      setError("공부하고 싶은 주제·개념·문제를 입력해 주세요. 예) 이차방정식 근의 공식");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: topic.trim(),
          subject,
          difficulty,
          count,
          type: qType,
          tier: "free", // 학생 무료 자습 — 저비용 Haiku 라우팅
          unitId, // 선택한 교육과정 단원(없으면 undefined → 자유 출제)
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : Object.values(data.error || {}).flat().join(" ") || "문제 생성에 실패했습니다.";
        throw new Error(msg);
      }
      const result = data as GenerateResult;
      if (!result.variants?.length) throw new Error("문제를 만들지 못했어요. 주제를 더 구체적으로 적어볼까요?");
      setVariants(result.variants);
      setIndex(0);
      setAnswers({});
      setGraded({});
      committedRef.current = false;
      setMode(result.mode);
      setPhase("solve");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했어요.");
    } finally {
      setLoading(false);
    }
  }

  const selectChoice = useCallback(
    (label: string) => {
      if (!current || graded[current.id]) return;
      setAnswers((p) => ({ ...p, [current.id]: label }));
    },
    [current, graded]
  );

  const gradeCurrent = useCallback(() => {
    if (!current) return;
    if (!answers[current.id]?.trim()) return;
    setGraded((p) => ({ ...p, [current.id]: true }));
  }, [current, answers]);

  const commitStats = useCallback(
    (solved: number, correct: number) => {
      if (committedRef.current) return;
      committedRef.current = true;
      setStats((prev) => {
        const next: StudyStats = {
          totalSolved: prev.totalSolved + solved,
          totalCorrect: prev.totalCorrect + correct,
          sets: prev.sets + 1,
        };
        try {
          localStorage.setItem(STUDY_STATS_KEY, JSON.stringify(next));
        } catch {
          /* 저장 공간 부족 등 — 통계는 비핵심이므로 무시 */
        }
        return next;
      });
      // 오늘 푼 문제 수 누적(날짜 바뀌면 bumpDaily가 자동 리셋)
      setDaily((prev) => {
        const next = bumpDaily(prev, solved, new Date());
        try {
          localStorage.setItem(STUDY_DAILY_KEY, JSON.stringify(next));
        } catch {
          /* 비핵심 — 무시 */
        }
        return next;
      });
      // 연속 학습일 갱신(하루 한 번만 +1, 빈 날 있으면 리셋)
      setStreak((prev) => {
        const next = bumpStreak(prev, new Date());
        try {
          localStorage.setItem(STUDY_STREAK_KEY, JSON.stringify(next));
        } catch {
          /* 비핵심 — 무시 */
        }
        return next;
      });
    },
    []
  );

  const goNext = useCallback(() => {
    if (index < variants.length - 1) {
      setIndex((i) => i + 1);
    } else {
      commitStats(variants.length, correctCount);
      setPhase("result");
    }
  }, [index, variants.length, correctCount, commitStats]);

  function restart() {
    setAnswers({});
    setGraded({});
    setIndex(0);
    committedRef.current = false;
    setPhase("solve");
  }

  function newSet() {
    setPhase("setup");
    setVariants([]);
    setAnswers({});
    setGraded({});
    setIndex(0);
    committedRef.current = false;
  }

  const accuracy =
    stats.totalSolved > 0 ? Math.round((stats.totalCorrect / stats.totalSolved) * 100) : 0;

  return (
    <div className="graph-paper min-h-screen font-sans text-slate-800">
      {/* 배경 워터마크 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-24 h-80 w-80 rounded-full bg-indigo-200/30 blur-[120px]" />
        <div className="absolute top-1/2 -right-24 h-80 w-80 rounded-full bg-sky-200/30 blur-[120px]" />
        <span className="absolute left-[5%] top-[16%] select-none font-serif text-[130px] leading-none text-slate-900/[0.035]">
          ∑
        </span>
        <span className="absolute right-[9%] top-[26%] select-none font-serif text-[110px] leading-none text-slate-900/[0.04]">
          π
        </span>
        <span className="absolute left-[12%] bottom-[12%] select-none font-serif text-[120px] leading-none text-slate-900/[0.03]">
          √
        </span>
        <span className="absolute right-[15%] bottom-[18%] select-none font-serif text-[100px] leading-none text-slate-900/[0.035]">
          ∫
        </span>
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-[#FAFAF7]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/study" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-blue-600 shadow-sm shadow-indigo-600/20">
              <Sigma className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="leading-tight">
              <div className="font-serif text-[17px] font-bold text-slate-900">문제팩토리</div>
              <div className="text-[11px] text-slate-500">무료 자습 · 수능형 문제풀이</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {mode && (
              <span
                className={`hidden rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline-flex ${
                  mode === "live"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-amber-300 bg-amber-50 text-amber-700"
                }`}
              >
                {mode === "live" ? "AI 생성" : "데모 모드"}
              </span>
            )}
            <Link
              href="/exam"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <GraduationCap className="h-4 w-4" aria-hidden />
              강사용
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-5 py-8">
        {phase === "setup" && (
          <SetupView
            subject={subject}
            setSubject={setSubject}
            unitId={unitId}
            setUnitId={setUnitId}
            difficulty={difficulty}
            setDifficulty={setDifficulty}
            qType={qType}
            setQType={setQType}
            count={count}
            setCount={setCount}
            topic={topic}
            setTopic={setTopic}
            loading={loading}
            error={error}
            stats={stats}
            accuracy={accuracy}
            dday={dday}
            todaySolved={todaySolved}
            streakDays={streakDays}
            onStart={start}
          />
        )}

        {phase === "solve" && current && (
          <SolveView
            variant={current}
            index={index}
            total={variants.length}
            userAnswer={answers[current.id]}
            graded={!!graded[current.id]}
            correctCount={correctCount}
            onSelect={selectChoice}
            onInput={(val) =>
              setAnswers((p) => ({ ...p, [current.id]: val }))
            }
            onGrade={gradeCurrent}
            onNext={goNext}
            onPrev={() => setIndex((i) => Math.max(0, i - 1))}
          />
        )}

        {phase === "result" && (
          <ResultView
            variants={variants}
            answers={answers}
            correctCount={correctCount}
            stats={stats}
            accuracy={accuracy}
            onRestart={restart}
            onNew={newSet}
          />
        )}
      </main>

      {/* 슬림 푸터 — 무료 광고 운영 고지 + 개인정보처리방침(AdSense 요건) */}
      <footer className="relative mx-auto max-w-3xl px-5 pb-8 pt-2">
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200 pt-5 text-[12px] text-slate-400 sm:flex-row">
          <span>무료 자습은 광고로 운영됩니다 · © 2026 문제팩토리</span>
          <span className="flex items-center gap-3">
            <Link
              href="/terms"
              className="cursor-pointer text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="cursor-pointer text-slate-500 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900"
            >
              개인정보처리방침
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ----------------------------- 설정 화면 ----------------------------- */

function SetupView(props: {
  subject: Subject;
  setSubject: (s: Subject) => void;
  unitId: string | undefined;
  setUnitId: (id: string | undefined) => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  qType: QuestionType;
  setQType: (t: QuestionType) => void;
  count: number;
  setCount: (n: number) => void;
  topic: string;
  setTopic: (s: string) => void;
  loading: boolean;
  error: string | null;
  stats: StudyStats;
  accuracy: number;
  dday: number | null;
  todaySolved: number;
  streakDays: number;
  onStart: () => void;
}) {
  const {
    subject, setSubject, unitId, setUnitId, difficulty, setDifficulty, qType, setQType,
    count, setCount, topic, setTopic, loading, error, stats, accuracy, dday, todaySolved, streakDays, onStart,
  } = props;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[12px] font-medium text-indigo-700">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          문제집 살 돈 걱정 없이, 공부할 부분만 넣으세요
        </div>
        <h1 className="font-serif text-[30px] font-bold leading-tight text-slate-900 break-keep text-balance">
          공부할 주제를 넣으면
          <br />
          <CircledWord className="text-indigo-600">수능형 문제</CircledWord>로 풀어드려요
        </h1>
        <p className="mt-2 text-[14px] text-slate-500">
          개념·단원·틀린 문제를 입력하면 바로 풀 수 있는 문제를 만들어 채점·해설까지.
        </p>
      </div>

      <StudyHud dday={dday} todaySolved={todaySolved} streakDays={streakDays} />

      {stats.sets > 0 && (
        <div className="flex items-center justify-center gap-5 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-center text-[13px] shadow-sm">
          <div>
            <div className="font-mono text-[18px] font-bold text-indigo-600">{stats.totalSolved}</div>
            <div className="text-[11px] text-slate-500">푼 문제</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="font-mono text-[18px] font-bold text-emerald-600">{accuracy}%</div>
            <div className="text-[11px] text-slate-500">정답률</div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <div className="font-mono text-[18px] font-bold text-slate-700">{stats.sets}</div>
            <div className="text-[11px] text-slate-500">학습 세트</div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
        {/* 과목 */}
        <Label>과목</Label>
        <div className="mb-4 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <Pill
              key={s.id}
              active={subject === s.id}
              onClick={() => {
                setSubject(s.id);
                setUnitId(undefined); // 과목 변경 시 단원 초기화
              }}
            >
              {s.label}
            </Pill>
          ))}
        </div>

        {/* 출제 단원(선택) — 교육과정 정합 */}
        <div className="mb-4">
          <Label>출제 단원 (선택)</Label>
          <UnitPicker subject={subject} value={unitId} onChange={setUnitId} size="compact" />
        </div>

        {/* 주제 입력 */}
        <Label>공부할 주제 · 개념 · 문제</Label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          rows={4}
          placeholder="예) 이차방정식 근의 공식 / 광합성 명반응과 암반응 / 빈칸 추론 연습"
          className="mb-4 w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />

        {/* 난이도 + 유형 */}
        <div className="mb-4 grid grid-cols-2 gap-4">
          <div>
            <Label>난이도</Label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <Pill key={d.id} active={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                  {d.label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <Label>유형</Label>
            <div className="flex gap-2">
              {QUESTION_TYPES.map((t) => (
                <Pill key={t.id} active={qType === t.id} onClick={() => setQType(t.id)}>
                  {t.label}
                </Pill>
              ))}
            </div>
          </div>
        </div>

        {/* 문항 수 */}
        <Label>문항 수</Label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCount(Math.max(1, count - 1))}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="문항 수 줄이기"
          >
            −
          </button>
          <span className="w-10 text-center font-mono text-[18px] font-bold text-slate-800">{count}</span>
          <button
            type="button"
            onClick={() => setCount(Math.min(10, count + 1))}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
            aria-label="문항 수 늘리기"
          >
            +
          </button>
          <span className="text-[12px] text-slate-400">1~10개</span>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] text-rose-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={loading}
          className="mt-5 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              문제 만드는 중…
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4" aria-hidden />
              문제 풀기 시작
            </>
          )}
        </button>
      </div>

      <AdSlot label="홈 배너" slot={AD_SLOTS.studyTop} />
    </div>
  );
}

/* ----------------------------- 풀이 화면 ----------------------------- */

function SolveView(props: {
  variant: Variant;
  index: number;
  total: number;
  userAnswer: string | undefined;
  graded: boolean;
  correctCount: number;
  onSelect: (label: string) => void;
  onInput: (val: string) => void;
  onGrade: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const {
    variant: v, index, total, userAnswer, graded, correctCount,
    onSelect, onInput, onGrade, onNext, onPrev,
  } = props;
  const correct = graded && isCorrect(v, userAnswer);
  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <div className="space-y-5">
      {/* 진행 바 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-[12px] text-slate-500">
          <span className="font-medium text-slate-700">
            문제 {index + 1} <span className="text-slate-400">/ {total}</span>
          </span>
          <span>
            맞은 개수 <span className="font-mono font-bold text-emerald-600">{correctCount}</span>
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 font-mono text-[13px] font-bold text-white">
            {index + 1}
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
            {DIFFICULTIES.find((d) => d.id === v.difficulty)?.label} ·{" "}
            {QUESTION_TYPES.find((t) => t.id === v.type)?.label}
          </span>
        </div>

        {v.passage && (
          <div className="mb-4 whitespace-pre-line rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-[14px] leading-relaxed text-slate-700">
            {v.passage}
          </div>
        )}

        <p className="mb-4 whitespace-pre-line text-[16px] font-medium leading-relaxed text-slate-900">
          {v.stem}
        </p>

        {/* 객관식 */}
        {v.type === "multiple_choice" && v.choices && (
          <div className="space-y-2">
            {v.choices.map((c) => {
              const picked = userAnswer === c.label;
              const isAns = graded && c.label === v.answer;
              const isWrongPick = graded && picked && c.label !== v.answer;
              return (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => onSelect(c.label)}
                  disabled={graded}
                  className={`flex w-full items-start gap-2.5 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                    graded ? "cursor-default" : "cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/50"
                  } ${
                    isAns
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : isWrongPick
                        ? "border-rose-300 bg-rose-50 text-rose-900"
                        : picked
                          ? "border-indigo-400 bg-indigo-50 text-indigo-900"
                          : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span className="font-mono font-semibold">{c.label}</span>
                  <span className="flex-1">{c.text}</span>
                  {isAns && <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />}
                  {isWrongPick && <X className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />}
                </button>
              );
            })}
          </div>
        )}

        {/* 단답형 */}
        {v.type === "short_answer" && (
          <div>
            <input
              value={userAnswer ?? ""}
              onChange={(e) => onInput(e.target.value)}
              disabled={graded}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !graded) onGrade();
              }}
              placeholder="정답을 입력하세요"
              className={`w-full rounded-xl border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 ${
                graded
                  ? correct
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                    : "border-rose-300 bg-rose-50 text-rose-900"
                  : "border-slate-200 bg-white text-slate-800 focus:border-indigo-400 focus:ring-indigo-100"
              }`}
            />
            {graded && (
              <div className="mt-2 text-[13px]">
                정답: <span className="font-semibold text-emerald-700">{v.answer}</span>
              </div>
            )}
          </div>
        )}

        {/* 채점 결과 + 해설 */}
        {graded && (
          <div className="mt-4 space-y-3">
            <div
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[14px] font-semibold ${
                correct ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {correct ? (
                <>
                  <Check className="h-4 w-4" aria-hidden /> 정답이에요!
                </>
              ) : (
                <>
                  <X className="h-4 w-4" aria-hidden /> 아쉬워요. 정답은 {v.answer}
                </>
              )}
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-indigo-700">
                <BookOpen className="h-3.5 w-3.5" aria-hidden /> 해설
              </div>
              <p className="whitespace-pre-line text-[14px] leading-relaxed text-slate-700">
                {v.explanation}
              </p>
            </div>
          </div>
        )}

        {/* 액션 */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={index === 0}
            className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> 이전
          </button>

          {!graded ? (
            <button
              type="button"
              onClick={onGrade}
              disabled={!userAnswer?.trim()}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:px-8"
            >
              채점하기
            </button>
          ) : (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-[15px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-opacity hover:opacity-95 sm:flex-none sm:px-8"
            >
              {index < total - 1 ? (
                <>
                  다음 문제 <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              ) : (
                <>
                  결과 보기 <Trophy className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 문제 사이 광고 (3번째마다) */}
      {(index + 1) % 3 === 0 && <AdSlot label="문제 사이" slot={AD_SLOTS.studyInline} />}
    </div>
  );
}

/* ----------------------------- 결과 화면 ----------------------------- */

function ResultView(props: {
  variants: Variant[];
  answers: Record<string, string>;
  correctCount: number;
  stats: StudyStats;
  accuracy: number;
  onRestart: () => void;
  onNew: () => void;
}) {
  const { variants, answers, correctCount, stats, accuracy, onRestart, onNew } = props;
  const total = variants.length;
  const rate = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const msg =
    rate >= 80 ? "훌륭해요! 이 단원은 자신감 가져도 좋아요." : rate >= 50 ? "절반은 넘었어요. 틀린 문제 해설을 다시 볼까요?" : "괜찮아요. 해설을 보고 한 번 더 풀면 분명 올라요.";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white/85 p-7 text-center shadow-sm backdrop-blur-sm">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 shadow-md shadow-indigo-600/25">
          <Trophy className="h-7 w-7 text-white" aria-hidden />
        </div>
        <div className="font-serif text-[40px] font-bold leading-none text-slate-900">
          {correctCount}
          <span className="text-[22px] text-slate-400"> / {total}</span>
        </div>
        <div className="mt-1 font-mono text-[15px] font-semibold text-indigo-600">정답률 {rate}%</div>
        <p className="mt-2 text-[14px] text-slate-500">{msg}</p>
      </div>

      <AdSlot label="결과" slot={AD_SLOTS.studyResult} />

      {/* 문제별 복습 */}
      <div className="space-y-2">
        <div className="px-1 text-[13px] font-semibold text-slate-500">문제별 복습</div>
        {variants.map((v, i) => {
          const ok = isCorrect(v, answers[v.id]);
          return (
            <div
              key={v.id}
              className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-bold ${
                    ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[14px] font-medium text-slate-800">{v.stem}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span className={ok ? "text-emerald-600" : "text-rose-500"}>
                      {ok ? "정답" : "오답"}
                    </span>
                    <span className="text-slate-400">
                      내 답 {answers[v.id] || "—"} · 정답 {v.answer}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> 다시 풀기
        </button>
        <button
          type="button"
          onClick={onNew}
          className="inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-3 text-[14px] font-semibold text-white shadow-sm shadow-indigo-600/25 transition-opacity hover:opacity-95"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> 새 문제 풀기
        </button>
      </div>

      <div className="pb-4 text-center text-[12px] text-slate-400">
        지금까지 {stats.totalSolved}문제 · 평균 정답률 {accuracy}%
      </div>
    </div>
  );
}

/* ----------------------------- 작은 UI 조각 ----------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[12px] font-semibold text-slate-500">{children}</div>;
}

/* D-day + 오늘 푼 문제 수 + 연속 학습일 — 학생 동기부여 슬림 HUD(타인 비교 없이 본인 진척만) */
function StudyHud({
  dday,
  todaySolved,
  streakDays,
}: {
  dday: number | null;
  todaySolved: number;
  streakDays: number;
}) {
  if (dday === null) return null; // 클라이언트 effect 계산 전 — 깜빡임 방지
  const ddayLabel = dday > 0 ? `D-${dday}` : dday === 0 ? "D-DAY" : "수고했어요";
  return (
    <div className="mx-auto flex w-fit flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-white/70 px-4 py-2.5 text-[13px] shadow-sm backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        <CalendarDays className="h-4 w-4 text-redpen" aria-hidden />
        <span className="font-medium text-slate-700">{SUNEUNG.year} 수능</span>
        <span className="font-mono font-bold text-redpen">{ddayLabel}</span>
      </span>
      <span className="h-4 w-px bg-slate-200" aria-hidden />
      <span className="text-slate-600">
        오늘 푼 문제 <span className="font-mono font-bold text-emerald-600">{todaySolved}</span>
      </span>
      {streakDays > 0 && (
        <>
          <span className="h-4 w-px bg-slate-200" aria-hidden />
          <span className="flex items-center gap-1 text-slate-600" title="매일 한 세트씩 풀면 이어져요">
            <Flame className="h-4 w-4 text-orange-500" aria-hidden />
            연속 <span className="font-mono font-bold text-orange-600">{streakDays}</span>일
          </span>
        </>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
