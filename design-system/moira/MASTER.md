# 모이라(Moira) — Design System Master

> **LOGIC:** 특정 화면을 만들 땐 먼저 `design-system/moira/pages/[page].md`를 확인.
> 그 파일이 있으면 그 규칙이 이 Master를 **override**. 없으면 아래 규칙을 그대로 따른다.

**Project:** 모이라(Moira) — 공평한 중간지점 추천 + 카톡 무가입 그룹 투표
**Platform:** 모바일 우선 한국어 웹앱 · Next.js(App Router) + Tailwind + 카카오맵
**Generated:** 2026-06-09 (ui-ux-pro-max + frontend-design 적용, 손수 보정)

---

## 0. 컨셉 — "공평의 저울 (The Fair Scale)"

제품의 생사는 **"이게 진짜 공평하네"라는 한순간의 설득**에 달려 있다.
그래서 디자인의 모든 무게중심은 **이동시간 가로막대 + 격차 숫자**라는 단 하나의 증거 장치에 쏠린다.

- **신뢰감** = 논쟁 종결. 추측이 아니라 숫자로 증명한다(`격차 12분 · 가장 공평`).
- **친근함** = 무가입·즉시성. 카톡 한 번이면 모두가 1초 만에 투표한다.
- **바이럴** = 결과 화면이 그 자체로 공유하고 싶은 카드가 된다(OG 이미지).

> 톤 한 줄: **데이터에 정직한 에디토리얼.** 화려함보다 "정확함이 주는 안도감".

---

## 1. 디자인 원칙 (5)

1. **공평은 편차로 증명한다** — 평균이 아니라 *멤버 간 격차*를 가장 크게 보여준다. 막대 + 숫자 + 한 줄 카피.
2. **무가입 즉시성** — 로딩·로그인 0. 링크 열면 0.5초 안에 행동 가능한 화면.
3. **모바일 엄지존** — 주요 액션은 화면 하단 고정(StickyBottomBar), 터치타겟 ≥ 44px.
4. **한 화면 한 결정** — 각 화면은 단 하나의 다음 행동만 강조한다.
5. **숫자는 또렷하게** — 모든 시간/분/표는 `tabular-nums`. 카운트업으로 살아있게.

---

## 2. 스타일

**Style:** Flat Design + Micro-interactions
**Keywords:** clean, trustworthy, friendly, data-honest, tactile-on-touch
**Key Effects:**
- 결과 화면 진입 시 **막대가 0→실제값으로 staggered 성장** (제품의 시그니처 모션)
- 시간 숫자 **count-up** (0분 → 23분)
- 카드 탭 시 가벼운 press(scale 0.99) + 그림자 하강
- 투표 집계 진행바 **실시간 width 트랜지션**

**Anti-patterns (절대 금지):**
- ❌ 보라색 그라데이션 on 화이트(=AI슬롭), 무의미한 글래스모피즘
- ❌ 이모지를 아이콘으로 사용 → **lucide-react SVG**만
- ❌ 레이아웃 흔드는 hover scale, 200ms 넘는 굼뜬 전환
- ❌ 공평성 막대에 의미 없는 무지개색 → 색은 *오직 공평도*만 의미
- ❌ 본문에 회색4(저대비), 투명 보더(라이트모드 안 보임)

---

## 3. 컬러 토큰

Tailwind `moira.*` 네임스페이스로 추가(가산적 — 문제팩토리 토큰 무손상).

| 역할 | Hex | Tailwind | 용도 |
|------|-----|----------|------|
| Brand | `#4F46E5` | `moira-brand` | 주 CTA, 강조, 선택 상태 |
| Brand Dark | `#4338CA` | `moira-brand-dark` | hover/press |
| Brand Tint | `#EEF2FF` | `moira-brand-tint` | 선택 배경, 칩 |
| **Fair-Good** | `#10B981` | `moira-fair-good` | 격차 작음 = 공평 ✅ |
| **Fair-Mid** | `#F59E0B` | `moira-fair-mid` | 격차 보통 ⚠ |
| **Fair-Bad** | `#F43F5E` | `moira-fair-bad` | 격차 큼 = 불공평 |
| Track | `#E2E8F0` | `moira-track` | 막대 배경 트랙 |
| Kakao | `#FEE500` | `moira-kakao` | 카톡 공유/투표 CTA만 |
| Kakao Ink | `#191600` | `moira-kakao-ink` | 카톡 버튼 글자 |
| BG | `#F8FAFC` | `moira-bg` | 앱 배경(쿨 슬레이트) |
| Surface | `#FFFFFF` | `moira-surface` | 카드 |
| Border | `#E2E8F0` | `moira-border` | 카드/입력 테두리 |
| Ink | `#0F172A` | `moira-ink` | 제목/숫자 |
| Body | `#475569` | `moira-body` | 본문(대비 7:1+) |
| Muted | `#94A3B8` | `moira-muted` | 보조 라벨 |

**공평도 → 색 매핑 규칙 (FairnessBars 핵심 로직):**
- 멤버 간 이동시간 **격차(max−min) ≤ 10분** → `fair-good`
- 11–20분 → `fair-mid`
- 21분+ → `fair-bad`
- 가장 공평한 후보 1개에는 `★ 가장 공평` 뱃지(brand) 부여.

---

## 4. 타이포그래피 — Pretendard

한국어 소비자 앱의 정답은 Inter/Roboto가 아니라 **Pretendard**(이미 전역 로드됨).
캐릭터는 *폰트 교체*가 아니라 **굵기 대비 + 자간 + 숫자 처리**로 만든다.

| 토큰 | size / weight / tracking | 용도 |
|------|--------------------------|------|
| display | 30px / 800 / -0.02em | 결과 화면 핵심 역명 |
| h1 | 24px / 800 / -0.02em | 화면 타이틀 |
| h2 | 20px / 700 / -0.01em | 카드 제목, 장소명 |
| body | 16px / 400 / 0 | 본문 |
| sm | 14px / 500 | 라벨, 보조 |
| xs | 13px / 600 | 칩, 뱃지 |
| **num** | `tabular-nums` + 700 | 모든 분/시간/표 (정렬 안정) |

- 본문 `line-height: 1.6` (한글), 숫자엔 `font-variant-numeric: tabular-nums`.
- 시간 숫자는 항상 `tabular-nums`로 — 카운트업 시 너비가 흔들리지 않게.

---

## 5. 형태 · 간격 · 그림자

| 항목 | 값 |
|------|-----|
| 앱 컨테이너 | `max-w-[480px] mx-auto` (모바일 우선, 데스크탑서도 폰 폭) |
| 카드 radius | `rounded-2xl` (16px) |
| 버튼/입력 radius | `rounded-xl` (12px) |
| 화면 좌우 패딩 | `px-5` (20px) |
| 카드 패딩 | `p-4`~`p-5` |
| 그림자(카드) | `0 1px 2px rgba(15,23,42,.04), 0 8px 24px rgba(15,23,42,.06)` |
| 그림자(고정바) | `0 -8px 24px rgba(15,23,42,.06)` |
| 트랜지션 | `150–250ms cubic-bezier(.4,0,.2,1)` |

---

## 6. 컴포넌트 스펙 (src/components/moira/)

| 컴포넌트 | 핵심 |
|----------|------|
| `MoiraShell` | max-w-480 컨테이너 + 배경 + (옵션)헤더/스텝퍼 + 하단 safe-area |
| `Button` | variant: primary(brand)·kakao(yellow)·ghost·outline / size lg는 h-13 풀폭 |
| **`FairnessBars`** | 멤버별 가로막대(이름·분), 격차 색매핑, `★가장 공평` 뱃지, 막대 staggered 성장 + 숫자 count-up. **제품 시그니처** |
| `PlaceCard` | 장소 후보(이름/카테고리/도보/대표 미리보기) + FairnessBars 요약 + 선택 라디오 |
| `StationHero` | 결과 최상단 — 추천 중간역 대형 표기 + 격차 한 줄 카피 |
| `MemberChip` | 아바타(이니셜) + 이름 + 출발지/상태(입력완료·대기) |
| `VoteOption` | 투표 옵션 카드 + 실시간 집계 progress + 득표수/퍼센트 |
| `VoteProgress` | 가로 진행바, width 트랜지션, 색 brand |
| `StickyBottomBar` | 하단 고정 CTA 영역, safe-area, 그림자 위로 |
| `Stepper` | 1·생성 → 2·결과 → 3·투표 → 4·확정 진행 표시 |

---

## 7. 핵심 화면 4 방향

1. **생성/주소입력** — 조율자 본인 위치 입력(현재위치/검색) → 멤버 주소요청 **카톡 링크 생성**. 들어온 멤버는 MemberChip로 실시간 누적. CTA: "중간지점 찾기".
2. **★결과/추천 (생사)** — StationHero(추천역+`격차 12분·가장 공평`) → 장소후보 3~5 PlaceCard, 각 카드에 **FairnessBars**. 진입 모션이 제품의 첫인상. CTA: "이 후보로 투표 시작".
3. **카톡 무가입 투표** — 로딩·로그인 0. 열면 바로 VoteOption 리스트 + 실시간 집계. 한 번 탭 = 투표. 상단에 "○명 중 △명 투표".
4. **확정** — 확정된 장소 대형 카드 + 멤버별 길찾기/예약/정산 **딥링크 버튼**(카카오맵·캐치테이블·토스). 공유 카드 = 바이럴 루프.

---

## 8. 접근성·품질 체크 (배포 전)

- [ ] 본문 대비 4.5:1+ (ink/body 토큰 사용, muted는 보조에만)
- [ ] 모든 클릭요소 `cursor-pointer` + 가시적 focus ring(brand 35%)
- [ ] 터치타겟 ≥ 44px, 하단 CTA safe-area
- [ ] `prefers-reduced-motion` 시 막대 성장/카운트업 즉시값
- [ ] 색만으로 공평도 전달 금지 → **항상 숫자 라벨 동반**
- [ ] 375 / 480px 반응형, 가로 스크롤 0
- [ ] lucide-react 아이콘만, 이모지 아이콘 금지
