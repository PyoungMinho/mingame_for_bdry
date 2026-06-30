"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { Avatar } from "./MemberChip";
import { useMounted, useReducedMotion } from "./motion";
import { fairLevel } from "@/lib/moira/fairness";
import {
  ROUTE_WEIGHT,
  ROUTE_DIM,
  ROUTE_ACTIVE,
  ROUTE_DASH,
  routeWeightKey,
  type LatLng,
  type MemberRoute,
} from "@/lib/moira/route";

// ── 카카오맵 타입 최소 선언 (kakao SDK 미설치 환경 대응) ──
interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}
interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
}
interface KakaoMapInstance {
  setBounds: (bounds: KakaoLatLngBounds, padding?: number) => void;
  getProjection: () => {
    containerPointFromCoords: (latlng: KakaoLatLng) => { x: number; y: number };
  };
}
interface KakaoMaps {
  load: (cb: () => void) => void;
  Map: new (
    container: HTMLElement,
    opts: { center: KakaoLatLng; level: number; draggable: boolean; zoomable: boolean },
  ) => KakaoMapInstance;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
}
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export interface RouteMapCanvasProps {
  members: MemberRoute[];
  destination: LatLng;
  /** 강조할 멤버 id 목록. 빈 배열 = 전체 표시 */
  activeMembers: string[];
  /** 전체 공평성 격차(분) — 경로선 색 결정 */
  fairGap: number;
  /** 목적지 핀 드래그 가능 여부 */
  draggablePin?: boolean;
  onPinDrag?: (coords: LatLng) => void;
  /** 마운트 시 수렴 애니메이션 */
  animateOnMount?: boolean;
  className?: string;
}

// ── SVG 좌표 변환 (폴백 모드: 지도 없이 정규화) ──
function toSvgPoint(
  latlng: LatLng,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  svgW: number,
  svgH: number,
) {
  const { minLat, maxLat, minLng, maxLng } = bounds;
  const latRange = maxLat - minLat || 0.01;
  const lngRange = maxLng - minLng || 0.01;
  const margin = 0.12; // 12% 여백
  const x = margin * svgW + ((latlng.lng - minLng) / lngRange) * svgW * (1 - 2 * margin);
  // SVG y는 위가 작음(lat 클수록 위) → 반전
  const y = margin * svgH + ((maxLat - latlng.lat) / latRange) * svgH * (1 - 2 * margin);
  return { x, y };
}

/** 좌표 집합에서 bounds 계산 */
function calcBounds(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

/** polyline 총 길이 추정 (SVG pathLength 대용, 스태거 계산용) */
function polylineLength(pts: Array<{ x: number; y: number }>): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len || 100;
}

/**
 * RouteMapCanvas — 카카오맵 SDK 래퍼 + SVG polyline 오버레이 + 아바타 마커/핀 + 수렴 애니메이션
 *
 * P0 폴백: 카카오 키 없거나 로드 실패 시 SVG 단독 렌더 (수렴 애니메이션 데모 작동).
 * P0 지도: pan/zoom 잠금 (draggable:false, zoomable:false).
 */
export function RouteMapCanvas({
  members,
  destination,
  activeMembers,
  fairGap,
  draggablePin = false,
  onPinDrag,
  animateOnMount = true,
  className,
}: RouteMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [svgSize, setSvgSize] = useState({ w: 480, h: 400 });
  const reduced = useReducedMotion();
  const mounted = useMounted(80); // 80ms 후 진입 애니메이션 시작

  // 공평성 등급 → 경로선 색 (오직 공평도만 색에 반영)
  const level = fairLevel(fairGap);

  // 모든 좌표 수집 (bounds 계산)
  const allPoints: LatLng[] = [
    ...members.flatMap((m) => m.polyline),
    ...members.map((m) => m.originLatLng),
    destination,
  ];
  const bounds = calcBounds(allPoints);

  // SVG 크기 동기화
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSvgSize({
          w: entry.contentRect.width || 480,
          h: entry.contentRect.height || 400,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // 카카오맵 로드
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!apiKey || !containerRef.current) {
      setMapFailed(true);
      return;
    }

    // 이미 로드됐으면 재사용
    if (window.kakao?.maps) {
      initMap();
      return;
    }

    // 스크립트 동적 로드
    const scriptId = "kakao-map-sdk";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`;
      script.async = true;
      script.onerror = () => setMapFailed(true);
      script.onload = () => {
        window.kakao?.maps.load(() => initMap());
      };
      document.head.appendChild(script);
    } else {
      // 이미 삽입됐지만 아직 로드 중
      const checkInterval = setInterval(() => {
        if (window.kakao?.maps) {
          clearInterval(checkInterval);
          window.kakao.maps.load(() => initMap());
        }
      }, 100);
      const timeout = setTimeout(() => {
        clearInterval(checkInterval);
        setMapFailed(true);
      }, 5000);
      return () => {
        clearInterval(checkInterval);
        clearTimeout(timeout);
      };
    }

    function initMap() {
      if (!containerRef.current || !window.kakao) return;
      try {
        const center = new window.kakao.maps.LatLng(destination.lat, destination.lng);
        const map = new window.kakao.maps.Map(containerRef.current, {
          center,
          level: 6,
          draggable: false,  // P0: 지도 pan/zoom 잠금
          zoomable: false,
        });

        // bounds 맞춤
        const kakBounds = new window.kakao.maps.LatLngBounds();
        allPoints.forEach((p) => {
          kakBounds.extend(new window.kakao!.maps.LatLng(p.lat, p.lng));
        });
        map.setBounds(kakBounds, 60);
        mapRef.current = map;
      } catch {
        setMapFailed(true);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 멤버별 이동시간 목록 (손해도 순위 계산용)
  const allMinutes = members.map((m) => m.minutes);

  // SVG 폴리라인 점 계산
  const memberPaths = members.map((m) => {
    const svgPts = m.polyline.map((p) =>
      toSvgPoint(p, bounds, svgSize.w, svgSize.h),
    );
    const length = polylineLength(svgPts);
    const weightKey = routeWeightKey(m.minutes, allMinutes);
    const weight = ROUTE_WEIGHT[weightKey];
    const dash = ROUTE_DASH[m.mode];
    const isActive =
      activeMembers.length === 0 || activeMembers.includes(m.id);
    const opacity = isActive ? ROUTE_ACTIVE : ROUTE_DIM;

    // 스태거: 오래 걸리는 멤버가 마지막 도착 → delay 비례
    const maxMin = Math.max(...allMinutes);
    const minMin = Math.min(...allMinutes);
    const range = maxMin - minMin || 1;
    const staggerMs = ((m.minutes - minMin) / range) * 400; // 0~400ms

    const pointsStr = svgPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

    return { m, svgPts, length, weight, dash, opacity, staggerMs, pointsStr };
  });

  // 아바타 마커 위치
  const originMarkers = members.map((m) => ({
    ...m,
    svgPt: toSvgPoint(m.originLatLng, bounds, svgSize.w, svgSize.h),
  }));

  // 목적지 핀 위치
  const destPt = toSvgPoint(destination, bounds, svgSize.w, svgSize.h);

  // 드래그 핀 핸들러 (P0: 단순 click → onPinDrag(destination) 전달)
  const handlePinClick = useCallback(() => {
    if (draggablePin && onPinDrag) {
      onPinDrag(destination);
    }
  }, [draggablePin, onPinDrag, destination]);

  // fair-* Tailwind 클래스 → SVG용 실제 색 추출
  // FAIR_STYLE.bar = "bg-moira-fair-good" 등 → 직접 색값 매핑
  const FAIR_COLOR: Record<string, string> = {
    good: "#10B981",
    mid: "#F59E0B",
    bad: "#F43F5E",
  };
  const routeStroke = FAIR_COLOR[level];

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden bg-moira-map-overlay-bg", className)}
      style={{ minHeight: 260 }}
      aria-label="경로 지도"
      role="img"
    >
      {/* 카카오맵 실패 시 안내 */}
      {mapFailed && (
        <div className="pointer-events-none absolute top-2 left-1/2 z-20 -translate-x-1/2">
          <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-moira-muted shadow-sm">
            지도를 불러올 수 없어요 — 경로 미리보기로 표시합니다
          </span>
        </div>
      )}

      {/* SVG 경로 오버레이 (지도 위 또는 단독) */}
      <svg
        ref={svgRef}
        className="absolute inset-0 z-10 w-full h-full"
        viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        {memberPaths.map(({ m, pointsStr, length, weight, dash, opacity, staggerMs }) => {
          // 애니메이션: mounted && !reduced 일 때만 dashoffset 애니메이션
          const shouldAnimate = animateOnMount && !reduced && mounted;

          return (
            <g key={m.id} style={{ opacity }}>
              {/* 흰색 halo (외곽선) — 밝은 타일 대비 마지노선 */}
              <polyline
                points={pointsStr}
                fill="none"
                stroke="white"
                strokeWidth={weight + 3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ opacity: 0.85 }}
              />
              {/* 실제 경로선 */}
              <polyline
                className="route-polyline"
                points={pointsStr}
                fill="none"
                stroke={routeStroke}
                strokeWidth={weight}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dash === "none" ? undefined : dash}
                style={
                  shouldAnimate
                    ? {
                        // CSS 변수로 pathLength 전달 → @keyframes moira-route-draw 사용
                        // stroke-dasharray를 애니메이션용으로 임시 전체 길이로 설정
                        strokeDasharray: `${length} ${length}`,
                        strokeDashoffset: length,
                        animation: `moira-route-draw 0.9s cubic-bezier(.22,1,.36,1) ${staggerMs}ms forwards`,
                        willChange: "stroke-dashoffset",
                      }
                    : {
                        strokeDasharray: dash === "none" ? undefined : dash,
                        strokeDashoffset: 0,
                      }
                }
              />
            </g>
          );
        })}
      </svg>

      {/* 아바타 마커 (출발지) — z-20 */}
      {originMarkers.map((m) => {
        const isActive = activeMembers.length === 0 || activeMembers.includes(m.id);
        return (
          <div
            key={m.id}
            className="route-marker absolute z-20"
            style={{
              left: m.svgPt.x - 22,
              top: m.svgPt.y - 22,
              opacity: isActive ? 1 : ROUTE_DIM,
              transition: "opacity 0.2s",
            }}
            aria-label={`${m.name} 출발지`}
          >
            {/* 44×44 투명 터치영역 */}
            <div className="flex h-[44px] w-[44px] items-center justify-center">
              <div
                className="rounded-full shadow-md"
                style={{
                  padding: 2,
                  backgroundColor: "white",
                }}
              >
                <Avatar name={m.name} color={m.avatar} size={30} ring />
              </div>
            </div>
          </div>
        );
      })}

      {/* 목적지 핀 — z-20 */}
      <div
        className="route-marker absolute z-20"
        style={{
          left: destPt.x - 22,
          top: destPt.y - 22,
        }}
        aria-label="목적지"
      >
        {/* 44×44 투명 터치영역 */}
        <button
          type="button"
          onClick={handlePinClick}
          aria-label="목적지 핀"
          disabled={!draggablePin}
          className={cn(
            "flex h-[44px] w-[44px] cursor-default items-center justify-center",
            draggablePin && "cursor-pointer",
          )}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-full bg-moira-brand text-white"
            style={{ boxShadow: "0 4px 10px rgba(79,70,229,.40)" }}
          >
            <MapPin size={18} strokeWidth={2.5} />
          </span>
        </button>
      </div>
    </div>
  );
}
