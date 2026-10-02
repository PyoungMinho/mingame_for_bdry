import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFixtureCase } from './fixtures';
import { applyAction, newHostGame, resultOf } from './game';
import {
  KAKAO_JS_KEY_FALLBACK,
  KAKAO_SCRIPT_ID,
  KAKAO_SDK_URL,
  buildOgResultQuery,
  canDirectDownload,
  copyText,
  detectInApp,
  externalOpenUrl,
  formatYmd,
  genericPayload,
  getKakao,
  invitePayload,
  kakaoJsKey,
  loadKakaoSdk,
  ogResultUrl,
  openExternal,
  parseOgResultParams,
  readyKakao,
  resetKakaoLoader,
  resultPayload,
  resultShareInput,
  share,
  toOgParams,
  verdictHeadline,
  ymd,
  type KakaoFeedTemplate,
  type KakaoLike,
  type ResultShareInput,
} from './share';

const UA = {
  kakaoIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36 KAKAOTALK/10.4.5',
  insta: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/119 Mobile Safari/537.36 Instagram 300.0.0.0',
  instaIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0',
  fb: 'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/440.0]',
  line: 'Mozilla/5.0 (iPhone) Mobile/15E148 Safari Line/13.20.0',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

function fakeKakao(opts: { initialized?: boolean; sendThrows?: boolean } = {}) {
  let inited = opts.initialized ?? false;
  const sent: KakaoFeedTemplate[] = [];
  const k: KakaoLike & { sent: KakaoFeedTemplate[]; keys: string[] } = {
    sent,
    keys: [],
    isInitialized: () => inited,
    init(key: string) {
      this.keys.push(key);
      inited = true;
    },
    Share: {
      sendDefault(t) {
        if (opts.sendThrows) throw new Error('KakaoError');
        sent.push(t);
      },
    },
  };
  return k;
}

const resultInput = (o: Partial<ResultShareInput> = {}): ResultShareInput => ({
  caught: true,
  hits: 3,
  judges: 4,
  minutes: 52,
  revoted: false,
  n: 5,
  date: '20261002',
  ...o,
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  resetKakaoLoader();
});

describe('share — 카카오 키·SDK', () => {
  it('env 키 우선, 없으면 공개용 상수', () => {
    vi.stubEnv('NEXT_PUBLIC_KAKAO_JS_KEY', '');
    expect(kakaoJsKey()).toBe(KAKAO_JS_KEY_FALLBACK);
    vi.stubEnv('NEXT_PUBLIC_KAKAO_JS_KEY', ' abc123 ');
    expect(kakaoJsKey()).toBe('abc123');
    expect(KAKAO_SDK_URL).toBe('https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js');
  });

  it('getKakao/readyKakao — 모양 검사 + 1회 init', () => {
    expect(getKakao({})).toBeNull();
    expect(getKakao({ Kakao: { init: 1 } })).toBeNull();
    const k = fakeKakao();
    expect(readyKakao({ Kakao: k }, 'KEY')).toBe(k);
    expect(readyKakao({ Kakao: k }, 'KEY')).toBe(k);
    expect(k.keys).toEqual(['KEY']); // 이미 초기화돼 있으면 다시 init 안 함
  });

  it('loadKakaoSdk — 이미 있으면 즉시, 없으면 script 주입(crossOrigin) 후 로드되면 init', async () => {
    const ready = fakeKakao({ initialized: true });
    await expect(loadKakaoSdk({ win: { Kakao: ready } })).resolves.toBe(ready);

    const win: { Kakao?: unknown } = {};
    const listeners: Record<string, () => void> = {};
    const script = {
      id: '',
      src: '',
      async: false,
      crossOrigin: '',
      integrity: '',
      addEventListener: (ev: string, fn: () => void) => (listeners[ev] = fn),
    };
    const appended: unknown[] = [];
    const doc = {
      getElementById: () => null,
      querySelector: () => null,
      createElement: () => script,
      head: { appendChild: (n: unknown) => appended.push(n) },
    } as unknown as Document;
    const p = loadKakaoSdk({ win, doc, timeoutMs: 1000, pollMs: 10, key: 'K' });
    expect(appended).toEqual([script]);
    expect(script).toMatchObject({ id: KAKAO_SCRIPT_ID, src: KAKAO_SDK_URL, async: true, crossOrigin: 'anonymous', integrity: '' });
    const k = fakeKakao();
    win.Kakao = k;
    listeners.load();
    await expect(p).resolves.toBe(k);
    expect(k.keys).toEqual(['K']);
  });

  it('loadKakaoSdk — 오류·타임아웃이면 null, 실패는 캐시하지 않는다', async () => {
    const listeners: Record<string, () => void> = {};
    const script = { addEventListener: (ev: string, fn: () => void) => (listeners[ev] = fn) };
    const doc = {
      getElementById: () => script,
      querySelector: () => null,
      createElement: () => {
        throw new Error('should reuse existing');
      },
    } as unknown as Document;
    const p = loadKakaoSdk({ win: {}, doc, timeoutMs: 1000, pollMs: 10 });
    listeners.error();
    await expect(p).resolves.toBeNull();

    vi.useFakeTimers();
    const p2 = loadKakaoSdk({ win: {}, doc, timeoutMs: 500, pollMs: 100 });
    vi.advanceTimersByTime(600);
    await expect(p2).resolves.toBeNull();
    expect(await loadKakaoSdk({ win: undefined, doc: undefined })).toBeNull();
  });
});

describe('share — 초대 카드(§8-2)', () => {
  it('템플릿·버튼 1개·정적 이미지·복사 텍스트', () => {
    const p = invitePayload({ code: '7F3K5', n: 5, tag: '달빛 매화', caseVersion: 1 });
    const join = 'https://project-orsrw.vercel.app/gung?code=7F3K5&v=1';
    expect(p.kakao).toEqual({
      objectType: 'feed',
      content: {
        title: '세자 독살 사건 · 방 코드 7F3K-5',
        description: '범인은 이 자리에 있소. 눌러서 입장하고 자리 번호를 고르시오. (5인 · 달빛 매화)',
        imageUrl: 'https://project-orsrw.vercel.app/gung/og.jpg',
        imageWidth: 1200,
        imageHeight: 630,
        link: { mobileWebUrl: join, webUrl: join },
      },
      buttons: [{ title: '입장하기', link: { mobileWebUrl: join, webUrl: join } }],
    });
    expect(invitePayload({ code: '7F3K5', n: 5, tag: '달빛 매화' }).copyText).toBe(
      '[세자 독살 사건] 방 코드 7F3K-5 (5인 · 달빛 매화)\n입장 → https://project-orsrw.vercel.app/gung?code=7F3K5',
    );
  });

  it('로컬 테스트: 링크는 현재 origin, 이미지는 공개 운영 도메인', () => {
    const p = invitePayload({ code: '7F3K5', n: 5, tag: 'x', origin: 'http://localhost:3000' });
    expect(p.url).toBe('http://localhost:3000/gung?code=7F3K5');
    expect(p.kakao.content.imageUrl).toBe('https://project-orsrw.vercel.app/gung/og.jpg');
  });
});

describe('share — 결과 카드(§8-3, §9) 스포일러 프리', () => {
  it('판결 문구 버킷 6종', () => {
    expect(verdictHeadline({ caught: true, hits: 4, judges: 4, revoted: true })).toBe('만장일치 — 범인은 숨을 곳이 없었다');
    expect(verdictHeadline({ caught: true, hits: 2, judges: 4, revoted: true })).toBe('재지목 끝에 간신히 덜미를 잡았다');
    expect(verdictHeadline({ caught: true, hits: 2, judges: 4, revoted: false })).toBe('끈질긴 추궁 끝에 범인을 잡았다');
    expect(verdictHeadline({ caught: false, hits: 0, judges: 4, revoted: true })).toBe('완전범죄 — 아무도 눈치채지 못했다');
    expect(verdictHeadline({ caught: false, hits: 1, judges: 4, revoted: true })).toBe('끝내 동률 — 범인은 어둠 속으로 사라졌다');
    expect(verdictHeadline({ caught: false, hits: 1, judges: 4, revoted: false })).toBe('진실에 닿았으나, 범인은 빠져나갔다');
  });

  it('템플릿·OG URL·복사 텍스트', () => {
    const p = resultPayload(resultInput());
    const og = 'https://project-orsrw.vercel.app/gung/og/result?o=c&n=5&h=3&j=4&m=52&r=0&d=20261002';
    expect(p.kakao.content).toMatchObject({
      title: '세자 독살 사건 — 범인 검거!',
      description: '끈질긴 추궁 끝에 범인을 잡았다 · 3/4명 적중 · 52분',
      imageUrl: og,
    });
    expect(p.kakao.buttons).toEqual([
      { title: '우리도 범인 찾기', link: { mobileWebUrl: 'https://project-orsrw.vercel.app/gung', webUrl: 'https://project-orsrw.vercel.app/gung' } },
    ]);
    expect(p.copyText).toBe('[세자 독살 사건] 범인 검거! 4명 중 3명 적중 · 52분\n범인은 누구였을까? 직접 해보시오 → https://project-orsrw.vercel.app/gung');
    expect(resultPayload(resultInput({ caught: false })).kakao.content.title).toBe('세자 독살 사건 — 범인 도주…');
    expect(ogResultUrl(resultInput({ minutes: 999, revoted: true }))).toContain('m=300&r=1');
  });

  it('실제 게임 결과 → 공유 문구에 역할명·방 코드·딥링크가 없다', () => {
    const c = makeFixtureCase();
    let s = applyAction(newHostGame(c, '22225', 0)!, { type: 'syncPhase', phase: 'vote' }, { c, now: 0 });
    s = applyAction(s, { type: 'advance' }, { c, now: 0 });
    for (const [v, t] of [[1, 2], [2, 1], [3, 2], [4, 2], [5, 1]]) s = applyAction(s, { type: 'ballot', voter: v, target: t }, { c, now: 0 });
    const r = resultOf(c, s)!;
    const p = resultPayload(resultShareInput(r, 5, '20261002'));
    const all = JSON.stringify(p);
    for (const banned of ['역할', '22225', '2222-5', 'code=', 'result=', 'consort', 'flower']) expect(all).not.toContain(banned);
    expect(p.kakao.content.description).toBe('끈질긴 추궁 끝에 범인을 잡았다 · 3/4명 적중 · 1분');
  });

  it('OG 파라미터 왕복·검증(잘못되면 null → 커버)', () => {
    const q = buildOgResultQuery(toOgParams(resultInput()));
    expect(q).toBe('o=c&n=5&h=3&j=4&m=52&r=0&d=20261002');
    expect(parseOgResultParams(new URLSearchParams(q))).toEqual({ o: 'c', n: 5, h: 3, j: 4, m: 52, r: 0, d: '20261002' });
    const bad = [
      'o=x&n=5&h=3&j=4&m=52&r=0&d=20261002',
      'o=c&n=7&h=3&j=4&m=52&r=0&d=20261002',
      'o=c&n=5&h=5&j=4&m=52&r=0&d=20261002',
      'o=c&n=5&h=3&j=5&m=52&r=0&d=20261002', // j ≤ n−1
      'o=c&n=5&h=3&j=4&m=0&r=0&d=20261002',
      'o=c&n=5&h=3&j=4&m=52&r=2&d=20261002',
      'o=c&n=5&h=3&j=4&m=52&r=0&d=20260231',
      'o=c&n=5&h=3&j=4&m=52&r=0',
      'o=c&n=5&h=3&j=4&m=5e1&r=0&d=20261002',
      'o=c&n=5&h=<b>&j=4&m=52&r=0&d=20261002',
    ];
    for (const b of bad) expect(parseOgResultParams(new URLSearchParams(b)), b).toBeNull();
    expect(parseOgResultParams(new URLSearchParams('o=e&n=4&h=0&j=2&m=1&r=1&d=20240229'))).not.toBeNull(); // 이탈자 → j=2, 윤년
    expect(formatYmd('20261002')).toBe('2026.10.02');
    expect(ymd(new Date(2026, 9, 2, 23, 59))).toBe('20261002');
  });

  it('일반 추천 카드(§8-4) — 코드 없음', () => {
    const p = genericPayload();
    expect(p.kakao.content.title).toBe('세자 독살 사건 — 술자리 추리 게임');
    expect(p.kakao.content.description).toBe('4~6명 · 폰 하나씩 · 약 50분. 범인은 이 자리에 있다.');
    expect(p.kakao.buttons[0].title).toBe('방 만들러 가기');
    expect(p.url).toBe('https://project-orsrw.vercel.app/gung');
  });
});

describe('share — 폴백 체인(§8-5)', () => {
  const payload = invitePayload({ code: '7F3K5', n: 5, tag: '달빛 매화' });

  it('1) 카카오 준비됨 → sendDefault(동기 호출)', async () => {
    const k = fakeKakao({ initialized: true });
    const shareSpy = vi.fn();
    const pending = share(payload, { kakao: k, navigator: { share: shareSpy } });
    expect(k.sent).toEqual([payload.kakao]); // await 전에 이미 호출됨(사용자 제스처 안)
    await expect(pending).resolves.toBe('kakao');
    expect(shareSpy).not.toHaveBeenCalled();
  });

  it('2) 카카오 실패 → navigator.share, 사용자 취소는 조용히', async () => {
    const k = fakeKakao({ initialized: true, sendThrows: true });
    const ok = vi.fn().mockResolvedValue(undefined);
    await expect(share(payload, { kakao: k, navigator: { share: ok } })).resolves.toBe('webshare');
    expect(ok).toHaveBeenCalledWith({ title: '세자 독살 사건', text: payload.text, url: payload.url });

    const abort = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }));
    await expect(share(payload, { kakao: null, navigator: { share: abort } })).resolves.toBe('cancelled');
  });

  it('3) 공유 미지원·오류 → 클립보드 → 레거시 execCommand', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav = { share: vi.fn().mockRejectedValue(new Error('NotAllowed')), clipboard: { writeText } } as never;
    await expect(share(payload, { kakao: null, navigator: nav })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith(payload.copyText);

    const ta = { value: '', style: {} as Record<string, string>, setAttribute: vi.fn(), select: vi.fn(), setSelectionRange: vi.fn() };
    const body = { appendChild: vi.fn(), removeChild: vi.fn() };
    const doc = { body, createElement: vi.fn(() => ta), execCommand: vi.fn(() => true) } as unknown as Document;
    const denied = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } } as never;
    await expect(copyText('hello', { navigator: denied, document: doc })).resolves.toBe(true);
    expect(ta.value).toBe('hello');
    await expect(share(payload, { kakao: null, navigator: denied, document: doc })).resolves.toBe('copied');
    expect(ta.value).toBe(payload.copyText);
    expect(body.removeChild).toHaveBeenCalledWith(ta);

    const noCopy = { body, createElement: () => ta, execCommand: () => false } as unknown as Document;
    await expect(share(payload, { kakao: null, navigator: {}, document: noCopy })).resolves.toBe('failed');
    await expect(share(payload, { kakao: null })).resolves.toBe('failed');
  });
});

describe('share — 인앱 브라우저', () => {
  it('감지', () => {
    expect(detectInApp(UA.kakaoIOS)).toBe('kakaotalk');
    expect(detectInApp(UA.kakaoAndroid)).toBe('kakaotalk');
    expect(detectInApp(UA.insta)).toBe('instagram');
    expect(detectInApp(UA.fb)).toBe('facebook');
    expect(detectInApp(UA.line)).toBe('line');
    expect(detectInApp(UA.safari)).toBeNull();
    expect(detectInApp(undefined)).toBeNull();
    expect(canDirectDownload(UA.kakaoIOS)).toBe(false);
    expect(canDirectDownload(UA.safari)).toBe(true);
  });

  it('외부 브라우저 URL', () => {
    const url = 'https://project-orsrw.vercel.app/gung?code=7F3K5&as=host';
    expect(externalOpenUrl(url, UA.kakaoIOS)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`);
    expect(externalOpenUrl(url, UA.line)).toBe(`${url}&openExternalBrowser=1`);
    expect(externalOpenUrl(url, UA.insta)).toBe(
      `intent://project-orsrw.vercel.app/gung?code=7F3K5&as=host#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`,
    );
    expect(externalOpenUrl(url, UA.instaIOS)).toBeNull(); // iOS 인스타는 방법 없음 → 안내
    expect(externalOpenUrl(url, UA.safari)).toBeNull();
  });

  it('openExternal — 이동했으면 true', () => {
    const loc = { href: 'https://project-orsrw.vercel.app/gung' };
    expect(openExternal('https://x.app/gung', { ua: UA.kakaoAndroid, location: loc })).toBe(true);
    expect(loc.href.startsWith('kakaotalk://web/openExternal?url=')).toBe(true);
    const loc2 = { href: 'a' };
    expect(openExternal('https://x.app/gung', { ua: UA.safari, location: loc2 })).toBe(false);
    expect(loc2.href).toBe('a');
  });
});
