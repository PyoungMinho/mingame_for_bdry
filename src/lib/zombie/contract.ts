/**
 * 좀비 터지면 — ID 레지스트리 (단일 출처).
 *
 * 콘텐츠 작가·씬 아티스트·엔진·UI 가 모두 이 파일의 id 만 쓴다.
 * 여기 없는 아이템/동료/장소/씬/엔딩 id 를 콘텐츠에서 쓰면 타입 에러 + 무결성 테스트 실패.
 */
import type {
  ChapterId,
  CompanionId,
  EndingId,
  EndingKind,
  ItemId,
  LocationId,
  SceneId,
  StatKey,
  TraitTag,
} from './types';

// ─────────────────────────────── 스탯 ───────────────────────────────

export const STAT_META: Record<StatKey, { label: string; short: string }> = {
  hp: { label: '체력', short: 'HP' },
  supply: { label: '보급', short: '보급' },
  mental: { label: '정신력', short: '정신' },
};

export const START_STATS: Record<StatKey, number> = { hp: 100, supply: 60, mental: 80 };

/**
 * 장면을 넘길 때마다 소모되는 보급 = 기본 + ⌊동행 수 × 계수⌋ (동행 1명 +0, 2명 +1, 3명 +2, 4명 +3).
 * 계수 1 → 0.75: 확장(약 40장면)으로 누적 소모가 커져 동행 4명이면 3장부터 11장면 연속 굶는 판이
 * 반숙련 플레이의 8.3%였다(무작위 3000판). 0.75 에서 0.4% — 대충 하면 여전히 굶는다.
 */
export const SUPPLY_DRAIN_BASE = 2;
export const SUPPLY_DRAIN_PER_COMPANION = 0.75;
/** 보급 0 상태로 장면을 넘기면 */
export const STARVING_HP = 8;
export const STARVING_MENTAL = 3;
/**
 * 물린 뒤 이 장면 수를 넘기면 좀비화(엔딩 turned).
 * 4 → 6: 4였을 때 1장에서 물리면 2장 입구에서 바로 변이해 "밤새 오르는 열" 서사와
 * 4~5장의 "물린 걸 숨긴다" 콘텐츠가 사실상 도달 불가였다(무작위 3000판 시뮬레이션).
 */
export const INFECTION_SCENES = 6;
/**
 * 어떤 엔딩이든 최소 이만큼 선택한 뒤에만 나온다 (PM 요구: "못해도 10개 선택은 해야 재미지지").
 * - 스토리 엔딩: 콘텐츠 무결성 테스트가 최단 경로 ≥ 이 값을 강제한다.
 * - 강제 엔딩: 이 전에 체력/정신력이 0 이 되면 1 로 버틴다(구사일생), 감염 변이는 이 시점까지 미뤄진다.
 */
export const MIN_CHOICES_BEFORE_END = 10;
/** 게임 시작 시각 (D+0 14:00) */
export const START_CLOCK = 14;
/** 결과에 hours 가 없을 때 흐르는 기본 시간(15분) — 시계가 장면마다 조금씩은 움직이게 */
export const DEFAULT_SCENE_HOURS = 0.25;

// ─────────────────────────────── 아이템 ───────────────────────────────

export const ITEMS: Record<ItemId, { name: string; desc: string }> = {
  bat: { name: '야구방망이', desc: '사회인 야구 2주 하고 접었다. 드디어 쓸 데가 생겼다.' },
  extinguisher: { name: '소화기', desc: '복도 소화전함에서 꺼냈다. 뿌려도 되고, 휘둘러도 된다.' },
  crowbar: { name: '빠루', desc: '문도 따고, 머리도 딴다.' },
  medkit: { name: '구급상자', desc: '밴드, 소독약, 붕대, 진통제. 물린 상처엔 소용없다.' },
  carKey: { name: '차 키', desc: '지하주차장 B2 어딘가의 내 차. 기름은 반 칸.' },
  radio: { name: '무전기', desc: '군·재난 방송 주파수가 잡힌다. 정보가 곧 생존이다.' },
  powerbank: { name: '보조배터리', desc: '폰이 살아 있으면 재난문자도, 가족 연락도 받는다.' },
  flashlight: { name: '손전등', desc: '정전된 서울에서 가장 비싼 물건.' },
  gasmask: { name: '방독면', desc: '민방위 훈련 때 받은 그것. 연기와 최루가스를 막는다.' },
  bike: { name: '따릉이', desc: '대여 앱은 먹통인데 자물쇠는 풀려 있었다.' },
  ramen: { name: '라면 한 박스', desc: '종말 이후 서울의 기축통화.' },
  soju: { name: '소주', desc: '마시면 용기, 던지면 화염병.' },
  dogfood: { name: '강아지 사료', desc: '콩이 최애 연어맛. 사람도 급하면 먹는다는 소문.' },
  descender: { name: '완강기', desc: '베란다 소방 완강기. 학교 소방훈련 때 이후 처음 본다.' },
  fuel: { name: '기름통', desc: '주유소에서 빼 온 휘발유 한 통. 차가 있다면 멀리 간다.' },
  pass: { name: '군 통행증', desc: '검문소를 통과할 수 있는 임시 통행증.' },
};

// ─────────────────────────────── 동료 ───────────────────────────────

export const COMPANIONS: Record<CompanionId, { name: string; role: string; desc: string }> = {
  kongi: {
    name: '콩이',
    role: '반려견',
    desc: '네 살 믹스견, 5kg. 한쪽 귀가 접혀 있다. 겁은 많은데 코는 좋다. 좀비 냄새를 먼저 맡고 으르렁거린다.',
  },
  grandma: {
    name: '1203호 할머니',
    role: '옆집 이웃',
    desc: '김장 때마다 김치를 나눠 주던 옆집 할머니. 느리지만 "난리통"을 겪어 본 사람의 지혜가 있다.',
  },
  minjun: {
    name: '민준',
    role: '고3 수험생',
    desc: '윗집 고3. 수능 D-49. 층간소음의 주범이었다. 체력 좋고 겁이 없다.',
  },
  nurse: {
    name: '정지수 간호사',
    role: '대학병원 간호사',
    desc: '3교대 나이트 근무 중에 사태가 터졌다. 상처 처치와 감염 증상을 안다.',
  },
  rider: {
    name: '용석',
    role: '배달 라이더',
    desc: '이 동네 골목과 지름길을 전부 안다. 오토바이는 잃었지만 다리는 빠르다.',
  },
  soldier: {
    name: '김 병장',
    role: '휴가 나온 군인',
    desc: '전역 D-30에 휴가 나왔다가 복귀를 못 했다. 총은 없지만 군 무전 절차와 검문소 사정을 안다.',
  },
};

/** 게임 시작 시 동행 */
export const START_COMPANIONS: CompanionId[] = ['kongi'];

// ─────────────────────────────── 장소 (지도) ───────────────────────────────
/**
 * 지도 좌표계: 1000 × 700. 한강이 y≈380 부근을 서→동으로 가로지른다(북=강북, 남=강남).
 * 인천항은 서쪽 끝, 북한산은 북쪽 끝, 잠실은 남동쪽.
 */
export const LOCATIONS: Record<LocationId, { name: string; x: number; y: number }> = {
  home: { name: '우리 아파트', x: 480, y: 250 },
  complex: { name: '아파트 단지', x: 530, y: 285 },
  store: { name: '역 앞 편의점', x: 430, y: 300 },
  station: { name: '지하철역', x: 380, y: 322 },
  tunnel: { name: '지하철 선로', x: 345, y: 360 },
  mart: { name: '대형마트', x: 290, y: 270 },
  hospital: { name: '대학병원', x: 620, y: 215 },
  shelter: { name: '초등학교 대피소', x: 590, y: 320 },
  checkpoint: { name: '강변 군 검문소', x: 500, y: 358 },
  bridge: { name: '한강대교', x: 420, y: 395 },
  stadium: { name: '잠실 구조 거점', x: 790, y: 470 },
  harbor: { name: '인천항', x: 60, y: 440 },
  mountain: { name: '북한산', x: 470, y: 70 },
};

// ─────────────────────────────── 챕터 ───────────────────────────────

export const CHAPTERS: Record<ChapterId, { name: string; window: string }> = {
  1: { name: '긴급재난문자', window: 'D+0 14:00 ~ 20:00' },
  2: { name: '첫날 밤', window: 'D+0 20:00 ~ D+1 08:00' },
  3: { name: '서울 한복판', window: 'D+1 08:00 ~ 22:00' },
  4: { name: '생존자들', window: 'D+1 22:00 ~ D+2 20:00' },
  5: { name: '탈출', window: 'D+2 20:00 ~ D+3 07:00' },
};

/** 챕터 입구 노드 — 다른 챕터에서 넘어올 수 있는 유일한 진입점 */
export const ENTRY = {
  c1: 'c1_start',
  c2a: 'c2a_start',
  c2b: 'c2b_start',
  c3: 'c3_start',
  c4: 'c4_start',
  c5Bridge: 'c5_bridge',
  c5Harbor: 'c5_harbor',
  c5Mountain: 'c5_mountain',
} as const;

export const START_NODE = ENTRY.c1;

/** 챕터 경계 간 공유 플래그 — 이 목록 밖의 플래그는 챕터 접두사(c1_, c2a_, …)를 붙인다 */
export const SHARED_FLAGS = {
  leftDog: '콩이를 집에 두고 떠났다 (1장) → 4장 재회 가능',
  smuggledDog: '반려동물 금지 대피 버스에 콩이를 이동가방에 숨겨 태웠다 (1장 → 2B)',
  openedDoor: '1장에서 피 흘리는 옆집 아저씨에게 문을 열어줬다',
  promisedMom: '엄마에게 꼭 살아서 가겠다고 약속했다 (1장) → 5장 결정적 순간 정신력 보너스',
  postedVideo: '좀비 영상을 SNS에 올렸다 (1장) → 4장에서 알아보는 사람이 있다',
  ateRamen: '재난문자 와중에도 라면을 끝까지 먹었다 (1장)',
  stayedHome: '첫날 밤 아파트에 남았다 (2A 루트)',
  evacuated: '대피 버스를 탔다 (2B 루트)',
  savedStranger: '위험을 무릅쓰고 낯선 사람을 구했다 (어느 챕터든) → 후반 보답',
  abandonedSomeone: '누군가를 두고 떠났다 (어느 챕터든) → 죄책감·후반 재등장',
  knowsBroadcast: '군 방송으로 구조 거점(잠실 헬기·인천항 수송선)을 알게 됐다',
  bridgeTimer: '한강대교가 D+3 06:00 폭파된다는 걸 안다',
  hiddenBite: '물린 사실을 무리에게 숨겼다',
  raidersDeal: '약탈자 무리와 거래했다 → 5장 배신 가능',
} as const;

export type SharedFlag = keyof typeof SHARED_FLAGS;

// ─────────────────────────────── 엔딩 ───────────────────────────────

export const ENDINGS_META: Record<EndingId, { kind: EndingKind; premise: string }> = {
  heli: { kind: 'survived', premise: '잠실 구조 거점에서 마지막 헬기에 올랐다' },
  ship: { kind: 'survived', premise: '인천항 해군 수송선을 타고 제주로 향한다' },
  mountain: { kind: 'survived', premise: '북한산 등산 동호회 아저씨들이 만든 산속 요새에 합류했다' },
  fortress: { kind: 'survived', premise: '아파트를 요새로 만들어 버텼다 — 12층의 왕' },
  alone: { kind: 'survived', premise: '살아남았지만 곁에 아무도 남지 않았다' },
  dogbond: { kind: 'special', premise: '반려견 탑승 불가 구조를 거절하고 콩이와 함께 걸어 나갔다' },
  hero: { kind: 'special', premise: '누군가를 살리기 위해 스스로 남았다' },
  quarantine: { kind: 'special', premise: '살았지만 군 격리시설 철창 안이다' },
  turned: { kind: 'turned', premise: '감염 — 나는 더 이상 내가 아니다 (감염 카운트다운 종료 시 엔진이 강제)' },
  dead: { kind: 'dead', premise: '체력이 다했다 (체력 0 시 엔진이 강제)' },
  breakdown: { kind: 'dead', premise: '몸보다 마음이 먼저 무너졌다 (정신력 0 시 엔진이 강제)' },
  ramen: { kind: 'dead', premise: '재난문자를 무시하고 라면을 먹다가 끝까지 몰랐다 (1장 밈 엔딩)' },
  betrayed: { kind: 'dead', premise: '믿었던 사람들에게 배신당했다' },
  bridge: { kind: 'dead', premise: '한강대교 위에서 06:00 정각을 맞았다' },
};

/** 엔진이 스탯/감염으로 강제하는 엔딩 */
export const FORCED_ENDINGS = { hp: 'dead', mental: 'breakdown', infection: 'turned' } as const;

// ─────────────────────────────── 생존자 유형 ───────────────────────────────

export const TRAITS: Record<TraitTag, { title: string; line: string }> = {
  kind: { title: '의리파 생존자', line: '좀비보다 사람을 먼저 챙겼다. 당신 같은 사람이 무리를 살린다.' },
  cold: { title: '냉혈 현실주의자', line: '감정은 사치. 계산이 빨랐고, 그래서 오래 버텼다.' },
  brave: { title: '무대뽀 돌격대장', line: '일단 부딪히고 본다. 무모함과 용기 사이 어딘가.' },
  careful: { title: '신중한 생존 전문가', line: '돌다리도 두드려 보고 안 건넌다. 그게 정답일 때가 많다.' },
  dog: { title: '댕댕이 보호자', line: '세상이 끝나도 콩이 밥은 챙긴다.' },
  meme: { title: '종말에도 진심인 자', line: '이 와중에 라면, 이 와중에 인증샷. 멘탈 하나는 최강.' },
};

// ─────────────────────────────── 씬 ───────────────────────────────

export const SCENES: Record<SceneId, { group: string; brief: string }> = {
  home_living: {
    group: 'A',
    brief:
      '토요일 오후 거실. 소파, 켜진 TV(화면 빛이 방을 물들임), 창밖 먼 곳의 검은 연기 기둥, 식탁 위 라면 냄비의 김. 따뜻한 오후빛이 불길한 주황으로 변해 가는 순간.',
  },
  phone_alert: {
    group: 'A',
    brief:
      '어두운 방, 손에 쥔 스마트폰이 앰버·빨강으로 번쩍인다(화면엔 추상적 경고 막대만 — 텍스트는 UI가 띄움). 폰 빛이 손과 주변을 비추는 강한 단일 광원.',
  },
  balcony_view: {
    group: 'A',
    brief:
      '12층 베란다 난간 너머 아파트 단지 전경. 마주 보는 아파트 동(벽에 큰 동 번호), 놀이터, 주차장에서 불타는 차, 작은 사람·좀비 실루엣들, 피어오르는 연기, 핏빛 석양.',
  },
  door_peephole: {
    group: 'A',
    brief:
      '시그니처 씬 — 현관 외시경(도어뷰) 어안렌즈 시점. 원형 비네트 바깥은 완전한 검정, 안쪽은 휘어진 복도. 렌즈에 바짝 붙은 사람 실루엣(팔을 부여잡고 고개를 숙임), 머리 위 형광등.',
  },
  dog_kongi: {
    group: 'B',
    brief:
      '콩이 클로즈업. 현관 바닥에 앉아 올려다보는 작은 믹스견(곱슬 털, 한쪽 귀가 접힘), 목줄, 창으로 들어오는 빛. 따뜻하지만 긴장된 분위기.',
  },
  home_dark: {
    group: 'B',
    brief:
      '정전된 밤의 방. 캠핑 랜턴 한 점의 따뜻한 빛, 소파와 식탁으로 친 바리케이드, 창밖은 붉게 물든 도시 하늘과 멀리 불길.',
  },
  hallway: {
    group: 'B',
    brief:
      '한국식 아파트 복도. 길게 뻗은 복도와 줄지은 현관문, 깜빡이는 형광등(일부 꺼짐), 빨간 소화전함, 복도 끝에 서 있는 기울어진 실루엣.',
  },
  stairwell: {
    group: 'B',
    brief:
      '비상계단. 벽에 큰 "12F" 표시, 문 위 초록 비상구 픽토그램 사인이 유일한 광원, 아래로 꺾여 내려가는 난간, 아래층 어둠 속에서 올라오는 손.',
  },
  elevator: {
    group: 'C',
    brief:
      '엘리베이터 홀. 반쯤 열린 엘리베이터 문 틈으로 삐져나온 손들, 위쪽 층수 표시등, 빨간 비상등 조명.',
  },
  parking_garage: {
    group: 'C',
    brief:
      '지하주차장. 기둥 번호(B2), 낮은 천장에 줄지은 형광등(몇 개 꺼짐), 주차된 차들, 차 사이 웅크린 실루엣, 한 대의 헤드라이트 빛.',
  },
  rooftop: {
    group: 'C',
    brief:
      '아파트 옥상 밤. 물탱크, 난간, 멀리 불타는 서울 야경(남산타워 실루엣), 연기 낀 밤하늘, 하늘에 헬기 불빛 한 점.',
  },
  evac_bus: {
    group: 'C',
    brief:
      '달리는 대피 버스 내부. 좌석 줄과 손잡이, 창밖을 스치는 붉은 불빛, 서 있는 승객 실루엣들, 한 명이 웅크려 기침한다.',
  },
  street_chaos: {
    group: 'D',
    brief:
      '서울 도로 한복판. 버려진 차들(택시 지붕 표시등), 쓰러진 가로등, 연기, 한국식 세로 간판 불빛, 멀리 무리 지어 걷는 좀비들.',
  },
  convenience_store: {
    group: 'D',
    brief:
      '밤거리에서 유일하게 환한 편의점. 형광등 가득한 유리 박스, 진열대, 계산대 뒤 알바 실루엣, 유리문에 찍힌 손자국.',
  },
  subway_platform: {
    group: 'D',
    brief:
      '지하철 승강장. 스크린도어 줄, 노선색 띠의 전광판, 기둥, 스크린도어 너머 선로의 어둠, 바닥에 버려진 짐.',
  },
  subway_tunnel: {
    group: 'D',
    brief:
      '지하철 선로 터널. 손전등 원뿔 빛, 원근으로 뻗은 레일, 벽을 따라 늘어진 케이블, 저 멀리 어둠 속 실루엣.',
  },
  mart: {
    group: 'E',
    brief:
      '대형마트 통로. 높은 진열대, 쏟아진 물건, 버려진 카트, 물건을 두고 다투는 사람 실루엣들, 천장 조명 일부 꺼짐.',
  },
  hospital: {
    group: 'E',
    brief:
      '대학병원 복도. 초록 비상등, 빈 침대와 휠체어, 유리창 너머 격리실, 반쯤 걷힌 커튼 뒤 실루엣.',
  },
  bike_street: {
    group: 'E',
    brief:
      '새벽 푸른빛 속 따릉이(앞 바구니 자전거)로 달리는 인물 실루엣, 가로수 길, 멀리서 쫓아오는 좀비들. 속도감.',
  },
  raiders: {
    group: 'E',
    brief:
      '약탈자 무리. 불붙은 드럼통 주위의 무장한 사람 실루엣들(방망이·쇠파이프), 폐차로 만든 바리케이드, 거친 분위기.',
  },
  shelter: {
    group: 'F',
    brief:
      '초등학교 강당 대피소. 농구 골대, 바닥의 매트와 담요들, 모여 앉은 사람들, 높은 창으로 새는 빛, 게시판에 붙은 쪽지들.',
  },
  checkpoint: {
    group: 'F',
    brief:
      '강변 군 검문소. 바리케이드와 철조망, 교차하는 탐조등 빔, 군 트럭, 소총 든 군인 실루엣, 경고 표지판.',
  },
  campfire: {
    group: 'F',
    brief:
      '폐허 속 밤 모닥불. 생존자 3~4명이 둘러앉음(작은 개 한 마리 포함 가능), 얼굴을 비추는 불빛, 주변을 둘러싼 어둠.',
  },
  horde: {
    group: 'F',
    brief:
      '좀비 떼. 화면을 가득 채우며 다가오는 무리, 앞줄은 크고 가깝게, 뒤로 수십이 겹침, 강한 역광.',
  },
  han_bridge: {
    group: 'G',
    brief:
      '새벽 한강대교. 아치 교량 실루엣, 다리 위 버려진 차 행렬, 강물의 반사, 강 건너 강남 스카이라인.',
  },
  helicopter: {
    group: 'G',
    brief:
      '잠실 구조 거점 헬기. 착륙한 군 헬기, 로터 블러, 서치라이트, 헬기로 달려가는 사람들, 흩날리는 먼지.',
  },
  harbor: {
    group: 'G',
    brief:
      '새벽 인천항. 컨테이너 크레인, 정박한 회색 수송선, 부두의 사람들, 바다 안개.',
  },
  mountain: {
    group: 'G',
    brief:
      '북한산. 화강암 봉우리 실루엣(인수봉 느낌), 안개 낀 능선, 나무에 매달린 산악회 리본, 산중 캠프 불빛.',
  },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const COMPANION_IDS = Object.keys(COMPANIONS) as CompanionId[];
export const LOCATION_IDS = Object.keys(LOCATIONS) as LocationId[];
export const SCENE_IDS = Object.keys(SCENES) as SceneId[];
export const ENDING_IDS = Object.keys(ENDINGS_META) as EndingId[];
