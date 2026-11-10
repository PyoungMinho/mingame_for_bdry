/**
 * 월마감 경계 규칙 + 계약 고정 테스트 — D0 (소유: 백엔드팀장).
 *
 * 방향서 §7 병렬 규칙 4를 소스 검사로 강제한다. 아직 없는 폴더(engine/·server/·_screens/ 등)는 비어 있는 채로 통과하고,
 * 파일이 생기는 순간부터 검사된다. 규칙 함수가 실제로 잡는지는 아래 "규칙 자체" 묶음이 가짜 소스로 확인한다.
 *
 *  ① server/ 는 server/ 자신과 API 라우트(src/app/api/monthly-close)만 import한다.
 *     → "use client" 파일, client/·_components/·_screens/·sheet/·engine/ 등 나머지는 전부 금지
 *     (화면 쪽 page.tsx·layout.tsx도 금지 = 방 상태 SSR 금지 §4-2를 구조로 막음).
 *  ② 순수 모듈(engine/·sheet/·coords.ts·constants.ts·protocol.ts)은 React·Next·DOM·node:*·Supabase·process.env를 쓰지 않는다.
 *     engine/은 sheet/·copy/·client/도 import하지 않는다.
 *  ③ engine/은 Date.now·Math.random·인자 없는 new Date()·performance.now·crypto 난수를 쓰지 않는다(시각·난수는 인자로 주입).
 *  ④ SUPABASE_SERVICE_ROLE_KEY는 server/ 안에서만 읽는다(백엔드 §7).
 *  ⑤ 다른 앱 코드를 import하지 않는다(B5: src/lib/pae 등). 허용: monthly-close 안, src/lib/utils.
 * 테스트 파일(*.test.ts(x))과 qa/는 검사 대상이 아니다(통합 테스트는 server를 불러야 한다).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  MC_KEY_RE,
  ROOM_CODE_RE,
  VIEW_FORBIDDEN_KEYS,
  type EndedView,
  type GameEventView,
  type PlayingView,
  type QuizView,
  type SyncOk,
  type TurnClock,
} from './protocol';
import { ROOM_CODE_MAX, ROOM_CODE_MIN } from './constants';

// ─── 경로 ─────────────────────────────────────────────────────────────────────

const LIB = __dirname; // src/lib/monthly-close
const SRC = path.resolve(LIB, '..', '..');
const APP = path.join(SRC, 'app', 'monthly-close');
const API = path.join(SRC, 'app', 'api', 'monthly-close');
const SERVER = path.join(LIB, 'server');
const ENGINE = path.join(LIB, 'engine');
const SHEET = path.join(LIB, 'sheet');
const CLIENT = path.join(LIB, 'client');
const COPY = path.join(LIB, 'copy');
const QA = path.join(LIB, 'qa');

const rel = (f: string) => path.relative(SRC, f);
const within = (f: string, dir: string) => f === dir || f.startsWith(dir + path.sep);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const ALL_FILES = [...walk(LIB), ...walk(APP), ...walk(API)].filter((f) => !within(f, QA));

// ─── 규칙 함수(순수) ──────────────────────────────────────────────────────────

/** 주석 제거("https://" 같은 문자열 안의 // 는 남긴다). 금지 패턴이 설명 주석에 적혀 있어도 걸리지 않게. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
}

/** import·export from·동적 import·require의 지정자 목록. */
function importSpecs(src: string): string[] {
  const code = stripComments(src);
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
  return [...code.matchAll(re)].map((m) => m[1]);
}

function isUseClient(src: string): boolean {
  return /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*\s*['"]use client['"]/.test(src);
}

/** 지정자 → 절대 경로(src 안일 때만). 패키지면 null. */
function resolveSpec(fromFile: string, spec: string): string | null {
  if (spec.startsWith('@/')) return path.join(SRC, spec.slice(2));
  if (spec.startsWith('./') || spec.startsWith('../')) return path.resolve(path.dirname(fromFile), spec);
  return null;
}

const NODE_BUILTINS = new Set([
  'fs', 'path', 'crypto', 'os', 'child_process', 'http', 'https', 'net', 'tls', 'url', 'util', 'stream',
  'buffer', 'events', 'zlib', 'worker_threads', 'perf_hooks', 'async_hooks', 'dns', 'module', 'process',
]);

/** 순수 모듈이 쓰면 안 되는 패키지. */
function forbiddenPackage(spec: string): boolean {
  if (spec.startsWith('node:')) return true;
  const root = spec.split('/')[0];
  if (NODE_BUILTINS.has(root)) return true;
  if (spec === 'react' || spec.startsWith('react/') || spec === 'react-dom' || spec.startsWith('react-dom/')) return true;
  if (spec === 'next' || spec.startsWith('next/')) return true;
  if (spec.startsWith('@supabase/')) return true;
  if (spec === 'server-only' || spec === 'client-only') return true;
  return false;
}

const DOM_RE = /\b(?:window|document|navigator|localStorage|sessionStorage|location)\s*\.|\brequestAnimationFrame\s*\(/;
const ENV_RE = /\bprocess\s*\.\s*env\b/;
const CLOCK_RANDOM_RES: readonly RegExp[] = [
  /\bDate\s*\.\s*now\s*\(/,
  /\bMath\s*\.\s*random\s*\(/,
  /\bnew\s+Date\s*\(\s*\)/,
  /\bnew\s+Date\b(?!\s*\()/,
  /\bperformance\s*\.\s*now\s*\(/,
  /\bcrypto\s*\.\s*(?:getRandomValues|randomUUID|randomBytes|randomInt)\s*\(/,
];

function pureViolations(src: string): string[] {
  const v: string[] = [];
  for (const s of importSpecs(src)) if (forbiddenPackage(s)) v.push(`import ${s}`);
  const code = stripComments(src);
  if (DOM_RE.test(code)) v.push('DOM 전역');
  if (ENV_RE.test(code)) v.push('process.env');
  if (isUseClient(src)) v.push('"use client"');
  return v;
}

function clockRandomViolations(src: string): string[] {
  const code = stripComments(src);
  return CLOCK_RANDOM_RES.filter((re) => re.test(code)).map((re) => re.source);
}

/** 다른 앱 코드인지(⑤). */
function isForeignAppPath(abs: string): boolean {
  if (!within(abs, SRC)) return false;
  if (within(abs, LIB) || within(abs, APP) || within(abs, API)) return false;
  const r = rel(abs).split(path.sep).join('/');
  if (/^lib\/utils(\.tsx?)?$/.test(r)) return false;
  return true;
}

// ─── 규칙 자체가 잡는지(가짜 소스) ─────────────────────────────────────────────

describe('경계 규칙 함수 자체', () => {
  it('import 지정자를 모두 뽑는다(정적·export from·동적·require·부수효과)', () => {
    const src = [
      "import a from './a';",
      "import type { B } from '../b';",
      "export { c } from './c';",
      "import './side';",
      "const d = await import('./d');",
      "const e = require('e');",
      "// import x from './commented';",
    ].join('\n');
    expect(importSpecs(src)).toEqual(['./a', '../b', './c', './side', './d', 'e']);
  });

  it('"use client" 지시문을 찾는다(앞 주석 허용, 중간 문자열은 무시)', () => {
    expect(isUseClient("'use client';\nexport const a = 1;")).toBe(true);
    expect(isUseClient('/** doc */\n"use client";\n')).toBe(true);
    expect(isUseClient("const s = 'use client';")).toBe(false);
  });

  it('순수 모듈 위반: React·node·Supabase·DOM·process.env를 잡고 주석은 무시', () => {
    expect(pureViolations("import { useState } from 'react';")).toContain('import react');
    expect(pureViolations("import fs from 'node:fs';")).toContain('import node:fs');
    expect(pureViolations("import { randomBytes } from 'crypto';")).toContain('import crypto');
    expect(pureViolations("import { createClient } from '@supabase/supabase-js';")).toHaveLength(1);
    expect(pureViolations('const w = window.innerWidth;')).toContain('DOM 전역');
    expect(pureViolations('const k = process.env.X;')).toContain('process.env');
    expect(pureViolations("// window.foo 는 쓰지 않는다\nimport { z } from 'zod';")).toEqual([]);
  });

  it('엔진 시각·난수 위반을 잡는다(주석·인자 있는 new Date는 통과)', () => {
    expect(clockRandomViolations('const t = Date.now();')).toHaveLength(1);
    expect(clockRandomViolations('const r = Math.random();')).toHaveLength(1);
    expect(clockRandomViolations('const d = new Date();')).toHaveLength(1);
    expect(clockRandomViolations('const d = new Date;')).toHaveLength(1);
    expect(clockRandomViolations('const p = performance.now();')).toHaveLength(1);
    expect(clockRandomViolations('crypto.getRandomValues(buf);')).toHaveLength(1);
    expect(clockRandomViolations('const d = new Date(now); // Date.now() 금지')).toEqual([]);
  });

  it('server/ 경로 해석과 다른 앱 경로 판정', () => {
    const from = path.join(CLIENT, 'useMcRoom.ts');
    expect(resolveSpec(from, '../server/db')).toBe(path.join(SERVER, 'db'));
    expect(resolveSpec(from, '@/lib/monthly-close/server/view')).toBe(path.join(SERVER, 'view'));
    expect(resolveSpec(from, 'zod')).toBeNull();
    expect(isForeignAppPath(path.join(SRC, 'lib', 'pae', 'auth'))).toBe(true);
    expect(isForeignAppPath(path.join(SRC, 'app', 'pae', 'page'))).toBe(true);
    expect(isForeignAppPath(path.join(SRC, 'lib', 'utils'))).toBe(false);
    expect(isForeignAppPath(path.join(LIB, 'coords'))).toBe(false);
  });
});

// ─── 실제 파일 검사 ───────────────────────────────────────────────────────────

describe('경계 규칙(방향서 §7 규칙 4) — 실제 파일', () => {
  it('검사 대상에 D0 동결 파일이 들어 있다(경로 계산 확인)', () => {
    const names = ALL_FILES.map(rel);
    for (const f of ['protocol.ts', 'constants.ts', 'coords.ts', 'copy/schema.ts', 'client/controller.ts']) {
      expect(names).toContain(path.join('lib', 'monthly-close', f));
    }
  });

  it('① server/는 server/ 자신과 API 라우트만 import한다', () => {
    const bad: string[] = [];
    for (const f of ALL_FILES) {
      if (within(f, SERVER) || within(f, API)) continue;
      for (const s of importSpecs(readFileSync(f, 'utf8'))) {
        const abs = resolveSpec(f, s);
        if (abs && within(abs, SERVER)) bad.push(`${rel(f)} → ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('① server/ 파일은 "use client"가 아니다', () => {
    const bad = walk(SERVER).filter((f) => isUseClient(readFileSync(f, 'utf8'))).map(rel);
    expect(bad).toEqual([]);
  });

  it('② 순수 모듈(engine/·sheet/·coords·constants·protocol)은 React·Next·DOM·node·Supabase·env를 쓰지 않는다', () => {
    const pure = [
      ...walk(ENGINE),
      ...walk(SHEET),
      path.join(LIB, 'coords.ts'),
      path.join(LIB, 'constants.ts'),
      path.join(LIB, 'protocol.ts'),
    ];
    const bad: string[] = [];
    for (const f of pure) {
      const src = readFileSync(f, 'utf8');
      for (const v of pureViolations(src)) bad.push(`${rel(f)}: ${v}`);
      for (const s of importSpecs(src)) {
        const abs = resolveSpec(f, s);
        if (abs && (within(abs, CLIENT) || within(abs, APP))) bad.push(`${rel(f)} → ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('② engine/은 sheet/·copy/·client/를 import하지 않는다', () => {
    const bad: string[] = [];
    for (const f of walk(ENGINE)) {
      for (const s of importSpecs(readFileSync(f, 'utf8'))) {
        const abs = resolveSpec(f, s);
        if (abs && (within(abs, SHEET) || within(abs, COPY) || within(abs, CLIENT))) bad.push(`${rel(f)} → ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('③ engine/은 Date.now·Math.random·new Date()·performance.now·crypto 난수를 쓰지 않는다', () => {
    const bad: string[] = [];
    for (const f of walk(ENGINE)) for (const v of clockRandomViolations(readFileSync(f, 'utf8'))) bad.push(`${rel(f)}: ${v}`);
    expect(bad).toEqual([]);
  });

  it('④ SUPABASE_SERVICE_ROLE_KEY는 server/ 안에서만 나온다', () => {
    const bad = ALL_FILES.filter(
      (f) => !within(f, SERVER) && stripComments(readFileSync(f, 'utf8')).includes('SUPABASE_SERVICE_ROLE_KEY'),
    ).map(rel);
    expect(bad).toEqual([]);
  });

  it('⑤ 다른 앱 코드(src/lib/pae 등, 다른 라우트)를 import하지 않는다', () => {
    const bad: string[] = [];
    for (const f of ALL_FILES) {
      for (const s of importSpecs(readFileSync(f, 'utf8'))) {
        const abs = resolveSpec(f, s);
        if (abs && isForeignAppPath(abs)) bad.push(`${rel(f)} → ${s}`);
      }
    }
    expect(bad).toEqual([]);
  });
});

// ─── 계약 고정(값) ────────────────────────────────────────────────────────────

describe('계약 값', () => {
  it('모든 오류 코드에 HTTP 상태가 있고, 표에 남는 코드가 없다', () => {
    expect(Object.keys(ERROR_HTTP_STATUS).sort()).toEqual([...ERROR_CODES].sort());
    expect(ERROR_HTTP_STATUS.NOT_JOINED).toBe(403);
    expect(ERROR_HTTP_STATUS.ROOM_FULL).toBe(409);
    expect(ERROR_HTTP_STATUS.SERVICE_DOWN).toBe(503);
  });

  it('ROOM_CODE_RE는 ROOM_CODE_MIN~MAX와 같은 범위다', () => {
    expect(ROOM_CODE_RE.test(String(ROOM_CODE_MIN))).toBe(true);
    expect(ROOM_CODE_RE.test(String(ROOM_CODE_MAX))).toBe(true);
    expect(ROOM_CODE_RE.test(String(ROOM_CODE_MIN - 1))).toBe(false);
    expect(ROOM_CODE_RE.test(String(ROOM_CODE_MAX + 1))).toBe(false);
    expect(ROOM_CODE_RE.test('01234')).toBe(false);
  });

  it('MC_KEY_RE는 16바이트 소문자 hex만 받는다', () => {
    expect(MC_KEY_RE.test('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(MC_KEY_RE.test('0123456789ABCDEF0123456789ABCDEF')).toBe(false);
    expect(MC_KEY_RE.test('0123456789abcdef')).toBe(false);
  });

  it('대전 중 화면 데이터 견본의 직렬화 결과에 금지 키가 없다(타입 필드 이름 회귀 방지)', () => {
    const json = JSON.stringify(PLAYING_SAMPLE);
    const keys = new Set([...json.matchAll(/"([A-Za-z_]+)":/g)].map((m) => m[1]));
    for (const k of VIEW_FORBIDDEN_KEYS) expect(keys.has(k), k).toBe(false);
    expect(Object.keys(PLAYING_SAMPLE.opp)).not.toContain('ships');
  });
});

// ─── 계약 고정(타입) — tsc가 검사한다. @ts-expect-error 아래 줄이 컴파일되면 type-check가 실패한다 ───

const PLAYING_SAMPLE: PlayingView = {
  status: 'playing',
  room: {
    code: '12345',
    version: 7,
    matchSeq: 1,
    alarmOn: true,
    record: { wins: [0, 0], draws: 0 },
    bellTopic: 'mc:00000000-0000-0000-0000-000000000000',
  },
  me: {
    seat: 0,
    nickname: '김',
    industry: 0,
    placed: true,
    consecutiveTimeouts: 0,
    ships: [
      { slot: 'L4', start: 'A1', dir: 'h' },
      { slot: 'L3', start: 'A3', dir: 'v' },
      { slot: 'L2', start: 'H7', dir: 'v' },
    ],
    hideBudgetMs: 120_000,
    hintsEarned: 1,
    hintsAvailable: 0,
    hints: [{ target: { kind: 'col', col: 'E' }, value: 2, round: 4, at: 1 }],
    quizLockUntil: null,
    skipNextFire: false,
    nextTauntRound: 1,
  },
  opp: {
    seat: 1,
    nickname: 'B',
    industry: 1,
    placed: true,
    consecutiveTimeouts: 0,
    present: true,
    lastSeenAt: 1,
    hidden: false,
  },
  events: [
    { seq: 9, at: 1, round: 5, type: 'fire', by: 0, cell: 'B7', result: 'hit' },
    { seq: 10, at: 2, round: 5, type: 'fire', by: 1, cell: 'H8', result: 'sunk', slot: 'L2' },
  ],
  game: {
    matchId: '00000000-0000-0000-0000-000000000001',
    round: 5,
    phase: 'fire',
    turn: 0,
    firstSeat: 0,
    clock: { state: 'paused', reason: 'hidden', remainingMs: 12_000, budgetEndsAt: 3 },
    myShots: [{ cell: 'B7', result: 'hit', round: 5 }],
    oppShots: [{ cell: 'H8', result: 'sunk', round: 5 }],
    sunkByMe: [],
    sunkByOpp: [{ slot: 'L2', round: 5 }],
    log: [{ seq: 1, at: 1, round: 4, by: 1, type: 'hint', target: { kind: 'block', cell: 'C4' } }],
    quiz: null,
    alarm: null,
  },
};

const _reveal: PlayingView = {
  ...PLAYING_SAMPLE,
  // @ts-expect-error 상대 배 공개(reveal)는 EndedView에만 존재한다
  reveal: [],
};

// @ts-expect-error 아직 풀이 중인 사람에게는 'settling'(상대가 맞혔다는 신호)을 보낼 수 없다
const _quizOpenSettling: QuizView = {
  id: 'q',
  kind: 'sum',
  values: [1, 2, 3],
  labelSeed: 0,
  deadlineAt: 0,
  mine: 'open',
  status: 'settling',
  settleAt: null,
};

const _quizCorrectSettling: QuizView = {
  id: 'q',
  kind: 'vat',
  values: [10_000],
  labelSeed: 0,
  deadlineAt: 0,
  mine: 'correct',
  status: 'settling',
  settleAt: 5,
};

// @ts-expect-error 반려(hit) 사건에는 슬롯을 실을 수 없다(맞힌 배의 길이 노출)
const _hitWithSlot: GameEventView = { seq: 1, at: 0, round: 1, type: 'fire', by: 0, cell: 'A1', result: 'hit', slot: 'L4' };

// @ts-expect-error 숨기기 정지에는 budgetEndsAt이 필요하다
const _hiddenNoBudget: TurnClock = { state: 'paused', reason: 'hidden', remainingMs: 1 };

const _syncUnchanged: SyncOk = { ok: true, serverNow: 0, changed: false, version: 7, presence: null };

const _endedHasReveal = (v: EndedView) => v.reveal.length + v.game.matchId.length;

void _reveal;
void _quizOpenSettling;
void _quizCorrectSettling;
void _hitWithSlot;
void _hiddenNoBudget;
void _syncUnchanged;
void _endedHasReveal;
