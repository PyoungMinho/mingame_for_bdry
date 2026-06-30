// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth";
import { usePersonaStore, PERSONA_META } from "@/lib/store/persona";
import { checkCoachAccess, getFreeTrialDaysLeft, PAYWALL_MESSAGES } from "@/lib/paywall/gate";
import { streamCoachChat, getCoachErrorMessage } from "@/lib/api/coach";
import type { CoachChatRequest } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 코치챗 페이지 — SSE 스트리밍 + Pro 게이트 (Q5=B)
// REDLINE: 타인 비교/외모 점수 UI 금지
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

// ---------------------------------------------------------------------------
// Pro 게이트 블록 화면
// ---------------------------------------------------------------------------

function ProGateBlock({ reason }: { reason: keyof typeof PAYWALL_MESSAGES }) {
  const router = useRouter();
  const daysLeft = getFreeTrialDaysLeft(useAuthStore.getState().user);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-5 gap-6 pb-20">
      {/* 흐린 채팅 미리보기 */}
      <div className="w-full rounded-xl border border-gray-200 p-4 opacity-40 pointer-events-none select-none" aria-hidden="true">
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-accent-100 shrink-0" />
            <div className="bg-gray-100 rounded-lg p-3 text-body-s text-gray-500">
              오늘 체크인 수고했어요. 어떤 부분이 가장 힘드셨나요?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="bg-primary-800 rounded-lg p-3 text-body-s text-white">
              공부가 잘 안 돼요
            </div>
          </div>
        </div>
      </div>

      {/* 게이트 카드 */}
      <div className="w-full rounded-xl bg-white border border-gray-200 shadow-md p-6 flex flex-col gap-4 text-center">
        <div
          className="w-12 h-12 rounded-full bg-accent-50 flex items-center justify-center mx-auto"
          aria-hidden="true"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="text-accent-500"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div>
          <p className="text-h4 font-bold text-primary-800 mb-1">Pro에서 코치와 대화해요</p>
          <p className="text-body-s text-gray-500">{PAYWALL_MESSAGES[reason]}</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={() => router.push("/paywall")}
        >
          {reason === "free_trial_ended" ? "Pro 구독하기" : "7일 무료로 시작하기"}
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={() => router.back()}
          className="w-full text-gray-400"
        >
          나중에
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 무료 체험 카운터 (Q5=B: 남은 무료 일수 표시)
// ---------------------------------------------------------------------------

function FreeTrialBanner({ daysLeft }: { daysLeft: number }) {
  if (daysLeft <= 0) return null;
  return (
    <div className="mx-5 mb-3 px-3 py-2 rounded-lg bg-accent-50 border border-accent-100 flex items-center justify-between">
      <span className="text-body-s text-accent-600 font-medium">
        무료 체험 {daysLeft}일 남음
      </span>
      <a href="/paywall" className="text-caption text-accent-500 underline">
        Pro 전환
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 채팅 말풍선
// ---------------------------------------------------------------------------

function ChatBubble({ message, isCoach }: { message: ChatMessage; isCoach: boolean }) {
  const persona = usePersonaStore.getState().selected;
  const accentColor = PERSONA_META[persona].accentColor;

  return (
    <div
      className={`flex gap-2 ${isCoach ? "" : "flex-row-reverse"}`}
      aria-label={isCoach ? "코치 메시지" : "내 메시지"}
    >
      {isCoach && (
        <div
          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-caption text-white font-bold mt-1"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        >
          {persona === "mentor" ? "지" : persona === "spartan" ? "강" : "민"}
        </div>
      )}
      <div
        className={[
          "max-w-[75%] rounded-2xl px-4 py-3 text-body-m leading-relaxed",
          isCoach
            ? "bg-gray-100 text-primary-800 rounded-tl-sm"
            : "bg-primary-800 text-white rounded-tr-sm",
          message.isStreaming ? "after:content-['▋'] after:animate-pulse after:ml-0.5" : "",
        ].join(" ")}
      >
        {message.content}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

export default function CoachPage() {
  const user = useAuthStore((s) => s.user);
  const persona = usePersonaStore((s) => s.selected);
  const personaMeta = PERSONA_META[persona];

  // Pro 게이트 체크 (Q5=B)
  const gateResult = checkCoachAccess(user);
  const daysLeft = getFreeTrialDaysLeft(user);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `${user?.nickname ?? ""}님, 안녕하세요. 오늘 기분은 어떤가요?`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 새 메시지 시 스크롤 아래로
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const assistantMsgId = crypto.randomUUID();
    const assistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      isStreaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsGenerating(true);

    const abort = new AbortController();
    abortRef.current = abort;

    const body: CoachChatRequest = {
      message: text,
      persona: persona as CoachChatRequest["persona"],
      history: messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content })),
    };

    await streamCoachChat(body, {
      signal: abort.signal,
      onDelta: (content) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: m.content + content }
              : m
          )
        );
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, isStreaming: false } : m
          )
        );
        setIsGenerating(false);
      },
      onError: (err) => {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        setError(getCoachErrorMessage(err.code));
        setIsGenerating(false);
      },
    });
  }, [input, isGenerating, messages, persona]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Pro 차단 화면
  if (gateResult.access === "blocked") {
    return (
      <div className="min-h-dvh flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
          <div className="h-14 flex items-center px-5 pt-safe">
            <h1 className="text-h4 font-bold text-primary-800">
              {personaMeta.coachName}
            </h1>
          </div>
        </header>
        <ProGateBlock reason={gateResult.reason as keyof typeof PAYWALL_MESSAGES} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-surface-bg">
      {/* App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="h-14 flex items-center justify-between px-5 pt-safe">
          <h1 className="text-h4 font-bold text-primary-800">{personaMeta.coachName}</h1>
          <button
            aria-label="코치 설정"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 touch-target"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33..." />
            </svg>
          </button>
        </div>
      </header>

      {/* 무료 체험 카운터 */}
      <FreeTrialBanner daysLeft={daysLeft} />

      {/* 메시지 목록 */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 pb-24"
        aria-label="코치와의 대화"
        aria-live="polite"
        aria-atomic="false"
      >
        {messages.map((msg) => (
          <ChatBubble
            key={msg.id}
            message={msg}
            isCoach={msg.role === "assistant"}
          />
        ))}
        {error && (
          <div role="alert" className="text-center text-body-s text-error py-2">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      {/* 입력창 */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 px-5 py-3 pb-safe z-30">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            rows={1}
            disabled={isGenerating}
            aria-label="메시지 입력"
            className={[
              "flex-1 resize-none max-h-32 px-4 py-3 rounded-xl border bg-gray-50",
              "text-body-m text-primary-800 placeholder:text-gray-400",
              "outline-none transition-all duration-fast",
              "focus-visible:border-accent-500 focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
              "border-gray-200 disabled:opacity-50",
            ].join(" ")}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isGenerating}
            aria-label="메시지 전송"
            className={[
              "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 touch-target",
              "transition-all duration-fast",
              input.trim() && !isGenerating
                ? "bg-accent-500 text-white hover:brightness-105 active:scale-95"
                : "bg-gray-200 text-gray-400 cursor-not-allowed",
            ].join(" ")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
