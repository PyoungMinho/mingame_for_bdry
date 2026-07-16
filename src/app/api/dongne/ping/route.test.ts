/**
 * 동네고수 ping route — DAU 게이트 (QA 플랜 §7 P-01~11)
 * 절대 규칙: 어떤 실패 경로에서도 게임을 막지 않는다(non-blocking, 항상 204) · IP/헤더 미접근.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';

vi.mock('@/lib/dongne/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }));

import { getSupabaseAdmin } from '@/lib/dongne/supabase-admin';
import { POST } from './route';
import { getDateForGame, getTodayGameNo } from '@/lib/dongne/queue';

/** req.json() 만 사용하는 라우트 — 최소 목으로 대체 */
function req(body: unknown, opts?: { throw?: boolean }): NextRequest {
  return {
    json: async () => {
      if (opts?.throw) throw new SyntaxError('Unexpected token');
      return body;
    },
  } as unknown as NextRequest;
}

function mockAdmin() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as never);
  return { upsert, from };
}

const UUID = '123e4567-e89b-42d3-a456-426614174000'; // 36자

beforeEach(() => {
  vi.clearAllMocks();
});

describe('§7 ping 검증·기록', () => {
  it('P-01 정상 UUID → 204 & upsert 호출', async () => {
    const { upsert } = mockAdmin();
    const res = await POST(req({ anonId: UUID }));
    expect(res.status).toBe(204);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('P-02 anon_id 키 별칭도 허용 → 204 & upsert 호출', async () => {
    const { upsert } = mockAdmin();
    const res = await POST(req({ anon_id: 'aXbYcZ01-2345-6789-abcd-ef0123456789' }));
    expect(res.status).toBe(204);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('P-03 형식 위반(7자·65자·특수문자·비문자열)은 204 + upsert 미호출', async () => {
    const { upsert } = mockAdmin();
    const bad = ['short12', 'x'.repeat(65), 'has space here!!', 12345, null, { a: 1 }];
    for (const v of bad) {
      const res = await POST(req({ anonId: v }));
      expect(res.status).toBe(204);
    }
    expect(upsert).not.toHaveBeenCalled();
  });

  it('P-04 바디 없음/비-JSON 은 204, throw 없음', async () => {
    const { upsert } = mockAdmin();
    expect((await POST(req(null))).status).toBe(204);
    expect((await POST(req('garbage'))).status).toBe(204);
    expect((await POST(req(undefined, { throw: true }))).status).toBe(204); // req.json() throw
    expect(upsert).not.toHaveBeenCalled();
  });

  it('P-05 더블파이어(같은 anonId 60s 내 2회) → 2회째 upsert 미호출 (seenRecently)', async () => {
    const { upsert } = mockAdmin();
    const id = 'double-fire-anon-0001-2345';
    await POST(req({ anonId: id }));
    await POST(req({ anonId: id }));
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});

describe('§7 ping non-blocking (실패에도 204)', () => {
  it('P-07 env 미설정(getSupabaseAdmin=null) → 204, 게임 무영향', async () => {
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);
    const res = await POST(req({ anonId: 'no-supabase-anon-1234-5678' }));
    expect(res.status).toBe(204);
  });

  it('P-08 테이블 미배포(upsert error) → console.error 만, 204 유지', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'relation "dongne_dau" does not exist' } });
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({ upsert }) } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(req({ anonId: 'table-missing-anon-1234-56' }));
    expect(res.status).toBe(204);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('P-09 예상외 예외(upsert throw) → catch → 204', async () => {
    const upsert = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: () => ({ upsert }) } as never);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(req({ anonId: 'unexpected-throw-anon-12345' }));
    expect(res.status).toBe(204);
    spy.mockRestore();
  });
});

describe('§7 ping 개인정보·KST 스탬프', () => {
  it('P-10 [정적분석] 라우트가 IP/헤더/쿠키를 읽지 않는다 (개인정보 미저장)', () => {
    const raw = readFileSync(path.resolve(__dirname, 'route.ts'), 'utf8');
    // ⚠ doc-comment 는 "IP·User-Agent·쿠키를 읽지 않는다"고 정당하게 언급 → false-positive.
    // C-01b 함정과 동일하게, 주석을 제거한 *실제 코드*에서 접근 구문만 스캔한다.
    const code = raw
      .replace(/\/\*[\s\S]*?\*\//g, '') // 블록 주석
      .replace(/\/\/.*$/gm, ''); // 라인 주석
    expect(code).not.toMatch(/req\.ip\b/);
    expect(code).not.toMatch(/x-forwarded-for/i);
    expect(code).not.toMatch(/\.headers\b/);
    expect(code).not.toMatch(/\.cookies\b/);
    expect(code).not.toMatch(/req\.geo\b/);
    expect(code).not.toMatch(/user-agent/i);
    // 주석 제거 전 원문엔 개인정보 미저장 방침이 명시돼 있음(문서화 확인)
    expect(raw).toMatch(/IP|개인정보/);
  });

  it('P-11 day_kst 는 서버 KST 스탬프(getDateForGame∘getTodayGameNo)', async () => {
    const { upsert } = mockAdmin();
    await POST(req({ anonId: 'kst-stamp-anon-abcd-1234-5678' }));
    const expectedDay = getDateForGame(getTodayGameNo());
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ day_kst: expectedDay, anon_id: 'kst-stamp-anon-abcd-1234-5678' }),
      expect.objectContaining({ onConflict: 'day_kst,anon_id', ignoreDuplicates: true }),
    );
    expect(expectedDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
