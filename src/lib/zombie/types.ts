/**
 * 좀비 터지면 (/zombie) — 스토리 데이터 스키마.
 *
 * 모든 시나리오 콘텐츠(src/lib/zombie/content/*)는 이 타입으로만 작성한다.
 * ID 레지스트리(아이템·동료·장소·씬·엔딩·챕터 입구)는 contract.ts 가 단일 출처다.
 */

export type StatKey = 'hp' | 'supply' | 'mental';

export type ItemId =
  | 'bat'
  | 'extinguisher'
  | 'crowbar'
  | 'medkit'
  | 'carKey'
  | 'radio'
  | 'powerbank'
  | 'flashlight'
  | 'gasmask'
  | 'bike'
  | 'ramen'
  | 'soju'
  | 'dogfood'
  | 'descender'
  | 'fuel'
  | 'pass';

export type CompanionId = 'kongi' | 'grandma' | 'minjun' | 'nurse' | 'rider' | 'soldier';

export type LocationId =
  | 'home'
  | 'complex'
  | 'store'
  | 'station'
  | 'tunnel'
  | 'mart'
  | 'hospital'
  | 'shelter'
  | 'checkpoint'
  | 'bridge'
  | 'stadium'
  | 'harbor'
  | 'mountain';

export type SceneId =
  // A — 집
  | 'home_living'
  | 'phone_alert'
  | 'balcony_view'
  | 'door_peephole'
  // B — 집 2 / 복도
  | 'dog_kongi'
  | 'home_dark'
  | 'hallway'
  | 'stairwell'
  // C — 건물
  | 'elevator'
  | 'parking_garage'
  | 'rooftop'
  | 'evac_bus'
  // D — 거리
  | 'street_chaos'
  | 'convenience_store'
  | 'subway_platform'
  | 'subway_tunnel'
  // E — 거리 2
  | 'mart'
  | 'hospital'
  | 'bike_street'
  | 'raiders'
  // F — 거점
  | 'shelter'
  | 'checkpoint'
  | 'campfire'
  | 'horde'
  // G — 탈출
  | 'han_bridge'
  | 'helicopter'
  | 'harbor'
  | 'mountain';

export type ChapterId = 1 | 2 | 3 | 4 | 5;

export type EndingId =
  | 'heli'
  | 'ship'
  | 'mountain'
  | 'fortress'
  | 'dogbond'
  | 'hero'
  | 'quarantine'
  | 'alone'
  | 'turned'
  | 'dead'
  | 'breakdown'
  | 'ramen'
  | 'betrayed'
  | 'bridge';

/** 선택 성향 태그 — 엔딩 화면의 "생존자 유형" 산출에 쓰인다. */
export type TraitTag = 'kind' | 'cold' | 'brave' | 'careful' | 'dog' | 'meme';

/**
 * 조건. 명시된 필드는 모두 AND. 비어 있으면 항상 참.
 * flags 는 자유 문자열 — 챕터 로컬 플래그는 `c1_`, `c2a_` 같은 접두사를 붙인다.
 */
export interface Condition {
  /** 전부 보유 */
  items?: ItemId[];
  /** 하나 이상 보유 */
  anyItems?: ItemId[];
  /** 하나도 보유하지 않음 */
  noItems?: ItemId[];
  /** 전부 동행 중 */
  companions?: CompanionId[];
  /** 하나 이상 동행 중 */
  anyCompanions?: CompanionId[];
  /** 하나도 동행하지 않음 */
  noCompanions?: CompanionId[];
  /** 전부 켜져 있음 */
  flags?: string[];
  /** 하나도 켜져 있지 않음 */
  noFlags?: string[];
  /** 스탯 하한(이상) */
  min?: Partial<Record<StatKey, number>>;
  /** 스탯 상한(이하) */
  max?: Partial<Record<StatKey, number>>;
  /** 감염 여부 */
  infected?: boolean;
}

/** 조건부 문단 — 동행/아이템에 따라 문장이 달라질 때 쓴다. */
export type Para = string | { when: Condition; text: string };

export interface Effect {
  hp?: number;
  supply?: number;
  mental?: number;
  addItems?: ItemId[];
  removeItems?: ItemId[];
  addCompanions?: CompanionId[];
  removeCompanions?: CompanionId[];
  setFlags?: string[];
  clearFlags?: string[];
  /** 물림 → 감염 카운트다운 시작 */
  infect?: boolean;
  /** 감염 치료(혈청 등, 극히 드묾) */
  cure?: boolean;
  /** 경과 시간(시간 단위) */
  hours?: number;
}

/** 다음 노드 id 또는 `end:<EndingId>` */
export type NextTarget = string;

/**
 * 결과. Choice.outcomes 는 위에서부터 평가한다:
 *  - when 이 거짓이면 건너뜀
 *  - chance(0~1)가 있으면 굴려서 실패 시 건너뜀
 *  - 마지막 outcome 은 반드시 when/chance 없는 무조건 폴백
 */
export interface Outcome {
  when?: Condition;
  chance?: number;
  effects?: Effect;
  result: Para[];
  next: NextTarget;
}

export interface Choice {
  /** 노드 안에서 유일 */
  id: string;
  /** 선택지 문구 (24자 이내 권장) */
  label: string;
  /** 보조 문구 (20자 이내 권장) */
  hint?: string;
  /** 선택 가능 조건 */
  requires?: Condition;
  /** requires 불충족 시 잠금 표시 문구. 없으면 선택지 자체를 숨긴다. */
  lockedHint?: string;
  tags?: TraitTag[];
  outcomes: Outcome[];
}

export type AlertKind = 'disaster' | 'kakao' | 'news' | 'radio' | 'call';

/** 씬 위에 뜨는 연출 오버레이 (재난문자·카톡·속보·무전·전화) */
export interface Alert {
  kind: AlertKind;
  /** 발신자/채널명 — 예: '행정안전부', '대학동기방 (7)', '엄마' */
  from?: string;
  text: string;
}

export interface StoryNode {
  id: string;
  chapter: ChapterId;
  location: LocationId;
  scene: SceneId;
  title: string;
  /** 절대 시각(D+0 00:00 기준 경과 시간). 진입 시 현재 시각이 이보다 이르면 이 시각으로 맞춘다. */
  clock?: number;
  alert?: Alert;
  body: Para[];
  /** 2~4개 */
  choices: Choice[];
}

export type EndingKind = 'survived' | 'dead' | 'turned' | 'special';

export interface EndingVariant {
  when: Condition;
  title?: string;
  body: Para[];
  epitaph?: string;
}

export interface Ending {
  id: EndingId;
  kind: EndingKind;
  title: string;
  scene: SceneId;
  body: Para[];
  /** 공유 카드용 한 줄 */
  epitaph: string;
  /** 위에서부터 첫 번째로 맞는 변형이 본문을 덮어쓴다 */
  variants?: EndingVariant[];
}
