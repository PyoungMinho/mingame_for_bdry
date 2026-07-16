# 동네고수 (`/dongne`) — QA 테스트 설계서

- 작성: 2026-07-16 · @QA설계자(Opus)
- 상위 권위: `docs/planning/dongne-direction.md`(방향서) > `docs/design/dongne-design-final.md`(치명 가드 7건) > `docs/planning/dongne-plan.md`
- 대상 코드: `src/app/dongne/**`, `src/lib/dongne/**`, `src/app/api/dongne/ping`, `scripts/dongne/**`, `supabase/dongne-schema.sql`
- 개발 통합 상태: type-check·build 통과, dongne 컴포넌트 테스트 27/27 통과(전 레포 608/608). 공유파일 수정 0.
- **핸드오프 대상(@QA실행자)**: 아래 P0 케이스부터 테스트 코드화. `fast-check` 설치 확인됨(프로퍼티 테스트 가능). `vitest` 1.6.
- **프리런치 주의**: `EPOCH_KST='2026-07-18'` → 현재(07-16) `getTodayGameNo()<1`이라 게임/아카이브가 프리런치·차단 화면으로 마스킹됨. **게임·아카이브·OG 로직 검증은 반드시 날짜 주입(`vi.setSystemTime` 또는 `now` 파라미터)으로 EPOCH 이후를 시뮬레이션할 것.** 프리런치 상태로 테스트하면 로직이 전부 우회되어 거짓 통과가 난다.

---

## 0. 요약 (읽는 순서)

1. **가장 시급**: §9 버그 의심점 **BUG-1(P0 크래시)** — 에디토리얼 스키마 불일치로 아카이브 해설 페이지가 런칭 후 500 크래시. 지금은 프리런치라 마스킹됨.
2. **최우선 회귀(R5)**: `queue.ts` 단일 소스 — 테스트 파일이 **0개**다. §1이 전부 신규 작성 대상.
3. **치명 가드 회귀**: §5 (색블록·정답 사전렌더·OG·미래회차) — 트레이드드레스/스포일러는 법적·신뢰 리스크.

---

## 1. 테스트 범위

### 검증한다 (IN)
- `queue.ts` 시간/출제/힌트 순수함수 전량(KST 경계·결정론·셔플 공정성·haversine·bearing·근접도)
- 게임 상태 머신(`useGame.ts`·`page.tsx`): 6회 소진·중복·정답·복원·자정 스냅샷·localStorage 폴백
- 자동완성 판정(`GuessInput`)이 **code 기준**인지, 동명 `nameWithSido` 구분
- 치명 가드 7건 회귀(색 경계·정답 렌더 금지·OG 스포·미래 회차·공유파일 격리)
- `ping` API: anon_id 검증·멱등·non-blocking·IP 미접근
- 데이터 무결성: manifest 250 code 유일성·silhouette 1:1·editorial 스키마/매칭/색·비하 스캔
- 빌드·SSG: 아카이브 `generateStaticParams`가 오늘 미만만 생성

### 검증하지 않는다 (OUT — 근거)
- 실루엣 **시각적 식별성**(R1) — 사람 눈 판정 영역, 자동화 불가. PM/디자인 육안 검수로 이관.
- 실제 카톡 인앱 브라우저 렌더(R3) — 실기기 매뉴얼 테스트(§8 수동 체크리스트로만).
- Supabase 실 테이블 적재·7일 이동평균 게이트 쿼리 정확도 — DB는 PM 수동 생성 후 운영 검증(스키마 SQL 정합만 코드리뷰).
- 원본 GeoJSON→centroid 지리적 정확도의 절대 오차(빌드 스크립트는 산출물 정합만 검증, 원본 대조는 OUT).
- 안티치트(방향서 §2 v1 비목표) — 소스에서 정답 추출 가능은 수용된 속성.

---

## 2. 테스트 레벨·리스크 매핑

| 레벨 | 대상 | 커버리지 목표 | 리스크 근거 |
|---|---|---|---|
| L1 단위 | `queue.ts`, `share.ts`, `storage.ts`, 힌트 수학 | 90%+ (핵심 순수함수) | R5 단일소스 불일치=치명, 결정론 붕괴=전 유저 다른 정답 |
| L2 통합 | `ping` route, 데이터 무결성, editorial 로더 | 실패경로 100% | non-blocking 위반 시 게임 차단, 스키마 불일치 크래시 |
| L3 컴포넌트/E2E | 상태 머신, 자동완성, 결과·공유 플로우 | 핵심 시나리오 100% | 오탭 시도 소모(R4), 스포일러 유출 |
| L4 비기능 | 치명 가드·접근성·SSG 경계 | 가드 7건 100% | 트레이드드레스(법)·스포일러(신뢰)·SEO |

---

## 3. §1 — `queue.ts` 시간·출제·힌트 (최우선 회귀 · 현재 테스트 0건)

> 전 케이스 **날짜 주입**(함수 인자 `now: Date`)으로 결정론 검증. `Math.random`·실시간 의존 금지.

### 3-1. KST 자정 경계 · EPOCH 상대 위치

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| Q-01 | 경계 | EPOCH 당일 KST 00:00:00 | `2026-07-17T15:00:00Z`(=07-18 00:00 KST) | `getTodayGameNo`=1 | P0 | ✅ |
| Q-02 | 경계 | EPOCH 전날 KST 23:59:59 | `2026-07-17T14:59:59Z` | `getTodayGameNo`=0 (호출측 프리런치 가드 발동) | P0 | ✅ |
| Q-03 | 경계 | 자정 직전 23:59:59.999 → 회차 불변 | 임의일 KST 23:59:59.999 | gameNo=N, `msUntilMidnightKST`≈1ms | P0 | ✅ |
| Q-04 | 경계 | 자정 정각 00:00:00.000 → 회차 +1 | 위 +1ms | gameNo=N+1, `msUntilMidnightKST`=86400000 | P0 | ✅ |
| Q-05 | 경계 | 정오 KST에도 같은 회차 | 같은 날 03:00Z·04:00Z·11:00Z | 셋 다 동일 gameNo | P0 | ✅ |
| Q-06 | 타임존 무관 | 서버 TZ가 UTC/America/LA여도 동일 | `process.env.TZ` 변형 후 동일 UTC 시각 | gameNo·code 불변(고정 UTC+9 산술) | P0 | ✅ |
| Q-07 | EPOCH 이전 | 프리런치 gameNo≤0 | `2026-01-01` | `getTodayGameNo`≤0; `getTodayRegionCode`는 `getRegionCodeForGame(≤0)`에서 **RangeError** | P0 | ✅ |
| Q-08 | 연말·연초 | 12/31 23:59→1/1 00:00 KST 경계 | `2026-12-31`/`2027-01-01` KST | gameNo 정확히 +1, 날짜 문자열 롤오버 정합 | P1 | ✅ |
| Q-09 | 윤년 | 2028-02-28→02-29→03-01 KST | 해당 3일 | 연속 gameNo +1씩(윤일 누락/중복 없음) | P1 | ✅ |
| Q-10 | 날짜 표기 | `getDateForGame(gameNo)`가 KST 달력일 | gameNo=1 | `'2026-07-18'` (EPOCH와 일치) | P1 | ✅ |
| Q-11 | 왕복 | `getDateForGame`↔`getTodayGameNo` 상쇄 | 임의 gameNo | ping이 쓰는 `getDateForGame(getTodayGameNo(now))`=now의 KST 날짜 | P0 | ✅ |

### 3-2. 결정론 출제 (같은 날짜=같은 정답, 전 환경 동일)

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| Q-20 | 결정론 | 같은 gameNo 재호출 = 같은 code | gameNo=42 ×1000회 | 항상 동일 code(캐시·순수함수) | P0 | ✅ |
| Q-21 | 결정론 | 게임=아카이브=OG=ping 동일 code | 같은 gameNo를 4경로에서 | 4곳 모두 `getRegionCodeForGame` 동일값 (R5 핵심) | P0 | ✅ |
| Q-22 | 프로퍼티 | fast-check: 임의 gameNo≥1 항상 유효 code 반환 | fc.integer(1, 10^6) | 반환값 ∈ REGION_CODES, throw 없음 | P0 | ✅ |
| Q-23 | 유효성 | 비정수·0·음수 거부 | 0, -1, 1.5, NaN | RangeError | P0 | ✅ |

### 3-3. 셔플 공정성 (방향서 §2 · R5)

> 아래는 QA설계자가 알고리즘을 재현·실측 검증 완료(30사이클). @QA실행자는 이를 **회귀 테스트로 고정**하라(코드 변경 시 공정성 붕괴 감지).

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| Q-30 | 전량 소진 | 한 사이클(250회)에 전 지역 정확히 1회 | cycle 0..29 각각 | 각 사이클 = REGION_CODES의 완전 순열(중복·누락 0) — **실측 통과** | P0 | ✅ |
| Q-31 | 균등 분포 | 4바퀴(1000회) 후 각 지역 출현수 | gameNo 1..1000 | 모든 지역 정확히 4회 (min=max=4) — **실측 통과** | P0 | ✅ |
| Q-32 | 사이클 경계 재등장 | 직전 사이클 tail 7이 새 사이클 head 7에 없음 | cycle N/N+1 인접 | 재등장 0건 — **실측 통과** | P1 | ✅ |
| Q-33 | 분구 연속 회피(사이클 내) | 인접 두 회차가 같은 시 분구(예 수원 4구)면 안 됨 | 전 사이클 인접쌍 | 같은 `cityGroup` 인접 0건 — **실측 통과** | P1 | ✅ |
| Q-34 | 분구 연속 회피(경계) | 사이클 마지막·다음 첫 회차 다른 그룹 | cycle N last vs N+1 first | 같은 그룹 0건 — **실측 통과** | P1 | ✅ |
| Q-35 | 결정론 | 셔플이 시드 고정(재호출·전 환경 동일) | cycleOrder(0) ×2 | 완전 동일 배열 | P0 | ✅ |
| Q-36 | 엣지 | wrap-around ≥250 (2바퀴째 code 계산) | gameNo=251 | `cycleOrder(1)[0]`, throw 없음 | P0 | ✅ |

### 3-4. 힌트 수학 (haversine · 8방위 · 근접도)

> 실측 기준값(QA설계자 검증): 종로구(서울)↔중구(부산) centroid ≈ **332km / bearing 146°(SE)**. 전국 centroid 최대거리 **599km < MAX_DIST 700** → 근접도 음수 불가.

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| Q-40 | 실측 | haversine 서울↔부산 | 두 실 centroid | 330±10km (수식 정합; ~325 기대치 근사) | P0 | ✅ |
| Q-41 | 항등 | 같은 좌표 거리 0 | a==b | 0km, 근접도 100(정답경로) | P0 | ✅ |
| Q-42 | 대칭 | haversine(a,b)==haversine(b,a) | 임의쌍 | 거리 대칭 | P1 | ✅ |
| Q-43 | 방위 경계각 | 8방위 45° 구간·±22.5° 경계 | 0/22.5/45/67.5/…/337.5° | N,NE 경계 반올림 규칙대로 매핑(각 45°) | P0 | ✅ |
| Q-44 | 방위 정북 랩 | 359°·1° 모두 N | bearing≈360/0 | 'N'(모듈로 8 랩 정확) | P0 | ✅ |
| Q-45 | 방위 반대 | 서울→부산 SE, 부산→서울 NW | 역방향 | 대략 반대 방위 | P1 | ✅ |
| Q-46 | 근접도 캡(오답) | `computeHint` 인접 지역 매우 근접 | 거리 5km 오답 | proximity ≤ **99** (100 아님 — 정답 전용 가드) | P0 | ✅ |
| Q-47 | 근접도 정답 | 정답은 100 | submitGuess 정답 분기 | `{distanceKm:0, direction:null, proximity:100}` | P0 | ✅ |
| Q-48 | 근접도 하한 | 거리≥MAX_DIST면 0(음수 금지) | 800km(가상) | `proximityPct`=0, `max(0,…)` | P1 | ✅ |
| Q-49 | 프로퍼티 | 임의 두 실 centroid 근접도 ∈ [0,99], 거리 ∈ [0,599] | fc: manifest 쌍 | 범위 불변식 | P1 | ✅ |
| Q-50 | 반올림 | 거리 정수 반올림 | 예 41.6km | `Math.round`=42 | P2 | ✅ |

---

## 4. §3 — 게임 상태 머신 (`useGame.ts` · `page.tsx` · `storage.ts`)

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| G-01 | 정상 | 첫 정답(3회째) | 오답2+정답 | status=won, guesses.length=3, 결과카드 확장 | P0 | ✅ |
| G-02 | 소진 | 6회 오답 → 실패 | 오답6 | status=lost, 정답 공개(name/실루엣) | P0 | ✅ |
| G-03 | 경계 | 6회째 정답 | 오답5+정답 | won(lost 아님), 근소 경계 | P0 | ✅ |
| G-04 | 차단 | 종료 후 추가 제출 무시 | won 상태서 submitGuess | no-op(status!==playing 가드) | P0 | ✅ |
| G-05 | 중복 추측 | 같은 code 재선택 | 이미 추측한 지역 | 옵션 '이미 추측함' 캡션·흐림, **강제 차단 아님**(선택 시 시도 소모됨) | P1 | ✅ |
| G-06 | 복원(진행중) | 3/6 저장 후 재방문 | loadGameState 3건 | 1~3행 복원+4행 active, 온보딩 재노출 안 함 | P0 | ✅ |
| G-07 | 복원(성공) | 완료 후 재진입 | won 저장 | 입력 UI 숨김, 결과카드 즉시 렌더 | P0 | ✅ |
| G-08 | 복원(실패) | lost 재진입 | lost 저장 | 실패 결과카드 즉시, 정답 노출 | P1 | ✅ |
| G-09 | 자정 스냅샷 | 세션 중 자정 넘김 | 마운트 후 시간 경과 | gameNo **불변**(useState 초기화 1회) — 새로고침 전엔 정답 안 바뀜 | P0 | ✅ |
| G-10 | 통계 멱등 | 같은 gameNo 완료 재계산 | recordCompletedGame ×2 | `lastPlayedGameNo===gameNo` 가드로 중복 집계 0 | P0 | ✅ |
| G-11 | 스트릭 연속 | 어제 플레이+오늘 | gameNo-last==1 | currentStreak +1, maxStreak 갱신 | P0 | ✅ |
| G-12 | 스트릭 끊김 | 하루 건너뜀 | gameNo-last>1 | currentStreak=1 리셋 | P0 | ✅ |
| G-13 | 스트릭 유지(패배) | 오답이어도 완료 | won=false | 스트릭 유지(§4-8 "정답 못 맞혀도 유지") | P1 | ✅ |
| G-14 | 히스토그램 | 성공 회차별·실패 칸 | attempts 1~6 / lost | idx=attempts-1(성공)·6(실패) 증가 | P1 | ✅ |
| G-15 | localStorage 불가 | 프라이빗 모드 | setItem throw | 예외 없이 저하모드, `StorageUnavailableNotice` 세션 1회, 게임 진행 가능 | P0 | ✅ |
| G-16 | 폴백 스트릭 | 저장 불가 시 통계 | 매 완료 loadStats=default | currentStreak 항상 1(누적 불가·수용 저하), 크래시 없음 | P2 | ✅ |
| G-17 | 넛지 조건 | 미플레이·streak>0·KST≥21시 | 3조건 충족 | NudgeBanner 노출, ✕ 세션 dismiss | P1 | ✅ |
| G-18 | 넛지 비노출 | 21시 미만/이미 플레이 | 조건 미충족 | 배너 없음 | P2 | ✅ |
| G-19 | 우리동네 뱃지 | 정답==hometown | 등록+일치 | 실링 뱃지+자랑 카피, **정답 확정 후에만** 계산 | P1 | ✅ |
| G-20 | 뱃지 미렌더 | 등록+불일치 | hometown≠today | 뱃지 영역 완전 미렌더(빈공간 없음) | P2 | ✅ |
| G-21 | 실루엣 실패 non-block | fetch 실패 | 동적 import reject | silhouetteState=error, 자동완성으로 게임 계속(완전 블로킹 금지) | P0 | ✅ |
| G-22 | 실루엣 재시도 | error→다시시도 | retrySilhouette | retryToken 증가, 재fetch | P2 | ✅ |
| G-23 | ping 1회 | 첫 인터랙션 | onClickCapture | pingOnce 1회만(pingFiredRef), 이미 ping했으면 스킵 | P1 | ✅ |

---

## 5. §4 — 동명 지역 판정 (code 기준)

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| N-01 | 동명 구분 | "중구" 입력 | 부산/인천/대구… | 각각 별도 옵션, `(부산)`·`(인천)` 배지 병기 | P0 | ✅ |
| N-02 | code 판정 | 같은 이름 다른 code 정답 | 고성군(강원 32380?)·(경남) | 정답 판정 == `region.code===today.code`(문자열 아님) | P0 | ✅ |
| N-03 | 오판정 방지 | 동명 오답 선택 | 정답=고성(강원), 추측=고성(경남) | 오답 처리(같은 이름이나 code 다름) | P0 | ✅ |
| N-04 | 배지 규칙 | 광역시 자치구 항상 `(시도)` | 종로구 등 | `nameWithSido !== name`이면 배지 노출 | P1 | ✅ |
| N-05 | 별칭 매칭 | "강남"→강남구, "수원"→수원시 구들 | alias 입력 | aliases 포함 매칭 | P1 | ✅ |
| N-06 | 세종 특례 | 세종 단일 출제 단위 | code 29010 | 하위 시군구 없음, 1문제 취급 | P2 | ✅ |
| N-07 | 자유텍스트 불가 | 미선택 제출 | 타이핑만 하고 [추측하기] | onSubmit 미호출(2탭 규칙) | P0 | ✅ (기존 통과) |

---

## 6. §5 — 치명 가드 회귀 (트레이드드레스·스포일러)

| ID | 카테고리 | 시나리오 | 입력/방법 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| C-01 | 색블록 0 | 공유 텍스트 출력 스캔 | **`buildShareText()` 반환 문자열**을 🟩🟨🟥🟦🟧🟪🟫⬛⬜ 정규식 스캔 | 매치 0 | P0 | ✅ |
| C-01b | 색블록(주의) | 소스 grep 금지 | share.ts 소스엔 주석에 🟩🟨🟥 3개 존재(false-positive) | **반드시 함수 출력만 검사**(소스 grep 아님) | P0 | ✅ |
| C-02 | 색이모지 화살표 | 방위는 텍스트 화살표만 | 성공/실패 출력 | ↑↗→↘↓↙←↖만, 색타일 없음 | P0 | ✅ |
| C-03 | 정답명 미포함 | 공유에 지역명 없음 | won/lost 출력 | 정답 지역명 문자열 미포함(스포프리), 정답행="정답!" | P0 | ✅ |
| C-04 | share 격리 | 색토큰 import 금지 | share.ts import 정적 분석 | CSS/`--dn-`/컴포넌트 import 0 | P1 | ✅ |
| C-05 | 정답 사전 렌더 금지 | playing 중 name/centroid DOM·alt 미노출 | status=playing | SilhouetteFrame aria="오늘의 동네 실루엣"만, TownBadge playing시 미렌더 | P0 | ✅ |
| C-06 | won 상태 name 가드 | correct 상태 실루엣 answerName 무시 | won + answerName 전달 | 렌더 안 함(SilhouetteFrame correct 분기), page는 lost일 때만 answerName 전달 | P0 | ✅ |
| C-07 | OG 정답 미참조 | OG route가 name/centroid 안 읽음 | route.tsx 정적분석 | manifest name/centroid import·참조 0(코드·path만) | P0 | ✅ |
| C-08 | OG 미래 404 | 미래 회차 OG | gameNo>today | 404 (오늘=today는 티저 200 허용) | P0 | ✅ |
| C-09 | OG 형식 404 | 비정수·음수 | gameNo="abc"/0/-1 | 404 | P1 | ✅ |
| C-10 | OG 프리런치 404 | EPOCH 이전 | today<1 | 전부 404 | P1 | ✅ |
| C-11 | OG stroke-only | 실루엣 채움 금지 | 생성 SVG 검사 | `fill="none"` stroke만(형태 식별 방지) | P1 | ✅ |
| C-12 | 아카이브 미래/오늘 차단 | 오늘·미래 gameNo | gameNo≥today | 200 친화 차단화면(404 아님), 복귀 CTA | P0 | ✅ |
| C-13 | 아카이브 형식 404 | 음수·비정수 | "abc"/0/-1 | notFound() 표준 404 | P1 | ✅ |
| C-14 | OG manifest 미참조(간접) | OG가 manifest 파일 import 안 함 | import 그래프 | manifest.json import 0 | P1 | ✅ |
| C-15 | 공유파일 무수정 | globals/루트layout/tailwind | git diff | dongne 스코프 외 변경 0(`.dn-shell`·`--dn-` 격리) | P0 | ✅ |

> **주의(테스트 설계 함정)**: C-01은 반드시 `buildShareText()`의 **런타임 반환값**을 스캔해야 한다. share.ts 소스를 grep하면 doc-comment의 "🟩🟨🟥 사용 금지" 문구가 3건 매치되어 거짓 실패가 난다(QA설계자 실측 확인).

---

## 7. §6 — `ping` API (DAU 게이트)

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| P-01 | 검증 | 정상 UUID | `{anonId:"<36자 uuid>"}` | 204, upsert 호출 | P0 | ✅ |
| P-02 | 검증 | 키 별칭 | `{anon_id:"..."}` | 204(둘 다 허용) | P1 | ✅ |
| P-03 | 검증 거부 | 형식 위반 | 7자·65자·특수문자·비문자열 | 204, **upsert 미호출**(카운트 스킵) | P0 | ✅ |
| P-04 | 검증 거부 | 바디 없음/비JSON | 빈·"garbage" | 204, throw 없음 | P0 | ✅ |
| P-05 | 멱등 | 더블파이어 | 같은 anonId 60s 내 2회 | 2회째 seenRecently로 upsert 미호출(1행) | P1 | ✅ |
| P-06 | 멱등(DB) | on-conflict do nothing | 스키마 검증 | PK(day_kst,anon_id)+ignoreDuplicates | P0 | 리뷰 |
| P-07 | non-block | env 미설정 | getSupabaseAdmin=null | 204(게이트 미가동, 게임 무영향) | P0 | ✅ |
| P-08 | non-block | 테이블 미배포 | upsert error | console.error만, 204 유지 | P0 | ✅ |
| P-09 | non-block | 예상외 예외 | 내부 throw | catch→204 | P0 | ✅ |
| P-10 | IP 미접근 | 헤더 미read | route 정적분석 | `req.ip`·`x-forwarded-for`·헤더 접근 0(개인정보 미저장) | P0 | ✅ |
| P-11 | KST 스탬프 | 서버 날짜 권위 | getDateForGame∘getTodayGameNo | 오늘 KST 날짜(클라 스푸핑 무시) | P1 | ✅ |
| P-12 | 서버 전용 | supabase-admin 클라 번들 유입 금지 | import 그래프 | client 컴포넌트에서 import 0 | P1 | 리뷰 |

---

## 8. §7·§8 — 데이터 무결성 · 빌드·SSG

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 | 자동화 |
|---|---|---|---|---|---|---|
| D-01 | manifest | 250개·code 유일 | manifest.json | length=250, code Set=250 — **실측 통과** | P0 | ✅ |
| D-02 | manifest | REGION_CODES 정합 | region-codes.ts vs manifest | 코드집합 동일·COUNT=250 | P0 | ✅ |
| D-03 | 실루엣 1:1 | 파일 ↔ code | silhouettes/*.json | 250개, 누락·잉여 0 — **실측 통과** | P0 | ✅ |
| D-04 | 실루엣 스키마 | viewBox·d 유효 | 각 json | `viewBox="0 0 100 100"`, d 비어있지 않음 | P1 | ✅ |
| D-05 | centroid 범위 | 한반도 위경도 내 | 각 centroid | lat 33~39·lng 124~131 — **실측(33.3~38.3/124.7~130.9) 통과** | P1 | ✅ |
| D-06 | editorial 매칭 | code 필드=파일명 | editorial/*.json | 전건 일치·code∈manifest — **실측 통과** | P0 | ✅ |
| D-07 | editorial 색·비하 | 색블록·비하표현 0 | 전 파일 스캔 | 색블록 0·"촌뜨기/낙후" 등 0 — **실측 통과** | P1 | ✅ |
| D-08 | editorial 스키마 | **로더 계약 일치** | editorial vs `EditorialContent` | ⚠ **불일치 — BUG-1 참조**(P0) | P0 | ✅ |
| D-09 | editorial 개수 | 시드 편수 | ls | **60편**(임무 컨텍스트 "84편"과 불일치 — §9 확인 필요) | P1 | 리뷰 |
| D-10 | SSG 경계 | generateStaticParams=오늘 미만 | today=N | `[1..N-1]`만, 오늘·미래 미생성 | P0 | ✅ |
| D-11 | SSG 프리런치 | today<1 | 프리런치 | `[]` 반환 | P1 | ✅ |
| D-12 | dynamicParams | 미프리빌드 과거 회차 | 배포 후 지난 회차 | on-demand 렌더+ISR 300s(재배포 없이 증가) | P2 | 리뷰 |
| D-13 | 아카이브 목록 | 오늘 제외 | archive/page | lastGameNo=today-1까지만(스포 방지) | P1 | ✅ |

---

## 9. 버그 의심점 (코드 리뷰 발견 — 별도 섹션)

### 🔴 BUG-1 (P0 · 크래시 + 콘텐츠 미표시) — editorial 스키마 불일치
- **위치**: `src/app/dongne/lib/editorial.ts`(계약) ↔ `src/app/dongne/data/editorial/{code}.json`(실데이터) ↔ `src/app/dongne/archive/[gameNo]/page.tsx:173`(소비)
- **내용**: `EditorialContent`/페이지는 `{ population, area, sections:[{heading,paragraphs[]}] }`를 기대하나, 실제 60개 JSON은 전부 `{ intro, body:[], facts:{}, sources:[] }` 스키마다. `sections`/`population`/`area` 필드가 **존재하지 않음**.
- **크래시 재현(확인함)**: 페이지 173행 `editorial && editorial.sections.length > 0` → `editorial`은 truthy, `editorial.sections`는 `undefined` → **`TypeError: Cannot read properties of undefined (reading 'length')`**. 에디토리얼 파일이 있는 code가 과거 회차가 되는 순간 아카이브 해설 페이지가 500 크래시(SSG 빌드 또는 ISR 렌더).
- **이중 피해**: 크래시를 막더라도 `intro/body/facts`는 절대 렌더되지 않아 60편 콘텐츠가 전부 "해설 준비 중" 폴백으로 표시되고, 인구·면적 스탯카드는 항상 빈칸. 애드센스 콘텐츠 층(방향서 §4 핵심 가치)이 무력화됨.
- **현재 마스킹 이유**: `EPOCH_KST='2026-07-18'`로 프리런치라 모든 아카이브가 `isBlocked` 차단화면을 타서 `loadEditorial`에 도달하지 않음. **런칭(EPOCH 도달) 후, 에디토리얼 보유 code가 gameNo<today가 되는 첫 시점에 폭발.**
- **근본 원인**: `editorial.ts` 자체 doc-comment가 이미 "방향서 §3은 `content/<code>.md`(MD), 임무 지시는 `editorial/{code}.json`(JSON)로 경로·포맷이 다르다 — 통합 시 정리 필요"라고 경고했으나, **실제 JSON 필드 형태(intro/body/facts)와 로더 인터페이스(sections/population/area)의 불일치는 아무도 조정하지 않음.**
- **권고**: 로더 `EditorialContent`와 페이지 렌더를 실제 JSON 스키마(`intro`/`body`/`facts`)로 맞추거나, JSON을 로더 스키마로 재생성. 어느 쪽이든 **런칭 전 필수(P0)**. 수정 후 D-08을 회귀로 고정.

### 🟡 BUG-2 (P2 · 코스메틱) — 자정 정각 "24:00:00" 플래시
- **위치**: `useMidnightCountdown.ts` `computeParts` + `queue.ts msUntilMidnightKST`
- **내용**: KST 자정 정각 순간 `msUntilMidnightKST()`가 정확히 `86400000`을 반환(확인함) → `Math.floor(86400000/1000)=86400초` → `hours=24` → 카운트다운이 한 틱 동안 **"24:00:00"** 표기 후 다음 초에 정상화. 결과카드·넛지 카운트다운 공용.
- **심각도**: 낮음(1틱 시각 결함, 데이터/판정 영향 없음). 다만 자정에 새 회차로 넘어가는 바로 그 순간 노출되므로 눈에 띌 수 있음.
- **권고**: `totalMs`를 `[0, DAY_MS)` 로 클램프(예 `% DAY_MS`)하거나 24시=0시 표기 처리. P2.

### 🟡 BUG-3 (P1 · 데이터 완결성/문서 드리프트) — editorial 60편 vs 84편
- **내용**: 임무 컨텍스트 ④는 "editorial JSON 84편 시드"라 했으나 실제 `editorial/*.json`=**60편**. 방향서 §3 SLA("N-1일 해설이 N일까지 준비", 버퍼 30편)에 비추면 시즌 초기 30여 회차는 커버되나, 84 주장과의 24편 갭은 문서/데이터 드리프트.
- **권고**: 실제 시드 편수를 확정·문서 동기화. BUG-1 수정 없이는 편수와 무관하게 콘텐츠가 렌더 안 되므로 BUG-1 이후 재점검. P1.

### 🟢 관찰 (버그 아님 · 리뷰 참고)
- **OBS-1(UX)**: 성공(won) 시 정답 지역명이 **화면 어디에도 표시되지 않음**. GuessList 정답행="🎯 정답!"(이름 없음), 결과 헤드라인="N/6 만에 맞혔어요"(이름 없음), SilhouetteFrame `correct`는 answerName 미렌더(스포가드). 사용자가 직접 선택해 알긴 하나, 확정 지명 라벨이 없다. 스펙(§4-3)상 이름 노출은 실패 케이스만 요구하므로 **규정 위반 아님** — 다만 "won에도 정답명 확인 라벨" 추가 여부는 디자인 확인 권장.
- **OBS-2(non-blocking)**: 프리런치(today≤0)에 `ping`이 `getDateForGame(getTodayGameNo())`로 **EPOCH 이전 날짜**를 스탬프할 수 있음(`getDateForGame`은 gameNo<1 미가드, `getRegionCodeForGame`와 달리 throw 안 함). 로컬 env 미설정이면 어차피 204라 실피해 없음. 런칭 후엔 today≥1이라 무해. 저심각.
- **OBS-3(설계 확인)**: OG는 `gameNo===today` 티저 허용(200), 아카이브 해설은 `gameNo>=today` 차단(오늘 정답 스포 방지). 비대칭은 **의도적**(OG=윤곽선 티저/무스포, 해설=정답 노출). C-08/C-12로 각각 회귀 고정.
- **OBS-4(수용된 저하)**: localStorage 불가 시 매 완료 `loadStats()`가 default 반환 → currentStreak 항상 1(누적 불가). §4-13 "허용 가능 저하" 명문과 정합. G-16으로 크래시 없음만 보장.

---

## 10. Quality Gate (릴리즈 전 필수 통과 조건)

**전부 충족해야 `git push mingame main` 배포 가능:**

1. **[차단]** BUG-1 해소 — editorial 스키마 정합. D-08 회귀 통과. (미해소 시 런칭 후 아카이브 크래시 → 배포 금지)
2. **[차단]** §3 queue.ts 전 P0(Q-01~07, 11, 20~23, 30~31, 35~36, 40~41, 43~44, 46~47) 통과. 결정론·자정경계·4경로 동일 정답(Q-21) 미통과 시 배포 금지.
3. **[차단]** 치명 가드 P0 전량(C-01~03, 05~08, 12, 15) 통과. 색블록 0·정답 사전렌더 0·OG 미래 404·공유파일 무수정.
4. **[차단]** ping non-blocking P0(P-03,04,07,08,09,10) — 어떤 실패에도 게임 미차단·IP 미접근.
5. **[차단]** 상태 머신 P0(G-01~04, 06,07, 09,10,11,12, 15, 21) — 6회 소진·자정 스냅샷·멱등·저장불가 폴백.
6. **[차단]** 데이터 무결성 P0(D-01,02,03,06,10) — 250 유일·1:1·SSG 경계.
7. **[비차단·권고]** BUG-2/BUG-3 처리 또는 이슈 등록. OBS-1 디자인 확인.
8. **[게이트 외 전제]** type-check·클린 build·`npm run test`+`test:redline` 그린, dongne 컴포넌트 27/27 유지, 공유파일 diff 0.

---

## 11. 자동화 전략

| 대상 | 도구 | 방식 |
|---|---|---|
| queue.ts(시간·출제·힌트) | vitest + **fast-check**(설치됨) | 순수함수 단위 + 프로퍼티(Q-22,49). `vi.setSystemTime` 또는 `now` 인자 주입으로 날짜 고정. `process.env.TZ` 변형으로 타임존 무관 검증(Q-06) |
| 셔플 공정성 | vitest | 30사이클 실측 스냅샷을 회귀로 고정(Q-30~36). QA설계자 재현 스크립트 이식 |
| share/color 가드 | vitest | **`buildShareText()` 출력** 정규식 스캔(소스 grep 금지·C-01b), import 정적 분석 |
| 상태 머신 | vitest + jsdom + `@testing-library/react` | `renderHook(useDongneGame)` + localStorage 목. 기존 컴포넌트 테스트 패턴 재사용 |
| ping route | vitest | `POST` 핸들러 직접 호출 + `getSupabaseAdmin`/`fetch` 목. 검증·멱등·non-blocking·IP미접근(정적분석) |
| 데이터 무결성 | vitest(node env) | manifest/silhouette/editorial JSON 로드 후 불변식 assert. CI에서 데이터 커밋마다 실행 |
| SSG 경계 | vitest | `generateStaticParams`·`generateMetadata` 순수 호출, 날짜 주입 |
| OG/아카이브 라우트 | vitest | route `GET`/page 함수 직접 호출(문자열·status 검사). 이미지 픽셀은 OUT |
| 실루엣 식별성·카톡 인앱 | **수동** | PM/디자인 육안 + 실기기(갤럭시 구형·iPhone SE) 카톡 인앱 체크리스트(§8 OUT) |
| 스키마 정합(P-06, P-12, D-09) | **코드 리뷰** | SQL DDL·import 그래프·편수는 자동화보다 리뷰가 저비용 |

**신규 테스트 파일 권장 배치**(@QA실행자):
- `src/lib/dongne/queue.test.ts` — §3 전량(최우선)
- `src/lib/dongne/share.test.ts` — §6 색가드
- `src/lib/dongne/storage.test.ts` — §4 스트릭·멱등·폴백
- `src/app/dongne/lib/useGame.test.tsx` — 상태 머신
- `src/app/api/dongne/ping/route.test.ts` — §7
- `src/app/dongne/data/data-integrity.test.ts` — §8 무결성 + D-08(BUG-1 회귀)
