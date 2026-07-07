# 팀메이크 오피스 — 디자인 최종안 "심야의 스튜디오 (After-Hours Studio)"

> 담당: @디자인팀장 (최종 결정권자) · 종합 기반: `office-plan.md` + `office-ux.md` + `office-ui.md`
> 목적: UX/UI 산출물을 종합하여 충돌을 해소하고 **단일 소스(single source of truth)**로 확정한다. 개발(순수 HTML5 Canvas 프로시저럴 렌더링, 외부 이미지 에셋 0개)이 그대로 import 해서 쓸 수 있도록 모든 수치를 기계용 스펙 `office-spec.json`과 1:1로 일치시킨다.
> **이 문서와 `office-spec.json`이 충돌하면 `office-spec.json`이 우선한다.**

---

## 0. 팀장 결정 요약 (Executive Decisions)

이 프로젝트에서 UX 문서와 UI 문서가 좌표계·룸배치·NPC홈·좌석에서 서로 다른 두 격자(UX=22×14 규모 22×16, UI=20×14)를 제시했다. 개발이 단일 렌더러 하나만 짜야 하므로 **하나로 못박는다.**

| # | 쟁점 | UX 안 | UI 안 | 팀장 확정 | 근거 |
|---|---|---|---|---|---|
| D1 | 아이소 상수 | tileW64/tileH32, origin(720,160), 캔버스1440×900, 그리드22×16 | tileW64/tileH32, origin(640,120), 그리드20×14 | **UX 안 채택** (origin 720,160 / 캔버스 1440×900 / 그리드 22×16) | UX가 복도·문·팀별 경로까지 좌표로 완결. 실제 투영 검산 결과 diorama가 캔버스 x[240..1392] y[160..736]로 깔끔히 중앙 안착. UI의 20×14는 복도/경로 미정의라 회의소집 연출을 못 굴림 |
| D2 | 룸 배치·회의실 위치 | 회의실 그리드 정중앙 (8,7) 6×4, 상단3룸+하단3룸+십자복도 | 회의실 하단 (6,11) 8×3 | **UX 안 채택** | 회의실 정중앙 배치가 6팀 이동거리 3~9타일로 균등 → 연출 안무가 이미 초단위로 확정돼 있음 |
| D3 | NPC 17명 home 좌표 | 전역 격자 절대좌표(검산 통과: 17명 전원 룸 내부·중복 없음) | 룸 로컬 좌표 | **UX 전역좌표 채택** | 렌더러는 전역좌표 하나만 먹으면 됨. 검산 통과가 결정타 |
| D4 | meetingSeats | 6석 (gy7 상단3 / gy10 하단3), 테이블 (10,8) 2×2 | 7석 (row11 5 / row13 2) | **UX 6석 + 상단정중앙 리드석 채택**, 단 UI의 "6인 이상 대비" 취지 반영해 seatId 5까지 6석 유지(최대팀=기획 5인이라 6석으로 전 시나리오 커버) | 좌석이 테이블 둘레로 마주보게 배치돼 "회의" 실루엣이 즉시 읽힘 |
| D5 | 디스플레이 서체 | (미지정) | **Gugi** 확정 제안 (대안 Do Hyeon) | **Gugi 최종 확정** | 굵은 라운드 스텐실형 한글 디스플레이 → 크래프트 사인보드 + 레트로컴퓨팅 무드 정확히 부합. Inter/Roboto/system/Space Grotesk 금지목록 회피. next/font `Gugi` 단일 웨이트(400) 지원 |
| D6 | 모노/한글 서체 | (UI에 위임) | IBM Plex Mono + IBM Plex Sans KR | **그대로 확정** | 한글 지원·터미널 캐릭터·금지목록 회피 3조건 충족 |
| D7 | 데스크 배치 좌표계 | (룸 라벨만) | 룸 로컬 좌표표 | **home = 데스크 위치로 통합** (NPC가 자기 데스크에 서있음) + 룸별 데코 1개 | 데스크와 NPC home을 분리하면 좌표 두 벌 관리 → 버그원. NPC home 타일 = 그 사람 데스크로 단일화 |
| D8 | 회의소집 트리거 UX | 좌하단 [회의 소집 ▸] → 팀 6개 드롭업 | 단일 버튼 + 팀 6개 미니 팝오버 | **단일 버튼 + 팝오버 확정** | 데크 공간 절약, UX/UI 이미 수렴 |
| D9 | 조명 4단계 | (UI에 위임, 60초 루프) | morning/midday/evening/night 각 15초, 틴트·램프알파 확정 | **그대로 확정** | 아트디렉션 4단계 지침과 정확히 일치, night가 머니샷 |

> **핵심 결론**: 좌표·공간은 **UX 문서를 캔버스 스펙으로**, 비주얼·토큰·드로잉·조명·크롬은 **UI 문서를 스타일 스펙으로** 채택한다. 두 문서가 좌표에서 부딪히면 UX, 색·폰트·픽셀디테일에서 부딪히면 UI가 이긴다. 이 규칙으로 전 충돌을 무손실 병합했다.

---

## 1. 아트디렉션 확정

**컨셉**: 심야의 스튜디오(After-Hours Studio). AI 에이전트 회사의 따뜻한 램프불빛 미니어처 아이소메트릭 오피스 디오라마. Monument Valley급 깔끔한 2:1 아이소 지오메트리 + 코지 에디토리얼 색감 + 미세 종이 그레인 오버레이. 다크 베이스라 램프/모니터 불빛이 고인다. 무드: 코지-녹턴 / 크래프트 / 레트로-컴퓨팅.

**anti-generic 강제 규칙(전면 준수)**: 보라-화이트 그라디언트 금지 / Inter·Roboto·system·Space Grotesk 금지 / 중앙정렬 히어로 금지(모바일 안내 카드만 예외) / 기본 shadcn 카드 금지 / 이모지 아이콘 남발 금지 / 균등 무지개 팔레트 금지. 다크-웜 심야스튜디오 아이덴티티를 전면에 일관.

---

## 2. 디자인 토큰 (확정)

### 2.1 베이스 컬러

| 토큰 | Hex | 용도 |
|---|---|---|
| `--ink-bg` | `#15161d` | 페이지 최외곽 배경, 캔버스 letterbox |
| `--wall-plum-1` | `#3a2f3a` | 벽면 기본(밝은 쪽) |
| `--wall-plum-2` | `#4a3b46` | 벽면 보조(그림자면) |
| `--floor-clay-1` | `#b98a63` | 바닥 체커 A(낮 원색) |
| `--floor-clay-2` | `#a97b56` | 바닥 체커 B(낮 원색) |
| `--accent-marigold` | `#f4b942` | 브랜드 시그널 — 램프광/하이라이트/active/배너점 |
| `--accent-verdigris` | `#4ec9b0` | 차가운 대비 — 스크린 글로우/보조 인터랙션 |
| `--text-warm` | `#f2ede3` | 본문/타이틀 텍스트 |
| `--text-muted` | `#9a9488` | 보조 텍스트/캡션/비활성 |
| `--border-hairline` | `rgba(242,237,227,0.10)` | 카드/패널 1px 보더 |
| `--shadow-soft` | `rgba(0,0,0,0.45)` | 패널 드롭섀도 |

### 2.2 팀 컬러코드 (NPC teamHue)

| 팀 | Hex | HSL 대략 |
|---|---|---|
| 기획 planning | `#f4b942` | 브랜드 앰버와 동일(의도) |
| 디자인 design | `#ef8e7a` | 웜 코랄 |
| 프론트 frontend | `#6db8e8` | 스카이 |
| 백엔드 backend | `#4ec9b0` | 베르디그리 틸 |
| QA qa | `#b58ce0` | 소프트 바이올렛 |
| 배포 deploy | `#b7c26a` | 올리브 |

6색 모두 채도·명도 근접(HSL L 62~74% / S 55~70%)으로 톤온톤 조화, 균등 무지개 회피. 기획팀=브랜드 앰버 동일은 의도(본진 톤, 회의소집 앰버 글로우와 공명).

### 2.3 NPC 공통색 & 시맨틱

| 토큰 | Hex |
|---|---|
| `--npc-skin` | `#e8b48a` |
| `--npc-outline` | `rgba(21,22,29,0.55)` |
| `--npc-shadow` | `rgba(15,15,20,0.35)` |
| `--lead-pin` | `#d9a441` |

| 상태 | 색 | 표현 |
|---|---|---|
| idle | `#9a9488` | 회색 도트 |
| walking | `#4ec9b0` | 청록 도트 |
| working | `#f4b942` | 앰버 도트(은은한 pulse) |
| meeting | `#b58ce0` | 바이올렛 도트 |

### 2.4 스페이싱 & 반경

기본 4px 그리드. 패널 패딩 12/16/24. 라운드: 사원증 12px, 데크 버튼 6~8px, 데크 카드 10px.

---

## 3. 타이포 확정 (next/font, 한글 필수)

| 역할 | 서체 | next/font | 웨이트 | 폴백 |
|---|---|---|---|---|
| 모노(UI크롬/라벨/시계/역할) | **IBM Plex Mono** | `next/font/google` → `IBM_Plex_Mono` | 400/500/600 | `ui-monospace, monospace` |
| 한글 본문/상태문구/이름 | **IBM Plex Sans KR** | `next/font/google` → `IBM_Plex_Sans_KR` | 400/500/700 | `"Malgun Gothic", sans-serif` |
| 디스플레이/타이틀락업 | **Gugi** (최종확정) | `next/font/google` → `Gugi` | 400 단일 | `"Nanum Pen Script", sans-serif` |

`spec.json` fonts 키와 일치: `{ display:"Gugi", mono:"IBM Plex Mono", korean:"IBM Plex Sans KR" }`.

### 3.1 타입 스케일

| 용도 | 서체 | size/lh/weight | 자간 |
|---|---|---|---|
| 타이틀락업 KR "팀메이크 오피스" | Gugi | 20/24/400 | 0.02em |
| 타이틀락업 EN "TEAM MAKES · OFFICE" | Plex Mono | 10/14/500 up | 0.12em |
| SIMULATION 배너 | Plex Mono | 12/16/500 | 0.04em |
| 데크 라벨 | Plex Mono | 11/14/500 up | 0.06em |
| 사원증 이름 | Plex Sans KR | 16/20/700 | 0 |
| 사원증 역할 | Plex Mono | 11/14/500 | 0.02em |
| 사원증 상태 | Plex Sans KR | 12/16/400 | 0 |
| 시계(스크러버) | Plex Mono | 13/16/600 tabular | 0.02em |

---

## 4. 아이소 투영 상수 (확정 — UX 채택)

```
tileW = 64, tileH = 32   (2:1 다이아몬드)
originX = 720, originY = 160   (그리드(0,0)의 화면 좌표)
canvas = 1440 × 900   (디자인 기준 해상도)
gridBounds = 22 cols × 16 rows
wallHeight = 48px (타일 1.5배), deskHeight = 28px

cartToIso(gx,gy):
  x = originX + (gx - gy) * (tileW/2)
  y = originY + (gx + gy) * (tileH/2)

isoToCart(sx,sy):
  a = (sx - originX)/(tileW/2)
  b = (sy - originY)/(tileH/2)
  gx = (a + b)/2 ;  gy = (b - a)/2

zSort(gx,gy): renderOrder = gx + gy  (동률 시 바닥<벽<데스크<NPC, 이후 삽입순)
```

검산: 그리드 4모서리 투영 = (720,160)/(240,400)/(1392,496)/(912,736) → 캔버스 1440×900 내 안착 확인.

**압출 프리즘 렌더 규칙**: 윗면 base+brightness(1.12) / 좌면 base 100% / 우면 base×brightness(0.72). 접지 그림자 = `rgba(15,15,20,0.35)` 타원(가로=코 폭 55%, 세로 18~22%), 블러 없이 하드엣지+알파. 길고 드라마틱한 그림자 금지.

---

## 5. 룸 배치 (6 업무룸 + 1 회의실 + 복도) — 확정

전역 그리드 22×16, 겹침 없는 격자 셀. 좌상단 원점.

| roomId | 방 이름 | 팀 | origin(gx,gy) | size(w×h) | 셀범위 | 문(door) | 바닥(주간) | 벽 |
|---|---|---|---|---|---|---|---|---|
| `planning-room` | 기획실 | planning | (1,1) | 6×5 | gx1-6, gy1-5 | (6,3) | `#b98a63`/`#a97b56` | `#3a2f3a` |
| `design-studio` | 디자인 스튜디오 | design | (8,1) | 5×5 | gx8-12, gy1-5 | (8,3) | 〃 | `#4a3b46` |
| `dev-room` | 개발실 | frontend | (14,1) | 6×5 | gx14-19, gy1-5 | (14,3) | 〃 | `#3a2f3a` |
| `meeting-room` | 회의실 | 공용 | (8,7) | 6×4 | gx8-13, gy7-10 | (8,8)/(13,8)/(10,7)/(11,7) | 〃(워밍 액센트) | `#3a2f3a` |
| `server-room` | 서버실 | backend | (1,11) | 6×4 | gx1-6, gy11-14 | (6,12) | `#ad8462`/`#9d7451`(톤다운) | `#4a3b46` |
| `qa-lab` | QA랩 | qa | (8,12) | 5×3 | gx8-12, gy12-14 | (8,13) | 〃 | `#3a2f3a` |
| `deploy-room` | 배포실/옥상 서버 | deploy | (15,11) | 5×4 | gx15-19, gy11-14 | (15,12) | `#ad8462`/`#9d7451`(가장 어둡게) | `#4a3b46` |

**복도(corridor)**: 십자형 스켈레톤 — 세로대 gx=7(전 rows), 가로대 gy=6 및 gy=15(전 cols). 모든 방 door가 여기 접속. 복도 바닥은 룸과 구분되게 무채색 클레이 `#8f7256`.

바닥 체커: `(gx+gy)%2===0 ? floor-clay-1 : floor-clay-2`, 룸 로컬 좌표 기준 재시작 + 1px grout `rgba(21,22,29,0.25)` 타일 보더. `server-room`/`deploy-room`은 야간 대비 예열로 주간에도 채도 5% 다운(위 표 톤다운 값).

### 5.1 데스크/오브젝트 배치 (전역 좌표 — home=데스크 통합)

각 NPC의 home 타일 = 그 사람 데스크(NPC가 데스크 앞에 섬). 팀장 데스크는 룸 입구 근처 앞쪽(위계 암시). 룸당 데코 1개.

| roomId | 오브젝트 | 전역(gx,gy) | 타입 |
|---|---|---|---|
| planning-room | 리드데스크(팀장) | (2,2) | desk |
| planning-room | 데스크(창의기획자) | (4,2) | desk |
| planning-room | 데스크(창의팀원) | (2,4) | desk |
| planning-room | 데스크(비평기획자) | (4,4) | desk |
| planning-room | 데스크(비평팀원) | (5,3) | desk |
| planning-room | 책장(데코) | (1,5) | shelf |
| design-studio | 리드데스크(디자인팀장) | (9,2) | desk |
| design-studio | 데스크(UX디자이너) | (11,2) | desk |
| design-studio | 데스크(UI디자이너) | (10,4) | desk |
| design-studio | 무드보드(데코) | (8,5) | board |
| dev-room | 리드데스크(프론트팀장) | (15,2) | desk |
| dev-room | 데스크(컴포넌트개발자) | (17,2) | desk |
| dev-room | 데스크(페이지개발자) | (16,4) | desk |
| dev-room | 모니터랙(데코) | (19,5) | monitorRack |
| server-room | 리드데스크(백엔드팀장) | (2,12) | desk |
| server-room | 데스크(API설계자) | (4,12) | desk |
| server-room | 데스크(DB설계자) | (3,13) | desk |
| server-room | 서버랙(데코, 틸글로우) | (1,14) | serverRack |
| qa-lab | 리드데스크(QA설계자) | (9,13) | desk |
| qa-lab | 데스크(QA실행자) | (11,13) | desk |
| qa-lab | 버그보드(데코) | (8,14) | board |
| deploy-room | 데스크(배포엔지니어) | (17,12) | desk |
| deploy-room | 서버안테나/옥상(데코) | (19,14) | antenna |
| meeting-room | 회의 테이블(중앙 프리즘) | (10,8) | table (2×2) |

`serverRack`은 night 단계에서 베르디그리 틸 글로우, `antenna`는 배포 올리브 미세 발광, 그 외 데코는 무발광.

### 5.2 회의실 좌석 (meetingSeats) — 확정

테이블 anchor (10,8) 2×2. 좌석은 테이블 둘레 6석, 서로 마주봄.

| seatId | (gx,gy) | 향(flip) |
|---|---|---|
| 0 (리드 우선석) | (9,7) | 남향 |
| 1 | (10,7) | 남향 |
| 2 | (11,7) | 남향 |
| 3 | (9,10) | 북향 |
| 4 | (10,10) | 북향 |
| 5 | (11,10) | 북향 |

배정정책: 소집 팀 인원만큼 seatId 0부터 순번 배정. isLead 멤버 우선 seatId 0(테이블 상단 정중앙). 최대팀=기획 5인 → 6석으로 전 시나리오 커버.

---

## 6. NPC 드로잉 스펙 (프로시저럴 — 리얼리즘 금지)

### 6.1 형태·비율

- 몸통: 둥근 콩/캡슐, 폭 18px × 높이 22px. 몸통색 = teamHue.
- 머리: 원 지름 16px, 몸통 상단 60% 겹침(목 생략). 머리색 = `#e8b48a` 전원 공통.
- 다리: 하단 짧은 스텁 2개(폭4×높4). 팔은 별도 path 없이 몸통 좌우 bulge로 암시.
- 아웃라인: 1px `rgba(21,22,29,0.55)`(완전블랙 금지, 소프트 크래프트).
- 팀장 마커(isLead): 머리 위 오른쪽 3px 원 + 짧은 핀 stem, 색 `#d9a441`. (스케일 변경 방식은 z-sort 복잡도 때문에 배제 → **핀 마커 확정**)

### 6.2 idle (2프레임 bob + 방별 마이크로 제스처)

- F0(600ms) 기준 y0 → F1(600ms) y −1px, ease-in-out.
- 방별 F1 제스처: planning/design=펜 까딱(2×2 점 좌→우 3px), dev/server/deploy=타이핑(1.5px 점 2개 교차 깜빡), qa=생각("…" 머리 위 3점 순차 페이드), meeting중=펜/생각 랜덤.

### 6.3 walk (4방향 × 3프레임)

- 방향: col+/row+ SE · col−/row− NW · col+/row− NE · col−/row+ SW.
- 프레임 `[0,1,2,1]` 순환(각 80~100ms): F1 스쿼시 scaleY0.94+다리벌림+그림자폭+8%, F2 y −2px+다리모임.
- 방향 기울기 skewX ±3deg, 향하는 쪽 몸통 절반 밝기 +6%.
- 이동속도: 1타일당 500~700ms(시뮬 틱 ~1초 + rAF 보간). 회의소집 안무는 0.35s/타일 기준(§8).

### 6.4 접지 그림자

타원 가로=몸통폭55% / 세로=20%, 색 `rgba(15,15,20,0.35)`, walk F1에서 가로+8%, 블러없음.

### 6.5 로스터 17명 (전역 home 확정 — spec.json과 1:1)

| agentId | name | team | role | roomId | teamHue | isLead | home(gx,gy) |
|---|---|---|---|---|---|---|---|
| planner-lead | 기획팀장 | planning | 최종 결정권자 | planning-room | #f4b942 | ✓ | (2,2) |
| creative-lead | 창의기획자 | planning | 창의 파트 리더 | planning-room | #f4b942 | | (4,2) |
| creative-member | 창의팀원 | planning | 아이디어 발산 | planning-room | #f4b942 | | (2,4) |
| critic-lead | 비평기획자 | planning | 비평 파트 리더 | planning-room | #f4b942 | | (4,4) |
| critic-member | 비평팀원 | planning | 리스크 지적 | planning-room | #f4b942 | | (5,3) |
| design-lead | 디자인팀장 | design | 디자인 최종 종합 | design-studio | #ef8e7a | ✓ | (9,2) |
| ux-designer | UX디자이너 | design | 플로우/와이어프레임 | design-studio | #ef8e7a | | (11,2) |
| ui-designer | UI디자이너 | design | 비주얼/디자인 시스템 | design-studio | #ef8e7a | | (10,4) |
| fe-lead | 프론트팀장 | frontend | 코드리뷰/아키텍처 | dev-room | #6db8e8 | ✓ | (15,2) |
| fe-component | 컴포넌트개발자 | frontend | UI 컴포넌트 구현 | dev-room | #6db8e8 | | (17,2) |
| fe-page | 페이지개발자 | frontend | 페이지/API 연동 | dev-room | #6db8e8 | | (16,4) |
| be-lead | 백엔드팀장 | backend | 시스템 아키텍처 종합 | server-room | #4ec9b0 | ✓ | (2,12) |
| be-api | API설계자 | backend | 엔드포인트/인증 | server-room | #4ec9b0 | | (4,12) |
| be-db | DB설계자 | backend | 데이터 모델링 | server-room | #4ec9b0 | | (3,13) |
| qa-designer | QA설계자 | qa | 테스트 전략/설계 | qa-lab | #b58ce0 | ✓ | (9,13) |
| qa-runner | QA실행자 | qa | 테스트 실행/버그헌팅 | qa-lab | #b58ce0 | | (11,13) |
| deploy-eng | 배포엔지니어 | deploy | 빌드게이트/Vercel배포 | deploy-room | #b7c26a | ✓ | (17,12) |

isLead = 팀당 정확히 1명(팀장 or 단독 배포엔지니어) = 핀 마커 대상. 전 17명 룸 내부·중복 없음 검산 통과.

---

## 7. 조명 4단계 (60초 루프) — 확정

전체 60초 = 4단계×15초, 단계 사이 2초 크로스페이드(틴트 알파 선형 보간). 진입 시 "낮(midday)"에서 시작.

| 단계 | name | 화면 틴트 rgba | 램프 알파 | 지속(초) |
|---|---|---|---|---|
| 아침 | morning | `rgba(139,160,196,0.14)` | 0.15 | 15 |
| 낮 | midday | `rgba(255,255,255,0.03)` | 0.05 | 15 |
| 저녁 | evening | `rgba(244,150,66,0.16)` | 0.55 | 15 |
| 밤 ★머니샷 | night | `rgba(15,18,32,0.62)` | 0.85 | 15 |

- 램프 글로우: `createRadialGradient` 중심=각 데스크 상단 중앙, 반경=tileW×1.4(≈90px). stop `0% #f4b942(a=lampAlpha)` → `60% #f4b942(a=lampAlpha×0.35)` → `100% transparent`. `globalCompositeOperation="lighter"`(가산).
- 스크린 글로우: 색 `#4ec9b0`, 반경 tileW×1.0, evening/night만 렌더.
- 밤 어두운 방(야근 대비): `server-room`/`deploy-room`/`qa-lab` 벽·바닥 명도 ×0.88. 나머지 4룸은 밤에도 상대적으로 밝게 유지.

---

## 8. 회의 소집 안무 (킬러 연출) — 확정 타임라인

경로 = [home] → [방 door] → [세로복도 gx=7 교차점] → [회의실 인접 door] → [배정 seatId]. 런타임 pathfinding 없음, 팀별 하드코딩 waypoint 배열.

```
t=0.0s  [회의 소집 ▸] → 팀 선택 → 버튼 "소집 중...(○○팀)" disabled
t=0.3s  1번째 NPC(isLead) 출발, 이후 0.3s 스태거로 순차 출발
        이동 소요 = 경로타일수 × 0.35s/타일
t≈3.5~5s 순차 도착 → seatId 착석, state="meeting"
t=5s    회의실 상단 얇은 라벨 "○○팀 회의 중"(모노, 팀컬러 언더라인) 페이드인
t=5~17s "회의 중" 유지(12초)
t=17s   라벨 페이드아웃, 역순 0.3s 스태거로 복귀
t≈20~22s 전원 home 복귀 state="idle", 버튼 재활성화
전체 ≈ 22~30초. 진행 중 타 팀 소집 버튼 disabled(동시 회의 금지·큐잉 없음).
```

**팀별 사전 정의 경로(room door → 회의실 door)**:

| team | room door | 복도 교차점 | 회의실 door |
|---|---|---|---|
| planning | (6,3) | (7,3)→(7,6) | (8,8) |
| design | (8,3) | (8,4)→(8,6) | (10,7) |
| frontend | (14,3) | (13,3)→(13,6) | (13,8) |
| backend | (6,12) | (7,12)→(7,11) | (8,8) |
| qa | (8,13) | (8,12)→(8,11) | (8,8) |
| deploy | (15,12) | (14,12)→(13,11) | (13,8) |

---

## 9. 페이지 크롬 (DOM, 데스크톱 전용 ≥1024px)

### 9.1 SIMULATION 배너
상단 고정 얇은 잉크 스트립(height 28px, bg `#101018`). 텍스트 `● SIMULATION — 실제 에이전트는 로컬에서 동작`(Plex Mono 12px, `--text-muted`). 앰버 점(6px, `#f4b942`)만 1.6s 깜빡(sim-blink). 노란 경고바 절대 금지. `prefers-reduced-motion` 시 고정 점등.

### 9.2 컨트롤 데크 (좌하단 플로팅, left/bottom 20px)
인셋+드롭섀도 카드(bg `#1b1c24`, radius 10, `box-shadow: 0 8px 24px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.04)`). 구성:
1. `[회의 소집 ▸]` 단일 버튼 + 클릭 시 팀 6개 미니 팝오버(확정). 진행 중 "소집 중...(○○팀)" disabled.
2. 낮/밤 스크러버(가로 슬라이더 180×4, 4단계 눈금 마커, 드래그 수동 스크럽 가능, `clock` 텍스트 "18:42" 앰버 tabular-nums).
3. 속도 토글 `1x`/`0.6x`(느리게) 2단 세그먼트, active=앰버 채움.

active 요소 딱 하나만 앰버로 튐(균일 강조 금지).

### 9.3 사원증(ID카드) 팝업
클릭 NPC 근처 절대배치, width 220, bg `#1e1e27`, radius 12, `transform: rotate(-2deg)`. 등장 `id-card-in` 0.18s cubic-bezier(0.2,0.8,0.3,1.1)(살짝 tilt로 "톡" 놓임). 구조: 팀컬러 헤더(44px, 미니 프로시저럴 아바타) → 이름(Plex Sans KR 700 16px) → 역할(Plex Mono 뮤트 11px) → 상태행(색 도트 + 문구). 뻔한 모달 금지.
위치: 기본 NPC 우상단(+16,-140), 우측경계 초과 시 좌상단 반전, 상단경계 초과 시 하단 반전. 닫힘: 바깥클릭/ESC/다른 NPC/60초 무동작.

### 9.4 페이지 배경 & 그레인/비네트
body bg `#15161d`. 스테이지 wrapper 중앙정렬(스테이지 배치용, 히어로 아님). 비네트 `radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%)`. 그레인: SVG `feTurbulence(fractalNoise, baseFrequency 0.9, numOctaves 2)` → data-uri 고정 1장, `opacity .05`, `mix-blend-mode: overlay`(애니 아님, 정적 텍스처 — anti-AI 크래프트).

### 9.5 타이틀 락업 (코너 좌상단, top 40 left 20)
KR "팀메이크 오피스"(Gugi 20px) / EN "TEAM MAKES · OFFICE"(Plex Mono 10px up, 뮤트). 에디토리얼 배치, 중앙정렬 금지.

### 9.6 모바일 가드 (<1024px)
스테이지/데크/락업 `display:none`, `.mobile-guard`만 표시(잉크 bg + 중앙정렬 안내 카드 — 이 화면만 중앙정렬 예외). "이 시뮬레이션은 데스크톱(1024px 이상)에서 최적화되어 있습니다." + 미니 타이틀 락업. 스테이지 미마운트(성능 보호).

### 9.7 z-index 레이어 (아래→위)
페이지bg(그레인) < 캔버스 스테이지 < 컨트롤 데크(40) < 그레인 오버레이(45) < SIMULATION 배너(50) < 사원증 팝업(60).

---

## 10. 접근성 (WCAG 2.1 AA) — 확정

1. 텍스트 대비: `#f2ede3` on `#15161d`/`#3a2f3a` = AA 이상. `#9a9488`는 큰 텍스트/보조에만.
2. 캔버스 대체텍스트: `sr-only` 요약 "팀메이크 오피스: 17명 AI 에이전트가 6개 팀에서 근무 중인 아이소메트릭 시뮬레이션."
3. 컨트롤은 전부 실제 `<button>`/`<input type=range>` DOM(캔버스 밖) → 키보드 조작 가능.
4. focus-visible 앰버 2px 아웃라인.
5. `prefers-reduced-motion`: walk→즉시이동, 틴트→즉시전환, 팝업→opacity만, 배너점→고정점등.
6. 팝업 `role="dialog"` `aria-labelledby`(이름) `aria-describedby`(역할+상태), 닫힘 후 포커스 복귀.

---

## 11. 오픈 이슈 (개발/PM 확인 요망)

1. **에셋 라이선스 리스크 원천 해소**: 이 디자인은 외부 이미지 에셋 0개(전부 프로시저럴 코드 렌더). 기획서 오픈이슈 "무료 타일셋 라이선스"는 **N/A로 종결** — 확인 부담 사라짐.
2. **성능 게이트**: 17명 + 6룸 + 램프 글로우(lighter 합성)의 실측 프레임 미확정. QA 게이트로 NPC 1→5→10→17 단계 프레임 측정 필요. 램프 글로우 radial-gradient가 매 프레임 재생성되면 병목 → 오프스크린 캐싱 전제 권고.
3. **캔버스 스케일**: 뷰포트 1024~1439px는 내부좌표 1440×900 고정 + CSS `transform: scale(0.72~1)`. 1440px+ 1:1 중앙정렬. 좌표 재계산 없음(스펙 준수).
4. **복도 door 좌표 미세조정**: qa 팀 회의실 진입을 (8,8)로 통일했으나 backend와 door 경합 가능 → 구현 시 도착 슬롯 순차 처리(스태거로 자연 회피).
5. **이스터에그 대사(Phase 1.5)**: 사원증 하단 "최근 활동 한 줄" 슬롯은 스펙에 자리만 마련(demo 어댑터가 문자열 주입). Phase 1 필수 아님.

---

## 12. 개발 인계 체크리스트

- [x] 아이소 상수(tileW/tileH/origin/투영식/zSort) — §4, spec.iso
- [x] 6업무룸+1회의실 좌표/색/오브젝트/복도 — §5, spec.rooms
- [x] NPC 17명 로스터(전역 home) — §6.5, spec.npcs
- [x] meetingSeats 6석 — §5.2, spec.meetingSeats
- [x] 조명 4단계 틴트/램프알파/지속 + 밤 어두운 방 — §7, spec.lighting
- [x] 디자인 토큰 hex + 폰트 3종 확정(Gugi/IBM Plex Mono/IBM Plex Sans KR) — §2·§3, spec.palette/teamHues/fonts
- [x] NPC 드로잉 스펙(비율/색/아웃라인/idle·walk) — §6
- [x] 회의 소집 안무 타임라인 + 팀별 경로 — §8
- [x] 페이지 크롬(배너/데크/사원증/그레인/비네트/락업/모바일가드) — §9
- [x] 접근성 — §10

**단일 소스**: `docs/design/office-spec.json` (기계용, 이 문서와 충돌 시 우선).
