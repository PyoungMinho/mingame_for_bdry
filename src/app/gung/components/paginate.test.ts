import { describe, expect, it } from 'vitest';
import { PAGE_CHARS, paginateItems, paginateText } from './paginate';
import { sejaCase } from '@/lib/gung/case-data';

describe('paginate (§5-7 쪽 나눔)', () => {
  it('짧으면 1쪽, 원문 글자는 하나도 잃지 않는다', () => {
    expect(paginateText('짧은 단서.')).toEqual(['짧은 단서.']);
    for (const r of sejaCase.rounds) {
      for (const cards of Object.values(r.clues)) {
        for (const c of cards) {
          const pages = paginateText(c.body);
          expect(pages.join('').replace(/\s/g, '')).toBe(c.body.replace(/\s/g, ''));
        }
      }
    }
  });
  it('문장 하나가 기준보다 길지 않으면 각 쪽은 기준 이하', () => {
    const long = Array.from({ length: 12 }, (_, i) => `${i}번째 문장은 이 정도 길이로 적혀 있다.`).join(' ');
    for (const p of paginateText(long)) expect(p.length).toBeLessThanOrEqual(PAGE_CHARS);
  });
  it('목록은 항목을 쪼개지 않는다', () => {
    const items = Array.from({ length: 9 }, (_, i) => 'x'.repeat(40) + i);
    const pages = paginateItems(items, (x) => x.length);
    expect(pages.flat()).toEqual(items);
    expect(pages.length).toBeGreaterThan(1);
  });
});
