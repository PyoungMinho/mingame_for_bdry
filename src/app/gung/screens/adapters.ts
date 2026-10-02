/**
 * 엔진(src/lib/gung) 해석 결과 → 컴포넌트 프레젠테이션 타입(§7 화면 규약) 변환.
 * 개인 화면에는 항상 "내 자리"만 들어온 ResolvedSheet/VisibleCard만 넘긴다 — 다른 자리 데이터는
 * 여기 어댑터가 아니라 모두의 패/진상 화면에서 getAllSheets로 따로 계산한다.
 */
import type { Assignment, GateTimeline, GungCase, PublicSeat, RailStep as EngineRailStep, ResolvedSheet, VisibleCard } from '@/lib/gung';
import type { GateTimelineView } from '../components/GateTimelineBar';
import type { MemoryContent, PlaceSummary, RailStep, RoleCardContent, SeatGridItem, SeatRingItem } from '../components/types';

const ROUND_WORD: Record<number, string> = { 1: '첫째', 2: '둘째', 3: '셋째' };

/** 잠금 블록 → 프레젠테이션. 잠긴 블록엔 본문이 애초에 없다(엔진이 안 내린다) — 안내 한 줄만 만든다. */
export function memoriesToContent(sheet: ResolvedSheet): MemoryContent[] {
  return sheet.memories.map((m) =>
    m.unlocked
      ? { title: m.heading, round: m.fromRound, lines: m.lines.slice() }
      : { title: m.heading, round: m.fromRound, lockedHint: `🔒 ${ROUND_WORD[m.fromRound] ?? `${m.fromRound}번째`} 조사가 시작되면 떠오르오` },
  );
}

/** 엔진 RailStep('done' 포함)을 헤더 레일 컴포넌트의 RailStep으로 — 'done'(진상·결과)이면 레일 자체를 숨긴다 */
export function toHeaderRail(step: EngineRailStep): RailStep | undefined {
  return step === 'done' ? undefined : step;
}

export function sheetToContent(sheet: ResolvedSheet, seat: number): RoleCardContent {
  // 역할 전용 용어(원고 1-6 「활맥 — 어의 비밀 카드 전용」)는 '비밀' 섹션 끝, 봉인 속에만 — 공용 「?」 시트에 올리면
  // 목록에 그 용어가 있는지로 역할이 드러난다(QA RISK-04 전수 점검)
  const roleTerms = sheet.terms.map((t) => `? ${t.term} — ${t.desc}`);
  // 묶음 사이 빈 줄 1개만(예전엔 '' 구분자 + '\n\n' 결합으로 빈 줄 3개 — 한 화면을 70px씩 낭비)
  // 「한눈에」 3줄은 붙여서, 비밀 항목은 문단으로, 용어는 붙여서
  const secretBody = [sheet.glance.join('\n'), sheet.secrets.join('\n\n'), roleTerms.join('\n')].filter(Boolean).join('\n\n');
  const lies = [
    ...sheet.canLie.map((t) => `둘러대도 되는 것 — ${t}`),
    ...sheet.mustTell.map((t) => `물으면 사실대로 — ${t}`),
    ...sheet.lieTips.map((t) => `추천 변명 — ${t}`),
  ];
  // §5-7 쪽 나눔 폐지 — 미션도 거짓말·말투처럼 항목 배열로 두고 ①②③ 번호 목록으로 그린다(한 문단으로 이어 붙이지 않음)
  const missionList = sheet.missions.map((m) => `${m.tag ? `${m.tag} ` : ''}${m.text} (+${m.points}점${m.onlyIfEscaped ? ' · 탈출 시만' : ''})`);
  return {
    seatLabel: `${seat}번 자리의 패`,
    roleName: sheet.name,
    icon: sheet.icon,
    identity: [sheet.identity.headline, sheet.identity.body].filter(Boolean).join('\n\n'),
    isCulprit: sheet.isCulprit,
    profile: sheet.profile,
    secret: secretBody,
    night: sheet.night.map((l) => ({ time: l.time ?? '', text: l.text })),
    lies,
    mission: missionList,
    speech: sheet.speech,
    round: sheet.round,
    memories: memoriesToContent(sheet),
  };
}

/**
 * 엔진 출입 타임라인 → 막대 컴포넌트 데이터. 같은 사람·같은 눈금의 여러 기록(어의 축시 초 出→入)은
 * 한 알약으로 묶어 겹치지 않게 한다(글자는 적힌 순서대로 '出入').
 */
export function gateToView(t: GateTimeline): GateTimelineView {
  const glyph = (d: 'in' | 'out') => (d === 'in' ? '入' : '出');
  const groups = new Map<string, typeof t.marks>();
  for (const m of t.marks) {
    const k = `${m.roleId}|${m.tick}`;
    groups.set(k, [...(groups.get(k) ?? []), m]);
  }
  const lineOf = (m: (typeof t.marks)[number]) => `${m.time} · ${m.who} ${glyph(m.dir)}${m.note ? `(${m.note})` : ''}`;
  const marks: GateTimelineView['marks'] = [...groups.entries()].map(([k, ms]) => {
    const sorted = ms.slice().sort((x, y) => x.pos - y.pos);
    const dirs = new Set(sorted.map((m) => m.dir));
    return {
      key: k,
      lane: sorted[0].roleId,
      x: sorted.reduce((sum, m) => sum + m.tick + m.pos, 0) / sorted.length,
      glyph: sorted.map((m) => glyph(m.dir)).join(''),
      dir: dirs.size > 1 ? 'both' : sorted[0].dir,
      label: sorted.map(lineOf).join(' / '),
    };
  });
  const readout = t.marks
    .slice()
    .sort((x, y) => x.round - y.round || x.seq - y.seq)
    .map(lineOf);
  return {
    title: t.title,
    watches: t.watches,
    parts: t.parts,
    lanes: t.lanes.map((l) => ({ key: l.roleId, label: l.label })),
    marks,
    spans: t.spans.map((sp, i) => ({ key: `${sp.roleId}-${i}`, lane: sp.roleId, from: sp.from, to: sp.to })),
    readout,
  };
}

export function cardToPlaceSummary(card: VisibleCard, c: GungCase): PlaceSummary {
  const place = c.places.find((p) => p.id === card.placeId);
  return { id: card.placeId ?? '', name: place?.name ?? '', sub: place?.sub, icon: place?.icon ?? 'pin' };
}

export function placeToSummary(c: GungCase, placeId: string): PlaceSummary {
  const place = c.places.find((p) => p.id === placeId);
  return { id: placeId, name: place?.name ?? placeId, sub: place?.sub, icon: place?.icon ?? 'pin' };
}

/** SeatRing(rollcall/progress/pick) — rolesVisible 이전엔 label 생략(자리 번호만) */
export function seatRingItems(
  n: number,
  opts: {
    mode: 'pick' | 'rollcall' | 'progress' | 'absent';
    selected?: number | null;
    rollCall?: number[];
    current?: number;
    done?: number[];
    absentSeats?: number[];
    labels?: (seat: number) => string | undefined;
  },
): SeatRingItem[] {
  const out: SeatRingItem[] = [];
  for (let seat = 1; seat <= n; seat++) {
    const label = opts.labels?.(seat);
    let state: SeatRingItem['state'] = 'default';
    if (opts.absentSeats?.includes(seat)) state = 'absent';
    else if (opts.mode === 'pick' && opts.selected === seat) state = 'selected';
    else if (opts.mode === 'rollcall' && opts.rollCall?.includes(seat)) state = 'checked';
    else if (opts.mode === 'progress') {
      if (opts.current === seat) state = 'current';
      else if (opts.done?.includes(seat)) state = 'done';
    }
    out.push({ seat, label, state });
  }
  return out;
}

export function publicSeatsToGridItems(seats: PublicSeat[], showRoles: boolean): SeatGridItem[] {
  return seats.map((s) => ({ seat: s.seat, roleName: showRoles ? s.shortName : undefined, icon: showRoles ? s.icon : undefined }));
}

export function seatsRange(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

export function hostSeatList(a: Assignment): number[] {
  return seatsRange(a.n);
}
