import type { StoryNode } from '../types';
import { c1 } from './c1';
import { c2 } from './c2';
import { c3 } from './c3';
import { c4 } from './c4';
import { c5 } from './c5';
import { c6 } from './c6';
import { c7 } from './c7';

export { ENDINGS } from './endings';

export const START_NODE = 'c1_start';

/** 장별 원본 — 무결성 검사에서 중복 id 를 잡기 위해 따로 노출한다. */
export const CHAPTER_SOURCES: [string, Record<string, StoryNode>][] = [
  ['c1', c1],
  ['c2', c2],
  ['c3', c3],
  ['c4', c4],
  ['c5', c5],
  ['c6', c6],
  ['c7', c7],
];

export const NODES: Record<string, StoryNode> = Object.assign({}, c1, c2, c3, c4, c5, c6, c7);
