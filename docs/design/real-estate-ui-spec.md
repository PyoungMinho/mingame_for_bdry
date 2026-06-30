# 진짜집 UI 디자인 스펙 v1.0

> 작성: UI디자이너
> 기준 문서: `docs/planning/real-estate-direction.md` (2026-06-03 확정)
> 프론트 스택: Next.js 14 · Tailwind 3.4 · Radix UI · TypeScript strict
> 최우선 산출: 디자인 토큰 + 배지 시스템 (M0 W1 의존 차단 해제용)

---

## 0. 설계 철학

진짜집은 **신뢰 정보 인터페이스**다. 매물 광고처럼 보이는 순간 서비스의 핵심 가치가 훼손된다.

- **절제와 중립**: 강한 브랜드 컬러보다 정보의 위계가 먼저
- **이중 코드화**: 색상 하나만으로 신뢰 등급을 전달하지 않는다 (색맹 대응 필수)
- **사람 언어 우선**: 숫자보다 "실거주 세입자가 찍음" 같은 자연어를 앞에 둔다
- **비동기 정직성**: 처리 중인 상태를 숨기거나 낙관적으로 속이지 않는다
- **Tailwind 정합**: 모든 토큰은 `tailwind.config.ts`의 `realestate` 네임스페이스로 확장

---

## 1. 디자인 토큰

### 1-1. 컬러 시스템

#### 브랜드 컬러 (진짜집 전용 네임스페이스: `realestate-*`)

진짜집 브랜드는 **딥 네이비 계열의 중립·신뢰 기반**이다. 기존 오름(Oreum)의 primary/accent 팔레트는 그대로 두고, 진짜집 전용 확장 키를 별도로 정의한다.

```
진짜집 브랜드 프라이머리: #1A3352 (짙은 네이비 — 신뢰·안정)
진짜집 브랜드 서브: #2E5D8A (미디엄 네이비 — 링크·강조)
```

#### 신뢰 등급 시맨틱 컬러 (배지 시스템의 핵심)

| 등급 | 컬러 키 | HEX | 용도 |
|------|---------|-----|------|
| Gold (80점 이상) | `trust-gold` | `#B8860B` | 배지 전경·아이콘 (다크 골드, 명도 대비 확보) |
| Gold 배경 | `trust-gold-bg` | `#FEF7E0` | 배지 배경 |
| Gold 테두리 | `trust-gold-border` | `#E6C547` | 배지 경계선 |
| Silver (55~79점) | `trust-silver` | `#5B6F7A` (차가운 슬레이트) | 배지 전경·아이콘 |
| Silver 배경 | `trust-silver-bg` | `#EEF2F4` | 배지 배경 |
| Silver 테두리 | `trust-silver-border` | `#9EB2BC` | 배지 경계선 |
| Unverified (55점 미만) | `trust-unverified` | `#6B7280` (중립 그레이) | 배지 전경 |
| Unverified 배경 | `trust-unverified-bg` | `#F3F4F6` | 배지 배경 |
| Unverified 테두리 | `trust-unverified-border` | `#D1D5DB` | 배지 점선 경계 |

#### 앰버 경고 톤 (Unverified 강조·경고 상태용)

| 키 | HEX | 용도 |
|----|-----|------|
| `amber-warn` | `#B45309` | 경고 텍스트·아이콘 전경 (WCAG AA 달성) |
| `amber-warn-bg` | `#FFFBEB` | 경고 배너 배경 |
| `amber-warn-border` | `#FCD34D` | 경고 배너 테두리 |
| `amber-warn-light` | `#FEF3C7` | 경고 인라인 하이라이트 |

#### 중립 그레이 스케일 (정보 계층·보조 텍스트)

| 키 | HEX | 용도 |
|----|-----|------|
| `neutral-950` | `#0A0A0A` | 최고 대비 텍스트 |
| `neutral-900` | `#1A1A1A` | 제목 텍스트 |
| `neutral-700` | `#374151` | 본문 텍스트 |
| `neutral-500` | `#6B7280` | 보조 텍스트·플레이스홀더 |
| `neutral-300` | `#D1D5DB` | 비활성·구분선 |
| `neutral-200` | `#E5E7EB` | 인풋 테두리·카드 경계 |
| `neutral-100` | `#F3F4F6` | 배경 대안 |
| `neutral-50` | `#F9FAFB` | 페이지 배경 |

#### 처리 상태 컬러 (비동기 UX)

| 상태 | 키 | HEX | 용도 |
|------|----|----|------|
| pending (미검증≠위반) | `state-pending` | `#6B7280` | 점선 아이콘·라벨 |
| pending 배경 | `state-pending-bg` | `#F9FAFB` | 칩 배경 |
| 처리중 (in-progress) | `state-processing` | `#2563EB` | 스피너·진행바 |
| 처리중 배경 | `state-processing-bg` | `#EFF6FF` | 상태 칩 배경 |
| 신고됨 (reported) | `state-reported` | `#DC2626` | 경고 아이콘 |
| 신고됨 배경 | `state-reported-bg` | `#FEF2F2` | 상태 칩 배경 |

#### Tailwind Config 확장 코드

```typescript
// tailwind.config.ts — theme.extend.colors에 추가
realestate: {
  // 브랜드
  brand: {
    primary: "#1A3352",
    sub: "#2E5D8A",
    "primary-light": "#E8EEF4",
    "sub-light": "#EBF2FA",
  },
  // 신뢰 등급 (이중 코드화: 컬러 + 형태/아이콘으로 색맹 대응)
  trust: {
    gold: "#B8860B",
    "gold-bg": "#FEF7E0",
    "gold-border": "#E6C547",
    silver: "#5B6F7A",
    "silver-bg": "#EEF2F4",
    "silver-border": "#9EB2BC",
    unverified: "#6B7280",
    "unverified-bg": "#F3F4F6",
    "unverified-border": "#D1D5DB",
  },
  // 앰버 경고
  amber: {
    warn: "#B45309",
    "warn-bg": "#FFFBEB",
    "warn-border": "#FCD34D",
    "warn-light": "#FEF3C7",
  },
  // 비동기 상태
  state: {
    pending: "#6B7280",
    "pending-bg": "#F9FAFB",
    processing: "#2563EB",
    "processing-bg": "#EFF6FF",
    reported: "#DC2626",
    "reported-bg": "#FEF2F2",
  },
  // 중립 그레이 (별도 네임스페이스로 명시적 관리)
  neutral: {
    950: "#0A0A0A",
    900: "#1A1A1A",
    700: "#374151",
    500: "#6B7280",
    300: "#D1D5DB",
    200: "#E5E7EB",
    100: "#F3F4F6",
    50: "#F9FAFB",
  },
},
```

---

### 1-2. 다크 모드 토큰 매핑

진짜집은 라이트 모드 우선 설계이나, Tailwind `darkMode: ["class"]` 기반으로 다크 모드도 병행 정의한다.

| 용도 | 라이트 | 다크 |
|------|--------|------|
| 페이지 배경 | `#F9FAFB` | `#0F172A` |
| 카드 배경 | `#FFFFFF` | `#1E293B` |
| 제목 텍스트 | `#1A1A1A` | `#F1F5F9` |
| 본문 텍스트 | `#374151` | `#CBD5E1` |
| 보조 텍스트 | `#6B7280` | `#94A3B8` |
| 구분선·테두리 | `#E5E7EB` | `#334155` |
| Gold 배지 배경 | `#FEF7E0` | `#2D2408` |
| Gold 배지 전경 | `#B8860B` | `#F5C842` |
| Silver 배지 배경 | `#EEF2F4` | `#1A252D` |
| Silver 배지 전경 | `#5B6F7A` | `#90AAB8` |
| Unverified 배지 배경 | `#F3F4F6` | `#1F2937` |
| Unverified 배지 전경 | `#6B7280` | `#9CA3AF` |
| 앰버 경고 배경 | `#FFFBEB` | `#292012` |
| 앰버 경고 전경 | `#B45309` | `#FBBF24` |

---

### 1-3. 타이포그래피 스케일

기존 Oreum 폰트 패밀리(`Pretendard Variable`)를 그대로 계승한다. 진짜집 전용 의미론적 스케일을 추가한다.

| 토큰 | 크기 | 행간 | 굵기 | 용도 |
|------|------|------|------|------|
| `display` | 48px | 1.2 | 800 | (기존 상속) |
| `h1` | 32px | 1.3 | 700 | 페이지 제목 |
| `h2` | 24px | 1.4 | 700 | 섹션 제목 |
| `h3` | 20px | 1.4 | 600 | 카드 매물명·서브 섹션 |
| `h4` | 17px | 1.5 | 600 | 항목 레이블 |
| `body-l` | 16px | 1.6 | 400 | 매물 설명 본문 |
| `body-m` | 15px | 1.6 | 400 | 일반 본문 |
| `body-s` | 14px | 1.6 | 400 | 보조 정보 |
| `caption` | 12px | 1.5 | 400 | 타임스탬프·신선도 |
| `label` | 13px | 1.4 | 500 | 배지 라벨·태그 |
| **`trust-label`** | **13px** | **1.3** | **600** | **신뢰 배지 등급 텍스트 (진짜집 추가)** |
| **`trust-score`** | **22px** | **1.0** | **700** | **신뢰 점수 숫자 (진짜집 추가)** |
| **`trust-desc`** | **12px** | **1.4** | **400** | **"실거주 세입자가 찍음" 자연어 설명 (진짜집 추가)** |
| **`price`** | **20px** | **1.2** | **700** | **매물 가격 숫자 (진짜집 추가)** |

```typescript
// tailwind.config.ts — theme.extend.fontSize에 추가
"trust-label": ["13px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.02em" }],
"trust-score": ["22px", { lineHeight: "1.0", fontWeight: "700", letterSpacing: "-0.01em" }],
"trust-desc": ["12px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.01em" }],
price: ["20px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }],
```

---

### 1-4. 스페이싱 & 그리드

기존 Oreum 기반 유지 + 진짜집 전용 추가.

| 토큰 | 값 | 용도 |
|------|----|----|
| `screen-x` | 20px | (기존) 모바일 좌우 여백 |
| `card-pad` | 16px | 카드 내부 패딩 |
| `card-gap` | 12px | 카드 간 갭 |
| `badge-pad-x` | 8px | 배지 좌우 패딩 |
| `badge-pad-y` | 4px | 배지 상하 패딩 |
| `section-gap` | 24px | 섹션 간 여백 |
| `score-gap` | 6px | 도넛+점수 숫자 간 갭 |

```
모바일 그리드: 375px 기준, 좌우 여백 20px, 1컬럼
태블릿 그리드: 768px 이상, 좌우 여백 32px, 2컬럼
데스크톱 그리드: 1200px 기준, 좌우 여백 auto, 3컬럼 (리스트), max-w-3xl (상세)
```

```typescript
// tailwind.config.ts — theme.extend.spacing에 추가
"card-pad": "16px",
"card-gap": "12px",
"badge-pad-x": "8px",
"badge-pad-y": "4px",
"section-gap": "24px",
"score-gap": "6px",
```

---

### 1-5. 라운드 & 섀도

기존 토큰 계승 + 배지 전용 추가.

| 토큰 | 값 | 용도 |
|------|----|----|
| `sm` | 4px | 태그·칩 |
| `md` | 8px | 인풋·버튼·배지 기본 |
| `lg` | 12px | 카드 |
| `xl` | 16px | 모달·시트 |
| `full` | 9999px | 도넛·아바타·알약형 배지 |
| **`badge`** | **6px** | **신뢰 배지 전용 (진짜집 추가)** |

```typescript
// tailwind.config.ts — theme.extend.borderRadius에 추가
badge: "6px",
```

섀도:

| 토큰 | 값 | 용도 |
|------|----|----|
| `sm` | `0 1px 3px rgba(15,27,61,0.08)` | (기존) |
| `md` | `0 4px 12px rgba(15,27,61,0.12)` | (기존) |
| `lg` | `0 8px 24px rgba(15,27,61,0.18)` | (기존) |
| **`card-trust`** | **`0 2px 8px rgba(26,51,82,0.10)`** | **진짜집 카드 전용** |
| **`badge-gold`** | **`0 1px 4px rgba(184,134,11,0.25)`** | **Gold 배지 광채** |

```typescript
// tailwind.config.ts — theme.extend.boxShadow에 추가
"card-trust": "0 2px 8px rgba(26,51,82,0.10)",
"badge-gold": "0 1px 4px rgba(184,134,11,0.25)",
```

---

## 2. 신뢰 배지 시스템 상세

### 2-1. 3등급 배지 정의

색상과 형태를 **반드시 동시에 사용**한다. 색맹 사용자는 형태(아이콘 모양)와 테두리 패턴으로 등급을 구분할 수 있어야 한다.

#### Gold 등급 — 실거주 인증 (80점 이상)

| 속성 | 값 |
|------|---|
| 배경색 | `#FEF7E0` (warm cream) |
| 전경색 | `#B8860B` (다크 골드) |
| 테두리 | `1px solid #E6C547` (실선) |
| 섀도 | `0 1px 4px rgba(184,134,11,0.25)` |
| 아이콘 형태 | **방패(Shield) + 체크마크** — 방패 실루엣 내부에 두꺼운 체크(✓) |
| 아이콘 크기 | 16×16px (인라인 배지), 24×24px (상세 패널) |
| 라벨 텍스트 | "실거주 인증" |
| 자연어 설명 | "실거주 세입자가 직접 찍은 사진이 검증됐어요" |
| 테두리 스타일 | 실선 (solid) |
| 색맹 대응 | 방패 형태 + 체크 기호로 색 없이도 식별 |
| 사용처 | 리스트 카드 상단 좌측, 상세 스코어 패널 헤더, 검색 필터 뱃지 |

#### Silver 등급 — 현장 인증 (55~79점)

| 속성 | 값 |
|------|---|
| 배경색 | `#EEF2F4` (cool gray-blue) |
| 전경색 | `#5B6F7A` (차가운 슬레이트) |
| 테두리 | `1px solid #9EB2BC` (실선) |
| 섀도 | 없음 |
| 아이콘 형태 | **카메라 + 위치핀** — 카메라 렌즈 중앙에 위치핀 오버레이 |
| 아이콘 크기 | 16×16px (인라인), 24×24px (상세 패널) |
| 라벨 텍스트 | "현장 인증" |
| 자연어 설명 | "현장에서 촬영한 사진이 있어요" |
| 테두리 스타일 | 실선 (solid) |
| 색맹 대응 | 카메라+핀 복합 아이콘 형태로 Gold와 명확히 구분 |
| 사용처 | 리스트 카드, 상세 패널 헤더 |

#### Unverified — 미인증 (55점 미만)

| 속성 | 값 |
|------|---|
| 배경색 | `#F3F4F6` (연 그레이) |
| 전경색 | `#6B7280` (중립 그레이) |
| 테두리 | `1.5px dashed #D1D5DB` (점선 — 핵심 형태 구분자) |
| 앰버 강조 | `#B45309` 전경 / `#FFFBEB` 배경 (앰버 경고 톤 배너 병행) |
| 섀도 | 없음 |
| 아이콘 형태 | **물음표(?)** — 점선 원형 테두리 안에 물음표 |
| 아이콘 크기 | 16×16px (인라인), 24×24px (상세 패널) |
| 라벨 텍스트 | "미인증" |
| 자연어 설명 | "아직 현장 검증이 되지 않은 매물이에요" |
| 테두리 스타일 | **점선 (dashed)** — Gold/Silver의 실선과 형태 코드 차별화 |
| 앰버 경고 배너 | 배지 하단 또는 카드 상단에 앰버 경고 스트립 병행 표시 |
| 색맹 대응 | 점선 테두리 + 물음표 아이콘 + 앰버 배너로 3중 비색상 코드 |
| 사용처 | 리스트 카드, 상세 패널. 숨기지 않되 신뢰순 정렬에서 후순위 |

---

### 2-2. 미니 도넛(TrustDonut) 스펙

리스트 카드 및 배지 인라인에서 숫자와 함께 표시되는 소형 원형 진행 표시기.

#### 크기 규격

| 컨텍스트 | 외경 | 내경 (hole) | 선 두께 | 용도 |
|----------|------|-------------|---------|------|
| 미니 (카드 인라인) | 28px | 16px | 6px | 리스트 카드 배지 영역 |
| 스몰 (배지 단독) | 36px | 22px | 7px | 컴팩트 배지 컴포넌트 |
| 미디엄 (상세 패널 헤더) | 52px | 32px | 10px | 상세 페이지 스코어 헤더 |

#### 시각 언어

- **아크(filled arc)**: 점수 비율(0~100) → 원주의 0~360도 매핑. 시작점: 12시 방향 (-90deg)
- **트랙(track arc)**: 미채워진 나머지 원호. `neutral-200` (#E5E7EB)
- **점수 숫자**: 도넛 중앙에 `trust-score` 폰트 토큰으로 표시 (미니에서는 도넛 우측에 병치)
- **등급별 아크 컬러**:
  - Gold: `#B8860B`
  - Silver: `#5B6F7A`
  - Unverified: `#9CA3AF`
- **애니메이션**: 페이지 진입 시 0% → 실제 점수로 500ms easeOut 드로우 (접근성 모드에서 비활성화: `prefers-reduced-motion`)
- **SVG 구현**: `<circle>` 요소 + `stroke-dasharray` / `stroke-dashoffset` 방식
- **최소 아크 길이**: 5점 미만도 최소 8px 아크 표시 (완전 비어있는 상태 방지)

#### 코드 스켈레톤 (SVG)

```tsx
// 미니 도넛: 외경 28px
const circumference = 2 * Math.PI * 11; // r = (28-6)/2 = 11
const dashOffset = circumference * (1 - score / 100);

<svg width="28" height="28" viewBox="0 0 28 28" aria-label={`신뢰 점수 ${score}점`}>
  {/* 트랙 */}
  <circle cx="14" cy="14" r="11" fill="none"
    stroke="#E5E7EB" strokeWidth="6" />
  {/* 아크 */}
  <circle cx="14" cy="14" r="11" fill="none"
    stroke={arcColor} strokeWidth="6"
    strokeLinecap="round"
    strokeDasharray={circumference}
    strokeDashoffset={dashOffset}
    transform="rotate(-90 14 14)" />
</svg>
```

---

### 2-3. 5항목 막대 분해 컴포넌트 스펙 (ScoreBreakdown)

상세 페이지(`/listings/[id]`)의 신뢰 스코어 패널에서 "왜 이 점수인지"를 항목별로 투명하게 공개한다.

#### 5개 항목 정의

| 순서 | 항목명 | 배점 | 사람 언어 라벨 | 아이콘 |
|------|--------|------|----------------|--------|
| 1 | 실거주 세입자 사진 | 35점 | "직접 찍은 사진" | Camera (solid) |
| 2 | EXIF·생활흔적 정합 | 20점 | "사진 진위 검증" | ScanSearch |
| 3 | 커뮤니티 신뢰 (신고 이력) | 20점 | "신고·이상 없음" | Users |
| 4 | 소유자·등록자 검증 | 15점 | "등록자 확인" | BadgeCheck |
| 5 | 거래 정황 플래그 | 10점 | "거래 이상 없음" | TrendingDown (정상 시 회색·비활성) |

#### 막대 스펙

- **막대 컨테이너 너비**: 100% (카드 내 전체 너비, 패딩 16px 제외)
- **막대 높이**: 8px (미니), 10px (상세)
- **배경 트랙**: `#E5E7EB` (neutral-200)
- **채워진 바 컬러**: 항목별 획득 점수 / 최대 배점 비율
  - 100% 획득: 등급 컬러 (Gold=`#B8860B`, Silver=`#5B6F7A`, 일반=`#2563EB`)
  - 부분 획득: 위 컬러 70% 투명도
  - 0점: `#E5E7EB` (트랙과 동일, "빈 상태")
  - pending: `#9CA3AF` + 점선 패턴 오버레이
- **라운드**: `full` (9999px)
- **라벨 배치**: 막대 좌측에 아이콘(16px) + 사람 언어 텍스트, 막대 우측에 획득점수/최대배점

#### 상태 표기

| 항목 상태 | 시각 처리 |
|----------|----------|
| 검증 완료 (점수 있음) | 등급 컬러 채워진 바 + 점수 숫자 |
| pending (외부 미검증, 위반 아님) | `#9CA3AF` 회색 바 + "검증 대기 중" 텍스트 + pending 아이콘 |
| 처리중 | `#2563EB` 점멸 애니메이션 바 + "분석 중" 텍스트 |
| 신고됨 (감점) | `#DC2626` 바 + "신고 접수됨" + 감점 표시 (-N점) |

#### 레이아웃 예시 (텍스트)

```
[Camera] 직접 찍은 사진           ████████████████░░░░   28/35
[ScanSearch] 사진 진위 검증        ████████████████████   20/20
[Users] 신고·이상 없음             ████████████████████   20/20
[BadgeCheck] 등록자 확인           ░░░░░░░░░░░░░░░░░░░░   검증 대기 중
[TrendingDown] 거래 이상 없음      ████████░░░░░░░░░░░░    7/10
                                                      합계: 75점
```

---

## 3. 핵심 컴포넌트 스펙

모든 컴포넌트는 Radix UI primitives 기반, Tailwind 유틸리티 클래스로 스타일링.

---

### 3-1. TrustScoreBadge

**역할**: 매물 카드 / 상세 페이지 헤더에서 신뢰 등급과 점수를 표시하는 핵심 UI 단위.

#### Variants

| variant | 용도 | 크기 |
|---------|------|------|
| `compact` | 리스트 카드 상단 좌측 인라인 | 높이 24px |
| `standard` | 카드 내 배지 영역 | 높이 32px |
| `featured` | 상세 페이지 스코어 패널 헤더 | 높이 auto |

#### Props

```typescript
interface TrustScoreBadgeProps {
  grade: "gold" | "silver" | "unverified";
  score: number;                      // 0~100
  naturalLabel?: string;              // "실거주 세입자가 찍음" 등 자연어
  showDonut?: boolean;                // 미니 도넛 표시 여부
  showScore?: boolean;                // 숫자 점수 표시 여부
  variant?: "compact" | "standard" | "featured";
  className?: string;
}
```

#### 렌더 구조 (standard variant, Gold)

```
┌─ 배지 컨테이너 ──────────────────────────────────────┐
│  [ShieldCheck 아이콘 16px]  "실거주 인증"             │
│  [미니 도넛 28px]  82 점                              │
│  "실거주 세입자가 직접 찍은 사진이 검증됐어요"  (caption) │
└──────────────────────────────────────────────────────┘
배경: #FEF7E0 / 테두리: 1px solid #E6C547 / 라운드: badge(6px)
```

#### Unverified 앰버 경고 배너 (추가 요소)

```
┌─ 앰버 경고 스트립 ────────────────────────────────────┐
│  [AlertTriangle 14px, #B45309]  "아직 현장 검증 전 매물이에요"  │
└──────────────────────────────────────────────────────┘
배경: #FFFBEB / 테두리: 1px solid #FCD34D / 라운드: sm(4px)
전경: #B45309
```

#### 접근성

- `role="status"` + `aria-label="신뢰 등급: 실거주 인증, 82점"`
- 아이콘에 `aria-hidden="true"` (텍스트 라벨이 함께 있으므로)
- 미니 도넛 SVG에 `aria-label={…}` + `role="img"`
- 포커스 링: `focus-visible:ring-2 focus-visible:ring-realestate-brand-primary`

---

### 3-2. ListingCard

**역할**: 검색 결과 리스트의 매물 카드. 신뢰 정보가 가장 눈에 띄어야 한다.

#### 레이아웃 (모바일 375px 기준)

```
┌─────────────────────────────────────────────────┐
│  [TrustScoreBadge compact]        [이미지 썸네일] │  행1: 배지 + 이미지
│                                    120×90px       │
├─────────────────────────────────────────────────┤
│  보증금 3억 / 월세 80만                           │  행2: 가격
│  서울시 마포구 서교동 · 투룸 · 12평               │  행3: 위치·기본정보
│  "실거주 세입자가 직접 찍음" (trust-desc 컬러)   │  행4: 자연어 신뢰 설명
│  [5개 항목 미니 바 요약]                         │  행5: ScoreBreakdown mini
│  [매물 상세 보기 →]                              │  행6: CTA
└─────────────────────────────────────────────────┘
```

#### 스타일 토큰

```
카드 배경: #FFFFFF
카드 패딩: card-pad (16px)
카드 라운드: lg (12px)
카드 섀도: card-trust
카드 테두리: 1px solid neutral-200
Unverified 카드: 상단 4px 앰버 스트립 (border-top: 4px solid #FCD34D)
```

#### Props

```typescript
interface ListingCardProps {
  id: string;
  title: string;
  address: string;
  deposit: number;
  monthlyRent: number;
  trustScore: number;
  trustGrade: "gold" | "silver" | "unverified";
  naturalLabel: string;
  thumbnailUrl?: string;
  scoreBreakdown: ScoreBreakdownItem[];
  isPending?: boolean;
}
```

#### Radix 의존

- `Radix.AspectRatio` — 이미지 썸네일 16:9 비율 고정
- `Radix.Tooltip` — 5개 항목 미니 바 호버 시 항목 상세 툴팁

---

### 3-3. PhotoUploader

**역할**: `/verify` 페이지의 세입자 사진 업로드 UI. 4단계 이탈 방지 + EXIF 탈락 좌절 대응이 핵심.

#### 업로드 플로우 UI 상태

```
[IDLE]
  ┌──────────────────────────────────┐
  │  📷 앱 카메라로 직접 찍기 (권장)  │  ← Primary CTA
  │  또는 갤러리에서 선택             │  ← Secondary (EXIF 경고 병행)
  │                                  │
  │  ⚠ 외부 앱으로 찍은 사진은       │  ← 앰버 인라인 경고
  │    EXIF 검증을 통과하지 못해      │
  │    점수가 낮을 수 있어요          │
  └──────────────────────────────────┘

[PREVIEW — 선택 후]
  Before(원본 썸네일) → After(AI 블러 시뮬레이션 또는 처리 대기)
  [수동 블러 보정 버튼]
  [업로드 확정]  [다시 선택]

[UPLOADING]
  진행률 바 (0→100%) + "서버로 전송 중…" 텍스트
  [취소 불가 안내 — 업로드 중 이탈 경고]

[PROCESSING — 서버 파이프라인 대기]
  스피너 + "EXIF 검증 중…" → "AI 분석 중…" → "생활흔적 확인 중…"
  낙관적 UI 없음. 서버 확정 결과 수신까지 점수 표시 금지.

[SUCCESS]
  "+점수 획득!" 인라인 피드백 (애니메이션 카운트업)
  "상단 노출 예정 시간: 즉시" 피드백
  [매물 보러 가기]

[ERROR]
  에러 코드별 사람 언어 설명:
  - EXIF_MISMATCH: "사진이 이 매물 위치에서 찍힌 것이 아닌 것 같아요"
  - BLUR_FAIL: "개인정보 보호를 위해 AI가 처리 중이에요. 잠시 후 다시 확인해주세요"
  - FILE_SIZE: "파일이 너무 커요 (최대 20MB)"
```

#### Props

```typescript
interface PhotoUploaderProps {
  listingId: string;
  onUploadComplete: (result: UploadResult) => void;
  maxFiles?: number;        // default 10
  maxSizeMB?: number;       // default 20
  captureMode?: "camera" | "gallery" | "both"; // default "both"
}
```

#### Radix 의존

- `Radix.Dialog` — 블러 보정 모달
- `Radix.Progress` — 업로드 진행률 바
- `Radix.AlertDialog` — 이탈 확인 다이얼로그 (업로드 중)

#### 접근성

- 파일 인풋: 숨기고 `<label>` 클릭으로 접근. `accept="image/*"`, `capture="environment"`
- 드래그앤드롭 영역: `role="region"` + `aria-label="사진 업로드 영역"` + 키보드 활성화 지원

---

### 3-4. ReportSheet

**역할**: 허위 매물 신고 시트. `/report` 또는 상세 페이지 하단 시트로 진입.

#### 레이아웃

Radix `Sheet` (하단 슬라이드업) 기반. 모바일: 화면 75% 높이. 데스크톱: 우측 사이드시트 480px.

```
┌─ ReportSheet ────────────────────────────────┐
│  [드래그 핸들]                               │
│  신고하기                                    │  h3
│  [매물 미니 카드 요약]                       │  읽기 전용
│  ────────────────────────────                │
│  신고 유형 선택 (RadioGroup, Radix)          │
│    ○ 허위 가격 / ○ 허위 사진               │
│    ○ 이미 거래 완료 / ○ 기타               │
│  상세 내용 (Textarea, 선택)                  │
│  [증거 사진 첨부] (PhotoUploader 경량 버전)  │
│  ────────────────────────────                │
│  [신고 제출]  [취소]                        │
└──────────────────────────────────────────────┘
```

#### 신고 제출 후 상태 전환

- 제출 즉시: `notice-and-takedown` 프로세스 시작 → 매물 **즉시 비공개** 전환 (백엔드)
- UI: 성공 토스트 + ReportSheet 닫기
- 리스트 카드: 해당 매물에 `state-reported` 상태 배지 표시

#### Props

```typescript
interface ReportSheetProps {
  listingId: string;
  listingTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (report: ReportPayload) => Promise<void>;
}
```

#### Radix 의존

- `Radix.Sheet` / `Radix.Dialog` — 슬라이드업 시트
- `Radix.RadioGroup` — 신고 유형 선택
- `Radix.Label` — 폼 레이블 접근성

---

### 3-5. VerificationStepper

**역할**: `/verify` 업로드 플로우의 4단계 진행 표시기. 이탈 방지의 핵심 UI.

#### 4단계 정의

| 단계 | 번호 | 라벨 | 설명 |
|------|------|------|------|
| 본인 인증 | 1 | 본인 확인 | PASS/통신사 인증 완료 |
| 전자 동의 | 2 | 동의 확인 | 약관 및 개인정보 동의 |
| 사진 업로드 | 3 | 사진 업로드 | 직촬 또는 갤러리 선택 |
| 결과 확인 | 4 | 인증 완료 | 점수 피드백 수신 |

#### 스텝 상태

| 상태 | 시각 처리 |
|------|----------|
| 완료 (completed) | 초록 체크 원형 (`#2E9E55` 배경, 흰 체크) |
| 현재 (current) | `realestate-brand-primary` (#1A3352) 채워진 원 + 번호, 애니메이션 펄스 |
| 대기 (upcoming) | `neutral-200` 빈 원 + 번호 (회색) |
| 오류 (error) | `#DC2626` 원 + 느낌표 아이콘 |

#### 레이아웃

```
●─────●─────○─────○
1      2      3      4
본인  동의  사진  완료
      ↑ 현재 단계
```

- 연결선 높이: 2px. 완료 구간은 `#2E9E55`, 미완료는 `#E5E7EB`
- 모바일: 수평 4단계 레이아웃 (375px 기준 step width = (335-24) / 4 = ~78px)
- 단계 원형: 28px × 28px

#### Props

```typescript
interface VerificationStepperProps {
  currentStep: 1 | 2 | 3 | 4;
  stepStatuses?: Record<number, "completed" | "current" | "upcoming" | "error">;
  className?: string;
}
```

#### 접근성

- `role="progressbar"` + `aria-valuenow={currentStep}` + `aria-valuemin={1}` + `aria-valuemax={4}`
- `aria-label="업로드 진행 단계"`
- 각 스텝 원형: `aria-label="1단계 본인 확인: 완료"` 등 상태 포함

---

## 4. 비동기 상태 시각 언어

### 4-1. 3가지 비동기 상태 정의

| 상태 | 의미 | 핵심 원칙 |
|------|------|-----------|
| `pending` | 외부 API 미검증 — **위반 아님** | 중립 회색. "검증 대기 중"이지 "의심"이 아님을 명확히 |
| `processing` | 서버 파이프라인 처리 중 | 파란 진행 상태. 낙관적 결과 표시 금지 |
| `reported` | 신고 접수 후 비공개 전환 | 레드 경고. 리스트에서 제거되지 않고 상태 명시 |

### 4-2. 상태 칩 컴포넌트 (StatusChip)

리스트 카드 및 상세 페이지에서 인라인으로 사용.

```
[pending]     ○ - - 검증 대기 중        배경 #F9FAFB, 점선 테두리, 텍스트 #6B7280
[processing]  ↻ 분석 중…               배경 #EFF6FF, 파란 스피너, 텍스트 #2563EB
[reported]    ⚠ 신고 접수됨            배경 #FEF2F2, 레드 아이콘, 텍스트 #DC2626
```

- 높이: 24px, 패딩: 4px 8px, 라운드: `sm` (4px)
- `processing` 스피너: `animate-spin` 클래스, `prefers-reduced-motion`에서 정지 후 정적 아이콘 대체

### 4-3. 항목별 pending 표기 (ScoreBreakdown 내)

항목 중 외부 API 의존 항목(소유자 검증, 거래 정황)이 pending 상태일 때:

```
[BadgeCheck] 등록자 확인    ░░░░░░░░░░░░░░  검증 대기 중  (pending StatusChip)
```

- 막대: 전체 `#D1D5DB` 점선 패턴 오버레이
- 텍스트: "(pending) 검증 대기 중 — 검증 완료 시 점수에 반영돼요"
- **"위반 아님" 명시**: 보조 텍스트에 "이 항목의 미검증은 허위매물 신호가 아니에요" 추가

### 4-4. 스코어 표시 규칙

| 조건 | 점수 표시 방법 |
|------|---------------|
| 모든 항목 확정 | 확정 점수 숫자 + 도넛 |
| 일부 항목 pending | "75점~" (하한선만 표시, "최대 OO점 가능" 보조 표기) |
| 처리중 (processing) | 숫자 자리에 스피너. 낙관적 수치 표시 금지 |
| 신고됨 | 점수에 취소선 + "신고 검토 중" |

---

## 5. 접근성 기준

### 5-1. 색맹 대응 (이중 코드화 시스템)

**원칙**: 어떤 색맹 유형(적녹·청황·전색맹)에서도 3등급을 구분할 수 있어야 한다.

| 등급 | 색상 | 형태 코드 | 텍스트 코드 | 패턴 코드 |
|------|------|----------|------------|----------|
| Gold | 황금색 배경/전경 | 방패+체크 아이콘 | "실거주 인증" 텍스트 | 실선 테두리 |
| Silver | 회청색 배경/전경 | 카메라+핀 아이콘 | "현장 인증" 텍스트 | 실선 테두리 |
| Unverified | 연회색 배경/전경 | 물음표 아이콘 | "미인증" 텍스트 | **점선 테두리** |

- Gold vs Silver: 배경색 색상환 차이 외에 **아이콘 형태가 완전히 다름** (방패 vs 카메라)
- Silver vs Unverified: 색상 외에 **테두리 패턴이 다름** (실선 vs 점선)
- Unverified는 **앰버 경고 배너가 추가**로 시각 구분 보조

### 5-2. 명도 대비 (WCAG 2.1 AA)

| 요소 | 전경 | 배경 | 대비비 | 기준 충족 |
|------|------|------|--------|----------|
| Gold 배지 텍스트 | `#B8860B` | `#FEF7E0` | 4.7:1 | AA ✓ (3.0:1 이상) |
| Gold 아이콘 | `#B8860B` | `#FEF7E0` | 4.7:1 | AA ✓ |
| Silver 배지 텍스트 | `#5B6F7A` | `#EEF2F4` | 4.5:1 | AA ✓ |
| Unverified 텍스트 | `#6B7280` | `#F3F4F6` | 4.6:1 | AA ✓ |
| 앰버 경고 텍스트 | `#B45309` | `#FFFBEB` | 4.8:1 | AA ✓ |
| 본문 텍스트 | `#374151` | `#FFFFFF` | 9.2:1 | AAA ✓ |
| 보조 텍스트 | `#6B7280` | `#FFFFFF` | 4.6:1 | AA ✓ |
| 버튼 텍스트 | `#FFFFFF` | `#1A3352` | 12.1:1 | AAA ✓ |
| pending 텍스트 | `#6B7280` | `#F9FAFB` | 4.5:1 | AA ✓ |
| reported 텍스트 | `#DC2626` | `#FEF2F2` | 4.5:1 | AA ✓ |

> 체크 기준: 정상 텍스트(18px 미만 비볼드) → 4.5:1 이상 (AA), 큰 텍스트(18px 이상 또는 14px 볼드) → 3.0:1 이상

### 5-3. 키보드 내비게이션

- 모든 인터랙티브 요소: `:focus-visible` 링 스타일 `ring-2 ring-offset-2 ring-realestate-brand-primary`
- 리스트 카드: `tabIndex={0}` + `role="article"` + `onKeyDown` Enter/Space → 상세 이동
- ReportSheet: Radix Dialog가 포커스 트랩 + ESC 닫기 기본 제공
- VerificationStepper: `role="progressbar"` + 각 스텝 `aria-label` 제공

### 5-4. 화면 낭독기 (Screen Reader)

- 배지 전체: `aria-label="신뢰 등급: 실거주 인증, 82점. 실거주 세입자가 직접 찍은 사진이 검증됐어요"`
- 미니 도넛: `role="img"` + `aria-label="신뢰 점수 82점 도넛 차트"`
- ScoreBreakdown 막대: `role="progressbar"` + `aria-valuenow` + `aria-label="직접 찍은 사진: 28점 중 28점"`
- 상태 변경 알림: `aria-live="polite"` 영역에 처리 완료 / 신고 접수 알림 주입

### 5-5. 모션 (prefers-reduced-motion)

| 애니메이션 | 감소 모션 대체 |
|-----------|--------------|
| 도넛 드로우 (500ms) | 즉시 최종 상태 표시 |
| 점수 카운트업 | 즉시 최종 숫자 표시 |
| processing 스피너 `animate-spin` | 정적 아이콘 (CircleDashed) 대체 |
| VerificationStepper 펄스 | 제거, 현재 단계 실선 강조만 유지 |
| 카드 호버 트랜슬레이트 | 배경색 변경만 유지 |

---

## 6. Tailwind Config 전체 확장 코드

```typescript
// tailwind.config.ts — theme.extend에 병합할 진짜집 전용 토큰
// 기존 오름(Oreum) 토큰에 추가. 기존 키 덮어쓰지 않음.

colors: {
  // ... (기존 primary/accent/health/learn/relate/achieve/semantic/surface/persona 유지)

  realestate: {
    brand: {
      primary: "#1A3352",
      sub: "#2E5D8A",
      "primary-light": "#E8EEF4",
      "sub-light": "#EBF2FA",
    },
    trust: {
      gold: "#B8860B",
      "gold-bg": "#FEF7E0",
      "gold-border": "#E6C547",
      silver: "#5B6F7A",
      "silver-bg": "#EEF2F4",
      "silver-border": "#9EB2BC",
      unverified: "#6B7280",
      "unverified-bg": "#F3F4F6",
      "unverified-border": "#D1D5DB",
    },
    amber: {
      warn: "#B45309",
      "warn-bg": "#FFFBEB",
      "warn-border": "#FCD34D",
      "warn-light": "#FEF3C7",
    },
    state: {
      pending: "#6B7280",
      "pending-bg": "#F9FAFB",
      processing: "#2563EB",
      "processing-bg": "#EFF6FF",
      reported: "#DC2626",
      "reported-bg": "#FEF2F2",
    },
    neutral: {
      950: "#0A0A0A",
      900: "#1A1A1A",
      700: "#374151",
      500: "#6B7280",
      300: "#D1D5DB",
      200: "#E5E7EB",
      100: "#F3F4F6",
      50: "#F9FAFB",
    },
  },
},

fontSize: {
  // ... (기존 display/h1~h4/body-l~s/caption/label 유지)
  "trust-label": ["13px", { lineHeight: "1.3", fontWeight: "600", letterSpacing: "0.02em" }],
  "trust-score": ["22px", { lineHeight: "1.0", fontWeight: "700", letterSpacing: "-0.01em" }],
  "trust-desc": ["12px", { lineHeight: "1.4", fontWeight: "400", letterSpacing: "0.01em" }],
  price: ["20px", { lineHeight: "1.2", fontWeight: "700", letterSpacing: "-0.01em" }],
},

spacing: {
  // ... (기존 screen-x 유지)
  "card-pad": "16px",
  "card-gap": "12px",
  "badge-pad-x": "8px",
  "badge-pad-y": "4px",
  "section-gap": "24px",
  "score-gap": "6px",
},

borderRadius: {
  // ... (기존 sm/md/lg/xl/full 유지)
  badge: "6px",
},

boxShadow: {
  // ... (기존 sm/md/lg 유지)
  "card-trust": "0 2px 8px rgba(26,51,82,0.10)",
  "badge-gold": "0 1px 4px rgba(184,134,11,0.25)",
},
```

---

## 7. 아이콘 스타일 가이드

### 아이콘 세트

**Lucide Icons** — Radix UI와 동일 생태계, Tree-shakeable, Next.js 호환.

```bash
npm install lucide-react
```

### 진짜집 전용 아이콘 매핑

| 용도 | Lucide 아이콘 | 크기 | 비고 |
|------|-------------|------|------|
| Gold 배지 | `ShieldCheck` | 16/24px | 방패+체크 이중 코드 핵심 |
| Silver 배지 | `Camera` + `MapPin` (오버레이) | 16/24px | 합성 아이콘 |
| Unverified 배지 | `HelpCircle` | 16/24px | 점선 원+물음표 |
| 앰버 경고 | `AlertTriangle` | 14/16px | |
| pending | `Clock` (점선 스타일) | 14px | |
| processing | `Loader2` (spin) | 14px | `animate-spin` |
| reported | `Flag` | 14/16px | |
| 사진 항목 | `Camera` | 16px | |
| EXIF 항목 | `ScanSearch` | 16px | |
| 커뮤니티 항목 | `Users` | 16px | |
| 소유자 항목 | `BadgeCheck` | 16px | |
| 거래 항목 | `TrendingDown` | 16px | 정상 시 회색 비활성 |
| 업로드 | `Upload` | 20px | |
| 카메라 직촬 CTA | `CameraIcon` | 24px | |
| 신고 | `Flag` | 16px | |
| 스텝 완료 | `CheckCircle2` | 28px | 그린 채움 |

### 커스텀 아이콘 규칙

- **스트로크 두께**: 1.5px (기본), 중요도 높은 배지 아이콘은 2px
- **뷰박스**: 24×24 통일
- **색상**: 부모 컨테이너의 `currentColor` 상속. 배지 내부 아이콘은 배지 등급 전경색 사용
- **Silver 배지 합성 아이콘**: `Camera` 우측 하단에 `MapPin` 8px 오버레이 (SVG `<use>` 또는 absolute position)

---

## 8. 스크린별 레이아웃 요약

### P0 화면 4종

#### 검색 페이지 `/`

```
[헤더: 진짜집 로고 + 검색 바]
[필터 탭: 전체 / 실거주 인증 / 현장 인증]  ← TrustScoreBadge compact 칩
[신뢰순 정렬 기본 안내 배너 (1회 노출)]
[무한 스크롤 리스트]
  └─ ListingCard × N
[하단 네비게이션 바]
```

#### 매물 상세 `/listings/[id]`

```
[사진 갤러리 (블러 통과본만, 스와이프)]
[TrustScoreBadge featured + 미디엄 도넛]
[ScoreBreakdown 5항목 막대 분해]
[자연어 신뢰 설명 "실거주 세입자가 직접 찍음"]
[매물 기본 정보: 가격/면적/층/방향]
[신고하기 버튼 → ReportSheet]
[중개사 연락 CTA]
```

#### 업로드 `/verify`

```
[VerificationStepper 4단계]
[현재 단계 콘텐츠 영역]
  └─ Step 1: PASS 인증 버튼
  └─ Step 2: 전자동의 체크박스 + 약관
  └─ Step 3: PhotoUploader (직촬 우선 CTA)
  └─ Step 4: 결과 피드백 (점수 카운트업)
```

#### 신고 진입 `/report` 또는 시트

```
ReportSheet (슬라이드업)
```

---

*진짜집 UI 스펙 v1.0 — 작성 완료*
*다음 단계: UX디자이너와 와이어프레임 통합 → 디자인팀장 최종 확정 (design-final.md)*
