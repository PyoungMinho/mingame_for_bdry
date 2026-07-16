"use client";

import { useEffect, useRef, useState } from "react";
import { Clipboard, Share2 } from "lucide-react";

export interface ShareButtonsProps {
  /**
   * 이미 조립된 공유 텍스트. 색블록·색이모지가 절대 포함되지 않은, 색 토큰과
   * 물리적으로 분리된 별도 포매터 모듈이 만든 문자열이어야 한다(§9-1 가드).
   * 이 컴포넌트는 문자열을 그대로 클립보드/Web Share에 전달할 뿐 직접 조립하지 않는다.
   */
  shareText: string;
  /** navigator.share 호출용 URL */
  shareUrl: string;
  copyLabel?: string;
  copiedLabel?: string;
  shareLabel?: string;
  /** 복사 성공 시 호출(분석 등 부가 훅, 선택) */
  onCopied?: () => void;
  className?: string;
}

const COPIED_RESET_MS = 2000;

/**
 * 공유 버튼 (design-final §4-14, F3 확정).
 * - 1차(항상): "결과 복사하기 📋" → clipboard 복사 → **버튼 라벨 인라인 전환**
 *   "복사됨 ✓"(2초 후 원복) + aria-live. 토스트 컴포넌트는 쓰지 않는다.
 * - 2차(navigator.share 지원 기기만): "공유하기" 버튼을 추가로 노출. 실패/취소 시
 *   에러 UI 분기 없이 조용히 클립보드 복사로 폴백한다.
 */
export default function ShareButtons({
  shareText,
  shareUrl,
  copyLabel = "결과 복사하기",
  copiedLabel = "복사됨 ✓",
  shareLabel = "공유하기",
  onCopied,
  className = "",
}: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // 클립보드 API 자체가 막힌 환경 — 조용히 무시(에러창 금지 원칙)
    }
    setCopied(true);
    onCopied?.();
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ text: shareText, url: shareUrl });
    } catch {
      // 사용자 취소 또는 실패 — 분기 UI 없이 조용히 클립보드로 폴백(§4-14)
      await copyToClipboard();
    }
  }

  return (
    <div className={`dn-share-buttons ${className}`.trim()}>
      <button
        type="button"
        className={`dn-share-copy touch-target${copied ? " is-copied" : ""}`}
        onClick={copyToClipboard}
      >
        <Clipboard size={18} aria-hidden="true" />
        {copied ? copiedLabel : `${copyLabel} 📋`}
      </button>
      <span className="dn-sr-only" role="status" aria-live="polite">
        {copied ? "복사되었습니다" : ""}
      </span>

      {canNativeShare ? (
        <button type="button" className="dn-share-native touch-target" onClick={handleNativeShare}>
          <Share2 size={18} aria-hidden="true" />
          {shareLabel}
        </button>
      ) : null}
    </div>
  );
}
