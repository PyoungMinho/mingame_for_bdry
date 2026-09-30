'use client';

import { BookOpen, Check, ChevronRight, Home, LineChart, Play, RotateCcw, Share2, Wallet as WalletIcon } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ASSETS, CHAPTERS, STAT_META } from '@/lib/rewind/contract';
import { formatKRW, holdingsList, type Resolution, type RunState } from '@/lib/rewind/engine';
import { netWorth, overseasGainTax } from '@/lib/rewind/market';
import { MARKET } from '@/lib/rewind/market-data';
import type { ChapterId, Gender, StatKey, StoryNode } from '@/lib/rewind/types';
import type { FoundEndings } from '../lib/useRewindGame';
import { AssetChart, Change, ChapterTrack, Gauge, Money, Photo, ageIn, gradeIn, type SceneValue } from './common';

const STATS: StatKey[] = ['trust', 'happy', 'health', 'sus'];
const SHARE_URL = 'https://project-orsrw.vercel.app/rewind';

// ─────────────────────────────── HUD ───────────────────────────────

export function chapterOfYear(year: number): ChapterId {
  for (const c of [7, 6, 5, 4, 3, 2, 1] as ChapterId[]) if (year >= Number(CHAPTERS[c].years.slice(0, 4))) return c;
  return 1;
}

export function Hud({ state, node, value, onTimeline, onWallet }: { state: RunState; node: StoryNode; value?: SceneValue; onTimeline: () => void; onWallet: () => void }) {
  // 결산 중이면 결산하는 해(다음 장면은 이미 새해다)
  const year = state.settling?.year ?? Number(node.date.slice(0, 4));
  const chapter = state.settling ? chapterOfYear(year) : node.chapter;
  // 이야기 중엔 장면 날짜 시세로, 결산 중엔 그해 연말가(wallet.mark)로 평가한다
  const scene = state.settling ? null : value;
  const nw = scene ? scene.netWorth : netWorth(state.wallet);
  const held = holdingsList(state).length > 0;
  const basis = scene ? scene.basis : held ? `${year}년 말 시세 기준` : null;
  const grade = gradeIn(year, state.settling ? 12 : Number(node.date.slice(5, 7)));
  return (
    <header className="rw-hud">
      <div className="rw-hud-inner">
        <div className="rw-hud-top">
          <div className="rw-when">
            <b>{year}</b>
            <span>
              {ageIn(year)}살{grade ? ` · ${grade}` : ''} · {CHAPTERS[chapter].name}
            </span>
          </div>
          <div className="rw-hud-actions">
            <button type="button" className="rw-icon-btn rw-only-mobile" onClick={onTimeline} aria-label="인생 연표와 자산 곡선">
              <LineChart aria-hidden />
              <span>연표</span>
            </button>
            <button type="button" className="rw-icon-btn rw-only-mobile" onClick={onWallet} aria-label="보유 자산">
              <WalletIcon aria-hidden />
              <span>자산</span>
            </button>
          </div>
        </div>
        <div className="rw-nw">
          <span className="rw-nw-label">순자산</span>
          <Money v={nw} className="rw-nw-num" />
          <Change from={state.wallet.lastNetWorth} to={nw} />
          {basis && <span className="rw-nw-basis">{basis}</span>}
        </div>
        <div className="rw-gauges">
          {STATS.map((k) => (
            <Gauge key={k} k={k} v={state.stats[k]} />
          ))}
        </div>
      </div>
    </header>
  );
}

export function WalletPanel({ state, value }: { state: RunState; value?: SceneValue }) {
  const list = holdingsList(state);
  return (
    <div className="rw-panel">
      <h2 className="rw-panel-h">보유 자산 {state.wallet.underParent ? '· 부모님 명의' : ''}</h2>
      <ul className="rw-holdings">
        <li>
          <span>현금·예금</span>
          <Money v={state.wallet.cash} />
        </li>
        {list.map((h) => (
          <li key={h.asset}>
            <span>{ASSETS[h.asset].name}</span>
            <Money v={value?.values[h.asset] ?? h.value} />
          </li>
        ))}
        {state.wallet.debt > 0 && (
          <li className="rw-debt">
            <span>대출</span>
            <span>−{formatKRW(state.wallet.debt)}</span>
          </li>
        )}
      </ul>
      {value?.basis && <p className="rw-legend">평가: {value.basis}</p>}
      {state.wallet.hiddenGift > 0 && <p className="rw-warn">차명으로 가져온 {formatKRW(state.wallet.hiddenGift)} — 언제 걸릴지 모른다</p>}
    </div>
  );
}

export function TimelinePanel({ state, chapter }: { state: RunState; chapter: ChapterId }) {
  return (
    <div className="rw-panel">
      <h2 className="rw-panel-h">자산 곡선</h2>
      <AssetChart points={state.wallet.history} />
      <p className="rw-legend">
        <i data-k="nw" /> 내 순자산 <i data-k="base" /> 같은 돈을 예금에만 뒀다면
      </p>
      <ChapterTrack chapter={chapter} />
      <h2 className="rw-panel-h">지나온 선택 · {state.history.length}</h2>
      <ol className="rw-journal">
        {[...state.history].reverse().slice(0, 40).map((h, i) => (
          <li key={`${h.nodeId}-${i}`}>
            <span>{h.date.replace('-', '.')}</span>
            <b>{h.title}</b>
            <em>▸ {h.choiceLabel}</em>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─────────────────────────────── 결과 ───────────────────────────────

export function Result({ res, onContinue }: { res: Resolution; onContinue: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  const d = res.delta;
  useEffect(() => {
    btn.current?.focus({ preventScroll: true });
  }, []);
  const chips: { t: string; dir: 'up' | 'down' | 'flat' }[] = [];
  for (const k of STATS) {
    const v = d.stats[k];
    if (v) chips.push({ t: `${STAT_META[k].label} ${v > 0 ? '+' : ''}${v}`, dir: k === 'sus' ? (v > 0 ? 'down' : 'up') : v > 0 ? 'up' : 'down' });
  }
  if (d.cash) chips.push({ t: `현금 ${d.cash > 0 ? '+' : '−'}${formatKRW(Math.abs(d.cash))}`, dir: d.cash > 0 ? 'up' : 'down' });
  if (d.bet) chips.push(d.bet.won ? { t: `토토 적중 · 세후 ${formatKRW(d.bet.payout)}${d.bet.tax ? ` (세금 ${formatKRW(d.bet.tax)})` : ''}`, dir: 'up' } : { t: `토토 낙첨 −${formatKRW(d.bet.stake)}`, dir: 'down' });
  let windfall = d.windfall - (d.bet ? d.bet.payout - d.bet.stake : 0);
  const borrowed = d.debt > 0 && windfall > 0 ? Math.min(windfall, d.debt) : 0; // 대출받아 현금으로 — 횡재가 아니다
  windfall -= borrowed;
  if (windfall) chips.push(windfall > 0 ? { t: `횡재 +${formatKRW(windfall)}`, dir: 'up' } : { t: `지출 −${formatKRW(-windfall)}`, dir: 'down' });
  if (d.debt) chips.push({ t: `대출 ${d.debt > 0 ? '+' : '−'}${formatKRW(Math.abs(d.debt))}${borrowed ? ' (현금으로)' : ''}`, dir: d.debt > 0 ? 'down' : 'up' });
  for (const r of d.trades) {
    // 분할 전이면 그 시절 실제 1주 기준으로 보여 준다(수정주가 × 분할 배수)
    const amount = r.lot ? `${Math.round((r.qty / r.lot) * 100) / 100}주 @${formatKRW(r.price * r.lot)}` : `@${formatKRW(r.price)}`;
    chips.push(
      r.ok
        ? { t: `${ASSETS[r.asset].name} ${r.side === 'buy' ? '매수' : '매도'} ${amount}${r.capped ? ' · 시장 한도까지만' : ''}`, dir: r.side === 'buy' ? 'up' : 'down' }
        : { t: `${ASSETS[r.asset].name} 거래 실패 — ${r.reason}`, dir: 'flat' },
    );
  }
  for (const l of d.lost) chips.push({ t: `${ASSETS[l.asset].name} 잃음`, dir: 'down' });
  if (d.forced.length) chips.push({ t: `현금이 모자라 ${d.forced.map((f) => ASSETS[f.asset].name).join('·')} 일부 매도`, dir: 'down' });
  if (d.transfer) chips.push({ t: d.transfer.mode === 'declare' ? `증여 신고 · 증여세 ${formatKRW(d.transfer.tax)}` : d.transfer.mode === 'hide' ? `차명으로 가져옴 (${formatKRW(d.transfer.value)})` : '부모님 명의 유지', dir: 'flat' });
  if (d.income !== undefined) chips.push({ t: d.income ? `매년 저축 ${formatKRW(d.income.perYear)} (${d.income.label})` : '저축 중단', dir: 'flat' });
  return (
    <section className="rw-result" aria-label="선택 결과">
      <p className="rw-result-choice">▸ {res.choice.label}</p>
      <div className="rw-result-text">
        {res.result.map((p, i) => (
          <p key={i} style={{ ['--i' as string]: i }}>
            {p}
          </p>
        ))}
      </div>
      {chips.length > 0 && (
        <ul className="rw-chips">
          {chips.map((c, i) => (
            <li key={i} data-dir={c.dir}>
              {c.t}
            </li>
          ))}
        </ul>
      )}
      <button ref={btn} type="button" className="rw-next" onClick={onContinue}>
        {res.state.toEnd ? '2026년으로' : res.state.pending.length ? `${res.state.pending[0]}년 결산` : '계속'}
        <ChevronRight aria-hidden />
      </button>
    </section>
  );
}

// ─────────────────────────────── 타이틀 ───────────────────────────────

export function Title({ saved, found, endingsTotal, onStart, onResume }: { saved: RunState | null; found: FoundEndings; endingsTotal: number; onStart: (g: Gender) => void; onResume: () => void }) {
  const [pick, setPick] = useState(false);
  const resumable = saved && !saved.final ? saved : null;
  const foundN = Object.keys(found).length;
  const best = Math.max(0, ...Object.values(found).map((f) => f.best));
  return (
    <main className="rw-title">
      <div className="rw-title-photo">
        <Photo scene="crt_living" date="2000-01" label="2000년 1월, 우리 집 거실" />
      </div>
      <div className="rw-title-inner">
        <p className="rw-kicker">1993년생 · 서른셋 · 눈을 떴더니 2000년</p>
        <h1 className="rw-logo">
          인생 <em>2회차</em>
        </h1>
        <p className="rw-tagline">미래를 다 아는데, 몸은 여덟 살이다. 2026년, 당신의 자산은 얼마일까?</p>
        {!pick ? (
          <div className="rw-title-actions">
            {resumable && (
              <button type="button" className="rw-btn rw-btn-primary" onClick={onResume}>
                <Play aria-hidden /> 이어하기 <small>{resumable.wallet.year}년 · {formatKRW(netWorth(resumable.wallet))}</small>
              </button>
            )}
            <button type="button" className={`rw-btn ${resumable ? '' : 'rw-btn-primary rw-btn-xl'}`} onClick={() => setPick(true)}>
              {resumable ? <RotateCcw aria-hidden /> : <Play aria-hidden />}
              {resumable ? '처음부터' : '2000년으로 돌아가기'}
            </button>
          </div>
        ) : (
          <div className="rw-gender" role="group" aria-label="성별 선택">
            <p>1993년에 태어난 나는…</p>
            <div>
              <button type="button" className="rw-btn rw-btn-primary" onClick={() => onStart('m')}>
                남자
              </button>
              <button type="button" className="rw-btn rw-btn-primary" onClick={() => onStart('f')}>
                여자
              </button>
            </div>
            <small>남자는 스무 살 무렵 군대가 기다린다. 그동안은 휴가 때만 거래할 수 있다.</small>
          </div>
        )}
        <ul className="rw-title-meta">
          <li>2000 → 2026</li>
          <li>실제 시세</li>
          <li>
            <BookOpen aria-hidden /> 결말 {foundN}/{endingsTotal}
          </li>
          {best > 0 && <li>최고 {formatKRW(best)}</li>}
        </ul>
        <p className="rw-fine">연도별 실제 시세·사건을 조사해 반영했지만 게임을 위해 단순화했어요. 투자 권유가 아닙니다.</p>
      </div>
    </main>
  );
}

// ─────────────────────────────── 엔딩 ───────────────────────────────

function useCountUp(target: number, ms = 2200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* 무시 */
    }
    if (reduce) {
      setV(target);
      return;
    }
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 4);
      setV(target * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Dedication() {
  return (
    <section className="rw-dedication" aria-label="헌정">
      <figure className="rw-polaroid">
        <Image src="/zombie/dedication.jpg" alt="김성준" width={360} height={480} sizes="(max-width: 520px) 62vw, 280px" />
      </figure>
      <p className="rw-dedication-text">한국 최고의 부자 김성준씨에게 이 게임을 바칩니다.</p>
    </section>
  );
}

export function EndingView({ state, found, endingsTotal, onRestart, onTitle }: { state: RunState; found: FoundEndings; endingsTotal: number; onRestart: () => void; onTitle: () => void }) {
  const f = state.final!;
  const shown = useCountUp(f.netWorth);
  const [copied, setCopied] = useState(false);
  const multiple = f.baseline > 0 ? f.netWorth / f.baseline : 0;
  // 엔딩 정산에서 뺀 해외주식 양도세(마지막 결산 해부터) — 마지막 장면 순자산과의 차이
  const lastSettled = Math.max(0, ...state.wallet.history.map((h) => h.year));
  const unpaidTax = Object.entries(state.wallet.realizedOverseas).reduce((t, [y, v]) => (Number(y) >= lastSettled ? t + overseasGainTax(MARKET, v, Number(y)) : t), 0);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);
  const share = async () => {
    const text = `[인생 2회차] 2000년으로 돌아간 1993년생의 2026년 자산: ${formatKRW(f.netWorth)} (${f.tier.title})\n결말: ${f.ending.title} · ${f.trait.title}\n“${f.ending.epitaph}”\n너라면 얼마 벌었을 것 같아?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '인생 2회차', text, url: SHARE_URL });
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${SHARE_URL}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* 무시 */
    }
  };
  return (
    <main className="rw-ending">
      <div className="rw-ending-photo">
        <Photo scene={f.ending.scene} date="2026-09" label={`엔딩 — ${f.ending.title}`} />
      </div>
      <section className="rw-ending-score" aria-label="2026년 9월 29일 기준 순자산">
        <p className="rw-kicker">2026년 9월 29일 기준 · 만 33세</p>
        <p className="rw-ending-nw">
          <Money v={Math.round(shown)} />
        </p>
        {unpaidTax > 0 && <p className="rw-fine">그날 시세로 평가하고, 아직 안 낸 해외주식 양도세 {formatKRW(unpaidTax)}을 뺐다</p>}
        <p className="rw-tier">
          <b>{f.tier.title}</b> {f.tier.line}
        </p>
        <p className="rw-vs">
          같은 돈을 예금에만 뒀다면 <Money v={f.baseline} />
          {multiple >= 1.05 && <em> → {multiple >= 100 ? Math.round(multiple).toLocaleString() : multiple.toFixed(1)}배</em>}
        </p>
        <AssetChart points={state.wallet.history} final={{ netWorth: f.netWorth, baseline: f.baseline }} />
      </section>
      <section className="rw-ending-story">
        <h1>{f.ending.title}</h1>
        {f.ending.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        <blockquote className="rw-epitaph">“{f.ending.epitaph}”</blockquote>
      </section>
      <Dedication />
      <section className="rw-ending-card">
        <p className="rw-kicker">나의 투자자 유형</p>
        <p className="rw-type">{f.trait.title}</p>
        <p>{f.trait.line}</p>
        <div className="rw-ending-actions">
          <button type="button" className="rw-btn rw-btn-primary" onClick={share}>
            {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
            {copied ? '복사됐어요' : '결과 공유하기'}
          </button>
          <button type="button" className="rw-btn" onClick={onRestart}>
            <RotateCcw aria-hidden /> 다시 2000년으로
          </button>
          <button type="button" className="rw-btn rw-btn-ghost" onClick={onTitle}>
            <Home aria-hidden /> 처음으로
          </button>
        </div>
        <p className="rw-fine">
          발견한 결말 {Object.keys(found).length}/{endingsTotal} · 연도별 실제 시세 기반, 게임을 위해 단순화 · 투자 권유 아님
        </p>
      </section>
      <span className="rw-sr" aria-live="polite">
        {copied ? '결과를 복사했어요' : ''}
      </span>
    </main>
  );
}
