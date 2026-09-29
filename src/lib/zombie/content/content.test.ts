import { describe, expect, it } from 'vitest';
import { formatIssues, validateChapter, validateStory } from '../validate';
import { CHAPTER_SOURCES, ENDINGS } from './index';

describe('zombie content — chapter', () => {
  for (const [name, nodes] of CHAPTER_SOURCES) {
    it(`chapter ${name} 구조`, () => {
      const errors = validateChapter(nodes).filter((i) => i.level === 'error');
      expect(Object.keys(nodes).length, `${name} 가 비어 있음`).toBeGreaterThan(0);
      expect(errors, formatIssues(errors)).toEqual([]);
    });
  }
});

describe('zombie content — story', () => {
  it('전체 그래프 무결성 (도달성·엔딩·플래그·아이템)', () => {
    const issues = validateStory(CHAPTER_SOURCES, ENDINGS);
    const errors = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level === 'warn');
    if (warns.length) console.warn(formatIssues(warns));
    expect(errors, formatIssues(errors)).toEqual([]);
  });
});
