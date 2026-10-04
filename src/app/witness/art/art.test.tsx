/**
 * 그림 모듈 계약 테스트 — 사건 데이터와의 대조 · 표정 상주 규칙 · 스포일러 가드 · 용량 예산.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CASE } from '@/lib/witness';
import { EndingArt } from './ending/EndingArt';
import { INTRO_ART_KEYS, IntroCutArt } from './intro/IntroCut';
import { DdobagiPortrait, ledOf } from './portraits/Ddobagi';
import { hangyeolLook, HangyeolPortrait } from './portraits/Hangyeol';
import { HaneulPortrait } from './portraits/Haneul';
import { JunhyeokPortrait } from './portraits/Junhyeok';
import { MisukPortrait } from './portraits/Misuk';
import { SungangPortrait } from './portraits/Sungang';
import { SCENE_ARTS, SCENE_HOTSPOTS, sceneArt } from './scenes/index';
import { WitnessArt } from './WitnessArt';

const FACES = ['normal', 'sweat', 'shock', 'angry', 'break', 'smirk'] as const;
const PEOPLE = { S1: SungangPortrait, S2: HaneulPortrait, S3: MisukPortrait, S4: JunhyeokPortrait, COP: HangyeolPortrait } as const;
const visible = (html: string, kind: 'face' | 'pose') => (html.match(new RegExp(`data-part="${kind}-[a-z]+" display="inline"`, 'g')) ?? []).length;

describe('장소 그림 ↔ 사건 데이터', () => {
  it('모든 장소의 art 키에 그림이 있다', () => {
    for (const loc of CASE.locations) expect(sceneArt(loc.art), loc.art).not.toBeNull();
  });
  it('핫스팟 좌표 맵이 데이터 좌표와 같다(빠짐·남음 없음)', () => {
    for (const loc of CASE.locations) {
      const anchors = SCENE_HOTSPOTS[loc.art as keyof typeof SCENE_HOTSPOTS];
      expect(Object.keys(anchors).sort()).toEqual(loc.hotspots.map((s) => s.id).sort());
      for (const spot of loc.hotspots) expect(anchors[spot.id], spot.id).toEqual([spot.x, spot.y]);
    }
  });
  it('장면 SVG 는 1장 40KB 이하, viewBox 1500×1000', () => {
    for (const def of Object.values(SCENE_ARTS)) {
      const html = renderToStaticMarkup(h(def.Art, { idScope: def.key }));
      expect(html.length, def.key).toBeLessThanOrEqual(40_000);
      expect(html).toContain('viewBox="0 0 1500 1000"');
    }
  });
});

describe('초상 — 표정 상주(display 만 전환)', () => {
  for (const [who, P] of Object.entries(PEOPLE)) {
    it(`${who}: 표정마다 이목구비·포즈 그룹이 하나씩만 보인다`, () => {
      for (const face of FACES) {
        const html = renderToStaticMarkup(h(P, { face, idScope: `${who}${face}` }));
        expect(visible(html, 'face'), `${who}/${face}`).toBe(1);
        expect(visible(html, 'pose'), `${who}/${face}`).toBe(1);
        expect(html).toContain(`data-face="${face}"`);
      }
    });
    it(`${who}: gzip 6KB 이하`, () => {
      const html = renderToStaticMarkup(h(P, { idScope: who }));
      expect(zlib.gzipSync(html).length).toBeLessThanOrEqual(6 * 1024);
    });
  }
  it('용의자 4명은 shock·angry·smirk 를 모두 같은 규칙으로 갖는다(D34)', () => {
    for (const P of [SungangPortrait, HaneulPortrait, MisukPortrait, JunhyeokPortrait]) {
      const angry = renderToStaticMarkup(h(P, { face: 'angry', idScope: 'a' }));
      expect(angry).toContain('data-part="face-angry" display="inline"');
      const smirk = renderToStaticMarkup(h(P, { face: 'normal', smirk: true, idScope: 'b' }));
      expect(smirk).toContain('data-part="face-smirk" display="inline"');
    }
  });
  it('한결 신뢰 5단계 → 표정', () => {
    expect(hangyeolLook(5).face).toBe('normal');
    expect(hangyeolLook(4)).toEqual({ face: 'normal', drops: 1, shake: false });
    expect(hangyeolLook(3).face).toBe('sweat');
    expect(hangyeolLook(2)).toEqual({ face: 'sweat', drops: 3, shake: true });
    expect(hangyeolLook(1).face).toBe('break');
    const html = renderToStaticMarkup(h(HangyeolPortrait, { trust: 2, idScope: 't' }));
    expect(html).toContain('wt-art-eyeshake');
  });
  it('또박이 LED = 표정(types.ts 규칙)', () => {
    expect(ledOf('normal')).toBe('standby');
    expect(ledOf('sweat')).toBe('process');
    expect(ledOf('shock')).toBe('correct');
    expect(ledOf('break')).toBe('correct');
    expect(ledOf('angry')).toBe('refuse');
    const html = renderToStaticMarkup(h(DdobagiPortrait, { face: 'angry', speaking: true, idScope: 'd' }));
    expect(html).toContain('data-led="refuse"');
    expect(html).toContain('data-speaking="on"');
  });
});

describe('소개 컷 · 엔딩', () => {
  it('사건 데이터의 소개 컷 art 키가 모두 그려져 있다', () => {
    for (const cut of CASE.intro) expect(INTRO_ART_KEYS as readonly string[]).toContain(cut.art);
    for (const k of INTRO_ART_KEYS) expect(renderToStaticMarkup(h(IntroCutArt, { art: k })).length).toBeGreaterThan(500);
  });
  it('엔딩 키아트는 범인을 모른다 — culprit 없으면 용의자 초상이 없다', () => {
    const none = renderToStaticMarkup(h(EndingArt, { ending: 'perfect' }));
    expect(none).not.toMatch(/wt-p-s[1-4]-/);
    const c = CASE.solution.culprit;
    const withC = renderToStaticMarkup(h(EndingArt, { ending: 'perfect', culprit: c }));
    expect(withC).toMatch(new RegExp(`wt-p-${c.toLowerCase()}-`));
  });
  it('오인 체포 4종은 같은 구도로 모두 그려진다', () => {
    for (const s of ['S1', 'S2', 'S3', 'S4'] as const) {
      const html = renderToStaticMarkup(h(EndingArt, { ending: `wrong-${s}` }));
      expect(html).toMatch(new RegExp(`wt-p-${s.toLowerCase()}-`));
    }
  });
  it('그림 소스는 정답(SOLUTION)·사건 데이터 모듈을 import 하지 않는다', () => {
    const dir = __dirname;
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of fs.readdirSync(d)) {
        const p = path.join(d, f);
        if (fs.statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(f) && !f.endsWith('.test.tsx')) files.push(p);
      }
    };
    walk(dir);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      expect(src, f).not.toMatch(/from '[^']*case-data'|from '@\/lib\/witness'|\bSOLUTION\b|\.solution\b/);
    }
  });
});

describe('WitnessArt — ArtSlot 과 같은 DOM', () => {
  it('scene / portrait / cut / ending', () => {
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'scene', art: 'living' }))).toContain('class="wt-art-scene wt-art wt-art--scene"');
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'scene', art: 'nope' }))).toContain('data-art="fallback"');
    const p = renderToStaticMarkup(h(WitnessArt, { kind: 'portrait', who: 'S3', face: 'sweat', crop: 'head', title: '방미숙' }));
    expect(p).toContain('wt-art wt-art--portrait');
    expect(p).toContain('viewBox="150 100 300 300"');
    expect(p).toContain('aria-label="방미숙"');
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'portrait', who: 'VICTIM' }))).toContain('aria-label="백도진"');
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'portrait', who: 'NARR' }))).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'cut', art: 'tower' }))).toMatch(/^<div class="wt-art-cut" data-art="tower">/);
    expect(renderToStaticMarkup(h(WitnessArt, { kind: 'ending', ending: 'timeout' }))).toMatch(/^<div class="wt-art-ending" data-ending="timeout">/);
  });
});
