'use client';

/**
 * §5-16 CountdownOverlay — 전체 화면 scrim, 셋·둘·하나·지목!(Song Myung 140, 마지막만 red-ink).
 * 각 단어 900ms 간격(§4-4). 소리(탁×3+징)는 §12-6 `sound.ts` 소유라 여기선 `onWordChange`로만 알린다.
 * 화면 탭 = 건너뛰기.
 */
import { useEffect, useRef, useState } from 'react';

const WORDS = ['셋', '둘', '하나', '지목!'] as const;
export type CountdownWord = (typeof WORDS)[number];

export interface CountdownOverlayProps {
  onDone: () => void;
  onWordChange?: (word: CountdownWord, index: number) => void;
  className?: string;
}

export function CountdownOverlay({ onDone, onWordChange, className }: CountdownOverlayProps) {
  const [index, setIndex] = useState(0);
  // 건너뛰기 탭과 마지막 틱이 겹치거나 더블탭해도 onDone 은 정확히 1번
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    onWordChange?.(WORDS[0], 0);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i >= WORDS.length) {
        window.clearInterval(id);
        finish();
        return;
      }
      setIndex(i);
      onWordChange?.(WORDS[i], i);
    }, 900);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button type="button" className={['gu-countdown', className ?? ''].filter(Boolean).join(' ')} onClick={finish} aria-label="건너뛰기">
      <span className="gu-countdown-word gu-display" data-final={index === WORDS.length - 1 || undefined} key={index}>
        {WORDS[index]}
      </span>
    </button>
  );
}
