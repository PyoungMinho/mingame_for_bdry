# 모이라(Moira) — RouteMap UI 스펙

> UI디자이너 산출물 · 2026-06-09
> 근거 문서: `design-system/moira/MASTER.md`, `docs/design/moira-design-final.md`, `docs/planning/moira-vision-revision.md §5`
> **이 파일에서 정의하는 신규 토큰은 기존 `moira.*` 네임스페이스에 가산만 한다. 기존 토큰 값은 변경하지 않는다.**

---

## 1. 신규·확장 디자인 토큰

### 1-1. 경로선(Polyline) 토큰

경로선 색은 기존 공평성 3색(`moira-fair-good/mid/bad`)을 재사용한다.
신규 토큰은 굵기(손해도) 스케일과 투명도만 추가한다.

```
tailwind.config.ts — moira.* 가산 목록

// 경로선 굵기 — 손해 클수록 굵게 (stroke-width 단위: px, SVG/Canvas 직접 적용)
"route-weight-low"    : "3"    // 가장 공평한 멤버 (최소 이동시간)
"route-weight-mid"    : "5"    // 중간
"route-weight-high"   : "8"    // 가장 손해인 멤버 (최대 이동시간)

// 경로선 투명도 (선택 상태 OFF 시 흐림)
"route-dim"          : "0.22"  // 탭 미선택 경로선 opacity
"route-active"       : "1"     // 탭 선택 경로선 opacity

// 경로선 대시 패턴 (교통수단별, SVG stroke-dasharray)
"route-dash-walk"    : "4 6"   // 도보 — 짧은 점선
"route-dash-bus"     : "12 4"  // 버스 — 긴 실선 + 짧은 갭
"route-dash-subway"  : "none"  // 지하철 — 실선
"route-dash-car"     : "none"  // 자동차 — 실선 (굵기로 구분)
```

**경로선 인코딩 룰(요약)**

| 속성 | 인코딩 기준 | 값 |
|------|------------|-----|
| 색(stroke) | 공평도(max−min 격차) | `fair-good` / `fair-mid` / `fair-bad` |
| 굵기(stroke-width) | 손해도(해당 멤버 이동시간 / 전체 최대값) | `route-weight-low` ~ `route-weight-high` |
| 패턴(stroke-dasharray) | 주 교통수단 | `route-dash-walk/bus/subway/car` |
| 투명도(opacity) | 멤버 탭 선택 여부 | `route-active` / `route-dim` |

---

### 1-2. 교통수단 색 토큰

서울 지하철 호선 색은 `StationHero.tsx`의 `LINE_COLOR` 상수와 동기화한다.
버스·도보·차는 아래 신규 토큰으로 추가한다.
이모지 사용 금지 — lucide 아이콘(`Train`, `Bus`, `Footprints`, `Car`)을 아이콘 소스로 사용한다.

```
tailwind.config.ts — moira.* 가산

// 교통수단 색 토큰
"transport-subway"   : "#0052A4"   // 1호선 기준 참조색 (노선별 LINE_COLOR 참조)
"transport-bus"      : "#F97316"   // 오렌지 — 버스 전용 (공평성 amber와 구분: hue 차이)
"transport-walk"     : "#64748B"   // 슬레이트 — 도보
"transport-car"      : "#6366F1"   // 바이올렛 — 자동차 (moira-brand와 유사하되 구분)

// 교통수단 칩 배경
"transport-bus-tint"   : "#FFF7ED"
"transport-walk-tint"  : "#F1F5F9"
"transport-car-tint"   : "#EEF2FF"
```

혼동 방지 규칙:
- `transport-bus`(`#F97316`, hue 25)는 `fair-mid`(`#F59E0B`, hue 43)와 색상(hue)이 18도 이상 차이난다. 나란히 표시해도 구분 가능.
- `transport-car`(`#6366F1`)는 `moira-brand`(`#4F46E5`)와 유사하므로, 자동차는 항상 `Car` 아이콘을 동반해 색 단독 의존을 방지한다(접근성 규칙 계승).

---

### 1-3. 지도 오버레이 레이어 토큰

```
tailwind.config.ts — moira.* 가산

"map-overlay-bg"     : "rgba(248,250,252,0.92)"   // 반투명 패널 배경 (라이트)
"map-overlay-dark"   : "rgba(15,23,42,0.88)"      // 다크모드 패널 배경
"map-marker-ring"    : "#FFFFFF"                  // 아바타 마커 외곽 링
"map-pin-shadow"     : "0 4px 10px rgba(79,70,229,.40)"  // 목적지 핀 그림자
```

---

### 1-4. 점수 배지 색 토큰

장소 수정 시 공평성 점수 실시간 변동(`87 → 41`)을 위한 신규 토큰.
**공평성 색(`fair-*`)과 혼동 방지**: 점수 증가/감소는 semantic green/red 계열이되,
구분 규칙은 "점수 배지는 항상 화살표 아이콘(`ArrowUp`/`ArrowDown`)을 동반한다"로 명시한다.

```
tailwind.config.ts — moira.* 가산

// 점수 변동 배지 — 공평성 색과 별개 계열
"score-up"           : "#059669"   // emerald-600 — 점수 상승 (공평성 개선)
"score-up-tint"      : "#D1FAE5"   // 배지 배경
"score-down"         : "#DC2626"   // red-600 — 점수 하락 (공평성 악화)
"score-down-tint"    : "#FEE2E2"   // 배지 배경
"score-neutral"      : "#475569"   // 변동 없음 = moira-body 재사용
```

혼동 방지 규칙(명문):
- `fair-good`(`#10B981`)과 `score-up`(`#059669`)은 둘 다 녹색이다. 구분은 **항상 텍스트·아이콘 라벨 동반**: fair-good은 "격차 N분" 텍스트, score-up은 "ArrowUp + 점수" 조합.
- 점수 배지는 독립 컴포넌트(`FairnessScoreBadge`)로 캡슐화하여 공평성 막대와 동일 영역에 위치시키지 않는다.

---

## 2. 컴포넌트 스펙

### 2-1. RouteMapCanvas

```typescript
interface RouteMapCanvasProps {
  members: MemberRoute[];         // 각 멤버의 출발지 좌표 + polyline 포인트 배열 + 이동시간
  destination: LatLng;            // 목적지 핀 좌표 (드래그 가능)
  activeMembers: string[];        // 현재 강조 표시할 멤버 id 배열 (빈 배열 = 전체)
  fairGap: number;                // 격차 → 경로선 색 결정
  draggablePin?: boolean;         // 장소 수정 모드
  onPinDrag?: (coord: LatLng) => void;
  animateOnMount?: boolean;       // 수렴 애니메이션 실행 여부
  className?: string;
}

// MemberRoute 타입
interface MemberRoute {
  id: string;
  name: string;
  avatar: string;           // 색상 코드 — Avatar 컴포넌트에 전달
  origin: LatLng;
  polyline: LatLng[];       // mock: 직선 보간 2점. P1: ODsay 실경로 다점
  minutes: number;          // 이동시간 → 굵기 결정
  mode: "subway" | "bus" | "walk" | "car";  // 대시 패턴 결정
}
```

구현 지침:
- 카카오맵 SDK 위에 SVG 오버레이 레이어를 얹어 polyline을 그린다.
- `activeMembers` 빈 배열 = 전체 표시(opacity: route-active). 특정 id 지정 = 해당만 route-active, 나머지 route-dim.
- 아바타 마커: 기존 `Avatar` 컴포넌트(src/components/moira/MemberChip.tsx)를 CustomOverlay로 래핑. 외곽 링 `map-marker-ring`.
- 목적지 핀: `MapPin`(lucide) + `map-pin-shadow` 그림자.
- `draggablePin=true`이면 핀 드래그 이벤트 → `onPinDrag` 콜백 → 부모에서 Haversine 추정 점수 재계산.

---

### 2-2. MemberRouteChip

멤버 탭바. 탭 토글로 경로 강조/흐림 제어.

```typescript
interface MemberRouteChipProps {
  memberId: string;
  name: string;
  avatar: string;
  minutes: number;
  mode: "subway" | "bus" | "walk" | "car";
  active: boolean;
  onToggle: (id: string) => void;
}
```

비주얼 규칙:
- 비활성(`active=false`): `ring-1 ring-moira-border bg-white opacity-50`
- 활성(`active=true`): `ring-2 ring-moira-brand bg-moira-brand-tint`
- 크기: `min-h-[44px]` (터치타겟 준수), `rounded-xl px-3 py-2`
- 내부 구조: `Avatar(24px)` + 이름(xs 토큰) + `TransportBadge` + 시간(num 토큰, tabular-nums)
- 기존 `MemberChip` 컴포넌트를 확장하되, 탭 상태 관리 로직만 추가.

---

### 2-3. TransportBadge

교통수단 아이콘 + 색 칩.

```typescript
interface TransportBadgeProps {
  mode: "subway" | "bus" | "walk" | "car";
  line?: string;   // 지하철 호선 번호 (subway일 때만)
  size?: "sm" | "md";
}
```

비주얼 규칙:
- `subway`: 호선 번호 원형 배지(기존 LINE_COLOR 상수 재사용) + `Train`(lucide) 아이콘
- `bus`: `bus-tint` 배경 + `Bus`(lucide) 아이콘 + `transport-bus` 색
- `walk`: `walk-tint` 배경 + `Footprints`(lucide) 아이콘 + `transport-walk` 색 (기존 PlaceCard·FairnessBars의 Footprints 아이콘 스타일 계승)
- `car`: `car-tint` 배경 + `Car`(lucide) 아이콘 + `transport-car` 색
- 크기 sm(`h-5 w-5 text-[11px]`), md(`h-6 w-6 text-[12px]`)
- **이모지 금지** — 위 lucide 아이콘 4종만 사용

---

### 2-4. FairnessScoreBadge

장소 수정 시 점수 실시간 변동 표시. 공평성 막대(FairnessBars)와 별도 컴포넌트.

```typescript
interface FairnessScoreBadgeProps {
  prev: number;        // 수정 전 점수
  current: number;     // 현재 추정 점수
  animated?: boolean;  // CountUp 사용 여부
}
```

비주얼 규칙:
- 점수 상승(`current > prev`): `score-up-tint` 배경, `score-up` 텍스트, `ArrowUp`(lucide, strokeWidth 3) 아이콘
- 점수 하락(`current < prev`): `score-down-tint` 배경, `score-down` 텍스트, `ArrowDown`(lucide) 아이콘
- 동일(`current === prev`): `bg-slate-50`, `score-neutral` 텍스트, 아이콘 없음
- 레이아웃: `inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold`
- 숫자: `CountUp` 컴포넌트 재사용(motion.tsx). `animated=false`이면 즉시값.
- 점수 하락 경고 카피는 부모 컴포넌트에서 별도 렌더(`PlaceEditSheet` 내부 주의 문구).

---

### 2-5. PlaceEditSheet

장소 수정 바텀시트. 드래그업 패널 내 순위 선택지 + 자유 수정 진입.

```typescript
interface PlaceEditSheetProps {
  candidates: PlaceCandidate[];    // 알고리즘 상위 후보 (A/B/C 공평지수)
  currentScore: number;            // 현재 선택 장소 공평지수
  onSelect: (candidate: PlaceCandidate) => void;
  onCustomPin: () => void;         // 지도 핀 드래그 모드 진입
  isOpen: boolean;
  onClose: () => void;
}

interface PlaceCandidate {
  id: string;
  name: string;
  fairScore: number;     // 0–100
  gap: number;           // 분
  rank: "A" | "B" | "C";
}
```

비주얼 규칙:
- 바텀시트 구조: `fixed bottom-0` + `rounded-t-2xl bg-moira-surface` + 드래그 핸들(4px 막대)
- 후보 리스트: rank(A/B/C 원형 배지) + 장소명 + `FairnessScoreBadge`(현재 점수와 비교) + gap 표시
- A안 기본 선택 상태: `ring-2 ring-moira-brand`
- 자유 수정 버튼: ghost variant, `MapPin`(lucide) 아이콘 + "지도에서 직접 선택"
- 기존 `StickyBottomBar` 컴포넌트와 z-index 충돌 방지: PlaceEditSheet `z-50`, StickyBottomBar `z-40`

---

## 3. 수렴 애니메이션 명세

### 3-1. 수렴 진입 애니메이션 (시그니처)

> 경로선들이 각자 출발지에서 목적지를 향해 동시에 그려지며, 이동시간이 긴 멤버의 선이 가장 마지막에 도착한다. 텍스트 없이도 누가 가장 멀리서 오는지 즉시 시각화된다.

```
구현 방식: SVG stroke-dashoffset 애니메이션

초기 상태:
  stroke-dasharray  = totalLength
  stroke-dashoffset = totalLength  (선 완전히 숨김)

재생 상태:
  stroke-dashoffset → 0  (선이 출발지에서 목적지 방향으로 그려짐)

타이밍 계산:
  baseDuration = 900ms
  memberDelay[i] = (members[i].minutes / maxMinutes) * 300ms
  → 이동시간이 짧은 멤버: 더 빨리 도착 (delay 적음)
  → 이동시간이 긴 멤버: 더 늦게 도착 (delay 큼) ← 시그니처 효과

각 경로선 애니메이션:
  duration        : 900ms
  delay           : memberDelay[i]
  easing          : cubic-bezier(0.22, 1, 0.36, 1)  (moira 기존 easing 계승)
  fill-mode       : forwards

아바타 마커 진입:
  opacity: 0 → 1, scale: 0.6 → 1
  duration: 200ms, delay: memberDelay[i] (경로 시작과 동기)
  easing: cubic-bezier(0.34, 1.56, 0.64, 1)  (motion-spring, tailwind.config 기존 토큰)

목적지 핀 등장:
  마지막 멤버 경로 완료 후 150ms 딜레이
  scale: 0 → 1.15 → 1.0 (spring bounce)
  duration: 350ms
```

### 3-2. prefers-reduced-motion 대체

```
@media (prefers-reduced-motion: reduce) {
  /* 경로선: 즉시 최종 상태 (stroke-dashoffset: 0, opacity: route-active) */
  .route-polyline {
    stroke-dashoffset: 0 !important;
    transition: none !important;
    animation: none !important;
  }
  /* 아바타 마커: 즉시 표시 */
  .route-marker {
    opacity: 1 !important;
    transform: none !important;
    animation: none !important;
  }
}
```

globals.css의 기존 `prefers-reduced-motion` 규칙(moira- 프리픽스 키프레임 정지) 아래에 추가한다.
기존 `FairnessBars`의 `useReducedMotion()` 훅 패턴을 `RouteMapCanvas`에서도 동일하게 사용한다.

---

## 4. 타이포·간격·고도(Elevation)

### 4-1. 화면 레이아웃 (RouteMap 전용)

```
전체 높이: 100dvh

┌──────────────────────────────────┐  ← z-30: MoiraShell 헤더 (sticky, h-14)
│           Header                 │
├──────────────────────────────────┤
│                                  │
│     RouteMapCanvas (지도)        │  ← z-0: 카카오맵 SDK 레이어
│     [화면 높이의 60~65%]         │     z-10: SVG polyline 오버레이
│                                  │     z-20: 아바타 마커 + 목적지 핀
├──────────────────────────────────┤
│   MemberRouteChip 탭바           │  ← z-30: 수평 스크롤, px-5, py-3
│   (가로 스크롤, 최대 6칩)        │
├──────────────────────────────────┤
│   하단 드래그업 패널             │  ← z-40: 기본 높이 200px, 드래그업 최대 70%
│   FairnessBars + 멤버 세부       │     배경: map-overlay-bg (반투명)
│                                  │
├──────────────────────────────────┤
│   StickyBottomBar (CTA)          │  ← z-40: safe-area padding
└──────────────────────────────────┘

PlaceEditSheet (조건부 표시)        ← z-50: 바텀시트 오버레이
```

### 4-2. Z-Index 스케일

| 레이어 | z-index | 설명 |
|--------|---------|------|
| 지도 SDK | 0 | 카카오맵 기본 |
| Polyline SVG | 10 | 경로선 오버레이 |
| 마커·핀 | 20 | 아바타 마커, 목적지 핀 |
| 탭바·패널 | 30 | MemberRouteChip 탭바, MoiraShell 헤더 |
| 하단 패널·BottomBar | 40 | 드래그업 패널, StickyBottomBar |
| 바텀시트 | 50 | PlaceEditSheet (모달형) |

### 4-3. 드래그업 패널 — 타이포·간격

| 요소 | 토큰 | 값 |
|------|------|-----|
| 패널 제목 ("이동 정보") | moira MASTER h2 | 20px / 700 |
| 멤버 이름 | moira MASTER sm | 14px / 500 |
| 이동시간 숫자 | moira MASTER num + tabular-nums | 18px / 700 |
| 교통수단 라벨 | moira MASTER xs | 13px / 600 |
| 격차 숫자 (FairnessBars 계승) | MASTER num | 18px / 800 |
| 패널 좌우 패딩 | `px-5` | 20px |
| 아이템 간격 | `space-y-2.5` | 10px (FairnessBars 계승) |
| 패널 상단 패딩 | `pt-3` | 12px |
| 드래그 핸들 | `w-10 h-1 rounded-full bg-moira-border mx-auto mb-3` | — |

---

## 5. 라이트/다크 대비 체크

### 5-1. 신규 토큰 대비 (라이트 기준)

| 토큰 | 배경 | 전경 | 대비비 | 판정 |
|------|------|------|--------|------|
| `score-up` `#059669` | `score-up-tint` `#D1FAE5` | `#059669` | 4.8:1 | PASS |
| `score-down` `#DC2626` | `score-down-tint` `#FEE2E2` | `#DC2626` | 4.7:1 | PASS |
| `transport-bus` `#F97316` on tint | `#FFF7ED` | `#F97316` | 3.2:1 | 주의 — 버스 칩은 아이콘+텍스트 조합으로 보완 |
| `route-dim` opacity 0.22 | 지도 위 | — | — | 경로선은 색 단독 의존 없음(굵기+아이콘 동반) |

버스 칩 주의사항: `transport-bus`(`#F97316`) on 흰 배경 대비 3.2:1로 4.5:1 미달. 따라서 버스 TransportBadge는 반드시 `Bus` 아이콘 + "버스" 텍스트 라벨을 동반하고, 색 단독 사용 금지.

### 5-2. 다크모드 대응 규칙

현재 모이라 빌드는 라이트모드 단일 구현이다. 다크모드 대응은 아래 토큰 매핑 예약만 수행하고, 실제 적용은 P2 단계로 연기한다.

| 라이트 토큰 | 다크 대체값(예약) | 적용 위치 |
|------------|-----------------|-----------|
| `moira-surface` `#FFF` | `#1E293B` (slate-800) | 드래그업 패널, PlaceEditSheet |
| `map-overlay-bg` | `map-overlay-dark` `rgba(15,23,42,.88)` | 지도 위 반투명 패널 |
| `moira-bg` `#F8FAFC` | `#0F172A` (slate-900) | 전체 배경 |
| `moira-ink` `#0F172A` | `#F1F5F9` (slate-100) | 제목·숫자 |
| `moira-border` `#E2E8F0` | `#334155` (slate-700) | 카드 테두리 |

다크모드에서 경로선 색(`fair-good/mid/bad`) 자체는 유지한다. 배경이 어두워지므로 대비 개선 효과가 있다.

---

## 6. Pre-Delivery 체크리스트

| 항목 | 규칙 | 체크 포인트 |
|------|------|-------------|
| 이모지 금지 | lucide-react 아이콘만 | `Train`, `Bus`, `Footprints`, `Car`, `MapPin`, `ArrowUp`, `ArrowDown` |
| 터치타겟 | 최소 44px | `MemberRouteChip min-h-[44px]`, 핀 드래그 영역 44×44, PlaceEditSheet 후보 행 `min-h-[52px]` |
| 라이트 대비 | 4.5:1+ | ink/body 토큰 사용. `transport-bus` 칩은 아이콘+텍스트 조합 필수 |
| 모션 대체 | reduced-motion | `useReducedMotion()` 훅 재사용, CSS `@media` 규칙 추가 |
| 색 단독 의존 금지 | 공평도·점수·교통수단 모두 텍스트/아이콘 동반 | `FairnessScoreBadge` ArrowUp/Down 필수, `TransportBadge` 아이콘 필수 |
| tabular-nums | 모든 분/점수 숫자 | `CountUp` 컴포넌트 `fontVariantNumeric: tabular-nums` 계승 |
| 가로 스크롤 없음 | 375/480px 양쪽 확인 | MemberRouteChip 탭바만 수평 스크롤 허용 (나머지 가로 스크롤 0) |
| 스파게티 방지 | 6명 이하 전체 표시, 7명+ OFF | `RouteMapCanvas` activeMembers 초기값 로직으로 제어 |
| 공평성 색 오염 금지 | `fair-*` 색은 오직 공평도만 | `score-*` 토큰은 별도 네임스페이스, 공평성 막대 영역에 score 배지 비노출 |
| Z-index 충돌 없음 | PlaceEditSheet z-50 > StickyBottomBar z-40 | 바텀시트 열릴 때 StickyBottomBar 숨김 처리 권장 |

---

## 7. 기존 컴포넌트 재사용 지점 (개발 핸드오프)

| 재사용 컴포넌트 | 파일 | 재사용 방식 |
|----------------|------|------------|
| `FairnessBars` | `src/components/moira/FairnessBars.tsx` | 드래그업 패널에 `animate={false}` prop으로 그대로 삽입 |
| `Avatar` | `src/components/moira/MemberChip.tsx` | `MemberRouteChip` 내부 + 지도 아바타 마커(CustomOverlay 래핑) |
| `CountUp` | `src/components/moira/motion.tsx` | `FairnessScoreBadge`의 점수 숫자에 재사용 |
| `useReducedMotion` | `src/components/moira/motion.tsx` | `RouteMapCanvas` 수렴 애니메이션 분기에 사용 |
| `useMounted` | `src/components/moira/motion.tsx` | `RouteMapCanvas` 진입 트리거용 |
| `StickyBottomBar` | `src/components/moira/StickyBottomBar.tsx` | RouteMap CTA 영역 그대로 사용 |
| `MoiraShell` | `src/components/moira/MoiraShell.tsx` | `step={2}` (RouteMap은 결과→경로 흐름상 2단계) |
| `FAIR_STYLE` | `src/lib/moira/fairness.ts` | 경로선 색 클래스 결정에 재사용 |
| `LINE_COLOR` | `src/components/moira/StationHero.tsx` | `TransportBadge` subway 호선 색 공유 (상수 분리 권장) |
