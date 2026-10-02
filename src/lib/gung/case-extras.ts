/**
 * 「세자 독살 사건」 손으로 쓴 공개 부록 데이터(개선 묶음 1 · R2) — 궁 배치도 레이아웃 · 호칭표 · 인물록.
 *
 * `case-data.ts` 는 원고에서 생성하는 파일이라 손대지 않는다. 이 파일은 **이미 공개된 정보의 표시 형식**만 담는다.
 *  - 배치도 라벨·주석: 플레이어 뷰 2-1 표·도식·주석 원문(docs/planning/gung-player-view.md §2-1 = 원고 1-8 ① '장소 지도').
 *    그리지 않는 것: 사람·화살표 동선·시각·물건·'대청 끝' 위치·번 나인 자리(R3 정보를 R2로 당기지 않게). 인원(4·5·6)과 무관하게 같다.
 *    동궁전 확대도는 원고에 방 배치의 방위가 없으므로 원고 도식 순서(동온돌│대청│서온돌)만 쓰고 방위 표시를 하지 않는다.
 *  - 호칭표: 브리핑·공개 프로필·공용/장소 카드 본문에 실제로 나오는 표기만(자동 검사 — case-extras.test.ts).
 *    엑스트라(의녀·생과방 나인·숙의방 궁녀 등)와 관계선은 넣지 않는다 — 처음부터 보이면 R3 카드의 연결이 앞당겨진다.
 *  - 인물록: publicSeats(D16 자기소개 뒤 공개 정보) + 공개 프로필(플레이어 뷰 3장). NPC 는 브리핑 「이 자리에 없으나,
 *    증언을 남긴 이」와 같은 말로만 부른다. 6인 판엔 그 개념 자체가 없다.
 */
import { publicSeats, roleById, type Assignment } from './assign';
import type { GungCase, PlaceId, RoleIconKey } from './types';

// ─────────────────────────────── 배치도 ───────────────────────────────

/** 장소·건물 상자. placeId 가 있으면 그 장소의 아이콘(places[].icon)을 붙인다 */
export interface MapBox {
  kind: 'box';
  key: string;
  placeId?: PlaceId;
  /** 1~2줄 라벨 */
  lines: string[];
  /** 라벨 옆 작은 글씨(예: '(북)') */
  note?: string;
  cx: number;
  cy: number;
  w: number;
  h: number;
}
export interface MapText {
  kind: 'text';
  key: string;
  text: string;
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  tone?: 'muted' | 'ink';
  size?: 'sm' | 'md';
}
export interface MapLine {
  kind: 'line';
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** road = 큰 길 · path = 연결선 · lane = 비껴 난 가는 길 · shut = 닫힌 문 쪽 점선 */
  style: 'road' | 'path' | 'lane' | 'shut';
}
/** 문 기호(門). barred = 빗장 가로대 */
export interface MapGate {
  kind: 'gate';
  key: string;
  cx: number;
  cy: number;
  barred?: boolean;
}
/** 울타리·묶음 테두리 */
export interface MapFence {
  kind: 'fence';
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: 'wall' | 'group';
}
export type MapItem = MapBox | MapText | MapLine | MapGate | MapFence;

export interface PalaceMapDef {
  key: 'palace' | 'donggung';
  title: string;
  /** [너비, 높이] — SVG viewBox */
  size: [number, number];
  items: MapItem[];
}

/** ① 궁 전체(방위 북↑) — 플레이어 뷰 2-1 도식 */
const PALACE: PalaceMapDef = {
  key: 'palace',
  title: '궁 전체',
  size: [320, 316],
  items: [
    { kind: 'text', key: 'compass', text: '북↑', x: 312, y: 14, anchor: 'end', tone: 'muted', size: 'sm' },
    // 세로선: 중궁전 — 동궁 내문 — 갈림길
    { kind: 'line', key: 'v1', x1: 160, y1: 46, x2: 160, y2: 102, style: 'path' },
    { kind: 'line', key: 'v2', x1: 160, y1: 122, x2: 160, y2: 200, style: 'path' },
    // 가운데 줄: 서고(외전) — 동궁 내문 — 동궁전
    { kind: 'line', key: 'h1', x1: 96, y1: 112, x2: 150, y2: 112, style: 'path' },
    { kind: 'line', key: 'h2', x1: 170, y1: 112, x2: 220, y2: 112, style: 'path' },
    { kind: 'box', key: 'jg', placeId: 'jg', lines: ['중궁전'], note: '(북)', cx: 160, cy: 30, w: 108, h: 32 },
    { kind: 'box', key: 'sg', placeId: 'sg', lines: ['서고(외전)'], cx: 50, cy: 112, w: 92, h: 32 },
    { kind: 'gate', key: 'naemun', cx: 160, cy: 112 },
    { kind: 'text', key: 'naemun-label', text: '동궁 내문', x: 166, y: 138, anchor: 'start', size: 'sm' },
    { kind: 'box', key: 'dg', placeId: 'dg', lines: ['동궁전'], cx: 266, cy: 112, w: 92, h: 32 },
    // 동궁전 뒤 → 후원 쪽: 점선 + 빗장
    { kind: 'line', key: 'hyeopmun', x1: 292, y1: 128, x2: 292, y2: 146, style: 'shut' },
    { kind: 'gate', key: 'hyeopmun-gate', cx: 292, cy: 150, barred: true },
    { kind: 'text', key: 'hyeopmun-1', text: '후원 협문', x: 280, y: 160, anchor: 'end', size: 'sm' },
    { kind: 'text', key: 'hyeopmun-2', text: '(그 밤 안에서 빗장)', x: 280, y: 173, anchor: 'end', tone: 'muted', size: 'sm' },
    // 아래 줄(가로 길): 서쪽 ◀ 갈림길 ▶ 동쪽
    { kind: 'line', key: 'road', x1: 10, y1: 200, x2: 248, y2: 200, style: 'road' },
    { kind: 'text', key: 'west', text: '서쪽 ◀', x: 12, y: 192, anchor: 'start', size: 'sm' },
    { kind: 'text', key: 'fork', text: '갈림길', x: 160, y: 218, anchor: 'middle', size: 'sm' },
    { kind: 'text', key: 'east', text: '▶ 동쪽', x: 166, y: 192, anchor: 'start', size: 'sm' },
    // 동쪽: 큰길 ▶ 취향당(숙의 처소)
    { kind: 'text', key: 'keungil', text: '큰길 ▶', x: 208, y: 192, anchor: 'start', size: 'sm' },
    { kind: 'box', key: 'chwihyang', lines: ['취향당', '(숙의 처소)'], cx: 282, cy: 200, w: 64, h: 38 },
    // 큰길에서 비스듬히 갈라진 가는 길 끝 — 후원 연못
    { kind: 'line', key: 'lane', x1: 222, y1: 202, x2: 248, y2: 250, style: 'lane' },
    { kind: 'box', key: 'hw', placeId: 'hw', lines: ['후원 연못'], cx: 268, cy: 263, w: 88, h: 26 },
    { kind: 'text', key: 'lane-1', text: '큰길에서 비껴 남 —', x: 312, y: 292, anchor: 'end', tone: 'muted', size: 'sm' },
    { kind: 'text', key: 'lane-2', text: '들르려면 일부러 돌아가야 함', x: 312, y: 306, anchor: 'end', tone: 'muted', size: 'sm' },
    // 서쪽 끝 묶음
    { kind: 'line', key: 'west-branch', x1: 56, y1: 200, x2: 56, y2: 220, style: 'path' },
    { kind: 'fence', key: 'west-group', x: 6, y: 220, w: 116, h: 84, style: 'group' },
    { kind: 'box', key: 'ng', placeId: 'ng', lines: ['내관 처소'], cx: 64, cy: 236, w: 104, h: 22 },
    { kind: 'box', key: 'ny', placeId: 'ny', lines: ['내의원'], cx: 64, cy: 262, w: 104, h: 22 },
    { kind: 'box', key: 'sr', placeId: 'sr', lines: ['수라간·생과방'], cx: 64, cy: 288, w: 104, h: 22 },
  ],
};

/** ② 동궁전 확대(방위 표시 없음 — 원고 도식 순서 그대로) */
const DONGGUNG: PalaceMapDef = {
  key: 'donggung',
  title: '동궁전 확대',
  size: [320, 196],
  items: [
    { kind: 'text', key: 'back', text: '후원 협문(그 밤 안에서 빗장)', x: 160, y: 14, anchor: 'middle', size: 'sm' },
    { kind: 'line', key: 'back-line', x1: 160, y1: 19, x2: 160, y2: 30, style: 'shut' },
    { kind: 'fence', key: 'wall', x: 18, y: 36, w: 284, h: 86, style: 'wall' },
    { kind: 'gate', key: 'back-gate', cx: 160, cy: 36, barred: true },
    { kind: 'box', key: 'east-room', lines: ['동온돌', '(세자 침소)'], cx: 70, cy: 79, w: 84, h: 56 },
    { kind: 'box', key: 'hall', lines: ['대청'], cx: 160, cy: 79, w: 84, h: 56 },
    { kind: 'box', key: 'west-room', lines: ['서온돌', '(빈궁 처소)'], cx: 250, cy: 79, w: 84, h: 56 },
    // 울타리 바깥 — 선은 울타리에만 잇는다(특정 방에 잇지 않는다)
    { kind: 'gate', key: 'naemun', cx: 160, cy: 122 },
    { kind: 'line', key: 'naemun-line', x1: 160, y1: 132, x2: 160, y2: 144, style: 'path' },
    { kind: 'text', key: 'naemun-label', text: '내문 — 침전 출입은 여기 하나', x: 160, y: 158, anchor: 'middle', size: 'md' },
    { kind: 'text', key: 'library', text: '서고는 내문 밖', x: 160, y: 184, anchor: 'middle', tone: 'muted', size: 'sm' },
  ],
};

export const PALACE_MAPS: readonly PalaceMapDef[] = [PALACE, DONGGUNG];

/** 배치도 아래 주석(플레이어 뷰 2-1 주석 원문 그대로) */
export const PALACE_MAP_NOTE = '※ 동궁 침전을 드나드는 길은 내문 하나다. 서쪽(내관 처소·내의원)과 후원 연못은 갈림길에서 정반대 방향이다.';

/** 배치도의 모든 글자(라벨·주석) — 금지어 검사·수용 기준 테스트용 */
export function palaceMapTexts(): string[] {
  const out: string[] = [];
  for (const m of PALACE_MAPS) {
    out.push(m.title);
    for (const it of m.items) {
      if (it.kind === 'box') out.push(...it.lines, ...(it.note ? [it.note] : []));
      if (it.kind === 'text') out.push(it.text);
    }
  }
  out.push(PALACE_MAP_NOTE);
  return out;
}

// ─────────────────────────────── 호칭표 ───────────────────────────────

/** 술자리에서 헷갈리는 호칭 — 「누구 = 이렇게도 불림」. 별칭은 공개 텍스트에 실제로 나오는 표기만 */
export interface AliasRow {
  who: string;
  aliases: string[];
}

export const ALIAS_TABLE: readonly AliasRow[] = [
  { who: '세자', aliases: ['저하'] },
  { who: '세자빈 남씨', aliases: ['빈궁', '빈궁마마', '남씨'] },
  { who: '주상', aliases: ['전하', '상감마마', '부왕'] },
  { who: '중전 서씨', aliases: ['중전마마', '중궁'] },
  { who: '가원대군', aliases: ['대군'] },
  { who: '숙의 연씨', aliases: ['숙의마마', '연씨'] },
  { who: '상약 내관 오득구', aliases: ['오 내관', '내관님'] },
  { who: '어의 백인수', aliases: ['영감', '어의 영감'] },
  { who: '조상궁', aliases: ['빈궁전 지밀상궁'] },
];

export function aliasLine(row: AliasRow): string {
  return `${row.who} = ${row.aliases.join('·')}`;
}

// ─────────────────────────────── 인물록 ───────────────────────────────

export interface RosterPerson {
  /** 착석 자리(NPC 는 없음) */
  seat?: number;
  name: string;
  icon: RoleIconKey;
  subtitle?: string;
  profile: string;
}

export interface Roster {
  seated: RosterPerson[];
  /** 4·5인 판의 NPC — 「이 자리에 없으나 증언을 남긴 이」. 6인이면 빈 배열 */
  absent: RosterPerson[];
}

/** 인원·배정만으로 정해지는 공개 인물록(자기소개 뒤에만 그린다 — 호출부가 rolesVisible 로 가린다) */
export function peopleRoster(c: GungCase, a: Assignment): Roster {
  const person = (id: string, seat?: number): RosterPerson | null => {
    const r = roleById(c, id);
    if (!r) return null;
    const o = r.byCount?.[a.n];
    return { seat, name: o?.name ?? r.name, icon: r.icon, subtitle: o?.subtitle ?? r.subtitle, profile: o?.profile ?? r.profile };
  };
  const seated = publicSeats(c, a)
    .map((s) => person(s.roleId, s.seat))
    .filter((p): p is RosterPerson => p !== null);
  const absent = a.npcs.map((id) => person(id)).filter((p): p is RosterPerson => p !== null);
  return { seated, absent };
}
