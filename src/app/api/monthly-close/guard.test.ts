import { afterEach, describe, expect, it, vi } from 'vitest';
import { guard } from './_util';

describe('라우트 보호막(guard)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('예상 못 한 예외 → JSON SERVICE_DOWN(503), 응답·로그에 메시지·스택 없음', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => void logs.push(a.map(String).join(' ')));
    const secret = 'state {"secret":{"boards":[]}} key=0123456789abcdef0123456789abcdef';
    const res = await guard('action', async () => {
      throw new TypeError(secret);
    });
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body).toMatchObject({ ok: false, error: 'SERVICE_DOWN' });
    expect(typeof body.serverNow).toBe('number');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('at ');
    expect(logs.join('\n')).toBe('[monthly-close] action unhandled TypeError');
  });

  it('정상 응답은 그대로 통과', async () => {
    const res = await guard('x', async () => new Response('{"ok":true}', { status: 200 }) as never);
    expect(res.status).toBe(200);
  });
});
