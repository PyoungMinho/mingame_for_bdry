/**
 * coords.ts 단위·속성 테스트 — 좌표 왕복, 이름 상자 정규화(두벌식 자모·전각·소문자), 범위 파싱,
 * 힌트 범위(3×3 가장자리 밀기, 방향서 §2-R), 배 칸·범위→배치, 경계 규칙(React·DOM·node 금지).
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  ALL_CELLS,
  COLS,
  ROWS,
  addrAt,
  cellIndex,
  colIndex,
  colName,
  formatRange,
  hintRange,
  isCellAddr,
  isHintTarget,
  makeRange,
  normalizeAddrInput,
  parseCell,
  parseRange,
  placementCells,
  placementRange,
  rangeCells,
  rangeContains,
  rangeSize,
  rangeToPlacement,
  shipCells,
  stepCell,
  toAddr,
  toPoint,
  type CellAddr,
} from './coords';
import { BOARD_SIZE, HINT_BLOCK_SIZE, SHIP_LENGTH, SHIP_SLOTS } from './constants';

const arbCell = fc.constantFrom(...ALL_CELLS);

describe('기본 변환', () => {
  it('64칸, 행 우선, 중복 없음', () => {
    expect(ALL_CELLS).toHaveLength(BOARD_SIZE * BOARD_SIZE);
    expect(new Set(ALL_CELLS).size).toBe(64);
    expect(ALL_CELLS[0]).toBe('A1');
    expect(ALL_CELLS[1]).toBe('B1');
    expect(ALL_CELLS[8]).toBe('A2');
    expect(ALL_CELLS[63]).toBe('H8');
  });

  it('B7 ↔ {c:1, r:6}', () => {
    expect(toPoint('B7')).toEqual({ c: 1, r: 6 });
    expect(toAddr({ c: 1, r: 6 })).toBe('B7');
  });

  it('판 밖 좌표는 null', () => {
    expect(toAddr({ c: 8, r: 0 })).toBeNull();
    expect(toAddr({ c: 0, r: 8 })).toBeNull();
    expect(toAddr({ c: -1, r: 0 })).toBeNull();
    expect(toAddr({ c: 0.5, r: 0 })).toBeNull();
    expect(addrAt(64)).toBeNull();
    expect(addrAt(-1)).toBeNull();
  });

  it('왕복: addr → point → addr, addr → index → addr', () => {
    fc.assert(
      fc.property(arbCell, (a) => {
        expect(toAddr(toPoint(a))).toBe(a);
        expect(addrAt(cellIndex(a))).toBe(a);
      }),
    );
  });

  it('isCellAddr', () => {
    for (const a of ALL_CELLS) expect(isCellAddr(a)).toBe(true);
    for (const bad of ['I1', 'A0', 'A9', 'b7', 'B07', ' B7', 'B7 ', 'AA1', '', 7, null]) {
      expect(isCellAddr(bad)).toBe(false);
    }
  });

  it('stepCell은 판 가장자리에서 멈춘다', () => {
    expect(stepCell('A1', -1, 0)).toBe('A1');
    expect(stepCell('A1', 0, -1)).toBe('A1');
    expect(stepCell('H8', 1, 1)).toBe('H8');
    expect(stepCell('B7', 1, 0)).toBe('C7');
    expect(stepCell('B7', 0, 1)).toBe('B8');
  });
});

describe('시트 열 이름', () => {
  it('A, Z, AA, AZ, BA', () => {
    expect(colName(0)).toBe('A');
    expect(colName(8)).toBe('I');
    expect(colName(9)).toBe('J');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colName(51)).toBe('AZ');
    expect(colName(52)).toBe('BA');
    expect(colName(-1)).toBe('');
  });

  it('colName ↔ colIndex 왕복', () => {
    fc.assert(
      fc.property(fc.nat(2000), (i) => {
        expect(colIndex(colName(i))).toBe(i);
      }),
    );
    expect(colIndex('a')).toBe(-1);
  });
});

describe('이름 상자 정규화', () => {
  it('두벌식 자모 → A~H (ㅁㅠㅊㅇㄷㄹㅎㅗ)', () => {
    expect(normalizeAddrInput('ㅁㅠㅊㅇㄷㄹㅎㅗ')).toBe('ABCDEFGH');
  });

  it('Shift+E(ㄸ)도 E', () => {
    expect(parseCell('ㄸ3')).toBe('E3');
  });

  it('조합형 자모(U+1100대)도 받는다', () => {
    expect(parseCell('ᅲ' + '7')).toBe('B7'); // ᅲ7
    expect(parseCell('ᄆ' + '1')).toBe('A1'); // ᄆ1
  });

  it('소문자·전각·공백·$ 정리', () => {
    expect(parseCell('b7')).toBe('B7');
    expect(parseCell(' B7 ')).toBe('B7');
    expect(parseCell('Ｂ７')).toBe('B7');
    expect(parseCell('$B$7')).toBe('B7');
    expect(parseCell('ㅠ7')).toBe('B7');
    expect(parseCell('ㅗ8')).toBe('H8');
  });

  it('판 밖·형식 오류는 null', () => {
    for (const bad of ['Z9', 'I1', 'A0', 'A9', 'B', '7', 'B7:C7', 'ㅋ7', '', '가7']) {
      expect(parseCell(bad)).toBeNull();
    }
  });

  it('모든 칸: 소문자·자모 입력이 같은 칸으로', () => {
    const toJamo: Record<string, string> = { A: 'ㅁ', B: 'ㅠ', C: 'ㅊ', D: 'ㅇ', E: 'ㄷ', F: 'ㄹ', G: 'ㅎ', H: 'ㅗ' };
    for (const a of ALL_CELLS) {
      expect(parseCell(a.toLowerCase())).toBe(a);
      expect(parseCell(toJamo[a[0]] + a.slice(1))).toBe(a);
    }
  });
});

describe('범위', () => {
  it('B3:D5 파싱과 표기', () => {
    const r = parseRange('B3:D5');
    expect(r).toEqual({ ok: true, range: { from: 'B3', to: 'D5' } });
    if (r.ok) {
      expect(formatRange(r.range)).toBe('B3:D5');
      expect(rangeSize(r.range)).toEqual({ cols: 3, rows: 3 });
      expect(rangeCells(r.range)).toEqual(['B3', 'C3', 'D3', 'B4', 'C4', 'D4', 'B5', 'C5', 'D5']);
    }
  });

  it('뒤집힌 범위도 정규화', () => {
    expect(parseRange('D5:B3')).toEqual({ ok: true, range: { from: 'B3', to: 'D5' } });
    expect(parseRange('D3:B5')).toEqual({ ok: true, range: { from: 'B3', to: 'D5' } });
  });

  it('한 칸 = 같은 from·to, 표기는 B7', () => {
    const r = parseRange('ㅠ7');
    expect(r).toEqual({ ok: true, range: { from: 'B7', to: 'B7' } });
    if (r.ok) expect(formatRange(r.range)).toBe('B7');
  });

  it('한글 범위 입력 "ㅠ2:ㄷ2" → B2:E2', () => {
    expect(parseRange('ㅠ2:ㄷ2')).toEqual({ ok: true, range: { from: 'B2', to: 'E2' } });
    expect(parseRange('b2：e2')).toEqual({ ok: true, range: { from: 'B2', to: 'E2' } }); // 전각 콜론
  });

  it('형식 오류(syntax)와 판 밖(outOfBoard)을 구분', () => {
    expect(parseRange('B3:')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange(':B3')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange('B3:C4:D5')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange('hello')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange('')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange('A0')).toEqual({ ok: false, reason: 'syntax' });
    expect(parseRange('Z9')).toEqual({ ok: false, reason: 'outOfBoard' });
    expect(parseRange('G2:J2')).toEqual({ ok: false, reason: 'outOfBoard' });
    expect(parseRange('A8:A9')).toEqual({ ok: false, reason: 'outOfBoard' });
  });

  it('속성: 임의의 두 칸 → 범위는 둘을 포함하고 표기 왕복', () => {
    fc.assert(
      fc.property(arbCell, arbCell, (a, b) => {
        const range = makeRange(toPoint(a), toPoint(b));
        expect(rangeContains(range, a)).toBe(true);
        expect(rangeContains(range, b)).toBe(true);
        const re = parseRange(formatRange(range));
        expect(re).toEqual({ ok: true, range });
        const { cols, rows } = rangeSize(range);
        expect(rangeCells(range)).toHaveLength(cols * rows);
      }),
    );
  });
});

describe('힌트 범위', () => {
  it('열 → E1:E8, 행 → A3:H3', () => {
    expect(formatRange(hintRange({ kind: 'col', col: 'E' }))).toBe('E1:E8');
    expect(formatRange(hintRange({ kind: 'row', row: 3 }))).toBe('A3:H3');
  });

  it('3×3: 가운데 기준, 가장자리는 판 안쪽으로 민다(방향서 §2-R)', () => {
    expect(formatRange(hintRange({ kind: 'block', cell: 'C4' }))).toBe('B3:D5');
    expect(formatRange(hintRange({ kind: 'block', cell: 'A1' }))).toBe('A1:C3');
    expect(formatRange(hintRange({ kind: 'block', cell: 'H8' }))).toBe('F6:H8');
    expect(formatRange(hintRange({ kind: 'block', cell: 'A8' }))).toBe('A6:C8');
    expect(formatRange(hintRange({ kind: 'block', cell: 'H1' }))).toBe('F1:H3');
    expect(formatRange(hintRange({ kind: 'block', cell: 'B2' }))).toBe('A1:C3');
  });

  it('속성: 3×3은 언제나 9칸, 판 안, 고른 칸 포함', () => {
    fc.assert(
      fc.property(arbCell, (cell) => {
        const r = hintRange({ kind: 'block', cell });
        expect(rangeSize(r)).toEqual({ cols: HINT_BLOCK_SIZE, rows: HINT_BLOCK_SIZE });
        expect(rangeContains(r, cell)).toBe(true);
      }),
    );
  });

  it('속성: 열·행 범위는 8칸', () => {
    for (const col of COLS) expect(rangeCells(hintRange({ kind: 'col', col }))).toHaveLength(8);
    for (const row of ROWS) expect(rangeCells(hintRange({ kind: 'row', row }))).toHaveLength(8);
  });

  it('isHintTarget', () => {
    expect(isHintTarget({ kind: 'col', col: 'E' })).toBe(true);
    expect(isHintTarget({ kind: 'row', row: 8 })).toBe(true);
    expect(isHintTarget({ kind: 'block', cell: 'B7' })).toBe(true);
    for (const bad of [
      { kind: 'col', col: 'I' },
      { kind: 'row', row: 0 },
      { kind: 'row', row: '3' },
      { kind: 'block', cell: 'B9' },
      { kind: 'cell', cell: 'B7' },
      null,
      'E',
    ]) {
      expect(isHintTarget(bad)).toBe(false);
    }
  });
});

describe('배', () => {
  it('가로·세로 칸 목록', () => {
    expect(shipCells('B2', 'h', 4)).toEqual(['B2', 'C2', 'D2', 'E2']);
    expect(shipCells('B2', 'v', 3)).toEqual(['B2', 'B3', 'B4']);
    expect(placementCells({ slot: 'L2', start: 'G8', dir: 'h' })).toEqual(['G8', 'H8']);
  });

  it('판 밖으로 나가면 null', () => {
    expect(shipCells('F1', 'h', 4)).toBeNull();
    expect(shipCells('A6', 'v', 4)).toBeNull();
    expect(placementCells({ slot: 'L2', start: 'H8', dir: 'v' })).toBeNull();
    expect(shipCells('A1', 'h', 0)).toBeNull();
  });

  it('범위 → 배치: 1×n 가로, n×1 세로, 그 외 rangeLen', () => {
    const r = (s: string) => {
      const p = parseRange(s);
      if (!p.ok) throw new Error(s);
      return p.range;
    };
    expect(rangeToPlacement(r('B2:E2'), 4)).toEqual({ ok: true, start: 'B2', dir: 'h' });
    expect(rangeToPlacement(r('E2:B2'), 4)).toEqual({ ok: true, start: 'B2', dir: 'h' });
    expect(rangeToPlacement(r('C3:C5'), 3)).toEqual({ ok: true, start: 'C3', dir: 'v' });
    expect(rangeToPlacement(r('B2:D2'), 4)).toEqual({ ok: false, reason: 'rangeLen' });
    expect(rangeToPlacement(r('B2:C3'), 2)).toEqual({ ok: false, reason: 'rangeLen' });
    expect(rangeToPlacement(r('B2'), 2)).toEqual({ ok: false, reason: 'rangeLen' });
  });

  it('속성: 배치 → 범위 → 배치 왕복(판 안인 경우)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...SHIP_SLOTS), arbCell, fc.constantFrom('h' as const, 'v' as const), (slot, start, dir) => {
        const p = { slot, start, dir };
        const cells = placementCells(p);
        const range = placementRange(p);
        if (!cells) {
          expect(range).toBeNull();
          return;
        }
        expect(cells).toHaveLength(SHIP_LENGTH[slot]);
        expect(range).not.toBeNull();
        expect(rangeToPlacement(range as NonNullable<typeof range>, SHIP_LENGTH[slot])).toEqual({ ok: true, start, dir });
        expect(rangeCells(range as NonNullable<typeof range>)).toEqual(cells);
      }),
    );
  });
});

describe('경계 규칙(방향서 §7 규칙 4-②)', () => {
  it('coords.ts·constants.ts는 React·DOM·node:*·Date.now·Math.random을 쓰지 않는다', () => {
    for (const file of ['coords.ts', 'constants.ts']) {
      const src = readFileSync(path.join(__dirname, file), 'utf8');
      const imports = [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith('./')).toBe(true);
      }
      expect(src).not.toMatch(/\b(window|document|navigator|localStorage)\b\./);
      expect(src).not.toMatch(/Date\.now|Math\.random/);
    }
  });
});

// 타입 수준 확인: CellAddr 리터럴 유니언이 64개 칸과 일치(잘못된 문자열은 컴파일 오류)
const _typeCheck: CellAddr[] = ['A1', 'H8'];
void _typeCheck;
