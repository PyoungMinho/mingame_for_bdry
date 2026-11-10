# 월마감(/monthly-close) 작업 상태 — 2026-11-08 PM 지시로 일시 중지

PM 지시: "일단 지금 작업상태 기록하고 작업 다 멈춰줘". 돌던 에이전트(출시 전 필수 수정 묶음)와 로컬 dev 서버를 멈췄다. **아무것도 커밋·배포하지 않았다.**

## 재개 (2026-11-10, PM "이어서 진행해줘")
- 순서 1 완료: 실패하던 R2-HIDE 테스트는 현재 통과. tsc 0, 월마감 테스트 804 통과·1 건너뜀, `QA_SHOW_BUGS=1` qa 259 통과, 남은 `it.fails` 0. BUG-01 불변식 단언 그대로.
- 순서 2·3 완료: 디자인팀장 M1~M5 재확인 **승인**(`review-design.md` 재확인 2차), 기획팀장 최종 리뷰 **조건부 Go**(`docs/planning/monthly-close-final-review.md`). 게이트 SQL에 질의 4(힌트 승률·검산 정답률) 추가.
- 순서 4: worktree 게이트 전부 통과(`deploy-gate.md`: 클린 빌드, 테스트 6,836, 시크릿 0, 커밋 185파일) → 미리보기 6장 → **PM "올려" 승인(2026-11-10)** → Supabase SQL 실행 완료(사전 A=0·C=false, 확인 표 4줄 일치, 사후 A=4·B/C 사전과 동일·D/E true·F=0) → 이 커밋으로 push.
- 배포 후 남은 일(PM): 시딩 전 실기 DEV 체크리스트, 눈테스트 3명, 문구 검수 5명, 플레이테스트 3쌍, 회사망 확인(`monthly-close-final-review.md`).

## 어디까지 왔나 (2026-11-08 중지 시점)
| 단계 | 상태 | 산출물 |
|---|---|---|
| STEP 1 기획 | 완료 (조건부 Go, PM 결정 5개 승인) | `docs/planning/sheetbattle-plan.md`, `docs/planning/sheetbattle/` |
| STEP 2 팀장 회의 | 완료 (Go) | `docs/planning/project-direction-monthly-close.md`, `docs/planning/monthly-close/lead-*.md` |
| STEP 3 디자인 | 완료 | `docs/design/monthly-close-{ux-spec,ui-spec,design-final}.md` |
| STEP 4 개발 | 완료 (D0 동결 → 4명 병렬 → D3 통합) | `src/app/monthly-close/**`, `src/app/api/monthly-close/**`, `src/lib/monthly-close/**`, `supabase/monthly-close-*.sql`, `scripts/monthly-close-smoke.mjs`, `docs/frontend/*`, `docs/backend/*` |
| STEP 5 QA | 1차 버그 21건 전부 수정, 2차 재검증 Gate A 조건부 통과 | `docs/qa/monthly-close-{test-plan,bug-report}.md` |
| STEP 6 리뷰 | 세 팀장 검수 완료(모두 조건부) → 출시 전 필수 수정 묶음 **거의 끝난 상태에서 중지** | `docs/planning/monthly-close/review-{design,frontend,backend}.md` |
| STEP 7 배포 | 시작 안 함 | — |

## 중지 시점의 출시 전 필수 수정 묶음 (기록: `docs/frontend/monthly-close-qa-fixes.md` §6)
- 코드 반영 완료(수정 기록상): 디자인 M1~M5(버튼·토스트 대비, 검산 오답 메모 B13, 홈 360px 1단, 모바일 결과 문서, 작업 줄 문서 위로), MC-FE-01(재대결 도발 커서), MC-FE-02(dispose 뒤 재구독), MC-FE-03(피식 판당 1회), F1(결과 화면 폴링 30~60초·10분 뒤 멈춤), BUG-22·23·24(키보드), BUG-25(작은 휴대폰 검산 자동 스크롤).
- **미완료: 최종 검증.** 중지 직전 진행자 중간 점검에서 tsc 0, 월마감 테스트 805개 중 **1개 실패**: `src/lib/monthly-close/qa/reverify.qa.test.tsx` > "R2-HIDE 숨김 중 크롬의 게임 명령은 전부 무시…" > "[room] 숨긴 뒤 크롬의 모든 명령 버튼·메뉴 항목을 눌러도 서버 명령 0·홈 이동 0·복귀 때 팝오버 0·눌림 모양 0". 이번 수정(작업 줄 이동 등)으로 인한 제품 회귀인지 테스트 기대 불일치인지 **아직 판정 안 함**. BUG-01 불변식(숨김 중 서버 명령 0·홈 이동 0·복귀 팝오버 0)은 약화 금지.

## 다시 시작할 때 순서
1. 위 실패 테스트 판정·수정 → `npx tsc --noEmit`, `npx vitest run src/lib/monthly-close src/app/monthly-close src/app/api/monthly-close`, `QA_SHOW_BUGS=1 npx vitest run src/lib/monthly-close/qa` 전부 통과.
2. 디자인팀장 M1~M5 재캡처 승인(캡처: scratchpad `fix-round/`, 재생성 필요할 수 있음).
3. @기획팀장 STEP 6 종합 보고서 `docs/planning/monthly-close-final-review.md`(BUG-22·23 등급, SIM-02 힌트 2개 유지 서명 포함).
4. STEP 7 배포(@배포엔지니어): git worktree에서 클린 빌드·테스트 → 미리보기 스크린샷 → **PM "올려" 승인** → Supabase SQL `supabase/monthly-close-schema.sql` 1회 실행(체크리스트: `review-backend.md` §2) → 명시 경로 커밋(`review-frontend.md` §5-2, 커밋 직전 다시 뽑기) → `git push mingame main` → 연기 시험·POST-01~06.

## 배포 시 주의
- 인덱스에 /flight 45개 staged 상태 — `git commit -- <경로>`로 경로 한정. `package.json`·moira·coffeeball·office 등 기존 변경 섞지 말 것.
- POST-04(레이트 리밋 확인) 뒤 10분은 같은 네트워크에서 새 방 입장이 막힐 수 있음.
- 무료 Supabase는 1주 무활동 시 다시 멈춤(2026-11-07에 Resume함).

## 진행자 기획 판단 (PM 위임)
명중 문구 업종별 2개 엉뚱하게, 검산 판당 3회 유지(미룸 합치지 않음), 한 차례 잃는 턴 최대 1회, 힌트 2개 유지·출시 후 실측 60% 초과 시 1개, 결과 화면 폴링 완화.
