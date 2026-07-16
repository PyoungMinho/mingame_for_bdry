/**
 * 동네고수 OG 라우트 — 스포일러/미래회차 가드 (QA 플랜 §6 C-07~11, C-14)
 * ImageResponse(edge/satori)는 테스트 환경에서 무겁고 실제 픽셀은 OUT → next/og 를 목으로 대체하고
 * 404 분기(요청 시각 의존)와 정적 분석(정답 미참조·stroke-only)만 검증한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('next/og', () => ({
  ImageResponse: class {
    constructor(_el: unknown, opts?: { width?: number; height?: number }) {
      // 실제 이미지 대신 200 응답으로 대체(픽셀 검증 OUT)
      return new Response('OGIMG', {
        status: 200,
        headers: { 'x-og-width': String(opts?.width ?? ''), 'x-og-height': String(opts?.height ?? '') },
      });
    }
  },
}));

import { GET } from './route';
import { getTodayGameNo } from '@/lib/dongne/queue';
import type { NextRequest } from 'next/server';

const dummyReq = {} as NextRequest;
function get(gameNo: string) {
  return GET(dummyReq, { params: { gameNo } });
}

const POST_LAUNCH = new Date('2026-08-15T03:00:00Z');
const PRE_LAUNCH = new Date('2026-01-01T03:00:00Z');
/** POST_LAUNCH 시점의 오늘 회차 — EPOCH 상수 변경에도 테스트가 유효하도록 상대 계산 */
const TODAY = getTodayGameNo(POST_LAUNCH);

afterEach(() => {
  vi.useRealTimers();
});

describe('§6 OG 404 가드 (요청 시각 의존)', () => {
  beforeEach(() => {
    vi.setSystemTime(POST_LAUNCH);
  });

  it('C-08 미래 회차(gameNo>today) → 404, 오늘(=today) 은 티저 허용(200)', async () => {
    expect((await get(String(TODAY + 1))).status).toBe(404);
    expect((await get('9999')).status).toBe(404);
    // 오늘 회차는 티저 200 허용
    expect((await get(String(TODAY))).status).toBe(200);
    // 과거 회차도 200
    expect((await get('10')).status).toBe(200);
  });

  it('C-09 비정수·음수·0 형식 → 404', async () => {
    expect((await get('abc')).status).toBe(404);
    expect((await get('0')).status).toBe(404);
    expect((await get('-1')).status).toBe(404);
    expect((await get('1.5')).status).toBe(404);
  });
});

describe('§6 OG 프리런치 가드', () => {
  it('C-10 EPOCH 이전(today<1) → 전부 404', async () => {
    vi.setSystemTime(PRE_LAUNCH);
    expect((await get('1')).status).toBe(404);
    expect((await get('5')).status).toBe(404);
  });
});

describe('§6 OG 정적 분석 (정답 미참조·stroke-only)', () => {
  const source = readFileSync(path.resolve(__dirname, 'route.tsx'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('C-07 OG 는 정답 name/centroid 를 읽지 않는다 (코드만 사용)', () => {
    expect(code).not.toMatch(/getRegionByCode/);
    expect(code).not.toMatch(/\.centroid/);
    expect(code).not.toMatch(/\.name\b/);
    expect(code).not.toMatch(/nameWithSido/);
  });

  it('C-14 OG 는 manifest.json 을 import 하지 않는다 (정답 유출 표면 0)', () => {
    expect(code).not.toMatch(/manifest/);
    // 실루엣(형태)만 동적 import
    expect(code).toMatch(/silhouettes/);
  });

  it('C-11 실루엣은 stroke-only(fill="none") — 형태 식별 방지', () => {
    expect(code).toMatch(/fill="none"/);
    expect(code).toMatch(/stroke=/);
  });
});
