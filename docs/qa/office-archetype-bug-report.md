# 직장인 성향 분석기 (office-archetype) — QA 실행 리포트 & 버그 리포트

> 작성: @QA실행자(Opus) · 대상: `src/app/office-archetype/**` · 스택: Next.js 14.2.3 App Router + TS · 순수 클라이언트(DB/API 0)
> 근거: `tests/office-archetype/{score,content-integrity,deeplink-og,state,css-nits}.spec.*` 실측 실행
> 게이트: `npm run type-check` PASS · `npm run build` PASS · `npm run test` 579/579 PASS (office-archetype 신규 48 포함)

---

## 1. 실행 요약

| 구분 | 수치 |
|---|---|
| 신규 테스트 파일 | 5 (score / content-integrity / deeplink-og / state / css-nits) |
| 신규 테스트 케이스 | 48 pass / 0 fail |
| 전체 회귀(`npm run test`) | 579 pass / 0 fail (기존 office-archetype 유닛 22종 포함 그대로 통과) |
| type-check / build | 둘 다 PASS |
| 커버 범위 | 점수엔진 전수(4^10) · 콘텐츠 참조 무결성 · 아이콘 매퍼 동기화 · 상태머신(jsdom+RTL+fake timers) · 딥링크/OG 계약 · nit 2건 회귀 가드 |

### ★ 점수엔진 전수 시뮬레이션 (4^10 = 1,048,576 전건)

- **8유형 전부 도달**: 8/8 (Set size === 8) — 도달 불가 유형 0
- **결정성**: 동일 입력 → 동일 출력 (랜덤 0, 순수함수). tie 120,251건 전건 액션형 결정론적 채택
- **분포(전수)**: architect 19.15% / sparker 17.84% / bulldozer 16.64% / mediator 13.39% / listener 10.11% / steady 8.47% / finisher 7.84% / **tuner 6.56%**
- **편향**: max/min = **2.919x** (architect ÷ tuner). 방향서 R2 '고른 분산' 미달이나 **엔진 코드 버그가 아니라 questions.json delta 튜닝 문제**
- **근본원인 신호**: 전 옵션 delta 총합 **Σx = -1(균형), Σy = +6(lead쪽 편향)** → y축 상단(lead) 상한 과다판정의 데이터적 원인

---

## 2. 버그 / 이슈 목록

### BUG-OA-01: 8유형 분포 편향 (architect 19.15% vs tuner 6.56%, 2.9배)
- **심각도**: P0 (소프트 게이트 — 배포는 막지 않음)
- **상태**: **open** (콘텐츠 delta 재튜닝 필요 — 베타 게이트 백로그)
- **영역**: `data/questions.json` delta
- **재현**: `npx vitest run tests/office-archetype/score.spec.ts -t OA-SCORE-02` → 전수 분포 로그
- **기대**: 방향서 R2 "특정 유형 과다 판정 방지" / `_meta` "고른 분산" → 이상적으로 max/min < 2.0
- **실제**: max/min 2.919x, 최소 tuner 6.56%
- **원인**: 옵션 delta 총합이 Σy=+6으로 lead 상한에 구조적으로 기움. **엔진(score.ts)은 정상**, 데이터 편향
- **fixNote**: finisher/steady(work×follow)·tuner(relation×follow) 상한 및 |y|>|x| 구조형 도달을 늘리도록 delta 재조정, Σy를 0 근처로. `score.spec.ts`의 baseline(2.919x)·Σy(6)를 회귀 앵커로 고정해 둠 — 재튜닝 시 이 테스트가 변화를 즉시 수치화. 소프트 게이트라 현 배포는 허용.

### BUG-OA-02: 다크모드 상성 CTA 저대비 (nit b)
- **심각도**: P2
- **상태**: **fixed**
- **영역**: `oa.css` `.oa-result-card-match-cta`
- **재현**: 다크테마 결과화면 상성 카드 '이 유형 보기 →' — 기존 `background:var(--oa-surface)`(#1C2030) + `color:var(--oa-type-deep)`(어두운 hex) → dark-on-dark 저대비, A11y AA 미달
- **기대**: WCAG AA 대비(대형 텍스트 ≥3.0, 이상적으로 ≥4.5)
- **실제(수정 전)**: 다크 배경 위 어두운 글자로 CTA가 거의 안 보임 → 상성 딥링크 전환 손실
- **fix**: 배경을 `var(--oa-type-deep)`, 글자를 `#FFFFFF`로 변경. 8유형 deep×흰글자 실측 대비 = architect 16.06 / steady 7.98 / finisher 6.66 / bulldozer 6.26 / mediator 5.38 / tuner 5.10 / listener 5.04 / **sparker 4.32**(대형텍스트 AA 통과). solid를 배경으로 쓰면 sparker/mediator/listener/tuner가 흰글자 대비 <3.0으로 FAIL하므로 deep 채택. 라이트/다크 공통 적용. 회귀 가드: `css-nits.spec.ts` OA-NIT-02.

### BUG-OA-03: 결과 게이지 라벨 좁은 뷰포트 줄바꿈 (nit a)
- **심각도**: P3
- **상태**: **fixed**
- **영역**: `oa.css` `.oa-result-card-gauge-item` / `.oa-result-card-gauge-label`
- **재현**: ≤360px 뷰포트에서 긴 shadowLabel("이럴 때 주의하면 더 좋아요")이 도트 게이지와 한 줄에서 지저분히 줄바꿈
- **fix**: `gauge-label`에 `white-space:nowrap`, `gauge-item`에 `flex-wrap:nowrap` → 라벨·도트 baseline 유지. 회귀 가드: `css-nits.spec.ts` OA-NIT-01.

### BUG-OA-04: config.json tie-break 주석 드리프트
- **심각도**: P3
- **상태**: **fixed**
- **영역**: `data/config.json` `resolveEngineNote`
- **재현**: 주석 최종 tie-break가 "마지막 문항 y부호 우선"으로 서술 — 실제 구현은 `|x|>=|y| → 액션형`(완전 동점 포함)으로 미구현·불일치
- **fix**: 주석을 실제 구현(|x|>=|y|→액션형, 0/0도 액션형)과 일치하도록 갱신. 코드가 SoT임을 명시. (실측: tie 120,251건 전건 액션형 일관 — `OA-SCORE-06`)

### BUG-OA-05: OG route 파라미터 주석 드리프트 (variant vs ratio)
- **심각도**: P3
- **상태**: **fixed**
- **영역**: `_components/ShareCta.tsx` prop 주석
- **재현**: 주석은 `?variant=square|story`로 표기하나 route(`og/[typeSlug]/route.tsx`)는 `?ratio=1x1|9x16`만 읽음. 호출부(ResultView)는 `?ratio=9x16`로 정합 → 실동작은 정상, 주석만 오해 유발
- **fix**: ShareCta 주석을 `?ratio=9x16`로 통일. 계약 검증: `deeplink-og.spec.ts` OA-OG-08(route가 ratio를 읽고 variant는 무시함을 고정).

### NOTE-OA-06: sumScores 엔진 계약이 idempotent하지 않음 (같은 qid 2건 둘 다 합산)
- **심각도**: P2
- **상태**: **open** (화면 경로에서 무해 — 방어는 리포트로 고정)
- **영역**: `lib/score.ts` `sumScores`
- **설명**: 같은 qid 답변이 배열에 2건 오면 마지막 것만 쓰지 않고 **둘 다 합산**. 화면 경로(`test/page.tsx`)는 `answers.filter((a)=>a.qid!==qid)`로 qid당 1건만 유지하므로 실사용에선 발생 안 함
- **근거**: `OA-SCORE-10`(엔진이 2건 합산함을 assert) + `OA-STATE-13`(화면 경로 filter로 qid당 1건 유지 입증) + `OA-STATE-02b`(서로 다른 옵션 연타에도 qid당 답변 1건·크래시 없음 실측)
- **fixNote**: 엔진 레벨에서 qid별 마지막 답변만 채택하도록 정규화하면 방어가 이중이 됨. 범위·우선순위 낮아 open 유지. 현재 두 테스트가 갭을 회귀로 고정.

### NOTE-OA-07: 10답 완료 후 결과 저장 전 이탈 시 q10 재노출 (UX 갭)
- **심각도**: P2
- **상태**: **open** (설계 동작 — 데이터 유실/크래시 아님)
- **영역**: `test/page.tsx` 복원 로직 `Math.min(restored.length, questions.length-1)`
- **설명**: answers 10건 저장됐지만 oa-result 미저장 상태(analyzing 중 이탈)에서 재진입하면 `currentIndex = min(10,9) = 9` → q10을 다시 보여줌(결과로 점프 안 함). 크래시·중복 진행 없음
- **근거**: `OA-STATE-09`
- **fixNote**: answers.length===questionCount이면 재판정→결과로 보내는 분기를 추가하면 재답변 강제를 없앨 수 있음. UX 개선 백로그.

### NOTE-OA-08: reduce-motion 시 JS 타이머(260/700ms) 미감축
- **심각도**: P3
- **상태**: **open** (수동 확인 — CSS는 감축됨)
- **영역**: `_components/OptionButton.tsx`(260ms) · `test/page.tsx`(analyzing 700ms)
- **설명**: `@media (prefers-reduced-motion: reduce)`가 `.oa-shell *` 애니를 0.01ms로 감축하나, JS `setTimeout(260/700ms)`는 감축 안 됨. OptionButton에 `transitionMs` override prop이 있으나 호출부(test/page)에서 미연결
- **fixNote**: `matchMedia('(prefers-reduced-motion: reduce)')` 감지 시 `transitionMs=0`·analyzing 지연 단축 연결. 모션 민감 사용자 체감 지연 제거.

### NOTE-OA-09: OG 폰트 자산 부재 → 기본 sans-serif 폴백
- **심각도**: P3
- **상태**: **open** (기지 이슈, route 주석에 명시됨)
- **설명**: design-final §5는 Paperlogy 로컬 폰트 주입을 명시하나 자산 미포함 → satori 기본 sans-serif 폴백. OG 200 렌더는 정상(`OA-OG-01/02` 8유형×2비율 전량 200 확인), 한글 자소 렌더 품질만 자산 추가 시 향상.

---

## 3. 수동(manual) 케이스 — 브라우저 확인 권장

| ID | 내용 | 상태 |
|---|---|---|
| OA-A11Y-02 | 키보드(Tab+Enter)만으로 10문항 완주 | 브라우저 수동 (OptionButton이 실 `<button>`이라 자연 지원 — 코드상 통과 예상) |
| OA-A11Y-04 | reduce-motion CSS 감축 확인 + JS 타이머 갭 | NOTE-OA-08 참조 |
| OA-NIT-01 | ≤360px 게이지 라벨 줄바꿈 → 수정 확인 | fixed (css-nits 회귀 가드) |
| OA-NIT-02 | 다크모드 상성 CTA 대비 → 수정 확인 | fixed (css-nits 회귀 가드 + 대비 실측) |

---

## 4. 결론

- **엔진·상태·딥링크·OG 계약은 전건 통과.** 특히 점수엔진은 4^10 전수 증명으로 8유형 도달성·결정성·tie 일관성을 확정.
- **배포 차단 이슈 없음.** BUG-OA-01(분포 편향)은 소프트 게이트(콘텐츠 백로그), 나머지 fixed 5건은 nit/주석.
- **재튜닝 안전망 확보**: score.spec의 baseline(2.919x)·Σy(6)가 delta 변경을 즉시 수치화. 아이콘 매퍼 동기화(TypeIcon↔OgIcon)를 회귀로 못 박아 콘텐츠 교체 안전성 보증.
