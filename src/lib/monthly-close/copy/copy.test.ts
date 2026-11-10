/**
 * 문구 팩 검사 (V22~V24, G0-6 규칙 1~3 중 기계로 잡히는 부분) + pick.ts 조사·고르기.
 * 스키마는 동결(copy/schema.ts). 여기서는 4개 팩을 그 스키마로 parse하고, 스키마가 못 잡는 것을 더 본다.
 */
import { describe, expect, it } from 'vitest';
import accounting from './accounting.json';
import common from './common.json';
import hr from './hr.json';
import sales from './sales.json';
import {
  BRAND_WORDS,
  COPY_LIMITS,
  commonPackSchema,
  findTokens,
  industryPackSchema,
  measureCopy,
  RANK_WORDS,
} from './schema';
import {
  COMMON_PACK,
  fileNameOf,
  fillCopy,
  formatClock,
  hasBatchim,
  INDUSTRY_PACKS,
  josa,
  memoLine,
  Picker,
  quizLabel,
  shareText,
  shipLongNames,
} from './pick';
import { INDUSTRIES, SHIP_SLOTS, TAUNT_COUNT } from '../constants';

const RAW = { accounting, sales, hr } as const;

function strings(v: unknown, path = '', out: Array<[string, string]> = []): Array<[string, string]> {
  if (typeof v === 'string') out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => strings(x, `${path}/${i}`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) strings(x, `${path}/${k}`, out);
  return out;
}

describe('문구 팩 스키마', () => {
  it('common.json이 동결 스키마를 통과한다', () => {
    const r = commonPackSchema.safeParse(common);
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
  });

  for (const key of INDUSTRIES) {
    it(`${key}.json이 동결 스키마를 통과한다`, () => {
      const r = industryPackSchema.safeParse(RAW[key]);
      expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)).toEqual([]);
    });
  }
});

describe('개수와 규칙', () => {
  it('도발은 정확히 TAUNT_COUNT개, 모두 40자 이하', () => {
    expect(COMMON_PACK.taunts).toHaveLength(TAUNT_COUNT);
    for (const t of COMMON_PACK.taunts) expect(measureCopy(t)).toBeLessThanOrEqual(COPY_LIMITS.memo);
  });

  for (const key of INDUSTRIES) {
    const p = INDUSTRY_PACKS[key];
    it(`${key}: 짧은 이름 2~3자, 검산 라벨 종류별 7개 이상, 메모 해당 없음/반려 6개 이상`, () => {
      for (const s of SHIP_SLOTS) {
        const n = Array.from(p.ships[s].short).length;
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(3);
        expect(p.ships[s].long).toHaveLength(3);
        expect(p.memo.sunk[s].length).toBeGreaterThanOrEqual(2);
      }
      for (const k of ['sum', 'vat', 'diff'] as const) expect(p.quiz[k].labels.length).toBeGreaterThanOrEqual(7);
      expect(p.memo.miss.length).toBeGreaterThanOrEqual(6);
      expect(p.memo.hit.length).toBeGreaterThanOrEqual(6);
      expect(p.alarm.length).toBeGreaterThanOrEqual(4);
    });

    it(`${key}: 목록 안에 같은 문구가 두 번 나오지 않는다`, () => {
      const lists: Record<string, string[]> = {
        miss: [...p.memo.miss],
        hit: [...p.memo.hit],
        alarm: [...p.alarm],
        'quiz.sum': [...p.quiz.sum.labels],
        'quiz.vat': [...p.quiz.vat.labels],
        'quiz.diff': [...p.quiz.diff.labels],
      };
      for (const [name, l] of Object.entries(lists)) expect({ name, dup: l.length - new Set(l).size }).toEqual({ name, dup: 0 });
    });

    it(`${key}: 결과 문서가 시말서를 제출한다 (경위서 아님, 디자인 D2)`, () => {
      expect(p.result.reprimand[0]).toContain('시말서를 제출합니다');
      for (const b of p.result.reprimand) expect(b.includes('경위서를 제출')).toBe(false);
    });

    it(`${key}: 결과 문서는 {배} 을(를) 표기를 쓰지 않는다 (디자인 D3)`, () => {
      for (const kind of ['reprimand', 'award', 'joint'] as const) for (const b of p.result[kind]) expect(b.includes('을(를)')).toBe(false);
    });
  }

  it('엉뚱한 명중 문구 6줄이 원문 그대로 들어 있다 (디자인 §8-2)', () => {
    expect(INDUSTRY_PACKS.accounting.memo.hit).toContain('{c} 건 반려되었습니다. 사유: 그냥요');
    expect(INDUSTRY_PACKS.accounting.memo.hit).toContain('{c} 영수증이 감열지라 글씨가 다 날아갔습니다.');
    expect(INDUSTRY_PACKS.sales.memo.hit).toContain("{c} 건 고객사가 '내부 검토 후 연락 주신다'고 합니다.");
    expect(INDUSTRY_PACKS.sales.memo.hit).toContain('{c} 건 담당자가 휴가 중입니다. (3주)');
    expect(INDUSTRY_PACKS.hr.memo.hit).toContain('{c} 건 반려. 금요일 오후 반차는 원래 반려입니다.');
    expect(INDUSTRY_PACKS.hr.memo.hit).toContain("{c} 사유서 사유란에 '그냥'이라고 적혀 있습니다.");
  });
});

describe('금지어·직급어 (V22, V24)', () => {
  it('legal 필드 밖에는 상표어가 없다', () => {
    const bad: string[] = [];
    for (const [path, s] of [...strings(common), ...strings(accounting), ...strings(sales), ...strings(hr)]) {
      if (path === '/legal') continue;
      const lower = s.toLowerCase();
      for (const w of BRAND_WORDS) if (lower.includes(w)) bad.push(`${path}:${w}`);
    }
    expect(bad).toEqual([]);
    expect(COMMON_PACK.legal).toContain('Microsoft');
  });

  it('베타 표기는 결과 문서 꼬리 한 곳에만 있다', () => {
    const found = [...strings(common), ...strings(accounting), ...strings(sales), ...strings(hr)].filter(([, s]) => s.includes('베타')).map(([p]) => p);
    expect(found).toEqual(['/resultDocs/tails/beta']);
  });

  it('숨기기 시트·표 이름·탭·파일명(등급 0·1)에는 직급어가 없다', () => {
    const bad: string[] = [];
    for (const key of INDUSTRIES) {
      const p = RAW[key];
      const g01: Array<[string, string]> = [
        ...strings(p.disguise, `${key}/disguise`),
        ...strings(p.tabs, `${key}/tabs`),
        ...strings(p.deco, `${key}/deco`),
        [`${key}/fileName`, p.fileName],
        [`${key}/formName`, p.formName],
      ];
      for (const s of SHIP_SLOTS) {
        g01.push([`${key}/ships/${s}/short`, p.ships[s].short], [`${key}/ships/${s}/table`, p.ships[s].table]);
      }
      for (const [path, text] of g01) for (const w of RANK_WORDS) if (text.includes(w)) bad.push(`${path}:${w}`);
    }
    expect(bad).toEqual([]);
  });

  it('"부장님 법카 내역"은 회계 L4 긴 이름 0번(고정 노출 후보)이다', () => {
    expect(INDUSTRY_PACKS.accounting.ships.L4.long[0]).toBe('부장님 법카 내역');
  });
});

describe('토큰', () => {
  it('모든 문장의 토큰이 알려진 토큰이다', () => {
    const known = new Set(['{c}', '{좌표}', '{R}', '{n}', '{n+1}', '{상대}', '{t}', '{배}', '{배:을}', '{배:이}', '{배:은}', '{탭}', '{결과}', '{경위}', '{HH:MM}', '{date}', '{문서종류}', '{파일명}', '{a}', '{b}']);
    const bad: string[] = [];
    for (const [path, s] of [...strings(common), ...strings(accounting), ...strings(sales), ...strings(hr)]) {
      for (const t of findTokens(s)) if (!known.has(t)) bad.push(`${path}:${t}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('pick.ts 조사', () => {
  it('받침 판정: 한글 음절과 숫자', () => {
    expect(hasBatchim('영수증')).toBe(true);
    expect(hasBatchim('법카 내역')).toBe(true);
    expect(hasBatchim('미수금')).toBe(true);
    expect(hasBatchim('견적 대기')).toBe(false);
    expect(hasBatchim('B7')).toBe(true); // 칠
    expect(hasBatchim('C2')).toBe(false); // 이
    expect(hasBatchim('A3')).toBe(true); // 삼
    expect(hasBatchim('D4')).toBe(false); // 사
    expect(hasBatchim('')).toBe(false);
  });

  it('josa()가 을/를·이/가·은/는을 고른다', () => {
    expect(josa('영수증', '을')).toBe('을');
    expect(josa('연차 신청', '을')).toBe('을');
    expect(josa('견적 대기', '을')).toBe('를');
    expect(josa('견적 대기', '이')).toBe('가');
    expect(josa('견적 대기', '은')).toBe('는');
    expect(josa('미수금', '이')).toBe('이');
    expect(josa('정정 요청', '은')).toBe('은');
  });

  it('{배:을} 토큰을 채운다 (3업종 × 3슬롯 모두 어색한 "을(를)" 없이)', () => {
    for (const key of INDUSTRIES) {
      const p = INDUSTRY_PACKS[key];
      for (const s of SHIP_SLOTS) {
        const name = p.ships[s].table;
        const out = fillCopy(p.result.award[0] ?? '', { R: 7, 좌표: 'B7', 배: name });
        expect(out.includes('{')).toBe(false);
        expect(out).toContain(`${name}${josa(name, '을')} 포함한`);
      }
    }
    expect(fillCopy('{배:을}, {배:이}, {배:은}', { 배: '견적 대기' })).toBe('견적 대기를, 견적 대기가, 견적 대기는');
  });

  it('{c} 뒤에 붙은 조사는 좌표 읽기에 맞춘다', () => {
    expect(fillCopy('{상대}님이 {c}을 검토했습니다.', { 상대: '민수', c: 'B7' })).toBe('민수님이 B7을 검토했습니다.');
    expect(fillCopy('{상대}님이 {c}을 검토했습니다.', { 상대: '민수', c: 'C2' })).toBe('민수님이 C2를 검토했습니다.');
    expect(fillCopy('{c}을', { c: 'A1' })).toBe('A1을');
    expect(fillCopy('{c}을', { c: 'H5' })).toBe('H5를');
  });

  it('값이 없는 토큰은 그대로 둔다', () => {
    expect(fillCopy('{t} 남음', {})).toBe('{t} 남음');
  });

  it('formatClock·fileNameOf', () => {
    expect(formatClock(14_000)).toBe('00:14');
    expect(formatClock(13_001)).toBe('00:14');
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(90_000)).toBe('01:30');
    expect(fileNameOf(INDUSTRY_PACKS.accounting, 7)).toBe('월마감_최종_진짜최종_v7');
    expect(fileNameOf(INDUSTRY_PACKS.sales, 8)).toBe('파이프라인_v8');
    expect(fileNameOf(INDUSTRY_PACKS.hr, 7)).toBe('연차사용현황_v7');
  });
});

describe('pick.ts 고르기', () => {
  it('같은 시드는 같은 결과, 한 판 안에서는 목록을 다 쓸 때까지 중복이 없다', () => {
    const list = INDUSTRY_PACKS.accounting.memo.miss;
    const a = new Picker('room-1');
    const seen = new Set<number>();
    for (let i = 0; i < list.length; i++) seen.add(a.pick(list, 'm').index);
    expect(seen.size).toBe(list.length);
    const b = new Picker('room-1');
    const c = new Picker('room-1');
    expect(b.pick(list, 'm')).toEqual(c.pick(list, 'm'));
  });

  it('다 쓰면 처음부터 다시 쓴다', () => {
    const p = new Picker(1);
    const list = ['a', 'b'];
    const out = [p.pick(list, 'k').text, p.pick(list, 'k').text, p.pick(list, 'k').text];
    expect(new Set(out.slice(0, 2)).size).toBe(2);
    expect(list).toContain(out[2]);
  });

  it('회계 첫 판·연습은 L4 긴 이름이 부장님 법카 내역으로 고정, 다른 업종은 고정 없음', () => {
    const acc = INDUSTRY_PACKS.accounting;
    for (let i = 0; i < 20; i++) expect(shipLongNames(acc, { fixedFirst: true, seed: `s${i}` }).L4).toBe('부장님 법카 내역');
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(shipLongNames(acc, { fixedFirst: false, seed: `s${i}` }).L4);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('memoLine이 좌표를 채우고 문구 id를 돌려준다', () => {
    const p = INDUSTRY_PACKS.hr;
    const m = memoLine(p, new Picker(3), 'miss', 'B7');
    expect(m.text).toContain('B7');
    expect(m.text.includes('{')).toBe(false);
    expect(m.id).toMatch(/^hr\/memo\.miss\/\d$/);
    const s = memoLine(p, new Picker(3), 'sunk', 'B7', 'L4');
    expect(s.id).toMatch(/^hr\/memo\.sunk\.L4\/\d$/);
  });

  it('quizLabel은 labelSeed % 개수로 고른다', () => {
    const p = INDUSTRY_PACKS.sales;
    expect(quizLabel(p, 'vat', 9).text).toBe(p.quiz.vat.labels[2]);
  });

  it('공유 텍스트 5줄, 경위는 60자에서 …', () => {
    const t = shareText({ docKind: 'award', fileName: '월마감_최종_진짜최종_v7', round: 9, mine: 2, theirs: 1, body: `${'가'.repeat(70)}. 둘째 문장.` });
    const lines = t.split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe('[월마감] 포상 품의서 · 월마감_최종_진짜최종_v7');
    expect(lines[1]).toBe('9회차 · 종결 2건 / 1건 · 결재 완료');
    expect(lines[2]).toBe(`경위: ${'가'.repeat(60)}…`);
    expect(lines[3]).toBe('(게임 결과입니다)');
    expect(lines[4]).toContain('project-orsrw.vercel.app/monthly-close');
    for (const l of lines) expect(Array.from(l).length).toBeLessThanOrEqual(80);
  });
});
