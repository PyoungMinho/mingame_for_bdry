/**
 * 화면 테스트 도구(jsdom) — 저장소(localStorage)를 '블랙박스 상태 창'으로 읽어 다음 조작을 결정한다.
 * 테스트가 화면 조작만으로 게임을 끝까지 돌리는 데 쓴다(엔진 직접 호출 없이 UI 클릭).
 * 이 파일은 테스트 전용이라 *.test 가 아니어도 번들에 들어가지 않는다(어디서도 import 하지 않는다).
 */
import { act, fireEvent } from '@testing-library/react';
import { CASE, STORAGE_KEYS, getEvidence, judgePresent, parseRun, roomStatus, setStatus, visibleHotspots, visibleLines, type Id, type RunState } from '@/lib/witness';

export const q = <T extends HTMLElement = HTMLElement>(sel: string): T | null => document.querySelector<T>(sel);
export const qa = <T extends HTMLElement = HTMLElement>(sel: string): T[] => [...document.querySelectorAll<T>(sel)];

export function readRun(): RunState | null {
  return parseRun(window.localStorage.getItem(STORAGE_KEYS.run));
}

export async function flush(ms = 2): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

export function click(el: Element | null, what = 'element'): void {
  if (!el) throw new Error(`click: ${what} 를 찾지 못했다\n현재 화면 텍스트: ${document.body.textContent?.slice(0, 400)}`);
  fireEvent.click(el);
}

export function clickText(text: string, scope: ParentNode = document): void {
  const el = [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => !b.disabled && (b.textContent ?? '').replace(/\s+/g, ' ').includes(text));
  click(el ?? null, `버튼 「${text}」`);
}

/**
 * 대사·획득 카드·로그 시트·결과 카드·코치마크를 전부 넘길 때까지.
 * 연출은 타이머 연쇄(시트 닫힘 → 컷인 → 판정 → 대사)라 한 번 비어 보여도 곧 이어질 수 있다 — 연속으로 비어야 끝난 것으로 본다.
 */
export async function settle(max = 200): Promise<void> {
  let idle = 0;
  for (let i = 0; i < max; i++) {
    await flush(3);
    const el =
      q('.wt-sheet--result [data-testid=result-continue]') ??
      q('.wt-acquire-ok') ??
      q('.wt-sheet--log .wt-sheet-footer .wt-btn') ??
      q('.wt-sheet--egg .wt-dialogue-tap') ??
      q('.wt-dialogue-tap:not(.wt-sheet--hint *)') ??
      q('.wt-coach-ok');
    if (!el) {
      idle += 1;
      if (idle >= 4) return;
      continue;
    }
    idle = 0;
    fireEvent.click(el);
  }
  throw new Error('settle: 끝나지 않는 대사/시트');
}

export async function spendIfAsked(): Promise<void> {
  await flush();
  const yes = q('[data-testid=spend-yes]');
  if (yes) {
    fireEvent.click(yes);
    await flush();
  }
}

export async function tab(label: '집 안' | '사람' | '수첩'): Promise<void> {
  const b = qa('.wt-tabbar button').find((x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').includes(label));
  click(b ?? null, `탭 ${label}`);
  await flush();
}

export async function exitToHub(): Promise<void> {
  const rail = q('.wt-rail-exit');
  if (rail) fireEvent.click(rail);
  else {
    const back = q('button[aria-label="나가기(허브로)"]');
    if (back) fireEvent.click(back);
  }
  await settle();
  if (!q('.wt-tabbar')) throw new Error('허브로 나가지 못했다');
}

export async function enterRoom(locId: Id): Promise<void> {
  await tab('집 안');
  click(q(`[data-testid=room-${locId}]`), `방 타일 ${locId}`);
  await spendIfAsked();
  await settle();
  if (!q('.wt-rail')) throw new Error(`${locId} 조사 화면이 열리지 않았다`);
}

export async function examineChip(hotspotId: Id): Promise<void> {
  click(q(`.wt-railchip[data-hid="${hotspotId}"]`), `레일 칩 ${hotspotId}`);
  await spendIfAsked();
  await settle();
}

export async function openSetUI(setId: Id): Promise<void> {
  await tab('사람');
  click(q(`[data-testid=set-${setId}]`), `증언 행 ${setId}`);
  await spendIfAsked();
  await settle();
  if (!q('.wt-test-panel')) throw new Error(`${setId} 심문 화면이 열리지 않았다`);
}

export async function gotoLine(index: number): Promise<void> {
  const dots = qa('.wt-linedot');
  click(dots[index] ?? null, `${index + 1}번 줄 점`);
  await flush();
}

export const cardLabel = (id: Id): string => getEvidence(id)?.name ?? CASE.profiles.find((p) => p.id === id)?.name ?? id;

/** 현재 줄에 카드(1~2장)를 제시한다 — 증거 시트에서 카드 이름으로 고른다 */
export async function presentUI(cards: Id[]): Promise<void> {
  click(q('[data-testid=present]'), '증거 제시 버튼');
  await flush();
  const sheet = q('.wt-sheet--sheet') ?? q('.wt-sheet');
  if (!sheet) throw new Error('증거 시트가 열리지 않았다');
  for (const [i, c] of cards.entries()) {
    const isProfile = !getEvidence(c);
    if (isProfile) clickText('인물', sheet as HTMLElement);
    await flush();
    const name = cardLabel(c);
    const btn = qa('.wt-sheet button.wt-card-hit, .wt-sheet button.wt-profile').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name));
    click(btn ?? null, `카드 ${name}`);
    await flush();
    if (i === 0 && cards.length > 1) clickText('하나 더 겹치기');
    await flush();
  }
  clickText(cards.length > 1 ? '함께 제시' : '이걸로!');
  await settle();
}

/** 이 세트에서 지금 할 수 있는 다음 무료 행동: 추궁할 줄 / 깰 수 있는 모순 */
function nextSetAction(run: RunState, setId: Id): { kind: 'press' | 'break'; index: number; cards?: Id[] } | null {
  const rows = visibleLines(run, setId);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (const b of r.line.breaks ?? []) {
      if (run.broken.includes(b.id)) continue;
      for (const alt of [b.evidence, ...(b.accept ?? [])]) {
        if (!alt.every((c) => run.evidence.includes(c) || CASE.profiles.some((p) => p.id === c))) continue;
        if (judgePresent(run, r.line.id, alt).kind === 'BREAK') return { kind: 'break', index: i, cards: [...alt] };
      }
    }
  }
  const p = rows.findIndex((r) => !r.pressed);
  return p >= 0 ? { kind: 'press', index: p } : null;
}

/**
 * 무료로 할 수 있는 것 전부를 화면 조작으로 한다(engine freeClosure 와 같은 규칙):
 * 무료 새 장소·세트 진입, 보이는 일반 핫스팟 조사, 모든 줄 추궁, 정답 카드를 가진 모순 제시.
 * 정밀 조사(유료)는 하지 않는다.
 */
export async function closureUI(): Promise<void> {
  for (let guard = 0; guard < 80; guard++) {
    const run = readRun();
    if (!run || run.phase !== 'play') return;
    let did = false;

    for (const loc of CASE.locations) {
      const visited = run.visited.includes(loc.id);
      if (!visited) {
        const st = roomStatus(run, loc.id);
        if (!(st.state === 'open' && st.cost === 0)) continue;
      } else if (!visibleHotspots(run, loc.id).some((s) => !s.examined && !s.hotspot.precise)) continue;
      await enterRoom(loc.id);
      for (const s of visibleHotspots(readRun()!, loc.id)) if (!s.examined && !s.hotspot.precise) await examineChip(s.hotspot.id);
      await exitToHub();
      did = true;
      break;
    }
    if (did) continue;

    for (const set of CASE.sets) {
      const st = setStatus(run, set.id);
      if (st.state === 'locked' || st.state === 'siren') continue;
      const isOpen = run.opened.includes(set.id);
      if (!isOpen && st.cost !== 0) continue;
      if (isOpen && !nextSetAction(run, set.id)) continue;
      await openSetUI(set.id);
      for (let k = 0; k < 40; k++) {
        const cur = readRun()!;
        if (cur.phase !== 'play') break;
        const act = nextSetAction(cur, set.id);
        if (!act) break;
        await gotoLine(act.index);
        if (act.kind === 'press') {
          click(q('[data-testid=press]'), '추궁 버튼');
          await settle();
        } else await presentUI(act.cards!);
      }
      if (readRun()?.phase === 'play' && q('.wt-test-panel')) await exitToHub();
      did = true;
      break;
    }
    if (!did) return;
  }
  throw new Error('closureUI: 끝나지 않는다');
}
