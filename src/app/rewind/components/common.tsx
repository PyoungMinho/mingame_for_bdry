'use client';

import { ChevronRight, Lock, MessageCircle, Phone, Radio, Smartphone, Tv, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ASSET_IDS, CHAPTERS, STAT_META } from '@/lib/rewind/contract';
import { formatKRW, visibleChoices, type RunState } from '@/lib/rewind/engine';
import type { Wallet } from '@/lib/rewind/market';
import type { Alert, AssetId, ChapterId, MarketData, PricePoint, StatKey, StoryNode } from '@/lib/rewind/types';
import { SceneArt } from '../scenes';

// ─────────────────────────────── 나이·학년 ───────────────────────────────

/** 세는나이 — 1993년생. 이야기 본문(2000년 "여덟 살")과 같은 기준 */
export const ageIn = (year: number) => year - 1993 + 1;

/** 1993-03~12 생 기준 학년 (2000 초1 … 2011 고3, 2012 대학). 학년도는 3월에 바뀐다(1~2월은 전 학년) */
export function gradeIn(year: number, month = 12): string {
  const g = (month < 3 ? year - 1 : year) - 1999; // 2000-03 → 1
  if (g === 0) return '입학 전';
  if (g >= 1 && g <= 6) return `초${g}`;
  if (g >= 7 && g <= 9) return `중${g - 6}`;
  if (g >= 10 && g <= 12) return `고${g - 9}`;
  if (g === 13) return '대학 새내기';
  return '';
}

// ─────────────────────────────── 장면 시점 평가 ───────────────────────────────

export interface SceneValue {
  netWorth: number;
  values: Partial<Record<AssetId, number>>;
  /** "6월 시세 기준" · "2010년 말 시세 기준" — 보유 자산이 없으면 null */
  basis: string | null;
}

/**
 * HUD·보유 자산 평가 — 장면 날짜 기준. wallet.mark(마지막 체결가)는 연중 매매 한 번에
 * 보유분 전체가 그 값으로 바뀌므로 표시에는 쓰지 않는다.
 * 자산마다 ① 방금 체결한 값 ② 그 달의 사건 시세(엔딩 기준일 포함, 가장 늦은 날)
 * ③ 직전 연말가 ④ 그것도 없으면 매입가. 보간·추정값은 만들지 않는다.
 */
export function sceneValuation(data: MarketData, w: Wallet, date: string, now: Partial<Record<AssetId, number>> = {}): SceneValue {
  const ym = date.slice(0, 7);
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const monthly: { date: string; prices: Partial<Record<AssetId, PricePoint>> }[] = Object.values(data.events).filter((e) => e.date.startsWith(ym));
  if (data.final.date.startsWith(ym)) monthly.push({ date: data.final.date, prices: data.final.prices });
  monthly.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // 늦은 날 먼저
  const prevYear = data.years[year - 1];
  const values: Partial<Record<AssetId, number>> = {};
  const used = { now: false, yearEnd: false, cost: false };
  let total = 0;
  for (const a of ASSET_IDS) {
    const q = w.qty[a];
    if (!(q > 0)) continue;
    const ev = monthly.find((e) => e.prices[a])?.prices[a];
    const ye = prevYear?.prices[a];
    let price: number;
    if (now[a] !== undefined || ev) {
      price = now[a] ?? ev!.krw;
      used.now = true;
    } else if (ye) {
      price = ye.krw;
      used.yearEnd = true;
    } else {
      price = w.mark[a];
      used.cost = true;
    }
    values[a] = q * price;
    total += q * price;
  }
  const when = [used.now && `${month}월`, used.yearEnd && `${year - 1}년 말`].filter(Boolean).join('·');
  const parts = [when && `${when} 시세`, used.cost && '매입가'].filter(Boolean);
  return { netWorth: Math.round(w.cash + total - w.debt), values, basis: parts.length ? `${parts.join('·')} 기준` : null };
}

// ─────────────────────────────── 금액 ───────────────────────────────

export function Money({ v, className }: { v: number; className?: string }) {
  return <span className={`rw-money ${className ?? ''}`}>{formatKRW(v)}</span>;
}

export function Change({ from, to }: { from: number; to: number }) {
  if (!from || from === to) return <span className="rw-chg" data-dir="flat">— 0%</span>;
  const pct = ((to - from) / Math.abs(from)) * 100;
  const dir = pct > 0 ? 'up' : 'down';
  return (
    <span className="rw-chg" data-dir={dir}>
      {dir === 'up' ? '▲' : '▼'} {Math.abs(pct) >= 1000 ? `${Math.round(pct / 100) / 10}천%` : `${Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%`}
    </span>
  );
}

// ─────────────────────────────── 사진 액자 ───────────────────────────────

/** 앨범 사진 — 흰 테두리 + 필름카메라 주황 날짜 도장 */
export function Photo({ scene, date, label, children }: { scene: string; date: string; label: string; children?: ReactNode }) {
  const [y, m] = date.split('-');
  return (
    <figure className="rw-photo">
      <div className="rw-photo-art" key={scene} role="img" aria-label={label}>
        <SceneArt id={scene} />
        <span className="rw-date" aria-hidden>
          {`'${y.slice(2)} ${Number(m)} ${Number(y) % 28 || 28}`}
        </span>
      </div>
      {children}
    </figure>
  );
}

// ─────────────────────────────── 게이지 ───────────────────────────────

export function Gauge({ k, v }: { k: StatKey; v: number }) {
  return (
    <div className="rw-gauge" data-k={k} data-hot={k === 'sus' && v >= 70 ? '' : undefined} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={v} aria-label={`${STAT_META[k].label} ${v}`}>
      <span className="rw-gauge-label" aria-hidden>
        {STAT_META[k].label}
      </span>
      <span className="rw-gauge-track" aria-hidden>
        <span className="rw-gauge-fill" style={{ width: `${v}%` }} />
      </span>
      <span className="rw-gauge-num" aria-hidden>
        {v}
      </span>
    </div>
  );
}

// ─────────────────────────────── 알림 ───────────────────────────────

const ALERT_LABEL: Record<Alert['kind'], string> = { news: '뉴스 속보', sms: '문자', call: '전화', chat: '메신저', ticker: '시세' };

export function AlertCard({ alert }: { alert: Alert }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const Icon = { news: Tv, sms: Smartphone, call: Phone, chat: MessageCircle, ticker: Radio }[alert.kind];
  return (
    <div className="rw-alert" data-kind={alert.kind} role="status">
      <div className="rw-alert-head">
        <Icon aria-hidden />
        <b>{ALERT_LABEL[alert.kind]}</b>
        {alert.from && <span>{alert.from}</span>}
        <button type="button" onClick={() => setOpen(false)} aria-label="알림 닫기">
          <X aria-hidden />
        </button>
      </div>
      <p>{alert.text}</p>
    </div>
  );
}

// ─────────────────────────────── 선택지 ───────────────────────────────

export function modalOpen(): boolean {
  return Boolean(document.querySelector('.rw-shell [aria-modal="true"]'));
}

export function Choices({ state, node, data, onChoose, disabled }: { state: RunState; node: StoryNode; data: MarketData; onChoose: (id: string) => void; disabled?: boolean }) {
  const list = useMemo(() => visibleChoices(state, node, data), [state, node, data]);
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || modalOpen()) return;
      const i = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : -1;
      if (i < 0 || i >= list.length || list[i].status !== 'open') return;
      e.preventDefault();
      onChoose(list[i].choice.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [list, onChoose, disabled]);
  return (
    <ol className="rw-choices" aria-label="선택지 (숫자 1~4 키로도 고를 수 있어요)">
      {list.map(({ choice, status, hint }, i) => (
        <li key={choice.id} style={{ ['--i' as string]: i }}>
          <button type="button" className="rw-choice" data-status={status} aria-disabled={status === 'locked' || undefined} onClick={() => status === 'open' && onChoose(choice.id)}>
            <span className="rw-choice-key" aria-hidden>
              {status === 'locked' ? <Lock /> : i + 1}
            </span>
            <span className="rw-choice-main">
              <span className="rw-choice-label">{choice.label}</span>
              {status === 'locked' ? <span className="rw-choice-locked">{hint}</span> : choice.hint && <span className="rw-choice-hint">{choice.hint}</span>}
            </span>
            {status === 'open' && <ChevronRight className="rw-choice-go" aria-hidden />}
          </button>
        </li>
      ))}
    </ol>
  );
}

// ─────────────────────────────── 자산 곡선 ───────────────────────────────

const LOG_MIN = 4; // 1만
const LOG_MAX = 13; // 10조
const lg = (v: number) => Math.min(LOG_MAX, Math.max(LOG_MIN, Math.log10(Math.max(1, v))));
const TICKS: [number, string][] = [
  [4, '1만'],
  [6, '100만'],
  [8, '1억'],
  [10, '100억'],
  [12, '1조'],
];

/** 순자산(빨강) vs 같은 돈을 예금에만 뒀다면(회색 점선). 로그 축. */
export function AssetChart({ points, final }: { points: { year: number; netWorth: number; baseline: number }[]; final?: { netWorth: number; baseline: number } }) {
  const W = 640;
  const H = 260;
  const pad = { l: 46, r: 14, t: 14, b: 26 };
  const x = (year: number) => pad.l + ((year - 2000) / 26.75) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (lg(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (H - pad.t - pad.b);
  const all = [...points];
  if (final) all.push({ year: 2026.75, netWorth: final.netWorth, baseline: final.baseline });
  const line = (k: 'netWorth' | 'baseline') => all.map((p, i) => `${i ? 'L' : 'M'}${x(p.year).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(' ');
  return (
    <svg className="rw-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="연도별 순자산 곡선">
      {TICKS.map(([t, l]) => (
        <g key={t}>
          <path d={`M${pad.l} ${y(10 ** t)} H${W - pad.r}`} className="rw-chart-grid" />
          <text x={pad.l - 6} y={y(10 ** t) + 4} textAnchor="end" className="rw-chart-tick">
            {l}
          </text>
        </g>
      ))}
      {[2000, 2005, 2010, 2015, 2020, 2026].map((yr) => (
        <text key={yr} x={x(yr)} y={H - 8} textAnchor="middle" className="rw-chart-tick">
          {yr}
        </text>
      ))}
      {all.length > 1 && (
        <>
          <path d={line('baseline')} className="rw-chart-base" />
          <path d={line('netWorth')} className="rw-chart-nw" />
        </>
      )}
      {all.map((p) => (
        <circle key={p.year} cx={x(p.year)} cy={y(p.netWorth)} r={p.year > 2026 ? 5 : 2.6} className="rw-chart-dot" />
      ))}
    </svg>
  );
}

export function ChapterTrack({ chapter }: { chapter: ChapterId }) {
  return (
    <div className="rw-track-wrap">
      <ol className="rw-track" aria-label="인생 연표">
        {([1, 2, 3, 4, 5, 6, 7] as ChapterId[]).map((c) => (
          <li key={c} data-state={c < chapter ? 'done' : c === chapter ? 'now' : 'next'} aria-current={c === chapter ? 'step' : undefined} title={`${c}장 ${CHAPTERS[c].name} (${CHAPTERS[c].years})`}>
            <span className="rw-track-years">{`'${CHAPTERS[c].years.slice(2, 4)}`}</span>
            <span className="rw-sr">{`${c}장 ${CHAPTERS[c].name}`}</span>
          </li>
        ))}
      </ol>
      <p className="rw-track-now" aria-hidden>
        {chapter}장 · {CHAPTERS[chapter].name} <span>{CHAPTERS[chapter].years}</span>
      </p>
    </div>
  );
}

/** 바텀시트 다이얼로그 (좀비 Drawer 와 같은 접근성 규칙) */
export function Sheet({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: ReactNode }) {
  const close = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab' || !sheet.current) return;
      const f = sheet.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault();
        f[0].focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      prevFocus?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rw-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="rw-sheet-backdrop" aria-hidden tabIndex={-1} onClick={onClose} />
      <div className="rw-sheet-body" ref={sheet}>
        <div className="rw-sheet-head">
          <h2>{title}</h2>
          <button ref={close} type="button" className="rw-icon-btn" onClick={onClose} aria-label="닫기">
            <X aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
