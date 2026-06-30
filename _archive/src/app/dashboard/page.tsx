"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

const PROJECTS = [
  {
    id: "proj-1",
    name: "쿠폰 관리 SaaS",
    status: "완성",
    statusColor: "#10B981",
    step: "QA 완료",
    date: "2026.06.03",
    desc: "기획 → 디자인 → 개발 → QA 전체 파이프라인 완료",
  },
  {
    id: "proj-2",
    name: "부동산 매물 플랫폼",
    status: "개발 중",
    statusColor: "#2563EB",
    step: "개발팀 작업 중",
    date: "2026.06.04",
    desc: "디자인 스펙 완료, 프론트·백엔드 병렬 개발 진행 중",
  },
  {
    id: "proj-3",
    name: "1인 독서 모임 앱",
    status: "기획 중",
    statusColor: "#7C3AED",
    step: "기획팀 라운드 2",
    date: "2026.06.05",
    desc: "창의기획자·비평기획자 종합 단계",
  },
];

const QUICK_ACTIONS = [
  {
    label: "/기획",
    desc: "아이디어를 기획서로",
    color: "from-violet-600/20 to-purple-600/20",
    border: "border-violet-500/25",
    text: "text-violet-400",
  },
  {
    label: "/디자인",
    desc: "UX·UI 스펙 작성",
    color: "from-pink-600/20 to-rose-600/20",
    border: "border-pink-500/25",
    text: "text-pink-400",
  },
  {
    label: "/개발",
    desc: "코드 자동 생성",
    color: "from-blue-600/20 to-cyan-600/20",
    border: "border-blue-500/25",
    text: "text-blue-400",
  },
  {
    label: "/QA",
    desc: "버그 자동 검출",
    color: "from-emerald-600/20 to-teal-600/20",
    border: "border-emerald-500/25",
    text: "text-emerald-400",
  },
];

const SCOPE_OPTIONS: { label: string; stages?: string }[] = [
  { label: "기획 + 디자인 + 개발 + QA" }, // 전체 파이프라인
  { label: "기획만", stages: "plan" },
  { label: "디자인만", stages: "design" },
  { label: "개발만", stages: "dev" },
];

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [scope, setScope] = useState<string>("기획 + 디자인 + 개발 + QA");

  function launchProject() {
    const topic = newTopic.trim();
    if (!topic) return;
    const opt = SCOPE_OPTIONS.find((o) => o.label === scope);
    const params = new URLSearchParams({ topic });
    if (opt?.stages) params.set("stages", opt.stages);
    router.push(`/dashboard/project/new?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0A0A0F]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 cursor-pointer">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            </div>
            <span className="text-white font-bold tracking-tight">팀메이크</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-xs text-white/40">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              이번 달 3 / 무제한 프로젝트
            </div>
            <button className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer" aria-label="프로필">
              P
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* New project CTA */}
        <div className="relative rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-[#13131A] to-[#13131A] p-8 mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 rounded-full blur-[80px] pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <h1 className="text-2xl font-bold text-white mb-2">안녕하세요, PM님</h1>
            <p className="text-white/50 text-sm mb-6">새 프로젝트를 시작하거나 진행 중인 프로젝트를 이어가세요.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-violet-500/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              새 프로젝트 시작
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <section className="mb-10">
          <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">빠른 실행</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <button
                key={a.label}
                onClick={() => setShowNewModal(true)}
                className={`p-4 rounded-xl border ${a.border} bg-gradient-to-br ${a.color} text-left transition-all duration-200 hover:scale-[1.02] cursor-pointer group`}
              >
                <p className={`font-bold text-base mb-1 font-mono ${a.text}`}>{a.label}</p>
                <p className="text-white/40 text-xs">{a.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Recent projects */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white/50 text-xs font-semibold uppercase tracking-widest">최근 프로젝트</h2>
            <button className="text-white/30 hover:text-white/60 text-xs transition-colors duration-200 cursor-pointer">전체 보기</button>
          </div>

          <div className="flex flex-col gap-3">
            {PROJECTS.map((p) => (
              <Link
                key={p.id}
                href={`/dashboard/project/${p.id}`}
                className="flex items-center gap-4 p-5 rounded-xl border border-white/[0.07] bg-[#13131A] hover:border-white/[0.15] hover:bg-[#16161F] transition-all duration-200 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-semibold text-sm truncate">{p.name}</h3>
                    <span
                      className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{ color: p.statusColor, background: `${p.statusColor}18`, border: `1px solid ${p.statusColor}30` }}
                    >
                      {p.status}
                    </span>
                  </div>
                  <p className="text-white/35 text-xs truncate">{p.desc}</p>
                </div>

                <div className="hidden md:flex flex-col items-end gap-1 shrink-0">
                  <p className="text-white/30 text-xs">{p.date}</p>
                  <p className="text-white/20 text-xs">{p.step}</p>
                </div>

                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/20 group-hover:text-white/50 transition-colors duration-200 shrink-0" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </Link>
            ))}
          </div>
        </section>
      </main>

      {/* New Project Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setShowNewModal(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#13131A] p-7 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">새 프로젝트 시작</h2>
              <button onClick={() => setShowNewModal(false)} className="text-white/40 hover:text-white transition-colors cursor-pointer" aria-label="닫기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <label htmlFor="project-topic" className="block text-white/50 text-sm mb-2">어떤 서비스를 만들고 싶으신가요?</label>
            <input
              id="project-topic"
              type="text"
              value={newTopic}
              onChange={(e) => setNewTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && launchProject()}
              placeholder="예: 쿠폰 관리 SaaS, 부동산 매물 플랫폼..."
              autoFocus
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm mb-6 outline-none focus:border-violet-500/60 transition-colors duration-200"
            />

            <div className="grid grid-cols-2 gap-3 mb-6">
              {SCOPE_OPTIONS.map((opt) => {
                const selected = scope === opt.label;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setScope(opt.label)}
                    className={[
                      "p-3 rounded-xl border text-xs text-left transition-all duration-200 cursor-pointer",
                      selected
                        ? "border-violet-500/60 bg-violet-600/15 text-white"
                        : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.2] hover:bg-white/[0.06] text-white/60 hover:text-white",
                    ].join(" ")}
                  >
                    {!opt.stages && (
                      <span className="block text-[10px] text-violet-400 font-semibold mb-1">추천 /풀파이프</span>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={launchProject}
              disabled={!newTopic.trim()}
              className="block w-full text-center bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 cursor-pointer shadow-lg shadow-violet-500/20"
            >
              AI 팀 실행하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
