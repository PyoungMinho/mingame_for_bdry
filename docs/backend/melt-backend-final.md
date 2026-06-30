# Melt — 백엔드 아키텍처 최종안

> 작성: @백엔드팀장 | 2026-05-29
> 서비스: Melt — 부모-사춘기 자녀 양방향 감정 소통 플랫폼
> 상태: MVP 6주 기준 아키텍처 확정

---

## 0. 팀장 판단 요약

이 서비스는 "채팅 앱"이 아니라 **미성년자 감정 데이터를 다루는 민감 플랫폼**이다.
기술 결정의 1순위는 속도나 기능이 아닌 **법적 안전성과 데이터 격리**다.
단순하게 만들되, 보안 경계는 타협하지 않는다.

---

## 1. 기술 스택

| 영역 | 선정 | 근거 |
|---|---|---|
| Runtime | Node.js 20 LTS | 안정적, 생태계 성숙 |
| Framework | Next.js 15 API Routes (BFF) | 프론트팀 스택 통일, 배포 단순화 |
| DB | Supabase Postgres | RLS 기반 행 단위 격리, 관리형 서비스 |
| ORM | Supabase JS Client + 직접 SQL | 복잡 쿼리는 Postgres 함수로 처리 |
| 스케줄러 | pg_cron (Supabase 내장) | 인프라 추가 없이 TTL/배치 처리 |
| Auth | Supabase Auth (JWT) | 가족 멤버십 + RLS 연동 |
| AI | Anthropic Claude API (Haiku) | 톤 검토 전용, 비용 최소화 |
| 실시간 | Supabase Realtime (Postgres Changes) | 자녀의 공개 결정을 부모에게 즉시 반영 |
| 배포 | Vercel (Next.js) + Supabase Cloud | 단일 플랫폼, MVP 인프라 간소화 |
| 모니터링 | Sentry + Supabase 대시보드 | 에러 추적 + 쿼리 성능 |
| 환경변수 관리 | .env.local / Vercel Env | 스테이징/프로덕션 분리 |

---

## 2. 시스템 구조도

```
[iOS/Android 클라이언트 (React Native)]
[Web 클라이언트 (Next.js 15)]
          │
          │  HTTPS + Supabase JWT
          ▼
[Next.js API Routes — BFF 레이어]  (src/app/api/*)
          │
          ├── assertFamilyMember()     ← 가족 소속 검증
          ├── assertRole()             ← parent / child 역할 검증
          ├── assertAgeCompliance()    ← 만 14세 미만 법정대리인 동의 확인
          ├── rateLimiter()            ← Upstash Redis (가족 단위 + 개인 단위)
          │
          ├──► [Supabase Postgres + RLS]
          │         - families / users / family_members
          │         - emotion_cards (TTL 72h)
          │         - card_visibility / card_history
          │         - ai_reviews
          │         - legal_consents
          │
          ├──► [pg_cron 잡 3개]
          │         - 72시간 카드 하드 삭제 (매시간)
          │         - 만료 알림 예약 (매일)
          │         - PIPA 법정 감사로그 정리 (월 1회)
          │
          ├──► [Supabase Realtime]
          │         - 자녀 공개 결정 → 부모 실시간 반영
          │         - 카드 수신 알림
          │
          └──► [Anthropic Claude Haiku API]
                    - 부모 메시지 톤 검토 전용
                    - 서버사이드 단방향 호출 (클라이언트 미노출)
```

**아키텍처 원칙: 모놀리식 Next.js BFF + Supabase 단일 스택**

마이크로서비스 불채택. 이유: MVP 6주 일정에서 서비스 분리는 운영 복잡도만 증가시킨다.
AI 톤 검토는 별도 마이크로서비스가 아닌 BFF 레이어 내 단일 함수로 처리한다.
트래픽 규모(가족 단위 소수 사용자)에서 분리 이익이 없다.

---

## 3. 데이터 모델 — 핵심 설계

### 3-1. 가족 계정 구조

```sql
-- 가족 단위 (최상위 그룹)
CREATE TABLE families (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_name   TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  invite_code   TEXT UNIQUE NOT NULL DEFAULT generate_invite_code()  -- 6자리 초대 코드
);

-- 사용자 (Supabase auth.users 1:1 연결)
CREATE TABLE users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL,
  birth_year      INT,             -- PIPA: 연도만 저장 (전체 생년월일 저장 금지)
  role            TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  is_minor        BOOLEAN GENERATED ALWAYS AS (
                    CASE WHEN birth_year IS NOT NULL
                    AND (EXTRACT(YEAR FROM now()) - birth_year) < 14
                    THEN true ELSE false END
                  ) STORED,       -- 만 14세 미만 여부 자동 계산
  legal_guardian_confirmed BOOLEAN DEFAULT false,  -- 법정대리인 동의 완료 여부
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active_at  TIMESTAMPTZ
);

-- 가족 멤버십 (N:M, 부모 최대 2명 + 자녀 N명)
CREATE TABLE family_members (
  family_id   UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('parent', 'child')),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, user_id)
);

-- 인덱스
CREATE INDEX idx_family_members_family_id ON family_members(family_id);
CREATE INDEX idx_family_members_user_id   ON family_members(user_id);
```

**설계 판단**:
- 가족당 부모 2명 제한은 DB 레벨이 아닌 API 레이어에서 강제 (CHECK 제약보다 유연한 에러 처리 가능)
- `invite_code`로 가족 그룹 초대 구현 (QR코드 또는 문자 공유)

### 3-2. 감정 카드 (72시간 TTL 핵심 테이블)

```sql
-- 감정 카드 본체
CREATE TABLE emotion_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID NOT NULL REFERENCES families(id),
  sender_id       UUID NOT NULL REFERENCES users(id),
  recipient_id    UUID NOT NULL REFERENCES users(id),

  -- 콘텐츠
  emotion_tag     TEXT NOT NULL,          -- 'sad', 'anxious', 'proud', 'confused' 등
  content         TEXT NOT NULL,          -- 부모 작성 메시지 (암호화 저장)
  ai_reviewed     BOOLEAN DEFAULT false,  -- AI 톤 검토 완료 여부
  ai_review_id    UUID REFERENCES ai_reviews(id),  -- 수정 제안 연결

  -- TTL 관련 (핵심)
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL GENERATED ALWAYS AS (sent_at + INTERVAL '72 hours') STORED,
  is_deleted      BOOLEAN NOT NULL DEFAULT false,  -- 소프트 삭제 플래그 (하드 삭제 전 감사용)
  deleted_at      TIMESTAMPTZ,

  -- 5분 쿨링오프
  cooloff_until   TIMESTAMPTZ NOT NULL GENERATED ALWAYS AS (sent_at + INTERVAL '5 minutes') STORED,
  can_recall      BOOLEAN GENERATED ALWAYS AS (now() < cooloff_until) STORED,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TTL 인덱스 (삭제 배치 성능)
CREATE INDEX idx_emotion_cards_expires_at ON emotion_cards(expires_at)
  WHERE is_deleted = false;
CREATE INDEX idx_emotion_cards_recipient  ON emotion_cards(recipient_id, expires_at);
CREATE INDEX idx_emotion_cards_family     ON emotion_cards(family_id);
```

### 3-3. 권한 모델 — 자녀 주도권 구조

```sql
-- 카드 공개 여부 (자녀가 결정하는 핵심 테이블)
CREATE TABLE card_visibility (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID NOT NULL UNIQUE REFERENCES emotion_cards(id) ON DELETE CASCADE,
  -- 자녀가 명시적으로 공개 결정을 내리기 전까지 부모는 열람 불가
  -- visibility: 'pending'(자녀 미결정) | 'visible'(공개) | 'hidden'(자녀가 숨김 결정)
  visibility  TEXT NOT NULL DEFAULT 'pending' CHECK (visibility IN ('pending', 'visible', 'hidden')),
  -- 공개 범위: 'full'(전체) | 'emotion_only'(감정 태그만) | 'summary'(요약만)
  scope       TEXT NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'emotion_only', 'summary')),
  decided_at  TIMESTAMPTZ,  -- 자녀가 결정한 시각
  decided_by  UUID REFERENCES users(id)  -- 반드시 자녀 본인이어야 함 (RLS 강제)
);

-- 자녀 감정 히스토리 (자녀 본인 전용)
CREATE TABLE child_emotion_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id     UUID NOT NULL REFERENCES users(id),
  family_id    UUID NOT NULL REFERENCES families(id),
  card_id      UUID REFERENCES emotion_cards(id) ON DELETE SET NULL,
  emotion_tag  TEXT NOT NULL,
  note         TEXT,              -- 자녀 본인 메모 (부모 열람 불가)
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 히스토리는 카드 삭제 후에도 감정 태그만 보존 (card_id NULL 처리)
  is_archived  BOOLEAN DEFAULT false
);
```

### 3-4. AI 톤 검토

```sql
CREATE TABLE ai_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id         UUID NOT NULL REFERENCES emotion_cards(id) ON DELETE CASCADE,
  original_text   TEXT NOT NULL,    -- 원문 (검토 후 삭제 대상)
  issues_found    JSONB,            -- [{type: 'accusatory', span: [10, 25], suggestion: '...'}, ...]
  risk_level      TEXT CHECK (risk_level IN ('safe', 'caution', 'high')),
  model_used      TEXT NOT NULL,    -- 'claude-haiku-4'
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 원문은 카드 발송 후 24시간 이내 삭제 (최소 보존 원칙)
  original_purged BOOLEAN DEFAULT false,
  purged_at       TIMESTAMPTZ
);
```

### 3-5. 법적 동의 (PIPA 필수)

```sql
CREATE TABLE legal_consents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id),
  consent_type    TEXT NOT NULL CHECK (consent_type IN (
                    'terms_of_service',
                    'privacy_policy',
                    'minor_guardian_consent',   -- 만 14세 미만 법정대리인 동의
                    'sensitive_data_processing' -- 감정 데이터 = 민감정보
                  )),
  consented       BOOLEAN NOT NULL,
  consented_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  guardian_id     UUID REFERENCES users(id),   -- 법정대리인 동의 시 부모 user_id
  ip_address      INET,                        -- 동의 IP (감사 증적)
  user_agent      TEXT,
  consent_version TEXT NOT NULL                -- 약관 버전 (변경 추적)
);

-- 감사 로그 (PIPA 5년 보존 의무)
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID,                 -- NULL 허용 (탈퇴 이후에도 로그 보존)
  family_id   UUID,
  action      TEXT NOT NULL,        -- 'card_sent', 'visibility_changed', 'card_deleted', 'consent_recorded'
  target_id   UUID,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user_id   ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created   ON audit_logs(created_at);
```

---

## 4. RLS 정책 핵심

**전 테이블 `ENABLE ROW LEVEL SECURITY` + 기본 거부(default deny)**

```sql
-- emotion_cards: 같은 가족 내 sender/recipient만 접근
-- 핵심: 부모는 visibility='visible'인 카드만 SELECT 가능
CREATE POLICY "emotion_cards_select" ON emotion_cards
  FOR SELECT USING (
    -- 발신자 본인은 항상 조회 가능
    sender_id = auth.uid()
    OR
    -- 수신자는 card_visibility가 'visible'인 경우만
    (recipient_id = auth.uid() AND EXISTS (
      SELECT 1 FROM card_visibility cv
      WHERE cv.card_id = emotion_cards.id
      AND cv.visibility = 'visible'
    ))
  );

-- card_visibility: 오직 자녀(수신자)만 UPDATE 가능
CREATE POLICY "card_visibility_update_child_only" ON card_visibility
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM emotion_cards ec
      WHERE ec.id = card_visibility.card_id
      AND ec.recipient_id = auth.uid()
      AND ec.sender_id != auth.uid()  -- 본인이 보낸 카드는 해당 없음
    )
  );

-- child_emotion_history: 본인만 모든 권한 (부모 접근 완전 차단)
CREATE POLICY "child_history_own_only" ON child_emotion_history
  FOR ALL USING (child_id = auth.uid());

-- legal_consents: INSERT만 허용, 수정/삭제 불가 (감사 무결성)
CREATE POLICY "legal_consents_insert_only" ON legal_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "legal_consents_select_own" ON legal_consents
  FOR SELECT USING (user_id = auth.uid());
-- UPDATE / DELETE 정책 없음 = DB 레벨 차단
```

---

## 5. 핵심 기술 이슈 해결 방안

### 5-1. 72시간 TTL 자동 소실 — 결정: 소프트 삭제 + pg_cron 하드 삭제 2단계

**채택: 소프트 삭제(즉시) + pg_cron 배치 하드 삭제(매시간)**

```
[카드 발송 72시간 후]
     │
     ├─ STEP 1: 매시간 pg_cron 잡이 expires_at < now() 인 행을 is_deleted=true 처리
     │           → RLS에서 is_deleted=true 행은 SELECT 거부 (클라이언트 즉시 소실)
     │
     └─ STEP 2: 24시간 후 실제 DELETE (물리 삭제)
                → audit_logs에 'card_expired' 이벤트만 보존 (내용 없이 ID/시각만)
```

**DB TTL 익스텐션 불채택 이유**: pg_ttl_index는 Supabase 관리형 환경에서 커스텀 익스텐션 설치가 불가하며 재시작 후 수동 초기화 필요. 운영 위험이 크다.

**즉각 삭제(동기 DELETE) 불채택 이유**: 카드 발송 시점에 72시간 후를 예약하는 방식은 대규모 Trigger 또는 외부 Job Queue가 필요해 MVP 복잡도를 높인다. 반면 매시간 배치는 최대 1시간 오차이나 감정 소통 서비스 특성상 수 분 단위 정확도가 불필요하다.

**클라이언트 동기화**: 프론트팀에 `expires_at` 필드 제공 → 클라이언트 타이머로 UI 소실 처리. 실제 데이터는 서버가 정리. 이중 처리로 사용자 경험과 데이터 무결성 모두 확보.

```sql
-- pg_cron 잡 (매시간 정각)
SELECT cron.schedule(
  'melt-expire-emotion-cards',
  '0 * * * *',  -- 매시간
  $$
    UPDATE emotion_cards
    SET is_deleted = true, deleted_at = now()
    WHERE expires_at < now()
    AND is_deleted = false;
  $$
);

-- pg_cron 잡 (매일 새벽 3시 — 실제 하드 삭제)
SELECT cron.schedule(
  'melt-hard-delete-expired-cards',
  '0 3 * * *',
  $$
    DELETE FROM emotion_cards
    WHERE is_deleted = true
    AND deleted_at < now() - INTERVAL '24 hours';
  $$
);
```

### 5-2. E2E 암호화 vs 위기 신호 감지 — 결정: 서버사이드 선감지 후 암호화

**채택: 암호화 전 서버사이드 위기 신호 감지 + 전송 중 TLS + 저장 시 열 암호화**

완전한 E2E 암호화(클라이언트 키 관리)는 채택하지 않는다.

**이유**:
1. **미성년자 보호 의무 우선**: 한국 아동복지법 제26조, 아동·청소년 성보호법상 플랫폼은 위험 신호 감지 및 신고 의무를 진다. E2E 암호화로 서버가 내용을 볼 수 없는 구조는 이 의무를 이행할 수 없게 한다.
2. **부모-자녀 서비스 특성**: 완전 익명 메신저가 아닌 보호 관계 내 소통. 위기 상황(자해 언급 등)에서 개입 가능성을 원천 차단하는 것은 서비스 가치와 상충한다.
3. **클라이언트 키 관리 복잡도**: 키 분실/기기 교체 시 메시지 영구 소실 → 감정 소통 목적에 부적합.

**구현 방식**:

```
[부모 메시지 작성 → 발송 버튼]
        │
        │ STEP 1: BFF에서 위기 신호 스캔 (Haiku API)
        │         - 자해/자살 관련 표현 감지
        │         - 극단적 위협/폭력 표현 감지
        │         → 감지 시: 발송 차단 + 부모에게 안내 + 위기상담 연계 링크
        │
        │ STEP 2: AI 톤 검토 (Haiku API)
        │         - 훈육적/비난적 표현 감지 → 수정 제안 (발송 차단 아님)
        │
        │ STEP 3: Postgres 열 암호화 (pgcrypto)
        │         - emotion_cards.content → AES-256 암호화 저장
        │         - 암호화 키: Supabase Vault (KMS) 관리
        │
        ▼
[DB 저장 — 운영자도 평문 조회 불가]
        │
        │ 감사 접근 (법적 요청 시에만)
        └─ Vault 키로 복호화 → 법적 근거 있는 경우만 허용 (내부 프로세스 별도 정의)
```

**요약**: "완전 E2E 암호화"보다 "서버사이드 선감지 + 저장 암호화 + 접근 감사"가 미성년자 보호와 프라이버시의 현실적 균형점이다.

### 5-3. AI 톤 검토 — Claude Haiku 활용

**설계 원칙**: 발송 차단이 아닌 수정 제안. 부모의 발송 의사를 존중하되 더 나은 표현을 유도.

**프롬프트 설계 방향**:

```
시스템 프롬프트:
"당신은 부모-자녀 소통 전문 상담사입니다.
부모가 사춘기 자녀에게 보내는 메시지를 검토해 주세요.

다음 표현 패턴을 감지하고 개선안을 제안해 주세요:
1. 훈육/지시적 어조: "~해야 해", "~하지 마", "왜 그러는 거야"
2. 비난/비교: "~밖에 안 돼", "다른 아이들은", "실망이야"
3. 감정 무시: "그게 뭐가 힘들어", "별것도 아닌데"
4. 위기 신호: 자해/자살 관련 표현 (최우선 감지)

응답 형식 (JSON):
{
  "risk_level": "safe|caution|high",
  "issues": [{"type": "...", "original": "...", "suggestion": "..."}],
  "overall_suggestion": "한 줄 요약"
}

위기 신호 감지 시 risk_level = 'high' 반드시 반환."

사용자 메시지:
"[부모 작성 텍스트]"
```

**비용 관리**:
- Haiku 사용 (Sonnet 대비 약 12배 저렴)
- 메시지당 1회 호출 (스트리밍 불필요)
- 결과 캐시: 동일 텍스트 24시간 캐시 (Redis)
- 월 비용 예측: 일 100건 × 500토큰 × $0.25/1M = 월 약 $0.38

---

## 6. 보안 고려사항

### 6-1. 미성년자 데이터 처리 규정 준수

**개인정보보호법 제22조의2 (아동의 개인정보 보호)**

| 항목 | 요구사항 | 구현 |
|---|---|---|
| 만 14세 미만 동의 | 법정대리인 동의 필수 | `legal_consents` 테이블에 `guardian_id` + `minor_guardian_consent` 타입 저장. 동의 완료 전 서비스 이용 차단 |
| 법정대리인 확인 | 휴대전화 본인인증 | 온보딩 플로우에서 부모 휴대전화 본인인증 API 연동 (PASS 또는 통신사 인증) |
| 이해하기 쉬운 고지 | 아동 눈높이 언어 | 만 14세 미만 사용자에게 별도 간이 개인정보 처리방침 UI 제공 |
| 최소 수집 | 필요한 정보만 | 생년월일 대신 `birth_year`만 저장. 이름 대신 닉네임. |
| 동의 철회 | 언제든 가능 | 계정 삭제 = 7일 내 물리 삭제 + audit_logs 보존 |

**감정 데이터 = 민감정보 처리**:
- 개인정보보호법 제23조: 민감정보는 정보주체의 별도 동의 필요
- `sensitive_data_processing` 동의 타입을 온보딩에서 별도 수집
- 동의 없이는 감정 카드 기능 전체 비활성

**데이터 최소 보존**:
- 감정 카드 본문: 72시간 후 삭제 (서비스 핵심)
- AI 검토 원문(`ai_reviews.original_text`): 24시간 후 NULL 처리
- 코치 로그 없음 (오름과 달리 Melt는 AI 대화 기능 없음)
- audit_logs: PIPA 의무 보존 5년 후 삭제

### 6-2. 가족 간 데이터 격리

```
격리 레벨:
  1. DB 레벨 (최강): RLS — family_id 기반 행 단위 격리
  2. API 레벨: assertFamilyMember() — 모든 요청에서 요청자가 해당 family 소속인지 검증
  3. 역할 레벨: assertRole() — child 역할은 자신의 card_visibility만 수정 가능
  4. 쿼리 레벨: 모든 DB 쿼리에 WHERE family_id = $1 명시 (RLS 이중 방어)
```

**절대 불가 시나리오 (DB 레벨 차단)**:
- 부모가 `card_visibility = 'pending'` 상태의 카드 내용 조회 → RLS SELECT 정책에서 차단
- 자녀가 다른 가족의 데이터 접근 → RLS family_id 검증에서 차단
- 부모가 자녀의 `child_emotion_history` 조회 → RLS `child_id = auth.uid()` 정책에서 차단

---

## 7. API 설계 확정

### 핵심 엔드포인트 목록

| Method | Path | 역할 | 인증 | 비고 |
|---|---|---|---|---|
| POST | `/api/auth/signup` | 회원가입 (역할 선택) | - | 온보딩 시작 |
| POST | `/api/auth/consent` | 법적 동의 기록 | Auth | 만 14세 미만 시 guardian_consent 필수 |
| POST | `/api/family/create` | 가족 그룹 생성 | Auth(parent) | 초대코드 발급 |
| POST | `/api/family/join` | 초대코드로 가족 합류 | Auth | |
| GET | `/api/family/members` | 가족 멤버 목록 | Auth | |
| POST | `/api/cards` | 감정 카드 발송 | Auth(parent) | AI 톤 검토 포함 |
| GET | `/api/cards/inbox` | 받은 카드 목록 (자녀) | Auth(child) | visibility 필터 없음 — 자녀는 전부 조회 |
| GET | `/api/cards/sent` | 보낸 카드 목록 (부모) | Auth(parent) | visibility='visible'인 것만 내용 포함 |
| DELETE | `/api/cards/:id/recall` | 쿨링오프 내 회수 | Auth(sender) | expires_at > now() - 5min 조건 |
| PATCH | `/api/cards/:id/visibility` | 공개 여부 결정 | Auth(child) | 자녀만 호출 가능 |
| GET | `/api/history` | 자녀 감정 히스토리 | Auth(child) | 본인만 조회 |
| POST | `/api/cards/:id/ai-review` | AI 톤 검토 요청 | Auth(parent) | 발송 전 선택적 호출 |

**응답 공통 래퍼**:
```ts
{
  success: boolean,
  data?: T,
  error?: { code: string, message: string },
  meta: { requestId: string, ts: string }
}
```

---

## 8. 배포 전략

```
환경 분리:
  development  → localhost + Supabase local (docker)
  staging      → Vercel Preview + Supabase 스테이징 프로젝트
  production   → Vercel Pro + Supabase Pro

배포 파이프라인:
  [feature 브랜치 PR]
    → GitHub Actions: 타입체크(tsc) + 린트(ESLint) + 단위테스트(Vitest)
    → Vercel Preview 자동 배포
    → PR 머지

  [main 브랜치 머지]
    → GitHub Actions: 상동 + DB 마이그레이션 검증
    → Vercel Production 자동 배포
    → Supabase 마이그레이션 자동 실행 (supabase db push)

환경변수 관리 (필수):
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY   ← 서버사이드 전용, 클라이언트 절대 노출 금지
  ANTHROPIC_API_KEY
  UPSTASH_REDIS_REST_URL
  UPSTASH_REDIS_REST_TOKEN
  ENCRYPTION_KEY              ← Postgres 열 암호화 키 (Supabase Vault 관리)
  IDENTITY_VERIFICATION_API_KEY  ← 본인인증 API
```

---

## 9. 백엔드 개발 일정 (6주 MVP)

| 주 | 마일스톤 | 담당 작업 |
|---|---|---|
| **W1** | 기반 구축 | DB 스키마 전체 마이그레이션 + RLS 정책 전체 적용 + Supabase Auth 설정 + 환경변수 세팅 + 온보딩 API (회원가입/동의) |
| **W2** | 가족 구조 + 카드 기본 | 가족 생성/초대/합류 API + 감정 카드 발송 API (AI 검토 없이 먼저) + 카드 inbox/sent API + RLS 통합 테스트 |
| **W3** | AI 톤 검토 + TTL | Claude Haiku 톤 검토 연동 + 위기 신호 감지 + pg_cron 잡 3개 설정 + 쿨링오프 회수 API |
| **W4** | 자녀 주도권 + 히스토리 | card_visibility PATCH API + Supabase Realtime 연동 + child_emotion_history API + 감정 히스토리 타임라인 |
| **W5** | 보안 강화 + 법적 준수 | 열 암호화 적용(pgcrypto) + 법정대리인 본인인증 연동 + 감사 로그 완성 + PIPA 데이터 최소화 검증 |
| **W6** | QA + 성능 | 부하 테스트 + RLS 침투 테스트 + TTL 검증 + 프론트팀 통합 테스트 지원 + 소프트 런칭 |

---

## 10. 보안 체크리스트

### 인증/인가
- [ ] 모든 API 엔드포인트 `assertFamilyMember()` 적용
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버사이드 전용 — 클라이언트 번들 포함 금지
- [ ] card_visibility 수정은 수신자(자녀) JWT 검증 이중 확인
- [ ] 쿨링오프 시간 서버 검증 (클라이언트 타이머 신뢰 금지)

### 데이터 보호
- [ ] `emotion_cards.content` AES-256 열 암호화
- [ ] `ai_reviews.original_text` 24시간 후 NULL 처리 pg_cron
- [ ] 카드 72시간 TTL pg_cron 배치 + 모니터링 알림
- [ ] `birth_year`만 저장, 전체 생년월일 저장 금지

### 미성년자 보호
- [ ] 만 14세 미만 `is_minor=true` 사용자 — `legal_guardian_confirmed=true` 없이 서비스 이용 차단
- [ ] 위기 신호(`risk_level='high'`) 감지 시 발송 차단 + 위기상담 링크 제공
- [ ] legal_consents 테이블 수정/삭제 불가 (INSERT only)
- [ ] 동의 철회 시 7일 내 데이터 물리 삭제 프로세스

### 감사/규정
- [ ] audit_logs 모든 카드 이벤트 기록 (생성/열람/삭제/공개 결정)
- [ ] DB 접근 로그 Supabase 로그 스트리밍 활성화
- [ ] 개인정보 처리방침 버전 관리 (`consent_version`)

---

## 11. 사장 결정 필요 항목

1. **법정대리인 본인인증 API 선택**: PASS(KCB/나이스) vs 통신사 3사 공동인증 — 비용 차이 약 2배. MVP는 이메일 + 체크박스 동의로 우선 진행하고 W5에 실 인증 추가 가능하나, 출시 전 반드시 실 인증 도입 필요.

2. **위기 신호 감지 후 처리 프로세스**: 감지 시 a) 발송 차단만 할지 b) 운영팀 알림을 줄지 c) 자동으로 위기상담 기관에 연계할지. 법적 신고 의무 범위와 연결되는 결정으로 법률 검토 선행 필요.

3. **열 암호화 범위**: `emotion_cards.content`만 암호화할지, `child_emotion_history.note`까지 포함할지. 성능 vs 프라이버시 트레이드오프.

4. **감정 히스토리 보존 기간**: 카드는 72시간 소실이지만 감정 태그 히스토리(`child_emotion_history`)는 얼마나 보존할지. 자녀의 자기 성찰 도구로서의 가치 vs 데이터 최소 보존 원칙.

---

> 본 문서는 Melt 서비스 백엔드 아키텍처 최종안이다.
> 다음 단계: @API설계자와 @DB설계자에게 이 문서 기반으로 W1 마이그레이션 파일과 API 스켈레톤 작성 지시.
