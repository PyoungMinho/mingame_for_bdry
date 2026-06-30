# 오름(Oreum) 점수 산식 명세서

> 작성: @DB설계자
> 배포 범위: 백엔드팀 전체 공개 / 프론트팀 결과 스펙만 공개
> 결정 원칙: 점수 산식은 LLM 미사용 — 결정론적 가중치 코드 (레드라인 §4)
> 공개 범위: 가중치 기본값 공개 / 보정 알고리즘(G항) 내부 보안

---

## 1. 4축 정의

| 축 | 키 | 설명 | 컬러 토큰 |
|---|---|---|---|
| 건강 | `health` | 신체 활동, 수면, 식습관 | `#2E9E55` |
| 학습 | `learning` | 독서, 공부, 스킬 습득 | `#2563EB` |
| 관계 | `relation` | 가족, 친구, 커뮤니티 교류 | `#C7307D` |
| 성취 | `achievement` | 업무, 목표, 생산성 결과 | `#EAB308` |

각 축: 사용자 슬라이더 입력 `0 ~ 100` (정수)

---

## 2. 기본 가중치 (공개)

```
W_health       = 0.25
W_learning     = 0.25
W_relation     = 0.25
W_achievement  = 0.25
합계           = 1.00  (필수 조건)
```

---

## 3. 사용자 커스텀 가중치

Pro 플랜 사용자는 가중치를 미세조정할 수 있다.
`users.weights` JSONB 컬럼에 저장.

**제약 조건 (서버 검증 필수)**:
- 각 가중치: `0.10 ≤ w ≤ 0.70`
- 4축 합산: `W_health + W_learning + W_relation + W_achievement = 1.00` (부동소수점 허용 오차 ±0.001)
- Free 플랜: 기본 가중치 고정 (커스텀 불가)

---

## 4. 점수 산식

### 4-1. 기본 total 계산

```
raw_total = (health × W_health)
          + (learning × W_learning)
          + (relation × W_relation)
          + (achievement × W_achievement)

total = ROUND(raw_total, 2)   -- 소수점 2자리
```

### 4-2. 변화량 (delta)

```
delta_from_yesterday = today.total - yesterday.total
```

- `yesterday` = `score_snapshot` 에서 `date = today - 1` 행
- 첫 날 체크인: `delta = NULL` (기준값 없음)
- 표시 형식: `+2.40` / `-1.20` / `--` (첫 날)

### 4-3. 재시작 보너스 (스트릭 끊김 시)

스트릭이 끊긴 후 첫 체크인에 한해 delta 계산 시 보너스 +5점을 delta 에 가산.
단, total 값 자체는 변경 없음 — delta 표시용 보정만 적용.

```
if (days_since_last_checkin > 1):
  display_delta = delta + 5.00   -- 표시 전용, score_snapshot.delta_from_yesterday 에는 미반영
```

---

## 5. G항 — 보정 알고리즘 (내부 비공개)

> 아래 항목은 핵심 IP 보호를 위해 구현 세부사항을 비공개로 한다.
> 백엔드팀 시니어 이상만 접근 가능.

**G항 존재 목적**: 단순 가중합의 한계 보완.
극단값(0점 또는 100점 연속) 및 입력 패턴 이상 탐지 적용.

공개 범위:
- G항이 적용됨을 사용자에게 공지 (신뢰성 확보)
- 보정 방향만 공개: "극단적 입력 시 완충 적용"
- 구체적 보정 계수·임계값·수식은 비공개

---

## 6. API 응답 스키마 (방향서 §3-4 인터페이스 합의)

```typescript
interface ScoreResponse {
  health:      number;   // 0~100, 소수점 2자리
  learning:    number;
  relation:    number;
  achievement: number;
  total:       number;   // 가중합 결과
  delta:       number | null;  // 전일 대비 (첫 날 null)
  ts:          string;   // ISO 8601
  version:     string;   // "v1"
}
```

---

## 7. 배치 잡 vs API Route 처리 경계

| 처리 주체 | 상황 | 비고 |
|---|---|---|
| `004_cron_jobs.sql` (JOB 2) | 매일 00:30 미처리 행 백필 | 균등 가중치 0.25 적용 |
| `POST /api/checkin` | 실시간 체크인 제출 | 사용자 커스텀 가중치 적용 |
| `POST /api/score/recalculate` | formula_version 업그레이드 시 | service_role, 배치 실행 |

**중복 방지**: 배치 잡은 `ON CONFLICT (user_id, date) DO NOTHING` — API Route 선처리 시 무시.

---

## 8. 버전 관리

| 버전 | 변경 내용 | 배포일 |
|---|---|---|
| `v1` | 초기 균등 가중치 + G항 기본 | W1 (2026-05) |
| `v2` (예정) | 사용자 행동 데이터 기반 가중치 추천 | W16+ |

formula_version 변경 시 기존 스냅샷은 유지, 신규 계산분부터 새 버전 적용.
과거 데이터 소급 재계산은 사장 승인 후 별도 마이그레이션 실행.

---

## 9. 백엔드팀 구현 체크리스트

- [ ] `POST /api/checkin` — input_jsonb 4축 범위 0~100 서버 검증
- [ ] weights 합산 = 1.00 ±0.001 서버 검증
- [ ] Free 플랜 가중치 커스텀 차단 (subscription.plan 확인)
- [ ] delta = null 처리 (score_snapshot WHERE date = today-1 없을 때)
- [ ] 재시작 보너스 (+5) — display 전용, DB 저장값과 분리
- [ ] formula_version 하드코딩 금지 — 환경 변수 `SCORE_FORMULA_VERSION=v1`
- [ ] G항 보정 로직 — 별도 내부 모듈 격리 (외부 노출 차단)
