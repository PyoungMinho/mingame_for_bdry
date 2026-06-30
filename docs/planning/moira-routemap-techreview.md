# 모이라(Moira) RouteMap — 기술 방향서 (팀장 회의 종합·확정)

> @기획팀장 최종 종합 · 2026-06-09
> 종합 대상: 프론트팀장(난이도 상) + 백엔드팀장(난이도 중상) + 디자인팀장(관리가능·블로커 1건) RouteMap 기술 검토
> 상위 근거(충돌 시 우선): `docs/planning/moira-vision-revision.md` §5·§6·§7, `docs/design/moira-routemap-design-final.md`
> **본 문서는 RouteMap 기술 방향 신규 확정본이다. 위 두 문서는 보존되며, 본 문서가 충돌 시 "기술 구현 방향"에 한해 override 한다.**
> 디자인 마지노선(§6)은 본 문서가 절대 override 하지 않는다 — 기술 타협은 마지노선 안에서만 한다.

---

## 0. CEO가 먼저 읽을 박스 (PM 액션 요약)

| # | 사안 | 기획팀장 판정 | CEO 액션 |
|---|---|---|---|
| **A** | **종합 GO/NO-GO** | ✅ **조건부 GO** — P0 데모 착수 승인. 조건: §2 선결 4건 + 스펙 정정 3종 반영 | 승인만 (착수 진행) |
| **B** | **ODsay "0 호출" 논쟁** | ✅ **자체 판정 완료** — passStopList 역좌표 꺾은선 타협안 공식 채택. "0 호출" 원칙 유지됨 | 검토만 |
| **C** | **좌표 파기 cron P1 필수 격상** | ✅ **확정** — originLatLng가 응답에 노출되므로 확정 즉시 파기 cron을 P1 출시 필수 게이트로 격상 | 검토만 (프라이버시 자산이므로 강력 권고) |
| **D** | **P0 데모 일정** | ✅ **4~5 영업일**(프론트 기준). G2 라이브 도구로 일주일 내 가능 | 일정 승인 |
| **E** | **B2B polyline/segments DB 컬럼·OSRM 방어선 착수 시점** | ⏳ **CEO 판단 요청** — 수익 옵션 C 결정됨에 따라 B2B용 데이터 보강(JSONB 컬럼)을 P0와 병행할지, P1로 미룰지 | **결정 요청** (§7 PM 액션) |

> **핵심 한 줄**: 디자인 스펙은 "표현"으로는 완성됐으나 프론트 인프라 갭(지도 SDK 0개·좌표 0개)이 P0를 스펙보다 어렵게 만든다. 그러나 회피 설계(P0 지도 잠금·꺾은선 polyline·곡선 베지어)로 **마지노선을 지키면서 4~5일 데모는 GO**다.

---

## 1. 종합 판정 + 난이도 요약

### 1-1. 최종 판정: ✅ **조건부 GO (P0 데모)**

세 팀장의 난이도 평가(상·중상·관리가능)는 **서로 모순되지 않는다.** 각자가 본 난이도의 출처가 다르기 때문이다:
- **프론트 "상"** = P0 진입 인프라 갭(지도 SDK 미로딩·framer-motion 미설치·mock 좌표 전무). → **선결 작업으로 해소 가능한 일회성 비용.**
- **백엔드 "중상"** = P0는 하(기존 5테이블·토큰·폴링·fairness 거의 수용), 난이도는 **P1 ODsay polyline 단 한 곳**에 집중. → P0를 막지 않음.
- **디자인 "관리가능"** = 리스크는 완화책 있음, 단 **P0 직선 곡선화 1건만 블로커**. → 스펙 정정으로 해소.

→ **세 평가를 합치면: P0 데모는 선결 4건 + 스펙 정정 3종을 마치면 GO. 진짜 난이도(ODsay 실경로)는 P1로 격리되어 데모를 막지 않는다.**

### 1-2. 난이도 한눈 표

| 범위 | 프론트 | 백엔드 | 디자인 | 종합 |
|---|---|---|---|---|
| **P0 (mock 직선→곡선)** | 상(인프라 갭) | 하(데이터계약 수용) | 관리가능(블로커=곡선화) | **중**(선결 해소 후 하향) |
| **P1 (ODsay 실경로)** | 중(좌표동기화·인터랙티브) | **중상(polyline=난이도 핵심)** | 관리가능 | **중상** |
| **마지노선 준수** | 준수 가능 | 준수 가능 | 절대불변 4종 | **준수** |

---

## 2. 핵심 논쟁 해소 (3건)

### 2-1. 논쟁 ① "ODsay 추가 호출 0" — **백엔드 사실 채택, passStopList 꺾은선 공식 채택**

**대립**:
- **디자인/vision 주장**(vision §5-1, design §6-D): "RouteMap은 result 단계 ODsay 데이터 재사용 → 추가 호출 0."
- **백엔드 반박(사실)**: searchPubTransPathT는 시간·환승·mapObj만 반환. **실제 좌표열(lane/graphPos)은 mapObj로 "노선 그래픽 데이터" API를 한 번 더 호출해야 나옴.** 즉 "시간/환승/점수 0호출"은 참이나 "**부드러운 실경로 polyline 좌표 0호출**"은 거짓.

**기획팀장 판정**: **"ODsay 0 호출"은 부분적으로만 참** — 백엔드 사실관계를 채택한다. 그러나 **디자인 의도(추가 호출 0으로 비용·G3 방어)는 타협안으로 100% 보존 가능**하다.

**✅ 공식 채택 타협안 (3단계)**:
1. **P0 / G2**: mock 직선 → **곡선 베지어로 휜다**(디자인 블로커 해소 겸). ODsay 호출 0(데모는 좌표 자체가 mock).
2. **P1 기본**: polyline = **passStopList 정류장 좌표 꺾은선** — 이미 result 응답에 있는 정류장 좌표를 이어서 그린다. **그래픽 API 미사용 = 추가 호출 0 유지.** ← **이것이 공식 P1 방식.**
3. **P1 예외(품질 부족 시만)**: 꺾은선 곡선 품질이 G2/사용자 체감에 부족할 때만, **확정된 1개 후보에 한해** 그래픽 데이터 1회 호출(후보 5개 전체 호출 절대 금지).

> **결론**: vision §5-1·design §6-D의 "ODsay 추가 호출 0" 문구는 **"시간/환승/점수 재사용 0호출 + P1 polyline=passStopList 꺾은선(그래픽 API 미사용)으로 0호출 유지"**로 정정한다. 디자인의 비용 방어 의도는 지켜지고, 백엔드의 사실관계도 반영된다.

### 2-2. 논쟁 ② 스펙 정정 3종 — **전부 반영**

| 정정 | 출처 | 판정 | 반영 위치 |
|---|---|---|---|
| **(가) route-dash / route-weight를 색 토큰에서 분리** | 프론트(Tailwind 색 유틸 충돌) | ✅ **반영** | design §3의 `route-weight-*`·`route-dash-*`·`route-dim`·`route-active`를 `theme.extend.colors.moira`에서 제거. **인라인 `style`(stroke-width/stroke-dasharray/opacity) 또는 `lib/moira/route.ts` 별도 상수**로 분리. 색 토큰(`transport-*`·`score-*`·`map-*`)만 colors에 잔류. |
| **(나) P0 지도 pan/zoom 잠금** | 프론트(좌표동기화 회피) | ✅ **반영** | design §1·§5 P0에 "**P0는 지도 드래그/줌 잠금 — 핀 드래그만 허용**" 명시. 인터랙티브 지도(pan/zoom↔SVG 좌표동기화)는 **P1로 격리**. |
| **(다) P0 직선 → 곡선 베지어** | 디자인(유일 블로커) | ✅ **반영** | vision §5-1·§6 P0·design §5 P0의 "직선 보간 2점"을 "**2차 베지어 곡선(휜 선)**"으로 정정. P0↔P1 시각격차 완화 + G2 추천품질 평가 왜곡 방지. mock polyline은 시작·끝·제어점 3점 보간. |

> **추가 데이터계약 보강(백엔드 요청, 반영)**: `RouteSegment`에 `fromLatLng`/`toLatLng` 추가, `polyline` 비고에 "**P1=passStopList 역좌표 꺾은선**" 명기, `mode` 산출(mixed→최장구간)=**백엔드 단일책임** 확정, `fairScore` 주석에 "**수정 중=Haversine 추정 / 확정 시 1회 ODsay 리컨실(값 점프 정상)**" 추가.

### 2-3. 논쟁 ③ 좌표(PII) 노출 vs "좌표 미노출" 원칙 — **한정 노출 + 파기 cron P1 필수**

**대립**: RouteMap은 `originLatLng`(집주소급 PII)를 응답에 내려야 경로선을 그린다 → vision §2-4 "좌표 미노출·확정 후 파기" 원칙과 충돌.

**판정 (백엔드 완화책 채택)**:
1. `originLatLng`/polyline 노출은 **`/routes` 응답에 한정** + **token 인증 필수**(기존 inviteToken `?t=` 재사용, 신규 권한모델 불필요).
2. **확정 시 즉시 파기 cron을 P1 출시 필수 게이트로 격상**(백엔드 요청 채택). vision §2-4가 이를 마케팅 자산으로 승격했으므로, **파기 cron 없이는 P1 출시 불가**.
3. polyline **5~6점 다운샘플**(집 앞 정밀좌표 노출 최소화).

---

## 3. 통합 선결 작업 체크리스트 (담당팀·우선순위)

> P0 착수 전 반드시 완료. **P0-1~P0-4 = 블로커(이거 없으면 P0 시작 불가)**.

### 🔴 P0 선결 (블로커)

| 순위 | 작업 | 담당 | 산출물 | 의존 |
|---|---|---|---|---|
| **P0-1** | **카카오맵 JS SDK 스크립트 로더 신설** — 현재 어디에도 로딩 안 됨(REST 지오코딩만 서버사이드). **앱키 도메인 등록 필요(CEO/인프라 액션)**. 로드 실패 시 FairnessBars 단독 폴백(design §7). | 프론트 | SDK 로더 + 폴백 | **앱키 도메인 등록(외부 의존)** |
| **P0-2** | **`lib/moira/transit.ts` 신설** + `LINE_COLOR` 상수를 `StationHero.tsx`에서 분리·export(현재 미export), 양쪽 import 교체. | 프론트 | `lib/moira/transit.ts` | 없음 |
| **P0-3** | **`lib/moira/route.ts` 신설** — `LatLng`·`RouteSegment`(+`fromLatLng`/`toLatLng`)·`MemberRoute`·`RoutePlace` 타입 단일 정의 + **route-weight/dash/dim/active 상수**(색 토큰 아님, 여기로 이전). | 프론트+백엔드(계약 합의) | `lib/moira/route.ts` | 2-2(가) 정정 |
| **P0-4** | **mock 좌표 추가** — `MEMBERS`에 `originLatLng`, `PLACES`에 `destinationLatLng`·`fairScore`·`memberRoutes`(**곡선 베지어 3점** polyline). 현재 mock에 lat/lng 전무. | 프론트 | `mock.ts` 확장 | 2-2(다) 곡선화 |

### 🟡 P0 선결 (병행 가능)

| 순위 | 작업 | 담당 |
|---|---|---|
| P0-5 | `tailwind.config.ts` `moira.*`에 §3 **색 토큰만** 가산(route-weight/dash 제외 — 2-2가). 기존 16키 무변경. | 프론트 |
| P0-6 | `globals.css`: `moira-route-draw` 키프레임 + **CSS @keyframes+will-change(컴포지터 위임, JS rAF 금지)** + 80ms stagger + `prefers-reduced-motion` 경로선/마커 정지 규칙. | 프론트 |
| P0-7 | result 데이터계약: P0 mock과 **동일 스키마**로 `polyline`·`transport`·`mode`·`segments`·`destinationLatLng` 형상 합의. `mode`(mixed→최장구간)=백엔드 단일책임. | 백엔드 |
| P0-8 | B2C 6인 캡: `/members POST` count≥6 거부(백엔드) + `[+]` 7번째 시도 시 팀플랜 안내(프론트). | 백엔드+프론트 |

### 🟢 P1 선결 (P0 데모와 병행 가능, 단 P1 출시 전 필수)

| 순위 | 작업 | 담당 |
|---|---|---|
| P1-1 | **좌표 파기 cron** — 확정 시 originLatLng/polyline 즉시 파기. **P1 출시 필수 게이트(격상)**. | 백엔드+DB |
| P1-2 | `moira_candidate_times`에 `polyline`/`segments` **JSONB 컬럼 신설**. (CEO §7-E 결정 따라 P0 병행 or P1) | DB |
| P1-3 | ODsay polyline = passStopList 역좌표 꺾은선 구현(추가 호출 0). 품질 부족 시만 확정 후보 1개 그래픽 호출. | 백엔드 |

---

## 4. P0 데모 범위·일정 + G2 연결

### 4-1. P0 데모 범위 (확정)

**포함**:
- `RouteMapCanvas`(카카오맵 SDK + SVG **곡선 베지어** 오버레이) + 아바타 마커 + 목적지 핀(드래그만, **지도 pan/zoom 잠금**).
- **수렴 진입 애니메이션**(CSS @keyframes stroke-dashoffset, will-change 컴포지터 위임, 80ms stagger, 늦는 멤버 마지막 도착) + reduced-motion 시 staggered fade-in(150ms opacity)+도착순 숫자배지.
- `MemberRouteChip` 탭바 + 온디맨드(5↓ 전체 / 6 동시+탭강조 / 7+(B2B) OFF).
- **장소 수정 + 공평성 점수 실시간 표시**(`PlaceEditSheet`+`FairnessScoreBadge`, Haversine, ODsay 0).
- result `StickyBottomBar`에 "경로 보기" CTA.
- 흰색 1.5px halo(전 경로선 의무) + TransportBadge + 구간라벨.

**제외(P1 격리)**:
- 인터랙티브 지도(pan/zoom↔SVG 좌표동기화) → P1.
- ODsay 실경로 polyline(passStopList 꺾은선) → P1.
- 좌표 파기 cron → P1(데모는 mock 좌표라 PII 없음).

### 4-2. 일정: **P0 데모 4~5 영업일** (프론트 기준)

```
D1   : P0-1 SDK 로더 + P0-2 transit.ts + P0-3 route.ts (인프라 갭 해소)
D2   : P0-4 mock 곡선 좌표 + P0-5 토큰 + P0-6 키프레임
D2-3 : RouteMapCanvas(지도+곡선 오버레이+마커, 지도 잠금)
D3-4 : 수렴 애니메이션 + MemberRouteChip 탭 온디맨드 + halo
D4-5 : PlaceEditSheet + FairnessScoreBadge(Haversine) + result CTA + SDK 실패 폴백 실기기 검증
```
→ **일주일 내 G2용 라이브 데모 가능**(프론트팀장 확약).

### 4-3. G2 연결

- P0 데모는 **vision §7 G2 블라인드 테스트의 핵심 도구**다("한 화면 동시 비교"+"장소 변경 점수표시"가 카카오맵 대비 60%+ 선호 검증).
- **G2 프레이밍 가드(디자인 R1)**: 테스트 스크립트에 "**선 모양이 아니라 시간 격차를 보라**" 명시 — P0 곡선 베지어가 P1 실경로와 모양 다르므로, 추천 품질 평가가 선 모양에 휘둘리지 않게 함.
- 진입 로딩 **≤1초 엄수**(design §6-D, 1.8초 고정 연출 금지).

---

## 5. 마지노선 명문화 (디자인 불변 — 기술이 절대 침범 불가)

> 디자인팀장 "절대 양보불가" 4종. **기술 타협(지도 잠금·꺾은선·곡선화)은 전부 이 마지노선 안에서만 이뤄진다.** 코드리뷰 강제 항목.

1. **색 단독의존 0** — 모든 경로선에 **흰색 1.5px halo + 굵기(손해도) + 숫자라벨** 동반. halo·굵기·숫자라벨 중 **하나라도 빠지면 거부**.
2. **6인 기본 ON 유지** — halo가 6인 가독성 전제. **7명+(B2B)만 경로선 기본 OFF.**
3. **score-up/down = 항상 화살표 아이콘 + FairnessBars와 다른 영역** — `FairnessScoreBadge`로 캡슐화, FairnessBars와 같은 영역 배치 금지(코드리뷰 강제).
4. **RouteMap 전 영역 광고 0** — vision §4·§5-1 불변. 수익 옵션 C 광고는 `/confirm` 후단만.

**추가 불변(디자인 R2·R3)**:
- reduced-motion 시 **즉시표시 금지** → staggered fade-in(150ms)+도착순 숫자배지 순차.
- 밝은 지도타일 위 emerald 저대비 → **흰색 1.5px halo 의무**(1번과 동일).

---

## 6. 미해결/추가 검토 (HOLD)

1. **P0 곡선 베지어가 G2에서 충분히 설득력 있는가** — 직선보다 낫지만 P1 실경로와 체감차 존재. 프로토 테스트로 확인, 부족 시 P1 ODsay polyline 앞당김(vision §9-2 계승).
2. **passStopList 꺾은선의 곡선 품질** — 정류장 수가 적은 구간은 각진 선이 될 수 있음. P1에서 체감 부족 시에만 확정 후보 1개 그래픽 호출(2-1 3단계).
3. **카카오맵 앱키 도메인 등록** — P0-1 SDK 로더의 외부 의존. CEO/인프라가 사전 처리 필요(§7-1).

---

## 7. PM(CEO) 액션 아이템

> 기획팀장 권고 — **P0 데모는 GO. 단 아래 2건은 CEO 결정·처리가 필요하다.**

1. **[CEO/인프라] 카카오맵 JS SDK 앱키 도메인 등록** — P0-1 블로커의 외부 의존. **이게 없으면 SDK 로더가 동작 안 함.** P0 착수 전 처리 권장(개발 무관 행정 작업).
2. **[CEO 결정 요청 §0-E] B2B 데이터 보강(JSONB 컬럼 P1-2·OSRM 방어선) 착수 시점** — 수익 옵션 C(광고+B2B 투트랙)가 확정됐으므로, B2B용 polyline/segments JSONB 컬럼과 OSRM 사전필터를 **P0와 병행할지 / P1로 미룰지** 결정 요청. 기획팀장 권고: **P0는 데모 속도 우선이므로 P1 병행**(B2B 영업 사이클이 길어 급하지 않음).
3. **[검토만] 좌표 파기 cron P1 필수 격상 승인** — vision §2-4가 "확정 후 좌표 파기"를 마케팅 자산으로 승격했으므로, **P1 출시 = 파기 cron 필수**로 게이트화(§2-3). 프라이버시 자산 보호 차원 강력 권고.

---

## 8. 결정 로그 (이 방향서가 상위 문서에 가하는 정정)

| # | 대상 문서·위치 | 기존 | 본 방향서 정정 |
|---|---|---|---|
| 1 | vision §5-1·§6, design §6-D "ODsay 0 호출" | "추가 호출 0" | "시간/환승/점수 재사용 0호출 + P1 polyline=passStopList 꺾은선(그래픽 API 미사용)으로 0 유지". 품질 부족 시만 확정 1후보 그래픽 1회. |
| 2 | design §3 `route-weight-*`·`route-dash-*`·`route-dim`·`route-active` | `theme.colors.moira` 가산 | **색 토큰 아님 — colors에서 제거.** 인라인 style 또는 `lib/moira/route.ts` 상수로 이전. 색 토큰만 colors 잔류. |
| 3 | vision §5-1·§6 P0, design §5 P0 "직선 보간 2점" | 직선 | **2차 베지어 곡선(3점 보간).** 디자인 블로커 해소 + P0↔P1 시각격차 완화. |
| 4 | design §1·§5 P0 지도 인터랙션 | (pan/zoom 명시 없음) | **P0 지도 드래그/줌 잠금 — 핀 드래그만.** 인터랙티브는 P1. |
| 5 | design §4 `RouteSegment`·`polyline`·`fairScore` | 좌표/주석 부족 | `fromLatLng`/`toLatLng` 추가, polyline 비고 "P1=passStopList 역좌표", `mode`=백엔드 단일책임, fairScore "확정 시 1회 리컨실" 주석. |
| 6 | vision §2-4 좌표 파기 | "확정 후 파기"(원칙) | **파기 cron = P1 출시 필수 게이트(격상)** + `/routes` 한정 노출 + token 필수 + 5~6점 다운샘플. |

> **한 줄 결단**: *"디자인 스펙은 표현으로 완성됐다. 기술 갭(지도 SDK 0개·좌표 0개)은 선결 4건으로 메우고, ODsay polyline은 'passStopList 꺾은선=추가 호출 0'으로 디자인의 비용 의도를 지키며, P0 직선은 곡선으로 휘어 디자인 블로커를 없앤다. 마지노선(halo·6인 ON·화살표·광고0)은 한 치도 양보하지 않는다. P0 데모 4~5일, GO."*
