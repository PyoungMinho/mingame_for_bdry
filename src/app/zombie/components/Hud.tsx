'use client';

import { Backpack, Biohazard, Brain, Dog, Heart, Map as MapIcon, MapPin, Package } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { CHAPTERS, COMPANIONS, LOCATIONS, STAT_META } from '@/lib/zombie/contract';
import { formatClock, infectionLeft, type RunState } from '@/lib/zombie/engine';
import type { CompanionId, StatKey, StoryNode } from '@/lib/zombie/types';

const STAT_ICON: Record<StatKey, LucideIcon> = { hp: Heart, supply: Package, mental: Brain };
const STAT_ORDER: StatKey[] = ['hp', 'supply', 'mental'];

/** 사람 동료는 이름 첫 글자 배지, 콩이는 강아지 아이콘 */
export const COMPANION_GLYPH: Record<CompanionId, string> = {
  kongi: '',
  grandma: '할',
  minjun: '민',
  nurse: '간',
  rider: '용',
  soldier: '병',
};

export function CompanionBadge({ id, size = 'sm' }: { id: CompanionId; size?: 'sm' | 'md' }) {
  return (
    <span className="zb-comp" data-size={size} data-id={id} title={COMPANIONS[id].name}>
      {id === 'kongi' ? <Dog aria-hidden /> : <span aria-hidden>{COMPANION_GLYPH[id]}</span>}
      <span className="zb-sr">{COMPANIONS[id].name}</span>
    </span>
  );
}

function StatBar({ k, value }: { k: StatKey; value: number }) {
  const Icon = STAT_ICON[k];
  return (
    <div
      className="zb-stat"
      data-stat={k}
      data-low={value <= 25 ? '' : undefined}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={`${STAT_META[k].label} ${value}/100`}
    >
      <Icon className="zb-stat-icon" aria-hidden />
      <span className="zb-stat-label" aria-hidden>
        {STAT_META[k].label}
      </span>
      <span className="zb-stat-track" aria-hidden>
        <span className="zb-stat-fill" style={{ width: `${value}%` }} />
      </span>
      <span className="zb-stat-num" aria-hidden>
        {value}
      </span>
    </div>
  );
}

export function Hud({
  state,
  node,
  onMap,
  onBag,
}: {
  state: RunState;
  node: StoryNode;
  onMap: () => void;
  onBag: () => void;
}) {
  const left = infectionLeft(state);
  const [day, time] = formatClock(state.clock).split(' ');
  return (
    <header className="zb-hud">
      <div className="zb-hud-inner">
        <div className="zb-hud-top">
          <div className="zb-clock">
            <span className="zb-sr">현재 시각 </span>
            <span className="zb-clock-d">{day}</span>
            <span className="zb-clock-t">{time}</span>
          </div>
          <div className="zb-where">
            <span className="zb-where-loc">
              <MapPin aria-hidden />
              {LOCATIONS[node.location].name}
            </span>
            <span className="zb-where-chap">
              {node.chapter}장 · {CHAPTERS[node.chapter].name}
            </span>
          </div>
          <div className="zb-hud-actions">
            <button type="button" className="zb-icon-btn zb-only-mobile" onClick={onMap} aria-label="지도와 기록 열기">
              <MapIcon aria-hidden />
              <span>지도</span>
            </button>
            <button
              type="button"
              className="zb-icon-btn zb-only-mobile"
              onClick={onBag}
              aria-label={`가방과 동료 열기${state.items.length ? `, 소지품 ${state.items.length}개` : ''}`}
            >
              <Backpack aria-hidden />
              <span>가방</span>
              {state.items.length > 0 && <span className="zb-count">{state.items.length}</span>}
            </button>
          </div>
        </div>
        <div className="zb-hud-stats">
          {STAT_ORDER.map((k) => (
            <StatBar key={k} k={k} value={state.stats[k]} />
          ))}
        </div>
        {(left !== null || state.companions.length > 0) && (
          <div className="zb-hud-bottom">
            {left !== null && (
              <span className="zb-infect" role="status">
                <Biohazard aria-hidden />
                감염 — {left > 0 ? `${left}장면 남음` : '한계'}
              </span>
            )}
            {state.companions.length > 0 && (
              <span className="zb-party" role="group" aria-label="동행">
                <span className="zb-party-label" aria-hidden>
                  동행
                </span>
                {state.companions.map((c) => (
                  <CompanionBadge key={c} id={c} />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
