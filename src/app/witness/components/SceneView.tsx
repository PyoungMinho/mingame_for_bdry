'use client';

/**
 * 조사 장면(디자인 §5-6) — 1500×1000(3:2) 장면 한 장이 HUD 와 레일 사이를 꽉 채우고, 폭 = 높이 × 1.5, 가로 패닝.
 * 핫스팟은 좌표(%)에 점(보이는 12px, 히트 48px)을 얹는다. 해금 전 핫스팟은 아예 렌더하지 않는다(D09 — 호출자가 걸러서 넘긴다).
 * 일반과 유머 핫스팟은 똑같이 그린다(증거 유무를 미리 알리면 정답을 가르쳐 준다).
 * 레일(HotspotRail)이 키보드·스크린 리더의 정식 경로다 — 점 버튼은 마우스·터치 전용(tabIndex -1, aria-hidden).
 */
import { Check, ChevronLeft, ChevronRight, Cpu, ScanSearch } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Hotspot, Location } from '@/lib/witness';
import { fxMs, T } from '../lib/fx';
import { useWt } from '../lib/context';
import { ArtSlot } from './ArtSlot';

export interface SceneSpot {
  hotspot: Hotspot;
  examined: boolean;
  isNew: boolean;
}

function spotState(s: SceneSpot): 'new' | 'unseen' | 'seen' {
  if (s.examined) return 'seen';
  return s.isNew ? 'new' : 'unseen';
}

export function spotAria(s: SceneSpot): string {
  const st = s.examined ? '조사함' : s.isNew ? '새로 생김, 조사 안 함' : '조사 안 함';
  const extra = s.hotspot.precise && !s.examined ? ', 정밀 조사 행동 1' : s.hotspot.device && !s.examined ? ', 기기' : '';
  return `${s.hotspot.label}, ${st}${extra}`;
}

export interface SceneViewProps {
  location: Location;
  spots: SceneSpot[];
  dimIds?: ReadonlySet<string>;
  /** 대사·시트 중: 점 입력 차단 + 스크림 */
  locked: boolean;
  onTap: (h: Hotspot) => void;
  panTo?: { id: string; n: number } | null;
  /** 장면 위에 얹는 요소(대사 패널 등) */
  children?: ReactNode;
}

export function SceneView({ location, spots, dimIds, locked, onTap, panTo, children }: SceneViewProps) {
  const { fx } = useWt();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [labelId, setLabelId] = useState<string | null>(null);
  const [edge, setEdge] = useState({ left: 0, right: 0 });
  const nudged = useRef(false);

  const measure = useCallback(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const w = el.scrollWidth;
    let l = 0;
    let r = 0;
    for (const s of spots) {
      const px = (s.hotspot.x / 100) * w;
      if (px < el.scrollLeft + 24) l += 1;
      else if (px > el.scrollLeft + el.clientWidth - 24) r += 1;
    }
    setEdge((e) => (e.left === l && e.right === r ? e : { left: l, right: r }));
  }, [spots]);

  // 입장할 때 아직 안 본 핫스팟의 중심으로
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const pool = spots.filter((s) => !s.examined);
    const use = pool.length ? pool : spots;
    if (!use.length) return;
    const cx = use.reduce((a, s) => a + s.hotspot.x, 0) / use.length;
    el.scrollLeft = Math.max(0, (cx / 100) * el.scrollWidth - el.clientWidth / 2);
    measure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.id]);

  useEffect(() => {
    measure();
    const el = scrollRef.current;
    if (!el) return;
    const on = () => measure();
    el.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => {
      el.removeEventListener('scroll', on);
      window.removeEventListener('resize', on);
    };
  }, [measure]);

  // 레일 칩 → 그 점으로 패닝
  useEffect(() => {
    if (!panTo) return;
    const el = scrollRef.current;
    const s = spots.find((x) => x.hotspot.id === panTo.id);
    if (!el || !s || el.clientWidth === 0) return;
    const left = Math.max(0, (s.hotspot.x / 100) * el.scrollWidth - el.clientWidth / 2);
    el.scrollTo?.({ left, behavior: fx === 'reduced' ? 'auto' : 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panTo?.n]);

  // 라벨은 1.6초
  useEffect(() => {
    if (!labelId) return;
    const t = setTimeout(() => setLabelId(null), fxMs(T.toastShort, 'full') || 10);
    return () => clearTimeout(t);
  }, [labelId]);

  const nudge = (dx: number) => scrollRef.current?.scrollBy?.({ left: dx, behavior: fx === 'reduced' ? 'auto' : 'smooth' });

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') nudge(-160);
    else if (e.key === 'ArrowRight') nudge(160);
  };

  return (
    <div className="wt-scene" data-locked={locked ? '1' : undefined}>
      <div className="wt-scene-scroll" ref={scrollRef} tabIndex={0} onKeyDown={onKey} aria-label="장면(좌우 화살표로 둘러보기). 아래 목록으로도 모든 곳을 고를 수 있어요" role="group">
        <div className="wt-scene-canvas">
          <ArtSlot kind="scene" art={location.art} idScope={location.id} rain={fx !== 'reduced'} />
          {spots.map((s) => {
            const h = s.hotspot;
            const st = spotState(s);
            const dim = dimIds?.has(h.id);
            return (
              <button
                key={h.id}
                type="button"
                className="wt-spot"
                style={{ left: `${h.x}%`, top: `${h.y}%` }}
                data-state={st}
                data-kind={h.precise ? 'precise' : h.device ? 'device' : 'plain'}
                data-dim={dim ? '1' : undefined}
                data-flip={h.y < 12 ? '1' : undefined}
                data-hid={h.id}
                aria-hidden
                tabIndex={-1}
                disabled={locked || dim}
                onClick={() => {
                  setLabelId(h.id);
                  onTap(h);
                }}
              >
                <span className="wt-spot-core">
                  {st === 'seen' ? <Check size={12} aria-hidden /> : h.precise ? <ScanSearch size={14} aria-hidden /> : h.device ? <Cpu size={12} aria-hidden /> : null}
                </span>
                {h.precise && !s.examined && <span className="wt-spot-plus">+1</span>}
                {st === 'new' && <span className="wt-spot-newtag">NEW</span>}
                {labelId === h.id && <span className="wt-spot-label">{h.label}</span>}
              </button>
            );
          })}
        </div>
      </div>
      {edge.left > 0 && (
        <button type="button" className="wt-edge wt-edge--l" onClick={() => nudge(-240)} aria-label={`왼쪽에 ${edge.left}곳 더 있어요`} tabIndex={-1}>
          <ChevronLeft size={16} aria-hidden /> {edge.left}
        </button>
      )}
      {edge.right > 0 && (
        <button type="button" className={['wt-edge', 'wt-edge--r', !nudged.current ? 'is-nudge' : ''].join(' ')} onClick={() => nudge(240)} aria-label={`오른쪽에 ${edge.right}곳 더 있어요`} tabIndex={-1}>
          {edge.right} <ChevronRight size={16} aria-hidden />
        </button>
      )}
      <div className="wt-scene-scrim" aria-hidden data-on={locked ? '1' : undefined} />
      {children}
    </div>
  );
}

export interface HotspotRailProps {
  spots: SceneSpot[];
  dimIds?: ReadonlySet<string>;
  disabled?: boolean;
  onPick: (h: Hotspot) => void;
  onExit: () => void;
  /** 오른쪽 끝(튜토리얼 [브리핑 시작]) */
  extra?: ReactNode;
}

export function HotspotRail({ spots, dimIds, disabled, onPick, onExit, extra }: HotspotRailProps) {
  const sorted = [...spots].sort((a, b) => a.hotspot.x - b.hotspot.x);
  const done = spots.filter((s) => s.examined).length;
  return (
    <div className="wt-rail">
      <button type="button" className="wt-btn wt-btn--ghost wt-rail-exit" onClick={onExit}>
        나가기
      </button>
      <span className="wt-rail-count" aria-label={`${spots.length}곳 중 ${done}곳 조사함`}>
        {done}/{spots.length}
      </span>
      <div className="wt-rail-chips" role="group" aria-label="눈에 띄는 곳">
        {sorted.map((s) => {
          const h = s.hotspot;
          const st = spotState(s);
          return (
            <button key={h.id} type="button" className="wt-railchip" data-state={st} data-hid={h.id} disabled={disabled || dimIds?.has(h.id)} aria-label={spotAria(s)} onClick={() => onPick(h)}>
              {st === 'seen' ? <Check size={14} aria-hidden /> : h.device ? <Cpu size={14} aria-hidden /> : <i className="wt-railchip-dot" aria-hidden />}
              <span>{h.label}</span>
              {h.precise && !s.examined && <span className="wt-railchip-tag">정밀 +1</span>}
              {st === 'new' && <span className="wt-railchip-new">NEW</span>}
            </button>
          );
        })}
      </div>
      {extra}
    </div>
  );
}
