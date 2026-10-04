'use client';

/**
 * 토스트 — HUD 아래에 쌓이고 최대 2개, role="status". 행동·획득·추궁 결과 1.6초 / 해금·업적 3.2초 / 사이렌 접근 4초(디자인 §5-19).
 * 토스트가 유일한 정보원이 되면 안 된다 — 같은 정보가 허브 배지·수첩·결과 카드에 남아 있어야 한다.
 */
import { Check, CircleAlert, Clock, Info, Radio, Siren, Star } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ToastInput, ToastKind } from '../lib/context';
import { fxConfig } from '../lib/fx';

interface Item {
  id: number;
  kind: ToastKind;
  text: string;
}

const ICON: Record<ToastKind, ReactNode> = {
  info: <Info size={16} aria-hidden />,
  cost: <Clock size={16} aria-hidden />,
  ok: <Check size={16} aria-hidden />,
  warn: <CircleAlert size={16} aria-hidden />,
  danger: <Siren size={16} aria-hidden />,
  star: <Star size={16} aria-hidden />,
  ai: <Radio size={16} aria-hidden />,
};

export function useToasts(): { items: Item[]; push: (t: ToastInput) => void } {
  const [items, setItems] = useState<Item[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const push = useCallback((t: ToastInput) => {
    const id = ++seq.current;
    setItems((cur) => {
      // 같은 문구가 이미 떠 있으면 중복해서 쌓지 않는다
      if (cur.some((x) => x.text === t.text)) return cur;
      const next = [...cur, { id, kind: t.kind ?? 'info', text: t.text }];
      return next.slice(-2);
    });
    const ms = Math.max(400, (t.ms ?? 1600) * (fxConfig.scale === 0 ? 0.01 : 1));
    timers.current.set(
      id,
      setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== id));
        timers.current.delete(id);
      }, ms),
    );
  }, []);
  useEffect(() => {
    const m = timers.current;
    return () => {
      m.forEach((tm) => clearTimeout(tm));
      m.clear();
    };
  }, []);
  return { items, push };
}

export function ToastStack({ items }: { items: Item[] }) {
  return (
    <div className="wt-toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`wt-toast wt-toast--${t.kind}`} role="status">
          {ICON[t.kind]}
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}

