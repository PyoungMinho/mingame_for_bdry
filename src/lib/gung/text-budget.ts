/**
 * 6판 글 분량 규칙(docs/design/gung-compact-scene-spec.md §3) — 화면·요소별 상한 상수와 재는 법.
 *
 * PM 피드백 「너무 길어 거부감」의 기준표다. text-budget.test.ts 가 이 표로 자동 검사한다(상한 초과 = 테스트 실패).
 *  - 단위: Array.from(문자열).length — 공백·문장부호 포함. 낭독 시간은 330자/분으로 환산한다.
 *  - 버튼·링크 라벨은 화살표·아이콘 글자(→ › ▸ ⏱ 🔒 …)를 빼고 잰다.
 *  - 상한을 바꾸면 스펙 문서 §3-2 표도 같이 고친다.
 *
 * 사건 데이터(원고 → case-data.ts)는 원고팀이 줄인다. 이 파일은 상한만 정하고, 아직 상한을 넘는 항목은
 * DATA_OVER_BUDGET 에 「지금 값」으로 적어 둔다 — 그 값보다 **늘면** 실패, 상한 안으로 들어오면 목록에서 지우라고 실패한다
 * (목록이 낡지 않게). 압축은 사실 삭제가 아니라 문장 압축 + 블라인드 재검증으로(스펙 §3-3).
 *
 * import 는 guide-data(타입)뿐 — 순수 상수 모듈.
 */
import type { GUIDE } from './guide-data';

/** 낭독 속도(자/분) */
export const READ_CHARS_PER_MIN = 330;

export function textLength(s: string): number {
  return Array.from(s).length;
}

/** 버튼·링크 라벨 길이 — 화살표·아이콘 글자는 빼고 잰다 */
export function labelLength(s: string): number {
  return textLength(s.replace(/[→›‹▸⏱🔒📓🗺📜🪪💬📢＋🌙🕯]/gu, '').trim());
}

/** 낭독 분(330자/분, 올림 없이 소수 1자리) */
export function readMinutes(chars: number): number {
  return Math.round((chars / READ_CHARS_PER_MIN) * 10) / 10;
}

/** 공통 UI 문구 상한(스펙 §3-2 '공통 UI 문구') */
export const UI_BUDGET = {
  /** 진행 대본(HostCue)·한 줄 안내 */
  cue: 40,
  /** 버튼 라벨(화살표 제외) */
  button: 14,
  /** 토스트(신호 포함) */
  toast: 40,
  banner: 40,
  confirmTitle: 14,
  confirmBody: 48,
  confirmOk: 6,
  /** micro·보조 한 줄 */
  micro: 30,
  /** 접힘 summary */
  fold: 20,
  /** 시트·섹션 제목 */
  head: 24,
} as const;

/** 'text' = 규칙 원문·수첩 범례처럼 내용이 길이를 정하는 글(상한 검사 제외 — 금칙어 검사는 그대로) */
export type UiCopyKind = keyof typeof UI_BUDGET | 'text';

/**
 * GUIDE 키 → 종류. 새 키를 GUIDE 에 더하면 여기에도 넣어야 한다(빠진 키는 테스트가 잡는다 — 타입도 막는다).
 */
export const GUIDE_COPY_KIND: Record<keyof typeof GUIDE, UiCopyKind> = {
  selectCue: 'cue',
  selectTimerStart: 'button',
  publicAlsoInPhones: 'micro',
  sceneCue: 'cue',
  sceneTimerDone: 'micro',
  sceneLabel: 'head',
  moveTag: 'head',
  examineHead: 'head',
  examineHint: 'cue',
  examineOnce: 'micro',
  examineSpent: 'cue',
  examineClosed: 'cue',
  examineCloseNote: 'micro',
  obsHead: 'head',
  obsSealed: 'micro',
  obsShowNote: 'micro',
  bigScreenMenu: 'button',
  bigScreenBody: 'cue',
  bigScreenNote: 'micro',
  bigScreenMirror: 'micro',
  bigScreenCopy: 'button',
  bigScreenSend: 'button',
  bigScreenCopied: 'toast',
  bigScreenHomeLink: 'button',
  hostOwnClueLink: 'button',
  introCue: 'cue',
  introPlayer: 'cue',
  introProfileLink: 'micro',
  speechSection: 'head',
  innocentStamp: 'head',
  truthWaitTitle: 'head',
  truthWaitBody: 'cue',
  truthWaitButton: 'button',
  truthConfirmTitle: 'confirmTitle',
  truthConfirmBody: 'confirmBody',
  truthConfirmOk: 'confirmOk',
  lieRulesTitle: 'head',
  rulesTitle: 'head',
  lieRules: 'text',
  lieRulesShort: 'text',
  discussAskLine: 'cue',
  cardsMustSee: 'micro',
  helpSheetTitle: 'head',
  helpLabel: 'head',
  mapSection: 'head',
  peopleSection: 'head',
  termsSection: 'head',
  peopleLocked: 'micro',
  peopleAbsentHead: 'head',
  aliasHead: 'head',
  mapLink: 'button',
  helpLink: 'button',
  mapTapHint: 'micro',
  mapPanHint: 'micro',
  publicAll: 'fold',
  publicThisRound: 'fold',
  timeHintHead: 'head',
  timeHintTail: 'text',
  notesTab: 'head',
  notesShortcut: 'button',
  notesHead: 'cue',
  notesLegend: 'text',
  notesCols: 'text',
  notesColHelp: 'text',
  notesLinePlaceholder: 'micro',
  notesFreePlaceholder: 'micro',
  notesClear: 'button',
  notesClearTitle: 'confirmTitle',
  notesClearBody: 'confirmBody',
  notesClearOk: 'confirmOk',
  notesIdle: 'micro',
  clueMicro: 'micro',
  boardEmpty: 'micro',
  boardAdd: 'button',
  keypadTitle: 'head',
  sealReject: 'micro',
  sealLocked: 'micro',
  sealDuplicate: 'micro',
  sealPosted: 'micro',
  sealWho: 'micro',
  sealNext: 'button',
  sealClose: 'button',
  unpost: 'button',
  unpostToast: 'toast',
  boardFooter: 'micro',
  placeHint: 'micro',
  defenseCue: 'cue',
  defenseFrame: 'text',
  bonusHostHead: 'head',
  bonusHostGuide: 'micro',
  bonusZeroInline: 'micro',
  bonusPlayerHead: 'head',
  bonusOpenNote: 'micro',
  votePrompt: 'head',
  voteNote: 'micro',
  sameCaseNewRoom: 'button',
  sameCaseTitle: 'confirmTitle',
  sameCaseBody: 'confirmBody',
  sameCaseOk: 'confirmOk',
  homeMinutes: 'micro',
  expandAll: 'button',
  collapseAll: 'button',
  storageBanner: 'banner',
  wakeBanner: 'banner',
  versionBanner: 'banner',
  lobbyCue: 'cue',
  lobbyPlayer: 'cue',
  lobbyPlayerMicro: 'micro',
  flowTitle: 'head',
  flowRoundsNote: 'micro',
  skipIntroMenu: 'button',
  roundStepsLabel: 'head',
  briefingPlayerLine: 'micro',
  briefingRulesHead: 'head',
  briefingFold: 'fold',
  truthConclusion: 'head',
  truthFullFold: 'fold',
  resultNoSpoiler: 'micro',
};

/** 사건 데이터 상한(스펙 §3-2 '사건 데이터'·'내 패'·'방장 화면 H2·H9') */
export const DATA_BUDGET = {
  /** 장소 카드·증언형 카드 */
  placeCard: 140,
  /** 공용 카드 PB-n(그 밖의 공용 카드는 publicCardDefault) */
  publicCard: { 'PB-1': 150, 'PB-2': 170, 'PB-3': 280 } as Record<string, number>,
  publicCardDefault: 170,
  /** 추가 증언(NPC) */
  npcCard: 120,
  /** H2 개요 낭독(호명 포함, ※ 안내 줄 제외 — 낭독하지 않는다) */
  briefingRead: 450,
  /** H9 진상: 비트 수 · 비트당(시각 포함) · 합계(비트 + 범인 한 줄 + 자백 + 결말 + 요약) */
  truthBeats: 8,
  truthBeat: 70,
  truthTotal: 650,
  /** P9 플레이어 진상 결론(요약) */
  truthConclusion: 200,
  bonusPrompt: 18,
  bonusOption: 8,
  placeSub: 14,
  /** 내 패 칩 6개(말투 삭제) — 합 ≤ 900 */
  sheet: { identity: 60, profile: 110, secret: 300, night: 150, lies: 190, mission: 90, total: 900 },
} as const;

/**
 * 아직 상한을 넘는 사건 데이터(6판 보정 원고 실측, 2026-10-04 · 7판 보정 재측정) — 원고팀 압축 대기.
 *  - 7판(조사 따로): 브리핑 「셋」이 「다 같이 한 곳에 가 각자 물건 둘을 살핀 뒤, 흩어져 한 곳씩 뒤진다 … 증거로 내밀려면 …」로
 *    늘어 개요 낭독이 4·5인 467 → 495, 6인 443 → 471(상한 450 초과, 낭독 1.4분 그대로). 대신 공용 관찰 낭독(6판 40줄)이 없어져
 *    플레이어가 읽는 글 합계는 3,951 → 3,721자로 줄었다(원고 9-10). NPC-6C 183 → 127(7판 보정 압축).
 * 키 = 측정 항목 id(text-budget.test.ts 의 measureCaseData 와 같은 꼴), 값 = 지금 길이(이보다 늘면 실패).
 * 상한 안으로 들어오면 테스트가 「목록에서 지우시오」로 실패한다.
 */
export const DATA_OVER_BUDGET: Readonly<Record<string, number>> = {
  'publicCard:PB-1': 158,
  'publicCard:PB-2': 179,
  'npcCard:NPC-5B': 132,
  'npcCard:NPC-6C': 127,
  'briefingRead:4': 495,
  'briefingRead:5': 495,
  'briefingRead:6': 471,
  truthTotal: 713,
  'sheet.secret:queen': 311,
  'sheet.secret:physician': 355,
  'sheet.secret:courtLady': 309,
  'sheet.secret:crownPrincess': 305,
  'sheet.night:consort': 159,
  'sheet.night:eunuch': 216,
  'sheet.night:physician': 162,
  'sheet.night:courtLady': 201,
  'sheet.night:crownPrincess': 231,
};
