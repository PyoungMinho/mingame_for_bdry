# office-archetype 최종 리뷰 (기획팀장 종합 판정)

> STEP 6 "최종 리뷰" 산출물. 디자인·프론트·배포(백엔드 대행) 3팀장 검수 + 기획 의도(방향서) 대비 검증 종합.
> 대상: 직장인 성향 분석기 `src/app/office-archetype/` → `project-orsrw.vercel.app/office-archetype`
> 판정일: 2026-07-07 · 결정권자: 기획팀장(Opus)

---

## 0. 최종 판정: **GO_WITH_FIXES** (내부 검증/프리뷰 배포 GO — 정식 공개는 콘텐츠 베타 게이트 통과 후)

세 팀장 모두 `GO_WITH_FIXES` 이며 **`blocksDeploy=true` finding은 0건**이다. 배포를 물리적으로 막는 결함은 없다.
단 이 제품에는 **기술 게이트와 별개로 방향서 §5가 규정한 콘텐츠 하드 게이트(직장인 30~50명 베타 공감률 4.0/5.0)** 가 존재하며, 데이터에 `status: "v1-draft-pre-beta-gate"`로 명시돼 있다. 따라서 배포는 두 단계로 분리한다:

- **지금 GO**: 코드/인프라를 라이브에 올려 **실사용자 베타 검증을 시작**하는 배포. (베타 공감률·분포편향 재튜닝은 라이브에서 실데이터로 수행하는 단계이므로, 배포가 곧 게이트 검증의 전제)
- **정식 공개(대규모 시딩)는 보류**: 블라인드/커뮤니티 대량 시딩은 공감률 4.0/5.0 통과 + 분포편향 재튜닝 후.

---

## 1. 기획 의도(방향서) 대비 구현 검증

기획팀장이 방향서 핵심 계약을 코드로 직접 대조한 결과 — **핵심 4대 의도 전부 구현 반영 확인**:

| 방향서 계약 | 구현 증거 | 판정 |
|---|---|---|
| **§3 "테스트 팩토리 1번 타자" = 재사용 엔진** | `lib/score.ts` 도메인 하드코딩 0(유형 id/한글 도메인어 전무), 판정은 축·등록순서·라벨만으로 동작. `data/{questions,types,config}.json` 분리 → JSON 교체만으로 hsp-test 등 후속 타자 재사용 가능 | ✅ 부합 |
| **§4-2 2차 확산 루프 = 상성 동료 매칭** | `types.json` 전 유형 `matchBestId`/`matchBestReason`/`matchWorstId` 보유, `findMatchType`이 결과·OG 양쪽에 상성 유형 노출. REDLINE 준수(매칭 없으면 `undefined`, 임의 fallback 생성 금지) | ✅ 부합 |
| **바이럴 재유입 루프 = OG 워터마크 + CTA** | `og/[typeSlug]/route.tsx` 워터마크 `project-orsrw.vercel.app/office-archetype` + CTA바 `"나도 테스트하기 → {watermark}"` 구현(Square 1:1 / Story 9:16 2종) | ✅ 부합 |
| **§1/§6 콜드스타트 전략 = 10문항·8유형·공유카드 2종** | 10문항 상태머신(문항당 1답변 불변식), 8유형 SSG 정적생성(build ● 확인), OG 2종(1200×1200 / 1080×1920 세이프존) | ✅ 부합 |
| **§5 콘텐츠 하드 게이트(베타 공감률 4.0/5.0)** | `_meta.status: "v1-draft-pre-beta-gate"` 3개 데이터 파일에 명시 — **미통과 상태가 데이터에 정직하게 스탬프됨** | ⚠️ **미통과(인간 태스크)** |

**결론**: 엔진·바이럴 루프·콜드스타트 골격은 기획 의도에 충실히 부합. 유일한 미충족은 **콘텐츠 v1 초안의 실사용자 공감률** 이며, 이는 코드가 아닌 인간 검증 태스크로 방향서 §5가 처음부터 "배포 게이트가 아닌 정식 공개 게이트"로 규정한 항목이다.

---

## 2. 3팀장 검수 종합 (blocksDeploy 스캔)

| 팀장 | verdict | P0/P1 findings | blocksDeploy=true |
|---|---|---|---|
| 디자인 | GO_WITH_FIXES | (없음, 전부 P2/P3 시각 nit) | **0건** |
| 프론트 | GO_WITH_FIXES | P0 콘텐츠 게이트(기술 아님), P2 폰트/카톡SDK | **0건** |
| 배포(백엔드 대행) | GO_WITH_FIXES | P1 git 위생, P1 metadataBase | **0건** |

**세 팀장 합산 findings 중 `blocksDeploy=true`는 하나도 없음** → 규칙상 NO_GO 사유 없음. GO_WITH_FIXES 확정.

### 반영한 리스크 대응 (배포 전 반드시 처리 = fixes)
1. **[P1·git 위생] 워킹트리 moira 미커밋분 혼입** — `git status`에 office-archetype과 무관한 moira 수정(`src/app/moira/*`, `src/lib/moira/*`)·**신규 API 라우트 `src/app/api/moira/compute/`**·테스트, 그리고 `.claude/launch.json`·`.env.example`·`vitest.config.ts` 존재. **`git add -A` 절대 금지, 명시 경로만 add.** 이것이 최우선 배포 리스크(-A 시 미검증 moira 코드 유출 = blast radius 폭발).
2. **[P1·metadataBase 부재] `src/` 전역 metadataBase 미설정 확인** — SNS 크롤러가 OG 이미지를 localhost 기준으로 절대화 → 카톡/트위터 썸네일 깨짐. **이 제품의 핵심 성장 루프가 "결과 공유→바이럴"이라 실효 손상.** office-archetype `layout.tsx` metadata에 `metadataBase: new URL('https://project-orsrw.vercel.app')` 추가(신규 라우트 스코프라 blast radius 0). 기존 라우트도 동일 상태라 물리적 차단은 아니나, 바이럴 제품이므로 **배포 직후 또는 배포와 함께 처리 강권**.

### 비차단 후속 nit (배포 후 정리 가능)
- Paperlogy 헤드라인 폰트 CDN 404 → `public/fonts/` 로컬 포함 또는 `@import` 제거(인앱+OG 디스플레이 타이포 미적용, 크래시 없음)
- 카톡 Kakao SDK/앱키 미설정 → 항상 navigator.share/클립보드 폴백. 정식 공개 전 결정 또는 라벨을 "공유하기"로 조정
- design-final §5 `variant→ratio` 표기 동기화, OG Cache-Control 헤더, 다크 FOUC/게이지 시인성

---

## 3. QA open 4건 처리 방침 (전부 저위험·비차단)

| open 항목 | 위험도 | 방침 |
|---|---|---|
| 8유형 분포편향 2.9배(architect 19.15% vs tuner 6.56%) | 소프트게이트 | **엔진 정상, questions.json delta 튜닝 문제.** 베타 공감률 검증과 **동시에** 실데이터로 재튜닝(score.spec baseline 2.919x·Σy=6 회귀 앵커 확보됨) |
| sumScores 비-idempotent | P3 | 화면경로 filter-replace로 무해(문항당 1답변 불변식). 순수함수 dedup은 선택 개선 |
| q10 재노출 UX 엣지 | P3 | analyzing 게이트가 크래시 방어, 결과 산출 일관. UX 미세 갭 |
| reduce-motion JS 타이머 미감축 | P3 | 시각 애니는 정지, JS 지연만 잔존(실질 위해 낮음). OptionButton `transitionMs=0` 주입으로 1줄 개선 가능 |

---

## 4. 프리플라이트 체크리스트 (배포엔지니어 실행 순서)

1. **명시 경로만 스테이징** — `git add src/app/office-archetype tests/office-archetype docs/planning/office-archetype-direction.md docs/design/office-archetype-*.md docs/qa/office-archetype-*.md docs/review/office-archetype-final-review.md` (**`git add -A` 절대 금지**)
2. **스테이징 검증** — `git diff --cached --stat`에 **moira/*, api/moira/compute, .claude/launch.json, .env.example, vitest.config.ts 미포함** 최종 확인
3. **시크릿 스캔** — `git diff --cached`에 하드코딩 키/토큰 0 확인(신규 파일 스캔 클린 기확인)
4. **(권장 fix) metadataBase 추가** — office-archetype `layout.tsx`에 `metadataBase` 세팅 후 `rm -rf .next && npm run build` 재통과
5. **로컬 게이트 재현** — `npm run type-check` PASS · `npm run build` 클린 PASS(result/[typeSlug] ● 8유형 SSG, og ƒ edge) · vitest 579/579 PASS
6. **프리뷰 승인** — 로컬 dev `/office-archetype` 랜딩·결과·공유카드 스크린샷 → PM 승인
7. **push** — `git commit` → `git push origin main`
8. **배포 후 검증** — `WebFetch https://project-orsrw.vercel.app/office-archetype?v=<SHA>` 신규 고유 콘텐츠 확인 · `/office-archetype/result/bulldozer` 200 · `/office-archetype/og/bulldozer` **200 + 이미지 렌더**(edge 실검증) · 기존 `/pae` `/moira` `/exam` 회귀 확인

---

## 5. Caveats (PM 배포 승인 전 반드시 인지)

- **콘텐츠 베타 공감률 4.0/5.0 게이트는 배포 후 실사용자 검증 단계다.** 지금 배포는 이 검증을 *시작*하기 위한 것이며, 통과 전 **대규모 시딩(블라인드/커뮤니티 대량 유입)은 금지**. 미달 시 방향서 §5대로 8유형·문항 재설계.
- **분포편향 2.9배는 베타 검증과 함께 재튜닝한다.** 별도 작업 아님 — 실사용자 공감률 데이터가 delta 재조정의 입력. 엔진은 정상, score.spec 회귀 앵커로 변화 즉시 수치화 가능.
- **metadataBase 미수정 채로 배포 시** SNS 공유 썸네일이 깨져 바이럴 루프가 반쪽이 된다. 체크리스트 4번을 배포와 함께 처리 강권.
- **git add -A 사용 시 미검증 moira 코드(신규 API 포함)가 함께 라이브로 유출**된다. 명시 경로 add가 이번 배포의 최우선 안전 조치.
- 폰트(Paperlogy)·카톡 SDK 미완은 브랜드 톤/라벨 정합 이슈로 배포는 막지 않으나, 정식 공개 전 정리 권장.

---

## 6. 보류/추가 검토 사항

- 직장인 30~50명 베타 모집·공감률 측정 프로토콜(인간 태스크) — 배포 후 착수
- 분포편향 delta 재튜닝(베타 데이터 기반) — 베타와 병행
- Kakao 앱키 발급/SDK 주입 여부 결정 — 정식 공개 전
- Paperlogy 폰트 라이선스·로컬 자산 확보 — 후속

---

**기획팀장 최종 결정**: **GO_WITH_FIXES**. 코드·인프라·바이럴 루프·재사용 엔진 모두 기획 의도에 부합하고 배포 차단 결함 0. 프리플라이트의 2대 fix(git 명시경로 add / metadataBase)를 처리한 뒤 **실사용자 베타 검증을 위한 배포를 승인**한다. 정식 대규모 공개는 콘텐츠 게이트(공감률 4.0/5.0) 통과 + 분포편향 재튜닝 후.
