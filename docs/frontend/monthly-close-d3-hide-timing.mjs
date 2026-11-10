// 월마감 숨기기 전환 시간 측정(방향서 §10 D3 기준 5, 디자인 V26) + 모바일 배치 확인 스크린샷.
// 로컬 Chrome(헤드리스) + CDP. 의존성 없음(Node 22 내장 WebSocket·fetch).
// 사용: node docs/frontend/monthly-close-d3-hide-timing.mjs [url] [반복수]
//   기본 url = http://localhost:3000/monthly-close/practice?mock=playing&i=0 (dev 서버 필요), 반복 40회
// 출력: mc-hide measure(키 처리기 → data-view 변경) p50/p95, 종단(keydown → 다음 프레임) p50/p95, 모바일 치수.
// 스크린샷·Chrome 프로필은 OS 임시 폴더(monthly-close-d3/)에 둔다(레포에 남기지 않음).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HERE = join(tmpdir(), 'monthly-close-d3');
mkdirSync(HERE, { recursive: true });
const URL_ = process.argv[2] ?? 'http://localhost:3000/monthly-close/practice?mock=playing&i=0';
const N = Number(process.argv[3] ?? 40);
const PORT = 9333;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = join(HERE, 'chrome-profile');
mkdirSync(profile, { recursive: true });
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--no-first-run', '--window-size=1366,768', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('no chrome');
}

let ws;
let id = 0;
const pending = new Map();
const events = [];
function send(method, params = {}) {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res, rej) => pending.set(i, { res, rej }));
}
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
  return r.result.value;
};
const key = async (code, k, keyCode) => {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', code, key: k, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', code, key: k, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode });
};
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const f = join(HERE, `${name}.png`);
  writeFileSync(f, Buffer.from(r.data, 'base64'));
  return f;
};
const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function main() {
  ws = new WebSocket(await target());
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result);
    } else events.push(msg);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const ok = await evalJs(`!!document.querySelector('.mc-shell [data-pane="theirs"] [data-addr="A1"]')`).catch(() => false);
    if (ok) break;
  }
  await sleep(800);
  console.log('title:', await evalJs('document.title'));
  console.log('shot desktop game:', await shot('desktop-game'));
  // 종단 측정용: keydown 시각 → 다음 프레임(rAF 뒤 task) 까지
  await evalJs(`(() => {
    window.__mcE2E = [];
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'Tab') return;
      const t0 = e.timeStamp;
      requestAnimationFrame(() => setTimeout(() => {
        if (document.querySelector('.mc-shell').getAttribute('data-view') === 'disguise') window.__mcE2E.push(performance.now() - t0);
      }, 0));
    }, true);
    performance.clearMeasures('mc-hide');
    return true;
  })()`);
  for (let i = 0; i < N; i++) {
    // 게임 화면 칸을 하나 눌러 포커스를 게임 쪽에 둔다
    await evalJs(`document.querySelector('[data-layer="game"] [data-pane="theirs"] [role="grid"]').focus(); true`);
    await key('Tab', 'Tab', 9);
    await sleep(60);
    if (i === 0) {
      console.log('shot desktop hidden:', await shot('desktop-hidden'));
      // 숨긴 뒤 Tab → 다음 칸 확인
      const before = await evalJs(`document.querySelector('.mc-namebox').value`);
      await key('Tab', 'Tab', 9);
      await sleep(60);
      const after = await evalJs(`document.querySelector('.mc-namebox').value`);
      const active = await evalJs(`document.activeElement?.closest('[data-layer]')?.getAttribute('data-layer') ?? document.activeElement?.tagName`);
      console.log(`hidden Tab: name box ${before} → ${after} (focus in ${active})`);
    }
    // 게임 탭 클릭으로 복귀
    await evalJs(`document.querySelector('[role="tab"][data-kind="game"]').click(); true`);
    await sleep(40);
  }
  const measures = await evalJs(`performance.getEntriesByName('mc-hide').map((m) => m.duration)`);
  const e2e = await evalJs('window.__mcE2E');
  const fmt = (a) => `n=${a.length} p50=${pct(a, 50)?.toFixed(2)}ms p95=${pct(a, 95)?.toFixed(2)}ms max=${Math.max(...a).toFixed(2)}ms`;
  console.log('mc-hide measure (keydown 처리기 → data-view 변경):', fmt(measures));
  console.log('종단(keydown → 다음 프레임):', fmt(e2e));

  // 모바일 390×844
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  await send('Page.reload');
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    const ok = await evalJs(`!!document.querySelector('.mc-shell[data-mobile="true"] [data-addr="A1"]')`).catch(() => false);
    if (ok) break;
  }
  await sleep(600);
  const mob = await evalJs(`(() => {
    const q = (s) => document.querySelector(s);
    const r = (s) => { const e = q(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.width)]; };
    return { mobile: q('.mc-shell').dataset.mobile, panes: document.querySelectorAll('[data-layer="game"] .mc-pane').length,
      tabs: [...document.querySelectorAll('[role=tab]')].map((t) => t.textContent), cellA1: r('[data-layer="game"] [data-addr="A1"]'),
      row8: r('[data-layer="game"] [data-addr="A8"]'), I9: r('[data-layer="game"] [data-addr="I9"]'), memo: r('.mc-memoline'), confirm: r('.mc-confirmrow'), tabsBar: r('.mc-mtabs'), vw: innerWidth, vh: innerHeight,
      hscroll: (() => { const s = q('[data-layer="game"] .mc-grid__scroll'); return s ? s.scrollWidth - s.clientWidth : null; })() };
  })()`);
  console.log('mobile 390x844:', JSON.stringify(mob));
  console.log('shot mobile:', await shot('mobile-game'));
  await evalJs(`document.querySelector('[role="tab"][data-kind="disguise"]').click(); true`);
  await sleep(100);
  console.log('shot mobile hidden:', await shot('mobile-hidden'));
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 640, deviceScaleFactor: 2, mobile: true });
  await evalJs(`document.querySelector('[role="tab"][data-kind="game"]').click(); true`);
  await sleep(300);
  const m360 = await evalJs(`(() => { const b = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null; }; return { A8: b('[data-layer="game"] [data-addr="A8"]'), tabs: b('.mc-mtabs'), vh: innerHeight }; })()`);
  console.log('mobile 360x640:', JSON.stringify(m360));
  console.log('shot mobile360:', await shot('mobile-360'));
  ws.close();
  proc.kill();
}
main().catch((e) => {
  console.error(e);
  proc.kill();
  process.exit(1);
});
