"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import type { EngineEvent } from "@/lib/server/team-engine";

// ─────────────────────────────────────────────────────────────
// Static config
// ─────────────────────────────────────────────────────────────

const ALL_STAGES = [
  { id: "plan", label: "기획", sub: "3라운드 회의" },
  { id: "meeting", label: "팀장회의", sub: "방향 확정" },
  { id: "design", label: "디자인", sub: "UX·UI 스펙" },
  { id: "dev", label: "개발", sub: "병렬 개발" },
  { id: "qa", label: "QA", sub: "테스트 실행" },
  { id: "review", label: "리뷰", sub: "최종 검수" },
];

const QUICK_COMMANDS = ["/기획", "/팀장회의", "/디자인", "/개발", "/QA", "/리뷰", "/풀파이프"];

const COMMAND_STAGES: Record<string, string[] | undefined> = {
  "/기획": ["plan"],
  "/팀장회의": ["meeting"],
  "/디자인": ["design"],
  "/개발": ["dev"],
  "/QA": ["qa"],
  "/리뷰": ["review"],
  "/풀파이프": undefined, // 전체
};

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type StageStatus = "pending" | "active" | "done";
interface StageState {
  id: string;
  label: string;
  sub: string;
  status: StageStatus;
}

interface Msg {
  key: number;
  role: "system" | "agent" | "user";
  agent: string;
  color: string;
  roleLabel?: string;
  text: string;
  done: boolean;
  time: string;
}

interface DocEntry {
  stageId: string;
  name: string;
  agent: string;
  color: string;
  text: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function nowTime(): string {
  return new Date().toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function initialStages(stageIds?: string[]): StageState[] {
  const base = stageIds?.length
    ? ALL_STAGES.filter((s) => stageIds.includes(s.id))
    : ALL_STAGES;
  return base.map((s) => ({ ...s, status: "pending" as StageStatus }));
}

function parseInput(raw: string): { topic: string; stageIds?: string[]; cmd?: string } {
  const text = raw.trim();
  const firstSpace = text.indexOf(" ");
  const head = firstSpace === -1 ? text : text.slice(0, firstSpace);
  if (head in COMMAND_STAGES) {
    const rest = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
    return { topic: rest, stageIds: COMMAND_STAGES[head], cmd: head };
  }
  return { topic: text };
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────

export default function ProjectPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stages, setStages] = useState<StageState[]>(initialStages());
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const [mode, setMode] = useState<"live" | "demo" | null>(null);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState("새 프로젝트");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openDoc, setOpenDoc] = useState<DocEntry | null>(null);

  // streaming refs
  const msgsRef = useRef<Msg[]>([]);
  const agentIdxRef = useRef<Map<string, number>>(new Map());
  const keyRef = useRef(0);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const currentStageRef = useRef<string>("");
  const lastOutputRef = useRef<Map<string, { agent: string; color: string; text: string }>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // setTimeout 기반 throttle — 백그라운드 탭에서도 동작 (rAF는 throttle됨).
  // immediate=true면 즉시 반영 (메시지 시작/종료 등 중요 이벤트).
  const scheduleFlush = useCallback((immediate = false) => {
    if (immediate) {
      if (flushTimer.current) {
        clearTimeout(flushTimer.current);
        flushTimer.current = null;
      }
      setMessages([...msgsRef.current]);
      return;
    }
    if (flushTimer.current) return;
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      setMessages([...msgsRef.current]);
    }, 40);
  }, []);

  const pushSystem = useCallback((text: string) => {
    msgsRef.current.push({
      key: keyRef.current++,
      role: "system",
      agent: "시스템",
      color: "#6b7280",
      text,
      done: true,
      time: nowTime(),
    });
    scheduleFlush(true);
  }, [scheduleFlush]);

  const handleEvent = useCallback((ev: EngineEvent) => {
    switch (ev.type) {
      case "pipeline_start": {
        setMode(ev.mode);
        setStages(ev.stages.map((s) => ({ ...s, status: "pending" as StageStatus })));
        pushSystem(
          ev.mode === "demo"
            ? `데모 모드로 AI 팀을 실행합니다. (ANTHROPIC_API_KEY 설정 시 실제 Claude로 동작)`
            : `실제 Claude로 AI 팀을 실행합니다.`
        );
        break;
      }
      case "stage_start": {
        currentStageRef.current = ev.stageId;
        setStages((prev) =>
          prev.map((s) => (s.id === ev.stageId ? { ...s, status: "active" } : s))
        );
        break;
      }
      case "agent_start": {
        const idx = msgsRef.current.length;
        msgsRef.current.push({
          key: keyRef.current++,
          role: "agent",
          agent: ev.name,
          color: ev.color,
          roleLabel: ev.role,
          text: "",
          done: false,
          time: nowTime(),
        });
        agentIdxRef.current.set(ev.agentId, idx);
        scheduleFlush(true);
        break;
      }
      case "agent_delta": {
        const idx = agentIdxRef.current.get(ev.agentId);
        if (idx !== undefined && msgsRef.current[idx]) {
          msgsRef.current[idx].text += ev.text;
          scheduleFlush();
        }
        break;
      }
      case "agent_done": {
        const idx = agentIdxRef.current.get(ev.agentId);
        if (idx !== undefined && msgsRef.current[idx]) {
          const m = msgsRef.current[idx];
          m.text = ev.output;
          m.done = true;
          lastOutputRef.current.set(currentStageRef.current, {
            agent: m.agent,
            color: m.color,
            text: ev.output,
          });
        }
        agentIdxRef.current.delete(ev.agentId);
        scheduleFlush(true);
        break;
      }
      case "stage_done": {
        setStages((prev) =>
          prev.map((s) => (s.id === ev.stageId ? { ...s, status: "done" } : s))
        );
        const out = lastOutputRef.current.get(ev.stageId);
        const stageMeta = ALL_STAGES.find((s) => s.id === ev.stageId);
        if (out && stageMeta) {
          setDocs((prev) => [
            ...prev,
            {
              stageId: ev.stageId,
              name: `${stageMeta.label}-산출물.md`,
              agent: out.agent,
              color: out.color,
              text: out.text,
            },
          ]);
        }
        break;
      }
      case "pipeline_done": {
        setRunning(false);
        pushSystem("파이프라인이 완료되었습니다. 산출물을 확인하세요.");
        break;
      }
      case "error": {
        setRunning(false);
        pushSystem(`오류: ${ev.message}`);
        break;
      }
    }
  }, [pushSystem, scheduleFlush]);

  const startPipeline = useCallback(
    async (runTopic: string, stageIds?: string[]) => {
      if (!runTopic.trim()) return;
      // 이전 실행 중단
      controllerRef.current?.abort();

      // 상태 리셋
      msgsRef.current = [];
      agentIdxRef.current.clear();
      lastOutputRef.current.clear();
      currentStageRef.current = "";
      setMessages([]);
      setDocs([]);
      setStages(initialStages(stageIds));
      setTopic(runTopic);
      setRunning(true);

      const controller = new AbortController();
      controllerRef.current = controller;

      pushSystem(`주제 "${runTopic}" — AI 팀을 깨우는 중...`);

      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: runTopic, stageIds }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const detail = await res.text().catch(() => "");
          pushSystem(`요청 실패 (${res.status}). ${detail.slice(0, 200)}`);
          setRunning(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!line) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              handleEvent(JSON.parse(json) as EngineEvent);
            } catch {
              /* skip malformed frame */
            }
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          pushSystem(`스트림 오류: ${err instanceof Error ? err.message : String(err)}`);
        }
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setRunning(false);
        }
      }
    },
    [handleEvent, pushSystem]
  );

  // URL ?topic= 로 진입 시 자동 시작 (Strict Mode 재마운트 안전)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("topic");
    if (!t) return;
    const stagesParam = params.get("stages");
    const stageIds = stagesParam ? stagesParam.split(",").filter(Boolean) : undefined;
    startPipeline(decodeURIComponent(t), stageIds);
    return () => controllerRef.current?.abort();
  }, [startPipeline]);

  function handleSend() {
    if (running) {
      controllerRef.current?.abort();
      setRunning(false);
      pushSystem("실행을 중단했습니다.");
      return;
    }
    const text = input.trim();
    if (!text) return;
    const { topic: parsedTopic, stageIds } = parseInput(text);
    const effectiveTopic = parsedTopic || (topic !== "새 프로젝트" ? topic : "");
    if (!effectiveTopic) {
      pushSystem("주제를 함께 입력하세요. 예: /기획 쇼핑몰 앱");
      return;
    }
    // 사용자 메시지 표시
    msgsRef.current.push({
      key: keyRef.current++,
      role: "user",
      agent: "PM",
      color: "#F59E0B",
      text,
      done: true,
      time: nowTime(),
    });
    setInput("");
    startPipeline(effectiveTopic, stageIds);
  }

  const doneCount = stages.filter((s) => s.status === "done").length;
  const progress = stages.length ? Math.round((doneCount / stages.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0A0A0F]/90 backdrop-blur-xl">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/dashboard" className="text-white/40 hover:text-white transition-colors cursor-pointer shrink-0" aria-label="대시보드로 돌아가기">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-sm truncate">{topic}</h1>
              <p className="text-white/30 text-xs">
                {running ? "AI 팀 작업 중..." : doneCount > 0 ? `${doneCount}/${stages.length} 단계 완료` : "대기 중"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {mode && (
              <div className={[
                "items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium hidden sm:flex",
                mode === "demo"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
              ].join(" ")}>
                {mode === "demo" ? "데모 모드" : "LIVE"}
              </div>
            )}
            {running && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                실행 중
              </div>
            )}
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="hidden md:flex w-9 h-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] text-white/50 hover:text-white transition-all cursor-pointer"
              aria-label="사이드바 토글"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
        {/* ── Left Sidebar: Pipeline ── */}
        <aside className="w-52 shrink-0 border-r border-white/[0.06] bg-[#0D0D14] p-4 hidden md:flex flex-col gap-1 overflow-y-auto">
          <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-3 px-2">파이프라인</p>
          {stages.map((s, i) => {
            const done = s.status === "done";
            const active = s.status === "active";
            return (
              <div key={s.id} className="relative">
                {i < stages.length - 1 && (
                  <div className={["absolute left-[18px] top-8 w-px h-4", done ? "bg-violet-500/40" : "bg-white/[0.06]"].join(" ")} aria-hidden="true" />
                )}
                <div className={[
                  "flex items-center gap-3 px-2 py-2.5 rounded-lg",
                  active ? "bg-violet-600/15 border border-violet-500/25" : "hover:bg-white/[0.03]",
                ].join(" ")}>
                  <div className={[
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0",
                    done ? "border-violet-500 bg-violet-500" :
                    active ? "border-blue-400 bg-blue-400/10" :
                    "border-white/15 bg-transparent",
                  ].join(" ")}>
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                    ) : active ? (
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" aria-hidden="true" />
                    ) : null}
                  </div>
                  <div>
                    <p className={["text-xs font-medium", done || active ? "text-white/80" : "text-white/30"].join(" ")}>{s.label}</p>
                    <p className="text-white/25 text-[10px]">{s.sub}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </aside>

        {/* ── Center: Chat ── */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {messages.length === 0 && !running && (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/30 to-blue-600/30 border border-violet-500/20 flex items-center justify-center mb-4">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="text-white/70 font-semibold mb-1.5">AI 팀 16명이 대기 중입니다</p>
                <p className="text-white/35 text-sm max-w-sm">
                  아래에 주제를 입력하거나 <span className="font-mono text-violet-400">/풀파이프 쇼핑몰 앱</span> 같은 명령으로 전체 파이프라인을 실행하세요.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.key} className={["flex gap-3", msg.role === "user" ? "flex-row-reverse" : ""].join(" ")}>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5"
                  style={{ background: msg.color }}
                  aria-hidden="true"
                >
                  {msg.agent.slice(0, 1)}
                </div>
                <div className={["max-w-[75%] min-w-0", msg.role === "user" ? "items-end flex flex-col" : ""].join(" ")}>
                  <div className="flex items-center gap-2 mb-1.5">
                    {msg.role !== "user" && (
                      <span className="text-[11px] font-semibold" style={{ color: msg.color }}>{msg.agent}</span>
                    )}
                    {msg.roleLabel && <span className="text-white/20 text-[10px]">{msg.roleLabel}</span>}
                    <span className="text-white/20 text-[10px]">{msg.time}</span>
                  </div>
                  <div className={[
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words",
                    msg.role === "user" ? "bg-violet-600/80 text-white rounded-tr-sm" :
                    msg.role === "system" ? "bg-white/[0.04] text-white/40 text-xs italic" :
                    "bg-[#17171F] border border-white/[0.06] text-white/80 rounded-tl-sm",
                  ].join(" ")}>
                    {msg.text}
                    {msg.role === "agent" && !msg.done && (
                      <span className="inline-block w-1.5 h-3.5 ml-0.5 -mb-0.5 bg-white/50 animate-pulse align-middle" aria-hidden="true" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/[0.06] bg-[#0D0D14]">
            <div className="flex gap-2 mb-3 flex-wrap">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setInput(cmd + " ")}
                  className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 text-white/40 text-xs font-mono transition-all duration-200 cursor-pointer"
                >
                  {cmd}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="명령어를 입력하세요... (예: /기획 쇼핑몰 앱)"
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white placeholder-white/20 text-sm outline-none focus:border-violet-500/50 transition-colors duration-200"
              />
              <button
                onClick={handleSend}
                disabled={!running && !input.trim()}
                className={[
                  "w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed",
                  running
                    ? "bg-red-600/90 hover:bg-red-500"
                    : "bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500",
                ].join(" ")}
                aria-label={running ? "중단" : "전송"}
              >
                {running ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* ── Right Sidebar: Docs ── */}
        {sidebarOpen && (
          <aside className="w-56 shrink-0 border-l border-white/[0.06] bg-[#0D0D14] p-4 hidden lg:flex flex-col overflow-y-auto">
            <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-4">산출물</p>
            {docs.length === 0 ? (
              <p className="text-white/25 text-xs leading-relaxed">아직 산출물이 없습니다. 단계가 완료되면 여기에 표시됩니다.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {docs.map((doc) => (
                  <button
                    key={doc.stageId}
                    onClick={() => setOpenDoc(doc)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.06] text-left transition-all duration-200 cursor-pointer group"
                  >
                    <span className="shrink-0" style={{ color: doc.color }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-white/60 text-xs font-mono truncate group-hover:text-white/90 transition-colors duration-200">{doc.name}</p>
                      <p className="text-white/25 text-[10px] truncate">{doc.agent}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <p className="text-white/30 text-[10px] mb-2 font-semibold uppercase tracking-wider">진행률</p>
              <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-white/30 text-[10px]">{doneCount} / {stages.length} 단계 완료 ({progress}%)</p>
            </div>
          </aside>
        )}
      </div>

      {/* Doc viewer modal */}
      {openDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setOpenDoc(null)}>
          <div className="w-full max-w-2xl max-h-[80vh] rounded-2xl border border-white/[0.1] bg-[#13131A] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-white/[0.07]">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="shrink-0" style={{ color: openDoc.color }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-white font-mono text-sm truncate">{openDoc.name}</p>
                  <p className="text-white/30 text-[11px]">{openDoc.agent}</p>
                </div>
              </div>
              <button onClick={() => setOpenDoc(null)} className="text-white/40 hover:text-white transition-colors cursor-pointer shrink-0" aria-label="닫기">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <pre className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap break-words font-sans">{openDoc.text}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
