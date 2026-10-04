'use client';

/**
 * 비용·상태 칩(디자인 §4-2 의미 사전). 색 · 아이콘 · 글자를 항상 함께 쓴다(색 단독 금지).
 * 앰버 = 행동 비용, 그린 = 무료, 핑크 = NEW, 뮤트 = 다녀옴·잠김, 레드 = 사이렌 뒤·위조·오답, 시안 = 정보.
 */
import { BadgeAlert, Check, CircleHelp, Clock, Diamond, Lock, RefreshCw, ScanSearch, Star, Undo2, Waves, X } from 'lucide-react';
import type { ReactNode } from 'react';

export type ChipKind =
  | 'cost'
  | 'precise'
  | 'free'
  | 'new'
  | 'visited'
  | 'examined'
  | 'locked'
  | 'siren'
  | 'star'
  | 'minor'
  | 'half'
  | 'redirect'
  | 'wrong'
  | 'raw'
  | 'revised'
  | 'forged'
  | 'cleared'
  | 'info';

const DEF: Record<ChipKind, { icon?: ReactNode; text: string }> = {
  cost: { icon: <Clock size={12} aria-hidden />, text: '행동 1' },
  precise: { icon: <ScanSearch size={12} aria-hidden />, text: '정밀 +1' },
  free: { text: '무료' },
  new: { text: 'NEW' },
  visited: { icon: <Check size={12} aria-hidden />, text: '다녀옴' },
  examined: { icon: <Check size={12} aria-hidden />, text: '조사함' },
  locked: { icon: <Lock size={12} aria-hidden />, text: '잠김' },
  siren: { icon: <Lock size={12} aria-hidden />, text: '사이렌 뒤' },
  star: { icon: <Star size={12} aria-hidden />, text: '결정적' },
  minor: { icon: <Diamond size={12} aria-hidden />, text: '모순 해소' },
  half: { icon: <Waves size={12} aria-hidden />, text: '반쯤 맞음 · 감점 없음' },
  redirect: { icon: <Undo2 size={12} aria-hidden />, text: '감점 없음' },
  wrong: { icon: <X size={12} aria-hidden />, text: '신뢰 −1' },
  raw: { icon: <CircleHelp size={12} aria-hidden />, text: '기록 그대로' },
  revised: { icon: <RefreshCw size={12} aria-hidden />, text: '해석 정정' },
  forged: { icon: <BadgeAlert size={12} aria-hidden />, text: '위조' },
  cleared: { text: '다 털었다' },
  info: { text: '' },
};

export function ActionChip({ kind, label, className }: { kind: ChipKind; label?: string; className?: string }) {
  const d = DEF[kind];
  return (
    <span className={['wt-chip', `wt-chip--${kind}`, className].filter(Boolean).join(' ')}>
      {d.icon}
      <span>{label ?? d.text}</span>
    </span>
  );
}

/** 비용 칩 + (NEW) 한 줄 */
export function ChipRow({ chips }: { chips: { kind: ChipKind; label?: string }[] }) {
  if (!chips.length) return null;
  return (
    <span className="wt-chiprow">
      {chips.map((c, i) => (
        <ActionChip key={`${c.kind}-${i}`} kind={c.kind} label={c.label} />
      ))}
    </span>
  );
}

/** 방·증언 행의 상태 → 칩 목록(디자인 §5-2 매트릭스) */
export function statusChips(opts: {
  state: 'locked' | 'open' | 'visited' | 'opened' | 'siren';
  cost: 0 | 1;
  isNew: boolean;
  cleared?: boolean;
  pressed?: number;
  visibleLines?: number;
}): { kind: ChipKind; label?: string }[] {
  const { state, cost, isNew } = opts;
  if (state === 'locked') return [{ kind: 'locked' }];
  if (state === 'siren') return [{ kind: 'siren' }];
  if (state === 'open') return [...(isNew ? [{ kind: 'new' as const }] : []), cost === 0 ? { kind: 'free' } : { kind: 'cost' }];
  if (state === 'visited') return isNew ? [{ kind: 'new' }, { kind: 'free' }] : [{ kind: 'visited' }];
  // opened(증언)
  if (opts.cleared) return [{ kind: 'cleared' }];
  return [{ kind: 'info', label: `열림 · 추궁 ${opts.pressed ?? 0}/${opts.visibleLines ?? 0}` }];
}
