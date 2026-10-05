/**
 * 화면 문구 — 시스템·UI 공통(비용 프롬프트·코치마크·설정·빈 상태). 사건 대사는 CASE 에서 온다.
 * 톤: 시스템·설정은 해요체, 한결(코치마크)은 해요체 존댓말, 탐정 독백은 평어체(UX 12-3).
 * 스포일러 금지: 인물·증거·트릭 어휘를 쓰지 않는다.
 */

export type CoachId =
  | 'firstDot'
  | 'acquire'
  | 'freeLook'
  | 'lineNav'
  | 'press'
  | 'present'
  | 'result'
  | 'hudTour'
  | 'hubLegend'
  | 'firstSpend'
  | 'firstHalf'
  | 'firstRedirect'
  | 'firstWrong'
  | 'firstQuestion'
  | 'firstStar'
  | 'firstUpgrade'
  | 'firstTrust1'
  | 'hintAdvice';

export const COACH_TEXT: Record<CoachId, string> = {
  firstDot: '빛나는 점을 눌러요.',
  acquire: '수첩에 담겼어요. 나중에 증언에 내밀 거예요.',
  freeLook: '더 둘러봐도 돼요. 다 안 봐도 되고요.',
  lineNav: '화살표로 증언을 넘겨 봐요.',
  press: '수상하면 [추궁]. 무료고 몇 번이든 돼요.',
  present: '앞뒤가 안 맞으면 증거를 내밀어요.',
  result: '기계도 틀릴 수 있죠?',
  hudTour: '',
  hubLegend: '자동으로 저장돼요. 언제든 닫아도 돼요.',
  firstSpend: '처음 가는 곳과 처음 듣는 증언엔 행동이 들어요. 한 번 더 물어볼게요.',
  firstHalf: '반쯤 맞음은 감점이 없어요. 방향은 맞아요. 두 장을 겹치거나, 먼저 풀어야 할 게 있을 수도 있어요.',
  firstRedirect: '감점은 없어요. 그 사람에게 따질 일이 아닌가 봐요.',
  firstWrong: '틀리면 제 인내심이 한 칸 깎여요. 반쯤 맞음과 우회는 괜찮아요.',
  firstQuestion: '수첩에 의문이 생겼어요. 풀리지 않은 건 거기 모여요.',
  firstStar: '결정적 모순을 깼어요! 3개를 깨면 범인을 지목할 수 있어요.',
  firstUpgrade: '기록이 바뀌었어요. 수첩 증거에 「갱신」 표시가 붙어요.',
  firstTrust1: '신뢰 1 — 한 번 더 틀리면 수사 배제예요.',
  hintAdvice: '수첩 정리 전에 의문·정리된 것을 봤나요? (행동 1이 들어요)',
};

/**
 * HUD 투어 3말풍선(튜토리얼 끝). id 는 말풍선마다 meta.coach 에 '봤다'를 남기는 키 —
 * 보여 준 순간 기록해, 새로고침·이어하기 뒤에 이미 본 말풍선이 또 나오지 않는다.
 */
export const HUD_TOUR: { id: string; text: string; anchor: 'clock' | 'trust' | 'star' }[] = [
  { id: 'hudTour1', text: '시계와 점은 행동이에요. 13번이 다 지나면 사이렌이 울려요.', anchor: 'clock' },
  { id: 'hudTour2', text: '다음부턴 틀리면 제 인내심이 깎여요, 선배님.', anchor: 'trust' },
  { id: 'hudTour3', text: '결정적 모순 별 3개를 모으면 범인을 지목할 수 있어요.', anchor: 'star' },
];

export const RULE_CARD_2_EXTRA = '(두 장을 겹쳐 낼 수도 있다)';

export const RULE_TITLES = ['시간', '증언', '지목'] as const;

/** 마지막 행동 시트 본문(디자인 §5-3, v4 축소 — 잃는 건 새 수사뿐이라 경고는 두 줄 + ★ 부족일 때 한 줄) */
export const LAST_ACTION = {
  title: '마지막 행동',
  body1: '이게 마지막 행동이다.',
  body2: '끝나면 새 수사는 끝. 이미 연 곳은 다시 볼 수 있다.',
  noGate: (k: number) => `결정적 모순이 아직 ${k}개 모자라다.`,
} as const;

/** 사이렌 화면 보조 문구(디자인 §5-16, v4) — 두 변형 모두 '이미 연 곳은 다시 본다'를 말한다 */
export const SIREN_SUB = {
  ready: '새 수사는 끝이다. 이미 연 곳을 다시 보고, 준비되면 지목하라.',
  short: (k: number) => `새 수사는 끝이다. 이미 연 곳은 다시 볼 수 있다. 결정적 모순이 ${k}개 더 필요하다.`,
} as const;

/** 「수사 종료」 확인 시트 — 사이렌 뒤 ★ < 3 (밸런스 R6) */
export const END_SHEET = {
  title: '수사를 끝낼까요?',
  lead: '끝내면 결과가 바로 나와요.',
  body: (k: number) => `지목하려면 결정적 모순이 ${k}개 더 필요해요.`,
  newSet: '새로 열린 증언이 있어요.',
  no: '더 본다',
  yes: '끝낸다',
} as const;

export const SPEND_TEXT = {
  hintExplain: '어디를, 어떤 주제를 짚어 줘요. 정답은 말하지 않아요.',
  preciseMore: (left: number) => `행동 1이 더 든다. (남은 행동 ${left} → ${left - 1})`,
  confirmTitle: (left: number) => `남은 행동 ${left} → ${left - 1}`,
  ask: '정말 쓸까요?',
} as const;

export const TOAST = {
  actionUsed: (from: number, to: number) => `행동 ${from} → ${to}`,
  sirenNear: '사이렌 소리가 가까워진다',
  trustMinus: '신뢰 −1',
  half: '반쯤 맞음 · 감점 없음',
  redirect: '감점 없음',
  tutorialWrong: '튜토리얼이라 감점 없음',
  already: '이미 깨진 얘기다',
  firstLine: '처음 줄로',
  linesGrew: (n: number) => `증언이 늘었다 · ${n}번`,
  question: '수첩: 의문 1개 추가',
  newSpot: (place: string) => `${place}에 새 단서 · NEW`,
  evidenceAdded: (n: number, total: number) => `수첩에 추가 · 증거 ${n}/${total}`,
  upgraded: (from: string, to: string) => `증거 갱신: ${from} → ${to}`,
  ready: '고발 준비 완료 — 최종 지목이 열렸어요',
  backAgain: '한 번 더 누르면 나가요(기록은 저장돼요)',
  sirenLocked: '사이렌 뒤엔 새로운 곳에 못 가요',
  /** 행동 0 인 대상 안에서 다른 곳으로 가려 할 때 */
  zeroInside: '나가면 사이렌. 이미 연 곳은 그 뒤에도 다시 볼 수 있다.',
  noActionPrecise: '남은 행동이 없다 — 정밀 조사는 못 한다',
  twoCards: '두 장까지 낼 수 있어요',
  moved: (slot: string) => `${slot} 칸에서 옮겼다`,
  copied: '문구를 복사했어요',
  copyFailed: '복사하지 못했어요. 아래 문구를 직접 선택해 주세요',
  achievement: (name: string) => `업적: ${name}`,
  saveBlocked: '이 브라우저는 저장을 막고 있어요. 탭을 닫으면 기록이 사라져요.',
} as const;

export const EMPTY = {
  evidence: '아직 수첩이 비었다. 현장부터 보자.',
  questions: '아직 캐물을 게 없다. 증언을 추궁해 보자.',
  timeline: '시각이 적힌 증거와 증언이 쌓이면 여기에 줄이 선다.',
  summary: '깬 모순이 쌓이면 여기에 정리된다.',
  hintMemo: '아직 쓴 수첩 정리가 없다.',
} as const;

export const NOTICE = {
  version: '새 버전이라 이전 수사는 이어갈 수 없어요. 도감은 그대로예요.',
  corrupt: '기록을 읽지 못해 새 수사로 시작해요.',
  noStorage: '이 브라우저는 저장을 막고 있어요. 탭을 닫으면 기록이 사라져요.',
} as const;

export const GLOSSARY: { term: string; desc: string }[] = [
  { term: '행동', desc: '처음 가는 장소, 처음 듣는 증언, 정밀 조사, 수첩 정리에 한 번씩 들어요. 13번을 다 쓰면 사이렌. 그 뒤엔 새 수사는 끝, 이미 연 곳은 다시 볼 수 있어요.' },
  { term: '신뢰도', desc: '한결의 인내심이에요. 틀린 증거를 내밀면 한 칸 깎여요. 0이 되면 수사에서 배제돼요. 결정적 모순을 깨면 한 칸 돌아와요.' },
  { term: '결정적 모순', desc: '범인을 지목하려면 3개를 깨야 하는 별(★)이에요. 깨면 신뢰도도 한 칸 올라요.' },
  { term: '일반 모순', desc: '마름모(◆). 지목 조건은 아니지만 새 길을 열어 줘요.' },
  { term: '반쯤 맞음', desc: '방향은 맞는데 딱 맞진 않다는 뜻이에요. 감점이 없어요. 두 장을 겹치거나 먼저 풀 게 있을 수 있어요.' },
  { term: '우회', desc: '그 사람에게 따질 일이 아니라는 뜻이에요. 감점이 없어요.' },
];

export const SETTINGS_TEXT = {
  solo: '혼자서 즐기는 1인용 게임이에요. 기록은 이 기기에만 저장돼요.',
  version: '버전 1.0',
  previewLine: '비 오는 밤, 이 문장이 지금 설정대로 나타나요.',
} as const;

export const TITLE_TEXT = {
  kicker: '스마트홈 살인사건',
  wordA: '목격자는 ',
  wordB: 'AI',
  chips: ['혼자서', '약 25분', '가입 없음'],
  /** 홈 진입 문구 — 저장이 없을 때(첫 방문) 이어하기 자리에 쓴다. 스포일러 없음(메타 description 과 같은 정보량) */
  hook: ['비 오는 밤, 41층 펜트하우스에서 회장이 숨졌다.', '용의자는 넷, 증인은 스피커 하나.', '행동 13번 안에 거짓말을 깨라.'],
} as const;

export const ENDING_SLOT_LABEL: Record<string, string> = {
  perfect: '완벽 해결',
  hidden: '숨은 엔딩',
  short: '증거 부족',
  timeout: '시간 초과',
  excluded: '수사 배제',
};
