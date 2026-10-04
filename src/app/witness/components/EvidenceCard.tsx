'use client';

/**
 * 증거 카드(디자인 §4-2·D13·D14, UI 5-9) — S 104×132 / M 행 56 / L 240×320.
 * 종류 아이콘: item Package · log ScrollText · doc FileText · photo Camera · memo StickyNote (Cpu 는 기기 핫스팟 전용).
 * 신뢰 태그: raw 「기록 그대로」 · revised 「해석 정정」(v3 단계형 갱신의 중간) · forged 「위조」. verified 는 태그를 달지 않는다(SHOW_VERIFIED_TAG = false).
 * 인물 프로필도 제시 카드다(원형 초상 + 이름 + 소개) — 최종 지목 칸에는 못 넣는다.
 */
import { Camera, FileText, Info, Package, ScrollText, StickyNote } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import type { Evidence, EvidenceKind, Profile } from '@/lib/witness';
import { LONG_PRESS_MS } from '../lib/fx';
import { SHOW_VERIFIED_TAG, evNo, nameOf } from '../lib/format';
import { ArtSlot } from './ArtSlot';
import { ActionChip } from './ActionChip';

export const KIND_ICON: Record<EvidenceKind, (size: number) => ReactNode> = {
  item: (s) => <Package size={s} aria-hidden />,
  log: (s) => <ScrollText size={s} aria-hidden />,
  doc: (s) => <FileText size={s} aria-hidden />,
  photo: (s) => <Camera size={s} aria-hidden />,
  memo: (s) => <StickyNote size={s} aria-hidden />,
};

export const KIND_LABEL: Record<EvidenceKind, string> = { item: '물건', log: '기록', doc: '서류', photo: '사진', memo: '메모' };

export function ReliabilityTag({ evidence }: { evidence: Evidence }) {
  if (evidence.reliability === 'raw') return <ActionChip kind="raw" />;
  if (evidence.reliability === 'revised') return <ActionChip kind="revised" />;
  if (evidence.reliability === 'forged') return <ActionChip kind="forged" />;
  if (evidence.reliability === 'verified' && SHOW_VERIFIED_TAG) return <ActionChip kind="info" label="신뢰" />;
  return null;
}

export interface EvidenceCardProps {
  evidence: Evidence;
  size: 'S' | 'M' | 'L';
  selected?: boolean;
  /** 선택 슬롯 글자(A·B) */
  slot?: string;
  isNew?: boolean;
  upgraded?: boolean;
  /** 다른 칸에서 쓰는 중 등 보조 배지 */
  badge?: string;
  onClick?: () => void;
  onInfo?: () => void;
  onLongPress?: () => void;
  asCheckbox?: boolean;
  disabled?: boolean;
  className?: string;
}

export function EvidenceCard({ evidence: e, size, selected, slot, isNew, upgraded, badge, onClick, onInfo, onLongPress, asCheckbox, disabled, className }: EvidenceCardProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const interactive = !!onClick && size !== 'L';
  const down = () => {
    fired.current = false;
    if (!onLongPress) return;
    timer.current = setTimeout(() => {
      fired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  };
  const up = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const click = () => {
    if (fired.current) {
      fired.current = false;
      return;
    }
    onClick?.();
  };
  const body = (
    <>
      <span className="wt-card-hole" aria-hidden />
      <span className="wt-card-kind" aria-hidden>
        {KIND_ICON[e.kind](size === 'L' ? 18 : 14)}
      </span>
      {isNew && <span className="wt-card-new">NEW</span>}
      <span className="wt-card-name">{e.name}</span>
      {size === 'L' && <span className="wt-card-sum">{e.summary}</span>}
      <span className="wt-card-meta">
        {upgraded && <span className="wt-card-ribbon">갱신</span>}
        <ReliabilityTag evidence={e} />
        {e.time && <span className="wt-card-time">{e.time}</span>}
        <span className="wt-card-no">{evNo(e.id)}</span>
      </span>
      {slot && <span className="wt-card-slot" aria-hidden>{slot}</span>}
      {badge && <span className="wt-card-badge">{badge}</span>}
    </>
  );
  const cls = ['wt-card', `wt-card--${size}`, selected ? 'is-selected' : '', disabled ? 'is-disabled' : '', className].filter(Boolean).join(' ');
  if (!interactive) {
    return (
      <div className={cls} data-kind={e.kind}>
        {body}
      </div>
    );
  }
  return (
    <div className={cls} data-kind={e.kind}>
      <button
        type="button"
        className="wt-card-hit"
        role={asCheckbox ? 'checkbox' : undefined}
        aria-checked={asCheckbox ? !!selected : undefined}
        aria-pressed={!asCheckbox && selected !== undefined ? !!selected : undefined}
        aria-label={`${e.name}${e.reliability === 'raw' ? ', 기록 그대로' : e.reliability === 'revised' ? ', 해석 정정' : e.reliability === 'forged' ? ', 위조' : ''}${e.time ? `, ${e.time}` : ''}${slot ? `, 슬롯 ${slot}` : ''}${badge ? `, ${badge}` : ''}`}
        disabled={disabled}
        onClick={click}
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onContextMenu={(ev) => onLongPress && ev.preventDefault()}
      >
        {body}
      </button>
      {onInfo && (
        <button type="button" className="wt-card-info" aria-label={`${e.name} 자세히 보기`} onClick={onInfo}>
          <Info size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}

/** 증거 목록 행(M) — 지목 칸·획득 목록 */
export function EvidenceRow({ evidence: e, onRemove }: { evidence: Evidence; onRemove?: () => void }) {
  return (
    <div className="wt-card wt-card--M" data-kind={e.kind}>
      <span className="wt-card-kind" aria-hidden>
        {KIND_ICON[e.kind](16)}
      </span>
      <span className="wt-card-name">{e.name}</span>
      <ReliabilityTag evidence={e} />
      {e.time && <span className="wt-card-time">{e.time}</span>}
      {onRemove && (
        <button type="button" className="wt-iconbtn wt-iconbtn--sm" onClick={onRemove} aria-label={`${e.name} 빼기`}>
          ×
        </button>
      )}
    </div>
  );
}

export interface ProfileTileProps {
  profile: Profile & { secretLine?: string; revealed?: boolean };
  selected?: boolean;
  slot?: string;
  onClick?: () => void;
  disabled?: boolean;
  asCheckbox?: boolean;
  /** 읽기 전용(수첩) — 소개 3줄 + 비밀 */
  detail?: boolean;
}

export function ProfileTile({ profile: p, selected, slot, onClick, disabled, asCheckbox, detail }: ProfileTileProps) {
  const who = p.id === 'VICTIM' ? 'VICTIM' : p.id;
  const inner = (
    <>
      <span className="wt-profile-art">
        <ArtSlot kind="portrait" who={who} crop="head" title={p.name} />
      </span>
      <span className="wt-profile-text">
        <b>
          {p.name}
          {p.age ? <small> ({p.age})</small> : null}
        </b>
        {detail ? (
          <>
            {p.summary.map((s) => (
              <span key={s} className="wt-profile-line">
                {s}
              </span>
            ))}
            {p.secretLine && (
              <span className="wt-profile-line wt-profile-secret">
                <span aria-hidden>✓ </span>
                {p.secretLine}
              </span>
            )}
          </>
        ) : (
          <span className="wt-profile-line">{p.summary[0]}</span>
        )}
      </span>
      {!detail && <span className="wt-profile-tag">제시 가능</span>}
      {slot && <span className="wt-card-slot" aria-hidden>{slot}</span>}
    </>
  );
  const cls = ['wt-profile', selected ? 'is-selected' : '', disabled ? 'is-disabled' : '', detail ? 'is-detail' : ''].filter(Boolean).join(' ');
  if (!onClick) return <div className={cls}>{inner}</div>;
  return (
    <button type="button" className={cls} role={asCheckbox ? 'checkbox' : undefined} aria-checked={asCheckbox ? !!selected : undefined} aria-label={`${nameOf(p.id)} 프로필${slot ? `, 슬롯 ${slot}` : ''}`} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

/** 정렬 */
export type EvidenceSort = 'recent' | 'time' | 'kind';
export const SORT_LABEL: Record<EvidenceSort, string> = { recent: '최근', time: '시각', kind: '종류' };
const KIND_ORDER: EvidenceKind[] = ['item', 'log', 'doc', 'photo', 'memo'];

export function sortEvidence(list: Evidence[], by: EvidenceSort): Evidence[] {
  const idx = new Map(list.map((e, i) => [e.id, i]));
  const arr = [...list];
  if (by === 'recent') return arr.reverse();
  if (by === 'time') return arr.sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || idx.get(a.id)! - idx.get(b.id)!);
  return arr.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || idx.get(a.id)! - idx.get(b.id)!);
}

const PROFILE_UI_ORDER = ['S1', 'S2', 'S3', 'S4', 'AI', 'VICTIM'];
/** 인물 프로필 표시 순서: 용의자 4 · 또박이 · 피해자 */
export function sortProfiles<T extends { id: string }>(list: T[]): T[] {
  return [...list].sort((a, b) => PROFILE_UI_ORDER.indexOf(a.id) - PROFILE_UI_ORDER.indexOf(b.id));
}
