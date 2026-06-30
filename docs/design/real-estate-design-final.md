# 진짜집 디자인 최종안 v1.0

> 작성: 디자인팀장 (최종 결정권자) · 2026-06-03
> 입력: `real-estate-ux-spec.md` (UX) + `real-estate-ui-spec.md` (UI) + `real-estate-direction.md` (방향서)
> 상태: **확정 — 프론트 개발 착수 가능**
> 범위: P0 4화면 (검색 / 매물 상세 / 업로드(/verify) / 본인인증·전자동의 게이트)
> 제외: 지도뷰 (P1, M1 이후)

이 문서는 UX·UI 두 산출물을 종합한 **단일 기준(Single Source of Truth)**이다. 두 산출물이 충돌할 경우 본 문서의 결정을 따른다. 충돌·보강 사항은 각 절의 `[팀장 결정]` 블록에 명시했다.

---

## 0. 팀장 종합 결정 요약 (충돌 조정 6건)

UX·UI 산출물 간 불일치를 검토해 다음과 같이 확정한다. 개발팀은 이 표를 우선 확인하라.

| # | 충돌/불일치 항목 | UX 산출물 | UI 산출물 | **팀장 최종 결정** | 근거 |
|---|---|---|---|---|---|
| D1 | **스텝퍼 단계 수** | 5단계 (인증·동의·촬영·처리·완료) | 4단계 (본인확인·동의·사진·완료) | **5단계 채택** | 촬영·처리를 합치면 비동기 대기(30초~2분)가 스텝바에서 사라져 이탈 방지 효과가 죽는다. `VerificationStepper`를 5스텝으로 확장 |
| D2 | **Silver 색상** | 노랑/골드 `#D4A017` (§7 표) | 차가운 슬레이트 `#5B6F7A` | **슬레이트 `#5B6F7A` 채택** | Gold·Silver 둘 다 따뜻한 노랑이면 색맹·저시력에서 구분 불가. "절제·중립" 철학과도 정합. UX의 노랑은 초안으로 폐기 |
| D3 | **pending 시 점수 표기** | 확정 항목만 합산한 단일 숫자(82→72) | 하한선 `75점~` + "최대 N점 가능" | **하한선 `N점~` 방식 채택** | 단일 숫자는 "점수가 깎였다"는 오인을 부른다. `~`는 "더 오를 수 있음"을 정직하게 전달 ("비동기 정직성" 원칙) |
| D4 | **Unverified 도넛 아크 색** | — | 본문 `#9CA3AF` vs 토큰 `#6B7280` 혼재 | **토큰값 `#6B7280` (trust.unverified)로 통일** | 토큰 단일화. 도넛 코드 스켈레톤의 `#9CA3AF`는 `#6B7280`으로 교체 |
| D5 | **하단 탭 3개 vs P0 4화면** | 탭 3개(홈/업로드/내활동) | 탭 언급 없음 | **탭 3개 확정 + P0 4화면 매핑 명문화**(§2.3) | 인증·동의 게이트는 탭이 아니라 업로드 플로우 내부 스텝. `/my`(내 활동)는 탭 골격만, 콘텐츠는 빈 상태로 P0 포함 |
| D6 | **신고 진입 경로** | 바텀시트(상세 화면 직진입) | `/report` 또는 시트 양립 표기 | **바텀시트 단일 채택**(별도 라우트 없음) | 3탭 원칙 유지·페이지 전환 최소화. `/report`는 딥링크 공유용으로만 P1에서 검토 |

추가 보강(누락분 디자인팀장 권한 보충): **모바일 우선/반응형 원칙(§1.3), 다크모드 적용 범위(§1.4 결정), 마이크로카피 톤 가이드(§9), 빈 상태/에러 상태(§7)**.

---

## 1. 디자인 원칙

### 1.1 비주얼·UX 철학 (한 문단)

진짜집은 매물 광고가 아니라 **신뢰 정보 인터페이스**다. 화면에서 가장 먼저 읽혀야 하는 것은 예쁜 매물 사진이 아니라 "이 방이 진짜인가"라는 질문에 대한 답이다. 따라서 모든 화면은 ① **신뢰 신호(배지·점수·자연어 라벨)를 정보 위계의 최상단**에 두고, ② **색 하나로 판단을 강요하지 않으며(색+형태 이중 코드)**, ③ **숫자보다 사람의 말("실거주 세입자가 직접 찍음")을 앞세우고**, ④ **처리 중인 상태를 숨기거나 낙관적으로 속이지 않는다(비동기 정직성)**. 딥 네이비(#1A3352)의 절제된 톤으로 "광고처럼 보이지 않는" 중립성을 유지하되, 신뢰 등급만은 명확한 시맨틱 컬러로 또렷하게 구분한다. 한마디로 **"화려함을 빼고 신뢰를 더한다."**

### 1.2 5대 실행 원칙 (개발 판단 기준)

1. **신뢰 우선 위계**: 배지·점수·자연어 라벨이 항상 가격·사진보다 시각적으로 우선.
2. **이중 코드화 강제**: 등급은 색 + 형태(아이콘) + 텍스트 + 테두리 패턴 중 최소 3개로 표현. 색상 단독 금지.
3. **사람 언어 우선**: 숫자(82점)보다 자연어("실거주 세입자가 찍음")를 먼저, 크게.
4. **비동기 정직성**: 서버 확정 결과만 표시. 낙관적 UI 금지. pending=처리중=신고됨을 각각 다른 시각 언어로.
5. **마찰 최소 업로드**: 5단계 이탈 지점마다 탈출구·기대값·복구 경로 제공.

### 1.3 모바일 우선 / 반응형 원칙 `[팀장 보강 — 누락분]`

서비스 주 사용자(김지은·박준호 페르소나)는 **모바일 우선**이다. 375px 기준으로 먼저 설계하고 위로 확장한다.

| 브레이크포인트 | 폭 기준 | 레이아웃 | 비고 |
|---|---|---|---|
| 모바일 (기본) | ~767px | 1컬럼, 좌우 여백 `screen-x`(20px), 하단 탭바 노출 | 모든 화면의 기준 |
| 태블릿 | 768px~1199px | 리스트 2컬럼, 좌우 여백 32px | 하단 탭바 유지 |
| 데스크톱 | 1200px~ | 리스트 3컬럼, 상세 `max-w-3xl` 중앙 정렬 | 하단 탭 → 상단 네비 전환(P1), M0는 모바일 레이아웃 그대로 중앙 정렬 허용 |

- 하단 고정 CTA(문의하기)·하단 탭바는 모바일·태블릿에서 `position: sticky/fixed`. iOS Safe Area(`env(safe-area-inset-bottom)`) 패딩 반영.
- 터치 타깃 최소 44×44px 전 화면 공통.
- M0는 **모바일·태블릿을 완성도 목표로**, 데스크톱은 "깨지지 않는" 수준(중앙 정렬 + max-width)까지만.

### 1.4 다크모드 결정 `[팀장 결정 — 누락분 명확화]`

UI 스펙이 다크모드 토큰을 정의했으나, **M0(P0)에서 다크모드는 "토큰만 정의, UI 미적용"으로 확정**한다.

- 이유: 신뢰 배지의 색맹·명도 대비 검증을 라이트 모드 한 벌로 먼저 완성하는 것이 우선. 다크 배지 대비비 재검증 부담을 M0에 얹지 않는다.
- 조치: `tailwind.config.ts`에 `darkMode: ["class"]`는 이미 존재하므로 다크 토큰은 **CSS 변수/주석으로 보존**하되, 컴포넌트에 `dark:` 분기는 M0에서 작성하지 않는다.
- 재개 시점: M1 폴리싱 단계. (미해결 항목 등록)

---

## 2. 확정 IA + 화면 인벤토리

### 2.1 화면 계층 맵 (확정)

```
진짜집 (/)
│
├── [P0·탭1] 검색 홈 (/)
│     ├─ 신뢰순 정렬 리스트 (기본, 서버 사전계산)
│     ├─ 지역 퀵탭 + 필터(가격/평수/배지등급)
│     └─ ListingCard → 매물 상세
│
├── [P0] 매물 상세 (/listings/[id])  ※RSC
│     ├─ 사진 갤러리(블러 통과본)
│     ├─ 신뢰 스코어 패널(featured 배지 + 미디엄 도넛)
│     ├─ ScoreBreakdown 5항목 막대 분해
│     ├─ 매물 기본 정보
│     ├─ 신고하기 → ReportSheet(바텀시트)
│     └─ 문의하기(하단 고정 Primary CTA)
│
├── [P0·탭2] 세입자 업로드 (/verify)  ※클라
│     ├─ VerificationStepper (5단계)
│     ├─ Step1 본인인증(PASS) ─┐
│     ├─ Step2 전자동의        ├─ /auth/verify 게이트 내장
│     ├─ Step3 사진 촬영/선택  ┘
│     ├─ Step4 처리 대기(폴링/Realtime)
│     └─ Step5 결과(Before/After + 등급 피드백)
│
├── [P0] 본인인증·전자동의 게이트 (/auth/verify)
│     └─ 업로드 플로우 Step1~2로 진입(독립 탭 없음)
│
└── [P0·탭3] 내 활동 (/my)  ※골격만, 콘텐츠 빈 상태
      └─ "아직 활동이 없습니다" 빈 상태 + [방 인증하기]
```

### 2.2 화면 인벤토리 (P0/P1)

| 우선순위 | 화면 | 라우트 | 렌더링 | 핵심 컴포넌트 | M0 완성도 |
|---|---|---|---|---|---|
| **P0** | 검색 홈 | `/` | CSR + 서버데이터 | ListingCard, TrustScoreBadge(compact), 필터 | 완성 |
| **P0** | 매물 상세 | `/listings/[id]` | **RSC** + 스켈레톤 | TrustScoreBadge(featured), ScoreBreakdown, PhotoGallery, ReportSheet | 완성 |
| **P0** | 업로드 | `/verify` | CSR | VerificationStepper(5), PhotoUploader, BeforeAfterSlider | 완성 |
| **P0** | 인증·동의 게이트 | `/auth/verify` | CSR | ConsentChecklist, PASS 버튼 | 완성 |
| **P0** | 내 활동 | `/my` | CSR | EmptyState | 골격(빈 상태) |
| P1 | 지도뷰 | `/map` | — | (지도 SDK) | 제외 |
| P1 | 이사 인증서 | `/my/certificate` | — | — | 제외 |
| P1 | 중개사 매물관리 | `/agent` | — | — | 제외 |

### 2.3 하단 탭 3개 ↔ P0 4화면 매핑 `[팀장 결정 D5]`

```
[하단 탭바 — 3개 핵심 탭, 높이 56px + Safe Area]
 ┌──────────┬──────────┬──────────┐
 │  [홈/검색] │  [업로드]  │ [내 활동] │
 │    /      │  /verify  │   /my    │
 └──────────┴──────────┴──────────┘

[상단 헤더 — 높이 48px]
 로고(좌) → /   |   검색창(중앙, 홈에서만 확장)   |   알림(우)
```

**탭과 P0 4화면의 관계 (개발 혼동 방지):**
- 탭은 **3개**다. P0 화면은 **5개**(매물 상세 + 인증·동의 게이트는 탭이 아님).
- `매물 상세(/listings/[id])`: 탭 없음. 검색 탭에서 카드 탭으로 진입하는 **하위 화면**. 진입 시 하단 탭바는 유지하되 하단 고정 CTA(문의하기)가 탭바 위에 겹쳐 표시.
- `인증·동의 게이트(/auth/verify)`: 탭 없음. **업로드 탭(/verify)의 Step1~2 내부**로 흡수. 독립 라우트는 PASS 딥링크 콜백 처리용으로만 유지.
- `신고(ReportSheet)`: 라우트·탭 없음. 상세 화면에서 **바텀시트**로만 진입.
- 네비게이션 원칙: 소비자 경로(검색)와 세입자 경로(업로드)를 탭으로 분리해 **역할 혼동 방지**.

---

## 3. 디자인 토큰 최종본

UI 스펙의 토큰을 확정본으로 채택한다. 모든 진짜집 토큰은 `realestate.*` 네임스페이스로 격리하며, **기존 `tailwind.config.ts`의 오름(Oreum) 토큰(primary/accent/health/learn/relate/achieve/semantic/surface/persona)은 절대 덮어쓰지 않고 `theme.extend`에 병합 추가**한다.

> 현 `tailwind.config.ts` 확인 결과: `realestate` 키 없음 → 신규 추가. `health.500 = #2E9E55`(그린)는 스텝퍼 "완료" 색으로 재사용 가능.

### 3.1 컬러 — realestate 네임스페이스 (확정)

```typescript
// tailwind.config.ts — theme.extend.colors 에 병합 (기존 키 유지)
realestate: {
  brand: {
    primary: "#1A3352",        // 딥 네이비 — 신뢰·안정 (Primary CTA, 포커스 링)
    sub: "#2E5D8A",            // 미디엄 네이비 — 링크·강조
    "primary-light": "#E8EEF4",
    "sub-light": "#EBF2FA",
  },
  trust: {                     // 신뢰 등급 (이중 코드화 핵심)
    gold: "#B8860B",           // 다크 골드 전경/아이콘
    "gold-bg": "#FEF7E0",
    "gold-border": "#E6C547",
    silver: "#5B6F7A",         // [D2] 슬레이트 확정 (노랑 폐기)
    "silver-bg": "#EEF2F4",
    "silver-border": "#9EB2BC",
    unverified: "#6B7280",     // [D4] 도넛 아크도 이 값으로 통일
    "unverified-bg": "#F3F4F6",
    "unverified-border": "#D1D5DB",
  },
  amber: {                     // 미인증·경고 톤
    warn: "#B45309",
    "warn-bg": "#FFFBEB",
    "warn-border": "#FCD34D",
    "warn-light": "#FEF3C7",
  },
  state: {                     // 비동기 상태
    pending: "#6B7280",
    "pending-bg": "#F9FAFB",
    processing: "#2563EB",
    "processing-bg": "#EFF6FF",
    reported: "#DC2626",
    "reported-bg": "#FEF2F2",
  },
  neutral: {                   // 정보 계층 그레이
    950: "#0A0A0A", 900: "#1A1A1A", 700: "#374151",
    500: "#6B7280", 300: "#D1D5DB", 200: "#E5E7EB",
    100: "#F3F4F6", 50: "#F9FAFB",
  },
},
```

### 3.2 타이포그래피 — realestate 추가분 (확정)

Pretendard Variable 계승. 진짜집 의미론 스케일 4종 추가.

```typescript
// theme.extend.fontSize 에 병합
"trust-label": ["13px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.02em" }],  // 배지 등급 텍스트
"trust-score": ["22px", { lineHeight: "1.0", fontWeight: "700", letterSpacing: "-0.01em" }], // 점수 숫자
"trust-desc":  ["12px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.01em" }],  // 자연어 설명
"price":       ["20px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }], // 가격 숫자
```

> 위계 규칙: 카드/상세에서 **자연어 라벨(trust-desc)과 등급 라벨(trust-label)이 가격(price)보다 시각 우선**. 점수 숫자(trust-score)는 도넛과 한 쌍.

### 3.3 스페이싱·라운드·섀도 — realestate 추가분 (확정)

```typescript
// theme.extend.spacing
"card-pad": "16px", "card-gap": "12px",
"badge-pad-x": "8px", "badge-pad-y": "4px",
"section-gap": "24px", "score-gap": "6px",

// theme.extend.borderRadius
badge: "6px",   // 신뢰 배지 전용 (카드 lg=12px, 시트 xl=16px는 기존 재사용)

// theme.extend.boxShadow
"card-trust": "0 2px 8px rgba(26,51,82,0.10)",  // 진짜집 카드 전용
"badge-gold": "0 1px 4px rgba(184,134,11,0.25)", // Gold 광채
```

### 3.4 토큰 → Tailwind 클래스 매핑 치트시트 (개발용)

| 디자인 의미 | Tailwind 클래스 예시 |
|---|---|
| Gold 배지 컨테이너 | `bg-realestate-trust-gold-bg border border-realestate-trust-gold-border rounded-badge shadow-badge-gold` |
| Gold 전경 텍스트/아이콘 | `text-realestate-trust-gold` |
| Silver 배지 | `bg-realestate-trust-silver-bg border border-realestate-trust-silver-border text-realestate-trust-silver rounded-badge` |
| Unverified 배지 | `bg-realestate-trust-unverified-bg border-[1.5px] border-dashed border-realestate-trust-unverified-border text-realestate-trust-unverified rounded-badge` |
| 앰버 경고 배너 | `bg-realestate-amber-warn-bg border border-realestate-amber-warn-border text-realestate-amber-warn rounded-sm` |
| Primary CTA | `bg-realestate-brand-primary text-white rounded-md` |
| 카드 | `bg-white rounded-lg shadow-card-trust border border-realestate-neutral-200 p-card-pad` |
| pending 칩 | `bg-realestate-state-pending-bg text-realestate-state-pending border border-dashed` |
| processing 칩 | `bg-realestate-state-processing-bg text-realestate-state-processing` |
| reported 배너 | `bg-realestate-state-reported-bg text-realestate-state-reported` |
| 가격 | `text-price text-realestate-neutral-900` |
| 자연어 라벨 | `text-trust-desc text-realestate-neutral-700` |
| 포커스 링(공통) | `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary` |

---

## 4. 신뢰 배지·스코어 시각 시스템 (서비스의 심장)

배점·컷오프는 방향서 2장을 그대로 따른다: **Gold ≥80 / Silver 55~79 / Unverified <55**. 5항목 배점: 세입자사진 35 · EXIF·생활흔적 20 · 커뮤니티신뢰 20 · 소유자검증 15 · 거래정황 10.

### 4.1 배지 3등급 (색+형태 이중 코드 — 색맹 대응 강제)

| 등급 | 컷오프 | 배경/전경/테두리 | **형태 코드(Lucide)** | 테두리 패턴 | 라벨 | 자연어 설명 |
|---|---|---|---|---|---|---|
| **Gold** | ≥80 | `#FEF7E0` / `#B8860B` / `#E6C547` + 광채섀도 | **`ShieldCheck`** (방패+체크, stroke 2px) | **실선** | "실거주 인증" | "실거주 세입자가 직접 찍은 사진이 검증됐어요" |
| **Silver** | 55~79 | `#EEF2F4` / `#5B6F7A` / `#9EB2BC` | **`Camera`+`MapPin` 합성** (렌즈 우하단 핀 8px) | **실선** | "현장 인증" | "현장에서 촬영한 사진이 있어요" |
| **Unverified** | <55 | `#F3F4F6` / `#6B7280` / `#D1D5DB` + **앰버 배너 병행** | **`HelpCircle`** (점선원+물음표) | **점선 1.5px** | "미인증" | "아직 현장 검증이 되지 않은 매물이에요" |

**이중 코드 보장 규칙 (색 없이도 구분):**
- Gold↔Silver: 아이콘 형태가 완전히 다름(방패 vs 카메라).
- Silver↔Unverified: 테두리 패턴이 다름(실선 vs **점선**).
- Unverified: 점선 + 물음표 + **앰버 경고 배너** 3중 비색상 코드.
- 아이콘 크기: 인라인 16px / 상세 패널 24px / 스텝완료 28px.

### 4.2 미니 도넛 (TrustDonut) — 확정

| 컨텍스트 | 외경 | 내경 | 선두께 | 사용처 |
|---|---|---|---|---|
| 미니 | 28px | 16px | 6px | 리스트 카드 인라인(점수는 도넛 우측 병치) |
| 스몰 | 36px | 22px | 7px | 컴팩트 배지 단독 |
| 미디엄 | 52px | 32px | 10px | 상세 스코어 패널 헤더(점수 중앙) |

- 아크: 점수 0~100 → 0~360°, 시작 12시(-90deg), `strokeLinecap="round"`.
- 트랙: `#E5E7EB`(neutral-200). 아크 색: Gold `#B8860B` / Silver `#5B6F7A` / **Unverified `#6B7280`**(D4 통일).
- 최소 아크: 5점 미만도 ≥8px 표시(빈 도넛 방지).
- 애니메이션: 진입 시 0→점수 500ms easeOut. **`prefers-reduced-motion`에서 즉시 최종값**.
- 구현: SVG `<circle>` + `stroke-dasharray`/`stroke-dashoffset`. (D4 반영: 스켈레톤 코드의 `#9CA3AF`를 `#6B7280`으로 교체)

### 4.3 5항목 막대 분해 (ScoreBreakdown) — 차별화의 핵심

상세 화면에서 "왜 이 점수인지"를 항목별로 투명 공개. 직방·다방과 체감 차이를 만드는 지점.

| 순서 | 항목 | 배점 | 사람 언어 라벨 | 아이콘(Lucide) |
|---|---|---|---|---|
| 1 | 실거주 세입자 사진 | 35 | "직접 찍은 사진" | `Camera` |
| 2 | EXIF·생활흔적 정합 | 20 | "사진 진위 검증" | `ScanSearch` |
| 3 | 커뮤니티 신뢰 | 20 | "신고·이상 없음" | `Users` |
| 4 | 소유자·등록자 검증 | 15 | "등록자 확인" | `BadgeCheck` |
| 5 | 거래 정황 플래그 | 10 | "거래 이상 없음" | `TrendingDown`(정상 시 회색) |

**막대 스펙:**
- 너비 100%(패딩 제외), 높이 8px(미니)/10px(상세), 트랙 `#E5E7EB`, 라운드 `full`.
- 채움 색: 100% 획득=등급 컬러, 부분=등급 컬러 70% 투명, 0점=트랙 동색, **pending=`#9CA3AF` + 점선 패턴 오버레이**.
- 배치: 좌측 아이콘(16px)+라벨, 우측 `획득/배점`(분모 항상 공개).
- 막대 채움 애니메이션: 0→값 600ms easeOut (`reduced-motion` 시 즉시).

**항목 상태 표기:**

| 상태 | 막대 | 우측 텍스트 |
|---|---|---|
| 검증완료 | 등급 컬러 채움 | `28/35` |
| **pending** | `#9CA3AF` 점선 | "검증 대기 중" (0점 표기 금지) |
| 처리중 | `#2563EB` 점멸 | "분석 중" |
| 신고됨(감점) | `#DC2626` | "신고 접수됨 −N점" |

> pending 보조 카피(필수): "이 항목의 미검증은 허위매물 신호가 아니에요 — 검증 완료 시 점수에 반영돼요."

### 4.4 총점 표기 규칙 `[팀장 결정 D3]`

| 조건 | 표기 방법 |
|---|---|
| 모든 항목 확정 | 확정 점수 숫자 + 도넛 (예: `82점`) |
| **일부 pending** | **하한선 `N점~` + 보조 "최대 M점까지 가능"** (예: 확정 72 → `72점~`, 보조 "최대 92점") |
| 처리중 | 숫자 자리에 스피너. 낙관 수치 금지 |
| 신고됨 | 점수 취소선 + "신고 검토 중" |

- 배지 등급은 **확정 항목만으로 컷오프 충족 시 해당 등급 부여**(pending이 있어도 나머지로 Gold면 Gold).
- UX 스펙의 "82→72 단일 숫자" 방식은 폐기. `~` 표기로 "더 오를 수 있음"을 정직하게 전달.

---

## 5. 화면별 스펙 (P0 4화면)

각 화면: **구성 컴포넌트 / 영역 우선순위 / 주요 상태 / 엣지 상태**.

### 5.1 검색 홈 (`/`)

**구성 컴포넌트(상→하):**
1. 헤더(48px): 로고 + 알림 아이콘
2. 검색바(56px): 검색 인풋 + 지역 퀵탭(관악/마포) + 필터 트리거
3. 정렬·카운트 바: `신뢰순▼`(서버 사전계산, **프론트 정렬 금지**) + "147개 매물"
4. 필터 탭(칩): 전체 / 실거주 인증 / 현장 인증 — `TrustScoreBadge compact` 스타일 칩
5. 리스트: `ListingCard × N`, 커서 무한스크롤
6. 하단 탭바(56px + Safe Area)

**영역 우선순위:** ① 배지+자연어 라벨 ② 가격 ③ 면적/위치 ④ 썸네일.

**주요 상태:** 기본(신뢰순, Gold 상단) / 필터 적용 / 무한스크롤 로딩(하단 스켈레톤 카드 3개) / 전체 로드 완료("관악·마포의 모든 매물을 보셨습니다").

**엣지 상태:**
- 검색 0건(서비스 외 지역): "현재 관악구·마포구에서 서비스 중입니다" + [관악구 보기][마포구 보기].
- 처리중 카드: 스켈레톤 썸네일 + "분석 중", 신뢰순 **리스트 후미** 배치.
- pending 포함 카드: 점수 옆 `*` + 툴팁("외부 확인 중 항목 있어 점수 변동 가능").
- 신고됨 카드: 검색 리스트에서 **즉시 제거**(비공개 전환과 동시). 직접 URL 접속만 신고 검토 화면.
- 네트워크 오류: 구름+번개 아이콘 + "잠시 연결이 끊겼습니다" + [다시 시도].

### 5.2 매물 상세 (`/listings/[id]`) — RSC

**구성 컴포넌트(상→하):**
1. 사진 위 오버레이 네비: ←뒤로 / 공유 / 저장♡
2. PhotoGallery(폭×60vw): 블러 통과본만, 스와이프, `1/6` 인디케이터
3. **신뢰 스코어 패널(핵심 구역)**: `TrustScoreBadge featured` + 미디엄 도넛(52px) + 자연어 라벨
4. **ScoreBreakdown**: 5항목 막대 + [항목 상세 보기 ▼]
5. 매물 기본 정보: 위치/평형/층/방향, 가격, 관리비, 입주가능일
6. 세입자 한마디(선택)
7. 신고하기(작은 텍스트 링크) → ReportSheet
8. 하단 고정: 문의하기(Primary CTA, 56px)

**영역 우선순위:** ① 신뢰 스코어 패널(스크롤 없이 절반 노출) ② 갤러리 ③ 문의 CTA ④ 기본 정보.

**주요 상태:** RSC 초기 로딩 스켈레톤 → 콘텐츠. 막대 채움 애니메이션.

**엣지 상태:**
- **pending 항목 포함**: 해당 막대 "검증 대기 중", 총점 `N점~`, 배지는 확정분으로 등급 판정(§4.4).
- **신고됨(reported)**: 갤러리 흐림 오버레이 + 상단 앰버 배너("신고 검토 중, 문의 제한") + 커뮤니티 항목 "검토 중"(앰버) + **문의 버튼 비활성**.
- **테이크다운(taken_down)** / 404: "이 매물은 더 이상 없습니다 — 거래 완료됐거나 허위매물로 내려갔을 수 있습니다" + [다른 매물 보기].

### 5.3 세입자 업로드 (`/verify`) — 5단계 `[팀장 결정 D1]`

**구성:** 상단 `VerificationStepper(5단계)` 고정 + 현재 스텝 콘텐츠.

```
●─────○─────○─────○─────○
인증   동의   촬영   처리   완료
(30초) (1분)  (2분)  (2분)
```

| 스텝 | 화면 콘텐츠 | 주요/엣지 상태 |
|---|---|---|
| **1 인증** | `[PASS 인증하기]` Primary(56px 풀위드) + "통신사 본인인증·1탭 완결" | 실패: "본인인증 실패 — [사유]. 재시도/고객센터". PASS 미설치: 앱스토어 유도 + SMS/이메일 폴백 |
| **2 동의** | 핵심 3개 체크박스 + [모두 동의하고 계속] + 전문 아코디언 + 약관 버전 표기 | 미동의 시 진행 버튼 비활성 |
| **3 촬영** | `[앱 카메라로 찍기]` Primary(초록) "EXIF 자동기록·점수 최대화" / `[사진첩]` Secondary + **앰버 경고**("외부 사진 EXIF 검증 어려움") + 촬영 가이드 | 카메라 권한 거부: "설정에서 허용" 딥링크 / "사진첩 사용"(앰버 후 계속) |
| **4 처리** | 원형 진행 애니메이션 + 3단계 진행 카피 + `[알림 켜고 나중에 확인]` 탈출구 | 2분 초과: "조금 더 걸려요 — 알림 켜기/계속 기다리기". **이탈 허용**(서버 처리 계속) |
| **5 완료** | BeforeAfterSlider(원본/블러) + [수동 블러 보정] + [게시하기]/[다시 찍기] → 결과(배지 애니메이션 + `+점수`) | 블러 실패: "AI 처리 중 — 잠시 후 확인". EXIF 불일치: "이 매물 위치에서 찍힌 사진이 아닌 것 같아요" |

**처리중(Step4) 3단계 카피:**
```
0~30초 : "사진을 안전하게 저장하고 있습니다"   [0~30%]
30초~1분: "AI가 개인정보를 감지하고 있습니다"   [30~60%]
1~2분  : "생활흔적을 분석하고 있습니다"        [60~90%]
완료   : 자동 Step5 진입                       [100%]
```

**낙관적 UI 금지**: 처리 완료(서버 확정) 전까지 점수·등급 표시 금지. 폴링/Realtime 구독으로 Step5 자동 전환.

**이탈 방지(공통):** 뒤로/X 시 "지금 나가면 진행이 저장되지 않습니다" 확인 다이얼로그. **단 Step4(처리중)는 다이얼로그 없이 즉시 이탈 허용** + 알림 권유. 재진입 시 "이어서 하기" → 마지막 단계 직행.

### 5.4 본인인증·전자동의 게이트 (`/auth/verify`)

업로드 Step1~2로 흡수되나, PASS 딥링크 콜백(`/verify?step=2&token=`) 처리를 위해 라우트 유지.

**구성:** 제목 + 핵심 3개 필수 동의 체크박스(각 전문 아코디언) + 선택 동의 1개(퇴거 후 사진 보존) + `[모두 동의하고 계속]` + 약관 버전(`v1.2 · 2026-06-03`).

**필수 동의 3개:** ①사진 게시 주체=세입자 본인 ②AI 자동 블러링 처리 ③신고 시 즉시 비공개 전환.

**영역 우선순위:** ① 3개 동의(모두 동의 숏컷으로 마찰 최소) ② 전문 아코디언(필요시) ③ 버전 표기(불변 로그 연계).

**엣지 상태:** IP·타임스탬프·약관버전 불변 로그는 서버 기록(사용자 미노출).

---

## 6. 컴포넌트 라이브러리 최종 목록

전 컴포넌트 **Radix UI primitives + Tailwind** 기반, TypeScript strict. 구현 우선순위는 방향서 의존 규칙(W1 토큰·배지 최우선)을 따른다.

### 6.1 구현 우선순위 (개발 착수 순서)

| 순위 | 컴포넌트 | 이유 | 의존 |
|---|---|---|---|
| **P0-1** | `tailwind.config.ts` 토큰 병합 | 모든 컴포넌트 선행 조건(W1 차단 해제) | 없음 |
| **P0-2** | `TrustDonut` | 배지·카드·상세 공통 의존 | 토큰 |
| **P0-3** | `TrustScoreBadge` | 서비스 심장, 3화면 사용 | TrustDonut |
| **P0-4** | `ScoreBreakdown` | 상세 차별화 핵심 | 토큰 |
| **P0-5** | `ListingCard` | 검색 화면 핵심 | Badge, Donut, Breakdown(mini) |
| **P0-6** | `VerificationStepper`(5) | 업로드 골격 | 토큰 |
| **P0-7** | `PhotoUploader` | 업로드 핵심 | Stepper, Radix Progress/Dialog |
| **P0-8** | `BeforeAfterSlider` | 블러 신뢰 | 토큰 |
| **P0-9** | `ReportSheet` | 신고 플로우 | Radix Sheet/RadioGroup |
| **P0-10** | `StatusChip` | 비동기 상태 공통 | 토큰 |
| **P0-11** | `EmptyState` / `ErrorState` | 빈·오류 상태 공통 | 토큰 |

### 6.2 컴포넌트 Props 요지

**`TrustScoreBadge`**
```typescript
interface TrustScoreBadgeProps {
  grade: "gold" | "silver" | "unverified";
  score: number;                  // 0~100
  scoreIsLowerBound?: boolean;    // [D3] true면 "N점~" 표기
  maxPossibleScore?: number;      // pending 시 "최대 M점" 보조
  naturalLabel?: string;          // 자연어 우선 노출
  showDonut?: boolean;
  showScore?: boolean;
  variant?: "compact" | "standard" | "featured";
  className?: string;
}
// role="status", aria-label="신뢰 등급: 실거주 인증, 82점, [자연어]"
// Unverified는 하단에 앰버 경고 스트립 자동 렌더
```

**`TrustDonut`**
```typescript
interface TrustDonutProps {
  score: number;                  // 0~100
  grade: "gold" | "silver" | "unverified";
  size?: "mini" | "small" | "medium";  // 28/36/52px
  showScore?: boolean;            // 중앙 또는 병치
  // role="img", aria-label="신뢰 점수 82점 도넛 차트"
  // prefers-reduced-motion: 애니메이션 생략
}
```

**`ScoreBreakdown`**
```typescript
interface ScoreBreakdownItem {
  key: "photo" | "exif" | "community" | "owner" | "transaction";
  earned: number | null;          // null = pending (0점 아님)
  max: number;
  status: "verified" | "pending" | "processing" | "reported";
  deltaIfReported?: number;       // 신고 감점
}
interface ScoreBreakdownProps {
  items: ScoreBreakdownItem[];
  variant?: "mini" | "detail";    // 카드/상세
  // 각 막대 role="progressbar" aria-valuenow/valuemax
}
```

**`ListingCard`**
```typescript
interface ListingCardProps {
  id: string; title: string; address: string;
  deposit: number; monthlyRent: number;
  trustScore: number; trustGrade: "gold"|"silver"|"unverified";
  naturalLabel: string; thumbnailUrl?: string;
  scoreBreakdown: ScoreBreakdownItem[];
  status?: "verified" | "pending" | "processing"; // reported는 리스트 제외
  // 카드 전체 탭 영역, tabIndex=0, role="article", Enter/Space→상세
  // Unverified: border-top 4px 앰버 스트립
}
```

**`VerificationStepper` [D1 — 5단계]**
```typescript
interface VerificationStepperProps {
  currentStep: 1 | 2 | 3 | 4 | 5;  // 인증/동의/촬영/처리/완료
  stepStatuses?: Record<number, "completed"|"current"|"upcoming"|"error">;
  estimatedTimes?: string[];       // ["30초","1분","2분","2분",""]
  // role="progressbar" valuemin=1 valuemax=5
}
```

**`PhotoUploader`**
```typescript
interface PhotoUploaderProps {
  listingId: string;
  onUploadComplete: (result: UploadResult) => void;
  maxFiles?: number;     // 10
  maxSizeMB?: number;    // 20
  captureMode?: "camera" | "gallery" | "both";  // both
  // 상태: IDLE→PREVIEW→UPLOADING→PROCESSING→SUCCESS/ERROR
  // 클라 EXIF/블러 처리 금지(서버 전담), 낙관적 UI 금지
  // <input accept="image/*" capture="environment">
}
```

**`ReportSheet`**
```typescript
interface ReportSheetProps {
  listingId: string; listingTitle: string;
  open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (report: ReportPayload) => Promise<void>;
  // Radix Sheet(모바일 75%h, 데스크톱 우측 480px)
  // RadioGroup 신고유형 + Textarea(선택,200자) + 증거사진(경량)
  // 제출 즉시 notice-and-takedown → 비공개 전환
}
```

**`StatusChip`**
```typescript
interface StatusChipProps {
  status: "pending" | "processing" | "reported";
  // pending: 점선 회색 "검증 대기 중"
  // processing: animate-spin "분석 중" (reduced-motion 시 정적 아이콘)
  // reported: 레드 "신고 접수됨"
}
```

**`BeforeAfterSlider`** / **`EmptyState`** / **`ErrorState`**: 토큰만 의존, 단순 표현 컴포넌트.

### 6.3 Radix 의존 매핑

| 컴포넌트 | Radix primitive |
|---|---|
| ListingCard | `AspectRatio`(썸네일 16:9), `Tooltip`(항목 미니바) |
| PhotoUploader | `Dialog`(블러 보정), `Progress`(진행률), `AlertDialog`(이탈 확인) |
| ReportSheet | `Dialog`/Sheet, `RadioGroup`, `Label` |
| 동의 게이트 | `Checkbox`, `Accordion`(전문), `Label` |
| 모든 모달 | Radix 포커스 트랩 + ESC 닫기 기본 활용 |

### 6.4 아이콘 — Lucide React

`npm install lucide-react`. stroke 1.5px(기본)/2px(배지 강조), viewBox 24×24, `currentColor` 상속.

핵심 매핑: Gold=`ShieldCheck` · Silver=`Camera`+`MapPin`(합성) · Unverified=`HelpCircle` · 경고=`AlertTriangle` · pending=`Clock` · processing=`Loader2`(spin) · reported=`Flag` · 5항목=`Camera`/`ScanSearch`/`Users`/`BadgeCheck`/`TrendingDown` · 스텝완료=`CheckCircle2`.

---

## 7. 비동기/엣지 상태 디자인

### 7.1 5대 상태 시각 언어 (확정)

| 상태 | 정의 | 사용자 언어 | 시각 처리 | 색 토큰 |
|---|---|---|---|---|
| `pending` | 외부 미검증 (**미검증 ≠ 위반**) | "검증 대기 중 (외부 확인 대기)" | 회색 점선 막대/칩 + "위반 아님" 보조 카피 | `state-pending` `#6B7280` |
| `processing` | 서버 파이프라인 처리 중 | "분석 중…" | 파란 펄스/스피너 + 진행 안내. **낙관 수치 금지** | `state-processing` `#2563EB` |
| `reported` | 신고 접수→비공개 전환 | "신고 검토 중" | 앰버/레드 배너 + 갤러리 흐림 + 문의 비활성 | `state-reported` `#DC2626` |
| `taken_down` | 영구 비공개 확정 | "이 매물은 내려갔습니다" | 전체 회색 처리 / 404 대체 화면 | neutral |
| `verified` | 검증 완료 | 점수 + 자연어 라벨 | 등급 배지(색+형태) | trust.* |

### 7.2 빈 상태 (EmptyState) `[팀장 보강]`

| 위치 | 카피 | 액션 |
|---|---|---|
| 검색 0건(서비스 외 지역) | "검색 결과가 없습니다 / 현재 관악구·마포구에서 서비스 중입니다" | [관악구 보기][마포구 보기] |
| 검색 0건(필터 과다) | "조건에 맞는 매물이 없어요 / 필터를 조정해보세요" | [필터 초기화] |
| 내 활동 첫 방문 | "아직 활동이 없습니다 / 방을 인증하면 등급과 인증서를 확인할 수 있어요" | [방 인증하기] |
| 알림 없음 | "새 알림이 없습니다" | — |

### 7.3 에러 상태 (ErrorState) `[팀장 보강]`

| 유형 | 카피 | 액션 |
|---|---|---|
| 네트워크 | "잠시 연결이 끊겼습니다" (구름+번개 아이콘) | [다시 시도] |
| 매물 404/테이크다운 | "이 매물은 더 이상 없습니다 / 거래 완료됐거나 허위매물로 내려갔을 수 있어요" | [다른 매물 보기] |
| PASS 인증 실패 | "본인인증에 실패했습니다 / 이유: [구체 사유]" | [다시 시도][고객센터] |
| 업로드 파일 오류 | "사진 업로드 실패 / 20MB 이하 JPG·PNG를 사용해주세요" | [다시 선택] |
| EXIF 불일치 | "이 매물 위치에서 찍힌 사진이 아닌 것 같아요" | [다시 찍기][그래도 제출] |
| 블러 실패 | "개인정보 보호 처리 중이에요 / 잠시 후 다시 확인해주세요" | [새로고침] |

**에러 공통 규칙:** 아이콘 + 텍스트 조합(아이콘 단독 금지), **복구 방법 항상 제시**, 책임 전가 표현("당신이 잘못") 금지.

### 7.4 인터랙션·모션 노트

| 인터랙션 | 사양 | reduced-motion 대체 |
|---|---|---|
| 배지 획득(결과) | scale 0.8→1.0 + 페이드인 200ms ease-out, Gold는 컨페티 1회 | 즉시 표시, 컨페티 생략 |
| 도넛 드로우 | 0→점수 500ms ease-out | 즉시 최종값 |
| 막대 채움 | 0→값 600ms ease-out | 즉시 최종값 |
| 점수 카운트업 | 숫자 롤업 | 즉시 최종 숫자 |
| 스텝 완료 | 원→체크 150ms | 정적 체크 |
| processing 스피너 | `animate-spin` | 정적 `CircleDashed` |
| 바텀시트 | 아래→위 250ms spring, 스크림 50% | 페이드만 |
| BeforeAfter | 수직 슬라이더 드래그, 기본 50/50 | 정적 분할 유지 |
| 무한스크롤 | 하단 스켈레톤 3개 | 동일 |

---

## 8. 접근성 기준 (WCAG 2.1 AA + 색맹 대응)

### 8.1 색맹 대응 — 이중 코드화 (확정·강제)

| 등급 | 색 | 형태 | 텍스트 | 패턴 |
|---|---|---|---|---|
| Gold | 황금 | 방패+체크 | "실거주 인증" | 실선 |
| Silver | **슬레이트(D2)** | 카메라+핀 | "현장 인증" | 실선 |
| Unverified | 연회색 | 물음표 | "미인증" | **점선** + 앰버 배너 |

검증 통과 기준: 적녹·청황·전색맹 시뮬레이션에서 3등급이 **색 없이 형태+패턴+텍스트만으로 구분 가능**해야 함(QA 체크 항목).

### 8.2 명도 대비 (WCAG AA, UI 스펙 검증값 채택)

| 요소 | 전경/배경 | 대비비 | 판정 |
|---|---|---|---|
| Gold 배지 텍스트·아이콘 | `#B8860B`/`#FEF7E0` | 4.7:1 | AA ✓ |
| Silver 배지 | `#5B6F7A`/`#EEF2F4` | 4.5:1 | AA ✓ |
| Unverified | `#6B7280`/`#F3F4F6` | 4.6:1 | AA ✓ |
| 앰버 경고 | `#B45309`/`#FFFBEB` | 4.8:1 | AA ✓ |
| 본문 | `#374151`/`#FFFFFF` | 9.2:1 | AAA ✓ |
| 보조 텍스트 | `#6B7280`/`#FFFFFF` | 4.6:1 | AA ✓ |
| Primary 버튼 | `#FFFFFF`/`#1A3352` | 12.1:1 | AAA ✓ |

> 기준: 18px 미만 비볼드 4.5:1↑, 18px↑/14px 볼드 3.0:1↑.

### 8.3 키보드·터치·스크린리더

- **터치 타깃 ≥44×44px** 전 화면. 카드 전체가 탭 영역.
- 포커스 링 공통: `focus-visible:ring-2 ring-offset-2 ring-realestate-brand-primary`.
- 카드: `tabIndex=0` `role="article"` Enter/Space→상세.
- 배지: `role="status"`, 도넛: `role="img"`, 막대: `role="progressbar"` + `aria-valuenow/valuemax`.
- 스텝퍼: `role="progressbar"` valuemax=5, 각 스텝 `aria-label="N단계 [라벨]: [상태]"`.
- 상태 변경(처리 완료·신고 접수): `aria-live="polite"` 주입.
- 모달(시트/다이얼로그): Radix 포커스 트랩 + ESC.

---

## 9. 마이크로카피 톤 가이드 `[팀장 보강 — 누락분]`

진짜집의 말투는 **"신뢰할 수 있는 친구가 사실만 담백하게 알려주는" 톤**이다.

**원칙:**
1. **사실 우선, 과장 금지**: "최고의 매물!" ✗ → "실거주 세입자가 직접 찍은 사진이 검증됐어요" ✓
2. **사용자 언어로 번역**: "EXIF 메타데이터 검증" ✗ → "사진 진위 검증" ✓
3. **불안 유발 대신 안심**: "위험 매물!" ✗ → "아직 현장 검증이 되지 않은 매물이에요" ✓
4. **책임 전가 금지**: "잘못 입력했습니다" ✗ → "20MB 이하 사진을 사용해주세요" ✓
5. **존댓말 + ~요체**(부드럽고 명료). 느낌표는 긍정 피드백(배지 획득)에만 절제 사용.
6. **pending은 반드시 "위반 아님" 명시**: 미검증이 의심으로 읽히지 않게.

**핵심 문구 사전(개발 하드코딩 기준):**

| 맥락 | 확정 카피 |
|---|---|
| Gold 자연어 | "실거주 세입자가 직접 찍은 사진이 검증됐어요" |
| Silver 자연어 | "현장에서 촬영한 사진이 있어요" |
| Unverified 자연어 | "아직 현장 검증이 되지 않은 매물이에요" |
| pending 보조 | "이 항목의 미검증은 허위매물 신호가 아니에요" |
| 처리 대기 | "AI가 개인정보를 안전하게 블러 처리하고 있습니다 (보통 30초~2분)" |
| 신고 접수 | "신고가 접수되었습니다. 검토 중에도 매물은 계속 볼 수 있어요" |
| 결과 피드백 | "이 매물이 검색 상단에 노출됩니다" |
| 업로드 이탈 | "지금 나가면 진행이 저장되지 않습니다" |

---

## 10. 프론트 핸드오프 노트 (개발팀 필독)

### 10.1 반드시 지킬 제약 (방향서·UX·UI 합의)

1. **토큰은 병합 추가**: `tailwind.config.ts`의 기존 오름 토큰을 **절대 덮어쓰지 말 것**. `realestate.*` 네임스페이스로만 추가(§3). 현재 config에 `realestate` 키 없음 확인 완료.
2. **신뢰순 정렬 = 서버 사전계산값 사용**. **프론트 정렬 로직 구현 금지**.
3. **낙관적 UI 전면 금지**. 업로드 결과·신고 처리·점수 갱신은 **서버 확정 결과만** 표시. Step4→5 전환은 폴링/Realtime 구독.
4. **EXIF·블러는 100% 서버 처리**. 클라이언트에서 EXIF 추출·블러링 금지(위변조 가능).
5. **매물 상세는 RSC** + 초기 로딩 스켈레톤.
6. **원본 사진 비공개**. 공개는 블러 통과본만. 클라는 원본만 업로드(전송).
7. **신고 즉시 비공개**(notice-and-takedown). 신고됨 매물은 검색 리스트 제외, 직접 URL만 검토 화면.

### 10.2 백엔드 데이터 계약 (프론트 표시 전제)

| 필요 데이터 | 형식 | 용도 |
|---|---|---|
| 항목별 점수 | `earned: number \| null` (`null`=pending, **0과 구분**) | ScoreBreakdown, 총점 `~` 표기 |
| 항목별 `verifiedAt` | timestamp \| null | 부분 신선도 표기 |
| 총점 | `score` + `isLowerBound: boolean` + `maxPossible` | §4.4 `N점~` 표기 |
| `badge_achieved` | "gold"\|"silver"\|"unverified" | 결과 화면 배지 |
| `score_delta` | number | 업로드 직후 "+N점" 카운트업 |
| 매물 상태 | "verified"\|"pending"\|"processing"\|"reported"\|"taken_down" | 화면 분기 |
| 처리 완료 신호 | Realtime 이벤트 \| 폴링 응답 | Step4→5 자동 전환 |

### 10.3 라우팅·딥링크

- PASS 인증 딥링크 콜백: `/verify?step=2&token=xxx` 처리 필수.
- 재진입 경로: `/verify` 재방문 시 진행 중 세션 감지 → "이어서 하기".
- 처리 완료 푸시 → 알림 탭 → `/verify?step=5` 복귀.
- 신고는 라우트 없음(바텀시트). `/report` 미생성(P1 검토).

### 10.4 M0 디자인 범위 / 제외

- **포함(P0)**: 검색·상세·업로드·인증게이트·내활동(빈 상태). 라이트 모드 한 벌.
- **제외(P1)**: 지도뷰, 이사 인증서 발급, 중개사 매물관리, **다크모드 UI 적용**(토큰만 보존).
- **데스크톱**: M0는 "깨지지 않는" 수준(중앙 정렬+max-width). 풀 데스크톱 레이아웃은 P1.

### 10.5 미해결 → 디자인 후속 (M1)

1. 다크모드 배지 대비비 재검증 후 UI 적용.
2. 컷오프(80/55) 실데이터 재튜닝 시 배지 분포 시각 영향 점검.
3. 지도뷰 디자인(지도 SDK 선정 후).
4. 이사 확인 인증서 비주얼.
5. 데스크톱 전용 레이아웃(상단 네비 전환).

---

*진짜집 디자인 최종안 v1.0 — 디자인팀장 확정*
*다음: "개발 시작" 트리거 → 프론트(컴포넌트/페이지) + 백엔드 병렬 착수. 프론트 1순위 = §6.1 P0-1 토큰 병합 + P0-2~5 신뢰 컴포넌트.*
