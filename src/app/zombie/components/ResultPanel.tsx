'use client';

import { Biohazard, ChevronRight, Clock, HeartPulse } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { COMPANIONS, ITEMS, STAT_META } from '@/lib/zombie/contract';
import type { Resolution } from '@/lib/zombie/engine';
import type { StatKey } from '@/lib/zombie/types';
import { modalOpen } from './ChoiceList';

type Chip = { tone: 'hp' | 'supply' | 'mental' | 'good' | 'bad' | 'item' | 'infect' | 'muted'; text: string };

function chips(res: Resolution): Chip[] {
  const d = res.delta;
  const out: Chip[] = [];
  const stat = (k: StatKey, v: number) => {
    if (v) out.push({ tone: k, text: `${STAT_META[k].label} ${v > 0 ? '+' : ''}${v}` });
  };
  stat('hp', d.hp);
  stat('supply', d.supply);
  stat('mental', d.mental);
  d.itemsGained.forEach((i) => out.push({ tone: 'item', text: `+ ${ITEMS[i].name}` }));
  d.itemsLost.forEach((i) => out.push({ tone: 'muted', text: `− ${ITEMS[i].name}` }));
  d.joined.forEach((m) => out.push({ tone: 'good', text: `${COMPANIONS[m].name} 합류` }));
  d.left.forEach((m) => out.push({ tone: 'bad', text: `${COMPANIONS[m].name} 이탈` }));
  if (d.infected) out.push({ tone: 'infect', text: '감염됨' });
  if (d.cured) out.push({ tone: 'good', text: '감염 치료' });
  if (d.clutch) out.push({ tone: 'bad', text: '구사일생 — 1로 버텼다' });
  return out;
}

export function ResultPanel({ res, onContinue }: { res: Resolution; onContinue: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const uid = useId();
  const textId = `${uid}-text`;
  const chipsId = `${uid}-chips`;
  const list = chips(res);
  const up = res.delta.upkeep;
  const ends = Boolean(res.state.ending);
  const hasChips = list.length > 0 || res.delta.hours > 0 || up.supply !== 0 || up.hp !== 0;

  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ') || modalOpen()) return;
      const t = e.target as HTMLElement | null;
      // 다른 버튼·입력에 포커스가 있으면 그 요소의 기본 동작을 존중한다
      if (t && t !== document.body && t !== btn.current && t.closest('button, a, input, textarea, select')) return;
      if (t === btn.current) return; // 버튼 자체의 네이티브 click 으로 처리
      e.preventDefault();
      onContinue();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <section className="zb-result" aria-label="선택 결과">
      <p className="zb-result-choice">
        <span aria-hidden>▸</span> {res.choice.label}
      </p>
      <div className="zb-result-text" id={textId}>
        {res.result.map((p, i) => (
          <p key={i} style={{ ['--i' as string]: i }}>
            {p}
          </p>
        ))}
      </div>
      {hasChips && (
        <ul className="zb-deltas" id={chipsId} aria-label="변화">
          {list.map((c, i) => (
            <li key={i} className="zb-chip" data-tone={c.tone}>
              {c.tone === 'infect' && <Biohazard aria-hidden />}
              {c.text}
            </li>
          ))}
          {res.delta.hours > 0 && (
            <li className="zb-chip" data-tone="muted">
              <Clock aria-hidden />+{res.delta.hours}시간
            </li>
          )}
          {up.supply < 0 && !res.delta.starving && (
            <li className="zb-chip zb-chip-upkeep" data-tone="muted">
              버티는 데 보급 {up.supply}
            </li>
          )}
          {res.delta.starving && (
            <li className="zb-chip" data-tone="bad">
              <HeartPulse aria-hidden />
              굶주림 체력 {up.hp} · 정신 {up.mental}
            </li>
          )}
        </ul>
      )}
      <button
        ref={btn}
        type="button"
        className="zb-continue"
        onClick={onContinue}
        onKeyDown={(e) => {
          // 선택지에서 Enter 를 누른 채로 있으면 반복 입력이 결과를 읽기도 전에 넘겨 버린다
          if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
        }}
        aria-describedby={hasChips ? `${textId} ${chipsId}` : textId}
      >
        {ends ? '결말 보기' : '계속'}
        <ChevronRight aria-hidden />
      </button>
    </section>
  );
}
