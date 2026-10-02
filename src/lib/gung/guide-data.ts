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
  selectCue: '공용 단서를 먼저 읽고, 고르기 2분을 시작하시오. 장소는 한 군데만이오',
  selectTimerStart: '다 읽었소 → 고르기 2분 시작',
  publicAlsoInPhones: '이 단서는 각자 폰 단서함에도 있소',
  hostOwnClueLink: '🔒 내 조사(장소·단서)는 단서함에서 ›',

  // ── G3 자기소개 ──
  introCue: '1번부터 차례로 신분을 밝히시오. 패의 신분 글을 읽으면 되오. 말투는 자유요',
  introPlayer: "방장이 내 번호를 부르면, 아래를 꾹 눌러 '신분'을 읽으시오",
  rulesIntroStep: '③ 자기소개 — 패의 신분 글을 읽는다(말투는 자유)',
  speechHead: '그 일이 화제에 오를 때 쓰는 말이오. 자기소개 땐 읽지 마시오.',

  // ── G4 정체 칸 ──
  innocentStamp: '결백',

  // ── G5 진상 2단 공개 ──
  truthWaitTitle: '그날 밤의 진상',
  truthWaitBody: '방장이 낭독하는 중이오. 방장 화면을 보시오.',
  truthWaitButton: '범인이 밝혀졌어요 →',
  truthConfirmTitle: '범인을 보겠소?',
  truthConfirmBody: '방장이 범인을 밝힌 뒤에만 누르시오. 넘어가면 범인과 모두의 비밀이 보이오.',
  truthConfirmOk: '보겠소',

  // ── R1 거짓말 규칙(브리핑 '둘.' = 원고 7-1, 공통 규칙 2 = 원고 1-7 = 플레이어 뷰 2-4) ──
  lieRulesTitle: '거짓말 규칙',
  lieRules: [
    '범인은 무엇이든 거짓말할 수 있소.',
    '범인이 아닌 자는 패의 「둘러대도 되는 것」만 둘러댈 수 있고, 그 거짓으로 남에게 죄를 씌울 순 없소.',
    '그 밖의 일은 입을 다물 순 있어도 지어낼 순 없소.',
    '「물으면 사실대로」는 누가 물어야 나오오. 물으면 숨김없이 답하시오. 「R2부터」「R3부터」가 붙었으면 그 조사 전까진 입만 다무시오(부인·지어내기 금지).',
    '거짓이 들통났다고 곧 범인은 아니오. 범인은 물증으로 가리시오.',
  ],
  // 봉인 패 '거짓말' 칸 맨 위엔 한 줄 요약만(긴 패가 한 화면을 넘지 않게 — QA F-1). 전문은 메뉴 › 하는 법.
  lieRulesShort: '범인 아닌 자는 「둘러대도 되는 것」만 둘러대고, 「물으면 사실대로」는 답하시오. 전문은 메뉴 › 하는 법.',
  discussAskLine: '「물으면 사실대로」는 물어야 나오오. 궁금하면 콕 집어 물으시오.',
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
  clueMicro: '공개해도 다른 폰엔 저절로 가지 않소. 인장을 방장에게 불러 주시오',
  boardEmpty: '아직 올린 단서가 없소. 공개한 이에게 인장을 불러 달라 하시오',
  boardAdd: '＋ 인장으로 올리기',
  keypadTitle: '인장 번호를 넣으시오',
  sealReject: '그런 인장은 없소',
  sealLocked: '10초 뒤에 다시 넣으시오',
  sealDuplicate: '이미 올린 단서요',
  sealWho: '누가 밝혔소? (건너뛰어도 되오)',
  sealSkip: '건너뛰기',
  sealPost: '보드에 올리기',
  unpost: '내리기',
  unpostTitle: '이 단서를 보드에서 내리겠소?',
  unpostBody: '내린 단서는 인장으로 다시 올릴 수 있소.',
  unpostOk: '내리겠소',
  boardFooter: '보드엔 스스로 밝힌 단서만 오르오',
  placeHint: '같은 곳을 고르면 같은 단서요. 나눠 갈수록 많이 알게 되오',

  // ── R6 최종 변론 3칸 틀 ──
  defenseCue: '한 사람씩 1분. 아래 셋만 말하시오',
  defenseFrame: ['범인이라 보는 자', '그 물증 하나 — 카드든 증언이든(수단·기회·동기 중)', '내가 아닌 까닭 한 줄'],

  // ── R7 보너스 문항 정식 단계 ──
  bonusHostHead: '보너스 문항 — 맞히면 +1 (범인의 답은 셈하지 않소)',
  bonusHostGuide: '문항을 읽고, 셋에 손가락 1~4로 답하게 하시오',
  bonusZeroTitle: '보너스 없이 공개하겠소?',
  bonusZeroBody: '보너스 문항을 하나도 적지 않았소. 그대로 가면 보너스 점수 없이 셈하오.',
  bonusZeroOk: '그대로 공개',
  bonusPlayerHead: '보너스 문항 — 방장이 물으면 손가락으로 답하시오',

  // ── M1 문구 정정 ──
  sameCaseNewRoom: '같은 사건, 다른 모임용 새 방 ›',
  sameCaseTitle: '같은 사건을 새 방으로 열겠소?',
  sameCaseBody: '범인은 늘 같소. 방금 한 사람은 진상을 아니, 처음 하는 이들끼리 하시오. 지금 기록은 지워지오.',
  sameCaseOk: '새 방 열기',
  homeMinutes: '약 60분',

  // ── M2 모두의 패 ──
  expandAll: '모두 펼치기',
  collapseAll: '모두 접기',
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
  );
  return out;
})();
