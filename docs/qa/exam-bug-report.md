# 문제팩토리(exam) 버그 리포트

> 작성: @QA실행자 (QA팀) · 대상: `/exam` 변형 생성 파이프라인 · 모드: demo(현재 환경, 키 없음) / live(SDK 모킹)
> 근거: 설계서 `docs/qa/exam-test-plan.md` 62케이스를 vitest로 구현·실행한 **실측 결과**.
> 테스트 코드: `tests/exam/{engine,engine-live,route,bank,types}.test.ts` (+ `_helpers.ts`)

---

## 0. 실행 요약 (Executive Summary)

| 항목 | 결과 |
|---|---|
| 작성 테스트 파일 | 6개 (`engine`, `engine-live`, `route`, `bank`, `types` + `_helpers`) |
| 실행 테스트 수 | **125개** (설계서 62케이스를 세분/경계 보강해 구현) |
| `npm test`(exam 한정) | **125 passed / 0 failed** (green) |
| 그중 `it.fails` 박제 | 1개(DM-SCI-02b — H-1 미수정 동안 '예상된 실패'로 green) |
| 확정 결함 | **High 3** (H-1 실증 / H-2 **정정** / H-3 실증) · **Medium 2 실증**(M-1 크래시 확정, M-5 데이터유실 재현) |
| exam-engine 커버리지 | **라인 99.7% / 브랜치 98.91% / 함수 100%** (G5 게이트 ≥80% 충족) |
| 즉시 수정 1순위 | **M-1**(`null` 입력 시 TypeError 크래시 — 실측 확정) → H-1 → H-3 → H-2 |

> 참고: 전체 `npm test`(레거시 포함)에는 7 failed가 있으나 **전부 전 프로젝트 '오름' 잔재**(`tests/server/ai-budget.test.ts`, `redline.test.ts` — AI 예산/레드라인 기능)이며 exam과 무관. exam 스위트는 완전 격리되어 125/125 green.

---

## BUG-EXAM-001 (M-1): extractJson("null") → null 반환 → 하류 TypeError 크래시 【실측 확정】

### 심각도: **High** (설계서 Medium → 실측 결과 **상향 권고**)

설계서는 M-1을 Medium으로 분류했으나, **실측 결과 제어되지 않은 `TypeError` 크래시가 확정**되어 사용자에게 의미 없는 502가 나가므로 High로 상향 권고한다.

### 재현 스텝
1. `extractJson("null")` 호출 (LLM이 문자열 `"null"`만 반환한 상황 모사)
2. `JSON.parse("null")` 은 성공하며 **JS `null`** 을 반환 → `extractJson`이 그대로 `null` 반환
3. 하류 `generateVariants`(live)의 라인 212 `(parsed.variants || [])`에서 **`null.variants` 프로퍼티 접근**

### 기대 결과
파싱 결과가 객체가 아니면(배열/null/원시값) **제어된 에러로 throw** ("AI 응답을 해석하지 못했습니다") → 라우트가 502 E_GENERATE로 정상 변환.

### 실제 결과 (실측 — M-1 "null" 크래시: **예**)
```
extractJson('null') → null   (typeof: object)
하류 (parsed.variants || []) 접근 → CRASH: TypeError - Cannot read properties of null (reading 'variants')
```
`||` 단축평가가 동작하기 **전에** `null`에서 `.variants` 프로퍼티를 읽으려다 `TypeError` 발생. 502는 나가지만 메시지가 "생성 중 오류" 같은 엉뚱한 일반 문구로 흡수된다.

추가 실측:
- `extractJson("[1,2,3]")` → `[1,2,3]` 그대로 반환(Array.isArray=true). 하류는 `arr.variants===undefined`로 **흡수되어 크래시 없음**(빈배열 → "변형 없음" throw). → 배열은 무해, **`null`만 치명적**.
- `extractJson("42")` → `42` 그대로 반환(원시값 통과, 계약 위반).

### 라이브 경로에서의 실제 노출 가능성 (중요)
`generateVariants` live 경로는 응답에 프리필 `"{"`를 **강제로 앞에 붙인다**(`raw = "{" + first.text`). 따라서 모델이 순수 `"null"`을 뱉어도 `raw="{null"` → `extractJson("{null")`는 파싱 실패 + 슬라이스 실패(`lastIndexOf("}")=-1`)로 **throw로 흡수**된다. 즉 **현재 프리필 구조가 우연히 M-1의 자연 발생을 막고 있다**(테스트 `engine-live.test.ts` LV-NULL에서 박제). 그러나:
- `extractJson`을 다른 경로(미래 서버액션/배치/프리필 없는 호출)에서 직접 쓰면 즉시 크래시.
- 방어가 "프리필이 마침 막아준다"는 우연에 의존 → 설계 결함.

### 환경
Node v22.10.0 / vitest 1.6.1 / macOS (darwin 24.2.0)

### 영향 범위
extractJson을 호출하는 모든 경로. 현재는 프리필이 가려주나, 리팩터/재사용 시 폭발.

### 권고
`extractJson` 파싱 직후 가드 추가:
```ts
const result = JSON.parse(...);
if (typeof result !== "object" || result === null || Array.isArray(result)) {
  throw new Error("AI 응답을 해석하지 못했습니다. 다시 시도해 주세요.");
}
return result;
```
### 가드 테스트
`engine.test.ts` EJ-13(`"null"`→null 박제), EJ-12/12b(배열·숫자), `engine-live.test.ts` "M-1 직접" (null→하류 TypeError 재현).

---

## BUG-EXAM-002 (H-1): science demo 빌더 i=0 복수정답(보기 중복) 【실증】

### 심각도: **High**

### 재현 스텝
1. demo 모드(키 없음)에서 `science` + `multiple_choice` + `count:1` 생성 (또는 N개 생성 시 항상 첫 문항)
2. i=0 → m=1kg, F=2N
3. 보기 ① = `(2+0)/(1+0) = 2.00` (정답), 보기 ② = `(2+0).toFixed(2) = 2.00` (오답)

### 기대 결과
보기 5개 텍스트가 **전부 상이**(유일정답). 시스템 프롬프트(exam-engine.ts:70)도 "복수정답·오류 금지" 명시.

### 실제 결과 (실측)
i=0에서 `①="2.00" == ②="2.00"`. 보기 유일값이 **5개가 아니라 4개** → 정답 모호한 문항이 학생 배포 시험지에 포함.
- 전수 검사(count:10): 중복 발생 인덱스 == **{0}** (i=1~9는 정상 5개 상이). → i=0만 결함.

### 환경
Node v22.10.0 / vitest 1.6.1 / demo 모드

### 영향 범위
demo는 "키 없이 전체 플로우 검증/체험"용인데 science 첫 문항이 깨져 데모 신뢰도 직격. live는 무관(LLM 생성).

### 권고
오답 보기를 정답과 절대 안 겹치게 재설계. 예: ② = `(F + m)` 같이 항상 a(=F/m)와 다른 값, 또는 시작값을 (m,F)=(1,2) 대신 a가 깔끔한 정수가 되는 (2,6)으로. **단순히 ②=(F*m)으로 바꾸면 i=0에서 F*m=2로 또 겹치므로 주의**(검증함).

### 가드 테스트
`engine.test.ts`:
- DM-SCI-02 — 현 버그동작 박제(`①==②=="2.00"`, uniq==4).
- DM-SCI-05 — 중복 인덱스 집합 == {0} 박제(수정 후 []로 뒤집을 것).
- **DM-SCI-02b — `it.fails`로 "보기 5개 상이" 올바른 기대 박제.** H-1 수정 시 `it.fails`→`it`로 바꾸면 미수정 회귀를 자동 감지(빨간불).

---

## BUG-EXAM-003 (H-2): extractJson이 "JSON + 두 번째 중괄호" 입력을 복구 못하고 throw 【실증 + 설계서 예측 정정】

### 심각도: **High** (단, 실제 발생 확률은 프리필로 낮음)

### ⚠️ 설계서 예측 정정 (실측으로 발견)
설계서 EJ-07은 `'{"a":1} 추가설명'`(한글 꼬리텍스트)이 **throw한다**고 예측했으나, **실측 결과 `{a:1}`로 정상 복구**된다. 이유: 한글 꼬리에는 `}`가 없어 `lastIndexOf("}")`가 JSON 끝 `}`를 정확히 잡기 때문. **따라서 EJ-07은 버그가 아니다.**
H-2의 **진짜 재현 케이스는 EJ-08** `'{"a":1} junk {"b":2}'` — 두 번째 객체의 `}` 때문에 슬라이스가 양끝 전체(`{"a":1} junk {"b":2}`)를 잡아 `JSON.parse` 실패 → throw.

### 재현 스텝
1. `extractJson('{"a":1} junk {"b":2}')` 호출 (모델이 JSON 뒤에 또 다른 중괄호 블록을 붙인 상황)
2. 순수 `JSON.parse` 실패 → `indexOf("{")`(=0) ~ `lastIndexOf("}")`(=마지막 객체 끝) 슬라이스
3. 슬라이스 결과 `{"a":1} junk {"b":2}` 를 다시 파싱 시도 → 실패 → throw

### 기대 결과
첫 완결 JSON 객체 `{a:1}`만 추출. 단순 후행 텍스트/추가 블록도 견뎌야 함.

### 실제 결과 (실측)
```
extractJson('{"a":1} 추가설명')        → { a: 1 }   ← 설계서 예측과 달리 정상(버그 아님)
extractJson('{"a":1} junk {"b":2}')   → THROW "AI 응답을 해석하지 못했습니다"  ← H-2 실재
```

### 환경
Node v22.10.0 / vitest 1.6.1

### 영향 범위
live 모드에서 모델이 형식을 약간 어기면(프리필을 써서 가능성↓, 0 아님) 502 생성 실패. 사용자 입장에선 멀쩡해 보이는 응답이 거부됨.

### 권고
(a) 코드펜스 우선 제거 정규식, (b) 첫 `{`부터 **균형 잡힌 중괄호 매칭**으로 첫 완결 객체만 추출, (c) 슬라이스 실패 시 첫 `{`~첫 균형 `}`로 1회 더 시도.

### 가드 테스트
`engine.test.ts` EJ-07(정상 복구 박제 — 설계서 정정 반영), EJ-08(현재 throw 박제, 수정 후 `toEqual({a:1})`로 뒤집을 것).

---

## BUG-EXAM-004 (H-3): count 이중방어 비대칭 (라우트 vs 엔진) 【실증】

### 심각도: **High** (현재 사용자 노출은 라우트가 앞단이라 낮음, 설계 결함)

### 재현 스텝
동일 입력 `count` 값을 (a) 라우트 POST로, (b) 엔진 `generateVariants` 직접 호출로 비교:

| 입력 count | 라우트(zod `int().min(1).max(10)`) | 엔진(`Math.max(1,Math.min(10,Math.round(c)||3))`) |
|---|---|---|
| 0 | **400 E_VALIDATION** | **length 3** (0→3) |
| 2.5 | **400** (int 위반) | length 3 (round) |
| 11 | 400 | length 10 (clamp) |
| NaN | 400 | length 3 (`||3`) |

### 기대 결과
한 입력에 두 계층이 **동일한 결정**(검증 SSOT). 특히 `0`은 "비었음"이 아니라 유효한 사용자 의도일 수 있는데 `Math.round(0)||3`이 0을 falsy로 오인해 3으로 바꿈.

### 실제 결과 (실측)
- 라우트 RT-04(count:0) → **400 E_VALIDATION** (실측 확인)
- 엔진 GV-04(count:0) → **variants.length === 3** (실측 확인)
- → 같은 입력이 계층에 따라 다른 결과 = 비대칭 확정.

### 환경
Node v22.10.0 / vitest 1.6.1

### 영향 범위
현재는 라우트가 앞단이라 영향 적음. 그러나 엔진을 다른 경로(서버액션/배치/테스트)에서 직접 호출하면 라우트 검증 우회 → 사용자가 "0개" 의도했는데 3개 청구·생성. clamp가 두 곳 분산(SSOT 위반).

### 권고
clamp를 단일 유틸로 추출해 라우트/엔진이 공유하거나, 엔진은 "검증된 1~10 정수"를 신뢰하고 방어를 라우트에 일임. `||3`은 `Number.isFinite(c) ? c : 3`로 교체(0을 falsy 취급하지 않게).

### 가드 테스트
라우트 `route.test.ts` RT-04/RT-05/RT-07, 엔진 `engine.test.ts` GV-04/GV-06~09. 양쪽이 비대칭을 박제.

---

## BUG-EXAM-005 (M-5): localStorage write 실패 시 메모리-디스크 불일치(조용한 데이터 유실) 【재현】

### 심각도: **Medium**

### 재현 스텝
1. `useProblemBank` 마운트
2. `localStorage.setItem`이 `QuotaExceededError` throw하도록 모킹
3. `add([variant])` 호출

### 기대 결과
write 실패 시 사용자에게 알림(토스트) + 상태 롤백, 또는 최소한 "저장됨" 표시를 띄우지 않음.

### 실제 결과 (실측 — PB-10)
- React state(`items`)는 갱신됨 → **화면엔 저장된 것처럼 보임**(길이 1).
- 그러나 `write`가 try/catch로 에러를 **조용히 삼켜** localStorage엔 미기록.
- 새 훅 인스턴스 마운트 시 `items === []` → **데이터 유실 확정**(테스트로 재현).

### 환경
Node v22.10.0 / vitest 1.6.1 / jsdom

### 영향 범위
강사가 "문제은행 저장됨"을 믿고 닫으면 다음 접속 시 유실. 무료 플랜 핵심가치(축적) 훼손.

### 권고
`write` 성공 여부를 `add`가 받아 실패 시 `setItems` 롤백 + 사용자 토스트("저장 공간 부족").

### 가드 테스트
`bank.test.tsx` PB-10(현 동작 박제: 메모리 갱신 + 디스크 미기록 + 재마운트 유실).

---

## 부록 A. 정상 동작 확인(회귀 가드, 버그 아님)

| 영역 | 확인 내용 | 케이스 |
|---|---|---|
| math 정합성 | 모든 i에서 정답 ③ == a*(i+1)+b, 보기 5개 상이(i=0→5, i=9→131) | DM-MATH-01~06 |
| science(i≥1) | i=1~9 보기 5개 상이, 정답 ① == (F/m) | DM-SCI-03/05 |
| english/korean/social | 정답 기호가 실제 보기 텍스트와 일치, 5개 상이 | DM-ENG/KOR/SOC |
| 전 과목 매트릭스 | 5과목×{MC,SA} throw 없이 생성, 정답 라벨이 보기 집합에 존재 | DM-ALL-01/02, TY-04 |
| 라우트 검증 | source 8000/8001, image 8MB/8MB+1, enum 위반, 깨진 JSON | RT-11~18 |
| 보안(키 비노출) | GET/POST 응답 본문에 `sk-ant`·실키 원문 미포함 | RT-20/20b, GT-03 |
| 훅 영속/중복제거 | add prepend, 중복 id 제거, remove/clear, 깨진 JSON 내성 | PB-01~09/12 |

## 부록 B. 코드 리뷰 잔여 항목(테스트로 박제했으나 수정은 별도)

- **M-1**(위 BUG-001) — 즉시 수정 권고(High 상향).
- **M-2** vid() Date.now+전역카운터 → 서버 영속 전환 시 PK 충돌 위험. (현재 영향 낮음, `crypto.randomUUID()` 권고) — id는 테스트에서 값 비교 안 함(존재/유일/문자열만).
- **M-3** extractJson/normalizeVariant 미export → **본 작업에서 export로 변경 완료**(부작용 없는 순수 함수). EJ/NV 직접 단위테스트 가능해짐.
- **M-4** XSS — 현재 React 자동 이스케이프로 무해(RT-21 200 통과). rich rendering 도입 전 DOMPurify 권고.
- **L-4** 커버리지 include에 `src/lib/exam/**`·`src/app/api/exam/**` 누락 → 훅/라우트가 커버리지 집계에서 빠짐(테스트는 실행됨). vitest.config 보강 권고.

## 부록 C. 수정 우선순위 (PM 보고용)

1. **M-1 (BUG-001)** — `null` 크래시 가드. 5줄 패치, 리스크 최저, 효과 최고. **즉시.**
2. **H-1 (BUG-002)** — science i=0 복수정답. demo 신뢰도 직격(릴리즈 차단급 G1). 보기 산식 1줄 교체.
3. **H-3 (BUG-004)** — count clamp SSOT 통일. `||3`→`Number.isFinite`.
4. **H-2 (BUG-003)** — extractJson 균형 매칭. 발생확률 낮으나 live 안정성.
5. **M-5 (BUG-005)** — write 실패 롤백+토스트. UX/데이터 신뢰.

---

## 부록 D. 수정 결과 (Resolution) — 2026-06-05

QA가 박제한 결함 4건을 즉시 수정하고, 박제 테스트를 '수정 후 불변식'으로 뒤집어 재검증했다. **exam 스위트 125/125 green 유지** + 브라우저 데모 end-to-end 확인.

| ID | 상태 | 수정 내용 | 검증 |
|---|---|---|---|
| **M-1** (BUG-001) | ✅ 수정 | `extractJson`을 **균형 중괄호 매칭 + 비객체 거부**(`asExamObject`)로 재작성. `null`/배열/원시값은 `throw "AI 응답을 해석하지 못했습니다"`로 흡수 → 하류 `null.variants` TypeError 원천 차단. | EJ-12/13/12b → `toThrow`로 뒤집음. engine-live "M-1 직접" → `toThrow`. |
| **H-1** (BUG-002) | ✅ 수정 | science 시드를 `m=1+i,F=2+i` → **`m=2+i,F=3+i`**(질량 항상 ≥2). i=0에서 ①(F/m)=1.50 이 ②(F)=3.00 과 더 이상 안 겹침. i 0~9 전부 보기 5개 상이. | DM-SCI-01→1.50, 02→5개 상이, 02b `it.fails`→`it`, 03/04 산식 `(3+i)/(2+i)`, 05→`[]`. **브라우저 데모 실측**: 질량2kg/3N → ①1.50 ②3.00 ③2.00 ④0.67 ⑤6.00. |
| **H-3** (BUG-004) | ✅ 수정 | count clamp `Math.round(c)||3` → **`Number.isFinite(round)? clamp(1,10) : 3`**. count0이 falsy→3 대신 하한 clamp로 1. NaN만 3 폴백. | GV-04 → `toHaveLength(1)`. GV-06~09 불변. |
| **H-2** (BUG-003) | ✅ 수정 | M-1 재작성과 동시 해결. `firstBalancedObject`가 `{a} junk {b}`에서 **첫 완결 객체만** 잘라 복구. | EJ-08 → `toEqual({a:1})`. EJ-07 불변. |
| **M-5** (BUG-005) | ⏳ 보류 | localStorage write 실패 롤백+토스트는 UI 작업 동반 → 별도 처리 권고. PB-10 박제는 현 동작 유지. | — |

**재검증 명령**: `npx vitest run tests/exam` → **5 files / 125 passed**. `tsc --noEmit` exam 파일 0 에러(jinjjajip 잔재 에러는 무관). 데모 콘솔 에러 0.

> 비고: 부록 A의 "science(i≥1)" 회귀가드는 이제 i=0 포함 전 구간으로 확장됨(DM-SCI-05 `dupIndexes==[]`).
