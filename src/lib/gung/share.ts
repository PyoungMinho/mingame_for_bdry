/**
 * 공유 — 카카오 SDK 로더·init·sendDefault 템플릿 2종(+일반 추천) · navigator.share · 클립보드 폴백 ·
 * 인앱 브라우저 감지·외부 브라우저 열기 · 결과 이미지(OG) 파라미터. (디자인 스펙 §8, §9, §12-5)
 *
 * React 비의존. 브라우저 객체는 전부 주입 가능(테스트는 가짜 env).
 *
 * 폴백 체인(§8-5, 에러창 금지): Kakao 준비됨 → sendDefault / 실패·미로딩 → navigator.share(취소는 조용히) /
 * 미지원 → 클립보드(navigator.clipboard → 숨은 textarea + execCommand).
 * sendDefault·navigator.share 는 **사용자 탭 핸들러 안에서 동기 호출**돼야 한다 → share() 는 첫 await 전에
 * 둘 중 하나를 부른다. SDK 로딩 대기(loadKakaoSdk)는 화면 진입 시 미리 해 둘 것(탭 핸들러에서 await 금지).
 *
 * 스포일러 금지(D8): 결과 카드·OG·공유 문구에 범인 역할명·역할 아이콘·방 코드·결과 딥링크를 넣지 않는다.
 */
import type { GameResult } from './game';
import { buildJoinUrl, buildSceneUrl, formatRoomCode, ROUTE_PATH } from './room';
import type { PlayerCount } from './types';

export const SITE_ORIGIN = 'https://project-orsrw.vercel.app';
export const APP_TITLE = '세자 독살 사건';
export const OG_COVER_PATH = `${ROUTE_PATH}/og.jpg`;
export const OG_RESULT_PATH = `${ROUTE_PATH}/og/result`;
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// ─────────────────────────────── 카카오 SDK ───────────────────────────────

export const KAKAO_SDK_VERSION = '2.8.3';
export const KAKAO_SDK_URL = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;
/**
 * SRI 해시 — 공식 다운로드 페이지(developers.kakao.com/docs/ko/javascript/download)를 2026-10-02 WebFetch 로
 * 확인했으나 해시가 텍스트로 렌더되지 않아(복사 버튼만) 대조하지 못했다 → 규칙대로 integrity 생략, crossOrigin 만.
 * 공식 페이지 값을 사람이 확인하면 여기에 넣으면 된다(스펙 §8-1 의 로컬 계산값은 미대조라 쓰지 않음).
 */
export const KAKAO_SDK_INTEGRITY: string | null = null;
export const KAKAO_SDK_CROSS_ORIGIN = 'anonymous';
export const KAKAO_SCRIPT_ID = 'gu-kakao-sdk';
/** 공개용 JavaScript 키(도메인 화이트리스트로 보호, PM 제공 2026-10-02). env 가 있으면 env 우선. */
export const KAKAO_JS_KEY_FALLBACK = '6045ca18d1a25f28574edbc44eec8371';

/** NEXT_PUBLIC_KAKAO_JS_KEY(빌드 시 인라인) → 없으면 상수 폴백 */
export function kakaoJsKey(): string {
  let env: string | undefined;
  try {
    env = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
  } catch {
    env = undefined;
  }
  return env && env.trim() ? env.trim() : KAKAO_JS_KEY_FALLBACK;
}

export interface KakaoLink {
  mobileWebUrl: string;
  webUrl: string;
}

export interface KakaoFeedTemplate {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
    link: KakaoLink;
  };
  buttons: { title: string; link: KakaoLink }[];
}

export interface KakaoLike {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(settings: KakaoFeedTemplate): void };
}

type WinLike = { Kakao?: unknown };

function globalWin(): WinLike | undefined {
  return typeof window !== 'undefined' ? (window as unknown as WinLike) : undefined;
}

/** window.Kakao 가 공유 가능한 모양이면 돌려준다(init 여부 무관) */
export function getKakao(win: WinLike | undefined = globalWin()): KakaoLike | null {
  const k = win?.Kakao as Partial<KakaoLike> | undefined;
  return k && typeof k.init === 'function' && typeof k.isInitialized === 'function' && typeof k.Share?.sendDefault === 'function'
    ? (k as KakaoLike)
    : null;
}

/** 아직이면 init. 성공(초기화됨) 여부 */
export function initKakao(kakao: KakaoLike, key: string = kakaoJsKey()): boolean {
  try {
    if (!kakao.isInitialized()) kakao.init(key);
    return kakao.isInitialized();
  } catch {
    return false;
  }
}

/** 지금 바로 sendDefault 가능한 Kakao(동기) */
export function readyKakao(win: WinLike | undefined = globalWin(), key?: string): KakaoLike | null {
  const k = getKakao(win);
  return k && initKakao(k, key) ? k : null;
}

let sdkPromise: Promise<KakaoLike | null> | null = null;

export interface LoadKakaoOptions {
  win?: WinLike;
  doc?: Document;
  timeoutMs?: number;
  key?: string;
  /** 폴링 간격(테스트용) */
  pollMs?: number;
}

/**
 * SDK 를 보장한다 — 이미 있으면(next/script 가 로드했어도) init 만, 없으면 <script> 주입.
 * 실패·타임아웃 → null(공유 버튼은 폴백 체인으로). 실패한 시도는 캐시하지 않는다.
 */
export function loadKakaoSdk(opts: LoadKakaoOptions = {}): Promise<KakaoLike | null> {
  const win = opts.win ?? globalWin();
  const doc = opts.doc ?? (typeof document !== 'undefined' ? document : undefined);
  const ready = readyKakao(win, opts.key);
  if (ready) return Promise.resolve(ready);
  if (!win || !doc) return Promise.resolve(null);
  if (sdkPromise) return sdkPromise;

  const timeoutMs = opts.timeoutMs ?? 3000;
  const pollMs = opts.pollMs ?? 100;
  const p = new Promise<KakaoLike | null>((resolve) => {
    let done = false;
    let poll: ReturnType<typeof setInterval> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (k: KakaoLike | null) => {
      if (done) return;
      done = true;
      if (poll !== undefined) clearInterval(poll);
      if (timer !== undefined) clearTimeout(timer);
      resolve(k);
    };
    const check = () => {
      const k = readyKakao(win, opts.key);
      if (k) finish(k);
    };
    try {
      let script = (doc.getElementById(KAKAO_SCRIPT_ID) ?? doc.querySelector(`script[src="${KAKAO_SDK_URL}"]`)) as HTMLScriptElement | null;
      if (!script) {
        script = doc.createElement('script');
        script.id = KAKAO_SCRIPT_ID;
        script.src = KAKAO_SDK_URL;
        script.async = true;
        script.crossOrigin = KAKAO_SDK_CROSS_ORIGIN;
        if (KAKAO_SDK_INTEGRITY) script.integrity = KAKAO_SDK_INTEGRITY;
        (doc.head ?? doc.body)?.appendChild(script);
      }
      script.addEventListener('load', check);
      script.addEventListener('error', () => finish(null));
    } catch {
      finish(null);
      return;
    }
    poll = setInterval(check, pollMs);
    timer = setTimeout(() => finish(readyKakao(win, opts.key)), timeoutMs);
  });
  sdkPromise = p.then((k) => {
    if (!k) sdkPromise = null;
    return k;
  });
  return sdkPromise;
}

/** 테스트용 — 로더 캐시 초기화 */
export function resetKakaoLoader(): void {
  sdkPromise = null;
}

// ─────────────────────────────── 문구·템플릿 ───────────────────────────────

function trimOrigin(o: string): string {
  return o.replace(/\/+$/, '');
}

export function homeUrl(origin: string = SITE_ORIGIN): string {
  return `${trimOrigin(origin)}${ROUTE_PATH}`;
}

export function coverImageUrl(imageOrigin: string = SITE_ORIGIN): string {
  return `${trimOrigin(imageOrigin)}${OG_COVER_PATH}`;
}

const link = (url: string): KakaoLink => ({ mobileWebUrl: url, webUrl: url });

/** 공유 한 건 — 카카오 템플릿 + navigator.share 데이터 + 복사 텍스트 */
export interface SharePayload {
  kakao: KakaoFeedTemplate;
  title: string;
  text: string;
  url: string;
  copyText: string;
}

export interface InviteShareInput {
  code: string;
  n: PlayerCount;
  /** 사건 표식 '달빛 매화' */
  tag: string;
  caseVersion?: number;
  /** 링크 origin(기본 운영 도메인) */
  origin?: string;
  /** 이미지 origin — 카톡 스크레이퍼가 읽을 수 있는 공개 URL 이어야 해서 기본 운영 도메인 */
  imageOrigin?: string;
  title?: string;
}

/** §8-2 초대 카드 + §8-5 복사 텍스트 */
export function invitePayload(i: InviteShareInput): SharePayload {
  const title = i.title ?? APP_TITLE;
  const display = formatRoomCode(i.code);
  const joinUrl = buildJoinUrl(i.origin ?? SITE_ORIGIN, i.code, i.caseVersion);
  return {
    kakao: {
      objectType: 'feed',
      content: {
        title: `${title} · 방 코드 ${display}`,
        description: `범인은 이 자리에 있소. 눌러서 입장하고 자리 번호를 고르시오. (${i.n}인 · ${i.tag})`,
        imageUrl: coverImageUrl(i.imageOrigin),
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
        link: link(joinUrl),
      },
      buttons: [{ title: '입장하기', link: link(joinUrl) }],
    },
    title,
    text: `[${title}] 방 코드 ${display} (${i.n}인 · ${i.tag})`,
    url: joinUrl,
    copyText: `[${title}] 방 코드 ${display} (${i.n}인 · ${i.tag})\n입장 → ${joinUrl}`,
  };
}

/**
 * 큰 화면(노트북·TV) 현장 주소 보내기 — 카톡 「나와의 채팅」으로 보내 PC 카톡에서 여는 길을 연다.
 * 비밀 없음: 현장 그림 주소뿐(관찰 문구·본 물건·역할·결과는 넣지 않는다). 방 코드는 초대 링크와 같은 값.
 */
export function scenePayload(i: { code: string; origin?: string; imageOrigin?: string; title?: string }): SharePayload {
  const title = i.title ?? APP_TITLE;
  const url = buildSceneUrl(i.origin ?? SITE_ORIGIN, i.code);
  const desc = '노트북·TV에서 열면 현장 그림만 크게 뜨오';
  return {
    kakao: {
      objectType: 'feed',
      content: {
        title: `${title} · 현장 보기`,
        description: desc,
        imageUrl: coverImageUrl(i.imageOrigin),
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
        link: link(url),
      },
      buttons: [{ title: '현장 열기', link: link(url) }],
    },
    title,
    text: `[${title}] 현장 보기 — ${desc}`,
    url,
    copyText: url,
  };
}

export interface ResultShareInput {
  caught: boolean;
  /** 적중자 수(비범인 중 1차 지목에서 범인을 짚은 수) */
  hits: number;
  /** 판정자 수(= n − 1 − 이탈자) */
  judges: number;
  /** 소요 분(1..300) */
  minutes: number;
  revoted: boolean;
  n: PlayerCount;
  /** 'YYYYMMDD' (방장 기기 로컬 날짜) */
  date: string;
  origin?: string;
  imageOrigin?: string;
  title?: string;
}

/** §9-3 판결 문구 버킷(스포일러 프리, 위에서부터) */
export function verdictHeadline(v: { caught: boolean; hits: number; judges: number; revoted: boolean }): string {
  if (v.caught) {
    if (v.hits === v.judges) return '만장일치 — 범인은 숨을 곳이 없었다';
    if (v.revoted) return '재지목 끝에 간신히 덜미를 잡았다';
    return '끈질긴 추궁 끝에 범인을 잡았다';
  }
  if (v.hits === 0) return '완전범죄 — 아무도 눈치채지 못했다';
  if (v.revoted) return '끝내 동률 — 범인은 어둠 속으로 사라졌다';
  return '진실에 닿았으나, 범인은 빠져나갔다';
}

export interface OgResultParams {
  /** c 검거 / e 도주 */
  o: 'c' | 'e';
  n: PlayerCount;
  h: number;
  j: number;
  m: number;
  r: 0 | 1;
  d: string;
}

export function toOgParams(i: ResultShareInput): OgResultParams {
  return {
    o: i.caught ? 'c' : 'e',
    n: i.n,
    h: i.hits,
    j: i.judges,
    m: Math.min(300, Math.max(1, Math.round(i.minutes))),
    r: i.revoted ? 1 : 0,
    d: i.date,
  };
}

/** 'o=c&n=5&h=3&j=4&m=52&r=0&d=20261002' — 전부 숫자/열거형, 자유 텍스트 없음 */
export function buildOgResultQuery(p: OgResultParams): string {
  return `o=${p.o}&n=${p.n}&h=${p.h}&j=${p.j}&m=${p.m}&r=${p.r}&d=${p.d}`;
}

export function ogResultUrl(i: ResultShareInput): string {
  return `${trimOrigin(i.imageOrigin ?? SITE_ORIGIN)}${OG_RESULT_PATH}?${buildOgResultQuery(toOgParams(i))}`;
}

function validYmd(d: string): boolean {
  if (!/^\d{8}$/.test(d)) return false;
  const y = Number(d.slice(0, 4));
  const mo = Number(d.slice(4, 6));
  const day = Number(d.slice(6, 8));
  if (y < 2024 || y > 2100 || mo < 1 || mo > 12 || day < 1) return false;
  const dim = [31, y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mo - 1];
  return day <= dim;
}

/**
 * OG 라우트용 검증(§9-1). 하나라도 틀리면 null → 라우트는 일반 커버를 렌더(404 금지).
 * j 는 1..n−1 (이탈자가 있으면 3 미만도 가능), h ≤ j.
 */
export function parseOgResultParams(q: { get(name: string): string | null }): OgResultParams | null {
  const int = (k: string, lo: number, hi: number): number | null => {
    const v = q.get(k);
    // 정규형만(앞자리 0 금지) — 'n=05'·'h=003' 같은 변형이 같은 그림의 다른 캐시 키가 되지 않게(QA BUG-29)
    if (v === null || !/^(0|[1-9]\d{0,2})$/.test(v)) return null;
    const x = Number(v);
    return x >= lo && x <= hi ? x : null;
  };
  const o = q.get('o');
  if (o !== 'c' && o !== 'e') return null;
  const n = int('n', 4, 6);
  if (n === null) return null;
  const j = int('j', 1, n - 1);
  if (j === null) return null;
  const h = int('h', 0, j);
  const m = int('m', 1, 300);
  const r = int('r', 0, 1);
  const d = q.get('d');
  if (h === null || m === null || r === null || d === null || !validYmd(d)) return null;
  return { o, n: n as PlayerCount, h, j, m, r: r as 0 | 1, d };
}

/** '20261002' → '2026.10.02' */
export function formatYmd(d: string): string {
  return /^\d{8}$/.test(d) ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6, 8)}` : d;
}

/** 로컬 날짜 'YYYYMMDD' */
export function ymd(date: Date): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}`;
}

/** §8-3 결과 카드 + §8-5 복사 텍스트 — 범인 역할명·방 코드 없음 */
export function resultPayload(i: ResultShareInput): SharePayload {
  const title = i.title ?? APP_TITLE;
  const home = homeUrl(i.origin);
  const line = verdictHeadline(i);
  const minutes = toOgParams(i).m;
  const head = i.caught ? '범인 검거!' : '범인 도주…';
  return {
    kakao: {
      objectType: 'feed',
      content: {
        title: `${title} — ${head}`,
        description: `${line} · ${i.hits}/${i.judges}명 적중 · ${minutes}분`,
        imageUrl: ogResultUrl(i),
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
        link: link(home),
      },
      buttons: [{ title: '우리도 범인 찾기', link: link(home) }],
    },
    title,
    text: `[${title}] ${head} ${i.judges}명 중 ${i.hits}명 적중 · ${minutes}분`,
    url: home,
    copyText: `[${title}] ${head} ${i.judges}명 중 ${i.hits}명 적중 · ${minutes}분\n범인은 누구였을까? 직접 해보시오 → ${home}`,
  };
}

/** GameResult → 결과 공유 입력(분 기록이 없으면 1분) */
export function resultShareInput(r: GameResult, n: PlayerCount, date: string): ResultShareInput {
  return { caught: r.caught, hits: r.hits, judges: r.judges, minutes: r.minutes ?? 1, revoted: r.revoted, n, date };
}

/** §8-4 일반 추천 카드(플레이어 P9) — 코드 없음 */
export function genericPayload(opts: { origin?: string; imageOrigin?: string; title?: string } = {}): SharePayload {
  const title = opts.title ?? APP_TITLE;
  const home = homeUrl(opts.origin);
  const desc = '4~6명 · 폰 하나씩 · 약 35분. 범인은 이 자리에 있다.';
  return {
    kakao: {
      objectType: 'feed',
      content: {
        title: `${title} — 술자리 추리 게임`,
        description: desc,
        imageUrl: coverImageUrl(opts.imageOrigin),
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
        link: link(home),
      },
      buttons: [{ title: '방 만들러 가기', link: link(home) }],
    },
    title,
    text: `[${title}] ${desc}`,
    url: home,
    copyText: `[${title}] ${desc}\n→ ${home}`,
  };
}

// ─────────────────────────────── 폴백 체인 ───────────────────────────────

export type ShareOutcome = 'kakao' | 'webshare' | 'copied' | 'cancelled' | 'failed';

export interface ShareEnv {
  /** undefined = window.Kakao 자동 감지 · null = 카카오 쓰지 않음 */
  kakao?: KakaoLike | null;
  navigator?: Partial<Pick<Navigator, 'share' | 'clipboard'>>;
  document?: Document;
}

function browserEnv(): ShareEnv {
  return {
    kakao: undefined,
    navigator: typeof navigator !== 'undefined' ? navigator : undefined,
    document: typeof document !== 'undefined' ? document : undefined,
  };
}

function isAbort(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';
}

/** 숨은 textarea + execCommand('copy') */
export function legacyCopy(text: string, doc: Document | undefined): boolean {
  if (!doc?.body) return false;
  try {
    const ta = doc.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    ta.style.fontSize = '16px'; // iOS 확대 방지
    doc.body.appendChild(ta);
    ta.select();
    try {
      ta.setSelectionRange(0, text.length);
    } catch {
      /* 일부 브라우저 */
    }
    const ok = doc.execCommand('copy');
    doc.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function copyText(text: string, env: ShareEnv = browserEnv()): Promise<boolean> {
  const clip = env.navigator?.clipboard;
  if (clip && typeof clip.writeText === 'function') {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      /* 권한 거부·비보안 컨텍스트 → 레거시 */
    }
  }
  return legacyCopy(text, env.document);
}

/**
 * 공유 버튼 핸들러에서 **await 없이 바로** 호출할 것.
 * Kakao → navigator.share → 클립보드. 'copied' 면 버튼 라벨을 "복사됨 ✓" 2초.
 */
export async function share(p: SharePayload, env: ShareEnv = browserEnv()): Promise<ShareOutcome> {
  const kakao = env.kakao === undefined ? readyKakao() : env.kakao;
  if (kakao) {
    try {
      kakao.Share.sendDefault(p.kakao);
      return 'kakao';
    } catch {
      /* 키·도메인 오류 등 → 다음 단계 */
    }
  }
  const nav = env.navigator;
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: p.title, text: p.text, url: p.url });
      return 'webshare';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  return (await copyText(p.copyText, env)) ? 'copied' : 'failed';
}

// ─────────────────────────────── 인앱 브라우저 ───────────────────────────────

export type InAppKind = 'kakaotalk' | 'instagram' | 'facebook' | 'line' | 'naver';

export function detectInApp(ua: string | undefined | null): InAppKind | null {
  const u = ua ?? '';
  if (/KAKAOTALK/i.test(u)) return 'kakaotalk';
  if (/Instagram/i.test(u)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/.test(u)) return 'facebook';
  if (/\bLine\/\d/i.test(u)) return 'line';
  if (/NAVER\(inapp/i.test(u)) return 'naver';
  return null;
}

export function isInAppBrowser(ua: string | undefined | null): boolean {
  return detectInApp(ua) !== null;
}

export function isAndroid(ua: string | undefined | null): boolean {
  return /Android/i.test(ua ?? '');
}

/** 인앱에선 a[download]·blob 저장이 막힌다 → "이미지를 꾹 눌러 저장하시오" 안내만(§9-5) */
export function canDirectDownload(ua: string | undefined | null): boolean {
  return !isInAppBrowser(ua);
}

/**
 * 외부(기본) 브라우저로 여는 URL. 방법이 없으면 null(→ "⋯ > 다른 브라우저로 열기" 안내).
 *  - 카카오톡: kakaotalk://web/openExternal?url=…  (§12-5)
 *  - LINE: ?openExternalBrowser=1
 *  - 그 밖의 안드로이드 인앱: Chrome intent://
 */
export function externalOpenUrl(url: string, ua: string | undefined | null): string | null {
  const kind = detectInApp(ua);
  if (!kind) return null;
  if (kind === 'kakaotalk') return `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
  if (kind === 'line') return `${url}${url.includes('?') ? '&' : '?'}openExternalBrowser=1`;
  if (isAndroid(ua)) {
    const m = /^(https?):\/\/(.*)$/i.exec(url);
    if (!m) return null;
    return `intent://${m[2]}#Intent;scheme=${m[1].toLowerCase()};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
  }
  return null;
}

/** 실제로 이동시킨다. 이동했으면 true */
export function openExternal(url: string, env: { ua?: string; location?: { href: string } } = {}): boolean {
  const ua = env.ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const target = externalOpenUrl(url, ua);
  const loc = env.location ?? (typeof window !== 'undefined' ? window.location : undefined);
  if (!target || !loc) return false;
  try {
    loc.href = target;
    return true;
  } catch {
    return false;
  }
}
