"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { OptionButton, ProgressBar } from "../_components";
import { resolveType } from "../lib/score";
import { OA_STORAGE_KEYS, type Answer } from "../lib/types";
import { incrementSocialProofCount } from "../lib/useSocialProofCount";
import configData from "../data/config.json";
import questionsData from "../data/questions.json";
import typesData from "../data/types.json";
import type { OaConfig, QuestionsData, TypesData } from "../lib/types";

const config = configData as OaConfig;
const questions = (questionsData as QuestionsData).questions;
const types = (typesData as TypesData).types;

type SlideDirection = "next" | "prev" | null;

/** history.pushState state payload — 브라우저 popstate로 문항 인덱스를 동기화하기 위한 마커. */
interface OaHistoryState {
  oaQuestionIndex: number;
}

/**
 * 화면 2 — 질문 (design-final §1 화면2).
 * 내부 state(currentIndex) + history.pushState/popstate로 브라우저 뒤로가기를 문항 단위로
 * 동기화한다(D8). URL은 항상 `/office-archetype/test`로 고정 — 문항 번호를 쿼리/경로에
 * 노출하지 않는다.
 */
export default function OfficeArchetypeTestPage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<SlideDirection>(null);
  const [analyzing, setAnalyzing] = useState(false);
  // 선택 직후 260ms 자동전환 대기 중엔 같은 문항 내 다른 옵션 탭을 잠근다(오조작 방지).
  // 문항이 바뀌면(currentIndex 변경) 자동으로 초기화된다.
  const [pendingQuestionId, setPendingQuestionId] = useState<string | null>(null);

  const total = config.questionCount || questions.length;
  const currentQuestion = questions[currentIndex];

  // 최초 마운트: sessionStorage에 진행 중이던 답변이 있으면 복원(design-final §1-0).
  // 복원한 만큼 문항 인덱스도 이어서 시작하고, popstate 동기화를 위한 history state를 초기화한다.
  useEffect(() => {
    let restored: Answer[] = [];
    try {
      const raw = window.sessionStorage.getItem(OA_STORAGE_KEYS.answers);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) restored = parsed;
      }
    } catch {
      // 손상된 값은 무시하고 처음부터 시작
    }
    setAnswers(restored);
    setCurrentIndex(Math.min(restored.length, questions.length - 1));

    history.replaceState({ oaQuestionIndex: Math.min(restored.length, questions.length - 1) }, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // popstate(브라우저 뒤로가기) 동기화 — 1번 문항에서 더 뒤로가면 랜딩으로 나간다(D8).
  useEffect(() => {
    function onPopState(e: PopStateEvent) {
      const state = e.state as OaHistoryState | null;
      if (state && typeof state.oaQuestionIndex === "number") {
        setDirection("prev");
        setCurrentIndex(state.oaQuestionIndex);
        setPendingQuestionId(null);
      }
      // state가 없으면(1번 문항 이전 = 랜딩 진입점) 브라우저가 알아서 이전 페이지로 이동한다.
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const persistAnswers = useCallback((next: Answer[]) => {
    try {
      window.sessionStorage.setItem(OA_STORAGE_KEYS.answers, JSON.stringify(next));
    } catch {
      // sessionStorage 불가 환경에서도 진행은 막지 않는다(React state로는 계속 동작)
    }
  }, []);

  const handleSelect = useCallback(
    (optionId: string) => {
      if (!currentQuestion || pendingQuestionId === currentQuestion.id) return;
      setPendingQuestionId(currentQuestion.id);

      const nextAnswers = [
        ...answers.filter((a) => a.qid !== currentQuestion.id),
        { qid: currentQuestion.id, oid: optionId },
      ];
      setAnswers(nextAnswers);
      persistAnswers(nextAnswers);

      const isLast = currentIndex >= questions.length - 1;

      if (isLast) {
        // 판정 로딩 연출(D11: 0.7초 고정) 후 결과 산출 + 저장 + replace.
        setAnalyzing(true);
        window.setTimeout(() => {
          const result = resolveType(nextAnswers, questions, types);
          try {
            window.sessionStorage.setItem(OA_STORAGE_KEYS.result, result.type.id);
          } catch {
            // 저장 실패해도 이번 렌더에서는 router.replace로 바로 이동하므로 화면은 정상 동작
          }
          incrementSocialProofCount(config.socialProof?.storageKey ?? "oa-count");
          // 질문 히스토리 정리 — 결과 화면에서 뒤로가기 눌러도 질문으로 안 돌아가게(design-final §1 화면2).
          history.replaceState(null, "");
          router.replace(`${config.resultBasePath}/${result.type.id}`);
        }, 700);
        return;
      }

      const nextIndex = currentIndex + 1;
      setDirection("next");
      history.pushState({ oaQuestionIndex: nextIndex } as OaHistoryState, "");
      setCurrentIndex(nextIndex);
      setPendingQuestionId(null);
    },
    [answers, currentIndex, currentQuestion, pendingQuestionId, persistAnswers, router],
  );

  const handleBack = useCallback(() => {
    if (currentIndex === 0) {
      router.back();
      return;
    }
    history.back();
  }, [currentIndex, router]);

  const selectedOptionId = useMemo(() => {
    if (!currentQuestion) return undefined;
    return answers.find((a) => a.qid === currentQuestion.id)?.oid;
  }, [answers, currentQuestion]);

  const slideClass = direction === "next" ? "oa-slide-next" : direction === "prev" ? "oa-slide-prev" : "";

  if (analyzing) {
    return (
      <div className="oa-container">
        <div className="oa-loading" role="status" aria-live="polite">
          <div className="oa-loading-track" />
          <p className="oa-loading-text">{config.labels.analyzing}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return null;
  }

  return (
    <div className="oa-container">
      <header className="oa-header">
        <button
          type="button"
          className="oa-icon-btn touch-target"
          onClick={handleBack}
          aria-label="이전 문항으로"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <ProgressBar current={currentIndex + 1} total={total} />
      </header>

      <main
        key={currentQuestion.id}
        className={slideClass}
        style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: 24, paddingBottom: 24 }}
        aria-live="polite"
      >
        <h1 className="oa-text-question">{currentQuestion.text}</h1>

        <div className="oa-options-list" style={{ marginTop: 32 }}>
          {currentQuestion.options.map((option) => (
            <OptionButton
              key={option.id}
              id={option.id}
              text={option.text}
              selected={selectedOptionId === option.id}
              disabled={pendingQuestionId === currentQuestion.id}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
