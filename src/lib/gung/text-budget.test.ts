/**
 * 6판 글 분량 규칙(docs/design/gung-compact-scene-spec.md §3) — 안내 문구(GUIDE)·사건 데이터 상한 자동 검사.
 * 상한표는 text-budget.ts. 방장 진행 대본(HOST_CUE)·확인 시트 문구는 화면 쪽 테스트(Improve.test.tsx '6판 글 분량')에서 잰다.
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import { assignFromCode, getAllSheets } from './assign';
import { getRoundBoard, resolveBriefing } from './deck';
import { flowPlan } from './game';
import { GUIDE, GUIDE_BANNED_WORDS, guideText } from './guide-data';
import { placeCardsFor } from './seal';
import { DATA_BUDGET, DATA_OVER_BUDGET, GUIDE_COPY_KIND, labelLength, readMinutes, textLength, UI_BUDGET } from './text-budget';
import { PLAYER_COUNTS } from './types';

const isNote = (p: string) => p.trimStart().startsWith('※');

/** 사건 데이터 측정값(항목 id → 길이)과 그 상한 */
function measureCaseData(): { id: string; len: number; cap: number }[] {
  const out: { id: string; len: number; cap: number }[] = [];
  const seen = new Set<string>();
  const push = (id: string, len: number, cap: number) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, len, cap });
  };
  for (const n of PLAYER_COUNTS) {
    for (const card of placeCardsFor(c, n)) push(`placeCard:${card.id}`, textLength(card.body), DATA_BUDGET.placeCard);
    for (const r of [1, 2, 3] as const) {
      const b = getRoundBoard(c, n, r);
      for (const p of b.publicCards) push(`publicCard:${p.id}`, textLength(p.body), DATA_BUDGET.publicCard[p.id] ?? DATA_BUDGET.publicCardDefault);
      for (const x of b.npcCards) push(`npcCard:${x.id}`, textLength(x.body), DATA_BUDGET.npcCard);
    }
    const read = resolveBriefing(c, n).paragraphs.filter((p) => !isNote(p));
    push(`briefingRead:${n}`, read.reduce((s, p) => s + textLength(p), 0), DATA_BUDGET.briefingRead);
  }
  const t = c.truth;
  push('truthBeats', t.beats.length, DATA_BUDGET.truthBeats);
  t.beats.forEach((b, i) => push(`truthBeat:${i + 1}`, textLength(`${b.time ?? ''}${b.text}`), DATA_BUDGET.truthBeat));
  push(
    'truthTotal',
    t.beats.reduce((s, b) => s + textLength(b.text), 0) + textLength(t.culpritLine) + textLength(t.confession) + textLength(t.epilogue ?? '') + textLength(t.summary ?? ''),
    DATA_BUDGET.truthTotal,
  );
  push('truthConclusion', textLength(t.summary ?? ''), DATA_BUDGET.truthConclusion);
  for (const q of c.bonusQuestions ?? []) {
    push(`bonusPrompt:${q.id}`, textLength(q.prompt), DATA_BUDGET.bonusPrompt);
    q.options.forEach((o, i) => push(`bonusOption:${q.id}.${i + 1}`, textLength(o), DATA_BUDGET.bonusOption));
  }
  for (const p of c.places) push(`placeSub:${p.id}`, textLength(p.sub ?? ''), DATA_BUDGET.placeSub);
  // 내 패 — 6인 판이면 역할 6개가 다 앉는다(패 글은 인원과 무관)
  const a = assignFromCode(c, '7F3K6')!;
  const S = DATA_BUDGET.sheet;
  for (const sh of getAllSheets(c, a)) {
    const parts = {
      identity: textLength(`${sh.identity.headline}${sh.identity.body ?? ''}`),
      profile: textLength(sh.profile),
      secret: textLength([...sh.glance, ...sh.secrets].join('')),
      night: textLength(sh.night.map((x) => `${x.time ?? ''}${x.text}`).join('')),
      lies: textLength([...sh.canLie, ...sh.mustTell, ...sh.lieTips].join('')),
      mission: textLength(sh.missions.map((m) => m.text).join('')),
    };
    for (const [k, v] of Object.entries(parts)) push(`sheet.${k}:${sh.roleId}`, v, S[k as keyof typeof S]);
    push(`sheet.total:${sh.roleId}`, Object.values(parts).reduce((s, v) => s + v, 0), S.total);
  }
  return out;
}

describe('6판 글 분량 — 안내 문구(GUIDE)', () => {
  it('GUIDE 의 모든 키가 종류표(GUIDE_COPY_KIND)에 있고, 표에만 있는 낡은 키도 없다', () => {
    expect(Object.keys(GUIDE).sort()).toEqual(Object.keys(GUIDE_COPY_KIND).sort());
  });

  it('종류별 상한 — 큐 40 · 버튼 14(화살표 제외) · 토스트·배너 40 · 확인 시트 14/48/6 · micro 30 · 접힘 20 · 제목 24', () => {
    const over: string[] = [];
    for (const [key, kind] of Object.entries(GUIDE_COPY_KIND)) {
      if (kind === 'text') continue;
      const v = (GUIDE as Record<string, unknown>)[key];
      expect(typeof v, key).toBe('string');
      const len = kind === 'button' || kind === 'fold' ? labelLength(v as string) : textLength(v as string);
      if (len > UI_BUDGET[kind]) over.push(`${key}(${kind}) ${len} > ${UI_BUDGET[kind]}: ${v}`);
    }
    expect(over).toEqual([]);
  });

  it('자리표시자가 있는 문구 — 접힘·토스트·제목 상한', () => {
    expect(labelLength(guideText.publicPast(2))).toBeLessThanOrEqual(UI_BUDGET.fold);
    expect(labelLength(guideText.pastAndTime(2))).toBeLessThanOrEqual(UI_BUDGET.fold);
    expect(textLength(guideText.sealToast(1234))).toBeLessThanOrEqual(UI_BUDGET.toast);
    expect(textLength(guideText.boardTitle(21))).toBeLessThanOrEqual(UI_BUDGET.head);
    expect(textLength(guideText.defenseHead('45초'))).toBeLessThanOrEqual(UI_BUDGET.head);
  });

  it('새 문구(배너·진행표·투표 문구 포함)에도 사건 고유어 0개', () => {
    const keys = ['storageBanner', 'wakeBanner', 'versionBanner', 'lobbyCue', 'flowRoundsNote', 'votePrompt', 'voteNote', 'bonusZeroInline', 'unpostToast', 'helpLink'] as const;
    for (const k of keys) expect(GUIDE_BANNED_WORDS.filter((w) => GUIDE[k].includes(w)), k).toEqual([]);
  });
});

describe('6판 글 분량 — 사건 데이터(원고 → case-data.ts)', () => {
  const rows = measureCaseData();

  it('측정 항목이 실제로 있다(탐침 유효성)', () => {
    expect(rows.filter((r) => r.id.startsWith('placeCard:')).length).toBeGreaterThanOrEqual(20);
    expect(rows.filter((r) => r.id.startsWith('sheet.total:'))).toHaveLength(6);
    expect(rows.find((r) => r.id === 'truthBeats')!.len).toBeGreaterThan(0);
  });

  it('상한 안 — 넘는 것은 DATA_OVER_BUDGET 에 지금 값으로 적힌 것뿐이고, 그 값보다 늘지 않았다', () => {
    const problems: string[] = [];
    for (const r of rows) {
      if (r.len <= r.cap) continue;
      const allowed = DATA_OVER_BUDGET[r.id];
      if (allowed === undefined) problems.push(`${r.id} ${r.len} > 상한 ${r.cap} (DATA_OVER_BUDGET 에 없음)`);
      else if (r.len > allowed) problems.push(`${r.id} ${r.len} > 기록된 ${allowed} (늘었다)`);
    }
    expect(problems).toEqual([]);
  });

  it('DATA_OVER_BUDGET 이 낡지 않았다 — 상한 안으로 들어온 항목은 목록에서 지운다', () => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const stale = Object.keys(DATA_OVER_BUDGET).filter((id) => {
      const r = byId.get(id);
      return !r || r.len <= r.cap;
    });
    expect(stale).toEqual([]);
  });

  it('진상 비트 ≤ 8 · 플레이어 진상 결론 ≤ 200자 · 장소 카드 ≤ 140자 · 내 패 합 ≤ 900자(지금 모두 상한 안 — 예외 없음)', () => {
    for (const id of ['truthBeats', 'truthConclusion']) {
      const r = rows.find((x) => x.id === id)!;
      expect(r.len, id).toBeLessThanOrEqual(r.cap);
    }
    for (const r of rows.filter((x) => x.id.startsWith('placeCard:') || x.id.startsWith('sheet.total:') || x.id.startsWith('truthBeat:'))) {
      expect(r.len, r.id).toBeLessThanOrEqual(r.cap);
    }
  });

  it('6인 개요 낭독 ≤ 450자(약 1.4분) — 4·5인은 증언자 한 줄만큼 넘는다(기록됨)', () => {
    const six = rows.find((r) => r.id === 'briefingRead:6')!;
    expect(six.len).toBeLessThanOrEqual(DATA_BUDGET.briefingRead);
    expect(readMinutes(six.len)).toBeLessThanOrEqual(1.4);
  });

  it('진행표 합계 ≤ 40분(4~6인)', () => {
    for (const n of PLAYER_COUNTS) expect(flowPlan(c, n).total, `${n}인`).toBeLessThanOrEqual(40);
  });
});
