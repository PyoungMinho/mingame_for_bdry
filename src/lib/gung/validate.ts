/**
 * 사건 데이터 무결성 검사 (순수 함수).
 *
 * 실제 사건(gung-case.md → case/*.ts)이 들어오면 테스트에서 validateCase(case) 에 error 가 0 이어야 한다.
 * error = 게임이 깨짐(배정 불가·빈 장소·없는 참조) / warn = UI 상한(§7-4) 초과·스포일러 위험.
 */
import { castFor, sortedRoles } from './assign';
import { cardsAtPlace } from './deck';
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLACE_ICON_KEYS,
  PLAYER_COUNTS,
  ROLE_ICON_KEYS,
  ROUND_NOS,
  type CardCondition,
  type GungCase,
  type TermId,
} from './types';

export interface CaseIssue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

/** 디자인 스펙 §7-4 상한(넘으면 warn) */
export const TEXT_LIMITS = {
  briefingChars: 1200,
  sectionChars: 260,
  nightLines: 8,
  nightLineChars: 36,
  crimeChars: 300,
  missionChars: 70,
  speechChars: 28,
  clueChars: 120,
  beatCount: 12,
  beatChars: 70,
  /** 현장 관찰 한 줄(원고 10-3 「40자 이내」 — 공백 포함) */
  observationChars: 40,
  /** 장소 그림 한 장의 물건 수(UX 스펙 §1-6 「장소당 최대 8개」) */
  sceneObjects: 8,
  /** 이동 한 줄(원고 10-2 「40자 이내」) */
  sceneCueChars: 40,
} as const;

export function validateCase(c: GungCase): CaseIssue[] {
  const out: CaseIssue[] = [];
  const err = (where: string, msg: string) => out.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => out.push({ level: 'warn', where, msg });
  const len = (s: string | undefined) => (s ?? '').replace(/\s/g, '').length;

  if (!c.id) err('case', 'id 없음');
  if (!Number.isInteger(c.version) || c.version < 1) err('case', `version ${c.version}`);
  if (!c.title) err('case', 'title 없음');

  // ── 용어
  const termIds = new Set<string>();
  for (const t of c.glossary ?? []) {
    if (termIds.has(t.id)) err(`glossary.${t.id}`, '용어 id 중복');
    termIds.add(t.id);
    if (!t.term || !t.desc) err(`glossary.${t.id}`, 'term/desc 비어 있음');
  }
  const checkTerms = (where: string, ids: TermId[] | undefined) => {
    for (const id of ids ?? []) if (!termIds.has(id)) err(where, `없는 용어 "${id}"`);
  };
  checkTerms('baseTerms', c.baseTerms);

  // ── 역할
  const roleIds = new Set<string>();
  const priorities = new Set<number>();
  for (const r of c.roles) {
    const w = `roles.${r.id}`;
    if (!r.id || r.id === 'self') err(w, `사용 불가 id "${r.id}"`);
    if (roleIds.has(r.id)) err(w, '역할 id 중복');
    roleIds.add(r.id);
    if (!Number.isInteger(r.priority) || r.priority < 1) err(w, `priority ${r.priority}`);
    if (priorities.has(r.priority)) err(w, `priority ${r.priority} 중복`);
    priorities.add(r.priority);
    if (!ROLE_ICON_KEYS.includes(r.icon)) err(w, `아이콘 키 "${r.icon}"`);
    if (!r.name) err(w, 'name 없음');
    if (!r.profile) err(w, 'profile(신분) 없음');
    if (!r.missions.length) warn(w, '개인 미션 없음');
    checkTerms(w, r.terms);
    for (const [k, v] of [
      ['profile', r.profile],
      ['motive', r.motive],
    ] as const) {
      if (len(v) > TEXT_LIMITS.sectionChars) warn(`${w}.${k}`, `${len(v)}자 > ${TEXT_LIMITS.sectionChars}`);
    }
    const secretLen = len(r.secrets.join(''));
    if (secretLen > TEXT_LIMITS.sectionChars * 2) warn(`${w}.secrets`, `${secretLen}자 — 꾹 누른 채 한 화면에 안 들어갈 수 있음(쪽 나눔 필요)`);
    // 라운드 잠금 블록 — 잠금 표식이 secrets 에 섞여 들어오면(옛 변환) 처음부터 보이므로 error
    for (const sec of r.secrets) if (/떠오르는 기억\)/.test(sec)) err(`${w}.secrets`, `라운드 잠금 블록이 secrets 에 섞임 — memories 로 옮길 것: "${sec.slice(0, 16)}…"`);
    (r.memories ?? []).forEach((m, i) => {
      const mw = `${w}.memories[${i}]`;
      if (!ROUND_NOS.includes(m.fromRound)) err(mw, `fromRound ${String(m.fromRound)}`);
      if (!m.heading) err(mw, 'heading 없음');
      if (!m.lines.length || m.lines.some((l) => !l.trim())) err(mw, '빈 줄/본문 없음');
      const ml = len(m.lines.join(''));
      if (ml > TEXT_LIMITS.sectionChars) warn(mw, `${ml}자 > ${TEXT_LIMITS.sectionChars}`);
    });
    if (r.night.length > TEXT_LIMITS.nightLines) warn(`${w}.night`, `${r.night.length}줄 > ${TEXT_LIMITS.nightLines}`);
    if (len(r.crime) > TEXT_LIMITS.crimeChars) warn(`${w}.crime`, `${len(r.crime)}자 > ${TEXT_LIMITS.crimeChars}`);
    for (const s of r.speech) if (len(s) > TEXT_LIMITS.speechChars) warn(`${w}.speech`, `"${s.slice(0, 12)}…" ${len(s)}자 > ${TEXT_LIMITS.speechChars}`);
    const mids = new Set<string>();
    for (const m of r.missions) {
      const mw = `${w}.missions.${m.id}`;
      if (mids.has(m.id)) err(mw, '미션 id 중복');
      mids.add(m.id);
      if (len(m.text) > TEXT_LIMITS.missionChars) warn(mw, `${len(m.text)}자 > ${TEXT_LIMITS.missionChars}`);
      const ck = m.check;
      if ((ck.kind === 'votesAtLeast' || ck.kind === 'votesAtMost' || ck.kind === 'notTopVoted') && ck.target !== 'self') {
        const t = c.roles.find((x) => x.id === ck.target);
        if (!t) err(mw, `없는 대상 역할 "${ck.target}"`);
        else if (t.priority > MIN_PLAYERS) warn(mw, `대상 "${ck.target}" 이(가) 4인 판에선 NPC — 표를 받을 수 없음`);
      }
      if (ck.kind === 'bonusCorrect' && !(c.bonusQuestions ?? []).some((q) => q.id === ck.questionId)) {
        err(mw, `없는 보너스 문항 "${ck.questionId}"`);
      }
    }
  }
  if (c.roles.length < MAX_PLAYERS) err('roles', `역할 ${c.roles.length}명 < ${MAX_PLAYERS}`);
  sortedRoles(c).forEach((r, i) => {
    if (r.priority !== i + 1) err(`roles.${r.id}`, `priority 가 1..${c.roles.length} 연속이 아님(${r.priority})`);
  });
  for (const n of PLAYER_COUNTS) {
    if (castFor(c, n).length !== n) err('roles', `${n}인 cast 가 ${castFor(c, n).length}명`);
  }

  // ── 범인
  const culprits = Array.isArray(c.culprit) ? c.culprit : [c.culprit];
  if (!culprits.length) err('culprit', '범인 없음');
  for (const id of culprits) {
    const r = c.roles.find((x) => x.id === id);
    if (!r) err('culprit', `없는 역할 "${id}"`);
    else {
      if (r.priority > MIN_PLAYERS) err('culprit', `범인 "${id}" priority ${r.priority} > ${MIN_PLAYERS} — 4인 판에서 NPC 가 됨`);
      if (!(r.crime || r.asCulprit?.crime)) err(`roles.${id}`, '범인 후보인데 crime(정체 본문) 없음');
    }
  }

  // ── 장소
  const placeIds = new Set<string>();
  for (const p of c.places) {
    if (placeIds.has(p.id)) err(`places.${p.id}`, '장소 id 중복');
    placeIds.add(p.id);
    if (!PLACE_ICON_KEYS.includes(p.icon)) err(`places.${p.id}`, `아이콘 키 "${p.icon}"`);
    if (!p.name) err(`places.${p.id}`, 'name 없음');
  }

  // ── 라운드·카드
  const cardIds = new Set<string>();
  const seeCard = (where: string, id: string, title: string, body: string) => {
    if (!id) err(where, '카드 id 없음');
    else if (cardIds.has(id)) err(where, `카드 id "${id}" 중복`);
    cardIds.add(id);
    if (!title || !body) err(where, `카드 "${id}" title/body 비어 있음`);
    if (len(body) > TEXT_LIMITS.clueChars) warn(where, `카드 "${id}" ${len(body)}자 > ${TEXT_LIMITS.clueChars}`);
  };
  const checkCond = (where: string, cond: CardCondition) => {
    for (const n of cond.forCount ?? []) if (!PLAYER_COUNTS.includes(n)) err(where, `forCount ${n}`);
    for (const id of [...(cond.onlyWhen?.players ?? []), ...(cond.onlyWhen?.npcs ?? [])]) {
      if (!roleIds.has(id)) err(where, `onlyWhen 없는 역할 "${id}"`);
    }
  };
  if (c.rounds.length !== 3) err('rounds', `라운드 ${c.rounds.length}개`);
  c.rounds.forEach((r, i) => {
    const w = `rounds[${i}]`;
    if (r.no !== i + 1) err(w, `no ${r.no} ≠ ${i + 1}`);
    if (!r.placeIds.length) err(w, '열린 장소 없음');
    if (new Set(r.placeIds).size !== r.placeIds.length) err(w, 'placeIds 중복');
    for (const pid of r.placeIds) if (!placeIds.has(pid)) err(w, `없는 장소 "${pid}"`);
    for (const pid of Object.keys(r.clues)) if (!r.placeIds.includes(pid)) warn(w, `clues["${pid}"] 는 열리지 않는 장소`);
    for (const [pid, cards] of Object.entries(r.clues)) {
      for (const card of cards) {
        seeCard(`${w}.clues.${pid}`, card.id, card.title, card.body);
        checkCond(`${w}.clues.${pid}.${card.id}`, card);
        checkTerms(`${w}.clues.${pid}.${card.id}`, card.terms);
      }
    }
    for (const card of r.publicCards ?? []) {
      seeCard(`${w}.publicCards`, card.id, card.title, card.body);
      checkCond(`${w}.publicCards.${card.id}`, card);
      checkTerms(`${w}.publicCards.${card.id}`, card.terms);
      // 출입 기록 — 눈금 밖 시각·없는 역할·카드 본문에 없는 줄이면 타임라인이 거짓을 그린다
      if (card.gateLog?.length && !c.gateAxis) err(`${w}.publicCards.${card.id}`, 'gateLog 가 있는데 gateAxis 없음');
      for (const e of card.gateLog ?? []) {
        const gw = `${w}.publicCards.${card.id}.gateLog`;
        const [wt, pt] = e.time.split(' ');
        if (c.gateAxis && (!c.gateAxis.watches.includes(wt) || !c.gateAxis.parts.includes(pt))) err(gw, `눈금 밖 시각 "${e.time}"`);
        if (!roleIds.has(e.roleId)) err(gw, `없는 역할 "${e.roleId}"`);
        if (e.dir !== 'in' && e.dir !== 'out') err(gw, `dir "${String(e.dir)}"`);
        if (!card.body.includes(`${e.time}:`) || !card.body.includes(e.who)) err(gw, `카드 본문에 없는 출입 "${e.time} ${e.who}"`);
      }
    }
    for (const card of r.npcCards ?? []) {
      seeCard(`${w}.npcCards`, card.id, card.title, card.body);
      checkTerms(`${w}.npcCards.${card.id}`, card.terms);
      const role = c.roles.find((x) => x.id === card.roleId);
      if (!role) err(`${w}.npcCards.${card.id}`, `없는 역할 "${card.roleId}"`);
      else if (role.priority <= MIN_PLAYERS) warn(`${w}.npcCards.${card.id}`, `"${card.roleId}" 는 늘 플레이어 — 이 NPC 카드는 영영 안 열림`);
    }
    if (r.no >= 1 && r.no <= 3) {
      for (const n of PLAYER_COUNTS) {
        for (const pid of r.placeIds) {
          if (!cardsAtPlace(c, n, r.no, pid).length) err(w, `${n}인 판 ${r.no}라운드 "${pid}" 에 보이는 카드가 없음`);
        }
      }
    }
  });

  // ── 브리핑·진상
  if (!c.briefing.paragraphs.length) err('briefing', '문단 없음');
  const bLen = c.briefing.paragraphs.reduce((s, p) => s + len(p), 0);
  if (bLen > TEXT_LIMITS.briefingChars) warn('briefing', `${bLen}자 > ${TEXT_LIMITS.briefingChars}`);
  if (!c.truth.beats.length) err('truth', '비트 없음');
  if (!c.truth.culpritLine || !c.truth.confession) err('truth', 'culpritLine/confession 없음');
  if (c.truth.beats.length > TEXT_LIMITS.beatCount) warn('truth', `비트 ${c.truth.beats.length}개 > ${TEXT_LIMITS.beatCount}`);
  for (const id of culprits) {
    const r = c.roles.find((x) => x.id === id);
    if (!r) continue;
    c.truth.beats.forEach((b, i) => {
      if (b.text.includes(r.name)) warn(`truth.beats[${i}]`, `범인 이름 "${r.name}" 이 '범인은…' 비트 전에 나옴(스포일러)`);
    });
  }

  // ── 현장(원고 7판 10장) — 이동(sceneRoute, 공용)·관찰(scenes, 살펴본 사람만). 조건 필드가 없다. 라운드 잠금은 fromRound 로만 건다
  const routeByRound = new Map<number, { placeId: string; examine: number }>();
  for (const r of c.sceneRoute ?? []) {
    const rw = `sceneRoute.R${String(r.round)}`;
    if (!ROUND_NOS.includes(r.round)) err(rw, `round ${String(r.round)}`);
    else if (routeByRound.has(r.round)) err(rw, '조사 중복');
    if (!placeIds.has(r.placeId)) err(rw, `없는 장소 "${r.placeId}"`);
    if (!Number.isInteger(r.examine) || r.examine < 1 || r.examine > 3) err(rw, `살펴보기 ${String(r.examine)} (1~3)`);
    if (!r.cue?.trim()) err(rw, '이동 한 줄 없음');
    else if (Array.from(r.cue).length > TEXT_LIMITS.sceneCueChars) warn(rw, `이동 한 줄 ${Array.from(r.cue).length}자 > ${TEXT_LIMITS.sceneCueChars}`);
    if (ROUND_NOS.includes(r.round)) routeByRound.set(r.round, { placeId: r.placeId, examine: r.examine });
  }
  const sceneIds = new Set<string>();
  const scenePlaces = new Set<string>();
  for (const sc of c.scenes ?? []) {
    const sw = `scenes.${sc.placeId}`;
    if (!placeIds.has(sc.placeId)) err(sw, `없는 장소 "${sc.placeId}"`);
    if (scenePlaces.has(sc.placeId)) err(sw, '장소 그림 중복');
    scenePlaces.add(sc.placeId);
    if (!sc.art) err(sw, '그림 키(art) 없음');
    if (!sc.objects.length) err(sw, '물건 없음');
    if (sc.objects.length > TEXT_LIMITS.sceneObjects) warn(sw, `물건 ${sc.objects.length}개 > ${TEXT_LIMITS.sceneObjects}`);
    for (const o of sc.objects) {
      const ow = `${sw}.${o.id}`;
      if (!o.id) err(sw, '물건 id 없음');
      else if (sceneIds.has(o.id) || cardIds.has(o.id)) err(ow, `id "${o.id}" 중복(물건·카드 통틀어)`);
      sceneIds.add(o.id);
      if (!o.name) err(ow, 'name 없음');
      const [x, y] = o.pos ?? [];
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) err(ow, `위치 ${JSON.stringify(o.pos)} (0~100 %)`);
      if (!o.lines.length) err(ow, '관찰 줄 없음');
      let prev = 0;
      for (const l of o.lines) {
        if (!ROUND_NOS.includes(l.fromRound)) err(ow, `fromRound ${String(l.fromRound)}`);
        else if (l.fromRound <= prev) err(ow, `fromRound ${l.fromRound} — 오름차순·라운드당 1줄이어야 함`);
        prev = l.fromRound;
        // 7판(원고 10-3): 그 줄 라운드의 이동 장소가 아닌 물건엔 그 라운드 줄이 없어야 한다(아무도 살펴볼 수 없는 줄)
        const stop = routeByRound.get(l.fromRound);
        if (c.sceneRoute && stop && stop.placeId !== sc.placeId) err(ow, `R${l.fromRound} 줄 — 그 조사 이동 장소(${stop.placeId})가 아님`);
        if (!l.text.trim()) err(ow, '빈 관찰 줄');
        const n = Array.from(l.text).length;
        if (n > TEXT_LIMITS.observationChars) warn(ow, `R${l.fromRound} 관찰 ${n}자 > ${TEXT_LIMITS.observationChars}`);
      }
    }
  }

  // 이동 장소마다 고를 거리(원고 10-2 검사 ⓓ: 그 조사까지 열린 줄이 있는 물건 수 > 살펴보기 수)
  for (const [round, stop] of routeByRound) {
    const objs = (c.scenes ?? []).find((sc) => sc.placeId === stop.placeId)?.objects ?? [];
    const n = objs.filter((o) => o.lines.some((l) => l.fromRound <= round)).length;
    if (n <= stop.examine) err(`sceneRoute.R${round}`, `살펴볼 물건 ${n}개 ≤ 살펴보기 ${stop.examine} — 고를 거리 없음`);
  }

  // ── 보너스 문항
  const qids = new Set<string>();
  for (const q of c.bonusQuestions ?? []) {
    if (qids.has(q.id)) err(`bonus.${q.id}`, '문항 id 중복');
    qids.add(q.id);
    if (q.options.length < 2) err(`bonus.${q.id}`, '보기 2개 미만');
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(`bonus.${q.id}`, `answer ${q.answer}`);
  }

  return out;
}

export function caseErrors(c: GungCase): CaseIssue[] {
  return validateCase(c).filter((i) => i.level === 'error');
}
