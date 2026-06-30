"use client";

import { useState, useId } from "react";

// /admin은 i18n 제외 — 영문 단일 운영
// 실제 Supabase Auth 연동은 API설계자 담당. 여기는 폼 UI만.
// noindex: robots.txt + generateMetadata에서 처리

type AdminView = "login" | "add-model";

interface LoginFormState {
  email: string;
  password: string;
  error: string | null;
  isLoading: boolean;
}

interface ModelFormState {
  name: string;
  slug: string;
  provider: string;
  category: string;
  releaseDate: string;
  inputPrice: string;
  outputPrice: string;
  contextWindow: string;
  sourceUrl: string;
  sourceType: "t1" | "t2" | "t3";
  reliability: "high" | "mid" | "low";
  lastVerified: string;
  successMsg: string | null;
  errorMsg: string | null;
  isSubmitting: boolean;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [view, setView] = useState<AdminView>("login");
  const loginEmailId = useId();
  const loginPasswordId = useId();

  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
    error: null,
    isLoading: false,
  });

  const today = new Date().toISOString().split("T")[0];

  const [modelForm, setModelForm] = useState<ModelFormState>({
    name: "",
    slug: "",
    provider: "",
    category: "LLM",
    releaseDate: "",
    inputPrice: "",
    outputPrice: "",
    contextWindow: "",
    sourceUrl: "",
    sourceType: "t1",
    reliability: "high",
    lastVerified: today,
    successMsg: null,
    errorMsg: null,
    isSubmitting: false,
  });

  // 로그인 처리 (Supabase Auth — 실제 연동은 API설계자 담당)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginForm((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // TODO: API설계자가 구현한 Supabase Auth 연동 훅으로 교체
      // const { error } = await supabase.auth.signInWithPassword({ email, password });
      // 임시: 폼 제출만 처리
      await new Promise((r) => setTimeout(r, 800));
      setIsAuthenticated(true);
      setView("add-model");
    } catch {
      setLoginForm((prev) => ({
        ...prev,
        error: "Invalid credentials. Please try again.",
        isLoading: false,
      }));
    }
  };

  const handleModelNameChange = (name: string) => {
    setModelForm((prev) => ({
      ...prev,
      name,
      slug: slugify(name),
    }));
  };

  // 모델 저장 (Supabase INSERT — 실제 연동은 API설계자 담당)
  const handleModelSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModelForm((prev) => ({ ...prev, isSubmitting: true, errorMsg: null, successMsg: null }));

    try {
      // TODO: API설계자가 구현한 POST /api/v1/models 엔드포인트 호출로 교체
      await new Promise((r) => setTimeout(r, 1000));
      setModelForm((prev) => ({
        ...prev,
        isSubmitting: false,
        successMsg: "Model saved successfully.",
        name: "",
        slug: "",
        provider: "",
        inputPrice: "",
        outputPrice: "",
        contextWindow: "",
        sourceUrl: "",
      }));
    } catch {
      setModelForm((prev) => ({
        ...prev,
        isSubmitting: false,
        errorMsg: "Failed to save. Please try again.",
      }));
    }
  };

  // 미인증 상태 — 로그인 폼
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-6 text-2xl font-bold text-center">Tier.gg Admin</h1>

          <form
            onSubmit={handleLogin}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
            aria-label="Admin login form"
            noValidate
          >
            <h2 className="mb-4 text-lg font-semibold">Admin Login</h2>

            <div className="flex flex-col gap-1 mb-4">
              <label htmlFor={loginEmailId} className="text-sm font-medium">
                Email <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <input
                id={loginEmailId}
                type="email"
                value={loginForm.email}
                onChange={(e) =>
                  setLoginForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
                aria-required="true"
                autoComplete="email"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex flex-col gap-1 mb-6">
              <label htmlFor={loginPasswordId} className="text-sm font-medium">
                Password <span aria-hidden="true" className="text-destructive">*</span>
              </label>
              <input
                id={loginPasswordId}
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((prev) => ({ ...prev, password: e.target.value }))
                }
                required
                aria-required="true"
                autoComplete="current-password"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {loginForm.error && (
              <p
                role="alert"
                aria-live="polite"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {loginForm.error}
              </p>
            )}

            <button
              type="submit"
              disabled={loginForm.isLoading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {loginForm.isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 인증 후 — 관리자 대시보드
  return (
    <div className="flex min-h-screen bg-background">
      {/* 사이드바 */}
      <aside className="w-56 flex-shrink-0 border-r border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <span className="font-bold text-sm">Tier.gg Admin</span>
          <button
            type="button"
            onClick={() => setIsAuthenticated(false)}
            className="text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Log out
          </button>
        </div>

        <nav aria-label="Admin navigation">
          <ul className="p-2" role="list">
            {[
              { key: "add-model", label: "Add New Model" },
              { key: "model-list", label: "Model List" },
              { key: "benchmarks", label: "Manual Benchmarks" },
              { key: "changelog", label: "Write Changelog" },
              { key: "sources", label: "Source Management" },
            ].map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setView(item.key as AdminView)}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    view === item.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                  aria-current={view === item.key ? "page" : undefined}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto p-8">
        <h1 className="mb-6 text-2xl font-bold">Add New Model</h1>

        {/* 성공/에러 토스트 */}
        {modelForm.successMsg && (
          <div
            role="alert"
            aria-live="polite"
            className="mb-4 flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-700 dark:text-green-400"
          >
            <span>{modelForm.successMsg}</span>
            <button
              type="button"
              onClick={() => setModelForm((prev) => ({ ...prev, successMsg: null }))}
              aria-label="Dismiss success message"
              className="ml-4 text-green-600 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ✕
            </button>
          </div>
        )}
        {modelForm.errorMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            <span>{modelForm.errorMsg}</span>
            <button
              type="button"
              onClick={() => setModelForm((prev) => ({ ...prev, errorMsg: null }))}
              aria-label="Dismiss error message"
              className="ml-4 hover:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ✕
            </button>
          </div>
        )}

        {/* 모델 등록 폼 */}
        <form
          onSubmit={handleModelSave}
          className="max-w-2xl rounded-xl border border-border bg-card p-6 shadow-sm"
          aria-label="Add new model form"
          noValidate
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* 모델명 */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium">
                Official Model Name
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="text"
                value={modelForm.name}
                onChange={(e) => handleModelNameChange(e.target.value)}
                required
                aria-required="true"
                placeholder="e.g. GPT-4o"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 슬러그 (자동) */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Slug (auto-generated)
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="text"
                value={modelForm.slug}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, slug: e.target.value }))
                }
                required
                aria-required="true"
                placeholder="e.g. gpt-4o"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 제공사 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Provider
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="text"
                value={modelForm.provider}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, provider: e.target.value }))
                }
                required
                aria-required="true"
                placeholder="e.g. OpenAI"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 카테고리 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Category
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <select
                value={modelForm.category}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="LLM">LLM</option>
                <option value="Image">Image Generation</option>
                <option value="Code">Code</option>
                <option value="Audio">Audio</option>
              </select>
            </div>

            {/* 출시일 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Release Date</label>
              <input
                type="date"
                value={modelForm.releaseDate}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, releaseDate: e.target.value }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 입력 가격 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Input Price ($/1M tokens)
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={modelForm.inputPrice}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, inputPrice: e.target.value }))
                }
                required
                aria-required="true"
                placeholder="e.g. 2.50"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 출력 가격 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Output Price ($/1M tokens)
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={modelForm.outputPrice}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, outputPrice: e.target.value }))
                }
                required
                aria-required="true"
                placeholder="e.g. 10.00"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 컨텍스트 창 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Context Window (K tokens)</label>
              <input
                type="number"
                min="0"
                value={modelForm.contextWindow}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, contextWindow: e.target.value }))
                }
                placeholder="e.g. 128"
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 출처 URL */}
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-sm font-medium">
                Source URL
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="url"
                value={modelForm.sourceUrl}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, sourceUrl: e.target.value }))
                }
                required
                aria-required="true"
                placeholder="https://..."
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 출처 유형 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Source Type
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <select
                value={modelForm.sourceType}
                onChange={(e) =>
                  setModelForm((prev) => ({
                    ...prev,
                    sourceType: e.target.value as ModelFormState["sourceType"],
                  }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="t1">T1 — Official</option>
                <option value="t2">T2 — External Benchmark</option>
                <option value="t3">T3 — Community</option>
              </select>
            </div>

            {/* 신뢰도 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Reliability
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <select
                value={modelForm.reliability}
                onChange={(e) =>
                  setModelForm((prev) => ({
                    ...prev,
                    reliability: e.target.value as ModelFormState["reliability"],
                  }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="high">High ●</option>
                <option value="mid">Medium ○</option>
                <option value="low">Low △</option>
              </select>
            </div>

            {/* 최종 확인일 */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Last Verified (default: today)
                <span aria-hidden="true" className="text-destructive ml-1">*</span>
              </label>
              <input
                type="date"
                value={modelForm.lastVerified}
                onChange={(e) =>
                  setModelForm((prev) => ({ ...prev, lastVerified: e.target.value }))
                }
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* 저장 / 취소 */}
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={modelForm.isSubmitting}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {modelForm.isSubmitting
                ? "Saving..."
                : "Save & Auto-generate Changelog"}
            </button>
            <button
              type="button"
              onClick={() =>
                setModelForm((prev) => ({
                  ...prev,
                  name: "",
                  slug: "",
                  provider: "",
                  inputPrice: "",
                  outputPrice: "",
                  contextWindow: "",
                  sourceUrl: "",
                }))
              }
              className="rounded-lg border border-input px-5 py-2.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* 최근 변경 이력 스켈레톤 (DB 연동 전) */}
        <section className="mt-10" aria-labelledby="recent-changes-heading">
          <h2 id="recent-changes-heading" className="mb-4 text-lg font-bold">
            Recent Changes (last 10)
          </h2>
          <ul className="space-y-2 text-sm" role="list">
            {["2026-05-28  GPT-4o price updated", "2026-05-26  Claude Opus 5 added"].map(
              (item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <span className="text-muted-foreground">{item}</span>
                  <button
                    type="button"
                    className="ml-4 text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Revert: ${item}`}
                  >
                    Revert
                  </button>
                </li>
              )
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}
