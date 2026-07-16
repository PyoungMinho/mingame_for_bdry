"use client";

import { Info } from "lucide-react";

export interface StorageUnavailableNoticeProps {
  onDismiss: () => void;
  className?: string;
}

/**
 * localStorage 불가 안내 (design-final §4-13). 세션당 1회, 비차단, 에러색·모달 금지.
 * 기능 감지·세션당 1회 노출 판단은 페이지 책임 — 이 컴포넌트는 마운트되면 항상 보인다.
 */
export default function StorageUnavailableNotice({
  onDismiss,
  className = "",
}: StorageUnavailableNoticeProps) {
  return (
    <div className={`dn-storage-notice ${className}`.trim()} role="status">
      <Info size={16} aria-hidden="true" />
      <span className="dn-storage-notice-text dn-text-body-sm">
        이 브라우저에서는 기록이 저장되지 않아요
      </span>
      <button
        type="button"
        className="dn-storage-notice-dismiss touch-target"
        onClick={onDismiss}
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
