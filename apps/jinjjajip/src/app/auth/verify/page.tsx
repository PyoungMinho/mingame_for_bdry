"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, useCallback } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as Accordion from "@radix-ui/react-accordion";
import { Check } from "lucide-react";
import { useUploadStore } from "@/lib/store/upload";
import { cn } from "@/lib/utils";

const REQUIRED_CONSENTS = [
  {
    id: "consent-author",
    label: "사진 게시 주체가 본인(세입자)임을 확인합니다 (필수)",
    fullText:
      "본인이 실제 거주하는 해당 매물의 사진을 직접 촬영하여 게시하는 것에 동의합니다. 허위 또는 타인의 사진을 게시할 경우 이용 약관에 따라 계정 제한 조치가 취해질 수 있습니다.",
  },
  {
    id: "consent-blur",
    label: "AI 자동 블러링 처리에 동의합니다 (필수)",
    fullText:
      "업로드한 사진에서 개인정보(얼굴, 차량번호, 개인 물품 등)가 AI에 의해 자동으로 블러 처리됩니다. 블러 처리 결과는 업로드 완료 후 확인하실 수 있으며, 수동 보정을 요청할 수 있습니다.",
  },
  {
    id: "consent-takedown",
    label: "신고 시 즉시 비공개 전환에 동의합니다 (필수)",
    fullText:
      "다른 사용자의 신고가 접수되면 검토 완료 시까지 매물이 즉시 비공개로 전환됩니다. 검토 결과 허위 신고로 판명될 경우 즉시 재공개됩니다.",
  },
] as const;

const OPTIONAL_CONSENT = {
  id: "consent-retention",
  label: "퇴거 후에도 사진 보존에 동의합니다 (선택)",
  fullText:
    "퇴거 후에도 해당 사진이 매물 신뢰 점수 산정에 활용되도록 보존하는 것에 동의합니다. 언제든지 설정에서 철회하실 수 있습니다.",
};

function AuthVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/verify";

  const setStep = useUploadStore((s) => s.setStep);
  const setConsentCompleted = useUploadStore((s) => s.setConsentCompleted);
  const setPassToken = useUploadStore((s) => s.setPassToken);

  const [passCompleted, setPassCompleted] = useState(false);
  const [checkedRequired, setCheckedRequired] = useState<Record<string, boolean>>({});
  const [checkedOptional, setCheckedOptional] = useState(false);

  const allRequired = REQUIRED_CONSENTS.every((c) => checkedRequired[c.id]);
  const canProceed = passCompleted && allRequired;

  const handleCheckAll = useCallback(() => {
    if (allRequired) {
      setCheckedRequired({});
    } else {
      const all: Record<string, boolean> = {};
      REQUIRED_CONSENTS.forEach((c) => {
        all[c.id] = true;
      });
      setCheckedRequired(all);
      setCheckedOptional(true);
    }
  }, [allRequired]);

  const handlePassMock = useCallback(() => {
    const mockToken = `pass_mock_${Date.now()}`;
    setPassToken(mockToken);
    setPassCompleted(true);
  }, [setPassToken]);

  const handleProceed = useCallback(() => {
    setConsentCompleted(true);
    setStep(3 as const);
    router.push(`${returnTo}?step=3`);
  }, [setConsentCompleted, setStep, router, returnTo]);

  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-40 flex items-center px-4 h-12 border-b border-realestate-neutral-200 bg-white">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="뒤로 가기"
          className="w-10 h-10 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </button>
        <h1 className="ml-2 text-base font-semibold text-realestate-neutral-900">
          본인인증 및 동의
        </h1>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-lg mx-auto">
        {/* Step 1 — PASS 인증 */}
        <section aria-labelledby="pass-heading">
          <h2 id="pass-heading" className="text-sm font-semibold text-realestate-neutral-700 mb-3">
            1단계. 본인인증
          </h2>
          {passCompleted ? (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium"
            >
              <Check size={16} aria-hidden="true" />
              본인인증 완료되었습니다
            </div>
          ) : (
            <button
              type="button"
              onClick={handlePassMock}
              className="w-full h-14 bg-realestate-brand-primary text-white rounded-md text-base font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
            >
              PASS 인증하기
            </button>
          )}
          <p className="mt-2 text-xs text-realestate-neutral-500 text-center">
            통신사 본인인증 · 1탭 완결
          </p>
        </section>

        {/* Step 2 — 전자동의 */}
        <section aria-labelledby="consent-heading">
          <h2 id="consent-heading" className="text-sm font-semibold text-realestate-neutral-700 mb-3">
            2단계. 전자동의
          </h2>

          {/* 모두 동의 숏컷 */}
          <button
            type="button"
            onClick={handleCheckAll}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-realestate-brand-primary mb-4 text-sm font-semibold text-realestate-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
          >
            <Checkbox.Root
              checked={allRequired}
              aria-label="모두 동의"
              className="w-5 h-5 rounded border-2 border-realestate-brand-primary bg-white flex items-center justify-center data-[state=checked]:bg-realestate-brand-primary"
              asChild
            >
              <span aria-hidden="true">
                {allRequired && <Check size={12} strokeWidth={2.5} className="text-white" />}
              </span>
            </Checkbox.Root>
            모두 동의하고 계속
          </button>

          {/* 필수 동의 목록 */}
          <Accordion.Root type="multiple" className="space-y-2">
            {REQUIRED_CONSENTS.map((consent) => (
              <Accordion.Item
                key={consent.id}
                value={consent.id}
                className="border border-realestate-neutral-200 rounded-lg overflow-hidden"
              >
                <div className="flex items-start gap-3 px-4 py-3">
                  <Checkbox.Root
                    id={consent.id}
                    checked={!!checkedRequired[consent.id]}
                    onCheckedChange={(checked) =>
                      setCheckedRequired((prev) => ({
                        ...prev,
                        [consent.id]: !!checked,
                      }))
                    }
                    className="mt-0.5 w-5 h-5 rounded border-2 border-realestate-neutral-300 bg-white flex-shrink-0 flex items-center justify-center data-[state=checked]:bg-realestate-brand-primary data-[state=checked]:border-realestate-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                  >
                    <Checkbox.Indicator>
                      <Check size={12} strokeWidth={2.5} className="text-white" />
                    </Checkbox.Indicator>
                  </Checkbox.Root>
                  <label
                    htmlFor={consent.id}
                    className="text-sm text-realestate-neutral-700 flex-1 cursor-pointer"
                  >
                    {consent.label}
                  </label>
                  <Accordion.Header asChild>
                    <Accordion.Trigger
                      className="flex-shrink-0 text-realestate-neutral-500 data-[state=open]:rotate-180 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded"
                      aria-label="약관 전문 보기"
                    >
                      <ChevronDown size={16} aria-hidden="true" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                </div>
                <Accordion.Content className="px-4 pb-3 text-xs text-realestate-neutral-500 leading-relaxed border-t border-realestate-neutral-100 pt-3">
                  {consent.fullText}
                </Accordion.Content>
              </Accordion.Item>
            ))}

            {/* 선택 동의 */}
            <Accordion.Item
              value={OPTIONAL_CONSENT.id}
              className="border border-realestate-neutral-200 rounded-lg overflow-hidden"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <Checkbox.Root
                  id={OPTIONAL_CONSENT.id}
                  checked={checkedOptional}
                  onCheckedChange={(checked) => setCheckedOptional(!!checked)}
                  className="mt-0.5 w-5 h-5 rounded border-2 border-realestate-neutral-300 bg-white flex-shrink-0 flex items-center justify-center data-[state=checked]:bg-realestate-brand-primary data-[state=checked]:border-realestate-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                >
                  <Checkbox.Indicator>
                    <Check size={12} strokeWidth={2.5} className="text-white" />
                  </Checkbox.Indicator>
                </Checkbox.Root>
                <label
                  htmlFor={OPTIONAL_CONSENT.id}
                  className="text-sm text-realestate-neutral-500 flex-1 cursor-pointer"
                >
                  {OPTIONAL_CONSENT.label}
                </label>
                <Accordion.Header asChild>
                  <Accordion.Trigger
                    className="flex-shrink-0 text-realestate-neutral-500 data-[state=open]:rotate-180 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded"
                    aria-label="약관 전문 보기"
                  >
                    <ChevronDown size={16} aria-hidden="true" />
                  </Accordion.Trigger>
                </Accordion.Header>
              </div>
              <Accordion.Content className="px-4 pb-3 text-xs text-realestate-neutral-500 leading-relaxed border-t border-realestate-neutral-100 pt-3">
                {OPTIONAL_CONSENT.fullText}
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>

          <p className="mt-4 text-xs text-realestate-neutral-500 text-center">
            약관 버전 v1.2 · 2026-06-03
          </p>
        </section>

        {/* 진행 버튼 */}
        <button
          type="button"
          onClick={handleProceed}
          disabled={!canProceed}
          aria-disabled={!canProceed}
          className={cn(
            "w-full h-14 rounded-md text-base font-semibold transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary",
            canProceed
              ? "bg-realestate-brand-primary text-white"
              : "bg-realestate-neutral-200 text-realestate-neutral-500 cursor-not-allowed",
          )}
        >
          {!passCompleted
            ? "먼저 본인인증을 완료해주세요"
            : !allRequired
            ? "필수 항목에 모두 동의해주세요"
            : "동의하고 사진 등록하기"}
        </button>
      </div>
    </div>
  );
}

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white" aria-busy="true" />}>
      <AuthVerifyContent />
    </Suspense>
  );
}
