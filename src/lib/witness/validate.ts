/**
 * 사건 데이터 무결성 검사(정적) + 행동 경제 경로 탐색(동적, 실제 엔진으로 BFS).
 *
 * 정적(validateCase): 시스템 6-1 분량 상한 · 6-2 구조 수치 · 6-5 증거 쓰임(고아 금지, decoys 예외) · 6-6 공정성 규칙 ·
 *   3-2 진실 유형 · 참조 무결성 · 비용 규칙(2-1) · 핫스팟 간격(디자인 D10) · 의존 그래프 DAG.
 * 동적(analyzeEconomy): 유료 항목 14개의 부분집합을 층별 BFS. 무료 행동(추궁·정답 제시·무료 진입·무료 핫스팟)은
 *   단조(얻기만 하고 잃지 않음)라 '그 집합에서 할 수 있는 무료 행동 전부'(closure)로 접는다 → 상태 = 유료 항목 집합.
 *   단, 행동이 0이 되는 마지막(12번째) 행동은 순서가 결과를 바꾸므로(사이렌 규칙) 따로 펼쳐 본다.
 */
import { CASE } from './case-data';
import {
  STAR_TOTAL,
  canAccuse,
  halfCards,
  continueAfterSiren,
  enterLocation,
  evalCond,
  examine,
  exit,
  getBreak,
  getEvidence,
  newRun,
  openSet,
  present,
  press,
  stars,
  type RunCore,
  type RunState,
} from './engine';
import type { Break, CaseFile, Cond, Dialogue, Id, Slot, SuspectId } from './types';
import { SLOTS } from './types';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

export const LIMITS = {
  line: 45,
  name: 12,
  setLines: 6,
  intro: 3,
  outro: 2,
  press: 3,
  reaction: 4,
  hotspotLines: 3,
  half: 3,
  redirectSay: 3,
  /** v3: 8 → 10 (R-09 동기 연결 · R-10 자기모순 장치) */
  redirectMax: 10,
  /** v3: 반쪽 카드(정답 세트 밖의 half 키) 사건당 상한 */
  halfCardMax: 6,
  detail: 3,
  endingLines: 10,
  introCuts: 8,
  cutLines: 3,
  totalLines: 60,
  totalText: 15000,
} as const;

const len = (s: string): number => [...s].length;

// ─────────────────────────────── 텍스트 총량 ───────────────────────────────

/** 플레이어가 화면에서 볼 수 있는 모든 사건 텍스트(내부 role·id 제외) */
export function playerTexts(c: CaseFile): string[] {
  const out: string[] = [];
  const dl = (ds: Dialogue[] | undefined) => ds?.forEach((x) => out.push(x.text));
  c.intro.forEach((cut) => dl(cut.lines));
  out.push(...c.rules);
  out.push(c.cutIns.press, c.cutIns.present, c.cutIns.break);
  for (const p of c.profiles) {
    out.push(p.name, ...p.summary);
    if (p.secretLine) out.push(p.secretLine);
  }
  for (const e of c.evidence) out.push(e.name, e.summary, ...e.detail, e.missHint);
  for (const l of c.locations) {
    out.push(l.name, l.look, l.scene);
    if (l.lockedLabel) out.push(l.lockedLabel);
    for (const h of l.hotspots) {
      out.push(h.label);
      if (h.preNote) out.push(h.preNote);
      dl(h.lines);
    }
  }
  for (const s of c.sets) {
    out.push(s.title);
    dl(s.intro);
    dl(s.outro);
    for (const ln of s.lines) {
      out.push(ln.text);
      dl(ln.press.lines);
      if (ln.press.question) out.push(ln.press.question.text);
      if (ln.press.question?.answer) out.push(ln.press.question.answer);
      if (ln.redirect) dl(ln.redirect.say);
      for (const b of ln.breaks ?? []) {
        dl(b.reaction);
        if (b.revisedText) out.push(b.revisedText);
        out.push(b.explain, b.hintTopic);
        if (b.half) Array.isArray(b.half) ? dl(b.half) : Object.values(b.half).forEach((x) => dl(x));
      }
    }
  }
  for (const w of c.solution.accuseWarn ?? []) dl(w.lines);
  for (const pool of Object.values(c.wrongReactions)) out.push(...(pool ?? []));
  out.push(...Object.values(c.copTrustLines));
  for (const e of Object.values(c.endings)) if (e) out.push(e.title, ...e.lines.map((x) => x.text));
  dl(c.easterEgg);
  const v = c.verdict;
  out.push(v.call.text);
  for (const k of SLOTS) {
    dl(v[k].ok);
    dl(v[k].ng);
  }
  for (const x of Object.values(v.opportunity.byCard ?? {})) dl(x);
  out.push(...Object.values(c.titles));
  const cp = c.copy;
  out.push(cp.half.text, cp.already.text, cp.wrongMonologue.text, cp.hintLead, ...cp.hintBreakable, cp.hintPlace, cp.hintRevisit, cp.hintAsk, cp.hintPress, cp.hintDone);
  return out;
}

export function textBudget(c: CaseFile = CASE): number {
  return playerTexts(c).reduce((a, s) => a + len(s), 0);
}

// ─────────────────────────────── 통계 ───────────────────────────────

export interface CaseStats {
  locations: number;
  hotspots: number;
  precise: number;
  evidence: number;
  upgrades: number;
  profiles: number;
  sets: number;
  lines: number;
  breaks: number;
  stars: number;
  minors: number;
  combos: number;
  comboStars: number;
  multiUse: number;
  herrings: number;
  questions: number;
  redirects: number;
  /** v3: 반쪽 카드 수(정답 세트 밖의 half 키) */
  halfCards: number;
  requires: number;
  text: number;
}

/** 정답·대체 정답 세트에 없는 half 키 = 반쪽 카드 */
function extraHalfCards(b: Break): Id[] {
  const answer = new Set([b.evidence, ...(b.accept ?? [])].flat());
  return halfCards(b).filter((k) => !answer.has(k));
}

function allBreaks(c: CaseFile) {
  return c.sets.flatMap((s) => s.lines.flatMap((l) => (l.breaks ?? []).map((b) => ({ b, l, s }))));
}

export function caseStats(c: CaseFile = CASE): CaseStats {
  const bs = allBreaks(c);
  const lines = c.sets.flatMap((s) => s.lines);
  const useCount = new Map<Id, Set<Id>>();
  for (const { b } of bs)
    for (const set of [b.evidence, ...(b.accept ?? [])])
      for (const card of set) {
        if (!c.evidence.some((e) => e.id === card)) continue;
        if (!useCount.has(card)) useCount.set(card, new Set());
        useCount.get(card)!.add(b.id);
      }
  return {
    locations: c.locations.length,
    hotspots: c.locations.reduce((a, l) => a + l.hotspots.length, 0),
    precise: c.locations.reduce((a, l) => a + l.hotspots.filter((h) => h.precise).length, 0),
    evidence: c.evidence.filter((e) => !e.upgradeOf).length,
    upgrades: c.evidence.filter((e) => e.upgradeOf).length,
    profiles: c.profiles.length,
    sets: c.sets.length,
    lines: lines.length,
    breaks: bs.length,
    stars: bs.filter((x) => x.b.tier === 'star').length,
    minors: bs.filter((x) => x.b.tier === 'minor').length,
    combos: bs.filter((x) => x.b.evidence.length === 2).length,
    comboStars: bs.filter((x) => x.b.evidence.length === 2 && x.b.tier === 'star').length,
    multiUse: [...useCount.values()].filter((s) => s.size >= 2).length,
    herrings: c.evidence.filter((e) => e.role.includes('herring')).length,
    questions: lines.filter((l) => l.press.question).length,
    redirects: lines.filter((l) => l.redirect).length,
    halfCards: bs.reduce((a, x) => a + extraHalfCards(x.b).length, 0),
    requires: bs.filter((x) => x.b.requires).length,
    text: textBudget(c),
  };
}

// ─────────────────────────────── 정적 검사 ───────────────────────────────

function condRefs(c: Cond | undefined, out: { kind: string; id: Id }[] = []): { kind: string; id: Id }[] {
  if (!c) return out;
  if ('all' in c) c.all.forEach((x) => condRefs(x, out));
  else if ('any' in c) c.any.forEach((x) => condRefs(x, out));
  else if ('not' in c) condRefs(c.not, out);
  else if ('broken' in c) out.push({ kind: 'broken', id: c.broken });
  else if ('hasEvidence' in c) out.push({ kind: 'hasEvidence', id: c.hasEvidence });
  else if ('flag' in c) out.push({ kind: 'flag', id: c.flag });
  else out.push({ kind: 'visited', id: c.visited });
  return out;
}

export function validateCase(c: CaseFile = CASE): Issue[] {
  const out: Issue[] = [];
  const err = (where: string, msg: string) => out.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => out.push({ level: 'warn', where, msg });
  const text = (where: string, s: string, max: number = LIMITS.line) => {
    if (!s || !s.trim()) err(where, '빈 문자열');
    else if (len(s) > max) err(where, `${len(s)}자 > ${max}자: "${s}"`);
  };
  const dls = (where: string, ds: Dialogue[], max: number) => {
    if (ds.length > max) err(where, `${ds.length}줄 > ${max}줄`);
    ds.forEach((x, i) => {
      text(`${where}[${i}]`, x.text);
      if (x.who === 'DEV' && !x.label) err(`${where}[${i}]`, "'DEV' 화자는 label 필요");
    });
  };

  // ── id 색인 ──
  const evIds = new Set<Id>();
  for (const e of c.evidence) {
    if (evIds.has(e.id)) err(`evidence ${e.id}`, 'id 중복');
    evIds.add(e.id);
  }
  const profileIds = new Set<Id>(c.profiles.map((p) => p.id));
  const cardIds = new Set<Id>([...evIds, ...profileIds]);
  const locIds = new Set<Id>();
  const hsIds = new Set<Id>();
  for (const l of c.locations) {
    if (locIds.has(l.id)) err(`location ${l.id}`, 'id 중복');
    locIds.add(l.id);
    for (const h of l.hotspots) {
      if (hsIds.has(h.id)) err(`hotspot ${h.id}`, 'id 중복');
      hsIds.add(h.id);
    }
  }
  const setIds = new Set<Id>();
  const lineIds = new Set<Id>();
  const breakIds = new Set<Id>();
  const qIds = new Set<Id>();
  for (const s of c.sets) {
    if (setIds.has(s.id)) err(`set ${s.id}`, 'id 중복');
    setIds.add(s.id);
    for (const l of s.lines) {
      if (lineIds.has(l.id)) err(`line ${l.id}`, 'id 중복');
      lineIds.add(l.id);
      if (l.press.question) {
        if (qIds.has(l.press.question.id)) err(`question ${l.press.question.id}`, 'id 중복');
        qIds.add(l.press.question.id);
      }
      for (const b of l.breaks ?? []) {
        if (breakIds.has(b.id)) err(`break ${b.id}`, 'id 중복');
        breakIds.add(b.id);
      }
    }
  }
  const flagIds = new Set<Id>();
  for (const s of c.sets) for (const l of s.lines) if (l.press.flag) flagIds.add(l.press.flag);
  for (const { b } of allBreaks(c)) for (const u of b.unlocks) if ('flag' in u) flagIds.add(u.flag);

  const checkCond = (where: string, cond: Cond | undefined) => {
    for (const r of condRefs(cond)) {
      const okRef =
        (r.kind === 'broken' && breakIds.has(r.id)) ||
        (r.kind === 'hasEvidence' && evIds.has(r.id)) ||
        (r.kind === 'flag' && flagIds.has(r.id)) ||
        (r.kind === 'visited' && (locIds.has(r.id) || hsIds.has(r.id)));
      if (!okRef) err(where, `조건이 없는 ${r.kind} "${r.id}" 를 가리킴`);
    }
  };

  // ── 프로필 ──
  for (const want of ['VICTIM', 'S1', 'S2', 'S3', 'S4', 'AI']) if (!profileIds.has(want)) err('profiles', `${want} 프로필 없음`);
  for (const p of c.profiles) {
    if (p.summary.length > 3) err(`profile ${p.id}`, '요약 3줄 초과');
    p.summary.forEach((s, i) => text(`profile ${p.id}.summary[${i}]`, s));
    if (p.secretLine) text(`profile ${p.id}.secretLine`, p.secretLine);
  }

  // ── 증거 ──
  const gives = new Map<Id, string[]>();
  const addGive = (id: Id, src: string) => gives.set(id, [...(gives.get(id) ?? []), src]);
  for (const l of c.locations) for (const h of l.hotspots) for (const g of h.gives ?? []) addGive(g, `hotspot ${h.id}`);
  for (const s of c.sets) for (const l of s.lines) if (l.press.gives) addGive(l.press.gives, `press ${l.id}`);
  for (const { b } of allBreaks(c))
    for (const u of b.unlocks) {
      if ('evidence' in u) addGive(u.evidence, `break ${b.id}`);
      if ('upgrade' in u) addGive(u.upgrade[1], `break ${b.id}`);
    }
  for (const e of c.evidence) {
    const w = `evidence ${e.id}`;
    text(`${w}.name`, e.name, LIMITS.name);
    text(`${w}.summary`, e.summary);
    if (e.detail.length > LIMITS.detail) err(w, `상세 ${e.detail.length}줄 > 3`);
    e.detail.forEach((d, i) => text(`${w}.detail[${i}]`, d));
    text(`${w}.missHint`, e.missHint);
    if (e.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time)) err(w, `time 형식 ${e.time}`);
    if (e.reliability && e.kind !== 'log') warn(w, `reliability 는 log 전용(시스템 3-3) — kind=${e.kind}`);
    const srcs = gives.get(e.id) ?? [];
    if (srcs.length !== 1) err(w, `출처가 ${srcs.length}곳 (${srcs.join(', ') || '없음'}) — 정확히 1곳이어야`);
    const f = e.from;
    if (f === 'start') {
      /* 시작 지급 */
    } else if ('location' in f) {
      const loc = c.locations.find((l) => l.id === f.location);
      const h = loc?.hotspots.find((x) => x.id === f.hotspot);
      if (!h || !(h.gives ?? []).includes(e.id)) err(w, `from 핫스팟 ${f.location}/${f.hotspot} 가 이 증거를 주지 않음`);
    } else if ('press' in f) {
      const ln = c.sets.flatMap((s) => s.lines).find((l) => l.id === f.press);
      if (!ln || ln.press.gives !== e.id) err(w, `from 추궁 ${f.press} 가 이 증거를 주지 않음`);
    } else {
      const br = allBreaks(c).find((x) => x.b.id === f.break);
      const gave = br?.b.unlocks.some((u) => ('evidence' in u && u.evidence === e.id) || ('upgrade' in u && u.upgrade[1] === e.id));
      if (!gave) err(w, `from 돌파 ${f.break} 가 이 증거를 주지 않음`);
    }
    if (e.upgradeOf) {
      // v3: 단계형 갱신 허용 — 사슬을 거슬러 올라가 원본(upgradeOf 없음)에 닿아야 하고 순환이 없어야 한다
      const seen = new Set<Id>([e.id]);
      let cur: Id | undefined = e.upgradeOf;
      let ok = false;
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const base = c.evidence.find((x) => x.id === cur);
        if (!base) break;
        if (!base.upgradeOf) {
          ok = true;
          break;
        }
        cur = base.upgradeOf;
      }
      if (!ok) err(w, `upgradeOf ${e.upgradeOf} 사슬이 원본 증거에 닿지 않음(없는 id 또는 순환)`);
      const siblings = c.evidence.filter((x) => x.upgradeOf === e.upgradeOf);
      if (siblings.length > 1) err(w, `${e.upgradeOf} 의 갱신본이 둘(${siblings.map((x) => x.id).join(', ')}) — 사슬은 한 줄기`);
      const up = allBreaks(c).some((x) => x.b.unlocks.some((u) => 'upgrade' in u && u.upgrade[0] === e.upgradeOf && u.upgrade[1] === e.id));
      if (!up) err(w, `갱신 [${e.upgradeOf} → ${e.id}] 해금이 없음`);
    }
  }

  // ── 장소·핫스팟 ──
  let precise = 0;
  for (const l of c.locations) {
    const w = `location ${l.id}`;
    checkCond(w, l.unlock);
    if (!l.initial && !l.unlock) err(w, '처음 잠긴 장소인데 unlock 없음');
    if (!l.initial && !l.lockedLabel) err(w, '잠김 문구(lockedLabel) 없음');
    if (l.lockedLabel) text(`${w}.lockedLabel`, l.lockedLabel);
    if (l.tutorial && l.cost !== 0) err(w, '튜토리얼 장소는 무료');
    if (!l.tutorial && l.cost !== 1) err(w, '장소 첫 진입 비용은 1(시스템 2-1)');
    if (l.hotspots.length < 3 || l.hotspots.length > 5) err(w, `핫스팟 ${l.hotspots.length}개 (3~5)`);
    for (const h of l.hotspots) {
      const hw = `hotspot ${h.id}`;
      dls(hw, h.lines, LIMITS.hotspotLines);
      checkCond(hw, h.unlock);
      for (const g of h.gives ?? []) if (!evIds.has(g)) err(hw, `없는 증거 ${g}`);
      if (h.flavor && h.gives?.length) err(hw, 'flavor 핫스팟이 증거를 줌');
      if (!h.flavor && !h.gives?.length) err(hw, '증거 없는 핫스팟은 flavor 로 표시');
      if (h.precise) {
        precise += 1;
        if (!h.preNote) err(hw, '정밀 조사에 preNote 없음(디자인 A2)');
        else text(`${hw}.preNote`, h.preNote);
      }
      if (h.x < 4 || h.x > 96 || h.y < 8 || h.y > 92) err(hw, `좌표 (${h.x},${h.y}) 가장자리 밖(x∈[4,96], y∈[8,92])`);
    }
    for (let i = 0; i < l.hotspots.length; i++)
      for (let j = i + 1; j < l.hotspots.length; j++) {
        const a = l.hotspots[i];
        const b = l.hotspots[j];
        const d = Math.sqrt((1.5 * (a.x - b.x)) ** 2 + (a.y - b.y) ** 2);
        if (d < 10) err(w, `핫스팟 간격 ${a.id}-${b.id} d=${d.toFixed(1)} < 10 (디자인 D10)`);
      }
  }
  if (precise !== 2) err('locations', `정밀 조사 ${precise}개 (시스템 6-2: 판 전체 2)`);

  // ── 증언 ──
  const suspects: SuspectId[] = ['S1', 'S2', 'S3', 'S4'];
  const liesBy = new Map<string, number>();
  const chainTargets = new Set<Id>();
  for (const { b } of allBreaks(c)) for (const u of b.unlocks) if ('set' in u && u.chain) chainTargets.add(u.set);
  let totalLines = 0;
  for (const s of c.sets) {
    const w = `set ${s.id}`;
    text(`${w}.title`, s.title);
    dls(`${w}.intro`, s.intro, LIMITS.intro);
    dls(`${w}.outro`, s.outro, LIMITS.outro);
    checkCond(w, s.unlock);
    if (!s.initial && !s.unlock) err(w, '잠긴 세트인데 unlock 없음');
    if (s.lines.length > LIMITS.setLines) err(w, `${s.lines.length}줄 > 6`);
    if (s.kind === 'confront' && s.speakers.length !== 2) err(w, '대질은 2인');
    // 비용 규칙(시스템 2-1 · 바이블 부록 A-2)
    const wantFree = s.kind === 'tutorial' || s.kind === 'confront' || chainTargets.has(s.id);
    if (wantFree && s.cost !== 0) err(w, '튜토리얼·대질·chain 세트는 무료');
    if (!wantFree && s.cost !== 1) err(w, '세트 첫 열람 비용은 1');
    totalLines += s.lines.length;
    const cardLine = new Map<Id, Id>();
    for (const l of s.lines) {
      const lw = `line ${l.id}`;
      text(lw, l.text);
      if (!l.id.startsWith(`${s.id}.`)) warn(lw, `줄 id 가 세트(${s.id}) 접두가 아님`);
      if (l.claimTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(l.claimTime)) err(lw, `claimTime 형식 ${l.claimTime}`);
      if (!s.speakers.includes(l.who)) err(lw, `화자 ${l.who} 가 세트 화자가 아님`);
      dls(`${lw}.press`, l.press.lines, LIMITS.press);
      if (l.press.gives && !evIds.has(l.press.gives)) err(lw, `추궁 증거 ${l.press.gives} 없음`);
      if (l.press.reveals) {
        const t = s.lines.find((x) => x.id === l.press.reveals);
        if (!t || !t.hidden) err(lw, `reveals ${l.press.reveals} 가 같은 세트의 숨은 줄이 아님`);
      }
      if (l.press.question) {
        text(`${lw}.question`, l.press.question.text);
        if (!l.press.question.resolvedBy.length) err(lw, '의문을 푸는 돌파·증거가 없음');
        for (const r of l.press.question.resolvedBy) if (!breakIds.has(r) && !evIds.has(r)) err(lw, `의문 해소 ${r} 가 돌파도 증거도 아님`);
        if (l.press.question.answer !== undefined) text(`${lw}.question.answer`, l.press.question.answer);
      }
      if (l.hidden && !s.lines.some((x) => x.press.reveals === l.id)) err(lw, '숨은 줄을 드러내는 추궁이 없음');
      // 진실 유형(시스템 3-2 · 6-4 · 6-6)
      const isAI = l.who === 'AI';
      if (isAI && !['record', 'inference', 'refusal'].includes(l.truth)) err(lw, `AI 줄은 record/inference/refusal 만 (${l.truth})`);
      if (!isAI && ['record', 'inference', 'refusal'].includes(l.truth)) err(lw, `사람 줄에 ${l.truth}`);
      if (l.forged && l.truth !== 'record') err(lw, 'forged 는 record 전용');
      const needsBreak = ['lie', 'mistaken', 'inference', 'refusal'].includes(l.truth) || (l.truth === 'record' && l.forged);
      const hasBreak = !!l.breaks?.length;
      if (needsBreak && !hasBreak) err(lw, `${l.truth}${l.forged ? '(forged)' : ''} 줄인데 돌파 없음(6-6 2번)`);
      if (!needsBreak && hasBreak) err(lw, `${l.truth} 줄에 돌파가 있음(6-6 3번)`);
      if (l.truth === 'lie') liesBy.set(l.who, (liesBy.get(l.who) ?? 0) + 1);
      // 우회
      if (l.redirect) {
        const r = l.redirect;
        if (r.cards.length < 1 || r.cards.length > 2) err(lw, `우회 카드 ${r.cards.length}장 (1~2)`);
        for (const card of r.cards) if (!cardIds.has(card)) err(lw, `우회 카드 ${card} 없음`);
        const correct = new Set((l.breaks ?? []).flatMap((b) => [b.evidence, ...(b.accept ?? [])].flat()));
        for (const card of r.cards) if (correct.has(card)) err(lw, `우회 카드 ${card} 가 이 줄의 정답 카드`);
        const halves = new Set((l.breaks ?? []).flatMap((b) => halfCards(b)));
        for (const card of r.cards) if (halves.has(card)) err(lw, `우회 카드 ${card} 가 이 줄의 반쪽 카드(HALF 에 가려 우회가 죽는다)`);
        dls(`${lw}.redirect`, r.say, LIMITS.redirectSay);
      }
      // 돌파
      for (const b of l.breaks ?? []) {
        const bw = `break ${b.id}`;
        dls(`${bw}.reaction`, b.reaction, LIMITS.reaction);
        text(`${bw}.explain`, b.explain);
        // v3: 깨진 줄 카드의 「정정」 칸이 비지 않게(C06 권한 해제가 빈 칸으로 보이던 버그)
        if (b.revisedText === undefined) err(bw, 'revisedText(깨진 뒤 진술) 없음');
        else text(`${bw}.revisedText`, b.revisedText);
        for (const k of halfCards(b)) if (!cardIds.has(k)) err(bw, `half 키 ${k} 가 카드가 아님`);
        if (!b.hintTopic || len(b.hintTopic) > 6) err(bw, `hintTopic "${b.hintTopic}"(1~2어)`);
        checkCond(bw, b.requires);
        if (b.type === 'permission' && l.truth !== 'refusal') err(bw, 'permission 돌파는 refusal 줄에만');
        if (l.truth === 'refusal' && b.type !== 'permission') err(bw, 'refusal 줄 돌파는 permission');
        const alts = [b.evidence, ...(b.accept ?? [])];
        for (const a of alts) {
          if (a.length < 1 || a.length > 2 || new Set(a).size !== a.length) err(bw, `카드 세트 [${a.join(',')}] 형식`);
          for (const card of a) if (!cardIds.has(card)) err(bw, `없는 카드 ${card}`);
        }
        if (b.evidence.length === 2) {
          // 6-6 5번: 조합의 각 카드는 혼자서 깨지지 않고 half 대사가 있다
          for (const card of b.evidence) {
            if (alts.some((a) => a.length === 1 && a[0] === card)) err(bw, `조합 카드 ${card} 가 단독 정답에도 있음`);
            const h = b.half;
            if (!h || (!Array.isArray(h) && !h[card])) err(bw, `조합 카드 ${card} 단독 HALF 대사 없음`);
          }
          const srcs = b.evidence.map((card) => {
            const e = c.evidence.find((x) => x.id === card);
            return e ? JSON.stringify(e.from) : card;
          });
          if (srcs[0] === srcs[1]) warn(bw, '조합 두 장의 출처가 같음(6-2 권장: 출처 다르게)');
        }
        if (b.requires && b.half && !Array.isArray(b.half) && !b.half.requires) warn(bw, 'requires 미충족 HALF 대사 없음');
        if (b.half) {
          const hs = Array.isArray(b.half) ? [b.half] : Object.values(b.half);
          hs.forEach((x, i) => x && dls(`${bw}.half[${i}]`, x, LIMITS.half));
        }
        for (const u of b.unlocks) {
          if ('set' in u) {
            const t = c.sets.find((x) => x.id === u.set);
            if (!t) err(bw, `해금 세트 ${u.set} 없음`);
            else if (!condRefs(t.unlock).some((r) => r.kind === 'broken' && r.id === b.id)) err(bw, `해금 세트 ${u.set} 의 unlock 이 이 돌파를 보지 않음`);
          } else if ('location' in u) {
            const t = c.locations.find((x) => x.id === u.location);
            if (!t) err(bw, `해금 장소 ${u.location} 없음`);
            else if (!condRefs(t.unlock).some((r) => r.kind === 'broken' && r.id === b.id)) err(bw, `해금 장소 ${u.location} 의 unlock 이 이 돌파를 보지 않음`);
          } else if ('hotspot' in u) {
            if (!hsIds.has(u.hotspot)) err(bw, `해금 핫스팟 ${u.hotspot} 없음`);
          } else if ('evidence' in u) {
            if (!evIds.has(u.evidence)) err(bw, `해금 증거 ${u.evidence} 없음`);
          } else if ('upgrade' in u) {
            if (!evIds.has(u.upgrade[0]) || !evIds.has(u.upgrade[1])) err(bw, `갱신 ${u.upgrade.join('→')} 증거 없음`);
          } else if ('secret' in u) {
            if (!suspects.includes(u.secret)) err(bw, `비밀 ${u.secret} 은 용의자가 아님`);
          }
        }
        // 6-6 4번: 같은 세트에서 한 카드로 두 줄을 깨지 않는다
        for (const card of new Set(alts.flat())) {
          const prev = cardLine.get(card);
          if (prev && prev !== l.id) err(w, `카드 ${card} 가 같은 세트의 두 줄(${prev}, ${l.id})을 깸(6-6 4번)`);
          cardLine.set(card, l.id);
        }
      }
    }
  }
  if (totalLines > LIMITS.totalLines) err('sets', `증언 줄 총 ${totalLines} > 60`);
  for (const s of suspects) if (!liesBy.get(s)) err('sets', `${s} 의 lie 줄이 없음(6-3)`);

  // ── 해금 그래프 DAG(세트·장소의 unlock 이 자기 안의 돌파에 기대지 않는가 + 순환 없음) ──
  {
    const deps = new Map<Id, Id[]>();
    const breakSet = new Map<Id, Id>();
    for (const { b, s } of allBreaks(c)) breakSet.set(b.id, s.id);
    for (const s of c.sets) deps.set(`set:${s.id}`, condRefs(s.unlock).filter((r) => r.kind === 'broken').map((r) => `set:${breakSet.get(r.id)}`));
    for (const l of c.locations)
      deps.set(`loc:${l.id}`, condRefs(l.unlock).filter((r) => r.kind === 'broken').map((r) => `set:${breakSet.get(r.id)}`));
    const state = new Map<Id, 1 | 2>();
    const visit = (n: Id, path: Id[]): void => {
      if (state.get(n) === 2) return;
      if (state.get(n) === 1) {
        err('graph', `해금 순환: ${[...path, n].join(' → ')}`);
        return;
      }
      state.set(n, 1);
      for (const m of deps.get(n) ?? []) visit(m, [...path, n]);
      state.set(n, 2);
    };
    for (const n of deps.keys()) visit(n, []);
  }

  // ── 구조 수치(시스템 6-2) ──
  const st = caseStats(c);
  const range = (where: string, v: number, lo: number, hi: number) => {
    if (v < lo || v > hi) err('structure', `${where} ${v} (기대 ${lo}~${hi})`);
  };
  range('장소', st.locations, 6, 7);
  range('증거', st.evidence, 17, 19);
  range('갱신 카드', st.upgrades, 2, 3);
  range('프로필', st.profiles, 6, 6);
  range('증언 세트', st.sets, 11, 12);
  range('모순', st.breaks, 12, 15);
  range('★', st.stars, 5, 7);
  range('◆', st.minors, 6, 8);
  range('조합 모순', st.combos, 2, 99);
  range('조합 ★', st.comboStars, 1, 99);
  range('여러 곳에 쓰이는 증거', st.multiUse, 3, 99);
  range('레드헤링', st.herrings, 2, 99);
  range('미해결 의문', st.questions, 6, 10);
  range('우회', st.redirects, 0, LIMITS.redirectMax);
  range('반쪽 카드', st.halfCards, 0, LIMITS.halfCardMax);
  if (st.text > LIMITS.totalText) err('text', `텍스트 총량 ${st.text}자 > ${LIMITS.totalText}`);

  // ── 최종 판정 ──
  const sol = c.solution;
  if (!suspects.includes(sol.culprit)) err('solution', '범인이 용의자가 아님');
  checkCond('solution.hiddenEnding', sol.hiddenEnding);
  (sol.accuseWarn ?? []).forEach((w, i) => {
    checkCond(`solution.accuseWarn[${i}]`, w.when);
    dls(`solution.accuseWarn[${i}]`, w.lines, 2);
  });
  for (const slot of SLOTS) {
    const acc = sol.accept[slot];
    if (acc.length < 1 || acc.length > 2) err('solution', `${slot} 정답 ${acc.length}개 (1~2)`);
    for (const id of acc) if (!evIds.has(id)) err('solution', `${slot} 정답 ${id} 가 증거가 아님(프로필 불가)`);
    for (const id of sol.decoys?.[slot] ?? []) {
      if (!evIds.has(id)) err('solution.decoys', `${slot} 미끼 ${id} 없음`);
      if (acc.includes(id)) err('solution.decoys', `${slot} 미끼 ${id} 가 정답`);
    }
  }
  for (const id of sol.accept.opportunity) {
    const e = c.evidence.find((x) => x.id === id);
    if (!e?.upgradeOf || e.reliability !== 'forged') err('solution', `기회 정답 ${id} 는 갱신된 위조 로그여야 함(시스템 3-6)`);
  }

  // ── 고아 증거(돌파·최종 칸·해금 중 하나 — decoys 는 '최종 칸 미끼'로 인정) ──
  const used = new Set<Id>();
  for (const { b } of allBreaks(c)) for (const a of [b.evidence, ...(b.accept ?? [])]) a.forEach((x) => used.add(x));
  for (const slot of SLOTS) {
    sol.accept[slot].forEach((x) => used.add(x));
    (sol.decoys?.[slot] ?? []).forEach((x) => used.add(x));
  }
  for (const e of c.evidence) if (e.upgradeOf) used.add(e.upgradeOf);
  for (const e of c.evidence) if (!used.has(e.id)) err(`evidence ${e.id}`, '고아 증거(돌파·최종 칸·해금 어디에도 안 쓰임)');

  // ── 기타 텍스트 ──
  if (c.intro.length > LIMITS.introCuts) err('intro', `${c.intro.length}컷 > 8`);
  c.intro.forEach((cut, i) => dls(`intro[${i}]`, cut.lines, LIMITS.cutLines));
  for (const [who, pool] of Object.entries(c.wrongReactions)) {
    if (!pool || pool.length !== 3) err(`wrongReactions ${who}`, '인물당 3종');
    pool?.forEach((s, i) => text(`wrongReactions ${who}[${i}]`, s));
  }
  for (const who of [...suspects, 'AI'] as const) if (!c.wrongReactions[who]) err('wrongReactions', `${who} 없음`);
  Object.entries(c.copTrustLines).forEach(([k, s]) => text(`copTrustLines ${k}`, s));
  const endingIds = ['perfect', 'hidden', 'short', ...suspects.filter((s) => s !== sol.culprit).map((s) => `wrong-${s}`), 'timeout', 'excluded'];
  for (const id of endingIds) {
    const e = c.endings[id as keyof typeof c.endings];
    if (!e) {
      err('endings', `${id} 엔딩 없음`);
      continue;
    }
    text(`ending ${id}.title`, e.title);
    dls(`ending ${id}`, e.lines, LIMITS.endingLines);
  }
  dls('easterEgg', c.easterEgg, 3);
  for (const id of c.hintRoute) if (!breakIds.has(id)) err('hintRoute', `없는 돌파 ${id}`);
  return out;
}

// ─────────────────────────────── 동적: 경로 탐색 ───────────────────────────────

export interface PaidItem {
  key: string;
  kind: 'location' | 'set' | 'precise';
  id: Id;
}

/** 돈(행동)이 드는 항목 전부 — 장소 첫 진입·세트 첫 열람·정밀 조사 */
export function paidItems(c: CaseFile = CASE): PaidItem[] {
  const items: PaidItem[] = [];
  for (const l of c.locations) if (l.cost > 0) items.push({ key: l.id, kind: 'location', id: l.id });
  for (const s of c.sets) if (s.cost > 0) items.push({ key: s.id, kind: 'set', id: s.id });
  for (const l of c.locations) for (const h of l.hotspots) if (h.precise) items.push({ key: `P:${h.id}`, kind: 'precise', id: h.id });
  return items;
}

/** 유료 항목 하나를 실제 엔진으로 실행(실패하면 null) */
export function applyItem(run: RunState, item: PaidItem): RunState | null {
  if (item.kind === 'location') {
    if (run.visited.includes(item.id)) return null;
    const s = enterLocation(run, item.id);
    return s.error ? null : s.run;
  }
  if (item.kind === 'set') {
    if (run.opened.includes(item.id)) return null;
    const s = openSet(run, item.id);
    return s.error ? null : s.run;
  }
  if (run.visited.includes(item.id)) return null;
  const loc = CASE.locations.find((l) => l.hotspots.some((h) => h.id === item.id))!;
  let r = run;
  const e = enterLocation(r, loc.id);
  if (e.error || e.events.some((x) => x.t === 'spent')) return null;
  r = e.run;
  const s = examine(r, item.id);
  return s.error ? null : s.run;
}

/**
 * 무료로 할 수 있는 것 전부(완벽한 플레이어): 무료 장소·세트 진입, 보이는 일반 핫스팟 조사, 모든 줄 추궁,
 * 정답 카드 세트를 들고 있으면 제시. 사이렌 규칙은 엔진이 막는다. 끝나면 허브로 나간다(행동 0이면 사이렌).
 */
export function freeClosure(run: RunState): RunState {
  let r = run;
  let changed = true;
  while (changed) {
    changed = false;
    for (const l of CASE.locations) {
      if (l.cost === 0 && !r.visited.includes(l.id)) {
        const s = enterLocation(r, l.id);
        if (!s.error) {
          r = s.run;
          changed = true;
        }
      }
      if (!r.visited.includes(l.id)) continue;
      for (const h of l.hotspots) {
        if (h.precise || r.visited.includes(h.id)) continue;
        const s = examine(r, h.id);
        if (!s.error && s.run !== r) {
          r = s.run;
          changed = true;
        }
      }
    }
    for (const set of CASE.sets) {
      if (set.cost === 0 && !r.opened.includes(set.id)) {
        const s = openSet(r, set.id);
        if (!s.error) {
          r = s.run;
          changed = true;
        }
      }
      if (!r.opened.includes(set.id)) continue;
      for (const l of set.lines) {
        if (!r.pressed.includes(l.id)) {
          const s = press(r, l.id);
          if (!s.error) {
            r = s.run;
            changed = true;
          }
        }
        for (const b of l.breaks ?? []) {
          if (r.broken.includes(b.id)) continue;
          for (const alt of [b.evidence, ...(b.accept ?? [])]) {
            if (!alt.every((card) => r.evidence.includes(card) || CASE.profiles.some((p) => p.id === card))) continue;
            const s = present(r, l.id, alt);
            if (!s.error && s.events.some((x) => x.t === 'verdict' && x.kind === 'BREAK')) {
              r = s.run;
              changed = true;
              break;
            }
          }
        }
      }
    }
  }
  return exit(r).run;
}

export interface AccuseOptions {
  perfect: boolean;
  hidden: boolean;
  /** 범인 + 정확히 2칸 */
  b: boolean;
}

/** 지금 손에 든 증거로 가능한 최선(지목 게이트 포함) */
export function accuseOptions(run: RunCore): AccuseOptions {
  const none = { perfect: false, hidden: false, b: false };
  if (!(stars(run) >= 3) || run.phase === 'ended') return none;
  const held = run.evidence.filter((id) => getEvidence(id));
  const acc = CASE.solution.accept;
  const ok = (slot: Slot) => held.filter((id) => acc[slot].includes(id));
  const m = ok('means');
  const o = ok('opportunity');
  const v = ok('motive');
  let perfect = false;
  for (const a of m) for (const b of o) for (const d of v) if (new Set([a, b, d]).size === 3) perfect = true;
  let b = false;
  const pairs: [Slot, Slot, Slot][] = [
    ['means', 'opportunity', 'motive'],
    ['means', 'motive', 'opportunity'],
    ['opportunity', 'motive', 'means'],
  ];
  for (const [x, y, z] of pairs)
    for (const a of ok(x))
      for (const c2 of ok(y)) {
        if (a === c2) continue;
        if (held.some((h) => h !== a && h !== c2 && !acc[z].includes(h))) b = true;
      }
  return { perfect, hidden: perfect && evalCond(CASE.solution.hiddenEnding, run), b };
}

export interface LayerStat {
  k: number;
  states: number;
  perfect: number;
  hidden: number;
  allStars: number;
  sPerfect: number;
  star3: number;
  b: number;
}

export interface EconomyReport {
  items: string[];
  budget: number;
  layers: LayerStat[];
  minPerfect: number | null;
  minPerfectSets: string[][];
  /** 최단 완벽 경로들의 서로 다른 '첫 3수' 집합 */
  perfectFirst3: string[][];
  minAllStars: number | null;
  minStar3: number | null;
  /** 최단 ★3 상태들이 쓴 ★ 돌파의 재료 출처 수(최소값) — 6-6 11번 */
  star3MinSources: number;
  /** 최단 ★3 상태 중 ★ 돌파가 전부 범인 세트에서 나온 것이 있나 */
  star3CulpritOnly: boolean;
  minB: number | null;
  minHidden: number | null;
  /** S(★ 전부) + 숨은 엔딩 최단 — 마지막 행동 순서까지 펼쳐 계산 */
  minSHidden: number | null;
  reachable: number;
  /** 행동이 남았는데 할 수 있는 유료 행동도, 지목도 없는 상태 수(soft-lock) */
  stuck: number;
  /** 무제한 행동으로 다 했을 때 */
  full: { items: number; breaks: number; breakTotal: number; evidence: number; evidenceTotal: number; upgrades: number; hidden: boolean; perfect: boolean };
}

const bitsOf = (mask: number, items: PaidItem[]): string[] => items.filter((_, i) => mask & (1 << i)).map((x) => x.key);

/** 원본 또는 그 갱신 사슬(v3 단계형 포함)의 어느 카드든 손에 있나 */
function heldInChain(run: RunCore, id: Id, depth = 0): boolean {
  if (run.evidence.includes(id)) return true;
  const next = CASE.evidence.find((u) => u.upgradeOf === id);
  return !!next && depth < 8 && heldInChain(run, next.id, depth + 1);
}

function starSourceCount(run: RunCore): { sources: number; culpritOnly: boolean } {
  const origins = new Set<string>();
  let culpritOnly = true;
  for (const id of run.broken) {
    const ref = getBreak(id);
    if (!ref || ref.brk.tier !== 'star') continue;
    if (!ref.set.speakers.every((s) => s === CASE.solution.culprit)) culpritOnly = false;
    const alt = [ref.brk.evidence, ...(ref.brk.accept ?? [])].find((a) => a.every((card) => run.evidence.includes(card) || CASE.profiles.some((p) => p.id === card)));
    for (const card of alt ?? ref.brk.evidence) {
      const e = getEvidence(card);
      if (!e) {
        origins.add(`profile:${card}`);
        continue;
      }
      const f = e.from;
      if (f === 'start') origins.add('start');
      else if ('location' in f) origins.add(`loc:${f.location}`);
      else if ('press' in f) origins.add(`set:${f.press.split('.')[0]}`);
      else origins.add(`set:${getBreak(f.break)?.set.id}`);
    }
  }
  return { sources: origins.size, culpritOnly };
}

/** 유료 항목 부분집합 BFS(예산 budget). 실제 엔진 + freeClosure */
export function analyzeEconomy(budget = 12): EconomyReport {
  const items = paidItems();
  const start = freeClosure(newRun());
  const layers: Map<number, RunState>[] = [new Map([[0, start]])];
  const stats: LayerStat[] = [];
  let stuck = 0;
  const statOf = (k: number, runs: Iterable<RunState>): LayerStat => {
    const s: LayerStat = { k, states: 0, perfect: 0, hidden: 0, allStars: 0, sPerfect: 0, star3: 0, b: 0 };
    for (const r of runs) {
      s.states += 1;
      const o = accuseOptions(r);
      const st = stars(r);
      if (o.perfect) s.perfect += 1;
      if (o.hidden) s.hidden += 1;
      if (st === STAR_TOTAL) s.allStars += 1;
      if (o.perfect && st === STAR_TOTAL) s.sPerfect += 1;
      if (st >= 3) s.star3 += 1;
      if (o.b) s.b += 1;
    }
    return s;
  };
  stats.push(statOf(0, [start]));
  let minSHidden: number | null = null;
  for (let k = 0; k < budget; k++) {
    const next = new Map<number, RunState>();
    const terminal: RunState[] = [];
    for (const [mask, run] of layers[k]) {
      let moves = 0;
      for (let i = 0; i < items.length; i++) {
        const bit = 1 << i;
        if (mask & bit) continue;
        const nm = mask | bit;
        const last = k + 1 === budget;
        const applied = applyItem(run, items[i]);
        if (!applied) continue;
        moves += 1;
        if (!last && next.has(nm)) continue;
        const closed = freeClosure(applied);
        if (last) terminal.push(closed);
        else next.set(nm, closed);
      }
      if (moves === 0 && run.actions > 0 && !canAccuse(run)) stuck += 1;
    }
    if (k + 1 === budget) {
      // 마지막 행동은 순서마다 결과가 달라 상태를 합치지 않는다
      const st = statOf(k + 1, terminal);
      stats.push(st);
      layers.push(new Map());
      if (minSHidden === null && terminal.some((r) => accuseOptions(r).hidden && stars(r) === STAR_TOTAL)) minSHidden = k + 1;
    } else {
      layers.push(next);
      const st = statOf(k + 1, next.values());
      stats.push(st);
      if (minSHidden === null && [...next.values()].some((r) => accuseOptions(r).hidden && stars(r) === STAR_TOTAL)) minSHidden = k + 1;
    }
  }
  const firstK = (pred: (s: LayerStat) => boolean) => stats.find(pred)?.k ?? null;
  const minPerfect = firstK((s) => s.perfect > 0);
  const minStar3 = firstK((s) => s.star3 > 0);
  const minPerfectSets: string[][] = [];
  const first3 = new Map<string, string[]>();
  if (minPerfect !== null && minPerfect < budget) {
    for (const [mask, r] of layers[minPerfect]) {
      if (!accuseOptions(r).perfect) continue;
      minPerfectSets.push(bitsOf(mask, items));
      // 이 집합 안의 도달 가능한 3-부분집합 = 서로 다른 첫 3수(단조성: 도달 가능한 접두사는 언제나 완주 가능)
      for (const m3 of layers[3].keys()) if ((m3 & mask) === m3) first3.set(String(m3), bitsOf(m3, items));
    }
  }
  let star3MinSources = Infinity;
  let star3CulpritOnly = false;
  if (minStar3 !== null && minStar3 < budget)
    for (const r of layers[minStar3].values()) {
      if (stars(r) < 3) continue;
      const s = starSourceCount(r);
      star3MinSources = Math.min(star3MinSources, s.sources);
      if (s.culpritOnly) star3CulpritOnly = true;
    }
  // 무제한 행동 — 전부 다 하기
  let full = freeClosure({ ...newRun(), actions: 99 });
  let done = 0;
  for (let guard = 0; guard < 50; guard++) {
    let progressed = false;
    for (const it of items) {
      const a = applyItem(full, it);
      if (a) {
        full = freeClosure(a);
        done += 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  const fo = accuseOptions(full);
  return {
    items: items.map((x) => x.key),
    budget,
    layers: stats,
    minPerfect,
    minPerfectSets,
    perfectFirst3: [...first3.values()],
    minAllStars: firstK((s) => s.allStars > 0),
    minStar3,
    star3MinSources: Number.isFinite(star3MinSources) ? star3MinSources : 0,
    star3CulpritOnly,
    minB: firstK((s) => s.b > 0),
    minHidden: firstK((s) => s.hidden > 0),
    minSHidden,
    reachable: layers.reduce((a, m) => a + m.size, 0),
    stuck,
    full: {
      items: done,
      breaks: full.broken.length,
      breakTotal: CASE.sets.reduce((a, s) => a + s.lines.reduce((b, l) => b + (l.breaks?.length ?? 0), 0), 0),
      evidence: CASE.evidence.filter((e) => !e.upgradeOf && heldInChain(full, e.id)).length,
      evidenceTotal: CASE.evidence.filter((e) => !e.upgradeOf).length,
      upgrades: CASE.evidence.filter((e) => e.upgradeOf && full.evidence.includes(e.id)).length,
      hidden: fo.hidden,
      perfect: fo.perfect,
    },
  };
}

/** 테스트·QA용: 유료 항목 키 순서대로 실행(각 단계 뒤 freeClosure). 실패한 키가 있으면 throw */
export function playPath(keys: string[], from: RunState = freeClosure(newRun())): RunState {
  const items = paidItems();
  let r = from;
  for (const k of keys) {
    const it = items.find((x) => x.key === k);
    if (!it) throw new Error(`unknown item ${k}`);
    const a = applyItem(r, it);
    if (!a) throw new Error(`item ${k} not available`);
    r = freeClosure(a);
  }
  return r;
}

/** 사이렌 뒤 처리까지(테스트용) */
export function afterSiren(run: RunState): RunState {
  return run.phase === 'siren' ? continueAfterSiren(run).run : run;
}

