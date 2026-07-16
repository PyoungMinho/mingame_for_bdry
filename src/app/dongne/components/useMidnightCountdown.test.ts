// @vitest-environment jsdom
/**
 * 동네고수 카운트다운 — BUG-2 회귀(자정 정각 "24:00:00" 플래시) + 포맷 (QA 플랜 BUG-2)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMidnightCountdown, formatHMS } from './useMidnightCountdown';

afterEach(() => {
  vi.useRealTimers();
});

describe('BUG-2 자정 정각 카운트다운', () => {
  it('KST 자정 정각(msUntilMidnight=86400000)에도 시(HH)는 24가 아니라 00~23', () => {
    // 2026-08-16 00:00:00 KST = 2026-08-15T15:00:00Z (msUntilMidnightKST()가 정확히 86_400_000 반환)
    vi.setSystemTime(new Date('2026-08-15T15:00:00.000Z'));
    const { result } = renderHook(() => useMidnightCountdown());
    expect(result.current.hours).toBeLessThan(24);
    expect(result.current.hours).toBe(0);
    const hms = formatHMS(result.current);
    expect(hms.startsWith('24')).toBe(false);
    expect(hms).toBe('00:00:00');
  });

  it('자정 직전(23:59:59.999)엔 남은 시간이 00:00:00 근처(음수·24시 없음)', () => {
    vi.setSystemTime(new Date('2026-08-15T14:59:59.999Z')); // KST 23:59:59.999
    const { result } = renderHook(() => useMidnightCountdown());
    expect(result.current.hours).toBeGreaterThanOrEqual(0);
    expect(result.current.hours).toBeLessThan(24);
  });

  it('정오 KST(12:00 정각)엔 정확히 12:00:00 남음', () => {
    vi.setSystemTime(new Date('2026-08-15T03:00:00Z')); // KST 12:00 정각
    const { result } = renderHook(() => useMidnightCountdown());
    expect(result.current.hours).toBe(12);
    expect(formatHMS(result.current)).toBe('12:00:00');
  });

  it('formatHMS 는 2자리 zero-pad', () => {
    expect(formatHMS({ hours: 3, minutes: 5, seconds: 9, totalMs: 0 })).toBe('03:05:09');
  });
});
