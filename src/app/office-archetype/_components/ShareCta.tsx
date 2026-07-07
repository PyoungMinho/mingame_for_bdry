"use client";

import { useState } from "react";
import { Share2, Download } from "lucide-react";

declare global {
  interface Window {
    Kakao?: {
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: Record<string, unknown>) => void;
      };
    };
  }
}

export interface ShareCtaProps {
  /** 공유할 결과 페이지 URL (딥링크, /result/[typeSlug] 절대경로) */
  shareUrl: string;
  /** 공유 시 타이틀/설명 — 카피는 호출부(config/type 데이터)에서 조합해 전달, 하드코딩 금지 */
  shareTitle: string;
  shareText: string;
  /** 이미지 저장(스토리 포맷) 다운로드용 URL, 예: /og/[typeSlug]?ratio=9x16
   *  (route는 ?ratio=1x1|9x16만 읽는다. 이전 주석의 ?variant=square|story는 구설계 표기라 삭제) */
  imageDownloadUrl: string;
  /** 다운로드 파일명 */
  imageFileName?: string;
  /** 라벨 문자열(config.labels에서 주입) */
  labels: {
    shareKakao: string;
    shareStory: string;
    toastCopied?: string;
  };
  className?: string;
}

/**
 * 공유 폴백 체인(design-final §1 화면3 확정):
 * Web Share API(navigator.share, 가능 시 files) → 실패/미지원 시 Kakao SDK
 * (Kakao.Share.sendDefault) → 최종 클립보드 복사 + 토스트.
 * 빈 에러창/콘솔 에러 노출 절대 금지 — 모든 실패는 조용히 다음 폴백으로 넘어간다.
 */
export default function ShareCta({
  shareUrl,
  shareTitle,
  shareText,
  imageDownloadUrl,
  imageFileName = "office-archetype.png",
  labels,
  className = "",
}: ShareCtaProps) {
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(labels.toastCopied ?? "링크가 복사되었어요");
    } catch {
      // 클립보드조차 실패하면 사용자에게 URL을 직접 보여주는 최후 수단(에러창 금지 원칙 준수)
      showToast(shareUrl);
    }
  }

  function shareViaKakao() {
    try {
      if (typeof window !== "undefined" && window.Kakao?.isInitialized?.()) {
        window.Kakao.Share.sendDefault({
          objectType: "feed",
          content: {
            title: shareTitle,
            description: shareText,
            imageUrl: imageDownloadUrl,
            link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
          },
        });
        return;
      }
    } catch {
      // 조용히 다음 폴백으로
    }
    copyToClipboard();
  }

  async function handleKakaoShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
        // 사용자가 취소했거나 미지원 — 다음 폴백(Kakao SDK)으로 조용히 이동
      }
    }
    shareViaKakao();
  }

  async function handleImageSave() {
    try {
      const res = await fetch(imageDownloadUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = imageFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // 다운로드 실패 시에도 에러창 없이 새 탭으로 폴백
      window.open(imageDownloadUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className={`oa-share-cta ${className}`.trim()}>
      <div className="oa-share-cta-row">
        <button
          type="button"
          className="oa-share-btn oa-share-btn-primary touch-target"
          onClick={handleKakaoShare}
        >
          <Share2 size={18} aria-hidden="true" />
          {labels.shareKakao}
        </button>
        <button
          type="button"
          className="oa-share-btn oa-share-btn-secondary touch-target"
          onClick={handleImageSave}
        >
          <Download size={18} aria-hidden="true" />
          {labels.shareStory}
        </button>
      </div>
      {toast ? (
        <div className="oa-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
