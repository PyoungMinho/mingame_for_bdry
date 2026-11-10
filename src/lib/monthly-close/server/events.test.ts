import { describe, expect, it } from 'vitest';
import { LINES_SHOWN_MAX } from '../constants';
import { buildEvent, dedupeKeyFor, recordEvent, recordEvents, safeCleanup, sanitizeProps, type EventContext } from './events';
import { MemoryStore } from './store-memory';
import type { RoomStore } from './store';

const H = (c: string) => c.repeat(64);
const NOW = 1_800_000_000_000;
const ctx = (over: Partial<EventContext> = {}): EventContext => ({
  roomId: 'room-1', matchId: 'match-1', playerKey: H('a'), env: 'production', isTest: false, ...over,
});

describe('sanitizeProps — 허용된 키만, 모양이 틀리면 거부', () => {
  it('10종 정상 값은 그대로 통과', () => {
    expect(sanitizeProps('room_created', { industry: 2, alarmOn: false })).toEqual({ industry: 2, alarmOn: false });
    expect(sanitizeProps('room_joined', { seat: 1, hostKey: H('b') })).toEqual({ seat: 1, hostKey: H('b') });
    expect(sanitizeProps('match_started', { seq: 1, rematch: false })).toEqual({ seq: 1, rematch: false });
    expect(sanitizeProps('match_ended', { reason: 'cap', rounds: 30, winner: null })).toEqual({ reason: 'cap', rounds: 30, winner: null });
    expect(sanitizeProps('rematch_requested', {})).toEqual({});
    expect(sanitizeProps('feedback', { laugh: 'some' })).toEqual({ laugh: 'some' });
    expect(sanitizeProps('line_report', { lineId: 'accounting/vat_01' })).toEqual({ lineId: 'accounting/vat_01' });
    expect(sanitizeProps('lines_shown', { lineIds: ['common/a', 'hr/b/2'] })).toEqual({ lineIds: ['common/a', 'hr/b/2'] });
    expect(sanitizeProps('share_copied', { doc: 'joint' })).toEqual({ doc: 'joint' });
    expect(sanitizeProps('transport', { bell: true })).toEqual({ bell: true });
  });

  it('여분 키(닉네임·IP·UA 등)는 버려진다', () => {
    const out = sanitizeProps('feedback', { laugh: 'lol', nickname: '김대리', ip: '1.2.3.4', ua: 'Mozilla' });
    expect(out).toEqual({ laugh: 'lol' });
    expect(JSON.stringify(sanitizeProps('room_joined', { seat: 0, hostKey: H('a'), nickname: 'x' }))).not.toContain('nickname');
  });

  it('잘못된 값은 null', () => {
    expect(sanitizeProps('room_created', { industry: 3, alarmOn: true })).toBeNull();
    expect(sanitizeProps('room_joined', { seat: 2, hostKey: H('a') })).toBeNull();
    expect(sanitizeProps('room_joined', { seat: 0, hostKey: 'a'.repeat(32) })).toBeNull(); // 원본 키 모양
    expect(sanitizeProps('match_ended', { reason: 'boom', rounds: 3, winner: 0 })).toBeNull();
    expect(sanitizeProps('match_ended', { reason: 'cap', rounds: 31, winner: 0 })).toBeNull();
    expect(sanitizeProps('feedback', { laugh: 'LOL' })).toBeNull();
    expect(sanitizeProps('line_report', { lineId: 'bad id with spaces' })).toBeNull();
    expect(sanitizeProps('line_report', { lineId: 'evil/x' })).toBeNull();
    expect(sanitizeProps('lines_shown', { lineIds: ['common/a', 'nope'] })).toBeNull();
    expect(sanitizeProps('lines_shown', { lineIds: Array.from({ length: LINES_SHOWN_MAX + 1 }, () => 'common/a') })).toBeNull();
    expect(sanitizeProps('share_copied', { doc: 'x' })).toBeNull();
    expect(sanitizeProps('transport', { bell: 'yes' })).toBeNull();
    expect(sanitizeProps('feedback', null)).toBeNull();
  });
});

describe('buildEvent / dedupeKeyFor', () => {
  it('컨텍스트의 env·is_test를 그대로 싣는다(제외는 gate SQL이 한다)', () => {
    const e = buildEvent('transport', { bell: false }, ctx({ env: 'preview', isTest: true }), NOW)!;
    expect(e).toMatchObject({ at: NOW, type: 'transport', env: 'preview', isTest: true, props: { bell: false } });
  });

  it('playerKey가 해시 모양이 아니면 기록하지 않는다', () => {
    expect(buildEvent('transport', { bell: true }, ctx({ playerKey: 'a'.repeat(32) }), NOW)).toBeNull();
    expect(buildEvent('transport', { bell: true }, ctx({ playerKey: null }), NOW)).not.toBeNull();
  });

  it('feedback은 매치·사람당 1건, 시작/종료는 매치당 1건', () => {
    expect(dedupeKeyFor('feedback', ctx())).toBe(`feedback:match-1:${H('a')}`);
    expect(dedupeKeyFor('feedback', ctx({ matchId: null }))).toBeNull();
    expect(dedupeKeyFor('match_started', ctx())).toBe('match_started:match-1');
    expect(dedupeKeyFor('match_ended', ctx())).toBe('match_ended:match-1');
    expect(dedupeKeyFor('room_created', ctx())).toBe('room_created:room-1');
    expect(dedupeKeyFor('room_joined', ctx())).toBe(`room_joined:room-1:${H('a')}`);
    expect(dedupeKeyFor('line_report', ctx())).toBeNull();
    expect(dedupeKeyFor('transport', ctx())).toBeNull();
  });
});

describe('recordEvent(s)', () => {
  it('feedback을 두 번 보내도 한 줄', async () => {
    const s = new MemoryStore();
    expect(await recordEvent(s, 'feedback', { laugh: 'lol' }, ctx(), NOW)).toBe(true);
    expect(await recordEvent(s, 'feedback', { laugh: 'none' }, ctx(), NOW + 1)).toBe(false);
    expect(s.debugEvents()).toHaveLength(1);
    expect(s.debugEvents()[0].props).toEqual({ laugh: 'lol' });
    // 다른 사람은 따로 기록
    expect(await recordEvent(s, 'feedback', { laugh: 'some' }, ctx({ playerKey: H('b') }), NOW + 2)).toBe(true);
  });

  it('잘못된 props는 기록하지 않고 던지지도 않는다', async () => {
    const s = new MemoryStore();
    expect(await recordEvent(s, 'feedback', { laugh: 'x' } as never, ctx(), NOW)).toBe(false);
    expect(s.debugEvents()).toHaveLength(0);
  });

  it('저장소가 던져도 recordEvent/recordEvents/safeCleanup은 던지지 않는다', async () => {
    const broken = {
      insertEvents: async () => { throw new Error('down'); },
      cleanup: async () => { throw new Error('down'); },
    } as unknown as RoomStore;
    expect(await recordEvent(broken, 'transport', { bell: true }, ctx(), NOW)).toBe(false);
    expect(await recordEvents(broken, [{ type: 'transport', props: { bell: true }, ctx: ctx() }], NOW)).toBe(0);
    expect(await safeCleanup(broken, NOW)).toEqual({ rooms: 0, matches: 0, events: 0 });
  });

  it('recordEvents: 유효한 것만 한 번에 기록', async () => {
    const s = new MemoryStore();
    const n = await recordEvents(
      s,
      [
        { type: 'match_started', props: { seq: 1, rematch: false }, ctx: ctx() },
        { type: 'feedback', props: { laugh: 'bad' } as never, ctx: ctx() },
        { type: 'match_ended', props: { reason: 'sunk2', rounds: 11, winner: 1 }, ctx: ctx() },
      ],
      NOW,
    );
    expect(n).toBe(2);
    expect(s.debugEvents().map((e) => e.type)).toEqual(['match_started', 'match_ended']);
  });
});
