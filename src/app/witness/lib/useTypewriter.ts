'use client';

/**
 * 타이핑 효과(§6-1). 글자 간격 보통 28ms · 빠름 12ms · 즉시 0. 문장부호 멈춤, 줄당 상한 1.4초.
 * 탭이 숨겨지면 멈춘다(paused). 하이드레이션 안전: 첫 렌더는 항상 '완성된 텍스트 또는 빈 문자열' 중 결정론적인 쪽.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { TYPE_CAP_MS, TYPE_MS, TYPE_PAUSE, fxConfig } from './fx';

export type TypeSpeed = 'normal' | 'fast' | 'instant';

/** 각 글자를 보여 준 뒤 다음 글자까지의 지연(ms). 총합이 상한을 넘으면 비례해 줄인다 */
export function typeDelays(text: string, speed: TypeSpeed): number[] {
  const base = TYPE_MS[speed];
  if (base === 0) return [];
  const pauseK = speed === 'fast' ? 0.5 : 1;
  const raw = [...text].map((ch) => base + (TYPE_PAUSE[ch] ?? 0) * pauseK);
  const total = raw.reduce((a, b) => a + b, 0);
  if (total <= TYPE_CAP_MS) return raw;
  const k = TYPE_CAP_MS / total;
  return raw.map((d) => d * k);
}

export interface TypewriterState {
  shown: string;
  done: boolean;
  skip: () => void;
}

export function useTypewriter(text: string, speed: TypeSpeed, opts: { instant?: boolean; paused?: boolean; resetKey?: string | number } = {}): TypewriterState {
  const chars = [...text];
  const instant = !!opts.instant || speed === 'instant' || fxConfig.scale === 0;
  const key = `${opts.resetKey ?? ''}|${text}`;
  const [st, setSt] = useState<{ k: string; n: number }>({ k: key, n: instant ? chars.length : 0 });
  const nRef = useRef(st.n);

  // key 가 바뀌면 즉시 새 상태(렌더 중 파생 — 한 프레임 깜빡임 방지)
  let n = st.k === key ? st.n : instant ? chars.length : 0;
  if (st.k !== key) {
    nRef.current = n;
    setSt({ k: key, n });
  }

  useEffect(() => {
    if (instant) {
      nRef.current = chars.length;
      setSt((s) => (s.k === key && s.n === chars.length ? s : { k: key, n: chars.length }));
      return;
    }
    if (opts.paused) return;
    const delays = typeDelays(text, speed);
    let i = nRef.current;
    if (i >= chars.length) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      i += 1;
      nRef.current = i;
      setSt({ k: key, n: i });
      if (i < chars.length) timer = setTimeout(tick, delays[i - 1] ?? TYPE_MS[speed]);
    };
    timer = setTimeout(tick, delays[Math.max(0, i - 1)] ?? TYPE_MS[speed]);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, speed, instant, opts.paused]);

  const skip = useCallback(() => {
    nRef.current = chars.length;
    setSt({ k: key, n: chars.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, chars.length]);

  n = Math.min(n, chars.length);
  return { shown: chars.slice(0, n).join(''), done: n >= chars.length, skip };
}
