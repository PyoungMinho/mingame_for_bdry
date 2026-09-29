import type { StoryNode } from '../types';
import { c1 } from './c1';
import { c2a } from './c2a';
import { c2b } from './c2b';
import { c3 } from './c3';
import { c4 } from './c4';
import { c5 } from './c5';

export { ENDINGS } from './endings';

/** 챕터별 원본 — 무결성 검사에서 중복 id 를 잡기 위해 따로 노출한다. */
export const CHAPTER_SOURCES: [string, Record<string, StoryNode>][] = [
  ['c1', c1],
  ['c2a', c2a],
  ['c2b', c2b],
  ['c3', c3],
  ['c4', c4],
  ['c5', c5],
];

export const NODES: Record<string, StoryNode> = Object.assign({}, c1, c2a, c2b, c3, c4, c5);
