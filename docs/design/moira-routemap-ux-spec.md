# 모이라(Moira) RouteMap — UX 스펙

> @UX디자이너 산출물 · 2026-06-09
> 근거: `docs/planning/moira-vision-revision.md` (상위 개정, 충돌 시 우선)
> 기존 디자인 시스템: `design-system/moira/MASTER.md` + `docs/design/moira-design-final.md` **확장(덮어쓰지 않음)**
> 라우트: `/moira/routes`

---

## 1. 사용자 플로우 — RouteMap의 위치

### 개정 5화면 구조

```
[화면 1] /moira          생성/주소입력      → 멤버 최대 6명 가드
         |
         v (계산중 FairnessComputing 1.8초)
[화면 2] /moira/result   결과/추천         → 기존 화면 유지, CTA 추가
         |
         | [★경로 보기] 버튼 탭
         v
[화면 3] /moira/routes   RouteMap          ← 신설 P0 주인공 (본 스펙)
         |
         | [이 장소로 투표] CTA
         v
[화면 4] /moira/vote     카톡 무가입 투표  → 경로 토글 추가(P1)
         |
         v
[화면 5] /moira/confirm  확정              → 경로 인포그래픽 공유(P1)
```

### result ↔ routes 관계: **확장(별도 라우트, result 대체 아님)**

- `/moira/result` 는 그대로 유지. 하단 StickyBottomBar에 기존 "투표 시작" 버튼과 나란히 **"경로 보기"** 아이콘 버튼을 추가.
- `/moira/routes` 는 result 위에 레이어를 얹는 별도 라우트다. Back 시 result로 귀환.
- 이유: result의 PlaceCard + FairnessBars는 G2 핵심 증거물이므로 제거하지 않는다. RouteMap은 "지도로 더 깊이 보기" 옵션.
- Stepper 표시: RouteMap은 result와 같은 step 2 위치로 처리(별도 스텝 없음, 모달형 진입 고려 가능하나 URL 독립성 확보를 위해 별도 라우트).

### result에 추가되는 요소 (P0)

```
StickyBottomBar (기존):
  [지도 아이콘 버튼]  [이 후보들로 투표 시작  →]

StickyBottomBar (개정 P0):
  [경로 보기  지도 아이콘]  [이 후보들로 투표 시작  →]
                ↑
        router.push('/moira/routes')
```

---

## 2. 화면 와이어프레임 — /moira/routes (375px 기준)

```
┌─────────────────────────────────────┐  ← max-w-480px
│  [← 뒤로]  moira  [공유 아이콘]    │  ← 헤더 h-14, sticky
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │                               │  │
│  │       지도 영역 (65vh)        │  │  ← 카카오맵 SDK
│  │                               │  │
│  │  [A] [B] [C]  장소 선택 칩    │  │  ← 지도 위 상단 오버레이
│  │                               │  │
│  │  · 아바타 마커(출발지 N개)    │  │
│  │  · 목적지 핀(드래그 가능)     │  │
│  │  · 경로선 (색=공평도,         │  │
│  │            굵기=손해도)       │  │
│  │                               │  │
│  │  공평지수 [87]  ←→  [41]      │  │  ← 장소 수정 시 실시간 변동
│  └───────────────────────────────┘  │
│                                     │
│  ─── 멤버 탭바 ───────────────────  │  ← 수평 스크롤 탭
│  [전체]  [민호]  [서연]  [지훈]  … │
│                                     │
│  ┌───────────────────────────────┐  │  ← 드래그업 패널 (기본 32vh)
│  │  ☰  핸들                     │  │
│  │                               │  │
│  │  FairnessBars (재사용)        │  │
│  │  민호 ████████████ 22분       │  │
│  │  서연 ████████████████ 28분 ↑│  │
│  │  지훈 █████████████ 26분      │  │
│  │  예린 ██████████████ 24분     │  │
│  │                               │  │
│  │  최대 격차 6분  [가장 공평]   │  │
│  │                               │  │
│  │  멤버별 교통수단 요약 리스트  │  │
│  │  · 민호  지하철 2호선  환승0  │  │
│  │  · 서연  지하철 4→2  환승1   │  │
│  │  · 지훈  버스+지하철  환승1  │  │
│  │  · 예린  지하철 6→2  환승1   │  │
│  └───────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│  [장소 바꿔보기]  [이 장소로 투표 →]│  ← StickyBottomBar
└─────────────────────────────────────┘
```

### 지도 영역 요소 명세

| 요소 | 설명 |
|------|------|
| 멤버 아바타 마커 | 각 출발지에 Member.avatar 색 원형 + 이니셜. 크기 32×32px. |
| 목적지 핀 | brand 인디고 원형(MapPin 아이콘). 드래그 시 장소 수정 진입. |
| 경로선 | 색=공평도(fair-good/mid/bad), 굵기=손해도(오래 걸릴수록 굵게, 2px~5px). |
| 장소 선택 칩 | 지도 상단 오버레이. A안/B안/C안(공평지수 91/74/62). 탭 시 해당 후보로 핀 이동 + 공평지수 즉시 갱신. |
| 공평지수 배지 | 지도 하단 오버레이. 현재 공평지수 숫자 + 등급 칩. 장소 수정 시 애니메이션 변동. |

### 드래그업 패널 3단계

```
접힘(peek) : 핸들 + 공평지수 한 줄 노출  → 지도 95% 노출
기본       : FairnessBars + 교통수단 요약  → 지도 65% 노출 (진입 기본)
전체펼침   : 멤버별 상세 구간·환승 정보   → 지도 30% 노출
```

---

## 3. 인터랙션 명세

### 3-1. 수렴 진입 애니메이션 (바이럴 핵심)

진입 시퀀스(총 1.2초, reduced-motion 시 즉시 최종 상태):

```
t=0ms    지도 로드 완료. 모든 경로선 투명(opacity 0).
t=100ms  멤버 아바타 마커 페이드인(각 50ms 간격, stagger).
t=300ms  경로선 draw 시작: 출발지 → 목적지 방향으로 동시 그리기(stroke-dashoffset 애니메이션).
         단, 소요시간이 긴 멤버일수록 duration이 길어 마지막에 도착.
         (예: 22분=650ms, 28분=800ms, 26분=750ms, 24분=700ms)
t=완료   목적지 핀 pulsate 1회 + 하단 패널 slide-up.
         FairnessBars 막대 staggered 성장(기존 로직 재사용).
```

구현 전략:
- `stroke-dasharray` + `stroke-dashoffset` CSS 애니메이션 (SVG polyline 오버레이).
- 각 경로선의 `animation-duration`은 `minutes / maxMinutes * 500ms + 600ms` 계산.
- `prefers-reduced-motion: reduce` 시 `animation: none`, 즉시 최종 상태 표시.
- keyframe 이름: `moira-route-draw` (기존 `moira-*` 프리픽스 패턴 계승).

### 3-2. 멤버 탭 → 경로선 온디맨드 표시

```
탭: [전체] → 모든 경로선 표시(5명 이하 기본)
탭: [민호] → 민호 경로선만 full opacity(color=공평도).
              나머지 경로선 opacity 0.15 + 회색(색 의미 제거).
              하단 패널: 민호 단독 막대 확대 + 교통수단 상세.
탭: 다시 [전체] → 전체 복귀, 수렴 애니메이션 재생(단축 버전 0.5초).
```

인원별 기본 동작:
- 5명 이하: [전체] 탭 기본. 전체 경로선 동시 표시.
- 6명(B2C 상한): [전체] 탭 기본이지만 툴팁 "멤버를 탭해서 한 명씩 보기" 1회 노출.
- 7명+(B2B): [전체] 탭 시 경로선 기본 OFF + 안내 배너 "멤버를 탭해서 경로 확인". 탭 시에만 해당 경로 표시.

### 3-3. 장소 수정 → 공평성 점수 실시간 변동

진입점: StickyBottomBar의 "장소 바꿔보기" 버튼 또는 목적지 핀 드래그.

```
[장소 바꿔보기] 탭
  ↓
장소 수정 시트(bottom sheet) 슬라이드업
  ├─ A안  공평지수 91  [추천]
  ├─ B안  공평지수 74
  ├─ C안  공평지수 62
  └─ 직접 입력  (주소 검색 or 지도 핀 드래그)

후보 탭 또는 핀 드래그 시:
  ↓ 즉시(ODsay 재호출 없음, Haversine 직선거리 추정)
  지도 핀 위치 이동
  경로선 갱신 (직선 보간 → P1에서 실경로 교체)
  공평지수 배지 숫자 변동 애니메이션 ("87" → "41")
  공평도 색 전환 (good→mid→bad 또는 역방향)
  하단 FairnessBars 막대 즉시 갱신
  손해 주체 텍스트: "이 장소는 서연님이 25분 더 멀어져요 (공평지수 41)"
    → 텍스트 색: fair-bad 로즈 (손해 경고 용도, 에러 의미 아님)

[이 장소로 투표] 탭:
  → 확정 시점 ODsay 실경로 재호출 1회
  → /moira/vote 이동
```

### 3-4. N명 초대 플로우 (RouteMap 내)

RouteMap에서 "친구 추가" 진입점 (멤버 탭바 끝 [+] 버튼):

```
[+] 탭
  ↓
"친구 초대 링크 복사" 시트
  → 링크 복사 or 카톡 공유
  → 친구가 링크로 진입 → /moira?session=XXX → 자신의 출발지 입력
  → RouteMap 자동 갱신 (폴링, 웹소켓 금지)
  → 6명 초과 시도 시: "소그룹(6명)까지 무료 — 더 큰 모임은 팀 플랜" 안내
```

---

## 4. 상태 정의

### 4-1. 경로 계산중 (로딩)

```
트리거: /moira/routes 최초 진입 시 (result 데이터 재사용이므로 1초 이내 목표).

표시:
  지도 영역: 스켈레톤 shimmer (기존 Skeleton 컴포넌트 재사용)
  멤버 마커: 아바타만 표시 (경로선 없음)
  하단 패널: FairnessBars 스켈레톤
  텍스트: "경로를 그리는 중…" (h3, 모이라 muted)
  진행: indeterminate 진행바 (기존 globals.css moira-indeterminate 키프레임 재사용)

성능 목표: result 단계의 ODsay 데이터 재사용 → 추가 API 호출 0.
           데모(mock polyline) 기준 진입→완료 1초 이내.
```

### 4-2. 빈 상태 (멤버 1명, 경로 계산 불가)

```
트리거: 멤버가 본인 혼자인 경우.

표시:
  지도: 본인 마커만 + 목적지 핀
  경로선: 없음
  안내 카드(지도 위 오버레이):
    UserPlus 아이콘 + "친구를 초대해야 경로를 비교할 수 있어요"
    [카톡으로 초대하기] 버튼 (moira-kakao 배경)
```

### 4-3. 에러 (경로 데이터 없음 / API 실패)

```
트리거: ODsay/mock 데이터 로드 실패.

표시:
  지도: 아바타 마커 + 목적지 핀만 (경로선 없음)
  하단 패널 에러:
    AlertCircle 아이콘(lucide) + "경로를 불러오지 못했어요"
    [다시 시도] → 데이터 재요청
    [결과 화면으로] → /moira/result
  색: 에러 표시에 rose(fair-bad) 사용 금지 → 아이콘+카피로만 전달 (기존 ErrorState 원칙 계승)
```

### 4-4. prefers-reduced-motion 대체

```
- 수렴 진입 애니메이션: 즉시 최종 상태(경로선 완성 상태로 표시).
- 경로선 draw 애니메이션: animation: none, stroke-dashoffset: 0.
- 탭 전환 경로선 fade: opacity 트랜지션 생략, 즉시 표시/숨김.
- FairnessBars 막대 성장: 즉시 최종값 (기존 useMounted + useReducedMotion 로직 그대로).
- 공평지수 숫자 변동: 카운트업 없이 즉시 최종 숫자.
구현: globals.css @media (prefers-reduced-motion: reduce) 전역 규칙 계승.
```

---

## 5. 필요 데이터 필드

### 현재 MemberTime 구조 (기존)

```typescript
interface MemberTime {
  name: string;
  minutes: number;
  transfers?: number;   // 환승 횟수
}
```

### RouteMap을 위해 필요한 확장 필드

```typescript
// 교통 구간 단위
interface RouteSegment {
  mode: "subway" | "bus" | "walk" | "car";  // 교통수단
  line?: string;                            // 지하철 호선 또는 버스 번호 (예: "2", "143")
  durationMin: number;                      // 구간 소요시간(분)
  distanceM?: number;                       // 구간 거리(미터, 도보/차 전용)
}

// 경로 polyline 좌표
interface LatLng {
  lat: number;
  lng: number;
}

// MemberTime 확장 (RouteMap 전용)
interface MemberRoute extends MemberTime {
  // 기존 필드 계승 (minutes, transfers)
  transport: "subway" | "bus" | "walk" | "car" | "mixed"; // 주 이동수단 요약
  segments: RouteSegment[];                // 구간별 교통수단 (환승 구분)
  polyline: LatLng[];                      // 경로 좌표 배열 (카카오맵 Polyline 렌더용)
                                           // P0 데모: mock 직선 보간 2~5점
                                           // P1: ODsay 실경로 좌표
  originLatLng: LatLng;                    // 출발지 좌표 (아바타 마커 위치)
}

// 장소 후보 확장 (RouteMap 전용)
interface RoutePlace extends Place {
  destinationLatLng: LatLng;              // 목적지 좌표 (핀 위치)
  fairScore: number;                      // 공평지수 0~100 (장소 수정 실시간 표시용)
  memberRoutes: MemberRoute[];            // MemberTime 확장 (MemberRoute)
}
```

### 백엔드 → 프론트 API 계약 요점

| 필드 | 제공 주체 | 시점 | 비고 |
|------|-----------|------|------|
| `polyline` | 백엔드 (ODsay) | result 계산 시 1회 | P0: mock 직선, P1: ODsay |
| `transport`, `segments` | 백엔드 (ODsay) | result 계산 시 1회 | ODsay 대중교통 경로 파싱 |
| `originLatLng` | 프론트 (입력값) | 주소 입력 시 | 카카오 주소 → 좌표 변환 |
| `destinationLatLng` | 백엔드 | result 계산 시 | 추천 후보 좌표 |
| `fairScore` | 프론트 계산 | 장소 수정 시 | Haversine 추정, ODsay 재호출 없음 |

### P0 데모용 mock 확장 (src/lib/moira/mock.ts 추가 예정)

```typescript
// 기존 MEMBERS에 originLatLng 추가
// 기존 PLACES에 destinationLatLng, memberRoutes 추가
// polyline: 출발지~목적지 직선 2점으로 mock
```

---

## 6. 접근성

### 6-1. 색맹 대비 (색+아이콘/라벨 병행 의무)

경로선은 색(emerald/amber/rose)으로 공평도를 전달하지만, 색만으로는 구분 불가:

| 정보 | 색 | 보조 수단 |
|------|-----|-----------|
| 경로선 공평도 | fair-good/mid/bad | 하단 패널 FairnessBars 숫자 라벨(기존 원칙 계승) |
| 경로선 손해도 | 굵기 차이 | 하단 패널 "N분 더 걸림" 텍스트 + 화살표 아이콘 |
| 장소 수정 경고 | rose 텍스트 | "OO님이 25분 더 멀어져요" 카피 명시 |
| 멤버 탭 활성 | brand 인디고 underline | `aria-selected="true"` + 탭 라벨(이름) |

### 6-2. 터치 타겟

| 요소 | 최소 크기 |
|------|-----------|
| 멤버 탭 버튼 | 44×44px (좌우 패딩으로 확보) |
| 아바타 마커 (탭 가능) | 44×44px (실제 마커 32px + 투명 터치 영역 확장) |
| 목적지 핀 | 44×44px |
| 드래그업 핸들 | 44px 높이 터치 영역 |
| StickyBottomBar 버튼 | h-13 (52px), 기존 Button lg 스펙 계승 |

### 6-3. 키보드/탭 순서

```
1. 헤더: 뒤로가기 → 워드마크 → 공유
2. 지도 영역: 장소 선택 칩 A→B→C (탭 이동)
3. 목적지 핀: Enter/Space → 장소 수정 시트 진입
4. 멤버 탭바: 전체→민호→서연→… (좌우 화살표키)
5. 드래그업 패널 내: FairnessBars (읽기 전용, aria-label 포함)
6. StickyBottomBar: 장소 바꿔보기 → 이 장소로 투표
```

### 6-4. ARIA 마크업 핵심

```
지도 영역: role="img", aria-label="N명 이동 경로 지도. 민호 22분, 서연 28분, ..."
           (지도는 스크린리더에서 대체 텍스트로 요약)
멤버 탭바: role="tablist", 각 탭 role="tab", aria-selected
경로선 SVG: aria-hidden="true" (시각 장식, 텍스트로 대체)
공평지수 배지: aria-live="polite" (장소 수정 시 실시간 변동 읽기)
손해 주체 경고: aria-live="assertive" (장소 수정 → 즉시 읽기)
드래그업 패널: role="region", aria-label="이동 시간 상세"
```

### 6-5. 기타

- 폰트 크기 최소 13px(xs 토큰), 본문 대비 4.5:1+ (기존 MASTER.md §8 계승).
- `font-variant-numeric: tabular-nums` 모든 분/공평지수 숫자.
- 카카오맵 SDK 로드 실패 시: 지도 자리에 "지도를 불러오지 못했어요" + FairnessBars만 표시(막대 기반 공평성은 지도 없이도 동작).

---

## 7. 컴포넌트 재사용 계획

| 컴포넌트 | 재사용 방식 |
|----------|-------------|
| `MoiraShell` | step prop: 2로 고정. headerRight에 공유 아이콘 버튼 추가. |
| `FairnessBars` | 하단 패널 내 그대로 재사용. animate=true로 진입 시 stagger. |
| `Button` | StickyBottomBar 2개 버튼 (outline + primary). |
| `StickyBottomBar` | 그대로 재사용. |
| `Avatar` / `MemberChip` | 아바타 마커 + 멤버 탭바에 재사용. |
| `States.FairnessComputing` | 진입 로딩 화면 재사용. |
| `States.ErrorState` | 에러 상태 재사용(색 정책 동일). |
| `States.Skeleton` | 지도/패널 로딩 스켈레톤. |
| `CountUp` / `useReducedMotion` | 공평지수 숫자 변동 애니메이션. |

### 신규 컴포넌트 (이번 화면에서 신설 필요)

| 컴포넌트 | 역할 |
|----------|------|
| `RouteMap` (지도 컨테이너) | 카카오맵 SDK 래퍼. polyline SVG 오버레이 관리. |
| `MemberTabBar` | 수평 스크롤 탭. 전체/멤버 탭 전환. |
| `RouteDrawOverlay` | SVG polyline + stroke-dashoffset 애니메이션 레이어. |
| `FairnessScoreBadge` | 지도 위 공평지수 배지. aria-live 포함. |
| `PlacePickerSheet` | 장소 수정 bottom sheet. A/B/C 순위 선택지 + 직접 입력. |
| `MemberRouteDetail` | 드래그업 패널 내 멤버별 교통수단+구간 리스트. |
| `DragHandle` | 패널 핸들 + gesture 처리. |

---

## 8. 인터랙션 노트 — 기타

### 공유 (바이럴)

헤더 우측 공유 아이콘:
```
탭 → 공유 시트
  ├─ [카톡으로 공유]  → og:image 경로 인포그래픽 (P1)
  │                       현재(P0): URL 공유
  └─ [링크 복사]      → 세션 URL 클립보드
```

og:image 내용(P1): "우리 N명 이렇게 모여요" + 경로 미니 지도 + 멤버별 시간.

### 뒤로가기 동작

- 헤더 뒤로가기 버튼: `router.back()` → /moira/result.
- Android 하드웨어 백버튼: 동일.

### 가로 스크롤 방지

멤버 탭바가 6명으로 길어질 경우, `-webkit-overflow-scrolling: touch` + `overflow-x: auto` + 스크롤바 hidden. 탭 활성 항목은 자동 scroll-into-view.
