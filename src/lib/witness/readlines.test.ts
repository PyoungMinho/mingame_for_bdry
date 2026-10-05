/**
 * 읽은 대사 — 해시 키 형식 · 현재 대사 목록(접두 6종 + 열린 것 표시) · meta 정리(옛 키 1회 초기화 · 최신 5000) · [≫ 읽은 건 넘기기] 계획.
 * (docs/planning/witness-replay.md §f · d-2 · h-3 S7 · h-4 U5/U6 의 순수 부분)
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import { READ_LINES_MAX, cleanReadLines, h4, openedReadKey, readCatalog, readKeysOf, readLineKey, skipPlan } from './readlines';
import { parseMeta } from './storage';
import type { Dialogue } from './types';

describe('키 형식', () => {
  it('`${readKey}#${i}~${h4}` — 문구가 바뀌면 키도 바뀐다', () => {
    expect(h4('안녕')).toMatch(/^[0-9a-z]{4}$/);
    expect(h4('안녕')).toBe(h4('안녕'));
    expect(h4('안녕')).not.toBe(h4('안녕!'));
    expect(readLineKey('T01#intro', 2, '안녕')).toBe(`T01#intro#2~${h4('안녕')}`);
  });

  it('목록은 화면이 쓰는 접두 6종 + 돌파별 열린 것 표시를 모두 담는다', () => {
    const cat = readCatalog();
    const set = CASE.sets[1];
    const line = set.lines.find((l) => l.press.lines.length)!;
    const brk = CASE.sets.flatMap((x) => x.lines).flatMap((l) => l.breaks ?? [])[0];
    const hs = CASE.locations[1].hotspots[0];
    const samples = [
      readKeysOf('intro0', CASE.intro[0].lines)[0],
      readKeysOf(hs.id, hs.lines)[0],
      readKeysOf(`${set.id}#intro`, set.intro)[0],
      readKeysOf(`${line.id}#press`, line.press.lines)[0],
      readKeysOf(`${brk.id}#break`, brk.reaction)[0],
      readKeysOf('ending-perfect', CASE.endings.perfect!.lines)[0],
      readKeysOf('ending-excluded', CASE.endings.excluded!.lines)[0],
      openedReadKey(brk.id),
    ];
    for (const k of samples) expect(cat.has(k), k).toBe(true);
    // 대사 아무거나 고쳐 쓰면 목록 밖
    expect(cat.has(readLineKey('intro0', 0, CASE.intro[0].lines[0].text + '!'))).toBe(false);
  });
});

describe('S7 meta.readLines 정리', () => {
  const valid = [...readCatalog()];

  it('해시 없는 옛 키 · 현재 대사에 없는 키 · 문자열 아닌 값은 버린다(1회 초기화)', () => {
    const old = ['intro0#0', 'T01#intro#0', `intro0#0~zzzz`, 42, null];
    expect(cleanReadLines([...old, valid[0], valid[1]])).toEqual([valid[0], valid[1]]);
    expect(cleanReadLines('nope')).toEqual([]);
  });

  it('상한은 최신(뒤쪽) 유지 — slice(-max)', () => {
    expect(READ_LINES_MAX).toBe(5000);
    const list = valid.slice(0, 20);
    expect(cleanReadLines(list, 10)).toEqual(list.slice(-10));
    // 6000 개(대부분 옛 키) → 남는 건 지금 대사 키뿐, 5000 이하
    const big = [...Array.from({ length: 6000 }, (_, i) => `x${i}#0`), ...valid];
    const out = cleanReadLines(big);
    expect(out.length).toBeLessThanOrEqual(READ_LINES_MAX);
    expect(out).toEqual(valid.slice(-READ_LINES_MAX));
  });

  it('parseMeta 가 같은 규칙으로 읽는다', () => {
    const m = parseMeta(JSON.stringify({ v: 1, readLines: ['intro0#0', valid[3], valid[3], valid[2]] }));
    expect(m.readLines).toEqual([valid[3], valid[2]]);
  });
});

describe('U5 [≫ 읽은 건 넘기기] 계획(순수)', () => {
  const lines: Dialogue[] = [
    { who: 'AI', text: '하나' },
    { who: 'AI', face: 'sweat', text: '둘' },
    { who: 'S1', text: '셋' },
    { who: 'AI', text: '넷' },
  ];
  const rk = 'T01#intro';
  const readSet = (idx: number[]) => new Set(idx.map((i) => readLineKey(rk, i, lines[i].text)));
  const isRead = (s: Set<string>) => (k: string) => s.has(k);

  it('연속 읽은 줄 1개면 비활성, 2개부터 활성 — 처음 보는 줄에서 멈춘다', () => {
    expect(skipPlan(lines, rk, 0, isRead(readSet([0])))).toMatchObject({ enabled: false, streak: 1, to: 1 });
    const p = skipPlan(lines, rk, 0, isRead(readSet([0, 1, 2])));
    expect(p).toMatchObject({ enabled: true, streak: 3, to: 3 });
    // 건너뛴 구간의 마지막 표정을 착지 줄에(M4)
    expect(p.carry).toEqual({ who: 'AI', face: 'sweat' });
  });

  it('끝까지 다 읽었으면 블록 끝(to null) · 지금 줄이 처음이면 비활성 · readKey 없으면 비활성', () => {
    expect(skipPlan(lines, rk, 2, isRead(readSet([0, 1, 2, 3])))).toMatchObject({ enabled: true, to: null, carry: { who: 'AI' } });
    expect(skipPlan(lines, rk, 0, isRead(readSet([1, 2, 3])))).toMatchObject({ enabled: false, streak: 0 });
    expect(skipPlan(lines, undefined, 0, () => true).enabled).toBe(false);
  });

  it('문구가 바뀐 줄은 읽은 줄이 아니다', () => {
    const s = readSet([0, 1]);
    const changed = [lines[0], { ...lines[1], text: '둘(고침)' }, lines[2]];
    expect(skipPlan(changed, rk, 0, isRead(s))).toMatchObject({ enabled: false, streak: 1 });
  });
});
