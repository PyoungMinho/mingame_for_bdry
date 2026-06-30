# 모이라(Moira) — 디자인 최종 리뷰 (RouteMap 반영 최신본)

> 검수자: 디자인팀장 (Opus) · 2026-06-09 (RouteMap P0 빌드 18:00 이후 재검수)
> 검수 범위: 디자인 정본 4종 + 디자인 시스템 + 컴포넌트 17종 + 5화면 + 토큰/모션 + 프론트 버그수정 3건
> 검증 기준(우선순위): `docs/planning/moira-vision-revision.md`(상위 개정) > `docs/design/moira-routemap-design-final.md`(RouteMap 확정) > `docs/design/moira-design-final.md` · `design-system/moira/MASTER.md`
> 제약: **검수 전용 — 코드/디자인 파일 무수정. 본 문서 1건만 작성.**
> ⚠️ 본 리뷰는 2026-06-09 15:46 작성된 이전본이 **RouteMap(`/moira/routes`)을 반영하지 못한 stale 상태**였던 것을 신규 화면 포함 최신본으로 **덮어쓴 것**이다.

---

## 1. 종합 판정

> ## ✅ **조건부 합격 (Go with minor fixes)**

**한줄 근거**: 비전 개정의 새 주인공 RouteMap이 스펙(`moira-routemap-design-final.md`)의 5종 신규 컴포넌트·인코딩 불변식·수렴 애니메이션·3단 드래그 패널을 **높은 충실도로 구현**했고, 이전 리뷰의 2대 블로커(M1 포커스 링 오염 · M2 비-lucide 글리프)가 **모두 해소**됐다. 색=공평도 불변식, 타제품 토큰 격리, 접근성(44px·aria·lucide)도 통과. **출시를 막는 Blocker(P0)는 없다.** 다만 (P1) 핀 드래그가 스펙의 "좌표 이동→실시간 점수 변동"이 아니라 "시트 열기"로 축소된 점, (P1) reduced-motion 시 경로선 대시패턴 소실 1건이 G2 정식 검증 전 정리되면 좋다.

| 영역 | 평가 | 비고 |
|---|---|---|
| RouteMap 디자인 충실도 | ★★★★☆ | 5종 컴포넌트·곡선 polyline·수렴 애니·점수배지 정합. 핀 드래그만 축소 |
| 색=공평도 불변식 | ★★★★★ | 경로선·막대=`fair-*` 전용, 교통=`transport-*`+아이콘, 점수=`score-*`+화살표 3중 분리 |
| 타제품 색 오염 격리 | ★★★★★ | `moira.*` 가산만, 포커스 링 `moira-scope` 격리 완료(M1 해소) |
| 접근성 | ★★★★☆ | lucide 100%·44px·aria-live·tabular-nums. 글리프 0(M2 해소). 지도 폴백 alt 양호 |
| 비전 정합(투명한 공개) | ★★★★★ | "손해 주체 카피"+장소 자유수정+점수 의무표시 = 사회적 해결 톤 정확 |
| 5화면 일관성 | ★★★★☆ | Shell·Stepper·Button·타이포 일관. CTA 아이콘 1건 불일치(아래 m3) |

---

## 2. 잘된 점 (RouteMap 중심)

1. **인코딩 불변식 3중 분리가 교과서적이다 (`RouteMapCanvas.tsx`, `route.ts`, `fairness.ts`)**
   경로선은 **색=공평도(`FAIR_COLOR[fairLevel(gap)]` 단일색) · 굵기=손해도(`routeWeightKey` low/mid/high) · 대시=교통수단(`ROUTE_DASH`) · 투명도=탭선택(`ROUTE_DIM 0.22`)** 4축이 완전히 직교한다. 색에 손해도·교통수단·멤버식별이 섞이지 않아 "색은 오직 공평도" 원칙(MASTER §2 anti-pattern, vision §5)을 코드 레벨에서 강제한다. UI spec §1-1 인코딩 표와 1:1 일치.

2. **곡선 polyline + 흰 헤일로 + 수렴 애니메이션이 스펙대로 구현됐다 (`mock.ts` bezier2, `RouteMapCanvas.tsx:301-345`, `globals.css:141`)**
   직선 2점이 아니라 **2차 베지어 8~12점 보간**으로 실경로 곡선감을 냈고(스펙이 직선 2점도 허용했으나 곡선으로 상회), 각 경로선에 `strokeWidth+3` 흰 halo를 깔아 밝은 타일 대비 마지노선을 확보했다. 수렴 애니는 `stroke-dashoffset` + 멤버별 `staggerMs = (minutes-min)/range*400`으로 **늦는 멤버가 마지막 도착**하는 시그니처를 정확히 재현(`moira-route-draw` 키프레임).

3. **장소 점수 실시간 변동 = "왜 모이라를 쓰는가"의 답이 살아있다 (`FairnessScoreBadge.tsx`, `routes/page.tsx:131-140`)**
   상단 A/B/C 칩 또는 PlaceEditSheet에서 장소를 바꾸면 `prevScore→fairScore`가 CountUp으로 변동하고 ArrowUp/Down·델타·`aria-live="polite"`가 동반된다. `score-up #059669`와 `fair-good #10B981`이 둘 다 녹색이나, 점수배지는 **항상 화살표+"점"** 라벨로 캡슐화되고 FairnessBars와 다른 영역(지도 하단 오버레이)에 배치돼 §6-G 혼동방지를 지킨다. 비전 §3-가(자유 수정+점수 의무)의 핵심 통제장치.

4. **"손해 주체 투명 공개" 카피가 비전(사회적 해결)을 정확히 전달한다 (`routes/page.tsx:347-354`)**
   `{maxMember}님이 {gap}분 더 이동해요`를 `fair-bad` 색 + `aria-live="assertive"`로 노출. 알고리즘이 강제로 정하는 톤이 아니라 "누가 손해인지 막대·카피로 투명 공개 → 보상은 친구끼리"라는 개정 비전(무게중심 이동)의 톤과 일치. 장소 자유 수정(PlaceEditSheet)을 허용하되 대가를 숨기지 않는 설계.

5. **이전 2대 블로커가 모두 닫혔다 (M1·M2 해소 확인)**
   - **M1(포커스 링 오염)**: `MoiraShell.tsx:49`가 최상위에 `moira-scope` 부착 + `globals.css:167` 언레이어드 `.moira-scope :focus-visible { box-shadow: 0 0 0 3px rgba(79,70,229,.35) }`가 전역 오렌지 링(`globals.css:18`)을 확실히 덮어씀. 모이라 전 화면 인디고 링.
   - **M2(비-lucide 글리프)**: `★▲▼` 전부 lucide로 교체 — `FairnessBars`는 `ArrowUp/ArrowDown`+`sr-only`("가장 오래 걸림"/"가장 가까움"), `StationHero`·`PlaceCard`는 `Star`(`aria-hidden`). moira UI 내 비-lucide 글리프 렌더 0건(grep 확인, `States.tsx:49` ★는 JS 주석).

6. **스파게티 방지 정책이 인원수 분기로 구현됐다 (`routes/page.tsx:107-123`)**
   `toggleMember`가 5명↓는 전체 ON(빈배열)→탭 시 단일강조, 7명+는 OFF 기본으로 분기. vision §5-1·UI spec §6의 "5↓ 동시 / 7+ 기본 OFF" 정책 반영. 데모 4인은 전체 동시표시가 맞다.

---

## 3. 결함·리스크 (심각도별)

### 🔴 P0 Blocker — 없음
출시·G2 검증을 물리적으로 막는 크래시·데이터손상·불변식 위반급 결함 없음. 프론트 버그수정 3건도 모두 적절(§5 확인).

### 🟠 P1 (G2 정식 빌드 전 정리 권장)

**P1-1. 핀 드래그가 스펙의 "좌표 이동 → 실시간 점수 변동"이 아니라 "시트 열기"로 축소됨**
- **어디서**: `RouteMapCanvas.tsx:261-265 handlePinClick` → `onPinDrag(destination)`(현재 좌표 그대로 콜백), `routes/page.tsx:143-145 handlePinDrag` → `setSheetOpen(true)`.
- **무엇이**: RouteMap 확정 §1-3·UX spec §3-3은 "핀 드래그 시 Haversine 추정으로 즉시 `87→41` 변동(ODsay 0)"을 **의무**로 명시했다. 구현은 핀이 실제 드래그되지 않고(클릭=시트 오픈), 좌표 자유 이동에 의한 점수 실시간 변동은 PlaceEditSheet의 A/B/C 이산 선택으로만 가능하다. `PlaceEditSheet.onCustomPin`(`routes/page.tsx:148`)도 "시트 닫기만"으로 P1 보류.
- **영향**: G2 블라인드 테스트 시나리오 중 "장소 바꿔보기 → 점수 변화 확인"(vision §7 G2 추가항목)은 A/B/C 칩으로 검증 가능하므로 **G2 자체는 막지 않는다**. 다만 "임의 지점으로 핀을 끌면 점수가 연속 변동"하는 가장 설득력 있는 데모는 빠졌다.
- **권고**: P1에서 핀 드래그 제스처 + Haversine 연속 추정 연결. 현재는 스펙이 `draggablePin`을 명시했으나 코드 주석("P0: 단순 click")처럼 단계적 구현임을 디자인팀이 **인지·승인**한 상태로 기록.

**P1-2. reduced-motion 시 경로선 대시패턴(교통수단 인코딩)이 소실됨**
- **어디서**: `RouteMapCanvas.tsx:327-341`. `shouldAnimate=false`(reduced) 분기는 `strokeDasharray: dash==="none" ? undefined : dash`로 대시 복원이 맞으나, `globals.css:153-157` `@media (prefers-reduced-motion) .route-polyline { stroke-dashoffset:0 !important; animation:none !important }`는 OK. **문제는 애니메이션 분기(`shouldAnimate=true`)에서 `strokeDasharray`를 길이값(`${length} ${length}`)으로 덮어써** 교통수단 대시(walk `4 6`/bus `12 4`)가 그리는 동안 사라지는 점.** 애니 완료 후 인라인 스타일이 길이 dasharray로 고정돼, 도보/버스 점선이 최종상태에서도 안 보일 수 있다(실선처럼 렌더).
- **영향**: 대시=교통수단은 **보조 인코딩**이고 교통수단은 칩(`TransportBadge`)+패널에서 아이콘+텍스트로 명확히 전달되므로 색 단독 의존 위반은 아님. 단 "경로선만 봐도 교통수단 구분"이라는 의도가 약화.
- **권고**: 애니 종료 시점(`onAnimationEnd`)에 dasharray를 교통수단 대시로 되돌리거나, halo는 실선/본선은 대시로 분리. UI spec §1-1 4번째 행(패턴=교통수단)의 의도 복원.

**P1-3. 경로선 단일 공평도색 → 선이 겹칠 때 멤버 식별을 색으로 못 함(설계상 트레이드오프)**
- **어디서**: `RouteMapCanvas.tsx:269-274`. 모든 멤버 경로선이 `FAIR_COLOR[level]` **동일 색**(전체 격차 기준 1색). 이는 "색=오직 공평도" 불변식을 지키려는 **올바른 선택**이며 스펙 정합이다(멤버 식별을 색으로 하면 불변식 오염).
- **트레이드오프**: 4인 곡선이 을지로3가로 수렴하며 겹칠 때, "이 선이 누구냐"를 색으로 구분 불가 → **아바타 마커 위치 + 굵기 + 멤버 탭 강조**에 의존. 데모 4인은 출발지가 흩어져 있어 식별 가능하나, 6인 밀집 시 혼동 가능.
- **권고(P2)**: 불변식 유지가 정답이므로 색 변경은 **금지**. 대신 멤버 탭 미선택 시에도 각 선 끝(출발지측)에 작은 이니셜 라벨을 붙이거나, 탭 강조를 더 강하게(미선택 `0.22`로 충분히 죽임). 현 구현으로도 G2 데모는 성립 → P2 개선.

### 🟡 P2 (출시 후 개선)

- **m1. 드래그 패널 제스처가 터치 전용** — `routes/page.tsx:153-164 onPanelTouchStart/End`만 있고 마우스/포인터 드래그·키보드 핸들 조작 없음. 핸들 클릭(`:312`)은 3단 순환으로 보완되나, 데스크탑 1280 프리뷰·키보드 사용자는 드래그 불가. UX spec §6-3 키보드 순서엔 패널이 "읽기 전용"으로만 명시돼 치명 아님. PointerEvent 통합 권장.
- **m2. peek 스냅이 `calc(100%_-_60px)`로 패널 본문 높이에 의존** — `SNAP_MAP.peek`(`routes/page.tsx:49`)는 패널 콘텐츠가 길면 100% 기준 이동량이 커져 peek에서 노출되는 "한 줄"이 의도(핸들+점수)와 어긋날 수 있다. full(`calc(120px_-_62vh)`)도 viewport 가정. 다양한 콘텐츠 높이에서 375/480 재확인 권장.
- **m3. result CTA 아이콘(`Route`)과 routes 내 CTA 아이콘(`Map`)이 불일치** — result `StickyBottomBar` "경로 보기"는 `Route` 아이콘(`result/page.tsx:73`), routes의 "장소 바꿔보기"는 `Map` 아이콘(`routes/page.tsx:193`). 둘 다 lucide·44px로 무해하나, "경로 보기" 진입점은 `Map`/`Route` 중 하나로 통일하면 5화면 아이콘 일관성↑. (RouteMap 확정 §1은 "지도 아이콘"으로만 표기 — 해석 여지.)
- **m4. result "경로 보기" 버튼에 텍스트 라벨 없음** — `result/page.tsx:69` `w-[52px] px-0` 아이콘 단독 + `aria-label="경로 보기"`. SR엔 OK이나 시각 사용자에게 아이콘만 노출 → 발견성 낮음. RouteMap이 신주인공인데 진입 버튼이 아이콘 정사각형이라 약하다. 라벨 동반 또는 강조 검토(G2 핵심 동선).
- **m5. 직접 핀 찍기 버튼이 P0에서 무동작** — `PlaceEditSheet.tsx:160-172` "직접 장소 핀 찍기"(outline+MapPin) 탭 시 `onCustomPin`→`setSheetOpen(false)`만. 사용자가 누르면 시트만 닫혀 "아무 일 안 일어남"으로 보임. P1 핀 모드 전까지는 버튼을 비활성(`disabled`)하거나 "준비 중" 표기 권장(빈 클릭 = 가짜감).

---

## 4. 검수 관점별 판정 요약 (브리핑 6개 항목)

| # | 관점 | 판정 | 근거 |
|---|---|---|---|
| 1 | **RouteMap 디자인 충실도** | ✅ 대체로 충실 (핀 드래그만 P1) | 곡선 polyline·흰 halo·수렴 애니(stagger)·A/B/C 칩 점수전환·멤버칩 솔로/dim 0.22·PlaceEditSheet·3단 패널 모두 구현. SVG 폴백 카피 "지도를 불러올 수 없어요 — 경로 미리보기로 표시합니다"(`RouteMapCanvas.tsx:288`) 적절·차분, FairnessBars 단독 동작 보장. |
| 2 | **색 의미 불변식** | ✅ 통과 | 경로선/막대=`fair-*`(격차≤10 good/11–20 mid/21+ bad, `fairness.ts:26-30`). 교통수단색(`transport-*`)은 항상 아이콘 동반, 버스는 텍스트까지(`TransportBadge.tsx:44`). 점수=`score-*`+화살표. 색이 공평도만 의미하도록 4축 직교(§2-1). 멤버 경로색은 식별용이 아니라 **전 멤버 공통 공평도색** — 식별은 아바타/굵기/탭(불변식 오염 회피, 정답). |
| 3 | **타제품 색 오염 격리** | ✅ 통과 | `tailwind.config.ts:107-142` `moira.*` 가산만, 기존 16키 무변경 + RouteMap 신규 토큰 가산. moira 컴포넌트/페이지에 persona/accent/mentor/spartan/문제팩토리 토큰 침범 0(grep). 포커스 링 `moira-scope` 격리로 M1 재발 차단. |
| 4 | **접근성** | ✅ 통과 (P2 잔여) | lucide 100%(`Train/Bus/Footprints/Car/MapPin/ArrowUp/ArrowDown/UserPlus/Share2/Route/Map`)·이모지 0. 터치타깃: MemberRouteChip `min-h-[44px]`, 마커 44×44 투명영역, PlaceEditSheet 행 `min-h-[52px]`, [+] 버튼 44px. aria-live(점수 polite·손해카피 assertive), 막대 숫자라벨 항상 동반. 대비: ink/body 4.5:1+, 버스칩 3.2:1은 아이콘+텍스트로 보완. |
| 5 | **비전 정합(투명한 공개)** | ✅ 통과 | "손해 주체 카피"·장소 자유수정(PlaceEditSheet)·점수 의무표시가 "알고리즘 강제"가 아닌 "투명 공개+사회적 해결" 톤. RouteMap 전 영역 광고 0(vision §4·§5-1 불변 준수). 헤더 공유(Share2)로 바이럴 동선. |
| 6 | **5화면 일관성** | ✅ 대체로 통과 (m3 아이콘) | MoiraShell(max-w-480·moira-scope) 전 화면 공통, Stepper `step={2}` result/routes 공유(별도 스텝 신설 안 함, §H 준수), Button/StickyBottomBar/타이포(Pretendard·tabular-nums) 일관. CTA 아이콘 1건만 불일치(m3). |

---

## 5. 프론트엔드 버그수정 3건 — 디자인 의도 부합 검증

| # | 수정 | 디자인 의도 부합 | 판정 |
|---|---|---|---|
| ① | 하단 바 버튼 줄바꿈 깨짐 → `shrink-0`/`flex-1` + `whitespace-nowrap` (`routes/page.tsx:190,198`) | StickyBottomBar는 [outline 보조][primary 주] 2버튼 고정폭 의도. outline "장소 바꿔보기"=`shrink-0`(고정), primary "이 장소로 투표"=`flex-1`(확장)으로 **엄지존 주 CTA 강조**(MASTER §1-3·4) 정확 반영. | ✅ 부합 |
| ② | 멤버칩 [+] 무반응 → 항상 6인캡 토스트 (`routes/page.tsx:126-129,288-297`) | P0 데모는 실제 초대 플로우 부재. [+] 탭 시 "소그룹(6명)까지 무료 / 더 큰 모임은 팀 플랜" 토스트(`role="alert"`)는 vision §3-다·§7 B2B 넛지 카피와 **일치**. 빈 클릭 대신 의미있는 피드백 = 가짜감 제거. | ✅ 부합 (단 m5의 "직접 핀 찍기"는 동일 처리 누락) |
| ③ | 드래그 패널 안 움직임 → Tailwind `calc()` 언더스코어 표기 (`routes/page.tsx:49-52`) | `translate-y-[calc(100%_-_60px)]` 등 Tailwind JIT는 calc 내 공백을 `_`로 표기해야 클래스 생성. 3단 스냅(peek/default/full) 수치가 §6-E 매핑(peek=지도95%/default=62vh/full=지도30%)과 정합. **표기 버그였고 수정이 디자인 스냅값을 정확히 살림.** | ✅ 부합 |

> 3건 모두 디자인 의도를 훼손하지 않고 오히려 의도대로 복원. ②와 관련해 PlaceEditSheet "직접 핀 찍기"도 동일하게 "준비 중" 피드백을 주면 일관성↑(m5).

---

## 6. G2 블라인드 테스트 — 디자인 준비도 의견

> vision §7은 **라이브 개발 전 Figma 프로토+mock으로 G2부터** 통과시키라 명시. 현 P0 라이브 빌드는 mock polyline로 동작하므로 **그 자체가 G2 검증 도구로 사용 가능**한 상태다.

**준비됨 (G2 측정 가능)**:
- ✅ "N명 경로를 한 화면 동시 비교"(G2 새 핵심증거) — 4인 곡선 동시표시 + 수렴 애니 + FairnessBars 패널로 카카오맵(각자 따로 검색) 대비 우위를 **체감시킬 수 있다.**
- ✅ "장소 바꿔보기 → 점수 변화 확인"(G2 추가 시나리오) — A/B/C 칩 전환 시 `FairnessScoreBadge` 변동 + 손해주체 카피로 **알고리즘 권위 유지 여부 측정 가능.**
- ✅ 색·굵기 인코딩의 직관성(공평도/손해도)을 비-전문가 20명에게 물을 준비 완료.

**G2 전 보완하면 설득력↑ (필수 아님)**:
- ⚠️ **P1-1(핀 드래그 연속변동)**: "아무 데나 끌어도 점수가 실시간"이 A/B/C 이산선택보다 "투명성" 체감이 강하다. G2에서 "자유도"를 평가한다면 핀 드래그가 빠진 점이 약점. 다만 이산 3안으로도 핵심 가설(점수표시=존재이유)은 검증 가능.
- ⚠️ **m4(경로 보기 진입 버튼 약함)**: result→routes 동선이 G2의 무대인데 진입 버튼이 아이콘 정사각형. 블라인드 참가자가 RouteMap에 도달 못하면 측정 자체가 안 됨 → **G2 전 진입 버튼 발견성 강화 권장(최우선 보완).**
- ℹ️ Kakao 키 없는 검증 환경에선 SVG 폴백으로 동작하나, "진짜 지도 위 경로"의 설득력은 실제 카카오맵 타일에서 더 크다. G2 핵심 세션은 **키 주입 후 실타일**로 1회 이상 검증 권장(폴백만으로 단정 금지).

**G2 디자인 준비도 종합**: **준비됨(Ready with one caveat)**. 측정 도구로서 결격 없음. 단 **m4(진입 버튼)만은 G2 세션 전 강화**해야 참가자가 신주인공 화면에 안정적으로 도달한다.

---

## 7. 출시 전 필수 vs 이후 개선

### ✅ 출시(G2 정식 세션) 전 — 필수 아님, 권장 1건
- **[권장] m4** — result "경로 보기" 진입 버튼 발견성 강화(라벨 동반/강조). *G2 도달률 직결, CSS·마크업 국소.*

### 🔵 G2 PASS 후 / P1 빌드에서
- **P1-1** — 핀 드래그 + Haversine 연속 점수변동(스펙 §1-3 완전 구현).
- **P1-2** — reduced-motion·애니완료 시 교통수단 대시패턴 복원.
- **P1-3 / m1·m2·m5** — 경로선 멤버 식별 보조(이니셜/탭강조), 패널 PointerEvent·스냅 높이 재확인, "직접 핀 찍기" 빈클릭 피드백.
- **m3** — result↔routes CTA 아이콘 통일.
- (이전 리뷰 잔여) 동적 OG/공유 카드(역명+격차+미니막대), 확정 미니맵 카카오 스태틱맵, 환승횟수 뱃지.

---

### 부록 — 통과 확인 사항(회귀 점검)
- 토큰 격리: `tailwind.config.ts:107-142` moira.* 가산, 문제팩토리/오름/진짜집 색 무손상 ✔
- 포커스 링: `MoiraShell` `moira-scope` + `globals.css:167` 인디고 링이 전역 오렌지(`:18`) override ✔ (M1 해소)
- 글리프: moira UI 비-lucide 글리프 렌더 0, ★▲▼→lucide+sr-only/aria-hidden ✔ (M2 해소)
- 모션 격리: `globals.css:141 moira-route-draw` + `:153` reduced-motion 경로선/마커 정지, `moira-` 프리픽스 ✔
- 색=공평도: 경로선·막대 `fair-*` 전용, 교통 `transport-*`+아이콘, 점수 `score-*`+화살표, 색 단독 의존 0 ✔
- 광고 0: RouteMap 전 영역 광고 미배치(vision 불변) ✔
- 데이터 계약: `route.ts` 단일 `MemberRoute`(§4 병합안), `transit.ts` `LINE_COLOR` 분리·export(§7 선결) ✔
- 터치타깃: MemberRouteChip 44 / 마커 44 / PlaceEditSheet 52 / [+] 44 ✔
