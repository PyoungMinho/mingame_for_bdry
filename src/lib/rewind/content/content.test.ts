import { describe, expect, it } from 'vitest';
import { MARKET } from '../market-data';
import { formatIssues, validateNodes, validateStory } from '../validate';
import { CHAPTER_SOURCES, ENDINGS, NODES, START_NODE } from './index';

describe('rewind content — chapter', () => {
  for (const [name, nodes] of CHAPTER_SOURCES) {
    it(`chapter ${name} 구조`, () => {
      expect(Object.keys(nodes).length, `${name} 비어 있음`).toBeGreaterThan(0);
      // 장 단독 검사: 다른 장으로 가는 next 는 여기서 모르므로 "없는 다음 노드"·시간역행 오류는 전체 검사에서 본다
      const errors = validateNodes(nodes, MARKET).filter((i) => i.level === 'error' && !i.msg.startsWith('없는 다음 노드'));
      expect(errors, formatIssues(errors)).toEqual([]);
    });
  }
});

describe('rewind content — story', () => {
  it('전체 그래프 무결성 (도달성·엔딩까지·시간·매매 참조·플래그·엔딩)', () => {
    const ids = new Map<string, string>();
    const dup: string[] = [];
    for (const [name, nodes] of CHAPTER_SOURCES) for (const id of Object.keys(nodes)) ids.has(id) ? dup.push(`${id} (${ids.get(id)}, ${name})`) : ids.set(id, name);
    expect(dup, '장 사이 노드 id 중복').toEqual([]);
    const issues = validateStory(NODES, ENDINGS, MARKET, START_NODE);
    const errors = issues.filter((i) => i.level === 'error');
    const warns = issues.filter((i) => i.level === 'warn');
    if (warns.length) console.warn(formatIssues(warns));
    expect(errors, formatIssues(errors)).toEqual([]);
  });
});
