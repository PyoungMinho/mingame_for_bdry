import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CSS = readFileSync(path.resolve(__dirname, '..', 'monthly-close.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = hex.length === 4 ? hex.slice(1).split('').map((x) => x + x).join('') : hex.slice(1);
  const r = parseInt(n.slice(0, 2), 16) / 255;
  const g = parseInt(n.slice(2, 4), 16) / 255;
  const b = parseInt(n.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

describe('monthly-close.css 규칙', () => {
  it('녹색 계열(색상각 80~170°, 채도 10%+)이 없다', () => {
    const hexes = CSS.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
    expect(hexes.length).toBeGreaterThan(40);
    const bad = hexes.filter((x) => {
      const { h, s } = hexToHsl(x);
      return s >= 0.1 && h >= 80 && h <= 170;
    });
    expect(bad).toEqual([]);
    const rgbas = [...CSS.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)];
    for (const m of rgbas) {
      const hex = '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
      const { h, s } = hexToHsl(hex);
      expect(s >= 0.1 && h >= 80 && h <= 170, hex).toBe(false);
    }
  });

  it('움직임: transition/animation 은 none 뿐, @keyframes 없음', () => {
    expect(CSS).not.toMatch(/@keyframes/);
    for (const m of CSS.matchAll(/(?:^|[;{\s])(transition|animation)\s*:\s*([^;}]+)/g)) {
      expect(m[2].trim().replace('!important', '').trim()).toBe('none');
    }
  });

  it('손 모양 커서 금지', () => {
    expect(CSS).not.toMatch(/cursor\s*:\s*pointer/);
  });

  it('모든 선택자가 mc- 범위 (루트 앱과 겹치지 않는다)', () => {
    const selectors = CSS.replace(/\{[^{}]*\}/g, '{}')
      .replace(/@media[^{]*\{/g, '')
      .split('{}')
      .flatMap((s) => s.split(','))
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('}'));
    const bad = selectors.filter((s) => !/mc-|body:has\(\.mc-root\)/.test(s.replace(/^[}\s]+/, '')) && s !== '}');
    expect(bad).toEqual([]);
  });

  it('scrollbar-color 를 쓰지 않는다 (크롬이 -webkit- 스크롤바를 무시하게 됨)', () => {
    expect(CSS).not.toMatch(/scrollbar-color/);
  });

  it('box-shadow 는 포커스를 받지 않는 장식(메모·팝오버·대화상자·토스트)에만, 선택·상태 규칙에는 없다', () => {
    const rules = [...CSS.matchAll(/([^{}]+)\{([^{}]*box-shadow\s*:[^;}]+)[;}]/g)];
    for (const [, sel, body] of rules) {
      const value = /box-shadow\s*:\s*([^;}]+)/.exec(body)?.[1].trim() ?? '';
      if (value === 'none') continue; // 전역 링 무력화
      expect(sel, `${sel} → ${value}`).toMatch(/mc-memo|mc-pop|mc-dialog|mc-toast/);
    }
  });

  it('핵심 토큰이 정의되어 있다', () => {
    for (const t of ['--mc-accent: #2f5e8e', '--mc-mine-bg: #fff3bf', '--mc-miss-fg: #5f656c', '--mc-sunk-edge', '--mc-font']) {
      expect(CSS).toContain(t);
    }
  });
});

// ───────────── 대비 회귀(디자인 리뷰 M1) ─────────────
// 실제 CSS로 작은 캐스케이드(명시도·소스 순서·상속)를 돌려 버튼·토스트의 글자색/바탕을 구하고 WCAG 대비를 잰다.
// `.mc-root button { color: inherit }`(0,1,1)처럼 초기화 규칙이 `.mc-btn`·`.mc-toast`의 지정 색을 이기면 실패한다.
// 범위: @media 밖 규칙(PC 기본). 형제 결합자·:has·의사 요소 규칙은 대상 요소에 적용하지 않는다.

interface El {
  tag: string;
  cls: string[];
  attrs?: Record<string, string>;
  states?: string[];
  parent?: El;
}
interface Rule {
  sel: string;
  decls: Record<string, string>;
  order: number;
}

function topLevelRules(css: string): Rule[] {
  const out: Rule[] = [];
  let i = 0;
  let order = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    if (head.startsWith('@')) {
      let depth = 1;
      let j = open + 1;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
        j++;
      }
      i = j;
      continue;
    }
    const close = css.indexOf('}', open);
    const decls: Record<string, string> = {};
    for (const d of css.slice(open + 1, close).split(';')) {
      const k = d.indexOf(':');
      if (k > 0) decls[d.slice(0, k).trim()] = d.slice(k + 1).trim();
    }
    for (const sel of splitTop(head, ',')) out.push({ sel: sel.trim(), decls, order: order++ });
    i = close + 1;
  }
  return out;
}
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
/** 복합 선택자 → [결합자, 단순 선택자열] (오른쪽이 대상) */
function compounds(sel: string): { comb: string; part: string }[] {
  const out: { comb: string; part: string }[] = [];
  let depth = 0;
  let cur = '';
  let comb = ' ';
  const flush = () => {
    if (cur.trim()) out.push({ comb, part: cur.trim() });
    cur = '';
  };
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      if (cur.trim()) {
        flush();
        comb = ' ';
      }
      if (ch !== ' ') comb = ch;
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}
type Spec = [number, number];
function parseCompound(part: string): { test: (el: El) => boolean; spec: Spec } {
  const tests: ((el: El) => boolean)[] = [];
  let spec: Spec = [0, 0];
  let i = 0;
  const add = (b: number, c: number) => (spec = [spec[0] + b, spec[1] + c]);
  while (i < part.length) {
    const rest = part.slice(i);
    let m: RegExpExecArray | null;
    if (rest.startsWith('*')) {
      i += 1;
    } else if ((m = /^[a-zA-Z][\w-]*/.exec(rest))) {
      const t = m[0].toLowerCase();
      tests.push((el) => el.tag === t);
      add(0, 1);
      i += m[0].length;
    } else if ((m = /^\.([\w-]+)/.exec(rest))) {
      const c = m[1]!;
      tests.push((el) => el.cls.includes(c));
      add(1, 0);
      i += m[0].length;
    } else if ((m = /^\[([\w-]+)(?:=['"]?([^'"\]]*)['"]?)?\]/.exec(rest))) {
      const [, name, val] = m;
      tests.push((el) => (val === undefined ? el.attrs?.[name!] !== undefined : el.attrs?.[name!] === val));
      add(1, 0);
      i += m[0].length;
    } else if (rest.startsWith('::')) {
      tests.push(() => false); // 의사 요소: 요소 자체가 아님
      i = part.length;
    } else if ((m = /^:([\w-]+)\(/.exec(rest))) {
      let depth = 1;
      let j = m[0].length;
      while (j < rest.length && depth > 0) {
        if (rest[j] === '(') depth++;
        else if (rest[j] === ')') depth--;
        j++;
      }
      const inner = rest.slice(m[0].length, j - 1);
      const name = m[1]!;
      const args = splitTop(inner, ',').map((x) => compileSelector(x.trim()));
      if (name === 'where') tests.push((el) => args.some((a) => a.matches(el)));
      else if (name === 'is') {
        tests.push((el) => args.some((a) => a.matches(el)));
        const top = args.reduce<Spec>((acc, a) => (cmpSpec(a.spec, acc) > 0 ? a.spec : acc), [0, 0]);
        add(top[0], top[1]);
      } else if (name === 'not') {
        tests.push((el) => !args.some((a) => a.matches(el)));
        const top = args.reduce<Spec>((acc, a) => (cmpSpec(a.spec, acc) > 0 ? a.spec : acc), [0, 0]);
        add(top[0], top[1]);
      } else {
        tests.push(() => false); // :has 등
        add(1, 0);
      }
      i += j;
    } else if ((m = /^:([\w-]+)/.exec(rest))) {
      const st = m[1]!;
      tests.push((el) => (el.states ?? []).includes(st) || (st === 'disabled' && el.attrs?.disabled !== undefined));
      add(1, 0);
      i += m[0].length;
    } else {
      tests.push(() => false);
      i = part.length;
    }
  }
  return { test: (el) => tests.every((t) => t(el)), spec };
}
const cmpSpec = (a: Spec, b: Spec) => (a[0] - b[0]) || (a[1] - b[1]);
function compileSelector(sel: string): { matches: (el: El) => boolean; spec: Spec } {
  const cs = compounds(sel).map((c) => ({ comb: c.comb, ...parseCompound(c.part) }));
  const spec = cs.reduce<Spec>((acc, c) => [acc[0] + c.spec[0], acc[1] + c.spec[1]], [0, 0]);
  const matchFrom = (idx: number, el: El | undefined): boolean => {
    if (!el) return false;
    const c = cs[idx]!;
    if (!c.test(el)) return false;
    if (idx === 0) return true;
    if (c.comb === '>') return matchFrom(idx - 1, el.parent);
    if (c.comb !== ' ') return false; // 형제 결합자는 다루지 않음
    for (let p = el.parent; p; p = p.parent) if (matchFrom(idx - 1, p)) return true;
    return false;
  };
  return { matches: (el) => cs.length > 0 && matchFrom(cs.length - 1, el), spec };
}

const RULES = topLevelRules(CSS).map((r) => ({ ...r, ...compileSelector(r.sel) }));
const TOKENS: Record<string, string> = {};
for (const r of RULES) if (r.sel === '.mc-root') for (const [k, v] of Object.entries(r.decls)) if (k.startsWith('--')) TOKENS[k] = v;
const resolve = (v: string): string => v.replace(/var\((--[\w-]+)\)/g, (_, t: string) => resolve(TOKENS[t] ?? 'transparent')).trim();

function winning(el: El, props: string[]): string | null {
  let best: { spec: Spec; order: number; v: string } | null = null;
  for (const r of RULES) {
    const p = props.find((x) => r.decls[x] !== undefined);
    if (!p || !r.matches(el)) continue;
    if (!best || cmpSpec(r.spec, best.spec) > 0 || (cmpSpec(r.spec, best.spec) === 0 && r.order > best.order)) best = { spec: r.spec, order: r.order, v: r.decls[p]! };
  }
  return best ? resolve(best.v) : null;
}
function colorOf(el: El): string {
  const v = winning(el, ['color']);
  if (v && v !== 'inherit' && v !== 'currentColor') return v;
  return el.parent ? colorOf(el.parent) : '#000000';
}
function bgOf(el: El): string {
  const v = winning(el, ['background-color', 'background']);
  const c = v ? /#[0-9a-fA-F]{3,6}\b/.exec(v)?.[0] : undefined;
  if (c && !/gradient/.test(v!)) return c;
  return el.parent ? bgOf(el.parent) : '#ffffff';
}
function hexRgb(hex: string): [number, number, number] {
  const n = hex.length === 4 ? hex.slice(1).split('').map((x) => x + x).join('') : hex.slice(1);
  return [0, 2, 4].map((k) => parseInt(n.slice(k, k + 2), 16)) as [number, number, number];
}
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = hexRgb(h).map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const norm = (c: string) => (c.toLowerCase() === '#fff' ? '#ffffff' : c.toLowerCase());

describe('monthly-close.css 대비 회귀 (디자인 리뷰 M1)', () => {
  const root: El = { tag: 'div', cls: ['mc-root'] };
  const shell: El = { tag: 'div', cls: ['mc-shell'], attrs: { 'data-view': 'game' }, parent: root };
  const layer: El = { tag: 'div', cls: [], attrs: { 'data-layer': 'game' }, parent: shell };
  const panel: El = { tag: 'section', cls: [], parent: root }; // 홈 패널(바탕은 인라인 흰색 — 여기선 상위 바탕 chrome으로 더 엄격하게 잰다)
  const docbar: El = { tag: 'div', cls: ['mc-docbar'], parent: layer };
  const pop: El = { tag: 'div', cls: ['mc-pop'], parent: layer };
  const tabs: El = { tag: 'div', cls: ['mc-tabs'], parent: shell };
  const toolbar: El = { tag: 'div', cls: ['mc-toolbar'], parent: shell };
  const btn = (cls: string[], parent: El, attrs: Record<string, string> = {}, states: string[] = []): El => ({ tag: 'button', cls, attrs, states, parent });

  const AA = 4.5;
  const cases: [string, El, number][] = [
    ['기본 버튼(홈 [공유 문서 만들기])', btn(['mc-btn'], panel), AA],
    ['기본 버튼 hover', btn(['mc-btn'], panel, {}, ['hover']), AA],
    ['기본 버튼 active', btn(['mc-btn'], panel, {}, ['active']), AA],
    ['상단바 [공유]·대화상자 [열기]', btn(['mc-btn'], shell), AA],
    ['위험 버튼', btn(['mc-btn'], layer, { 'data-variant': 'danger' }), AA],
    ['보조 버튼', btn(['mc-btn'], layer, { 'data-variant': 'secondary' }), AA],
    ['글자 버튼(작업 줄)', btn(['mc-btn'], docbar, { 'data-variant': 'text' }), AA],
    ['글자 버튼 quiet(신고)', btn(['mc-btn'], docbar, { 'data-variant': 'text', 'data-quiet': 'true' }), AA],
    ['결재 경보 토스트', btn(['mc-toast', 'mc-toast--alarm'], layer, { role: 'alert' }), AA],
    ['경보 [Tab] 칩', { tag: 'span', cls: ['mc-chip'], parent: btn(['mc-toast', 'mc-toast--alarm'], layer) }, AA],
    ['알림 토스트 링크', btn(['mc-toast__link'], { tag: 'div', cls: ['mc-toast', 'mc-toast--note'], parent: layer }), AA],
    ['시트 탭', btn(['mc-tab'], tabs, { role: 'tab' }), AA],
    ['시트 탭(선택)', btn(['mc-tab'], tabs, { role: 'tab', 'aria-selected': 'true' }), AA],
    ['시트 탭(새 결과)', btn(['mc-tab'], tabs, { role: 'tab', 'data-fresh': 'true' }), AA],
    ['도구줄 버튼', btn(['mc-tool', 'mc-tool--wide'], toolbar), AA],
    ['메뉴·드롭다운 항목', btn(['mc-item'], pop, { role: 'menuitem' }), AA],
    ['분할 선택(피식, 눌림)', btn(['mc-seg__btn'], docbar, { 'aria-pressed': 'true' }), AA],
    ['분할 선택(피식)', btn(['mc-seg__btn'], docbar), AA],
  ];
  for (const [name, el, min] of cases) {
    it(`${name}: 글자/바탕 ≥ ${min}:1`, () => {
      const fg = colorOf(el);
      const bg = bgOf(el);
      expect(contrast(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    });
  }

  it('기본 버튼 글자는 흰색(#fff, 약 6.7:1), 경보 토스트 글자는 --mc-toast-fg', () => {
    expect(norm(colorOf(btn(['mc-btn'], panel)))).toBe('#ffffff');
    expect(contrast(colorOf(btn(['mc-btn'], panel)), bgOf(btn(['mc-btn'], panel)))).toBeGreaterThan(6.5);
    expect(norm(colorOf(btn(['mc-toast', 'mc-toast--alarm'], layer)))).toBe(norm(resolve('var(--mc-toast-fg)')));
  });

  it('비활성 기본 버튼은 지금 모양 유지(흐린 글자 --mc-text-off / 바탕 --mc-grid, 흰 글자 아님)', () => {
    const off = btn(['mc-btn'], panel, { 'aria-disabled': 'true' });
    expect(norm(colorOf(off))).toBe(norm(resolve('var(--mc-text-off)')));
    expect(norm(bgOf(off))).toBe(norm(resolve('var(--mc-grid)')));
    const dis = btn(['mc-btn'], panel, { disabled: '' });
    expect(norm(colorOf(dis))).toBe(norm(resolve('var(--mc-text-off)')));
  });

  it('버튼 초기화 규칙은 명시도 0이 아닌 클래스를 갖지 않는다(:where로 감싼다)', () => {
    const resets = RULES.filter((r) => /(^|\s)button$/.test(r.sel) && (r.decls.color === 'inherit' || r.decls.font === 'inherit'));
    expect(resets.length).toBeGreaterThan(0);
    for (const r of resets) expect(r.spec[0], `${r.sel} 클래스·속성 명시도`).toBe(0);
  });

  it('(자기 점검) 옛 규칙 `.mc-root button { color: inherit }`이면 기본 버튼이 실패했을 것이다', () => {
    const old = compileSelector('.mc-root button');
    expect(cmpSpec(old.spec, compileSelector('.mc-btn').spec)).toBeGreaterThan(0);
  });
});
