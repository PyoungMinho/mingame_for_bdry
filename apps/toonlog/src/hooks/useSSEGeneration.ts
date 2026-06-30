/**
 * SSE 생성 스트림 구독 훅.
 * EventSource로 /api/diary/:id/stream?jobId=:jobId 구독 → ToonlogSSEEvent 처리.
 * 백엔드 미가동/연결 실패 시 mockSSEStream 폴백 (P0 경로 데모 보장).
 *
 * design-final §4 플로우A 단계7: 1컷 도착 즉시 표시 (이탈방지 핵심).
 *
 * 백엔드 직렬화 계약 (api/diary/[id]/stream/route.ts):
 *   `event: {type}\ndata: {JSON.stringify(ToonlogSSEEvent)}\n\n`
 * → addEventListener(type, ...) 로 수신, data를 그대로 파싱(전체 이벤트 객체).
 */
"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ToonlogSSEEvent } from "@/lib/contract";
import { useGenerationStore } from "@/store/generationStore";
import { mockSSEStream } from "@/lib/mock";

/** 백엔드 미가동 환경에서도 mock 폴백 허용 (P0 데모). 프로덕션 실연결 시 실패하면 에러 노출. */
const ALLOW_MOCK = process.env.NODE_ENV !== "production";

const SSE_EVENT_TYPES: ToonlogSSEEvent["type"][] = [
  "status",
  "panel",
  "progress",
  "tip",
  "done",
  "error",
];

export function useSSEGeneration(diaryId: string | null) {
  const qc = useQueryClient();

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!diaryId) return;

    // 스토어 접근은 effect 내부에서 getState 사용 (불필요한 재구독 방지)
    const store = useGenerationStore.getState();

    // 이미 완료된 경우 재구독 방지
    if (store.isDone && store.diaryId === diaryId) return;

    // diary/new 에서 init(jobId, diaryId)로 이미 세팅됨 → jobId 보존.
    // 다른 diary로 진입했거나 미초기화 상태면 새로 init.
    if (store.diaryId !== diaryId) {
      store.init(store.jobId ?? "pending", diaryId);
    }
    // 구독 시점의 jobId (없으면 백엔드가 job-{diaryId}로 폴백)
    const jobId = useGenerationStore.getState().jobId;

    function handleEvent(event: ToonlogSSEEvent) {
      // effect 클로저가 오래된 store를 잡지 않도록 매번 최신 액션 사용
      const s = useGenerationStore.getState();
      switch (event.type) {
        case "status":
          s.setStage(event.stage);
          break;
        case "panel":
          // 1컷 도착 즉시 누적 → 화면 노출 (이탈 방어 핵심)
          s.addPanel(event.panel);
          break;
        case "progress":
          s.setProgress(event.completed);
          break;
        case "tip":
          s.setTip(event.text);
          break;
        case "done":
          s.setDone(event.panels);
          qc.invalidateQueries({ queryKey: ["diary", event.diaryId] });
          qc.invalidateQueries({ queryKey: ["archive"] });
          qc.invalidateQueries({ queryKey: ["quota"] });
          cleanupRef.current?.();
          break;
        case "error":
          s.setError(event.code, event.message, event.retryable);
          cleanupRef.current?.();
          break;
      }
    }

    // jobId가 있으면 query param으로 전달 (백엔드 계약)
    const streamUrl =
      jobId && jobId !== "pending"
        ? `/api/diary/${diaryId}/stream?jobId=${encodeURIComponent(jobId)}`
        : `/api/diary/${diaryId}/stream`;

    let es: EventSource | null = null;
    let usedMock = false;

    function startMock() {
      if (usedMock) return;
      usedMock = true;
      const cancel = mockSSEStream(handleEvent);
      cleanupRef.current = cancel;
    }

    if (typeof window !== "undefined" && "EventSource" in window) {
      try {
        es = new EventSource(streamUrl);

        // 기본 message 이벤트 (event: 라인 없는 경우 대비)
        es.onmessage = (e) => {
          try {
            handleEvent(JSON.parse(e.data) as ToonlogSSEEvent);
          } catch {
            /* 파싱 실패 무시 */
          }
        };

        // named events — 백엔드는 `event: {type}` 직렬화, data는 전체 이벤트 객체
        SSE_EVENT_TYPES.forEach((type) => {
          es!.addEventListener(type, (e) => {
            try {
              handleEvent(JSON.parse((e as MessageEvent).data) as ToonlogSSEEvent);
            } catch {
              /* 파싱 실패 무시 */
            }
          });
        });

        es.onerror = () => {
          es?.close();
          // 완료 전 연결 실패 시에만 mock 폴백 (백엔드 미가동 데모)
          const s = useGenerationStore.getState();
          if (!s.isDone && ALLOW_MOCK) {
            startMock();
          }
        };

        cleanupRef.current = () => es?.close();
      } catch {
        // EventSource 생성 실패 — mock 폴백
        if (ALLOW_MOCK) startMock();
      }
    } else if (ALLOW_MOCK) {
      // SSR/미지원 환경 — mock
      startMock();
    }

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diaryId]);
}
