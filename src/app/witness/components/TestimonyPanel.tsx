'use client';

/**
 * 심문 하단 패널 — 줄 카드 · ◀ 줄 점 ▶ · [추궁] [증거 제시] (디자인 §5-9, UI 5-7·5-8).
 *  - 진실 유형(기록·해석 등)은 화면에 쓰지 않는다. 깨진 줄은 취소선 + 「정정」 칩 + 정정 진술, 제시 버튼은 [다음 줄 ▶] 로 바뀐다(D32).
 *  - 줄 점: 현재 · 미추궁 · 추궁함 · 깨짐 · NEW(숨은 줄). 마지막 줄 다음은 1번으로 순환(토스트 「처음 줄로」).
 *  - 스와이프 임계 48px(가장자리 20px 제외), 키보드 ←/→. 필수 경로는 전부 버튼이다.
 */
import { ChevronLeft, ChevronRight, FileSearch, MessageCircleQuestion, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { Break, Line } from '@/lib/witness';
import { nameOf } from '../lib/format';

export interface LineRow {
  line: Line;
  pressed: boolean;
  broken: Break | null;
  isNew: boolean;
}

export function dotState(row: LineRow, current: boolean): { key: 'current' | 'new' | 'broken' | 'pressed' | 'plain'; aria: string } {
  if (current) return { key: 'current', aria: '현재' };
  if (row.broken) return { key: 'broken', aria: '깨짐' };
  if (row.isNew) return { key: 'new', aria: '새 줄' };
  if (row.pressed) return { key: 'pressed', aria: '추궁함' };
  return { key: 'plain', aria: '추궁 안 함' };
}

export interface TestimonyPanelProps {
  rows: LineRow[];
  index: number;
  multi: boolean;
  tutorial: boolean;
  disabled: boolean;
  onIndex: (i: number, wrapped?: boolean) => void;
  onPress: () => void;
  onPresent: () => void;
  /** 이 줄이 [증거 제시] 유도 대상(튜토리얼) */
  pulsePresent?: boolean;
  keysEnabled: boolean;
  coach?: ReactNode;
}

export function TestimonyPanel({ rows, index, multi, tutorial, disabled, onIndex, onPress, onPresent, pulsePresent, keysEnabled, coach }: TestimonyPanelProps) {
  const row = rows[index];
  const total = rows.length;
  const go = (d: 1 | -1) => {
    if (total <= 1) return;
    const n = (index + d + total) % total;
    onIndex(n, d === 1 && index === total - 1);
  };
  const goRef = useRef(go);
  goRef.current = go;
  const swipe = useRef<{ x: number } | null>(null);

  useEffect(() => {
    if (!keysEnabled) return;
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      if (document.querySelector('.wt-sheet')) return;
      if (e.key === 'ArrowLeft') goRef.current(-1);
      else if (e.key === 'ArrowRight') goRef.current(1);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [keysEnabled]);

  if (!row) return null;
  const { line, broken } = row;
  const nextLabel = '다음 줄 ▶';

  return (
    <div className="wt-tpanel">
      <div
        className="wt-linecard"
        data-spk={line.who}
        data-broken={broken ? '1' : undefined}
        data-new={row.isNew ? '1' : undefined}
        onPointerDown={(e) => {
          const w = (e.currentTarget as HTMLElement).clientWidth || window.innerWidth;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          swipe.current = x < 20 || x > w - 20 ? null : { x: e.clientX };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || disabled) return;
          const dx = e.clientX - s.x;
          if (dx <= -48) go(1);
          else if (dx >= 48) go(-1);
        }}
        onPointerCancel={() => (swipe.current = null)}
      >
        <div className="wt-linecard-head">
          <span className="wt-linecard-n">
            {index + 1}/{total}
          </span>
          {multi && <span className="wt-linecard-who">{nameOf(line.who)}</span>}
          {line.claimTime && (
            <span className="wt-claim" title="증언이 주장하는 시각">
              주장 · {line.claimTime}
            </span>
          )}
          <span className="wt-grow" />
          {row.isNew && !broken && <span className="wt-card-new">NEW</span>}
          {broken ? <span className="wt-chip wt-chip--minor">깨짐</span> : row.pressed ? <span className="wt-linecard-mark">추궁함</span> : null}
        </div>
        <p className="wt-linecard-text">{broken ? <s>{line.text}</s> : `“${line.text}”`}</p>
        {broken?.revisedText && (
          <p className="wt-linecard-revised">
            <span className="wt-chip wt-chip--cost">{broken.type === 'permission' ? '권한 해제' : '정정'}</span>
            <span>“{broken.revisedText}”</span>
          </p>
        )}
      </div>

      <div className="wt-linenav">
        <button type="button" className="wt-iconbtn wt-iconbtn--lg" onClick={() => go(-1)} aria-label="이전 줄" disabled={disabled || total <= 1}>
          <ChevronLeft size={22} aria-hidden />
        </button>
        <ol className="wt-dots" aria-label="증언 줄">
          {rows.map((r, i) => {
            const st = dotState(r, i === index);
            return (
              <li key={r.line.id}>
                <button type="button" className="wt-linedot" data-state={st.key} onClick={() => onIndex(i)} aria-label={`${i + 1}번 줄, ${st.aria}`} aria-current={i === index ? 'true' : undefined} disabled={disabled}>
                  {st.key === 'broken' ? <X size={10} aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="wt-iconbtn wt-iconbtn--lg" onClick={() => go(1)} aria-label="다음 줄" disabled={disabled || total <= 1}>
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>

      <div className="wt-ppbar">
        <button type="button" className="wt-btn wt-btn--press" onClick={onPress} disabled={disabled} data-testid="press">
          <MessageCircleQuestion size={20} aria-hidden /> 추궁
        </button>
        {broken ? (
          <button type="button" className="wt-btn wt-btn--primary" onClick={() => go(1)} disabled={disabled} data-testid="next-line">
            {nextLabel}
          </button>
        ) : (
          <button type="button" className={['wt-btn', 'wt-btn--primary', pulsePresent ? 'is-pulse' : ''].filter(Boolean).join(' ')} onClick={onPresent} disabled={disabled} data-testid="present">
            <FileSearch size={20} aria-hidden /> 증거 제시
          </button>
        )}
      </div>
      <p className="wt-ppcap">
        <span>무료 · 무제한</span>
        <span>{broken ? '깨진 줄' : tutorial ? '튜토리얼 · 틀려도 감점 없음' : '틀리면 신뢰 −1'}</span>
      </p>
      {coach}
    </div>
  );
}
