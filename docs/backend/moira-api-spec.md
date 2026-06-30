# Moira API 설계서

> 버전: v1 | 작성: 2026-06-09 | 담당: @API설계자
>
> **무가입 중간지점 약속 플랫폼** — 호스트/게스트 모두 회원가입 없이 임시 토큰으로만 동작한다.

---

## 1. 엔드포인트 목록

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/moira/meetups` | 없음 | 약속 생성, hostToken 발급 |
| POST | `/api/moira/meetups/[id]/members` | inviteToken (query) | 게스트 출발지 제출 |
| GET | `/api/moira/meetups/[id]` | 없음 | 멤버 누적 상태 폴링 |
| POST | `/api/moira/meetups/[id]/compute` | hostToken (header) | 중간역+장소 공평성 계산 |
| GET | `/api/moira/meetups/[id]/result` | 없음 | 추천역·후보 5·멤버별 이동시간 |
| POST | `/api/moira/meetups/[id]/votes` | voterToken (header) | 무가입 투표 (1인 1표 멱등) |
| GET | `/api/moira/meetups/[id]/votes` | 없음 | 투표 집계 폴링 |
| POST | `/api/moira/meetups/[id]/confirm` | hostToken (header) | 약속 확정 (호스트 전용) |
| GET | `/api/moira/meetups/[id]/share` | 없음 | OG 카드 메타 (바이럴 공유) |

모든 경로 접두사: `/api/moira/` — 타 제품(`/api/exam/`, `api/db/`) 네임스페이스와 완전 분리.

---

## 2. 공통 규칙

### 2-1. 응답 봉투

**성공**
```jsonc
{
  "success": true,
  "data": { /* 엔드포인트별 페이로드 */ },
  "meta": { /* 선택: version, pollingIntervalMs 등 */ }
}
```

**실패**
```jsonc
{
  "success": false,
  "error": {
    "code": "E_INVALID_TOKEN",   // 기계가 읽는 코드 (아래 표 참조)
    "message": "유효하지 않은 토큰입니다."  // 사람이 읽는 한국어
  }
}
```

### 2-2. Moira 에러 코드 표

| code | HTTP | 설명 |
|------|------|------|
| `E_VALIDATION` | 400 | Zod 파싱 실패 — fieldErrors 포함 |
| `E_BAD_JSON` | 400 | JSON 파싱 불가 |
| `E_INVALID_TOKEN` | 401 | 토큰 없음·서명 불일치·만료 |
| `E_NOT_HOST` | 403 | hostToken 필요 엔드포인트에 voterToken 사용 |
| `E_MEETUP_NOT_FOUND` | 404 | meetupId 없음 또는 TTL 만료 후 삭제됨 |
| `E_MEETUP_EXPIRED` | 410 | TTL 만료 (삭제 전 상태 알림) |
| `E_ALREADY_COMPUTED` | 409 | compute를 이미 실행했고 result가 있음 |
| `E_NOT_READY` | 409 | compute 전에 result를 요청 |
| `E_ALREADY_VOTED` | 409 | 동일 voterToken이 동일 후보에 이미 투표 (변경은 허용) |
| `E_ALREADY_CONFIRMED` | 409 | 이미 확정된 약속에 재확정 시도 |
| `E_RATE_LIMIT` | 429 | IP/토큰별 레이트리밋 초과 |
| `E_EXTERNAL` | 502 | ODsay/카카오 외부 API 장애 |
| `E_DEMO_MODE` | 200 | (에러 아님) — demo 모드임을 meta에 표기 |

### 2-3. HTTP 상태 코드 정책

- `200 OK` — 조회, 멱등 POST 성공
- `201 Created` — 새 리소스 생성 성공 (meetups, members)
- `202 Accepted` — compute 비동기 트리거 (즉시 반환, 계산은 백그라운드)
- `400 Bad Request` — 입력 오류
- `401 Unauthorized` — 토큰 누락/무효
- `403 Forbidden` — 권한 부족
- `404 Not Found` — 리소스 없음
- `409 Conflict` — 상태 충돌
- `410 Gone` — TTL 만료
- `429 Too Many Requests` — 레이트리밋 + `Retry-After` 헤더
- `502 Bad Gateway` — 외부 API 실패

### 2-4. 페이지네이션

현재 버전에서 목록 응답이 없으므로 페이지네이션 미적용. 향후 필요 시 cursor 기반으로 추가.

### 2-5. 레이트리밋 정책

| 엔드포인트 | 기준 | 분당 | 일일 |
|------------|------|------|------|
| POST `/meetups` | IP | 10 | 50 |
| POST `/members` | IP | 20 | 100 |
| POST `/compute` | hostToken | 3 | 10 |
| POST `/votes` | voterToken | 10 | 50 |
| POST `/confirm` | hostToken | 5 | 20 |
| GET 전체 | IP | 60 | - |

compute는 ODsay N×K 호출 비용이 크므로 가장 엄격하게 제한.
기존 `src/lib/server/rate-limit.ts` (in-memory) 재사용. 운영 스케일 시 Upstash Redis로 교체.

---

## 3. 무가입 토큰 인증 흐름

### 3-1. 토큰 종류 및 역할

```
hostToken   — 약속 생성자 전용. compute/confirm 권한.
              발급: POST /meetups 응답.
              운반: Authorization: Bearer <hostToken> 헤더.
              만료: 72시간 (TTL과 동일).

inviteToken — 게스트가 출발지를 제출하기 위한 1회용 링크 토큰.
              발급: POST /meetups 응답 내 inviteUrl에 포함.
              운반: ?t=<inviteToken> 쿼리 파라미터 (카톡 링크 공유 시 URL에 노출).
              만료: 48시간.
              주의: 링크 공유 특성상 URL 노출이 불가피 → 짧은 만료 + 1회 사용 후 voterToken 발급.

voterToken  — 게스트가 투표/확인에 쓰는 지속 토큰.
              발급: POST /members 성공 응답.
              운반: Authorization: Bearer <voterToken> 헤더 또는 localStorage.
              만료: 72시간.
```

### 3-2. 토큰 구조 (HMAC-SHA256 서명, JWT-like 비공개 포맷)

```
<base64url(payload)>.<base64url(HMAC-SHA256(base64url(payload), MOIRA_TOKEN_SECRET))>

payload = {
  sub:  "host" | "invite" | "voter",  // 토큰 종류
  mid:  string,                         // meetupId
  uid:  string,                         // uuid v4 (랜덤, 추측 불가)
  iat:  number,                         // 발급 Unix timestamp (초)
  exp:  number,                         // 만료 Unix timestamp (초)
}
```

엔트로피: uid는 `crypto.randomUUID()` (128비트). 별도 JWT 라이브러리 불필요, 표준 `crypto` 모듈로 직접 구현.

### 3-3. 토큰 검증 공통 흐름

```
1. 헤더/쿼리에서 토큰 추출
2. base64url 디코드 → payload + sig 분리
3. payload 재서명 → sig 일치 여부 (timing-safe 비교)
4. exp > Date.now()/1000 확인
5. sub 타입 확인 (호스트 전용 엔드포인트는 sub==="host" 체크)
6. mid === 요청 경로의 [id] 확인 → 타 약속의 토큰 재사용 차단
```

---

## 4. 폴링 설계

웹소켓 미사용. 클라이언트가 일정 간격으로 GET 요청.

### 4-1. version 필드 기반 변경 감지

모든 폴링 응답에 `meta.version` (정수, 변경 시 증가) 포함.
클라이언트는 이전 version과 비교하여 렌더 갱신 여부 결정 → 불필요한 리렌더 방지.

```jsonc
// GET /meetups/[id] 응답
{
  "success": true,
  "data": { "members": [...] },
  "meta": {
    "version": 3,
    "pollingIntervalMs": 3000,
    "memberCount": 4,
    "readyCount": 2
  }
}
```

### 4-2. 권장 폴링 간격

| 화면 | 폴링 대상 | 간격 |
|------|----------|------|
| /moira (생성) | GET `/meetups/[id]` | 3초 |
| /moira/vote (투표) | GET `/meetups/[id]/votes` | 4초 |

투표 화면은 실시간성이 덜 중요하므로 약간 늦춤.

### 4-3. Redis ↔ Postgres 역할 분담

```
Redis (Upstash):
  - 투표 카운터: HINCRBY moira:votes:{meetupId} {placeId} 1
  - 투표자 기록: SET moira:voted:{meetupId}:{voterToken_uid} {placeId} EX 259200
  - meetup version 카운터: INCR moira:ver:{meetupId}
  - TTL 만료 시 자동 삭제 (Redis TTL = meetup TTL)

Postgres:
  - 영구 저장소 (meetup, member, place, vote, appointment 테이블)
  - compute 완료 후 결과 저장
  - confirm 시 약속 확정 기록
  - Redis 장애 시 fallback 집계 소스

동기화:
  - 투표 시: Redis 먼저 업데이트 → 응답 반환 → 비동기로 Postgres upsert
  - confirm 시: Postgres에 최종 투표 집계 기록 (Redis 카운터 → DB)
```

---

## 5. 데모 모드

ODSAY_API_KEY 또는 KAKAO_REST_KEY 환경변수가 없으면 **demo 모드**로 동작 (문제팩토리 철학 동일).

```typescript
function detectMoiraMode(): "live" | "demo" {
  const hasOdsay = !!process.env.ODSAY_API_KEY;
  const hasKakao = !!process.env.KAKAO_REST_KEY;
  return hasOdsay && hasKakao ? "live" : "demo";
}
```

| 엔드포인트 | 데모 동작 |
|------------|----------|
| POST `/meetups` | 정상 생성 (토큰 발급, DB 저장) |
| POST `/members` | 주소→좌표 변환 skip, (0, 0) 저장 |
| POST `/compute` | `src/lib/moira/mock.ts` 의 PLACES/RECOMMENDED_STATION 반환 |
| GET `/result` | mock 데이터 반환 (공평성 점수 계산은 실제 로직 실행) |
| 나머지 | 실제 로직 동일 |

모든 demo 모드 응답에 `"meta": { "mode": "demo" }` 포함.

---

## 6. 엔드포인트 상세 스펙

### 6-1. POST `/api/moira/meetups` — 약속 생성

**인증**: 없음

**Request Body (Zod)**
```typescript
const CreateMeetupSchema = z.object({
  hostName:   z.string().min(1).max(20),
  hostOrigin: z.string().min(2).max(100), // 주소 문자열
  ttlHours:   z.coerce.number().int().min(1).max(72).optional().default(48),
});
```

**Response 201**
```typescript
type CreateMeetupResponse = {
  success: true;
  data: {
    meetupId:  string;         // nanoid(10), URL-safe
    hostToken: string;         // "host" 토큰 (72시간)
    inviteUrl: string;         // https://moira.app/j/{meetupId}?t={inviteToken}
    inviteToken: string;       // 프론트가 직접 카톡 딥링크 조합용
  };
  meta: { mode: "live" | "demo" };
};
```

**처리 흐름**
1. Zod 검증
2. meetupId = nanoid(10)
3. demo: 좌표 변환 skip / live: 카카오 로컬 API → hostLat, hostLng 변환
4. DB INSERT meetups + members (hostToken uid → members.invite_token_uid)
5. Redis: `SET moira:ver:{meetupId} 0 EX {ttlSec}`
6. hostToken + inviteToken 서명 → 응답

**에러 케이스**
- 400 E_VALIDATION — 필드 오류
- 429 E_RATE_LIMIT — IP 10회/분 초과

---

### 6-2. POST `/api/moira/meetups/[id]/members` — 게스트 출발지 제출

**인증**: inviteToken — `?t=<inviteToken>` 쿼리 파라미터

**Request Body (Zod)**
```typescript
const AddMemberSchema = z.object({
  name:   z.string().min(1).max(20),
  origin: z.string().min(2).max(100),
});
```

**Response 201**
```typescript
type AddMemberResponse = {
  success: true;
  data: {
    memberId:   string;
    voterToken: string;  // "voter" 토큰 (72시간) — 투표에 사용
  };
  meta: { mode: "live" | "demo" };
};
```

**처리 흐름**
1. inviteToken 검증 (sub==="invite", mid===id, exp 체크)
2. 카카오 로컬 API → lat/lng 변환 (demo: skip)
3. DB INSERT members (lat/lng, name, origin — origin 원문 보존)
4. Redis: INCR `moira:ver:{id}`
5. voterToken 발급 → 응답
6. inviteToken은 재사용 가능 (여러 게스트가 같은 링크 사용 — uid로 중복 방지 불필요, 게스트마다 새 voterToken 발급)

**에러 케이스**
- 401 E_INVALID_TOKEN — inviteToken 누락/만료/서명 불일치
- 404 E_MEETUP_NOT_FOUND
- 410 E_MEETUP_EXPIRED

---

### 6-3. GET `/api/moira/meetups/[id]` — 멤버 상태 폴링

**인증**: 없음 (공개)

**Query Params**
```typescript
const PollSchema = z.object({
  since: z.coerce.number().int().optional(), // 마지막 version (없으면 무조건 반환)
});
```

**Response 200**
```typescript
type MeetupStatusResponse = {
  success: true;
  data: {
    meetupId: string;
    members:  Array<{
      id:     string;
      name:   string;
      avatar: string;    // hex color (결정적 해시, 이름 기반)
      status: "host" | "done" | "waiting";
      // origin, lat, lng 는 반환하지 않음 (PII 최소화)
    }>;
    computed: boolean;   // compute 완료 여부
    confirmed: boolean;
  };
  meta: {
    version:          number;
    pollingIntervalMs: 3000;
    memberCount:       number;
    readyCount:        number;  // status !== "waiting" 수
    mode:              "live" | "demo";
  };
};
```

`since` 파라미터와 현재 version이 같으면 `data.members` 없이 version만 반환 (대역폭 절약).

---

### 6-4. POST `/api/moira/meetups/[id]/compute` — 중간역+장소 계산

**인증**: `Authorization: Bearer <hostToken>` (sub==="host")

**Request Body**: 없음 (멤버 데이터는 서버가 DB에서 읽음)

**Response 202** (비동기 수락)
```typescript
type ComputeResponse = {
  success: true;
  data: { status: "computing" };
  meta: { mode: "live" | "demo"; estimatedSec: number };
};
```

**처리 흐름 (백그라운드)**
```
1. DB에서 모든 member lat/lng 수집
2. OSRM → 반경 내 후보 지하철역 K개 프리필터 (0원, self-host)
3. demo: mock.ts 결과 반환 / live:
   a. ODsay 대중교통 시간행렬 N(멤버) × K(역) 호출
   b. 각 후보역 공평성 점수 = α·avg + β·max + γ·stddev
      (기본 가중치: α=0.4, β=0.4, γ=0.2 — 환경변수 MOIRA_SCORE_ALPHA 등으로 조정)
   c. 상위 1개 역 선정 → 카카오 로컬로 근처 장소 5개 검색
   d. 각 장소별 MemberTime 배열 구성
4. DB에 result 저장 (meetups.computed_at, places 테이블 upsert)
5. Redis INCR version
```

**에러 케이스**
- 401 E_INVALID_TOKEN
- 403 E_NOT_HOST
- 409 E_ALREADY_COMPUTED
- 409 E_NOT_READY (멤버 1명 이하)
- 502 E_EXTERNAL (ODsay/카카오 장애)

**레이트리밋**: hostToken 기준 3회/분 (ODsay 비용 보호)

---

### 6-5. GET `/api/moira/meetups/[id]/result` — 결과 조회

**인증**: 없음

**Response 200**
```typescript
type ResultResponse = {
  success: true;
  data: {
    recommendedStation: {
      name:   string;
      lines:  string[];  // ["2", "3"]
      reason: string;
    };
    places: Array<{
      id:       string;
      name:     string;
      category: string;
      walkMin:  number;
      blurb:    string;
      times:    Array<{ name: string; minutes: number; transfers?: number }>;
      fairGap:  number;    // max - min
      fairAvg:  number;    // 평균
      fairScore: number;   // α·avg + β·max + γ·stddev (낮을수록 공평)
      fairLevel: "good" | "mid" | "bad";
      votes:    number;    // 현재 득표 (Redis 캐시 우선)
    }>;
  };
  meta: { mode: "live" | "demo"; version: number };
};
```

**에러 케이스**
- 404 E_MEETUP_NOT_FOUND
- 409 E_NOT_READY (compute 미완료)

---

### 6-6. POST `/api/moira/meetups/[id]/votes` — 투표

**인증**: `Authorization: Bearer <voterToken>` (sub==="voter")

**Request Body (Zod)**
```typescript
const VoteSchema = z.object({
  placeId: z.string().min(1).max(50),
});
```

**멱등성 규칙**
- 같은 voterToken + 같은 placeId → `200 OK` (중복 무시, 에러 아님)
- 같은 voterToken + 다른 placeId → 기존 표 취소 후 새 표 등록 (표 변경 허용)
- 표 변경은 confirm 전까지만 가능

**Response 200**
```typescript
type VoteResponse = {
  success: true;
  data: {
    placeId:   string;
    changed:   boolean;   // 기존 표를 변경했으면 true
    idempotent: boolean;  // 완전히 동일한 요청이면 true
  };
};
```

**처리 흐름**
1. voterToken 검증 (sub==="voter", mid===id)
2. Redis GET `moira:voted:{id}:{uid}` → 이전 표 확인
3. 이전 표와 동일: 200 idempotent=true 반환
4. 이전 표 있고 다른 placeId: Redis HINCRBY -1 (이전) / +1 (새)
5. 이전 표 없음: Redis HINCRBY +1
6. Redis SET `moira:voted:{id}:{uid}` placeId EX TTL
7. Postgres: 비동기 upsert (votes 테이블)
8. Redis INCR version

**에러 케이스**
- 401 E_INVALID_TOKEN
- 404 E_MEETUP_NOT_FOUND / placeId 없음
- 409 E_ALREADY_CONFIRMED (confirm 후 투표 시도)

---

### 6-7. GET `/api/moira/meetups/[id]/votes` — 투표 집계 폴링

**인증**: 없음

**Response 200**
```typescript
type VotesResponse = {
  success: true;
  data: {
    total:     number;  // 투표 참여 인원
    memberCount: number;
    tally:     Record<string, number>;  // { placeId: voteCount }
    confirmed: boolean;
    winner:    string | null;  // confirmed=true 시 placeId
  };
  meta: { version: number; pollingIntervalMs: 4000 };
};
```

집계는 Redis HGETALL `moira:votes:{id}` 우선, Redis 키 없으면 Postgres fallback.

---

### 6-8. POST `/api/moira/meetups/[id]/confirm` — 약속 확정

**인증**: `Authorization: Bearer <hostToken>` (sub==="host")

**Request Body (Zod)**
```typescript
const ConfirmSchema = z.object({
  placeId: z.string().min(1).max(50),
  date:    z.string().min(1).max(30),  // "6월 14일 (토)" — 자유 형식 문자열
  time:    z.string().min(1).max(20),  // "오후 7:00"
});
```

**Response 200**
```typescript
type ConfirmResponse = {
  success: true;
  data: {
    appointment: {
      placeId:  string;
      name:     string;
      address:  string;
      date:     string;
      time:     string;
    };
    shareUrl: string;  // OG 카드 URL (GET /share)
  };
};
```

**처리 흐름**
1. hostToken 검증
2. placeId 유효성 확인 (result에 포함된 후보 중 하나)
3. DB UPDATE meetups SET confirmed=true, confirmed_place_id, appointment_date, appointment_time
4. Redis INCR version + SET `moira:confirmed:{id}` placeId EX TTL
5. OG 메타 캐시 워밍 (선택)

**에러 케이스**
- 401 E_INVALID_TOKEN
- 403 E_NOT_HOST
- 409 E_ALREADY_CONFIRMED
- 404 placeId 없음

---

### 6-9. GET `/api/moira/meetups/[id]/share` — OG 카드 메타

**인증**: 없음

**Response 200**
```typescript
type ShareResponse = {
  success: true;
  data: {
    og: {
      title:       string;  // "민호님의 모임 · 을지로3가 근처"
      description: string;  // "6월 14일 오후 7:00 · 을지로 노가리골목"
      image:       string;  // OG 이미지 URL (서버 생성 또는 정적)
      url:         string;
    };
    confirmed:  boolean;
    memberCount: number;
  };
};
```

카톡 링크 미리보기 (OG 메타)용. Next.js `generateMetadata`와 연동 가능.

---

## 7. PII 최소화 정책

| 데이터 | 저장 정책 |
|--------|----------|
| 출발지 원문 (`origin`) | DB 저장 (사용자가 제출한 주소 문자열) — 약속 TTL 만료 시 삭제 |
| 좌표 (`lat`, `lng`) | DB 저장 — compute 완료 후 원문과 함께 TTL 만료 시 삭제 |
| 이름 (`name`) | DB 저장 — TTL 만료 시 삭제 |
| 토큰 서명 비밀 | 서버 환경변수만 (`MOIRA_TOKEN_SECRET`) — DB 미저장 |

**TTL**: meetup 생성 시 `ttlHours` (기본 48시간). 만료 시 meetups + members + places + votes 일괄 삭제 (Postgres scheduled job 또는 Supabase `pg_cron`).

API 응답에서 `lat`, `lng`, 타 멤버의 `origin`은 절대 반환하지 않음.

---

## 8. 데이터 형태 계약 (DB설계자와 공유)

DB설계자는 아래 계약에 맞춰 스키마 설계:

```typescript
// meetups 테이블 핵심 컬럼
interface MeetupRow {
  id:                   string;   // nanoid(10), PK
  host_token_uid:       string;   // hostToken payload.uid
  invite_token_uid:     string;   // inviteToken payload.uid (재사용 가능)
  ttl_expires_at:       Date;
  computed_at:          Date | null;
  confirmed:            boolean;
  confirmed_place_id:   string | null;
  appointment_date:     string | null;
  appointment_time:     string | null;
  created_at:           Date;
}

// members 테이블 핵심 컬럼
interface MemberRow {
  id:               string;   // uuid
  meetup_id:        string;   // FK → meetups.id
  voter_token_uid:  string;   // voterToken payload.uid
  name:             string;
  origin:           string;   // 원문 주소 (PII)
  lat:              number | null;
  lng:              number | null;
  is_host:          boolean;
  created_at:       Date;
}

// places 테이블 핵심 컬럼
interface PlaceRow {
  id:         string;
  meetup_id:  string;
  name:       string;
  category:   string;
  walk_min:   number;
  blurb:      string;
  fair_gap:   number;
  fair_avg:   number;
  fair_score: number;
  fair_level: "good" | "mid" | "bad";
}

// member_times 테이블
interface MemberTimeRow {
  place_id:   string;
  member_id:  string;
  minutes:    number;
  transfers:  number | null;
}

// votes 테이블
interface VoteRow {
  meetup_id:       string;
  voter_token_uid: string;
  place_id:        string;
  voted_at:        Date;
}
```

---

## 9. 환경변수 (.env)

```bash
# --- Database ---
DATABASE_URL=postgresql://user:pass@host:5432/moira

# --- Redis (Upstash) ---
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# --- 외부 API (없으면 demo 모드) ---
ODSAY_API_KEY=          # ODsay 대중교통 API
KAKAO_REST_KEY=         # 카카오 로컬/맵 REST API

# --- OSRM (self-host) ---
OSRM_URL=http://localhost:5000   # 후보역 프리필터 (0원)

# --- Moira 전용 ---
MOIRA_TOKEN_SECRET=<최소 32바이트 랜덤 문자열>
MOIRA_SCORE_ALPHA=0.4    # 평균 가중치
MOIRA_SCORE_BETA=0.4     # 최대값 가중치
MOIRA_SCORE_GAMMA=0.2    # 표준편차 가중치
MOIRA_DEFAULT_TTL_HOURS=48

# --- 레이트리밋 조정 (선택) ---
MOIRA_RL_CREATE_PER_MIN=10
MOIRA_RL_COMPUTE_PER_MIN=3

# --- Next.js ---
NEXT_PUBLIC_MOIRA_BASE_URL=https://moira.app
```

---

## 10. 파일 구조

```
src/app/api/moira/
├── meetups/
│   └── route.ts                  # POST /meetups
│   └── [id]/
│       ├── route.ts              # GET /meetups/[id]
│       ├── members/
│       │   └── route.ts          # POST /members
│       ├── compute/
│       │   └── route.ts          # POST /compute
│       ├── result/
│       │   └── route.ts          # GET /result
│       ├── votes/
│       │   └── route.ts          # GET + POST /votes
│       ├── confirm/
│       │   └── route.ts          # POST /confirm
│       └── share/
│           └── route.ts          # GET /share

src/lib/moira/
├── mock.ts                       # 데모 픽스처 (기존, 수정 금지)
├── fairness.ts                   # 공평성 로직 (기존, 수정 금지)
├── token.ts                      # 토큰 발급/검증 유틸
├── compute.ts                    # 공평성 계산 + 외부 API 호출
└── redis.ts                      # Redis 헬퍼 (투표 카운터)

docs/backend/
└── moira-api-spec.md             # 이 문서
```
