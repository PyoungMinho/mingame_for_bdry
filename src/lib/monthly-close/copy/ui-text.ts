/**
 * 화면 라벨(문구 팩 스키마 밖). 출처: UX §4(와이어프레임)·§4-1 홈·§4-10 결과·§10, 디자인 최종 §4-1·§9-2.
 * 스키마(copy/schema.ts)는 동결이라 버튼·메뉴·홈 안내 같은 "고정 라벨"은 여기에 모은다. 새 웃음 문구 없음.
 * 등급 0·1 자리에는 직급어를 쓰지 않는다(이 파일의 모든 줄은 copy.test.ts가 같은 금지어 검사를 한다).
 */

export const UI = {
  appName: '월마감',
  /** 홈 */
  home: {
    tagline: '스프레드시트처럼 생긴 화면에서 동료와 1대1로 하는 좌표 게임입니다.',
    beta: '베타',
    newDocTitle: '새 문서',
    nickname: '내 이름(표시용)',
    nicknameHint: '(8자)',
    formsTitle: '양식',
    alarmCheck: '결재 경보 포함',
    alarmCheckSub: '(3초 안에 시트를 전환하지 못하면 1회 쉽니다)',
    create: '공유 문서 만들기',
    openByNumberTitle: '문서 번호로 열기',
    open: '열기',
    recentTitle: '최근 문서',
    recentEmpty: '최근 문서가 없습니다.',
    practice: '박대리와 연습 2분',
    noticeTitle: '안내',
    noticeLead: '이 서비스는 게임입니다.',
    rules: [
      '숨겨 둔 항목 3개 중 2개를 먼저 찾으면 이깁니다.',
      '내 차례에 셀 주소(예: B7)를 골라 상대 시트를 검토합니다. 한 번에 20초.',
      'Tab 또는 ESC를 누르면 업무 시트로 바뀝니다. 돌아올 때는 아래 시트 탭을 클릭하세요.',
    ],
    notes: [
      '시트 화면에서 Tab은 시트 전환 키입니다. (키보드로는 방향키, Enter, / 키를 쓰세요)',
      '같은 브라우저에서만 30분 안에 다시 입장할 수 있습니다.',
      '혼자 시험할 땐 시크릿 창을 쓰세요.',
      'PC에서 더 잘 보입니다.',
      '회사 규정 확인은 본인 몫이며, 회사의 화면 모니터링은 피할 수 없습니다.',
      '숨기기는 완벽하지 않습니다. 브라우저 탭 미리보기·앱 전환 화면의 썸네일에는 숨기기 전 화면이 남을 수 있습니다.',
    ],
    recentWhen: (mins: number) => (mins < 1 ? '방금' : `${mins}분 전`),
  },
  /** 입장 대화상자 */
  join: {
    title: '공유된 문서 열기',
    docNumber: '문서 번호',
    nickname: '이름(표시용)',
    form: '양식',
    open: '열기',
    invite: '동료가 보낸 2인 좌표 게임 초대입니다 · 베타 · ',
    showRules: '규칙 보기',
    hideRules: '규칙 접기',
  },
  /** 공유 패널 */
  share: {
    title: '공유',
    docNumber: '문서 번호',
    copyLink: '링크 복사',
    copyNumber: '번호 복사',
    alarmIncluded: (on: boolean) => `결재 경보 포함: ${on ? '예' : '아니요'}`,
    sameBrowser: '같은 브라우저에서만 다시 열 수 있습니다 (30분)',
    shareMore: '공유…',
  },
  /** 크롬 */
  chrome: {
    shareBtn: '공유',
    coEdit: '공동 편집 중',
    versionLabel: (a: number, b: number) => `버전 기록 ${a}:${b}`,
    hint: '검토 의견',
    taunt: '의견 남기기',
    cooldown: (rounds: number) => `${rounds}회차 뒤 가능`,
    fileMenu: { newDoc: '새 문서', closeDoc: '문서 닫기', endPractice: '연습 종료' },
    helpMenu: { rules: '인수인계서' },
    nameBox: '이름 상자',
    formulaBar: '수식 입력줄',
    cancel: '취소',
    confirm: '입력',
  },
  /** 배치 */
  placement: {
    title: '배치 표',
    head: ['항목', '칸', '상태'] as const,
    placed: '배치됨',
    unplaced: '미배치',
    auto: '자동 배치',
    done: '배치 완료',
    alarmOn: '결재 경보: 포함',
    alarmOff: '결재 경보: 미포함',
  },
  /** 모바일(1024px 미만, UX §5) */
  mobile: {
    more: '더 보기',
    mine: '내 시트',
    theirs: '상대 시트',
    apply: (cell: string) => `${cell} 반영`,
    applyIdle: '반영',
    quizOk: '확인',
    hintOk: '이 범위 검토',
    hintMenu: (n: number) => `검토 의견(Σ ${n})`,
  },
  /** 대전 */
  battle: {
    itemsHead: ['항목', '칸', '상태'] as const,
    stateOk: '정상',
    stateHit: (n: number) => `${n}건 반려`,
    stateSunk: '종결',
    stateUnknown: '미확인',
    changeLog: ['시각', '범위', '내용'] as const,
    review: ['범위', '값', '시각'] as const,
    changeLogHint: (range: string) => `${range} 조회`,
    absent: '부재 처리',
    colReview: '열 검토',
    rowReview: '행 검토',
    blockReview: '범위 검토',
    quizEnterHint: 'Enter로 확정',
    memoHeadOpp: (name: string) => `${name}님 · 방금`,
    memoHeadMine: '검토 결과',
    memoHeadHint: '검토 의견',
  },
  /** 확인 팝오버 */
  confirm: {
    resignText: '저장하지 않은 변경 사항이 있습니다. 닫으시겠습니까? (이 판은 기권 처리됩니다)',
    resignOk: '닫기',
    absentText: '부재 처리하시겠습니까?',
    absentOk: '처리',
    cancel: '취소',
  },
  /** 예외 대화상자 */
  errors: {
    openPractice: '연습 문서 열기',
    newDoc: '새 문서 만들기',
  },
  /** 결과 */
  result: {
    saveAs: (n: number) => `v${n}로 저장`,
    requested: '요청함…',
    copyText: '내용 복사',
    newWithOther: '다른 동료와 새 문서',
    laughQ: '피식했나요?',
    laugh: { none: '아니요', some: '약간', lol: '많이' },
    report: '불편한 문구 신고',
    reportWhich: '어느 문구인가요?',
    reportKinds: { memo: '메모', taunt: '도발', doc: '문서' },
    reportSend: '보내기',
    belong: '소속/성명',
    when: '일시',
    reason: '종료 사유',
    gist: '경위',
    sign: '서명',
    sealMark: '(인)',
    peerClosed: '공동 편집자가 문서를 닫았습니다.',
    nameToggle: '상대 이름 넣기',
    coEditorLabel: '공동 편집자',
    practiceSummary: '연습 결산',
    inviteColleague: '동료 초대(공유 문서 만들기)',
  },
  /** 인수인계서(규칙 3줄 팝오버) */
  rulesTitle: '인수인계서',
  /** 연습 코치 말풍선 머리 줄(+ 단계 n/8) */
  practiceCoachHead: '연습',
} as const;
