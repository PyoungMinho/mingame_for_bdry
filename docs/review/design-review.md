# 진짜집(Jinjjajip) 디자인 충실도 최종 검수

> 검수: 디자인팀장 (최종 결정권자) · 2026-06-03 · STEP 6 최종 리뷰
> SSOT: `docs/design/real-estate-design-final.md` + `real-estate-ui-spec.md` + `real-estate-ux-spec.md`
> 구현물: `apps/jinjjajip/src/` (M0 P0 4화면 + 내활동) · `tailwind.config.ts`
> 방식: 스펙 대조 코드리뷰 + tsc/vitest 실측. 코드 재작성 없이 자기 영역 미세 수정 1건 적용.

## 종합 판정: 조건부 승인 (M0 디자인 GO)

P0 4화면 + 내활동, 11개 P0 컴포넌트가 SSOT를 높은 충실도로 구현했다. 브랜드 핵심 약속(신뢰·실거주 인증의 시각 우선, 이중 코드화, pending 정직성)이 화면에서 정확히 전달된다. 검수 중 발견한 **단 하나의 명확한 스펙 불일치(ScoreBreakdown 등급 컬러)는 본 검수에서 직접 수정·검증 완료**했다. 잔여 갭은 모두 코스메틱/카피 수준으로 출시를 막지 않는다.

실측: `tsc --noEmit` exit 0 · `vitest run` 16파일 / **151 PASS / 0 FAIL** (수정 후 회귀 없음).

---

## 검수항목별 합격/갭

### 1. 디자인 토큰 — 합격 ✓

`tailwind.config.ts`가 design-final §3 토큰을 verbatim 반영. 핵심 팀장 결정 3건 모두 정확:
- D2 Silver 슬레이트 `#5B6F7A` 반영 (`tailwind.config.ts:31`).
- D4 unverified `#6B7280` 통일 (`tailwind.config.ts:34`, `TrustDonut.tsx:24`).
- realestate.* 네임스페이스 격리 — 오름/tier-gg 토큰 미오염 (§10.1 제약 준수).
- 타이포 4종(trust-label/score/desc/price), spacing(card-pad/badge-pad/score-gap/screen-x), radius badge=6px, shadow(card-trust/badge-gold) 전부 일치.
- 다크모드: `darkMode:["class"]` 보존 + 컴포넌트 `dark:` 분기 부재 → §1.4 "토큰만 정의, UI 미적용" 결정과 정합. **합격.**

### 2. 핵심 컴포넌트 충실도 — 합격 ✓ (수정 1건 반영 후)

- **TrustDonut** (`src/components/trust/TrustDonut.tsx`): 28/36/52px 3사이즈, 12시 시작(-90deg), `strokeLinecap=round`, 최소 8px 아크(`:50-55`), D4 아크색, `motion-reduce:transition-none`. **합격.**
- **TrustScoreBadge** (`src/components/trust/TrustScoreBadge.tsx`): 3등급 색+형태 이중코드(Gold ShieldCheck / Silver Camera+MapPin 합성 `:60-77` / Unverified HelpCircle+점선 1.5px), D3 `N점~` 하한 표기(`:108`), maxPossible 보조, Unverified 앰버 스트립 자동렌더(`:186-194`), `role=status`+aria-label. **합격.**
- **ScoreBreakdown** (`src/components/trust/ScoreBreakdown.tsx`): 5항목·아이콘 매핑(§6.4), pending 점선+0점 표기금지(`:55-72`), processing 우선판정(`:36-52`), reported 레드, 분모 항상 공개, `role=progressbar`. **[수정완료] verified 막대 등급 컬러** — 아래 갭 G1 참조.
- **StatusChip** (`src/components/common/StatusChip.tsx`): 3상태 + processing reduced-motion 정적 CircleDashed 폴백(`:53-65`). **합격.**
- **VerificationStepper** (`src/components/verify/VerificationStepper.tsx`): D1 5단계 확정(`:16`), 완료 그린/현재 네이비/오류 레드, CheckCircle2, `role=progressbar` valuemax=5, 각 원 aria-label(`:95`). **합격.**
- **ErrorState/EmptyState** (`src/components/common/`): 아이콘+텍스트 조합(아이콘 단독 아님), 복구 액션 슬롯, role=alert/status. **합격.**
- **ListingCard** (`src/components/listing/ListingCard.tsx`): 배지 가격보다 시각 우선(`:94-101`), Unverified border-top 4px 앰버 스트립(`:73`), pending 툴팁(`:115-136`), tabIndex=0/role=article/Enter·Space. **합격.**
- **ReportSheet / PhotoUploader / BeforeAfterSlider**: Radix Sheet/RadioGroup·Dialog/Progress/AlertDialog·Slider 정확. 이탈 AlertDialog, 블러 보정 Dialog, sr-only 접근성 슬라이더. **합격.** (카피 일관성 G3 참조)

### 3. UX 플로우 — 합격 ✓

- **검색홈** (`src/app/page.tsx`): 헤더48→지역퀵탭/필터→정렬카운트(isSuccess 게이트)→등급칩→리스트(반응형 1/2/3컬럼)→탭바. 신뢰순 서버정렬(`sort:"trust"`, 프론트 재정렬 없음 §10.1-2 준수). 스켈레톤 6개. ux-spec IA 일치.
- **/verify 5단계** (`src/app/verify/page.tsx`): Stepper(5) + Step1 PASS→Step2 동의→Step3 사진→Step4 폴링→Step5 결과. 이어서하기, 나중에확인 탈출구, `step`/`token`/`listingId` 딥링크 파싱(§10.3). 낙관금지: `done===true`만 step5 전환(`:102`).
- **매물 상세** (`src/app/listings/[id]/page.tsx`): **RSC** + loading.tsx 스켈레톤. 신뢰패널(featured+52px 도넛) 최상단→ScoreBreakdown→기본정보→신고링크→하단고정 CTA(Safe Area). §5.2 영역 우선순위 정확.
- **/auth/verify 게이트** (`src/app/auth/verify/page.tsx`): 필수3+선택1 동의, 모두동의 숏컷, 전문 아코디언, 약관버전 v1.2. **/my**: EmptyState 골격(§2.2). **합격.**

### 4. 신뢰 전달 비주얼 언어 — 합격 ✓ (브랜드 핵심)

- 정보 위계: 카드·상세 모두 자연어 라벨·등급이 가격/사진보다 시각 우선(원칙1). 사람 언어 카피(§9 사전) 하드코딩 일치.
- 이중 코드화: 색+아이콘 형태+텍스트+테두리 패턴 4중. 색맹 시 형태/패턴만으로 3등급 구분 가능(§8.1 강제 충족).
- **pending 정직성(핵심 검수 포인트)**: pending이 0점/실패로 오인되지 않게 ① 막대 점선(채움 아님) ② 우측 "검증 대기 중"(0점 숫자 금지) ③ §4.3 보조카피 "미검증은 허위매물 신호가 아니에요" ④ 총점 `N점~` 하한 표기 — **4중 안전장치로 정확히 구현**. `aggregateTrustScore`가 pending을 점수 제외+maxPossible 포함+isLowerBound=true로 처리(`domain.ts:199-225`). 비동기 정직성 원칙 완벽 준수.

### 5. 접근성 — 합격 ✓

- focus-visible 링: `globals.css:20-22` 전역 + 인터랙티브 요소 개별. reduced-motion 전역 처리(`:25-33`) + 컴포넌트 `motion-reduce:*`.
- aria: 배지 role=status, 도넛 role=img, 막대 role=progressbar+valuenow/max, 스텝퍼 progressbar, 상태변경 aria-live=polite, 모달 Radix 포커스트랩+ESC.
- 명도 대비: 토큰이 §8.2 검증값(전부 AA↑)을 그대로 사용. 터치타깃 ≥44px(탭바 h-14, 버튼 h-12~14, 아이콘버튼 w-10 h-10).
- 미세 관찰(비차단): 상세 중개사 "(인증)" 라벨이 `text-green-600`(`page.tsx:169`) — realestate 토큰 아닌 Tailwind 기본 그린. 대비는 충분하나 토큰 일관성상 후속 정리 권고.

### 6. 최근 추가 에러/가드 화면(버그리포트 §9) — 합격 ✓

- 검색홈 ErrorState (`page.tsx:174-179`): "잠시 연결이 끊겼습니다"+다시시도. ErrorState 컴포넌트 재사용으로 일관.
- verify Step4 에러 (`verify/page.tsx:110-128`): error/server-error/network-paused → ErrorState(재시도+홈으로). 데드엔드 제거. 공통 컴포넌트 사용 일관.
- verify Step3 매물부재 가드 (`verify/page.tsx:299-313`): "매물 정보가 없어요"+홈으로. ErrorState 패턴 동일.
- 세 화면 모두 동일 ErrorState 어휘·레이아웃·복구버튼 스타일 → **디자인 일관성 유지. 합격.**

---

## 갭 정리 (우선순위順)

### G1 [수정완료] ScoreBreakdown verified 막대 등급 컬러 불일치 — 디자인 영역, 본 검수에서 수정

- **위치**: `src/components/trust/ScoreBreakdown.tsx:96-118` (수정 전)
- **갭**: ui-spec §2-3(`real-estate-ui-spec.md:386`) + design-final §4.3은 "100% 획득=등급 컬러(Gold #B8860B / Silver #5B6F7A / 일반 #2563EB), 부분=70% 투명"으로 명시. 구현은 grade를 받지 않고 verified 막대를 `#1A3352`(brand-primary, 네이비)로 하드코딩 → Gold/Silver 매물의 5항목 막대가 모두 네이비 단색으로 칠해져 등급-막대 시각 연결이 끊김.
- **수정**: `ScoreBreakdown`에 옵셔널 `grade` prop 추가 + `VERIFIED_FILL` 등급 컬러 매핑 + 부분획득 70%(`B3` 알파)/0점 트랙동색 적용. 두 호출처 연결: `ListingCard.tsx:118`(trustGrade), `listings/[id]/page.tsx:130`(trust.badgeAchieved).
- **검증**: tsc exit 0 · vitest 151 PASS(score-breakdown 10건 포함 회귀 0). pending/processing/reported 막대는 미변경(정보 정확성 유지).

### G2 [비차단] 검색홈 등급 필터 칩 — 장식만, 클릭 비동작

- **위치**: `src/app/page.tsx:143-160`
- **갭**: §5.1은 "전체/실거주 인증/현장 인증" 필터 칩을 명시. 구현은 Gold/Silver TrustScoreBadge 2개를 장식으로만 표시(onClick 없음, "전체" 칩 없음). 지역/유형 필터는 정상 동작하므로 등급 필터만 미완.
- **판정**: 등급 필터는 신뢰순 정렬로 상위 노출이 대체되어 M0 핵심 가치 손상 없음. M1 후속. **출시 비차단.**

### G3 [비차단] ReportSheet 제출 전 카피 vs 정책 일관성

- **위치**: `src/components/report/ReportSheet.tsx:224`(제출 전) vs `:119`(제출 후) / design-final §9 카피사전
- **갭**: 제출 전 안내 "신고 접수 즉시 매물이 비공개 전환됩니다"와 제출 후/§9 카피 "검토 중에도 매물은 계속 볼 수 있어요"가 사용자 관점에서 상충해 보임(notice-and-takedown 즉시비공개 vs 검토중 노출). 백엔드 정책(BUG-05 reported 정책 미확정) 의존.
- **판정**: 정책 확정(기획/백엔드) 후 카피 단일화 필요. 디자인 단독 수정 불가(정책 종속) → 출시 전 카피 정렬 권고하나, 두 문구 모두 안심 톤이라 **비차단**.

### G4 [관찰] TrustScoreBadge Unverified 앰버 스트립 카피 톤

- **위치**: `src/components/trust/TrustScoreBadge.tsx:192`
- **관찰**: 스트립 카피 "미인증 매물입니다. 현장 방문 전 주의하세요"는 §9 원칙3(불안 유발 대신 안심)과 자연어 라벨 "아직 현장 검증이 되지 않은 매물이에요"보다 약간 경고 톤이 강함. 정보 전달은 정확.
- **판정**: 톤 미세조정 여지(예: "현장 검증 전이니 직접 확인을 권해요"). 비차단, M1 카피 폴리싱 시 검토.

### G5 [관찰·디자인 영역 밖] verify/page.tsx Step1Content 미사용 변수

- **위치**: `src/app/verify/page.tsx:19` `const setStep`(Step1Content 스코프 내 미사용; 실제 사용은 VerifyContent).
- **판정**: tsconfig에 noUnusedLocals 미설정 → 빌드 비차단(tsc exit 0 확인). 프론트 영역 코드정리 사항. 디자인 충실도 무관.

---

## M0 출시 디자인 판정

| 구분 | 판정 |
|---|---|
| 디자인 토큰 | GO |
| 핵심 컴포넌트(11종) | GO (G1 수정완료) |
| UX 플로우(P0 4+1화면) | GO |
| 신뢰 비주얼 언어 / pending 정직성 | GO |
| 접근성(AA+색맹) | GO |
| 에러/가드 화면 일관성 | GO |

**최종: 디자인 GO (조건부 승인).** 출시 차단 갭 없음. G1은 검수 중 해소. G3(신고 카피)는 백엔드 정책 확정 시 카피 단일화 — 디자인 단독 차단 아님. G2/G4/G5는 M1 폴리싱 백로그.

---

## M1 디자인 후속 백로그

1. 등급 필터 칩 동작화(전체/실거주/현장) — G2.
2. 신고 정책 확정 후 ReportSheet 카피 단일화 — G3 (기획/백엔드 동반).
3. Unverified 앰버 스트립 톤 폴리싱 — G4.
4. 중개사 "(인증)" 라벨 realestate 토큰화 — 검수5 미세관찰.
5. 다크모드 배지 대비비 재검증 후 UI 적용 (design-final §10.5).
6. 데스크톱 전용 레이아웃(상단 네비 전환) — 현재 모바일 중앙정렬 허용.

*진짜집 디자인 충실도 검수 — 디자인팀장 확정 · 2026-06-03*
