# 문제팩토리(exam) 테스트 설계서

> 작성: @QA설계자 (QA팀) · 대상 라우트 `/exam` · 모드: demo(현재 키 없음) / live
> 이 문서는 **설계 전용**이다. 실제 vitest 코드 작성·실행은 @QA실행자가 이 문서만 보고 수행한다.
> 케이스는 함수명·정확한 입력값·기대 불변식까지 명시되어 있어 그대로 코드로 옮길 수 있다.

---

## 0. 결론 먼저 (Executive Summary)

| 항목 | 내용 |
|---|---|
| 테스트 대상 코드 라인 | 약 470줄 (엔진 341 + 라우트 64 + 훅 62) |
| 현재 테스트 수 | **0개** (기존 `tests/`는 전 프로젝트 '오름' 잔재 → 무시) |
| 설계된 케이스 총수 | **62개** (P0: 24, P1: 26, P2: 12) |
| 발견된 결함 | Critical 0 · **High 3** · Medium 5 · Low 4 |
| 가장 큰 리스크 | ① science demo 첫 문항 **복수정답**(①=②) ② extractJson이 "JSON+꼬리텍스트"를 throw ③ count clamp가 라우트/엔진 **비대칭** |

테스트 전략의 핵심 무기는 **demo 모드의 완전한 결정성**이다. demo 빌더는 입력(subject/type/count/difficulty)에 대해 순수 함수처럼 동작하므로(유일한 비결정 요소는 `id`), 네트워크·API 키 없이 정답·보기·정합성을 **수치 단위로 단언**할 수 있다. 이게 이 제품 테스트의 최대 강점이다.

---

## 1. 테스트 전략

### 1.1 무엇을, 어느 레이어에서, 왜

| 레이어 | 대상 | 왜 이 레이어인가 | 모드 |
|---|---|---|---|
| **L1 유닛 (순수/결정)** | `detectMode`, `extractJson`, `normalizeVariant`, `demoResult` 빌더 5종, count clamp | 비즈니스 로직·파싱·정합성의 진실 원천. 외부 의존 없음. 가장 ROI 높음 | demo 로직은 키 불필요 |
| **L1.5 유닛 (모듈 격리)** | `generateVariants(demo 경로)` | env 조작만으로 demo 분기 전체를 결정적으로 검증. Anthropic SDK 미호출 | `ANTHROPIC_API_KEY` 미설정 |
| **L2 통합 (라우트 핸들러 직접 호출)** | `POST/GET /api/exam/generate` | zod 검증·에러코드·이중방어·키 비노출을 HTTP 계약 수준에서 검증. Next 서버 안 띄우고 `route.ts`의 export 함수에 `Request` 주입 | demo |
| **L1 유닛 (클라이언트 훅)** | `useProblemBank` | localStorage 영속·중복제거·예외내성. jsdom 환경 | N/A |
| **L3 live (모킹)** | `generateVariants(live 경로)` | Anthropic SDK를 모킹해 프리필 조립·extractJson 연동·빈 결과 throw 검증. **실제 API 호출 금지** | `vi.mock("@anthropic-ai/sdk")` |

### 1.2 테스트 설계 원칙 적용

1. **리스크 기반** — 강사가 학생에게 배포하는 시험지이므로 **"정답 정합성"이 최우선 P0**. 틀린 정답 = 제품 신뢰 즉사. demo 빌더 수치 검증을 최상단에 둔다.
2. **경계값 집중** — count: `0,1,3,10,11,NaN,2.4,2.6,-5`. source: `""`, 공백만, 8000자, 8001자. image: 8MB, 8MB+1.
3. **상태 전이** — 모드 전이(키 4종: 없음/빈문자/placeholder/실키), 입력 분기(text/image/둘다/둘다없음), 타입 분기(MC/SA).
4. **실패 먼저** — 각 함수마다 악성·빈·초과 입력을 정상보다 먼저 배치.
5. **재현 가능** — `id`(Date.now 기반)·`Date.now()`는 단언에서 제외하거나 `vi.useFakeTimers`로 고정. env는 각 테스트에서 set/restore.

### 1.3 결정성 확보 규칙 (실행자 필수 준수)

- **id 비교 금지**: `vid()`는 `v_${Date.now().toString(36)}_${전역카운터}`. 모듈 전역 `_vid`는 import 시점부터 누적되어 **테스트 간 값이 다르다**. id는 "존재함/유일함/문자열" 정도만 단언하고 정확한 값은 비교하지 말 것.
- **env 격리**: `detectMode`는 `process.env.ANTHROPIC_API_KEY`를 읽는다. 테스트 전 `delete process.env.ANTHROPIC_API_KEY` 또는 명시 set, 후 복원. 기존 `tests/setup.ts`는 exam 키를 건드리지 않으므로 안전.
- **시간 의존**: `savedAt: Date.now()` 단언 시 `vi.useFakeTimers().setSystemTime(...)`.
- **빌더 결정성**: 같은 (subject,type,count,difficulty) → id 외 모든 필드 동일. 스냅샷보다 **명시적 값 단언** 권장(회귀 추적 용이).

### 1.4 Quality Gate (릴리즈 전 통과 조건)

| Gate | 기준 |
|---|---|
| G1 정합성 | **모든 demo 객관식 빌더에서 정답 기호가 가리키는 보기 텍스트 = 실제 계산값, 보기 5개 텍스트 전부 상이(유일정답)**. 현재 science i=0 **FAIL** → 수정 전 릴리즈 불가 |
| G2 검증 | 라우트가 count<1, count>10, 소수, 비-enum subject/difficulty/type, source·image 동시 부재를 모두 400으로 거부 |
| G3 보안 | GET/POST 응답 본문 어디에도 `ANTHROPIC_API_KEY` 원문 미포함. 엔진은 서버 모듈("use client" 없음)에서만 import |
| G4 견고성 | extractJson이 비-JSON/빈문자에 **throw**(크래시 아닌 제어된 에러), 라우트가 이를 502 E_GENERATE로 변환 |
| G5 커버리지 | `src/lib/server/**` 라인 ≥ 80% (엔진 핵심 분기 전부) |
| G6 영속 | useProblemBank add/remove/clear/중복제거가 localStorage 라운드트립으로 검증, 예외 시 크래시 없음 |

### 1.5 자동화 전략

- 도구: **vitest 1.6** (`npm test` = `vitest run`). RTL은 훅 테스트에만 `// @vitest-environment jsdom`.
- L1/L1.5/L2: 100% 자동화 (이 문서 케이스 전부).
- L3 live: `@anthropic-ai/sdk` 모킹으로 자동화. **실제 키·실제 네트워크 호출은 CI에서 절대 금지.**
- 커버리지 include를 `src/lib/exam/**` 추가 권장(현재 `src/lib/server/**`만 → 훅·타입 상수 미집계). → 코드 리뷰 L-4 참조.

---

## 2. 테스트 케이스 매트릭스

> 표기: **불변식** = 반드시 성립해야 하는 단언. P0=릴리즈 차단급, P1=중요, P2=보강.
> 입력은 `GenerateRequestBody` 형태. 생략 필드는 유효 기본값 가정(subject:"math", difficulty:"medium", type:"multiple_choice", count:3, source:"문항").

### 2.1 `detectMode()` — 모드 판별 (exam-engine.ts:20)

| ID | 카테고리 | 입력 (ANTHROPIC_API_KEY) | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| DM-01 | 정상 | env 미설정(`delete`) | `"demo"` | **P0** |
| DM-02 | 정상 | `""` (빈 문자열) | `"demo"` (falsy) | **P0** |
| DM-03 | 경계 | `"   "` (공백만) | `"demo"` (trim 후 빈값) | **P0** |
| DM-04 | 경계 | `"demo"` | `"demo"` (명시 placeholder) | **P0** |
| DM-05 | 경계 | `"sk-ant-your-key-here"` | `"demo"` (startsWith "sk-ant-your") | **P0** |
| DM-06 | 정상 | `"sk-ant-api03-REALKEY..."` | `"live"` | **P0** |
| DM-07 | 경계 | `"  sk-ant-api03-x  "` (앞뒤 공백) | `"live"` (trim 후 판별) | P1 |
| DM-08 | 악성 | `"sk-ant-yourxxx"` (your로 시작하나 실키 흉내) | `"demo"` (의도된 보수적 폴백) | P2 |

### 2.2 `extractJson(text)` — LLM 응답 파싱 (exam-engine.ts:120) ※ 미export → live 경로 통해 간접 검증하거나 export 권장(리뷰 M-3)

| ID | 카테고리 | 입력 text | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| EJ-01 | 정상 | `'{"variants":[]}'` | `{variants:[]}` 반환 | **P0** |
| EJ-02 | 정상 | 앞뒤 공백 포함 `'  {"a":1}  '` | trim 후 `{a:1}` | P1 |
| EJ-03 | 정상 | live 프리필 재현 `'{' + '"variants":[...]}'` | 정상 파싱(프리필 "{" 접두 케이스) | **P0** |
| EJ-04 | 비정상 | 코드펜스 `` '```json\n{"a":1}\n```' `` | start~end 슬라이스로 `{a:1}` 복구 | **P0** |
| EJ-05 | 비정상 | 머리말+JSON `'결과: {"a":1}'` | `{a:1}` 복구 | P1 |
| EJ-06 | 비정상 | 중첩객체 `'pre {"v":{"x":1}} post'` | `{v:{x:1}}` (lastIndexOf "}" 정확) | P1 |
| EJ-07 | **악성** | **JSON+꼬리텍스트 `'{"a":1} 추가설명'`** | **현재 throw** (슬라이스가 `{"a":1} 추가설명`되어 파싱실패). → **버그 H-2**: 정상 JSON인데 throw. 기대(수정후): `{a:1}` | **P0** |
| EJ-08 | **악성** | **두 객체 `'{"a":1} junk {"b":2}'`** | **현재 throw**(슬라이스가 양끝 `{`~`}` 전체 → 깨짐). 검증: throw 발생 확인 → H-2 동일 근본원인 | P1 |
| EJ-09 | 비정상 | 빈 문자열 `""` | throw("AI 응답을 해석하지 못했습니다") | **P0** |
| EJ-10 | 비정상 | 순수 텍스트 `"hello"` | throw | **P0** |
| EJ-11 | 비정상 | 미완성 `'{"a":1'` (닫힘 없음) | throw (end<start) | P1 |
| EJ-12 | **악성** | **배열 `'[1,2,3]'`** | **현재 `[1,2,3]` 반환**(JSON.parse 성공). → **버그 M-1**: 타입계약상 객체여야 하나 배열 통과. 하류 `parsed.variants` undefined로 흡수되나 계약 위반. throw 또는 `{}` 기대 | P1 |
| EJ-13 | 악성 | `"null"` | JSON.parse→`null` 반환. 하류 `parsed.variants` 접근 시 **TypeError 위험**(null.variants). 검증 필요 | **P0** |
| EJ-14 | 악성 | 매우 큰 비-JSON(10만자 텍스트) | throw, 행오버 없이 즉시 반환(성능) | P2 |

### 2.3 `normalizeVariant(raw, body)` — 변형 정규화 (exam-engine.ts:145) ※ 미export(리뷰 M-3)

| ID | 카테고리 | 입력 raw | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| NV-01 | 정상 | `{stem:"문제", type:"multiple_choice", choices:[{label:"①",text:"a"}], answer:"①", explanation:"해설"}` | Variant 반환, 모든 필드 보존, `difficulty/subject`는 body값 주입 | **P0** |
| NV-02 | 경계 | `{stem:"  "}` (공백만) | **`null` 반환** (stem 트림 후 빈값) | **P0** |
| NV-03 | 경계 | `{}` (stem 키 자체 없음) | `null` 반환 | **P0** |
| NV-04 | 경계 | `{stem:"q", type:undefined}` | `type === "multiple_choice"` (기본값) | **P0** |
| NV-05 | 경계 | `{stem:"q", type:"essay"}` (미지원 타입) | `type === "multiple_choice"` (short_answer 외 전부 MC로) | P1 |
| NV-06 | 정상 | `{stem:"q", type:"short_answer"}` | `type==="short_answer"`, **`choices === undefined`** | **P0** |
| NV-07 | 경계 | `{stem:"q", type:"multiple_choice", choices:[]}` | `choices === []` (빈 배열, undefined 아님 — MC는 항상 배열) | P1 |
| NV-08 | 경계 | choices에 빈 text 섞임 `[{label:"①",text:"a"},{label:"②",text:""},{text:"  "}]` | **text 있는 것만 필터** → `choices.length === 1` (label은 빈값 허용, text만 기준) | **P0** |
| NV-09 | 경계 | `{stem:"q", answer:""}` 또는 answer 키 없음 | `answer === "(정답 미상)"` (폴백) | P1 |
| NV-10 | 경계 | `{stem:"q", explanation:""}` | `explanation === "(해설 없음)"` (폴백) | P1 |
| NV-11 | 정상 | `{stem:"q", passage:"  지문  "}` | `passage === "지문"` (trim). 빈 passage면 `undefined` | P1 |
| NV-12 | 악성 | `{stem:"q", choices:[{label:"<script>",text:"x"}]}` | label/text 그대로 보존(이스케이프는 렌더 책임). XSS 노출지점은 리뷰 M-4 참조 | P2 |
| NV-13 | 경계 | MC인데 choices가 모두 빈 text | `choices === []` (length 0 → MC라 빈배열 유지) | P1 |

### 2.4 `demoResult(body)` 빌더 — **정합성 (최우선)** (exam-engine.ts:232)

> 불변식 공통: `variants.length === clamp된 count`, 각 항목 `subject===body.subject`, `difficulty===body.difficulty`, `type===body.type`.

#### 2.4.1 math 빌더 (exam-engine.ts:234)

| ID | 카테고리 | 입력 | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| DM-MATH-01 | **정합성** | subject:math, type:multiple_choice, count:1 | i=0: a=2,b=3,x=1. **정답 "③"이 가리키는 보기 ③ 텍스트 = `5`(=a*x+b)**. stem이 요구하는 값과 일치 | **P0** |
| DM-MATH-02 | **정합성** | math, MC, count:10 | **모든 i(0~9)에서 ③ 텍스트 == a*(i+1)+b == answer가 가리키는 값**. (검증완료: i=0→5,i=9→131 전부 일치) | **P0** |
| DM-MATH-03 | **정합성** | math, MC, count:10 | **각 문항 보기 5개 텍스트가 전부 상이**(③±2 연속정수 → 항상 유일정답). 중복 0건 | **P0** |
| DM-MATH-04 | 정상 | math, short_answer, count:3 | 각 항목 `choices===undefined`, `answer === String(a*(i+1)+b)` (예 i=0→"5") | **P0** |
| DM-MATH-05 | 정합성 | math, SA, count:5 | answer 텍스트(SA)가 stem 계산값과 정확히 일치(문자열 비교) | P1 |
| DM-MATH-06 | 보강 | math, MC, count:1 | explanation에 `a*(i+1)`과 최종값이 포함(해설-정답 일관성 텍스트 검증) | P2 |

#### 2.4.2 science 빌더 (exam-engine.ts:291) — **결함 구역**

| ID | 카테고리 | 입력 | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| DM-SCI-01 | **정합성** | science, MC, count:1 | i=0: m=1,F=2. a=F/m=2.00. 정답 "①" 텍스트 = `"2.00"`. → **현재 ①="2.00" PASS이나 ②도 "2.00" → 보기 중복** | **P0** |
| DM-SCI-02 | **정합성·버그** | science, MC, count:1 | **보기 5개 텍스트 전부 상이여야 함. 현재 i=0에서 ①="2.00"==②="2.00" → FAIL(복수정답).** 이 케이스는 **버그 H-1을 고정(pin)하는 회귀 테스트**. 수정 전엔 의도적 `expect(...).not.toBe` 실패를 문서화 | **P0** |
| DM-SCI-03 | **정합성** | science, MC, count:10 | i=1~9는 보기 5개 상이(검증완료). 정답 ① 텍스트 == `(F/m).toFixed(2)`. 전 범위 정답=계산값 일치 | **P0** |
| DM-SCI-04 | 정상 | science, SA, count:3 | `answer === ((2+i)/(1+i)).toFixed(2)`, choices undefined | **P0** |
| DM-SCI-05 | 정합성 | science, MC, count:10 | **각 i에서 ① 텍스트가 ②③④⑤ 중 어느 것과도 같지 않은지** 전수 검사(i=0만 실패해야 정상). 실패 인덱스 집합 == {0} | P1 |

#### 2.4.3 english / korean / social 빌더 (exam-engine.ts:255/273/307)

| ID | 카테고리 | 입력 | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| DM-ENG-01 | 정상 | english, MC, count:1 | 정답 "②"가 가리키는 보기 ② == `"decides"`. passage 존재, 5개 보기 | **P0** |
| DM-ENG-02 | 정상 | english, SA, count:1 | `answer === "decides → decide"`, choices undefined, passage 존재 | P1 |
| DM-ENG-03 | 정합성 | english, MC | 보기 5개 텍스트 상이(believe/decides/suggests/matters/ability 전부 다름) | P1 |
| DM-KOR-01 | 정상 | korean, MC, count:1 | 정답 "②" == "한 종의 멸종이 생태계 전체에 영향을 줄 수 있다." passage 존재 | **P0** |
| DM-KOR-02 | 정합성 | korean, MC | 보기 5개 상이, 정답이 가리키는 텍스트가 SA answer와 일관 | P1 |
| DM-SOC-01 | 정상 | social, MC, count:1 | 정답 "②" == "영화를 보느라 포기한 아르바이트 수입" | **P0** |
| DM-SOC-02 | 정상 | social, SA, count:1 | `answer === "영화를 보느라 포기한 아르바이트 수입"`, choices undefined | P1 |
| DM-ALL-01 | 정상 | 5과목 × {MC,SA} 매트릭스, count:2 | **모든 조합에서 빌더가 throw 없이 정상 반환**, variants.length===2, sourceSummary에 "[데모]" 접두 | **P0** |
| DM-ALL-02 | 정합성 | 5과목 MC, count:1 | **모든 과목에서 `answer` 기호가 실제 choices의 label 집합에 존재**(예 답이 "⑥"이면 안됨) | **P0** |

### 2.5 `generateVariants(body)` — 엔진 통합/clamp (exam-engine.ts:172)

> 전제: `delete process.env.ANTHROPIC_API_KEY` (demo 경로 강제).

| ID | 카테고리 | 입력 count (그 외 유효) | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| GV-01 | 정상 | count:3 | `mode==="demo"`, `variants.length===3` | **P0** |
| GV-02 | 경계 | count:1 | length===1 | **P0** |
| GV-03 | 경계 | count:10 | length===10 | **P0** |
| GV-04 | **경계·불일치** | count:0 | **엔진: `Math.round(0)||3` → length===3** (0이 3으로!). → 라우트(GV-R)와 **비대칭**(H-3). 엔진 단독 동작 고정 | **P0** |
| GV-05 | 경계 | count:11 | length===10 (상한 clamp) | **P0** |
| GV-06 | 경계 | count:NaN | length===3 (`||3` 폴백) | P1 |
| GV-07 | 경계 | count:2.4 | length===2 (`Math.round`→2) | P1 |
| GV-08 | 경계 | count:2.6 | length===3 (Math.round→3) | P1 |
| GV-09 | 경계 | count:-5 | length===1 (하한 clamp) | P1 |
| GV-10 | 정상 | live env(`"sk-ant-api03-x"`) + SDK 모킹 | `new Anthropic()` 호출됨, demo로 안 빠짐 (분기 검증) | P1 |
| GV-11 | 정상 | demo, math MC count:3 | 반환 `mode` 필드 존재 & `sourceSummary`·`variants` 키 존재(GenerateResult 형태) | **P0** |
| GV-12 | 견고 | demo, source:"", imageBase64 없음 | demo는 source 없어도 대표유형 생성 → throw 없이 variants 반환 (라우트 refine과 분리됨, H-3 관련) | P1 |

### 2.6 `generateVariants` live 경로 — **SDK 모킹** (exam-engine.ts:182~226)

> `vi.mock("@anthropic-ai/sdk")`로 `messages.create` 스텁. env에 실키 형태 set. **실제 호출 금지.**

| ID | 카테고리 | 모킹된 응답 content | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| LV-01 | 정상 | `[{type:"text", text:'"variants":[{"stem":"q","answer":"③","choices":[{"label":"③","text":"x"}]}]}'}]` | 프리필 "{"가 앞에 붙어 파싱 성공. `mode==="live"`, length===1 | **P0** |
| LV-02 | 경계 | text가 빈 변형만 `'"variants":[{"stem":""}]}'` | normalize에서 전부 null → **throw "변형 문항을 만들지 못했습니다"** | **P0** |
| LV-03 | 경계 | `variants` 키 없음 `'"sourceSummary":"x"}'` | `(parsed.variants||[])`→빈배열→length 0→**throw** | **P0** |
| LV-04 | 경계 | count:2인데 모킹이 변형 5개 반환 | **`.slice(0,count)` → length===2** (상한 절단) | P1 |
| LV-05 | 정상 | sourceSummary 없는 정상 변형 | `sourceSummary === "원본 문항 기반 변형"` (폴백) | P1 |
| LV-06 | 비정상 | content에 text 블록 없음(`[{type:"image"...}]`) | `raw="{"` → extractJson(`"{"`) throw → 라우트 502 | P1 |
| LV-07 | 정상 | image 입력 동봉 | userBlocks에 image 블록 + text 블록 2개. media_type 전달 확인(모킹 호출 인자 검사) | P1 |
| LV-08 | 견고 | `messages.create` reject(네트워크 오류) | generateVariants가 reject 전파 → 라우트 502 E_GENERATE | **P0** |

### 2.7 `POST /api/exam/generate` — 라우트 검증·에러·이중방어 (route.ts:38)

> Next 서버 미기동. `import { POST } from route` 후 `new Request(url,{method:"POST",body:JSON.stringify(...)})` 주입. demo env.

| ID | 카테고리 | 입력 body | 기대 status / 불변식 | 우선순위 |
|---|---|---|---|---|
| RT-01 | 정상 | `{source:"문제", subject:"math", difficulty:"medium", type:"multiple_choice", count:3}` | 200, json `{mode:"demo", variants(len 3), sourceSummary}` | **P0** |
| RT-02 | 비정상 | `{}` (필수 누락) | 400, `code:"E_VALIDATION"`, `error.subject`·`error.difficulty`·`error.type` 존재 | **P0** |
| RT-03 | 비정상 | source 공백+이미지 없음 `{source:"   ", subject:"math",difficulty:"easy",type:"short_answer",count:1}` | 400 E_VALIDATION, `error.source` (refine: trim>0 또는 image) | **P0** |
| RT-04 | 경계 | `{count:0, ...유효}` | **400 E_VALIDATION** (zod min(1)). → 엔진(GV-04)은 통과시키므로 **이중방어 비대칭 증명(H-3)** | **P0** |
| RT-05 | 경계 | `{count:11, ...}` | 400 E_VALIDATION (zod max(10)) | **P0** |
| RT-06 | 경계 | `{count:"3", ...}` (문자열) | 200 (`z.coerce.number` → 3). length 3 | P1 |
| RT-07 | 경계 | `{count:2.5, ...}` | **400** (`z.int()` 위반) — 엔진 Math.round와 또 다른 처리(H-3) | P1 |
| RT-08 | 악성 | `{subject:"history", ...}` (비-enum) | 400 E_VALIDATION, `error.subject` | **P0** |
| RT-09 | 악성 | `{difficulty:"insane", ...}` | 400, `error.difficulty` | P1 |
| RT-10 | 악성 | `{type:"essay", ...}` | 400, `error.type` | P1 |
| RT-11 | 경계 | source 길이 8000 정확 | 200 (max 포함) | P1 |
| RT-12 | 경계 | source 길이 8001 | 400 E_VALIDATION (max 초과) | **P0** |
| RT-13 | 경계 | imageBase64 길이 8_000_000 + imageMediaType 유효 + source "" | 200 (image 경로) | P1 |
| RT-14 | 경계 | imageBase64 길이 8_000_001 | 400 E_VALIDATION (max 초과) | **P0** |
| RT-15 | 비정상 | imageBase64 있는데 imageMediaType 없음 | 400 E_VALIDATION, `error.imageMediaType` (2번째 refine) | **P0** |
| RT-16 | 악성 | imageMediaType:"image/gif" (enum 외) | 400 E_VALIDATION | P1 |
| RT-17 | 악성 | **본문이 깨진 JSON** (`req.json()` 자체 실패, body:"{not json") | **400 `code:"E_BAD_JSON"`** (catch 분기) | **P0** |
| RT-18 | 악성 | body가 빈 본문 / 비-JSON 문자열 | 400 E_BAD_JSON | P1 |
| RT-19 | 견고 | 유효 입력인데 `generateVariants`가 throw하도록 모킹 | **502 `code:"E_GENERATE"`**, error는 에러 메시지 문자열 | **P0** |
| RT-20 | 보안 | 위 어떤 응답에도 | **응답 본문 직렬화 문자열에 `process.env.ANTHROPIC_API_KEY` 원문 미포함** | **P0** |
| RT-21 | 악성 | source에 `"<script>alert(1)</script>"` | 200 통과(서버는 저장/생성만). 이스케이프는 렌더 계층 책임 — 회귀 추적용(M-4) | P2 |
| RT-22 | 악성 | source에 거대 유니코드/이모지 7999자 | 200, length 카운트가 코드유닛 기준임을 확인(서로게이트 페어 주의) | P2 |

### 2.8 `GET /api/exam/generate` — 모드 조회 (route.ts:34)

| ID | 카테고리 | 입력 (env) | 기대 출력/불변식 | 우선순위 |
|---|---|---|---|---|
| GT-01 | 정상 | 키 미설정 | 200, `{mode:"demo"}` **단 하나의 키만** (mode 외 필드 없음) | **P0** |
| GT-02 | 정상 | 실키 set + SDK 모킹 불필요 | 200, `{mode:"live"}` | **P0** |
| GT-03 | 보안 | 실키 set | **응답에 키 원문 미포함**(mode 문자열만). `JSON.stringify(res.body)`에 "sk-ant" 부분문자열 없음 | **P0** |
| GT-04 | 보안 | placeholder 키 | `{mode:"demo"}` (실수로 placeholder 노출 안됨) | P1 |

### 2.9 `useProblemBank()` — localStorage 훅 (useProblemBank.ts) ※ `// @vitest-environment jsdom`

> RTL `renderHook` + `act`. 각 테스트 전 `localStorage.clear()`.

| ID | 카테고리 | 시나리오 | 기대 불변식 | 우선순위 |
|---|---|---|---|---|
| PB-01 | 정상 | 초기 마운트, 빈 스토리지 | `items===[]`, `loaded===true` (effect 후) | **P0** |
| PB-02 | 정상 | add([v1,v2]) | items 길이 2, **prepend 순서**(나중 add가 앞). localStorage에 직렬화됨 | **P0** |
| PB-03 | 경계 | 같은 id v1 두 번 add | **중복 제거** → 길이 1 (`existing` Set 필터) | **P0** |
| PB-04 | 경계 | add([]) (빈 배열) | items 변화 없음, write 미발생(`if(!additions.length) return prev`) | P1 |
| PB-05 | 정상 | add 후 remove(id) | 해당 항목 제거, localStorage 반영 | **P0** |
| PB-06 | 경계 | 존재 안하는 id remove | 변화 없음(필터 no-op), 크래시 없음 | P1 |
| PB-07 | 정상 | clear() | items===[], localStorage에 "[]" | **P0** |
| PB-08 | 정상 | add 후 새 훅 인스턴스 마운트 | 기존 데이터 read로 복원(영속성 검증) | **P0** |
| PB-09 | 견고 | localStorage에 깨진 JSON 주입 후 마운트 | `read` try/catch → `items===[]` (크래시 없음) | **P0** |
| PB-10 | 견고 | `setItem`이 QuotaExceededError throw하도록 모킹 후 add | write try/catch → **state는 갱신되나 throw 전파 안됨**. UI 크래시 없음. **단 메모리-디스크 불일치 발생**(M-5) | P1 |
| PB-11 | 경계 | savedAt 단언 | `vi.useFakeTimers`로 고정 후 `items[0].savedAt === 고정시각` | P2 |
| PB-12 | 경계 | add로 prepend된 결과의 id 순서 | 최신이 index 0 (page.tsx 결과 표시 순서 의존) | P2 |

### 2.10 타입/상수 일관성 (types.ts)

| ID | 카테고리 | 시나리오 | 기대 불변식 | 우선순위 |
|---|---|---|---|---|
| TY-01 | 정합성 | `SUBJECTS`의 id 집합 | == zod enum(`["english","math","korean","science","social"]`) == 엔진 `SUBJECT_LABEL` 키. **세 곳 동기화** | P1 |
| TY-02 | 정합성 | `DIFFICULTIES` id | == zod difficulty enum == `DIFFICULTY_LABEL` 키 | P1 |
| TY-03 | 정합성 | `QUESTION_TYPES` id | == zod type enum == `TYPE_LABEL` 키 | P1 |
| TY-04 | 정합성 | 모든 SUBJECTS에 대해 demoResult 빌더 존재 | `builders[subject]`가 5과목 전부 정의(런타임 undefined 방지) | **P0** |

---

## 3. 정적 코드 리뷰

> 심각도: **Critical**(데이터 손상/보안 즉시) · **High**(사용자 직접 피해) · **Medium**(특정 조건 결함) · **Low**(품질).
> 형식: `[심각도] 파일:라인 — 문제 / 영향 / 권고`. 해당 케이스 ID 연결.

### High

**[High] H-1 · exam-engine.ts:296-303 — science demo 빌더 i=0에서 복수정답(보기 중복)**
- 문제: i=0일 때 m=1, F=2. 보기 ① = `(2+0)/(1+0)=2.00`, 보기 ② = `(2+0)=2.00`. **정답 ①과 오답 ②의 텍스트가 동일("2.00")**. 시스템 프롬프트(70행)는 "복수정답·오류 금지"를 명시하는데 demo가 이를 위반.
- 영향: **demo 모드에서 science를 count 1로 생성하면(또는 N개 생성 시 항상 첫 문항) 정답이 모호한 시험지가 학생에게 배포됨.** demo는 "키 없이 전체 플로우 검증"용인데 그 첫인상이 깨진 문항. 데모 신뢰도 직격.
- 검증: 위 Bash로 i=0만 `setSize=4`(5개여야 함) 확인.
- 권고: 오답 보기 설계를 정답과 절대 안 겹치게. 예: ② = `(F*m)` 또는 `(F - m)` 등 항상 a와 다른 값으로. 또는 m,F 시작값을 (1,2)가 아닌 (2,6)처럼 a=3 정수로 잡아 ①≠②≠③ 보장. **DM-SCI-02가 이 버그의 회귀 가드.**

**[High] H-2 · exam-engine.ts:127-135 — extractJson이 "정상 JSON + 꼬리 텍스트"를 복구 못하고 throw**
- 문제: `indexOf("{")`~`lastIndexOf("}")` 슬라이스 방식. LLM이 `{"...":...} 추가 설명입니다` 처럼 **JSON 뒤에 평문을 붙이면** lastIndexOf("}")가 JSON 끝 "}"를 정확히 잡아 복구되지만, JSON 뒤에 **또 다른 중괄호**(예: 이모지 설명, 또 다른 예시 객체)가 오면 슬라이스가 깨져 `JSON.parse` 실패 → throw.
- 영향: live 모드에서 모델이 형식을 약간 어기면(프리필을 써서 가능성은 낮지만 0 아님) **502 에러로 사용자 생성 실패**. 단순 후행 텍스트조차 못 버팀(EJ-07/EJ-08에서 재현).
- 권고: (a) 코드펜스 우선 제거 정규식 `/```(?:json)?\s*([\s\S]*?)```/`, (b) 첫 "{"부터 균형 잡힌 중괄호 매칭으로 첫 완결 객체만 추출, (c) 최소한 슬라이스 실패 시 첫 "{"~첫 균형"}"로 한 번 더 시도. EJ-07/08/13 케이스로 가드.

**[High] H-3 · exam-engine.ts:175 vs route.ts:22 — count 이중방어 비대칭(라우트와 엔진이 0/소수/NaN을 다르게 처리)**
- 문제: 라우트 zod = `int().min(1).max(10)` → 0·11·2.5·NaN을 **400 거부**. 엔진 = `Math.max(1,Math.min(10,Math.round(count)||3))` → 0→**3**, 2.5→**3**(반올림), NaN→**3**. 즉 **같은 입력에 두 계층이 다른 결과**.
- 영향: 현재는 라우트가 앞단이라 사용자 영향 적음. 그러나 (1) 엔진을 다른 경로(서버 액션/배치/테스트)에서 직접 호출하면 라우트 검증을 우회해 0이 조용히 3으로 변함 — **사용자가 "0개"를 의도했는데 3개 청구·생성**. (2) `Math.round(0)||3`은 **0을 "비었음"으로 오인**하는 버그성 표현(0은 유효 의도일 수 있음). (3) clamp가 두 곳에 흩어져 SSOT 위반.
- 권고: 검증을 한 곳으로. 엔진은 "이미 검증된 1~10 정수"를 신뢰하고 방어는 라우트에 일임하거나, 반대로 엔진 clamp를 단일 유틸로 추출해 라우트가 그것을 호출. `||3`은 `Number.isFinite` 체크로 교체. RT-04/RT-07 ↔ GV-04/GV-06~08이 불일치를 고정.

### Medium

**[Medium] M-1 · exam-engine.ts:122,131 — extractJson이 비-객체 JSON(배열/원시값)을 그대로 반환**
- 문제: `JSON.parse("[1,2,3]")`·`JSON.parse("null")`·`JSON.parse("42")`가 성공해 배열/null/숫자를 반환. 반환 타입 시그니처는 `{sourceSummary?, variants?}`인데 계약 위반.
- 영향: 배열/숫자는 `parsed.variants===undefined`로 흡수되지만, **`"null"`이면 라인 212 `(parsed.variants||[])`에서 `null.variants` 접근 → TypeError** (제어되지 않은 크래시, 502는 되나 메시지가 엉뚱). EJ-13에서 재현 필요.
- 권고: 파싱 후 `typeof result === "object" && result !== null && !Array.isArray(result)` 가드, 아니면 throw(제어된 에러).

**[Medium] M-2 · exam-engine.ts:139-143 — vid()의 모듈 전역 카운터·Date.now 의존 → 테스트 결정성·동시성 취약**
- 문제: `_vid`는 모듈 로드 후 전역 누적. id = `v_${Date.now36}_${카운터}`. (1) 같은 ms에 두 프로세스/요청이 생성하면 Date.now 동일+카운터는 프로세스별 독립이라 **서로 다른 서버 인스턴스 간 id 충돌 가능**(현재 localStorage 단일 클라이언트라 영향 적으나, 서버 영속 전환 시 폭탄). (2) 테스트에서 id가 매번 달라 스냅샷 불가.
- 영향: 미래 계정/DB 연동 시 PK 충돌 위험. 현재는 Low-ish지만 설계 결함이라 Medium.
- 권고: `crypto.randomUUID()` 사용. 테스트 결정성은 1.3 규칙으로 회피.

**[Medium] M-3 · exam-engine.ts:120,145 — extractJson/normalizeVariant 미export → 직접 단위테스트 불가**
- 문제: 두 핵심 순수 함수가 모듈 내부에 갇혀 있어 generateVariants(live, SDK 모킹) 경유로만 간접 검증 가능. EJ/NV 14+13개 케이스를 직접 못 짠다.
- 영향: 테스트 작성 난이도↑, 커버리지 사각, 회귀 추적 약화.
- 권고: `export function extractJson`, `export function normalizeVariant` (또는 `__test__` 네임스페이스 export). 부작용 없는 순수 함수라 export 안전.

**[Medium] M-4 · page.tsx:602,609,628 등 + route.ts 전구간 — 사용자 입력/생성물의 XSS 경로(React 자동 이스케이프 의존)**
- 문제: source·생성 stem/passage/choices/explanation을 `{...}`로 렌더(React가 이스케이프하므로 현재 안전). 그러나 **PrintSheet(838~)도 동일 텍스트를 렌더**하고 `window.print()`로 출력. 향후 `dangerouslySetInnerHTML`이나 마크다운 도입 시 즉시 XSS. 서버(route)는 입력을 sanitize 없이 저장/반환.
- 영향: 현재 React 기본 이스케이프로 **실害 없음**(RT-21 통과). 단 방어가 "프레임워크 우연"에 의존 — 리치텍스트 전환 시 회귀.
- 권고: 입력 검증에 위험 패턴 로깅, 향후 rich rendering 전 DOMPurify 도입 명시. RT-21/NV-12를 가드로 유지.

**[Medium] M-5 · useProblemBank.ts:17-23,35-46 — write 실패 시 메모리-디스크 불일치(조용한 데이터 유실)**
- 문제: `write`가 QuotaExceeded 등에서 try/catch로 **조용히 삼킴**. 그런데 `add`는 `setItems(next)`로 React 상태는 이미 갱신. 결과: **화면엔 저장된 것처럼 보이나 localStorage엔 없음** → 새로고침 시 사라짐.
- 영향: 강사가 "문제은행 저장됨" 배지(page.tsx:217)를 믿고 닫았는데 다음날 유실. 무료 플랜의 핵심 가치(축적) 훼손.
- 권고: write 성공 여부를 add가 받아 실패 시 setItems 롤백 + 사용자 토스트("저장 공간 부족"). PB-10이 현 동작을 고정.

### Low

**[Low] L-1 · exam-engine.ts:183 — maxTokens 상한 계산이 count·700 선형, 큰 변형에서 잘릴 위험**
- `1500 + count*700`, max 8000. count=10이면 8500→8000 캡. 긴 지문(영어/국어) 10문항은 8000토큰에 안 들어가 **JSON 중간 절단 → extractJson throw**. 권고: 과목별 토큰 가중 또는 변형을 청크로.

**[Low] L-2 · page.tsx:107 vs route.ts:18 — 클라이언트 이미지 한도(5MB) ≠ 서버 한도(8MB base64≈6MB 원본)**
- UI는 5MB 원본 차단, 서버는 8,000,000자 base64. 불일치 자체는 안전(클라가 더 엄격)하나 사용자 혼란·경계 테스트 복잡. 권고: 한도 상수 공유(types로).

**[Low] L-3 · page.tsx:115 — `file.type as "image/png"` 타입 단언 남용**
- 실제 webp/jpeg인데 png로 단언. 런타임 값은 정확하나 타입 안전 거짓. okTypes 체크 후라 안전하지만 단언 대신 좁히기 권고.

**[Low] L-4 · vitest.config.ts:18 — 커버리지 include에 `src/lib/exam/**` 누락**
- 현재 `src/lib/server/**`만 → `useProblemBank`·`types` 상수가 커버리지 집계 제외. G5 게이트 의미 약화. 권고: include에 `src/lib/exam/**` 추가, `src/app/api/exam/**` 도 검토(라우트 통합 커버리지).

---

## 4. @QA실행자 핸드오프 체크리스트

- [ ] env 격리 헬퍼 작성: `withEnv(key,val,fn)` / 각 모드 테스트 전후 ANTHROPIC_API_KEY set·restore
- [ ] **H-1(DM-SCI-02)·H-2(EJ-07/08)·H-3(RT-04 vs GV-04)는 "현 버그 고정"으로 작성** — 수정 전엔 버그 동작을 `expect`로 박제하고 `// BUG H-x` 주석. 수정 PR이 이 테스트를 뒤집게.
- [ ] extractJson/normalizeVariant **export 요청**(M-3) 또는 live 모킹 우회 결정
- [ ] EJ-13(`"null"`) 실행해 **TypeError 크래시 여부 실측**(M-1 심각도 확정)
- [ ] 라우트는 `new Request`/`Response` 주입식으로 — Next dev 서버 미기동
- [ ] live·route throw 테스트는 `@anthropic-ai/sdk` 모킹, **절대 실네트워크 금지**
- [ ] useProblemBank는 `// @vitest-environment jsdom` + `localStorage.clear()` beforeEach
- [ ] P0 24개 우선 구현 → G1~G4 게이트 충족 확인 후 P1/P2
