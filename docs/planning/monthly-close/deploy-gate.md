# 월마감(/monthly-close) 배포 게이트 — STEP 7 앞부분 (2026-11-10, @배포엔지니어)

범위: 사전확인 + 로컬 게이트 + 빌드 산출물 점검 + env 드리프트 + 시크릿 스캔. **add·commit·push는 하지 않았다**(PM 미리보기 승인 전). 메인 작업 트리의 파일·인덱스·`.next`·localhost:3000 dev 서버는 건드리지 않았다(이 문서 1개만 새로 씀).

## 0. 판정

| 항목 | 결과 |
|---|---|
| 사전확인(remote 관계·롤백 기준선·슬러그·커밋 목록) | **통과** |
| 로컬 게이트(node·npm ci·type-check·클린 build·test) | **통과** |
| BLD-01 / PERF-01 / SEC-07 / LEAK-09 | **통과** / **통과**(여유 4.4KB) / **통과** / **통과**(로더 스크립트는 있음, 아래 참고) |
| 로컬 운영 서버 연기 시험(`next start -p 3100`, MemoryStore) | **통과**(종료 코드 0) |
| env 드리프트 | **통과 — 새 키 0** |
| 시크릿 스캔 | **통과 — 실제 키 0**(이름·주석·테스트 가짜 값만) |
| 공유 파일 diff(`layout.tsx`·`providers.tsx`·`globals.css`·`package.json`·lock) | **0** |

남은 것: 프리뷰 스크린샷 → PM "올려" 승인 → Supabase SQL → add/commit/push → 라이브 검증(§6).

## 1. 사전확인

| 확인 | 명령 | 결과 |
|---|---|---|
| 로컬 main vs mingame/main | `git fetch mingame; git log HEAD..mingame/main; git log mingame/main..HEAD` | 둘 다 비어 있음. **같은 커밋** |
| 롤백 기준선 SHA | `git rev-parse HEAD` | **`46df171ac5dbbb356d1d4055db715177a5cf3195`** (feat: /liar) = 현재 운영 |
| 슬러그 | 예약어 목록·`ls src/app` | `monthly-close`는 예약어 아님, `src/app`·추적 파일에 같은 이름 없음 |
| 작업 트리 | `git status --porcelain` | 비어 있지 않음(flight 45 staged, 무관한 ` M` 10개, 무관한 `??` 다수) → **경로 지정 add/commit으로 분리**(§4) |
| 월마감 파일 상태 | `git status --porcelain -uall` | 월마감 관련 184개 전부 `??`, 이미 추적·staged된 것 0 |
| gitignore에 걸린 월마감 파일 | `git ls-files --others --ignored --exclude-standard -- <경로>` | 0 |
| 추적 안 된 의존 | 월마감 코드의 import 전수 | 외부 패키지(react, next, lucide-react, @supabase/supabase-js, zod, vitest, @testing-library/react, fast-check)는 HEAD `package.json`에 있음. `@/` 경로는 전부 `@/lib/monthly-close`·`@/app/monthly-close`·`@/app/api/monthly-close` 안. 상대경로 `../../../_util`도 월마감 API 안. → **목록 밖 의존 0**(worktree 빌드 통과가 실증) |

## 2. 로컬 게이트 (격리 worktree)

- worktree: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/6e5d3fa5-1e67-4890-90f3-efd18d785ba1/scratchpad/mc-gate` — `git worktree add --detach … mingame/main` (detached `46df171`, main 체크아웃 아님). **지우지 않고 남겨 둠.**
- 복사: 아래 §4의 커밋 경로 184개만 `rsync --files-from`으로 복사. worktree의 `git status --porcelain -uall` = 184줄, 전부 `??`. `package.json`은 HEAD 판본(메인 트리의 `test:redline` 삭제 미포함) = 실제 push될 내용과 같다. `.env*` 없음, 셸에 Supabase/Vercel 변수 없음.
- 파일 지문: `…/scratchpad/mc-gate-manifest.sha1`(184개 SHA-1). 코드가 바뀌면 `rsync -a --checksum --dry-run --itemize-changes --files-from=…/scratchpad/mc-all.txt ./ …/mc-gate/`로 차이를 보고 다시 동기화 → 재실행.

| 단계 | 명령 | 결과 |
|---|---|---|
| node | `node -v` / `.nvmrc` | `v22.10.0` / `22` 일치 |
| 설치 | `npm ci` | 성공(48초) |
| 타입 | `npm run type-check` | 0 오류 (동기화 후 `npx tsc --noEmit` 재실행도 0) |
| 클린 빌드 | `rm -rf .next && npm run build` | 성공. `✓ Compiled successfully`, `Generating static pages (164/164)`. 경고는 기존 것뿐(`MOIRA_TOKEN_SECRET is not set`, edge runtime 정적생성 안내, browserslist) |
| 테스트 | `npm run test` | **Test Files 292 passed · 1 skipped / Tests 6,836 passed · 1 skipped · 1 todo, 실패 0** (308초) |
| 게이트 도중 변경 반영 | `supabase/monthly-close-gate.sql`(질의 4 추가), `server/sql-files.test.ts`(3→4), 문서 2개(+final-review 신규) 재동기화 → `npx tsc --noEmit` + `npx vitest run src/lib/monthly-close/server` | tsc 0, **6 files · 117 tests 통과**. 동기화 후 메인 트리와 worktree 차이 0 |

## 3. 빌드 산출물 점검

**라우트(BLD-01)** — 빌드 목록에 모두 있음:
```
ƒ /api/monthly-close/feedback | health | rooms | rooms/[code]/action | rooms/[code]/join | rooms/[code]/sync
○ /monthly-close              177 B    109 kB
ƒ /monthly-close/[code]       4.92 kB  148 kB
ƒ /monthly-close/practice     4.22 kB  147 kB
+ First Load JS shared by all 90.9 kB
```

**PERF-01**(라우트 전용 gzip 60KB 초과 시 P2, `app-build-manifest.json`에서 루트 layout·main 청크 제외 계산): 홈 17.3KB, `[code]` **55.6KB**, practice 55.0KB → **통과**. 다만 `[code]`가 기준까지 4.4KB 남음 — 다음 기능 추가 때 다시 잴 것. CSS 청크 1개.

**SEC-07 완전판**(`.next/static/**` 파일 수): `SUPABASE_SERVICE_ROLE_KEY` 0 · `service_role` 0 · `sb_secret_` 0 · `server/pipeline` 0 · `store-supabase` 0 · `store-memory` 0 · `monthly-close/server` 0 · `server/db` 0 · `server/nickname` 0 · `createHash` 0 · `node:crypto` 0 · `keyHash` 0 · `MOIRA_TOKEN_SECRET` 0 → **통과**.

**운영 서버 확인**(`npx next start -p 3100`, MemoryStore, 확인 뒤 종료. 3000번 dev 서버는 그대로):
- `node scripts/monthly-close-smoke.mjs http://localhost:3100` → **종료 코드 0, "결과: 전부 통과"** (health ok → 키 없음 400 → 방 만들기 → 입장 → 배치 2 → sync·같은 version 짧은 응답 → 발사 miss → 차례 아님 409 → 기권 → 상대 배치 공개 3척 → 제3자 ROOM_FULL. ④ 익명 키 조회는 env 없어 건너뜀 — 라이브 POST-02에서 수행)
- **LEAK-09**: `/monthly-close`·`/practice`·`/12345` SSR HTML의 `<ins …>` **0개** → 통과. 기록: 루트 layout이 AdSense 로더(`pagead2…adsbygoogle.js` preload + `adsbygoogle-init` 스크립트)를 모든 페이지에 넣으므로 월마감에도 로더는 있다(공유 파일이라 손대지 않음). 자동 광고가 켜지면 라이브에서 `ins`가 생길 수 있으니 배포 후 브라우저 DOM에서 한 번 더 본다.
- noindex: 세 페이지 모두 `<meta name="robots" content="noindex, nofollow">`, `<title>월마감</title>`. 페이지는 메타만 쓰는 것이 설계(방향서 §2 L, next.config/middleware 없음). API는 `x-robots-tag: noindex` + `cache-control: no-store`(health 직접 확인, 나머지 응답은 연기 시험이 전부 검사).
- 회귀(같은 운영 빌드): `/pae` `/moira` `/exam` `/liar` 200.

## 4. 커밋 경로 (확정, 184개 + 이 문서 = 185개)

```
P=(src/app/monthly-close src/app/api/monthly-close src/lib/monthly-close public/monthly-close \
supabase/monthly-close-schema.sql supabase/monthly-close-teardown.sql supabase/monthly-close-gate.sql \
scripts/monthly-close-smoke.mjs \
docs/planning/sheetbattle-plan.md docs/planning/sheetbattle \
docs/planning/project-direction-monthly-close.md docs/planning/monthly-close docs/planning/monthly-close-final-review.md \
docs/design/monthly-close-ux-spec.md docs/design/monthly-close-ui-spec.md docs/design/monthly-close-design-final.md \
docs/frontend/monthly-close-components.md docs/frontend/monthly-close-d3.md docs/frontend/monthly-close-qa-fixes.md \
docs/frontend/monthly-close-d3-hide-timing.mjs \
docs/backend/monthly-close-d0-freeze.md docs/backend/monthly-close-d3-review.md docs/backend/monthly-close-qa-fixes.md \
docs/backend/monthly-close-sim.md \
docs/qa/monthly-close-test-plan.md docs/qa/monthly-close-bug-report.md)
```
(zsh는 배열로 써야 경로가 나뉜다. bash면 `"${P[@]}"`.)

구성: `src/app/monthly-close` 59 · `src/app/api/monthly-close` 9 · `src/lib/monthly-close` 82 · `public/monthly-close` 3 · SQL 3 · smoke 1 · 문서 27(이 문서 포함 28).

## 5. 제외 (커밋에 들어가면 안 되는 것)

| 묶음 | 상태 |
|---|---|
| flight 45개(`src/app/flight/**`, `src/lib/flight/**`, `docs/{design,planning,qa}/flight-*`, `project-direction-flight.md`) | 인덱스에 staged — `git commit -- <경로>`로만 분리 가능 |
| `package.json`(`test:redline` 삭제), `CLAUDE.md`, `.claude/agents/devops/deploy-engineer.md`, `.claude/launch.json`, `teams/workflows/deploy.yaml` | ` M` |
| moira 5개(`src/app/moira/{result,routes}/page.tsx`, `src/lib/moira/{scenario.ts,server/compute.ts,server/odsay.ts}`) | ` M` |
| `src/app/coffeeball/`, `src/lib/coffeeball/`, `src/app/office/` | `??` |
| `docs/design/office-clay-*`, `docs/planning/{absurd-mnemonic-plan,dogpic-gallery,dogprompt-library,dogprompt-seeding-plan,dogstar-plan}.md`, `docs/planning/dogstar/`, `docs/research/rewind/audit/*.html` | `??` |

## 6. env 드리프트 · 시크릿

- 월마감 비테스트 코드가 읽는 키(직접 `process.env.X` + 주입형 `env.X` 전수): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL`, `VERCEL_ENV`. 앞 3개는 HEAD의 /pae·/dongne가 이미 씀(운영 등록 확인됨, review-backend §3), 뒤 2개는 Vercel 시스템 변수 → **새로 등록할 키 0**. 테스트 전용 `MC_SIM_*`·`QA_SHOW_BUGS`는 운영과 무관.
- 주의(review-backend §3): `VERCEL_ENV`가 런타임에 안 들어오면 기록이 `env='development'`로 저장돼 게이트 SQL이 운영 판을 0으로 센다 → 배포 후 POST-06으로 확인.
- 시크릿 스캔(`BEGIN … PRIVATE KEY|sk-ant-|service_role|"private_key"|api[_-]?key\s*[:=]` + JWT `eyJ…`·`sb_secret_`·`sb_publishable_…`·실제 supabase 호스트·`ghp_`·`AKIA`): 실제 키 **0**. 걸린 것은 키 **이름**·SQL `grant … to service_role`·주석·문서 설명·테스트 가짜 값(`'service-key-for-test'`)뿐. `*.key`·`credentials*`·`service-account*`·`.env*` 파일 0.
- SQL 지문: `monthly-close-schema.sql` SHA-256 `23da560d6f97f15052be2861237d811a7e3ffa03bb4824973acb1bf2fe30b868`, 165줄, 첫 줄 `-- 월마감(/monthly-close) — Supabase 스키마` = 백엔드 리뷰 판본과 **같음**. `monthly-close-gate.sql`은 게이트 도중 질의 4가 추가됨(`51d099d3…2596`) — 읽기 전용 조회 파일이며 POST-06은 여전히 **질의 3만** 실행.

## 7. 승인 후 실행 순서 (PM "올려" 이후에만)

0. **직전 재동기화 확인**: 메인 트리와 worktree 차이 0인지(`rsync --checksum --dry-run`, §2). 차이가 있으면 worktree에서 type-check·build·test 재실행. 아울러 `git fetch mingame && git log HEAD..mingame/main`이 비어 있는지(비어 있지 않으면 중단·보고), `git rev-parse HEAD` = `46df171…`인지.
1. **Supabase SQL (push 전, 진행자)**: `review-backend.md` §2 그대로 — Healthy · ref `hwdb` 일치 · 사전 확인 A=0·C=false · New query에 `monthly-close-schema.sql` 전체(165줄·첫 줄 확인) · Run · 성공 판정 ①(4줄 true/true/0/false/false/false) ②(A=4, B·C 사전값과 같음, D=true, E=true, F=0) · 캡처. `pae-schema.sql`·teardown 실행 금지.
2. **add (명시 경로만)**: `git add -- $P` (위 §4 배열. `-A`/`.` 금지)
3. **스테이징 검토·시크릿 스캔**:
   ```
   git diff --cached --name-only -- $P | wc -l          # 기대 185
   git diff --cached --name-only | grep -vE 'monthly-close|sheetbattle' | grep -vE 'flight'   # 기대 0줄 (flight 45개는 staged로 남아 있어도 커밋엔 안 들어감)
   git diff --cached -- $P | grep -iE 'BEGIN [A-Z ]*PRIVATE KEY|sk-ant-|"private_key"|eyJ[A-Za-z0-9_-]{20,}\.|sb_secret_[A-Za-z0-9]'   # 기대 0줄
   git diff --cached --stat -- src/app/layout.tsx src/app/providers.tsx src/app/globals.css package.json package-lock.json   # 기대 0
   ```
4. **경로 지정 커밋**(flight staged분 제외): `git commit -m "feat: 월마감(/monthly-close) — 엑셀 위장 좌표 해전" -- $P`
   - 확인: `git show --stat HEAD | tail -1`(185 files), `git show --name-only HEAD | grep -c flight` = 0, `git show --name-only HEAD | grep -cE 'package.json|moira|coffeeball|office|CLAUDE.md|\.claude/'` = 0, `git diff --cached --name-only | wc -l` = 45(flight 그대로 staged).
5. **push**: `git push mingame main` (origin 아님, force 금지). 배포 SHA = `git rev-parse HEAD`.
6. **라이브 검증**(`review-backend.md` §4-1, 최대 8~10분 폴링, 하나라도 실패하면 다음 단계로 가지 않음):
   0) `https://project-orsrw.vercel.app/monthly-close?v=<SHA>`·`/monthly-close/practice?v=<SHA>` 고유 콘텐츠·제목 "월마감"·noindex 메타. 브라우저 DOM `ins.adsbygoogle` 0 재확인
   1) `GET /api/monthly-close/health?v=<SHA>` → `{"db":"ok"}` (down이면 review-backend §2-6)
   2) POST-01 `node scripts/monthly-close-smoke.mjs https://project-orsrw.vercel.app` → 종료 코드 0, 응답 시간·방 번호·매치 id 기록
   3) POST-06 진행자가 `monthly-close-gate.sql` **질의 3만** 실행 → `env=production`·`is_test=true` 행
   4) POST-02 공개 키 `apikey` 헤더만으로 `mc_*` 4개 REST 조회 → 401/403 + `42501` 또는 200 `[]`
   5) POST-03 초인종 페이로드 키 `["v"]`만, 최소 3건
   6) POST-05 `/pae` 방 만들기, `/moira`·`/exam` 고유 콘텐츠(캐시버스터)
   7) POST-04 맨 마지막 `node …/scratchpad/be-review/post04.mjs https://project-orsrw.vercel.app rotate` (이후 10분 같은 네트워크 새 방 입장 제한 — PM 플레이테스트는 그 뒤)
7. **보고**: 라이브 URL·배포 SHA·각 POST 결과.

**롤백**(review-backend §5): 다른 앱까지 깨지거나 유출 징후 → Vercel Instant Rollback(직전 운영 `46df171` 배포 Promote; 이후 push 반영엔 Undo Rollback 필요). 월마감만 실패 → `git revert --no-edit <SHA> && git push mingame main`. DB는 되돌릴 것 없음(mc_ 4개, RLS·권한 회수).
