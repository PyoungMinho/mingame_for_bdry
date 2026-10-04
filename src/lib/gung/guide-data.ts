/**
 * 개선 묶음 1 안내 문구(공개 텍스트) — 출처: docs/planning/gung-improve-spec.md(기획 최종안, 2026-10-02) 각 항목의 「문구」.
 *
 * 규칙(스펙 '공통 규칙'): 새 안내 문구(큐·프롬프트·변론 틀·수첩 범례·규칙 상자)에는 **사건 고유어를 넣지 않는다.**
 * 금칙어(GUIDE_BANNED_WORDS)는 GUIDE_COPY 전체에서 0개여야 한다(guide-data.test.ts). 지도 라벨·장소 이름·카드 본문·
 * 보너스 문항 원문은 이 검사에서 뺀다(그것들은 case-data.ts·case-extras.ts 의 원고 원문이다).
 *
 * 이 파일은 사건 정보를 새로 만들지 않는다 — 진행·규칙·형식 문구뿐이다. 문구를 고치면 스펙 문서도 같이 고칠 것.
 * import 가 없는 순수 상수 모듈이다 — 프레젠테이션 컴포넌트(src/app/gung/components)도 엔진 의존 없이 쓸 수 있다.
 */
/** 새 안내 문구에 들어가면 안 되는 사건 고유어(스펙 공통 규칙) */
export const GUIDE_BANNED_WORDS = ['꿀', '석청', '탕약', '매듭', '부자', '생부자', '노린', '독이 든', '서온돌', '동온돌', '연못', '장부', '노리개', '회임', '해시', '자시'] as const;

export const GUIDE = {
  // ── G2 낭독 먼저 · 방장 조사는 단서함에서 ──
  // 6판: 낭독은 현장 보기 1분이 맡고, 고르기 타이머는 현장 → 고르기 전진 때 저절로 돈다. 분 숫자는 DEFAULT_TIMERS 와 같아야 한다(테스트).
  selectCue: '각자 한 곳만 고르시오. 같은 곳은 같은 단서요',
  /** 단계 맞추기·방장 복구로 고르기에 들어와 타이머가 없을 때만(보통은 현장 → 고르기 전진 때 저절로 돈다) */
  selectTimerStart: '⏱ 고르기 1분 시작',
  publicAlsoInPhones: '이 단서는 각자 폰 단서함에도 있소',

  // ── 6판 현장 보기(조사 첫 1분, 다 같이 보는 그림) ──
  // 통합(프론트팀장): 그림이 무대 맨 위(큐 한 줄), 공용 단서는 그 아래 「소리 내어 읽으시오」 머리가 맡는다
  sceneCue: '그림 속 물건을 눌러 다 같이 보시오',
  sceneNewHead: '이번 조사 새 관찰 — 소리 내어 읽으시오',
  sceneTimerDone: '다 봤으면 넘어가시오',
  sceneLabel: '현장 보기',
  /** 장소 이름을 누르면 펼치는 궁 배치도(장소를 누르면 그 현장으로) */
  sceneMapToggle: '배치도로 장소 고르기',
  sceneMapHint: '장소를 누르면 그 현장으로 가오',
  /** 플레이어 장소 고르기 위 — 현장 단계엔 방장 화면을 함께 본다 */
  scenePlayerHint: '현장 그림은 방장 화면에서 다 같이 보시오',
  sceneOpenLink: '📜 내 폰으로 현장 보기 ›',
  sceneAgainLink: '📜 현장 다시 보기 ›',
  /** 큰 화면(노트북·TV) — /gung/scene */
  bigScreenMenu: '노트북·TV로 현장 보기',
  bigScreenBody: '노트북·TV 브라우저에 이 주소를 열면 현장 그림만 크게 뜨오',
  bigScreenNote: '비밀은 없소. 조사 번호는 그 화면에서 고르시오',
  bigScreenMirror: '폰 화면을 TV에 비추는 중이면 필요 없소',
  bigScreenCopy: '주소 복사',
  bigScreenSend: '카톡으로 보내기',
  bigScreenCopied: '큰 화면 주소를 복사했소',
  bigScreenHomeLink: '노트북·TV 현장 화면 ›',
  hostOwnClueLink: '🔒 내 조사는 단서함에서 ›',

  // ── G3 자기소개 — 6판 압축: 이름·직함 한 줄만(공개 프로필 전문은 「?」 › 인물) ──
  introCue: '1번부터 차례로 이름과 직함만 밝히시오',
  introPlayer: '내 차례에 꾹 눌러 이름·직함만 밝히시오',
  introProfileLink: '공개 프로필은 「?」 › 인물에 있소',
  /** 말투 예시는 게임이 끝난 뒤 '모두의 패'에서만(UX 스펙 §2-2 다 · 내 패 칩 6개) */
  speechSection: '말투',

  // ── G4 정체 칸 ──
  innocentStamp: '결백',

  // ── G5 진상 2단 공개 ──
  truthWaitTitle: '그날 밤의 진상',
  truthWaitBody: '방장이 낭독하는 중이오. 방장 화면을 보시오.',
  truthWaitButton: '범인이 밝혀졌어요 →',
  truthConfirmTitle: '범인을 보겠소?',
  truthConfirmBody: '방장이 범인을 밝힌 뒤에만 누르시오. 넘어가면 범인과 모두의 비밀이 보이오.',
  truthConfirmOk: '보겠소',

  // ── R1 규칙 상자 — 6판: 원고 1-7 공통 규칙(4줄 + ※) 원문. 브리핑 '하나~넷'(원고 7-1)은 이것을 줄여 낭독한다 ──
  lieRulesTitle: '거짓말 규칙',
  rulesTitle: '규칙',
  lieRules: [
    '범인은 이 판의 플레이어 가운데 독을 넣은 단 한 사람. 독살인 줄 모르고 거든 자는 범인이 아니다.',
    '범인만 무엇이든 거짓말한다. 나머지는 패의 「둘러대도 되는 것」만 둘러대되 남에게 죄를 씌울 순 없고, 그 밖엔 입을 다물 뿐 지어내지 못하며, 「물으면 사실대로」는 물으면 답해야 한다.',
    '조사는 세 번. 매번 공용 단서와 현장 그림을 함께 본 뒤, 각자 장소 한 곳을 골라 그 장소 카드를 얻는다(겹쳐도 된다). 간 곳은 밝히되, 카드는 공개하든 숨기든 자유다.',
    '누구나 숨길 비밀이 있다. 거짓말이 들통났다고 곧 범인은 아니다. 범인은 물증으로 가려라.',
    '※ 패에 「R2부터」「R3부터」가 붙은 일은 그 조사 전엔 입을 다물어도 된다(부인·지어내기는 금지). 판에 따라 라운드 시작 때 추가 증언 카드가 함께 열릴 수 있다. 카드·관찰·증언은 본 대로 들은 대로다.',
  ],
  // 봉인 패 '거짓말' 칸 맨 위엔 한 줄 요약만(긴 패가 한 화면을 넘지 않게 — QA F-1). 전문은 메뉴 › 하는 법.
  lieRulesShort: '범인 아닌 자는 「둘러대도 되는 것」만 둘러대고, 「물으면 사실대로」는 답하시오. 전문은 메뉴 › 하는 법.',
  discussAskLine: '「물으면 사실대로」는 물어야 나오오. 콕 집어 물으시오.',
  cardsMustSee: '꼭 볼 3칸: 정체 · 비밀 · 거짓말',

  // ── R2 궁 배치도 · 인물 ──
  helpSheetTitle: '궁 배치도 · 시각표 · 인물 · 용어',
  helpLabel: '궁 배치도·시각표·인물·용어',
  mapSection: '궁 배치도',
  peopleSection: '인물',
  termsSection: '용어',
  peopleLocked: '역할은 자기소개 뒤에 보이오',
  peopleAbsentHead: '이 자리에 없으나 증언을 남긴 이',
  aliasHead: '부르는 말',
  mapLink: '🗺 궁 배치도 보기',
  /** 방장 개요 화면 — 시각표·배치도는 「?」 시트로(개요 아래 상시 노출 제거, UX 스펙 §2-2 가-10) */
  helpLink: '배치도 · 시각표 ›',
  mapTapHint: '지도를 누르면 크게 보이오',
  /** QA(개선 묶음 1): 큰 지도 시트 — 1.4배라 좌우로 밀어 본다 */
  mapPanHint: '◀ 좌우로 밀어 보시오 ▶',

  // ── R3 공용 단서 상시 열람 ──
  publicAll: '공용 단서 전체 ▸',
  publicThisRound: '📢 이번 조사 공용 단서 ▸',
  timeHintHead: '시각 어림',
  timeHintTail: ['정은 초에서 1시간 뒤', '말은 1시간 반 넘어'],

  // ── R4 개인 추리 수첩 ──
  notesTab: '수첩',
  notesShortcut: '📓 수첩',
  notesHead: '내 추리 수첩 — 이 폰에만 적히오. 앱은 아무것도 대신 채우지 않소',
  notesLegend: '○ 그럴 수 있었소 · ✕ 아니라는 물증이 있소 · 빈칸은 모름',
  notesCols: { means: '수단', opp: '기회', motive: '동기' },
  notesColHelp: {
    means: '수단 — 독을 손에 넣을 수 있었나',
    opp: '기회 — 그때 그곳에 손을 댈 수 있었나',
    motive: '동기 — 그럴 까닭이 있었나',
  },
  notesLinePlaceholder: '한 줄 메모',
  notesFreePlaceholder: '자유 메모',
  notesClear: '수첩 비우기',
  notesClearTitle: '수첩을 다 지우겠소?',
  notesClearBody: '이 폰에 적은 표시와 메모가 모두 지워지오.',
  notesClearOk: '지우겠소',
  notesIdle: '1분 동안 손대지 않으면 진행 화면으로 돌아가오',

  // ── R5 공개 단서 인장 보드 ──
  clueMicro: '공개했으면 인장을 방장에게 불러 주시오',
  boardEmpty: '아직 올린 단서가 없소. 인장을 불러 달라 하시오',
  boardAdd: '＋ 인장으로 올리기',
  keypadTitle: '인장 번호를 넣으시오',
  sealReject: '그런 인장은 없소',
  sealLocked: '10초 뒤에 다시 넣으시오',
  sealDuplicate: '이미 올린 단서요',
  /** 6판: 4자리를 다 넣으면 바로 보드에 오른다 — '누가'는 올린 뒤 고른다(안 골라도 된다) */
  sealPosted: '보드에 올렸소',
  sealWho: '누가 밝혔소? (안 눌러도 되오)',
  sealNext: '다른 인장 넣기',
  sealClose: '다 올렸소',
  unpost: '내리기',
  /** 6판: 내리기 확인 시트 대신 5초 되돌리기 토스트 */
  unpostToast: '보드에서 내렸소',
  boardFooter: '보드엔 스스로 밝힌 단서만 오르오',
  /** 장소 고르기 안내 한 줄(UX 스펙 §2-2 다) */
  placeHint: '한 곳만 고르시오 · 같은 곳은 같은 단서요',

  // ── R6 최종 변론 3칸 틀 ──
  defenseCue: '한 사람씩 45초. 아래 셋만 말하시오',
  defenseFrame: ['범인이라 보는 자', '그 물증 하나 — 카드든 증언이든(수단·기회·동기 중)', '내가 아닌 까닭 한 줄'],

  // ── R7 보너스 문항 정식 단계 ──
  bonusHostHead: '보너스 — 맞히면 +1(범인 답은 빼오)',
  bonusHostGuide: '문항을 읽고, 셋에 손가락 1~4로 답하게 하시오',
  /** 6판: 보너스 0개 확인 시트 대신 버튼 위 인라인 경고 */
  bonusZeroInline: '보너스 없이 가면 점수 없이 셈하오',
  bonusPlayerHead: '보너스 문항 — 손가락으로 답하시오',
  /** 플레이어: 보너스를 열면 지목이 잠긴다(확인 시트 대신 인라인 한 줄) */
  bonusOpenNote: '보너스를 열면 지목은 잠기오',
  /** 원고 8-1 투표 화면 문구 + 작은 글씨(규칙 1) */
  votePrompt: '독을 넣은 자는 누구인가?',
  voteNote: '독살인 줄 모르고 거든 자는 범인이 아니다',

  // ── M1 문구 정정 ──
  sameCaseNewRoom: '같은 사건으로 새 방 ›',
  sameCaseTitle: '새 방을 열겠소?',
  sameCaseBody: '범인은 늘 같소. 처음 하는 이들끼리 하시오. 지금 기록은 지워지오.',
  sameCaseOk: '새 방 열기',
  homeMinutes: '약 35분',

  // ── M2 모두의 패 ──
  expandAll: '모두 펼치기',
  collapseAll: '모두 접기',

  // ── 6판 진행 압축(docs/design/gung-compact-scene-spec.md §2) ──
  /** 배너(≤ 40자) */
  storageBanner: '이 브라우저는 저장이 안 돼요. 새로고침하면 처음부터예요',
  wakeBanner: '🌙 화면이 꺼지면 종이 안 울려요. 설정 › 자동 잠금을 늘리시오',
  versionBanner: '사건 내용이 갱신됐어요. 새 방을 권해요.',
  /** H1 롤콜 — 자리별 외치기 대신 표식 한 번에(자리 칩은 선택) */
  lobbyCue: '표식이 같소? 한꺼번에 외치시오',
  /** P1 대기 */
  lobbyPlayer: '방장 화면의 표식과 같은지 보시오',
  lobbyPlayerMicro: '자리가 틀렸으면 ⋮ › 자리 바꾸기',
  /** 진행표(FlowStrip) — 분 합계는 flowPlan(타이머 상수)에서 */
  flowTitle: '오늘의 순서',
  flowRoundsNote: '조사 1번 = 현장 1 + 고르기 1 + 토론 5분',
  /** 방장 ⋮ 메뉴 — 패 확인 화면의 건너뛰기 링크를 옮김 */
  skipIntroMenu: '자기소개 건너뛰기',
  /** 조사 라운드 하위 단계 표시(현장 → 고르기 → 토론) */
  roundStepsLabel: '이번 조사 순서',
  /** P2 개요 — 규칙 카드 + 낭독문 접힘 */
  briefingPlayerLine: '방장이 읽소. 규칙만 보시오',
  briefingRulesHead: '규칙 넷',
  briefingFold: '낭독문 전체 ▸',
  /** P9 진상 — 결론 + 전문 접힘 */
  truthConclusion: '결론',
  truthFullFold: '진상 전문 ▸',
  /** H10 결과 — 미리보기 상시 노출 대신 이미지 저장 시트에서 */
  resultNoSpoiler: '결과 카드엔 범인 이름이 없소',
} as const;

/**
 * 숫자 뒤 목적격 조사 — 읽는 소리의 끝 받침으로 고른다(1234 = 천이백삼십사 → 를, 9680 = 구천육백팔십 → 을).
 * 끝자리 0(십·백·천)·1(일)·3(삼)·6(육)·7(칠)·8(팔) = 받침 있음 → 을 / 2(이)·4(사)·5(오)·9(구) → 를.
 */
export function objectParticle(n: number): '을' | '를' {
  const last = Math.abs(Math.trunc(n)) % 10;
  return [0, 1, 3, 6, 7, 8].includes(last) ? '을' : '를';
}

// ── 자리표시자가 있는 문구(스펙 원문 그대로 — 조사만 숫자에 맞춘다) ──
export const guideText = {
  /** R3 방장 H5·H6 */
  publicPast: (lastRound: number) => `지난 공용 단서 (조사 1~${lastRound}) ▸`,
  /** R5 공개 카드 인장 */
  sealLine: (seal: number) => `인장 ${seal} — 방장에게 불러 주면 공용 보드에 그대로 올라가오`,
  /** R5 공개 토스트(기존 '공개로 표시했소' 교체) */
  sealToast: (seal: number | null) =>
    seal === null ? '공개했소 — 소리 내어 읽으시오' : `공개했소 — 인장 ${seal}${objectParticle(seal)} 방장에게 불러 주고, 소리 내어 읽으시오`,
  boardTitle: (k: number) => `공개 단서 보드 (${k}장)`,
  boardSeat: (seat: number) => `${seat}번 공개`,
  /** R5 내 지난 방문 꼬리표 */
  visitedTag: (round: number) => `조사 ${round}에 감`,
  /** 진행표 합계 */
  flowTotal: (minutes: number) => `약 ${minutes}분`,
  /** 6판 현장 화면 접힘 1곳(지난 공용 단서 + 시각 어림) */
  pastAndTime: (round: number) => (round > 1 ? '지난 공용 단서 · 시각 어림 ▸' : '시각 어림 ▸'),
  /** 플레이어 최종 변론 머리(길이는 타이머 값에서 — '45초'·'1분') */
  defenseHead: (duration: string) => `최종 변론 · 1번부터 ${duration}씩`,
  /** G5 대기 화면 내 지목 칩(적중 표시 없음) */
  myVoteChip: (seat: number) => `내 지목: ${seat}번`,
} as const;

/** 금칙어 검사 대상 — 새 안내 문구 전부(자리표시자는 예시 값으로 채운다) */
export const GUIDE_COPY: readonly string[] = (() => {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(GUIDE);
  out.push(
    guideText.publicPast(2),
    guideText.sealLine(1234),
    guideText.sealToast(1234),
    guideText.sealToast(null),
    guideText.boardTitle(3),
    guideText.boardSeat(2),
    guideText.visitedTag(1),
    guideText.myVoteChip(3),
    guideText.flowTotal(35),
    guideText.pastAndTime(1),
    guideText.pastAndTime(2),
    guideText.defenseHead('45초'),
  );
  return out;
})();
