# 동네고수 (`/dongne`) — QA 실행 리포트 · 버그 리포트

- 작성: 2026-07-16 · @QA실행자(Opus)
- 입력: `docs/qa/dongne-test-plan.md`(@QA설계자) · `docs/planning/dongne-direction.md` · `docs/design/dongne-design-final.md`
- 대상: `src/app/dongne/**`, `src/lib/dongne/**`, `src/app/api/dongne/ping`, `src/app/dongne/data/**`
- 게이트 결과: **type-check 통과 · 클린 build 통과 · 전체 스위트 719/719(100%) 통과**

---

## 0. 요약 (한눈에)

| 항목 | 값 |
|---|---|
| 발견 버그 | **3건** (치명/P0 1 · P1 1 · P2 1) |
| 수정 완료 | **2건** (BUG-1 P0, BUG-2 P2) — 전부 dongne 스코프 내 |
| 리포트만(스코프/성격상 미수정) | **1건** (BUG-3 문서·데이터 드리프트) |
| 신규 테스트 파일 | 9개 |
| 신규 테스트 수 | **+111** (608 → **719**) |
| 최종 통과율 | 719/719 (100%) |
| 공유 파일 수정 | **0건** (dongne 스코프만 수정) |

Quality Gate(§10) **P0 차단 항목 전부 통과** — BUG-1 해소·queue 결정론/자정경계·치명가드·ping non-blocking·상태머신·데이터 무결성.

---

## BUG-1: 아카이브 해설 페이지 editorial 스키마 불일치 → 런칭 후 500 크래시 + 콘텐츠 전면 미표시

### 심각도: **Critical (P0)** — 수정 완료 ✅

### 재현 스텝 (수정 전)
1. 시스템 시간을 EPOCH(2026-07-18) 이후로 설정(예: 2027-06-01, gameNo≈319).
2. editorial JSON 파일이 존재하는 과거 회차 URL 진입 — 예 `/dongne/archive/{g}` (g의 정답 code가 `data/editorial/{code}.json` 보유).
3. 페이지가 `loadEditorial(code)`로 `{intro, body, facts, sources}` 객체를 받는다.
4. `archive/[gameNo]/page.tsx:173`이 `editorial && editorial.sections.length > 0`을 평가.

### 기대 결과
해당 지역 해설(인구·유래·특산물 등 1,500자)과 스탯카드가 렌더된다(방향서 §4 애드센스 콘텐츠 층의 핵심 가치).

### 실제 결과 (수정 전)
`editorial`은 truthy · `editorial.sections`는 `undefined` → **`TypeError: Cannot read properties of undefined (reading 'length')`** → 페이지 500(SSG 빌드/ISR 렌더 모두). 크래시를 막아도 `intro/body/facts`는 절대 렌더되지 않아 60편 전량이 "해설 준비 중" 폴백 + 인구·면적 스탯 빈칸.

### 근본 원인
로더 계약(`EditorialContent` = `{population, area, sections[]}`)과 실데이터(60개 전부 `{intro, body[], facts{}, sources[]}`)가 불일치. 프리런치(EPOCH 미도달)라 모든 아카이브가 `isBlocked` 차단화면을 타서 마스킹돼 있었음 — **런칭 후 첫 과거 회차가 editorial 보유 code가 되는 순간 폭발**.

### 수정 (dongne 스코프)
- `src/app/dongne/lib/editorial.ts` — `EditorialContent` 인터페이스를 실데이터 스키마(`intro?/body?/facts?/sources?`, 전부 optional)로 재정합. `EditorialSection` 제거.
- `src/app/dongne/archive/[gameNo]/page.tsx` — 스탯카드를 `facts` 엔트리(라벨→값) 순회로, 본문을 `intro`(리드 문단) + `body[]` 문단 렌더로 교체. 파일/필드 부재 시 "준비 중" 폴백 유지.

### 회귀 고정
- `data-integrity.test.ts` D-08 — 60편 전량이 `intro:string / body:non-empty array / facts:object`이고 `sections`는 부재임을 assert. 로더 반환 객체를 페이지 접근 패턴대로 접근해도 throw 없음.
- `archive/[gameNo]/page.test.tsx` — editorial 보유 과거 회차 페이지를 실제 렌더(`renderToStaticMarkup`)하여 크래시 없음 + "준비 중" 폴백이 아닌 실콘텐츠 렌더 확인. editorial 없는 회차는 폴백 안전 렌더.

### 영향 범위
아카이브 해설 라우트 전용. 게임 코어 루프·OG·ping 무관(전부 별도 회귀 통과). 공유 파일 무수정.

---

## BUG-2: KST 자정 정각 카운트다운 "24:00:00" 1틱 플래시

### 심각도: **Low (P2, 코스메틱)** — 수정 완료 ✅

### 재현 스텝
1. KST 자정 정각(00:00:00.000) 시점 = 예 `2026-08-15T15:00:00Z`.
2. `msUntilMidnightKST()`가 정확히 `86_400_000`(24h) 반환(정상 — 다음 자정까지 24h).
3. `useMidnightCountdown.computeParts`가 `floor(86400000/1000)=86400초` → `hours=24` → "24:00:00" 표기.

### 기대 결과
HH는 항상 00~23. 자정 정각엔 "00:00:00".

### 실제 결과 (수정 전)
새 회차로 넘어가는 바로 그 순간 결과카드·넛지 카운트다운이 한 틱 "24:00:00" 노출.

### 수정
`src/app/dongne/components/useMidnightCountdown.ts` — `computeParts`에서 `totalMs`를 `[0, DAY_MS)`로 클램프(`% DAY_MS`). `queue.ts`의 `msUntilMidnightKST` 시맨틱은 불변(Q-04가 여전히 86400000 기대) — 표시 계층만 보정.

### 회귀 고정
`useMidnightCountdown.test.ts` — 자정 정각 `formatHMS`가 "24"로 시작하지 않고 "00:00:00"임을 assert.

### 영향 범위
표시 전용. 데이터·정답 판정 무영향.

---

## BUG-3: editorial 시드 60편 vs 임무 컨텍스트 "84편" 불일치 (데이터/문서 드리프트)

### 심각도: **Medium (P1)** — 리포트만 (미수정, 스코프·성격상 콘텐츠/문서 담당)

### 내용
실제 `src/app/dongne/data/editorial/*.json` = **60편**. 임무 컨텍스트 ④는 "84편 시드"라 명시 → 24편 갭. 방향서 §3 SLA(버퍼 30편)엔 시즌 초기 커버되나, 84 주장과 불일치.

### 권고
실제 시드 편수(60)를 확정·문서 동기화. BUG-1 수정으로 렌더 경로는 정상화됐으므로, 이후 편수만 문서/데이터 일치시키면 됨. 코드 버그 아님 → QA 스코프 밖(콘텐츠 파이프라인·PM).

### 회귀 고정
`data-integrity.test.ts` D-09 — 현재 시드 편수 60을 assert(향후 편수 변동 시 실패로 감지).

---

## 관찰 (버그 아님 · 리뷰 참고)

- **OBS-1 (UX)**: 성공(won) 시 정답 지역명이 화면 어디에도 라벨로 표시되지 않음(사용자가 직접 선택해 알긴 함). 스펙(§4-3)상 이름 노출은 실패 케이스만 요구 → 규정 위반 아님. "won에도 정답명 확인 라벨" 추가 여부는 디자인 확인 권장.
- **OBS-2 (non-blocking)**: 프리런치(today≤0)에 `ping`이 `getDateForGame(getTodayGameNo())`로 EPOCH 이전 날짜를 스탬프할 수 있음(`getDateForGame`은 gameNo<1 미가드). 로컬 env 미설정이면 204라 실피해 없고, 런칭 후 today≥1이라 무해. 저심각 — 미수정.
- **OBS-3 (설계 확인)**: OG는 `gameNo===today` 티저 200 허용, 아카이브 해설은 `gameNo>=today` 차단(200 친화). 비대칭은 의도적(OG=윤곽선 무스포 티저 / 해설=정답 노출). C-08·C-12로 각각 회귀 고정.
- **OBS-4 (수용된 저하)**: localStorage 불가 시 매 완료 `loadStats()`가 default → currentStreak 항상 1. §4-13 명문과 정합. G-15/16으로 크래시 없음만 보장.

---

## 테스트 구현 요약 (신규 9파일 · +111)

| 파일 | 케이스 | 커버 |
|---|---|---|
| `src/lib/dongne/queue.test.ts` | 34 | §3 Q-01~50 시간·출제·힌트 + fast-check 프로퍼티(Q-22 2000런, Q-49 3000런) |
| `src/lib/dongne/share.test.ts` | 8 | §6 색블록/스포일러 가드 C-01~04 (**런타임 출력 스캔** — C-01b 소스 grep 함정 회피) |
| `src/lib/dongne/storage.test.ts` | 14 | §4 스트릭/멱등/히스토그램 G-10~14 + 저장불가 폴백 G-15/16 |
| `src/app/dongne/lib/useGame.test.tsx` | 14 | §4 상태머신 G-01~12,21,23 (날짜 주입 post-launch 시뮬) |
| `src/app/api/dongne/ping/route.test.ts` | 10 | §7 P-01~11 검증·멱등·non-blocking·IP미접근(주석 제거 후 정적분석) |
| `src/app/dongne/data/data-integrity.test.ts` | 12 | §8 D-01~09 무결성 + **D-08 BUG-1 회귀** |
| `src/app/dongne/og/[gameNo]/route.test.ts` | 6 | §6 C-07~11,14 OG 404·스포가드(next/og 목) |
| `src/app/dongne/archive/[gameNo]/page.test.tsx` | 9 | §6 C-12/13 + §8 D-10/11 SSG경계 + **BUG-1 페이지 레벨 회귀** |
| `src/app/dongne/components/useMidnightCountdown.test.ts` | 4 | **BUG-2 회귀** + 포맷 |

셔플 공정성(Q-30~36)은 30사이클 실측을 회귀로 고정(전 사이클 완전순열·4바퀴 균등·경계/분구 연속회피 0건 — 전부 통과).

---

## 잔여 리스크

1. **[미커버·수동]** 실루엣 시각적 식별성(R1)·카톡 인앱 브라우저 렌더(R3)·IME 드롭다운 가림(R4) — 자동화 불가, PM/디자인 육안 + 실기기 매뉴얼 테스트 필요(설계서 §1 OUT).
2. **[운영 검증 대기]** Supabase `dongne_dau` 실 테이블 적재·7일 이동평균 게이트 쿼리는 PM 테이블 생성 후 운영 검증(스키마 SQL 정합은 코드리뷰 완료, ping은 non-blocking 계약 회귀 통과).
3. **[콘텐츠]** editorial 60편(BUG-3) — 시즌 초기 30여 회차 커버. 편수 확정·나머지 190개 code 해설은 콘텐츠 파이프라인(N-1일 SLA)로 후속. BUG-1 수정으로 렌더 경로는 준비 완료.
4. **[스타일 폴리시]** 아카이브 스탯카드가 `facts`의 긴 값(명물/한줄매력)을 mono-num 셀에 렌더 — 기능 정상, 시각 폴리시는 후속(임무 컨텍스트 ③ 명문). `.dn-archive-*` 전용 CSS 미정의(무스타일이나 크래시 없음).

---

## 게이트 최종 (§10 대비)

- [x] BUG-1 해소 · D-08 회귀 통과
- [x] queue.ts P0 전량(자정경계·결정론·4경로 동일정답·힌트) 통과
- [x] 치명 가드 P0(C-01~03,05·간접,07,08,12) 통과
- [x] ping non-blocking P0(P-03,04,07,08,09,10) 통과
- [x] 상태머신 P0(G-01~04,06,07,09,10,11,12) 통과
- [x] 데이터 무결성 P0(D-01,02,03,06,08,10) 통과
- [x] BUG-2 처리(권고 항목) · OBS-1 디자인 확인 위임
- [x] type-check · 클린 build · 719/719 그린 · 공유 파일 diff 0
