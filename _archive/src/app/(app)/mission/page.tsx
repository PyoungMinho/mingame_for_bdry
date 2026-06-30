// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import type { MissionTodayResponse } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 미션 & 목표 페이지 — 오늘의 미션 + 90일 목표 마일스톤
// REDLINE: 타인 비교/외모 점수 UI 금지
// ---------------------------------------------------------------------------

type SegmentTab = "today" | "goal";

// ---------------------------------------------------------------------------
// 마일스톤 타임라인 데이터 (mock — W3~W4 API 연동)
// ---------------------------------------------------------------------------

interface Milestone {
  id: string;
  label: string;
  week: string;
  status: "completed" | "active" | "locked";
  progress?: number;
}

const MOCK_MILESTONES: Milestone[] = [
  { id: "summit", label: "정상", week: "D+90", status: "locked" },
  { id: "camp4", label: "캠프4", week: "W7~8", status: "locked" },
  { id: "camp3", label: "캠프3", week: "W5~6", status: "locked" },
  { id: "camp2", label: "캠프2", week: "W3~4", status: "active", progress: 60 },
  { id: "camp1", label: "캠프1", week: "W1~2", status: "completed" },
  { id: "start", label: "출발", week: "D+0", status: "completed" },
];

// ---------------------------------------------------------------------------
// 오늘의 미션 탭
// ---------------------------------------------------------------------------

function TodayMissionTab() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mission", "today"],
    queryFn: () => api.get<MissionTodayResponse>("/api/mission/today"),
    placeholderData: {
      mission: {
        id: "mock-1",
        title: "물 2L 마시기",
        description: "하루 동안 물 2리터를 마셔보세요.",
        axis: "health" as const,
        difficulty: "easy" as const,
      },
      completedAt: null,
    },
  });

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-xl bg-white border border-gray-100 p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl bg-error-bg border border-error p-4 text-center">
        <p className="text-body-s text-error">미션을 불러오지 못했습니다.</p>
      </div>
    );
  }

  if (!data?.mission) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-body-m text-gray-500">
          오늘의 미션을 준비 중이에요.
          <br />
          체크인 후 미션이 생성됩니다.
        </p>
        <Button asChild variant="primary" size="md">
          <a href="/home">체크인 하러 가기</a>
        </Button>
      </div>
    );
  }

  const mission = data.mission;
  const isCompleted = completedIds.has(mission.id) || !!data.completedAt;

  return (
    <div className="flex flex-col gap-3">
      <div
        className={[
          "rounded-xl border p-4 transition-all duration-base",
          isCompleted
            ? "bg-health-50 border-health-200"
            : "bg-white border-gray-100 shadow-sm",
        ].join(" ")}
      >
        <div className="flex items-start gap-3">
          {/* 체크박스 */}
          <button
            onClick={() => {
              if (!isCompleted) {
                setCompletedIds((prev) => new Set([...prev, mission.id]));
              }
            }}
            aria-label={isCompleted ? "미션 완료됨" : "미션 완료 표시"}
            aria-pressed={isCompleted}
            className={[
              "w-6 h-6 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-all duration-fast touch-target",
              isCompleted
                ? "border-health-500 bg-health-500"
                : "border-gray-300 hover:border-health-400",
            ].join(" ")}
          >
            {isCompleted && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>

          <div className="flex-1">
            <p
              className={[
                "text-body-m font-medium",
                isCompleted ? "line-through text-gray-400" : "text-primary-800",
              ].join(" ")}
            >
              {mission.title}
            </p>
            {mission.description && (
              <p className="text-body-s text-gray-500 mt-0.5">{mission.description}</p>
            )}
            <span
              className={[
                "inline-block mt-2 text-caption px-2 py-0.5 rounded-full",
                mission.axis === "health" ? "bg-health-50 text-health-700" :
                mission.axis === "learning" ? "bg-learn-50 text-learn-700" :
                mission.axis === "relation" ? "bg-relate-50 text-relate-700" :
                "bg-achieve-50 text-achieve-700",
              ].join(" ")}
            >
              {mission.axis === "health" ? "건강" : mission.axis === "learning" ? "학습" : mission.axis === "relation" ? "관계" : "성취"}
            </span>
          </div>
        </div>
      </div>

      {isCompleted && (
        <div
          role="alert"
          className="rounded-xl bg-health-50 border border-health-200 p-3 flex items-center gap-2"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2E9E55"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-body-s text-health-700 font-medium">미션 완료! +1점이 반영됩니다.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 90일 목표 탭 — 마일스톤 타임라인
// ---------------------------------------------------------------------------

function GoalTab() {
  return (
    <div className="flex flex-col gap-4">
      {/* 북극성 다짐 */}
      <div className="rounded-xl bg-primary-800 text-white p-4">
        <p className="text-caption text-primary-300 mb-1">북극성 다짐</p>
        <p className="text-body-m font-semibold">
          나는 건강하고 꾸준히 성장하는 사람이 된다
        </p>
      </div>

      {/* 마일스톤 타임라인 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-s font-semibold text-gray-500 px-1">마일스톤</h3>
        {MOCK_MILESTONES.map((milestone, idx) => (
          <div
            key={milestone.id}
            className="flex items-center gap-3"
            aria-label={`${milestone.label} — ${milestone.week} — ${milestone.status === "completed" ? "완료" : milestone.status === "active" ? "진행 중" : "잠김"}`}
          >
            {/* 타임라인 도트 */}
            <div className="flex flex-col items-center" aria-hidden="true">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-caption font-bold",
                  milestone.status === "completed"
                    ? "bg-health-500 text-white"
                    : milestone.status === "active"
                    ? "bg-accent-500 text-white"
                    : "bg-gray-200 text-gray-400",
                ].join(" ")}
              >
                {milestone.status === "completed" ? "✓" : milestone.status === "locked" ? "🔒" : "→"}
              </div>
              {idx < MOCK_MILESTONES.length - 1 && (
                <div
                  className={`w-0.5 h-6 mt-1 ${milestone.status === "completed" ? "bg-health-300" : "bg-gray-200"}`}
                />
              )}
            </div>

            {/* 마일스톤 카드 */}
            <div
              className={[
                "flex-1 rounded-lg border p-3 mb-1",
                milestone.status === "completed"
                  ? "bg-health-50 border-health-200"
                  : milestone.status === "active"
                  ? "bg-white border-accent-200 shadow-sm"
                  : "bg-gray-50 border-gray-200",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <p
                  className={[
                    "text-body-s font-semibold",
                    milestone.status === "locked" ? "text-gray-400" : "text-primary-800",
                  ].join(" ")}
                >
                  {milestone.label}
                </p>
                <span className="text-caption text-gray-400">{milestone.week}</span>
              </div>
              {milestone.status === "active" && milestone.progress !== undefined && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-caption text-gray-500">진행률</span>
                    <span className="text-caption font-medium text-accent-600">
                      {milestone.progress}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-500 rounded-full transition-all duration-slow"
                      style={{ width: `${milestone.progress}%` }}
                      role="progressbar"
                      aria-valuenow={milestone.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

export default function MissionPage() {
  const [activeTab, setActiveTab] = useState<SegmentTab>("today");

  return (
    <>
      {/* App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="h-14 flex items-center px-5 pt-safe">
          <h1 className="text-h4 font-bold text-primary-800">미션 & 목표</h1>
        </div>
      </header>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* 세그먼트 탭 */}
        <div
          className="flex bg-gray-100 rounded-lg p-1 gap-1"
          role="tablist"
          aria-label="탭 선택"
        >
          {(["today", "goal"] as SegmentTab[]).map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`tabpanel-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex-1 h-9 rounded-md text-body-s font-medium transition-all duration-fast",
                activeTab === tab
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-gray-500 hover:text-primary-800",
              ].join(" ")}
            >
              {tab === "today" ? "오늘의 미션" : "90일 목표"}
            </button>
          ))}
        </div>

        {/* 탭 패널 */}
        <div
          id={`tabpanel-${activeTab}`}
          role="tabpanel"
          aria-label={activeTab === "today" ? "오늘의 미션" : "90일 목표"}
        >
          {activeTab === "today" ? <TodayMissionTab /> : <GoalTab />}
        </div>
      </div>
    </>
  );
}
