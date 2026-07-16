# 동네고수 (`/dongne`) — 프로젝트 방향서

- 작성: 2026-07-16 · 기획팀장(최종 결정)
- 상위 문서: `docs/planning/dongne-plan.md`(기획서), `docs/planning/daily-traffic-site-research.md`(리서치·전제 교정 2건 승계)
- 검토 종합: 디자인팀장 · 프론트팀장 · 백엔드팀장 3인 검토 의견
- 성격: **3일 최소 리스크 실험 + 데일리 게임 허브 1번 타자** (10만 DAU 사업 아님)
- 게이트: 런칭 30일 시점, 직전 7일 평균 **DAU ≥ 500** → 통과, 미달 시 즉시 손절

---

## 0. 팀장 종합 판정 (3인 검토 → 최종 결정)

3개 팀장 모두 **조건부 승인**. 기획서는 구현 가능 범위 안에 있고 3일 빌드 가능하다는 데 이견 없음. 검토 과정에서 드러난 **6개 충돌/교정 지점**을 아래와 같이 결정한다. 기획서와 모순되는 3건은 기획서를 수정 완료했다.

| # | 충돌/교정 지점 | 관련 팀 | 최종 결정 | 기획서 수정 |
|---|---|---|---|---|
| C1 | OG 스택 소스 = `/pae`? | 프론트(실측 정정) | **office-archetype로 정정** (`/pae`엔 동적 OG 없음) | ✅ §3-2 |
| C2 | DAU 게이트 진실 소스 | 백엔드·디자인 | **Supabase ping**(`/api/dongne/ping`+`dongne_dau`), Vercel Analytics는 게이트 미사용 | ✅ §5-1 |
| C3 | 리더보드/지역 대항전 포함? | 3팀 만장일치 | **v1 제외(OUT)** → v2. MVP는 "우리 동네" 뱃지 localStorage-only | 이미 정합 |
| C4 | 데이터 번들 전략 | 프론트·백엔드 | **빌드타임 사전계산 + 2분할 페이로드**(manifest 전체 / 오늘 실루엣만 온디맨드) | ✅ §2-1 |
| C5 | 안티치트 | 프론트 | **v1 비목표 명문화(Wordle 모델)** + 완화 3종 | ✅ §2-1 |
| C6 | 아카이브 SEO를 위한 공유 `sitemap.ts` 편집? | 백엔드(편집) vs 프론트(이연) | **프론트 채택 — v1은 공유 sitemap/robots/manifest 미편집**, 페이지 레벨 JSON-LD만 유지, sitemap 배선은 자체도메인 이전 시 | 신규 결정 |

### C6 결정 근거 (백엔드 §4 vs 프론트 §4.1 충돌 조정)
백엔드팀장은 아카이브 URL을 루트 `src/app/sitemap.ts`에 추가하자고 했고, 프론트팀장은 그것이 공유 파일 편집이라 v1엔 넣지 말자고 했다. **기획팀장 판정: 프론트 채택.** 근거 — (a) 리서치대로 신규 도메인 SEO는 6~12개월 잠김이고 30일 게이트는 **커뮤니티 시딩 DAU만으로** 판정된다 → v1에서 sitemap을 편집해 얻는 SEO 이득은 0에 수렴, (b) 애드센스 자체가 자체도메인 이전 후 신청이므로 SEO 콘텐츠 층 배선도 그때가 정합 시점, (c) 공유 `sitemap.ts` 편집은 프로덕션 문제팩토리로 blast radius를 넓힌다. **단, 아카이브 페이지 자체의 JSON-LD(Place/Article)·정적 HTML은 페이지 레벨이라 무해 → 유지**(자체도메인 이전 시 sitemap만 배선하면 SEO 자산 즉시 활성).

---

## 1. 확정 스코프 (최종)

### 포함 (IN — v1, 3일)
1. **코어 게임 루프**: 실루엣 SVG 렌더 · 지명 자동완성(행정표준코드 판정) · 6회 시도 · 힌트(haversine 거리 km · 8방위 화살표 · 근접도%) — 전부 클라이언트 순수함수.
2. **결정론적 출제**: KST 고정 UTC+9 시드 · `QUEUE[250]` 빌드타임 고정 셔플 · `src/lib/dongne/queue.ts` 단일 진실 소스.
3. **데이터 파이프라인**: 빌드타임 오프라인 스크립트로 정규화(회전 고정 정북·미러 금지·fit-to-frame 88% 패딩) → 2분할 산출물(manifest 전체 / 실루엣 개별).
4. **리텐션**: localStorage 스트릭·최고스트릭·플레이수·승률·1~6/실패 히스토그램 · "스트릭 위험" 넛지(1회).
5. **공유**: 텍스트 포맷(색블록 금지·자릿수 정렬) · OG 티저(`/dongne/og/[gameNo]`, office-archetype 스택) · "우리 동네" 뱃지(localStorage 비교).
6. **아카이브 + '어제의 동네' 해설**: `/dongne/archive`, `/dongne/archive/[gameNo]`(오늘 미만만 SSG, 미래/오늘 404) · 페이지 레벨 JSON-LD.
7. **정적 3종**: `/dongne/about` · `/dongne/privacy` · `/dongne/contact`(하위 경로 필수 — 최상위 예약어 회피).
8. **DAU 게이트 장치**: `/api/dongne/ping` + Supabase `dongne_dau` 테이블.

### 제외 (OUT)
- **영구 제외**: 로드뷰 모드(카카오/네이버 지도 API 게임 사용 약관 위반) · 🟩🟨 색블록 이모지 그리드 공유(NYT 트레이드드레스) · '-들(-dle)' 계열 네이밍.
- **v2로 이연**(게이트 통과 조건부): 실시간 지역 대항전 리더보드·지역별 정답률 집계(서버 필요) · 서버 판정 API(정답 완전 은닉) · 로그인/계정 · 웹푸시·서비스워커 · 결제/구독 · 네이티브 앱 · 다국어.
- **자체도메인 이전 시로 이연**: 애드센스 신청 · 공유 `sitemap.ts`/`robots.ts`/`manifest.ts` 배선 · 독립 Vercel 프로젝트 승격.
- **미도입(면적 정규화 트레이드오프)**: fit-to-frame으로 면적 단서 제거 = 공정성·가독성 우선 확정, 재논의 금지.

---

## 2. 기술 결정사항 (확정)

| 항목 | 결정 | 근거 |
|---|---|---|
| **KST 시드** | 고정 UTC+9 산술 `floor((Date.now()+9h−EPOCH)/86400000)`. `toLocaleString`/로컬 타임존 금지 | 해외 유저·시계 스큐 시 다른 문제 출제 방지(백엔드·프론트 공통) |
| **단일 진실 소스** | `src/lib/dongne/queue.ts` — 게임·아카이브·OG·ping 전부 import. fast-check로 자정경계·연말·wrap-around(≥250) 프로퍼티 테스트 | 게임·해설 정답 불일치 = 치명. 최우선 회귀 대상 |
| **데이터 파이프라인** | 빌드타임 오프라인(`scripts/dongne/build-regions.ts`, devDep만). 런타임 단순화 금지. 런타임 의존성 0 추가 | LCP 2.5s 예산 |
| **페이로드 2분할** | manifest.json(250 코드/이름/별칭/centroid/bbox) + silhouettes/{code}.json(오늘만 fetch) | 성능 + 전량 스포 덤프 차단 |
| **실루엣 정규화** | 회전 고정(정북 상향)·미러 금지·fit-to-frame(프레임 88%)·단일 path 솔리드 필·내부 디테일 최소(다도해는 주요 섬 2~3개만) | 방향 화살표 지리 의미 보존 = 공정성 규칙 |
| **centroid** | 기하중심 금지(섬·요철 왜곡). pole of inaccessibility 또는 소수 지역 수동 override 테이블 | "0km인데 멀게 느껴짐" 클레임 방지 |
| **행정개편 반영** | 2023-07 군위군(경북→대구) 등 최신 개편 반영. 세종시=시 단위 1문제 특례. 동명은 `구명(광역시)` 병기 | 데이터 정합 |
| **정답 판정** | 문자열 아닌 **행정표준코드 일치**. 동명 지역 자동완성에 `(시도)` 배지 항상 병기 | 오판정 방지(마지막 방어선) |
| **안티치트** | v1 비목표. 완화 3종(정답 확정 전 렌더 금지 / 오늘 실루엣만 fetch / QUEUE 코드배열만) | 서버리스 내재 속성, 리더보드 없어 무해 |
| **OG** | office-archetype 스택(`ImageResponse`/edge). `/dongne/og/[gameNo]` 회차 URL(날짜별 캐시 자동 갱신). satori raw path 제약 → SVG를 data-URI `<img>`. 시스템 sans 폴백 | `/pae`엔 동적 OG 없음(프론트 실측) |
| **DAU 게이트** | Supabase `dongne_dau(day_kst, anon_id, PK)`. 서버에서 UTC+9 스탬프. on-conflict-do-nothing dedupe. 7일 이동평균 ≥500 | 무료 Vercel Analytics 상한·샘플링 회피, 신규 env/dep 0 |
| **공유 파일 격리** | 자체 `dongne/layout.tsx`+스코프 CSS(`.dongne-shell`), `title.absolute`+`metadataBase`. globals·루트 layout·providers 무수정 | office-archetype/pae 선례, blast radius 0 |
| **디자인 토큰** | 웜 페이퍼 에디토리얼 × 카토그래픽. `.dn-shell` 스코프 CSS. 기존 로드 폰트 재사용(Black Han Sans+Pretendard) → 웹폰트 추가 0 | 실루엣 가독성(밝은 배경) + 3앱 톤 차별화 |
| **모바일** | `100dvh`+`env(safe-area-inset-*)` 강제. 단일 컬럼 max-width 480px. 게임→결과 라우팅 X, **인라인 확장**. 하단 탭바 없음 | 카톡 인앱 브라우저 `100vh` 잘림·뒤로가기 불안정 |
| **공유 아티팩트 경계** | 온스크린 결과는 색·히트맵 OK / **공유 텍스트는 색 제거·수치·화살표만**. 코드에서 물리적 분리 | 트레이드드레스 위반 원천 차단 |
| **공유 방식** | 클립보드 복사 1차 + `navigator.share` 병행(있으면). "복사됨" 마이크로 피드백 | 카톡 인앱 Web Share 불안정 |
| **v1 shared-file 변경** | **0건**(Supabase ping은 기존 env·기존 dep 재사용). @vercel/analytics·sitemap 편집 미도입 | 최소 blast radius |

---

## 3. 팀별 작업 분담 · 산출물 경로

### 데이터/공유 (프론트+백엔드 공동 소유 · D1 선행 — 전체 일정 최대 리스크)
- `scripts/dongne/build-regions.ts` (오프라인, 커밋 후 devDep 제거 가능) — GeoJSON→정규화·단순화·centroid·동명·섬·세종 처리
- `src/app/dongne/data/manifest.json` (250 코드/이름/별칭/centroid/bbox)
- `src/app/dongne/data/silhouettes/{code}.json` (지역별 정규화 path)
- `src/lib/dongne/queue.ts` (KST 시드·QUEUE·EPOCH 단일 진실 소스)

### 디자인팀 (총 6.5~9h, D1 프론트로딩, Figma 정밀목업 생략 — 토큰+스펙 직행)
- 디자인 토큰 + `.dn-shell` 셸 CSS(dvh/safe-area) → 스펙
- **실루엣 렌더 스펙 + viewBox 정규화 규칙**(데이터팀 공동, 2h — 최우선)
- 게임 화면·결과 인라인·공유 텍스트 정렬·OG 티저·"우리 동네" 금박 실링 스펙
- 아카이브 + '어제의 동네' 에디토리얼 템플릿(SEO/애드센스 톤)
- 산출물: `docs/design/dongne-*.md` (또는 코드 직행 시 `src/app/dongne/dongne.css` 토큰)

### 프론트엔드팀 (코어 UI·게임로직·공유·아카이브)
- `src/app/dongne/page.tsx` (게임: 실루엣·자동완성·힌트 6행·인라인 결과)
- `src/app/dongne/layout.tsx` + `dongne.css` (스코프 격리·metadata)
- 힌트 로직(haversine/bearing/근접도)·localStorage(스트릭·통계·히스토그램)
- `src/app/dongne/og/[gameNo]/route.tsx` (office-archetype 이식, data-URI 실루엣)
- `src/app/dongne/archive/page.tsx` + `src/app/dongne/archive/[gameNo]/page.tsx` (SSG, generateStaticParams=오늘 미만, 페이지 JSON-LD)
- `src/app/dongne/about|privacy|contact/page.tsx`

### 백엔드팀 (최소 — DAU 게이트 하나로 수렴, 약 5~7h)
- `supabase/dongne-schema.sql` (`dongne_dau` 테이블 DDL, `pae-schema.sql` 선례)
- `src/app/api/dongne/ping/route.ts` (서버 day_kst UTC+9 스탬프·유니크 dedupe, `getSupabaseAdmin` 재사용)
- 게이트 판정 쿼리/뷰(7일 이동평균) — 운영 문서
- 아카이브 SSG 배선 지원(generateStaticParams·JSON-LD, sitemap은 이연)

### QA팀
- 회귀 최우선: **queue.ts 단일 소스 일관성**(게임=아카이브=OG=ping 동일 정답), KST 자정경계·연말·wrap-around, 동명 지역 판정, 셔플 공정성
- 산출물: `docs/qa/dongne-*.md` + 테스트 코드

### PM 직접 (팀은 킷만 제공)
- 커뮤니티 시딩 실행 · 자체 도메인 구매(게이트 통과 후) · Supabase 테이블 생성 승인 · EPOCH 확정
- 시딩 킷 산출물: `docs/planning/dongne-plan.md §7`(복붙 게시글·타이밍·타깃 게시판)
- '어제의 동네' 해설 콘텐츠: AI 초안(`src/app/dongne/data/content/<code>.md`) → PM 리뷰. SLA = "N-1일 해설이 N일까지 준비", 버퍼 30편 프론트로딩(250편 전량 D3 불필요)

---

## 4. 일정 (D1 / D2 / D3)

- **D1 — 데이터 우선 + 코어**: `build-regions.ts` 파이프라인(4~6h, 폭발 시 전체 지연 → 최우선 종결) → `queue.ts` → 게임 UI + 힌트 로직 + KST 시드. 데이터 끝난 위에 UI를 쌓는 순서 고정.
- **D2 — 리텐션 + 전파**: localStorage 스트릭·히스토그램 · 결과 인라인 + 공유 텍스트 · OG route(office-archetype 이식) · "우리 동네" 실링 · 아카이브 + 해설 템플릿 · 정적 3종.
- **D3 — 측정 + 출시**: `dongne_dau` 테이블 + `/api/dongne/ping` 배선 · QA(회귀·엣지) · 크로스 배너 · 시딩 킷 최종화 · `git push mingame main` 배포. (자체 도메인·애드센스는 게이트 통과 후 PM.)

일정 총평: 3일 빠듯하나 가능. **데이터 파이프라인이 유일한 폭발 지점** — D1에 반드시 종결.

---

## 5. 미해결 리스크 · 담당

| # | 리스크 | 심각도 | 완화 | 담당 |
|---|---|---|---|---|
| R1 | **실루엣 식별성** — 광역시 자치구·소도시가 서로 안 구분(디자인 단독 불가) | 치명 | 250개 중 저식별 지역 시즌1 큐 후순위 + `시군구명(시도)` 병기. 데이터 단계 배제 플래그 | 데이터팀+디자인 합의 |
| R2 | **데이터 정합** — 최신 행정개편·섬 MultiPolygon·centroid 왜곡 | 최상위(일정) | pole of inaccessibility/수동 override, bbox 정규화+최소 표시크기, 개편 반영 | 백엔드+프론트(데이터) |
| R3 | **카톡 인앱 브라우저** — 100vh 잘림·Web Share 불안정·safe-area | 높음 | dvh+safe-area 강제, 클립보드 1차 공유, 웹푸시 v1 제외 | 프론트+디자인 |
| R4 | **한글 IME 자동완성** — 인앱 키보드가 드롭다운 가림·동명 오판정 | 높음 | 드롭다운 입력창 위/키보드 회피, 동명 `(시도)` 배지 항상 병기 | 프론트+디자인 |
| R5 | **queue.ts 불일치** — 게임과 해설/OG 정답 어긋남 | 높음 | 단일 진실 소스 강제 + fast-check 프로퍼티 테스트 | 백엔드(모듈)+QA |
| R6 | **콘텐츠 병목** — 250×1,500자 해설 | 중(게이트 무관) | 하루 1편 케이던스, 30편 버퍼 프론트로딩 | AI 초안+PM |
| R7 | **감쇠·해자 없음** — 1주 내 복제 가능 | 사업 | 30일 DAU 500 킬 스위치로 손실 3일치 한정, 속도·초반 커뮤니티 선점 | PM |
| R8 | **색블록 본능** — 개발자가 근접도를 🟩🟨로 표현하려는 유혹 | 중(법적) | 온스크린 색 OK/공유 텍스트-only 경계를 코드에서 물리 분리 | 프론트+QA |
| R9 | 안티치트 소프트 노출 | 낮음(수용) | v1 비목표 문서화 + 완화 3종. 실서버 리더보드 생기는 v2에 재검토 | 종결 |

### 보류 (PM 판단 대기)
- 자체 도메인 실제 가용성·가격(구매 직전 실조회) · 애드센스 신청 시점(게이트 통과+도메인 이전 후) · **EPOCH 실배포일 확정**(잠정 2026-08-01, 배포엔지니어와 확정) · 시즌2 콘텐츠(읍면동·랜드마크, 250문제 소진 8개월 후).

---

## 6. 기획서 수정 반영 (모순 해소 완료)
`docs/planning/dongne-plan.md`에 4건 수정 적용:
1. §3-2 OG 스택 소스 `/pae` → **office-archetype** + `/dongne/og/[gameNo]` + satori data-URI (C1)
2. §5-1 DAU 게이트 진실 소스 Vercel Analytics → **Supabase ping** (C2)
3. §2-1 데이터 파이프라인 **2분할 페이로드 + queue.ts 단일 소스 + 런타임 의존성 0** (C4)
4. §2-1 **안티치트 v1 비목표 명문화(Wordle 모델)** (C5)
