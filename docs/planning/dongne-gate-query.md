# 동네고수 — DAU 게이트 판정 SQL 읽는 법 (PM용)

- 작성: API설계자(백엔드팀)
- 대상: PM(사장) — Supabase 대시보드에서 직접 실행
- 관련: `docs/planning/dongne-direction.md` §0(C2) · §5(R2) · `supabase/dongne-schema.sql`

---

## 1. 이 문서가 필요한 이유

"동네고수"는 **런칭 30일 시점, 직전 7일 평균 DAU ≥ 500**이면 계속하고 미달이면 즉시 손절하는
킬 스위치가 걸려 있다(기획서 §6). 이 판정에 쓰는 진짜 숫자는 Vercel Analytics가 아니라
**Supabase `dongne_dau` 테이블**이다. 이 문서는 그 숫자를 어떻게 뽑는지 안내한다.

## 2. 딱 한 번 해야 할 일 — 스키마 실행

1. https://supabase.com 대시보드 → 이 프로젝트(오후의 패와 같은 프로젝트) → **SQL Editor**
2. `supabase/dongne-schema.sql` 파일 내용을 전체 복사 → 붙여넣기 → **Run**
3. 에러 없이 끝나면 완료. (재실행해도 안전 — `create table if not exists` / 함수는 덮어쓰기이므로 여러 번 눌러도 무방)
4. 이 작업은 딱 1번만 하면 된다. 이후엔 게임이 알아서 매일 카운트를 쌓는다.

> 이 테이블에는 이름·IP·기기정보·쿠키 어떤 것도 저장되지 않는다. 저장되는 건 딱 두 값뿐이다 —
> **"몇 월 며칠(KST)"** 과 **"익명 방문자 토큰(anon_id)"**. anon_id는 브라우저가 스스로 발급하는
> 무작위 UUID로, 특정 개인을 식별할 수 없는 익명 난수다(IP·계정과 연결 안 됨). 이걸로 "서로 다른
> 방문자 몇 명인지(순 방문자 수)"만 센다.

## 3. 평소 확인 — 게이트 판정 쿼리

SQL Editor에 새 쿼리로 아래를 붙여넣고 Run 하면 된다(스키마 파일 맨 아래에도 동일한 쿼리가 있다):

```sql
with latest as (
  select max(day_kst) as latest_day_kst from public.dongne_dau
),
daily_dau as (
  select d.day_kst, count(*) as dau
  from public.dongne_dau d, latest
  where d.day_kst < latest.latest_day_kst
  group by d.day_kst
),
recent_7_complete_days as (
  select day_kst, dau
  from daily_dau
  order by day_kst desc
  limit 7
)
select
  count(*)                  as days_counted,
  round(avg(dau), 1)        as avg_dau_last_7d,
  round(avg(dau), 1) >= 500 as gate_pass
from recent_7_complete_days;
```

### 결과 읽는 법

| 컬럼 | 의미 |
|---|---|
| `days_counted` | 평균에 포함된 날짜 수. 런칭 30일 시점이면 항상 `7`이어야 정상(더 적으면 아직 데이터가 덜 쌓인 것) |
| `avg_dau_last_7d` | **이게 그 숫자다.** 직전 7일(오늘 제외) 평균 순 방문자 수(그 날 distinct anon_id 수) |
| `gate_pass` | `true`면 500 이상(통과) · `false`면 미달(손절 기준 충족) |

- **오늘(가장 최근 날짜)은 항상 제외된다.** 하루가 다 끝나야 그 날 숫자가 확정되기 때문 — 아직 진행 중인 날을 넣으면 평균이 부정확하게 낮게 나온다.
- `gate_pass = false`가 나왔다고 그 자리에서 바로 서비스를 내릴 필요는 없다. 기획서 §6 기준대로 **"런칭 후 30일 시점"**에 판단하면 된다. 그 전에 궁금하면 추이만 참고용으로 봐도 된다(아래 4번).

## 4. 참고용 — 일자별 추이 보기

게이트 판정과 무관하게 그냥 매일 얼마나 오는지 보고 싶으면:

```sql
select day_kst, count(*) as dau
from public.dongne_dau
group by day_kst
order by day_kst desc
limit 30;
```

## 5. 숫자가 이상하게 낮게 나올 때 체크리스트

1. **스키마를 아직 안 돌렸다** → 2번 항목대로 `dongne-schema.sql` 먼저 실행했는지 확인.
2. **배포 직후라 데이터가 며칠치밖에 없다** → `days_counted`가 7보다 작으면 정상(기다리면 됨).
3. **Supabase env가 Vercel Production에 안 걸려 있다** → `/dongne` 방문 시 서버 로그에 `[dongne/ping] ...` 에러가 안 남으면 정상. env 문제면 ping이 조용히 실패하고(게임엔 지장 없음) 카운트도 안 쌓인다 — 배포엔지니어에게 `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`가 Production 스코프에 있는지 확인 요청.

## 6. 알아두면 좋은 것 — 이 집계의 성격

이번 스키마는 방향서 §5-1대로 **(KST날짜, 익명 anon_id) 쌍**을 저장해 날짜별 **순 방문자 수(distinct anon_id)**를 센다.

- **개인정보 안전**: anon_id는 브라우저가 발급하는 무작위 UUID일 뿐, IP·User-Agent·쿠키·계정·기기지문 그 어떤 것도 저장/연결하지 않는다. 특정 개인을 식별할 수 없는 익명 난수라 "이거 저장해도 되나" 걱정거리가 아니다.
- **중복 방지 2중**: (1) 브라우저가 `dongne:ping:{YYYYMMDD}` 플래그로 하루 1회만 신호를 보내고, (2) 서버가 PK(day_kst, anon_id)로 같은 방문자의 하루 재전송을 한 행으로 눌러버린다(on-conflict-do-nothing). 그래서 `avg_dau_last_7d`는 "페이지 열린 횟수"가 아니라 **서로 다른 방문자 수**에 가깝다.
- **경계(정직성 의존이 남는 부분)**: 같은 사람이 브라우저 저장소를 지우거나 시크릿창·다른 기기로 오면 새 anon_id가 생겨 별개 방문자로 잡힌다. 이건 웹 익명 집계의 공통 한계이며, "500명 vs 50명"을 가르는 킬 스위치 판정에는 영향이 미미하다(v1 안티어뷰징은 비목표). 정밀 실명 단위 집계가 필요해지면 v2에서 인증 기반으로 바꾼다.
