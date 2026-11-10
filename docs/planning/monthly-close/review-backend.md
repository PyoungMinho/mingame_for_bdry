# 월마감(/monthly-close) STEP 6 최종 리뷰 — 백엔드

- 작성: 2026-11-08 · @백엔드팀장
- 범위: `src/lib/monthly-close/{engine,server}/**`, `src/app/api/monthly-close/**`, `supabase/monthly-close-{schema,teardown,gate}.sql`, `scripts/monthly-close-smoke.mjs`
- 기준: 방향서 `docs/planning/project-direction-monthly-close.md` §4·§10·§11, `docs/backend/monthly-close-{d0-freeze,d3-review,qa-fixes,sim}.md`, `docs/qa/monthly-close-bug-report.md`
- 방식: 읽기와 실행 확인만 했다. 제품 코드, SQL, git 상태는 바꾸지 않았다. 운영 Supabase에는 접속하지 않았다.
- 검토한 SQL 판본: `supabase/monthly-close-schema.sql` SHA-256 `23da560d6f97f15052be2861237d811a7e3ffa03bb4824973acb1bf2fe30b868` (165줄). 이 파일이 바뀌면 §2 체크리스트를 다시 검토해야 한다.

---

## 0. 판정

**백엔드 파트는 출시 가능(조건부 Go)이다.** 출시 전에 고쳐야 할 백엔드 코드는 없다. 남은 필수 항목은 모두 운영 작업이다(§8-1의 SQL 실행, 배포 게이트, 배포 직후 점검).

| 항목 | 판정 | 근거 |
|---|---|---|
| 1. SQL 운영 1회 실행 안전성 | **통과** | 로컬 Postgres 17에 Supabase와 같은 역할·기본 권한·발행을 만들고 /pae·/dongne 스키마를 먼저 올린 뒤 리허설했다(§1-2). 2회 연속 실행에 오류가 없었고, mc_ 밖 카탈로그(테이블·권한·정책·발행·함수·트리거·기본 권한)는 실행 전후 diff가 0이었다. 확인 표 4줄도 기대값과 같았다 |
| 2. 환경변수 | **통과(배포 후 1건 확인)** | 새 키 0개. /pae·/dongne와 변수 이름이 같다. 운영 런타임에 두 키가 있다는 것을 라이브에서 간접 확인했다(§3). 단 `VERCEL_ENV`가 런타임에 들어오는지는 배포 후 POST-06으로 확인해야 한다(지표 집계와 직결) |
| 3. 연기 시험·POST·롤백 | **절차 확정** | 로컬 연기 시험 전 항목 통과(종료 코드 0). POST-01~06의 순서와 판정을 §4에, 롤백 절차를 §5에 정리했다. POST-04는 DB를 건드리지 않는 방식으로 바꿨고, 로컬에서 동작을 확인했다 |
| 4. QA 수정 코드 리뷰 | **통과, 새 결함 P3 2건** | BUG-03·15·16, 닉네임 필터, clientIp 모두 의도대로 동작한다. 리뷰 중 새로 찾은 것은 P3 두 건(N1 고유 인덱스 위반 보고 순서, N2 레이트 리밋 정리 창)이고 둘 다 출시를 막지 않는다(§6) |
| 5. 남은 위험 | **수용(1건은 감시 조건부)** | 결과 탭을 열어 둔 방은 만료되지 않는다. 이 문제는 활성 방 상한뿐 아니라 Vercel Hobby 함수 호출 한도와도 이어지므로, 1·3·7일째에 수치를 점검하고 기준을 넘으면 바로 고친다(§7) |

실행 확인 결과:
- `npx tsc --noEmit --incremental false`: 0 오류
- 백엔드 범위 vitest(엔진, 서버, API, QA 백엔드 테스트 3개): **14파일 243개 통과, 1개 건너뜀**(sim-sweep, 의도된 건너뜀)
- `QA_SHOW_BUGS=1`로 백엔드 관련 QA 4파일 실행: **80/80 통과**(백엔드 몫 `bug()` 남은 것 0)
- `boundaries.test.ts`: 17/17 통과
- `node scripts/monthly-close-smoke.mjs http://localhost:3000`(MemoryStore): **전부 통과, 종료 코드 0**

---

## 1. 이번 리뷰에서 직접 확인한 것

### 1-1. 라이브 상태(읽기 전용 요청 3건, Supabase 직접 접속 없음)

| 요청 | 결과 | 뜻 |
|---|---|---|
| `POST /api/pae/rooms`(인증 헤더 없음, 본문 `{}`) | **401** `{"error":"인증 필요"}` | 이 라우트는 `NEXT_PUBLIC_SUPABASE_URL`이나 `SUPABASE_SERVICE_ROLE_KEY`가 없으면 먼저 500 "Supabase 미설정"을 낸다(`src/app/api/pae/rooms/route.ts`). 401이 나왔으므로 **두 키가 지금 운영 런타임에 있다.** 토큰이 없으면 `uidFromReq`는 Supabase를 부르지 않으므로 DB에 닿는 요청이 아니다 |
| `/pae` 페이지 JS 번들 | `https://hwdb….supabase.co` 1종, 공개 키 `sb_publishable_…` 1종 | `NEXT_PUBLIC_*` 두 값이 운영 빌드에 들어 있다. **프로젝트 ref가 `hwdb`로 시작한다**(§2 체크리스트에서 사용). 공개 키는 새 형식(publishable)이다 |
| `GET /api/monthly-close/health` | 404 | 월마감은 아직 배포되지 않았다(기준선) |

### 1-2. SQL 리허설(로컬 Postgres 17.11, scratchpad 임시 클러스터, 끝난 뒤 삭제)

준비: `anon`·`authenticated`·`service_role(bypassrls)` 역할, `auth.uid()` 대역, Supabase식 기본 권한(public의 테이블·시퀀스·함수를 세 역할에 자동 부여), 빈 `supabase_realtime` 발행을 만들었다. 그 위에 `pae-schema.sql`과 `dongne-schema.sql`을 먼저 실행해 운영과 비슷한 상태를 만들었다.

| 시험 | 결과 |
|---|---|
| schema 1회차·2회차 연속 실행(`ON_ERROR_STOP`) | 둘 다 성공. 확인 표 4줄 모두 `t / t / 0 / f / f / f` |
| mc_ 밖 카탈로그 스냅샷 diff(실행 전 ↔ 2회 실행 후) | **차이 없음**. pae 테이블 3개의 RLS·정책 3개·Realtime 발행 3개, dongne_dau, 기본 권한 모두 그대로 |
| service_role로 저장소 동작 재현 | 방 insert, 자리 2개, CAS update(1회차 1행, 2회차 0행 = CONFLICT), 매치 insert, `on conflict (dedupe_key) do nothing`(두 번째는 0행), identity id 자동 채번, 방 삭제 시 자리 연쇄 삭제·매치 보존 — 전부 기대대로 |
| anon·authenticated로 select·insert | `permission denied for table mc_*`(42501) |
| 발행이 `FOR ALL TABLES`인 프로젝트를 가정 | 확인 표의 `in_realtime_publication`이 `t`로 바뀌어 잡아낸다 |
| teardown 실행 → 재실행 | mc_ 4개만 지워지고 pae·dongne는 그대로. 다시 schema를 실행하면 정상 생성 |
| §2의 사전·사후 확인 쿼리 | 문법과 기대값을 검증했다 |

한계: Supabase 고유 요소(PostgREST 스키마 캐시, SQL 편집기 동작, 새 형식 키)는 로컬에서 재현할 수 없다. 이 부분은 배포 직후 health와 연기 시험이 첫 실측이다.

---

## 2. SQL 실행 체크리스트 (진행자용, 로그인된 Supabase SQL 편집기)

**언제**: 배포 push **전에** 실행한다. 테이블만 있고 코드가 없으면 아무 영향이 없다(브라우저 키로는 읽기·쓰기 모두 거부). 반대로 코드가 먼저 올라가면 SQL을 실행할 때까지 월마감 홈에 "공유 서버에 연결할 수 없습니다"가 뜬다. 그 경우에도 다른 앱에는 영향이 없다.

### 2-1. 실행 직전 확인(전부 예여야 진행)

| # | 확인 | 아니면 |
|---|---|---|
| 1 | 대시보드 프로젝트 상태가 **Healthy**다(Paused가 아니다) | Resume 후 다시 시작 |
| 2 | 브라우저 주소가 `supabase.com/dashboard/project/hwdb…`다. 라이브 번들의 Supabase 주소 `hwdb….supabase.co`와 **ref 앞 4자가 같다** | **중단.** 다른 프로젝트다 |
| 3 | SQL Editor에서 **New query**로 빈 탭을 열었다(저장된 스니펫 탭이 아니다). 실행 역할 선택기가 보이면 `postgres`다 | 새 탭을 열고 역할을 바꾼다 |
| 4 | 아래 **사전 확인 쿼리**를 실행했고 `A = 0`, `C = false`다. B·D 값은 메모해 두었다 | `A ≠ 0`이면 **중단**: 예전 시도에서 만든 mc_ 테이블이 있다는 뜻이다. `if not exists` 때문에 예전 열 구조가 그대로 남을 수 있으므로 백엔드팀장이 확인한다. `C = true`여도 **중단**: 발행이 전체 테이블 대상이라 mc_ 테이블도 자동으로 들어간다 |
| 5 | 또 다른 New query 탭에 `supabase/monthly-close-schema.sql`을 **전체** 붙여 넣었다. 첫 줄이 `-- 월마감(/monthly-close) — Supabase 스키마`이고, 마지막 줄이 `order by t.name;`이며, 165줄이다 | 다시 붙여 넣는다. **첫 줄이 `-- 오후의 패`면 pae-schema.sql이다. 절대 실행하지 말 것**(그 파일도 머리말에 "멱등: 재실행 안전"이라고 적혀 있지만, 실제로는 /pae 테이블을 지운다) |
| 6 | 편집기에서 일부만 선택된 상태가 아니다(선택된 부분이 있으면 그 부분만 실행된다) | 빈 곳을 클릭해 선택을 푼다 |

사전 확인 쿼리(읽기 전용):

```sql
select 'A mc_tables_now' as item, count(*)::text as value, '0' as expect
  from pg_tables where schemaname = 'public' and tablename like 'mc\_%' escape '\'
union all
select 'B other_public_tables', coalesce(string_agg(tablename, ',' order by tablename), '(none)'), '메모'
  from pg_tables where schemaname = 'public' and tablename not like 'mc\_%' escape '\'
union all
select 'C realtime_all_tables', coalesce((select puballtables::text from pg_publication where pubname = 'supabase_realtime'), '(no publication)'), 'false'
union all
select 'D realtime_tables', coalesce((select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'), '(none)'), '메모'
order by 1;
```

B에는 `rooms, room_players, hands`가 보일 것이다(/dongne SQL을 실행했다면 `dongne_dau`도 있다). D에는 `hands, room_players, rooms`가 보일 것이다[추정: pae-schema가 이 셋을 발행에 넣는다].

### 2-2. 실행

1. Run을 누른다. 경고 창이 뜰 수 있다. 이 파일에는 drop 문이 없지만 주석과 문자열에 "drop", "delete", "truncate"라는 단어가 들어 있기 때문이다. **경고에 `drop table` 같은 실제 문장이 보이면 잘못된 파일이므로 취소한다.** 그렇지 않으면 2-1의 5번(첫 줄)을 다시 보고 진행한다.
2. 결과 표가 나올 때까지 기다린다(수 초).

### 2-3. 성공 판정

**① 스크립트 끝의 확인 표(4줄)**: 4줄 모두 아래와 같아야 한다.

| table_name | table_exists | rls_on | policies | anon_has_any_privilege | authenticated_has_any_privilege | in_realtime_publication |
|---|---|---|---|---|---|---|
| mc_events / mc_matches / mc_players / mc_rooms | true | true | 0 | false | false | false |

**② 사후 확인 쿼리**(읽기 전용, New query 탭에서):

```sql
select 'A mc_tables' as item, count(*)::text as value, '4' as expect
  from pg_tables where schemaname = 'public' and tablename like 'mc\_%' escape '\'
union all
select 'B other_public_tables', coalesce(string_agg(tablename, ',' order by tablename), '(none)'), '사전 B와 같음'
  from pg_tables where schemaname = 'public' and tablename not like 'mc\_%' escape '\'
union all
select 'C realtime_tables', coalesce((select string_agg(tablename, ',' order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'), '(none)'), '사전 D와 같음'
union all
select 'D service_role_crud',
       bool_and(has_table_privilege('service_role', format('public.%I', t), 'SELECT')
            and has_table_privilege('service_role', format('public.%I', t), 'INSERT')
            and has_table_privilege('service_role', format('public.%I', t), 'UPDATE')
            and has_table_privilege('service_role', format('public.%I', t), 'DELETE'))::text, 'true'
  from unnest(array['mc_rooms', 'mc_players', 'mc_matches', 'mc_events']) as t
union all
select 'E service_role_seq', has_sequence_privilege('service_role', 'public.mc_events_id_seq', 'USAGE')::text, 'true'
union all
select 'F mc_rows', ((select count(*) from public.mc_rooms) + (select count(*) from public.mc_players))::text, '0'
order by 1;
```

**성공 = ①의 4줄 전부 일치 + ②의 A=4, B·C가 사전 값과 같음, D=true, E=true, F=0.** 두 결과 표를 캡처해 배포엔지니어에게 넘긴다(배포 보고에 첨부).

### 2-4. 실패하면

- 오류가 나면 **아무것도 바뀌지 않는다**(한 트랜잭션). 오류 문구를 그대로 전달한다. 원인을 고친 뒤 다시 실행해도 안전하다.
- `permission denied`가 나면 역할 선택기가 `postgres`가 아닌 경우다.
- ①에서 `anon_has_any_privilege = true`나 `policies > 0`이 나오면 누군가 mc_ 테이블에 권한이나 정책을 따로 걸었다는 뜻이다. **배포를 멈추고** 백엔드팀장에게 알린다.
- ①에서 `in_realtime_publication = true`가 나오면 **발행에서 테이블을 빼려고 하지 말 것**(`alter publication`은 /pae 실시간에 닿는다). 그대로 두고 알린다. 이 경우에도 RLS와 권한 회수 때문에 브라우저 키로는 변경 내용을 받을 수 없다.

### 2-5. 하지 말 것

- `pae-schema.sql` 실행 금지. `monthly-close-teardown.sql`도 지시가 없으면 실행하지 않는다.
- 보안 어드바이저의 "RLS가 켜져 있지만 정책이 없음" 안내는 **의도된 설계**다(정책 0 = 브라우저 전면 거부). 정책을 추가하지 말 것.
- Database → Publications(Realtime)에서 mc_ 테이블을 켜지 말 것.

### 2-6. 배포 후 health가 `down`일 때 진단 순서

health는 이유를 숨기고 `down`만 돌려준다(비밀이 새지 않게 하려는 의도다). 아래 순서로 원인을 좁힌다.
1. 2-3의 ② 사후 확인 쿼리를 다시 실행해 테이블이 있는지 본다. 없으면 SQL을 실행하지 않았거나 다른 프로젝트에 실행한 것이다.
2. SQL 편집기에서 `notify pgrst, 'reload schema';`를 1회 실행하고 1분 뒤 health를 다시 본다(PostgREST 스키마 캐시가 갱신되지 않은 경우).
3. `POST /api/pae/rooms`(인증 없음)가 401이면 키는 있는 것이다. 이때는 서비스 키가 다른 프로젝트의 값이거나 만료됐을 가능성을 본다. 500 "Supabase 미설정"이면 키가 없는 것이다.
4. 프로젝트 상태(Paused 여부)를 확인한다.

---

## 3. 환경변수 판정

| 키 | 월마감에서 읽는 곳 | /pae·/dongne와 같은 이름 | 운영에 있는가 |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `server/db.ts`(서버), `client/bell.ts`(브라우저 초인종) | 같음(`src/lib/pae/supabase-admin.ts`, `src/lib/pae/supabase.ts`, `src/lib/dongne/supabase-admin.ts`) | **있음**: 번들에 `hwdb…`, pae 401 |
| `SUPABASE_SERVICE_ROLE_KEY` | `server/db.ts` 한 곳(경계 테스트로 강제) | 같음 | **있음**: pae 401 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `client/bell.ts`(구독 전용) | 같음 | **있음**: 번들에 `sb_publishable_…` |
| `VERCEL_ENV` | `server/db.ts currentEnv()` → 모든 기록의 `env` | (월마감만 씀) | **미확인** → POST-06 |
| `VERCEL` | `store-memory.ts isOnVercel()`, `auth.ts clientIp()` | (월마감만 씀) | 미확인(아래 참고) |

- **새로 등록할 키는 0개다.** 월마감 전체(`src/lib/monthly-close`, `src/app/monthly-close`, `src/app/api/monthly-close`)의 `process.env` 읽기는 위 5개뿐이다. `VERCEL`·`VERCEL_ENV`는 Vercel이 자동으로 넣는 시스템 변수다.
- **`getStore()`가 운영에서 Supabase를 고르는 조건**: `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`가 **둘 다** 있으면 무조건 `SupabaseStore`다. 이 판단에 `VERCEL_ENV`는 끼어들지 않는다. 두 키가 있다는 것은 §1-1에서 확인했으므로 운영에서 MemoryStore로 빠질 경로는 없다. 키가 빠지는 사고가 나면 `VERCEL`이나 `VERCEL_ENV`가 있을 때 503 `SERVICE_DOWN`, 둘 다 없을 때는 MemoryStore가 된다. 다만 두 키가 확인됐으므로 실제로 일어날 경로는 아니다.
- **새로 찾은 의존성(지표)**: `VERCEL`·`VERCEL_ENV`는 프로젝트 설정의 "시스템 환경변수 노출"이 켜져 있어야 런타임에 들어온다(Vercel 문서. 기본값은 켜짐). 꺼져 있으면 운영 기록이 전부 `env='development'`로 저장된다. 그러면 **게이트 SQL이 운영 판을 0으로 센다.** 게임은 정상으로 돌기 때문에 겉으로는 드러나지 않는다. 레포에 이 변수를 쓰는 다른 앱이 없어 이미 확인된 선례도 없다. 그래서 배포 직후 POST-06으로 확인한다. clientIp는 이 설정과 상관없이 안전하다(`VERCEL`이 없으면 XFF를 먼저 보는데, Vercel이 XFF를 접속 IP로 덮어쓴다).
- 공개 키가 새 형식(`sb_publishable_`)이다. supabase-js 2.109의 구독과 서버 `httpSend`는 이 형식을 지원한다. REST를 직접 조회할 때는 키를 `apikey` 헤더로만 보내야 한다(Supabase 문서). 이 차이 때문에 연기 시험의 ④는 판정 방식을 보완해야 한다(§4 POST-02, N4).

---

## 4. 배포 후 연기 시험과 POST 점검

### 4-1. 순서 (배포엔지니어, 하나라도 실패하면 다음으로 가지 않는다)

| 순서 | ID | 하는 일 | 통과 기준 | 실패 시 |
|---|---|---|---|---|
| 0 | — | 캐시버스터 `?v=<SHA>`를 붙여 `/monthly-close`·`/monthly-close/practice`의 고유 콘텐츠, 제목, `noindex` 확인 | 일치 | 배포 반영 대기·재확인 |
| 1 | — | `GET /api/monthly-close/health?v=<SHA>` | `{"db":"ok"}` | §2-6 진단. 해결 전에는 연기 시험을 돌리지 않는다 |
| 2 | **POST-01** | `node scripts/monthly-close-smoke.mjs https://project-orsrw.vercel.app`(env 변수 없이 실행, ④는 건너뜀) | **종료 코드 0**. 출력의 각 응답 시간도 기록한다(액션이 늘 1초를 넘으면 초인종 대기 상한을 줄일지 검토, §7 #6) | 롤백 판단(§5). 출력의 "방 번호·매치 id"를 보고에 남긴다 |
| 3 | **POST-06**(신규) | 진행자가 SQL 편집기에서 `supabase/monthly-close-gate.sql`의 **질의 3만** 선택해 실행 | `env = production`, `is_test = true`인 행이 matches·events 둘 다에 있다. 연기 시험을 처음 한 번만 돌렸다면 matches 1, events 4(room_created·room_joined·match_started·match_ended) | `env`가 `development`면 Vercel 프로젝트 설정 → Environment Variables → 시스템 환경변수 노출을 켜고 **재배포**한다. **시딩 전 필수**(출시 자체는 막지 않음) |
| 4 | **POST-02** | 공개 키로 REST를 직접 조회한다. `curl -s -i "<URL>/rest/v1/mc_rooms?select=id&limit=1" -H "apikey: <공개 키>"`, 테이블 4개 각각 | HTTP 401/403이고 본문에 **`42501`**(permission denied for table)이 있어야 한다. 200 `[]`도 통과 | 본문이 `Invalid API key`·`No API key`면 시험이 무효다(키를 잘못 넣음). 200에 행이 보이면 **즉시 롤백** + 백엔드팀장 |
| 5 | **POST-03** | scratchpad 일회성 스크립트로 테스트 표시 방 1개를 만든다. A가 방을 만들면 응답 `view.room.bellTopic`을 얻는다. 저장소의 supabase-js로 공개 키 `createClient(URL, 공개 키).channel(bellTopic).on('broadcast', {event:'v'}, …)`를 구독한 상태에서 B 입장 → 배치 2회 → 발사 1회 → 기권 | 받은 모든 페이로드의 키가 정확히 `["v"]`이고 값이 숫자다. 최소 3건 | 0건이면 공개 채널이 꺼졌거나 회사망이 막은 것이다. 게임은 폴링으로 돌아가므로 기록만 한다. **`v` 밖의 키가 있으면 롤백** |
| 6 | **POST-05** | `/pae` 방 만들기(브라우저), `/moira`·`/exam` 고유 콘텐츠 | 성공, 회귀 0 | /pae 방 만들기만 실패하면 같은 Supabase의 문제다. 월마감 health와 함께 본다 |
| 7 | **POST-04** | **맨 마지막에** `node <scratchpad>/be-review/post04.mjs https://project-orsrw.vercel.app rotate` | `limited ≥ 1`(대개 61번째부터)이면 Vercel이 헤더를 덮어쓰는 것이다 → **BUG-11 닫음** | `limited = 0`이면 `… none`(XFF 없이)으로 한 번 더 돌린다. 이번에 `≥ 1`이면 위조가 통한다는 뜻이다 → BUG-11을 P2로 올린다. 둘 다 0이면 요청이 여러 인스턴스로 흩어진 것이다 → 결론을 내지 못한 것으로 기록하고 수용한다(최종 방어선은 활성 방 200) |

POST-04 스크립트: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/6e5d3fa5-1e67-4890-90f3-efd18d785ba1/scratchpad/be-review/post04.mjs`
- QA의 S6 방식(실제 번호 10001~10070으로 join)을 바꿨다. 번호를 `00001~00070`처럼 형식에 맞지 않게 보내면 형식 검사에서 바로 실패해 IP 실패 횟수에 잡힌다. 그래서 **DB를 한 번도 건드리지 않고, 운영 중인 남의 대기방에 실수로 들어갈 일도 없다.** 비밀키는 요청마다 새로 만들고, 테스트 표시도 붙인다.
- 로컬 dev에서 XFF를 고정해 동작을 확인했다: `404 ROOM_NOT_FOUND` 60건, 이어서 `429 RATE_LIMITED` 10건(61번째부터).
- **부작용**: 통과하면 배포엔지니어의 실제 IP가 그 함수 인스턴스에서 **10분 동안 새 방 입장이 막힌다**(자리가 있는 사람의 sync·action은 영향 없음). 그래서 순서상 맨 마지막에 둔다. **같은 네트워크에서 하는 PM 플레이테스트(G0-7)는 POST-04 뒤 10분이 지나서 시작한다.**

### 4-2. 연기 시험이 운영에 남기는 것

- 방 1개, 매치 1개, 이벤트 4건. 모두 `is_test = true`라 게이트에서 빠진다. 방은 30분 뒤 만료되고 다음 방 만들기 때 정리된다. 매치·이벤트는 90일 정리 규칙을 따른다.
- 활성 방 200개 중 1개를 30분 동안 쓴다.
- POST-03 스크립트도 테스트 표시 방 1개를 남긴다(같은 조건).

---

## 5. 롤백

| 상황 | 방법 | 주의 |
|---|---|---|
| 다른 앱(/pae·/moira·/exam 등)까지 깨짐 | **Vercel Instant Rollback**(대시보드 → 프로젝트 → Production 타일 → Instant Rollback). 재빌드 없이 즉시 된다 | ① Hobby는 **바로 직전 운영 배포로만** 되돌릴 수 있다. 월마감 커밋 뒤에 다른 배포가 있었다면 git revert를 쓴다. ② 되돌린 뒤에는 Vercel이 **운영 도메인 자동 할당을 끈다.** 이후 `git push mingame main`을 해도 라이브에 반영되지 않는다. 수정본을 올릴 때는 반드시 **Undo Rollback**(새 배포를 Promote)까지 해야 한다 |
| 월마감만 실패(health down, 연기 시험 실패) | 급하지 않다. 월마감은 홈에 "공유 서버 연결 불가 · 연습 가능"을 띄우고 다른 앱에는 영향이 없다. 바로 고칠 수 있으면 고쳐서 다시 올리고, 아니면 `git revert --no-edit <SHA> && git push mingame main` | revert는 자동 배포 경로를 그대로 쓰므로 Instant Rollback의 ② 함정이 없다 |
| 숨긴 정보 유출(POST-02 행 노출, POST-03 `v` 밖의 키, 연기 시험 금지 키 실패) | **즉시 Instant Rollback** → 원인 분석 → 수정 → Undo Rollback | 유출은 다른 실패보다 먼저 처리한다 |
| DB | **되돌릴 것이 없다.** mc_ 테이블 4개만 추가했고 RLS와 권한 회수로 잠겨 있다. 코드를 되돌린 뒤에도 그대로 두어도 무해하다 | 월마감을 접을 때만 `monthly-close-teardown.sql`을 쓴다. 그 전에 반드시 ① 코드를 먼저 되돌리고 ② 게이트 SQL 결과를 `docs/planning/monthly-close/`에 저장한다. teardown은 되돌릴 수 없다(데이터 영구 삭제). 로컬 리허설에서는 mc_ 4개만 지우고 pae·dongne는 건드리지 않았다 |

---

## 6. QA 수정 후 코드 리뷰

### 6-1. 수정 5건

| 대상 | 판정 | 확인한 것 |
|---|---|---|
| BUG-03 검산 경계 | **정상** | 경계를 전부 "포함"으로 맞췄다. `doAnswer`는 마감 `now > delivered + QUIZ_MS`일 때만 거부하고, `stepQuiz`의 만료(`>`), 확정(`now > plan.at`), `awardedSeats`(`≤ QUIZ_TIE_MS`)가 서로 같은 규칙이다. 액션 전에 도는 `advance()`가 정각에 온 정답을 먼저 먹지 않는다. 남은 사람이 답하면 `doAnswer`가 끝에서 `stepQuiz`를 불러 즉시 확정한다. 아무도 요청하지 않으면 확정이 늦어질 수 있지만, 클라가 settleAt + 150ms에 refresh하므로 멈추지 않는다. 화면의 settleAt 값은 그대로라 프론트 영향이 없다 |
| BUG-15 `quizBacklog` | **정상** | 판마다 0으로 시작하고, 투영 허용 목록 밖이라 화면 데이터에 나가지 않는다. 옛 상태는 `?? 0`으로 읽는다. 출제 라운드에 밀린 회차가 있으면 +1, 출제할 때 −1 하므로 한 라운드에 1회만 나간다. 둘 다 힌트 상한이면 밀린 회차를 비운다. 경보는 `finalizeQuiz → tryIssueAlarm`으로 검산 확정 직후 같은 라운드에 시도되므로 연속 출제 때문에 사라지지 않는다. 받을 수 있는 힌트 수는 출제 시점의 `hintsEarned`로 정하므로 4회 이상 나올 수 없다 |
| BUG-16 2턴 손실 | **정상** | `beginTurn`이 차례 시작 때 쉼을 먼저 소진한다. 따라서 시간 초과 시점에 켜져 있는 `skipNextFire`는 이 차례 도중에 경보 실패로 생긴 것뿐이고, 끄는 것이 맞다. 상대가 실패한 경우, 둘 다 실패한 경우, 시간 안에 쏜 경우 모두 사람당 1턴 손실이다(시뮬 2턴 손실 0건, 테스트 3건). `consecutiveTimeouts`가 1 오르는 것은 문서에 적힌 대로 수용한다 |
| 닉네임 필터 | **정상** | 만들기와 입장 두 경로 모두 `cleanNickname` 뒤 `screenNickname`을 거친다. 저장값, 상태, 상대 화면이 같은 값이다. 대체 이름 "편집자NN"은 DB CHECK(1~8자)를 지킨다. 오탐 예: "땅따먹기"가 `따먹`에 걸려 기본 이름으로 바뀐다. 거부가 아니라 대체이므로 해는 없고 수용한다 |
| clientIp 신뢰 헤더 | **정상** | Vercel에서는 `x-real-ip` → `x-vercel-forwarded-for` → XFF 순서로 본다. Vercel 문서에 따르면 셋 다 플랫폼이 접속 IP로 채우고 외부 XFF는 덮어쓴다. `VERCEL`이 없어도 로컬 분기의 XFF를 Vercel이 덮어쓰므로 안전하다. IP는 로그·DB·응답 어디에도 남지 않는다(서버 `console.*`는 guard의 라우트 이름·예외 종류 1곳뿐) |

### 6-2. 리뷰 중 새로 찾은 것 (출시를 막지 않음)

| # | 등급 | 내용 | 영향 | 제안 |
|---|---|---|---|---|
| N1 | P3 | **고유 인덱스 위반 보고 순서가 MemoryStore와 다르다.** Postgres는 `mc_players_room_seat_uq`(먼저 만든 인덱스)를 먼저 검사한다. 그래서 "같은 키가 같은 1번 자리"에 들어가려 하면 `SEAT_TAKEN`이 나온다(로컬 PG17에서 확인). MemoryStore는 키를 먼저 봐서 `KEY_EXISTS`를 낸다. 결과적으로 `joinFlow`의 "KEY_EXISTS면 계속 진행" 분기는 운영에서 타지 않는다 | 같은 비밀키의 join 두 개가 겹치거나(같은 브라우저 두 탭에서 동시에 열기), 앞선 요청이 행만 넣고 죽은 경우에만 생긴다. 이때 뒤 요청이 `ROOM_FULL`을 받는다. 6초가 지나면 R3 경로가 자기 행을 지우고 다시 시도하므로 새로고침하면 풀린다. 입장 버튼은 `pending`으로 연타가 막혀 있다 | SEAT_TAKEN인데 남은 행의 키가 내 키면 KEY_EXISTS로 처리한다(`pipeline.joinFlow` 한 줄 또는 `SupabaseStore.addPlayer`). MemoryStore도 seat를 먼저 보도록 맞추고 테스트를 추가한다 |
| N2 | P3 | `RateLimiter.prune(now, rule.windowMs)`가 **방금 호출한 규칙의 창**으로 **모든 버킷**을 정리한다. 키가 2만 개를 넘을 때 sync(1초)·join(60초) 규칙이 prune을 부르면 10분 창인 `access-fail-ip`의 차단 기록도 지워진다 | 키를 계속 바꾸는 대입 공격자는 2만 요청마다 IP 차단이 풀린다. 한도가 시간당 약 360회에서 대략 1.5배 수준으로 느슨해진다[추정]. 친구 게임이고 유출되는 정보가 없어 영향이 작다 | 버킷마다 창을 저장하거나, 정리 기준을 가장 긴 창(1시간)으로 바꾼다 |
| N3 | 운영 확인 | `VERCEL_ENV` 미노출 시 운영 기록이 `env='development'`로 저장된다(§3) | 지표가 조용히 0이 된다 | POST-06(코드 수정 불필요) |
| N4 | P3 | 연기 시험 ④가 새 형식 공개 키를 `Authorization: Bearer`로도 보낸다. Supabase 문서는 새 키를 `apikey` 헤더로만 보내라고 한다. 형식 때문에 401이 나도 "거부"로 통과 처리되어, 이 항목이 근거 없이 통과로 보일 수 있다 | 권한 회수의 1차 증거는 SQL 확인 표(§2-3)이므로 실제 위험은 낮다 | POST-02를 §4의 curl 방식(`apikey`만, 본문 `42501` 확인)으로 대체한다. 스크립트는 출시 후 고친다 |

그 밖에 IPv6 사용자는 /64 안에서 주소를 바꿔 IP 버킷을 우회할 수 있다(P3, 대응은 /64 단위 집계). 국내 IPv6 비중과 공격 이득을 감안해 수용한다.

---

## 7. 남은 위험 — 출시 수용 판단

| # | 위험 | 판단 | 근거 | 감시·발동 조건 |
|---|---|---|---|---|
| 1 | 레이트 리밋이 함수 인스턴스 메모리 안에서만 동작(인스턴스가 늘수록 한도가 느슨해짐, N2·IPv6 포함) | **수용** | 방 번호를 맞혀서 얻는 것은 남의 대기방 2번 자리뿐이다. 자리 없는 사람에게는 화면 데이터를 보내지 않는다(G0-4, QA 응답 1,078건 전수 스캔 0). 인스턴스와 무관한 최종 방어선으로 활성 방 200개 상한이 있다 | `CAPACITY` 응답 발생, 또는 `room_joined`가 하루 기준으로 급증하면 → 방 번호 6자리(상수 2개) 또는 Vercel Firewall 규칙 |
| 2 | **결과 탭을 열어 둔 방은 만료되지 않는다**(탭이 보이면 3~5초마다 sync를 보내고, 그때마다 만료가 30분씩 늘어남) | **조건부 수용(감시 필수)** | 영향이 두 가지다. ① 활성 방 상한 200을 차지한다. ② **함수 호출 수**: 탭 하나가 시간당 720~1,200회를 호출해 한 판 전체(약 600회)보다 많다. Vercel Hobby는 한도를 넘으면 **프로젝트 전체(모든 라이브 앱)가 멈출 수 있다**[커뮤니티 보고, 한도 수치는 미확인]. 지인 시딩 규모(14일 100판)에서는 탭을 열어 둔 채 오래 두는 경우가 드물다. 또 탭이 백그라운드로 가면 브라우저 타이머가 느려진다[추정]. 그래서 한도 안에 들 것으로 본다[추정] | **1·3·7일째 점검**: Vercel 대시보드 Usage → Function Invocations, 그리고 SQL `select status, count(*), count(*) filter (where updated_at < now() - interval '30 minutes') as lingering from public.mc_rooms where expires_at > now() group by status;` **프로젝트 전체 하루 호출이 3만 건을 넘거나(월 100만 속도, 다른 앱 포함) `ended` 상태의 활성 방이 30개 이상이면 그날 F1을 적용한다** |
| 3 | 검산 중 상대가 답을 내면 version만 오른다(1비트: "상대가 뭔가 냈다") | **수용** | 정답, 오답 여부, 잠금 값은 새지 않는다(비간섭 테스트). 얻는 정보는 "상대가 입력했다"뿐이고, 이것으로 내 답을 바꿀 방법이 없다 | 없음 |
| 4 | 숨기기 소급 한계(정지 처리 전에 복귀하면 대개 2초 이하는 흐른 것으로 처리) | **수용** | 클라가 숨기기·복귀를 즉시 keepalive sync로 보낸다. 손해의 상한은 한 번에 약 2초다 | 플레이테스트에서 불만이 나오면 재검토 |
| 5 | 경보 반응 ms를 클라이언트가 보고한다(조작하면 벌칙을 피함) | **수용** | 설계 결정이다(방향서 §4-1). 친구끼리 하는 게임이고, 조작해서 얻는 것은 1턴뿐이다 | 없음 |
| 6 | 초인종 `httpSend`를 응답 전에 최대 1.5초 기다린다 | **수용** | 평소 수십~수백 ms[추정] | POST-01 응답 시간. 액션이 계속 1초를 넘으면 상한을 줄인다(서버 상수 1개) |
| 7 | 실제 Supabase로는 처음 돈다(PostgREST 임베딩·upsert) | **수용** | SQL 의미는 로컬 PG17에서 재현했다(§1-2). PostgREST 경로는 health와 POST-01이 첫 실측이고, 실패해도 월마감만 "점검 중"이 된다 | POST-01 실패 시 §5 |
| 8 | 방이 만료되면(30분 무활동) feedback이 기록되지 않는다 | **수용** | 결과 화면 직후에 보내므로 영향이 작다 | 웃음 응답 수가 기대보다 적으면 재검토 |
| 9 | N1 같은 키 동시 입장 시 ROOM_FULL | **수용** | 6초 뒤 스스로 풀리고, UI가 연타를 막는다 | 출시 후 F2 |
| 10 | N3 `VERCEL_ENV` 미노출 | **수용 불가 → 확인으로 해소** | 지표가 조용히 0이 되면 14일 게이트 판정이 무의미해진다 | POST-06(시딩 전 필수) |

---

## 8. 수정 요청

### 8-1. 출시 전 필수 (전부 운영 작업, 백엔드 코드 수정 0건)

| # | 누가 | 할 일 | 완료 기준 |
|---|---|---|---|
| M1 | 진행자 | §2 체크리스트대로 `monthly-close-schema.sql` 1회 실행(**push 전**) | §2-3 성공 판정 전부 충족 + 캡처 |
| M2 | 배포엔지니어 | 커밋할 내용만 꺼낸 git worktree에서 BLD-01(`npm ci` · type-check · `rm -rf .next && npm run build` · `npm run test`), PERF-01, LEAK-09, **SEC-07**. `.next/static/**`에서 `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_`, `server/pipeline`, `store-supabase`가 0건이고, `service_role`은 supabase-js 주석 외에 0건이어야 한다 | 전부 통과 |
| M3 | 배포엔지니어 | 명시 경로만 `git add`하고 `git commit -- <같은 경로>`로 커밋한다. 방향서 §10의 경로에 **`scripts/monthly-close-smoke.mjs`를 추가**한다(지금 목록에 없음. 비밀 없음, 빌드 영향 없음). staged 상태인 /flight 45개와 `package.json`의 기존 변경은 넣지 않는다 | `git diff --cached --stat`이 월마감 경로뿐 |
| M4 | 배포엔지니어 | §4-1 순서대로 0 → 1 → POST-01 → POST-06 → POST-02 → POST-03 → POST-05 → **POST-04(맨 끝)** | 각 통과 기준. POST-06이 실패하면 출시는 유지하되 시딩 전에 재배포 |
| M5 | 진행자 → PM | 안내 2가지: ① POST-04 뒤 10분 동안은 같은 네트워크에서 새 방 입장이 "잠시 후 다시"로 막힐 수 있다 ② 1·3·7일째에 §7 #2를 점검한다 | 전달 기록 |

### 8-2. 출시 후 가능 (우선순위 순)

| # | 등급 | 내용 | 소유 | 시한 |
|---|---|---|---|---|
| F1 | P2 | 끝난 방이 계속 살아 있는 문제. 서버에서 `ended` 상태로 N분(예: 재대결 대기 2분 + 30분)이 지나면 sync가 만료를 늘리지 않게 한다. 만료되면 클라는 ROOM_NOT_FOUND를 받고 폴링을 멈춘다(현 클라 동작). 결과 탭이 나중에 "찾을 수 없음"으로 바뀌므로, 프론트가 결과 화면을 로컬에 붙잡아 두거나 `ended`에서 폴링 간격을 30~60초로 늘리는 방안을 함께 정한다 | 백엔드(+프론트) | §7 #2의 기준을 넘으면 그날, 아니어도 시딩 1주 안 |
| F2 | P3 | N1: SEAT_TAKEN인데 남은 행의 키가 내 키면 KEY_EXISTS로 처리하고, MemoryStore의 위반 보고 순서를 PG와 맞춘 뒤 테스트를 추가한다 | 백엔드 | 2주 안 |
| F3 | P3 | N2: `RateLimiter.prune`을 버킷별 창(또는 가장 긴 창) 기준으로 바꾼다 | 백엔드 | 2주 안 |
| F4 | P3 | N4: 연기 시험 ④를 `apikey` 헤더만 보내고 본문 `42501`로 판정하도록 바꾼다. POST-03(초인종 페이로드)도 스크립트에 넣는다 | 백엔드 | 다음 배포 때 |
| F5 | P3 | health가 `down`일 때 서버 로그에 PG·PostgREST **오류 코드만** 남긴다(예: `[monthly-close] health down PGRST205`). 지금은 원인이 보이지 않는다. 코드는 비밀이 아니다 | 백엔드 | 다음 배포 때 |
| F6 | P3 | IPv6 클라이언트는 /64 단위로 IP 버킷을 센다 | 백엔드 | 남용 신호가 보이면 |
| F7 | 기획 확인 | G0-3 힌트 항목을 출시 후 실측(`mc_matches.hints`·`winner_seat`)으로 판정한다. 진행자 결정이 이미 기록돼 있으니 기획팀장의 최종 서명만 남는다 | 기획팀장 | STEP 6 종합 때 |

---

## 9. 출처

- 코드: `src/lib/monthly-close/server/{db,auth,rate,nickname,pipeline,store-supabase,store-memory}.ts`, `src/lib/monthly-close/engine/{core,quiz}.ts`, `src/lib/monthly-close/client/{bell,liveRoom,api}.ts`, `src/app/api/monthly-close/**`, `src/app/monthly-close/_screens/{GameScreen,JoinDialog}.tsx`, `src/app/api/pae/rooms/route.ts`, `src/lib/pae/{auth,supabase-admin,supabase}.ts`, `src/lib/dongne/supabase-admin.ts`, `supabase/{pae,dongne,monthly-close-*}.sql`, `scripts/monthly-close-smoke.mjs`
- 실행 산출물(scratchpad): `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/6e5d3fa5-1e67-4890-90f3-efd18d785ba1/scratchpad/be-review/`(`bootstrap.sql`·`snapshot.sql`·`snap-before.txt`·`snap-after.txt`·`func.sql`·`precheck.sql`·`postcheck.sql`·`post04.mjs`)
- [Supabase — API keys(새 키는 `apikey` 헤더, 권한 누락은 service_role도 거부)](https://supabase.com/docs/guides/api/api-keys)
- [Vercel — System environment variables(`VERCEL`·`VERCEL_ENV`는 노출 설정이 켜져 있을 때 제공)](https://vercel.com/docs/environment-variables/system-environment-variables)
- [Vercel — Request headers(`x-forwarded-for` 덮어쓰기, `x-real-ip`·`x-vercel-forwarded-for` 동일)](https://vercel.com/docs/headers/request-headers)
- [Vercel — Instant Rollback(Hobby는 직전 배포만, 롤백 후 자동 할당 꺼짐·Undo Rollback)](https://vercel.com/docs/instant-rollback)
- [Vercel Community — Hobby 한도 초과 시 일시 중지 보고](https://community.vercel.com/t/hobby-plan-usage-limits-exceeded-due-to-ai-bot-crawling/41718), [호출 한도 수치 불일치 보고](https://community.vercel.com/t/vercel-hobby-plan-function-invocation-limit-discrepancy-1-million-vs-100k-notification/32767)
