/**
 * 공유 — 스포일러 없는 결과 문구 · Web Share → 클립보드 폴백 · 카카오(P1) 템플릿·SDK 로더 · OG 쿼리(숫자·열거형만).
 * (시스템 4-4, 디자인 §9) React 비의존. 브라우저 객체는 전부 주입 가능(테스트는 가짜 env).
 *
 * 스포일러 금지: 인물·증거 이름, 트릭 어휘, 숨은 엔딩 내용, 범인을 암시하는 값은 문구·URL·OG 어디에도 넣지 않는다.
 * 공유 URL 에는 파라미터를 붙이지 않는다(P0). OG 결과 변형은 숫자·열거형만 받는다.
 * 카카오: /gung 의 share 패턴을 참고한 별도 구현(파일 공유 없음). 키는 NEXT_PUBLIC_KAKAO_JS_KEY 우선, 없으면 /gung 과 같은 공개 키.
 */
import type { EndingId, Grade } from './types';
import { EVIDENCE_TOTAL, STAR_TOTAL, type RunResult } from './engine';

export const SITE_ORIGIN = 'https://project-orsrw.vercel.app';
export const ROUTE_PATH = '/witness';
export const SHARE_TITLE = '스마트홈 살인사건 — 목격자는 AI 스피커';
export const OG_PATH = `${ROUTE_PATH}/og`;
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** 훅 문구 4종(시스템 4-4) — (plays − 1) % 4 로 순환 */
export const HOOKS = [
  '용의자는 넷, 증인은 스피커 하나.',
  'AI는 거짓말을 안 해. 다만 다 말하지도 않지.',
  "목격자가 '죄송해요, 잘 모르겠어요'래.",
  '행동 12번. 너라면 어디부터 뒤질래?',
] as const;

/** 공유·OG 문자열에 들어가면 안 되는 트릭 어휘(시스템 4-4 금지 목록 + 이 사건 핵심 소품) */
export const TRICK_WORDS = ['목소리', '녹음', '루틴', '예약', '공백', '출발음', '음성팩', '위조', '청소기', '트로피', '특허', '파쇄기', '마이크'] as const;

function trimOrigin(o: string): string {
  return o.replace(/\/+$/, '');
}

export function homeUrl(origin: string = SITE_ORIGIN): string {
  return `${trimOrigin(origin)}${ROUTE_PATH}`;
}

/** 훅 인덱스 0..3 (plays 는 이번 엔딩을 반영한 뒤의 횟수, 1부터) */
export function hookIndex(plays: number): number {
  const n = Math.max(1, Math.floor(plays || 1));
  return (n - 1) % HOOKS.length;
}

/** 공유용 칭호 — 오인 체포는 인물과 관계없이 하나(디자인 §9-1) */
export function shareTitle(r: Pick<RunResult, 'title' | 'ending'>): string {
  return r.ending.startsWith('wrong-') ? '스피커도 당황한 추리' : r.title;
}

/** 「강력팀 도착 n0분 전 해결/지목」 — 시간 초과·수사 배제는 null */
export function timePhrase(r: Pick<RunResult, 'ending' | 'actionsLeft'>, minutesPerAction = 10): string | null {
  const solved = r.ending === 'perfect' || r.ending === 'hidden';
  const accused = r.ending === 'short' || r.ending.startsWith('wrong-');
  if (!solved && !accused) return null;
  const verb = solved ? '해결' : '지목';
  if (r.actionsLeft <= 0) return `사이렌과 함께 ${verb}`;
  return `강력팀 도착 ${r.actionsLeft * minutesPerAction}분 전 ${verb}`;
}

export interface ShareInput {
  result: Pick<RunResult, 'ending' | 'grade' | 'title' | 'stars' | 'evidence' | 'actionsLeft'>;
  /** 엔딩 반영 뒤 플레이 횟수 */
  plays: number;
  origin?: string;
  imageOrigin?: string;
}

/** 시스템 4-4 공유 문구(5줄, 스포 없음) */
export function shareText(i: ShareInput): string {
  const r = i.result;
  const head = `${r.grade}등급 · ${shareTitle(r)}${r.ending === 'hidden' ? ' · 숨은 엔딩 발견' : ''}`;
  const tp = timePhrase(r);
  const stats = [`결정적 모순 ${r.stars}/${STAR_TOTAL}`, `증거 ${r.evidence}/${EVIDENCE_TOTAL}`, ...(tp ? [tp] : [])].join(' · ');
  return [`「${SHARE_TITLE}」`, head, stats, HOOKS[hookIndex(i.plays)], homeUrl(i.origin)].join('\n');
}

// ─────────────────────────────── OG 쿼리 ───────────────────────────────

export type OgKind = 'p' | 'h' | 's' | 'w' | 't' | 'x';

export interface OgParams {
  g: Grade;
  s: number;
  e: number;
  r: number;
  k: OgKind;
  v: number;
}

export function ogKind(ending: EndingId): OgKind {
  if (ending === 'perfect') return 'p';
  if (ending === 'hidden') return 'h';
  if (ending === 'short') return 's';
  if (ending === 'timeout') return 't';
  if (ending === 'excluded') return 'x';
  return 'w';
}

export function toOgParams(i: ShareInput): OgParams {
  const r = i.result;
  return {
    g: r.grade,
    s: Math.min(STAR_TOTAL, Math.max(0, r.stars)),
    e: Math.min(EVIDENCE_TOTAL, Math.max(0, r.evidence)),
    r: Math.min(12, Math.max(0, r.actionsLeft)),
    k: ogKind(r.ending),
    v: hookIndex(i.plays),
  };
}

export function buildOgQuery(p: OgParams): string {
  return `g=${p.g}&s=${p.s}&e=${p.e}&r=${p.r}&k=${p.k}&v=${p.v}`;
}

export function ogResultUrl(i: ShareInput): string {
  return `${trimOrigin(i.imageOrigin ?? SITE_ORIGIN)}${OG_PATH}?${buildOgQuery(toOgParams(i))}`;
}

export function ogCoverUrl(imageOrigin: string = SITE_ORIGIN): string {
  return `${trimOrigin(imageOrigin)}${OG_PATH}`;
}

/** OG 라우트 화이트리스트 검증. 하나라도 틀리면 null → 기본 커버 200 (디자인 §9-2) */
export function parseOgParams(q: { get(name: string): string | null }): OgParams | null {
  const int = (k: string, hi: number): number | null => {
    const v = q.get(k);
    if (v === null || !/^(0|[1-9]\d?)$/.test(v)) return null;
    const x = Number(v);
    return x <= hi ? x : null;
  };
  const g = q.get('g');
  const k = q.get('k');
  if (g === null || !['S', 'A', 'B', 'C'].includes(g)) return null;
  if (k === null || !['p', 'h', 's', 'w', 't', 'x'].includes(k)) return null;
  const s = int('s', STAR_TOTAL);
  const e = int('e', EVIDENCE_TOTAL);
  const r = int('r', 12);
  const v = int('v', HOOKS.length - 1);
  if (s === null || e === null || r === null || v === null) return null;
  return { g: g as Grade, s, e, r, k: k as OgKind, v };
}

// ─────────────────────────────── 카카오(P1) ───────────────────────────────

export const KAKAO_SDK_VERSION = '2.8.3';
export const KAKAO_SDK_URL = `https://t1.kakaocdn.net/kakao_js_sdk/${KAKAO_SDK_VERSION}/kakao.min.js`;
export const KAKAO_SCRIPT_ID = 'wt-kakao-sdk';
/** 공개용 JavaScript 키(도메인 화이트리스트로 보호) — /gung 과 같은 키. env 가 있으면 env 우선 */
export const KAKAO_JS_KEY_FALLBACK = '6045ca18d1a25f28574edbc44eec8371';

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
  content: { title: string; description: string; imageUrl: string; imageWidth: number; imageHeight: number; link: KakaoLink };
  buttons: { title: string; link: KakaoLink }[];
}

export interface KakaoLike {
  isInitialized(): boolean;
  init(key: string): void;
  Share: { sendDefault(settings: KakaoFeedTemplate): void };
}

type WinLike = { Kakao?: unknown };
const globalWin = (): WinLike | undefined => (typeof window !== 'undefined' ? (window as unknown as WinLike) : undefined);

export function getKakao(win: WinLike | undefined = globalWin()): KakaoLike | null {
  const k = win?.Kakao as Partial<KakaoLike> | undefined;
  return k && typeof k.init === 'function' && typeof k.isInitialized === 'function' && typeof k.Share?.sendDefault === 'function' ? (k as KakaoLike) : null;
}

export function readyKakao(win: WinLike | undefined = globalWin(), key: string = kakaoJsKey()): KakaoLike | null {
  const k = getKakao(win);
  if (!k) return null;
  try {
    if (!k.isInitialized()) k.init(key);
    return k.isInitialized() ? k : null;
  } catch {
    return null;
  }
}

let sdkPromise: Promise<KakaoLike | null> | null = null;

/** SDK 보장(화면 진입 시 미리 호출 — 탭 핸들러에서 await 금지). 실패·타임아웃 → null, 실패는 캐시하지 않는다 */
export function loadKakaoSdk(opts: { win?: WinLike; doc?: Document; timeoutMs?: number; key?: string; pollMs?: number } = {}): Promise<KakaoLike | null> {
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
        script.crossOrigin = 'anonymous';
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

export function resetKakaoLoader(): void {
  sdkPromise = null;
}

// ─────────────────────────────── 공유 한 건 ───────────────────────────────

export interface SharePayload {
  title: string;
  text: string;
  url: string;
  copyText: string;
  kakao: KakaoFeedTemplate;
}

const link = (url: string): KakaoLink => ({ mobileWebUrl: url, webUrl: url });

export function sharePayload(i: ShareInput): SharePayload {
  const url = homeUrl(i.origin);
  const full = shareText(i);
  const text = full.split('\n').slice(0, -1).join('\n');
  const r = i.result;
  const tp = timePhrase(r);
  return {
    title: SHARE_TITLE,
    text,
    url,
    copyText: full,
    kakao: {
      objectType: 'feed',
      content: {
        title: `목격자는 AI — ${r.grade}등급 · ${shareTitle(r)}`,
        description: [`결정적 모순 ${r.stars}/${STAR_TOTAL}`, `증거 ${r.evidence}/${EVIDENCE_TOTAL}`, ...(tp ? [tp] : [])].join(' · '),
        imageUrl: ogResultUrl(i),
        imageWidth: OG_WIDTH,
        imageHeight: OG_HEIGHT,
        link: link(url),
      },
      buttons: [{ title: '나도 수사하기', link: link(url) }],
    },
  };
}

/** 결과 없이 추천하는 카드(타이틀 등) */
export function genericPayload(opts: { origin?: string; imageOrigin?: string } = {}): SharePayload {
  const url = homeUrl(opts.origin);
  const desc = '비 오는 밤, 41층 펜트하우스. 용의자는 넷, 증인은 스피커 하나. 혼자서 25분.';
  return {
    title: SHARE_TITLE,
    text: `「${SHARE_TITLE}」\n${desc}`,
    url,
    copyText: `「${SHARE_TITLE}」\n${desc}\n${url}`,
    kakao: {
      objectType: 'feed',
      content: { title: '목격자는 AI', description: desc, imageUrl: ogCoverUrl(opts.imageOrigin), imageWidth: OG_WIDTH, imageHeight: OG_HEIGHT, link: link(url) },
      buttons: [{ title: '수사 시작', link: link(url) }],
    },
  };
}

// ─────────────────────────────── 폴백 체인 ───────────────────────────────

export type ShareOutcome = 'kakao' | 'webshare' | 'copied' | 'cancelled' | 'failed';

export interface ShareEnv {
  /** undefined = window.Kakao 자동 감지 · null = 카카오 쓰지 않음(P0 기본) */
  kakao?: KakaoLike | null;
  navigator?: Partial<Pick<Navigator, 'share' | 'clipboard'>>;
  document?: Document;
}

function browserEnv(): ShareEnv {
  return {
    kakao: null,
    navigator: typeof navigator !== 'undefined' ? navigator : undefined,
    document: typeof document !== 'undefined' ? document : undefined,
  };
}

const isAbort = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';

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
    ta.style.fontSize = '16px';
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
      /* 권한 거부 → 레거시 */
    }
  }
  return legacyCopy(text, env.document);
}

/**
 * 공유 버튼 핸들러에서 **await 없이 바로** 호출할 것(사용자 제스처 안에서 첫 호출이 일어나야 한다).
 * (카카오 — env.kakao 를 넘길 때만) → navigator.share → 클립보드. 'failed' 면 UI 는 선택 가능한 텍스트 박스를 띄운다.
 */
export async function share(p: SharePayload, env: ShareEnv = browserEnv()): Promise<ShareOutcome> {
  const kakao = env.kakao === undefined ? readyKakao() : env.kakao;
  if (kakao) {
    try {
      kakao.Share.sendDefault(p.kakao);
      return 'kakao';
    } catch {
      /* 키·도메인 오류 → 다음 단계 */
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
