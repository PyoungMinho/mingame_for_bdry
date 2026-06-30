# 오름(Oreum) — DB 거버넌스 문서

> 관리자: @DB설계자 (백엔드팀)
> 최종 업데이트: 2026-05-14
> 대상: 백엔드팀 / QA팀 / 보안 감사

---

## 1. 디렉토리 구조

```
api/db/
├── migrations/
│   ├── 001_initial_schema.sql     — 7개 테이블 DDL
│   ├── 002_rls_policies.sql       — RLS 전 테이블 활성화 + 정책
│   ├── 003_indexes_and_triggers.sql — 인덱스 + 자동화 트리거
│   └── 004_cron_jobs.sql          — pg_cron 일배치 잡 3개
├── seeds/
│   └── dev_seed.sql               — 개발용 테스트 데이터
├── score_formula.md               — 4축 점수 산식 (부분 공개)
└── README.md                      — 본 문서
```

마이그레이션 실행 순서: 001 → 002 → 003 → 004

---

## 2. 테이블 목록 및 관계도

### ERD (텍스트 기반)

```
auth.users (Supabase)
    │ 1:1
    ▼
[users]
    │ 1:N           1:N           1:1           1:N
    ├─────────────────────────────────────────────────────┐
    │              │              │              │
[daily_checkin] [goal]     [subscription]  [coach_chat]
    │              │ 1:N
    │(일배치)       ▼
    │         [mission]
    ▼
[score_snapshot]
```

### 관계 상세

| 테이블 | 관계 | 대상 | 정책 |
|---|---|---|---|
| users | 1:1 | auth.users | ON DELETE CASCADE |
| daily_checkin | N:1 | users | ON DELETE CASCADE |
| score_snapshot | N:1 | users | ON DELETE CASCADE |
| mission | N:1 | users | ON DELETE CASCADE |
| mission | N:1 | goal | ON DELETE SET NULL |
| goal | N:1 | users | ON DELETE CASCADE |
| subscription | N:1 | users | ON DELETE CASCADE, UNIQUE(user_id) |
| coach_chat | N:1 | users | ON DELETE CASCADE |

---

## 3. RLS 패턴 요약

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| users | 본인만 | service_role | 본인만 | 차단 (소프트) |
| daily_checkin | 본인만 | 본인만 | 본인만 | 차단 |
| score_snapshot | 본인만 | service_role | service_role | 차단 |
| mission | 본인만 | 본인(user) / service_role(ai) | 본인만 | 차단 |
| goal | 본인만 | 본인만 | 본인만 | 차단 |
| subscription | 본인만 | service_role | service_role | 차단 |
| coach_chat | 본인만 | service_role | service_role | 차단 |

**레드라인**: `user_id != auth.uid()` 인 행은 어떤 정책에서도 SELECT 불가.
타인 점수 조회는 DB 레벨에서 원천 차단됨.

### 클라이언트 접근 흐름

```
클라이언트 (anon/authenticated JWT)
    │
    ├─ Supabase RLS 검증 → user_id = auth.uid() 강제
    │
    └─ 서버 전용 작업 (API Route / Edge Function)
           │ service_role key 사용
           └─ score_snapshot INSERT
              coach_chat INSERT
              subscription 갱신
              익명화 잡
```

---

## 4. 일배치 잡 목록

| 잡 이름 | 실행 시각 (KST) | 동작 |
|---|---|---|
| `oreum-daily-score-snapshot` | 00:30 | daily_checkin → score_snapshot 계산·삽입 |
| `oreum-anonymize-inactive-users` | 03:00 | 90일 미접속 유저 PII 익명화 |
| `oreum-daily-mission-queue` | 05:00 | 오늘의 미션 placeholder 생성 (AI 처리는 Edge Function) |
| `oreum-pipa-chat-content-cleanup` | 매월 1일 04:00 | coach_chat 1년 경과 content 삭제 |

---

## 5. 익명화 정책

### 대상

`last_active_at < NOW() - 90 days AND is_anonymized = FALSE`

### 처리 내용

| 필드 | 처리 방법 |
|---|---|
| `users.display_name` | `'탈퇴유저'` 고정값 치환 |
| `users.is_anonymized` | `TRUE` |
| `auth.users.email` | `익명화_{uuid}@oreum.invalid` (Admin API 경유) |
| `coach_chat.content` | `'[익명화됨]'` 치환 |
| `daily_checkin` | 유지 (통계 용도, PII 미포함) |
| `score_snapshot` | 유지 (통계 용도, PII 미포함) |
| `mission`, `goal` | 유지 (PII 미포함) |

### 복구 정책

익명화 후 복구 불가. 재가입 시 신규 계정 생성.

---

## 6. 데이터 보존 기간

| 테이블 | 보존 기간 | 근거 |
|---|---|---|
| users | 영구 (익명화) | 통계 연속성 |
| daily_checkin | 영구 | 사용자 성장 기록, PII 미포함 |
| score_snapshot | 영구 | 성장 시각화 기반 |
| mission | 영구 | 목표 달성 기록 |
| goal | 영구 | 성과 기록 |
| subscription | 영구 | 결제 감사 로그 |
| coach_chat content | 1년 후 삭제 | PIPA 최소수집 원칙 |
| coach_chat meta | 영구 | 비용 집계, PII 미포함 |

---

## 7. PIPA (개인정보보호법) 준수 체크리스트

- [x] 최소 수집: 생년월일 대신 `birth_year` 만 저장
- [x] 코치챗 본문 1년 후 삭제 (PIPA §28의2)
- [x] 90일 미접속 자동 익명화 (서비스 이용 종료 간주)
- [x] 삭제 요청 시 `deleted_at` 소프트 삭제 → 30일 후 실제 삭제 (API Route 구현 필요)
- [ ] 개인정보 처리방침 게시 (법무팀 작업)
- [ ] 제3자 제공 고지 (Anthropic API, OpenAI API 데이터 처리 동의)

---

## 8. 인덱스 전략 요약

| 패턴 | 인덱스 | 설명 |
|---|---|---|
| 오늘 체크인 조회 | `idx_checkin_user_date` | (user_id, date DESC) |
| 최신 점수 조회 | `idx_snapshot_user_date` | (user_id, date DESC) |
| pending 미션 | `idx_mission_user_status` | (user_id, status) |
| 코치챗 페이지네이션 | `idx_chat_user_created` | (user_id, created_at DESC) |
| 90일 미접속 배치 | `idx_users_last_active` | last_active_at (partial) |
| 월간 AI 비용 집계 | `idx_chat_user_cost_month` | (user_id, created_at DESC) WHERE cost_krw > 0 |

---

## 9. 데이터 볼륨 예측

기준: Base 시나리오 유료 MAU 18,000명, DAU = MAU × 0.4 = 7,200명

| 테이블 | 일 증가 행수 | 월 증가 | 1년 누적 | 파티셔닝 필요 시점 |
|---|---|---|---|---|
| daily_checkin | 7,200 | 216,000 | 2,628,000 | MAU 100,000 초과 시 |
| score_snapshot | 7,200 | 216,000 | 2,628,000 | daily_checkin 동일 |
| coach_chat | ~30,000 | ~900,000 | ~10,800,000 | **6개월 내 파티셔닝 검토** |
| mission | ~14,400 | ~432,000 | ~5,256,000 | MAU 100,000 초과 시 |

### coach_chat 파티셔닝 계획 (v1.5)

`created_at` 기준 월별 레인지 파티셔닝 적용.
예: `coach_chat_2026_05`, `coach_chat_2026_06`, ...

```sql
-- v1.5 예고 마이그레이션 (현재 미적용)
-- ALTER TABLE public.coach_chat PARTITION BY RANGE (created_at);
```

---

## 10. 보안 주의 사항

1. `service_role` 키는 서버 환경 변수에만 저장. 클라이언트 번들 노출 절대 금지.
2. `anon` 키는 RLS 정책에 의해 제한됨. 그러나 공개 테이블이 없으므로 anon 접근 = 전면 거부.
3. Supabase Dashboard > SQL Editor 직접 쿼리 시 서비스 롤 수준이므로 RLS 우회 주의.
4. `SECURITY DEFINER` 함수(`update_last_active_on_checkin`) — `search_path = public` 고정 필수.
