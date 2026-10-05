/**
 * 사건 데이터 무결성 — 참조 id · 고아 증거(decoys 예외) · 분량 상한(줄 ≤45자, 세트 ≤6줄, 총 텍스트 ≤15,000자) ·
 * 진실 유형 · 구조 수치 · 공정성 규칙 · 핫스팟 간격. 그리고 검사기가 실제로 잡아내는지(변조 데이터).
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import { EVIDENCE_TOTAL, STAR_TOTAL } from './engine';
import type { CaseFile } from './types';
import { LIMITS, caseStats, playerTexts, textBudget, validateCase } from './validate';

const clone = (): CaseFile => JSON.parse(JSON.stringify(CASE)) as CaseFile;
const errors = (c: CaseFile) => validateCase(c).filter((i) => i.level === 'error');

describe('사건 데이터 — 검사기 통과', () => {
  it('오류 0건', () => {
    expect(errors(CASE)).toEqual([]);
  });

  it('경고는 E14b(item 인데 reliability) 하나뿐 — 바이블 원문 유지', () => {
    const warns = validateCase(CASE).filter((i) => i.level === 'warn');
    expect(warns.map((w) => w.where)).toEqual(['evidence E14b']);
  });

  it('구조 수치가 바이블 0장 대조표와 같다', () => {
    const s = caseStats();
    expect(s).toMatchObject({
      locations: 6,
      hotspots: 24,
      precise: 2,
      evidence: 18,
      upgrades: 3,
      profiles: 6,
      sets: 11,
      lines: 50,
      breaks: 15,
      stars: 7,
      minors: 8,
      combos: 2,
      comboStars: 2,
      multiUse: 6,
      questions: 8,
      redirects: 10,
      halfCards: 6,
      requires: 1,
    });
    expect(STAR_TOTAL).toBe(7);
    expect(EVIDENCE_TOTAL).toBe(18);
  });

  it('분량 상한: 모든 줄·대사 ≤ 45자(규칙 카드·장면 설명 제외), 세트 ≤ 6줄, 증언 총 ≤ 60줄', () => {
    const exempt = new Set([...CASE.rules, ...CASE.locations.map((l) => l.scene), ...CASE.locations.map((l) => l.look)]);
    const long = playerTexts(CASE).filter((t) => !exempt.has(t) && [...t].length > LIMITS.line);
    expect(long).toEqual([]);
    for (const s of CASE.sets) expect(s.lines.length).toBeLessThanOrEqual(6);
    expect(CASE.sets.reduce((a, s) => a + s.lines.length, 0)).toBeLessThanOrEqual(60);
    for (const e of CASE.evidence) expect([...e.name].length).toBeLessThanOrEqual(12);
  });

  it('총 텍스트 ≤ 15,000자', () => {
    const n = textBudget();
    expect(n).toBeGreaterThan(5000);
    expect(n).toBeLessThanOrEqual(15000);
  });

  it('증거 id 는 E01~E18 + 갱신 E03a·E03b·E14b (v3: E03 → E03a 해석 정정 → E03b 위조 확정)', () => {
    const ids = CASE.evidence.map((e) => e.id);
    for (let i = 1; i <= 18; i++) expect(ids).toContain(`E${String(i).padStart(2, '0')}`);
    expect(CASE.evidence.filter((e) => e.upgradeOf).map((e) => `${e.upgradeOf}→${e.id}`).sort()).toEqual(['E03a→E03b', 'E03→E03a', 'E14→E14b']);
    const rel = (id: string) => CASE.evidence.find((e) => e.id === id)?.reliability;
    expect([rel('E03'), rel('E03a'), rel('E03b')]).toEqual(['raw', 'revised', 'forged']);
  });

  it('모든 돌파에 정정 진술(revisedText) — 깨진 줄의 「정정」·「권한 해제」 칸이 비지 않는다', () => {
    for (const s of CASE.sets) for (const l of s.lines) for (const b of l.breaks ?? []) expect(b.revisedText?.trim(), b.id).toBeTruthy();
  });

  it('AI 줄은 record/inference/refusal 만, 거짓말 없음 · 용의자 넷 모두 lie 1개 이상', () => {
    const lines = CASE.sets.flatMap((s) => s.lines);
    for (const l of lines.filter((x) => x.who === 'AI')) expect(['record', 'inference', 'refusal']).toContain(l.truth);
    for (const s of ['S1', 'S2', 'S3', 'S4']) expect(lines.some((l) => l.who === s && l.truth === 'lie')).toBe(true);
  });

  it('최종 정답 칸: 칸마다 1~2개, 기회 칸은 갱신(위조)본만 · 미끼가 칸마다 있다', () => {
    const { accept, decoys } = CASE.solution;
    expect(accept.means.length).toBeGreaterThanOrEqual(1);
    expect(accept.opportunity.every((id) => CASE.evidence.find((e) => e.id === id)?.reliability === 'forged')).toBe(true);
    for (const k of ['means', 'opportunity', 'motive'] as const) expect(decoys?.[k]?.length).toBeGreaterThan(0);
  });

  it('우회(redirect) 10개 이하(v3), 카드 1~2장, 그 줄 정답 카드를 포함하지 않는다', () => {
    const rs = CASE.sets.flatMap((s) => s.lines).filter((l) => l.redirect);
    expect(LIMITS.redirectMax).toBe(10);
    expect(rs.length).toBeLessThanOrEqual(LIMITS.redirectMax);
    for (const l of rs) {
      const correct = new Set((l.breaks ?? []).flatMap((b) => [b.evidence, ...(b.accept ?? [])].flat()));
      expect(l.redirect!.cards.length).toBeGreaterThanOrEqual(1);
      expect(l.redirect!.cards.length).toBeLessThanOrEqual(2);
      for (const c of l.redirect!.cards) expect(correct.has(c)).toBe(false);
    }
  });

  it('엔딩 텍스트: 완벽·숨은·증거 부족·오인 체포 ×3·시간 초과·수사 배제 = 8', () => {
    const keys = Object.keys(CASE.endings);
    expect(keys.length).toBe(8);
    expect(keys.filter((k) => k.startsWith('wrong-')).length).toBe(3);
    expect(keys).not.toContain(`wrong-${CASE.solution.culprit}`);
  });

  it('공유·URL 에 쓰일 사건 제목엔 인물 이름이 없다', () => {
    for (const p of CASE.profiles) expect(CASE.title.includes(p.name)).toBe(false);
  });
});

describe('규칙 문구 — 행동 13 · 사이렌 뒤 재방문(밸런스 R1~R3)', () => {
  it('규칙 카드 1: 행동 13번 · 새로운 곳은 끝 · 이미 연 곳은 다시 볼 수 있다', () => {
    expect(CASE.rules[0]).toContain('행동 13번');
    expect(CASE.rules[0]).toContain('새로운 곳은 끝');
    expect(CASE.rules[0]).toContain('이미 연 곳은 다시 볼 수 있다');
    expect(CASE.rules[0]).not.toContain('다시 못 들어간다');
  });

  it('인트로 마지막 컷: 22시 50분(시작 22:50 + 13×10분 = 도착 01:00)', () => {
    const last = CASE.intro[CASE.intro.length - 1];
    expect(last.art).toBe('clock');
    expect(last.lines.map((l) => l.text).join(' ')).toContain('22시 50분');
    expect(CASE.intro.flatMap((c) => c.lines).map((l) => l.text).join(' ')).not.toMatch(/(^|\s)23시/);
  });

  it('핵심 문구에 12번이 남지 않았다', () => {
    expect(CASE.rules.join(' ')).not.toContain('12번');
  });
});

describe('검사기가 실제로 잡아낸다(변조 데이터)', () => {
  it('고아 증거 — decoys 에서 빼면 오류, decoys 에 있으면 통과', () => {
    const c = clone();
    c.solution.decoys!.motive = ['E07', 'E08'];
    expect(errors(c).some((e) => e.where === 'evidence E10' && e.msg.includes('고아'))).toBe(true);
  });

  it('45자 초과 줄', () => {
    const c = clone();
    c.sets[1].lines[0].text = '가'.repeat(46);
    expect(errors(c).some((e) => e.where === 'line T01.1')).toBe(true);
  });

  it('세트 7줄', () => {
    const c = clone();
    const s = c.sets.find((x) => x.id === 'T04')!;
    s.lines.push({ ...s.lines[0], id: 'T04.6' }, { ...s.lines[0], id: 'T04.7' });
    expect(errors(c).some((e) => e.where === 'set T04' && e.msg.includes('줄 > 6'))).toBe(true);
  });

  it('없는 id 참조', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T08')!.unlock = { broken: 'C99' };
    expect(errors(c).some((e) => e.msg.includes('"C99"'))).toBe(true);
  });

  it('우회 카드에 그 줄의 정답 카드', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T10')!.lines.find((l) => l.id === 'T10.4')!.redirect!.cards = ['E16'];
    expect(errors(c).some((e) => e.msg.includes('정답 카드'))).toBe(true);
  });

  it('돌파의 정정 진술 누락(v3 — C06 빈 칸 버그 회귀)', () => {
    const c = clone();
    delete c.sets.find((x) => x.id === 'T05')!.lines.find((l) => l.id === 'T05.6')!.breaks![0].revisedText;
    expect(errors(c).some((e) => e.where === 'break C06' && e.msg.includes('revisedText'))).toBe(true);
  });

  it('우회 카드가 같은 줄의 반쪽 카드(HALF 에 가려 죽은 데이터)', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T10')!.lines.find((l) => l.id === 'T10.4')!.redirect!.cards = ['E03a'];
    expect(errors(c).some((e) => e.msg.includes('반쪽 카드'))).toBe(true);
  });

  it('갱신 사슬 순환·갈래', () => {
    const c = clone();
    c.evidence.find((e) => e.id === 'E03')!.upgradeOf = 'E03b';
    expect(errors(c).some((e) => e.msg.includes('사슬'))).toBe(true);
    const d = clone();
    d.evidence.find((e) => e.id === 'E03b')!.upgradeOf = 'E03';
    expect(errors(d).some((e) => e.msg.includes('한 줄기'))).toBe(true);
  });

  it('의문 해소 대상이 돌파도 증거도 아님', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T07')!.lines.find((l) => l.id === 'T07.5')!.press.question!.resolvedBy = ['X99'];
    expect(errors(c).some((e) => e.msg.includes('X99'))).toBe(true);
  });

  it('lie 줄에 돌파 없음', () => {
    const c = clone();
    delete c.sets.find((x) => x.id === 'T01')!.lines[1].breaks;
    expect(errors(c).some((e) => e.where === 'line T01.2')).toBe(true);
  });

  it('true 줄에 돌파', () => {
    const c = clone();
    const t = c.sets.find((x) => x.id === 'T01')!;
    t.lines[0].breaks = [{ ...t.lines[1].breaks![0], id: 'C98', evidence: ['E07'] }];
    expect(errors(c).some((e) => e.where === 'line T01.1' && e.msg.includes('돌파가 있음'))).toBe(true);
  });

  it('같은 세트의 두 줄을 한 카드로 깸(6-6 4번)', () => {
    const c = clone();
    const t = c.sets.find((x) => x.id === 'T07')!;
    t.lines.find((l) => l.id === 'T07.3')!.breaks![0].evidence = ['E02'];
    expect(errors(c).some((e) => e.msg.includes('6-6 4번'))).toBe(true);
  });

  it('해금 순환(DAG 위반)', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T04')!.initial = false;
    c.sets.find((x) => x.id === 'T04')!.unlock = { broken: 'C10' };
    expect(errors(c).some((e) => e.msg.includes('해금 순환'))).toBe(true);
  });

  it('핫스팟이 너무 붙음(디자인 D10)', () => {
    const c = clone();
    const l0 = c.locations[0];
    l0.hotspots[4].x = 40;
    l0.hotspots[4].y = 80;
    expect(errors(c).some((e) => e.msg.includes('간격'))).toBe(true);
  });

  it('조합 카드 단독 HALF 대사 누락', () => {
    const c = clone();
    const b = c.sets.find((x) => x.id === 'T10')!.lines.find((l) => l.id === 'T10.2')!.breaks![0];
    b.half = { E05: b.half && !Array.isArray(b.half) ? b.half.E05 : [] };
    expect(errors(c).some((e) => e.msg.includes('E15 단독 HALF'))).toBe(true);
  });

  it('비용 규칙 위반(대질 유료)', () => {
    const c = clone();
    c.sets.find((x) => x.id === 'T09')!.cost = 1;
    expect(errors(c).some((e) => e.where === 'set T09')).toBe(true);
  });

  it('총 텍스트 초과', () => {
    const c = clone();
    c.rules.push(...Array.from({ length: 50 }, () => '가'.repeat(40)));
    expect(errors(c).some((e) => e.where === 'text')).toBe(true);
  });
});
