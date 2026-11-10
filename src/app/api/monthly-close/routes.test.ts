import { beforeEach, describe, expect, it } from 'vitest';
import { resetDbForTests } from '@/lib/monthly-close/server/db';
import { sharedLimiter } from '@/lib/monthly-close/server/rate';
import { POST as createRoom } from './rooms/route';
import { POST as join } from './rooms/[code]/join/route';
import { POST as sync } from './rooms/[code]/sync/route';
import { POST as action } from './rooms/[code]/action/route';
import { POST as feedback } from './feedback/route';
import { GET as health } from './health/route';

const KEY_A = 'a1'.repeat(16);
const KEY_B = 'b2'.repeat(16);

const req = (url: string, key: string | null, body: unknown, extra: Record<string, string> = {}) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-mc-key': key } : {}), ...extra },
    body: JSON.stringify(body),
  });
const ctx = (code: string) => ({ params: { code } });

describe('라우트 6개 (MemoryStore, 실제 핸들러)', () => {
  beforeEach(() => {
    resetDbForTests();
    sharedLimiter().reset();
  });

  it('health → ok, 캐시 금지·noindex 헤더', async () => {
    const res = await health();
    expect(await res.json()).toEqual({ db: 'ok' });
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('방 만들기 → 입장 → sync → action → feedback 흐름', async () => {
    const c = await createRoom(req('/api/monthly-close/rooms', KEY_A, { nickname: '가', industry: 2, alarmOn: true }, { 'x-mc-test': '1' }) as never);
    expect(c.status).toBe(200);
    const created = await c.json();
    expect(created).toMatchObject({ ok: true, seat: 0, view: { status: 'waiting' } });
    const code = created.code as string;

    const noKey = await join(req(`/x`, null, { nickname: '나', industry: 0 }) as never, ctx(code));
    expect(noKey.status).toBe(400);
    expect((await noKey.json()).reason).toBe('key');

    const j = await join(req('/x', KEY_B, { nickname: '나', industry: 0 }) as never, ctx(code));
    expect(await j.json()).toMatchObject({ ok: true, seat: 1, rejoined: false, view: { status: 'placing' } });

    const s = await sync(req('/x', KEY_A, { knownVersion: -1, view: 'game' }) as never, ctx(code));
    const sb = await s.json();
    expect(sb).toMatchObject({ ok: true, changed: true, presence: { oppHidden: false } });
    const s2 = await sync(req('/x', KEY_A, { knownVersion: sb.view.room.version, view: 'disguise' }) as never, ctx(code));
    expect(await s2.json()).toMatchObject({ changed: false, presence: { oppHidden: false } });

    const a = await action(req('/x', KEY_A, { actionId: 'a1', type: 'fire', cell: 'A1' }) as never, ctx(code));
    expect(a.status).toBe(409);
    expect(await a.json()).toMatchObject({ ok: false, error: 'WRONG_PHASE', view: { status: 'placing' } });

    const bad = await action(req('/x', KEY_A, 'not-an-object') as never, ctx(code));
    expect(bad.status).toBe(400);

    const nf = await sync(req('/x', KEY_A, { knownVersion: -1, view: 'game' }) as never, ctx('99999'));
    expect(nf.status).toBe(404);

    const fb = await feedback(req('/api/monthly-close/feedback', KEY_A, { type: 'transport', code: null, bell: false }) as never);
    expect(fb.status).toBe(204);
  });

  it('큰 본문은 거부', async () => {
    const big = { nickname: 'x'.repeat(20_000), industry: 0, alarmOn: false };
    const c = await createRoom(req('/api/monthly-close/rooms', KEY_A, big) as never);
    expect(c.status).toBe(400);
  });
});
