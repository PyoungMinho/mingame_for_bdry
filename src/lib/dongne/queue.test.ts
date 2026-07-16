/**
 * 동네고수 queue.ts — 시간·출제·힌트 단일 진실 소스 회귀 (QA 테스트 플랜 §3, R5 최우선)
 *
 * 전 케이스 날짜 주입(`now: Date` 인자)으로 결정론 검증 — Math.random·실시간 의존 금지.
 * ID는 docs/qa/dongne-test-plan.md 의 Q-xx 에 대응한다.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  EPOCH_KST,
  MAX_DIST_KM,
  REGION_CODES,
  REGION_COUNT,
  getTodayGameNo,
  getDateForGame,
  getMidnightKST,
  msUntilMidnightKST,
  getRegionCodeForGame,
  getTodayRegionCode,
  haversineKm,
  bearingDeg,
  toDirection8,
  proximityPct,
  computeHint,
  DIRECTION_ARROW,
} from './queue';
import manifest from '@/app/dongne/data/manifest.json';
import type { Region } from './types';

const DAY_MS = 86_400_000;
const REGION_SET = new Set(REGION_CODES);

/** KST 벽시계 → UTC Date (KST=UTC+9, 고정). h-9 음수는 Date.UTC가 자연 롤오버. */
function kst(y: number, mo: number, d: number, h = 0, mi = 0, s = 0, ms = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, s, ms));
}

/** 같은 시 분구 그룹 키(queue.ts cityGroup 재현) — Q-33/34 검증용 */
function cityGroup(code: string): string {
  return code[4] !== '0' ? code.slice(0, 4) : code;
}

/** cycle c 의 250개 출제 순서(gameNo c*250+1 .. c*250+250) */
function cycleOrder(c: number): string[] {
  return Array.from({ length: REGION_COUNT }, (_, i) => getRegionCodeForGame(c * REGION_COUNT + i + 1));
}

const SEOUL = { lat: 37.5827, lng: 126.9746 }; // 종로구(서울) centroid
const BUSAN = { lat: 35.1034, lng: 129.0309 }; // 중구(부산) centroid

// ────────────────────────── 3-1. KST 자정 경계 · EPOCH 상대 위치 ──────────────────────────

describe('§3-1 KST 자정 경계 · EPOCH 상대 위치', () => {
  // EPOCH 상수 변경에도 유효하도록 EPOCH_KST에서 파생
  const [EY, EM, ED] = EPOCH_KST.split('-').map(Number);

  it('Q-01 EPOCH 당일 KST 00:00:00 → gameNo=1', () => {
    expect(getTodayGameNo(kst(EY, EM, ED, 0, 0, 0))).toBe(1);
  });

  it('Q-02 EPOCH 전날 KST 23:59:59 → gameNo=0 (호출측 프리런치 가드)', () => {
    expect(getTodayGameNo(new Date(kst(EY, EM, ED).getTime() - 1000))).toBe(0);
  });

  it('Q-03 자정 직전 23:59:59.999 → 회차 불변 & msUntilMidnight ≈ 1ms', () => {
    const now = kst(2026, 7, 20, 23, 59, 59, 999);
    expect(getTodayGameNo(now)).toBe(getTodayGameNo(kst(2026, 7, 20, 0)));
    expect(msUntilMidnightKST(now)).toBe(1);
  });

  it('Q-04 자정 정각 00:00:00.000 → 회차 +1 & msUntilMidnight=86400000', () => {
    const before = kst(2026, 7, 20, 12);
    const midnight = kst(2026, 7, 21, 0, 0, 0, 0);
    expect(getTodayGameNo(midnight)).toBe(getTodayGameNo(before) + 1);
    expect(msUntilMidnightKST(midnight)).toBe(DAY_MS);
  });

  it('Q-05 같은 KST 날짜의 정오·오후는 전부 동일 gameNo', () => {
    // 2026-07-20 KST 12:00 / 13:00 / 20:00 = UTC 03:00 / 04:00 / 11:00
    const a = new Date('2026-07-20T03:00:00Z');
    const b = new Date('2026-07-20T04:00:00Z');
    const c = new Date('2026-07-20T11:00:00Z');
    const g = getTodayGameNo(a);
    expect(getTodayGameNo(b)).toBe(g);
    expect(getTodayGameNo(c)).toBe(g);
  });

  it('Q-06 서버 TZ(UTC/America/LA)와 무관하게 동일 UTC 시각은 동일 gameNo·code', () => {
    const instant = new Date('2026-08-01T05:00:00Z');
    const original = process.env.TZ;
    try {
      const results: Array<{ g: number; code: string }> = [];
      for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Seoul']) {
        process.env.TZ = tz;
        const g = getTodayGameNo(instant);
        results.push({ g, code: getRegionCodeForGame(g) });
      }
      expect(new Set(results.map((r) => r.g)).size).toBe(1);
      expect(new Set(results.map((r) => r.code)).size).toBe(1);
    } finally {
      process.env.TZ = original;
    }
  });

  it('Q-07 EPOCH 이전(2026-01-01) → gameNo≤0 & getTodayRegionCode RangeError', () => {
    const now = kst(2026, 1, 1, 12);
    expect(getTodayGameNo(now)).toBeLessThanOrEqual(0);
    expect(() => getTodayRegionCode(now)).toThrow(RangeError);
  });

  it('Q-08 연말·연초 12/31 → 1/1 KST 경계에서 gameNo 정확히 +1', () => {
    const dec31 = kst(2026, 12, 31, 12);
    const jan1 = kst(2027, 1, 1, 12);
    expect(getTodayGameNo(jan1) - getTodayGameNo(dec31)).toBe(1);
  });

  it('Q-09 윤년 2028-02-28 → 02-29 → 03-01 KST 연속 +1 (윤일 누락/중복 없음)', () => {
    const g28 = getTodayGameNo(kst(2028, 2, 28, 12));
    const g29 = getTodayGameNo(kst(2028, 2, 29, 12));
    const g01 = getTodayGameNo(kst(2028, 3, 1, 12));
    expect(g29 - g28).toBe(1);
    expect(g01 - g29).toBe(1);
  });

  it('Q-10 getDateForGame(1) === EPOCH_KST (2026-07-16)', () => {
    expect(getDateForGame(1)).toBe(EPOCH_KST);
    expect(EPOCH_KST).toBe('2026-07-16');
  });

  it('Q-11 왕복: getDateForGame(getTodayGameNo(now)) === now의 KST 날짜 (ping 스탬프 정합)', () => {
    for (const iso of ['2026-07-18T05:00:00Z', '2026-08-01T05:00:00Z', '2026-12-31T14:00:00Z']) {
      const now = new Date(iso);
      // now의 KST 달력일 = (utc + 9h) 를 UTC 자정으로 절삭한 날짜
      const kstDate = new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
      expect(getDateForGame(getTodayGameNo(now))).toBe(kstDate);
    }
  });
});

// ────────────────────────── 3-2. 결정론 출제 ──────────────────────────

describe('§3-2 결정론 출제', () => {
  it('Q-20 같은 gameNo 재호출은 항상 같은 code (1000회)', () => {
    const first = getRegionCodeForGame(42);
    for (let i = 0; i < 1000; i++) expect(getRegionCodeForGame(42)).toBe(first);
  });

  it('Q-21 게임=아카이브=OG=ping 4경로 동일 code (단일 소스 getRegionCodeForGame)', () => {
    // 4경로 모두 getRegionCodeForGame(getTodayGameNo(now)) 를 호출한다(코드상 단일 진실 소스).
    const now = kst(2026, 8, 15, 10);
    const direct = getRegionCodeForGame(getTodayGameNo(now));
    expect(getTodayRegionCode(now)).toBe(direct); // 게임 훅 경로
    // 아카이브/OG/ping도 동일 함수를 재사용 → 임의 gameNo 안정성으로 대리 검증
    for (let g = 1; g <= 500; g++) expect(getRegionCodeForGame(g)).toBe(getRegionCodeForGame(g));
  });

  it('Q-22 [property] 임의 gameNo≥1 은 항상 유효 code 반환·throw 없음', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (g) => {
        const code = getRegionCodeForGame(g);
        return REGION_SET.has(code);
      }),
      { numRuns: 2000 },
    );
  });

  it('Q-23 비정수·0·음수·NaN 은 RangeError', () => {
    for (const bad of [0, -1, 1.5, NaN, Infinity, -0.5]) {
      expect(() => getRegionCodeForGame(bad)).toThrow(RangeError);
    }
  });
});

// ────────────────────────── 3-3. 셔플 공정성 ──────────────────────────

describe('§3-3 셔플 공정성 (R5)', () => {
  it('Q-30 한 사이클(250회)은 전 지역 정확히 1회 = 완전 순열 (cycle 0..29)', () => {
    for (let c = 0; c < 30; c++) {
      const order = cycleOrder(c);
      expect(order).toHaveLength(REGION_COUNT);
      expect(new Set(order).size).toBe(REGION_COUNT); // 중복 0
      expect(new Set(order)).toEqual(REGION_SET); // 누락 0 (REGION_CODES와 동일 집합)
    }
  });

  it('Q-31 4바퀴(1000회) 후 각 지역 정확히 4회 (min=max=4)', () => {
    const counts = new Map<string, number>();
    for (let g = 1; g <= 1000; g++) {
      const code = getRegionCodeForGame(g);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    expect(counts.size).toBe(REGION_COUNT);
    const values = [...counts.values()];
    expect(Math.min(...values)).toBe(4);
    expect(Math.max(...values)).toBe(4);
  });

  it('Q-32 사이클 경계: 직전 사이클 tail 7이 새 사이클 head 7에 재등장 0건', () => {
    for (let c = 0; c < 10; c++) {
      const prev = cycleOrder(c);
      const next = cycleOrder(c + 1);
      const tail = new Set(prev.slice(-7));
      const headHits = next.slice(0, 7).filter((code) => tail.has(code));
      expect(headHits).toHaveLength(0);
    }
  });

  it('Q-33 분구 연속 회피(사이클 내): 인접 두 회차 같은 cityGroup 0건', () => {
    for (let c = 0; c < 10; c++) {
      const order = cycleOrder(c);
      for (let i = 1; i < order.length; i++) {
        expect(cityGroup(order[i])).not.toBe(cityGroup(order[i - 1]));
      }
    }
  });

  it('Q-34 분구 연속 회피(경계): 사이클 마지막·다음 첫 회차 다른 group', () => {
    for (let c = 0; c < 10; c++) {
      const prev = cycleOrder(c);
      const next = cycleOrder(c + 1);
      expect(cityGroup(next[0])).not.toBe(cityGroup(prev[prev.length - 1]));
    }
  });

  it('Q-35 셔플 결정론: cycleOrder(0) 두 번 계산 완전 동일', () => {
    expect(cycleOrder(0)).toEqual(cycleOrder(0));
  });

  it('Q-36 wrap-around ≥250 (gameNo=251) → cycleOrder(1)[0], throw 없음', () => {
    const code = getRegionCodeForGame(251);
    expect(REGION_SET.has(code)).toBe(true);
    expect(code).toBe(cycleOrder(1)[0]);
  });
});

// ────────────────────────── 3-4. 힌트 수학 ──────────────────────────

describe('§3-4 힌트 수학 (haversine · 8방위 · 근접도)', () => {
  it('Q-40 haversine 서울↔부산 ≈ 330±10km', () => {
    const d = haversineKm(SEOUL, BUSAN);
    expect(d).toBeGreaterThanOrEqual(320);
    expect(d).toBeLessThanOrEqual(340);
  });

  it('Q-41 같은 좌표 거리 0km & proximityPct 100', () => {
    expect(haversineKm(SEOUL, SEOUL)).toBe(0);
    expect(proximityPct(0)).toBe(100);
  });

  it('Q-42 haversine 대칭 (a,b)==(b,a)', () => {
    expect(haversineKm(SEOUL, BUSAN)).toBeCloseTo(haversineKm(BUSAN, SEOUL), 9);
  });

  it('Q-43 8방위 45° 구간 정매핑', () => {
    expect(toDirection8(0)).toBe('N');
    expect(toDirection8(45)).toBe('NE');
    expect(toDirection8(90)).toBe('E');
    expect(toDirection8(135)).toBe('SE');
    expect(toDirection8(180)).toBe('S');
    expect(toDirection8(225)).toBe('SW');
    expect(toDirection8(270)).toBe('W');
    expect(toDirection8(315)).toBe('NW');
    // ±22.5° 경계 (Math.round 반올림 규칙)
    expect(toDirection8(22.5)).toBe('NE');
    expect(toDirection8(67.5)).toBe('E');
  });

  it('Q-44 정북 랩: 359°·1°·360° 전부 N (모듈로 8)', () => {
    expect(toDirection8(359)).toBe('N');
    expect(toDirection8(1)).toBe('N');
    expect(toDirection8(360)).toBe('N');
  });

  it('Q-45 방위 반대: 서울→부산 SE, 부산→서울 NW', () => {
    expect(toDirection8(bearingDeg(SEOUL, BUSAN))).toBe('SE');
    expect(toDirection8(bearingDeg(BUSAN, SEOUL))).toBe('NW');
  });

  it('Q-46 근접도 캡(오답): computeHint 는 거리 0이어도 proximity ≤ 99 (100은 정답 전용)', () => {
    const near = { lat: SEOUL.lat + 0.001, lng: SEOUL.lng + 0.001 };
    const hint = computeHint(near, SEOUL);
    expect(hint.proximity).toBeLessThanOrEqual(99);
    // 완전 동일 좌표(거리 반올림 0)에서도 캡 유지
    expect(computeHint(SEOUL, SEOUL).proximity).toBe(99);
  });

  it('Q-47 정답 근접도 = 100 (proximityPct(0), 정답 분기 전용값)', () => {
    // 정답 기록은 useGame 이 {distanceKm:0, direction:null, proximity:100} 로 직접 세팅한다.
    // 그 값의 근거인 proximityPct(0)===100 을 여기서 고정한다(computeHint 는 절대 100 미반환 — Q-46).
    expect(proximityPct(0)).toBe(100);
  });

  it('Q-48 근접도 하한: 거리≥MAX_DIST 는 0 (음수 금지)', () => {
    expect(proximityPct(MAX_DIST_KM)).toBe(0);
    expect(proximityPct(800)).toBe(0);
    expect(proximityPct(9999)).toBe(0);
  });

  it('Q-49 [property] 임의 두 실 centroid: proximity∈[0,99], 거리∈[0,599]', () => {
    const regions = manifest as Region[];
    const idx = fc.integer({ min: 0, max: regions.length - 1 });
    fc.assert(
      fc.property(idx, idx, (i, j) => {
        const hint = computeHint(regions[i].centroid, regions[j].centroid);
        return (
          hint.proximity >= 0 &&
          hint.proximity <= 99 &&
          hint.distanceKm >= 0 &&
          hint.distanceKm <= 599
        );
      }),
      { numRuns: 3000 },
    );
  });

  it('Q-50 거리 정수 반올림: computeHint.distanceKm === Math.round(haversineKm)', () => {
    const hint = computeHint(SEOUL, BUSAN);
    expect(hint.distanceKm).toBe(Math.round(haversineKm(SEOUL, BUSAN)));
    expect(Number.isInteger(hint.distanceKm)).toBe(true);
  });

  it('DIRECTION_ARROW 는 색타일 아닌 텍스트 화살표만 (트레이드드레스 무관)', () => {
    expect(Object.values(DIRECTION_ARROW).join('')).toBe('↑↗→↘↓↙←↖');
  });
});
