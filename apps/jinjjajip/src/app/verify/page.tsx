"use client";

import { useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { VerificationStepper } from "@/components/verify/VerificationStepper";
import { PhotoUploader } from "@/components/verify/PhotoUploader";
import { StatusChip } from "@/components/common/StatusChip";
import { ErrorState } from "@/components/common/ErrorState";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { useUploadStore, type UploadStep } from "@/lib/store/upload";
import { useUploadStatus, type UploadResultWithDone } from "@/lib/api/upload";
import type { UploadResult } from "@/lib/types/domain";

const STEP_TIMES = ["30초", "1분", "2분", "2분", ""];

function Step1Content() {
  const router = useRouter();
  const setStep = useUploadStore((s) => s.setStep);

  function handlePassStart() {
    router.push("/auth/verify?returnTo=/verify");
  }

  return (
    <div className="px-4 py-8 flex flex-col items-center gap-6">
      <div className="text-center">
        <h2 className="text-xl font-serif font-bold text-realestate-neutral-900 mb-2">본인인증</h2>
        <p className="text-sm text-realestate-neutral-500">
          실거주 세입자 확인을 위해 통신사 본인인증이 필요합니다
        </p>
      </div>
      <button
        type="button"
        onClick={handlePassStart}
        className="w-full h-14 bg-realestate-brand-primary text-white rounded-md text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
      >
        PASS 인증하기
      </button>
      <p className="text-xs text-realestate-neutral-500 text-center">통신사 본인인증 · 1탭 완결</p>
    </div>
  );
}

function Step2Content() {
  const router = useRouter();

  return (
    <div className="px-4 py-8 flex flex-col items-center gap-4">
      <div className="text-center">
        <h2 className="text-xl font-serif font-bold text-realestate-neutral-900 mb-2">전자동의</h2>
        <p className="text-sm text-realestate-neutral-500">약관 동의 후 계속할 수 있어요</p>
      </div>
      <button
        type="button"
        onClick={() => router.push("/auth/verify?returnTo=/verify")}
        className="w-full h-14 bg-realestate-brand-primary text-white rounded-md text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
      >
        약관 동의하기
      </button>
    </div>
  );
}

interface Step3ContentProps {
  listingId: string;
  onUploadComplete: (result: UploadResult) => void;
}

function Step3Content({ listingId, onUploadComplete }: Step3ContentProps) {
  return (
    <div className="px-4 py-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-serif font-bold text-realestate-neutral-900 mb-2">사진 등록</h2>
        <div className="text-sm text-realestate-amber-warn bg-realestate-amber-warn-bg border border-realestate-amber-warn-border rounded-md px-3 py-2">
          외부(사진첩) 사진은 EXIF 검증이 어려워 점수에 영향을 줄 수 있어요
        </div>
      </div>
      <PhotoUploader
        listingId={listingId}
        onUploadComplete={onUploadComplete}
        captureMode="both"
        maxFiles={10}
        maxSizeMB={20}
      />
    </div>
  );
}

interface Step4ContentProps {
  uploadId: string;
  onComplete: (result: UploadResultWithDone) => void;
}

function Step4Content({ uploadId, onComplete }: Step4ContentProps) {
  const router = useRouter();
  const { data, isError, isPaused, refetch } = useUploadStatus(uploadId);

  useEffect(() => {
    // 완료 판별은 서버 확정 신호 done === true 로만. (낙관적 수치 금지)
    // status 'error' 는 step5 전환하지 않고 폴링 화면에서 처리 화면 유지(폴링은 훅에서 중단).
    if (data?.done === true) {
      onComplete(data);
    }
  }, [data, onComplete]);

  // error / paused(데이터 없음) / 서버 측 error 상태 — 에러 UI로 표면화
  const hasServerError = data?.status === "error";
  const isNetworkPaused = isPaused && !data;
  if (isError || hasServerError || isNetworkPaused) {
    const message = isNetworkPaused ? "연결이 끊겼습니다" : "분석에 실패했어요";
    return (
      <ErrorState
        message={message}
        description="잠시 후 다시 시도하거나, 홈으로 돌아가 매물을 다시 선택해 주세요"
        onRetry={() => refetch()}
        secondaryAction={
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full px-4 py-3 rounded-md border border-realestate-neutral-300 text-realestate-neutral-700 text-body-s font-medium focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
          >
            홈으로
          </button>
        }
      />
    );
  }

  return (
    <div className="px-4 py-8 flex flex-col items-center gap-6" aria-live="polite">
      <div className="w-16 h-16 flex items-center justify-center rounded-full bg-realestate-state-processing-bg">
        <Loader2
          size={32}
          className="text-realestate-state-processing animate-spin"
          aria-hidden="true"
        />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-realestate-neutral-900 mb-1">
          사진 분석 중
        </p>
        <p className="text-sm text-realestate-neutral-500">
          AI가 개인정보를 안전하게 블러 처리하고 있습니다
          <br />
          <span className="text-xs">(보통 30초~2분)</span>
        </p>
      </div>
      <StatusChip status="processing" />
      <button
        type="button"
        onClick={() => router.push("/")}
        className="text-sm text-realestate-neutral-500 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded"
      >
        나중에 확인하기
      </button>
    </div>
  );
}

interface Step5ContentProps {
  result: UploadResult;
  onRetake: () => void;
}

function Step5Content({ result, onRetake }: Step5ContentProps) {
  const router = useRouter();
  const scoreDelta = result.scoreDelta;
  const badge = result.badgeAchieved;

  return (
    <div className="px-4 py-8 flex flex-col items-center gap-6" role="status" aria-live="polite">
      <div className="text-center">
        <h2 className="text-2xl font-serif font-bold text-realestate-neutral-900 mb-2">
          인증 완료!
        </h2>
        {scoreDelta !== null && scoreDelta !== undefined && (
          <p className="text-3xl font-serif font-bold text-realestate-brand-primary tabular-nums">
            +{scoreDelta}점
          </p>
        )}
        {badge && (
          <p className="text-sm text-realestate-neutral-600 mt-1">
            {badge === "gold"
              ? "실거주 인증 배지를 획득했어요!"
              : badge === "silver"
              ? "현장 인증 배지를 획득했어요!"
              : "인증이 처리되었습니다"}
          </p>
        )}
        {scoreDelta !== null && scoreDelta !== undefined && (
          <p className="text-xs text-realestate-neutral-500 mt-2">
            이 매물이 검색 상단에 노출됩니다
          </p>
        )}
      </div>
      {/* M0: BeforeAfterSlider 는 blurredUrl/beforeUrl 이 모두 있을 때만 조건부 렌더.
          현재 UploadResult 계약에 해당 URL 필드가 없어 step5 에서 생략(domain.ts 비수정).
          백엔드가 blurredUrl 등을 계약에 추가하면 아래처럼 조건부 렌더:
            {result.blurredUrl && beforeUrl && (
              <BeforeAfterSlider blurredUrl={result.blurredUrl} beforeUrl={beforeUrl} />
            )} */}
      <div className="flex gap-3 w-full">
        <button
          type="button"
          onClick={onRetake}
          className="flex-1 h-12 border border-realestate-neutral-300 text-realestate-neutral-700 rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
        >
          다시 찍기
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex-1 h-12 bg-realestate-brand-primary text-white rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    currentStep,
    listingId,
    uploadId,
    uploadResult,
    setStep,
    setListingId,
    setUploadId,
    setUploadResult,
    setPassToken,
  } = useUploadStore();

  useEffect(() => {
    const stepParam = searchParams.get("step");
    const token = searchParams.get("token");
    const listingIdParam = searchParams.get("listingId");

    if (stepParam) {
      const parsed = parseInt(stepParam, 10) as UploadStep;
      if (parsed >= 1 && parsed <= 5) {
        setStep(parsed);
      }
    }
    if (token) {
      setPassToken(token);
    }
    if (listingIdParam && !listingId) {
      setListingId(listingIdParam);
    }
  }, [searchParams, setStep, setPassToken, listingId, setListingId]);

  const handleUploadComplete = useCallback(
    (result: UploadResult) => {
      setUploadId(result.uploadId);
      setStep(4 as const);
    },
    [setUploadId, setStep],
  );

  const handleProcessingComplete = useCallback(
    (result: UploadResultWithDone) => {
      setUploadResult(result);
      setStep(5 as const);
    },
    [setUploadResult, setStep],
  );

  const handleRetake = useCallback(() => {
    setStep(3 as const);
  }, [setStep]);

  const hasInProgress =
    currentStep > 1 && currentStep < 5;

  return (
    <div className="min-h-dvh bg-white pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-realestate-neutral-200 px-4 py-3">
        <VerificationStepper
          currentStep={currentStep}
          estimatedTimes={STEP_TIMES}
        />
      </header>

      {hasInProgress && currentStep !== 4 && (
        <div className="px-4 py-2 text-xs text-realestate-neutral-500 bg-realestate-neutral-50 border-b border-realestate-neutral-200">
          이전 진행을 이어서 합니다
        </div>
      )}

      <main>
        {currentStep === 1 && <Step1Content />}
        {currentStep === 2 && <Step2Content />}
        {currentStep === 3 && !listingId && (
          <ErrorState
            message="매물 정보가 없어요"
            description="매물을 먼저 선택해 주세요"
            secondaryAction={
              <button
                type="button"
                onClick={() => router.push("/")}
                className="w-full px-4 py-3 rounded-md border border-realestate-neutral-300 text-realestate-neutral-700 text-body-s font-medium focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
              >
                홈으로
              </button>
            }
          />
        )}
        {currentStep === 3 && listingId && (
          <Step3Content
            listingId={listingId}
            onUploadComplete={handleUploadComplete}
          />
        )}
        {currentStep === 4 && uploadId && (
          <Step4Content
            uploadId={uploadId}
            onComplete={handleProcessingComplete}
          />
        )}
        {currentStep === 5 && uploadResult && (
          <Step5Content result={uploadResult} onRetake={handleRetake} />
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" aria-busy="true" />}>
      <VerifyContent />
    </Suspense>
  );
}
