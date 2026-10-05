'use client';

/**
 * HUD — 시계 · 행동 핍 · 신뢰도(한결의 인내심) · ★ 게이지 · 수첩 버튼 (디자인 §3-2, UI 5-1·5-2). 소리 토글은 허브 HUD(… 옆)에만 — 인게임 HUD 는 한결 얼굴 자리를 지킨다.
 * 허브(96px)는 시계+13핍, 인게임(52px)은 숫자형 + 하단 2px 13칸 헤어라인(D02). 개수는 RULES.normal.actions 를 따른다.
 * 전체 ★ 개수는 보여 주지 않는다(엔딩에서 처음 공개). 값 변화는 role="status" 로 600ms 디바운스해 읽는다.
 */
import { Clock, Ellipsis, NotebookPen, Siren, Star, ChevronLeft } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { RULES, clock, minutesLeft, rulesOf, stars, type Face, type RunCore } from '@/lib/witness';
import { REPLAY_TEXT } from '../lib/copy';
import { ArtSlot } from './ArtSlot';
import { SoundToggle } from '../audio/SoundToggle';

export function ActionPips({ left, total = RULES.normal.actions, as = 'pips', preview = 0 }: { left: number; total?: number; as?: 'pips' | 'line'; preview?: number }) {
  const items = Array.from({ length: total }, (_, i) => i);
  if (as === 'line') {
    return (
      <span className="wt-hair" data-danger={left <= 3 ? '1' : undefined} aria-hidden>
        {items.map((i) => (
          <i key={i} className={['wt-hair-seg', i < left ? 'is-on' : '', preview > 0 && i === left - 1 ? 'is-preview' : ''].filter(Boolean).join(' ')} />
        ))}
      </span>
    );
  }
  return (
    <span className="wt-pips" role="img" aria-label={`행동 ${left}번 남음`} data-danger={left <= 3 ? '1' : undefined}>
      {items.map((i) => (
        <i key={i} className={['wt-pip', i < left ? 'is-on' : '', preview > 0 && i === left - 1 ? 'is-preview' : ''].filter(Boolean).join(' ')} />
      ))}
    </span>
  );
}

/** 신뢰 단계별 한결 얼굴(5단계 → Face 3종 + 오버레이) */
export function faceForTrust(trust: number): Face {
  if (trust >= 4) return 'normal';
  if (trust >= 2) return 'sweat';
  return 'shock';
}

export function TrustFace({ trust, size = 'sm' }: { trust: number; size?: 'sm' | 'md' }) {
  return (
    <span className={`wt-avatar wt-avatar--${size}`} data-trust={trust}>
      <ArtSlot kind="portrait" who="COP" face={faceForTrust(trust)} trust={Math.max(0, Math.min(5, trust)) as 0 | 1 | 2 | 3 | 4 | 5} crop="head" title="한결" />
    </span>
  );
}

export function TrustMeter({ value, max = 5, size = 'sm', showDelta = true }: { value: number; max?: number; size?: 'sm' | 'md'; showDelta?: boolean }) {
  const prev = useRef(value);
  const [delta, setDelta] = useState<number>(0);
  useEffect(() => {
    if (prev.current !== value) {
      setDelta(value - prev.current);
      prev.current = value;
      const t = setTimeout(() => setDelta(0), 1200);
      return () => clearTimeout(t);
    }
  }, [value]);
  const level = value <= 1 ? '1' : value === 2 ? '2' : 'ok';
  return (
    <span className={`wt-trust wt-trust--${size}`} data-level={level} data-hit={delta < 0 ? '1' : undefined} data-gain={delta > 0 ? '1' : undefined} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={`신뢰도 ${value}/${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} className={['wt-trust-cell', i < value ? 'is-on' : ''].filter(Boolean).join(' ')} />
      ))}
      {showDelta && delta !== 0 && (
        <span className="wt-trust-delta" aria-hidden>
          {delta < 0 ? `신뢰 −${-delta}` : `+${delta}`}
        </span>
      )}
    </span>
  );
}

export function StarGate({ count, gate = 3, onClick }: { count: number; gate?: number; onClick?: () => void }) {
  const descId = useId();
  const label = count > gate ? `★${gate} +${count - gate}` : `${count}/${gate}`;
  const inner = (
    <>
      {Array.from({ length: gate }, (_, i) => (
        <Star key={i} size={15} aria-hidden className={i < count ? 'is-on' : ''} />
      ))}
      <span className="wt-stargate-n">{label}</span>
    </>
  );
  const aria = `결정적 모순 ${count}개${count >= gate ? ', 최종 지목 가능' : `, 지목하려면 ${gate}개 필요`}`;
  // 버튼의 이름은 '최종 지목'(하는 일), 모순 개수·가능 여부는 설명으로 — 이름이 길어 이름으로 못 찾는 일이 없게 한다
  return onClick ? (
    <button type="button" className="wt-stargate" data-full={count >= gate ? '1' : undefined} onClick={onClick} aria-label={count >= gate ? '최종 지목' : '최종 지목 (아직 불가)'} aria-describedby={descId}>
      {inner}
      <span id={descId} className="wt-sr">
        {aria}
      </span>
    </button>
  ) : (
    <span className="wt-stargate" data-full={count >= gate ? '1' : undefined} role="img" aria-label={aria}>
      {inner}
    </span>
  );
}

/**
 * 스크린 리더용 한 줄 — 행동·시계가 연달아 바뀔 땐 600ms 모아서 읽는다.
 * 단, 결정적 모순(★) 개수가 바뀐 순간은 모으지 않고 바로 갱신한다: 첫 ★ 직후에는 대사·결과 카드가 곧바로 이어져서,
 * 600ms 뒤에 뜨면 안내가 다음 내용에 밀려 한참 늦게 따라온다.
 */
export function useLiveText(spoken: string, star: number, ms = 600): string {
  const [x, setX] = useState(spoken);
  const prevStar = useRef(star);
  useEffect(() => {
    if (prevStar.current !== star) {
      prevStar.current = star;
      setX(spoken);
      return;
    }
    const t = setTimeout(() => setX(spoken), ms);
    return () => clearTimeout(t);
  }, [spoken, star, ms]);
  return x;
}

const clockSpoken = (c: string) => `${Number(c.slice(0, 2))}시 ${Number(c.slice(3))}분`;

/** 이번 판 종류 칩 — 기억 판이면 「기억」, 되감기를 썼으면 「되감기」(상시, 사양 g-4) */
export function ModeChips({ run, compact }: { run: Pick<RunCore, 'recall' | 'rewound'>; compact?: boolean }) {
  const chips: string[] = [];
  if (run.recall) chips.push(REPLAY_TEXT.chipRecall);
  if (run.rewound) chips.push(REPLAY_TEXT.chipRewind);
  if (chips.length === 0) return null;
  return (
    <span className={['wt-hud-modes', compact ? 'wt-hud-modes--compact' : ''].filter(Boolean).join(' ')} data-testid="hud-modes">
      {chips.map((c) => (
        <i key={c} className="wt-modechip">
          {c}
        </i>
      ))}
    </span>
  );
}

export interface HudProps {
  variant: 'hub' | 'compact';
  run: RunCore;
  onBack?: () => void;
  onNotebook?: () => void;
  onMenu?: () => void;
  onStar?: () => void;
  notebookDot?: boolean;
  /** 비용 프롬프트가 떠 있는 동안 곧 쓸 핍을 깜빡인다 */
  previewPips?: number;
  /** 한결 말풍선(오답 직후 1.2초) */
  bubble?: string | null;
  /** HUD 투어: 이 부분 강조 */
  tour?: 'clock' | 'trust' | 'star' | null;
}

export function HudBar({ variant, run, onBack, onNotebook, onMenu, onStar, notebookDot, previewPips = 0, bubble, tour }: HudProps) {
  const rules = rulesOf(run);
  const c = clock(run);
  const left = run.actions;
  const mins = minutesLeft(run);
  const star = stars(run);
  const spoken = `행동 ${left} 남음, ${clockSpoken(c)}, 신뢰 ${run.trust}, 결정적 모순 ${star}`;
  const live = useLiveText(spoken, star);
  const tense = left <= 3 || run.phase === 'siren';
  const full = `${clockSpoken(c)}, 행동 ${left}번 남음, 강력팀 도착까지 ${mins}분`;

  if (variant === 'hub') {
    return (
      <header className="wt-hud wt-hud--hub" data-tense={tense ? '1' : undefined} data-tour={tour ?? undefined}>
        <div className="wt-hud-row1">
          <span className="wt-hud-clock" data-tour-anchor="clock" aria-label={full}>
            <Clock size={16} aria-hidden />
            <span className="wt-clock">{c}</span>
          </span>
          <ActionPips left={left} total={rules.actions} preview={previewPips} />
          {tense && <Siren size={14} className="wt-siren-ic" aria-hidden />}
          <span className="wt-count" aria-hidden>
            {left}
          </span>
          <SoundToggle />
          <button type="button" className="wt-iconbtn" onClick={onMenu} aria-label="설정 · 도움말">
            <Ellipsis size={20} aria-hidden />
          </button>
        </div>
        <div className="wt-hud-row2">
          <TrustFace trust={run.trust} size="md" />
          <span data-tour-anchor="trust" className="wt-hud-trust">
            <TrustMeter value={run.trust} max={rules.trustMax} size="md" />
            <span className="wt-hud-trusttext">신뢰 {run.trust}</span>
          </span>
          {bubble && <span className="wt-bubble" role="status">{bubble}</span>}
          <span className="wt-grow" />
          <span data-tour-anchor="star">
            <StarGate count={star} gate={rules.starGate} onClick={onStar} />
          </span>
        </div>
        <div className="wt-hud-row3">
          <span>강력팀 도착까지 {mins}분</span>
          <ModeChips run={run} />
        </div>
        <div className="wt-sr" role="status" aria-live="polite">
          {live}
        </div>
      </header>
    );
  }

  return (
    <header className="wt-hud wt-hud--compact" data-tense={tense ? '1' : undefined} data-tour={tour ?? undefined}>
      <div className="wt-hud-compactrow">
        <button type="button" className="wt-iconbtn" onClick={onBack} aria-label="나가기(허브로)" disabled={!onBack}>
          <ChevronLeft size={22} aria-hidden />
        </button>
        <span className="wt-hudchip" aria-label={full} data-tour-anchor="clock">
          <Clock size={14} aria-hidden />
          <b>{left}</b>
          {tense && <Siren size={13} className="wt-siren-ic" aria-hidden />}
        </span>
        <span className="wt-hud-trust" data-tour-anchor="trust">
          <TrustFace trust={run.trust} />
          <TrustMeter value={run.trust} max={rules.trustMax} />
        </span>
        {bubble && <span className="wt-bubble wt-bubble--compact" role="status">{bubble}</span>}
        <span className="wt-grow" />
        <span data-tour-anchor="star">
          <StarGate count={star} gate={rules.starGate} onClick={onStar} />
        </span>
        <button type="button" className="wt-iconbtn wt-iconbtn--dot" onClick={onNotebook} aria-label={notebookDot ? '수첩 (새 내용 있음)' : '수첩'}>
          <NotebookPen size={20} aria-hidden />
          {notebookDot && <i className="wt-dot" aria-hidden />}
        </button>
      </div>
      <ActionPips left={left} total={rules.actions} as="line" preview={previewPips} />
      <ModeChips run={run} compact />
      <div className="wt-sr" role="status" aria-live="polite">
        {live}
      </div>
    </header>
  );
}
