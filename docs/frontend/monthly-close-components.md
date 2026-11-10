# 월마감 컴포넌트 props 계약 (컴포넌트개발자 → 페이지개발자)

- 소유: `src/app/monthly-close/_components/**`, `monthly-close.css`, `src/lib/monthly-close/sheet/**`
- 규칙: 컴포넌트는 props만 받고 데이터를 부르지 않는다. 기능 버튼은 모두 `data-mc-cmd`. 문구는 전부 props(문구 팩에서 온다). 배럴 index.ts 없음 — 파일에서 직접 import.
- 연결: `layout.tsx`에서 `import './monthly-close.css'` + `<McRoot>`(`_components/sheet/McRoot`)로 감싼다. 시트 셸(`SheetShell`)은 `position: fixed; inset: 0`이라 홈은 셸 없이 일반 문서 스크롤.
- 상태 표현은 outline/background/border만. box-shadow 금지(전역 주황 포커스 링이 지운다). 움직임·손 모양 커서 0.

## 1. 순수 로직 `src/lib/monthly-close/sheet/`

| 모듈 | 내보내기 | 설명 |
|---|---|---|
| `sheet-model.ts` | `initSheetState(dims, sel)`, `sheetReducer(state, action, ctx?)`, `keyToAction(state, keyInfo)`, `ptToAddr/addrToPt`, `selectionRange/rangeLabel/rangeEdges`, `placeMemo(cellBox, pane)` | 선택·이동·편집 리듀서(게임판·숨기기 시트 공용). `ctx.canEdit/textAt`로 보호 셀. Enter=확정 후 아래, Tab=오른쪽, Esc=편집 취소(편집 중이 아니면 `null` — 숨기기는 이 밖에서), 글자=편집 시작(대체), F2=유지 편집. `lastCommit.seq`로 변화 감지. |
| `disguise.ts` | `buildDisguise(spec,{seed,asOf})`, `evaluate(model)`, `setInput(model,addr,n)`, `isEditableAddr`, `formulaBarText`, `chartData`, `hashSeed(...parts)`, `parseNumberInput` | seed→30행×10열. 소계·합계·증감·비율 실제 계산(정수/천분율). `spec`은 문구 팩 `disguise` 필드를 그대로 받는다(구조적 타입). |
| `disguise-fixtures.ts` | `DISGUISE_FIXTURES.{accounting,sales,hr}` | 문구 팩 JSON 전에 쓰는 대역 스펙. 서비스 화면 문구의 출처가 아니다. |

## 2. 셸 `_components/sheet/`

| 컴포넌트 | 핵심 props |
|---|---|
| `McRoot` | `.mc-root` 래퍼 (layout 최상위) |
| `SheetShell` (= `SheetFrame`) | `view: 'game'\|'disguise'`, `mobile?`, `chrome`(TopBar~FormulaBar 노드), `game`, `disguise`, `footer`(SheetTabs+StatusBar). 두 레이어 모두 미리 마운트, `data-view`만 바뀜. **메모·토스트·대화상자·검산은 `game` 안에 둘 것**(숨기면 자동으로 사라지게). |
| `TopBar` | `fileName, versionLabel?, coEditLabel?, editors[{initial,offline?}], shareLabel, shareDisabled?` — `[공유]`=`data-mc-cmd="share"` |
| `MenuBar` | `labels?`(8개), `open: 'file'\|'help'\|null`, `onToggle`, `fileItems/helpItems: {id,label,aside?,disabled?}[]`, `onItem(menu,id)` — cmd: `menu-file`, `menu-help`, `file:<id>`, `help:<id>` |
| `ToolBar` | `hintLabel, hintCount, hintOff?, hintActive?, onHint, tauntLabel, tauntOff?, tauntOpen?, onTaunt, hintMenu?, tauntMenu?` — cmd: `hint`, `taunt`. 비활성 모양(`data-off`)은 게임 레이어에서만 흐림 |
| `FormulaBar` | `nameValue, onNameValueChange, onNameSubmit(text)`(Enter, 한글 조합 중 제외), `nameDisplayOnly?`(모바일), `formula, onFormulaChange?`(없으면 읽기 전용), `armed`(✕✓ 활성), `hideButtons?`(모바일), `onCancel, onConfirm` — cmd: `cancel`, `confirm` |
| `SplitPanes` / `Pane` / `PaneHead` | `Pane{ id, head, headRight?, overlay?, children }` — 창 머리 띠 문구(디자인 §4-2)는 props. 모바일은 `left`만 넘긴다 |
| `SheetGrid` | 머리글+칸 슬롯. `colWidths(null=기본, 0=숨김)`, `rowCount`, `rowHeight?`, `selected?/range?`, `readOnly?`, `pick?{cols,rows}`+`onPickCol/Row`, `frozen?`, `merges?`, `renderCell(c,r,ctx)→<Cell w={ctx.w}>`, `activeId?`, `onKeyDown?`, `overlay?`, `gridlines?` |
| `Cell` | `addr, state('empty'\|'mine'\|'miss'\|'hit'\|'sunk'\|'reveal'), label?, strike?, selected?, selectionTone('active'\|'readonly'\|'locked'), hoverable?, range?{t,b,l,r,bad?}, memo?('miss'\|'hit'\|'sunk'\|'note'), w?, align?, tone?, ariaLabel?` + div 속성. aria-label 기본 `B7, 해당 없음`. |
| `CellMemo` | `kind, head, body, x, y, flip?` — 위치는 `placeMemo()`로. title 속성 없음, 포인터 안 가로챔 |
| `SheetTabs` | `tabs[{id,label,kind:'game'\|'result'\|'disguise'\|'deco',fresh?}]`(**게임 탭 첫 번째, 결과 탭 바로 오른쪽**), `activeId`, `onTab(id,kind)`, `onAdd?` |
| `StatusBar` | `message`(≤28자, 색 불변), `right`(`회차 N · 100%` / `100%`) — `role=status` |
| `CellStateSampler` | 셀 상태 정지 판(12개 견본). `/practice` 눈테스트용 |

### 조립 예 (방, 게임 레이어)
```tsx
<SheetShell view={view} mobile={isMobile}
  chrome={<><TopBar .../><MenuBar .../><ToolBar .../><FormulaBar .../></>}
  game={<SplitPanes left={<Pane id="mine" head="내 시트 · 공동 편집 중" overlay={memos}><BoardPane label="내 시트" idPrefix="m" .../></Pane>}
                    right={<Pane id="theirs" head="상대 시트 · 편집 가능" overlay={<>{alarm}{toast}</>}><BoardPane .../></Pane>} />}
  disguise={<DisguiseSheet controller={ds} .../>}
  footer={<><SheetTabs .../><StatusBar .../></>} />
```

## 3. 숨기기 시트 `_components/disguise/`

- `useDisguiseSheet(spec, {seed, asOf})` → `DisguiseController`: `{ model, sheet, state, dispatch, cell, formulaBar, onGridKeyDown, onEditKeyDown }`. **`<FormulaBar {...ds.formulaBar} />`** 로 이름 상자·수식 입력줄이 선택/편집과 연동된다. 숨기는 순간 게임 값 비우기는 게임 쪽 몫(이 훅은 게임 값을 모른다). 이 훅의 Tab = 다음 칸, Esc = 편집 취소, Enter = 확정 후 아래.
- `DisguiseSheet{ controller, label, filterLeft, filterRight, mobile?, idPrefix? }` — 필터 줄 문구는 문구 팩(`보기: 기본 │ 필터: 없음 │ 정렬: 없음`, `마지막 저장 HH:MM`). 틀 고정·조건부 서식·편집·재계산·차트 포함. `mobile`이면 업종별 4열만(나머지 폭 0), 편집·차트 없음.
- `DecoSheet{ label, title, headers[3], rows[{date,memo,owner}](6줄+), filterLeft, filterRight, onSelect?(addr,text) }` — 선택·이동만(편집 없음).
- `BarChart{ data: chartData(sheet), left, top }` — DisguiseSheet 내부용.

## 4. 판 `_components/board/` + `overlays/`

- `BoardPane{ label, idPrefix, cells: {B7:{state,label?,strike?,memo?}}, selected?, selectionTone?, fireable?, readOnly?, range?, rangeBad?, pick?, pickedCols?, pickedRows?, onPickCol/Row, extras?, onCellMouseDown/Click/DoubleClick/Enter(addr), onKeyDown?, overlay? }`. 9열(A~I)×20행, 판 A1:H8 + 바깥 표.
- 판 바깥 표는 `extras: Record<"A10", ExtraCell>` — 만드는 함수(전부 순수, `board/extras.ts`의 `merge`로 합침):
  - `itemsExtras({heads,items})` 10~13행 항목 표 / `placementExtras({...})` 10~16행 배치 표(15행 버튼 `auto-place`·`place-done`) / `reviewExtras(heads, rows)` 15~17행 검토 의견 / `hintResultExtras({cols:{E:2}, rows:{3:1}})` 9행·I열 / `changeLogExtras(heads, rows)` (overlays/ChangeLog) 15~17행 변경 내역 / `quizExtras({...})` (overlays/QuizSheet) 10~13행 검산 표(오른쪽 창에서 항목 표와 교체; 오답 `wrong`=입력칸 `#VALUE!` 잠금).
  - 15행 이후 `changeLogExtras`(왼쪽)와 `reviewExtras`(오른쪽)는 **서로 다른 창**에 넣을 것.
- 검산 입력: Enter만 `onSubmit`. Tab·한글 조합 중 Enter는 가로채지 않는다(Tab=숨기기는 페이지 키 훅).
- `AlarmToast{text, chip?('Tab'|'전환'), onActivate}`(`data-mc-cmd="alarm"`, role=alert, 판 위 가운데 고정) / `Toast{text, action?{label,cmd,onClick}}` / `Popover` / `Dropdown{items,activeIndex?,onPick,cmdPrefix,label}` / `ConfirmPopover{title,body?,confirmLabel,cancelLabel,danger?,onConfirm,onCancel}` / `InlineDialog{title,children,actions?}`(포털 없음, `.mc-layer--game` 안에 둘 것).
- `TauntPicker{items(aside=쿨다운 보조 글자,disabled),activeIndex?,onPick(id),label}` → cmd `taunt:<id>`. `HintPicker{labels,active,onChoose,label}`(선택) + `hintPreview(target)` → `{name:'E1:E8', formula:'=COUNTIF(E1:E8,">0")'}` (고르기 중 이름 상자·수식줄에 넣을 미리보기). 힌트 고르기는 `BoardPane.pick` + `onPickCol/Row` + 칸 `onCellClick`.
- 공유 패널(`SharePanel`)은 별도 컴포넌트 없이 `Popover` + `Button`/`Checkbox`로 조립(문서 번호 22px는 `style`). 필요하면 알려 달라.

## 5. 결과 `_components/result/`

- `ResultSheet{label, filterLeft, filterRight, doc, actions}` — 눈금선 끈 시트에 문서 얹기(셀 없음, 머리글 유지).
- `ResultDoc{kind('reprimand'|'award'|'joint'), title(띄어쓰기 금지), rows[{label,value,tall?,sign?}], approval?{labels[3],stamps[3]}|null, alarmFailLine?, footnote}` — 시말서 도장은 `['', '', '확인']`(맨 오른쪽 1개), 품의서 3개, 경위서 `approval=null`. 5자 이상 제목은 자간 0.2em 자동.
- `DocActionBar{saveLabel, saveDisabled?, onSave, saveAside?, copyLabel, onCopy, newLabel, onNew, laugh: LaughPollProps, nameToggle?, reportLabel, onReport, reportSlot?}` — cmd: `save-v8`, `copy-text`, `new-doc`, `laugh:none|some|lol`, `name-toggle`, `report`.
- `LaughPoll{question, options[3], value, onChange, disabled?}` / `ReportPopover{title, options[3], sendLabel, cancelLabel, onSend(target), onCancel}`(`reportSlot`에 넣으면 위로 열림).

## 6. 모바일 `_components/mobile/`

`MobileTopBar{fileName, shareLabel, moreLabel, onMore}` / `MobileSheetTabs{...SheetTabs props, keyboardOffset?}`(키보드 높이만큼 띄워 키보드 바로 위에 붙임 — `visualViewport`로 계산해서 넘길 것; **탭 한 번 = blur+숨기기**는 `onTab`에서) / `MemoLine{text, time?}` / `ConfirmRow{label, onConfirm, disabled?}`. 모바일은 `SheetShell mobile` + 창 1개 + 상태줄 없음 + `FormulaBar nameDisplayOnly hideButtons`.

## 7. `form/controls.tsx`

`Button{variant:'primary'|'secondary'|'text'|'danger', size?, quiet?, cmd?}`, `TextInput{size?, error?}`, `RadioRow{label, options, value, onChange}`, `Checkbox{checked,onChange,cmd?}`, `SegmentedChoice{label,options,value,onChange,cmdPrefix?}`.

## 8. `data-mc-cmd` 목록 (명령 이동 모드 순회 대상, DOM 순서가 곧 순서)

`menu-file`, `file:*`, `menu-help`, `help:*`, `hint`, `taunt`, `share`, `cancel`, `confirm`, `auto-place`, `place-done`, `alarm`, `taunt:<id>`, `hint-kind:*`, `save-v8`, `copy-text`, `new-doc`, `laugh:*`, `name-toggle`, `report`, `report-cancel`, `report-send`, `confirm-ok`, `confirm-cancel`, `open-result`(Toast 액션 예), `more`(모바일). 명령 이동 순서 A6(파일→도움말→Σ→의견→공유→…)과 DOM 순서가 다르면 `useCommandMode`에서 정렬하거나 알려 달라.

## 9. 테스트

`npx vitest run src/lib/monthly-close/sheet src/app/monthly-close/_components` — sheet-model 리듀서, disguise 합계(8 seed × 3업종), Cell 상태, 셸/탭/크롬, DisguiseSheet(편집·재계산·Tab·ESC·이름 상자·모바일), BoardPane·표·검산, 오버레이·폼, 결과·모바일, CSS 규칙(녹색 없음·움직임 없음·pointer 없음·scrollbar-color 없음·box-shadow 위치).
