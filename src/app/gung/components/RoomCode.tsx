'use client';

/**
 * §5-23 RoomCode — "7F3K-5" mono 44. 탭 = 복사 → 라벨 "복사됨 ✓" 2초(토스트 아님, 인라인).
 */
import { useRef, useState } from 'react';

export interface RoomCodeProps {
  /** 저장/전달용 5자(하이픈 없음) — 표시할 때 마지막 1자 앞에 하이픈을 넣는다 */
  code: string;
  tag?: string;
  n?: number;
  compact?: boolean;
  className?: string;
}

function formatDisplay(code: string): string {
  if (code.length < 2) return code;
  return `${code.slice(0, -1)}-${code.slice(-1)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function RoomCode({ code, tag, n, compact, className }: RoomCodeProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);
  const display = formatDisplay(code);

  const handleCopy = async () => {
    const ok = await copyText(display);
    if (!ok) return;
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button type="button" className={['gu-roomcode', className ?? ''].filter(Boolean).join(' ')} data-compact={compact || undefined} onClick={handleCopy} aria-label={`방 코드 ${display}, 탭하여 복사`}>
      <span className="gu-roomcode-code gu-num">{copied ? '복사됨 ✓' : display}</span>
      {(tag || n) && !copied && (
        <span className="gu-roomcode-meta">
          {n ? `${n}인` : ''}
          {n && tag ? ' · ' : ''}
          {tag ? `사건 표식 「${tag}」` : ''}
        </span>
      )}
    </button>
  );
}
