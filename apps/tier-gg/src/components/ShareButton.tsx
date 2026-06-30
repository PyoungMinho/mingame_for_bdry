"use client";

import { useState, useCallback } from "react";

interface ShareButtonProps {
  label: string;
  copiedLabel?: string;
  ariaLabel?: string;
}

export default function ShareButton({ label, copiedLabel = "Copied!", ariaLabel }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ url, title: document.title });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // user cancelled share or clipboard denied
    }
  }, []);

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={ariaLabel ?? label}
      className="rounded-lg border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
