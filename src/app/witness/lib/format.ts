/**
 * 화면용 순수 도우미 — 이름·표기·되돌리기·엔딩 정규화. React 비의존(테스트 가능).
 * 사건 데이터는 항상 CASE 에서 읽는다. 범인 id 는 어디에도 쓰지 않는다(디자인 확정본 §0 스포일러 규칙).
 */
import {
  CASE,
  EVIDENCE_TOTAL,
  getEvidence,
  getHotspot,
  getLocation,
  getSet,
  titleOf,
  type AchievementId,
  type Break,
  type Dialogue,
  type EndingId,
  type Evidence,
  type Face,
  type Grade,
  type Id,
  type LastEnding,
  type Location,
  type MissedItem,
  type OpenedItem,
  type ProfileId,
  type RunCore,
  type RunResult,
  type RunState,
  type Speaker,
  type TestimonySet,
} from '@/lib/witness';

/** 화면에 verified 로그 태그를 달지 말지(디자인 D13). PM 이 원하면 true 로 */
export const SHOW_VERIFIED_TAG = false;

export const SUSPECT_IDS = ['S1', 'S2', 'S3', 'S4'] as const;

/** 지도 타일 배치(집 구조): [서재][손님방] / [거실][주방] / [옥상 정원][다용도실] — 장소 id 는 사건 데이터의 art 키로 찾는다 */
export function houseLayout(): (Location | null)[] {
  const byArt = (art: string) => CASE.locations.find((l) => l.art === art) ?? null;
  return [byArt('study'), byArt('guest'), byArt('living'), byArt('kitchen'), byArt('roof'), byArt('utility')];
}

export const placeName = (l: Location): string => l.name.split(' — ')[0];

export function nameOf(who: Speaker | ProfileId, label?: string): string {
  if (who === 'DEV') return label ?? '기기';
  if (who === 'VICTIM') return CASE.profiles.find((p) => p.id === 'VICTIM')?.name ?? '피해자';
  return CASE.names[who as Speaker] ?? '';
}

export const TUTORIAL_LOC: Location | undefined = CASE.locations.find((l) => l.tutorial);
export const TUTORIAL_SET: TestimonySet | undefined = CASE.sets.find((s) => s.kind === 'tutorial');

export function tutorialDone(run: RunCore): boolean {
  if (!TUTORIAL_SET) return true;
  const bs = TUTORIAL_SET.lines.flatMap((l) => l.breaks ?? []);
  return bs.every((b) => run.broken.includes(b.id));
}

// ─────────────────────────────── AI LED ───────────────────────────────

export type Led = 'standby' | 'process' | 'refuse' | 'correct';

/** Face → LED(디자인 types.ts 주석: normal=대기 · sweat=처리 중 · shock/break=정정 · angry=권한 거부) */
export function ledOf(face?: Face): Led {
  if (face === 'sweat') return 'process';
  if (face === 'angry') return 'refuse';
  if (face === 'shock' || face === 'break') return 'correct';
  return 'standby';
}

export const LED_LABEL: Record<Led, string> = { standby: '대기', process: '처리 중', refuse: '권한 거부', correct: '정정' };

// ─────────────────────────────── 시간·표기 ───────────────────────────────

export function evNo(id: Id): string {
  const m = /^E(\d+)/.exec(id);
  return m ? `No.${m[1]}` : id;
}

export function fmtPlayTime(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  return `${min}분`;
}

export function fmtSavedAt(at: number, now: number = Date.now()): string {
  const d = new Date(at);
  const n = new Date(now);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(n) - day(d)) / 86400000);
  if (diff <= 0) return `오늘 ${hm} 저장`;
  if (diff === 1) return `어제 ${hm} 저장`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm} 저장`;
}

/** 'HH:MM' → 시(hour) 라벨 */
export function hourOf(time: string): string {
  return `${time.slice(0, 2)}:00`;
}

/** 이어하기 카드 한 줄 요약 */
export function runSummary(run: RunCore, clockText: string, evidenceCount: number): string {
  return `${clockText} · 행동 ${run.actions} 남음 · 증거 ${evidenceCount}개 · 신뢰 ${run.trust}/5`;
}

// ─────────────────────────────── 증거 출처 ───────────────────────────────

export function sourceText(e: Evidence): string {
  const f = e.from;
  if (f === 'start') return '수사 시작 때부터';
  if ('location' in f) {
    const loc = getLocation(f.location);
    const h = getHotspot(f.hotspot)?.hotspot;
    return `${loc ? placeName(loc) : '현장'}${h ? ` · ${h.label}` : ''}`;
  }
  if ('press' in f) return '증언을 추궁해서';
  return '모순을 깨고 나서';
}

// ─────────────────────────────── 되돌리기(결과 카드 복원) ───────────────────────────────

/**
 * 돌파 직전 상태를 재구성한다. 새로고침 뒤 결과 카드를 다시 띄울 때 `diffOpened(before, after)` 용.
 * (엔진은 직전 상태를 저장하지 않으므로 그 돌파가 준 증거·플래그·비밀만 되돌린다)
 */
export function undoBreak(run: RunState, brk: Break): RunState {
  let evidence = [...run.evidence];
  let flags = [...run.flags];
  let secrets = [...run.secrets];
  for (const u of brk.unlocks) {
    if ('evidence' in u) evidence = evidence.filter((e) => e !== u.evidence);
    else if ('upgrade' in u) {
      const [from, to] = u.upgrade;
      evidence = evidence.map((e) => (e === to ? from : e));
    } else if ('flag' in u) flags = flags.filter((f) => f !== u.flag);
    else if ('secret' in u) secrets = secrets.filter((s) => s !== u.secret);
  }
  return { ...run, broken: run.broken.filter((b) => b !== brk.id), evidence, flags, secrets };
}

// ─────────────────────────────── 결과 카드 항목 문구 ───────────────────────────────

export type OpenedChip = { text: string; tone: 'free' | 'cost' | 'new' | 'none' };
export interface OpenedLine {
  key: string;
  icon: 'set' | 'confront' | 'location' | 'hotspot' | 'evidence' | 'upgrade' | 'secret';
  text: string;
  chip?: OpenedChip;
}

const costChip = (cost: 0 | 1): OpenedChip => (cost === 0 ? { text: '무료', tone: 'free' } : { text: '행동 1', tone: 'cost' });

export function openedLine(item: OpenedItem): OpenedLine {
  switch (item.kind) {
    case 'set': {
      const s = getSet(item.id);
      const title = s?.title ?? '';
      if (item.chain) return { key: `set:${item.id}`, icon: 'set', text: `새 증언 「${title}」`, chip: { text: '무료 · 바로 이어짐', tone: 'free' } };
      if (item.confront) return { key: `set:${item.id}`, icon: 'confront', text: `대질 「${title}」`, chip: { text: '무료', tone: 'free' } };
      return { key: `set:${item.id}`, icon: 'set', text: `새 증언 「${title}」`, chip: costChip(item.cost) };
    }
    case 'location': {
      const l = getLocation(item.id);
      return { key: `loc:${item.id}`, icon: 'location', text: `새 장소: ${l ? placeName(l) : ''}`, chip: costChip(item.cost) };
    }
    case 'hotspot': {
      const ref = getHotspot(item.id);
      const loc = ref ? placeName(ref.location) : '';
      return { key: `hs:${item.id}`, icon: 'hotspot', text: `${loc}에 새 단서`, chip: ref?.hotspot.precise ? { text: '정밀 +1', tone: 'cost' } : { text: 'NEW · 무료', tone: 'new' } };
    }
    case 'evidence':
      return { key: `ev:${item.id}`, icon: 'evidence', text: `증거 획득: ${getEvidence(item.id)?.name ?? ''}` };
    case 'upgrade':
      return { key: `up:${item.to}`, icon: 'upgrade', text: `증거 갱신: ${getEvidence(item.from)?.name ?? ''} → ${getEvidence(item.to)?.name ?? ''}` };
    default:
      return { key: `sec:${item.who}`, icon: 'secret', text: `비밀 도감: ${nameOf(item.who)} 한 줄 추가` };
  }
}

/** [바로 가기] 대상 우선순위: chain 세트 > 대질 > 새 세트 > 새 장소 > 새 단서(디자인 §5-11) */
export function gotoTarget(items: OpenedItem[]): OpenedItem | null {
  const sets = items.filter((i): i is Extract<OpenedItem, { kind: 'set' }> => i.kind === 'set');
  return (
    sets.find((s) => s.chain) ??
    sets.find((s) => s.confront) ??
    sets[0] ??
    items.find((i) => i.kind === 'location') ??
    items.find((i) => i.kind === 'hotspot') ??
    null
  );
}

// ─────────────────────────────── 엔딩 데이터 ───────────────────────────────

export interface EndingData {
  ending: EndingId;
  grade: Grade;
  title: string;
  stars: number;
  evidence: number;
  wrong: number;
  hints: number;
  actionsLeft: number;
  playMs: number;
  missed: MissedItem[];
  unbrokenStars: number;
  hiddenTeaser: boolean;
  achievements: AchievementId[];
  evidenceTotal: number;
}

export function endingFromResult(r: RunResult): EndingData {
  return {
    ending: r.ending,
    grade: r.grade,
    title: r.title,
    stars: r.stars,
    evidence: r.evidence,
    wrong: r.wrong,
    hints: r.hints,
    actionsLeft: r.actionsLeft,
    playMs: r.playMs,
    missed: r.missed,
    unbrokenStars: r.unbrokenStars,
    hiddenTeaser: r.hiddenTeaser,
    achievements: r.achievements,
    evidenceTotal: r.evidenceTotal,
  };
}

export function endingFromLast(le: LastEnding): EndingData {
  return {
    ending: le.ending,
    grade: le.grade,
    title: titleOf(le.ending, le.grade),
    stars: le.stars,
    evidence: le.evidence,
    wrong: le.wrong,
    hints: le.hints,
    actionsLeft: le.actionsLeft,
    playMs: le.playMs,
    missed: le.missed.map((id) => {
      const e = getEvidence(id);
      return { id, missHint: e?.missHint ?? '', ...(e?.upgradeOf ? { upgrade: true } : {}) };
    }),
    unbrokenStars: le.unbrokenStars,
    hiddenTeaser: le.hiddenTeaser,
    achievements: le.newAchievements,
    evidenceTotal: EVIDENCE_TOTAL,
  };
}

export const ACHIEVEMENT_INFO: Record<AchievementId, { name: string; how: string }> = {
  flawless: { name: '무결점', how: '틀린 제시 없이 완벽 해결' },
  lightning: { name: '번개 수사', how: '행동 3 이상 남기고 완벽 해결' },
  nohint: { name: '힌트 없이', how: '수첩 정리 없이 완벽 해결' },
  allclear: { name: '다 털었다', how: '결정적 모순과 비밀 4개를 모두 채움' },
  arrestSpeaker: { name: '스피커를 체포하려 함', how: '또박이를 범인으로 지목해 봄' },
  trustedMachine: { name: '기계를 너무 믿었다', how: '고쳐지기 전 기록을 증거로 냄' },
};

export const ACHIEVEMENT_ORDER: AchievementId[] = ['flawless', 'lightning', 'nohint', 'allclear', 'arrestSpeaker', 'trustedMachine'];

/** 대사 한 줄의 읽기용 전체 문장(스크린 리더) */
export function spokenText(d: Dialogue): string {
  const n = d.who === 'NARR' ? '' : nameOf(d.who, d.label);
  return n ? `${n}: ${d.text}` : d.text;
}

/** 상태 나열(aria-label 용) */
export function joinAria(parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(', ');
}
