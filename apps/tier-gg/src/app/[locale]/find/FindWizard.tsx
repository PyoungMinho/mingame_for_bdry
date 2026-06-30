"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { mockModels } from "@/lib/data/mock-models";

// 위저드 분류 매트릭스 — UX 스펙 섹션 5 기준
const TASK_MATRIX: Record<string, string[]> = {
  developer: ["coding", "dataAnalysis", "summarization"],
  marketer: ["copywriting", "image", "dataAnalysis", "translation", "summarization"],
  designer: ["copywriting", "image", "summarization"],
  student: ["coding", "copywriting", "dataAnalysis", "translation", "summarization"],
  other: ["coding", "copywriting", "image", "dataAnalysis", "translation", "summarization"],
};

const JOBS = ["developer", "marketer", "designer", "student", "other"] as const;
const TASKS = ["coding", "copywriting", "image", "dataAnalysis", "translation", "summarization"] as const;
const BUDGETS = ["free", "low", "mid", "unlimited"] as const;

type Job = (typeof JOBS)[number];
type Task = (typeof TASKS)[number];
type Budget = (typeof BUDGETS)[number];

const JOB_EMOJIS: Record<Job, string> = {
  developer: "👨‍💻",
  marketer: "📣",
  designer: "🎨",
  student: "📚",
  other: "⬡",
};

interface WizardState {
  step: 0 | 1 | 2 | 3; // 0=직무, 1=작업, 2=예산, 3=결과
  job: Job | null;
  task: Task | null;
  budget: Budget | null;
  isCalculating: boolean;
}

interface FindWizardProps {
  locale: string;
}

// 단순 추천 알고리즘 (DB 연동 전 mock 기반)
// 가중치: 벤치마크 40% + 가격효율 40% + 컨텍스트 10% + 다국어 10%
function recommendModels(job: Job, task: Task, budget: Budget) {
  const budgetMap: Record<Budget, number | null> = {
    free: 0,
    low: 10,
    mid: 50,
    unlimited: null,
  };
  const maxBudget = budgetMap[budget];

  return mockModels
    .filter((model) => {
      if (maxBudget === 0 && (model.attrs.priceInput ?? 0) !== 0) return false;
      if (maxBudget != null && maxBudget > 0 && model.attrs.priceInput != null) {
        // 단순화: priceInput($/1M) 기준 — 실제 월 비용과 다름, MVP 임시 로직
        if (model.attrs.priceInput > maxBudget) return false;
      }
      return true;
    })
    .map((model) => {
      // 가중치 점수 계산 (0~100 범위 정규화 생략, 상대적 비교)
      const benchScore = (model.scores.mmlu ?? 0) * 0.4;
      const priceScore =
        model.attrs.priceInput != null && model.attrs.priceInput > 0
          ? (1 / model.attrs.priceInput) * 10 * 0.4
          : 0.4; // 무료면 최대 점수
      const ctxScore = ((model.attrs.contextWindow ?? 0) / 2000) * 0.1;
      const multiScore = model.attrs.modality.includes("text") ? 0.1 : 0;
      return { model, score: benchScore + priceScore + ctxScore + multiScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => r.model);
}

export default function FindWizard({ locale }: FindWizardProps) {
  const t = useTranslations("find");
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 쿼리스트링에서 초기 상태 복원 (공유 URL 지원) — 유효 값만 통과
  const rawJob = searchParams.get("job");
  const rawTask = searchParams.get("task");
  const rawBudget = searchParams.get("budget");
  const initialJob: Job | null =
    rawJob && (JOBS as readonly string[]).includes(rawJob) ? (rawJob as Job) : null;
  const initialTask: Task | null =
    rawTask && (TASKS as readonly string[]).includes(rawTask) ? (rawTask as Task) : null;
  const initialBudget: Budget | null =
    rawBudget && (BUDGETS as readonly string[]).includes(rawBudget)
      ? (rawBudget as Budget)
      : null;
  const initialStep =
    initialJob && initialTask && initialBudget
      ? 3
      : initialJob && initialTask
      ? 2
      : initialJob
      ? 1
      : 0;

  const [state, setState] = useState<WizardState>({
    step: initialStep as WizardState["step"],
    job: initialJob,
    task: initialTask,
    budget: initialBudget,
    isCalculating: false,
  });

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  // URL 동기화
  const updateUrl = useCallback(
    (job: Job | null, task: Task | null, budget: Budget | null) => {
      const params = new URLSearchParams();
      if (job) params.set("job", job);
      if (task) params.set("task", task);
      if (budget) params.set("budget", budget);
      const query = params.toString();
      router.replace(
        `${localePath("/find")}${query ? `?${query}` : ""}`,
        { scroll: false }
      );
    },
    [locale, router]
  );

  const selectJob = useCallback(
    (job: Job) => {
      setState((prev) => ({ ...prev, job, task: null, step: 1 }));
      updateUrl(job, null, null);
    },
    [updateUrl]
  );

  const selectTask = useCallback(
    (task: Task) => {
      setState((prev) => ({ ...prev, task, step: 2 }));
      updateUrl(state.job, task, null);
    },
    [state.job, updateUrl]
  );

  const selectBudget = useCallback(
    (budget: Budget) => {
      setState((prev) => ({ ...prev, budget, isCalculating: true }));
      updateUrl(state.job, state.task, budget);
      // 위저드 결과 계산 지연 (UX: "찾는 중..." 메시지 노출)
      setTimeout(() => {
        setState((prev) => ({ ...prev, isCalculating: false, step: 3 }));
      }, 800);
    },
    [state.job, state.task, updateUrl]
  );

  const restart = useCallback(() => {
    setState({ step: 0, job: null, task: null, budget: null, isCalculating: false });
    router.replace(localePath("/find"), { scroll: false });
  }, [locale, router]);

  const goBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(0, prev.step - 1) as WizardState["step"],
    }));
  }, []);

  const progressSteps = [
    { key: "job", label: t("progress.job") },
    { key: "task", label: t("progress.task") },
    { key: "budget", label: t("progress.budget") },
    { key: "result", label: t("progress.result") },
  ];

  const recommendations =
    state.step === 3 && state.job && state.task && state.budget
      ? recommendModels(state.job, state.task, state.budget)
      : [];

  return (
    <div className="mx-auto max-w-[800px] px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-extrabold">{t("pageTitle")}</h1>
        <p className="mt-2 text-muted-foreground">{t("pageDescription")}</p>
      </div>

      {/* 진행 표시기 */}
      <nav aria-label="Wizard progress" className="mb-10">
        <ol
          className="flex items-center justify-center gap-0"
          role="progressbar"
          aria-valuenow={state.step}
          aria-valuemax={3}
          aria-valuetext={progressSteps[state.step].label}
        >
          {progressSteps.map((s, i) => (
            <li key={s.key} className="flex items-center">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  i < state.step
                    ? "bg-primary text-primary-foreground"
                    : i === state.step
                    ? "border-2 border-primary text-primary"
                    : "border border-muted-foreground/40 text-muted-foreground/60"
                }`}
                aria-current={i === state.step ? "step" : undefined}
              >
                {i + 1}
              </span>
              <span
                className={`ml-2 text-xs font-medium ${
                  i === state.step ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
              {i < progressSteps.length - 1 && (
                <span className="mx-3 h-px w-8 bg-border" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* 단계 1: 직무 선택 */}
      {state.step === 0 && (
        <section aria-labelledby="step1-heading">
          <h2 id="step1-heading" className="mb-6 text-center text-lg font-semibold">
            {t("step1.question")}
          </h2>
          <ul
            className="grid grid-cols-2 gap-4 sm:grid-cols-3"
            role="list"
            aria-label="Select your role"
          >
            {JOBS.map((job) => (
              <li key={job}>
                <button
                  type="button"
                  onClick={() => selectJob(job)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectJob(job);
                  }}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border border-border bg-card p-6 transition-all hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-pressed={state.job === job}
                >
                  <span className="text-3xl" role="img" aria-label={t(`step1.${job}`)}>
                    {JOB_EMOJIS[job]}
                  </span>
                  <span className="text-sm font-medium">{t(`step1.${job}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 단계 2: 작업 선택 */}
      {state.step === 1 && state.job && (
        <section aria-labelledby="step2-heading">
          <h2 id="step2-heading" className="mb-6 text-center text-lg font-semibold">
            {t("step2.question")}
          </h2>
          <ul
            className="grid grid-cols-2 gap-3 sm:grid-cols-3"
            role="list"
            aria-label="Select your primary task"
          >
            {TASKS.map((task) => {
              const isActive = TASK_MATRIX[state.job!]?.includes(task) ?? false;
              return (
                <li key={task}>
                  <button
                    type="button"
                    onClick={() => isActive && selectTask(task)}
                    disabled={!isActive}
                    title={isActive ? undefined : t("step2.unavailableTooltip")}
                    className={`flex w-full items-center justify-center rounded-xl border p-4 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      isActive
                        ? "border-border bg-card hover:border-primary hover:shadow-md"
                        : "cursor-not-allowed border-border/40 bg-muted/40 text-muted-foreground/40"
                    } ${state.task === task ? "border-primary bg-primary/10" : ""}`}
                    aria-pressed={state.task === task}
                    aria-disabled={!isActive}
                  >
                    {t(`step2.${task}`)}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("back")}
            </button>
          </div>
        </section>
      )}

      {/* 단계 3: 예산 선택 */}
      {state.step === 2 && (
        <section aria-labelledby="step3-heading">
          <h2 id="step3-heading" className="mb-6 text-center text-lg font-semibold">
            {t("step3.question")}
          </h2>
          <ul
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="list"
            aria-label="Select your budget"
          >
            {BUDGETS.map((budget) => (
              <li key={budget}>
                <button
                  type="button"
                  onClick={() => selectBudget(budget)}
                  className="flex w-full items-center justify-center rounded-xl border border-border bg-card p-5 text-sm font-medium transition-all hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-pressed={state.budget === budget}
                >
                  {t(`step3.${budget}`)}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-start">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("back")}
            </button>
          </div>
        </section>
      )}

      {/* 계산 중 상태 */}
      {state.isCalculating && (
        <div
          className="flex flex-col items-center gap-4 py-16"
          role="status"
          aria-live="polite"
          aria-label={t("calculating")}
        >
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">{t("calculating")}</p>
        </div>
      )}

      {/* 결과 화면 */}
      {state.step === 3 && !state.isCalculating && state.job && state.task && state.budget && (
        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="mb-6 text-xl font-bold">
            {t("result.title", {
              job: t(`step1.${state.job}`),
              task: t(`step2.${state.task}`),
              budget: t(`step3.${state.budget}`),
            })}
          </h2>

          {recommendations.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center">
              <p className="text-muted-foreground">{t("result.empty")}</p>
              <button
                type="button"
                onClick={goBack}
                className="mt-4 rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t("result.adjustBudget")}
              </button>
            </div>
          ) : (
            <ol className="space-y-4" role="list" aria-label="Top 3 recommendations">
              {recommendations.map((model, i) => {
                const partner = recommendations.find((m) => m.slug !== model.slug);
                const pair = partner
                  ? [model.slug, partner.slug].sort().join("_vs_")
                  : null;
                return (
                  <li
                    key={model.slug}
                    className="flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
                      aria-label={`Rank ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold text-lg">{model.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {model.providerSlug}
                        {model.attrs.priceInput != null && ` · $${model.attrs.priceInput}/1M tokens`}
                      </p>
                      {model.scores.mmlu != null && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          MMLU: {model.scores.mmlu}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Link
                          href={localePath(`/models/${model.slug}`)}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {t("result.viewDetail")}
                        </Link>
                        {pair && (
                          <Link
                            href={localePath(`/compare/${pair}`)}
                            className="rounded-md border border-input px-3 py-1.5 text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {t("result.addCompare")}
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {/* AD_SLOT_WIZARD_RESULT */}
          {/* AD_SLOT_WIZARD_RESULT */}
          <div className="mt-6" style={{ minHeight: "250px" }} aria-hidden="true" />

          {/* 가중치 공개 */}
          <p className="mt-6 rounded-lg bg-muted px-4 py-3 text-xs text-muted-foreground">
            {t("result.weightDisclosure")}
          </p>

          {/* 공유 + 재시작 */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("result.shareResult")}
            </button>
            <button
              type="button"
              onClick={restart}
              className="rounded-lg border border-input px-4 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {t("result.restart")}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
