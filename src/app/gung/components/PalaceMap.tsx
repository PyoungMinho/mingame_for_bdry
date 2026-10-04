/**
 * 궁 배치도(개선 묶음 1 · R2) — 정적 인라인 SVG 2장(① 궁 전체 ② 동궁전 확대) + 주석.
 *
 * 레이아웃·라벨은 손으로 쓴 데이터 `src/lib/gung/case-extras.ts`(플레이어 뷰 2-1 원문)에서 받는다 — 이 컴포넌트는 그리기만 한다.
 * 장소 상자엔 PlaceGrid 와 같은 아이콘(places[].icon)을 붙인다. 핀치 줌은 없다 — onTap 이 있으면 누를 때 큰 시트로 연다.
 * 사람·화살표 동선·시각·물건은 그리지 않는다(데이터에 자리가 없다). 인원과 무관하게 같은 그림.
 * 프레젠테이션 전용 — 엔진 import 없음(구조만 맞춘 로컬 타입).
 *
 * QA(개선 묶음 1): 지도 글자는 viewBox 단위로 10~12.5 라, 폭 320 안팎 폰에선 화면에서도 10~12.5px 이다. 그래서
 * 「지도를 누르면 크게 보이오」의 큰 시트(zoom)에선 지도를 1.4배(448px)로 그리고 좌우로 밀어 보게 한다 — 가장 작은 글자도 14px.
 * 처음엔 가운데(동궁 내문 줄기)부터 보이게 가로 스크롤을 가운데로 둔다. 핀치 줌은 여전히 없다.
 */
'use client';

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { GUIDE } from '@/lib/gung/guide-data';
import { placeIconComponent } from './icons';
import type { PlaceIconKey } from './types';

export type PalaceMapItemView =
  | { kind: 'box'; key: string; placeId?: string; lines: string[]; note?: string; cx: number; cy: number; w: number; h: number }
  | { kind: 'text'; key: string; text: string; x: number; y: number; anchor: 'start' | 'middle' | 'end'; tone?: 'muted' | 'ink'; size?: 'sm' | 'md' }
  | { kind: 'line'; key: string; x1: number; y1: number; x2: number; y2: number; style: 'road' | 'path' | 'lane' | 'shut' }
  | { kind: 'gate'; key: string; cx: number; cy: number; barred?: boolean }
  | { kind: 'fence'; key: string; x: number; y: number; w: number; h: number; style: 'wall' | 'group' };

export interface PalaceMapView {
  key: string;
  title: string;
  size: [number, number];
  items: readonly PalaceMapItemView[];
}

export interface PalaceMapProps {
  maps: readonly PalaceMapView[];
  /** placeId → 아이콘 키(사건 데이터 places[].icon) */
  placeIcons: Record<string, PlaceIconKey>;
  note: string;
  /** 있으면 지도를 누를 때 호출(전체 높이 시트로 크게) */
  onTap?: () => void;
  tapLabel?: string;
  /** 큰 지도(시트) — 1.4배로 그리고 좌우로 밀어 본다(가장 작은 글자 14px) */
  zoom?: boolean;
  /**
   * 통합(현장 보기): 있으면 장소 상자(placeId 있는 것)가 누를 수 있는 단추가 된다 — 누르면 그 장소 id.
   * 누르는 자리는 상자보다 조금 넓다(서쪽 세 곳은 서로 붙어 있어 겹치지 않는 만큼만). onTap 과 같이 쓰지 않는다.
   */
  onPlace?: (placeId: string) => void;
  /** onPlace 와 함께 — 지금 보고 있는 장소(금색 테) */
  activePlace?: string;
  className?: string;
}

/** 큰 지도 한 장 — 가로로 밀어 보는 틀. 처음엔 가운데로 */
function PanBox({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.round((el.scrollWidth - el.clientWidth) / 2);
  }, []);
  return (
    <div className="gu-map-pan" ref={ref}>
      {children}
    </div>
  );
}

function labelsOf(m: PalaceMapView): string {
  const out: string[] = [];
  for (const it of m.items) {
    if (it.kind === 'box') out.push([it.lines.join(''), it.note].filter(Boolean).join(' '));
    if (it.kind === 'text') out.push(it.text);
  }
  return out.join(', ');
}

function Gate({ cx, cy, barred }: { cx: number; cy: number; barred?: boolean }) {
  return (
    <g className="gu-map-gate" data-barred={barred || undefined}>
      <rect x={cx - 11} y={cy - 9} width={22} height={18} className="gu-map-gate-bg" />
      <path d={`M${cx - 12} ${cy - 8}H${cx + 12}M${cx - 9} ${cy - 5}H${cx + 9}M${cx - 7} ${cy - 5}V${cy + 8}M${cx + 7} ${cy - 5}V${cy + 8}`} className="gu-map-gate-glyph" />
      {barred && <path d={`M${cx - 10} ${cy + 2}H${cx + 10}`} className="gu-map-bar" />}
    </g>
  );
}

/** 누르는 자리 여유(viewBox 단위) — 서쪽 세 곳(높이 22, 간격 26)이 서로 겹치지 않는 만큼 */
const HIT_PAD_X = 4;
const HIT_PAD_Y = 2;

function Box({
  it,
  icon,
  onPlace,
  active,
}: {
  it: Extract<PalaceMapItemView, { kind: 'box' }>;
  icon?: PlaceIconKey;
  onPlace?: (placeId: string) => void;
  active?: boolean;
}) {
  const left = it.cx - it.w / 2;
  const top = it.cy - it.h / 2;
  const Icon = icon ? placeIconComponent(icon) : null;
  const textX = Icon ? (left + 20 + left + it.w) / 2 : it.cx;
  const two = it.lines.length > 1;
  const placeId = it.placeId;
  const tap =
    onPlace && placeId
      ? {
          role: 'button' as const,
          tabIndex: 0,
          'aria-label': `${it.lines[0]} 현장`,
          'aria-pressed': Boolean(active),
          onClick: () => onPlace(placeId),
          onKeyDown: (e: KeyboardEvent<SVGGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onPlace(placeId);
            }
          },
        }
      : {};
  return (
    <g className={onPlace && placeId ? 'gu-map-node gu-map-node--tap' : 'gu-map-node'} data-place={it.placeId} data-icon={icon} data-active={active || undefined} {...tap}>
      {onPlace && placeId && (
        <rect x={left - HIT_PAD_X} y={top - HIT_PAD_Y} width={it.w + HIT_PAD_X * 2} height={it.h + HIT_PAD_Y * 2} rx={8} className="gu-map-hit" />
      )}
      <rect x={left} y={top} width={it.w} height={it.h} rx={6} className="gu-map-box" data-place={it.placeId ? '' : undefined} />
      {Icon && <Icon x={left + 6} y={it.cy - 7} size={14} strokeWidth={2} className="gu-map-icon" aria-hidden focusable={false} />}
      {two ? (
        <>
          <text x={textX} y={it.cy - 4} textAnchor="middle" className="gu-map-t gu-map-t--name">
            {it.lines[0]}
          </text>
          <text x={textX} y={it.cy + 11} textAnchor="middle" className="gu-map-t gu-map-t--sub">
            {it.lines[1]}
          </text>
        </>
      ) : (
        <text x={textX} y={it.cy + 4.5} textAnchor="middle" className="gu-map-t gu-map-t--name">
          {it.lines[0]}
          {it.note && <tspan className="gu-map-t--sub"> {it.note}</tspan>}
        </text>
      )}
    </g>
  );
}

function MapSvg({
  m,
  placeIcons,
  onPlace,
  activePlace,
}: {
  m: PalaceMapView;
  placeIcons: Record<string, PlaceIconKey>;
  onPlace?: (placeId: string) => void;
  activePlace?: string;
}) {
  const [w, h] = m.size;
  // 장소 단추가 있으면 그림(img)이 아니라 묶음(group) — img 안의 단추는 보조기기에서 안 보인다
  const a11y = onPlace ? { role: 'group' as const, 'aria-label': m.title } : { role: 'img' as const, 'aria-label': `${m.title}: ${labelsOf(m)}` };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="gu-map-svg" {...a11y} data-map={m.key}>
      {m.items.map((it) => {
        switch (it.kind) {
          case 'fence':
            return <rect key={it.key} x={it.x} y={it.y} width={it.w} height={it.h} rx={it.style === 'group' ? 8 : 4} className="gu-map-fence" data-style={it.style} />;
          case 'line':
            return <line key={it.key} x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} className="gu-map-line" data-style={it.style} />;
          case 'gate':
            return <Gate key={it.key} cx={it.cx} cy={it.cy} barred={it.barred} />;
          case 'box':
            return (
              <Box
                key={it.key}
                it={it}
                icon={it.placeId ? placeIcons[it.placeId] : undefined}
                onPlace={onPlace}
                active={Boolean(onPlace && it.placeId && it.placeId === activePlace)}
              />
            );
          case 'text':
            return (
              <text
                key={it.key}
                x={it.x}
                y={it.y}
                textAnchor={it.anchor}
                className={`gu-map-t ${it.size === 'md' ? 'gu-map-t--md' : 'gu-map-t--sm'}`}
                data-tone={it.tone ?? 'ink'}
              >
                {it.text}
              </text>
            );
        }
        return null;
      })}
    </svg>
  );
}

export function PalaceMap({ maps, placeIcons, note, onTap, tapLabel, zoom, onPlace, activePlace, className }: PalaceMapProps) {
  const tappable = Boolean(onTap) && !onPlace;
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTap?.();
    }
  };
  return (
    <figure
      className={['gu-map', zoom ? 'gu-map--zoom' : '', className ?? ''].filter(Boolean).join(' ')}
      data-tappable={tappable || undefined}
      {...(tappable ? { role: 'button', tabIndex: 0, 'aria-label': tapLabel, onClick: onTap, onKeyDown: onKey } : {})}
    >
      {zoom && <p className="gu-map-panhint">{GUIDE.mapPanHint}</p>}
      {maps.map((m) => (
        <div key={m.key} className="gu-map-block">
          <p className="gu-map-title">{m.title}</p>
          {zoom ? (
            <PanBox>
              <MapSvg m={m} placeIcons={placeIcons} onPlace={onPlace} activePlace={activePlace} />
            </PanBox>
          ) : (
            <MapSvg m={m} placeIcons={placeIcons} onPlace={onPlace} activePlace={activePlace} />
          )}
        </div>
      ))}
      <figcaption className="gu-map-note">{note}</figcaption>
    </figure>
  );
}
