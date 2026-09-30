/**
 * 인생 2회차 — 콘텐츠 무결성 검사 (순수 함수).
 * validateStory(nodes, endings, data, startId): 구조·시간·매매 참조·도달성·플래그를 전부 본다.
 */
import { ASSET_IDS, ENGINE_FLAG_PATTERNS, SCENE_IDS } from './contract';
import type { Condition, Effect, Ending, MarketData, Para, StoryNode } from './types';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

const SCENES = new Set<string>(SCENE_IDS);
const ASSETS = new Set<string>(ASSET_IDS);
const DATE = /^(20[0-2]\d)-(0[1-9]|1[0-2])$/;
const LABEL_MAX = 30;
const MIN_CHOICES = 10;

function conds(c: Condition | undefined, where: string, out: Issue[]) {
  if (!c) return;
  for (const a of [...(c.holding ?? []), ...(c.noHolding ?? [])]) {
    if (!ASSETS.has(a)) out.push({ level: 'error', where, msg: `알 수 없는 자산 "${a}"` });
  }
}

function paras(ps: Para[], where: string, out: Issue[]) {
  if (!Array.isArray(ps) || !ps.length) {
    out.push({ level: 'error', where, msg: '문단이 비어 있음' });
    return;
  }
  if (!ps.some((p) => typeof p === 'string')) out.push({ level: 'warn', where, msg: '무조건 문단이 없음' });
  ps.forEach((p, i) => {
    if (typeof p === 'string') {
      if (!p.trim()) out.push({ level: 'error', where: `${where}[${i}]`, msg: '빈 문단' });
    } else conds(p.when, `${where}[${i}]`, out);
  });
}

function effects(e: Effect | undefined, node: StoryNode, where: string, data: MarketData, out: Issue[]) {
  if (!e) return;
  const year = Number(node.date.slice(0, 4));
  for (const t of e.trades ?? []) {
    if (!ASSETS.has(t.asset)) out.push({ level: 'error', where, msg: `알 수 없는 자산 "${t.asset}"` });
    if (!t.at) {
      out.push({ level: 'error', where, msg: `이야기 속 매매(${t.asset})는 at(사건 시세 id)이 필수` });
      continue;
    }
    const ev = data.events[t.at];
    if (!ev) {
      out.push({ level: 'error', where, msg: `없는 사건 시세 "${t.at}"` });
      continue;
    }
    if (!ev.prices[t.asset]) out.push({ level: 'error', where, msg: `사건 "${t.at}"에 ${t.asset} 가격이 없음` });
    if (Number(ev.date.slice(0, 4)) !== year) out.push({ level: 'error', where, msg: `사건 "${t.at}"(${ev.date})과 장면 연도(${year})가 다름` });
    if (t.kind === 'buy' && t.krw === undefined && t.pct === undefined) out.push({ level: 'error', where, msg: '매수에 krw 또는 pct 필요' });
    if (t.kind === 'buy' && t.pct !== undefined && !(t.pct > 0 && t.pct <= 1)) out.push({ level: 'error', where, msg: `pct ${t.pct}` });
    if (t.kind === 'sell' && !(t.pct > 0 && t.pct <= 1)) out.push({ level: 'error', where, msg: `pct ${t.pct}` });
  }
  for (const l of e.lose ?? []) {
    if (!ASSETS.has(l.asset) || !(l.pct > 0 && l.pct <= 1)) out.push({ level: 'error', where, msg: `lose ${l.asset} ${l.pct}` });
  }
  if (e.transfer && year < data.rules.adultYear) out.push({ level: 'error', where, msg: `명의 이전은 성년(${data.rules.adultYear}) 이후 장면에서만` });
  for (const k of ['trust', 'happy', 'health', 'sus'] as const) {
    const v = e[k];
    if (v !== undefined && Math.abs(v) > 50) out.push({ level: 'error', where, msg: `${k} ${v} (±50 초과)` });
  }
  if (e.income && !(e.income.perYear >= 0)) out.push({ level: 'error', where, msg: 'income.perYear 음수' });
}

export function validateNodes(nodes: Record<string, StoryNode>, data: MarketData): Issue[] {
  const out: Issue[] = [];
  const ids = new Set(Object.keys(nodes));
  for (const [key, n] of Object.entries(nodes)) {
    const w = `node ${key}`;
    if (n.id !== key) out.push({ level: 'error', where: w, msg: `키와 id 불일치 (${n.id})` });
    if (![1, 2, 3, 4, 5, 6, 7].includes(n.chapter)) out.push({ level: 'error', where: w, msg: `chapter ${n.chapter}` });
    if (!DATE.test(n.date) || n.date < '2000-01' || n.date > '2026-09') out.push({ level: 'error', where: w, msg: `date ${n.date}` });
    if (!SCENES.has(n.scene)) out.push({ level: 'error', where: w, msg: `알 수 없는 씬 "${n.scene}"` });
    if (!n.title?.trim()) out.push({ level: 'error', where: w, msg: '제목 없음' });
    paras(n.body, `${w}.body`, out);
    if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 4) {
      out.push({ level: 'error', where: w, msg: `선택지 ${n.choices?.length ?? 0}개 (2~4)` });
      continue;
    }
    if (n.choices.every((c) => c.requires)) out.push({ level: 'error', where: w, msg: '조건 없는 선택지가 최소 1개 필요' });
    const seen = new Set<string>();
    n.choices.forEach((c, ci) => {
      const cw = `${w}.${c.id ?? ci}`;
      if (seen.has(c.id)) out.push({ level: 'error', where: cw, msg: '중복 choice id' });
      seen.add(c.id);
      if (!c.label?.trim()) out.push({ level: 'error', where: cw, msg: '라벨 없음' });
      else if ([...c.label].length > LABEL_MAX) out.push({ level: 'warn', where: cw, msg: `라벨 ${[...c.label].length}자` });
      conds(c.requires, cw, out);
      if (!c.outcomes?.length) {
        out.push({ level: 'error', where: cw, msg: 'outcomes 없음' });
        return;
      }
      c.outcomes.forEach((o, oi) => {
        const ow = `${cw}.o${oi}`;
        const last = oi === c.outcomes.length - 1;
        if (last && (o.when || o.chance !== undefined)) out.push({ level: 'error', where: ow, msg: '마지막 outcome 은 무조건 폴백' });
        if (o.chance !== undefined && !(o.chance > 0 && o.chance < 1)) out.push({ level: 'error', where: ow, msg: `chance ${o.chance}` });
        conds(o.when, ow, out);
        effects(o.effects, n, ow, data, out);
        paras(o.result, `${ow}.result`, out);
        if (o.next === 'end') return;
        const t = nodes[o.next];
        if (!t) out.push({ level: 'error', where: ow, msg: `없는 다음 노드 "${o.next}"` });
        else if (t.date < n.date) out.push({ level: 'error', where: ow, msg: `시간 역행 ${n.date} → ${t.id}(${t.date})` });
      });
    });
  }
  void ids;
  return out;
}

export function validateStory(nodes: Record<string, StoryNode>, endings: Ending[], data: MarketData, startId: string): Issue[] {
  const out = validateNodes(nodes, data);
  if (!nodes[startId]) out.push({ level: 'error', where: 'start', msg: `시작 노드 "${startId}" 없음` });

  // 도달성 + 최소 깊이(조건 무시 최단 경로)
  const depth: Record<string, number> = { [startId]: 0 };
  const q = [startId];
  let minEnd = Infinity;
  while (q.length) {
    const id = q.shift()!;
    const n = nodes[id];
    if (!n) continue;
    for (const c of n.choices) {
      for (const o of c.outcomes) {
        if (o.next === 'end') minEnd = Math.min(minEnd, depth[id] + 1);
        else if (depth[o.next] === undefined && nodes[o.next]) {
          depth[o.next] = depth[id] + 1;
          q.push(o.next);
        }
      }
    }
  }
  for (const id of Object.keys(nodes)) if (depth[id] === undefined) out.push({ level: 'error', where: `node ${id}`, msg: '시작에서 도달 불가' });
  if (minEnd === Infinity) out.push({ level: 'error', where: 'graph', msg: '엔딩(end)으로 가는 길이 없음' });
  else if (minEnd < MIN_CHOICES) out.push({ level: 'error', where: 'graph', msg: `엔딩까지 최단 ${minEnd}선택 (<${MIN_CHOICES})` });

  // 모든 노드에서 end 에 닿을 수 있어야 한다(막다른 길·무한 루프 금지)
  const canEnd = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of Object.values(nodes)) {
      if (canEnd.has(n.id)) continue;
      if (n.choices.some((c) => c.outcomes.some((o) => o.next === 'end' || canEnd.has(o.next)))) {
        canEnd.add(n.id);
        changed = true;
      }
    }
  }
  for (const id of Object.keys(nodes)) if (!canEnd.has(id)) out.push({ level: 'error', where: `node ${id}`, msg: '여기서 엔딩까지 갈 수 없음' });

  // 플래그: 읽는 것은 어딘가에서 켜져야 한다(엔진 플래그 제외)
  const setF = new Set<string>();
  for (const n of Object.values(nodes)) for (const c of n.choices) for (const o of c.outcomes) o.effects?.setFlags?.forEach((f) => setF.add(f));
  const engineFlag = (f: string) => ENGINE_FLAG_PATTERNS.some((re) => re.test(f));
  const checkFlags = (c: Condition | undefined, where: string) => {
    for (const f of [...(c?.flags ?? []), ...(c?.noFlags ?? [])]) {
      if (!setF.has(f) && !engineFlag(f)) out.push({ level: 'error', where, msg: `플래그 "${f}" 를 읽지만 켜는 곳이 없음` });
    }
  };
  for (const n of Object.values(nodes)) {
    for (const p of n.body) if (typeof p !== 'string') checkFlags(p.when, `node ${n.id}`);
    for (const c of n.choices) {
      checkFlags(c.requires, `node ${n.id}.${c.id}`);
      for (const o of c.outcomes) {
        checkFlags(o.when, `node ${n.id}.${c.id}`);
        for (const p of o.result) if (typeof p !== 'string') checkFlags(p.when, `node ${n.id}.${c.id}`);
      }
    }
  }

  // 엔딩
  if (!endings.length) out.push({ level: 'error', where: 'endings', msg: '엔딩 없음' });
  const eids = new Set<string>();
  endings.forEach((e, i) => {
    const w = `ending ${e.id}`;
    if (eids.has(e.id)) out.push({ level: 'error', where: w, msg: '중복 id' });
    eids.add(e.id);
    if (!SCENES.has(e.scene)) out.push({ level: 'error', where: w, msg: `알 수 없는 씬 "${e.scene}"` });
    if (!e.title?.trim() || !e.epitaph?.trim()) out.push({ level: 'error', where: w, msg: '제목/epitaph 없음' });
    paras(e.body, `${w}.body`, out);
    checkFlags(e.when, w);
    e.variants?.forEach((v, vi) => {
      checkFlags(v.when, `${w}.v${vi}`);
      paras(v.body, `${w}.v${vi}`, out);
    });
    if (i === endings.length - 1 && e.when) out.push({ level: 'error', where: w, msg: '마지막 엔딩은 조건 없는 기본 결말이어야 함' });
  });
  return out;
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `[${i.level}] ${i.where}: ${i.msg}`).join('\n');
}
