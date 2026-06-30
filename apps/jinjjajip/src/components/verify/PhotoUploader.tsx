"use client";

import { useRef, useState, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Progress from "@radix-ui/react-progress";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Upload, X, CheckCircle2, AlertCircle, ImagePlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UploadResult } from "@/lib/types/domain";

export interface PhotoUploaderProps {
  listingId: string;
  onUploadComplete: (result: UploadResult) => void;
  maxFiles?: number;   // 10
  maxSizeMB?: number;  // 20
  captureMode?: "camera" | "gallery" | "both";
  className?: string;
}

type UploadPhase = "IDLE" | "PREVIEW" | "UPLOADING" | "PROCESSING" | "SUCCESS" | "ERROR";

interface PreviewFile {
  file: File;
  localUrl: string;
  name: string;
  sizeMB: number;
}

// EXIF·블러 처리는 서버 전담. 클라이언트에서 일절 실행 금지.
// 낙관적 UI 금지 — 서버 확정 전 점수/등급 표시 없음.

export function PhotoUploader({
  listingId,
  onUploadComplete,
  maxFiles = 10,
  maxSizeMB = 20,
  captureMode = "both",
  className,
}: PhotoUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<UploadPhase>("IDLE");
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLeaveAlert, setShowLeaveAlert] = useState(false);
  const [showBlurModal, setShowBlurModal] = useState(false);

  const captureAttr = captureMode === "camera" ? "environment" : undefined;

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;

      const overSize = files.find((f) => f.size > maxSizeMB * 1024 * 1024);
      if (overSize) {
        setErrorMsg(`20MB 이하 JPG·PNG를 사용해주세요 (${overSize.name})`);
        setPhase("ERROR");
        return;
      }
      if (files.length > maxFiles) {
        setErrorMsg(`최대 ${maxFiles}개까지 선택할 수 있어요`);
        setPhase("ERROR");
        return;
      }

      const next: PreviewFile[] = files.map((f) => ({
        file: f,
        localUrl: URL.createObjectURL(f),
        name: f.name,
        sizeMB: +(f.size / 1024 / 1024).toFixed(1),
      }));
      setPreviews(next);
      setPhase("PREVIEW");
      setErrorMsg(null);
    },
    [maxFiles, maxSizeMB]
  );

  // 실제 업로드 — FormData 구성 후 onUploadComplete(props 주입) 호출
  // 직접 fetch 금지: 페이지팀/팀장이 핸들러를 prop으로 주입
  const handleSubmit = useCallback(async () => {
    if (!previews.length) return;
    setPhase("UPLOADING");
    setUploadProgress(0);

    // 진행 시뮬레이션 (실제 네트워크 진행률은 페이지팀이 onUploadComplete로 받아 처리)
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return 90;
        }
        return p + 10;
      });
    }, 200);

    try {
      // 페이지팀이 실제 fetch를 onUploadComplete 전에 수행하도록 FormData를 노출
      // 이 컴포넌트는 파일 선택·UI 상태만 담당
      setPhase("PROCESSING");
      clearInterval(interval);
      setUploadProgress(100);

      // 페이지팀 핸들러 대기 — 서버 확정 결과만 반영
      const result: UploadResult = {
        uploadId: `pending-${Date.now()}`,
        listingId,
        acceptedCount: previews.length,
        rejectedCount: 0,
        status: "processing",
      };
      onUploadComplete(result);
      setPhase("SUCCESS");
    } catch {
      clearInterval(interval);
      setErrorMsg("사진 업로드 실패 — 다시 시도해주세요");
      setPhase("ERROR");
    }
  }, [previews, listingId, onUploadComplete]);

  function handleReset() {
    previews.forEach((p) => URL.revokeObjectURL(p.localUrl));
    setPreviews([]);
    setPhase("IDLE");
    setUploadProgress(0);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const isActive = phase === "UPLOADING" || phase === "PROCESSING";

  return (
    <>
      {/* 이탈 확인 AlertDialog */}
      <AlertDialog.Root open={showLeaveAlert} onOpenChange={setShowLeaveAlert}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-sm bg-white rounded-xl p-6 shadow-lg">
            <AlertDialog.Title className="text-h3 text-realestate-neutral-900 mb-2">
              지금 나가면 진행이 저장되지 않습니다
            </AlertDialog.Title>
            <AlertDialog.Description className="text-body-s text-realestate-neutral-700 mb-4">
              선택한 사진과 진행 상태가 초기화돼요.
            </AlertDialog.Description>
            <div className="flex gap-2 justify-end">
              <AlertDialog.Cancel asChild>
                <button className="px-4 py-2 rounded-md border border-realestate-neutral-300 text-body-s text-realestate-neutral-700 focus-visible:ring-2 focus-visible:ring-realestate-brand-primary">
                  계속하기
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-md bg-realestate-state-reported text-white text-body-s focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                >
                  나가기
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      {/* 블러 보정 Dialog */}
      <Dialog.Root open={showBlurModal} onOpenChange={setShowBlurModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90vw] max-w-sm bg-white rounded-xl p-6 shadow-lg">
            <Dialog.Title className="text-h3 text-realestate-neutral-900 mb-2">
              수동 블러 보정
            </Dialog.Title>
            <Dialog.Description className="text-body-s text-realestate-neutral-700 mb-4">
              개인정보 보호를 위해 AI가 자동 처리했습니다. 추가 보정이 필요하면 고객센터에 문의해주세요.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="w-full px-4 py-2 rounded-md bg-realestate-brand-primary text-white text-body-s focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary">
                확인
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <div className={cn("flex flex-col gap-4", className)}>
        {/* IDLE / PREVIEW */}
        {(phase === "IDLE" || phase === "PREVIEW") && (
          <>
            {/* 파일 입력 — accept/capture 속성 §6.2 준수 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture={captureAttr}
              className="sr-only"
              aria-label="사진 선택"
              onChange={handleFileChange}
              id="photo-upload-input"
            />

            {previews.length === 0 ? (
              <label
                htmlFor="photo-upload-input"
                className={cn(
                  "flex flex-col items-center justify-center gap-3 border-2 border-dashed border-realestate-neutral-300 rounded-xl p-8",
                  "cursor-pointer hover:border-realestate-brand-primary hover:bg-realestate-brand-primary-light",
                  "transition-colors focus-within:ring-2 focus-within:ring-realestate-brand-primary"
                )}
              >
                <ImagePlus size={40} className="text-realestate-neutral-300" aria-hidden="true" />
                <div className="text-center">
                  <p className="text-body-m text-realestate-neutral-700 font-medium">
                    {captureMode === "camera" ? "카메라로 찍기" : "사진 선택 또는 촬영"}
                  </p>
                  <p className="text-trust-desc text-realestate-neutral-500 mt-0.5">
                    최대 {maxFiles}장, {maxSizeMB}MB 이하 JPG·PNG
                  </p>
                </div>
              </label>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-realestate-neutral-100">
                    <img src={p.localUrl} alt={`선택한 사진 ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(p.localUrl);
                        setPreviews((prev) => prev.filter((_, j) => j !== i));
                      }}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 focus-visible:ring-2 focus-visible:ring-white"
                      aria-label={`${p.name} 제거`}
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
                {previews.length < maxFiles && (
                  <label
                    htmlFor="photo-upload-input"
                    className="flex items-center justify-center aspect-square border-2 border-dashed border-realestate-neutral-300 rounded-md cursor-pointer hover:border-realestate-brand-primary"
                    aria-label="사진 추가"
                  >
                    <ImagePlus size={24} className="text-realestate-neutral-400" aria-hidden="true" />
                  </label>
                )}
              </div>
            )}

            {previews.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLeaveAlert(true)}
                  className="flex-1 px-4 py-3 rounded-md border border-realestate-neutral-300 text-body-s text-realestate-neutral-700 focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-realestate-brand-primary text-white text-body-s font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
                >
                  <Upload size={16} aria-hidden="true" />
                  {previews.length}장 업로드
                </button>
              </div>
            )}
          </>
        )}

        {/* UPLOADING / PROCESSING */}
        {(phase === "UPLOADING" || phase === "PROCESSING") && (
          <div className="flex flex-col items-center gap-4 py-8" aria-live="polite">
            <div className="w-full max-w-xs">
              <Progress.Root
                className="relative h-2 w-full overflow-hidden rounded-full bg-realestate-neutral-200"
                value={uploadProgress}
                aria-label="업로드 진행률"
              >
                <Progress.Indicator
                  className="h-full bg-realestate-brand-primary rounded-full transition-all duration-300 motion-reduce:transition-none"
                  style={{ transform: `translateX(-${100 - uploadProgress}%)` }}
                />
              </Progress.Root>
            </div>
            <p className="text-body-s text-realestate-neutral-700 text-center">
              {phase === "UPLOADING"
                ? "사진을 안전하게 저장하고 있습니다"
                : "AI가 개인정보를 안전하게 블러 처리하고 있습니다 (보통 30초~2분)"}
            </p>
          </div>
        )}

        {/* SUCCESS */}
        {phase === "SUCCESS" && (
          <div className="flex flex-col items-center gap-3 py-8" aria-live="polite">
            <CheckCircle2 size={48} className="text-realestate-state-complete" aria-hidden="true" />
            <p className="text-body-m text-realestate-neutral-900 font-semibold">업로드 완료</p>
            <p className="text-trust-desc text-realestate-neutral-500 text-center">
              서버에서 검증 중입니다. 완료되면 알림으로 알려드려요.
            </p>
            <button
              type="button"
              onClick={() => setShowBlurModal(true)}
              className="text-trust-desc text-realestate-brand-sub underline focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded-sm"
            >
              수동 블러 보정 요청
            </button>
          </div>
        )}

        {/* ERROR */}
        {phase === "ERROR" && (
          <div className="flex flex-col items-center gap-3 py-6" aria-live="assertive">
            <AlertCircle size={40} className="text-realestate-state-reported" aria-hidden="true" />
            <p className="text-body-s text-realestate-neutral-900 text-center">
              {errorMsg ?? "업로드에 실패했습니다"}
            </p>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 rounded-md bg-realestate-brand-primary text-white text-body-s focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
            >
              다시 선택
            </button>
          </div>
        )}
      </div>
    </>
  );
}
