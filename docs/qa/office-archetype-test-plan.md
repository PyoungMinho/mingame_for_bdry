# 직장인 성향 분석기 (office-archetype) 테스트 설계서

> 작성: @QA설계자(Opus) · 대상: `src/app/office-archetype/**` · 스택: Next.js 14.2.3 App Router + TS, vitest, 순수 클라이언트(DB/API 0)
> 전제: type-check/build/기존 22 유닛테스트 통과, 브라우저 E2E(랜딩→10문항→결과→OG) 동작 확인됨.
> 이 문서의 케이스는 @QA실행자가 **그대로 구현**할 수 있게 입력/기대값을 구체화했다.

---

## 1. 테스트 범위

### 테스트한다 (In scope)
- 점수엔진 `lib/score.ts`: 8유형 도달성·분포 편향·tie-break 결정성·경계값
- 콘텐츠 정합성: `data/questions.json` × `data/types.json` 참조 무결성·축 커버리지·스키마
- 상태머신 `test/page.tsx`: sessionStorage 복원, 새로고침, popstate, pendingQuestionId 잠금, analyzing→result
- 결과 딥링크 `result/[typeSlug]`: generateStaticParams 8종, 404, OG 메타, 친구 프리뷰 모드
- 리다이렉터 `result/page.tsx`: oa-result 유무 분기
- 공유 OG `og/[typeSlug]/route.tsx`: 8유형 × 2비율 렌더, 워터마크, 잘못된 슬러그 404
- 접근성/모바일: 터치타겟, 포커스, aria, reduce-motion
- 알려진 nit 2건 재현

### 테스트하지 않는다 (Out of scope)
- 콘텐츠 문구 자체의 "공감률"(베타 게이트 §6-3 소관, 코드 QA 아님) — 단, 축 delta의 **수치 균형**은 검증한다
- Paperlogy 폰트 렌더(자산 미포함, sans-serif 폴백이 정상 동작임을 전제)
- Kakao SDK 실제 전송(미초기화 시 클립보드 폴백만 검증)
- 실 디바이스 크로스브라우저 매트릭스(수동 스모크로 대체)

---

## 2. 리스크 기반 우선순위

| 리스크 | 왜 | 우선순위 |
|---|---|---|
| 점수엔진 분포 편향 | **전수 시뮬 결과 architect 19.15% vs tuner 6.56% (약 2.9배)** — 특정 유형 과다 판정, 방향서 R2 "편향 검증" 위반 소지. 제품 신뢰도 직결 | P0 |
| 콘텐츠 참조 무결성 | matchBestId/matchWorstId가 없는 유형 참조 시 상성 카드·OG 붕괴. 슬러그 오타 시 404 | P0 |
| 상태머신 데이터 유실/교착 | 새로고침·뒤로가기·손상 sessionStorage에서 재답변 강제되거나 잠금 해제 안 되면 이탈 | P0 |
| tie-break 결정성 | 같은 답변이 매번 같은 결과여야 공유·재현이 성립(문서 note와 코드 정합) | P1 |
| OG 8유형 렌더 실패 | 공유 카드가 재유입 핵심. edge 런타임에서 특정 유형만 깨지면 조용히 유실 | P1 |
| 딥링크 404/프리뷰 모드 | 친구가 공유한 URL이 죽으면 바이럴 루프 단절 | P1 |
| 다크모드 대비(nit b) | 상성 CTA가 안 보이면 상성→딥링크 전환 손실 | P2 |
| 게이지 라벨 줄바꿈(nit a) | 결과 첫인상 훼손, 완성도 인식 저하 | P2 |
| reduce-motion/a11y | 접근성 게이트·모션 민감 사용자 | P2 |

---

## 3. 점수엔진 전수/대량 시뮬레이션 (핵심)

> `resolveType`는 순수 함수(랜덤 없음). 문항 4지 × 10문항 = **4^10 = 1,048,576 조합 전수 열거가 가능**하다.
> QA실행자는 아래를 vitest에서 반복(nested loop 또는 base-4 카운터)으로 구현할 것. 소요 <2s.

### 전수 시뮬 실측 (설계 시 검증한 baseline — 회귀 기준값)
```
TOTAL COMBOS: 1,048,576   (전 조합 8유형 모두 도달 ✅ 8/8)
architect  19.15%   sparker 17.84%   bulldozer 16.64%   mediator 13.39%
listener   10.11%   steady   8.47%   finisher  7.84%    tuner      6.56%
최빈/최소 비율 ≈ 2.92x   |  x=0 조합 96,018  y=0 조합 86,938  |x|=|y| 조합 120,251
전문항 동일선택: a→architect(4,12) / b→bulldozer(5,4) / c→sparker(-7,0) / d→tuner(-3,-10)
```

> **판정(설계자 의견)**: "8유형 전부 도달"은 통과지만 "고른 분산"(questions.json _meta·방향서 R2)은 **미달**이다.
> 2.9배 편향은 P0 리스크로 리포트하되, 이는 **콘텐츠(delta) 튜닝 문제**지 엔진 코드 버그가 아니다.
> → QA실행자는 (a) 도달성은 hard assert, (b) 편향비는 **soft assert(경고 리포트)**로 구현해 게이트를 막지 않되 수치를 남긴다.

---

## 4. 테스트 케이스

### A. 점수엔진 (`lib/score.ts`) — Unit

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-SCORE-01 | 도달성(전수) | 4^10 전수 열거 후 도달 유형 집합 | 전 조합 | 8유형 **전부** 최소 1회 도달 (Set size === 8) | P0 |
| OA-SCORE-02 | 분포편향(전수) | 전수 결과 유형별 카운트 | 전 조합 | max/min 비율 리포트. baseline과 대조: 8유형 카운트가 위 실측값 ±0(회귀시 실패). 비율>3.5x면 **경고 로그**(fail 아님, 리포트에 기록) | P0 |
| OA-SCORE-03 | 결정성 | 동일 답변 2회 판정 | `answerAllWith("b")` 2회 | type.id·scores 완전 동일 | P0 |
| OA-SCORE-04 | 경계 x=0,y=0 | 빈 답변(합 0,0) | `[]` | scores {x:0,y:0}, pos/pos 상한 액션형(=types[0]=bulldozer) 반환 | P0 |
| OA-SCORE-05 | 0의 pos귀속 | x=0 또는 y=0 인 실제 조합 다수 추출 | 전수 중 x===0 96,018건 | 전건 x라벨=xLabels[0](work)로 귀속(음수 상한으로 안 샘) | P1 |
| OA-SCORE-06 | tie-break \|x\|=\|y\| | \|x\|===\|y\|>0 조합 | 전수 중 120,251건 | 전건 액션형(inQuadrant[0]) 채택 — 결정성 확인 | P1 |
| OA-SCORE-07 | 서브규칙 방향 | 상한 고정 후 \|x\|>\|y\| vs \|y\|>\|x\| | 직접 answers/questions mock 주입(축 통제) | 전자→액션형, 후자→구조형 | P1 |
| OA-SCORE-08 | 방어적 sum | 존재X qid/oid | `[{qid:"zzz",oid:"a"},{qid:"q1",oid:"zzz"}]` | throw 안 함, {x:0,y:0} | P1 |
| OA-SCORE-09 | 부분 답변 | 3문항만 답변 | q1~q3 임의 | throw 안 함, 나머지 축 0 취급, 유효 유형 반환 | P2 |
| OA-SCORE-10 | 중복 qid | 같은 qid 2건(다른 oid) | 마지막이 우선? | sumScores는 **둘 다 합산**함을 명시 검증(현 구현 사실). test/page는 filter로 1건 유지 → 화면 경로에선 미발생. 이 갭을 리포트 | P2 |
| OA-SCORE-11 | types 빈배열 | resolveType(_, _, []) | 빈 types | throw("types 데이터가 비어 있습니다") | P1 |
| OA-SCORE-12 | 상한 유형 0개 폴백 | types에서 특정 상한 제거한 mock | 그 상한 도달 답변 | types[0] 폴백 + dev에서 console.warn 1회 | P2 |
| OA-SCORE-13 | uniqueInOrder 순서 | types.map(axis.x/axis.y) | 실제 데이터 | xLabels=["work","relation"], yLabels=["lead","follow"] (등록순) | P1 |

### B. 콘텐츠 정합성 (`data/*.json`) — Unit

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-DATA-01 | 유형 개수 | types 길이 | types.json | 정확히 8 | P0 |
| OA-DATA-02 | 상한 2개씩 | axis.x:axis.y 조합 카운트 | 8유형 | 4상한 × 각 2유형 | P0 |
| OA-DATA-03 | matchBestId 무결성 | 각 유형 matchBestId | 8유형 | 전부 실존 유형 id, 자기 자신 아님 | P0 |
| OA-DATA-04 | matchWorstId 무결성 | matchWorstId(있으면) | 8유형 | 존재 시 실존 유형 id (현재 8개 모두 값 있음), 자기 자신 아님 | P1 |
| OA-DATA-05 | id≡slug 일관 | id vs slug | 8유형 | 전부 id===slug (findTypeBySlug 이중 매칭 전제) | P1 |
| OA-DATA-06 | id 유일성 | id 집합 | 8유형 | 중복 없음(Set size 8) | P1 |
| OA-DATA-07 | 필수 필드 | 각 유형 필수키 | 8유형 | name/alias/axis/tagline/color{tint,solid,deep}/icon/gauge{strength,shadow}/strengths/shadows/matchBestId/matchBestReason 전부 존재·비어있지 않음 | P0 |
| OA-DATA-08 | 게이지 범위 | gauge 값 | 8유형 | strength/shadow ∈ 0..5 정수 | P1 |
| OA-DATA-09 | 아이콘 매핑 | type.icon | 8유형 | `isKnownIcon(icon)===true` (TypeIcon ICON_MAP에 전부 존재, HelpCircle 폴백 안 탐) | P1 |
| OA-DATA-10 | OG 아이콘 매핑 | type.icon | 8유형 | ogIcons OG_ICON_SHAPES에 전부 존재(FALLBACK 안 탐) — TypeIcon과 OgIcon **두 매퍼 동기화** 확인 | P1 |
| OA-DATA-11 | 색 형식 | color 3톤 | 8유형 | tint/solid/deep 전부 `#RRGGBB` 6자리 hex | P2 |
| OA-DATA-12 | 문항 수 | questions 길이 | questions.json | config.questionCount(10)와 일치, questions.length===10 | P0 |
| OA-DATA-13 | 옵션 수/구조 | 각 문항 options | 10문항 | 각 4지선다, option{id,text,scores} 존재, id 문항 내 유일 | P0 |
| OA-DATA-14 | delta 정수 | 모든 option.scores.x/y | 40옵션 | 전부 정수(Number.isInteger), NaN/undefined 없음(x·y 둘 다 존재) | P1 |
| OA-DATA-15 | 축 커버리지 | 각 문항 delta 부호 분포 | 10문항 | 각 문항이 4상한 방향으로 최소한의 분산(문항별 x부호·y부호가 한쪽으로만 쏠리지 않는지 리포트) | P2 |
| OA-DATA-16 | 축 균형(합) | 전 옵션 delta 총합 | 40옵션 | Σx, Σy 리포트(0에서 멀면 구조적 편향 신호 — 분포편향 근본원인 추적용) | P1 |
| OA-DATA-17 | config 축 정의 | config.axes | config.json | id x/y, pos/neg가 types.json 라벨(work/relation, lead/follow)과 일치 | P1 |
| OA-DATA-18 | 라벨 키 존재 | config.labels 필수키 | config.json | ConfigLabels 필수 8키 + 화면 참조 키(matchCtaButton, friendPreviewBadge/Cta, toastNoResult, socialProofTemplate 등) 전부 존재 | P1 |

### C. 상태머신 (`test/page.tsx`) — Integration (jsdom + RTL)

| ID | 카테고리 | 시나리오 | 입력/조작 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-STATE-01 | 정상 진행 | 10문항 순차 선택 | 각 문항 옵션 탭(타이머 advance) | 마지막 탭 후 analyzing 표시 → 700ms 후 `router.replace(/result/<id>)` 호출 | P0 |
| OA-STATE-02 | 자동전환 잠금 | 선택 직후 같은 문항 다른 옵션 탭 | 첫 탭 후 260ms 내 2번째 탭 | 2번째 탭 무시(pendingQuestionId+disabled 이중 가드), 답변 1건만 | P0 |
| OA-STATE-03 | 중간 새로고침 복원 | 3문항 답 후 재마운트 | sessionStorage에 answers 3건 → 컴포넌트 재마운트 | currentIndex=3(4번 문항)으로 복원, 이전 답 유지 | P0 |
| OA-STATE-04 | popstate 뒤로 | 5번 문항서 브라우저 뒤로 | history.back() → popstate(oaQuestionIndex=3) | currentIndex=3, direction="prev", pending 해제 | P0 |
| OA-STATE-05 | 1번서 더 뒤로 | q1에서 back | handleBack, currentIndex===0 | `router.back()` 호출(랜딩 이탈) | P1 |
| OA-STATE-06 | 손상 sessionStorage | answers에 `"{{bad"` | 재마운트 | try/catch로 무시, restored=[], currentIndex=0, 크래시 없음 | P0 |
| OA-STATE-07 | answers=객체(비배열) | answers에 `'{"a":1}'` | 재마운트 | Array.isArray 가드로 무시, 처음부터 시작 | P1 |
| OA-STATE-08 | 뒤로 후 재선택 | q5→뒤로 q3→다른 옵션 선택 | 재선택 | 해당 qid 답 교체(filter), 중복 답변 없음, 다음 문항 진행 | P1 |
| OA-STATE-09 | 전문항 완료 후 이탈→재진입 | 10답 후 result 저장 전 이탈, 재마운트 | answers 10건, oa-result 없음 | currentIndex=Math.min(10,9)=9 → **q10 재노출**(결과로 점프 안 함). 현 설계 동작임을 문서화. UX 갭 리포트 | P2 |
| OA-STATE-10 | sessionStorage 쓰기 불가 | setItem이 throw(quota/priv 모드) | 선택 진행 | persist catch 삼킴, React state로 진행 계속(크래시 없음) | P1 |
| OA-STATE-11 | 결과 저장 실패 | 마지막 문항 setItem throw | 마지막 탭 | catch 삼킴, router.replace는 그대로 실행(화면 정상 이동) | P1 |
| OA-STATE-12 | analyzing 중 재렌더 | analyzing=true 상태 | - | role="status" aria-live="polite" 로딩만, 옵션 미노출 | P2 |
| OA-STATE-13 | 중복 qid 화면경로 방지 | 같은 문항 여러 번 답(뒤로 왕복) | filter 로직 | answers에 qid당 1건만 유지(OA-SCORE-10 갭이 화면경로에선 안 터짐을 입증) | P1 |

### D. 결과 딥링크 (`result/[typeSlug]`, `result/page.tsx`) — Integration

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-LINK-01 | 정적 생성 | generateStaticParams | - | 정확히 8개 {typeSlug}, 값 = 8유형 id | P0 |
| OA-LINK-02 | 잘못된 슬러그 404 | `/result/no-such` | findTypeBySlug undefined | `notFound()` 호출(404) | P0 |
| OA-LINK-03 | 대소문자/특수문자 | `/result/BULLDOZER`, `/result/..` | - | 매칭 실패 → 404 (id는 소문자 kebab, 대문자 미매칭) | P1 |
| OA-LINK-04 | OG 메타 유형별 | generateMetadata(각 유형) | 8유형 | title=`{name} 〈{alias}〉 | {config.title}`, og.images url=`/office-archetype/og/{id}` 1200x1200, twitter summary_large_image | P0 |
| OA-LINK-05 | 잘못된 슬러그 메타 | generateMetadata(bad) | - | `{}` 반환(빈 메타, 크래시 없음) | P1 |
| OA-LINK-06 | 본인 결과 모드 | oa-result===typeSlug | ResultView 마운트 | 프리뷰 배지 없음, ShareCta+재시작 노출 | P0 |
| OA-LINK-07 | 친구 프리뷰 모드 | oa-result≠typeSlug (또는 없음) | ResultView | `friendPreviewBadge` 노출, ShareCta 숨김, friendPreviewCta 링크 노출 | P0 |
| OA-LINK-08 | 확인 전 깜빡임 | isOwnResult===null 초기 | 첫 렌더 | 본인 결과 레이아웃으로 렌더(배지 안 뜸) — FOUC 방지 확인 | P2 |
| OA-LINK-09 | 상성 프리뷰 시트 | matchCTA 클릭 | onMatchCtaClick | previewType 바텀시트 dialog(aria-modal), 배경 클릭·stopPropagation 정상, "이 유형 보기" 링크=`/result/{matchId}` | P1 |
| OA-LINK-10 | 리다이렉터(결과 있음) | `/result` + oa-result 존재 | mount | `router.replace(/result/{slug})` | P0 |
| OA-LINK-11 | 리다이렉터(결과 없음) | `/result` + oa-result 없음 | mount | toastNoResult 표시 → 1500ms 후 `/office-archetype` replace | P0 |
| OA-LINK-12 | 리다이렉터 언마운트 | 1500ms 전 언마운트 | cleanup | clearTimeout 호출(누수/이중 replace 없음) | P2 |
| OA-LINK-13 | restart 세션정리 | 재시작 링크 클릭 | handleRestart | sessionStorage.clear() 호출 후 랜딩 이동 | P1 |
| OA-LINK-14 | indexInTypes | No.XX/08 표기 | 각 유형 | findIndex+1, 1..8, padStart 2자리 | P2 |

### E. 공유 OG 라우트 (`og/[typeSlug]/route.tsx`) — Integration

| ID | 카테고리 | 시나리오 | 입력 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-OG-01 | 8유형 1:1 | 각 유형 `?ratio=1x1`(기본) | 8 GET | 200, ImageResponse 1200x1200, 유형명·태그라인·워터마크 포함 | P1 |
| OA-OG-02 | 8유형 9:16 | 각 유형 `?ratio=9x16` | 8 GET | 200, 1080x1920, 상성카드·워터마크 포함 | P1 |
| OA-OG-03 | 잘못된 ratio | `?ratio=abc`, 없음 | GET | 1x1로 폴백(200) | P2 |
| OA-OG-04 | 잘못된 슬러그 | `/og/no-such` | GET | `Response("Not found",{status:404})` | P0 |
| OA-OG-05 | 워터마크 필수 | 반환 엘리먼트 검사 | 8유형 | `project-orsrw.vercel.app/office-archetype` 문자열 포함(square CTA바 + story 하단) | P1 |
| OA-OG-06 | matchType 무결성 | findMatchType 결과 | 8유형 | 전부 정의됨(상성 배지/카드 렌더 보장, OA-DATA-03 연동) | P1 |
| OA-OG-07 | edge 런타임 안전 | runtime="edge" export | - | Node 전용 API 미사용(순수 satori 트리) 정적 확인 | P2 |
| OA-OG-08 | ratio 파라미터 계약 | ResultView 호출 URL | 코드 | ShareCta imageDownloadUrl=`?ratio=9x16`가 route가 읽는 파라미터명과 일치(`ratio`) — **주석의 `variant` 표기와 실제 `ratio` 불일치 리포트** | P2 |

### F. 접근성 / 모바일 — Manual + Unit

| ID | 카테고리 | 시나리오 | 확인 | 기대 결과 | 우선 |
|---|---|---|---|---|---|
| OA-A11Y-01 | 터치타겟 | 옵션/버튼 44×44 | 옵션·아이콘버튼·공유·CTA | `.touch-target` 적용, 실측 ≥44px | P1 |
| OA-A11Y-02 | 키보드 진행 | Tab+Enter로 10문항 완주 | 실 button 요소 | 마우스 없이 전 플로우 완주 가능 | P1 |
| OA-A11Y-03 | 포커스 링 | :focus-visible | 라이트/다크 | 두 테마 모두 가시 포커스 링 | P1 |
| OA-A11Y-04 | reduce-motion | prefers-reduced-motion:reduce | 슬라이드/rise/loading | `.oa-shell *` 애니 0.01ms화. **단, 이 미디어쿼리는 CSS 레벨만—OptionButton의 260ms JS 타이머·analyzing 700ms JS 타이머는 감축 안 됨. 갭 리포트**(transitionMs override 미연결) | P2 |
| OA-A11Y-05 | aria 상태 | 게이지·로딩·다이얼로그 | DotGauge role=img aria-label, 로딩 aria-live, 시트 aria-modal | 전부 존재 | P1 |
| OA-A11Y-06 | 옵션 aria-pressed | 선택 상태 | OptionButton | lit에 연동, 복원 시 selected 반영 | P2 |
| OA-A11Y-07 | 축소/확대 | viewport maximumScale=5 | - | 확대 허용(1로 잠그지 않음) 확인 | P2 |

### G. 알려진 nit 재현 — Manual/Visual

| ID | 카테고리 | 시나리오 | 재현 조건 | 기대(수정 후) | 우선 |
|---|---|---|---|---|---|
| OA-NIT-01 | 게이지 라벨 줄바꿈(a) | 결과 카드 게이지 라벨 | 좁은 뷰포트(≤360px). shadowLabel="이럴 때 주의하면 더 좋아요"(긴 문자열)가 `.oa-result-card-gauge-item` flex 안에서 도트와 함께 지저분히 줄바꿈 | 라벨 nowrap 또는 gauge-item 세로배치/축약. 두 게이지가 정렬 유지 | P2 |
| OA-NIT-02 | 상성 CTA 다크 대비(b) | 결과 상성 카드 "이 유형 보기 →" | 다크모드. `.oa-result-card-match` 배경=`--oa-type-tint`(라이트 hex 고정) 위 `.oa-result-card-match-cta` 배경=`--oa-surface`(다크 #1C2030)+글자 `--oa-type-deep`(어두운 hex) → 대비 부족 | WCAG AA(≥4.5:1) 충족하도록 CTA 배경/글자 재지정(예: solid 배경+흰 글자, 또는 tint 위에서 deep 유지) | P2 |

---

## 5. Quality Gate (릴리즈 전 필수 통과 조건)

**하드 게이트(하나라도 실패 시 배포 보류)**
1. `npm run type-check` · `npm run build`(클린) 통과
2. 기존 22 + 신규 유닛/통합 테스트 **전건 green**
3. OA-SCORE-01(8유형 도달) · OA-DATA-01~03/07/12~14 · OA-LINK-01/02/04 · OA-OG-04 통과
4. 상태머신 P0(OA-STATE-01/02/03/06) 통과 — 데이터 유실·교착·크래시 0
5. 딥링크/OG 404 처리 정상(죽은 슬러그가 500/빈페이지로 새지 않음)

**소프트 게이트(경고 리포트, 배포는 막지 않되 이슈 등록)**
6. OA-SCORE-02 분포편향 리포트 — 현재 2.9배. **콘텐츠 delta 튜닝 백로그**로 등록(엔진 코드 결함 아님)
7. OA-NIT-01/02 폴리시 픽스(권장, 다크모드 대비는 A11y 관점에서 P2→P1 승격 가능)
8. OA-A11Y-04 reduce-motion JS 타이머 갭 — 개선 백로그

> 콘텐츠 베타 공감률 게이트(4.0/5.0, 방향서 §6-3)는 QA 소관 밖. 단 "코드/데이터는 게이트 통과 후 즉시 교체 가능(하드코딩 0)"임을 QA가 보증한다(도메인 무지 아키텍처 회귀 방지 테스트 = OA-DATA 전반).

---

## 6. 자동화 전략

| 레벨 | 대상 | 도구 | 비고 |
|---|---|---|---|
| Unit | score.ts, data/*.json 정합성 | vitest | **A·B 전 케이스 자동화**(전수 시뮬 포함, <2s). 최우선 |
| Integration | test/page 상태머신, ResultView 모드, 리다이렉터 | vitest + @testing-library/react + jsdom | sessionStorage/history/popstate/타이머는 `vi.useFakeTimers`+jsdom mock. `router` mock(next/navigation) |
| Integration | OG route GET | vitest | GET 직접 호출, 404/파라미터 분기·엘리먼트 트리 스냅샷 문자열 검사. ImageResponse 실렌더는 edge 의존—**엘리먼트 구조 단위 검증**으로 대체 |
| Manual | a11y, nit 시각, reduce-motion, 실기기 | 브라우저 devtools(모바일 에뮬)·axe·스크린리더 | F·G. 체크리스트화 |

**우선 구현 순서(QA실행자용)**: ① A 전수 시뮬(P0 리스크 즉시 수치화) → ② B 정합성(참조 무결성) → ③ C 상태머신 P0 → ④ D 딥링크 → ⑤ E OG → ⑥ F/G 수동.

---

## 부록: 코드 리뷰 발견 (별도 구조화 반환과 동일)

- score.ts 중복 qid 합산 갭(화면경로 filter로 무해) — OA-SCORE-10/OA-STATE-13
- config `resolveEngineNote`의 tie-break 최종 단계 서술("마지막 문항 y부호")이 실제 구현(|x|≥|y| 액션형 우선)과 불일치 — 주석 드리프트, 코드가 SoT
- OG 라우트 파라미터명 `ratio` vs 설계 D4/주석 `variant` 불일치 — 내부 호출은 정합하나 문서/주석 갱신 필요
- reduce-motion이 JS 타이머(260ms/700ms)를 감축하지 않음 — transitionMs override 미연결
- nit (a)(b) 상세는 §4-G
