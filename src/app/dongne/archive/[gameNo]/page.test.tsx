/**
 * 동네고수 아카이브 해설 — 차단 화면·SSG 경계·BUG-1 페이지 레벨 회귀 (QA 플랜 §6 C-12/13, §8 D-10/11)
 *
 * ⚠ 프리런치 마스킹: getTodayGameNo() 실시간이 <1 → 모든 회차가 차단. 날짜 주입으로 EPOCH 이후를 시뮬레이션.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import Page, { generateStaticParams, generateMetadata } from './page';
import { getRegionCodeForGame, getTodayGameNo } from '@/lib/dongne/queue';

const POST_LAUNCH = new Date('2026-08-15T03:00:00Z');
const LATE = new Date('2027-06-01T03:00:00Z'); // full cycle 지나 모든 editorial code가 과거
const PRE_LAUNCH = new Date('2026-01-01T03:00:00Z');
/** POST_LAUNCH 시점의 오늘 회차 — EPOCH 상수 변경에도 테스트가 유효하도록 상대 계산 */
const TODAY = getTodayGameNo(POST_LAUNCH);

const EDI_DIR = path.resolve(__dirname, '../../data/editorial');
const editorialCodes = new Set(readdirSync(EDI_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')));

/** 과거 회차(1..today-1) 중 editorial 파일이 있는 첫 gameNo — BUG-1 크래시 경로 */
function pastGameNoWithEditorial(now: Date): number {
  const today = getTodayGameNo(now);
  for (let g = 1; g < today; g++) {
    if (editorialCodes.has(getRegionCodeForGame(g))) return g;
  }
  throw new Error('no editorial-backed past gameNo');
}

afterEach(() => {
  vi.useRealTimers();
});

describe('§8 SSG 경계 (generateStaticParams)', () => {
  it('D-10 [1..today-1]만 생성(오늘·미래 미포함)', () => {
    vi.setSystemTime(POST_LAUNCH);
    const params = generateStaticParams();
    expect(params).toHaveLength(TODAY - 1);
    expect(params[0]).toEqual({ gameNo: '1' });
    expect(params[params.length - 1]).toEqual({ gameNo: String(TODAY - 1) });
    expect(params.every((p) => Number(p.gameNo) < TODAY)).toBe(true);
  });

  it('D-11 프리런치(today<1) → [] 반환', () => {
    vi.setSystemTime(PRE_LAUNCH);
    expect(generateStaticParams()).toEqual([]);
  });
});

describe('§6 아카이브 차단·형식 가드', () => {
  it('C-12 오늘·미래 회차 → 200 친화 차단 화면(notFound 아님)', async () => {
    vi.setSystemTime(POST_LAUNCH);
    for (const gameNo of [String(TODAY), String(TODAY + 1), '9999']) {
      const el = await Page({ params: { gameNo } });
      const html = renderToStaticMarkup(el);
      expect(html).toContain('아직 공개되지 않은 회차');
      expect(html).toContain('오늘 문제 풀러 가기');
    }
  });

  it('C-12 오늘 회차 차단 화면엔 "진행 중" 안내 포함', async () => {
    vi.setSystemTime(POST_LAUNCH);
    const html = renderToStaticMarkup(await Page({ params: { gameNo: String(TODAY) } }));
    expect(html).toContain('오늘 문제는 아직 진행 중이에요');
  });

  it('C-13 비정수·음수·0 형식 → notFound() throw (표준 404)', async () => {
    vi.setSystemTime(POST_LAUNCH);
    for (const gameNo of ['abc', '0', '-1', '1.5']) {
      await expect(Page({ params: { gameNo } })).rejects.toThrow();
    }
  });

  it('C-12 generateMetadata: 차단 회차는 noindex robots', async () => {
    vi.setSystemTime(POST_LAUNCH);
    const meta = await generateMetadata({ params: { gameNo: String(TODAY) } });
    expect(meta.robots).toMatchObject({ index: false });
  });

  it('과거 회차 generateMetadata: 지역명 타이틀 + index:true', async () => {
    vi.setSystemTime(POST_LAUNCH);
    const meta = await generateMetadata({ params: { gameNo: '10' } });
    expect(meta.robots).toMatchObject({ index: true });
    expect(JSON.stringify(meta.title)).toMatch(/동네였을까/);
  });
});

describe('§6/§8 BUG-1 페이지 레벨 회귀 (editorial 스키마 정합)', () => {
  it('editorial 보유 과거 회차 해설 페이지가 크래시 없이 렌더된다 (수정 전 editorial.sections.length TypeError)', async () => {
    vi.setSystemTime(LATE);
    const g = pastGameNoWithEditorial(LATE);
    const code = getRegionCodeForGame(g);
    expect(editorialCodes.has(code)).toBe(true);
    // 이 호출이 수정 전엔 TypeError(Cannot read properties of undefined 'length')로 throw 했다.
    const el = await Page({ params: { gameNo: String(g) } });
    const html = renderToStaticMarkup(el);
    // intro/body 콘텐츠가 실제로 렌더됨(폴백 "준비 중"이 아니라)
    expect(html).not.toContain('자세한 해설은 아직 준비 중');
    expect(html).toContain('dn-archive-body');
  });

  it('editorial 없는 과거 회차는 "준비 중" 폴백으로 안전 렌더', async () => {
    vi.setSystemTime(LATE);
    const today = getTodayGameNo(LATE);
    let noEdi = -1;
    for (let g = 1; g < today; g++) {
      if (!editorialCodes.has(getRegionCodeForGame(g))) { noEdi = g; break; }
    }
    expect(noEdi).toBeGreaterThan(0);
    const html = renderToStaticMarkup(await Page({ params: { gameNo: String(noEdi) } }));
    expect(html).toContain('자세한 해설은 아직 준비 중');
  });
});
