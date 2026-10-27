# 「문단속 5」(cloudcheck) — 디자인 최종안 (STEP 3-b)

> 작성: @디자인팀장(Opus) · 2026-10-19 · STEP 3 종합 산출물
> 입력: `docs/design/cloudcheck-ux-spec.md`(UX, 2,838줄) + `docs/design/cloudcheck-ui-spec.md`(UI, 1,349줄)
> 상위 기준: `docs/planning/project-direction-cloudcheck.md`(방향서, **최우선**) · 디자인팀장 STEP 2 검토 원문 `docs/design/cloudcheck-lead-review.md` · 기획서 `docs/planning/cloudcheck-plan.md`
> 대상: `src/app/cloudcheck/_client/**`(STEP 4 프론트) · 문구 검수 대상 `src/lib/cloudcheck/rules/i18n/ko.ts`(DB설계자)
> **지위: STEP 4 구현 기준.** 이 문서와 UX·UI 스펙이 충돌하면 **이 문서가 우선한다.** 방향서와 충돌하면 방향서가 우선하고, 방향서 범위를 건드리는 결정은 "권고 + 확인 필요 대상 + 잠정 기본값"으로 표기했다(§1-3). UX·UI 스펙 파일은 고치지 않았다. 이 문서가 가리키는 절(예: "UX §4-4")은 **이 문서의 변경분을 반영해 읽는다.**

**표기**: [확인: 근거] 이번 세션에 실행·대조로 확인 / [일반 지식] 널리 알려진 사양, 원문 재확인 안 함 / [미확인] 확인 못 함(§12로 이월) / [설계 판단] 디자인팀장 결정 / ⟨잠정⟩ 다른 팀 확인 전까지 쓰는 기본값. **[확인]이 아닌 사실과 통계 수치는 제품 문구에 쓰지 않는다**(기획서 원칙).

**이번 세션에 직접 실행한 검증** (레포에는 아무것도 두지 않았다. 스크립트는 세션 스크래치패드에만 있다)
1. 금지어: 방향서 §7-3 `findBanned()` 원문을 그대로 옮겨 UX 카피 덱 762행 + §9 예시 89행 + 이 문서 §8-2의 변경·추가 카피 89키 + 권고 문구 6건(약한 제목 5개·면책 권고문)에 실행했다(§10-1). UX디자이너가 "코드 실행 도구가 없어 텍스트 검색으로 대신했다"고 남긴 부분을 실제 실행으로 바꿨다.
2. CSS 바이트: 레포에 설치된 esbuild 0.21.5(node 22.10.0)의 `transform({loader:'css', minify:true, charset:'utf8'})`로 이 문서 §4의 CSS를 압축해 쟀다. 문법 경고 0, CR 0, `</style` 0 [확인: 실행].
3. Figma 도구는 이번 세션에 연결돼 있지 않다 [확인: 도구 목록]. 기존 관례대로 마크다운 스펙과 텍스트 와이어로 낸다.

---

## 0. 확정 요약

1. **화면은 V0~V8 아홉 개 + 겹침 요소 3개**(예외 인라인 폼, 인쇄 옵션, 리포트 닫기 확인 `<dialog>`)다. URL·해시는 바꾸지 않고, `history.state`에는 `{ cc: ScreenId }`만 넣는다(`ScreenId = "start"|"prep"|"input"|"report"|"fix"|"compare"|"demo"|"catalog"|"about"`).
2. **리포트는 목록이다.** 문 단위 종합 배지는 화면에도 **인쇄에도** 그리지 않는다(`worstStatus`는 UI 미사용, 정답지 전용). 분포는 점검 단위, 상태 글자는 어디서도 줄이지 않는다.
3. **상태 도형(▲◆●■◌)은 상태 글자 바로 옆에서만** 쓴다. `StatusIcon`을 import할 수 있는 곳은 `StatusBadge`·`DistributionChips`·`StatusLegend` 셋뿐이다. 입력 읽기 실패·비교 거부·미판정 줄은 **'확인 불가 톤'(회색 바탕 + 실선 + 6px 빗금 띠)만** 쓰고 ■는 쓰지 않는다.
4. **점검 행은 기본으로 접힌다.** 접힘은 V3~V5에서 `<details>`가 아니라 **버튼 + 영역**으로 만든다. `[고치는 법]`은 접힌 줄에서도 보인다.
5. **인쇄 펼침은 CSS로 강제한다.** `beforeprint` 같은 JS 이벤트에 기대지 않으므로 Ctrl+P·브라우저 메뉴 인쇄도 같은 결과가 나온다. 이상 없음 대상은 인쇄에서 목록을 줄이고 생략 사실을 한 줄로 남긴다.
6. **인쇄 마스킹은 항상 기본이다.** '이름·ID 표시'는 인쇄 버튼 흐름에서만 루트 클래스를 붙였다가 `print()` 직후 뗀다. 메뉴 인쇄는 언제나 마스킹본이다.
7. **사용자 데이터는 `MaskedValue`로만 그린다.** 속성(`aria-label`·`title`·`placeholder`·`document.title`)에는 사용자 데이터가 0이다. `t()`는 `DisplayValue`를 받지 않고, 사용자 데이터가 섞인 문장은 `<T>`·`<Msg>`가 노드로 조립한다.
8. **앱 안 이동은 `href` 없는 버튼**이다(워드마크·메뉴·건너뛰기·구역 이동). `href`는 `DocLink`와 `DownloadLink` 두 관문에만 있다.
9. **다크 토큰은 `@media screen and (prefers-color-scheme:dark)`로만** 건다. 인쇄는 자동으로 라이트가 되므로 인쇄용 토큰 재선언 블록을 없앴다(토큰 3벌 → 2벌). 다크 `line-strong`·`na-line`은 **#646C79**로 바꾼다(표면 위 2.96 → 3.28).
10. **알림 묶음은 3변형**(강한 공지·일반·예외 요약) + 체험 안내(보라)다. UI의 `scope` 변형은 없애고, 확인 불가 톤은 알림이 아닌 별도 블록(`.cc-untone`)으로 둔다.
11. **직접 볼 목록은 화면에 체크 칸을 그리지 않는다**(번호 목록). 빈 체크 칸과 메모 열은 인쇄에만 나온다.
12. **예외 표시는 위험·주의 대상에만** 붙인다. 라벨 문구는 고위험 지점 #12 기준 "예외 표시(상태는 그대로) · 사유 · 만료일까지"다.
13. **`beforeunload`는 실제 리포트에만** 건다. 창 전체 드롭은 V0·V1이면 V2로 가서 읽고, V2면 그대로 읽고, 그 밖의 화면이면 삼키고 안내한다.
14. **CSS 실측 29.66KiB**(골격 3파일 14.2KB + 컴포넌트 기준안 16.2KB, 압축 후, gzip 6.9KB). 화면 CSS는 목표 1KiB·상한 2KiB다. 방향서의 CSS 30KiB는 '목표'이고 실패 기준이 없어 STEP 4가 멈추지 않는다. 넘으면 34KiB로 올리는 것을 기획팀장에게 권고한다.
15. **금지어 실제 실행 결과**: 카피 덱 762키 위반 0(히트 2건은 방향서 허용 키), 이 문서의 변경·추가 카피 89키와 권고 문구 6건 위반 0(면책 권고문의 히트는 기존 허용 키 범위).
16. **룰 제목**: 강한 수정 5건을 ⟨잠정⟩ 적용하고(기획팀장 확인), 약한 수정 4건은 권고로 둔다.
17. **오프라인판 SHA-256 값은 페이지에 적지 않는다.** 파일은 자기 해시를 담을 수 없으므로, V0·V8에는 게시 채널과 `sha256sum` 대조법만 둔다. 해시 대조 입력칸은 v1.1로 미룬다(같은 페이지 값과만 비교하므로 위조 페이지 앞에서는 소용이 없다. 기획서 #17과 같은 이유).
18. **수집기 정리·붙여넣기**: 백엔드 검토의 C-12("내려받았으면 Enter" → 수집기가 파일 삭제)와 `--print`를 ⟨잠정⟩ 기본값으로 문구를 쓴다. 사용자가 직접 입력하는 줄은 정상 경로에서 두 줄 그대로다.
19. **P1(마지막에 만들고 먼저 자른다)**: 화면 가리기(D11) → 체험 안내 패널. 해시 대조 칸은 STEP 4에서 만들지 않는다.
20. **V0의 Azure 버튼은 '펼침 버튼'**(`aria-expanded`)이다. `aria-disabled`를 단 채 클릭에 반응하는 모호한 패턴을 쓰지 않는다.

---

## 1. 쟁점 결정

### 1-1. UX 쟁점 Q1~Q21

| # | 쟁점 | 결정 | 이유 | 영향 파일·담당 | 확인 필요 → ⟨잠정⟩ |
|---|---|---|---|---|---|
| Q1 | 오프라인판 SHA-256을 HTML 안에 적을 수 없음 | **UX 권고 채택.** V0 A10·V8 J3에는 값 대신 게시 채널(저장소 릴리스·PDF 개정판·쪽)과 `sha256sum` 대조법만 적는다. 채널이 `null`이면 '준비 중'. V1의 **수집기** 해시는 별도 데이터 블록의 해시라 값을 그대로 보인다 | 파일이 자기 해시를 담는 순간 해시가 바뀐다. `PAGE.sha256`은 G5 테스트와 라이브 검증에만 쓴다 | `screens/Start.tsx`·`About.tsx`(페이지개발자), 템플릿(프론트팀장: 페이지 해시를 HTML에 넣지 않음) | 프론트팀장 통보(차단 아님) |
| Q2 | 금지어 정규식이 사실 수치·'우선순위'·'%'까지 막음 | **정규식은 G0 동결 그대로.** 카피가 피한다: 수치+분·초 없음, '순위' 대신 '먼저 볼 순서', 경과는 '시간·일'만, 전파 지연은 "시간이 걸릴 수 있습니다" | 수치를 빼도 뜻이 거의 줄지 않는다. 허용 키를 늘리면 검사에 구멍이 생긴다. **렌더 검사는 체험 데이터 문자열도 훑으므로** 가짜 리소스 이름·값에도 금지 토큰을 넣지 않는다(DB설계자) | 카피 전부, `fixtures/companies`(DB설계자) | 기획팀장 → ⟨현행 유지, 허용 키 추가 0⟩ |
| Q3 | "직접 입력 두 줄"과 남은 파일 지우기(`rm`) 충돌 | **백엔드 검토 §2-1 ⑨의 C-12 흐름을 기본으로 한다.** 수집기가 마지막에 "내려받았으면 Enter"를 묻고 그 파일을 지운다. `--yes`로 실행해 질문이 없을 때만 `rm` 직접 입력 안내 + 메뉴 Delete 경고. 단계 7은 "(선택 · 마지막 단계)" 유지, 제목은 UX의 "수집에 필요한 입력은 두 줄" 유지 | 정상 경로에서 사용자가 치는 줄은 두 줄 그대로다(방향서 §7-4와 정합). Delete 메뉴는 홈 디렉터리 전체를 지운다 [확인: UX §0-4 ⑥] | `cc.prep.cleanup.body` 변경, `cc.prep.cleanup.manual` 추가(§8-2) | API설계자·백엔드팀장(프롬프트 구현) → ⟨있다고 보고 문구 작성. 구현하지 않으면 UX 원문(`rm` 직접 입력)으로 되돌림⟩ |
| Q4 | 붙여넣기 경로의 출력 방식 미정 | **`--print`** (백엔드 검토 §2-6 "경로 ③용으로 결과 JSON을 표준출력에도"). 플래그 글자는 카탈로그에 넣지 않고 `config.ts`의 `COLLECTOR_FLAGS.print`에서 `{flag}` 파라미터로 넣는다. 파라미터는 문장 끝 콜론 뒤에 둔다(조사 문제 회피) | 사용자 입력 줄이 늘지 않는다(두 번째 줄 끝에 옵션) | `cc.prep.paste.body` 변경, `config.ts`(페이지개발자) | API설계자·백엔드팀장 → ⟨`--print`⟩ |
| Q5 | 룰 제목 수정 제안 5건 + 약한 4건 | **강한 5건 ⟨잠정⟩ 적용, 약한 4건은 권고(기본은 방향서 제목 유지)**, AWS-MFA-2는 유지하되 해당 없음 근거 줄 필수. 최종 표 §9 | G7의 "제목×상태 검토 표 완료"는 디자인팀장 담당 게이트다. ✕(오독) 판정을 남긴 채 G7을 닫을 수 없다. ID·priority·사유 코드는 그대로이고 `cc.rule.<id>.title` 문구만 바뀐다 | `rules/i18n/ko.ts`(DB설계자) | 기획팀장(방향서 §6-1 제목 표 소유) → ⟨강한 5건 적용⟩ |
| Q6 | R-03(범위 패널 접기 금지) vs 360px 첫 화면 | **순서는 데스크톱과 같게 유지한다**(방향서 §12: "리포트 첫 화면" = 최상단 블록). 모바일 압축: `dt` 위·`dd` 아래, 못 보는 것 7개는 14px 1열(전부 노출), 거부된 호출·권한 해제 힌트는 각각 상위 3개 + 나머지 접힘. 첫 화면 신호는 고정 맥락 줄의 '확인 불가 n'이 맡는다 | 위치 학습과 R-03을 지키면서 높이를 줄이는 최소안이다 | `ScopePanel`(컴포넌트개발자) | — (STEP 5 실측) |
| Q7 | `beforeunload` 범위 | **실제 리포트(`report.mode.kind === "real"`)만.** 체험은 걸지 않는다 | 다시 만들 수 있는 체험에 경고를 걸면 경고가 소음이 된다 | `state/unload.ts`(페이지개발자) | 프론트팀장 통보 |
| Q8 | 창 전체 드롭 동작 | **UX §6-5 처리표 채택.** `window`의 `dragover`·`drop`은 언제나 `preventDefault`. V0·V1 → V2로 가서 읽기 / V2 → 읽기 / V3~V5 → 삼키고 `cc.app.drop.ignored-report` / V6~V8 → 삼키고 `cc.app.drop.ignored` | 리포트 덮어쓰기와 페이지 이탈(브라우저가 파일을 여는 것)을 함께 막는다 | `state/drop.ts`(페이지개발자) | — |
| Q9 | 예외 표시 대상 | **위험·주의 대상에만 `[예외로 표시]`.** 불러온 예외 파일이 다른 상태의 대상과 맞으면 라벨은 그대로 보이고 상태는 바뀌지 않는다 | 확인 불가에 예외를 붙이면 '알면서 모른 척'이 된다. 이상 없음에는 예외로 할 것이 없다 | `TargetTable`의 `canMarkException` | — |
| Q10 | 화면 체크박스 | **화면에는 체크 칸을 그리지 않는다**(번호 목록). 인쇄에만 5mm 빈 칸 + 메모 열(행 10mm 이상). UI의 화면 체크박스는 폐기 | 화면 체크는 '확인 완료'(고위험 #12)로 읽히고, 메모리에만 있어 새로 고침하면 사라진다 | `ManualCheckList`, `print.css` | — |
| Q11 | V5 `became-unknown` 오독 | **맨 위 묶음 + 강조 줄**(`cc.compare.became-unknown.note`) + 변화 칸에 `Chip--strong` | 위험이 확인 불가로 바뀐 것을 해결로 읽으면 녹색 과신과 같은 사고가 난다 | `BeforeAfterTable` | — |
| Q12 | `document.title`의 사용자 데이터 | **금지. 범위를 넓혀 모든 속성 값에도 사용자 데이터 0**(§5-0 R1). 제목은 고정 문구와 점검 제목(정적 데이터)만 | 탭 제목은 기록에 남고 인쇄 PDF 기본 파일 이름이 된다 [일반 지식]. 속성 문자열은 `MaskedValue`의 인쇄 마스킹을 우회한다 | `state/screens.ts`, 모든 컴포넌트 | — |
| Q13 | 해시 대조 입력칸 ⟨P1⟩ | **STEP 4에서 만들지 않는다(v1.1 검토).** `cc.prep.hash.compare.*` 5키 삭제 | 이 칸은 이 페이지에 적힌 값과만 비교한다. 페이지가 위조됐다면 값도 함께 위조되므로 '일치'가 거짓 안심을 준다. 기획서 #17이 같은 이유로 '붙이기 전 검사 칸'을 보류했다 | 카피 삭제 | — |
| Q14 | 체험 카드 순서·안내 패널 | **C → D → A → B, 세트 글자 비표시 채택.** 체험 안내 패널(DemoGuide)은 P1(컷 순서 0.5: D11 다음) | 위험 → 확인 불가 → 이상 없음/해당 없음 → 주의 순으로 배운다 | `DemoCards`, `screens/Demo.tsx` | — |
| Q15 | 화면 가리기(D11) | **P1 채택(방향서 컷 0순위)**. 루트 클래스 `cc-screen-mask`, 기본 꺼짐, 켜면 맥락 줄에 `cc.ctx.screen-mask` | 이중 렌더를 이미 하므로 비용이 작다 | `print.css` ①, `StickyContextBar` | — |
| Q16 | 문서 안 이동의 `href="#…"` | **금지. 건너뛰기·구역 이동·"직접 확인하는 방법 3가지 →"는 버튼 + `focus()`** | 해시가 바뀌면 R-06과 '해시 불변'에 어긋난다. `href` 관문 규칙(방향서 §2-4)이 AST 수준에서 같이 막는다 | `SkipButton`·`JumpNav` | — |
| Q17 | `recognize()` 힌트 | **모델 변경 없이 `detail`에 담아 달라고 요청**: `detail.hint = {c:"exceptions-file"}`, `detail.tail = {v: DisplayValue}`. tail은 입력 끝 40자, `sensitive`/`freeText`, **비밀 패턴 검사를 거쳐 걸리면 `redacted`** | 잘린 붙여넣기 진단과 예외 파일 오투입 안내에 필요하다. tail에 비밀이 섞일 수 있어 같은 관문을 지나야 한다 | `parse/recognize.ts`(API설계자) | API설계자 → ⟨없으면 일반 문구(`cc.recog.parse-error.reason`, `not-cloudcheck`)만⟩ |
| Q18 | 알림 밀도 | **강한 공지는 항상 펼침, 일반 알림은 제목 버튼 + 접힌 본문(인쇄 펼침), 예외 요약은 한 줄**. 순서는 UX §4-4a 표 그대로 | 최대 약 10종이 쌓여도 첫 화면을 덮지 않게 | `ReportNotices` | — (STEP 5 실측) |
| Q19 | 인쇄 반복 머리·바닥 | **MVP는 반복 줄 없음.** 첫 쪽 머리 + 마지막 바닥 면책 전문만 | 브라우저 지원이 달라 [미확인], 반복 줄을 넣으면 허용 키가 없는 축약 면책문을 새로 써야 한다 | `PrintHead`, `print.css` | — (v1.1 재검토) |
| Q20 | 졸업 경로의 CIS 링크 | **글자만**(링크 없음). Prowler·Defender는 `LINK_HOSTS` 안 | `LINK_HOSTS` 변경 없이 끝난다 | `cc.c.grad.line` | — |
| Q21 | 확정 면책문의 '항목' | **권고**: "'확인 불가' 항목과" → "'확인 불가'로 표시된 점검·대상과"(금지어 히트는 기존 허용 키 범위 안 [확인: 실행]) | §7-1 용어 규칙('항목' 금지)과 확정문이 어긋난다 | `cc.disclaimer.body` 1키 | 기획팀장 → ⟨확정문 그대로⟩ |

### 1-2. UI 쟁점 1~4 (+ UI §9-1의 나머지)

| # | 쟁점 | 결정 | 이유·근거 |
|---|---|---|---|
| UI-1 | CSS 예산 30KiB 초과 위험, 측정 기준 | **실측했다**(§4-1). UI 스펙 원문 CSS(골격 + 컴포넌트 10군 발췌)는 21,513B. 이 문서의 최종 골격 + 컴포넌트 전부 기준안은 **30,372B = 29.66KiB**(gzip 6,889B). 측정 기준은 ⟨잠정⟩ "esbuild 압축 후 바이트(gzip 전)" — HTML에 인라인되는 실제 크기다. 화면 CSS는 목표 1KiB·상한 2KiB. 적용한 절감: 인쇄 토큰 블록 제거(`screen and`), `scope` 배너 변형 제거, CloudChoiceCard 제거, 펼침 페이드 제거, 인쇄 URL 표시 제거, 체크박스 네이티브화, 표→카드 공용 클래스(`cc-ct`), 배지·칩 공통 선언 병합 | 방향서 §2-3의 CSS 행은 실패 기준이 '—'(목표)다. 측정·보고만 하고 STEP 4는 멈추지 않는다. 화면 CSS까지 더해 30KiB를 넘으면 **34KiB로 상향을 기획팀장에게 권고**(실측 근거: 29.66 + 화면 최대 2 + 여유). gzip 영향은 약 +0.6KB다 → 확인: 프론트팀장(측정 기준), 기획팀장(상향) |
| UI-2 | 입력 읽기 실패 패널의 회색 톤 | **채택하되 규칙을 단다.** '확인 불가 톤'(바탕 `--cc-unknown-bg` + 1px `--cc-unknown-line` + 6px 띠 + 빗금)만 쓰고, **■ 도형과 '확인 불가' 글자는 쓰지 않는다.** 제목은 `cc.recog.<status>.title`("읽지 못했습니다" 등). V5 비교 거부, V2 계정 불일치, V3 미판정 줄, 권한 해제 힌트도 같은 블록이다 | 회색 = '탓이 아닌 할 일' 톤은 유지하고, 판정 '확인 불가'와 헷갈리는 두 신호(도형·글자)만 뺀다 |
| UI-3a | 확인 불가 왼쪽 띠 6px(다른 상태 4px) | **채택** | 빗금이 보이는 최소 폭이고, 회색을 옅게 처리하지 않는 원칙과도 맞는다(더 무겁게). 가시성은 STEP 5 |
| UI-3b | 워드마크 밑줄 예외 | **채택.** 워드마크는 `<button class="cc-hdr__brand">`(href 없음), 평소 밑줄 없음·hover 밑줄 | 앱 안 이동이라 링크가 아니라 버튼이다. 메뉴 2개는 링크 모양 버튼(`.cc-link--nav`, 밑줄 있음) |
| UI-3c | 분포 칩 0 표시(`--zero`) | **채택**: 바탕 없음 · 1px `--cc-line` · 글자 `--cc-ink-2`(8.78:1) · 숫자 400 · 아이콘은 상태 색 유지 | 0도 표시·순서 고정(D3)을 지키면서 0이 아닌 칩이 먼저 눈에 들어온다 |
| UI-3d | `light-dark()` 미사용 | **채택 + 개선.** 다크 블록을 `screen and`로 묶어 인쇄 재선언 블록을 없앴다(약 1.1KB 절감) | 구형 브라우저에서 모든 색이 무효가 되는 위험을 피하면서 중복은 줄였다. 다크 OS에서 라이트로 인쇄되는지는 STEP 5 |
| UI-4 | UX와 맞출 접점 | 상태 글자·문 이름 = UX 카피(`cc.status.*`, `cc.door.*`) / 배너 매핑 = §6-4 표 / 인쇄 머리·바닥 = `PrintHead`(`.cc-phead--full\|--list`) + 바닥 `Disclaimer` / `document.title` = UX §6-1 표(사용자 데이터 0) / 템플릿 메타 = 아래 | 접점 7개 모두 이 문서에서 닫았다 |
| UI-4 메타 | `color-scheme`·`theme-color`·description | 프론트팀장에게 요청: `<meta name="color-scheme" content="light dark">`, `theme-color` 라이트 #FFFFFF·다크 #0F1115(미디어 쿼리 2개), `<meta name="description">` = `cc.start.tagline` 문구. 방향서 §2-2 머리 순서의 viewport·title 다음 | 폼 컨트롤·스크롤바가 테마를 따른다. HTML 바이트만 바뀌고 해시는 빌드가 다시 계산한다 → 확인: 프론트팀장 ⟨추가⟩ |
| UI §9-1 #2·#3 | 다크 #646C79 / 토큰 이름 `risk·caution·clear·unknown·na` | **채택**(§4) | 결정 M(상태 문자열 단일화)을 CSS까지 |
| UI §9-1 #5 | Danger 버튼·폼 오류 빨강 없음 | **채택** | 빨강은 '위험' 판정 전용 |
| UI §9-1 #8 | 인쇄 반전 → 테두리형, 배경 보존은 배지·칩만 | **채택** | 브라우저 기본 인쇄는 배경을 찍지 않는다 [일반 지식] |
| UI §9-1 #10 | 아이콘 15종(lucide 5종 ISC) + `/*! */` 고지 | **채택** + V8에 한 줄 고지 `cc.about.oss` | 고지 전문은 번들 끝(`legalComments:'eof'`)에 남는다. G5에서 grep |
| UI §9-1 #12 | 해시 묶음(`<span>` + `<wbr>`) 복사 결과 | 유지, STEP 5 확인. 이어지지 않으면 `.cc-hash__g{display:inline-block}` 대안 | — |
| UI §9-1 #13 | `forced-colors` 블록 | **유지**(예산 안) | Windows 고대비 사용자 |

### 1-3. 다른 팀 확인이 필요한 항목과 ⟨잠정⟩ 기본값 (STEP 4는 이 값으로 진행)

| # | 항목 | 확인 대상 | ⟨잠정⟩ 기본값 | 바꾸면 고칠 곳 |
|---|---|---|---|---|
| X1 | CSS 측정 기준 | 프론트팀장 | esbuild 압축 후 바이트(gzip 전) | 예산 테스트 1줄 |
| X2 | CSS 목표 상향 30 → 34KiB | 기획팀장 | 목표 30KiB 유지, 실패 기준 없음(방향서 그대로), D4 실측 보고 | 예산 표 |
| X3 | 금지어 정규식·허용 키 | 기획팀장 | 현행 유지, 허용 키 추가 0 | — |
| X4 | 룰 제목 강한 수정 5건 | 기획팀장(→DB설계자 반영) | 5건 적용(§9) | `rules/i18n/ko.ts` 5줄 |
| X5 | 룰 제목 약한 수정 4건 | 기획팀장 | 미적용(방향서 제목) | 4줄 |
| X6 | 면책문 '항목' | 기획팀장 | 방향서 확정문 그대로 | `cc.disclaimer.body` 1줄 |
| X7 | C-12 "내려받았으면 Enter" 삭제 프롬프트 | API설계자·백엔드팀장 | 있다고 보고 문구 작성 | `cc.prep.cleanup.*` 2키 |
| X8 | 붙여넣기용 출력 플래그 | API설계자·백엔드팀장 | `--print` | `config.ts` 1줄 |
| X9 | `recognize().detail`의 `hint`·`tail` | API설계자 | 없으면 일반 문구만 | — |
| X10 | `parseExceptions` 실패 `issues`를 코드 문자열로 | API설계자 | `"format"\|"reason"\|"until"\|"span"\|"rule"\|"too-many"`(시그니처 `string[]` 그대로). 모르는 값은 `format`으로 표시 | `cc.report.exc.issue.*` |
| X11 | `_client` import 허용 목록 추가: `contract/collect-schema.ts`의 `LIMITS`, `contract/exceptions-schema.ts`의 `EXCEPTION_MAX_DAYS`, 새 `contract/rg-queries.ts`(KQL 원문, API설계자) | 프론트팀장·API설계자 | 추가한다(이름 지정 import만). 방향서 §4-5가 "UI가 `file.size`로 LIMITS를 먼저 본다"고 정했는데 §3 규칙 4의 허용 목록에 없어 생긴 공백이다 | 가드 테스트 허용 목록 |
| X12 | 템플릿 메타(color-scheme·theme-color·description) | 프론트팀장 | 추가 | 템플릿 |
| X13 | 푸터 저장소 링크 `REPO_URL` | PM(G9) | `null` → 링크 숨김, "만든 곳: Boundaryworks"만 | `config.ts` |
| X14 | `worstStatus`를 인쇄 요약에도 그리지 않음 | 기획팀장 통보 | 그리지 않음(방향서 "쓸 수 있는 곳"의 축소) | — |
| X15 | 마스킹 사본 파일 이름 | API설계자 | `cloudcheck-masked.json`(계정 숫자 없음) | `DownloadLink` 호출 1곳 |
| X16 | 수집기 원문 문별 구간 표식 | API설계자 | 정규식 상수 하나(`config.ts`의 `SCRIPT_SECTION_RE`)로 맞춘다. 표식을 못 찾으면 전체를 한 덩어리로 보인다(원문은 항상 보임) | `config.ts` 1줄 |

---

## 2. 충돌 해소 로그

### 2-1. UX ↔ UI

| # | 지점 | UX 스펙 | UI 스펙 | **최종(이유)** |
|---|---|---|---|---|
| C1 | 알림 변형 수 | 3종(강한 공지·일반·예외 요약) | 6종(info·scope·strong·exception·unknown·demo) | **알림 묶음은 strong·info·exception 3종 + 체험 안내 demo.** `scope`(점선) 폐기 → `info`. `unknown`은 알림이 아니라 확인 불가 톤 블록 `.cc-untone`으로 분리. 점선은 이미 '해당 없음·수집 안 함·추정 칩·비활성'이 쓰고 있어 의미가 겹친다 |
| C2 | 루트 클래스 이름 | `cc-print-unmask` · `cc-print-list-only` · `cc-screen-mask` | `cc-print-full` · `cc-print-manual` · `cc-screen-masked` | **UX 이름.** `cc-print-full`은 '전체 리포트 인쇄'와 헷갈린다 |
| C3 | 직접 볼 목록 체크 칸 | 화면 없음, 인쇄만 | 화면에 `.cc-box` 체크박스 | **UX**(Q10). 인쇄 빈 칸은 CSS 상자(`.cc-mc__box`, 글자 '☐' 아님) |
| C4 | 스티키 해제 높이 | 600px 이하: 띠는 줄어든 채 고정, 맥락 줄만 해제 | 520px 이하: 둘 다 해제 | **UX.** 띠(28px)는 베타·체험 표식이라 남기고, 큰 쪽(맥락 줄 40~64px)만 푼다. 1920×1080 200%(540px)도 해제 대상이 된다 |
| C5 | 점검 행 구조 | `<h3><button aria-expanded>` + 같은 줄의 다른 버튼은 밖 | `<details><summary>` | **UX 구조.** `[고치는 법]`을 접힌 줄에 둘 수 있고(요약줄 안에 버튼 중첩 불가), 인쇄 펼침을 CSS로 강제할 수 있다(`<details>`의 닫힌 내용은 CSS로 못 연다 [일반 지식]) |
| C6 | 점검 행 기본 상태 | 접힘(`[자세히 ▾]`, 먼저 볼 3개에서 "펼치고 포커스") | 위험·주의·확인 불가 펼침 | **모두 접힘.** 요약줄(상태·제목·사유·대상 수·`[고치는 법]`)로 훑고, 먼저 볼 3개가 위에서 고른다. 인쇄는 위험·주의·확인 불가를 CSS로 펼친다 |
| C7 | 인쇄 링크 | 제목 + 호스트 글자 | URL 전체를 뒤에 붙임 | **UX**(종이에서 긴 URL은 읽기를 방해하고 바이트도 든다) |
| C8 | 경로 선택 | 라디오 카드 2개(화살표 키) | 카드 + `[이 경로로]` 버튼 | **라디오 카드.** 단, 라디오를 숨기지 않고 보이는 네이티브 라디오 + 카드 전체 `<label>`(`:has()` 의존 제거) |
| C9 | 체험 고르기 | 클라우드 라디오 + 회사 카드마다 버튼 | 라디오 카드 4장 | **UX.** 4장이 동등한 선택이라 버튼 4개는 모두 보조 버튼(주 버튼 없음). 버튼 접근 이름에 회사 이름(정적 문구) 포함 |
| C10 | V0 클라우드 선택 | 버튼 4개(AWS 주 버튼) | CloudChoiceCard 큰 카드 | **버튼.** CloudChoiceCard 폐기(주 버튼이 흐려지고 CSS가 든다) |
| C11 | Azure 준비 중 | `aria-disabled` + 이유 글자 + 누르면 안내 | 비활성 점선 카드 | **펼침 버튼**(`aria-expanded`, `Chip--soon` "준비 중"). 누르면 같은 자리에 안내와 `[Azure 체험 보기]` |
| C12 | 화면 전환 h1 포커스 링 | 보이게 둔다 | `h1[tabindex="-1"]:focus{outline:none}` | **`:focus-visible`만 따른다.** 키보드로 이동했으면 링이 보이고 마우스면 안 보인다(UI의 숨김 규칙 삭제) |
| C13 | 상태 도형 사용처 | 와이어에 "■ 읽지 못했습니다", "■ 비교하지 않았습니다", "■ 아직 판단하지 못한…" | 오류 패널에는 도형 금지 | **도형은 상태 글자 옆에서만**(§0의 3번). 세 곳 모두 확인 불가 톤 블록, 도형 없음 |
| C14 | 예외 라벨 | "예외 표시 · {사유} · {만료일}까지" | "예외 표시(상태는 그대로): 사유 · 만료일" | **고위험 #12 기준**: "예외 표시(상태는 그대로) · {reason} · {until}까지"(방향서 §7-3: 16곳 대안을 카피 기준으로 채택) |
| C15 | 본인 응답 라벨 | "본인 응답: {answer} · 검증하지 않음" | "본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지" | **#12 기준**: "본인 응답: {answer}(검증 안 됨) · 상태는 확인 불가 유지" |
| C16 | `prodImpact` 칩 | "운영 영향 가능" | "운영 중단 가능" | **UX.** `prodImpact`의 정의는 '현재 접속·요청에 영향'이라 '중단'은 과장이다 |
| C17 | 영향도 클래스 | — | `cc-impact--mid` | **모델 값 그대로 `cc-impact--low\|medium\|high`**(런타임 이름 변환 없음) |
| C18 | 먼저 볼 3개의 대상 표시 | `[대상 n개 보기]` 버튼(행으로 이동·펼침·포커스) | '대상 n' 칩 | **UX 버튼** |
| C19 | 띠 펼치기 | 줄어든 띠에 `[펼치기]` 버튼 | 스크롤 위치로 자동 | **버튼 없음.** 줄어든 띠도 "[베타] 실계정 검증 전" / "[체험 모드] 가짜 데이터"를 유지한다. 뒷부분은 `max-height:0`이라 스크린리더에는 계속 읽힌다 |
| C20 | 띠 문구 구조 | 문장 1키 + 짧은 1키 | 태그·굵은 구절·보조 줄 | **태그·줄·보조 3키**(`cc.band.<beta\|demo>.<tag\|row\|more>`, §8-2) |
| C21 | 화면 글자 | 와이어·카피 덱 | 스펙 속 예시 글자("읽음", "끌어다 놓거나…") | **모든 글자는 UX 카피 덱 + 이 문서 §8-2.** UI 스펙의 글자 예시는 구속력이 없다 |
| C22 | 펼침 움직임 | 펼침·접힘 120ms | `<details>` 내용 페이드인 120ms | **화살표 회전 120ms 하나.** 페이드인은 기본 펼침 상태로 렌더될 때 '진입 애니메이션'이 된다 |
| C23 | 체크박스 | — | 직접 그린 `.cc-box`(체크 위치 [미확인]) | **네이티브 + `accent-color: var(--cc-ink)`**(인쇄 옵션 한 곳만 남음) |
| C24 | 고정 맥락 줄 화면 | V3·V4 | 미지정 | **V3·V4** |
| C25 | 머리 메뉴 | 버튼(워드마크) | `<a>` | **전부 `<button>`**(방향서 §2-4: `href`는 관문에서만) |
| C26 | 읽은 파일 목록 | 표(열 7개, `th scope`) | `<ul>` 행 | **표**(모바일은 `cc-ct` 카드 + role 보강) |
| C27 | 띠·맥락 줄 접근 이름 | `<aside aria-label="안내 띠">`, `cc.ctx.aria` "계정과 기준 시각" | `role="region"` "베타 안내", "점검 대상 계정" | **UX 카피 키** |

### 2-2. 스펙 ↔ 방향서 (+ 검토 원문)

| # | 지점 | 스펙·검토 원문 | 방향서 | **최종** |
|---|---|---|---|---|
| D1 | `worstStatus` | UX·UI: 화면 미사용 | "정렬, 인쇄 요약, 정답지에만 쓴다" | **UI 어디에도 그리지 않는다(인쇄 포함).** 문 색 하나가 작은 종합 판정이 된다는 D2의 이유는 종이에도 그대로다. 정렬은 엔진이 이미 끝내 오므로 UI가 쓸 일이 없다(→ X14) |
| D2 | 셸 직접 입력 "두 줄뿐"(§7-4) | UX Q3: `rm`이 세 번째 줄 | 기획서 C-12: 남은 파일 지우기 안내 | C-12를 수집기 Enter 프롬프트로 처리(Q3) → 정상 경로는 두 줄 그대로 |
| D3 | 면책문 '항목' | UX Q21 | §7-1 '항목' 금지 vs §7-2 확정문 | 구체 규정(확정문) 우선 ⟨잠정⟩, 한 단어 수정 권고(→ X6) |
| D4 | 신원 표기 | R-13 "화면 전체, 인쇄 마스킹" | 기획서 §5-5 "계정 별칭 + ID 끝 4자리" | **신원은 화면·인쇄 모두 '별칭 + ••••끝4자리'.** `identity.account`(전체 ID)는 그리지 않는다. 맥락 줄은 스크린샷용 장치라 전체 ID가 찍히면 안 된다. 별칭은 화면 전체·인쇄 마스킹(`alias-001`) |
| D5 | 인쇄와 `<details>` | 검토 원문 §2-7·UX §6-6: `beforeprint`로 펼침 | G5 STEP 5 이월 "인쇄(`<details>` 펼침)" | **V3~V5에 `<details>`를 쓰지 않는다**(C5). STEP 5 항목은 "CSS 강제 펼침 확인"으로 바뀐다 |
| D6 | 인쇄 '이름·ID 표시' | UX·UI: 옵션이 루트 클래스를 바꿈 | R-13 마스킹 기본값 | 클래스는 **인쇄 버튼 흐름 동안만**(§6-0). 옵션을 켜 둔 채 잊어도 메뉴 인쇄는 마스킹 |
| D7 | KQL 원문 출처 | UX: 쿼리 블록 2개 | §4-7 KQL은 계약 문서, §3 규칙 4 허용 import 밖 | `contract/rg-queries.ts`(API설계자) + 허용 목록 추가 ⟨잠정⟩(→ X11). Azure 개방 전까지는 화면에 나오지 않는다 |
| D8 | `LIMITS` 사용 | UX: 드롭존에 25MB·20MB | §4-5 "UI가 `file.size`로 LIMITS를 먼저 본다" vs §3 규칙 4 | 허용 목록에 추가 ⟨잠정⟩(→ X11). 카피 숫자와 상수가 같은지 테스트한다(§11-2 G-D25) |
| D9 | 고위험 16곳 | UX 카피 일부가 #12와 다름 | §7-3 끝: "16곳 대안을 카피 덱 기준으로 채택" | 라벨 3키를 #12에 맞춤(C14·C15) |
| D10 | 전체 선택 | UX: 키보드 포커스 때 `Selection.selectAllChildren` | §7-4 "클릭 한 번에 전체 선택", §2-4 `user-select: all`은 KQL·해시만 | **채택.** Selection API는 클립보드 API가 아니다. CSS 전체 선택은 두 곳(`.cc-cmd--kql .cc-cmd__pre`, `.cc-hash`)뿐 |
| D11 | 번역 차단 범위 | UX §6-13: 명령·해시·ID 블록도 `translate="no"` | §2-4: V2~V5 컨테이너와 MaskedValue | **방향서 범위 + 명령·해시 블록**(V1에서도 명령 글자가 번역되면 안 된다) |
| D12 | 고치는 법 '대안' 칸 | UX §9-5 `change-alt`, `cc.c.cli.irreversible` | 모델 `FixGuide.change`는 하나, 되돌릴 수 없음 표시 필드 없음 | **모델을 바꾸지 않는다.** 대안 경로와 '되돌릴 수 없는 변경입니다' 경고는 DB설계자가 `change`(또는 `revert`) 문구 안에 문장으로 쓰고, 명령은 `change.commands` 순서로 둔다. `cc.c.cli.irreversible` 키는 삭제 |
| D13 | 확인 불가 사유 목록 `gaps` | UX: "판단하지 못한 이유" 목록 | `gaps: UnknownReason[]`(파라미터 없음) | 파라미터가 필요한 긴 문장 대신 **짧은 이름 `cc.reason.short.<코드>`**로 나열한다 → DB설계자가 21종 전부 작성(현재 UX 권고안 7종) |
| D14 | 직접 볼 목록 `what`·`why` | UX: `cc.rule.aws-mfa-2.auto.what/why/how` | `what: MsgRef`(MessageCode), `why: MsgRef<UnknownReason> \| null`, `howKey: CatalogKey` | '무엇을' 칸 = [점검 제목(있으면)] + [대상 이름(있으면)] + `what`. `why`가 `null`이면 origin별 대체 문장(`cc.c.manual.why.*`, guide-card는 `cc.c.guide.badge-note`). auto-notice는 `what`=`fact:idp-mfa`, `why`=`null`, `howKey`=`cc.rule.aws-mfa-2.auto.how`로 표현한다(DB설계자) |

---

## 3. 화면 구조(IA)와 핵심 플로우

### 3-1. 화면 목록 (최종)

| ID | `ScreenId` | 화면 | 핵심 액션(주 버튼) | 필요한 데이터(없으면 V0) | `<main>` 번역 |
|---|---|---|---|---|---|
| V0 | `start` | 시작 | [AWS 점검 시작] | — (정적 HTML이 먼저 그림) | 허용 |
| V1 | `prep` | 수집 준비 | ② [수집기 내려받기] / ① [결과 파일 넣기 →] | 선택한 클라우드 | 허용(명령·해시 블록만 `translate="no"`) |
| V2 | `input` | 결과 파일 넣기 | [이 계정으로 리포트 보기] (비교 모드 [비교 보기]) | — | `translate="no"` |
| V3 | `report` | 리포트 | **주 버튼 없음.** 시각적 핵심은 '먼저 볼 3개' 블록, 그 안 `[고치는 법]`은 보조 버튼(주 버튼 3개가 생기지 않게) | `Report` | `translate="no"` |
| V4 | `fix` | 고치는 법 | [고친 뒤 다시 수집해서 비교하기 →] (체험: [학습용 계정으로 실제로 해 보기 →]) | `Report` + `ruleId` | `translate="no"` |
| V5 | `compare` | 재점검 비교 | [이번 리포트 보기] | `Comparison` | `translate="no"` |
| V6 | `demo` | 체험 모드 | 회사 카드의 [이 회사 리포트 보기] ×4(동등, 보조 버튼) | — | 허용 |
| V7 | `catalog` | 판정 규칙 | 점검 하나 펼쳐 읽기 | `RULE_CATALOG` | 허용 |
| V8 | `about` | 이 도구에 대해 | [오프라인판 내려받기] | 앱 설정 | 허용 |

**전역 요소**: 띠(베타/체험, 둘을 쌓지 않음) → 머리(워드마크·판정 규칙·이 도구에 대해, 버튼 3개) → (V3·V4) 고정 맥락 줄 → `<main tabindex="-1">` → 바닥. 라이브 영역 2개(`polite`·`assertive`)는 앱 루트 첫머리. 부팅 대체 안내·`<noscript>`는 정적 HTML(프론트팀장 템플릿). 체험 상태(V3·V4가 체험 리포트일 때, V6)는 보라 띠 + 안쪽 4px 프레임.

**띠 선택 규칙**: `screen ∈ {demo}` 이거나 (`screen ∈ {report, fix}` 이고 `report.mode.kind === "demo"`)이면 체험 띠, 그 밖은 베타 띠(`CLOUD_AVAILABILITY.aws === "beta"`인 동안).

### 3-2. 플로우와 전이표

- 플로우 F1~F5, F1-b, 이탈·복구, 휴먼에러 ①~⑦ 대응은 **UX §2-0~2-9를 최종본으로 지정**한다. 바뀐 점: F1 단계 9(남은 파일 지우기)는 수집기의 Enter 프롬프트(Q3), F1-b 단계 1은 `bash cloudcheck-aws.sh --print`(Q4), F1 단계 4의 '대조해 보기' 칸은 없음(Q13).
- 전이표 T1~T20은 **UX §3-5를 최종본으로 지정**한다. 바뀐 점: **T2**(Azure `soon`)는 화면 이동이 아니라 같은 자리 펼침(`aria-expanded`). T1~T4·T11의 확인 `<dialog>`는 실제 리포트가 있을 때만(체험 → 새 점검은 확인 없음).
- 계정 혼동 5겹(UX §2-1)은 그대로다: 셸 확인 → V2 인식 목록·버튼 문구 → V3 신원 줄·맥락 줄 → V4 대상 계정 줄 → V5 비교 거부.

---

## 4. 최종 CSS

### 4-1. 파일 구성 · 로드 순서 · 예산(실측)

| 파일 | 소유 | 내용 | 압축 후 [확인: 실측] |
|---|---|---|---|
| `_client/styles/tokens.css` | 컴포넌트개발자 | §4-2 그대로 복사 | 2,453B |
| `_client/styles/base.css` | 컴포넌트개발자 | §4-3 그대로 복사(리셋·컨트롤·접힘·표·상태 리맵·빗금·아이콘 클래스·움직임) | 9,047B |
| `_client/components/*.css` | 컴포넌트개발자 | §4-5 기준안을 컴포넌트별 파일로 나눠 옮긴다 | 16,163B |
| `_client/screens/screens.css` | 페이지개발자 | 화면 배치 전용(V0 머리 블록, V1 단계 목록, V7 목록 간격 등). 컴포넌트 클래스와 `.cc-stack`·`.cc-wrap`·`.cc-cards`를 먼저 재사용 | 목표 1KiB · 상한 2KiB |
| `_client/styles/print.css` | 컴포넌트개발자 | §4-4 그대로 복사 | 2,712B |
| **합계(화면 CSS 제외)** | | | **30,372B = 29.66KiB, gzip 6,889B** |

- **import 순서**(`main.tsx`): `tokens.css` → `base.css` → 컴포넌트 CSS(각 컴포넌트 파일에서 import) → `screens.css` → **`print.css` 맨 마지막**. esbuild는 import 순서대로 잇는다 [일반 지식]. G5에서 번들 CSS의 마지막 `@media print`가 `print.css` 것인지 확인한다.
- **비교**: UI 스펙에 적힌 CSS 전부(골격 3파일 + 아이콘·리맵·빗금 + 컴포넌트 10군 발췌)는 같은 방식으로 21,513B였다. UI디자이너의 손계산(약 24.1KB)보다 약 2.6KB 작다.
- **측정 방법**: 레포 `node_modules/esbuild`(0.21.5)의 `transform`(`loader:'css'`, `minify:true`, `charset:'utf8'`). 문법 경고 0. ⟨잠정⟩ 측정 기준 = 압축 후 바이트(gzip 전)(→ X1).
- **화면 CSS를 상한(2KiB)까지 쓰면 약 31.7KiB**로 방향서 목표(30KiB, 실패 기준 없음)를 넘는다. D4 통합 실측에서 넘으면 프론트팀장이 기획팀장에게 **34KiB 상향**을 요청한다(→ X2). 그 전에 쓸 수 있는 추가 절감: `forced-colors` 블록(약 190B), `.cc-di--32`(V0 다섯 곳을 24px로), `.cc-legend`를 범례 문장 한 줄로.
- **금지**(방향서 §2-3~2-4 + 디자인): `style` 속성·JSX `style` prop(SVG 포함) / `@import` / 외부·`data:` `url()`(빗금은 그라디언트, 아이콘은 인라인 SVG) / Tailwind 유틸리티 이름의 클래스(모든 클래스 `cc-` 접두) / CSS-in-JS / **`tokens.css` 밖의 16진 색**(예외: `print.css`의 `#000`·`#fff`) / **`tokens.css` 밖의 `prefers-color-scheme`** / `!important`(`[hidden]`·reduced-motion·`print.css`만) / CR 문자·`</style` 문자열.

### 4-2. `styles/tokens.css` (최종)

UI 스펙 §1-2 대비 바뀐 점: ① 다크 블록을 `@media screen and (prefers-color-scheme:dark)`로 묶었다 → 인쇄는 OS 테마와 무관하게 `:root` 라이트 값을 쓰므로 **인쇄용 재선언 블록을 없앴다**(남은 것은 `color-scheme:light` 한 줄). ② 다크 `--cc-line-strong`·`--cc-na-line` = **#646C79**. ③ 이름은 모델 `Status`와 같다(`risk·caution·clear·unknown·na`). 대비 수치는 UI §1-4가 최종이다(§4-7).

```css
/* styles/tokens.css — 문단속 5 디자인 토큰 v1.0 (design-final 확정본)
 * ① 색은 판정(5상태)에만 쓴다. 예외(파랑)·체험(보라)은 띠·테두리 전용.
 * ② 다크는 'screen and'로만 건다 → 인쇄는 OS 테마와 무관하게 :root(라이트) 값을 쓴다.
 * ③ 16진 색은 이 파일에만 둔다. 컴포넌트 CSS에는 다크용 @media를 쓰지 않는다.
 * ④ style="" 속성 금지. 동적 값은 클래스·data-* 속성으로 표현한다.
 * ⑤ 새 토큰은 디자인팀장 승인 후 추가한다. */
:root{
  color-scheme:light dark;

  /* 종이와 잉크 */
  --cc-bg:#FFFFFF;
  --cc-surface:#F5F6F8;
  --cc-hover:#EDEFF3;
  --cc-line:#D3D8DF;          /* 장식 구분선 전용(1.43:1). 의미를 싣지 않는다 */
  --cc-line-strong:#848D99;   /* 입력·카드 경계(3:1 이상). hover 바탕 위에서는 쓰지 않는다 */
  --cc-ink:#15181D;
  --cc-ink-2:#444B57;
  --cc-ink-3:#5B6370;         /* 보조 글자(AA). 상태 글자로 쓰지 않는다 */
  --cc-ph-bg:#E4E7EC;         /* 명령 자리표시자 강조 바탕 */
  --cc-glyph:#FFFFFF;         /* 상태 도형 위 글리프(뚫린 색) */
  --cc-scrim:rgba(21,24,29,.55);

  /* 5상태: ink=글자 · bg=바탕 · icon=도형·띠·테두리(글자색 금지) */
  --cc-risk-ink:#9B1C1C;    --cc-risk-bg:#FDEDED;    --cc-risk-icon:#C42121;
  --cc-caution-ink:#74470A; --cc-caution-bg:#FFF4D9; --cc-caution-icon:#A86200;
  --cc-clear-ink:#14532D;   --cc-clear-bg:#E9F6EE;   --cc-clear-icon:#1C7A43;
  --cc-unknown-ink:#1F2937; --cc-unknown-bg:#ECEFF3; --cc-unknown-icon:#4A5361; --cc-unknown-line:#7D8796;
  --cc-na-ink:#444B57;      --cc-na-icon:#6A7280;    --cc-na-line:#848D99;

  /* 예외(파랑) · 체험(보라) — 띠·테두리·라벨 전용 */
  --cc-exc:#2459D6;  --cc-exc-ink:#1D3F99;  --cc-exc-bg:#EBF1FE;
  --cc-demo:#6B33C9; --cc-demo-ink:#4A1F94; --cc-demo-bg:#F3EDFD;

  /* 파생(var 참조라 테마 값이 바뀌면 따라간다) */
  --cc-focus:var(--cc-ink);
  --cc-inv-bg:var(--cc-ink);
  --cc-inv-ink:var(--cc-bg);

  /* 타이포 */
  --cc-font:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI","Malgun Gothic","맑은 고딕","Noto Sans KR","Noto Sans CJK KR",Roboto,sans-serif;
  --cc-mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"D2Coding","Noto Sans Mono CJK KR",monospace;
  --cc-fs-13:.8125rem; --cc-fs-14:.875rem; --cc-fs-16:1rem; --cc-fs-18:1.125rem;
  --cc-fs-20:1.25rem;  --cc-fs-24:1.5rem;  --cc-fs-30:1.875rem;
  --cc-lh-body:1.6; --cc-lh-ui:1.5; --cc-lh-head:1.35;

  /* 간격(N×4px) · 형태 · 크기 */
  --cc-sp-1:4px; --cc-sp-2:8px; --cc-sp-3:12px; --cc-sp-4:16px;
  --cc-sp-6:24px; --cc-sp-8:32px; --cc-sp-12:48px; --cc-sp-16:64px;
  --cc-r-1:4px; --cc-r-2:6px;
  --cc-bar:4px; --cc-bar-unknown:6px;
  --cc-hit:44px;
  --cc-w-main:880px; --cc-w-wide:1040px; --cc-gutter:16px; --cc-band-h:28px;
  --cc-dur:120ms;
}
@media (min-width:600px){:root{--cc-gutter:24px}}
@media (min-width:1024px){:root{--cc-gutter:32px}}

@media screen and (prefers-color-scheme:dark){:root{
  --cc-bg:#0F1115; --cc-surface:#171A20; --cc-hover:#1C2027; --cc-line:#2B3038; --cc-line-strong:#646C79;
  --cc-ink:#E7E9EC; --cc-ink-2:#B3B9C3; --cc-ink-3:#9AA1AC;
  --cc-ph-bg:#2F353F; --cc-glyph:#0F1115; --cc-scrim:rgba(0,0,0,.65);
  --cc-risk-ink:#FFB3B3;    --cc-risk-bg:#3A1517;    --cc-risk-icon:#FF6B6B;
  --cc-caution-ink:#FFD98C; --cc-caution-bg:#33250B; --cc-caution-icon:#F0B341;
  --cc-clear-ink:#A3E4BA;   --cc-clear-bg:#102A1B;   --cc-clear-icon:#4DC27B;
  --cc-unknown-ink:#E5E7EB; --cc-unknown-bg:#20242C; --cc-unknown-icon:#B0B7C2; --cc-unknown-line:#737C8A;
  --cc-na-ink:#B3B9C3;      --cc-na-icon:#8E95A1;    --cc-na-line:#646C79;
  --cc-exc:#6E9FFF;  --cc-exc-ink:#BCD1FF;  --cc-exc-bg:#15223F;
  --cc-demo:#A98BFF; --cc-demo-ink:#DCCFFF; --cc-demo-bg:#231B3A;
}}

/* 인쇄는 위 :root 라이트 값을 그대로 쓴다(다크 블록이 screen 전용). 폼 컨트롤 기본색만 라이트로 고정 */
@media print{:root{color-scheme:light}}
```

### 4-3. `styles/base.css` (최종)

UI 스펙 §6-2 대비 바뀐 점: ① `h1[tabindex="-1"]:focus{outline:none}` 삭제(C12) ② 링크 모양 버튼 `.cc-link`·`.cc-link--nav` 추가(C25) ③ 접힘 패턴 `.cc-tog`·`.cc-fold`·`.cc-open` 추가, `<details>` 페이드인 삭제(C5·C22) ④ 체크박스를 네이티브 + `accent-color`로(C23) ⑤ 낮은 화면 규칙 600px·맥락 줄만 해제(C4) ⑥ 상태 리맵·빗금·아이콘 클래스(UI §2-2·§2-4·§3-1)를 여기로 모음 ⑦ `::selection`을 잉크 반전으로(KQL·해시 키보드 전체 선택의 대비, UX §0-2 요청: 라이트 17.79:1 · 다크 15.5:1) ⑧ 부팅 대체 안내 지연(`.cc-boot`)을 reduced-motion 규칙에서 뺐다(표시 여부 전환이지 움직임이 아니다. 빼지 않으면 움직임 줄이기 사용자에게 정상 부팅 중에도 "실행되지 않았습니다"가 잠깐 보인다) ⑨ `scroll-padding-top` 96px(맥락 줄 두 줄까지 덮음).

```css
/* styles/base.css — 리셋 · 타이포 · 링크/링크형 버튼 · 포커스 · 컨트롤 · 접힘 · dialog · 표 · 상태 리맵 · 빗금 · 아이콘 · 움직임 (design-final 확정본) */
*,*::before,*::after{box-sizing:border-box}
html{font-size:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-padding-top:96px}
body{margin:0;background:var(--cc-bg);color:var(--cc-ink);font:400 var(--cc-fs-16)/var(--cc-lh-body) var(--cc-font);font-variant-numeric:tabular-nums;word-break:keep-all;overflow-wrap:break-word}
h1,h2,h3,h4,p,ul,ol,dl,dd,figure,fieldset,blockquote,pre{margin:0}
ul,ol{padding:0;list-style:none}           /* 구조 목록. 구조 <ul>/<ol>에는 role="list"(Safari 낭독) */
fieldset{min-width:0;padding:0;border:0}
legend{padding:0}
h1,h2,h3,h4{font-weight:700;line-height:var(--cc-lh-head)}
h1{font-size:var(--cc-fs-20)}
h2{font-size:var(--cc-fs-18)}
h3{font-size:var(--cc-fs-16);font-weight:600}
@media (min-width:600px){h1{font-size:var(--cc-fs-24)}h2{font-size:var(--cc-fs-20)}h3{font-size:var(--cc-fs-18)}}
.cc-display{font-size:var(--cc-fs-24);font-weight:700;line-height:var(--cc-lh-head)}
@media (min-width:600px){.cc-display{font-size:var(--cc-fs-30)}}
.cc-prose>*+*{margin-top:var(--cc-sp-3)}
.cc-prose ul,.cc-prose ol{padding-left:1.25em;list-style:revert}
small,.cc-small{font-size:var(--cc-fs-13);line-height:var(--cc-lh-ui)}
.cc-ui{font-size:var(--cc-fs-14);line-height:var(--cc-lh-ui)}
.cc-muted{color:var(--cc-ink-3)}
.cc-mono{font-family:var(--cc-mono)}
.cc-any{overflow-wrap:anywhere;word-break:normal}
code,kbd,samp,pre{font-family:var(--cc-mono);font-size:var(--cc-fs-14)}
hr{margin:var(--cc-sp-6) 0;border:0;border-top:1px solid var(--cc-line)}
[hidden]{display:none!important}

/* 링크 · 링크형 버튼(앱 안 이동은 href 없는 <button class="cc-link">) · 포커스 */
a,.cc-link{color:var(--cc-ink);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.18em}
a:hover,.cc-link:hover{text-decoration-thickness:2px}
.cc-link{display:inline;padding:0;border:0;background:none;font:inherit;text-align:left;cursor:pointer}
.cc-link--nav{display:inline-flex;align-items:center;min-height:var(--cc-hit);padding-inline:var(--cc-sp-2);font-size:var(--cc-fs-14);font-weight:600}
.cc-link--nav[aria-current="page"]{font-weight:700;text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--cc-focus);outline-offset:2px}
::selection{background:var(--cc-ink);color:var(--cc-bg)}
.cc-inv{background:var(--cc-inv-bg);color:var(--cc-inv-ink)}
.cc-inv a,.cc-inv .cc-link{color:inherit}
.cc-inv :focus-visible,.cc-banner--strong :focus-visible{outline-color:var(--cc-inv-ink)}
::placeholder{color:var(--cc-ink-3);opacity:1}

/* 유틸 */
.cc-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.cc-skip{position:absolute;z-index:100;top:-120px;left:var(--cc-sp-2);min-height:var(--cc-hit);padding:var(--cc-sp-2) var(--cc-sp-4);border:0;background:var(--cc-inv-bg);color:var(--cc-inv-ink);font:inherit;font-weight:700;cursor:pointer}
.cc-skip:focus{top:var(--cc-sp-2)}
.cc-wrap{width:min(100% - 2*var(--cc-gutter),var(--cc-w-main));margin-inline:auto}
.cc-wrap--wide{width:min(100% - 2*var(--cc-gutter),var(--cc-w-wide))}
.cc-stack>*+*{margin-top:var(--cc-gap,var(--cc-sp-4))}
.cc-gap-2{--cc-gap:var(--cc-sp-2)}.cc-gap-6{--cc-gap:var(--cc-sp-6)}.cc-gap-8{--cc-gap:var(--cc-sp-8)}

/* 버튼: 높이 44px 이상. 위험(빨강) 변형 없음 */
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
.cc-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--cc-sp-2);min-height:var(--cc-hit);padding:10px 16px;border:1.5px solid var(--cc-ink);border-radius:var(--cc-r-1);background:transparent;color:var(--cc-ink);font-size:var(--cc-fs-16);font-weight:600;line-height:1.3;text-align:center;text-decoration:none}
.cc-btn:hover{background:var(--cc-hover)}
.cc-btn--primary{background:var(--cc-ink);color:var(--cc-bg)}
.cc-btn--primary:hover{background:var(--cc-ink-2);border-color:var(--cc-ink-2)}
.cc-btn--ghost{padding-inline:var(--cc-sp-2);border-color:transparent;text-decoration:underline;text-underline-offset:.18em}
.cc-btn--sm{padding-inline:12px;font-size:var(--cc-fs-14)}
.cc-btn[disabled],.cc-btn[aria-disabled="true"]{background:transparent;border:1.5px dashed var(--cc-line-strong);color:var(--cc-ink-3);cursor:not-allowed}

/* 입력: 경계 3:1 이상, 오류에 빨강 금지(굵은 잉크 테두리 + 문장) */
.cc-in,.cc-ta,.cc-sel{display:block;width:100%;min-height:var(--cc-hit);padding:10px 12px;border:1.5px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-bg);color:var(--cc-ink);font-size:var(--cc-fs-16);line-height:1.4}
.cc-ta{min-height:140px;resize:vertical;font-family:var(--cc-mono);font-size:var(--cc-fs-14);line-height:1.6}
.cc-in:focus-visible,.cc-ta:focus-visible,.cc-sel:focus-visible{border-color:var(--cc-ink)}
.cc-in[aria-invalid="true"],.cc-ta[aria-invalid="true"]{padding:9.5px 11.5px;border:2px solid var(--cc-ink)}
.cc-in:disabled,.cc-ta:disabled,.cc-sel:disabled{border-style:dashed;color:var(--cc-ink-3);cursor:not-allowed}
.cc-lab{display:block;margin-bottom:var(--cc-sp-1);font-size:var(--cc-fs-14);font-weight:600}
.cc-hint{margin-top:var(--cc-sp-1);color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
.cc-err{margin-top:var(--cc-sp-1);font-size:var(--cc-fs-14);font-weight:700}
.cc-opt{display:flex;align-items:center;gap:var(--cc-sp-3);min-height:var(--cc-hit)}
input[type="radio"],input[type="checkbox"]{flex:none;width:20px;height:20px;margin:0;accent-color:var(--cc-ink)}   /* 네이티브 컨트롤 + 잉크 강조색(체크 표시를 CSS로 그리지 않는다) */

/* 접힘: 리포트·고치는 법·비교(V3~V5)는 <details>를 쓰지 않고 버튼+영역만 쓴다(인쇄는 print.css가 CSS로 펼침).
   <details>는 V1 스크립트 뷰어·V7·V8에서만 쓴다. 움직임은 화살표 회전 하나뿐(진입 애니메이션 없음) */
.cc-fold:not(.cc-open){display:none}
.cc-tog{display:flex;align-items:center;gap:var(--cc-sp-2);width:100%;min-height:var(--cc-hit);padding:0;border:0;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.cc-tog:hover,summary:hover{background:var(--cc-hover)}
summary{display:flex;align-items:center;gap:var(--cc-sp-2);min-height:var(--cc-hit);cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
.cc-chev{flex:none;margin-left:auto;transition:transform var(--cc-dur)}
[aria-expanded="true"]>.cc-chev,details[open]>summary .cc-chev{transform:rotate(180deg)}

/* dialog: 앱 전체에서 하나(리포트 닫기 확인) */
dialog{width:calc(100% - 2*var(--cc-sp-4));max-width:480px;padding:var(--cc-sp-6);border:2px solid var(--cc-ink);border-radius:var(--cc-r-2);background:var(--cc-bg);color:var(--cc-ink)}
dialog::backdrop{background:var(--cc-scrim)}
.cc-dlg__act{display:flex;flex-direction:column-reverse;gap:var(--cc-sp-2);margin-top:var(--cc-sp-6)}
@media (min-width:600px){.cc-dlg__act{flex-direction:row;justify-content:flex-end}}

/* 표 */
table{width:100%;border-collapse:collapse}
caption{padding:0 0 var(--cc-sp-2);text-align:left;font-weight:600}
th,td{padding:10px 12px;border-bottom:1px solid var(--cc-line);text-align:left;vertical-align:top;overflow-wrap:break-word}
th{background:var(--cc-surface);border-bottom:1.5px solid var(--cc-line-strong);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:700}
tbody tr:hover{background:var(--cc-hover)}

/* 상태 리맵: 컴포넌트는 --cc-st-*만 읽는다 */
.cc-st--risk{--cc-st-ink:var(--cc-risk-ink);--cc-st-bg:var(--cc-risk-bg);--cc-st-icon:var(--cc-risk-icon);--cc-st-line:var(--cc-risk-icon)}
.cc-st--caution{--cc-st-ink:var(--cc-caution-ink);--cc-st-bg:var(--cc-caution-bg);--cc-st-icon:var(--cc-caution-icon);--cc-st-line:var(--cc-caution-icon)}
.cc-st--clear{--cc-st-ink:var(--cc-clear-ink);--cc-st-bg:var(--cc-clear-bg);--cc-st-icon:var(--cc-clear-icon);--cc-st-line:var(--cc-clear-icon)}
.cc-st--unknown{--cc-st-ink:var(--cc-unknown-ink);--cc-st-bg:var(--cc-unknown-bg);--cc-st-icon:var(--cc-unknown-icon);--cc-st-line:var(--cc-unknown-line)}
.cc-st--na{--cc-st-ink:var(--cc-na-ink);--cc-st-bg:transparent;--cc-st-icon:var(--cc-na-icon);--cc-st-line:var(--cc-na-line)}

/* 확인 불가 빗금 띠(장식, 의미 없음). 호스트는 border-left 6px를 가진다. 인쇄에서는 배경이 빠져 실선 띠가 남는다 */
.cc-hatch{position:relative}
.cc-hatch::before{content:"";position:absolute;top:0;bottom:0;left:calc(-1*var(--cc-bar-unknown));width:var(--cc-bar-unknown);border-radius:var(--cc-r-2) 0 0 var(--cc-r-2);background:repeating-linear-gradient(135deg,var(--cc-bg) 0 2px,transparent 2px 5px);pointer-events:none}

/* 상태 아이콘(.cc-si) — StatusBadge·DistributionChips·StatusLegend 안에서만 쓴다 */
.cc-si{display:inline-block;flex:none;width:16px;height:16px;vertical-align:-.2em;overflow:visible}
.cc-si--20{width:20px;height:20px}
.cc-si--24{width:24px;height:24px}
.cc-si--risk{color:var(--cc-risk-icon)}
.cc-si--caution{color:var(--cc-caution-icon)}
.cc-si--clear{color:var(--cc-clear-icon)}
.cc-si--unknown{color:var(--cc-unknown-icon)}
.cc-si--na{color:var(--cc-na-icon)}
.cc-si__s{fill:currentColor;stroke:currentColor;stroke-width:2;stroke-linejoin:round}
.cc-si__g{fill:none;stroke:var(--cc-glyph);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.cc-si--na .cc-si__s{fill:none;stroke-width:2.2;stroke-dasharray:4.4 2.67}
.cc-si--na .cc-si__g{stroke:currentColor}

/* 문 아이콘(.cc-di)·UI 아이콘(.cc-ic): 단색 선, 잉크, 상태 색 금지 */
.cc-di,.cc-ic{display:inline-block;flex:none;width:16px;height:16px;vertical-align:-.2em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.cc-di--20,.cc-ic--20{width:20px;height:20px;stroke-width:1.75}
.cc-di--24,.cc-ic--24{width:24px;height:24px;stroke-width:1.5}
.cc-di--32{width:32px;height:32px;stroke-width:1.5}

/* 움직임 · 낮은 화면 · 고대비 */
/* 부팅 대체 안내(정적 HTML): 3초 동안 숨겼다가 보인다. 부팅하면 JS가 hidden을 붙인다. 표시 여부 전환이지 움직임이 아니므로 reduced-motion 규칙에서 뺀다 */
.cc-boot{animation:cc-boot 3s steps(1,end)}
@keyframes cc-boot{from{visibility:hidden}}
@media (prefers-reduced-motion:reduce){:not(.cc-boot),::before,::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
/* 높이 600px 이하(200~400% 확대, 가로 폰): 띠는 줄어든 채 고정(스티키 유지), 맥락 줄은 스티키 해제 */
@media (max-height:600px){html{scroll-padding-top:calc(var(--cc-band-h) + 8px)}.cc-ctx{position:static}.cc-band__more{max-height:0}}
@media (forced-colors:active){
  .cc-si__s{fill:CanvasText;stroke:CanvasText}
  .cc-si__g{stroke:Canvas}
  .cc-si--na .cc-si__s{fill:none}
  .cc-si--na .cc-si__g{stroke:CanvasText}
}
```

### 4-4. `styles/print.css` (최종)

UI 스펙 §6-3 대비 바뀐 점: ① 루트 클래스 이름(C2) ② **접힘은 `.cc-fold.cc-po`를 CSS로 펼친다**(JS 이벤트 불필요). `details.cc-pc` 규칙 삭제 ③ 수집하지 않은 문 묶음(`.cc-ncg`)의 점검은 요약줄만 ④ 대상 표의 이상 없음 행(`tr.cc-tt__row--clear`)은 숨기고 생략 줄(`cc-print-only` 행)을 남긴다 ⑤ 링크 URL 출력 삭제(C7), 호스트 글자는 남기고 ↗ 아이콘만 숨김 ⑥ 직접 볼 목록의 빈 칸(`.cc-mc__box`)·메모 열(`.cc-mc__memo`)은 화면에서 숨기고 인쇄에서만 보임(C3) ⑦ 인쇄 머리 두 벌(`.cc-phead--full|--list`) 전환 ⑧ 0 칩(`.cc-dc--zero`)은 인쇄에서도 바탕 없음(배지 배경 보존 규칙이 `!important`라 뒤에서 한 번 더 지정).

```css
/* styles/print.css — 마스킹 전환 · 인쇄 (design-final 확정본). main.tsx에서 반드시 마지막에 import한다.
 * 원칙: 의미는 모양·글자·테두리에만 싣는다(배경은 장식). 인쇄 펼침은 JS 이벤트(beforeprint)에 기대지 않고 CSS로 강제한다. */

/* ① 마스킹 이중 렌더(화면): 기본은 전체 값. 화면 가리기(P1)는 루트 cc-screen-mask */
.cc-mask-short{display:none}
.cc-screen-mask .cc-mask-full{display:none}
.cc-screen-mask .cc-mask-short{display:inline}

/* ② 화면에서는 숨기는 인쇄 전용 요소(인쇄 머리·바닥 면책·체험 제목·직접 볼 목록의 체크 칸과 메모 열) */
.cc-print-only,.cc-mc__box,.cc-mc__memo{display:none}

@page{size:A4 portrait;margin:14mm 12mm 16mm}

@media print{
  html{font-size:10.5pt;scroll-padding-top:0}
  body{background:#fff;color:#000;line-height:1.5}
  *,*::before,*::after{background:transparent!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important}
  .cc-sb,.cc-dc{background:var(--cc-st-bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}   /* 배지·분포 칩만 배경 보존 */
  .cc-dc--zero{background:transparent!important}   /* 0 칩은 인쇄에서도 바탕 없음(위 규칙보다 뒤) */

  /* 숨김 */
  .cc-noprint,.cc-skip,.cc-hdr,.cc-ctx,.cc-jump,.cc-demo-frame,.cc-boot,.cc-drop,.cc-paste,.cc-sv,.cc-actions,.cc-popt,.cc-xf,.cc-btn,.cc-chev,.cc-ext__i,dialog{display:none!important}
  .cc-print-only{display:revert}
  .cc-wrap,.cc-wrap--wide{width:auto;margin:0}
  .cc-band{position:static;padding:2mm 3mm;border:1pt solid #000}
  .cc-band__more{max-height:none}
  .cc-print-demo{margin:0 0 4mm;padding:3mm 4mm;border:2.5pt solid #000;font-size:1.6rem;font-weight:700;text-align:center}

  /* 마스킹: 인쇄 기본 = 마스킹 값(Ctrl+P·브라우저 메뉴 인쇄 포함).
     '이름·ID 표시'는 인쇄 버튼 흐름에서만 루트에 cc-print-unmask를 붙였다가 print() 직후 뗀다 */
  .cc-mask-full,.cc-screen-mask .cc-mask-full{display:none}
  .cc-mask-short,.cc-screen-mask .cc-mask-short{display:inline}
  .cc-print-unmask .cc-mask-full{display:inline}
  .cc-print-unmask .cc-mask-short{display:none}

  /* 접힘: cc-po가 붙은 접힌 영역은 인쇄에서 펼친다. 수집하지 않은 문 묶음(cc-ncg)의 점검은 요약줄만 */
  .cc-fold.cc-po{display:revert!important}
  .cc-ncg .cc-rule__body{display:none!important}
  .cc-tog{min-height:0}
  .cc-rule{border-left-width:3pt;border-radius:0}
  .cc-rule.cc-st--unknown{border-left-width:4pt}
  /* 대상 표: 위험·주의·확인 불가 대상은 전부, 이상 없음 대상은 생략(생략 줄은 cc-print-only 행) */
  .cc-tt tr.cc-tt__row--clear{display:none!important}

  /* 쪽 나눔 */
  h1,h2,h3,.cc-door__h,.cc-rule__sum{break-after:avoid}
  .cc-rule__sum,.cc-pl__i,.cc-tt tr,.cc-mc tr,.cc-cmd,.cc-banner,.cc-card{break-inside:avoid}
  .cc-manual{break-before:page}
  thead{display:table-header-group}
  p,li{orphans:3;widows:3}

  /* 링크: 제목 + 호스트 글자만 남긴다(URL 전체는 쓰지 않는다) */
  a,.cc-link{color:#000}

  /* 반전 요소 → 테두리형(배경이 안 찍혀도 글자가 사라지지 않게) */
  .cc-banner--strong,.cc-inv,.cc-chip--inv{color:#000;border:2pt double #000}
  .cc-mv--redacted{color:#000;border:1pt solid #000}
  .cc-cmd--write{border:2.5pt solid #000}
  .cc-cmd--write .cc-cmd__cap{color:#000;border-bottom:1.5pt solid #000;font-weight:700}
  .cc-cmd__pre{white-space:pre-wrap;font-size:9pt}
  .cc-chip,.cc-impact{border-color:#000}
  .cc-disc{max-width:none;border:0;border-top:.75pt solid #000;border-radius:0}

  /* 직접 볼 목록: 손으로 체크하는 표(체크 칸·메모 열은 인쇄에만) */
  .cc-mc th,.cc-mc td{padding:2mm 2.5mm;border:.5pt solid #000}
  .cc-mc tr{height:10mm}
  .cc-mc__box{display:inline-block;width:5mm;height:5mm;margin-right:2mm;border:1pt solid #000;vertical-align:-1mm}
  .cc-mc__memo{display:table-cell;min-width:38mm}

  /* 인쇄 머리: 전체 리포트 / 직접 볼 목록만 */
  .cc-phead--list{display:none}
  .cc-print-list-only .cc-report>:not(.cc-manual):not(.cc-print-only){display:none!important}
  .cc-print-list-only .cc-phead--full{display:none}
  .cc-print-list-only .cc-phead--list{display:revert}
  .cc-print-list-only .cc-manual{break-before:auto}
}
```

**인쇄 JS 계약(페이지개발자 `state/print.ts`)** — `beforeprint`·`afterprint`로 펼치고 접는 코드는 **쓰지 않는다.**

```ts
// _client/state/print.ts — 인쇄 버튼 흐름의 유일한 곳. 루트 클래스는 print() 동안만 붙는다
export function printReport(opts: { scope: "full" | "list"; unmask: boolean }): void {
  const root = document.documentElement;
  const cls: string[] = [];
  if (opts.scope === "list") cls.push("cc-print-list-only");
  if (opts.unmask) cls.push("cc-print-unmask");
  root.classList.add(...cls);
  const cleanup = () => root.classList.remove("cc-print-list-only", "cc-print-unmask");
  window.addEventListener("afterprint", cleanup, { once: true });
  try { window.print(); } finally { cleanup(); }
  // print()가 막지 않고 바로 돌아오는 브라우저에서는 마스킹본·전체 리포트로 인쇄된다(안전한 쪽으로 실패). STEP 5에서 iOS Safari 확인
}
```

- 메뉴 인쇄(Ctrl+P)는 루트 클래스가 없으므로 **항상 전체 리포트 + 마스킹**이다. 인쇄 옵션의 '이름·ID 표시'는 메모리 상태일 뿐 화면·메뉴 인쇄에 영향이 없다(`cc.c.print.unmask-scope`로 안내).
- 인쇄 전용 블록(V3 안): `PrintHead`(full/list 두 벌), `.cc-print-demo`(체험일 때 "체험 모드 · 가짜 데이터" 크게), 대상 표의 생략 줄, 마지막 바닥 `Disclaimer`. 도장·서명란·'확인자'·'판정: 적합' 칸은 만들지 않는다.

### 4-5. 컴포넌트 CSS 기준안 (측정에 쓴 코드 — 컴포넌트별 파일로 나눠 옮긴다)

UI 스펙 §5의 시각 규격과 §6-4 패턴을 이 문서의 결정(C1~C27)에 맞춰 다시 쓴 것이다. 섹션 주석 단위로 해당 컴포넌트의 `.css`로 옮기고, 값은 바꾸지 않는다. 새 규칙이 필요하면 토큰만 쓰고, 반전 요소를 새로 만들면 `print.css`에 테두리형 대체를 함께 넣는다.

```css
/* ===== 기본 요소 ===== */
/* StatusBadge · DistributionChips (UI §6-4 그대로) */
.cc-sb,.cc-dc{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--cc-st-line);border-radius:var(--cc-r-1);background:var(--cc-st-bg);color:var(--cc-st-ink);font-size:var(--cc-fs-14);font-weight:600}
.cc-sb{min-height:28px;padding:2px 8px 2px 6px;line-height:1.3;white-space:nowrap}
.cc-sb.cc-st--na,.cc-dc.cc-st--na{border-style:dashed}
.cc-sb--sm{min-height:24px;padding:1px 6px 1px 4px;font-size:var(--cc-fs-13)}
.cc-sb--lg{min-height:32px;gap:8px;padding:4px 10px 4px 8px;font-size:var(--cc-fs-16)}
.cc-sb__n{font-weight:700}
.cc-dist{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2)}
.cc-dist__lead{font-weight:700}
.cc-dc{min-height:36px;padding:4px 12px 4px 8px}
.cc-dc__n{font-size:var(--cc-fs-18);font-weight:700;line-height:1.2}
.cc-dc--sm{min-height:28px;padding:2px 8px 2px 6px;font-size:var(--cc-fs-13)}
.cc-dc--sm .cc-dc__n{font-size:var(--cc-fs-14)}
.cc-dc--zero{border:1px solid var(--cc-line);background:transparent;color:var(--cc-ink-2);font-weight:400}
.cc-dc--zero .cc-dc__n{font-weight:400}
.cc-legend{display:flex;flex-wrap:wrap;gap:var(--cc-sp-1) var(--cc-sp-4);font-size:var(--cc-fs-13);color:var(--cc-ink-2)}
.cc-legend>div{display:flex;align-items:center;gap:6px}
.cc-legend dt{font-weight:600;color:var(--cc-ink)}
/* 확인 불가 톤 블록(상태 도형 없이 띠+빗금): 미판정 줄 · 권한 해제 힌트 · 입력 읽기 실패 패널 */
.cc-untone{padding:var(--cc-sp-2) var(--cc-sp-4);border:1px solid var(--cc-unknown-line);border-left:var(--cc-bar-unknown) solid var(--cc-unknown-icon);border-radius:var(--cc-r-2);background:var(--cc-unknown-bg);color:var(--cc-unknown-ink)}
/* LabelChip · ImpactChip */
.cc-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-bg);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:600;line-height:1.4}
.cc-chip--hint,.cc-chip--soon{border-style:dashed}
.cc-chip--soon{color:var(--cc-ink-3)}
.cc-chip--strong{border:1.5px solid var(--cc-ink);color:var(--cc-ink)}
.cc-chip--inv{border-color:var(--cc-inv-bg);background:var(--cc-inv-bg);color:var(--cc-inv-ink)}
.cc-impact{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid var(--cc-ink);border-radius:var(--cc-r-1);font-size:var(--cc-fs-13)}
.cc-impact--medium{border-width:1.5px;font-weight:600}
.cc-impact--high{border-width:2px;font-weight:700}
/* 예외 표시(파랑: 행 왼쪽 띠 + 라벨). 상태 배지는 그대로 */
.cc-exc>td:first-child,.cc-exc.cc-card{border-left:var(--cc-bar) solid var(--cc-exc)}
.cc-exc--expired>td:first-child{border-left-style:dashed}
.cc-excl{display:inline-flex;min-height:24px;padding:0 8px;border:1px solid var(--cc-exc);border-radius:var(--cc-r-1);background:var(--cc-exc-bg);color:var(--cc-exc-ink);font-size:var(--cc-fs-13);font-weight:600}
.cc-excl--expired{border-style:dashed}
/* DocLink */
.cc-ext__x{display:inline-flex;align-items:center;gap:2px;white-space:nowrap;margin-left:4px}
.cc-ext__host{font-family:var(--cc-mono);font-size:var(--cc-fs-13);color:var(--cc-ink-2)}
/* MaskedValue · AccountLabel */
.cc-mv--redacted{display:inline-block;padding:0 6px;border-radius:var(--cc-r-1);background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-family:var(--cc-mono);font-size:var(--cc-fs-13)}
.cc-acct__alias{font-weight:700}
.cc-acct__l4{margin-left:4px;font-family:var(--cc-mono)}

/* ===== 머리 · 띠 · 맥락 줄 ===== */
.cc-hdr{border-bottom:1px solid var(--cc-line);background:var(--cc-bg)}
.cc-hdr__in{display:flex;align-items:center;flex-wrap:wrap;gap:var(--cc-sp-2);min-height:56px}
.cc-hdr__brand{padding:0;border:0;background:none;color:var(--cc-ink);font:inherit;font-size:var(--cc-fs-18);font-weight:700;min-height:var(--cc-hit);cursor:pointer}
.cc-hdr__brand:hover{text-decoration:underline}
.cc-hdr__nav{display:flex;gap:var(--cc-sp-2);margin-left:auto}
.cc-hdr__off{padding:var(--cc-sp-1) var(--cc-gutter);border-top:1px solid var(--cc-line);background:var(--cc-surface);font-size:var(--cc-fs-13)}
.cc-band{position:sticky;top:0;z-index:40;padding:5px var(--cc-gutter);border-bottom:1px solid var(--cc-line-strong);background:var(--cc-surface);color:var(--cc-ink);font-size:var(--cc-fs-13);line-height:18px}
.cc-band__tag{display:inline-block;margin-right:var(--cc-sp-2);padding:0 6px;border:1px solid currentColor;border-radius:var(--cc-r-1);font-weight:700}
.cc-band__row{font-weight:700}
.cc-band__more{max-height:4em;overflow:hidden;transition:max-height var(--cc-dur)}
.cc-compact .cc-band__more{max-height:0}
.cc-band--demo{border-bottom-color:var(--cc-demo);background:var(--cc-demo-bg);color:var(--cc-demo-ink)}
.cc-demo-frame{position:fixed;inset:0;z-index:50;border:4px solid var(--cc-demo);pointer-events:none}
.cc-ctx{position:sticky;top:var(--cc-band-h);z-index:30;display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-1) var(--cc-sp-3);min-height:40px;padding:6px var(--cc-gutter);border-bottom:1px solid var(--cc-line-strong);background:var(--cc-bg);font-size:var(--cc-fs-14)}
.cc-ctx .cc-acct__alias{display:inline-block;max-width:16em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}
.cc-jump:not(:focus-within){position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.cc-jump{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2);padding:var(--cc-sp-2) 0}

/* ===== 리포트 상단 ===== */
.cc-report>*+*{margin-top:var(--cc-sp-8)}
.cc-scope{padding:var(--cc-sp-4);border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-2);background:var(--cc-surface)}
.cc-scope__dl>div{display:grid;gap:var(--cc-sp-1);padding:var(--cc-sp-2) 0;border-bottom:1px solid var(--cc-line);break-inside:avoid}
.cc-scope dt{color:var(--cc-ink-3);font-size:var(--cc-fs-14);font-weight:600}
.cc-scope dd{font-size:var(--cc-fs-14)}
.cc-scope__cannot{display:grid;gap:2px var(--cc-sp-6);font-size:var(--cc-fs-14)}
@media (min-width:600px){.cc-scope{padding:var(--cc-sp-6)}.cc-scope__dl>div{grid-template-columns:6em 1fr;gap:var(--cc-sp-3)}.cc-scope__cannot{grid-template-columns:1fr 1fr}}
@media (min-width:1024px){.cc-scope__dl{columns:2;column-gap:var(--cc-sp-8)}}
.cc-dcr{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--cc-sp-2)}
.cc-dcr__i{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;padding:8px 10px;border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);font-size:var(--cc-fs-13)}
.cc-dcr__i b{font-size:var(--cc-fs-14)}
.cc-dcr__i--partial{font-weight:700}
.cc-dcr__i--none{border-style:dashed;color:var(--cc-ink-2)}
.cc-dcr--compact{grid-template-columns:repeat(5,auto);justify-content:start}
.cc-banner{padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line-strong);border-left:var(--cc-bar) solid var(--cc-ink-2);border-radius:var(--cc-r-2);background:var(--cc-surface);font-size:var(--cc-fs-14);line-height:var(--cc-lh-ui)}
.cc-banner+.cc-banner{margin-top:var(--cc-sp-2)}
.cc-banner__t{font-weight:700}
.cc-banner__b{margin-top:var(--cc-sp-1)}
.cc-banner--strong{border-color:var(--cc-inv-bg);background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-size:var(--cc-fs-16)}
.cc-banner--exception{border-color:var(--cc-exc);background:var(--cc-exc-bg);color:var(--cc-exc-ink)}
.cc-banner--demo{border-color:var(--cc-demo);background:var(--cc-demo-bg);color:var(--cc-demo-ink)}
.cc-pl{display:grid;gap:var(--cc-sp-2)}
.cc-pl__i{display:grid;gap:var(--cc-sp-1) var(--cc-sp-3);padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line);border-left:var(--cc-bar) solid var(--cc-st-icon);border-radius:var(--cc-r-2)}
.cc-pl__i.cc-st--unknown{border-color:var(--cc-unknown-line);border-left:var(--cc-bar-unknown) solid var(--cc-unknown-icon)}
.cc-pl__act{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2)}
@media (min-width:600px){.cc-pl__i{grid-template-columns:1fr auto;align-items:center}.cc-pl__act{grid-column:2;grid-row:1/span 2;justify-content:flex-end}}

/* ===== 리포트 본문 ===== */
.cc-door{border-top:2px solid var(--cc-ink)}
.cc-door+.cc-door{margin-top:var(--cc-sp-8)}
.cc-door__head{display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-2) var(--cc-sp-3);padding:var(--cc-sp-4) 0 var(--cc-sp-3)}
.cc-door__h{display:flex;align-items:center;gap:var(--cc-sp-2)}
.cc-door__term{color:var(--cc-ink-3);font-size:var(--cc-fs-14);font-weight:400}
.cc-door__counts{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2)}
.cc-door__collect{margin-bottom:var(--cc-sp-3);color:var(--cc-ink-2);font-size:var(--cc-fs-13)}
.cc-door__inc{margin-top:var(--cc-sp-3);font-size:var(--cc-fs-14)}
@media (min-width:600px){.cc-door+.cc-door{margin-top:var(--cc-sp-12)}.cc-door__counts{margin-left:auto}}
/* RuleRow: <h3><button aria-expanded> 안에 상태 글자 + 제목, 같은 줄의 다른 버튼은 버튼 밖(상호작용 중첩 금지) */
.cc-rule{border:1px solid var(--cc-line);border-left:var(--cc-bar) solid var(--cc-st-icon);border-radius:var(--cc-r-2);background:var(--cc-bg)}
.cc-rule+.cc-rule{margin-top:var(--cc-sp-2)}
.cc-rule.cc-st--unknown{border-color:var(--cc-unknown-line);border-left:var(--cc-bar-unknown) solid var(--cc-unknown-icon)}
.cc-rule.cc-st--na{border-left-style:dashed}
.cc-rule__sum{display:grid;gap:var(--cc-sp-1) var(--cc-sp-3);padding:var(--cc-sp-3) var(--cc-sp-4)}
.cc-rule__tog{flex-wrap:wrap;gap:var(--cc-sp-2) var(--cc-sp-3)}
.cc-rule__title{flex-basis:100%;font-size:var(--cc-fs-16);font-weight:600;line-height:var(--cc-lh-head)}
.cc-rule__why{color:var(--cc-ink-2);font-size:var(--cc-fs-14)}
.cc-rule__tail{color:var(--cc-ink-2);font-size:var(--cc-fs-13)}
.cc-rule__act{display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-2)}
.cc-rule__body{padding:0 var(--cc-sp-4) var(--cc-sp-4)}
.cc-rule__body>*+*{margin-top:var(--cc-sp-4)}
.cc-rule__sub{font-size:var(--cc-fs-14);font-weight:700}
@media (min-width:600px){.cc-rule__sum{grid-template-columns:1fr auto}.cc-rule__title{flex-basis:auto;flex:1;font-size:var(--cc-fs-18)}.cc-rule__act{grid-column:2;grid-row:1/span 3;justify-content:flex-end}}
.cc-ncg{padding:var(--cc-sp-3) var(--cc-sp-4)}
/* TargetTable · EvidenceList */
.cc-tt__name{display:block;font-weight:600}
.cc-tt__type{color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
.cc-tt__facts{font-size:var(--cc-fs-14)}
.cc-tt__form>td{padding:0}
.cc-ev{font-size:var(--cc-fs-13)}
.cc-ev li{padding:2px 0;border-bottom:1px solid var(--cc-line)}
/* ManualCheckList(화면은 번호 목록, 체크 칸·메모 열은 인쇄 전용) */
.cc-mc__no{width:4em;font-weight:700}
.cc-mc__perm{display:inline-block;margin-top:2px;padding:0 6px;border-radius:var(--cc-r-1);background:var(--cc-ph-bg);font-family:var(--cc-mono);font-size:var(--cc-fs-13)}
/* GuideCard · FixSteps 공용 번호 상자(채운 사각은 상태 도형과 헷갈리므로 외곽선) */
.cc-guide{padding:var(--cc-sp-4)}
.cc-steps{counter-reset:st}
.cc-steps>li{position:relative;padding-left:44px;counter-increment:st}
.cc-steps>li+li{margin-top:var(--cc-sp-4)}
.cc-steps>li::before{content:counter(st);position:absolute;left:0;top:0;width:28px;height:28px;border:1.5px solid var(--cc-ink);border-radius:var(--cc-r-1);font-weight:700;line-height:25px;text-align:center}
.cc-disc{max-width:44em;padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line);border-radius:var(--cc-r-2);color:var(--cc-ink-2);font-size:var(--cc-fs-13);line-height:var(--cc-lh-body)}
.cc-popt{display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-2) var(--cc-sp-4)}
.cc-xf{padding:var(--cc-sp-4);border-left:var(--cc-bar) solid var(--cc-exc);background:var(--cc-exc-bg)}
.cc-xf>*+*{margin-top:var(--cc-sp-3)}
.cc-xf__h{color:var(--cc-exc-ink);font-size:var(--cc-fs-14);font-weight:700}
.cc-actions{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2)}
.cc-actions__new{margin-left:auto}

/* ===== 고치는 법 ===== */
.cc-fix__acct{padding:var(--cc-sp-3) var(--cc-sp-4);border:2px solid var(--cc-ink);border-radius:var(--cc-r-2)}
.cc-fix__meta{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2);align-items:center}
.cc-cmd{margin:0;border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-surface)}
.cc-cmd__cap{padding:var(--cc-sp-1) var(--cc-sp-3);border-bottom:1px solid var(--cc-line-strong);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:600}
.cc-cmd__pre{padding:var(--cc-sp-3);font-size:var(--cc-fs-14);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}
.cc-cmd--write{border:3px solid var(--cc-ink)}
.cc-cmd--write .cc-cmd__cap{border-bottom:0;background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-size:var(--cc-fs-14);font-weight:700}
.cc-cmd--typed{border-width:1.5px;border-color:var(--cc-ink)}
.cc-cmd--kql .cc-cmd__pre{-webkit-user-select:all;user-select:all}
.cc-ph{padding:0 2px;border-radius:2px;background:var(--cc-ph-bg);font-weight:700;text-decoration:underline dotted 2px;text-underline-offset:3px}

/* ===== 수집 준비 ===== */
.cc-sv{border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-2);background:var(--cc-surface)}
.cc-sv__bar{display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-2);padding:var(--cc-sp-2) var(--cc-sp-3);border-bottom:1px solid var(--cc-line-strong);font-size:var(--cc-fs-13)}
.cc-sv__d>summary{padding:0 var(--cc-sp-3);border-bottom:1px solid var(--cc-line);font-size:var(--cc-fs-14);font-weight:600}
.cc-sv__code{margin:0;padding:var(--cc-sp-3) 0;overflow-x:auto;font-size:var(--cc-fs-13);line-height:1.6;counter-reset:ln}
.cc-sv__l{position:relative;display:block;padding:0 var(--cc-sp-3) 0 56px;white-space:pre;counter-increment:ln}
.cc-sv__l::before{content:counter(ln);position:absolute;left:0;width:44px;color:var(--cc-ink-3);text-align:right;-webkit-user-select:none;user-select:none}
.cc-sv__l--c{color:var(--cc-ink-3)}
.cc-fp td:first-child,.cc-fp td:nth-child(2){font-family:var(--cc-mono);font-size:var(--cc-fs-13);overflow-wrap:anywhere}
.cc-fp__w>td:first-child{box-shadow:inset 2px 0 var(--cc-ink);font-weight:700}
.cc-hash{display:block;padding:var(--cc-sp-3);border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-surface);font-family:var(--cc-mono);font-size:var(--cc-fs-16);line-height:1.7;-webkit-user-select:all;user-select:all}
.cc-hash__g{margin-right:.75em}
.cc-hash__g:last-child{margin-right:0}
.cc-hash__src{font-size:var(--cc-fs-13);font-weight:600}
/* PathChooser · DemoCards: 카드형 라디오/카드. 라디오는 시각적으로만 숨기고 카드에 포커스 링 */
.cc-cards{display:grid;gap:var(--cc-sp-3)}
.cc-card{display:block;padding:var(--cc-sp-4);border:2px solid var(--cc-line-strong);border-radius:var(--cc-r-2);background:var(--cc-bg)}
.cc-card--radio{cursor:pointer}
.cc-card--radio:hover,.cc-card--on{border-color:var(--cc-ink)}
.cc-card__pick{display:flex;align-items:center;gap:var(--cc-sp-3);min-height:var(--cc-hit)}   /* 보이는 네이티브 라디오 + 제목(라디오를 숨기지 않는다) */
.cc-card>*+*{margin-top:var(--cc-sp-2)}
.cc-card__t{font-size:var(--cc-fs-18);font-weight:700}
@media (min-width:600px){.cc-cards{grid-template-columns:1fr 1fr}.cc-card{padding:var(--cc-sp-6)}}
@media (min-width:1024px){.cc-cards--4{grid-template-columns:repeat(4,1fr)}}

/* ===== 입력 · 비교 ===== */
.cc-drop{display:flex;flex-direction:column;align-items:center;gap:var(--cc-sp-3);padding:var(--cc-sp-6) var(--cc-sp-4);border:2px dashed var(--cc-line-strong);border-radius:var(--cc-r-2);background:var(--cc-surface);text-align:center}
.cc-drop--over{border-style:solid;border-color:var(--cc-ink);background:var(--cc-hover)}
.cc-drop:focus-within{outline:2px solid var(--cc-focus);outline-offset:2px}
.cc-drop__hint{display:none}
@media (min-width:600px){.cc-drop{padding:var(--cc-sp-8) var(--cc-sp-4)}.cc-drop__hint{display:block}}
.cc-paste{min-height:140px}
@media (min-width:600px){.cc-paste{min-height:180px}}
.cc-tabs{display:flex;gap:var(--cc-sp-2);border-bottom:1px solid var(--cc-line-strong)}
.cc-tab{min-height:var(--cc-hit);padding:0 var(--cc-sp-4);border:0;border-bottom:3px solid transparent;background:none;font:inherit;font-weight:600;cursor:pointer}
.cc-tab[aria-selected="true"]{border-bottom-color:var(--cc-ink);font-weight:700}
.cc-fr__size{color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
.cc-fr__row--superseded>td{color:var(--cc-ink-2)}
.cc-fr__panel>*+*{margin-top:var(--cc-sp-1)}
.cc-ba__chg{font-weight:700;box-shadow:inset 2px 0 var(--cc-ink)}
.cc-ba__note{font-size:var(--cc-fs-14)}
.cc-idc{display:grid;gap:var(--cc-sp-3)}
.cc-idc__side{padding:var(--cc-sp-4);border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-2)}
.cc-idc__diff{text-decoration:underline 2px;text-underline-offset:3px}
@media (min-width:600px){.cc-idc{grid-template-columns:1fr 1fr}}
.cc-promise{font-size:var(--cc-fs-16)}
.cc-caveat{margin-top:var(--cc-sp-2);color:var(--cc-ink-2);font-size:var(--cc-fs-14)}

/* ===== 표 → 카드(600px 미만): 카드로 바꿀 표에 cc-ct를 붙인다. table/row/cell/columnheader role은 마크업에서 명시 ===== */
@media (max-width:599.98px){
  .cc-ct,.cc-ct tbody,.cc-ct tr,.cc-ct td{display:block}
  .cc-ct thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .cc-ct tr{margin-top:var(--cc-sp-2);padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line);border-radius:var(--cc-r-2)}
  .cc-ct td{padding:var(--cc-sp-1) 0;border:0}
  .cc-ct td[data-label]::before{content:attr(data-label);display:block;color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
  .cc-ct tr.cc-exc{border-left:var(--cc-bar) solid var(--cc-exc)}
  .cc-ct tr.cc-exc>td:first-child{border-left:0}
}
```

### 4-6. 아이콘 SVG (최종 지정)

- **UI 스펙 §2-2(상태 도형 5종), §3-1(문 아이콘 5종), §3-2(UI 아이콘 5종), §3-3(파비콘 data: SVG), §3-5(라이선스 고지 블록)를 최종본으로 지정한다.** path는 바꾸지 않았다. 클래스 CSS는 §4-3 `base.css`로 옮겼다.
- 마크업 규칙: `viewBox`·`class`·`aria-hidden="true"`·`focusable="false"`만 쓴다(`width`·`height`·`fill`·`stroke`·`style` 속성 없음). 크기는 클래스(`cc-si--20` 등). 체크·물음표는 글자가 아니라 path다(금지어 '✓' 회피).
- 상태 도형은 `StatusIcon` 하나가 그리고, `StatusBadge`·`DistributionChips`·`StatusLegend`만 import한다(§5-0 R2). 문 아이콘은 상태 색을 칠하지 않는다.
- 라이선스: `_client/components/icons.ts` 머리의 `/*! … */`(ISC + Feather MIT 보수적 병기). esbuild `legalComments:'eof'`로 번들 끝에 남는지 G5에서 grep. V8에 한 줄 고지(`cc.about.oss`).
- 쓰지 않는 아이콘: 방패·자물쇠·인증 마크류, 도형 안 경고 기호, 복사, 스피너, 업로드·다운로드·프린터, 이모지.

### 4-7. 대비 (최종 지정)

- **UI 스펙 §1-4 표 1~5를 최종으로 지정한다**(약 110쌍, 손계산 4쌍 + WebAIM API 교차). 미달은 다크 #5D6572 한 곳이었고 #646C79로 해소했다.
- 사용 제한(UI §1-5 그대로): `-icon` 토큰은 글자색 금지(caution 4.35·na 4.48 구간) / 상태 틴트 위 글자는 그 상태의 `-ink` / `--cc-ink-3`은 bg·surface·hover 위에서만 / hover 바탕 위에서는 `--cc-line-strong` 경계를 쓰지 않는다(2.91).
- 이 문서에서 새로 쓴 색 조합: `::selection`(ink/bg, 17.79·15.5), 0 칩 글자 `--cc-ink-2`(8.78·9.57), 체크박스·라디오 `accent-color: var(--cc-ink)`. 새 16진 값은 없다.

---

## 5. 컴포넌트 최종 스펙 (컴포넌트개발자 소유: `_client/components/**`, `_client/styles/**`, `_client/i18n/ko/components.ts`)

### 5-0. 공통 규칙 (모든 컴포넌트)

| # | 규칙 | 확인 방법(§11-2) |
|---|---|---|
| R1 | **사용자 데이터는 `MaskedValue`로만 그린다.** `DisplayValue`를 문자열로 보간하지 않는다. 속성 값(`aria-label`·`title`·`alt`·`placeholder`·`data-*`)과 `document.title`에 사용자 데이터 0. 접근 이름에 사용자 데이터가 필요하면 `aria-labelledby`로 화면의 `MaskedValue` 요소(`id`)를 가리킨다(예: `[빼기]` 버튼 = 자기 id + 파일 이름 id) | G-D8 |
| R2 | **상태 도형은 `StatusIcon`만 그리고, `StatusIcon`은 `StatusBadge`·`DistributionChips`·`StatusLegend`만 import한다.** 상태 글자 없는 도형 0 | G-D2·G-D3 |
| R3 | 카탈로그 글자는 `t()`(문자열, 사용자 데이터 불가) 또는 `<T>`(노드), 엔진 코드는 `<Msg>`로만 꺼낸다. 문장을 조각으로 잇지 않는다(상태 칩의 `{상태 글자} {n}`만 예외) | 카탈로그 린트 |
| R4 | `style` prop 0, 클래스는 `cc-` 접두, 컴포넌트 CSS에 16진 색 0 | G-D1·G-D15·G-D16 |
| R5 | 인터랙티브 대상 44px 이상, 아이콘만 있는 버튼 0, 장식 SVG는 `aria-hidden="true" focusable="false"` | G-D22·G-D23 |
| R6 | V3~V5에서 쓰는 컴포넌트는 `<details>`를 쓰지 않는다. 접힘은 `Fold`(버튼 `.cc-tog[aria-expanded][aria-controls]` + 영역 `.cc-fold`, 열림 `.cc-open`, 인쇄 펼침 `.cc-po`). 접힌 영역도 DOM에 항상 렌더한다(인쇄가 CSS로 펼치므로). 인쇄에서 펼쳐지는 접힘의 '나머지 n개 펼치기'·'더 보기'류 버튼에는 `cc-noprint`를 붙이고, 제목을 담은 토글(점검 행·일반 알림 제목)은 인쇄에 남긴다 | G-D7 |
| R7 | props는 판정 결과 모델 v1(`src/lib/cloudcheck/model/report.ts`) 타입을 그대로 받는다. 화면 쪽 가공은 아래 표에 적은 어댑터 타입만 | 리뷰 |
| R8 | 구조 `<ul>`/`<ol>`에 `role="list"`, 표는 `<table>`+`<th scope>`, 모바일 카드로 바꾸는 표는 `cc-ct` + `table`·`row`·`cell`·`columnheader` role 명시 | 렌더 검사 |

**i18n 인터페이스**(파일 경계는 §8). `i18n/index.ts`는 프론트팀장, `<T>`·`<Msg>`는 컴포넌트개발자다.

```ts
// _client/i18n/index.ts (프론트팀장) — components.ts · screens.ts · rules/i18n/ko.ts를 합친다
import type { CatalogKey, IsoDate, IsoUtc, MessageCode } from "../../../../lib/cloudcheck/model/report";
export type TextParam = number | string | { readonly t: IsoUtc } | { readonly d: IsoDate }; // DisplayValue는 받지 않는다
export declare function t(key: CatalogKey, params?: Readonly<Record<string, TextParam>>): string; // 속성·document.title·라이브 영역은 이것만
export declare function keyOf(code: MessageCode): CatalogKey; // UX §7-1 규칙 7의 단일 구현(UnknownReason → cc.reason.unknown.<c>, "AWS-MFA-2:x" → cc.reason.aws-mfa-2.x, "fact:x" → cc.fact.x, isolated-denial·no-targets-proven → cc.reason.<c>)
export declare function fmtTime(at: IsoUtc, form: "full" | "short"): string; // full "2026-10-19 12:12 KST (03:12 UTC)", short "10-19 12:12 KST". UTC+9 산술, Intl 미사용

// _client/components/T.tsx (컴포넌트개발자)
import type { ReactElement } from "react";
import type { CatalogKey, MsgParam, MsgRef } from "../../../../lib/cloudcheck/model/report";
export declare function T(props: { k: CatalogKey; p?: Readonly<Record<string, MsgParam | ReactElement>> }): ReactElement; // {v} → <MaskedValue>, {t} → <time>, 노드는 그대로
export declare function Msg(props: { m: MsgRef; short?: boolean }): ReactElement; // short = cc.reason.short.<code>(gaps 나열용)
```

### 5-1. 관문 컴포넌트 5종 (+ 부속 관문 1) — D1에 먼저 만든다

```ts
// 모두 src/app/cloudcheck/_client/components/ 아래. 타입은 model/report.ts(G0 동결)에서 import
import type { CatalogKey, CliTemplate, DisplayValue, ExternalLink, Status } from "../../../../lib/cloudcheck/model/report";

/** ① 사용자 데이터를 그리는 유일한 통로(R-12·R-13) */
export interface MaskedValueProps { readonly value: DisplayValue; readonly id?: string }
/** ② 외부 링크를 만드는 유일한 통로. LINK_HOSTS만, 새 탭 + 도메인 표기 */
export interface DocLinkProps { readonly link: ExternalLink; readonly labelKey: CatalogKey; readonly lang?: "en" }
/** ③ 상태 표시의 유일한 통로. 글자를 숨기는 prop이 없다 */
export interface StatusBadgeProps { readonly status: Status; readonly size?: "sm" | "md" | "lg"; readonly count?: number }
/** ④ 명령·쿼리·직접 입력 줄. 복사 버튼 없음 */
export type CliBlockProps =
  | { readonly cmd: CliTemplate; readonly demo?: boolean }           // cmd.kind로 읽기/쓰기 결정. 쓰기 블록은 V4에서만 나온다
  | { readonly kql: { readonly id: string; readonly text: string } } // contract/rg-queries.ts(Azure CSV 경로)
  | { readonly typed: string };                                      // V1의 직접 입력 두 줄(sha256sum·bash)
/** ⑤ 붙여넣기 입력칸. 값을 보관하지 않는다 */
export interface PasteBoxProps { readonly onText: (text: string) => void; readonly onNonText: () => void; readonly describedBy?: string }
/** 부속 관문: 내려받기(방향서 §2-4 "href는 DocLink·다운로드 관문에서만") */
export type DownloadLinkProps =
  | { readonly kind: "route"; readonly labelKey: CatalogKey; readonly primary?: boolean }  // 오프라인판 /cloudcheck/download
  | { readonly kind: "blob"; readonly labelKey: CatalogKey; readonly fileName: string; readonly mime: string;
      readonly bytes: () => string | Uint8Array; readonly primary?: boolean; readonly onResult?: (ok: boolean) => void };
```

| 관문 | 모델 입력 | 렌더 규칙 | 금지·주의 |
|---|---|---|---|
| **MaskedValue** | `DisplayValue` (`plain` · `sensitive{type, full, masked, flags}` · `redacted{why}`) | plain: `<bdi class="cc-mv cc-any" translate="no">text</bdi>` / sensitive: `<span class="cc-mv cc-any" translate="no"><bdi class="cc-mask-full">full</bdi><bdi class="cc-mask-short">masked</bdi></span>` — 화면은 full, 인쇄·화면 가리기는 masked(CSS 전환, §4-4) / redacted: `<span class="cc-mv cc-mv--redacted">가린 값</span>`(원값은 DOM에 없다, 화면·인쇄 같음). `flags`: `truncated`면 full 뒤에 `cc.c.masked.truncated-short`("(일부)"), 각 flag 설명(`cc.c.masked.flag.*`)은 값 **밖** 뒤에 `.cc-vh`로(값을 복사할 때 섞이지 않게) | 제어·양방향 문자 치환은 엔진이 이미 한 값을 그대로 그린다. `innerHTML`·`dangerouslySetInnerHTML` 0. `masked`가 `••••1234`인 ID는 화면 신원 표시에 쓰지 않는다(신원은 `AccountLabel`) |
| **DocLink** | `ExternalLink{href, host}` + 제목 키(`BasisRef.titleKey`·`IncidentRef.titleKey`·`FixGuide.*.doc`·`GuideCard.steps[].doc`·`runbook`) | `<a class="cc-ext" href target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><span class="cc-ext__t">제목</span><span class="cc-ext__x"><span class="cc-ext__host">호스트</span>↗(Icon external)</span><span class="cc-vh">새 탭에서 열림</span></a>` | 검사: `LINK_HOSTS.includes(host)` + `href`가 `https://<host>/`로 시작. 어긋나면 링크 없이 제목 글자만(오류 문구 없음). 인쇄는 제목 + 호스트 글자 |
| **StatusBadge** | `Status` (+ 개수) | `<span class="cc-sb cc-st--{status} [cc-sb--sm\|--lg]"><StatusIcon/><span class="cc-sb__t">{t("cc.status."+status)}</span>[<span class="cc-sb__n"> n</span>]</span>`. md = 점검 행·먼저 볼 3개, sm = 표·맥락 줄('확인 불가 n'), lg = V4 머리 | 글자 축약·생략 0, `white-space:nowrap`(좁으면 배지째 다음 줄) |
| **CliBlock** | `CliTemplate{kind, shell, segments}` / KQL `{id, text}` / 직접 입력 줄 | `<figure class="cc-cmd cc-cmd--{read\|write\|kql\|typed}" translate="no"><figcaption class="cc-cmd__cap">머리표</figcaption><pre class="cc-cmd__pre" tabindex="0"><code>…</code></pre></figure>`. 머리표: read `cc.c.cli.read-head` / write `cc.c.cli.write-head`(잉크 반전) / kql `cc.c.cli.kql-head` / typed `cc.c.cli.typed-head`. `segments`: `text`는 글자, `ph`는 `<span class="cc-ph">&lt;{t(key)}&gt;</span>`(꺾쇠를 그대로 둬서 복사해도 실행되지 않는다). 아래에 `cc.c.cli.placeholder-note`(ph가 있을 때), 쓰기 블록 아래 `cc.c.cli.no-copy`, 체험이면 쓰기 블록 위에 `cc.c.cli.demo-note`. KQL: 클릭 전체 선택(CSS) + **키보드 포커스 때 `getSelection().selectAllChildren(code)`**(클립보드 API 아님) + `aria-describedby` → `cc.c.cli.select-hint` | 복사 버튼·클립보드 API 0. 쓰기·읽기·직접 입력 블록에는 전체 선택 없음. 자리표시자에 숨김 낭독 글자를 넣지 않는다(복사 결과가 깨진다) |
| **PasteBox** | (입력) | `<textarea class="cc-ta cc-paste" value="" spellCheck={false} autoComplete="off" autoCorrect="off" autoCapitalize="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false">` + 라벨 `cc.c.paste.label` + 안내 `cc.c.paste.hint`. `onPaste`: `preventDefault()` → `clipboardData.getData("text/plain")`이 있으면 `onText`, 없으면 `onNonText`. `onDrop`(글자) 같은 처리. 값은 언제나 빈 문자열(입력칸에 남지 않으므로 키 파일 거부 때 "입력칸을 비웠습니다"가 사실이 된다). `onChange`는 아무것도 하지 않는 함수로 둔다(제어 컴포넌트 경고 방지). `readOnly`는 쓰지 않는다(붙여넣기 자체가 막힐 수 있다 [일반 지식]) | 25MB 문자열을 `<textarea>`에 넣지 않는다. 내용을 상태·로그에 남기지 않는다(곧바로 `recognize`) |
| **DownloadLink** | 오프라인판 / 수집기 원문 / 마스킹 사본 / 예외 파일 | route: `<a class="cc-btn [cc-btn--primary]" href="/cloudcheck/download" download>`(`file://`이면 렌더하지 않음) / blob: `<button>` → `Blob` → `URL.createObjectURL` → 임시 `<a download>` 클릭 → 다음 틱에 `revokeObjectURL`. 성공 낭독 `cc.app.live.downloaded`("내려받기를 시작했습니다…"), 예외가 나면 `cc.app.download.fail` | `location.*` 대입·`window.open` 0. 파일 이름: `cloudcheck-aws.sh`·`cloudcheck-azure.sh` / `cloudcheck-masked.json`⟨잠정, X15⟩ / `cloudcheck-exceptions.json` |

### 5-2. 나머지 컴포넌트

| 컴포넌트 | 파일 | props (모델 v1 타입) | 규칙·비고 |
|---|---|---|---|
| StatusIcon | `StatusIcon.tsx` + `icons.ts` | `{ status: Status; size?: 16 \| 20 \| 24 }` | UI §2-2 path. import는 R2의 세 곳만 |
| DoorIcon / Icon | `DoorIcon.tsx` / `Icon.tsx` | `{ door: DoorId; size?: 16\|20\|24\|32 }` / `{ name: "external"\|"chevron"\|"file"\|"back"\|"close"; size? }` | 잉크색, 상태 색 금지. `icons.ts` 머리에 라이선스 `/*! */` |
| T · Msg | `T.tsx` | §5-0 | `MsgParam.v`는 `MaskedValue`로, `t`는 `<time dateTime>`+`fmtTime` |
| AccountLabel | `AccountLabel.tsx` | `{ alias: DisplayValue \| null; last4: string }` | 별칭(MaskedValue, 없으면 `cc.ctx.no-alias`) + `<span aria-hidden="true" class="cc-acct__l4">••••{last4}</span>` + `<span class="cc-vh">{cc.c.acct.last4-sr}</span>`. 신원 표기는 이것만(D4) |
| Chip | `Chip.tsx` | `{ variant?: "hint"\|"strong"\|"inv"\|"soon"; children }` | '대상 n개'(`cc.c.chip.targets`), '못 본 것 n'(`--strong`, 이상 없음 행 필수), '직접 볼 것 n'(`--strong`), '권장'(`--inv`), '준비 중'(`--soon`), 본인 응답 라벨 |
| LabelChip | `Chip.tsx` | `{ label: Exclude<Label, { kind: "exception" }> }` | `intended-public-candidate`·`unusual-characters` 실선, `name-hint`·`legacy-hint`는 `--hint`(추정). 문구 `cc.label.*` |
| ExceptionLabel | `Chip.tsx` | `{ label: Extract<Label, { kind: "exception" }> }` | active `cc.label.exception-active`, expired `cc.label.exception-expired`(점선). `reason`은 엔진이 정리한 `DisplayValue`(UI 상태의 원문 문자열을 직접 그리지 않는다) |
| ImpactChip | `Chip.tsx` | `{ impact: FixGuide["impact"]; prodImpact: boolean }` | `cc-impact--low\|medium\|high`(테두리 굵기 차등, 신호등 색 금지) + `prodImpact`면 `cc.c.chip.prod-impact` |
| UnknownTone | `UnknownTone.tsx` | `{ children; as?: "div"\|"p" }` | `.cc-untone.cc-hatch`. **도형·'확인 불가' 글자 없음.** 미판정 줄·권한 해제 힌트·입력 읽기 실패·비교 거부 |
| StatusLegend | `StatusLegend.tsx` | `{}` | 5상태 도형 + `cc.status.*` + `cc.status.desc.*`, STATUS_ORDER 순. 툴팁 금지 |
| DistributionChips | `DistributionChips.tsx` | `{ dist: Distribution; size?: "md"\|"sm"; hideZero?: boolean; lead?: boolean }` | 칩 5개 STATUS_ORDER 고정, md = 분포(0 표시 `--zero`), sm = 문 머리(`hideZero`). `lead`면 "점검 {total}개". 막대·도넛·비율 금지 |
| AppHeader | `AppHeader.tsx` | `{ current: ScreenId; offline: boolean; onNav: (s: "start"\|"catalog"\|"about") => void }` | 워드마크 `<button class="cc-hdr__brand">`, 메뉴 `<button class="cc-link cc-link--nav" aria-current>`. `offline`이면 `cc.hdr.offline` 줄. 스티키 아님 |
| Band · DemoFrame | `Band.tsx` | `{ kind: "beta"\|"demo" }` / `{}` | `<aside class="cc-band [cc-band--demo]" aria-label={cc.band.aria}>` 태그·줄·보조 3키(§8-2). 닫기·펼치기 버튼 없음. DemoFrame은 `aria-hidden` 고정 프레임 |
| StickyContextBar | `StickyContextBar.tsx` | `{ identity: IdentityBlock; asOf: AsOf \| null; unknownRules: number; exceptionsActive: number \| null; demoCompanyKey: CatalogKey \| null; age: Extract<TimeNotice, { kind: "snapshot-age" }> \| null; screenMasked: boolean }` | `AccountLabel` · 클라우드 · `cc.ctx.asof`(+`cc.ctx.asof-approx` when `asOf.source` ∈ filename·file-time) · `StatusBadge sm unknown count` · `cc.ctx.exceptions` · 경과(`cc.ctx.age.*`, 24시간 이상일 때만) · 체험이면 `cc.ctx.demo-company` · 화면 가리기면 `cc.ctx.screen-mask`. V3·V4 |
| SkipButton · JumpNav | `Skip.tsx` | `{ target: () => HTMLElement \| null }` / `{ items: { labelKey: CatalogKey; target: () => HTMLElement \| null }[] }` | 버튼 + `focus()`(해시 불변). JumpNav는 포커스를 받을 때만 보인다(`.cc-jump`) |
| LiveRegions | `LiveRegions.tsx` | `{ polite: string; assertive: string }` | `role="status"`·`role="alert"` 두 개, 보이는 패널에는 `aria-live` 금지. 글자는 페이지가 `t()`로 넘긴다 |
| ConfirmDialog | `ConfirmDialog.tsx` | `{ open: boolean; onStay(): void; onGo(): void }` | `<dialog>` `showModal()`, 처음 포커스 [리포트로 돌아가기], Esc = 돌아가기, 닫히면 호출 버튼으로 포커스. 파괴적 버튼도 외곽선(빨강 없음). `<dialog>` 미지원이면 같은 문구의 인라인 패널 |
| Fold | `Fold.tsx` | `useFold(id: string, defaultOpen?: boolean)` + `<FoldButton>` | 열림 상태는 화면 `view` 상태에 저장(V4→V3 복원). 영역에 `cc-po`를 줄지(인쇄 펼침)는 호출하는 쪽이 정한다 |
| PromiseBlock | `PromiseBlock.tsx` | `{ variant: "full"\|"short" }` | full(V0·V8): `cc.promise.line` + `no-send` + `verify-link`(버튼) + `caveat`. short(V2): `no-send` + `caveat`. **caveat는 약속 바로 아래 항상** |
| Disclaimer | `Disclaimer.tsx` | `{}` | `cc.disclaimer.body`(허용 키). V3 분포 아래 + 인쇄 마지막 바닥 + V8 |
| ScopePanel | `ScopePanel.tsx` | `{ report: Report; onShowManual(): void }` | 접을 수 없음(R-03). 행: 신원·범위·수집·권한·문별 수집·못 보는 것 7가지(§7-1 대조표 그대로). 권한 해제 힌트·거부된 호출은 각각 상위 3개 + `Fold`(인쇄 펼침), '호출 기록 자세히'는 `Fold`(인쇄 숨김). Azure 구독별 상태는 `Fold`. 힌트 문장은 `UnknownTone` |
| DoorCollectionRow | `DoorCollectionRow.tsx` | `{ rows: readonly { door: DoorId; status: DoorCollection["status"]; judgeLevel?: DoorCollection["judgeLevel"]; reason?: DoorCollection["reason"] }[]; compact?: boolean }` | 색 없음(수집 상태지 판정이 아니다). V1(경로별 상수)·V2(인식 결과)·V3(`DoorCollection`) 공용 어댑터 타입 |
| Banner | `Banner.tsx` | `{ variant: "strong"\|"info"\|"exception"\|"demo"; title: ReactNode; body?: ReactNode; foldId?: string }` | strong: `role="note"` 항상 펼침 / info: `foldId`가 있으면 제목이 `FoldButton`·본문 `Fold`(`cc-po`), 없으면 제목·본문이 모두 보인다(V0 A3·A3', V4 F3') / exception: 한 줄 + 대상 없음 `Fold` / demo: 체험 안내·Azure 준비 중. 닫기 버튼 없음. 모델 타입 `Banner`와 이름이 겹치므로 `import type { Banner as EngineBanner }` |
| ReportNotices | `ReportNotices.tsx` | `{ banners: readonly EngineBanner[]; time: readonly TimeNotice[]; overlay: ExceptionOverlay \| null; unmatchedRuleIds: readonly RuleId[] }` | 표시 순서·변형은 §6-4 표 고정. 문구 `cc.banner.*`·`cc.time.*`·`cc.c.exc.summary`·`cc.c.exc.unmatched-line`. `future-timestamp`의 분 수는 그리지 않는다(Q2) |
| FirstLook | `FirstLook.tsx` | `{ firstLook: FirstLook; rules: ReadonlyMap<RuleId, RuleResult>; catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; onFix(id: RuleId): void; onShowTargets(id: RuleId): void; onShowManual(): void }` | findings: `<ol role="list" class="cc-pl">` 최대 3행, 번호 장식 없음, `[고치는 법]`(fix 있고 위험·주의일 때) + `[대상 n개 보기]`(확인 불가는 `[직접 볼 목록에서 보기]`) / unlock: 묶음마다 `cc.c.first.unlock.<kind>` + 점검 제목 나열 / none-found: info 배너 + `cc.c.first.none-body` + 졸업 경로. 축하 연출 없음 |
| DoorSection | `DoorSection.tsx` | `{ door: DoorResult; catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; inputs: readonly InputSummary[]; overlay: ExceptionOverlay \| null; view: DoorView; on: DoorHandlers }` | 머리: DoorIcon + `cc.door.*.name` + term + `DistributionChips sm hideZero`(문 단위 배지 없음) + `Chip--strong` '직접 볼 것 n'(`manualCount`, 0도 표시). 수집 줄 `cc.c.dsec.collect.*`(+입력이 2개 이상이면 `cc.c.dsec.collect.input`, findings-only면 `cc.c.doorrow.findings-only`). 본문: `collection.status === "not-collected"`면 `NotCollectedGroup` 하나, 아니면 `RuleRow`들(엔진 순서 그대로) → 끝에 `NaFold` → 그 문의 실제 사례 1건(priority가 가장 작은 `incident`). `DoorView`(열린 점검 id 집합·대상 표 쪽수·열린 예외 폼)와 `DoorHandlers`(펼침·고치는 법·직접 볼 목록·예외 콜백)는 `DoorSection.tsx`가 정의하는 어댑터 타입이다 |
| RuleRow | `RuleRow.tsx` | `{ rule: RuleResult; entry: RuleCatalogEntry; open: boolean; onToggle(): void; onFix?(): void; onShowManual?(): void; table: TargetTableProps }` | `<li class="cc-rule cc-st--{status} [cc-hatch]">` → `.cc-rule__sum`: `<h3><button class="cc-tog cc-rule__tog" aria-expanded aria-controls>` 안에 `StatusBadge md` + 제목 + chevron, 버튼 밖에 사유 줄(`Msg why`, 해당 없음은 `cc.c.rule.na-basis` + `Msg basis`), 이상 없음·해당 없음은 꼬리표 `cc.c.rule.tail`(coverage·asOf), 동작 영역: '대상 n개' 칩, 이상 없음이면 '못 본 것 n'(`entry.cannotSee.length`, 필수), `[고치는 법]`(위험·주의 + `entry.fix`), `[직접 볼 목록에서 보기]`(확인 불가). 본문 `Fold`(위험·주의·확인 불가는 `cc-po`): 영향 → 확인할 질문(주의) → 판단하지 못한 이유(`gaps` → `Msg short`) + 푸는 방법(`resolution`) → `allowsClear:false`면 `cc.c.chip.no-clear` → 대상 표 → 이 점검이 보지 못하는 것 → 근거(DocLink)·마지막 확인일 → 호출 기록(`EvidenceList`, `Fold`, 인쇄 숨김). 기본 접힘 |
| NotCollectedGroup · NaFold | `RuleRow.tsx` | `{ rules: readonly RuleResult[] }` | 묶음 줄 = `StatusBadge unknown` + `cc.c.dsec.not-collected-group`(펼치면 점검 요약줄들, 인쇄는 요약줄만 `.cc-ncg`) / `cc.c.dsec.na-fold`(펼치면 해당 없음 행 + 근거 줄, 인쇄 펼침) |
| TargetTable | `TargetTable.tsx` | `{ rule: RuleResult; overlay: ExceptionOverlay \| null; shown: number; onMore(): void; canMark(item: ItemResult): boolean; editingId: string \| null; onOpenForm(id: string): void; onSave(item: ItemResult, v: { reason: string; until: IsoDate }): void; onRemove(item: ItemResult): void; today: IsoDate }` | 열: 상태(`StatusBadge sm`) · 대상(`MaskedValue` + `cc.c.rtype.<type>`) · 위치(`cc.c.loc.global` / 리전 plain / 구독 MaskedValue) · 사실(`Msg` facts) · 사유(`Msg why`, 확인 불가면 + 푸는 방법) · 표시(LabelChip·ExceptionLabel) · 동작(`[예외로 표시]` = `canMark`일 때). 50행 단위 `[더 보기]`, 넘친 행은 `cc-fold cc-po`(인쇄 펼침). 이상 없음 행은 `cc-tt__row--clear` + 인쇄 생략 줄(`cc.c.table.print-clear-omitted`). 예외 행 `cc-exc`(만료 `cc-exc--expired`). 폼은 대상 행 바로 아래 `<tr class="cc-tt__form">` |
| EvidenceList | `EvidenceList.tsx` | `{ items: readonly ItemResult[] }` | 대상들의 `evidence[]`를 `receipt.id`로 중복 제거해 나열: `cc.c.rule.evidence.line`(id·call·scope·result 이름(`cc.c.scope.receipt.*`)·at) + count·errorCode가 있으면 덧붙임 / CSV 출처는 `cc.c.rule.evidence.csv`. `observed`는 그리지 않는다 |
| ExceptionForm | `ExceptionForm.tsx` | `{ target: DisplayValue; today: IsoDate; onSave(v: { reason: string; until: IsoDate }): void; onCancel(): void }` | 사유 `<textarea class="cc-in">`(1~500자, PasteBox와 같은 맞춤법·자동완성 차단 속성) + 만료일 `<input type="date" min=내일 max=today+EXCEPTION_MAX_DAYS>`(기본 30일 뒤) + `cc.c.exc.state-note`. 오류: 2px 잉크 테두리 + `aria-invalid` + `aria-describedby` + 첫 오류 포커스(빨강 없음). Esc = 취소 |
| ManualCheckList | `ManualCheckList.tsx` | `{ items: readonly ManualCheckItem[]; catalog: ReadonlyMap<RuleId, RuleCatalogEntry>; selfAnswers: Readonly<Record<string, SelfAnswer>>; onSelfAnswer(ruleId: RuleId, stepId: string, v: SelfAnswer): void }` (`SelfAnswer = "yes"\|"no"\|"unknown"`) | `<section class="cc-manual">` 표 `cc-mc cc-ct`. 열: 번호(인쇄에서 앞에 빈 칸 `.cc-mc__box`) · 문 · 무엇을(D14) · 왜 판단하지 못했나(`Msg why`, null이면 origin별 대체) · 어떻게 보나(`t(howKey)` + 권한이면 `cc.c.manual.how-perm`, 권한 이름 `.cc-mc__perm`) · 메모(인쇄만). 같은 점검·같은 사유 대상이 6개 이상이면 `cc.c.manual.group` 한 행 + `Fold`(인쇄 펼침). 정렬 = 문 순서 → priority → origin. 화면 체크 칸 없음. `[이 목록만 인쇄]` |
| GuideCard | `GuideCard.tsx` | `{ entry: RuleCatalogEntry; answers: Readonly<Record<string, SelfAnswer>>; onAnswer(stepId: string, v: SelfAnswer): void }` (`entry.guide`가 non-null인 AZ-MFA-G) | **AZ-MFA-G 점검 행의 본문(대상 표 자리)에 들어간다.** 행 자체는 일반 `RuleRow`(확인 불가, `StatusBadge` 포함). 내용: `cc.c.guide.badge-note` + `cc.c.guide.asymmetry` + 단계 `<ol class="cc-steps">`(외곽선 번호 상자, 채운 사각 금지) + 단계마다 `<fieldset>` 라디오(처음엔 선택 없음) + `cc.c.self.note`. 고른 뒤 행에 `cc.label.self-answer`. **입력은 이 한 곳뿐**이고, 직접 볼 목록의 guide-card 행은 라디오 없이 단계 요약 + 본인 응답 라벨만 보인다. 상태·분포·먼저 볼 3개는 바뀌지 않는다(INV-8). 모델 타입 `GuideCard`와 이름이 겹치므로 `import type { GuideCard as GuideCardData }` |
| PrintOptions · PrintHead | `Print.tsx` | `{ onPrint(o: { scope: "full"\|"list"; unmask: boolean }): void }` / `{ report: Report; kind: "full"\|"list" }` | 옵션: 범위 라디오(`cc.c.print.scope.*`) + '이름·ID 표시' 체크(기본 꺼짐, `cc.c.print.unmask-note` + `cc.c.print.unmask-scope`) + `[인쇄 창 열기]`. PrintHead(`cc-print-only cc-phead--full\|--list`): `cc.c.print.header(-list)` · 체험이면 `.cc-print-demo` · 신원(AccountLabel, 인쇄 마스킹) · 범위 · 수집 시각 full · 수집기 · 페이지·룰셋 버전 · 입력 파일 이름(MaskedValue) · `cc.c.print.masked-note`/`unmasked-note`(`cc-print-unmask` 기준 CSS 전환) · 목록만이면 `cc.c.dist.sentence` + `cc.c.print.list-note` |
| FixSteps · AccountCheck | `FixSteps.tsx` | `{ fix: FixGuide; demo: boolean }` / `{ identity: IdentityBlock; cmd: CliTemplate<"read">; demo: boolean }` | 3단계 모두 펼침(`<ol class="cc-steps">`): ① `observe.textKey` + DocLink(doc) + 읽기 CliBlock / ② `change.property`(`cc.fix.property`) + DocLink + `change.textKey` + 쓰기 CliBlock / ③ `revert.textKey` + 쓰기 CliBlock. `commands: []`면 블록 없이 문구만. AccountCheck: `.cc-fix__acct` 2px 잉크 상자, `cc.fix.account` + `cc.fix.account-check(.azure)` + 읽기 CliBlock(체험이면 `cc.fix.account-demo`) |
| ScriptViewer | `ScriptViewer.tsx` | `{ fileName: string; source: string; sectionRe: RegExp }` | 문별 `<details class="cc-sv__d">`(V1이라 허용) + 줄마다 `<span class="cc-sv__l">`(줄 번호 CSS 카운터, 복사 제외), 주석 줄 `--c`. 표식을 못 찾으면 한 덩어리. `translate="no"`. 인쇄 숨김 |
| FootprintTable | `FootprintTable.tsx` | `{ cloud: Cloud }` | `contract/calls.ts`의 `AWS_CALLS`/`AZURE_CALLS`를 그대로: 호출(`cli`) · 권한(`permission`, null이면 `cc.c.fp.no-permission`) · 쓰는 곳(`phases` → `cc.c.fp.phase.*`/문 이름) · 단위(`cc.c.fp.unit.*`) · 구분(`readOnly:false`는 `cc.c.fp.kind.generate`, 행 `cc-fp__w`). 표 `cc-ct` |
| HashDisplay | `HashDisplay.tsx` | `{ hex: string; describedBy?: string }` | 64자를 `<span class="cc-hash__g">` 8개 + `<wbr>`(공백 문자 없음), `tabindex="0"` + 포커스 때 전체 선택, `aria-label`은 고정 문구 `cc.c.hash.aria`, 힌트 `cc.c.hash.hint`. 일치·불일치 판정 UI는 만들지 않는다(Q13) |
| PathChooser | `PathChooser.tsx` | `{ cloud: Cloud; value: "csv"\|"collector"; onChange(v): void }` | `<fieldset>` + 카드 2장 = `<label class="cc-card cc-card--radio [cc-card--on]">` 안에 **보이는** 네이티브 라디오(`.cc-card__pick`). 선택해도 이동하지 않는다(WCAG 3.2.2). 각 카드에 `DoorCollectionRow compact` |
| DropZone · InputTabs | `DropZone.tsx` | `{ onFiles(files: readonly File[]): void; busy: boolean }` / `{ value: "file"\|"paste"; onChange(v): void }` | `[파일 고르기]` 버튼 항상 보임(숨은 `<input type="file" multiple accept=".json,.csv">`), `.cc-drop--over`, 읽는 중 `aria-busy`. 탭은 `role="tablist"`(앱에서 하나), 화살표 키 |
| FileRecognitionList | `FileRecognitionList.tsx` | `{ recs: readonly InputRecognition[]; onRemove(index: number): void; compareLast4: string \| null }` | 표 `cc-fr cc-ct`, 열 7개(UX C4). 이름 `MaskedValue`(붙여넣기는 `cc.c.rlist.via.paste`), 크기, 종류 `cc.c.rlist.kind.*`, 계정 `AccountLabel`(`identityPreview`), 수집 시각(+추정), 담긴 곳, 상태(`ok` → `cc.c.rlist.ok`, 그 밖 → `cc.recog.<status>.title`), `[빼기]`(`aria-labelledby`). 실패 행 아래 `<tr>`에 `UnknownTone`(title·reason·hint·next, `detail` 파라미터). `superseded`는 글자 `--cc-ink-2`. 비교 모드면 같은/다른 계정 글자 |
| BeforeAfterTable · IdentityCompare | `Compare.tsx` | `{ cmp: Extract<Comparison, { ok: true }>; catalog }` / `{ before: CompareSide; after: CompareSide }` | 묶음 순서: became-unknown(+ 강조 줄) → worse → better → became-known(+ 줄) → same(접힘). 대상 칸 = `items.before/after`에서 값이 다른 상태만 STATUS_ORDER 순 최대 3개(없으면 `cc.c.cmp.items.same`). 비율·점수·개선율 없음. IdentityCompare: 두 카드, 다른 필드는 밑줄 |
| DemoCards · CloudRadio | `Demo.tsx` | `{ cloud: Cloud; onOpen(set: DemoSetId): void }` / `{ value: Cloud; onChange(v): void }` | 카드 순서 C → D → A → B, 세트 글자 비표시. 카드 = 회사 이름(h3) + 가르치는 것 + 이야기 + 클라우드별 한 줄 + 보조 버튼 `cc.demo.open`(접근 이름에 회사 이름). `cc-cards cc-cards--4` |

### 5-3. 삭제·통합한 컴포넌트

| UI·검토 원문 이름 | 최종 | 이유 |
|---|---|---|
| StateBadge · CommandBlock · ExternalLink | **StatusBadge · CliBlock · DocLink** | 방향서 §3 관문 이름으로 통일 |
| CloudChoiceCard | 삭제 → V0 버튼 | C10 |
| PathCard | **PathChooser**(라디오 카드) | C8 |
| DemoSetPicker | **DemoCards + CloudRadio** | C9 |
| PriorityList / UnlockList | **FirstLook** 하나 | `FirstLook.mode` 세 가지를 한 컴포넌트가 분기 |
| Banner 6변형 | **Banner 4변형 + UnknownTone + ReportNotices** | C1 |
| ExceptionBand | **ExceptionLabel + 행 클래스 `cc-exc`** | 라벨과 띠의 역할 분리 |
| ManualCheckList 화면 체크박스 | 삭제 | Q10 |
| DemoGuide(체험 안내 패널) | P1(컷 0.5) | Q14 |
| 해시 대조 칸 | 만들지 않음(v1.1) | Q13 |
| BootFallback | **템플릿 정적 HTML**(프론트팀장) + `.cc-boot.cc-banner.cc-banner--strong` | 스크립트가 안 돌 때 보여야 하므로 React 밖 |

---

## 6. 화면 최종 스펙 (페이지개발자 소유: `_client/main.tsx`, `_client/screens/**`, `_client/state/**`, `_client/config.ts`, `_client/i18n/ko/screens.ts`)

와이어프레임·블록 ID(A1~J8)·모바일 차이·상태 변형은 **UX §4-1~4-10을 최종본으로 지정**하고, 아래 표의 결정이 그 위에 덮어쓴다. 문구는 UX §7 + 이 문서 §8-2.

### 6-0. 공통 동작

**상태·모듈 배치**

| 파일 | 하는 일 | 규칙 |
|---|---|---|
| `state/screens.ts` | `ScreenId` 유니온, 화면별 필요 데이터, `document.title`·h1·낭독 문구 표(UX §6-1 그대로) | 제목에 사용자 데이터 0(점검 제목은 정적이라 허용) |
| `state/reducer.ts` | 앱 상태(UX §3-4) + `input`(buildInput 결과 핸들, 마스킹 사본용) + `exceptions` + `selfAnswers` + `view`(점검 펼침·대상 표 쪽수·알림 접힘·스크롤·인쇄 옵션·화면 가리기) | 저장소·URL·쿠키 0(R-06) |
| `state/history.ts` | **`pushState`의 유일한 위치**: `history.pushState({ cc: screen }, "")`. 부팅 때 `history.state`는 읽기만, `popstate`는 필요 데이터가 없으면 V0, 예외가 나면 `historyDisabled`(이력 없는 모드). 앱 안 [← 돌아가기]는 push한 적이 있으면 `history.back()`, 없으면 V0 | `replaceState`·URL·해시 변경 0 (UX §6-3 그대로) |
| `state/pipeline.ts` | 파일 → `file.size` 상한(`LIMITS`) → "읽는 중" 행 먼저 그림(두 프레임 뒤 파싱) → `recognize()` → 목록 갱신 / CTA → `buildInput(recs)` → `ok`면 `judge(input)` → V3, 아니면 갱신된 인식 상태로 V2에 남음 / 체험: 데이터 블록 JSON → `recognize({ via: "demo", … })` → 같은 길 | UI는 `NormalizedInput`·`ParsedHandle`을 열어 보지 않는다 |
| `state/clock.ts` | 현재 시각을 읽는 **유일한 곳**: `nowIso()`(→ `timeNotices`), `todayLocal()`(→ `overlayExceptions`·예외 폼 min/max) | `vi.setSystemTime`으로 시험 |
| `state/print.ts` | §4-4 `printReport` | `beforeprint` 의존 코드 없음 |
| `state/unload.ts` | 실제 리포트가 메모리에 있을 때만 `beforeunload` 등록, 없어지면 해제(Q7) | 체험 제외 |
| `state/drop.ts` | 창 전체 `dragover`·`drop` 가로채기 + 화면별 처리(Q8) | 글자 드래그는 막지 않는다 |
| `state/compact.ts` | 스크롤 24px 넘으면 `<html>`에 `cc-compact`, 16px 아래로 오면 해제(8px 이력) | passive 리스너 |
| `state/live.ts` | 라이브 영역 문구(`polite`·`assertive`), 포커스 이동 뒤 한 번만 | "완료" 금지 |
| `config.ts` | `CLOUD_AVAILABILITY = { aws: "beta", azure: "soon" }` · `HASH_CHANNELS = { repo: null, pdf: null }` · `PAGE_VERSION` · `REPO_URL = null`⟨X13⟩ · `COLLECTOR_FLAGS = { print: "--print", doors: "--doors" }`⟨X8⟩ · `ACCOUNT_CHECK: Record<Cloud, CliTemplate<"read">>`(`aws sts get-caller-identity` / `az account show`) · `MAX_FILES = 8` · `TABLE_PAGE = 50` · `MANUAL_GROUP_MIN = 6` · `EXC_DEFAULT_DAYS = 30` · `SCRIPT_SECTION_RE`⟨X16⟩ | 숫자·플래그는 카탈로그에 넣지 않는다 |

**`<html>` 루트에 붙는 것**: `lang="ko"` · `data-cc-booted`(부팅 후) · `cc-compact`(스크롤) · `cc-file`(`file://`) · `cc-screen-mask`(P1 화면 가리기) · `cc-print-unmask`·`cc-print-list-only`(**인쇄 버튼 흐름 동안만**).

**화면 전환(모든 화면)**: h1(`tabindex="-1"`)로 포커스(V4 → V3 복귀는 눌렀던 `[고치는 법]`) → `document.title` → 맨 위로 즉시 스크롤(복귀 제외, 부드러운 스크롤 없음) → 라이브 영역 낭독 1회(체험이면 앞에 "체험 모드입니다."). V2~V5의 `<main>`에 `translate="no"`.

**예외 표시**: `[예외로 표시]` → 폼 → 새 항목 `{ ruleId, resource: item.resource.key, reason, until, createdAt: todayLocal() }` → **`parseExceptions(serializeExceptions(next))`로 왕복 검사**(스키마를 따로 import하지 않는 단일 원천) → `overlayExceptions(report, next, todayLocal())` 재계산 → 라벨은 오버레이 결과로만 그린다. 불러오기 실패는 `cc.report.exc.import-fail` + `cc.report.exc.issue.<코드>`(⟨X10⟩).

### 6-1. V0 시작 (`start`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| A1 띠 · A2 머리 | Band(beta) · AppHeader | `CLOUD_AVAILABILITY` | `file://`면 `cc.hdr.offline` |
| A3 열린 리포트 / A3' 새로고침 복구 | Banner info + 버튼 | `report.mode.kind === "real"` / 부팅 때 `history.state.cc` ∈ {input, report, fix, compare} + 메모리 비어 있음 | 체험 리포트는 A3을 띄우지 않는다 |
| A4 제목·약속 | `h1` + `.cc-display`(`cc.promise.line`) | — | 정적 HTML이 먼저 그린다(프론트팀장 템플릿이 같은 클래스·같은 글자로) |
| A5 다섯 곳 | DoorIcon 32 ×5 + `cc.door.*` | 상수 | 색 없음 |
| A6 시작 버튼 | `.cc-btn--primary` [AWS 점검 시작] · Azure **펼침 버튼**(`aria-expanded`, `Chip--soon` + `cc.start.cta.azure-soon`) · [체험 모드로 먼저 보기] · [결과 파일이 이미 있어요] | `CLOUD_AVAILABILITY.azure` | Azure 펼침 안: Banner demo(`cc.start.azure-soon.note`) + [Azure 체험 보기](→ V6, Azure 선택). `beta`·`open`이 되면 일반 이동 버튼 |
| A7 약속·고지 | PromiseBlock full | — | "직접 확인하는 방법 3가지 →"는 A9로 포커스 옮기는 버튼 |
| A8 못 보는 것(일부) | 목록 3줄(`cc.gcs.leaked-keys`·`idp-mfa`·`app-vulnerabilities`) + [7가지 모두 보기](같은 자리 `Fold`) | 상수 | 화면 이동 없음 |
| A9 직접 확인 3가지 | 번호 목록 `cc.start.verify.*` | — | |
| A10 오프라인판 | DownloadLink route + `cc.start.offline.*` + 채널 행(`HASH_CHANNELS`, null이면 '준비 중') + `cc.start.offline.hash-note` | `HASH_CHANNELS` | `file://`면 블록 전체 숨김. **해시 값은 쓰지 않는다**(Q1) |
| A11 바닥 | `cc.app.footer.*` | `PAGE_VERSION`, 룰셋 버전 | `REPO_URL`이 null이면 저장소 링크 없음 |

전환: T1~T5, T18, T20(UX §3-5). 드롭: V2로 이동 후 읽기.

### 6-2. V1 수집 준비 (`prep`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| B0 머리 줄 | [← 처음으로] · `cc.prep.cloud` + [바꾸기] | `cloud` | 재수집 모드면 `cc.prep.recollect.*`(이전 계정은 `AccountLabel`) / 휴대폰 폭이면 `cc.prep.mobile-note` |
| B1 방법 선택 | PathChooser | 경로별 문 범위 상수(① AWS = mfa·key, Azure = key·net·sto 일부 / ② = 5문) | 기본 ②. 선택은 이동이 아니다 |
| B2 하는 일 | `cc.prep.what.body.<cloud>` | — | 방향서 §7-2 문구 그대로 |
| B3 순서 | 단계 8개 버튼(해당 블록으로 포커스) + [결과 파일 넣기 →](보조) | — | |
| B4 원문 | ScriptViewer | 데이터 블록의 수집기 원문, `SCRIPT_SECTION_RE` | `translate="no"` |
| B5·B6 호출 목록·권한 | FootprintTable + 권한 중복 제거 목록 | `AWS_CALLS`/`AZURE_CALLS` | 합계 "호출 26종 · 보고서 생성 요청 1건"(AWS) |
| B7 해시 | HashDisplay(이 페이지 값) + 저장소·PDF 행(`HASH_CHANNELS`) + `cc.prep.hash.independence`·`rule`·`mismatch` | 데이터 블록 `RELEASES`의 현재 수집기 해시 | 대조 입력칸 없음(Q13) |
| B8 실행 권한 | `cc.prep.identity.*` | — | |
| B9 내려받기 | **DownloadLink blob(주 버튼)** `cc.prep.download.cta` + `cc.prep.download.file` | 수집기 원문 바이트 | 바이트 = 저장소 파일 = `SHA256SUMS`(C-10, STEP 5 확인) |
| B10 셸 두 줄 | CliBlock typed ×2(`sha256sum cloudcheck-aws.sh`, `bash cloudcheck-aws.sh`) + `cc.prep.shell.*` | 파일 이름 | 복사 버튼 없음, 전체 선택 없음 |
| B11 결과 받기 · 붙여넣기 | `cc.prep.result.*` + `cc.prep.paste.body`(`{flag}` = `COLLECTOR_FLAGS.print`) | config | ⟨X8⟩ |
| B12 정리 | `cc.prep.cleanup.body`·`manual`·`warn` | — | ⟨X7⟩ C-12 Enter 프롬프트 |
| B13 넣기 | [결과 파일 넣기 →] | — | 방법 ①이면 이것이 주 버튼 |
| B14 ClickFix | `cc.prep.clickfix.*` + DocLink(helpnetsecurity) | — | V8과 같은 문구 |
| Azure 방법 ① | CliBlock kql ×2(`contract/rg-queries.ts`) + `cc.prep.csv.azure.*` | KQL 원문 | `azure`가 `soon`이 아닐 때만 |

전환: T6, T18. 드롭: V2로 이동 후 읽기. 화면 안 번역 허용, 명령·해시·원문 블록은 `translate="no"`.

### 6-3. V2 결과 파일 넣기 (`input`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| C1 비교 모드 | Banner info `cc.input.compare.banner`(+ AccountLabel) | `compareBase.identity` | |
| C2 입력 | InputTabs + DropZone / PasteBox | — | 한 번에 `MAX_FILES`개, 폴더·글자 아닌 붙여넣기 안내(`cc.input.*`) |
| C3 약속 | PromiseBlock short | — | 드롭존 바로 옆(아래) |
| C4 읽은 파일 | FileRecognitionList | `InputRecognition[]` | 실패 행 아래 UnknownTone 패널(도형 없음). 키 파일 거부(B7)는 `assertive` 낭독 |
| C5 볼 수 있는 곳 | DoorCollectionRow | `ok` 인식 결과의 `doors` 합집합(나머지 문은 not-collected) | 읽은 파일이 1개 이상일 때만 |
| C6 계정 확인 | `cc.input.identity`(+ AccountLabel) + `cc.input.confirm` | `identityPreview` | `ok` 결과끼리 클라우드·끝 4자리가 다르면 `cc.input.mixed` |
| C7 CTA | `.cc-btn--primary` `cc.input.cta` / 비교 모드 `cc.input.compare.cta` + [모두 비우기] | `buildInput` 결과 | 읽을 파일이 없거나 섞여 있으면 `aria-disabled` + 이유 글자(`cc.input.cta-disabled`·`cc.input.mixed`·`cc.input.compare-mismatch`). 누르면 "리포트를 만드는 중입니다" 낭독 |

전환: T7, T8, T18. 드롭: 그대로 읽기.

### 6-4. V3 리포트 (`report`)

블록 순서는 고정이다: D0 띠 → 머리 → D1 고정 맥락 줄 → D2 h1 + 구역 이동 → D3 조회 범위 → D4 알림 → D5 분포 → D6 먼저 볼 3개 → D7 문 5구역 → D8 직접 볼 목록 → D9 동작 → D10 바닥. 인쇄 전용: PrintHead(full·list), 체험 큰 제목, 마지막 Disclaimer.

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| D0·D1 | Band · DemoFrame · StickyContextBar | `report.mode`, `identity`, `collection.asOf`, `distribution.rules.unknown`, `overlay.counts.active`, `timeNotices`의 snapshot-age | 600px 이하 높이에서 맥락 줄 스티키 해제(CSS) |
| D2 | `h1`(`cc.report.title`/`-demo`) + `cc.report.sub` + JumpNav | — | |
| D3 | ScopePanel | §7-1 | 접을 수 없음 |
| D4 | ReportNotices | `report.banners` + `timeNotices(report, nowIso())` + `overlay` | 아래 순서표 |
| D5 | DistributionChips(lead, md) + StatusLegend + 미판정 줄(UnknownTone `cc.c.dist.unresolved` + [직접 볼 목록으로 이동]) + Disclaimer | `distribution.rules` | `distribution.items`는 쓰지 않는다. 미판정 줄은 unknown > 0일 때만 |
| D6 | FirstLook | `report.firstLook` + 문별 `rules` 조회 | `[대상 n개 보기]`는 해당 점검 행을 펼치고 포커스(화면 이동 아님, `pushState` 없음) |
| D7 | DoorSection ×5(DOORS 순서) → RuleRow·NotCollectedGroup·NaFold·TargetTable·EvidenceList | `report.doors[]`, `RULE_CATALOG`, `overlay` | 점검 행 기본 접힘, 엔진 순서를 다시 정렬하지 않는다 |
| D8 | ManualCheckList (+ `[이 목록만 인쇄]` = `printReport({scope:"list", unmask:false})`) | `report.manualChecklist`, `selfAnswers` | 빈 상태 `cc.c.manual.empty` |
| D9 | PrintOptions · DownloadLink blob(마스킹 사본 `maskedCopy(input)`) · 예외 내보내기(DownloadLink blob `serializeExceptions`, 옆에 `cc.report.exc.export-note` 상시) · 예외 불러오기(숨은 파일 입력 `.json`) · [다시 수집한 파일과 비교] · `.cc-actions__new` [새 점검] · ⟨P1⟩ 화면 가리기 토글 · `cc.report.loss` 상시 | — | 체험: 인쇄 · [다른 회사 보기] · [학습용 계정으로 실제로 해 보기]만(UX §11-5) |
| D10 | `cc.c.grad.line` + 버전 | `PAGE_VERSION`, `engine.rulesetVersion` | |

**D4 알림 순서·변형** (엔진 배너 순서는 엔진이 정하고, 시간 알림·예외 요약은 표시 단계에서 이 순서로 끼운다)

| 순서 | 종류 | 변형 | 출처 |
|---|---|---|---|
| 1 | `secrets-detected` | strong(항상 펼침) | `banners` |
| 2 | `snapshot-age` very-stale(7일) | strong | `timeNotices` |
| 3~10 | `areas-not-judged` · `schema-newer-minor` · `identity-unconfirmed` · `collector-unknown-release` · `csv-scope-unproven` · `collected-at-approximate` · `doors-skipped` · `duplicate-input-ignored` | info(제목 버튼 + 접힌 본문, 인쇄 펼침) | `banners` |
| 11~13 | `snapshot-age` stale(24시간) · `future-timestamp` · `guidance-stale` | info | `timeNotices` |
| 14 | 예외 요약 | exception(한 줄 + 대상 없음 접힘) | `overlay.counts` + 예외 파일의 미일치 항목 `ruleId` |

체험 모드는 `timeNotices`가 빈 배열이라 2·11~13이 없고, 체험 데이터는 `collector-unknown-release`가 나지 않게 만든다(DB설계자). 조회 범위 수집 줄 아래에 `cc.c.scope.demo-fixed-time`.

전환: T9~T11, T16, T17, T18. 드롭: 삼키고 `cc.app.drop.ignored-report`.

### 6-5. V4 고치는 법 (`fix`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| F0 | Band · StickyContextBar | V3과 같음 | |
| F1 | [← 리포트로] + `h1` + StatusBadge lg + 제목 + `cc.fix.meta` | `RuleResult.{status, distribution.total}`, `entry.titleKey`, door | |
| F2 | AccountCheck | `identity`, `ACCOUNT_CHECK[cloud]` | 모든 V4에 있다(4겹) |
| F3 · F3' | ImpactChip + `cc.fix.last-verified` / guidance-stale면 Banner info `cc.fix.stale` | `entry.fix.{impact, prodImpact}`, `entry.lastVerified`, `entry.basis.length`, `timeNotices` | |
| F4~F6 | FixSteps | `entry.fix` | 3단계 모두 펼침, **쓰기 명령이 나오는 유일한 화면** |
| F7 | 대상 목록(위험·주의 대상 `MaskedValue`, 50개씩) + `cc.fix.targets-mask-note` | `rule.items` | |
| F8 | DocLink `cc.fix.runbook` | `entry.fix.runbook` | 있을 때만 |
| F9 | 주 버튼 `cc.fix.cta`(→ V1 재수집, `compareBase = report`) / 체험 `cc.fix.cta-demo`(→ V1, 체험 해제) | 앱 상태 | |

`fix`가 없는 점검(가이드형)은 V3에 `[고치는 법]`이 없으므로 V4로 오지 않는다. 데이터 없이 도착하면 V0. 전환: T12, T13, T18.

### 6-6. V5 재점검 비교 (`compare`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| G1 | IdentityCompare + Banner info(`cc.compare.reordered`, `cc.compare.same-report`) | `cmp.before/after`, `reordered`, `sameCredentialReport` | |
| G2 | `cc.compare.summary(.zero)` + BeforeAfterTable | `cmp.rules[]`, `RULE_CATALOG` | became-unknown 맨 위 + 강조 줄(Q11) |
| 거부 | UnknownTone(`cc.compare.refuse.<reason>`, 도형 없음) + IdentityCompare + [다른 파일로 다시 비교] | `cmp.ok === false` | |
| G3 | 주 버튼 `cc.compare.cta`(→ V3, `report = after`) + [다른 파일로 다시 비교] | — | |

Before/After가 컷되면(방향서 컷 1순위) V5, V2 비교 모드, V3 [다시 수집한 파일과 비교], V4 둘째 CTA를 함께 지운다(UX §13-3).

### 6-7. V6 체험 모드 (`demo`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| H0 | Band demo + DemoFrame | — | 이 화면부터 체험 표식 |
| H1 | CloudRadio + (Azure 선택 시 `azure`가 `soon`이면) Banner demo `cc.demo.azure-note` | `CLOUD_AVAILABILITY` | 선택해도 이동하지 않는다 |
| H2 | DemoCards(C → D → A → B) | `cc.demo.set.*`, 데이터 블록 체험 JSON(클라우드 × 세트) | 카드 버튼 → pipeline 체험 경로 → V3(`mode: demo`) |

세트별로 데이터가 시연해야 할 UI 상태는 UX §11-3 "요건" 열이 최종이다(DB설계자). 전환: T15, T18.

### 6-8. V7 판정 규칙 (`catalog`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| I1 | 클라우드 라디오(전체·AWS·Azure) + `cc.catalog.count`·`order` | `RULE_CATALOG`의 `released` 개수 | |
| I2 | 문 5그룹 × 점검 `<details>`(V7이라 허용) | `RuleCatalogEntry` 전부(§7-3) | 제목 옆에 룰 ID(고정폭 작은 글자)와 `cc.catalog.max.*`. **priority 숫자는 보이지 않는다**(순위처럼 읽힘). 상태별 조건은 `conditionKeys`에 있는 상태만, 기준값에 공개 기준·도구 기준 칩, `released:false`는 펼칠 수 없는 한 줄 `cc.catalog.unreleased` |

전환: T19.

### 6-9. V8 이 도구에 대해 (`about`)

| 블록 | 컴포넌트 | 데이터 | 규칙 |
|---|---|---|---|
| J1 | PromiseBlock full + Disclaimer + `cc.about.not-certification` | — | 허용 키 2개가 모두 이 화면에 있다 |
| J2 | `cc.about.verify.*` | — | |
| J3 | DownloadLink route(주 버튼) + 채널 + `cc.about.offline.why` | `HASH_CHANNELS` | `file://`면 내려받기 숨김, 해시 값 없음 |
| J4 | 못 보는 것 7가지 전체(`cc.gcs.*`) | 상수 | |
| J5 | 못 막는 경로 4가지(`cc.about.paths.*`) | — | 외부 안내 링크는 STEP 4에서 `LINK_HOSTS` 안 URL을 확인할 때까지 **글자만** |
| J6 | ClickFix(`cc.prep.clickfix.*` 재사용) | — | |
| J7 | `cc.c.grad.line` | — | CIS는 글자만 |
| J8 | 버전 · 만든 곳 · `cc.about.oss` · 언어 · (REPO_URL 있으면) 저장소·의견 링크 | config | |

전환: T19.

---

## 7. §5 모델 ↔ 화면 요소 대조표

방향서 §5-2 `report.ts`의 모든 필드가 어디에 그려지는지 적는다. "—"는 그리지 않는다는 뜻이고 이유는 §7-4에 모았다. 컴포넌트 이름은 §5, 키는 UX §7 + §8-2.

### 7-1. `Report`와 머리 블록

| 필드 | 그리는 곳 | 형태·키 |
|---|---|---|
| `model` | — | §7-4 |
| `engine.version` | — | §7-4 |
| `engine.rulesetVersion` | V3 바닥, V8 J8, 인쇄 머리, 앱 바닥 | `cc.app.footer.versions`의 `{ruleset}` |
| `mode.kind` | 띠 선택(§3-1), DemoFrame, 맥락 줄, 동작 줄 구성, V4 문구·CTA, `beforeunload`, V0 A3, `timeNotices` 호출 여부, 인쇄 체험 제목 | — |
| `mode.setId` | 맥락 줄·인쇄 머리의 가짜 회사 이름 | `cc.ctx.demo-company` + `cc.demo.set.<id>.name`(세트 글자 자체는 비표시) |
| `identity.cloud` | 맥락 줄, 조회 범위 신원, V4 AccountCheck, 인쇄 머리 | `cc.app.cloud.*` |
| `identity.account` | — | §7-4(신원은 별칭 + 끝 4자리) |
| `identity.accountLast4` | 맥락 줄, 신원 줄, V2 계정 열(인식 미리보기와 같은 값), V4, 인쇄 머리 | `AccountLabel`(`••••1234` + 숨김 글자 `cc.c.acct.last4-sr`) |
| `identity.alias` | 같은 곳 | `MaskedValue`(화면 전체·인쇄 `alias-001`), null이면 `cc.ctx.no-alias` |
| `identity.currentSubscription` | 신원 줄(Azure) | `cc.c.scope.current-sub` + `MaskedValue` |
| `identity.principalType` · `principalName` | 신원 줄 | `cc.c.scope.run-as`(`cc.c.scope.principal.*` + `MaskedValue`) |
| `identity.source` | 신원 줄 | `cc.c.scope.id-source.*` |
| `identity.confirmed` | 신원 줄 | `cc.c.scope.confirmed.*`(null → `none`) |
| `scope.unit` · `checked` · `visible` | 범위 줄 | `cc.c.scope.range.region\|subscription\|none`(분수 표기 금지) |
| `scope.missing[].name` · `.reason` | 범위 줄 | `cc.c.scope.range.missing-*` + `MaskedValue`(이름) + `cc.reason.short.<reason>` |
| `scope.missing[].receiptId` | — | §7-4 |
| `scope.outOfScope[]` | 범위 줄 | `cc.c.scope.range.out-of-scope` + `cc.c.scope.oos.<reason>` |
| `scope.subscriptions[]` | 범위 줄 아래 접힘(Azure) | `cc.c.scope.subs.heading` · id·name `MaskedValue` · state plain · `cc.c.scope.subs.<queried>` |
| `scope.proven` | 범위 줄(false일 때 한 줄) | `cc.c.scope.range.unproven` |
| `collection.asOf` | 맥락 줄(짧은 KST, 출처가 filename·file-time이면 "(추정)"), 수집 줄(전체 KST + UTC), 인쇄 머리 | `cc.ctx.asof`, `cc.c.scope.collect.line` |
| `collection.asOfRange` | 수집 줄(입력마다 시각이 다를 때) | `cc.c.scope.collect.range` |
| `collection.credentialReport` | 수집 줄 | `cc.c.scope.collect.credential` + `cc.c.scope.collect.credential-source.*` |
| `collection.receipts` | 수집 줄 합계(성공 = ok+empty+notconfigured · 거부 = denied · 오류 = error+unsupported+throttled · 잘림 = truncated) + '호출 기록 자세히' 접힘의 8종 표 | `cc.c.scope.collect.line`, `cc.c.scope.receipt.*`, `cc.c.scope.receipt.total`. CSV 입력이면 `cc.c.scope.collect.no-receipts` |
| `collection.inputs[]` | 수집 줄(수집기 버전), '호출 기록 자세히' 접힘의 "읽은 입력" 표, 인쇄 머리(입력 파일 이름) | 이름 `MaskedValue`, `kind` → `cc.c.rlist.kind.*`, `via` → `cc.c.scope.inputs.via.*`, `bytes`, `asOf`, `collector.{name, version, knownRelease}` → `cc.c.scope.inputs.known-release\|unknown-release`, `schema.id` → 고정폭 글자, `schema.support` → `cc.c.scope.inputs.schema-*`(exact는 표시 없음), `doors` → `cc.c.scope.inputs.door-*`, `scopeProven` → `cc.c.scope.inputs.proven\|unproven`. `index`는 키로만 |
| `permissions.denied[]` | 권한 줄(상위 3 + 접힘, 인쇄 펼침) | `cc.c.scope.perm.denied-line`(`call` · `scope` MaskedValue · `errorCode` · `times` · `ruleIds.length`) + `permission`이 `call`과 다르면 `cc.c.scope.perm.need`. 없으면 `cc.c.scope.perm.none` |
| `permissions.denied[].receiptIds` | — | §7-4 |
| `permissions.unlockHints[]` | 권한 줄 힌트 문장(상위 3 + `cc.c.scope.perm.more-hints`, UnknownTone) | `cc.c.scope.perm.hint`(`permission` · `unlocks.length` → `{rules}` · `total` → `{items}`) |
| `permissions.unlockHints[].unlocks[].items` | — | §7-4(합계 `total`로 말한다) |
| `cannotSee[]` | 조회 범위 '못 보는 것 7가지'(전부), V8 J4 | `cc.gcs.<code>`. `manualChecklist`에 AWS-MFA-2 auto-notice가 있으면 `idp-mfa` 줄을 굵게 + `cc.gcs.idp-mfa.emphasis` |
| `distribution.rules` | 분포 칩(lead + 5칩), 맥락 줄 '확인 불가 n', 미판정 줄, V3 낭독(`cc.app.live.report`), 목록만 인쇄 머리(`cc.c.dist.sentence`) | `DistributionChips`, `StatusBadge sm count` |
| `distribution.items` | — | §7-4 |
| `banners[]` | D4 알림(§6-4 순서표) | `cc.banner.<kind>.title/body`. 파라미터: `count`, `doors` → 문 이름 나열(`cc.door.*.name`), `got`·`supported`. `areas-not-judged.reason`은 — (§7-4) |
| `doors[]` | 문 5구역 | §7-2 |
| `firstLook` | D6 | `mode`별 §5-2 FirstLook |
| `manualChecklist[]` | D8, 인쇄(목록 + 체크 칸) | §7-2 |

### 7-2. 문 · 점검 · 대상 · 증거 · 직접 볼 목록

| 타입.필드 | 그리는 곳 | 형태·키 |
|---|---|---|
| `DoorResult.door` | 구역 h2, JumpNav, 직접 볼 목록 '문' 열 | DoorIcon + `cc.door.<id>.name` · `term` |
| `DoorResult.worstStatus` | — | §7-4 |
| `DoorResult.collection.status` · `judgeLevel` · `reason` · `asOf` | 구역 수집 줄, 조회 범위 문별 수집 줄 | `cc.c.dsec.collect.collected\|partial\|none`(+ `Msg reason`), `findings-only` → `cc.c.doorrow.findings-only`, `asOf` → 시각 + 출처. `not-collected`면 구역 본문이 NotCollectedGroup 하나 |
| `DoorResult.collection.inputIndex` | 구역 수집 줄(입력이 2개 이상일 때) | `cc.c.dsec.collect.input` + 입력 이름 `MaskedValue` |
| `DoorResult.rules` | RuleRow들(엔진 순서 그대로) | — |
| `DoorResult.distribution` | 구역 머리 칩 | `DistributionChips sm hideZero` |
| `DoorResult.manualCount` | 구역 머리 | `Chip--strong` `cc.c.chip.manual`(0도 표시) |
| `RuleResult.ruleId` | `RULE_CATALOG` 조인 키, DOM id·`aria-controls` | — |
| `RuleResult.cloud` · `.door` | — / 묶음 위치 | §7-4 |
| `RuleResult.priority` | — | §7-4 |
| `RuleResult.items` | TargetTable, EvidenceList, V4 대상 목록 | — |
| `RuleResult.distribution` | 요약줄 '대상 n개'(`total`) | `cc.c.chip.targets` |
| `RuleResult.labels` | 요약줄 LabelChip | `cc.label.*` |
| `RuleResult.inputIndex` | — | §7-4 |
| `RuleResult.status` | StatusBadge md, 행 클래스, 동작 버튼 종류, 인쇄 펼침 여부 | — |
| `RuleResult.why` | 사유 줄 | `Msg`(위험·주의 `cc.reason.<rule>.<slug>` 또는 `cc.reason.isolated-denial`, 확인 불가 `cc.reason.unknown.<c>`) |
| `RuleResult.asOf` · `.coverage` | 꼬리표(이상 없음·해당 없음 필수, 위험·주의는 `asOf`가 있을 때) | `cc.c.rule.tail` + `cc.c.rule.coverage.<kind>[-all\|-part]` |
| `RuleResult.coverage.population` | — | §7-4 |
| `RuleResult.gaps`(unknown) | 본문 '판단하지 못한 이유' | `cc.c.rule.gaps` + `Msg short` → `cc.reason.short.<c>` |
| `RuleResult.resolution`(unknown) | 본문 '푸는 방법' | `cc.c.rule.resolution` + `cc.c.rule.resolution.<kind>`(권한이면 `permissions` 고정폭 나열) |
| `RuleResult.basis`(na) | 해당 없음 행 근거 줄 | `cc.c.rule.na-basis` + `Msg` |
| `ItemResult.id` | React 키, 오버레이 키, `aria-labelledby` 대상 id | — |
| `ItemResult.resource.type` | 대상 칸 아래 작은 글자 | `cc.c.rtype.<type>`(17종, §8-2) |
| `ItemResult.resource.name` | 대상 칸, V4 대상 목록, 직접 볼 목록 '무엇을' | `MaskedValue` |
| `ItemResult.resource.location` | 위치 칸 | global → `cc.c.loc.global`, region → plain, subscription → `MaskedValue` |
| `ItemResult.resource.key` | — | §7-4(예외 파일 `resource` 값으로만 쓴다) |
| `ItemResult.facts` | 사실 칸 | `Msg` → `cc.fact.<slug>` |
| `ItemResult.labels` | 표시 칸 | LabelChip, 예외는 오버레이 ExceptionLabel |
| `ItemResult.status` · `.why` | 상태 칸 StatusBadge sm · 사유 칸 `Msg` | 이상 없음 행 클래스 `cc-tt__row--clear`(인쇄 생략) |
| `ItemResult.resolution`(unknown) | 사유 칸 뒤 짧은 '푸는 방법' | `cc.c.rule.resolution.<kind>` |
| `ItemResult.evidence[]` → `EvidenceRef.receipt.{id, call, scope, result, count, errorCode, at}` | 본문 '이 점검이 쓴 호출 기록'(접힘, 인쇄 숨김) | `cc.c.rule.evidence`, `cc.c.rule.evidence.line`(`scope`는 `MaskedValue`, `result`는 `cc.c.scope.receipt.*`, `at`은 UTC) |
| `EvidenceRef.csv.{kind, column, row}` | 같은 곳 | `cc.c.rule.evidence.csv` |
| `EvidenceRef.observed[]` | — | §7-4 |
| `ManualCheckItem.id` | React 키 | — |
| `ManualCheckItem.origin` | '무엇을' 칸의 작은 칩(out-of-scope·guide-card·auto-notice만), `why`가 null일 때 대체 문장 선택 | `cc.c.manual.origin.*`, `cc.c.manual.why.*`, guide-card는 `cc.c.guide.badge-note` |
| `ManualCheckItem.door` | '문' 열 | `cc.door.<id>.name` · `term`(null이면 빈칸) |
| `ManualCheckItem.ruleId` · `.resource` · `.what` | '무엇을' 칸 = 점검 제목 + 대상 이름 + `what`(D14) | `entry.titleKey` + `MaskedValue` + `Msg` |
| `ManualCheckItem.why` | '왜 판단하지 못했나' | `Msg`(`cc.reason.unknown.*`) |
| `ManualCheckItem.howKey` · `.resolution` | '어떻게 보나' | `t(howKey)` + 권한이면 `cc.c.manual.how-perm` |
| `FirstLook.findings.ruleIds` | 행(최대 3) | StatusBadge md + 제목 + `Msg why` + 버튼 |
| `FirstLook.unlock.groups[].{resolution, ruleIds}` | 묶음 줄 | `cc.c.first.unlock.<kind>`(권한이면 `{permission}` = `permissions.join`) + 점검 제목 나열 |
| `FirstLook.none-found` | info 배너 | `cc.c.first.none` · `none-body` · `none-cta` + 졸업 경로 |

### 7-3. 리포트 밖 (judge 밖의 함수 결과 · 카탈로그 · 입력 인식)

| 타입.필드 | 그리는 곳 | 형태·키 |
|---|---|---|
| `InputRecognition.via` · `.name` | V2 파일 칸 | 파일 → `MaskedValue`(인쇄 `file-001`), 붙여넣기 → `cc.c.rlist.via.paste` |
| `.bytes` | 파일 칸 아래 크기 | KB/MB 소수 첫째 자리 |
| `.status` | 상태 칸 + 실패 패널 | `cc.c.rlist.ok` / `cc.recog.<status>.title·reason·hint·next` |
| `.kind` | 종류 칸 | `cc.c.rlist.kind.*` |
| `.detail` | 실패 패널 파라미터 | `line`·`col` → `cc.recog.parse-error.reason`, `maybeTruncated`+`tail` → `reason-truncated`, `hint: exceptions-file` → `cc.recog.not-cloudcheck.exceptions-file`, `major` → `schema-major.reason` |
| `.identityPreview` | 계정 칸, C6 계정 줄, 비교 모드 같은/다른 계정, 섞임 판정 | `AccountLabel` |
| `.asOf` · `.doors` | 수집 시각 칸(+ `cc.c.rlist.asof-approx`) · 담긴 곳 칸, DoorCollectionRow | — |
| `.handle` | — | §7-4 |
| `TimeNotice` snapshot-age | D4(stale info · very-stale strong), 맥락 줄 경과 | `cc.time.snapshot-age.<level>.*`, `cc.ctx.age.hours\|days`(`days = floor(ageHours/24)`) |
| `TimeNotice` future-timestamp | D4 info | `cc.time.future-timestamp.*`. `aheadMinutes`는 — (§7-4) |
| `TimeNotice` guidance-stale | D4 info(점검 제목 나열), V4 F3' | `cc.time.guidance-stale.*`, `cc.fix.stale` |
| `ExceptionOverlay.byItemId` | 대상 행 ExceptionLabel + 행 클래스 | `cc.label.exception-active\|expired` |
| `ExceptionOverlay.counts` | 예외 요약 띠, 맥락 줄 '예외 n'(`active`) | `cc.c.exc.summary`, `cc.ctx.exceptions` |
| `ExceptionOverlay.entries[]` | 예외 요약 접힘의 '대상 없음' 줄(state = unmatched인 항목의 `ruleId` → 점검 제목) | `cc.c.exc.unmatched-line`. 리소스 키·사유 원문은 그리지 않는다 |
| `Comparison`(ok:false) `reason` · `before` · `after` | V5 거부 블록 | `cc.compare.refuse.<reason>` + IdentityCompare |
| `Comparison`(ok:true) `reordered` · `sameCredentialReport` | V5 G1 info 배너 | `cc.compare.reordered`, `cc.compare.same-report` |
| `Comparison.rules[].{ruleId, before, after, change, items}` | BeforeAfterTable | `cc.c.cmp.*`, `cc.compare.became-*.note` |
| `CompareSide.{cloud, accountLast4, alias, asOf}` | IdentityCompare | `AccountLabel` + 시각 |
| `RuleCatalogEntry.ruleId` | V7 제목 옆 작은 고정폭 글자 | 데이터 |
| `.cloud` · `.door` | V7 필터·문 그룹, V3 조인 | — |
| `.kind` | — | §7-4 |
| `.released` | V7 `cc.catalog.unreleased`(false), V3에는 엔진이 넣지 않음 | — |
| `.titleKey` · `.summaryKey` | V3 행·V4·V5·V7·직접 볼 목록 / V7 펼침 첫 줄 | E 키 |
| `.maxStatus` · `.allowsClear` | V7 `cc.catalog.max.*` / V3 본문·V7 `cc.c.chip.no-clear` | — |
| `.priority` | — | §7-4 |
| `.conditionKeys` | V7 상태별 조건(있는 상태만) | E 키 |
| `.impactKey` · `.questionKey` | V3 본문 '영향'·'확인할 질문'(주의) | `cc.c.rule.impact`·`question` + E 키 |
| `.paths` · `.permissions` · `.params` | V7 수집 경로(`cc.catalog.path.*`) · 필요한 권한(고정폭) · 기준값(`RuleParamView`: `key` 문구 + `value` + `basis` → `cc.catalog.param.*` 칩) | — |
| `.cannotSee` | V3 '못 본 것 n' 칩(`length`)과 본문 목록, V7 | E 키 |
| `.falsePositiveKeys` | V7 '의도한 설정일 수 있는 경우' | E 키 |
| `.fix` (`FixGuide`) | V3 `[고치는 법]` 노출 여부, V4 전체 | `impact`·`prodImpact` → ImpactChip, `observe/change/revert.{textKey, doc, property, commands}` → FixSteps·CliBlock·DocLink, `runbook` → F8 |
| `CliTemplate.{kind, shell, segments}` | CliBlock | `kind` → 머리표, `segments[].ph.key` → `<…>`(E `cc.ph.*`). `shell`은 — (§7-4) |
| `.guide` (`GuideCard.steps[].{id, textKey, doc}`) | AZ-MFA-G 행 본문 GuideCard, 직접 볼 목록 요약 | `id` → `selfAnswers` 키 |
| `.basis[]` (`BasisRef.{titleKey, link}`) | V3 본문 근거, V4 F3 개수, V7 | DocLink. `kind`는 — (§7-4) |
| `.incident` (`IncidentRef.{titleKey, date, link, sourceName}`) | 문 구역 끝 '실제 사례'(그 문에서 priority가 가장 작은 것 1건) | `cc.c.dsec.incident` + DocLink |
| `.lastVerified` | V3 본문, V4 F3, V7 | `cc.c.rule.last-verified`, `cc.fix.last-verified` |
| `Label`(intended-public-candidate · name-hint · legacy-hint · unusual-characters) | 점검·대상 표시 칸 | LabelChip `cc.label.*` |
| `Label`(exception) | 대상 행 | ExceptionLabel(오버레이 결과만) |

### 7-4. 그리지 않는 필드와 이유

| 필드 | 이유 |
|---|---|
| `Report.model` | 모델 버전 상수(엔진·UI 계약 확인용). 사용자에게 의미가 없다 |
| `Report.engine.version` | 엔진은 같은 HTML에 묶여 페이지 버전과 함께 바뀐다. 화면은 페이지 버전(`PAGE_VERSION`)과 룰셋 버전을 보인다. 프론트팀장이 생성 단계에서 두 값의 관계를 고정한다 |
| `IdentityBlock.account` | 기획서 §5-5: 신원은 '별칭 + ID 끝 4자리'. 맥락 줄이 스크린샷용이라 전체 ID가 찍히면 안 된다 |
| `ScopeBlock.missing[].receiptId`, `DeniedCall.receiptIds` | 같은 추적 정보가 점검별 '호출 기록'(EvidenceList)에 있다. 범위 패널을 짧게 유지한다(R-03 영역) |
| `PermissionHint.unlocks[].items` | 힌트 문장은 합계(`total`)로 말한다. 점검별 내역은 '먼저 풀 것' 묶음이 점검 제목으로 보여 준다 |
| `Report.distribution.items` | 대상 단위 합계는 초록을 부풀린다(D1) |
| `DoorResult.worstStatus` | 문 단위 종합 배지 금지(D2). 종이에도 같은 이유. 정답지(G3) 전용 |
| `RuleBase.cloud` | 리포트 전체가 한 클라우드다(신원 줄) |
| `RuleBase.priority`, `RuleCatalogEntry.priority` | 순서에만 쓴다. 숫자를 보이면 순위·점수처럼 읽힌다 |
| `RuleBase.inputIndex` | 같은 문의 점검은 같은 입력을 쓴다 → 문 단위(`DoorCollection.inputIndex`)로 보인다 |
| `Coverage.population` | 대상 수는 '대상 n개' 칩(`distribution.total`), 모수 0은 해당 없음 근거 줄이 말한다 |
| `Coverage.proven` | 꼬리표의 `covered`·`total`("리전 16개(활성 17개 중)")과 확인 불가 사유가 같은 뜻을 전한다. 이상 없음·해당 없음은 타입상 항상 증명됨이다 |
| `Banner`(areas-not-judged)`.reason` | 본문 한 문장(`cc.banner.areas-not-judged.body`)이 '읽지 못함'과 '필요한 값 없음' 두 경우를 함께 말한다 |
| `Label`(exception)`.createdAt` | 라벨은 사유·만료일만 보인다. 만든 날은 예외 파일에 남는다 |
| `ResourceRef.key` (`MatchKey`) | 방향서: 화면에 그리지 않는다(리소스 이름 포함). 예외 파일 값으로만 쓴다 |
| `EvidenceRef.observed` | 사용자 말로 바꾼 같은 사실이 `facts`로 이미 나온다. 원시 값은 QA·정답지와 v1.1 '증거 보기' 후보 |
| `InputRecognition.handle` | 불투명 핸들(방향서 §5-3) |
| `TimeNotice.future-timestamp.aheadMinutes` | 분 단위 수치는 금지어 정책 때문에 쓰지 않는다(Q2) |
| `ExceptionOverlay.entries`(unmatched 밖) | 개별 항목 상태는 대상 행 라벨로 이미 보인다 |
| `RuleCatalogEntry.kind` | `maxStatus`('항상 확인 불가')와 `released`가 같은 정보를 준다 |
| `BasisRef.kind`, `CliTemplate.shell` | 근거 제목 문구가 출처 종류를 말하고(템플릿 "<제공처> 문서: …"), 명령 글자가 셸을 말한다 |

---

## 8. 카피 덱 소유 분할 (확정)

### 8-1. 파일 경계와 키 규칙

**762키 전문은 UX §7-2(C 319) · §7-3(S 322) · §7-4(E 121)를 최종본으로 지정하고, §8-2의 변경분을 덮어쓴다.** 금지어 결과는 §10.

| 파일 | 소유 | 첫 세그먼트 | 담는 것 |
|---|---|---|---|
| `_client/i18n/ko/components.ts` (C) | 컴포넌트개발자 | `c` `status` `door` `label` `band` `hdr` `ctx` `boot` `promise` `disclaimer` | `_client/components/**`가 그리는 글자. `cc.boot.*`는 템플릿(프론트팀장)이 빌드 때 가져다 정적 HTML에 넣는다 |
| `_client/i18n/ko/screens.ts` (S) | 페이지개발자 | `app` `start` `prep` `input` `report` `fix` `compare` `demo` `catalog` `about` | `_client/screens/**`·`main.tsx`·`state/live.ts`가 그리는 글자 |
| `src/lib/cloudcheck/rules/i18n/ko.ts` (E) | DB설계자(디자인 검수) | `reason` `banner` `time` `recog` `fact` `gcs` `rule` + **`ph` `basis` `incident`** | 엔진·룰이 **코드로** 내는 문장, 룰 카탈로그의 모든 `CatalogKey`(제목·요약·조건·영향·질문·못 보는 것·오탐·고치는 법·가이드 단계·기준값·근거·사례 제목), 명령 자리표시자 이름 |
| `_client/i18n/index.ts` | 프론트팀장 | — | 세 파일 병합, `CatalogKey` 타입, `t`·`keyOf`·`fmtTime`(§5-0), **첫 세그먼트 ↔ 파일 린트** |

**키 규칙(최종)**: UX §7-1 규칙 1~9를 그대로 따르고 넷을 더한다.
10. 사용자 데이터 파라미터(`{v}`)가 든 키는 `<T>`·`<Msg>`로만 꺼낸다. `t()`로 꺼내는 키(속성·`document.title`·라이브 영역)에는 사용자 데이터 파라미터가 없어야 한다.
11. 엔진 코드 → 키 변환은 `keyOf()` 하나로만 한다(UX 규칙 7의 소문자 변환).
12. 플래그·숫자 같은 상수는 카탈로그에 쓰지 않고 `config.ts`에서 파라미터로 넣는다. 조사 문제를 피하려고 **문장 끝 콜론 뒤**에 둔다. 단, UX가 이미 숫자를 적은 상한 문구(`cc.c.drop.limit` "25MB/20MB", `cc.c.exc.until-help` "90일", `cc.recog.too-deep.reason` "32단계")는 그대로 두고, 상수와 같은지 테스트로 묶는다(G-D25).
13. 어느 코드든 어느 파일의 키든 그릴 수 있다. 소유는 **글자를 쓰는 사람** 기준이다(예: V0가 `cc.gcs.*`(E)를 그린다).

### 8-2. 최종본 변경분 (UX 카피 덱 대비)

**변경**

| 키 | 파일 | 최종 문구 | 이유 |
|---|---|---|---|
| `cc.label.exception-active` | C | 예외 표시(상태는 그대로) · {reason} · {until}까지 | 고위험 #12(C14) |
| `cc.label.exception-expired` | C | 예외 표시 만료되어 해제됨 · 만료일 {until} | 방향서 §1-2 C '만료되어 해제됨' |
| `cc.label.self-answer` | C | 본인 응답: {answer}(검증 안 됨) · 상태는 확인 불가 유지 | 고위험 #12(C15) |
| `cc.c.scope.perm.denied-line` | C | {call} · {scope} — {errorCode} ({times}회, 점검 {rules}개에 영향) | `DeniedCall.scope`를 보인다 |
| `cc.report.exc.summary` → **`cc.c.exc.summary`** | S → C | (문구 그대로) 예외 {active}건 적용 · 만료되어 해제 {expired}건 · 대상 없음 {unmatched}건 | 컴포넌트(ReportNotices)가 그린다 |
| `cc.app.live.downloaded` | S | 내려받기를 시작했습니다. 브라우저의 다운로드 목록에서 확인하세요. | 페이지는 내려받기 성공을 알 수 없다(사실만 말한다) |
| `cc.prep.cleanup.body` | S | 수집기는 마지막에 결과 파일을 내려받았는지 묻습니다. 결과 파일을 내려받은 뒤에 Enter를 누르면 수집기가 그 파일을 지웁니다. 먼저 누르면 파일이 지워지니, 그때는 수집기를 다시 실행하세요. | Q3 ⟨X7⟩ |
| `cc.prep.paste.body` | S | 두 번째 줄 끝에 다음 옵션을 붙여 실행하면 결과가 화면에도 출력됩니다. 그 내용을 복사해 다음 화면의 '붙여넣기' 탭에 붙여 넣으세요. 출력이 너무 커서 잘리면 --doors로 문을 나눠 여러 번 실행하고 하나씩 붙여 넣으세요. 옵션: {flag} | Q4 ⟨X8⟩ |
| `cc.rule.aws-mfa-1.title` | E | 루트 계정 설정 | §9 ⟨X4⟩ |
| `cc.rule.az-mfa-g.title` | E | Entra MFA 적용 여부(직접 확인) | §9 ⟨X4⟩ |
| `cc.rule.aws-key-3.title` | E | 관리자 권한 액세스 키 | §9 ⟨X4⟩ |
| `cc.rule.aws-log-1.title` | E | CloudTrail 기록 설정 | §9 ⟨X4⟩ |
| `cc.rule.az-log-1.title` | E | 활동 로그 내보내기 설정 | §9 ⟨X4⟩ |

**추가 — C(`components.ts`)**

| 키 | 최종 문구 | 쓰는 곳 |
|---|---|---|
| `cc.band.beta.tag` / `.row` / `.more` | 베타 / 실계정 검증 전 / 판정이 틀릴 수 있습니다. | Band(C19·C20) |
| `cc.band.demo.tag` / `.row` / `.more` | 체험 모드 / 가짜 데이터 / 실제 계정을 점검한 결과가 아닙니다. | Band |
| `cc.c.acct.last4-sr` | 끝 네 자리 {last4} | AccountLabel(숨김 글자) |
| `cc.c.masked.truncated-short` | (일부) | MaskedValue |
| `cc.c.cli.typed-head` | 셸에 직접 입력하는 줄 | CliBlock typed |
| `cc.c.print.unmask-scope` | 이 설정은 '인쇄 창 열기' 버튼으로 인쇄할 때만 적용됩니다. 브라우저 메뉴로 인쇄하면 항상 가려서 인쇄합니다. | PrintOptions(D6) |
| `cc.c.table.print-clear-omitted` | 이상 없음 대상 {n}개는 인쇄본에서 목록을 생략했습니다. | TargetTable 인쇄 줄 |
| `cc.c.rule.evidence` | 이 점검이 쓴 호출 기록 {n}건 | EvidenceList 접힘 버튼 |
| `cc.c.rule.evidence.line` | {id} · {call} · {scope} · {result} · {at} | EvidenceList |
| `cc.c.rule.evidence.csv` | {kind} · '{column}' 열 · {row}번째 줄 | EvidenceList(CSV) |
| `cc.c.scope.perm.need` | 필요한 권한: {permission} | 거부 줄(권한 ≠ 호출) |
| `cc.c.scope.perm.more-hints` | 권한 해제 힌트 {n}개 더 보기 | 권한 줄 접힘 |
| `cc.c.scope.id-source.collector` / `.csv-arn` / `.csv-tenant` | 수집기가 확인한 신원 / CSV의 ARN에서 읽은 계정 / CSV의 테넌트 열에서 읽은 테넌트 | 신원 줄 |
| `cc.c.scope.current-sub` | 현재 구독: {sub} | 신원 줄(Azure) |
| `cc.c.scope.subs.heading` · `.ok` · `.partial` · `.failed` · `.not-queried` | 구독별 조회 상태 · 조회함 · 일부만 조회함 · 조회하지 못함 · 조회하지 않음 | 범위 줄 접힘(Azure) |
| `cc.c.scope.oos.other-tenant` · `.not-enabled` · `.not-requested` | 다른 테넌트 · 사용 중이 아닌 구독 · 요청하지 않은 구독 | 범위 밖 사유 |
| `cc.c.scope.range.unproven` | 조회 범위가 끝까지 확인되지 않았습니다. 이 영향을 받는 점검은 '없음'을 확정하지 못합니다. | 범위 줄 |
| `cc.c.scope.inputs.heading` | 읽은 입력 | 호출 기록 자세히 |
| `cc.c.scope.inputs.known-release` · `.unknown-release` | 알려진 수집기 릴리스 · 알려진 릴리스 목록에 없음 | 〃 |
| `cc.c.scope.inputs.schema-newer` · `.schema-older` | 더 새로운 형식(아는 값만 사용) · 이전 형식(없는 영역은 수집 안 함) | 〃 |
| `cc.c.scope.inputs.door-used` · `-superseded` · `-skipped` · `-absent` | 사용 · 다른 입력으로 대체 · 수집 안 함 · 담기지 않음 | 〃 |
| `cc.c.scope.inputs.via.file` · `.paste` · `.demo` | 파일 · 붙여넣기 · 체험 데이터 | 〃 |
| `cc.c.scope.inputs.proven` · `.unproven` | 범위 확인됨 · 범위 미확정 | 〃 |
| `cc.c.scope.receipt.total` | 전체 {n} | 〃 |
| `cc.c.dsec.collect.input` | 입력: {name} | 구역 수집 줄 |
| `cc.c.exc.unmatched-line` | 대상 없음 {n}건: {rules} | 예외 요약 접힘 |
| `cc.c.loc.global` | 전역 | 대상 표 위치 |
| `cc.c.manual.why.auto-notice` | 자동 판정 범위 밖이라 직접 확인해야 합니다. | 직접 볼 목록(why = null) |
| `cc.c.manual.why.out-of-scope` | 이 파일이 다루지 않는 영역입니다. | 〃 |
| `cc.c.manual.group` | 대상 {n}개 | 직접 볼 목록 묶음 |
| `cc.c.rtype.aws-account` · `root` · `iam-user` · `access-key` · `iam-role` · `region` · `security-group` · `eni` · `s3-bucket` · `trail` · `entra-tenant` · `entra-user` · `subscription` · `storage-account` · `blob-container` · `nsg` · `nic` | AWS 계정 · 루트 사용자 · IAM 사용자 · 액세스 키 · IAM 역할 · 리전 · 보안 그룹 · 네트워크 인터페이스(ENI) · S3 버킷 · CloudTrail trail · Entra 테넌트 · Entra 사용자 · 구독 · 스토리지 계정 · Blob 컨테이너 · NSG(네트워크 보안 그룹) · NIC(네트워크 인터페이스) | 대상 표 종류(17종 = `ResourceType`) |

**추가 — S(`screens.ts`)**

| 키 | 최종 문구 | 쓰는 곳 |
|---|---|---|
| `cc.prep.cleanup.manual` | --yes로 실행해 이 질문이 나오지 않았다면, 셸에서 rm 다음에 파일 이름을 직접 입력해 지우세요. | V1 B12 |
| `cc.input.mixed` | 다른 계정이나 다른 클라우드의 파일이 섞여 있습니다. 점검하려는 계정의 파일만 남기세요. | V2 C6·C7 |
| `cc.report.exc.issue.format` · `.reason` · `.until` · `.span` · `.rule` · `.too-many` | 파일 형식이 맞지 않습니다. · 사유가 비어 있는 예외가 있습니다. · 만료일이 없거나 날짜 형식이 맞지 않는 예외가 있습니다. · 만료일이 만든 날 다음 날부터 90일 안이 아닌 예외가 있습니다. · 없는 점검을 가리키는 예외가 있습니다. · 예외가 너무 많아 읽지 않았습니다. | 예외 불러오기 실패 ⟨X10⟩ |
| `cc.about.oss` | 아이콘 일부는 Lucide 아이콘(ISC 라이선스)을 고쳐 썼습니다. 라이선스 전문은 이 페이지 소스의 스크립트 끝에 있습니다. | V8 J8 |

**삭제**

| 키 | 이유 |
|---|---|
| `cc.band.beta` · `cc.band.beta-short` · `cc.band.demo` · `cc.band.demo-short` · `cc.band.expand-aria` | 띠 3키 구조로 교체, 펼치기 버튼 없음(C19·C20) |
| `cc.c.cli.placeholder-aria` | 자리표시자에 숨김 낭독 글자를 넣으면 복사 결과가 깨진다(§5-1 CliBlock) |
| `cc.c.cli.irreversible` | 모델에 '되돌릴 수 없음' 필드가 없다 → 룰 문구 안에 쓴다(D12) |
| `cc.prep.hash.compare.label` · `.match` · `.mismatch` · `.scope` · `.bad-format` | 해시 대조 칸을 만들지 않는다(Q13) |
| `cc.report.exc.summary` | `cc.c.exc.summary`로 이동 |

**E 파일 요구사항(DB설계자, 문구는 디자인 검수)**
- `cc.reason.short.<코드>`: 확인 불가 사유 **21종 전부**(UX 권고안은 7종). `gaps` 나열과 범위 패널 '빠진 리전(사유)'에 쓴다(D13).
- `cc.ph.<이름>`: 명령 자리표시자 이름(예: `cc.ph.user-name` "사용자이름", `cc.ph.sg-id` "보안그룹ID"). 꺾쇠는 컴포넌트가 붙인다.
- 직접 볼 목록 `what`용 `cc.fact.*`(예: `cc.fact.idp-mfa` "ID 공급자(IdP) 쪽 MFA") — D14.
- 고치는 법의 대안 경로·'되돌릴 수 없는 변경입니다' 경고는 `cc.rule.<id>.fix.change|revert` 문장 안에(D12).
- 체험 데이터(fixtures)의 가짜 이름·값도 금지 토큰 0(렌더 검사가 읽는다, Q2).
- 약한 제목 4건(§9)은 기획팀장 답이 오면 반영.

**최종 키 수**: C 319 + 68 − 7 = **380**, S 322 + 9 − 6 = **325**, E 121(UX 권고안) − 0 + DB설계자 추가분(`short` 14종·`ph`·`fact`·룰 카탈로그 키). C·S 합계 705.

---

## 9. 제목 × 상태 최종 표

읽는 순서는 항상 `[상태 글자] [제목] — [사유]`다. 배지와 제목만 붙여 읽어(사유 줄을 가리고) 오독 여부를 판정했다. ○ 바르게 읽힘 / △ 같은 줄의 사유·근거 줄이 필수(항상 보이므로 허용) / — 그 점검이 낼 수 없는 상태. **굵은 제목 = 방향서 §6-1 개정분, ⟨잠정⟩ = 이번 수정(X4: 기획팀장 확인 전까지 적용)**.

| priority | ID | 최종 제목 | ▲위험 | ◆주의 | ●이상 없음 | ■확인 불가 | ◌해당 없음 | 판정 |
|---|---|---|---|---|---|---|---|---|
| 10 | AWS-STO-2 | **버킷 공개 상태** | ○ | ○ | ○ | ○ | △ | ○ |
| 20 | AZ-STO-2 | **컨테이너 공개 상태** | ○ | ○ | ○ | ○ | △ | ○ |
| 30 | AWS-NET-1 | **관리·DB 포트의 인터넷 노출** | ○ | ○ | △ | ○ | — | △ (약한 권고: "… 노출 상태") |
| 40 | AZ-NET-1 | **관리·DB 포트의 인터넷 노출(NSG)** | ○ | ○ | △ | ○ | — | △ (약한 권고: "… 노출 상태(NSG)") |
| 50 | AWS-KEY-4 | **역할 신뢰 설정(외부 계정)** | ○ | ○ | ○ | ○ | △ | ○ |
| 60 | AWS-MFA-1 | 루트 계정 설정 ⟨잠정⟩ (원래 "루트 계정 문단속") | ○ | ○ | ○ | ○ | △ | ○ — "● 이상 없음 · … 문단속"이 금지 카피 '문단속 끝' 인상을 주던 문제 해소 |
| 70 | AWS-MFA-2 | 콘솔 사용자 MFA | ○ | — (INV-7이면 가능, DB설계자 확정) | ○ | ○ | △ | △ 유지 — 해당 없음 근거 줄("콘솔 비밀번호가 있는 IAM 사용자 0명(확인됨)") + IdP 직접 볼 목록 필수 |
| 80 | AZ-MFA-1 | Entra 사용자 MFA 등록 현황(조건부) | ○ | ○ | — | △ | — | ○ (`released:false`) |
| 90 | AZ-MFA-G | Entra MFA 적용 여부(직접 확인) ⟨잠정⟩ (원래 "Entra MFA 포털 확인(가이드)") | — | — | — | ○ | — | ○ — "포털 확인이 불가능" 오독 해소 |
| 100 | AWS-KEY-3 | 관리자 권한 액세스 키 ⟨잠정⟩ (원래 "관리자 열쇠 출입 제한 안내") | — | ○ | — | ○ | △ | ○ — 상태 아닌 '안내'·해결책을 제목에서 뺐다 |
| 110 | AWS-KEY-1 | **액세스 키 나이** | — | ○ | ○ | ○ | △ | ○ |
| 120 | AWS-KEY-2 | **자격증명 마지막 사용** | — | ○ | ○ | ○ | △ | ○ |
| 130 | AZ-KEY-1 | 스토리지 공유 키 회전 | — | ○ | △ | ○ | [미확인] | △ (약한 권고: "스토리지 공유 키 설정") |
| 140 | AWS-STO-1 | 계정 전체 퍼블릭 액세스 차단 | — | △ | ○ | ○ | — | △ (약한 권고: "… 차단 설정") |
| 150 | AZ-STO-1 | **익명 공개 차단 설정** | — | ○ | ○ | ○ | [미확인] | ○ |
| 160 | AWS-LOG-1 | CloudTrail 기록 설정 ⟨잠정⟩ (원래 "CloudTrail 장기 기록") | — | ○ | ○ | ○ | — | ○ — '장기'가 보관 기간까지 확인한 것처럼 읽히던 문제 해소 |
| 170 | AZ-LOG-1 | 활동 로그 내보내기 설정 ⟨잠정⟩ (원래 "활동 로그 장기 보관") | — | ○ | ○ | ○ | — | ○ — 같은 이유 |
| 180 | AZ-LOG-2 | Blob 접근 기록 | — | △ | ○ | ○ | △ | △ (약한 권고: "Blob 접근 기록 설정") |

- **공통 규칙**(UX §8 결론 확정): ① 제목에 상태 형용사('공개된' '열린' '오래된')와 효과 명사('장기' '안전' '제한')를 넣지 않는다 ② 해당 없음 행은 근거 줄 없이 나타나지 않는다 ③ 이상 없음 행은 꼬리표(확인한 범위 · 기준 시각)와 '못 본 것 n' 칩 없이 나타나지 않는다(G-D11).
- 약한 권고 4건(NET-1 계열·AZ-KEY-1·AWS-STO-1·AZ-LOG-2)은 사유 줄이 요약줄에 항상 보여 △로도 G7을 닫을 수 있다. 기획팀장이 승인하면 반영한다(X5).
- 스코프 컷 5번(AWS-KEY-3을 안내 카드로 축소)이 적용되면 이 행을 다시 검토한다.

---

## 10. 금지어 점검 결과와 G7 디자인 항목

### 10-1. 실행 결과 [확인: 실행]

- **방법**: 방향서 §7-3 `banned-words.ts`의 `BANNED_KO` 11종 · `ALLOWED_CONTEXT_KO` · `findBanned()`를 그대로(타입만 지워) 옮긴 스크립트로 실행했다. 입력은 UX 스펙의 표에서 키 열이 `cc.`로 시작하는 행의 '한국어' 열이다.
- **카피 덱 762행**(C 319 · S 322 · E 121, 중복 키 0, 첫 세그먼트 ↔ 소속 위반 0): 히트는 2행이고 둘 다 방향서 `ALLOWED_KEYS`다 — `cc.disclaimer.body`(보증·준수·인증), `cc.about.not-certification`(보증·준수·인증). **위반 0.**
- **UX §9 예시 3룰 89행**(제목·조건·사유·영향·질문·못 보는 것·고치는 법·명령 행 포함): **히트 0.**
- **이 문서의 변경·추가 카피와 권고 문구**(§8-2 표 53행 = 변경 13키 + C 추가 67키 + S 추가 9키, 약한 권고 제목 5개, 면책 권고문 1개): 히트는 면책 권고문 1건이며 기존 허용 키(`cc.disclaimer.body`) 범위다. **위반 0.**
- **남은 위험**: 룰 18장 문구(DB설계자, E)와 체험 데이터 문자열은 아직 없다. STEP 4의 `model/banned-words.test.ts` + 카탈로그 정적 검사 + 체험 A~D 렌더 텍스트 검사(QA)가 정식 판정이다.

### 10-2. 고위험 16곳 대응 (방향서 §7-3: 카피 기준으로 채택)

| # | 지점 | 최종 키·장치 | 확인 |
|---|---|---|---|
| 1 | 리포트 상단 요약 | `DistributionChips` + `cc.c.dist.sentence`("점검 N개 — 위험 a · …") | 렌더 |
| 2 | 전부 초록 | `cc.c.first.none` · `none-body` + 못 보는 것 + 졸업 경로, 축하 연출 0 | 체험 A(AWS) |
| 3 | 좁은 화면 배지 | `StatusBadge`에 글자 숨김 prop 없음, `nowrap` | G-D3 |
| 4 | 진행 메시지 | `cc.c.rlist.ok` "읽었습니다", `cc.app.live.building`, `cc.app.live.downloaded`(변경) | 금지어 |
| 5 | 버튼 | 동사 버튼(`cc.input.cta` "이 계정으로 리포트 보기", `cc.app.dlg.close-report.*`) | 리뷰 |
| 6 | 시작 화면·메타 | `cc.start.tagline` = `<meta name="description">`(X12), 한 줄 약속 그대로 | 템플릿 |
| 7 | 무전송 설명 | `cc.promise.no-send` + `cc.promise.caveat`(약속 바로 아래 항상) | G-D19 |
| 8 | 수집기 설명 | `cc.prep.what.body.*`(방향서 §7-2 그대로) | 금지어 |
| 9 | 해시 대조 | `cc.prep.hash.rule` "값이 게시된 곳이 모두 같으면 계속하세요. 하나라도 다르면 실행하지 마세요."('검증 통과'·'안전한 파일' 같은 표현 없음), 대조 칸 없음 | 리뷰 |
| 10 | 재점검 | `cc.c.cmp.change.*` "심각도 낮아짐/높아짐", `cc.compare.summary` "바뀐 점검 n개", 비율 0 | 체험·QA |
| 11 | 확인 불가 | `cc.reason.unknown.*` 21종(해소법이 붙은 할 일 톤) | 금지어·검수 |
| 12 | 예외·본인 응답 | `cc.label.exception-active`·`self-answer`(변경) | 렌더 |
| 13 | 인쇄본 제목 | `cc.c.print.header` "문단속 5 리포트 · 올린 파일 기준 참고 자료", 도장·서명란 0 | 인쇄 STEP 5 |
| 14 | 졸업 경로 | `cc.c.grad.line` "더 넓게 보려면: Prowler · Defender for Cloud · CIS 벤치마크" | — |
| 15 | 분수 표기 | `cc.c.scope.range.*` "리전: 확인 16개 · 활성 17개", 분수·퍼센트 0 | 금지어(`%`) |
| 16 | 오류 문구 말투 | `cc.recog.*` "…로 읽히지 않았습니다 / 이런 경우가 많습니다 / 다음 행동" | 검수 |

### 10-3. G7 표현 게이트 — 디자인 항목 (STEP 5에서 QA와 함께 닫는다)

- [ ] 금지어 0: 카탈로그 정적 검사(C·S·E) + 체험 A~D × AWS·Azure 렌더 텍스트(V3·V4·V6·V7·V8 포함).
- [ ] 면책·고지 고정 노출: V0(약속 + 고지), V2(무전송 약속 + 고지), V3(분포 아래 면책 + 인쇄 마지막 바닥), V8(약속 + 고지 + 면책 + `not-certification`).
- [ ] 제목×상태 표(§9) 완료: 잠정 5건 확정(X4) 후 ✕ 0 확인.
- [ ] 고위험 16곳(§10-2) STEP 4 결과물 대조.
- [ ] 상태 글자 생략 0, 도형만 있는 상태 표시 0(G-D2·G-D3).
- [ ] 축하 연출·카운트업·진입 애니메이션 0, 분수·퍼센트 0.
- [ ] 체험 표식 4중(띠·프레임·맥락 줄 '가짜 회사'·인쇄 큰 제목) + 탭 제목 "체험 리포트 · 문단속 5"(G-D20).
- [ ] 인쇄본에 도장·서명란·'확인자'·'판정' 칸 0, 마스킹 기본(G-D14).
- [ ] 룰 18장 문구(E) 디자인 검수: 템플릿(UX §9-1)·톤(UX §7-5)·사실 수치 회피(UX §9-4)·제목×상태.

---

## 11. 개발 핸드오프 체크리스트

### 11-1. 디렉터리 분리 (오케스트레이션 규칙 7 · 방향서 §3)

| 담당 | 쓰는 곳(여기만) | 이 문서에서 받을 것 |
|---|---|---|
| 컴포넌트개발자 | `_client/components/**`, `_client/styles/**`, `_client/i18n/ko/components.ts` | §4-2~4-6(CSS·아이콘 복사), §5 전부, §8-2 C 변경분, UX §7-2 |
| 페이지개발자 | `_client/main.tsx`, `_client/state/**`, `_client/screens/**`(+ `screens.css`), `_client/config.ts`, `_client/i18n/ko/screens.ts` | §3, §6 전부, §4-4 인쇄 JS 계약, §8-2 S 변경분, UX §3-5·§4·§5·§6·§7-3 |
| 프론트팀장 | `_client/i18n/index.ts`, `_client/mocks/**`, `_build/**`(템플릿·생성·가드), `_serve/**`, `_generated/**`, 두 라우트 | §5-0 i18n 인터페이스, §11-2 가드, X1·X11·X12, 정적 V0·`<noscript>`·BootFallback 템플릿(`.cc-boot.cc-banner.cc-banner--strong`, `cc.boot.*`), 목업 Report A~D(UX §11-3 요건) |
| DB설계자 | `src/lib/cloudcheck/rules/**`(특히 `i18n/ko.ts`), `fixtures/**` | §8-2 E 요구사항, §9 제목, D12·D13·D14, UX §7-4·§9 템플릿, UX §11-3 세트 요건, 체험 데이터 금지 토큰 0 |
| API설계자 | `parse/**`, `collector/**`, `contract/rg-queries.ts`(신규) | Q3(C-12 프롬프트), Q4(`--print`), Q17(`detail.hint`·`tail`), X10(issues 코드), X15(마스킹 사본 이름), X16(원문 구간 표식) |

- **같은 파일을 두 사람이 고치지 않는다.** 화면 전용 CSS는 `screens/screens.css`(페이지개발자), 컴포넌트 CSS는 컴포넌트 옆 파일(컴포넌트개발자). 공용 배럴 `index.ts`를 두지 않는다(방향서 §3 규칙 3).
- **UI는 목업 Report로 먼저 간다**(방향서 §3 규칙 2). 목업은 UX §11-3의 세트 요건(첫 화면 세 모드, 수집하지 않은 문, INV-7, 알림 다수, 해당 없음만 있는 문)을 모두 담아야 렌더 가드가 의미를 갖는다.
- **D1 우선순위**(컴포넌트개발자): tokens·base·print CSS → 관문 5종 + DownloadLink → T·Msg → StatusIcon·DistributionChips·StatusLegend → Fold → 나머지.

### 11-2. 가드 테스트로 확인할 디자인 규칙

AST·번들·CSS 검사는 프론트팀장 `_build/guards.test.ts`(방향서 §2-4 4층 강제에 추가), 렌더 검사는 각 개발자의 RTL 테스트(`// @vitest-environment jsdom`)에서 목업 Report A~D와 실제 엔진 출력(D4 이후) 둘 다로 돌린다.

| ID | 규칙 | 검사 방법 |
|---|---|---|
| G-D1 | `style` prop·SVG `style` 0 | AST(방향서) |
| G-D2 | `StatusIcon` import는 `StatusBadge`·`DistributionChips`·`StatusLegend`만 | AST import 그래프 |
| G-D3 | 상태 글자 생략 0: 모든 `.cc-si--{s}`의 가장 가까운 `.cc-sb`·`.cc-dc`·`.cc-legend` 안에 `t("cc.status."+s)` 글자가 있다 | 렌더(V0·V3·V4·V7, 체험 A~D) |
| G-D4 | 복사 버튼 0: 번들에 `navigator.clipboard`·`execCommand` 0(방향서) + 글자에 '복사'가 든 `<button>` 0 | 번들 + 렌더 |
| G-D5 | 외부 링크: 모든 `a[target=_blank]`가 `rel`에 noopener·noreferrer, `href`가 `https://<LINK_HOSTS>/…`, 링크 글자에 그 호스트가 보임. JSX `href` 속성은 `DocLink.tsx`·`DownloadLink.tsx`에만(→ `href="#…"`도 막힘) | 렌더 + AST |
| G-D6 | CSS `user-select:all`은 `.cc-cmd--kql .cc-cmd__pre`·`.cc-hash` 두 선택자뿐 | 번들 CSS 검사 |
| G-D7 | V3·V4·V5 렌더에 `<details>` 0 | 렌더 |
| G-D8 | 속성·`document.title`에 사용자 데이터 0: 리포트의 모든 `DisplayValue.full`(3자 이상)이 어떤 요소의 어떤 속성 값에도, `document.title`에도 없다 | 렌더(체험 A~D + 적대 픽스처) |
| G-D9 | V2~V5 `<main>`과 모든 `.cc-mv`, 명령·해시 블록에 `translate="no"` | 렌더 |
| G-D10 | PasteBox·예외 사유 입력의 7속성(`spellcheck=false` · `autocomplete=off` · `autocorrect=off` · `autocapitalize=off` · `data-gramm=false` · `data-gramm_editor=false` · `data-enable-grammarly=false`) | 렌더 |
| G-D11 | 이상 없음 행에 꼬리표 + '못 본 것 n' 칩, 해당 없음 행에 근거 줄 | 렌더(체험 A) |
| G-D12 | 문 구역 머리에 `StatusBadge` 0(`.cc-door__head .cc-sb` 없음) | 렌더 |
| G-D13 | 쓰기 명령 블록(`.cc-cmd--write`)은 V4에서만 | 렌더(V0~V3·V5~V8에서 0) |
| G-D14 | 인쇄 마스킹 기본: `printReport` 뒤 `<html>`에 `cc-print-unmask`·`cc-print-list-only` 없음(`window.print` 모의), `print.css`의 `@media print`에 `.cc-mask-short{display:inline}` 기본 규칙 | 단위 + CSS 스냅샷 |
| G-D15 | 클래스 이름은 전부 `cc-` 접두(문자열 리터럴 `className` 토큰) | AST |
| G-D16 | 16진 색은 `tokens.css`에만(`print.css`의 `#000`·`#fff` 예외) | CSS 검사 |
| G-D17 | `prefers-color-scheme`는 `tokens.css`에만, 그것도 `screen and`로만 | CSS 검사 |
| G-D18 | 금지어 0: 카탈로그 정적 + 체험 A~D 렌더 텍스트(`findBanned` 하나) | 방향서 G7 |
| G-D19 | 고지·면책 노출: V0·V2·V8에 `cc.promise.caveat`, V3·V8에 `cc.disclaimer.body`, V3 DOM에 인쇄 전용 바닥 면책 | 렌더 |
| G-D20 | 체험 표식: 체험 띠 + `.cc-demo-frame` + 맥락 줄 `cc.ctx.demo-company` + `.cc-print-demo` + 탭 제목 | 렌더 |
| G-D21 | 예외 라벨이 붙어도 그 대상의 `StatusBadge` 상태가 같다 | 렌더(오버레이 유무 비교) |
| G-D22 | 모든 장식 SVG에 `aria-hidden="true"`·`focusable="false"`, SVG에 `width`·`height`·`fill`·`stroke` 속성 0 | 렌더 + AST |
| G-D23 | 글자 없는 버튼 0(`textContent` 또는 `aria-labelledby` 대상 글자) | 렌더 |
| G-D24 | CSS 예산 보고: 압축 후 바이트를 출력(목표 30KiB, 실패 기준 없음) | 예산 테스트 |
| G-D25 | 상수와 카피 숫자 일치: `LIMITS`(25MB·20MB·32), `EXCEPTION_MAX_DAYS`(90), `MAX_FILES`(8)가 해당 문구에 그대로 | 단위 |
| G-D26 | CSS 위생: CR 0, `</style` 0(방향서) | 생성기 |
| G-D27 | `<html lang="ko">`, 메타 `color-scheme`·`theme-color`·`description` | 템플릿 스냅샷 |
| G-D28 | 화면 전환 후 포커스가 h1(복귀는 눌렀던 버튼), `history.pushState` 인자가 `{cc: ScreenId}`·`""` | 렌더 + AST(방향서) |

### 11-3. 역할별 체크

**컴포넌트개발자**
- [ ] §4-2·4-3·4-4 CSS를 그대로 복사(값 변경 금지), §4-5 기준안을 컴포넌트별로 분할, 자기 CSS 바이트를 보고
- [ ] 관문 5종 + DownloadLink를 §5-1 시그니처로. 관문 밖에서 `href`·사용자 데이터 렌더 0
- [ ] `T`·`Msg`가 `MsgParam.v`를 `MaskedValue`로 그리는지, `t()`가 `DisplayValue`를 받지 못하는지(타입)
- [ ] 상태 도형은 R2의 세 곳에서만, 확인 불가 톤 블록에는 도형·'확인 불가' 글자 0
- [ ] 점검 행 기본 접힘, 접힌 영역도 DOM에 렌더, 인쇄 펼침 클래스(`cc-po`) 지정
- [ ] 이상 없음 행의 꼬리표·'못 본 것 n', 해당 없음 근거 줄, 문 머리 배지 0
- [ ] 직접 볼 목록: 화면 체크 칸 0, 인쇄 빈 칸·메모 열

**페이지개발자**
- [ ] `ScreenId`·`history.ts`(pushState 1곳)·`print.ts`(§4-4)·`unload.ts`(실제 리포트만)·`drop.ts`(Q8)·`clock.ts`(시각 1곳)
- [ ] 화면 전환 4단계(포커스·제목·스크롤·낭독), 체험 낭독 접두
- [ ] V3 블록 순서 고정, 알림 순서표(§6-4), 먼저 볼 3개의 `[대상 n개 보기]` → 펼침 + 포커스
- [ ] 예외: `parseExceptions(serializeExceptions(next))` 왕복 검사 → `overlayExceptions` 재계산 → 오버레이로만 라벨
- [ ] 띠 선택 규칙(§3-1), Azure 펼침 버튼(T2), `file://` 처리
- [ ] 체험 동작 차이(UX §11-5): `beforeunload`·확인 대화상자·마스킹 사본·화면 가리기·V5 없음

**프론트팀장**
- [ ] `i18n/index.ts`: 세 파일 병합 + `keyOf` + `fmtTime`(UTC+9 산술) + 첫 세그먼트 린트
- [ ] 가드 G-D1~G-D28 중 AST·번들·CSS 항목을 `_build/guards.test.ts`에
- [ ] 템플릿: 정적 V0(같은 클래스·같은 글자), `<noscript>`, BootFallback, 메타 3종(X12), 페이지 해시를 HTML에 넣지 않음(Q1)
- [ ] import 허용 목록 갱신(X11), CSS 측정 기준 확정(X1), D4 CSS 실측 보고(X2)

**DB설계자 · API설계자** — §11-1 표의 항목. 룰 문구는 제목 → 템플릿 → 린트 → 디자인 검수 순서(방향서 §9).

### 11-4. 스코프 컷과 P1 (디자인 관점)

| 순서 | 항목 | 같이 지우는 UI | 남기는 것 |
|---|---|---|---|
| (만들지 않음) | 해시 대조 칸 | `cc.prep.hash.compare.*` | 해시 값 표시·외부 채널 안내 |
| 0 | 화면 가리기(D11, P1) | 토글, `cc.ctx.screen-mask`, `cc-screen-mask` | 인쇄용 이중 렌더(마스킹 기본) |
| 0.5 | 체험 안내 패널(P1) | `cc.demo.guide.*` | 카드의 '가르치는 것' 한 줄 |
| 1 이후 | 방향서 §9 순서(Before/After → 쌍둥이 비교 → 예외 파일 내보내기·불러오기 → AZ-LOG-2 → AWS-KEY-3 안내 카드 → Azure 전체) | UX §13-3 표 그대로 | 끝까지 지킬 것: 5상태, 조회 범위 패널, 고치는 법 3단계, 금지어 린트, 인쇄 마스킹 기본, 상태 글자 생략 0 |

---

## 12. STEP 5 이월 [미확인]

| # | 항목 | 확인 방법 |
|---|---|---|
| 1 | 상태 도형 16px 글리프 가독성, 6px 빗금 띠 가시성, 흑백 출력·색각 이상 에뮬레이션(Chrome Rendering) | 3개 브라우저 |
| 2 | 해시 묶음(`<span>`+`<wbr>`) 복사 결과가 공백·개행 없는 64자인지 | Chrome·Safari·Firefox |
| 3 | 인쇄: OS 다크 모드에서도 라이트로 인쇄되는지(`screen and` 분리), `cc-po` CSS 강제 펼침, 이상 없음 대상 생략 줄, 마스킹 기본, `print-color-adjust`(배지·칩), SVG 인쇄 | 3개 브라우저, Ctrl+P와 버튼 둘 다 |
| 4 | `window.print()`가 막는지(블로킹) — 막지 않는 브라우저(iOS Safari 의심)에서는 목록만·이름 표시 옵션이 적용되지 않고 전체 + 마스킹으로 인쇄됨(안전한 실패) | iOS·Android |
| 5 | V1·V7·V8 `<summary>` flex의 Safari 동작(펼침·키보드·마커 숨김) | Safari |
| 6 | 시스템 폰트(Windows·macOS·Android·iOS)의 줄바꿈·행간·`keep-all` | 4개 OS |
| 7 | CSS 실제 합계(화면 CSS 포함)와 Tailwind 규칙 수 +0(G5) | D4·G5 |
| 8 | Blob 내려받기 바이트 = 수집기 원문 = `SHA256SUMS`, `file://`에서 오프라인판 버튼 숨김 | G5 이월 |
| 9 | `file://`의 meta CSP와 `pushState` 실패 시 이력 없는 모드 | 오프라인판 |
| 10 | React 18 + Trusted Types 전 화면(V0~V8, 체험 A~D, 드롭, 붙여넣기, 인쇄, 내려받기) | Chrome |
| 11 | `paste` 이벤트와 `clipboard-read=()` 공존, KQL·해시 키보드 포커스 전체 선택(Selection API) | Safari·Firefox |
| 12 | `<dialog>` 지원·포커스 복귀, 미지원 시 인라인 패널 | 3개 브라우저 |
| 13 | `beforeunload`와 뒤로 가기 캐시(bfcache) | Chrome·Safari |
| 14 | 스크린리더: 점검 행 버튼 이름("위험 콘솔 사용자 MFA, 접힘"), `aria-labelledby` 이름, 마스킹 ID 숨김 글자, 자리표시자 낭독(`<사용자이름>`), 띠 보조 줄(`max-height:0`)이 읽히는지 | NVDA·VoiceOver |
| 15 | 360px 첫 화면(R-03) 실측, 높이 600px 이하 스티키 규칙, 200%·400% 확대 재배치 | 기기·확대 |
| 16 | 파비콘 data: SVG 탭 표시 | 3개 브라우저 |
| 17 | 알림 최대 밀도(약 10종)에서 첫 화면 | 체험 D + 적대 픽스처 |
| 18 | 이해도 사전 점검(체험 D, 내부 2~3명) — UX §11-4 질문 4개 | QA |
| 19 | `--print` 출력을 CloudShell에서 복사할 수 있는 길이(스크롤백), C-12 Enter 삭제 동작 | PM V1(G8) |
| 20 | 부팅 대체 안내 3초 지연의 체감(느린 기기에서 정상 부팅 중 보이지 않는지) | 저사양 기기 |

---

## 부록. 근거

- 입력 문서: `docs/planning/project-direction-cloudcheck.md`(§1~§3, §5, §6-1, §7, §8, §9, §11), `docs/design/cloudcheck-ux-spec.md`(§0~§13, 부록 A), `docs/design/cloudcheck-ui-spec.md`(§0~§9), `docs/design/cloudcheck-lead-review.md`(§1~§7), `docs/planning/cloudcheck-plan.md`(§5-5 신원 표기, 결정 #17 '붙이기 전 검사 칸' 보류, C-09·C-12), `docs/backend/cloudcheck-lead-review.md`(§2-1 수집기 구조 ⑨ C-12 Enter 삭제, §2-6 `--print`), `docs/frontend/cloudcheck-lead-review.md`(§3-5 번들 금지 토큰, §3-6 크기 예산), `docs/design/flight-design-final.md`(최종안 형식 관례).
- 실행 검증(세션 스크래치패드, 레포 무변경): 방향서 §7-3 `findBanned()` 원문 실행(UX 카피 덱 762행 + 예시 89행 + 이 문서 변경분) / 레포 `node_modules/esbuild` 0.21.5 `transform` 압축 측정(UI 스펙 원문 CSS 21,513B, 이 문서 CSS 30,372B, gzip 6,889B, 경고 0).
