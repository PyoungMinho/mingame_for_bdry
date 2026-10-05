# 목격자는 AI — 다시 하기 최종 사양 (되감기 확대 · 수사 기억 · 읽은 대사 넘기기)

> 상태: **최종 사양(기획팀장 확정)**. 초안 → 비평 3건(악용·UX·QA) 반영본. src 는 아직 안 고쳤다.
> 착수 조건: 지금 진행 중인 `src/app/witness` 작업이 머지된 뒤(Ending·AccuseFlow·DialogueBox·Overlays 가 겹친다).
> 이 문서 본문은 내부용이라 정답 id 를 적는다. **사장 보고·커밋 메시지·공유 문구에는 범인/정답을 쓰지 않는다.**

> **v2 정정(2026-10-05)**: 난이도 조정(`witness-balance.md` — 행동 13 · 사이렌 뒤 재방문 · 「수사 종료」)이 이 사양보다 **먼저** 구현됐다(engine·화면 완료). 아래 본문의 수치·서술을 그에 맞춰 고쳤다. 이 사양의 구현은 아직 하지 않았고 다음 작업이다. 바뀐 점: ① 행동 12 → 13(시작 22:50) ② 사이렌 뒤에도 이미 연 곳은 무료 재진입, 새 유료는 막힘 ③ **강제 지목이 없어졌다**(`forced` 항상 false) — 지목은 ★≥3 이면 언제든 자발이고, ★<3 이면 [수사 종료] → 시간 초과 ④ 되감기 종류 `action` 은 **timeout ★≥2 전용** ⑤ 기억 판도 `rulesOf().actions` 를 따라 13.

---

## 사장 보고용 3줄 요약 (스포 없음)

1. 실패하면 엔딩 맨 위 **[↺ 직전부터 다시]** 한 번으로 이어 한다(판당 최대 2번, 그 판은 A등급까지). 범인을 잘못 고르면 1번만 남는다 — 범인 찍기 방지.
2. 2회차부터 새 수사 때 **「기억 이어가기」(전에 방에서 찾은 증거 들고 시작, B등급까지)** / **「처음부터」(S·최단 기록은 여기서만)** 를 고른다. 증언 깨기 퍼즐은 기억해도 그대로 남는다.
3. 대사창 **[≫ 읽은 건 넘기기]** 로 이미 본 대화는 한 번에 넘기고, 처음 보는 줄에서는 멈춘다.

---

## 0. 비평 처리표 (41건: 수용 35 · 기각 6)

### 악용·최적화 비평 (16건: 수용 13 · 기각 3)
| # | 지적 | 판정 | 이유(1줄) |
|---|---|---|---|
| X1 | 지목이 범인 소거 오라클(3번이면 범인 적중 3/4) | **수용** | 범인 틀린 판정은 되감기 2칸 소모 → 범인 적중 3/4→1/2(정확 열거로 확인, §b) |
| X2 | 기회 칸 찍기 실제 ~32% | **수용** | 정확 열거 32.3% 재현, X1 규칙 적용 시 21.9% → 테스트 상한 25% |
| X3 | "완벽 0%"는 지목 찍기에만 성립 | **수용** | 제시 찍기+배제 되감기는 이미 있던 경로, 문장만 한정(코드 안 막음) |
| X4 | 끝난 판 저장 삭제·LastEnding 누락으로 표기 세탁 | **수용** | 새로고침만으로 칩·꼬리가 사라지는 실제 버그 |
| X5 | allclear 를 기억 판에서 제외 | **수용** | 기억 판은 ★전부 최단 10→5라 사실상 실력 업적 |
| X6 | 사건 파일 3판 조건은 처음부터 판만 셈 | 기각 | 사건 파일은 막힌 사람의 출구이고 열람으로 얻는 보상 없음(처음부터 S 는 원래 열린 구멍, §e) |
| X7 | 지목 되감기 행동 −1 삭제 | **수용** | 정직한 사람만 벌주고 QA C2 구멍의 원인 |
| X8 | `rewindClosed`(사건 파일 열면 되감기 종료) 삭제 | **수용** | 새 판을 시작하면 우회되어 막는 것이 없음 |
| X9 | 저장 조작은 못 막는다고 정직하게 서술, rev 가드는 선택 | **수용** | 엄격 파싱은 '손상 방어'로만 서술, rev 가드는 보류 |
| X10 | `best` 순위는 행동 수만, ms 는 표시용 | **수용** | `playMs` 는 탭 가시 시간이라 순위로 부적합 |
| X11 | 기억 판 행동 8 | 기각 | 기억 판은 피로 완화 모드, 머리 쓰는 증언 퍼즐은 무료 행동이라 행동 압박이 재미의 핵심이 아님. 시계 보정 복잡도도 없앰(v2 정정: 기억 판 예산은 별도 상수 없이 `rulesOf().actions` = 13 을 따른다) |
| X12 | 읽음 키 해시 + 훑은 줄 미기록 | **수용** | 길게 누르기 연속 넘김·[넘기기]로 지나간 줄은 읽음 기록 안 함. "2회차부터만 노출"은 기각(같은 판 재방문도 실제로 읽은 글) |
| X13 | 시간 초과 '한 수 전'은 쓸모 없음 | **수용** | ★2 이상일 때만 되감기 노출, 그 밖엔 [새 수사]가 주 버튼(기억 강조) |
| X14 | 3번째 실패 직후 구간 관찰 | **수용** | 친구 베타 관찰 항목(§보류) |
| X15 | 돌파 뒤 "새로 열린 것" 카드 접기 | **수용** | 읽은 카드면 한 줄 칩으로 접음 |
| X16 | 새 수사 시트에서 마지막 선택을 기본값 | 기각 | 실수로 기억 판 진입 위험, UX U3(위치 고정·직전 결과로 강조) 채택 |

### UX 비평 (11건: 수용 10 · 기각 1)
| # | 지적 | 판정 | 이유 |
|---|---|---|---|
| U1 | 되감기 가능 엔딩에서 '놓친 것'·'못 깬 모순 N개'가 힌트로 샘 | **수용** | 되감기 선택지가 있으면 잠금 |
| U2 | 되감기 버튼이 맨 아래 | **수용** | 제목 바로 아래 주 버튼, 도장·통계 접기, 공유는 보조 |
| U3 | 새 수사 진입 시트가 겹쳐 3탭 | **수용** | 확인+선택을 시트 1개로 통합 |
| U4 | 라벨 충돌([≫ 빠르게] vs [≫ 넘기기]) | **수용** | `≫ 읽은 건 넘기기`, 기억 부제 `증거 n개 들고` |
| U5 | 넘기기 버튼 깜빡임·탭 영역 겹침 | **수용** | 연속 읽은 줄 2개+일 때만 활성, 슬롯 예약, 44px, 오른쪽 위 |
| U6 | 기억 판 시작 화면 소음·빈 방 | **수용(일부)** | NEW 점 제거·지도 ✓·HUD 「기억」 칩. 핫스팟 "이미 확인" 문구 칩은 기존 조사 완료 표시로 대체(문구 0) |
| U7 | 되감기 이름 2개 | **수용** | `↺ 직전부터 다시` 하나 |
| U8 | 횟수·상한 고지가 겁줌 | **수용** | `A등급까지`, 마지막일 때만 `마지막 1번`, 소진 시 `되감기 끝` |
| U9 | 사건 파일 확인 시트 버튼명 | 기각 | X8 로 시트 자체가 사라짐 |
| U10 | 1회차에 보이는 것 정리 | **수용** | §g 표 |
| U11 | 한 수 전 뒤 지목 조건 닫힘 토스트 | **수용** | `지목 조건이 다시 닫혔어요` 1회 |

### QA 비평 (14건: 수용 12 · 기각 2)
| # | 지적 | 판정 | 이유 |
|---|---|---|---|
| C1 | 끝난 판 저장 삭제 | **수용** | X4 와 동일, `persistRun` 조건 변경 |
| C2 | 한 수 전이 지목 직전보다 유리(공짜 힌트·−1 무력화) | **수용** | ⓐ 행동 −1 삭제 + 힌트 사용 수는 판 전체 값 유지 |
| C3 | 저장 지점 시간 순서 섞임 | **수용(변형)** | `seq` 필드 대신 결정 규칙(되감기 종류별 스냅샷 정리, §a-4)으로 해결 |
| C4 | 옛 탭이 새 판 읽으면 상한 풀림 | **수용** | 기억·판정 되감기 판만 `v:2` 로 저장, meta 는 v1 유지 + found 멱등 백필 |
| H1 | 돌파 7개 필요성 증명 방식 | **수용** | 금지 실험(ban) 테스트 |
| H2 | 사건 파일 열면 배제 포함 전부 차단 | 기각 | X8 로 `rewindClosed` 삭제. 단 "처음부터 S 는 구멍 아님" 명시는 수용 |
| H3 | 미리 채운 카드가 손에 없음 | **수용** | 보유 카드만 남김 |
| H4 | 기억 판 행동 8 시 시계 | 기각 | X11 로 행동 8 안 씀(예산은 본 판과 같은 13) → 해당 없음 |
| H5 | 기억 판 NEW 점·n 계산·빈 방 함정 | **수용** | `markSeen`, n = 튜토리얼 지급분 제외, `allRecalled` ✓ |
| M1 | 배제 엔딩 found 갱신 누락 | **수용** | 조기 반환 전에 계산 |
| M2 | 배포 전 `rewound=true` 판 호환 | **수용** | `{judged:0, excluded:1}` 로 읽음 |
| M3 | readLines 상한·해시 마이그레이션 | **수용(일부)** | 최신 5000 유지·현재 대사에 없는 키 정리는 수용, 해시 변환 마이그레이션은 기각(1회 초기화가 단순·정확, 영향 몇 명) |
| M4 | 넘기기 시 표정 갱신 누락 | **수용** | 건너뛴 구간의 마지막 face 적용 |
| M5 | 몬테카를로는 CI 제외 | **수용** | 정확 열거로 대체(결정적) |

---

## 1. 현행 코드 사실 (구현 기준선)

| 항목 | 현재 동작 | 위치 |
|---|---|---|
| 되감기 | `rewind(run)` — excluded 엔딩만. `checkpoint` 복원, 신뢰 `max(cp.trust, rewindTrust=2)`, `rewound=true`, 무제한 | engine.ts L1195 |
| checkpoint | `openSet()` 이 세트를 열 때마다 `core(run)` | engine.ts |
| 판정 | `judgeAccusation`: 범인 틀리면 `wrong-Sx`(slots 는 계산하나 화면엔 칸 정보 없음), 범인 맞으면 칸별 ok/ng 연출 | L1065 |
| 정답 | culprit S4 · means E02/E04 · opportunity E03b(C11→C13 로만) · motive E09 | case-data SOLUTION |
| 등급 | `gradeOf`: 완벽/숨은 + ★전부 + wrong≤2 + !rewound → S, 아니면 A / short 2칸 → B / 나머지 C | L1076 |
| RULES | actions **13**(v2 정정, 구 12), 시작 **22:50**, 10분/행동, trustMax 5, hintsMax 2, starGate 3, rewindTrust 2 | L56 |
| run 저장 | `parseCore` 화이트리스트, 코어마다 `v===SAVE_V(1)` 검사, 실패 시 `'version'` → run 키만 삭제(meta 보존) | storage.ts L255, L350 |
| meta | `v!==1` 이면 전체 초기화, 필드 단위 관대. readLines `slice(0,5000)`(오래된 쪽 유지) | storage.ts L433 |
| 끝난 판 | `useWitnessGame.persistRun`: excluded 아닌 ended 면 `clearRun` | L194 |
| plays | `applyResultToMeta` 가 excluded 제외 엔딩마다 +1, `caseFileUnlocked` = 완벽 1회 or plays≥3 | engine.ts |
| missed | `missed(run)` = 보유(또는 갱신본 보유) 안 한 BASE 증거 **전체 목록**(화면만 3개로 자름). LastEnding 에도 전체 id | L1118 |
| 읽은 대사 | `meta.readLines` 키 `${readKey}#${i}`, 타자 끝나면 `markRead`(탭으로 즉시 완성한 줄도 포함) | DialogueBox L115 |

---

## a. 되감기 규칙 (확정)

### a-1. 종류
| 종류 | 제안 조건 | 돌아가는 시점 | 복원 후 |
|---|---|---|---|
| `excluded`(기존) | 수사 배제 | `checkpoint`(세트 진입) | 현행 그대로. **무제한, 판정 칸 안 씀** |
| `accuse` | `wrong-Sx`·`short` 전부(v2 정정: 사이렌 뒤 지목도 플레이어가 고른 시점이라 **자발**로 본다 — 강제 지목이 없어졌다) | `accuseCp` = `submitAccusation` 진입 직전 `core(run)` | 허브. **행동 그대로(−1 없음)**. 사이렌 뒤에 지목했다면 사이렌 뒤 허브·행동 0 으로 복귀(`core` 에 `phase` 가 들어 있다). 지목 화면에 지난 선택 미리 채움 |
| `action` | **`timeout` 이면서 `stars(run) ≥ starGate−1`(=★2 이상) 전용**(v2 정정: 구 ① 강제 지목 오답은 없어짐). timeout 은 이제 '사이렌 뒤 ★<3 에서 [수사 종료]' | `actCp` = 마지막 **유료 행동** 직전 `core(run)`(1칸 굴림) | 허브. 행동 = 스냅샷 값(≥1), 사이렌 해제(`phase` 'play'). 재방문이 생겨 행동 1개를 돌려줄 이유는 timeout 에만 남는다 |

- `actCp` 를 찍는 곳 = 실제로 `spend(cost≥1)` 하는 4곳만: `enterLocation`(첫 입장), `examine`(정밀 첫 조사), `openSet`(첫 열람·cost 1), `hint`. 재입장·재열람·추궁·제시·비용 0 세트(T07/T09/T10)·L0 에서는 안 바뀐다.
- `actCp` 가 없으면(배포 전부터 하던 판 등) `action` 선택지는 `null`. 오류 없이 엔딩 그대로.
- 완벽·숨은 엔딩은 되감기 없음.

### a-2. 판정 칸(횟수) — 숫자 확정
- 판당 **판정 칸 2개**(`rewinds.judged` 0~2 = 쓴 칸 수).
- 되감기 비용: **범인 틀림(`wrong-Sx`) = min(2, 남은 칸)**, 칸만 틀림(`short`) = 1, `timeout` = 1.
- 결과: 칸만 틀리는 정직한 사람은 판정 최대 3번, 범인을 한 번 틀리면 판정 최대 2번.
- 남은 칸 0 이면 선택지 `null`. 배제 되감기는 칸을 안 쓰고 무제한(현행 3-5 원칙 유지).

### a-3. 신뢰·행동·힌트 보정 (모든 종류 공통)
- 신뢰 = `max(snapshot.trust, RULES.rewindTrust=2)` (현행 그대로).
- 행동 = 스냅샷 값 그대로(지목 되감기 −1 **없음**).
- `wrong` = 스냅샷 값(현행과 동일. 되감기 판은 어차피 S 불가).
- **`hints`·`hintLog` 는 판 전체 값 유지**(되돌리지 않음) → 사이렌 직전 수첩 정리로 공짜 힌트를 얻는 구멍 차단.
- 판 전체 유지: `playMs`, `seen`, `egg`(OR), `recall`, `rewinds`, `attempts`, `hints`, `hintLog`.

### a-4. 스냅샷 정리 규칙 (시간 순서 보장, C3)
| 되감기 | `checkpoint` | `accuseCp` | `actCp` |
|---|---|---|---|
| `accuse`(X=accuseCp) | `core(X)` | 삭제 | 유지(항상 X 이전에 찍힘) |
| `action`(X=actCp) | `core(X)` | 삭제 | 삭제(다시 유료 행동을 하면 새로 찍힘) |
| `excluded`(X=checkpoint) | X(현행) | 삭제 | 삭제 |
- 행동 0 에 도달하려면 유료 행동이 필요하므로 `action`(timeout) 뒤 다시 timeout 이 되면 항상 새 `actCp` 가 있다. `excluded` 뒤 `actCp` 가 없는 경우는 a-1 대로 `null`.
- (v2 정정) 사이렌 뒤 허브에서 연 증언의 `checkpoint` 는 `phase: 'siren'` 을 담는다. 수사 배제 되감기(`rewind`)는 체크포인트의 `phase` 를 그대로 이어 받는다(구현됨) — 행동이 되살아나지 않고 사이렌 뒤 허브로 돌아온다.
- `core()` 는 `checkpoint`·`accuseCp`·`actCp` 3필드를 모두 벗긴다(중첩 0).

### a-5. 미리 채우기
- `rewind` 시 `prevAccuse = result.accusation` 에서 **현재 `run.evidence` 에 있는 카드만 남김**(범인은 항상 유지). `startAccuse` 에서 한 번 더 같은 필터 → 지목 화면 '칸' 단계부터.

### a-6. 데이터 모델 (engine.ts)
```ts
export type RewindKind = 'excluded' | 'accuse' | 'action';
interface RunCore {
  // …기존 (rewound: boolean 유지 = 아래 합 > 0)
  rewinds?: { judged: number; excluded: number }; // judged 0~2(칸), excluded 0~999. 없으면 rewound ? {0,1} : {0,0}
  attempts?: number;          // 이 판의 비-배제 판정 횟수 0~3
  prevAccuse?: Accusation;    // 되감은 뒤 미리 채우기
  recall?: { n: number; ids: Id[] }; // 기억 판. n = 시작 시 meta.plays+1, ids ⊆ RECALL_ELIGIBLE
}
interface RunState extends RunCore {
  checkpoint?: RunCore; accuseCp?: RunCore; actCp?: RunCore;
}
export function rewindOption(run: RunState): { kind: RewindKind; cost: number; last: boolean } | null;
export function rewind(run: RunState): Step; // rewindOption 의 것을 실행, 없으면 fail 'no-rewind'
```
- `rewindOption` 판정 순서: ended 아님 → null / excluded + checkpoint → excluded(cost 0) / perfect·hidden → null / 남은 칸 0 → null / timeout → (★≥2 && actCp) ? action : null / wrong·short → accuse(accuseCp 필수 — v2 정정: 강제 지목이 없어져 '강제면 action' 분기 삭제, 사이렌 뒤 지목도 accuse). `last` = 이번 되감기 후 남은 칸 0.
- `rewindClosed` 는 **만들지 않는다**(X8).

---

## b. 찍기 방지 (확정 수치)

### b-1. 정확 열거 결과 (몬테카를로 아님, 최적 찍기 전략)
가정: 범인 후보 4, 수단 후보 4 중 정답 2, 동기 후보 4 중 1, 범인이 틀리면 칸 정보 없음, 범인 맞으면 칸별 정오 공개(현행 유지).

| 찍는 사람 모델 | 판정 3번·비용 균일(초안) | **판정 칸 2·범인 틀림 2칸(확정)** |
|---|---|---|
| 무작위(보유 15장 아무거나) | 0.50% | **0.39%** |
| 종류 앎, 기회 후보 5 | 16.0% | **11.9%** |
| 종류 앎 + 갱신 리본(기회 고정) | 32.3% | **21.9%** |
| 범인만 알아내기(적중 확률) | 75% | **50%** |
(판정 4번 허용 시 리본 모델 57% → 3번 상한 유지가 맞음.)

### b-2. 결정
1. 판정 칸 2 + 범인 틀림 2칸(a-2).
2. 칸별 정오 공개 유지 — 정직한 사람의 다음 추리 재료이고, 찍어서 얻는 최대치는 A + `되감기` 표시뿐(S·최단·실력 업적 불가).
3. 되감기마다 신뢰 −1 기각(신뢰는 제시 오답 자원이라 지목 찍기와 무관).
4. **plays 는 판당 1회**: 그 판의 첫 비-배제 엔딩(`attempts===1`)에서만 +1. 되감기로 plays 가 부풀어 같은 판 안에서 사건 파일이 열리는 일 차단(정합성 목적).
5. 구조적 방어 문장의 정확한 범위: **"기회 칸 정답은 C11→C13 돌파로만 생기므로, 지목 찍기만으로는 그 퍼즐을 건너뛸 수 없다."** 증거 제시 찍기 + 무제한 배제 되감기로 퍼즐을 무차별로 푸는 경로는 원래부터 있고(제시 약 60~100번), 결과는 A + 되감기 표시로 한정 → 막지 않는다.
6. 남는 위험(수용): 기억 판은 ★3 이 행동 1이라 판을 몇 번 돌려 범인을 소거할 수 있다. 보상은 B 상한이고 S 는 처음부터 판 전용이므로 수용.

---

## c. 수사 기억 범위 (확정)

### c-1. 이월
- `RECALL_ELIGIBLE` = `from.location` 인 15장: E01 E02 E03 E04 E05 E06 E07 E08 E09 E10 E11 E12 E13 E17 E18.
- 기억 판 시작: `newRun({ recall: ids })` → `skipTutorial:true` → 이월 증거 `acquire` → 그 증거를 주는 **핫스팟 id 만** `visited` 에 추가(장소 id 는 안 넣음) → `seen` 에 ids 추가(NEW 점 0) → `recall = { n: meta.plays+1, ids }`.
- 장소 입장 비용(1)은 그대로. 방의 모든 증거를 기억으로 가진 방은 `roomStatus.allRecalled=true` → 지도에 ✓ 아이콘(문구 없음).

### c-2. 이월 안 함 (= 머리 쓰는 부분)
- 돌파 산출 E03a·E03b·E14b·E15·E16, 추궁 산출 E14, `broken`·`opened`·`pressed`·`revealed`·`flags`·`secrets`·열린 장소·풀린 의문·깬 줄·숨은 엔딩 조건 전부.
- (초안의 "E03a/E03b 들었으면 E03 으로 기록" 줄 삭제 — E03 은 튜토리얼 지급분이라 무의미. 단 `found` 계산은 `holdsOrSuperseded` 기준이라 자동으로 맞음.)

### c-3. 안전성 (프로토타입 BFS 실측, QA 재확인 완료)
| 조건 | 완벽 최단 | 숨은 최단 | ★전부 최단 | ★3 최단 | 진행 불가 |
|---|---|---|---|---|---|
| 기억 없음(현행) | 8 | 10 | 10 | 4 | 0 |
| 15장 전부 | **4**(T02 T03 T04 T05) | 6 | 5 | 1 | 0 |
| 한 장 빼기 ×15 | 4~6 | 6~8 | 5~7 | — | 0 |
| 고정 시드 부분집합 ×32 | 전부 도달 | — | — | — | 0 |
- **필요 돌파 7개 유지(금지 실험)**: C05·C08·C10·C03·C04·C11·C13 중 하나만 막아도 완벽 해결 `null`(새 판·기억 판 동일). C01·C02·C06·C07·C09·C12·C14·C15 는 막아도 기억 판 완벽 4. 숨은 엔딩은 C02·C03·C04·C05·C06·C08·C10·C11·C13 중 하나만 막아도 `null`.
- 단조성: 모든 해금 조건(`Location.unlock`·`TestimonySet.unlock`·`Hotspot.unlock`·`Break.requires`)에 `not` 0개, 핫스팟 id 를 가리키는 `visited:` 조건 0개 → 증거·조사 표시가 늘어도 막힐 수 없다. `not` 은 `accuseWarn` 에만 있고 대상(E03a/E03b)은 이월 안 함.
- 기억 판 행동 예산은 **별도 상수 없이 `rulesOf().actions` = 13 을 따른다**(v2 정정, X11 기각 유지). 사이렌 뒤 재방문도 똑같이 적용된다. 시계(22:50 시작)·문구 변경 없음.

---

## d. 저장·마이그레이션 (확정)

### d-1. run (`wt:save:v1` 키 유지)
- `SAVE_V` 는 1 유지. **단 `recall` 이 있거나 `rewinds.judged>0` 인 판만 `v:2` 로 저장**(코어·스냅샷 모두). 새 파서는 1·2 모두 수용, 옛 파서는 `'version'` 으로 판만 버리고 meta 보존 → 옛 탭이 상한을 풀어 S 를 meta 에 쓰는 일 차단.
- `parseCore` 신규 필드: `rewinds`(judged 0~2, excluded 0~999), `attempts`(0~3), `prevAccuse`(기존 Accusation 검증), `recall`(n 1~9999, ids ⊆ ELIGIBLE·중복 없음). 범위 밖이면 **판 폐기**(손상 방어. 변조는 막지 못하며 막으려 하지 않는다 — 서버·랭킹 없음).
- 배포 전 판 호환: `rewinds` 없음 + `rewound:true` → `{judged:0, excluded:1}`, `rewound:false` → `{0,0}`. 이 경우를 폐기 사유로 삼지 않는다.
- `parseRun`: `checkpoint`·`accuseCp`·`actCp` 각각 `parseCore`, 어느 하나라도 안에 스냅샷 필드가 있으면 폐기.
- **끝난 판 보존(C1/X4)**: `persistRun` 삭제 조건을 `phase==='ended' && rewindOption(r)===null` 로 변경. 되감기 가능한 끝난 판은 저장 유지 → 타이틀 [이어하기] 시 엔딩 화면으로 바로(배제 엔딩과 같은 경로). `setView` 의 `!loaded.run && pendingView` 분기는 "run 이 ended 면 ending 화면" 으로 일반화.

### d-2. meta (`wt:meta:v1`, v=1 유지)
```ts
interface WitnessMeta {
  // …기존
  found?: Id[];   // 판을 넘어 누적한 RECALL_ELIGIBLE 증거(최대 15)
  best?: { used: number; ms: number; grade: Grade; at: number }; // 처음부터·무되감기 완벽/숨은 최단
}
interface LastEnding { /* …기존 */ recallRun?: number; rewinds?: number; } // 새로고침 후 칩·공유 꼬리 복원(X4)
```
- `found` 갱신: ① `applyResultToMeta` — **배제 포함 모든 엔딩**에서 조기 반환 전에 `found ∪= ELIGIBLE − result.missed`. ② `absorbFound(meta, run)` — 끝나지 않은 판을 버리고 새 수사 시작할 때.
- 백필은 **불러올 때마다 멱등**: `lastEnding` 있으면 `found ∪= ELIGIBLE − lastEnding.missed`(옛 탭이 found 를 지워도 다음 로드에 복원).
- `best` 갱신: 처음부터(`!recall`)·`!rewound`·완벽/숨은일 때 `used`(쓴 행동 수)가 더 적으면 교체, 같으면 유지. `ms` 는 표시용.
- 손상 처리: `found` 배열 아니면 `[]`, 도메인 밖 버림, 중복 제거, 최대 15 / `best` 범위 실패 시 undefined / 다른 필드 불변.
- `readLines`: 키에 문구 해시 4자 추가 → `${readKey}#${i}~${h4(text)}`. 해시 없는 옛 키는 로드 시 버림(**1회 초기화**, 영향: 사장+친구 몇 명). 로드 시 현재 대사에 없는 키 정리, 상한은 `slice(-5000)`(최신 유지).
- 남은 위험: 옛 탭이 meta 를 저장하면 `best` 가 지워질 수 있음(배포 직후 짧은 창). 수용.

---

## e. 등급·기록·공유 (확정)

### e-1. 등급·칭호
```
base  = gradeOf(run, j)                        // 현행(rewound 면 S→A)
cap   = run.recall ? 'B' : run.rewound ? 'A' : null   // 기억+되감기 = B
grade = cap ? min(base, cap) : base
title = titleOf(ending, cap ? min(base,'A') : base) // 기억 판 완벽 → 등급 B, 칭호는 「로그를 읽는 사람」
```
- 기억 판 등급 글자는 숨기지 않는다(PM 결정 "최고 B" 유지, 칭호·「기억」 칩으로 구분).

### e-2. 기록 인정표
| 항목 | 처음부터·무되감기 | 되감기 씀 | 기억 판 |
|---|---|---|---|
| 엔딩 도감·인물 비밀 | O | O | O |
| bestGrade | O | O(≤A) | O(≤B) |
| `best`(최단) | O | X | X |
| flawless·lightning·nohint | O | X | X |
| allclear | O | O | **X** |
| arrestSpeaker·trustedMachine | O | O | O |
| plays | 판당 1 | 판당 1 | 판당 1 |
| 사건 파일 해금(완벽 1회 or plays≥3) | O | O | O |
- 사건 파일을 읽고 처음부터 판에서 S 를 받는 것은 **구멍으로 보지 않는다**(최적화 층은 원래 진상을 알고 반복함). 막지 않음.
- 형사 모드(나중): `rulesOf` 에 `allowRecall:false` → `newRun({recall})` 거부 + 시트에서 기억 버튼 숨김.

### e-3. RunResult 추가
`attempt: number`(1~3), `recallRun?: number`, `rewinds?: number`(배제 포함 합). LastEnding 으로 그대로 복사.

### e-4. 결과 카드·공유
- 엔딩 칭호 아래 작은 칩: `N회차·기억` / `되감기`(둘 다면 둘 다).
- `shareText` 두 번째 줄 꼬리: `B등급 · 로그를 읽는 사람 · 3회차·기억` / `A등급 · 로그를 읽는 사람 · 되감기`. 카카오 title 동일. 처음부터·무되감기는 꼬리 없음(현행).
- OG: `m` 선택 파라미터 예약(0 처음부터·1 되감기·2 기억·3 둘 다, 없으면 0). OG 라우트는 아직 없음.
- 꼬리 문구는 `TRICK_WORDS` 금지어 0.

---

## f. 읽은 대사 넘기기 (확정)

- '읽은 줄' = `meta.readLines` 에 해시 포함 키가 있는 줄(판을 넘어 유지). `run.seen` 은 무관.
- 대상: readKey 가 있는 모든 DialogueBox(컷·핫스팟 독백·세트 소개·추궁·돌파 리액션·엔딩 본문). HALF·WRONG·REDIRECT 등 readKey 없는 판정 피드백은 대상 아님.
- 버튼 `≫ 읽은 건 넘기기`: 대사창 **오른쪽 위**, 터치 44px+, 슬롯 항상 예약(투명도만 토글). 활성 조건 = **지금 줄 포함 연속 읽은 줄 ≥ 2**.
- 누르면 다음 '처음 보는 줄'로 점프, 없으면 블록 끝(`onDone`). 건너뛴 구간의 **마지막 `face`/화자**를 착지 줄에 적용(M4).
- 읽음 기록: 일반 탭으로 지나간 줄만 기록. **길게 누르기 연속 넘김·[넘기기]로 지나간 줄은 새로 기록하지 않음**(X12).
- 엔진 효과는 대사 전에 이미 적용 → 넘겨도 획득·해금 누락 없음.
- 돌파 뒤 "새로 열린 것" 카드: `${breakId}#opened` 가 읽음이면 한 줄 칩으로 접힘, 처음이면 그대로(X15).
- 최종 판정 연출 [전부 건너뛰기] 노출 조건: `plays ≥ 1 || attempt ≥ 2`.
- 코치마크: 버튼이 처음 활성될 때 1회(`markCoach` 재사용), **1회차(plays=0)에는 띄우지 않음**.

---

## g. 화면 흐름·확정 문구

### g-1. 실패 엔딩 (오인 체포·증거 부족·시간 초과), `rewindOption` 있음
```
[키아트]
제목
[ ↺ 직전부터 다시 ]   ← 주 버튼·전폭, 제목 바로 아래
   A등급까지           (last 면: A등급까지 · 마지막 1번)
(본문 탭 진행 — 이미 읽은 본문이면 [↺] 하단 고정 노출, [결과 바로 보기] 생략)
놓친 것은 수사가 끝나면 보여요   ← '놓친 것'·'못 깬 모순 N개' 잠금(U1)
[ 새 수사 ]  [ 엔딩 도감 ]
[ 사건 파일 ](해금 시, 확인 시트 없음)
공유 · 제목으로 (보조/작은 링크)
```
- 도장·통계 6칸은 접는다(되감을 판에 C 를 크게 찍지 않음). 공유 버튼은 `secondary`.

### g-2. 같은 엔딩, 되감기 없음(소진·timeout ★<2·actCp 없음)
```
도장 + 통계 + 놓친 것(열림) + 업적
되감기 끝            ← 흐린 한 줄(소진일 때만)
[ 새 수사 ]   ← 주 버튼 (시트에서 '기억' 강조)
[ 공유 ]  [ 엔딩 도감 ]  [ 사건 파일 ]
```
- 완벽·숨은 엔딩, 배제 화면은 현행(배제 문구만 톤 통일: `A등급까지`).

### g-3. 새 수사 시트 (진입 3곳 공통: 타이틀·엔딩·배제 화면)
- `plays=0` 또는 기억할 증거(found − 튜토리얼 3장) 0개 → 시트 없음. 저장된 판이 있으면 현행 확인 시트만.
- 그 밖 → **시트 1개**(확인+선택 통합):
```
새 수사
(저장된 판이 있으면) 지금 수사는 지워져요
[ 기억 이어가기 ]   증거 n개 들고 · B등급까지
[ 처음부터 ]        S · 최단 기록 도전
```
- 버튼 위치·순서 고정(위 기억, 아래 처음부터). 주 버튼 색은 직전 결과로: 실패면 기억, 완벽·숨은이면 처음부터.
- n = `found − {E01,E02,E03}` 개수(HUD 증거 수와 별개로 '새로 들고 가는 것').
- `Overlays` 의 "엔딩 도감에 기록하고 새 수사" → `새 수사`.

### g-4. 기억 판 플레이 중
- HUD 작은 칩 `기억`(상시). 되감기 판이면 `되감기` 칩.
- 지도: 기억으로 다 가진 방에 ✓. 조사한 핫스팟은 기존 조사 완료 표시. 수첩: 기억 카드에 작은 「기억」, 정렬 아래쪽, NEW 점 없음.
- '한 수 전' 복귀 직후 지목 조건(★3)이 닫혔으면 토스트 1회 `지목 조건이 다시 닫혔어요`.

### g-5. 확정 문구 (전부)
| 위치 | 문구 |
|---|---|
| 되감기 버튼 | `↺ 직전부터 다시` |
| 되감기 부제 | `A등급까지` / `A등급까지 · 마지막 1번` |
| 되감기 소진 | `되감기 끝` |
| 놓친 것 잠금 | `놓친 것은 수사가 끝나면 보여요` |
| 시트 제목 / 경고 | `새 수사` / `지금 수사는 지워져요` |
| 기억 버튼 / 부제 | `기억 이어가기` / `증거 n개 들고 · B등급까지` |
| 처음부터 버튼 / 부제 | `처음부터` / `S · 최단 기록 도전` |
| 대사 넘기기 | `≫ 읽은 건 넘기기` |
| HUD·결과 칩 | `기억` · `N회차·기억` · `되감기` |
| 토스트 | `지목 조건이 다시 닫혔어요` |
| 배제 되감기 부제(톤 통일) | `A등급까지` |
- 금지 단어: 제한·불가·페널티. 설명 문단 없음.

### g-6. 1회차 플레이어에게 보이는 것
| 요소 | 1회차 |
|---|---|
| 새 수사 시트 | 안 보임 |
| 되감기 | 보임(실패 순간에만, 부제 `A등급까지`) |
| 넘기기 버튼 | 같은 판 재방문 시 조용히 보임, 코치마크 없음 |

---

## h. 테스트·경로 검증 기준 (수치)

### h-1. `paths.test.ts` (기존 수치 불변: 완벽 8 · ★3 4 · B 5 · 숨은 10 · 진행 불가 0 · 엔딩 8종)
| ID | 입력 | 기대 |
|---|---|---|
| P1 | `analyzeEconomy(13, memStart(ELIG))`(v2 정정: 예산 12 → 13) | 완벽 4, 필요 집합 `[[T02,T03,T04,T05]]`, 숨은 6, ★전부 5, ★3 1, B 1, 진행 불가 0, 엔딩 8/8 |
| P2 | 새 판·기억 판, hintRoute 7개 각각 ban | 완벽 `null` ×7 / 나머지 8개 ban 시 기억 판 완벽 4 / 숨은은 9개 ban 시 `null` |
| P3 | 한 장씩 빼기 ×15 | 완벽 4~6, 숨은 6~8, 진행 불가 0 |
| P4 | 고정 시드 LCG 12345 부분집합 ×32 | 진행 불가 0, 완벽 도달 불가 0 |
| P5 | 정적: ELIG | 출처 장소 15장, 갱신·돌파·추궁 산출 0, 정답 기회 칸과 교집합 0 |
| P6 | 정적: 해금 조건 | `not` 0, 핫스팟 id `visited` 0 |
| P7 | `newRun({recall:ELIG})` vs `memStart(ELIG)` | 증거·visited 동일, 장소 visited 는 L0 만, broken `[C01]`, flags `[]`, `seen ⊇ ids` |
| P8 | 기억 판 ★3 직후(C11 전) | `accuseWarn` 이 E03b 없음 경고 |
| P9 | 기억 판 도달 상태 전체 | 남은 행동 ≥ 안 연 T02~T05 수 이면 완벽 도달 가능 |
| P10 | 기억 판 시작 `hintFor` | 목표가 allRecalled 방 아님 |
| P11 | 찍기 정확 열거(`guessOdds`, 결정적) | 무작위 ≤ 0.5%, 종류 앎 ≤ 13%, 리본 고정 ≤ 25%, 범인 적중 = 50% |

### h-2. `engine.test.ts`
| ID | 입력 | 기대 |
|---|---|---|
| E1 | 완벽 최단 경로 → 자발 칸 오답(short) → 되감기 | `{kind:'accuse',cost:1,last:false}` → play·허브·신뢰≥2·**행동 불변**·prevAccuse=제출값 |
| E2 | 칸 오답 3번 | 3번째 선택지 `null`, `rewind` → `'no-rewind'`, 판 불변 |
| E2b | 범인 오답 1번 → 되감기 | cost 2, `last:true`, 다음 판정 뒤 `null` |
| E3 | ①행동1 수첩 정리 → 사이렌 뒤 오답 → 되감기(`accuse`) ②행동1 자발 오답 → 되감기 → 소진 → 사이렌 뒤 오답 → 되감기(`accuse`, 행동 0 유지) | ① `hints` 판 전체 값 유지(공짜 힌트 0) ② 최종 행동 ≤ 1 |
| E4 | 각 종류 되감기 직후 | a-4 표대로 스냅샷 정리 |
| E5 | `core()`·JSON | 스냅샷 중첩 0 |
| E6 | actCp 기록 위치 | 유료 4곳에서만 변경 |
| E7 | 행동 0 → 사이렌 → [수사 종료] → timeout ★2 / ★1 | ★2 → action·행동1·final[]·허브(사이렌 해제) / ★1 → `null` |
| E8 | actCp 없는 판(배포 전)의 timeout ★≥2 | 오류 없음, `null` |
| E9 | 한 판 판정 3번 + 배제 1번 | plays +1, 도감 합집합, 배제 엔딩에서도 found 갱신 |
| E10 | 등급 | 되감기+★전부·무결점 → A / 기억 완벽 → B·칭호 A용 / 둘 다 → B / 실력 업적 3종 → 기억·되감기 판 0 / allclear → 기억 판 0, 되감기 판 O |
| E11 | 한 수 전 되감기 후 지목 | prevAccuse 칸 전부 보유 카드 |
| E12 | best | 처음부터 무되감기만 갱신, used 기준 |

### h-3. `storage.test.ts`
| ID | 기대 |
|---|---|
| S1 | 신규 필드 왕복 보존 |
| S2 | 스냅샷 중첩 / recall id 범위 밖 / judged 3 / attempts 4 → 판 폐기 |
| S3 | 기억·판정 되감기 판 → JSON `v:2`, 옛 파서 복사본으로 `'version'`·meta 보존 |
| S4 | 배포 전 판(`rewound:true`, 새 필드 없음) 정상 로드, rewinds `{0,1}` |
| S5 | meta found 없음+lastEnding → 백필 / 잘못된 id 제거 / 16개 → 15 / v 1 유지 / found 지운 meta 재로드 → 복원 |
| S6 | 되감기 선택지 있는 끝난 판 저장 유지, `null` 이면 삭제 |
| S7 | readLines 6000 → 최신 5000, 현재 대사에 없는 키·해시 없는 키 정리 |

### h-4. `share.test.ts` · UI(witness.flows / witness.ux)
- SH1 꼬리 `· N회차·기억` / `· 되감기` / 둘 다, 처음부터 꼬리 없음, 금지어 0, OG `m` 기본 0.
- U1 오인 체포 → 제목 아래 [↺ 직전부터 다시]·`A등급까지` → 지목 '칸' 단계 미리 채움. 놓친 것 잠금.
- U2 소진 후 `되감기 끝` + [새 수사] 주 버튼.
- U3 엔딩 새로고침 → 이어하기 → 엔딩 화면·버튼·칩 유지(C1/X4).
- U4 plays 0 시트 없음 / 이후 시트 1개·두 버튼 / 저장 판 있으면 경고 1줄 포함(3탭 아님) / 기억 판 NEW 점 0·HUD 칩.
- U5 넘기기: 연속 읽은 줄 1개면 비활성, 처음 보는 줄에서 멈춤, 끝까지 읽음이면 블록 종료, 돌파 결과 첫 카드는 표시·두 번째부터 칩.
- U6 넘기기로 지나간 줄은 readLines 에 안 들어감.

### h-5. 통과 기준
1. 위 전부 통과. 특히 E2b·E3·S3·S6·U3 은 비평 구멍을 막은 증거라 필수.
2. 기존 paths 수치 불변.
3. 기존 테스트 수정은 plays 증가 가정·스냅샷 비교·readLines 키 형식만, 목록을 PR 에 명시.
4. paths.test 실행 시간 현재의 2배 이하(넘으면 결과 캐시 또는 describe 분할).

---

## i. 파일별 작업 목록·규모

| 파일 | 작업 |
|---|---|
| `src/lib/witness/engine.ts` | RunCore/RunState 필드, `core()` 3필드 제거, 유료 4곳 `actCp`, `submitAccusation` 의 `accuseCp`·`attempts`, `rewindOption`·`rewind` 일반화(a-2 비용·a-3 보정·a-4 정리·a-5 필터), `hints` 판 전체 유지, `gradeOf`/`summarize` 상한·칭호·`attempt`·`recallRun`, `achievementsOf` 필터(e-2), `newRun({recall})`, `RECALL_ELIGIBLE`·`absorbFound`, `applyResultToMeta`(plays 판당 1·배제 포함 found·best·LastEnding 신규 필드), `roomStatus.allRecalled`, `rulesOf.allowRecall`, StepError `'no-rewind'` |
| `src/lib/witness/storage.ts` | `parseCore`/`parseRun`/`parseResult` 신규 필드, v 1·2 수용 및 조건부 v2 저장, 배포 전 판 호환, `parseMeta` found/best/LastEnding 필드·멱등 백필, readLines 해시 키·정리·`slice(-5000)` |
| `src/lib/witness/share.ts` | 꼬리 표기, 카카오 title, OG `m` |
| `src/lib/witness/validate.ts` | `memStart`, `analyzeEconomy(budget, start?, {ban})`, `freeClosure({ban})`, `guessOdds`(정확 열거) |
| `src/lib/witness/types.ts` | `RewindKind`, LastEnding·RunResult·WitnessMeta 필드 |
| `src/app/witness/lib/useWitnessGame.ts` | `persistRun` 조건, `setView` ended 분기, `startNew({recall})`, 버리는 판 `absorbFound`, `markRead` 기록 규칙 |
| `components/Ending.tsx` · `screens/EndingScreen.tsx` | g-1/g-2 레이아웃, 놓친 것 잠금, 칩, 공유 secondary, LastEnding 복원 |
| `components/StartSheet.tsx`(신규) + `TitleScreen`·`EndingScreen`·`Overlays`(ExcludedView·문구) | 통합 시트 |
| `components/DialogueBox.tsx` · `screens/TestimonyScreen.tsx` | 넘기기 버튼·face 적용·해시 키·열린 것 칩 |
| `components/AccuseFlow.tsx` · `screens/AccuseScreen.tsx` | prevAccuse 미리 채움, [전부 건너뛰기] 조건 |
| `components/Hud.tsx` · `Notebook.tsx` · `EvidenceCard.tsx` · 지도(LocationScreen/허브) | 기억·되감기 칩, ✓, NEW 점 제거, 정렬, 토스트 |
| `components/Collection.tsx` | 최단 기록 한 줄(행동 수) |
| `lib/copy.ts` | g-5 문구 |
| 테스트 | `paths.test.ts`·`engine.test.ts`·`storage.test.ts`·`share.test.ts`·UI flows/ux |
| 문서 | `witness-system.md` 3-5(되감기)·4-3(등급 표) 갱신 |

**규모**: src 수정 약 16파일(신규 1) + 테스트 5파일. 엔진·저장·공유·검증 약 +450줄, UI 약 +350줄, 테스트 약 +550줄. **약 2~2.5일**(엔진 0.6 · 저장/공유 0.4 · UI 0.8 · 테스트 0.6). 순서: 엔진+저장+paths/engine/storage 테스트 → UI → UI 테스트 → 친구 베타.

---

## 보류·남은 위험

1. **3번째 실패 직후 체감**(X14·초안 6): 판정 칸 2 가 정직한 사람에게 충분한지 친구 베타 3명 관찰. 부족하면 칸만 틀림 비용을 유지한 채 칸 3 으로 늘리는 안을 재검토(리본 모델 상한을 다시 계산할 것).
2. **기억 판 긴장감**(X11 기각의 대가): 행동 13 + 사이렌 뒤 재방문에 완벽 4 라 여유가 더 크다(v2 정정: 12 → 13). 베타에서 "싱겁다"가 나오면 기억 판만 예산을 따로 주는 `rulesOf` 분기를 그때 정한다(시계 보정 H4 필요).
3. **기억 판으로 범인 소거**: B 상한으로 수용(§b-2.6).
4. **저장 조작·두 탭 덮어쓰기**: 막지 않음. rev 가드(약 15줄)는 우선순위 낮음으로 보류.
5. **옛 탭 meta 저장으로 `best` 유실**: 배포 직후 짧은 창, 수용.
6. **읽음 기록 1회 초기화**: 해시 도입 배포 시 기존 사용자 넘기기/빠르게 보기가 한 번 리셋된다.
7. **OG 라우트 부재**: `m` 은 예약만.
