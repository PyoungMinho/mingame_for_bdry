# 모이라(Moira) — 디자인 최종 산출물

> 스킬 적용: `ui-ux-pro-max`(디자인 시스템 도출) + `frontend-design`(아트디렉션·모션).
> 풀 시스템: [`design-system/moira/MASTER.md`](../../design-system/moira/MASTER.md)
> 빌드 검증: 2026-06-09, 모바일 375 / 480 / 데스크탑 1280 — 콘솔 에러 0, 가로 스크롤 0.

---

## 1. 아트 디렉션 — "공평의 저울"

제품의 생사는 **"이게 진짜 공평하네"라는 한순간의 설득**. 모든 디자인 무게를
**이동시간 가로막대 + 격차 숫자**라는 단 하나의 증거 장치에 집중시켰다.

- 톤: **데이터에 정직한 에디토리얼.** 화려함보다 "정확함이 주는 안도감".
- 신뢰(공평=논쟁 종결) + 친근(무가입·즉시) + 바이럴(결과가 공유하고 싶은 카드).

## 2. 디자인 토큰 (Tailwind `moira.*`)

`tailwind.config.ts`에 가산 추가 — 기존 문제팩토리 토큰 무손상.

- Brand 인디고 `#4F46E5` / dark `#4338CA` / tint `#EEF2FF`
- **공평성 스케일(색=오직 공평도)**: good `#10B981`(격차≤10) · mid `#F59E0B`(11–20) · bad `#F43F5E`(21+)
- Kakao `#FEE500` (공유/투표 CTA 전용)
- 면: bg `#F8FAFC` · surface `#FFF` · border `#E2E8F0`
- 글자: ink `#0F172A` · body `#475569` · muted `#94A3B8`
- 폰트: **Pretendard**(전역 로드), 숫자 전부 `tabular-nums`, 굵기 대비로 캐릭터.

## 3. 시그니처 모션

- **FairnessBars 진입**: 막대 0→실제값 staggered 성장(70ms 간격) + 숫자 count-up.
- count-up은 `requestAnimationFrame` 기반이되 **숨김 탭/모션감소에서 최종값 보장**
  (`document.hidden`·`visibilitychange`·safety timeout) — 어중간하게 멈추지 않음.
- 카드 press(scale .99), 투표 진행바 실시간 width 트랜지션, "실시간 집계" 펄스 점.

## 4. 빌드된 4 화면 (라우트)

| # | 화면 | 경로 | 핵심 |
|---|------|------|------|
| 1 | 생성/주소입력 | `/moira` | 내 출발지 + 멤버 카톡 주소요청 링크, 멤버 칩 실시간 누적 |
| 2 | **결과/추천 ★** | `/moira/result` | StationHero(추천역+격차 카피) + 장소후보 5 PlaceCard, 각 카드 **FairnessBars**(제품 생사) |
| 3 | 카톡 무가입 투표 | `/moira/vote` | 로그인 0, 즉시 투표, 실시간 집계 진행바, 한 번 탭=투표 |
| 4 | 확정 | `/moira/confirm` | 확정 카드 + 길찾기/예약/1n정산/공유 딥링크, 카톡 공유 CTA |

## 4-b. 상태(state) 보강 — 빈·로딩·에러 (`src/components/moira/States.tsx`)

happy-path만으로는 제품이 가짜처럼 느껴진다. 실제 흐름의 빈틈을 채웠다.

- **★ 계산중 `FairnessComputing`** — `/moira/result` 진입 시 1.8초 노출 후 결과 공개.
  멤버 아바타 레이더(ping) + 단계별 카피 순환("좌표 확인→이동시간 측정→후보 비교→공평한 지점 선택")
  + 인디터미닛 진행바 + 결과 카드 스켈레톤(시머). ODsay N×K 연산을 **신뢰의 한순간**으로 연출.
- **빈 상태 `EmptyState`** — `/moira`에서 멤버 칩 `X`로 친구를 모두 빼면 노출.
  점선 카드 + UserPlus + "아직 초대한 친구가 없어요" + 카톡 링크 CTA(액션 내장).
- **에러 상태 `ErrorState`** — `/moira/result?view=error`. 로즈 경고 아이콘 + "다시 계산하기"(→재연산)
  + "출발지 다시 입력"(→`/moira`). 색은 공평도 전용이므로 **에러는 로즈를 의미로 쓰지 않고 아이콘+카피로 전달**.
- 검증 제어 쿼리: `?view=loading|ready|error` 로 상태 고정(스크린샷·데모용).
- 모션은 `globals.css`의 `moira-` 프리픽스 키프레임(shimmer·indeterminate·soft-pulse) — 문제팩토리 무손상,
  `prefers-reduced-motion` 시 전역 규칙으로 자동 정지.

## 5. 컴포넌트 (`src/components/moira/`)

`MoiraShell`(max-w-480 프레임+워드마크+스텝퍼) · `Button`(primary/kakao/outline/ghost) ·
**`FairnessBars`**(시그니처) · `PlaceCard` · `StationHero` · `VoteOption` ·
`MemberChip`(빼기 옵션)/`Avatar`/`AvatarStack` · `Stepper` · `StickyBottomBar` · `motion`(CountUp·hooks) ·
**`States`**(`FairnessComputing`·`EmptyState`·`ErrorState`·`Skeleton`).
로직: `src/lib/moira/fairness.ts`(격차→등급·색), `src/lib/moira/mock.ts`(서울 4인 데모).

## 6. 접근성·품질

- 본문 대비 4.5:1+, 포커스 링(brand 35%), 터치타겟 ≥44px, 하단 CTA safe-area.
- 색만으로 공평도 전달 금지 → **항상 숫자 라벨 동반**. lucide 아이콘만(이모지 금지).
- `prefers-reduced-motion` 시 막대/카운트업 즉시값.

## 7. 다음 단계(개발 연동 포인트)

- FairnessBars `members` 데이터 → ODsay 대중교통 시간행렬 N×K로 교체.
- StationHero/PlaceCard 추천 → 공평성 인덱스(`α·평균+β·최대+γ·표준편차`) 결과 바인딩.
- 투표 집계 → 폴링(웹소켓 X), 카톡 무가입 토큰 세션. 지도 자리 → 카카오맵 SDK.
