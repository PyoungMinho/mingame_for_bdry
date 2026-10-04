import { describe, expect, it } from 'vitest';
import { hash32, makeRng, mix, shuffle } from './rng';
import {
  CODE_RE,
  SEED_ALPHABET,
  TAG_A,
  TAG_B,
  buildHostRecoveryUrl,
  buildJoinUrl,
  caseTag,
  filterCodeInput,
  formatRoomCode,
  generateRoomCode,
  generateSeed,
  isValidRoomCode,
  normalizeCode,
  parseEntryParams,
  parseRoomCode,
} from './room';

/** 정해진 바이트열을 순환해서 내주는 가짜 난수원 */
function fixedBytes(...seq: number[]) {
  let k = 0;
  return (len: number) => {
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = seq[k++ % seq.length];
    return out;
  };
}

describe('rng — flight/rng.ts 와 같은 알고리즘(고정값)', () => {
  it('hash32 · mulberry32 · mix 고정값', () => {
    expect([hash32(''), hash32('gung'), hash32('7F3K')]).toEqual([167010153, 1784957149, 1380499054]);
    const r = makeRng(42);
    expect([r(), r(), r()]).toEqual([0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
    expect(mix(1, 2)).toBe(3668340011);
  });

  it('shuffle 은 원본을 건드리지 않고 순열을 만든다', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, makeRng(7));
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.slice().sort()).toEqual(src);
    expect(shuffle(src, makeRng(7))).toEqual(out);
  });
});

describe('room — 방 코드', () => {
  it('시드 문자 31종, 0 O 1 I L 없음', () => {
    expect(SEED_ALPHABET).toHaveLength(31);
    expect(new Set(SEED_ALPHABET).size).toBe(31);
    for (const ch of '0O1IL') expect(SEED_ALPHABET).not.toContain(ch);
    for (const ch of SEED_ALPHABET) expect(CODE_RE.test(`${ch}${ch}${ch}${ch}5`)).toBe(true);
    for (const ch of '0O1IL') expect(CODE_RE.test(`${ch}AAA5`)).toBe(false);
  });

  it('검증 정규식 — 4자 시드 + 4~6', () => {
    expect(isValidRoomCode('7F3K5')).toBe(true);
    expect(isValidRoomCode('7f3k-5')).toBe(true);
    expect(isValidRoomCode(' 7F3K 5 ')).toBe(true);
    expect(isValidRoomCode('7F3K3')).toBe(false);
    expect(isValidRoomCode('7F3K7')).toBe(false);
    expect(isValidRoomCode('7F3K')).toBe(false);
    expect(isValidRoomCode('7F3KK5')).toBe(false);
    expect(isValidRoomCode('7O3K5')).toBe(false);
  });

  it('파싱·표시·정규화', () => {
    expect(normalizeCode('7f3k-5')).toBe('7F3K5');
    expect(normalizeCode('7F3K – 5')).toBe('7F3K5');
    expect(parseRoomCode('7f3k-5')).toEqual({ code: '7F3K5', seed: '7F3K', n: 5, display: '7F3K-5', tag: caseTag('7F3K') });
    expect(parseRoomCode('nope')).toBeNull();
    expect(formatRoomCode('7F3K5')).toBe('7F3K-5');
    expect(formatRoomCode('bad')).toBe('BAD');
  });

  it('CodeInput 필터 — 자리별 허용 문자만, 최대 5자', () => {
    expect(filterCodeInput('7f3k-5')).toBe('7F3K5');
    expect(filterCodeInput('7O1F3K5')).toBe('7F3K5'); // O·1 무시
    expect(filterCodeInput('7F3K7')).toBe('7F3K'); // 5번째는 4~6만
    expect(filterCodeInput('7F3K59999')).toBe('7F3K5');
    expect(filterCodeInput('')).toBe('');
  });

  it('생성 — 주입 난수원, 형식 보장, 거절 샘플링(248 이상 버림)', () => {
    const room = generateRoomCode(5, fixedBytes(0, 1, 2, 3));
    expect(room.code).toBe('23455');
    expect(CODE_RE.test(room.code)).toBe(true);
    // 255·250·248 은 버려지고 247(=31×7+30 → 'Z'), 30('Z') 만 쓰인다
    expect(generateSeed(fixedBytes(255, 250, 248, 247, 30))).toBe('ZZZZ');
    expect(() => generateRoomCode(7 as never)).toThrow();
  });

  it('기본 난수원(crypto) — 형식이 늘 맞는다', () => {
    for (let i = 0; i < 200; i++) {
      const n = ([4, 5, 6] as const)[i % 3];
      const r = generateRoomCode(n);
      expect(CODE_RE.test(r.code)).toBe(true);
      expect(r.n).toBe(n);
    }
  });

  it('사건 표식 — 고정값(재정렬 금지) · 같은 시드 = 같은 표식', () => {
    expect(TAG_A).toHaveLength(16);
    expect(TAG_B).toHaveLength(16);
    expect(['7F3K', '2222', 'ZZZZ', 'ABCD'].map(caseTag)).toEqual(['청자 석류', '대숲 까치', '촛불 연꽃', '옥빛 모란']);
    expect(caseTag('7f3k')).toBe(caseTag('7F3K'));
    // QA BUG-03: 인원 숫자만 다른 코드는 표식도 달라야 한다(인원 오타 검출). 5인 = 시드만 준 값(하위 호환)
    expect(parseRoomCode('7F3K4')!.tag).not.toBe(parseRoomCode('7F3K6')!.tag);
    expect(parseRoomCode('7F3K5')!.tag).toBe(caseTag('7F3K'));
  });

  it('입장 URL 만들기·읽기', () => {
    expect(buildJoinUrl('https://project-orsrw.vercel.app/', '7f3k-5', 1)).toBe('https://project-orsrw.vercel.app/gung?code=7F3K5&v=1');
    expect(buildJoinUrl('http://localhost:3000', '7F3K5')).toBe('http://localhost:3000/gung?code=7F3K5');
    expect(buildHostRecoveryUrl('https://x.app', '7F3K5')).toBe('https://x.app/gung?code=7F3K5&as=host');

    const e = parseEntryParams('?code=7f3k5&as=host&v=2');
    expect(e.room?.code).toBe('7F3K5');
    expect(e.asHost).toBe(true);
    expect(e.caseVersion).toBe(2);
    expect(e.invalidCode).toBe(false);

    expect(parseEntryParams('code=XXXX9')).toMatchObject({ room: null, invalidCode: true, asHost: false, caseVersion: null });
    expect(parseEntryParams(new URLSearchParams(''))).toMatchObject({ room: null, invalidCode: false });
    expect(parseEntryParams('code=7F3K5&v=abc').caseVersion).toBeNull();
  });
});

describe('큰 화면 현장 링크(통합)', () => {
  it('buildSceneUrl — /gung/scene?code=… (코드 정규화 · 끝 / 정리 · 코드 없으면 경로만)', async () => {
    const { buildSceneUrl, SCENE_ROUTE_PATH } = await import('./room');
    expect(SCENE_ROUTE_PATH).toBe('/gung/scene');
    expect(buildSceneUrl('https://x.app/', '7f3k5')).toBe('https://x.app/gung/scene?code=7F3K5');
    expect(buildSceneUrl('https://x.app', null)).toBe('https://x.app/gung/scene');
  });
});
