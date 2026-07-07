# 팀메이크 오피스 — UI 디자인 스펙 "심야의 스튜디오 (After-Hours Studio)"

> 담당: @UI디자이너 · 기반: `docs/planning/office-plan.md` (Phase 1 확정 스코프)
> 목적: 순수 Canvas 프로시저럴 렌더링(외부 이미지 에셋 0개)이 바로 구현할 수 있는 수치 스펙. 컨셉 재해석 없음 — 지시된 "심야의 스튜디오" 방향을 정밀 실행.

---

## 0. 컨셉 한 줄

Monument Valley급 깔끔한 2:1 아이소메트릭 지오메트리 + 코지한 에디토리얼 색감 + 미세 종이 그레인. 다크 베이스 위에 램프/모니터 불빛이 고이는 심야 스튜디오. 무드: 코지-녹턴 / 크래프트 / 레트로-컴퓨팅.

---

## 1. 디자인 토큰

### 1.1 컬러 — 베이스

| 토큰 | Hex | 용도 |
|---|---|---|
| `--ink-bg` | `#15161d` | 페이지 최외곽 배경(스테이지 밖), 캔버스 letterbox |
| `--wall-plum-1` | `#3a2f3a` | 벽면 기본(밝은 쪽, 낮 기준) |
| `--wall-plum-2` | `#4a3b46` | 벽면 보조(어두운 쪽 / 그림자면) |
| `--floor-clay-1` | `#b98a63` | 바닥 체커 A (낮 기준 원색) |
| `--floor-clay-2` | `#a97b56` | 바닥 체커 B (낮 기준 원색) |
| `--accent-marigold` | `#f4b942` | 브랜드 시그널 — 램프광, 하이라이트, active 상태, 배너 점 |
| `--accent-verdigris` | `#4ec9b0` | 차가운 대비 — 스크린 글로우, 보조 인터랙션, QA/백엔드 연계색과 별개로 UI 전용 사용 시 이 값 |
| `--text-warm` | `#f2ede3` | 본문/타이틀 텍스트 (다크 배경 위) |
| `--text-muted` | `#9a9488` | 보조 텍스트, 캡션, 비활성 라벨 |
| `--border-hairline` | `rgba(242,237,227,0.10)` | 카드/패널 1px 보더 |
| `--shadow-soft` | `rgba(0,0,0,0.45)` | 패널 드롭섀도 |

미세 튜닝 사유: 기획/아트디렉션 지정 hex 그대로 채택. 임의 변경 없음(추가 튜닝 불필요할 만큼 지정값이 이미 코지-녹턴 톤에 부합).

### 1.2 팀 컬러코드 (NPC teamHue)

| 팀 | Hex | 용도 |
|---|---|---|
| 기획 (planning) | `#f4b942` | 몸통색, 사원증 헤더 스트립, 룸 라벨 액센트 |
| 디자인 (design) | `#ef8e7a` | 〃 |
| 프론트엔드 (frontend) | `#6db8e8` | 〃 |
| 백엔드 (backend) | `#4ec9b0` | 〃 |
| QA (qa) | `#b58ce0` | 〃 |
| 배포 (deploy) | `#b7c26a` | 〃 |

- 기획팀 컬러가 브랜드 액센트(`--accent-marigold`)와 동일 — 의도된 것: 기획실이 "본진" 톤이며 회의 소집 연출 시 앰버 글로우와 시각적으로 공명하도록 함.
- 6색 모두 채도·명도를 서로 근접 범위(HSL L 62~74%, S 55~70%)로 맞춰 "균등 무지개" 느낌을 피하고 톤온톤 조화 유지(이미 지정값이 이 범위 내).

### 1.3 NPC 공통색

| 토큰 | Hex | 용도 |
|---|---|---|
| `--npc-skin` | `#e8b48a` | 머리(웜 스킨톤), 전 NPC 공통 |
| `--npc-outline` | `rgba(21,22,29,0.55)` | 1px 소프트 아웃라인 (완전 검정 금지 — 크래프트 느낌 위해 잉크bg 기반 반투명) |
| `--npc-shadow` | `rgba(15,15,20,0.35)` | 접지 그림자 타원 |
| `--lead-pin` | `#d9a441` | 팀장 마커(황동핀) |

### 1.4 시맨틱 (UI 상태용, 사원증 카드 "현재 상태" 배지 등)

| 상태 | 색 | 비고 |
|---|---|---|
| idle | `--text-muted` (`#9a9488`) | 회색 도트 |
| walking | `--accent-verdigris` (`#4ec9b0`) | 청록 도트 |
| working | `--accent-marigold` (`#f4b942`) | 앰버 도트 (은은한 pulse) |
| meeting | `#b58ce0` | QA 보라 재사용 — "집중 모드" 뉘앙스 |

### 1.5 스페이싱 & 반경

- 기본 단위: `4px` 그리드
- 패널 내부 패딩: `12px` / `16px` / `24px`
- 카드 라운드: `12px` (사원증), `8px` (컨트롤 데크 버튼)
- 캔버스 자체는 그리드 개념 없음(아이소 좌표계는 §3 참조)

---

## 2. 타이포그래피 (next/font, 한글 필수, 금지목록 준수: Inter/Roboto/system/Space Grotesk 사용 안 함)

| 역할 | 서체 | next/font 패키지 | 폴백 |
|---|---|---|---|
| 모노(UI 크롬/라벨/시계/사원증 role) | **IBM Plex Mono** | `next/font/google` → `IBM_Plex_Mono` (weight 400/500/600) | `ui-monospace, monospace` |
| 한글 본문/모노 보조(한글 라벨·상태문구) | **IBM Plex Sans KR** | `next/font/google` → `IBM_Plex_Sans_KR` (weight 400/500/700) | `"Malgun Gothic", sans-serif` |
| 디스플레이/배너 타이틀(락업, "TEAM MAKES · OFFICE") | **Gaegu**로 확정하지 않고 → **"Gugi"** 채택 | `next/font/google` → `Gugi` (weight 400, 단일 웨이트) | `"Nanum Pen Script", sans-serif` |

**디스플레이 서체 결정 사유**: 아트디렉션이 "따뜻한 손글씨 계열 또는 묵직한 그로테스크 중 택1, distinctive"를 요구. 손글씨(Gaegu/Nanum Pen)는 코지함은 있으나 "레트로-컴퓨팅" 무드와 충돌하고 작은 타이틀 락업에서 가독성이 떨어짐. **Gugi**(구성진 두꺼운 스텐실형 한글 디스플레이 서체, 라운드 굵은 스트로크)를 채택 — 크래프트한 사인보드/스튜디오 로고 느낌이면서 레트로 아케이드 뉘앙스가 있어 "심야 스튜디오 + 살짝 레트로컴퓨팅" 무드에 부합. 영문 로고타입 "TEAM MAKES"에도 동일 서체 적용해 국영문 톤 일치.

### 2.1 타입 스케일

| 용도 | 서체 | size / line-height / weight | 자간 |
|---|---|---|---|
| 타이틀 락업 (코너, "팀메이크 오피스") | Gugi | 20px / 24px / 400 | 0.02em |
| 타이틀 락업 서브 (영문, "TEAM MAKES · OFFICE") | IBM Plex Mono | 10px / 14px / 500, uppercase | 0.12em |
| 배너 텍스트 | IBM Plex Mono | 12px / 16px / 500 | 0.04em |
| 컨트롤 데크 라벨 | IBM Plex Mono | 11px / 14px / 500, uppercase | 0.06em |
| 사원증 이름 | IBM Plex Sans KR | 16px / 20px / 700 | 0 |
| 사원증 역할/모노 캡션 | IBM Plex Mono | 11px / 14px / 500 | 0.02em |
| 사원증 상태 문구 | IBM Plex Sans KR | 12px / 16px / 400 | 0 |
| 시계(낮밤 스크러버 표시 시각) | IBM Plex Mono | 13px / 16px / 600, tabular-nums | 0.02em |

```ts
// src/lib/fonts.ts (예시 — 실제 구현 시 프론트팀 확정)
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Gugi } from "next/font/google";

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const plexSansKR = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-kr",
});

export const gugi = Gugi({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-display",
});
```

---

## 3. 아이소메트릭 투영 상수

```ts
export const ISO = {
  tileW: 64,           // 타일 폭 (다이아몬드 가로)
  tileH: 32,           // 타일 높이 (다이아몬드 세로) — 2:1 비율 고정
  originX: 640,        // 캔버스 내 그리드 (0,0) 투영 원점 X (캔버스 960~1200 기준 중앙 상단부)
  originY: 120,        // 그리드 (0,0) 투영 원점 Y
  wallHeight: 96,      // 벽 프리즘 압출 높이(px) — 벽 상단면까지
  deskHeight: 28,       // 데스크 오브젝트 압출 높이(px)
};

// 카트(격자 col,row) → 스크린 좌표
export function cartToIso(col: number, row: number, originX = ISO.originX, originY = ISO.originY) {
  const x = originX + (col - row) * (ISO.tileW / 2);
  const y = originY + (col + row) * (ISO.tileH / 2);
  return { x, y };
}

// 깊이 정렬 키 (z-sort). 격자 셀 기반이므로 (row+col)이 1차 키, 방 간 겹침 없음(기획서 Z-order 대응)
export function depthKey(col: number, row: number, footY = 0) {
  return col + row + footY * 0.001; // footY는 같은 셀 내 NPC 미세 보정용(옵션)
}
```

- 오브젝트(벽/데스크) 렌더 = 압출 프리즘 3면: **윗면(top) 밝게 / 좌면(left) 중간 / 우면(right) 어둡게**. 명도 규칙:
  - top face: base color, `brightness(1.12)`, 즉 HSL L +8%
  - left face: base color 그대로 (100%)
  - right face: base color, `brightness(0.72)`, 즉 HSL L −18%
- 접지 그림자: 낮은 알파 타원 `rgba(15,15,20,0.35)`, `ellipse(w: 이코 폭의 55%, h: 18~22%)`, blur 없음(Canvas 벡터 타원 그대로 — 크래프트한 하드엣지 유지, 대신 알파로 소프트함 표현). 길고 드라마틱한 그림자 금지.

---

## 4. 룸 레이아웃 (6업무룸 + 1회의실)

전체 그리드 캔버스: **20 col × 14 row** 가정(각 방을 겹치지 않는 격자 블록으로 분리 배치, 기획서 §Z-order 대응 원칙 그대로).

| roomId | 방 이름 | 팀 | 격자 원점(col,row) | 크기(cols×rows) | 바닥(낮 기준 체커 시작) | 벽색 |
|---|---|---|---|---|---|---|
| `planning-room` | 기획실 | 기획 | (0, 0) | 6×5 | `#b98a63`/`#a97b56` | `#3a2f3a` |
| `design-studio` | 디자인 스튜디오 | 디자인 | (7, 0) | 5×5 | 〃 | `#4a3b46` |
| `dev-room` | 개발실 | 프론트엔드 | (13, 0) | 6×5 | 〃 | `#3a2f3a` |
| `server-room` | 서버실 | 백엔드 | (13, 6) | 6×4 | 〃(서버실만 톤다운, §4.1) | `#4a3b46` |
| `qa-lab` | QA랩 | QA | (7, 6) | 5×4 | 〃 | `#3a2f3a` |
| `deploy-room` | 배포실/옥상 서버 | 배포 | (0, 6) | 6×4 | 〃(가장 어둡게, §4.1) | `#4a3b46` |
| `meeting-room` | 회의실 | 공용 | (6, 11) | 8×3 | 〃 (중앙, 워밍 액센트) | `#3a2f3a` |

### 4.1 방별 바닥 체커 오프셋 & 미세 튠

- 체커 패턴: `(col+row) % 2 === 0 ? floor-clay-1 : floor-clay-2`, 룸 원점 기준 로컬 좌표로 재시작(방마다 시각적 독립 블록처럼 보이게 grout line 역할의 1px `rgba(21,22,29,0.25)` 타일 보더 추가).
- `server-room`, `deploy-room`은 "밤 머니샷 어두운 방" 지정 대상(§6) → 낮 시간에도 바닥 채도를 5% 낮춰(`#ad8462`/`#9d7451`) 야간 대비를 자연스럽게 예열.

### 4.2 데스크/오브젝트 배치 (룸 로컬 좌표, 원점 0,0 = 방 좌상단 셀)

각 방은 "데스크 1개당 NPC 1명 홈 포지션" 원칙. 팀장은 별도 리드 데스크(약간 앞쪽/입구 근처, 접근성으로 위계 암시).

| roomId | 오브젝트 | 로컬 좌표(col,row) | 크기(타일) |
|---|---|---|---|
| `planning-room` | 리드 데스크(팀장) | (1, 1) | 1×1 |
| `planning-room` | 데스크 A (창의기획자) | (3, 1) | 1×1 |
| `planning-room` | 데스크 B (창의팀원) | (4, 1) | 1×1 |
| `planning-room` | 데스크 C (비평기획자) | (3, 3) | 1×1 |
| `planning-room` | 데스크 D (비평팀원) | (4, 3) | 1×1 |
| `planning-room` | 책장(데코) | (0, 4) | 1×1 |
| `design-studio` | 리드 데스크(디자인팀장) | (1, 1) | 1×1 |
| `design-studio` | 데스크 A (UX디자이너) | (3, 1) | 1×1 |
| `design-studio` | 데스크 B (UI디자이너) | (3, 3) | 1×1 |
| `design-studio` | 무드보드(데코) | (1, 4) | 1×1 |
| `dev-room` | 리드 데스크(프론트팀장) | (1, 1) | 1×1 |
| `dev-room` | 데스크 A (컴포넌트개발자) | (3, 1) | 1×1 |
| `dev-room` | 데스크 B (페이지개발자) | (4, 3) | 1×1 |
| `dev-room` | 모니터랙(데코) | (1, 3) | 1×1 |
| `server-room` | 리드 데스크(백엔드팀장) | (1, 1) | 1×1 |
| `server-room` | 데스크 A (API설계자) | (3, 1) | 1×1 |
| `server-room` | 데스크 B (DB설계자) | (3, 2) | 1×1 |
| `server-room` | 서버랙(데코, 틸 글로우) | (0, 3) | 1×1 |
| `qa-lab` | 리드 데스크(QA설계자) | (1, 1) | 1×1 |
| `qa-lab` | 데스크 A (QA실행자) | (3, 2) | 1×1 |
| `qa-lab` | 버그보드(데코) | (1, 3) | 1×1 |
| `deploy-room` | 데스크(배포엔지니어) | (2, 1) | 1×1 |
| `deploy-room` | 서버 안테나/옥상 오브젝트(데코) | (4, 2) | 1×1 |
| `meeting-room` | 회의 테이블(중앙, 긴 프리즘) | (2, 1) | 4×1 |

### 4.3 회의실 좌석 좌표 (meetingSeats)

회의 소집 시 팀 규모에 따라 순서대로 배정(최대 5석 동시 배치 가정 — 기획팀 5인이 최대 인원).

```ts
export const meetingSeats = [
  { seatId: 0, col: 7,  row: 11 },
  { seatId: 1, col: 8,  row: 11 },
  { seatId: 2, col: 9,  row: 11 },
  { seatId: 3, col: 10, row: 11 },
  { seatId: 4, col: 11, row: 11 },
  { seatId: 5, col: 7,  row: 13 }, // 테이블 반대편 (여유석, 팀장 조합 회의 등 6인 이상 대비)
  { seatId: 6, col: 9,  row: 13 },
];
```

---

## 5. NPC 프로시저럴 드로잉 스펙

### 5.1 비율 & 형태

- 몸통: 둥근 콩/캡슐, 폭 18px × 높이 22px (정면 기준), 라운드 사각형 or 캡슐 path로 구현
- 머리: 몸통 대비 큰 원, 지름 16px, 몸통 상단에 60% 겹침(목 생략 — 콩 실루엣)
- 팔다리: 최소 표현 — 다리는 몸통 하단 2개의 짧은 스텁(폭 4px, 높이 4px)만, 팔은 별도 path 없이 idle/walk 프레임에서 몸통 좌우 bulge로 암시
- 아웃라인: 1px, `--npc-outline` (`rgba(21,22,29,0.55)`) — 완전 블랙 금지, 소프트 느낌
- 몸통색 = teamHue(§1.2), 머리색 = `--npc-skin` (`#e8b48a`) 전원 공통
- 팀장 마커: 머리 위 3px 원 + 짧은 핀 stem, 색 `--lead-pin` (`#d9a441`), 또는 몸통 스케일 +10%(18×22 → 20×24)로 미묘하게 크게. **채택: 핀 마커 방식**(스케일 변경은 z-sort 계산 복잡도 증가시키므로 배제).

### 5.2 idle 애니 (2프레임 seq, 방별 마이크로 제스처)

| 프레임 | 지속 | 내용 |
|---|---|---|
| F0 | 600ms | 기준 포즈 (y offset 0) |
| F1 | 600ms | 몸통 y offset −1px (부드러운 bob, ease-in-out), 방 성격별 제스처 오버레이 |

방별 제스처 오버레이(F1에서만 표시, 작은 도형):
- `planning-room`, `design-studio` → **펜 까딱**: 손 위치에 2×2px 점이 좌→우 3px 이동
- `dev-room`, `server-room` → **타이핑**: 데스크 앞쪽에 2개의 1.5px 점이 번갈아 깜빡(손 깜빡임 암시)
- `qa-lab` → **생각**: 머리 위 "…" (1px 점 3개, 순차 페이드인)
- `deploy-room` → **타이핑**(dev-room과 동일 로직 재사용)
- `meeting-room`(회의 중 idle) → **생각 또는 펜 까딱** 랜덤 배정(팀 원속성 유지)

### 5.3 walk 애니 (4방향 × 2~3프레임)

- 방향: NE, NW, SE, SW (아이소 이동 방향에 맞춤 — 그리드 상 col/row 증감 부호로 결정)
  - col+, row+ → SE / col−, row− → NW / col+, row− → NE / col−, row+ → SW
- 프레임: 3프레임 스쿼시-bob 사이클 (`stepCycle = [0, 1, 2, 1]` 순환, 각 80~100ms)
  - F0: 기준 높이, 다리 스텁 중립
  - F1: 몸통 스쿼시 y `scaleY 0.94`, 다리 스텁 벌어짐(전진감), 접지 그림자 폭 +8%
  - F2: 몸통 y offset −2px(살짝 튐), 다리 스텁 모임
- 방향별 몸 기울기: 이동 벡터 방향으로 몸통 `skewX` ±3deg (NE/SE = 우측 기울임, NW/SW = 좌측 기울임)
- 방향성 하이라이트: 이동 방향을 바라보는 쪽 몸통 절반에 밝기 +6% 오버레이(머리 큰 눈/이목구비 없이도 "향하는 쪽" 판독 보조)
- 이동 속도: 1 tile(64px 환산 스크린 거리 기준) 당 약 500~700ms (기획서 "이동결정 1틱 + 렌더 보간" 구조 — 시뮬레이션 틱은 ~1초, 화면 보간은 rAF로 부드럽게)

### 5.4 접지 그림자

- 타원, 반경: 몸통 폭의 55%(가로) × 20%(세로)
- 색: `--npc-shadow` (`rgba(15,15,20,0.35)`)
- walk 중 F1 프레임에서 가로 폭 +8% (스쿼시와 함께 "지면 닿음" 강조), blur 없음(하드엣지 벡터 — Canvas 성능/크래프트 룩 동시 고려)

### 5.5 NPC 로스터 (17명)

```ts
export type Team = "planning" | "design" | "frontend" | "backend" | "qa" | "deploy";

export const TEAM_HUE: Record<Team, string> = {
  planning: "#f4b942",
  design:   "#ef8e7a",
  frontend: "#6db8e8",
  backend:  "#4ec9b0",
  qa:       "#b58ce0",
  deploy:   "#b7c26a",
};

export const NPC_ROSTER = [
  // 기획팀 (5)
  { agentId: "planner-lead",     name: "기획팀장",   team: "planning", role: "최종 결정권자",           roomId: "planning-room", teamHue: TEAM_HUE.planning, isLead: true,  home: { col: 1, row: 1 } },
  { agentId: "creative-lead",    name: "창의기획자",  team: "planning", role: "창의 파트 리더",          roomId: "planning-room", teamHue: TEAM_HUE.planning, isLead: false, home: { col: 3, row: 1 } },
  { agentId: "creative-member",  name: "창의팀원",    team: "planning", role: "아이디어 발산",           roomId: "planning-room", teamHue: TEAM_HUE.planning, isLead: false, home: { col: 4, row: 1 } },
  { agentId: "critic-lead",      name: "비평기획자",  team: "planning", role: "비평 파트 리더",          roomId: "planning-room", teamHue: TEAM_HUE.planning, isLead: false, home: { col: 3, row: 3 } },
  { agentId: "critic-member",    name: "비평팀원",    team: "planning", role: "리스크 지적",             roomId: "planning-room", teamHue: TEAM_HUE.planning, isLead: false, home: { col: 4, row: 3 } },

  // 디자인팀 (3)
  { agentId: "design-lead",      name: "디자인팀장",  team: "design",   role: "디자인 최종 종합",         roomId: "design-studio", teamHue: TEAM_HUE.design, isLead: true,  home: { col: 1, row: 1 } },
  { agentId: "ux-designer",      name: "UX디자이너",  team: "design",   role: "플로우/와이어프레임",       roomId: "design-studio", teamHue: TEAM_HUE.design, isLead: false, home: { col: 3, row: 1 } },
  { agentId: "ui-designer",      name: "UI디자이너",  team: "design",   role: "비주얼/디자인 시스템",      roomId: "design-studio", teamHue: TEAM_HUE.design, isLead: false, home: { col: 3, row: 3 } },

  // 프론트엔드팀 (3)
  { agentId: "fe-lead",          name: "프론트팀장",  team: "frontend", role: "코드리뷰/아키텍처",        roomId: "dev-room", teamHue: TEAM_HUE.frontend, isLead: true,  home: { col: 1, row: 1 } },
  { agentId: "fe-component",     name: "컴포넌트개발자", team: "frontend", role: "UI 컴포넌트 구현",       roomId: "dev-room", teamHue: TEAM_HUE.frontend, isLead: false, home: { col: 3, row: 1 } },
  { agentId: "fe-page",          name: "페이지개발자", team: "frontend", role: "페이지 조립/API 연동",     roomId: "dev-room", teamHue: TEAM_HUE.frontend, isLead: false, home: { col: 4, row: 3 } },

  // 백엔드팀 (3)
  { agentId: "be-lead",          name: "백엔드팀장",  team: "backend",  role: "시스템 아키텍처 종합",      roomId: "server-room", teamHue: TEAM_HUE.backend, isLead: true,  home: { col: 1, row: 1 } },
  { agentId: "be-api",           name: "API설계자",   team: "backend",  role: "엔드포인트/인증",          roomId: "server-room", teamHue: TEAM_HUE.backend, isLead: false, home: { col: 3, row: 1 } },
  { agentId: "be-db",            name: "DB설계자",    team: "backend",  role: "데이터 모델링",            roomId: "server-room", teamHue: TEAM_HUE.backend, isLead: false, home: { col: 3, row: 2 } },

  // QA팀 (2)
  { agentId: "qa-designer",      name: "QA설계자",    team: "qa",       role: "테스트 전략/설계",         roomId: "qa-lab", teamHue: TEAM_HUE.qa, isLead: true,  home: { col: 1, row: 1 } },
  { agentId: "qa-runner",        name: "QA실행자",    team: "qa",       role: "테스트 실행/버그헌팅",      roomId: "qa-lab", teamHue: TEAM_HUE.qa, isLead: false, home: { col: 3, row: 2 } },

  // 배포팀 (1)
  { agentId: "deploy-eng",       name: "배포엔지니어", team: "deploy",  role: "빌드게이트/Vercel배포",     roomId: "deploy-room", teamHue: TEAM_HUE.deploy, isLead: true, home: { col: 2, row: 1 } },
];
```

- `isLead` 판별: 팀당 정확히 1명(팀장 or 단독 배포엔지니어) — 핀 마커(§5.1) 적용 대상.
- `home` 좌표는 §4.2 데스크 배치표의 로컬 좌표와 1:1 매칭.

---

## 6. 조명 4단계 (낮밤 60초 루프)

전체 사이클 60초 = 4단계 × 15초. 전환은 각 단계 사이 2초 크로스페이드(틴트 알파 선형 보간).

| 단계 | name | 화면 틴트 rgba | 램프 글로우 알파 | 지속(초) | 비고 |
|---|---|---|---|---|---|
| 아침 | `morning` | `rgba(139,160,196,0.14)` (쿨 블루그레이) | `0.15` | 15 | 램프 약, 자연광 우세 |
| 낮 | `midday` | `rgba(255,255,255,0.03)` (최소 틴트) | `0.05` | 15 | 최자연광, 램프 거의 꺼짐 |
| 저녁 | `evening` | `rgba(244,150,66,0.16)` (앰버/오렌지 워시) | `0.55` | 15 | 램프 발광 시작 |
| 밤 | `night` | `rgba(15,18,32,0.62)` (인디고 딥, `#0f1220` 기반) | `0.85` | 15 | ★ 머니샷. 스크린 글로우 동반 |

```ts
export const LIGHTING_STAGES = [
  { name: "morning", tint: "rgba(139,160,196,0.14)", lampAlpha: 0.15, duration: 15 },
  { name: "midday",  tint: "rgba(255,255,255,0.03)",  lampAlpha: 0.05, duration: 15 },
  { name: "evening", tint: "rgba(244,150,66,0.16)",   lampAlpha: 0.55, duration: 15 },
  { name: "night",   tint: "rgba(15,18,32,0.62)",     lampAlpha: 0.85, duration: 15 },
];
```

### 6.1 램프 글로우 스펙

- 형태: `radial-gradient` (Canvas: `createRadialGradient`), 중심 = 각 데스크 오브젝트 상단 중앙, 반경 = 타일 폭의 1.4배(약 90px)
- 색 stop: `0% #f4b942 (alpha=lampAlpha)` → `60% #f4b942 (alpha=lampAlpha*0.35)` → `100% transparent`
- 블렌드 모드: `globalCompositeOperation = "lighter"` (가산 합성) — 다크 배경 위에서 실제 빛이 고이는 느낌
- 모니터/스크린 글로우: 동일 로직이나 색 `--accent-verdigris` (`#4ec9b0`), 반경은 타일 폭의 1.0배, 데스크 정면(모니터 위치)에서 발생, `night`/`evening` 단계에서만 렌더(그 외 단계는 알파 0으로 스킵)

### 6.2 밤 머니샷 — 어두운 방 목록

야근 무드 연출을 위해 `night` 단계에서 다음 방은 벽/바닥 명도를 추가로 −12% 낮추고, 해당 방의 NPC 유무에 따라 램프 유무로 대비 강조:

- `server-room` (백엔드 — 서버랙 틸 글로우만 발광, 방 자체는 가장 어둡게)
- `deploy-room` (배포실 — 야근 배포 무드, 램프 1개만 고립되어 발광)
- `qa-lab` (야간 버그헌팅 무드로 절반 어둡게)

나머지(`planning-room`, `design-studio`, `dev-room`, `meeting-room`)는 밤에도 상대적으로 밝게 유지하여 "일부 방은 어둡게" 대비를 만든다(기획서 조명 지침 그대로).

```ts
export const NIGHT_DIM_ROOMS = ["server-room", "deploy-room", "qa-lab"];
export const NIGHT_DIM_FACTOR = 0.88; // 벽/바닥 明度 배율
```

---

## 7. 페이지 크롬 (DOM, 데스크톱 전용 min-width: 1024px)

### 7.1 SIMULATION 배너

```css
.sim-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 28px;
  background: #101018;
  border-bottom: 1px solid var(--border-hairline);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  z-index: 50;
}
.sim-banner .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--accent-marigold);
  animation: sim-blink 1.6s ease-in-out infinite;
}
@keyframes sim-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
```

텍스트: `● SIMULATION — 실제 에이전트는 로컬에서 동작` (전체 모노, 점만 애니). 노란 경고바 아님 — 잉크색 얇은 스트립.

### 7.2 컨트롤 데크 (좌하단 플로팅 패널)

```css
.control-deck {
  position: fixed;
  left: 20px; bottom: 20px;
  background: #1b1c24;
  border: 1px solid var(--border-hairline);
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px var(--shadow-soft), inset 0 1px 0 rgba(255,255,255,0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--font-mono);
  z-index: 40;
}
.control-deck .btn {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-warm);
  background: #26262f;
  border: 1px solid var(--border-hairline);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.control-deck .btn:hover { background: #303040; }
.control-deck .btn.active {
  background: var(--accent-marigold);
  color: #1b1600;
  border-color: var(--accent-marigold);
}
.control-deck .scrubber {
  width: 180px; height: 4px;
  background: #33333e;
  border-radius: 2px;
  position: relative;
}
.control-deck .scrubber .stage-marker {
  position: absolute; top: -3px;
  width: 2px; height: 10px;
  background: var(--text-muted);
}
.control-deck .clock {
  font-variant-numeric: tabular-nums;
  font-size: 13px; font-weight: 600;
  color: var(--accent-marigold);
}
```

구성 요소(위→아래): `[회의 소집 ▸]` 트리거 버튼(팀별 드롭다운 or 단일 버튼, 오픈이슈 §Phase1 결정: **단일 "회의 소집 ▸" 버튼 + 클릭 시 팀 6개 미니 리스트 팝오버**로 확정 — 데크 공간 절약), 낮밤 스크러버(현재 단계 마커 + `clock` 텍스트로 "18:42" 식 가상 시각 표시), 속도 토글(`1x` / `4x` 버튼 쌍, active 상태 앰버).

### 7.3 사원증(ID카드) 프로필 팝업

```css
.id-card {
  position: absolute; /* 클릭 NPC 근처에 배치, JS로 위치 계산 */
  width: 220px;
  background: #1e1e27;
  border-radius: 12px;
  border: 1px solid var(--border-hairline);
  box-shadow: 0 12px 32px var(--shadow-soft);
  overflow: hidden;
  transform: rotate(-2deg);
  animation: id-card-in 0.18s cubic-bezier(0.2, 0.8, 0.3, 1.1);
  font-family: var(--font-kr);
  z-index: 60;
}
@keyframes id-card-in {
  from { opacity: 0; transform: rotate(-6deg) scale(0.92) translateY(6px); }
  to   { opacity: 1; transform: rotate(-2deg) scale(1) translateY(0); }
}
.id-card .header {
  height: 44px;
  background: var(--team-hue, var(--accent-marigold)); /* JS에서 팀 컬러 주입 */
  display: flex; align-items: center; gap: 8px;
  padding: 0 12px;
}
.id-card .avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--npc-skin);
  border: 1px solid rgba(21,22,29,0.4);
  /* 아바타 내부에 프로시저럴 콩캐릭터 축소 렌더(Canvas snapshot or mini SVG) */
}
.id-card .body { padding: 12px 14px 14px; }
.id-card .name {
  font-size: 16px; font-weight: 700; color: var(--text-warm);
}
.id-card .role {
  font-family: var(--font-mono);
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px; letter-spacing: 0.02em;
}
.id-card .status-row {
  margin-top: 10px; display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--text-warm);
}
.id-card .status-dot {
  width: 6px; height: 6px; border-radius: 50%;
}
```

내용 구조: 헤더 스트립(팀컬러 배경 + 미니 프로시저럴 아바타) → 이름(디스플레이 아님, KR 굵게) → 역할(모노, 뮤트) → 상태 행(색상 도트 + "회의 중" 등 짧은 문구, §1.4 시맨틱 색 매핑) → (선택) 하단 얇은 구분선 + "최근 활동" 한 줄.

### 7.4 스테이지 밖 페이지 배경 & 그레인/비네트

```css
body.office-page {
  background: var(--ink-bg);
  position: relative;
}
.office-stage-wrapper {
  position: relative;
  display: flex; align-items: center; justify-content: center;
  min-height: 100vh;
}
.office-vignette {
  position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%);
  z-index: 30;
}
.office-grain {
  position: fixed; inset: 0; pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  z-index: 45;
  /* SVG feTurbulence 배경 이미지 data-uri 또는 canvas 프로시저럴 노이즈 1회 생성 후 고정 */
}
```

그레인 구현: SVG `<filter><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" />` → `data:image/svg+xml` 배경으로 고정(재생성 없음, 성능 고려 — 애니메이션 노이즈 아님, 정적 텍스처 1장). `opacity: 0.05`, `mix-blend-mode: overlay`.

### 7.5 타이틀 락업 (코너)

```css
.title-lockup {
  position: fixed; top: 40px; left: 20px;
  z-index: 20;
  color: var(--text-warm);
}
.title-lockup .kr {
  font-family: var(--font-display); /* Gugi */
  font-size: 20px;
  letter-spacing: 0.02em;
}
.title-lockup .en {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 2px;
}
```

텍스트: KR "팀메이크 오피스" / EN "TEAM MAKES · OFFICE".

---

## 8. 데스크톱 전용 가드 (< 1024px)

```css
@media (max-width: 1023px) {
  .office-stage-wrapper, .control-deck, .title-lockup { display: none; }
  .mobile-guard { display: flex; }
}
```

`.mobile-guard`: 잉크 배경 + 중앙 정렬(이 화면만 예외적으로 중앙정렬 허용 — 안내 화면이라 히어로 아님) 텍스트 "이 시뮬레이션은 데스크톱(1024px 이상)에서 최적화되어 있습니다." (IBM Plex Sans KR, 14px), 하단에 타이틀 락업 미니 버전.

---

## 9. 산출물 요약 (개발 인계 체크리스트)

- [x] 아이소 상수 (`tileW=64, tileH=32, cartToIso, origin`) — §3
- [x] 6룸+회의실 좌표/색/오브젝트 배치 — §4
- [x] NPC 17명 로스터(agentId/name/team/role/roomId/teamHue/isLead/home) — §5.5
- [x] meetingSeats 배열 — §4.3
- [x] 조명 4단계 틴트/알파/지속초 + 밤 어두운 방 목록 — §6
- [x] 디자인 토큰 hex 전체 + 폰트 3종 next/font 패밀리명 확정 — §1, §2
- [x] NPC 드로잉 스펙(비율/색/아웃라인/idle·walk 프레임) — §5
- [x] 페이지 크롬 CSS(배너/컨트롤데크/사원증/그레인/비네트/타이틀락업) — §7

**후속 결정 필요(@디자인팀장 종합 시 확인 요망)**:
1. 디스플레이 서체 **Gugi** 최종 채택 여부(대안: 두껍고 라운드한 그로테스크 계열로 원할 경우 `Do Hyeon` 대체 후보 있음).
2. 회의 소집 트리거 UX를 "단일 버튼 + 팝오버"로 확정했으나(§7.2), 팀장 회의 등 교차 시나리오는 Phase 2 검토.
3. 데크 폭(220px 카드 기준) 및 캔버스 전체 사이즈(20×14 그리드 기준 최소 뷰포트 1280×800 권장)는 프론트팀 구현 시 실측 조정 여지.
