/**
 * OG 이미지(next/og ImageResponse, edge runtime)용 아이콘 SVG 조각.
 *
 * `_components/TypeIcon.tsx`는 lucide-react 컴포넌트를 그대로 렌더링하지만,
 * satori(ImageResponse의 렌더 엔진)는 React 컴포넌트 트리가 아니라 최종 순수 SVG만
 * 안정적으로 지원하므로, 여기서는 lucide-react 0.381 소스(24x24 viewBox, stroke 기반)의
 * path/line 데이터를 그대로 복사해 인라인 SVG로 렌더링한다.
 *
 * data/types.json의 `icon` 키(kebab-case)가 매핑 기준 — TypeIcon.tsx의 ICON_MAP과
 * 반드시 동일한 8개 키 집합을 유지해야 한다. 매핑에 없는 키는 물음표 아이콘으로 폴백.
 */

interface OgIconProps {
  icon: string;
  size: number;
  color: string;
  strokeWidth?: number;
}

type IconShape =
  | { tag: "path"; d: string }
  | { tag: "line"; x1: string; x2: string; y1: string; y2: string }
  | { tag: "circle"; cx: string; cy: string; r: string };

const OG_ICON_SHAPES: Record<string, IconShape[]> = {
  "hard-hat": [
    { tag: "path", d: "M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" },
    { tag: "path", d: "M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" },
    { tag: "path", d: "M4 15v-3a6 6 0 0 1 6-6h0" },
    { tag: "path", d: "M14 6h0a6 6 0 0 1 6 6v3" },
  ],
  ruler: [
    {
      tag: "path",
      d: "M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z",
    },
    { tag: "path", d: "m14.5 12.5 2-2" },
    { tag: "path", d: "m11.5 9.5 2-2" },
    { tag: "path", d: "m8.5 6.5 2-2" },
    { tag: "path", d: "m17.5 15.5 2-2" },
  ],
  "check-check": [
    { tag: "path", d: "M18 6 7 17l-5-5" },
    { tag: "path", d: "m22 10-7.5 7.5L13 16" },
  ],
  sprout: [
    { tag: "path", d: "M7 20h10" },
    { tag: "path", d: "M10 20c5.5-2.5.8-6.4 3-10" },
    {
      tag: "path",
      d: "M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z",
    },
    {
      tag: "path",
      d: "M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z",
    },
  ],
  "party-popper": [
    { tag: "path", d: "M5.8 11.3 2 22l10.7-3.79" },
    { tag: "path", d: "M4 3h.01" },
    { tag: "path", d: "M22 8h.01" },
    { tag: "path", d: "M15 2h.01" },
    { tag: "path", d: "M22 20h.01" },
    {
      tag: "path",
      d: "m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10",
    },
    { tag: "path", d: "m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17" },
    { tag: "path", d: "m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7" },
    {
      tag: "path",
      d: "M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z",
    },
  ],
  scale: [
    { tag: "path", d: "m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" },
    { tag: "path", d: "m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" },
    { tag: "path", d: "M7 21h10" },
    { tag: "path", d: "M12 3v18" },
    { tag: "path", d: "M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" },
  ],
  headphones: [
    {
      tag: "path",
      d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3",
    },
  ],
  "sliders-horizontal": [
    { tag: "line", x1: "21", x2: "14", y1: "4", y2: "4" },
    { tag: "line", x1: "10", x2: "3", y1: "4", y2: "4" },
    { tag: "line", x1: "21", x2: "12", y1: "12", y2: "12" },
    { tag: "line", x1: "8", x2: "3", y1: "12", y2: "12" },
    { tag: "line", x1: "21", x2: "16", y1: "20", y2: "20" },
    { tag: "line", x1: "12", x2: "3", y1: "20", y2: "20" },
    { tag: "line", x1: "14", x2: "14", y1: "2", y2: "6" },
    { tag: "line", x1: "8", x2: "8", y1: "10", y2: "14" },
    { tag: "line", x1: "16", x2: "16", y1: "18", y2: "22" },
  ],
};

const FALLBACK_SHAPE: IconShape[] = [
  { tag: "circle", cx: "12", cy: "12", r: "10" },
  { tag: "path", d: "M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" },
  { tag: "line", x1: "12", x2: "12.01", y1: "17", y2: "17" },
];

/** OG route(satori) 전용 아이콘 렌더러 — TypeIcon.tsx와 동일 8키를 순수 SVG로 그린다. */
export function OgIcon({ icon, size, color, strokeWidth = 2.5 }: OgIconProps) {
  const shapes = OG_ICON_SHAPES[icon] ?? FALLBACK_SHAPE;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {shapes.map((shape, i) => {
        if (shape.tag === "path") return <path key={i} d={shape.d} />;
        if (shape.tag === "line")
          return <line key={i} x1={shape.x1} x2={shape.x2} y1={shape.y1} y2={shape.y2} />;
        return <circle key={i} cx={shape.cx} cy={shape.cy} r={shape.r} />;
      })}
    </svg>
  );
}
