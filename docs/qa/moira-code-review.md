# 모이라(Moira) 백엔드 — 코드 리뷰 (QA 관점)

> 리뷰어: @QA설계자 (Opus) | 2026-06-09 | 단계: 백엔드 스텁(demo 동작)
> 범위: `src/lib/moira/{token,fairness,mock}.ts`, `src/app/api/moira/meetups/route.ts`,
> `src/app/api/moira/meetups/[id]/result/route.ts`. 명세 대비 검증: `moira-backend-final.md` 외.
> 심각도: **Blocker**(머지 차단) / **Major**(MVP 전 수정 권장) / **Minor**(백로그).

---

## 0. 총평

스텁 단계 코드는 **무가입·공평성·demo우선** 원칙을 충실히 구현했고, 토큰 모듈은
서명→파싱→만료→meetup→sub 순서가 보안적으로 올바르며 `timingSafeEqual`을 정확히 쓴다.
**현 단계에 한해 Blocker는 없다**(코드 결함 기준). 다만 팀장이 §10에서 이미 플래그한
미연결·미구현 항목은 **MVP 진입 전 Blocker로 승격**되며, 코드 자체에도 Major 2건·Minor 다수가 있다.
가장 큰 리스크는 **(a) issueToken의 exp 클램프 부재로 인한 토큰>데이터 수명 역전**과
**(b) detectMode/calcScore 로직이 두 라우트에 복제되어 demo/live 분기 드리프트 가능성**이다.

---

## 1. Blocker (머지/릴리즈 차단)

> **코드 결함 기준 Blocker: 0건.** 아래는 "MVP 풀플로우 진입 시" Blocker로 승격되는 미구현(팀장 §10 P0 재확인).

| ID | 항목 | 위치 | QA 관점 사유 | 승격 시점 |
|---|---|---|---|---|
| B-1 | DB/Redis/외부 클라이언트 미연결 | route.ts 126~130행 주석 TODO | 토큰을 발급하지만 `hashToken` 저장·1인1표·폴링·만료가 전무. **무가입 모델의 핵심(해시 대조)이 런타임에 존재하지 않음.** demo 응답만 반환되므로 영속 플로우(생성→투표→확정) 통합테스트 불가. | DB 연결 P0 |
| B-2 | meetups.id `UUID`→`TEXT` 전환 미반영 | `api/db/moira/migrations/001` (오름 아님, 모이라 소유) | API가 `nanoid(10)` 문자열 PK를 발급하는데 DDL은 `UUID PK`. 연결 즉시 **INSERT 타입 불일치로 전면 실패**. 팀장 §2.5/§10-P0 확정 사항이 코드/DDL에 미적용. | DB 연결 전 필수 |
| B-3 | 003 RLS / 004 cron 마이그레이션 부재 | `api/db/moira/migrations/` | service_role-only RLS 없으면 anon key 유출 시 무차별 접근(§7.2 방어선 공백). cron 없으면 PII 영구 잔존(PIPA 위반 소지). | live/운영 전 필수 |

> 위 3건은 **현재 코드 결함이 아니라 "다음 단계 게이트"** 이므로 본 단계 머지는 막지 않되,
> `moira-test-design.md` §3-3·§4 게이트에 "미연결 영역은 범위 밖"으로 명시했다.

---

## 2. Major (MVP 전 수정 권장)

### M-1. `issueToken` exp 클램프 부재 — 토큰이 데이터보다 오래 산다
**위치**: `src/lib/moira/token.ts:61-76`, `meetups/route.ts:109,119-120`
**현상**: `issueToken`은 고정 TTL(host/voter 72h, invite 48h)만 쓰고, 호출부(route.ts)는
사용자 입력 `ttlHours`(기본 48, 최소 1)를 **토큰 발급에 전혀 전달하지 않는다.**
사용자가 `ttlHours:1`로 약속을 만들어도 hostToken은 72h 유효.
**영향(QA 관점)**:
- 약속 데이터(미래 TTL 1h)는 만료됐는데 hostToken(72h)이 살아있어 → 연결 후 `404 E_MEETUP_NOT_FOUND` / `410` 유발. "유효한 토큰인데 약속이 없다"는 혼란.
- 팀장 §2.3이 `exp = min(now+토큰TTL, meetup.expires_at)` **클램프를 표준으로 확정**했으나 미구현.
**권장**: `issueToken(sub, meetupId, now?, meetupExpiresAtSec?)` 시그니처 확장 →
`exp = Math.min(now + TTL[sub], meetupExpiresAtSec ?? Infinity)`. route.ts에서 `now + ttlHours*3600` 전달.
**테스트 가드**: 현재는 클램프가 없으므로 "host exp-iat===72h"가 통과(TK-01). 구현 후 이 단언을
**클램프 케이스로 교체**해야 함 → 코드리뷰-테스트 연동 항목으로 @QA실행자에 인계.

### M-2. `detectMode`·점수 로직 복제 — demo/live 분기 드리프트
**위치**: `meetups/route.ts:21-23` 와 `result/route.ts:22-24`에 `detectMode()` **각각 정의**.
`stddev`/`calcScore`도 `result/route.ts`에만 존재(향후 compute.ts·DB 집계와 3중 중복 예정).
**영향**: 팀장 §6-1은 "단일 함수 `detectMoiraMode()`"를, §4-2는 "앱·DB **동일 공식**"을 요구.
복제본은 한쪽만 수정될 때 **두 모드 응답이 미묘히 갈라지는** 회귀의 온상(스키마 동일성 §6-3 위반 위험).
특히 `result`의 모표준편차(`/arr.length`)와 미래 Postgres `STDDEV_POP`가 어긋나면 정렬 순위가 바뀐다.
**권장**: `src/lib/moira/mode.ts`(detectMode 1곳) + `fairness.ts`에 `scoreOf(minutes, weights)` 단일 구현
추가하고 route는 그것만 호출. DB 집계는 `STDDEV_POP`로 못박아 동일 공식 보장.
**테스트 가드**: RS-09/RS-10(공식·가중치), §3-3 INV-9(모드 스키마 동일)로 드리프트 감지.

---

## 3. Minor (백로그)

### m-1. `nanoid10` 모듈로 편향 (균일성 결함)
**위치**: `meetups/route.ts:65-70`. `b % 62` 사용 → `256 % 62 = 8`이라 알파벳 앞 8글자(`A~H`)가
**5/256, 나머지 54글자는 4/256** 확률(검증 완료). 약 25% 더 자주 등장.
**영향**: 보안상 치명적이진 않으나(여전히 ~59.5비트 엔트로피) URL ID 분포가 비균일.
충돌 확률 미세 증가, 통계적 식별 가능성 이론적 상승.
**권장**: rejection sampling(`if (b < 256 - (256%62)) ...`) 또는 표준 `nanoid` 패키지 사용.
**테스트**: TKP(속성)로 "10자·영숫자" 형식은 보장하되 편향은 코드리뷰 항목으로만 추적(P2).

### m-2. `result/route.ts` `calcScore`의 빈 배열·NaN 미방어
**위치**: `result/route.ts:33-38`. `Math.max(...minutes)`는 `minutes=[]`면 `-Infinity`,
`avg`는 `0/0=NaN` → `fairScore=NaN`. 정렬(`a-b`)에서 NaN은 순서 불안정.
**영향**: demo 데이터는 항상 4명이라 현재 안전하나, **live·멤버 0~1명 compute 결과**가 들어오면 깨짐.
`fairness.ts`의 `gapOf/avgOf`는 빈 배열을 0으로 방어하는데 route의 `calcScore`는 **방어 없음**(비대칭).
**권장**: `calcScore`도 `minutes.length===0 → 0` 가드 추가. fairness.ts에 `scoreOf` 통합 시 자연 해결(M-2 연동).

### m-3. `avgOf`(반올림) vs `calcScore` 내부 mean(비반올림) 불일치
**위치**: `fairness.ts:20-23`(round) vs `result/route.ts:34`(`reduce/length`, 비반올림).
응답의 `fairAvg`(반올림 정수)와 `fairScore` 계산에 쓰인 평균(소수)이 **서로 다른 값**.
**영향**: 의도된 설계일 수 있으나(표시는 정수, 점수는 정밀) 문서에 명시 안 됨 → 검증자 혼란.
DB 집계가 어느 쪽을 쓰느냐에 따라 `fair_avg`/`fair_score` 정합이 갈림.
**권장**: 정본 문서에 "`fairAvg`=표시용 반올림, `fairScore`=정밀 평균 사용" 1줄 명문화. RS-05/RS-09로 양쪽 고정.

### m-4. `result/route.ts` 빈/임의 `params.id` 무검증 통과
**위치**: `result/route.ts:44`. 현재 DB 미조회라 `id=""`·존재하지 않는 id도 demo면 `200` 반환.
**영향**: 연결 후 `404 E_MEETUP_NOT_FOUND`로 바뀌어야 정상(§2.2 에러표). 지금은 **존재하지 않는 약속도 mock 결과를 준다** → 클라가 "있는 줄" 착각.
**권장**: DB 연결 시 `findById→없으면 404` 분기 필수. 현 단계는 RS-15로 "현 동작" 회귀가드만.

### m-5. `MOIRA_SCORE_*` env가 모듈 로드시 1회 평가 — 런타임 변경 무반영
**위치**: `result/route.ts:18-20` 모듈 최상위 `const`. 서버 기동 후 env 바꿔도 미반영.
**영향**: 운영 중 가중치 튜닝 불가(재배포 필요). 테스트에서도 `vi.resetModules()` 없이는 env 토글 무효.
**권장**: 함수 내부에서 `Number(process.env...)` 읽거나, 의도라면 문서화. 테스트는 RS-10에서 resetModules 강제(설계서 명시).

### m-6. `geocode` 실패 silent null — live 모드 부분 실패 가시성 부족
**위치**: `meetups/route.ts:48-62`. 카카오 API 실패/타임아웃 시 `null` 반환 후 **그대로 진행**(좌표 없이 약속 생성).
**영향**: live인데 좌표가 비어 compute가 무의미해질 수 있음. §6-3은 502→`degraded:true` 표기를 요구하나 미반영.
**권장**: live에서 geocode 실패 시 `meta.degraded:true` 또는 명시적 502. fetch 타임아웃(AbortController) 추가.

### m-7. 토큰 SECRET 폴백이 dev-secret으로 **조용히** 동작(비프로덕션)
**위치**: `token.ts:24-33`. `MOIRA_TOKEN_SECRET` 없으면 프로덕션만 `console.error`, 그 외엔 경고 없이 고정 dev secret 사용.
**영향**: 스테이징/프리뷰가 NODE_ENV!=="production"이면 **모두가 아는 고정 키로 서명** → 토큰 위조 가능. demo 안전성 의존이 환경 설정에 좌우.
**권장**: 최소한 `NODE_ENV!=="test"`에서 미설정 시 1회 경고. 또는 부팅 시 키 길이(≥32) 검증. (테스트는 dev secret 사용이 정상 — 격리 OK.)

### m-8. `verifyToken`이 `JSON.parse` 결과를 `as TokenPayload`로 **타입 단언만** (런타임 형태 미검증)
**위치**: `token.ts:107`. 서명이 유효하면 우리가 발급한 것이라 신뢰 가능하나, payload에 `exp`/`mid`/`sub`가
누락된 경우(미래 포맷 변경·키 재사용) `undefined` 비교가 조용히 통과/오작동할 수 있음.
**영향**: 현재는 우리가 발급한 토큰만 서명 통과하므로 실질 위험 낮음(Minor). 다만 `exp` 누락 시 `undefined < now`=false→만료 안 됨.
**권장**: 파싱 후 `typeof payload.exp==="number" && typeof payload.mid==="string" && payload.sub` 가드. 방어적 코딩.

---

## 4. 명세 대비 누락·불일치 점검 (구현 vs `moira-backend-final.md`)

| 명세 항목 | 정본 요구 | 현 구현 | 판정 |
|---|---|---|---|
| 응답 봉투 `{success,data,meta}` | §3 고정 | meetups·result 모두 준수 | ✅ |
| demo `meta.mode` 표기 | §6-1 | meetups: `meta.mode` 동적, result: `"demo"` 하드코딩 | ⚠️ result는 하드코딩(live 분기 따로) — 동작상 OK, M-2 드리프트 주의 |
| 에러코드 `E_VALIDATION/E_BAD_JSON` | §2.2 | meetups 준수(`fieldErrors` 포함) | ✅ |
| `E_RATE_LIMIT` + `Retry-After` | §8.3 | 구현됨(test에서 skip) | ✅ |
| hashToken=SHA-256(raw 전체) | §2.2 | 정확히 구현(uid 아닌 raw) | ✅ 우수 |
| 검증 순서 서명→해시 | §2.2-3 | verifyToken 내부 서명 최우선 | ✅ |
| exp 클램프(≤meetup TTL) | §2.3 확정 | **미구현** | ❌ M-1 |
| meetupId TEXT PK | §2.5 확정 | API는 TEXT, DDL은 UUID | ❌ B-2 |
| 투표 ON CONFLICT DO UPDATE | §5.2 확정 | 미구현(투표 라우트 없음) | ⬜ 미구현 |
| stddev = STDDEV_POP | §4.2 확정 | result는 모표준편차(일치), DB 미작성 | ⚠️ DB 작성 시 맞춰야 |
| PII 미노출(좌표·origin) | §8.1 | meetups·result 응답에 미포함 | ✅(테스트로 고정 MT-28/RS-12) |
| GET `/meetups/[id]` 폴링 | §3 #3 | **라우트 자체 없음** | ⬜ 미구현(P0) |
| compute/votes/confirm/share | §3 #4,6,8,9 | **라우트 없음** | ⬜ 미구현(P0~P1) |
| 단일 detectMode 함수 | §6-1 | 2곳 복제 | ⚠️ M-2 |

**누락 엔드포인트 요약**: 9개 중 **2개만 구현**(POST /meetups, GET /result). members·poll·compute·votes·confirm·share **6개 미구현**. 무가입 풀플로우(생성→제출→폴링→계산→투표→확정)가 end-to-end로 닫히지 않음 → 통합·E2E 테스트는 P0 구현 완료 후로 보류(설계서 §3-3에 명시).

---

## 5. 백엔드팀장 기존 플래그 — QA 재확인 결과

| 팀장 §10 리스크 | QA 재판정 | 비고 |
|---|---|---|
| meetups.id UUID→TEXT | **확인·B-2로 승격** | 연결 즉시 INSERT 실패. DB설계자 협업으로 DDL/시드 동반 수정 필수. |
| 003 RLS·004 cron 부재 | **확인·B-3** | 보안 방어선·PII 만료 공백. live 전 Blocker. |
| DB·Redis·외부 미연결 | **확인·B-1** | 현 스텁은 mock만. 영속 불변식(1인1표·폴링) 런타임 부재. |
| token exp 클램프 미구현 | **확인·M-1** | 코드 레벨에서도 재현. 시그니처 확장 권장. |
| in-memory RL 서버리스 부정확 | 동의(Minor) | MVP 허용. 멀티인스턴스 누수는 Upstash 이관 시 해소. RL 케이스는 단일 인스턴스 가정 테스트(MT-RL-*). |
| compute 비동기(202) 모델 | 동의(Minor) | MVP 동기 처리 합리적. 202 스펙과 실제 동기 동작 간 문서 정합만 유지. |
| OG 동적 이미지 | 동의(P2) | 영향 낮음. |

**추가 발견(팀장 미플래그)**: M-2(detectMode/score 복제), m-1(nanoid 편향), m-2(calcScore NaN), m-7(dev secret silent), m-8(payload 런타임 미검증). 모두 보안·정합성 관점에서 회귀 위험이 있어 본 리뷰에서 신규 등록.

---

## 6. 우선 조치 권고 (QA → 백엔드팀)

1. **M-1 exp 클램프** 먼저 — 작고, 무가입 토큰 수명 정합의 핵심. (TK-01 단언 교체 동반.)
2. **B-2 meetups.id TEXT 전환** — DB 연결의 전제. DDL/시드/FK 동반.
3. **M-2 detectMode/score 단일화** — 미구현 라우트(compute) 작성 **전에** 공통 모듈로 빼야 3중 복제 방지.
4. m-2/m-5는 M-2 통합 작업에 흡수. m-7/m-8은 토큰 모듈 보안 하드닝 1회로 묶어 처리.
5. 위 반영 후 @QA실행자가 `moira-test-design.md` P0 케이스부터 구현 → green 확인 → 미구현 라우트 작성 시 케이스 확장.
