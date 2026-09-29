'use client';

import { useId } from 'react';
import { LOCATION_IDS, LOCATIONS } from '@/lib/zombie/contract';
import type { LocationId } from '@/lib/zombie/types';

/**
 * 작전지도 풍 서울 약도(1000×700). 한강이 가운데를 가로지르고 북=강북, 남=강남.
 * 지나온 장소는 붉은 점선 경로로 잇고, 현재 위치는 앰버 맥동, 가 보지 않은 곳은 흐린 빈 원.
 */
const RIVER =
  'M0 392 C60 380 150 404 250 396 S380 366 470 368 S600 390 660 404 S800 434 880 424 S960 414 1000 416 ' +
  'L1000 452 C960 452 920 462 880 460 S780 468 660 440 S540 410 470 404 S330 410 250 432 S80 418 0 428 Z';
const SEA = 'M0 0 H70 C92 120 58 240 86 360 C102 440 70 560 96 700 H0 Z';
const ROADS = [
  'M96 356 C300 350 500 342 1000 380',
  'M96 500 C360 480 640 520 1000 500',
  'M480 250 C470 320 440 380 420 470 C400 560 410 640 420 700',
  'M620 215 C600 300 560 380 560 460',
  'M470 70 C476 140 480 200 480 250',
];

/** 라벨 위치 — 도심에 몰린 장소끼리 겹치지 않게 손으로 배치 (dx, dy, 정렬) */
const LABEL: Record<LocationId, [number, number, 'start' | 'middle' | 'end']> = {
  home: [18, 8, 'start'],
  complex: [18, 12, 'start'],
  store: [-18, 2, 'end'],
  station: [-18, 12, 'end'],
  tunnel: [-18, 16, 'end'],
  mart: [0, -20, 'middle'],
  hospital: [18, 8, 'start'],
  shelter: [18, 10, 'start'],
  checkpoint: [18, 14, 'start'],
  bridge: [0, 44, 'middle'],
  stadium: [0, 46, 'middle'],
  harbor: [18, 10, 'start'],
  mountain: [20, 10, 'start'],
};
/** 안개 속에서도 이름을 보여 줄 "먼 목적지" — 여정의 방향을 암시한다 */
const DESTINATIONS = new Set<LocationId>(['stadium', 'harbor', 'mountain']);

export function SeoulMap({ route, current }: { route: LocationId[]; current: LocationId }) {
  // 모바일에선 사이드바(숨김)와 드로어에 동시에 그려지므로 id 가 겹치지 않게 인스턴스별로 만든다
  const uid = useId().replace(/:/g, '');
  const gridId = `zb-map-grid-${uid}`;
  const fogId = `zb-map-fog-${uid}`;
  const visited = new Set(route);
  const pts = route.map((id) => `${LOCATIONS[id].x},${LOCATIONS[id].y}`).join(' ');
  return (
    <svg className="zb-map-svg" viewBox="0 0 1000 700" role="img" aria-label={`서울 약도 — 현재 위치 ${LOCATIONS[current].name}`}>
      <defs>
        <pattern id={gridId} width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M50 0 H0 V50" fill="none" stroke="rgba(236,230,214,0.05)" strokeWidth="1" />
        </pattern>
        <radialGradient id={fogId} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0.6" stopColor="#07090A" stopOpacity="0" />
          <stop offset="1" stopColor="#07090A" stopOpacity="0.85" />
        </radialGradient>
      </defs>
      <rect width="1000" height="700" fill="#0B1011" />
      <rect width="1000" height="700" fill={`url(#${gridId})`} />
      <path d={SEA} fill="#0A1A1F" />
      <text x="34" y="560" className="zb-map-region" transform="rotate(-90 34 560)">
        서해
      </text>
      {[90, 62, 36].map((rx, i) => (
        <ellipse key={rx} cx="470" cy="74" rx={rx} ry={rx * 0.5} transform={`rotate(-8 470 74)`} fill="none" stroke="rgba(236,230,214,0.09)" strokeWidth={1.4} strokeDasharray={i === 0 ? '5 5' : undefined} />
      ))}
      {ROADS.map((d) => (
        <path key={d} d={d} fill="none" stroke="rgba(236,230,214,0.06)" strokeWidth="7" strokeLinecap="round" />
      ))}
      <path d={RIVER} fill="#0F2A30" stroke="#1E4A52" strokeWidth="2" />
      <text x="610" y="426" className="zb-map-river">
        한 강
      </text>
      <rect x="414" y="372" width="12" height="56" fill="rgba(236,230,214,0.18)" />
      <ellipse cx="790" cy="478" rx="26" ry="16" fill="none" stroke="rgba(236,230,214,0.16)" strokeWidth="2" />
      <text x="300" y="175" className="zb-map-region">
        강북
      </text>
      <text x="640" y="585" className="zb-map-region">
        강남
      </text>
      <rect width="1000" height="700" fill={`url(#${fogId})`} />

      {route.length > 1 && <polyline className="zb-map-route" points={pts} fill="none" />}

      {LOCATION_IDS.map((id) => {
        const { x, y, name } = LOCATIONS[id];
        const state = id === current ? 'current' : visited.has(id) ? 'visited' : 'unknown';
        const [dx, dy, anchor] = LABEL[id];
        const showLabel = state !== 'unknown' || DESTINATIONS.has(id);
        return (
          <g key={id} className="zb-map-loc" data-state={state}>
            {state === 'current' && <circle cx={x} cy={y} r="26" className="zb-map-pulse" />}
            <circle cx={x} cy={y} r={state === 'current' ? 13 : state === 'visited' ? 10 : 8} />
            {showLabel && (
              <text x={x + dx} y={y + dy} textAnchor={anchor}>
                {state === 'unknown' ? `${name}?` : name}
              </text>
            )}
          </g>
        );
      })}

      <g className="zb-map-compass" transform="translate(950 50)">
        <path d="M0 -22 L7 4 L0 -2 L-7 4 Z" />
        <text y="22" textAnchor="middle">
          N
        </text>
      </g>
      <g className="zb-map-scale" transform="translate(120 668)">
        <path d="M0 0 H80 M0 -5 V5 M80 -5 V5" />
        <text x="40" y="-9" textAnchor="middle">
          5 km
        </text>
      </g>
    </svg>
  );
}
