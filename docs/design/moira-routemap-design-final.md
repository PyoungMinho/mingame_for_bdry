# 모이라(Moira) RouteMap — 디자인 최종안 (확정)

> @디자인팀장 종합·확정 · 2026-06-09
> 종합 대상: `docs/design/moira-routemap-ux-spec.md`(UX) + `docs/design/moira-routemap-ui-spec.md`(UI)
> 상위 근거(충돌 시 우선): `docs/planning/moira-vision-revision.md` §3·§5·§6
> 확장 대상(덮어쓰지 않음): `design-system/moira/MASTER.md`, `docs/design/moira-design-final.md`
> **본 문서는 RouteMap(`/moira/routes`) 전용 신규 확정본이다. 기존 `moira-design-final.md`는 보존된다.**
> 충돌 발생 시 본 문서가 두 팀원 스펙을 **단일안으로 override** 한다. (결정 로그 §6)

---

## 1. 확정 요약 (1페이지)

**라우트**: `/moira/routes` — **별도 라우트로 확정**(result 대체 아님, result 위 레이어). Back → `/moira/result`. Stepper는 `step={2}`로 고정(result와 동일 단계, 별도 스텝 신설 금지). result `StickyBottomBar`에 outline "경로 보기"(지도 아이콘) 버튼을 primary "투표 시작" 좌측에 추가 → `router.push('/moira/routes')`.

**레이아웃 (100dvh, max-w-480, 모바일 우선)**:
```
[z-30] MoiraShell 헤더 (sticky h-14): ← 뒤로 · moira · 공유아이콘
[z-0]  카카오맵 SDK 레이어  ┐
[z-10] SVG polyline 오버레이 ├ 지도 영역 = 62vh (확정값, §6-C)
[z-20] 아바타 마커 · 목적지 핀┘   └ 상단오버레이: 장소칩 A/B/C · 하단오버레이: FairnessScoreBadge
[z-30] MemberRouteChip 탭바 (수평 스크롤, 최대 6칩 + [+])
[z-40] 드래그업 패널 (3단: peek/기본/전체) · FairnessBars + MemberRouteDetail
[z-40] StickyBottomBar: [장소 바꿔보기(outline)] [이 장소로 투표 →(primary)]
[z-50] PlaceEditSheet (조건부 바텀시트 — 열릴 때 StickyBottomBar 숨김)
```

**핵심 인터랙션 (불변 규칙 반영)**:
1. **수렴 진입 애니메이션** — 경로선이 출발지→목적지로 동시에 그려지되, 오래 걸리는 멤버 선이 마지막 도착. `stroke-dashoffset` 기반. `prefers-reduced-motion` 시 즉시 최종 상태.
2. **스파게티 방지** — 기본 막대(FairnessBars) + 경로선 온디맨드(멤버 탭). **5명↓ 전체 동시 / 6명 동시+탭강조 툴팁 1회 / 7명+(B2B) 경로선 기본 OFF + 탭 전용**. `RouteMapCanvas.activeMembers` 초기값으로 제어.
3. **장소 수정 → 공평성 점수 실시간 표시(의무)** — 핀 드래그/후보 탭 시 Haversine 추정으로 즉시 `87→41` 변동(ODsay 재호출 0). FairnessBars·경로선·`FairnessScoreBadge` 동시 갱신 + 손해 주체 카피. **확정("이 장소로 투표") 시점에만 ODsay 실경로 1회 재호출**.
4. **광고 금지** — RouteMap 화면 전 영역 광고 배치 금지(불변, vision §4·§5-1).

---

## 2. 컴포넌트 명세 표

### 2-1. 신규 컴포넌트 (5종 확정 — 명칭 단일화)

> UX 7종 / UI 5종 명칭 불일치를 **5종으로 통합**(아래 §6-A 결정 로그). `RouteDrawOverlay`·`DragHandle`은 독립 컴포넌트가 아니라 `RouteMapCanvas` 내부 구현으로 흡수.

| 이름 (확정) | 역할 | 재사용? | props 핵심 |
|---|---|---|---|
| `RouteMapCanvas` | 카카오맵 SDK 래퍼 + SVG polyline 오버레이 + 아바타 마커/핀 + 수렴 애니메이션. (UX의 `RouteMap`·`RouteDrawOverlay`·`DragHandle` 흡수) | 신규 | `members: MemberRoute[]`, `destination: LatLng`, `activeMembers: string[]`(빈배열=전체), `fairGap: number`, `draggablePin?`, `onPinDrag?(c)`, `animateOnMount?`, `className?` |
| `MemberRouteChip` | 멤버 탭바 칩. 탭 토글로 경로 강조/흐림. (UX `MemberTabBar`와 동일물 → UI 명칭 채택) | `MemberChip`/`Avatar` 확장 | `memberId`, `name`, `avatar`, `minutes`, `mode`, `active`, `onToggle(id)` |
| `TransportBadge` | 교통수단 아이콘+색 칩 (`Train/Bus/Footprints/Car`). | 신규 | `mode`, `line?`(subway만), `size?: 'sm'|'md'` |
| `FairnessScoreBadge` | 장소 수정 시 점수 실시간 변동 배지(ArrowUp/Down 필수). 공평성 막대와 **별도 영역**. | `CountUp` 재사용 | `prev: number`, `current: number`, `animated?` |
| `PlaceEditSheet` | 장소 수정 바텀시트. A/B/C 순위 선택지 + 직접 입력. (UX `PlacePickerSheet` → UI 명칭 채택) | `StickyBottomBar` 패턴 | `candidates: PlaceCandidate[]`, `currentScore`, `onSelect(c)`, `onCustomPin()`, `isOpen`, `onClose()` |

**보조 표시 컴포넌트** `MemberRouteDetail`(드래그업 패널 내 멤버별 교통수단·구간 리스트)는 신규 컴포넌트가 아니라 **`routes/page.tsx` 내 섹션 렌더 + `TransportBadge` 조합**으로 구현(독립 export 불필요). 패널 핸들은 `RouteMapCanvas` 외부, `routes/page.tsx`가 보유.

### 2-2. 재사용 컴포넌트 (기존 `src/components/moira/`)

| 컴포넌트 | 파일 | 재사용 방식 |
|---|---|---|
| `MoiraShell` | `MoiraShell.tsx` | `step={2}` 고정. `headerRight`에 공유 아이콘 버튼 추가. |
| `FairnessBars` | `FairnessBars.tsx` | 드래그업 패널에 그대로. 진입 시 `animate` on(stagger), 탭 단독 보기 시 해당 멤버 확대. |
| `Avatar` | `MemberChip.tsx` (`export Avatar`) | 지도 아바타 마커(CustomOverlay 래핑) + `MemberRouteChip` 내부. |
| `Button` | `Button.tsx` | StickyBottomBar 2버튼(outline + primary), PlaceEditSheet 액션. |
| `StickyBottomBar` | `StickyBottomBar.tsx` | RouteMap CTA 영역 그대로. PlaceEditSheet 열릴 때 숨김. |
| `States.FairnessComputing` | `States.tsx` | 진입 로딩(단, 목표 ≤1초 — §6-D). |
| `States.ErrorState` | `States.tsx` | 에러 상태(색 정책 동일: rose를 의미로 쓰지 않음). |
| `States.Skeleton` | `States.tsx` | 지도/패널 로딩 스켈레톤. |
| `CountUp`·`useReducedMotion`·`useMounted` | `motion.tsx` | 점수 변동 + 수렴 애니메이션 분기 + 진입 트리거. |
| `FAIR_STYLE`·`fairLevel`·`gapOf` | `lib/moira/fairness.ts` | 경로선 색 클래스 결정(`good/mid/bad` → `bar/text/ring`). |
| `LINE_COLOR` | `StationHero.tsx` (현재 **미export**) | `TransportBadge` subway 호선 색. **P0 선결: `lib/moira/transit.ts`로 상수 분리·export 후 양쪽 import**(§7). |

---

## 3. 신규 디자인 토큰 (가산 — 기존 `moira.*` 충돌 0 확인)

> `tailwind.config.ts`의 기존 `moira.*` 16키(brand·fair-*·track·kakao·bg·surface·border·ink·body·muted)와 **키 중복 없음 확정**(아래 prefix는 전부 신규). 기존 값 변경 금지.

```ts
// tailwind.config.ts → theme.extend.colors.moira 에 가산
// ── 경로선(굵기=손해도, 색은 fair-* 재사용하므로 색 토큰 추가 없음) ──
"route-weight-low":  "3",   // 최소 이동시간 멤버 (px, SVG stroke-width)
"route-weight-mid":  "5",
"route-weight-high": "8",   // 최대 손해 멤버
"route-dim":         "0.22",// 탭 미선택 경로선 opacity
"route-active":      "1",
"route-dash-walk":   "4 6",
"route-dash-bus":    "12 4",
"route-dash-subway": "none",
"route-dash-car":    "none",
// ── 교통수단 색 (공평성 색과 hue 분리, 항상 아이콘 동반) ──
"transport-subway": "#0052A4",  // LINE_COLOR 참조 기준색
"transport-bus":    "#F97316",  // amber(#F59E0B)와 hue ≥18° 차이
"transport-walk":   "#64748B",
"transport-car":    "#6366F1",  // brand와 유사 → 항상 Car 아이콘
"transport-bus-tint":  "#FFF7ED",
"transport-walk-tint": "#F1F5F9",
"transport-car-tint":  "#EEF2FF",
// ── 지도 오버레이 ──
"map-overlay-bg":   "rgba(248,250,252,0.92)",
"map-overlay-dark": "rgba(15,23,42,0.88)",   // P2 다크 예약
"map-marker-ring":  "#FFFFFF",
// ── 점수 변동 배지 (공평성 fair-* 와 별 네임스페이스, 항상 ArrowUp/Down 동반) ──
"score-up":        "#059669",
"score-up-tint":   "#D1FAE5",
"score-down":      "#DC2626",
"score-down-tint": "#FEE2E2",
"score-neutral":   "#475569",  // = moira-body 재사용값
```
- **그림자**(색 토큰 아님)는 boxShadow 또는 인라인 처리: `map-pin-shadow = 0 4px 10px rgba(79,70,229,.40)`.
- **공평성 색 오염 방지(불변)**: `score-up #059669`와 `fair-good #10B981`은 둘 다 녹색 → 구분은 **항상 라벨**(fair-good="격차 N분", score-up="ArrowUp+점수"). `score-*` 배지는 FairnessBars와 **같은 영역에 배치 금지**(`FairnessScoreBadge`로 캡슐화).

**키프레임**(globals.css 가산, `moira-` prefix 계승): `moira-route-draw`(stroke-dashoffset). `prefers-reduced-motion` 전역 규칙 아래에 `.route-polyline{stroke-dashoffset:0!important;animation:none!important}` · `.route-marker{opacity:1!important;transform:none!important}` 추가.

---

## 4. 데이터 계약 (프론트·백엔드 수령) — **단일 `MemberRoute` 확정**

> UX(`extends MemberTime`, `name/minutes/transfers/transport/segments/polyline/originLatLng`)와 UI(flat `id/name/avatar/origin/polyline/minutes/mode`)의 두 정의를 **하나로 병합**(§6-B). 결과: **id·avatar 추가 + MemberTime 계승 + 좌표/구간 포함**.

```typescript
interface LatLng { lat: number; lng: number; }

interface RouteSegment {
  mode: "subway" | "bus" | "walk" | "car";
  line?: string;          // 호선/버스번호 (예: "2", "143")
  durationMin: number;
  distanceM?: number;     // 도보/차 구간
}

// ── 확정 단일 타입 (lib/moira/route.ts 신설) ──
interface MemberRoute extends MemberTime {   // MemberTime: { name, minutes, transfers? }
  id: string;                                // ★ UI 요구 — 탭 키·activeMembers 식별자
  avatar: string;                            // ★ UI 요구 — Avatar 색(hex). 기존 Member.avatar와 동일 소스
  transport: "subway" | "bus" | "walk" | "car" | "mixed"; // 주 이동수단 요약(칩 표기)
  mode: "subway" | "bus" | "walk" | "car";   // ★ 경로선 대시패턴 결정용(mixed면 최장구간 mode)
  segments: RouteSegment[];                  // 구간별(환승 구분) — MemberRouteDetail 렌더
  polyline: LatLng[];                        // P0: mock 직선 보간 2점 / P1: ODsay 실경로 다점
  originLatLng: LatLng;                       // 출발지 좌표(아바타 마커 위치)
}

interface RoutePlace extends Place {
  destinationLatLng: LatLng;
  fairScore: number;          // 0~100 (장소 수정 실시간 표시)
  memberRoutes: MemberRoute[];
}
```
> `transport`(요약 라벨, "mixed" 허용) vs `mode`(경로선 대시패턴, 단일값) **둘 다 보존** — 역할이 다름. `mixed`일 때 `mode`는 segments 중 최장 구간 mode로 백엔드가 산출해 전달.

**제공 주체·시점**

| 필드 | 제공 | 시점 | 비고 |
|---|---|---|---|
| `polyline` | 백엔드(ODsay) | result 계산 1회 | P0 mock 직선 / P1 ODsay |
| `transport`·`mode`·`segments` | 백엔드(ODsay) | result 계산 1회 | 대중교통 경로 파싱 |
| `id`·`avatar`·`originLatLng` | 프론트(입력값) | 주소 입력 시 | 카카오 주소→좌표, avatar는 기존 Member.avatar 계승 |
| `destinationLatLng`·`fairScore`(초기) | 백엔드 | result 계산 시 | 추천 후보 좌표·점수 |
| `fairScore`(수정 중) | 프론트 계산 | 장소 수정 시 | Haversine 추정, **ODsay 재호출 0** |

---

## 5. 단계 분리 (P0 데모 / P1 실경로)

### P0 — 데모(mock 좌표) · G2 검증용 라이브 빌드
- `RouteMapCanvas`(카카오맵 + SVG polyline) + 아바타 마커 + 목적지 핀.
- **수렴 진입 애니메이션**(stroke-dashoffset, 늦는 멤버 마지막 도착) + reduced-motion 대체.
- `MemberRouteChip` 탭바 + 온디맨드 표시(5↓/6/7+ 정책).
- **장소 수정 + 공평성 점수 실시간 표시**(`PlaceEditSheet` + `FairnessScoreBadge`, Haversine, ODsay 0).
- result `StickyBottomBar`에 "경로 보기" CTA.
- `mock.ts` 확장: 기존 `MEMBERS`에 `originLatLng`/`id`(존재)·`PLACES`에 `destinationLatLng`·`memberRoutes`·`polyline`(직선 2점) 추가.
- 신규 토큰·키프레임 등록. `LINE_COLOR` → `lib/moira/transit.ts` 분리.

### P1 — 깊이/실경로
- **ODsay 실경로 polyline**으로 mock 교체(확정 시점 1회 호출). `transport`/`segments` 실데이터.
- 투표 화면 경로 토글, 확정 카톡 경로 인포그래픽(og:image), 공유 시트 og:image.

### P2 (예약)
- 다크모드 토큰 매핑 적용(현재 라이트 단일). 손해 멤버 보상 넛지.

---

## 6. 충돌 해소 결정 로그

| # | 사안 | UX 안 | UI 안 | **팀장 확정** |
|---|---|---|---|---|
| A | 신규 컴포넌트 개수·명칭 | 7종(`RouteMap`/`MemberTabBar`/`RouteDrawOverlay`/`FairnessScoreBadge`/`PlacePickerSheet`/`MemberRouteDetail`/`DragHandle`) | 5종(`RouteMapCanvas`/`MemberRouteChip`/`TransportBadge`/`FairnessScoreBadge`/`PlaceEditSheet`) | **신규 5종**(UI 기준). `RouteDrawOverlay`·`DragHandle`→`RouteMapCanvas` 내부 흡수, `MemberRouteDetail`→page 섹션, `TransportBadge`는 UX 누락분 채택. 명칭은 UI(`RouteMapCanvas`/`MemberRouteChip`/`PlaceEditSheet`)로 통일. |
| B | `MemberRoute` 타입 정의 | `extends MemberTime` + name/transport/segments/polyline/originLatLng (id·avatar 없음) | flat id/name/avatar/origin/polyline/minutes/mode (segments·transport 없음) | **병합 단일안**(§4): `extends MemberTime` + **id·avatar 추가**(UI 요구) + segments·originLatLng(UX 요구) + transport와 mode **둘 다 보존**(역할 분리). `lib/moira/route.ts` 신설. |
| C | 지도 높이 | "65vh"(와이어), "60~65%"(상태) | "60~65%" | **62vh 단일 확정**(peek 시 95%, 전체펼침 시 30%는 드래그 패널 동작값으로 유지). |
| D | 진입 로딩 컴포넌트 | `FairnessComputing` 재사용 + "경로 그리는 중" | (명시 없음) | **`FairnessComputing` 재사용**하되 **목표 ≤1초**(result ODsay 데이터 재사용, 추가 호출 0). 1.8초 고정 연출 금지 — 데이터 준비되면 즉시 해제. |
| E | 드래그업 패널 단수 | 3단(peek/기본/전체) | 기본 200px·최대 70% | **3단 채택**(UX). 수치 매핑: peek=핸들+점수 1줄(지도 95%) / 기본=지도 62vh / 전체=지도 30%. UI의 z-40·핸들 토큰 계승. |
| F | z-index | (미정의) | 0/10/20/30/40/50 6단 | **UI 스케일 채택**. PlaceEditSheet z-50 > StickyBottomBar z-40, 시트 열림 시 BottomBar 숨김. |
| G | 점수 배지 색 vs 공평성 색 혼동 | rose 텍스트는 "손해 경고"(에러 아님) 명시 | `score-*` 별 네임스페이스 + ArrowUp/Down 의무 | **둘 다 채택**: 경로선/막대 색=`fair-*`(공평도 전용), 점수 변동=`score-*`(항상 화살표 아이콘), 손해 카피 텍스트는 `fair-bad` 사용 가능하나 **에러 의미로는 rose 금지**(ErrorState 원칙 계승). `FairnessScoreBadge`는 FairnessBars와 다른 영역. |
| H | 라우트 형태 | 별도 라우트(`/moira/routes`, 모달 아님) | 100dvh 전체 화면 | **별도 라우트 확정**(URL 독립성·공유·Back 일관성). Stepper `step={2}` 공유, 신규 스텝 없음. |
| I | 경로선 색 클래스 출처 | "fair-good/mid/bad" | `FAIR_STYLE` 재사용 | **`FAIR_STYLE[fairLevel(gap)].bar`** 재사용(`lib/moira/fairness.ts`, `good/mid/bad` 키 확인됨). 신규 색 토큰 추가 없음. |

---

## 7. 개발 착수 전 체크리스트 (프론트·백엔드 핸드오프)

**선결(P0 시작 전)**
- [ ] `lib/moira/transit.ts` 신설 → `LINE_COLOR` 상수를 `StationHero.tsx`에서 분리·export, 양쪽 import로 교체(현재 미export, 중복 정의 방지).
- [ ] `lib/moira/route.ts` 신설 → `LatLng`·`RouteSegment`·`MemberRoute`·`RoutePlace` 타입 단일 정의(§4).
- [ ] `tailwind.config.ts` `moira.*`에 §3 신규 토큰 가산(기존 16키 무변경 확인됨).
- [ ] `globals.css`에 `moira-route-draw` 키프레임 + `prefers-reduced-motion` 경로선/마커 정지 규칙 추가.

**데이터·계약**
- [ ] `mock.ts`: `MEMBERS`에 `originLatLng` 추가(`id`는 기존 보유), `PLACES`에 `destinationLatLng`·`fairScore`·`memberRoutes`(polyline 직선 2점) 추가.
- [ ] 백엔드: result 계산 응답에 `polyline`·`transport`·`mode`·`segments`·`destinationLatLng` 포함(P0 mock 형상과 동일 스키마). **`mixed`일 때 `mode`=최장구간 mode 산출 규칙** 합의.
- [ ] 장소 수정 중 점수 = 프론트 Haversine, **ODsay 재호출 0**. 확정 시점 1회만 ODsay.

**불변 규칙 검수**
- [ ] 색=오직 공평도(`fair-*`), 점수 변동=`score-*`+화살표, 교통수단=`transport-*`+아이콘 — 색 단독 의존 0.
- [ ] 스파게티 방지: `activeMembers` 초기값이 5↓ 전체 / 7+ OFF로 분기.
- [ ] 장소 수정 시 `FairnessScoreBadge` `aria-live="polite"` + 손해 주체 카피 `aria-live="assertive"`.
- [ ] B2C 6명 캡: `[+]` 7번째 초대 시도 시 "소그룹(6명)까지 무료 — 더 큰 모임은 팀 플랜".
- [ ] **RouteMap 전 영역 광고 0**(vision §4·§5-1 불변).
- [ ] `prefers-reduced-motion`: 경로선 즉시 완성·마커 즉시·CountUp 즉시값(`useReducedMotion` 재사용).

**품질**
- [ ] 이모지 0 / lucide만(`Train`·`Bus`·`Footprints`·`Car`·`MapPin`·`ArrowUp`·`ArrowDown`·`UserPlus`·`AlertCircle`).
- [ ] 터치타겟 ≥44px(`MemberRouteChip min-h-[44px]`, 핀/마커 44×44 투명영역, PlaceEditSheet 행 ≥52px).
- [ ] 375/480px 가로 스크롤 0(멤버 탭바만 수평 스크롤 + 활성 scroll-into-view).
- [ ] 버스 칩 대비 3.2:1 미달 → 아이콘+"버스" 텍스트 동반 필수(색 단독 금지).
- [ ] 카카오맵 SDK 로드 실패 시 지도 자리 대체 카피 + FairnessBars 단독 동작(막대 기반 공평성은 지도 없이도 성립).
