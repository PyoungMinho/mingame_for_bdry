/**
 * 공유 — 스포 없는 문구(인물·증거 이름·트릭 어휘 금지) · 훅 순환 · 시간 문구 · OG 화이트리스트 · 카카오 키 · 폴백 체인.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KAKAO_JS_KEY_FALLBACK as GUNG_KAKAO_KEY } from '@/lib/gung/share';
import { CASE } from './case-data';
import type { EndingId, Grade } from './types';
import {
  HOOKS,
  KAKAO_JS_KEY_FALLBACK,
  TRICK_WORDS,
  buildOgQuery,
  genericPayload,
  hookIndex,
  kakaoJsKey,
  ogResultUrl,
  parseOgParams,
  share,
  sharePayload,
  shareText,
  timePhrase,
  toOgParams,
  type KakaoLike,
  type ShareInput,
} from './share';

const input = (ending: EndingId, grade: Grade, extra: Partial<ShareInput['result']> = {}, plays = 1): ShareInput => ({
  result: { ending, grade, title: '칭호', stars: 5, evidence: 15, actionsLeft: 2, ...extra },
  plays,
});

/** 공유에 절대 들어가면 안 되는 낱말 — 인물 이름·증거 이름·트릭·숨은 엔딩 내용 */
const FORBIDDEN = [
  ...CASE.profiles.map((p) => p.name),
  '나한결',
  '표명환',
  ...CASE.evidence.map((e) => e.name),
  ...TRICK_WORDS,
  '알람',
  '미안',
];

const ALL: [EndingId, Grade][] = [
  ['perfect', 'S'],
  ['perfect', 'A'],
  ['hidden', 'A'],
  ['short', 'B'],
  ['short', 'C'],
  ['wrong-S1', 'C'],
  ['wrong-S2', 'C'],
  ['wrong-S3', 'C'],
  ['wrong-S4', 'C'],
  ['timeout', 'C'],
  ['excluded', 'C'],
];

describe('공유 문구(시스템 4-4)', () => {
  it('5줄 형식', () => {
    const t = shareText({ result: { ending: 'perfect', grade: 'A', title: CASE.titles.A, stars: 5, evidence: 15, actionsLeft: 2 }, plays: 2 });
    expect(t.split('\n')).toEqual([
      '「스마트홈 살인사건 — 목격자는 AI 스피커」',
      'A등급 · 로그를 읽는 사람',
      '결정적 모순 5/7 · 증거 15/18 · 강력팀 도착 20분 전 해결',
      'AI는 거짓말을 안 해. 다만 다 말하지도 않지.',
      'https://project-orsrw.vercel.app/witness',
    ]);
  });

  it('어떤 엔딩이든 스포일러 낱말이 없다(문구·카카오·URL)', () => {
    for (const [e, g] of ALL)
      for (let plays = 1; plays <= 4; plays++) {
        const p = sharePayload(input(e, g, { title: e === 'perfect' && g === 'S' ? CASE.titles.S : CASE.titles.A }, plays));
        const blob = [p.title, p.text, p.copyText, p.url, p.kakao.content.title, p.kakao.content.description, p.kakao.content.imageUrl, ...p.kakao.buttons.map((b) => b.title)].join('\n');
        for (const w of FORBIDDEN) expect(blob.includes(w), `${e}/${g}: "${w}"`).toBe(false);
      }
    const g = genericPayload();
    for (const w of FORBIDDEN) expect([g.text, g.copyText, g.kakao.content.description].join('\n').includes(w)).toBe(false);
  });

  it('오인 체포는 인물과 관계없이 같은 칭호 · 숨은 엔딩은 사실만', () => {
    const a = shareText(input('wrong-S1', 'C', { title: CASE.titles.wrong }));
    const b = shareText(input('wrong-S3', 'C', { title: CASE.titles.wrong }));
    expect(a).toBe(b);
    expect(a).toContain('스피커도 당황한 추리');
    expect(shareText(input('hidden', 'S', { title: CASE.titles.S }))).toContain('숨은 엔딩 발견');
  });

  it('공유 URL 엔 파라미터가 없다', () => {
    const p = sharePayload(input('perfect', 'A'));
    expect(p.url).toBe('https://project-orsrw.vercel.app/witness');
    expect(p.copyText.endsWith(p.url)).toBe(true);
  });

  it('훅 4개를 (plays − 1) % 4 로 순환', () => {
    expect([1, 2, 3, 4, 5].map(hookIndex)).toEqual([0, 1, 2, 3, 0]);
    expect(hookIndex(0)).toBe(0);
    expect(shareText(input('perfect', 'A', {}, 3))).toContain(HOOKS[2]);
  });

  it('시간 문구: 해결 / 지목 / 생략(시간 초과·수사 배제) / 행동 0', () => {
    expect(timePhrase({ ending: 'perfect', actionsLeft: 4 })).toBe('강력팀 도착 40분 전 해결');
    expect(timePhrase({ ending: 'short', actionsLeft: 1 })).toBe('강력팀 도착 10분 전 지목');
    expect(timePhrase({ ending: 'wrong-S2', actionsLeft: 3 })).toBe('강력팀 도착 30분 전 지목');
    expect(timePhrase({ ending: 'timeout', actionsLeft: 0 })).toBeNull();
    expect(timePhrase({ ending: 'excluded', actionsLeft: 5 })).toBeNull();
    expect(timePhrase({ ending: 'hidden', actionsLeft: 0 })).toBe('사이렌과 함께 해결');
    expect(shareText(input('timeout', 'C', { title: CASE.titles.timeout })).split('\n')[2]).toBe('결정적 모순 5/7 · 증거 15/18');
  });
});

describe('OG 쿼리(디자인 §9-2) — 정수·열거형만', () => {
  it('왕복', () => {
    const i = input('hidden', 'S', { stars: 7, evidence: 18, actionsLeft: 0 }, 6);
    const q = buildOgQuery(toOgParams(i));
    expect(q).toBe('g=S&s=7&e=18&r=0&k=h&v=1');
    expect(parseOgParams(new URLSearchParams(q))).toEqual(toOgParams(i));
    expect(ogResultUrl(i)).toBe(`https://project-orsrw.vercel.app/witness/og?${q}`);
  });

  it('범인을 담을 자리가 없다 — 오인 체포는 모두 k=w', () => {
    for (const e of ['wrong-S1', 'wrong-S2', 'wrong-S3', 'wrong-S4'] as EndingId[]) expect(toOgParams(input(e, 'C')).k).toBe('w');
  });

  it('하나라도 틀리면 null(기본 커버)', () => {
    const bad = ['g=X&s=1&e=1&r=1&k=p&v=0', 'g=S&s=8&e=1&r=1&k=p&v=0', 'g=S&s=1&e=19&r=1&k=p&v=0', 'g=S&s=1&e=1&r=13&k=p&v=0', 'g=S&s=01&e=1&r=1&k=p&v=0', 'g=S&s=1&e=1&r=1&k=z&v=0', 'g=S&s=1&e=1&r=1&k=p&v=4', 'g=S&s=1&e=1&r=1&k=p', 'g=S&s=-1&e=1&r=1&k=p&v=0', 'g=S&s=1.5&e=1&r=1&k=p&v=0'];
    for (const q of bad) expect(parseOgParams(new URLSearchParams(q)), q).toBeNull();
  });
});

describe('카카오(P1) · 폴백 체인', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('JS 키 = /gung 과 같은 공개 키, NEXT_PUBLIC_KAKAO_JS_KEY 우선', () => {
    expect(KAKAO_JS_KEY_FALLBACK).toBe(GUNG_KAKAO_KEY);
    vi.stubEnv('NEXT_PUBLIC_KAKAO_JS_KEY', '');
    expect(kakaoJsKey()).toBe(KAKAO_JS_KEY_FALLBACK);
    vi.stubEnv('NEXT_PUBLIC_KAKAO_JS_KEY', ' env-key ');
    expect(kakaoJsKey()).toBe('env-key');
  });

  it('카카오 → Web Share → 클립보드 → 실패', async () => {
    const p = sharePayload(input('perfect', 'A'));
    const sent: unknown[] = [];
    const kakao: KakaoLike = { isInitialized: () => true, init: () => undefined, Share: { sendDefault: (t) => void sent.push(t) } };
    expect(await share(p, { kakao })).toBe('kakao');
    expect(sent[0]).toBe(p.kakao);
    const shared: ShareData[] = [];
    expect(await share(p, { kakao: null, navigator: { share: async (d?: ShareData) => void shared.push(d!) } })).toBe('webshare');
    expect(shared[0]).toEqual({ title: p.title, text: p.text, url: p.url });
    const abort = Object.assign(new Error('x'), { name: 'AbortError' });
    expect(await share(p, { kakao: null, navigator: { share: async () => Promise.reject(abort) } })).toBe('cancelled');
    let copied = '';
    const clipboard = { writeText: async (t: string) => void (copied = t) } as unknown as Clipboard;
    expect(await share(p, { kakao: null, navigator: { clipboard } })).toBe('copied');
    expect(copied).toBe(p.copyText);
    expect(await share(p, { kakao: null, navigator: {} })).toBe('failed');
  });

  it('카카오 전송이 throw 하면 다음 단계로', async () => {
    const p = sharePayload(input('perfect', 'A'));
    const kakao: KakaoLike = {
      isInitialized: () => true,
      init: () => undefined,
      Share: {
        sendDefault: () => {
          throw new Error('domain');
        },
      },
    };
    let copied = '';
    const clipboard = { writeText: async (t: string) => void (copied = t) } as unknown as Clipboard;
    expect(await share(p, { kakao, navigator: { clipboard } })).toBe('copied');
    expect(copied).toBe(p.copyText);
  });
});
