// @vitest-environment jsdom
/**
 * 엔딩 8종 — 화면 조작으로 각각 도달한다(QA 실행자).
 * 상태는 엔진(playPath)으로 '지목 직전'까지 만들어 저장소에 심고, 그 뒤는 전부 화면 클릭이다:
 *   허브 [최종 지목] → 확인 시트 → 범인 → 수단·기회·동기 칸 → (지목 경고) → 확인 → 판정 연출 → 엔딩 → 공유 시트.
 * 시간 초과는 마지막 행동(수첩 정리)을 화면에서 쓰고 사이렌을 거쳐, 수사 배제는 화면에서 오답을 내서 도달한다.
 * meta(도감)는 판 사이에 그대로 이어지므로, 마지막에 타이틀 「엔딩 도감 8/8」과 도감 썸네일 8장을 확인한다.
 * 범인 id·정답 카드는 코드에 쓰지 않고 CASE.solution 에서 읽는다.
 */
import { cleanup, render } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CASE,
  STAR_TOTAL,
  STORAGE_KEYS,
  canAccuse,
  endingSlots,
  enterLocation,
  examine,
  exit,
  getEvidence,
  hint,
  loadMeta,
  newRun,
  openSet,
  openStorage,
  present,
  setScreen,
  stars,
  type Accusation,
  type EndingId,
  type RunState,
  type SuspectId,
} from '@/lib/witness';
import { freeClosure, paidItems, playPath } from '@/lib/witness/validate';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { cardLabel, click, clickText, flush, gotoLine, presentUI, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];
const PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];
const SHORT_PATH = ['L2', 'P:L2.h3', 'T04', 'T05', 'L3'];
const CULPRIT = CASE.solution.culprit;
const INNOCENTS = (['S1', 'S2', 'S3', 'S4'] as SuspectId[]).filter((s) => s !== CULPRIT);
const ACC = CASE.solution.accept;
const perfectAcc = (): Accusation => ({ culprit: CULPRIT, means: ACC.means[0], opportunity: ACC.opportunity[0], motive: ACC.motive[0] });

/** 스포일러 낱말: 인물 이름(용의자·증인·피해자) + 모든 증거 이름 */
const SPOILER_WORDS = [...Object.values(CASE.names).filter((n) => n && n.length > 1), ...CASE.evidence.map((e) => e.name), ...CASE.profiles.map((p) => p.name)].filter((w, i, a) => w && a.indexOf(w) === i);

function seedRun(run: RunState): void {
  window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
}

async function boot(): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  click(q('[data-testid=title-resume]'), '이어하기');
  await settle();
}

async function pickCard(id: string): Promise<void> {
  const name = cardLabel(id);
  const card = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name));
  click(card ?? null, `칸 카드 ${name}`);
  await flush();
}

/** 지목 2단계~판정 연출~엔딩 본문 끝까지(화면 조작) */
async function slotsToEnding(acc: Accusation): Promise<{ warned: boolean; skipShown: boolean; sums: (string | null)[] }> {
  click(q(`[data-testid=pick-${acc.culprit}]`), `범인 ${acc.culprit}`);
  click(q('[data-testid=pick-submit]'));
  await flush();
  expect(readRun()!.accuse?.stage).toBe('slots');
  for (const slot of ['means', 'opportunity', 'motive'] as const) {
    click(q(`[data-testid=slot-${slot}]`));
    await flush();
    await pickCard(acc[slot]);
  }
  click(q('[data-testid=slots-confirm]'));
  await flush();
  let warned = false;
  if (q('[data-testid=warn-go]')) {
    warned = true;
    click(q('[data-testid=warn-go]'));
    await flush();
  }
  click(q('[data-testid=confirm-submit]'), '이대로 넘긴다');
  await flush();
  expect(q('.wt-verdict')).toBeTruthy();
  const skipShown = !!q('[data-testid=verdict-skip]');
  for (let i = 0; i < 40 && !q('[data-testid=verdict-finish]') && q('.wt-verdict'); i++) {
    const tap = q('.wt-verdict .wt-dialogue-tap');
    if (tap) click(tap);
    await flush();
  }
  const sums = qa('.wt-verdict-sum li').map((li) => li.getAttribute('data-ok'));
  if (q('[data-testid=verdict-finish]')) click(q('[data-testid=verdict-finish]'));
  await flush();
  await toEndingDetail();
  return { warned, skipShown, sums };
}

async function toEndingDetail(): Promise<void> {
  for (let i = 0; i < 40 && !q('.wt-ending-detail'); i++) {
    const tap = q('.wt-dialogue-tap');
    if (tap) click(tap);
    await flush();
  }
  expect(q('.wt-ending-detail'), '엔딩 결과 영역').toBeTruthy();
  // 되감기가 남은 실패 엔딩은 도장·통계를 접어 둔다(다시 하기 §g-1) — 등급을 확인하는 테스트는 펼쳐서 본다
  const fold = q('[data-testid=ending-fold]');
  if (fold && fold.getAttribute('aria-expanded') !== 'true') {
    click(fold);
    await flush();
  }
}

/** 허브의 [최종 지목] → (행동이 남았으면) 확인 시트 → 1단계 */
async function accuseFromHub(acc: Accusation) {
  expect(q('.wt-hud--hub')).toBeTruthy();
  click(q('.wt-accusebar-btn'), '최종 지목 버튼');
  await flush();
  if (readRun()!.actions > 0) clickText('지목하러 간다');
  await flush();
  expect(q('.wt-pick')).toBeTruthy();
  return slotsToEnding(acc);
}

function shareText(): string {
  click(q('[data-testid=ending-share]'), '공유');
  const text = q('.wt-sharecard')?.textContent ?? '';
  click(q('.wt-sheet--share button[aria-label="닫기"]'));
  return text;
}

function expectNoSpoiler(text: string, where: string): void {
  for (const w of SPOILER_WORDS) expect(text.includes(w), `${where}: 「${w}」`).toBe(false);
  expect(text).not.toMatch(/범인|진상|위조|트로피|특허/);
}

/** 제시 없이 유료 항목만 쓴다(장소는 일반 핫스팟만) — paths.test 의 wander 와 같은 규칙 */
function wander(from: RunState, keys: string[]): RunState {
  let r = from;
  for (const k of keys) {
    const it = paidItems().find((x) => x.key === k)!;
    if (it.kind === 'set') {
      r = exit(openSet(r, it.id).run).run;
      continue;
    }
    const loc = CASE.locations.find((l) => l.id === it.id || l.hotspots.some((h) => h.id === it.id))!;
    r = enterLocation(r, loc.id).run;
    for (const h of loc.hotspots) {
      if (h.precise && h.id !== it.id) continue;
      if (!h.precise && it.kind === 'precise') continue;
      const x = examine(r, h.id);
      if (!x.error) r = x.run;
    }
    r = exit(r).run;
  }
  return r;
}

const reached = new Set<EndingId>();

beforeAll(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  // 1회차부터 시작하는 도감(meta) — 판 사이에 이어진다
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 0, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH }),
  );
  fxConfig.scale = 0;
});
afterAll(() => {
  cleanup();
  fxConfig.scale = 1;
  window.localStorage.clear();
});

describe('엔딩 8종 — 화면 조작으로 도달(도감은 판 사이에 이어진다)', () => {
  it('① 완벽 해결(1회차): 판정 3칸 통함 · A · [전부 건너뛰기] 없음 · 숨은 엔딩 티저', async () => {
    seedRun(setScreen(playPath(PATH), { name: 'hub', tab: 'house' }));
    await boot();
    const v = await accuseFromHub(perfectAcc());
    expect(v.skipShown).toBe(false);
    expect(v.warned).toBe(false);
    expect(v.sums).toEqual(['1', '1', '1']);
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.perfect!.title);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('A');
    expect(q('.wt-teaser')).toBeTruthy();
    const s = shareText();
    expect(s).toContain('A등급');
    expectNoSpoiler(s, '완벽 해결 공유');
    reached.add('perfect');
    cleanup();
  });

  it('② 숨은 엔딩: 같은 범인·같은 3칸 + 숨은 조건 → 「마지막 알람」, 티저 없음, 공유엔 사실만', async () => {
    seedRun(setScreen(playPath([...PATH, 'T01', 'T06']), { name: 'hub', tab: 'house' }));
    await boot();
    const v = await accuseFromHub(perfectAcc());
    expect(v.skipShown).toBe(true); // 2회차
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.hidden!.title);
    expect(q('.wt-teaser')).toBeNull();
    const s = shareText();
    expectNoSpoiler(s, '숨은 엔딩 공유');
    reached.add('hidden');
    cleanup();
  });

  it('③ S 등급: 완벽 + ★ 전부 + 틀린 제시 ≤ 2 → S 도장', async () => {
    const run = playPath([...PATH, 'T01', 'L5', 'P:L5.h3']);
    expect(stars(run)).toBe(STAR_TOTAL);
    seedRun(setScreen(run, { name: 'hub', tab: 'house' }));
    await boot();
    await accuseFromHub(perfectAcc());
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('S');
    expect(q('.wt-grade svg.wt-art-stamp[data-grade="S"]')).toBeTruthy();
    expect(shareText()).toContain('S등급');
    cleanup();
  });

  it('④ 범인 맞힘·증거 부족: 2칸이면 B, 1칸이면 C — 위조 갱신본이 없으면 지목 경고가 먼저 뜬다', async () => {
    const base = playPath(SHORT_PATH);
    expect(canAccuse(base)).toBe(true);
    const hasUpgrade = ACC.opportunity.every((id) => base.evidence.includes(id));
    // B: 수단·동기 정답, 기회는 정답이 아닌 카드
    const wrongOpp = base.evidence.find((id) => getEvidence(id) && !ACC.opportunity.includes(id) && id !== ACC.means[0] && id !== ACC.motive[0])!;
    seedRun(setScreen(base, { name: 'hub', tab: 'house' }));
    await boot();
    const b = await accuseFromHub({ culprit: CULPRIT, means: ACC.means[0], opportunity: wrongOpp, motive: ACC.motive[0] });
    expect(b.warned).toBe(!hasUpgrade);
    expect(b.sums).toEqual(['1', '0', '1']);
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.short!.title);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('B');
    expectNoSpoiler(shareText(), '증거 부족 B 공유');
    cleanup();

    // C: 동기만 정답
    const wrongMeans = base.evidence.find((id) => getEvidence(id) && !ACC.means.includes(id) && id !== wrongOpp && id !== ACC.motive[0])!;
    seedRun(setScreen(base, { name: 'hub', tab: 'house' }));
    await boot();
    const c = await accuseFromHub({ culprit: CULPRIT, means: wrongMeans, opportunity: wrongOpp, motive: ACC.motive[0] });
    expect(c.sums).toEqual(['0', '0', '1']);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('C');
    reached.add('short');
    cleanup();
  });

  for (const s of INNOCENTS) {
    it(`⑤ 오인 체포(${s}): 칸 판정 없이 호명 직후 엔딩 · C · 공유엔 이름 없음`, async () => {
      const base = playPath(SHORT_PATH);
      seedRun(setScreen(base, { name: 'hub', tab: 'house' }));
      await boot();
      const v = await accuseFromHub({ culprit: s, means: ACC.means[0], opportunity: base.evidence.find((id) => getEvidence(id) && id !== ACC.means[0] && id !== ACC.motive[0])!, motive: ACC.motive[0] });
      expect(v.sums).toEqual([]); // 칸 판정 요약 없음
      const id = `wrong-${s}` as EndingId;
      expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings[id]!.title);
      expect(q('.wt-ending')?.getAttribute('data-ending')).toBe(id);
      expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('C');
      expectNoSpoiler(shareText(), `오인 체포 ${s} 공유`);
      reached.add(id);
      cleanup();
    });
  }

  it('⑥ 시간 초과: 마지막 행동(수첩 정리)을 화면에서 쓰고 → 사이렌 → [계속] → 「사이렌이 먼저 왔다」 C', async () => {
    let r = wander(freeClosure(newRun({ now: Date.now(), skipTutorial: true })), ['L1', 'L2', 'L3', 'L4', 'T01', 'T02', 'T03', 'T04', 'T05', 'P:L2.h3']);
    r = hint(r).run;
    // 제시 없이 쓸 수 있는 유료 항목은 10개뿐 — 남은 행동을 1 로 맞추고 마지막 행동을 수첩 정리로 쓴다
    r = { ...r, actions: 1 };
    expect(stars(r)).toBeLessThan(3);
    seedRun(setScreen(r, { name: 'hub', tab: 'notebook' }));
    await boot();
    clickText('정리하기');
    await flush();
    expect(document.body.textContent).toContain('이게 마지막 행동이다.');
    expect(document.body.textContent).toContain('결정적 모순이 아직');
    click(q('[data-testid=spend-yes]'));
    await flush(10);
    for (let i = 0; i < 8; i++) {
      const tap = q('.wt-sheet--hint .wt-dialogue-tap');
      if (!tap) break;
      click(tap);
      await flush();
    }
    click(q('[data-testid=hint-close]'), '수첩 정리 닫기');
    await flush();
    expect(q('.wt-siren')).toBeTruthy();
    expect(q('.wt-siren-sub')?.textContent).toContain('결정적 모순이 3개 더 필요하다');
    click(q('[data-testid=siren-continue]'));
    await flush();
    // 사이렌 뒤 허브 — ★ < 3 이면 [지목하기] 대신 [수사 종료](확인 시트 → [끝낸다])
    expect(q('[data-testid=accuse-bar]')).toBeNull();
    click(q('[data-testid=end-investigation]'), '수사 종료');
    await flush();
    expect(document.body.textContent).toContain('수사를 끝낼까요?');
    expect(document.body.textContent).toContain('지목하려면 결정적 모순이 3개 더 필요해요.');
    click(q('[data-testid=end-yes]'));
    await flush();
    await toEndingDetail();
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.timeout!.title);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('C');
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
    expectNoSpoiler(shareText(), '시간 초과 공유');
    reached.add('timeout');
    cleanup();
  });

  it('⑦ 수사 배제: 신뢰 1에서 화면으로 오답 → W65 · 도감 기록 · 타이틀에 이어하기(되감기용) 남음', async () => {
    let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    r = enterLocation(r, 'L3').run;
    for (const h of CASE.locations.find((l) => l.id === 'L3')!.hotspots) if (!h.precise) r = examine(r, h.id).run;
    r = openSet(r, 'T05').run;
    for (let i = 0; i < 4; i++) r = present(r, 'T05.1', ['E01']).run;
    expect(r.trust).toBe(1);
    seedRun(r);
    await boot();
    await gotoLine(0);
    await presentUI(['E01']);
    await settle();
    expect(q('.wt-excluded')).toBeTruthy();
    expect(loadMeta(openStorage().storage).endings).toContain('excluded');
    reached.add('excluded');
    cleanup();
    // 새로고침: 배제된 판은 되감기를 위해 남는다 → 타이틀 [이어하기] → 같은 W65
    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=title-resume]'), '이어하기');
    await flush();
    expect(q('.wt-excluded')).toBeTruthy();
    cleanup();
  });

  it('⑧ 도감: 엔딩 8/8 · 썸네일 8장 · 사건 파일 열림 · 플레이 횟수 = 판 수', async () => {
    expect([...reached].sort()).toEqual([...endingSlots()].sort());
    const meta = loadMeta(openStorage().storage);
    expect([...meta.endings].sort()).toEqual([...endingSlots()].sort());
    // 완벽·숨은·S·B·C·오인×3·시간 초과 = 9판. 수사 배제는 되감기가 남아 있어 도감에만 기록(플레이 횟수 그대로)
    expect(meta.plays).toBe(9);
    expect(meta.bestGrade).toBe('S');
    window.localStorage.removeItem(STORAGE_KEYS.run);
    render(<WitnessApp />);
    await flush();
    await flush();
    // 마지막 엔딩(시간 초과)을 아직 '보는 중'으로 남겨 뒀으면 엔딩 화면부터 → [제목으로]
    if (q('.wt-ending')) {
      await toEndingDetail(); // 이미 읽은 본문이라 [결과 바로 보기]는 없다 — 탭으로 넘긴다
      clickText('제목으로');
      await flush();
    }
    expect(q('[data-testid=title-collection]')?.textContent).toContain('8/8');
    click(q('[data-testid=title-collection]'));
    await flush();
    expect(qa('.wt-coll-thumb').length).toBe(8);
    expect(qa('.wt-coll-item:not([data-got])').length).toBe(0);
    expect(q('[data-testid=coll-casefile]')?.textContent).toBe('사건 파일');
  });
});

describe('BUG-W01 회귀: 언마운트된 화면이 1초 뒤 meta 를 덮어쓰지 않는다', () => {
  it('대사를 읽고(읽음 기록 대기 중) 바로 언마운트 → 다른 곳이 쓴 도감이 1초 뒤에도 그대로', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(
      STORAGE_KEYS.meta,
      JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH }),
    );
    let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    r = setScreen(openSet(r, 'T05').run, { name: 'testimony', ref: 'T05', line: 0 });
    seedRun(r);
    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=title-resume]'), '이어하기');
    await flush(20); // 증언 소개 대사가 다 나와 읽음 기록 타이머(1초)가 걸린 상태
    expect(q('.wt-test-panel')).toBeTruthy();
    cleanup();
    // 다른 인스턴스(다른 탭·다시 마운트된 화면)가 그사이 엔딩을 기록했다
    const other = { ...loadMeta(openStorage().storage), endings: ['timeout'], plays: 2 };
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(other));
    await flush(1200);
    const after = loadMeta(openStorage().storage);
    expect(after.endings).toEqual(['timeout']);
    expect(after.plays).toBe(2);
  });
});

describe('저장 경계(화면) — 새로고침·깨진 저장·쓰기 실패', () => {
  const meta0 = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({ v: 1, plays: 0, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH, ...extra });

  it('판정 연출 도중 새로고침 → 엔딩 화면으로 복원(이어하기 카드 아님) · 플레이 1회 · 진행 저장 없음', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.meta, meta0());
    seedRun(setScreen(playPath(PATH), { name: 'hub', tab: 'house' }));
    await boot();
    click(q('.wt-accusebar-btn'));
    await flush();
    clickText('지목하러 간다');
    await flush();
    const acc = perfectAcc();
    click(q(`[data-testid=pick-${acc.culprit}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    for (const slot of ['means', 'opportunity', 'motive'] as const) {
      click(q(`[data-testid=slot-${slot}]`));
      await flush();
      await pickCard(acc[slot]);
    }
    click(q('[data-testid=slots-confirm]'));
    await flush();
    click(q('[data-testid=confirm-submit]'));
    await flush();
    expect(q('.wt-verdict')).toBeTruthy(); // 연출 중
    cleanup(); // 새로고침
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('[data-testid=title-resume]')).toBeNull();
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.perfect!.title);
    const m = loadMeta(openStorage().storage);
    expect(m.plays).toBe(1);
    expect(m.endings).toEqual(['perfect']);
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
    cleanup();
  });

  const BAD_RUNS: [string, string][] = [
    ['JSON 아님', '{"v":1,'],
    ['null', 'null'],
    ['배열', '[]'],
    ['문자열', '"run"'],
    ['필수 필드 없음', '{"v":1}'],
    ['행동 범위 밖', JSON.stringify({ ...newRun(), actions: 99 })],
    ['없는 증거 id', JSON.stringify({ ...newRun(), evidence: ['E99'] })],
    ['신뢰 음수', JSON.stringify({ ...newRun(), trust: -3 })],
  ];
  for (const [label, raw] of BAD_RUNS) {
    it(`깨진 저장(${label}) → 앱은 타이틀로 뜨고 안내 띠 · 도감 보존 · 새 수사 가능`, async () => {
      window.localStorage.clear();
      window.localStorage.setItem(STORAGE_KEYS.meta, meta0({ endings: ['timeout'], plays: 1 }));
      window.localStorage.setItem(STORAGE_KEYS.run, raw);
      render(<WitnessApp />);
      await flush();
      await flush();
      expect(q('.wt-title-screen')).toBeTruthy();
      expect(q('[data-testid=title-resume]')).toBeNull();
      expect(q('.wt-banner')?.textContent ?? '').toMatch(/기록을 읽지 못해|새 버전이라/);
      expect(q('[data-testid=title-collection]')?.textContent).toContain('1/8');
      click(q('[data-testid=title-new]'));
      await flush();
      expect(readRun()?.phase).toBe('play');
      cleanup();
    });
  }

  it('깨진 meta(JSON 아님) → 새 도감으로 뜨고 앱은 산다', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.meta, '{oops');
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-title-screen')).toBeTruthy();
    expect(q('[data-testid=title-collection]')?.textContent).toContain('0/8');
    cleanup();
  });

  it('플레이 중 쓰기 실패(용량 초과) → 게임은 메모리로 계속 · 설정 시트에 「저장을 막고 있어요」 띠', async () => {
    window.localStorage.clear();
    window.localStorage.setItem(STORAGE_KEYS.meta, meta0({ plays: 1 }));
    seedRun(setScreen(playPath(['L3']), { name: 'hub', tab: 'house' }));
    await boot();
    const proto = Object.getPrototypeOf(window.localStorage) as Storage;
    const orig = proto.setItem;
    proto.setItem = function (k: string, v: string) {
      if (k.startsWith('wt:') && k !== 'wt:probe') throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
    try {
      await tabHouseAndEnter('L1');
      // 게임은 메모리로 계속된다(행동 소비·조사 화면)
      expect(q('.wt-rail')).toBeTruthy();
      // (BUG-W06: 플레이 중 알림은 아직 없다 — 지금은 설정 시트·타이틀에서만 띠가 보인다)
      click(q('button[aria-label="나가기(허브로)"]'), '나가기');
      await settle();
      click(q('button[aria-label="설정 · 도움말"]'), '설정');
      await flush();
      expect(q('.wt-sheet .wt-banner')?.textContent).toContain('저장을 막고 있어요');
    } finally {
      proto.setItem = orig;
    }
    cleanup();
  });
});

async function tabHouseAndEnter(locId: string): Promise<void> {
  const b = qa('.wt-tabbar button').find((x) => (x.getAttribute('aria-label') ?? x.textContent ?? '').includes('집 안'));
  click(b ?? null, '집 안 탭');
  await flush();
  click(q(`[data-testid=room-${locId}]`), `방 ${locId}`);
  await flush();
  const yes = q('[data-testid=spend-yes]');
  if (yes) click(yes);
  await flush();
  await settle();
}
