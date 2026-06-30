# 모이라(Moira) — 프론트엔드 최종 리뷰 (STEP 6, 갱신본)

> 검수: @프론트팀장 (Opus) · 2026-06-09 (★RouteMap + 버그픽스 3건 반영 최신본)
> 대상: `src/app/moira/**` (6 페이지) · `src/components/moira/**` (15) · `src/lib/moira/{route,transit,fairness,mock,token}.ts` · `src/lib/utils.ts`
> 성격: **검수 전용 — 프로덕션 코드 미수정.** 본 파일만 작성.
> 이전 리뷰(15:48)는 RouteMap·버그픽스 미반영 stale → 본 문서가 대체.

---

## 0. 무엇이 바뀌었나 (이전 리뷰 대비)

이전 리뷰는 5개 페이지(create/result/vote/confirm) 기준이었고, 데이터 계층 부재(B1)·폴링 부재(B2)를 Blocker로 지적했다. 그 이후:
- **★ `/moira/routes` (RouteMap) 신규 빌드** — 멤버별 경로선 SVG 시각화 + 장소 A/B/C 실시간 점수 변동 + 드래그업 패널 + PlaceEditSheet. 컴포넌트 5종 신설(RouteMapCanvas, MemberRouteChip, TransportBadge, FairnessScoreBadge, PlaceEditSheet) + lib 2종(route.ts, transit.ts).
- **브라우저 검증 중 버그 3건 발견·수정** — 하단 바 줄바꿈 / [+] 무반응 / 드래그 패널 멈춤.
- 본 검수의 핵심은 **이 버그픽스 3건이 코드상 건전하고 회귀가 없는지** 검증하는 것.

> B1(데이터 페칭 계층 0줄)·B2(투표 폴링 부재)는 **여전히 유효**하나, 이는 "P0 데모 정적 프로토타입" 단계 설계상 의도된 미착수다(G2 입증 전 라이브 금지). RouteMap도 동일하게 mock 직접 import이며 P1(ODsay 실폴리라인) 미착수가 정상.

---

## 1. 종합 판정 — **조건부 합격 (GO for P0 demo, with cleanup)**

버그픽스 3건은 **모두 코드상 정확하고 부작용·회귀가 없다.** TypeScript 0에러, 테스트 323/323 통과(baseline 유지, 회귀 0). 제품 격리(moira 네임스페이스) 완벽 — 타제품(exam/oreum/real-estate) import 0건, `any` 0건, 토큰 누수 0건. RouteMap 통합은 상태관리·메모이제이션·키 안정성 모두 양호하다.

**P0 데모 출시 게이트는 통과한다.** 추가로 발견한 이슈는 전부 **P2(데드코드/표기 일관성)** 수준이며 데모 동작을 막지 않는다. 라이브(G2 통과 후) 진입 시에는 이전 리뷰의 B1/B2(데이터 계층·폴링)와 본 문서 P1 항목을 먼저 닫아야 한다.

> 한 줄 근거: *"버그픽스 3건은 건전하다 — tsc/test 회귀 0, 격리 완벽. 남은 건 데모를 막지 않는 P2 데드코드뿐. P0 데모는 GO."*

---

## 2. 버그픽스 3건 건전성 검증 (본 검수 핵심)

### ✅ FIX #1 — 하단 바 버튼 줄바꿈 깨짐 (건전)
- 위치: `src/app/moira/routes/page.tsx:186-203` (StickyBottomBar 내부)
- 수정 확인:
  - outline "장소 바꿔보기" → `variant="outline" block={false}` + `className="shrink-0 whitespace-nowrap"` (`:187-195`)
  - primary "이 장소로 투표" → `block={false}` + `className="flex-1 whitespace-nowrap"` (`:196-203`)
- **건전성 분석:** `Button.tsx:50` `block && "w-full"` 이므로 `block={false}`가 `w-full`을 제거 → outline은 `shrink-0`로 콘텐츠 폭 유지, primary는 `flex-1`로 잔여 폭 흡수. `StickyBottomBar.tsx:27` 컨테이너가 `flex gap-2.5`라 두 자식이 정상 배분된다. `whitespace-nowrap`로 한글 글자단위 줄바꿈 차단. **부작용 없음** — 다른 StickyBottomBar 사용처(result:64, vote:40, confirm:62, create:46)는 이 페이지와 무관하게 각자 `block`/`w-[52px]` 패턴을 유지하므로 공유 컴포넌트 변경이 아닌 **호출부 className 변경**이라 회귀 불가. ✔

### ✅ FIX #2 — 멤버칩 [+] 버튼 무반응 (건전)
- 위치: `src/app/moira/routes/page.tsx:125-129` (`handleAddMember`)
- 수정 확인: `allMemberCount>=6` 가드 제거, **항상** `setCapToast(true)` + 3초 후 자동 해제.
- **건전성 분석:** 데모는 4명(`mock.ts:15-48`)이라 기존 `>=6` 조건은 영구 silent no-op이었다. 수정 후 [+] 클릭 시 항상 "소그룹(6명)까지 무료 / 더 큰 모임은 팀 플랜" 토스트(`:288-297`) 노출 → P0 데모에 적합한 B2B 넛지 피드백. `setTimeout` cleanup 미설정이나 토스트 토글이라 **언마운트 후 setState 경고 가능성**은 이론상 존재 — 단 페이지 전환이 라우터 push라 실질 영향 미미(P2로 표기). 상태(`capToast`)는 독립적이라 다른 상태와 충돌 없음. ✔

### ✅ FIX #3 — 드래그 패널 멈춤 (Tailwind calc 공백 누락) (건전 + 전수조사 완료)
- 위치: `src/app/moira/routes/page.tsx:48-52` (`SNAP_MAP`)
- 수정 확인:
  - `peek: "translate-y-[calc(100%_-_60px)]"` (`:49`) — 언더스코어로 `-` 양옆 공백 표현
  - `full: "translate-y-[calc(120px_-_62vh)]"` (`:51`) — 부호 내장(`120px - 62vh` = 음수)으로 별도 `-` 프리픽스 없이 위로 이동
  - `default: "translate-y-0"` (`:50`)
- **건전성 분석:** Tailwind JIT는 임의값 내 공백을 언더스코어로 받는다(`calc(100%_-_60px)` → `calc(100% - 60px)`). 기존엔 공백 누락으로 무효 CSS → transform 묵살되어 패널이 안 움직였다. 수정 표기는 **Tailwind 공식 underscore 규약을 정확히 따름.** `full`이 음수 부호를 calc 내부에 넣은 것도 올바른 선택(Tailwind 임의값은 선행 `-`를 클래스 프리픽스로 해석하므로 `-translate-y-[calc(62vh_-_120px)]`보다 `translate-y-[calc(120px_-_62vh)]`가 안전). ✔
- **★ 전수조사 결과 (요청사항):** `grep "calc("` 로 `src/app/moira` + `src/components/moira` 전체 스캔 →
  - `routes/page.tsx:49`, `:51` **2건만** 존재, 둘 다 언더스코어 표기 정상.
  - **컴포넌트 15종에 calc() 임의값 0건** — 동일 패턴 잔여 버그 없음. **추가 누락 없음 확정.** ✔

**→ 버그픽스 3건 모두 건전. 부작용·회귀 없음. tsc 0에러 + test 323 통과로 이중 확인.**

---

## 3. 잘된 점 (Good)

1. **제품 격리 완벽.** `grep` 결과: moira → `@/lib/server`·`exam`·`oreum`·`real-estate`·`study` import **0건**. moira 파일 내 `persona-/sparta-/mentor-/exam-` 토큰 누수 **0건**. 모든 색·키프레임이 `moira.*`(tailwind.config:107-142) / `moira-` 프리픽스(globals.css:99-162)로 가산 격리. RouteMap 신규 토큰(`transport-*`, `map-overlay-*`, `score-*`)도 전부 `moira.` 하위. 타제품 무손상.

2. **RouteMap 데이터 계약이 단일 정의점.** `route.ts`가 `LatLng/RouteSegment/MemberRoute/RoutePlace/PlaceCandidate` 타입 단일 소스 + `ROUTE_WEIGHT/ROUTE_DASH/routeWeightKey` SVG 상수를 한 곳에. 페이지·컴포넌트가 여기서만 import → 타입 드리프트 차단. `MemberRoute extends MemberTime`로 공평성 로직과 호환.

3. **카카오 키 없이 SVG 폴백 견고.** `RouteMapCanvas.tsx:156-222`: `NEXT_PUBLIC_KAKAO_MAP_KEY` 부재 시 즉시 `setMapFailed(true)` → SVG 단독 렌더 + "지도 미리보기" 안내 배지(`:285-291`). mock polyline은 2차 베지어 보간 9~11점(`mock.ts:158-208`)이라 직선이 아닌 "실경로 같은 곡선"으로 4인 경로가 을지로3가로 수렴하는 시각화 보장. **P0 데모 적합.** SDK 로드 경로도 중복삽입 가드 + 5초 타임아웃 + cleanup 완비.

4. **공평성 시각화가 시그니처를 정확히 구현.** `FairnessBars.tsx`가 멤버 가로막대 + `▲최대/▼최소` 마커 + "최대 격차 N분" 응축, 색은 `fairness.ts:42-70 FAIR_STYLE` 한 곳에서만 등급 매핑(색=오직 공평도). `FairnessScoreBadge`는 장소 변경 시 ArrowUp/Down + delta + CountUp로 점수 변동을 실시간 표현.

5. **rAF count-up + reduced-motion 이중 안전장치.** `motion.tsx:46-76`: reduced/`document.hidden` 즉시 최종값, `visibilitychange` 스냅, `settle`(delay+duration+120ms) 타이머로 rAF throttle 시에도 최종값 도달 보장, cleanup 전부 해제. globals.css의 `@media (prefers-reduced-motion)` 로 경로선·마커도 즉시 최종 상태 고정(`:153-162`).

6. **접근성 기본기 양호.** 모든 인터랙티브 요소 `<button>` + `aria-label`/`aria-pressed`/`aria-live`, 터치타겟 `min-h-[44px]`/`min-w-[44px]` 일관 준수(MemberRouteChip:42, [+]버튼:280, 칩:233), PlaceEditSheet는 `role="dialog" aria-modal` + ESC 닫기 + 포커스. **이전 리뷰 m5(포커스 링)도 해소** — `.moira-scope :focus-visible` 브랜드 인디고 링(globals.css:167) 명시됨.

7. **프레젠테이션/컨테이너 경계 깔끔.** 15개 컴포넌트 전부 순수 프레젠테이션(prop 주입), `routes/page.tsx`가 컨테이너. `cn` 사용 일관, `Button`/`StickyBottomBar`/`MoiraShell` variant·slot 재사용성 높음.

---

## 4. RouteMap 통합 품질 (상태관리·메모이제이션·키)

| 항목 | 평가 | 근거 |
|---|---|---|
| 상태 설계 | **양호** | `selectedPlace`(RoutePlace 전체)/`prevScore`(점수 변동용)/`activeMembers`(빈배열=전체 ON 스파게티 방지)/`panelSnap`/`capToast`/`sheetOpen` 책임 분리 명확. `handlePlaceSelect`가 `setPrevScore`→`setSelectedPlace` 순서로 delta 계산 보장(`:132-140`). |
| 메모이제이션 | **양호** | `gap`(`:87`)·`maxMember`(`:101`) `useMemo([selectedPlace])`, 콜백 `useCallback` 의존성 정확. `PLACE_CANDIDATES`/`RANKS`/`SNAP_MAP` 모듈 스코프 상수라 리렌더 무관. |
| 키 안정성 | **양호** | 멤버칩·경로상세·SVG `key={m.id}`(`:264,364`, RouteMapCanvas `:306,353`), 장소칩 `key={c.id}`. **이전 FairnessBars key=id 이슈는 `key={`${m.name}-${i}`}`(FairnessBars:40)로 인덱스 보조 적용** — 동명이인 데모는 유일하나 라이브 대비 필요(M-라이브 항목 참고). |
| 불필요 리렌더 | **경미** | RouteMapCanvas가 `allPoints`/`bounds`/`memberPaths`/`originMarkers`를 매 렌더 재계산(`:132-258`, useMemo 없음). P0 4인 규모라 비용 미미하나, 라이브 다인·폴링 시 `useMemo` 권장(P2). |
| 드래그 UX | **양호** | 터치 dy 임계 ±40px로 snap 전환(`:157-164`), 핸들 클릭은 peek→default→full 순환(`:312-316`). FairnessBars `animate={panelSnap !== "peek"}`로 접힌 상태 애니메이션 억제(`:342`) — 영리함. |

---

## 5. 발견 이슈 (심각도 · 파일:라인)

### 🔴 P0 (데모 출시 차단) — **없음**
P0 데모 동작을 막는 이슈 없음. 버그픽스 3건으로 직전 차단 요인 해소.

### 🟠 P1 (라이브 전환 전 필수) — 이전 리뷰에서 이월, 여전히 유효
- **P1-1. 데이터 페칭 계층 0줄.** `src/app/moira/{page,result/page,routes/page,vote/page,confirm/page}.tsx` 전부 mock 모듈 상수 직접 import(`routes:27` `import { MEMBERS, ROUTE_PLACES } from "@/lib/moira/mock"`). `{success,data,meta}` 봉투 언래핑·`useMeetup/useResult/useVotes` 훅·토큰 스토어 미존재. **P1 의도된 미착수(G2 전 라이브 금지)지만 라이브 게이트.** mock이 API 응답과 동형이라 컴포넌트는 거의 무변경 전환 가능, 페이지 컨테이너 5종은 재작성 필요.
- **P1-2. 투표 화면 폴링 부재.** `vote/page.tsx:24-25` `baseVoted(=3)+myVote`는 단일 클라이언트 시뮬레이션. "실시간 집계" 배지(`:67-73`)는 표시뿐 실제 폴링 없음. 라이브 시 `meta.version/pollingIntervalMs` 기반 훅 필요.
- **P1-3. RouteMap도 라이브 시 ODsay 실폴리라인·서버 fairScore 신뢰 필요.** 현재 `fairScore`는 mock 하드코딩(`mock.ts:293,310,329`), polyline은 베지어 보간. P1 정상이나 라이브 전 서버 계산값으로 교체.

### 🟡 P2 (출시 후 정리) — 본 검수 신규 발견
- **P2-1. 데드코드: `RANK_OF`.** `routes/page.tsx:41-43`에서 `Object.fromEntries`로 생성하나 **파일 내 사용처 0건**(grep 확인). 제거 대상. (tsc는 미사용 지역 const를 에러로 안 잡아 통과.)
- **P2-2. 데드코드: `fairStyle` (RouteMapCanvas).** `:129` `const fairStyle = FAIR_STYLE[level]` 계산하나 **미사용** — 실제 경로색은 별도 `FAIR_COLOR` 맵(`:269-274`)에서 `routeStroke` 도출. `FAIR_STYLE` import가 이 죽은 변수 때문에만 남음. `fairStyle` 라인 + import 정리 권장. (기능 정상, 죽은 계산만.)
- **P2-3. `--route-length` CSS 변수 미연결.** `globals.css:141-148 @keyframes moira-route-draw`의 `from { stroke-dashoffset: var(--route-length, 1000) }`가 `--route-length`를 기대하나, `RouteMapCanvas.tsx:328-336`은 인라인 `strokeDasharray:`${length} ${length}` + strokeDashoffset:length` + `animation: moira-route-draw ...forwards`로 처리하고 **`--route-length`를 set하지 않는다.** 애니메이션 `from`이 fallback `1000`을 쓰므로 경로 길이≠1000일 때 시작 dashoffset이 어긋나 그리기 시작점이 미세하게 튈 수 있음(forwards라 끝은 0으로 정상 수렴). 데모상 무해하나, 인라인 `style={{ "--route-length": length }}` 추가 또는 keyframe을 `from { stroke-dashoffset: inherit }`로 정리 권장.
- **P2-4. `handleAddMember` setTimeout cleanup 미설정.** `routes/page.tsx:128`. 토스트 자동닫기 타이머가 언마운트 시 미해제 → 라우터 전환 직후 setState 경고 가능(실질 영향 미미). `useRef`+cleanup 또는 useEffect 기반 토스트로 정리 권장.
- **P2-5. RouteMapCanvas 파생값 useMemo 부재.** `:132-258` 매 렌더 재계산. P0 무해, 라이브 다인 대비 메모 권장(4번 표 참고).
- **P2-6. 클립보드/공유 하드코딩.** `page.tsx:28` `"https://moira.app/j/8Kd2xq"`, `routes:177` `window.location.href`. 라이브는 `inviteUrl` 응답값 + `Kakao.Share` 연결 필요.
- **P2-7. confirm 딥링크 4종 무동작.** `confirm/page.tsx:33-49 DeepLink`에 `onClick`/`href` 없음. 카카오맵·캐치테이블·토스 스킴 미연결(출시 후).
- **P2-8. `utils.ts` 오름 잔재 주석.** 공유 유틸 상단 오름 관련 주석 잔존(무해, 정리 대상) — 이전 리뷰 m6 이월.

---

## 6. 검증 로그 (사실 확인)

| 검증 | 명령 | 결과 |
|---|---|---|
| 타입 안전 | `npx tsc --noEmit` | **0 에러** (exit 0) ✔ |
| 테스트 회귀 | `npm test` (vitest run) | **17 파일 · 323 테스트 전부 통과** — baseline(17/323) 동일, **회귀 0** ✔ |
| calc() 공백 전수조사 | `grep "calc("` (moira app+components) | **2건만**(routes:49,51) 둘 다 언더스코어 정상. 컴포넌트 0건. **잔여 버그 없음** ✔ |
| 제품 격리 (cross-import) | `grep` server/exam/oreum/real-estate/study | **0건** ✔ |
| 타입 안전 (`any`) | `grep ": any\|as any"` | **0건** ✔ |
| 토큰 누수 | `grep persona-/sparta-/mentor-/exam-` (moira) | **0건** ✔ |
| moira 토큰/키프레임 정의 | tailwind.config:107-142 · globals.css:99-162 | 사용 토큰 전부 정의됨(`map-overlay-bg`/`track`/`score-*`/`transport-*`/`fair-*`), `moira-route-draw`/`route-polyline`/`route-marker` 키프레임·클래스 존재 ✔ |
| 데이터 페칭 | `grep useQuery/useSWR/fetch/zustand` (moira) | 0건 — 순수 mock import(P1-1 이월, P0 정상) |

---

## 7. 권고 (우선순위)

1. **[지금/P0 데모]** 그대로 GO. 버그픽스 3건 머지 유지. **P2-1·P2-2 데드코드(`RANK_OF`/`fairStyle`)는 10분 내 정리 가능하니 다음 커밋에서 제거 권장**(린트 클린).
2. **[라이브 게이트/G2 통과 후]** P1-1(api.ts+훅3종+토큰스토어) → P1-2(투표 폴링) → P1-3(ODsay 실폴리라인·서버 fairScore) 순.
3. **[출시 후/P2]** P2-3(--route-length 연결) · P2-4(타이머 cleanup) · P2-6/7(공유·딥링크 실연결) · P2-8(주석 정리).

— @프론트팀장
