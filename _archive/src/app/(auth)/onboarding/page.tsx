// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { checkAgeEligibility, AGE_BLOCK_MESSAGE } from "@/lib/auth/guard";
import { useAuthStore } from "@/lib/store/auth";
import { usePersonaStore, PERSONA_META } from "@/lib/store/persona";
import type { Persona } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 온보딩 4스텝
// Step 1: 나이 확인 (만 16세 미만 차단)
// Step 2: 북극성 다짐
// Step 3: 90일 목표
// Step 4: 페르소나 선택
// ---------------------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface OnboardingState {
  birthDate: string;
  northStar: string;
  goal90: string;
  persona: Persona;
}

// ---------------------------------------------------------------------------
// 만 16세 미만 차단 화면
// ---------------------------------------------------------------------------

function AgeBlockedScreen() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-center justify-center gap-6 py-12 text-center"
    >
      <div
        className="w-16 h-16 rounded-full bg-error-bg flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="text-2xl">⚠</span>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-h3 font-bold text-primary-800">이용 제한 안내</h2>
        <p className="text-body-l text-gray-600">{AGE_BLOCK_MESSAGE}</p>
      </div>
      <p className="text-body-s text-gray-400">
        오름은 만 16세 이상부터 이용 가능합니다.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 스텝 인디케이터
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2" aria-label={`${total}단계 중 ${current}단계`}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            "rounded-full transition-all duration-base",
            i + 1 === current
              ? "w-6 h-2 bg-accent-500"
              : i + 1 < current
              ? "w-2 h-2 bg-accent-200"
              : "w-2 h-2 bg-gray-200",
          ].join(" ")}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">{total}단계 중 {current}단계</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — 생년월일 입력
// ---------------------------------------------------------------------------

function Step1Birth({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-bold text-primary-800">생년월일을 알려주세요</h2>
        <p className="text-body-m text-gray-500">이용 연령 확인을 위해 필요합니다.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="birth-date" className="text-label font-medium text-primary-800">
          생년월일
        </label>
        <input
          id="birth-date"
          type="date"
          value={value}
          max={new Date().toISOString().split("T")[0]}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? "birth-error" : undefined}
          className={[
            "w-full h-11 px-4 rounded-lg border bg-white",
            "text-body-l text-primary-800",
            "outline-none transition-all duration-fast",
            "focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
            error ? "border-error" : "border-gray-200 focus-visible:border-accent-500",
          ].join(" ")}
        />
        {error && (
          <p id="birth-error" role="alert" className="flex items-center gap-1 text-caption text-error">
            <span aria-hidden="true">✕</span>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — 북극성 다짐
// ---------------------------------------------------------------------------

function Step2NorthStar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const MAX = 100;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-bold text-primary-800">나만의 북극성을 정해요</h2>
        <p className="text-body-m text-gray-500">어떤 사람이 되고 싶으신가요?</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="north-star" className="text-label font-medium text-primary-800">
          나는
        </label>
        <div className="relative">
          <textarea
            id="north-star"
            placeholder="건강하고 꾸준히 성장하는"
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MAX))}
            rows={3}
            className={[
              "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white resize-none",
              "text-body-l text-primary-800 placeholder:text-gray-400",
              "outline-none transition-all duration-fast",
              "focus-visible:border-accent-500 focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
            ].join(" ")}
          />
          <span className="absolute bottom-2 right-3 text-caption text-gray-400">
            {value.length}/{MAX}
          </span>
        </div>
        <p className="text-body-m text-gray-600 font-medium">
          한 사람이 된다
        </p>
        {!value.trim() && (
          <p className="text-caption text-gray-400">한 줄로 적어보세요</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — 90일 목표
// ---------------------------------------------------------------------------

function Step3Goal({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const MAX = 200;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-bold text-primary-800">90일 목표를 정해요</h2>
        <p className="text-body-m text-gray-500">
          구체적일수록 AI가 더 잘 도와드려요.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="goal-90" className="text-label font-medium text-primary-800">
          90일 안에 이루고 싶은 것
        </label>
        <div className="relative">
          <textarea
            id="goal-90"
            placeholder="예) 매일 30분 운동해서 체력 키우기"
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MAX))}
            rows={4}
            className={[
              "w-full px-4 py-3 rounded-lg border border-gray-200 bg-white resize-none",
              "text-body-l text-primary-800 placeholder:text-gray-400",
              "outline-none transition-all duration-fast",
              "focus-visible:border-accent-500 focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
            ].join(" ")}
          />
          <span className="absolute bottom-2 right-3 text-caption text-gray-400">
            {value.length}/{MAX}
          </span>
        </div>

        {/* AI 마일스톤 미리보기 (mock) */}
        {value.trim().length > 10 && (
          <div className="rounded-lg bg-primary-50 border border-primary-100 p-3 flex flex-col gap-1">
            <p className="text-caption text-primary-500 font-medium">AI 마일스톤 미리보기</p>
            <p className="text-body-s text-primary-700">W1~2: 기초 루틴 만들기</p>
            <p className="text-body-s text-primary-700">W3~4: 습관화 강화</p>
            <p className="text-body-s text-gray-400">+ 더 보기는 목표 설정 후 확인</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — 페르소나 선택
// ---------------------------------------------------------------------------

function Step4Persona({
  value,
  onChange,
}: {
  value: Persona;
  onChange: (v: Persona) => void;
}) {
  const personas: Persona[] = ["mentor", "spartan", "friend"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2 font-bold text-primary-800">코치 스타일을 골라요</h2>
        <p className="text-body-m text-gray-500">언제든 바꿀 수 있어요.</p>
      </div>

      <div className="flex flex-col gap-3" role="radiogroup" aria-label="코치 스타일 선택">
        {personas.map((p) => {
          const meta = PERSONA_META[p];
          const isSelected = value === p;
          return (
            <button
              key={p}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(p)}
              className={[
                "w-full rounded-xl border-2 p-4 text-left transition-all duration-base touch-target",
                isSelected
                  ? "border-accent-500 bg-accent-50"
                  : "border-gray-200 bg-white hover:border-gray-300",
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                {/* 선택 상태 인디케이터 */}
                <div
                  className={[
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    isSelected ? "border-accent-500" : "border-gray-300",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-accent-500" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-body-m font-semibold text-primary-800">
                      {meta.displayName}
                    </span>
                    <span className="text-caption text-gray-500">— {meta.coachName}</span>
                  </div>
                  <p className="text-body-s text-gray-500 mt-0.5">{meta.tagline}</p>
                  <p className="text-body-s text-gray-400 mt-1 italic">
                    &ldquo;{meta.exampleMessage}&rdquo;
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 온보딩 페이지
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAgeBlocked = searchParams.get("blocked") === "age";

  const setOnboardingDone = useAuthStore((s) => s.setOnboardingDone);
  const setPersonaStore = usePersonaStore((s) => s.setPersona);

  const [step, setStep] = useState<Step>(1);
  const [ageError, setAgeError] = useState<string | null>(null);
  const [isAgeBlockedLocal, setIsAgeBlockedLocal] = useState(isAgeBlocked);
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState<OnboardingState>({
    birthDate: "",
    northStar: "",
    goal90: "",
    persona: "mentor",
  });

  const updateForm = useCallback(
    <K extends keyof OnboardingState>(key: K, value: OnboardingState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // 각 스텝 유효성 검사
  function isStepValid(): boolean {
    switch (step) {
      case 1:
        return form.birthDate.length > 0 && !ageError;
      case 2:
        return form.northStar.trim().length > 0;
      case 3:
        return form.goal90.trim().length > 5;
      case 4:
        return true;
    }
  }

  // 다음 버튼 핸들러
  async function handleNext() {
    if (step === 1) {
      const result = checkAgeEligibility(form.birthDate);
      if (!result.allowed) {
        setAgeError(result.reason ?? AGE_BLOCK_MESSAGE);
        setIsAgeBlockedLocal(true);
        return;
      }
      setAgeError(null);
    }

    if (step < 4) {
      setStep((prev) => (prev + 1) as Step);
      return;
    }

    // Step 4 완료 — 온보딩 제출
    setIsLoading(true);
    try {
      // TODO: POST /api/onboarding 실제 연동
      await new Promise((r) => setTimeout(r, 600));
      setPersonaStore(form.persona);
      setOnboardingDone(true);
      router.replace("/home");
    } catch {
      // 오류 처리 TODO
    } finally {
      setIsLoading(false);
    }
  }

  // 차단 화면
  if (isAgeBlockedLocal) {
    return <AgeBlockedScreen />;
  }

  const STEP_LABELS: Record<Step, string> = {
    1: "나이 확인",
    2: "북극성 다짐",
    3: "90일 목표",
    4: "코치 선택",
  };

  return (
    <div className="flex flex-col gap-6 min-h-[60dvh]">
      {/* 스텝 인디케이터 */}
      <div className="flex items-center justify-between">
        <StepIndicator current={step} total={4} />
        <span className="text-caption text-gray-400">
          {step}/4 — {STEP_LABELS[step]}
        </span>
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="flex-1">
        {step === 1 && (
          <Step1Birth
            value={form.birthDate}
            onChange={(v) => {
              updateForm("birthDate", v);
              setAgeError(null);
            }}
            error={ageError}
          />
        )}
        {step === 2 && (
          <Step2NorthStar
            value={form.northStar}
            onChange={(v) => updateForm("northStar", v)}
          />
        )}
        {step === 3 && (
          <Step3Goal
            value={form.goal90}
            onChange={(v) => updateForm("goal90", v)}
          />
        )}
        {step === 4 && (
          <Step4Persona
            value={form.persona}
            onChange={(v) => updateForm("persona", v)}
          />
        )}
      </div>

      {/* 하단 CTA */}
      <div className="flex flex-col gap-3 pb-safe">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!isStepValid()}
          loading={isLoading}
          onClick={handleNext}
        >
          {step === 4 ? "시작하기" : "다음"}
        </Button>
        {step > 1 && (
          <Button
            variant="ghost"
            size="md"
            className="w-full"
            onClick={() => setStep((prev) => (prev - 1) as Step)}
          >
            이전
          </Button>
        )}
      </div>
    </div>
  );
}
