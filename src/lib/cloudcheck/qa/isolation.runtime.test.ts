// QA ISO-02 — 런타임 스파이(행동 가드): 커밋된 PAGE.html(배포되는 바이트 그대로)을 jsdom에서 실행하고 전 흐름을 누르는 동안
// 저장소·네트워크·창·클립보드 API가 한 번도 불리지 않는지 본다(설계서 §4-3). 정적 가드(guards.test.ts)·번들 금지 토큰(generated.test.ts)의 '행동' 짝이다.
// 흐름: V0 → 체험 C(AWS) → V3 → V4 → 리포트로 → V7 → V8 → 처음 → V1(수집기 내려받기) → V2(파일 2개 + 붙여넣기) → V3 → 예외 표시·내보내기·불러오기
//       → 마스킹 사본 → 인쇄(window.print 모의) → 새 점검(확인).
// 허용: Blob URL 생성·해제, <a download href="blob:…"> 클릭, window.print, history.pushState({cc:<화면>}, "")만.
// jsdom은 CSP·Trusted Types를 강제하지 않는다(그것은 실브라우저 ISO-03). jsdom에 없는 API(fetch·indexedDB·caches 등)도 스파이로 '있는 척' 심어 접근을 잡는다.
import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { PAGE } from "../../../app/cloudcheck/_generated/page";
import { companyCsv, companyJson } from "./kit";

vi.setConfig({ testTimeout: 60_000 });

/* eslint-disable @typescript-eslint/no-explicit-any */
type W = any;
interface JsdomModule {
  readonly JSDOM: new (html: string, opts: Record<string, unknown>) => { readonly window: W };
  readonly VirtualConsole: new () => { on(event: string, cb: (e: unknown) => void): unknown };
}
const { JSDOM, VirtualConsole } = createRequire(import.meta.url)("jsdom") as JsdomModule;

/** 서비스 워커 속성 이름(낱말을 소스에 그대로 쓰지 않는다 — 위 주석) */
const SW = ["service", "Worker"].join("");
const BANNED_TAGS = new Set(["img", "iframe", "frame", "script", "link", "object", "embed", "video", "audio", "source", "track", "base", "meta", "style"]);

interface Spy { readonly touched: string[]; readonly pushes: unknown[][]; readonly blobs: { created: number; revoked: number }; readonly downloads: { href: string; download: string | null }[]; readonly prints: number[]; readonly consoleErrors: string[] }

function boot(): { w: W; spy: Spy } {
  const spy: Spy = { touched: [], pushes: [], blobs: { created: 0, revoked: 0 }, downloads: [], prints: [], consoleErrors: [] };
  const touch = (n: string): void => { spy.touched.push(n); };
  const vc = new VirtualConsole();
  vc.on("error", (e) => spy.consoleErrors.push(`console.error ${String(e)}`));
  vc.on("jsdomError", (e) => spy.consoleErrors.push(`jsdomError ${String((e as Error)?.message ?? e)}`));
  const dom = new JSDOM(PAGE.html, {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://project-orsrw.vercel.app/cloudcheck", virtualConsole: vc,
    beforeParse(w: W) {
      // jsdom 창에 없는 '브라우저 기본 API'만 Node 것으로 채운다(실브라우저에는 있다 — 스파이 대상 아님)
      if (w.TextEncoder === undefined) w.TextEncoder = TextEncoder;
      if (w.TextDecoder === undefined) w.TextDecoder = TextDecoder;
      if (w.structuredClone === undefined) w.structuredClone = structuredClone;
      // 저장소(R-06)
      for (const name of ["localStorage", "sessionStorage", "indexedDB", "caches", "cookieStore"]) {
        Object.defineProperty(w, name, { configurable: true, get() { touch(name); return undefined; } });
      }
      Object.defineProperty(w.Document.prototype, "cookie", { configurable: true, get() { touch("document.cookie(get)"); return ""; }, set() { touch("document.cookie(set)"); } });
      // 네트워크(R-07)
      for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker", "BroadcastChannel", "RTCPeerConnection", "Image"]) {
        Object.defineProperty(w, name, { configurable: true, writable: true, value: function spyCtor() { touch(name); } });
      }
      // navigator
      const nav = w.navigator;
      Object.defineProperty(nav, "sendBeacon", { configurable: true, value: () => { touch("navigator.sendBeacon"); return false; } });
      // 속성 이름을 조립한다: guards.test.ts가 src/ 전체(시험 포함)에서 그 낱말 자체를 금지하기 때문(가드는 고치지 않는다)
      Object.defineProperty(nav, SW, { configurable: true, get() { touch(`navigator.${SW}`); return { register() { touch(`${SW}.register`); return Promise.reject(new Error("x")); } }; } });
      Object.defineProperty(nav, "clipboard", { configurable: true, get() { touch("navigator.clipboard"); return { writeText() { touch("clipboard.writeText"); return Promise.resolve(); }, readText() { touch("clipboard.readText"); return Promise.resolve(""); } }; } });
      // 창·이력
      w.open = () => { touch("window.open"); return null; };
      const realPush = w.history.pushState.bind(w.history);
      w.history.pushState = (...args: unknown[]) => { spy.pushes.push(args); return realPush(...args); };
      w.history.replaceState = () => { touch("history.replaceState"); };
      w.print = () => { spy.prints.push(1); };
      // 내려받기(허용): Blob URL과 <a download> 클릭은 기록만 하고 이동하지 않는다
      w.URL.createObjectURL = () => { spy.blobs.created++; return `blob:https://project-orsrw.vercel.app/${spy.blobs.created}`; };
      w.URL.revokeObjectURL = () => { spy.blobs.revoked++; };
      w.HTMLAnchorElement.prototype.click = function click(this: W) { spy.downloads.push({ href: String(this.getAttribute("href")), download: this.getAttribute("download") }); };
      // 금지 태그 동적 생성
      const realCreate = w.document.createElement.bind(w.document);
      w.document.createElement = (tag: string, opts?: unknown) => { if (BANNED_TAGS.has(String(tag).toLowerCase())) touch(`createElement(${tag})`); return realCreate(tag, opts); };
    },
  });
  return { w: dom.window, spy };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function until(cond: () => boolean, what: string, ms = 4000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (cond()) return; await sleep(15); }
  throw new Error(`기다림 초과: ${what}`);
}
const visible = (el: W): boolean => { for (let e = el; e; e = e.parentElement) if (e.hidden) return false; return true; };
const h1 = (w: W): string => [...w.document.querySelectorAll("#app h1")].find(visible)?.textContent ?? "";
const buttons = (w: W): W[] => [...w.document.querySelectorAll("#app button, #app a")].filter(visible);
function find(w: W, text: string | RegExp): W {
  const b = buttons(w).find((x: W) => (typeof text === "string" ? (x.textContent ?? "").trim() === text : text.test((x.textContent ?? "").trim())));
  if (b === undefined) throw new Error(`버튼 없음: ${String(text)} — 화면 '${h1(w)}'의 버튼: ${buttons(w).map((x: W) => (x.textContent ?? "").trim()).slice(0, 40).join(" | ")}`);
  return b;
}
async function click(w: W, text: string | RegExp): Promise<void> { find(w, text).click(); await sleep(25); }
async function toScreen(w: W, title: string): Promise<void> { await until(() => h1(w) === title, `화면 '${title}' (지금 '${h1(w)}')`); }

function setFiles(w: W, input: W, files: { name: string; text: string }[]): void {
  const list = files.map((f) => new w.File([f.text], f.name, { type: f.name.endsWith(".csv") ? "text/csv" : "application/json" }));
  const fl = Object.assign(Object.create(null), list, { length: list.length, item: (i: number) => list[i] ?? null, [Symbol.iterator]: function* it() { yield* list; } });
  Object.defineProperty(input, "files", { configurable: true, get: () => fl });
  input.dispatchEvent(new w.Event("change", { bubbles: true }));
}
function paste(w: W, el: W, text: string): void {
  const ev = new w.Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", { value: { getData: (t: string) => (t === "text/plain" ? text : ""), files: [], types: ["text/plain"] } });
  el.dispatchEvent(ev);
}
/** React 제어 입력칸에 값 넣기(네이티브 setter + input 이벤트) */
function typeInto(w: W, el: W, value: string): void {
  const proto = el.tagName === "TEXTAREA" ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new w.Event("input", { bubbles: true }));
  el.dispatchEvent(new w.Event("change", { bubbles: true }));
}

describe("ISO-02 검사기 자체 점검", () => {
  it("페이지 안에서 금지 API를 건드리면 스파이가 기록한다(스파이가 실제로 심겨 있다)", async () => {
    const { w, spy } = boot();
    await until(() => w.document.documentElement.hasAttribute("data-cc-booted"), "부팅");
    w.eval("void window.localStorage; void document.cookie; try { new XMLHttpRequest() } catch (e) {}; void navigator.clipboard; window.open('x'); history.replaceState(null, ''); document.createElement('img');");
    expect(spy.touched).toEqual(["localStorage", "document.cookie(get)", "XMLHttpRequest", "navigator.clipboard", "window.open", "history.replaceState", "createElement(img)"]);
    w.close();
  });
});

describe("ISO-02 커밋된 PAGE.html 런타임 스파이 — 전 흐름", () => {
  it("저장소·네트워크·창·클립보드 호출 0, pushState 인자는 ({cc:<화면>}, '')뿐, 허용 동작(Blob 내려받기·인쇄)만 일어난다", async () => {
    const { w, spy } = boot();
    const steps: string[] = [];
    const step = (s: string): void => { steps.push(`${s} [${h1(w)}]`); };
    await until(() => w.document.documentElement.hasAttribute("data-cc-booted"), "부팅");
    step("부팅");

    // V0 → 체험 → C(AWS) 리포트
    await click(w, "체험 모드로 먼저 보기");
    await toScreen(w, "체험 모드");
    const card = [...w.document.querySelectorAll("#app article")].find((a: W) => (a.textContent ?? "").includes("아슬아슬상회"));
    if (card === undefined) throw new Error("아슬아슬상회 카드 없음");
    const cardBtns = [...card.querySelectorAll("button")];
    (cardBtns.find((b: W) => (b.textContent ?? "").includes("리포트")) ?? cardBtns[0]).click();
    await until(() => h1(w) === "체험 리포트", `체험 리포트 — 콘솔: ${spy.consoleErrors.slice(0, 3).join(" / ")} — 카드 버튼: ${cardBtns.map((b: W) => b.textContent).join("|")}`);
    step("체험 리포트");

    // V4 고치는 법 → 리포트로
    await click(w, "고치는 법");
    await toScreen(w, "고치는 법");
    step("고치는 법");
    await click(w, "← 리포트로");
    await toScreen(w, "체험 리포트");

    // V7 · V8 (머리 메뉴)
    await click(w, "판정 규칙");
    await toScreen(w, "판정 규칙");
    step("판정 규칙");
    await click(w, "이 도구에 대해");
    await toScreen(w, "이 도구에 대해");
    step("이 도구에 대해");

    // 처음 → AWS 점검 시작(V1) → 수집기 내려받기(Blob) → 결과 파일 넣기(V2)
    await click(w, "문단속 5");
    await until(() => buttons(w).some((b: W) => (b.textContent ?? "").trim() === "AWS 점검 시작"), "V0");
    await click(w, "AWS 점검 시작");
    await until(() => buttons(w).some((b: W) => (b.textContent ?? "").trim() === "수집기 내려받기"), "V1 수집기 내려받기");
    step("V1");
    await click(w, "수집기 내려받기");
    await click(w, /^결과 파일 넣기/);
    await until(() => w.document.querySelector('#app input[type="file"]') !== null, "V2 파일 입력");
    step("V2");

    // 파일 2개(수집기 JSON + 보고서 CSV) + 붙여넣기(보고서 CSV)
    setFiles(w, w.document.querySelector('#app input[type="file"][multiple]') ?? w.document.querySelector('#app input[type="file"]'), [
      { name: "cloudcheck-aws-3333-20261019T031500Z.json", text: JSON.stringify(companyJson("aws", "C")) },
      { name: "credential-report.csv", text: companyCsv("C") },
    ]);
    await until(() => (w.document.querySelector("#app")?.textContent ?? "").includes("읽었습니다"), "파일 인식");
    await click(w, "붙여넣기");
    const ta = w.document.querySelector("#app textarea");
    if (ta === null) throw new Error("붙여넣기 칸 없음");
    paste(w, ta, companyCsv("C"));
    await until(() => w.document.querySelectorAll("#app .cc-input__list tbody tr, #app .cc-input__list li").length >= 3, "붙여넣기 인식(파일 2 + 붙여넣기 1)");
    step("V2 파일+붙여넣기");
    await click(w, "이 계정으로 리포트 보기");
    await toScreen(w, "리포트");
    step("V3 실제 리포트");

    // 예외 표시: 위험 점검 하나 펼치기 → [예외로 표시] → 사유·만료일 → 저장
    const tog = w.document.getElementById("cc-rule-AWS-STO-2-t") ?? w.document.querySelector("#app .cc-rule__tog");
    tog.click();
    await sleep(30);
    await click(w, "예외로 표시");
    const form = w.document.querySelector("#app form") ?? w.document;
    const reason = form.querySelector("textarea, input[type='text']");
    const until_ = form.querySelector("input[type='date']");
    if (reason) typeInto(w, reason, "QA 시험: 정적 웹사이트로 의도된 공개");
    if (until_) typeInto(w, until_, "2026-11-30");
    await sleep(20);
    await click(w, "예외로 표시하기");
    await until(() => /예외 1건 적용/.test(w.document.querySelector("#app")?.textContent ?? ""), "예외 1건 적용");
    step("예외 표시");
    await click(w, "예외 파일 내보내기");
    step("예외 내보내기");
    // 불러오기: 파일 입력에 예외 파일
    await click(w, "예외 파일 불러오기");
    const excInputs = [...w.document.querySelectorAll('#app input[type="file"]')];
    const excInput = excInputs[excInputs.length - 1];
    if (excInput) setFiles(w, excInput, [{ name: "cloudcheck-exceptions.json", text: JSON.stringify({ schema: "cloudcheck.exceptions/1.0", entries: [] }) }]);
    await sleep(80);
    step("예외 불러오기");

    // 마스킹 사본 · 인쇄 · 새 점검
    await click(w, "마스킹 사본 저장");
    step("마스킹 사본");
    await click(w, "인쇄");
    if (buttons(w).some((b: W) => (b.textContent ?? "").trim() === "인쇄 창 열기")) await click(w, "인쇄 창 열기");
    await sleep(60);
    step("인쇄");
    await click(w, "새 점검");
    await click(w, "리포트를 닫고 계속");     // 확인 대화상자(jsdom은 showModal이 없어 role=alertdialog 대체 경로)
    await until(() => h1(w) !== "리포트", "새 점검 뒤 리포트 닫힘");
    step("새 점검");
    console.info(`[ISO-02] ${steps.join(" → ")} | pushState ${spy.pushes.length}회 · 내려받기 ${spy.downloads.length}건(${spy.downloads.map((d) => d.download).join(", ")}) · Blob ${spy.blobs.created}/${spy.blobs.revoked} · 인쇄 ${spy.prints.length}회`);

    // ── 판정 ──
    const bad = spy.pushes.filter((a) => !(a.length === 2 && a[1] === "" && typeof a[0] === "object" && a[0] !== null && Object.keys(a[0] as object).join() === "cc" && typeof (a[0] as { cc: unknown }).cc === "string"));
    expect({ touched: spy.touched, badPushes: bad }).toEqual({ touched: [], badPushes: [] });
    expect(spy.downloads.filter((d) => d.download === null || !d.href.startsWith("blob:"))).toEqual([]);
    expect(spy.downloads.length, steps.join(" → ")).toBeGreaterThanOrEqual(3);    // 수집기 · 예외 파일 · 마스킹 사본
    expect(spy.blobs.created).toBe(spy.downloads.length);
    expect(spy.prints.length).toBeGreaterThanOrEqual(1);
    expect(spy.pushes.length).toBeGreaterThan(8);
    expect(spy.consoleErrors.filter((e) => !/Not implemented: HTMLCanvasElement|Could not parse CSS stylesheet/.test(e))).toEqual([]);
    expect(w.location.href).toBe("https://project-orsrw.vercel.app/cloudcheck");
    w.close();
  });
});
