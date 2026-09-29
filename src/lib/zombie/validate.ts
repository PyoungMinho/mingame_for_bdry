/**
 * 스토리 그래프 무결성 검사 (순수 함수).
 *
 * - validateChapter: 챕터 한 파일만 검사. 외부 참조는 ENTRY 입구 노드와 엔딩만 허용.
 * - validateStory:   전 챕터 + 엔딩을 합쳐 검사(도달 가능성·플래그 생산/소비·아이템 획득 경로 등).
 */
import {
  COMPANION_IDS,
  ENDING_IDS,
  MIN_CHOICES_BEFORE_END,
  ENTRY,
  FORCED_ENDINGS,
  ITEM_IDS,
  LOCATION_IDS,
  SCENE_IDS,
  START_COMPANIONS,
  START_NODE,
} from './contract';
import type { Condition, Effect, Ending, EndingId, Para, StoryNode } from './types';

export interface Issue {
  level: 'error' | 'warn';
  where: string;
  msg: string;
}

const ENTRY_IDS = new Set<string>(Object.values(ENTRY));
const ITEM_SET = new Set<string>(ITEM_IDS);
const COMPANION_SET = new Set<string>(COMPANION_IDS);
const LOCATION_SET = new Set<string>(LOCATION_IDS);
const SCENE_SET = new Set<string>(SCENE_IDS);
const ENDING_SET = new Set<string>(ENDING_IDS);

const LABEL_MAX = 30;
const HINT_MAX = 26;

function condIssues(c: Condition | undefined, where: string, out: Issue[]) {
  if (!c) return;
  for (const k of [...(c.items ?? []), ...(c.anyItems ?? []), ...(c.noItems ?? [])]) {
    if (!ITEM_SET.has(k)) out.push({ level: 'error', where, msg: `알 수 없는 아이템 "${k}"` });
  }
  for (const k of [...(c.companions ?? []), ...(c.anyCompanions ?? []), ...(c.noCompanions ?? [])]) {
    if (!COMPANION_SET.has(k)) out.push({ level: 'error', where, msg: `알 수 없는 동료 "${k}"` });
  }
}

function effectIssues(e: Effect | undefined, where: string, out: Issue[]) {
  if (!e) return;
  for (const k of [...(e.addItems ?? []), ...(e.removeItems ?? [])]) {
    if (!ITEM_SET.has(k)) out.push({ level: 'error', where, msg: `알 수 없는 아이템 "${k}"` });
  }
  for (const k of [...(e.addCompanions ?? []), ...(e.removeCompanions ?? [])]) {
    if (!COMPANION_SET.has(k)) out.push({ level: 'error', where, msg: `알 수 없는 동료 "${k}"` });
  }
  for (const s of ['hp', 'supply', 'mental'] as const) {
    const v = e[s];
    if (v !== undefined && (!Number.isFinite(v) || Math.abs(v) > 60)) {
      out.push({ level: 'error', where, msg: `${s} 변화량 ${v} 이 비정상(±60 초과)` });
    }
  }
  if (e.hours !== undefined && (e.hours < 0 || e.hours > 24)) {
    out.push({ level: 'error', where, msg: `hours ${e.hours} 가 0~24 범위 밖` });
  }
}

function parasIssues(ps: Para[], where: string, out: Issue[]) {
  if (!Array.isArray(ps) || ps.length === 0) {
    out.push({ level: 'error', where, msg: '문단이 비어 있음' });
    return;
  }
  const hasPlain = ps.some((p) => typeof p === 'string');
  if (!hasPlain) out.push({ level: 'warn', where, msg: '무조건 문단이 하나도 없음 — 조건이 모두 거짓이면 빈 화면' });
  ps.forEach((p, i) => {
    if (typeof p === 'string') {
      if (!p.trim()) out.push({ level: 'error', where: `${where}[${i}]`, msg: '빈 문단' });
    } else {
      condIssues(p.when, `${where}[${i}]`, out);
      if (!p.text?.trim()) out.push({ level: 'error', where: `${where}[${i}]`, msg: '빈 조건부 문단' });
    }
  });
}

function targetIssue(next: string, where: string, local: Set<string>, allowExternal: boolean, out: Issue[]) {
  if (next.startsWith('end:')) {
    const id = next.slice(4);
    if (!ENDING_SET.has(id)) out.push({ level: 'error', where, msg: `알 수 없는 엔딩 "${next}"` });
    return;
  }
  if (local.has(next)) return;
  if (allowExternal && ENTRY_IDS.has(next)) return;
  out.push({ level: 'error', where, msg: `존재하지 않는 다음 노드 "${next}"` });
}

/** 노드 묶음 하나의 구조 검사. allowExternal=true 면 ENTRY 입구로의 참조를 허용한다(챕터 단독 검사용). */
export function validateNodes(nodes: Record<string, StoryNode>, allowExternal: boolean): Issue[] {
  const out: Issue[] = [];
  const local = new Set(Object.keys(nodes));

  for (const [key, n] of Object.entries(nodes)) {
    const w = `node ${key}`;
    if (n.id !== key) out.push({ level: 'error', where: w, msg: `키와 id 불일치 (id="${n.id}")` });
    if (![1, 2, 3, 4, 5].includes(n.chapter)) out.push({ level: 'error', where: w, msg: `chapter ${n.chapter}` });
    if (!LOCATION_SET.has(n.location)) out.push({ level: 'error', where: w, msg: `알 수 없는 장소 "${n.location}"` });
    if (!SCENE_SET.has(n.scene)) out.push({ level: 'error', where: w, msg: `알 수 없는 씬 "${n.scene}"` });
    if (!n.title?.trim()) out.push({ level: 'error', where: w, msg: '제목 없음' });
    if (n.clock !== undefined && (n.clock < 0 || n.clock > 96)) {
      out.push({ level: 'error', where: w, msg: `clock ${n.clock} 가 0~96 범위 밖` });
    }
    parasIssues(n.body, `${w}.body`, out);

    if (!Array.isArray(n.choices) || n.choices.length < 2 || n.choices.length > 4) {
      out.push({ level: 'error', where: w, msg: `선택지 ${n.choices?.length ?? 0}개 (2~4개여야 함)` });
      continue;
    }
    if (n.choices.every((c) => c.requires)) {
      out.push({ level: 'error', where: w, msg: '모든 선택지에 requires — 조건 없는 선택지가 최소 1개 있어야 소프트락이 없다' });
    }

    const ids = new Set<string>();
    n.choices.forEach((c, ci) => {
      const cw = `${w}.choices[${ci}:${c.id}]`;
      if (ids.has(c.id)) out.push({ level: 'error', where: cw, msg: '중복 choice id' });
      ids.add(c.id);
      if (!c.label?.trim()) out.push({ level: 'error', where: cw, msg: '라벨 없음' });
      else if ([...c.label].length > LABEL_MAX) out.push({ level: 'warn', where: cw, msg: `라벨 ${[...c.label].length}자 (>${LABEL_MAX})` });
      if (c.hint && [...c.hint].length > HINT_MAX) out.push({ level: 'warn', where: cw, msg: `힌트 ${[...c.hint].length}자 (>${HINT_MAX})` });
      condIssues(c.requires, cw, out);

      if (!Array.isArray(c.outcomes) || c.outcomes.length === 0) {
        out.push({ level: 'error', where: cw, msg: 'outcomes 없음' });
        return;
      }
      c.outcomes.forEach((o, oi) => {
        const ow = `${cw}.outcomes[${oi}]`;
        const isLast = oi === c.outcomes.length - 1;
        if (isLast && (o.when || o.chance !== undefined)) {
          out.push({ level: 'error', where: ow, msg: '마지막 outcome 은 when/chance 없는 무조건 폴백이어야 함' });
        }
        if (o.chance !== undefined && !(o.chance > 0 && o.chance < 1)) {
          out.push({ level: 'error', where: ow, msg: `chance ${o.chance} 는 0과 1 사이(배타)여야 함` });
        }
        condIssues(o.when, ow, out);
        effectIssues(o.effects, ow, out);
        parasIssues(o.result, `${ow}.result`, out);
        if (typeof o.next !== 'string' || !o.next) out.push({ level: 'error', where: ow, msg: 'next 없음' });
        else targetIssue(o.next, ow, local, allowExternal, out);
      });
    });
  }
  return out;
}

/** 챕터 단독 검사 — 작가가 자기 파일만 돌려 볼 때 쓴다. */
export function validateChapter(nodes: Record<string, StoryNode>): Issue[] {
  return validateNodes(nodes, true);
}

function* conditionsOf(n: StoryNode): Generator<Condition> {
  for (const p of n.body) if (typeof p !== 'string') yield p.when;
  for (const c of n.choices) {
    if (c.requires) yield c.requires;
    for (const o of c.outcomes) {
      if (o.when) yield o.when;
      for (const p of o.result) if (typeof p !== 'string') yield p.when;
    }
  }
}

/** 전체 스토리 검사. sources 는 [챕터명, 노드묶음] 목록(중복 id 검출용). */
export function validateStory(
  sources: [string, Record<string, StoryNode>][],
  endings: Partial<Record<EndingId, Ending>>,
): Issue[] {
  const out: Issue[] = [];
  const all: Record<string, StoryNode> = {};
  for (const [name, nodes] of sources) {
    for (const [k, n] of Object.entries(nodes)) {
      if (all[k]) out.push({ level: 'error', where: `${name}:${k}`, msg: '다른 챕터와 노드 id 중복' });
      all[k] = n;
    }
  }
  out.push(...validateNodes(all, false));

  for (const id of Object.values(ENTRY)) {
    if (!all[id]) out.push({ level: 'error', where: 'ENTRY', msg: `입구 노드 "${id}" 없음` });
  }

  // 엔딩 정의
  for (const id of ENDING_IDS) {
    const e = endings[id];
    const w = `ending ${id}`;
    if (!e) {
      out.push({ level: 'error', where: w, msg: '엔딩 정의 없음' });
      continue;
    }
    if (e.id !== id) out.push({ level: 'error', where: w, msg: `id 불일치 "${e.id}"` });
    if (!SCENE_SET.has(e.scene)) out.push({ level: 'error', where: w, msg: `알 수 없는 씬 "${e.scene}"` });
    if (!e.title?.trim() || !e.epitaph?.trim()) out.push({ level: 'error', where: w, msg: '제목/epitaph 없음' });
    parasIssues(e.body, `${w}.body`, out);
    e.variants?.forEach((v, i) => {
      condIssues(v.when, `${w}.variants[${i}]`, out);
      parasIssues(v.body, `${w}.variants[${i}].body`, out);
    });
  }

  // 도달 가능성 (조건 무시한 상한 그래프)
  const seen = new Set<string>();
  const endingsHit = new Set<string>(Object.values(FORCED_ENDINGS));
  const stack: string[] = [START_NODE];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id) || !all[id]) continue;
    seen.add(id);
    for (const c of all[id].choices) {
      for (const o of c.outcomes) {
        if (o.next.startsWith('end:')) endingsHit.add(o.next.slice(4));
        else stack.push(o.next);
      }
    }
  }
  for (const id of Object.keys(all)) {
    if (!seen.has(id)) out.push({ level: 'error', where: `node ${id}`, msg: '시작 노드에서 도달 불가' });
  }
  for (const id of ENDING_IDS) {
    if (!endingsHit.has(id)) out.push({ level: 'error', where: `ending ${id}`, msg: '어떤 경로로도 도달 불가' });
  }

  // 최소 깊이 — 어떤 스토리 엔딩도 MIN_CHOICES_BEFORE_END 번 선택 전에는 나올 수 없다 (조건 무시 최단 경로)
  const depth: Record<string, number> = { [START_NODE]: 0 };
  const bfs: string[] = [START_NODE];
  while (bfs.length) {
    const id = bfs.shift()!;
    const n = all[id];
    if (!n) continue;
    for (const c of n.choices) {
      for (const o of c.outcomes) {
        const d = depth[id] + 1;
        if (o.next.startsWith('end:')) {
          if (d < MIN_CHOICES_BEFORE_END) {
            out.push({ level: 'error', where: `node ${id}.${c.id}`, msg: `${d}번째 선택에 "${o.next}" — 엔딩은 최소 ${MIN_CHOICES_BEFORE_END}번 선택 뒤에만` });
          }
        } else if (depth[o.next] === undefined) {
          depth[o.next] = d;
          bfs.push(o.next);
        }
      }
    }
  }

  // 플래그 / 아이템 / 동료 — 읽히는 것은 어딘가에서 생산돼야 한다
  const flagsSet = new Set<string>();
  const itemsAdded = new Set<string>();
  const compsAdded = new Set<string>(START_COMPANIONS);
  for (const n of Object.values(all)) {
    for (const c of n.choices) {
      for (const o of c.outcomes) {
        o.effects?.setFlags?.forEach((f) => flagsSet.add(f));
        o.effects?.addItems?.forEach((f) => itemsAdded.add(f));
        o.effects?.addCompanions?.forEach((f) => compsAdded.add(f));
      }
    }
  }
  const endingConds: [string, Condition][] = [];
  for (const e of Object.values(endings)) {
    if (!e) continue;
    for (const p of e.body) if (typeof p !== 'string') endingConds.push([`ending ${e.id}`, p.when]);
    e.variants?.forEach((v) => {
      endingConds.push([`ending ${e.id}`, v.when]);
      for (const p of v.body) if (typeof p !== 'string') endingConds.push([`ending ${e.id}`, p.when]);
    });
  }
  const check = (c: Condition, where: string) => {
    for (const f of [...(c.flags ?? []), ...(c.noFlags ?? [])]) {
      if (!flagsSet.has(f)) out.push({ level: 'error', where, msg: `플래그 "${f}" 를 읽지만 어디서도 setFlags 하지 않음` });
    }
    for (const i of [...(c.items ?? []), ...(c.anyItems ?? [])]) {
      if (!itemsAdded.has(i)) out.push({ level: 'error', where, msg: `아이템 "${i}" 를 요구하지만 획득 경로 없음` });
    }
    for (const m of [...(c.companions ?? []), ...(c.anyCompanions ?? [])]) {
      if (!compsAdded.has(m)) out.push({ level: 'error', where, msg: `동료 "${m}" 를 요구하지만 합류 경로 없음` });
    }
  };
  for (const n of Object.values(all)) for (const c of conditionsOf(n)) check(c, `node ${n.id}`);
  for (const [w, c] of endingConds) check(c, w);

  return out;
}

export function formatIssues(issues: Issue[]): string {
  return issues.map((i) => `[${i.level}] ${i.where}: ${i.msg}`).join('\n');
}
