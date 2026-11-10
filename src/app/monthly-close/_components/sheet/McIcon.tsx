/** 문서 아이콘 — 상단바 20px · 파비콘과 같은 그림(디자인 최종안 §6-4). 접힌 모서리·녹색 없음. */
export function McIcon({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4.5" y="6.5" width="23" height="19" fill="#FFFFFF" stroke="#5B6168" strokeWidth="1.5" />
      <rect x="5.25" y="7.25" width="21.5" height="4" fill="#E3E5E8" />
      <path d="M5 11.5h22M5 16h22M5 20.5h22M12 7v18.5M19.5 7v18.5" fill="none" stroke="#9AA1A9" strokeWidth="1" />
      <rect x="12.5" y="16.5" width="6.5" height="3.5" fill="#2F5E8E" />
    </svg>
  );
}
