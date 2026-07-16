/**
 * 동네고수 데이터 무결성 (QA 플랜 §8 D-01~09) + BUG-1(D-08) 회귀 고정.
 * manifest 250 유일 · silhouette 1:1 · editorial 스키마/매칭/색·비하 스캔 · 로더 계약 정합.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REGION_CODES, REGION_COUNT } from '@/lib/dongne/region-codes';
import manifest from './manifest.json';
import type { Region, Silhouette } from '@/lib/dongne/types';

const DATA_DIR = __dirname;
const SIL_DIR = path.join(DATA_DIR, 'silhouettes');
const EDI_DIR = path.join(DATA_DIR, 'editorial');

const regions = manifest as Region[];
const codeSet = new Set(REGION_CODES);
const COLOR_BLOCK_RE = /[\u{1F7E5}-\u{1F7EB}\u{2B1B}\u{2B1C}]/u;
const SLUR_RE = /(촌뜨기|촌구석|시골뜨기|낙후|후진|깡촌|촌놈)/;

function listJson(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith('.json'));
}
function readJson<T>(p: string): T {
  return JSON.parse(readFileSync(p, 'utf8')) as T;
}

describe('§8 manifest 무결성', () => {
  it('D-01 manifest 250개 · code 유일', () => {
    expect(regions).toHaveLength(250);
    expect(new Set(regions.map((r) => r.code)).size).toBe(250);
  });

  it('D-02 manifest code 집합 === REGION_CODES (COUNT=250)', () => {
    expect(REGION_COUNT).toBe(250);
    expect(new Set(regions.map((r) => r.code))).toEqual(codeSet);
  });

  it('D-05 centroid 는 한반도 위경도 범위 내 (lat 33~39 · lng 124~131)', () => {
    for (const r of regions) {
      expect(r.centroid.lat).toBeGreaterThanOrEqual(33);
      expect(r.centroid.lat).toBeLessThanOrEqual(39);
      expect(r.centroid.lng).toBeGreaterThanOrEqual(124);
      expect(r.centroid.lng).toBeLessThanOrEqual(131);
    }
  });

  it('manifest 각 항목 필수 필드 존재 (nameWithSido·aliases·bbox)', () => {
    for (const r of regions) {
      expect(typeof r.name).toBe('string');
      expect(typeof r.nameWithSido).toBe('string');
      expect(Array.isArray(r.aliases)).toBe(true);
      expect(r.bbox).toHaveLength(4);
    }
  });
});

describe('§8 실루엣 무결성', () => {
  const silFiles = listJson(SIL_DIR);

  it('D-03 실루엣 파일 250개 · code 1:1 (누락·잉여 0)', () => {
    expect(silFiles).toHaveLength(250);
    const silCodes = new Set(silFiles.map((f) => f.replace('.json', '')));
    expect(silCodes).toEqual(codeSet);
  });

  it('D-04 실루엣 스키마: viewBox="0 0 100 100" · d 비어있지 않음 · code 파일명 일치', () => {
    for (const f of silFiles) {
      const sil = readJson<Silhouette>(path.join(SIL_DIR, f));
      expect(sil.viewBox).toBe('0 0 100 100');
      expect(typeof sil.d).toBe('string');
      expect(sil.d.length).toBeGreaterThan(0);
      expect(sil.code).toBe(f.replace('.json', ''));
    }
  });
});

describe('§8 editorial 무결성 + BUG-1 회귀', () => {
  const ediFiles = listJson(EDI_DIR);

  it('D-09 editorial 시드 편수 = 60 (임무 컨텍스트 "84편"과 불일치 — BUG-3 문서 드리프트)', () => {
    expect(ediFiles).toHaveLength(60);
  });

  it('D-06 editorial code 필드 = 파일명 & code ∈ manifest', () => {
    for (const f of ediFiles) {
      const edi = readJson<{ code: string }>(path.join(EDI_DIR, f));
      expect(edi.code).toBe(f.replace('.json', ''));
      expect(codeSet.has(edi.code)).toBe(true);
    }
  });

  it('D-07 editorial 본문에 색블록·비하 표현 0건', () => {
    for (const f of ediFiles) {
      const edi = readJson<Record<string, unknown>>(path.join(EDI_DIR, f));
      const text = JSON.stringify(edi);
      expect(COLOR_BLOCK_RE.test(text), `${f} 색블록`).toBe(false);
      expect(SLUR_RE.test(text), `${f} 비하표현`).toBe(false);
    }
  });

  it('D-08 [BUG-1 회귀] editorial JSON 은 로더 계약(intro/body/facts)과 정합 — sections 미참조', () => {
    // 수정 전: 로더/페이지가 {population, area, sections[]}를 기대했으나 실데이터는
    // {intro, body[], facts{}}였다 → archive 페이지 editorial.sections.length 에서 TypeError 크래시.
    // 이 테스트는 실데이터 스키마를 고정한다(수정 후 계약).
    for (const f of ediFiles) {
      const edi = readJson<Record<string, unknown>>(path.join(EDI_DIR, f));
      expect(typeof edi.intro, `${f} intro`).toBe('string');
      expect(Array.isArray(edi.body), `${f} body`).toBe(true);
      expect((edi.body as unknown[]).length, `${f} body non-empty`).toBeGreaterThan(0);
      expect(typeof edi.facts, `${f} facts`).toBe('object');
      // 구(舊) 스키마 필드는 존재하지 않아야 함(계약 재정합 확인)
      expect(edi.sections, `${f} sections 잔존`).toBeUndefined();
    }
  });

  it('D-08 [BUG-1 회귀] 로더 EditorialContent 인터페이스가 실데이터를 crash 없이 수용', async () => {
    // 로더가 반환한 객체를 아카이브 페이지 렌더 로직과 동일하게 접근해도 throw 없어야 함.
    const { loadEditorial } = await import('../lib/editorial');
    const sample = ediFiles[0].replace('.json', '');
    const edi = await loadEditorial(sample);
    expect(edi).not.toBeNull();
    // 페이지가 실제로 하는 접근들: facts entries, intro, body.map — 크래시 유발 여부
    expect(() => {
      const _facts = edi?.facts ? Object.entries(edi.facts) : [];
      const _intro = edi?.intro ?? '';
      const _body = (edi?.body ?? []).map((p) => p);
      void _facts;
      void _intro;
      void _body;
    }).not.toThrow();
  });

  it('editorial 스탯카드용 facts 는 라벨→문자열 값 (렌더 안전)', () => {
    for (const f of ediFiles) {
      const edi = readJson<{ facts: Record<string, unknown> }>(path.join(EDI_DIR, f));
      for (const [label, value] of Object.entries(edi.facts)) {
        expect(typeof label).toBe('string');
        expect(typeof value).toBe('string');
      }
    }
  });
});
