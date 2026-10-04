'use client';

/**
 * 수첩(W40~W42, 디자인 §5-13) — 항상 무료. 허브 세 번째 탭과 조사·심문 중 풀스크린 시트에 같은 컴포넌트를 마운트한다.
 * 상단 4탭(증거·인물·타임라인·의문) sticky + 수첩 정리(힌트) 바. 의문 탭 아래에 「정리된 것」(깬 모순의 explain)과 「수첩 정리 메모」.
 *  - 타임라인은 기록(실선)과 주장(점선)을 나란히 둘 뿐 엇갈림을 자동으로 표시하지 않는다.
 *  - verified 로그에는 태그를 달지 않는다(블라인드 검증본과 같은 정보량).
 *  - 힌트는 수첩 안에만 있다: 비용 프롬프트(2탭) → 시트에 탐정 독백 → hintLog 보관(재열람 무료).
 */
import { Diamond, Lock, NotebookPen, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  EVIDENCE_TOTAL,
  RULES,
  getEvidence,
  holdings,
  hint,
  profiles,
  questions,
  summaries,
  timeline,
  type Dialogue,
  type HintTarget,
  type Id,
  type RunState,
} from '@/lib/witness';
import { COACH_TEXT, EMPTY } from '../lib/copy';
import { hourOf, nameOf } from '../lib/format';
import { useWt, type NotebookTab } from '../lib/context';
import { BottomSheet } from './BottomSheet';
import { DialogueBox } from './DialogueBox';
import { EvidenceDetailSheet } from './EvidenceSheet';
import { EvidenceCard, ProfileTile, ReliabilityTag, SORT_LABEL, sortEvidence, sortProfiles, KIND_ICON, type EvidenceSort } from './EvidenceCard';
import { SpendPrompt, useSpend } from './SpendPrompt';
import { useNav } from '../lib/useNav';

/** 수첩 탭 NEW 점 — 아직 못 본 증거·의문이 있는가 */
export function hasNotebookNews(run: RunState): boolean {
  const seen = new Set(run.seen ?? []);
  if (holdings(run).some((e) => !seen.has(e.id))) return true;
  return questions(run).some((q) => !seen.has(q.id));
}

const TAB_LABEL: Record<NotebookTab, string> = { evidence: '증거', people: '인물', timeline: '타임라인', questions: '의문' };

export interface NotebookProps {
  run: RunState;
  tab: NotebookTab;
  onTab: (t: NotebookTab) => void;
  onGoto: (t: HintTarget) => void;
  /** 타임라인 주장 항목 → 그 줄로 */
  onJumpLine?: (lineId: Id) => void;
  asSheet?: boolean;
}

export function Notebook({ run, tab, onTab, onGoto, onJumpLine, asSheet }: NotebookProps) {
  const { game, toast } = useWt();
  const [sort, setSort] = useState<EvidenceSort>('recent');
  const [detail, setDetail] = useState<Id | null>(null);
  const [hintOpen, setHintOpen] = useState<{ lines: Dialogue[]; target?: HintTarget; instant?: boolean } | null>(null);
  const release = useRef<(() => void) | null>(null);
  const spend = useSpend();
  const nav = useNav();
  const ev = useMemo(() => holdings(run), [run]);
  const qs = questions(run);
  const sums = summaries(run);
  const seenSet = new Set(run.seen ?? []);
  const hintsLeft = RULES.normal.hintsMax - run.hints;
  const canHint = run.phase === 'play' && hintsLeft > 0 && run.actions >= 1;

  // 탭에서 본 것을 '본 것'으로 표시(탭을 떠나거나 수첩을 닫을 때)
  const lastTab = useRef(tab);
  const runRef = useRef(run);
  runRef.current = run;
  const markTabSeen = (t: NotebookTab) => {
    const r = runRef.current;
    if (t === 'evidence') {
      const ids = holdings(r).map((e) => e.id);
      if (ids.some((id) => !(r.seen ?? []).includes(id))) game.seen(ids);
    } else if (t === 'questions') {
      const ids = ['tab:questions', ...questions(r).map((q) => q.id)];
      if (ids.some((id) => !(r.seen ?? []).includes(id))) game.seen(ids);
    }
  };
  useEffect(() => {
    if (lastTab.current !== tab) markTabSeen(lastTab.current);
    lastTab.current = tab;
    if (tab === 'questions' && !(runRef.current.seen ?? []).includes('tab:questions')) game.seen(['tab:questions']);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  useEffect(
    () => () => {
      markTabSeen(lastTab.current);
      release.current?.();
      release.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const startHint = () => {
    if (!canHint) return;
    const advice = !(run.seen ?? []).includes('tab:questions') && !game.meta.coach.includes('hintAdvice');
    spend.request({ kind: 'hint', label: '수첩 정리', hintsLeft });
    if (advice) game.markCoach('hintAdvice');
  };

  const confirmHint = () => {
    spend.cancel();
    const lock = game.holdRoute();
    const prevActions = game.getRun()?.actions ?? 12;
    const step = game.act((r) => hint(r));
    if (step.error) {
      lock();
      toast({ kind: 'warn', text: step.error === 'no-hints' ? '수첩 정리는 다 썼다' : '지금은 쓸 수 없다' });
      return;
    }
    release.current?.();
    release.current = lock;
    nav.feedback(step.events, prevActions);
    const h = step.events.find((e) => e.t === 'hint');
    if (h && h.t === 'hint') setHintOpen({ lines: h.lines, target: h.target });
  };

  const closeHint = () => {
    setHintOpen(null);
    release.current?.();
    release.current = null;
  };

  const obtained = sortEvidence(ev, sort);
  const slots = Math.max(0, EVIDENCE_TOTAL - ev.length);
  const pf = sortProfiles(profiles(run));
  const tl = timeline(run);
  const unresolved = qs.filter((q) => !q.resolved);
  const resolved = qs.filter((q) => q.resolved);
  const showAdvice = !(run.seen ?? []).includes('tab:questions') && !game.meta.coach.includes('hintAdvice');

  return (
    <div className={['wt-notebook', asSheet ? 'is-sheet' : ''].filter(Boolean).join(' ')}>
      <div className="wt-notebook-head">
        <div className="wt-spiral" aria-hidden />
        <h2 className="wt-display wt-notebook-title">
          <NotebookPen size={20} aria-hidden /> 수첩
        </h2>
      </div>
      <div className="wt-nbtabs" role="tablist" aria-label="수첩 항목">
        {(['evidence', 'people', 'timeline', 'questions'] as NotebookTab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="wt-nbtab" onClick={() => onTab(t)} data-testid={`nbtab-${t}`}>
            {TAB_LABEL[t]}
            {t === 'evidence' && <small> {ev.length}/{EVIDENCE_TOTAL}</small>}
            {t === 'people' && <small> {pf.length}</small>}
            {t === 'questions' && qs.some((q) => !seenSet.has(q.id)) && <i className="wt-dot" aria-label="새 의문" />}
          </button>
        ))}
      </div>

      <div className="wt-hintbar">
        <span className="wt-hintbar-t">
          <b>수첩 정리</b> — 막혔을 때 · 행동 1 · 남은 {hintsLeft}회
        </span>
        <button type="button" className="wt-btn wt-btn--secondary wt-btn--sm" onClick={startHint} disabled={!canHint} data-testid="hint-start">
          {hintsLeft <= 0 ? '다 썼다' : run.phase !== 'play' ? '사이렌 뒤' : '정리하기'}
        </button>
      </div>
      {spend.target && (
        <SpendPrompt run={run} target={spend.target} onConfirm={confirmHint} onCancel={spend.cancel} coach={showAdvice ? COACH_TEXT.hintAdvice : undefined} />
      )}

      <div className="wt-nbbody" role="tabpanel">
        {tab === 'evidence' && (
          <>
            <div className="wt-nbtools">
              <span>
                {ev.length}/{EVIDENCE_TOTAL}
              </span>
              <button type="button" className="wt-sortbtn" onClick={() => setSort((s) => (s === 'recent' ? 'time' : s === 'time' ? 'kind' : 'recent'))} aria-label={`정렬: ${SORT_LABEL[sort]}. 누르면 바뀌어요`}>
                정렬 {SORT_LABEL[sort]} ▾
              </button>
            </div>
            {ev.length === 0 && <p className="wt-empty">{EMPTY.evidence}</p>}
            <div className="wt-cardgrid">
              {obtained.map((e) => (
                <EvidenceCard key={e.id} evidence={e} size="S" isNew={!seenSet.has(e.id)} upgraded={!!e.upgradeOf} onClick={() => setDetail(e.id)} />
              ))}
              {Array.from({ length: slots }, (_, i) => (
                <div key={`s${i}`} className="wt-card wt-card--S wt-card--silhouette" aria-label="아직 얻지 못한 증거">
                  <span>?</span>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'people' && (
          <div className="wt-profilelist">
            {pf.map((p) => (
              <ProfileTile key={p.id} profile={p} detail />
            ))}
          </div>
        )}

        {tab === 'timeline' && (
          <>
            {tl.length === 0 && <p className="wt-empty">{EMPTY.timeline}</p>}
            <ol className="wt-timeline">
              {tl.map((it, i) => {
                const showHour = i === 0 || hourOf(tl[i - 1].time) !== hourOf(it.time);
                const e = it.kind === 'record' ? getEvidence(it.ref) : undefined;
                return (
                  <li key={`${it.kind}-${it.ref}`} className="wt-tl">
                    {showHour && <div className="wt-tl-hour">{hourOf(it.time)}</div>}
                    <button
                      type="button"
                      className="wt-tl-item"
                      data-kind={it.kind}
                      data-spk={it.who}
                      onClick={() => (it.kind === 'record' ? setDetail(it.ref) : onJumpLine?.(it.ref))}
                      disabled={it.kind === 'claim' && !onJumpLine}
                    >
                      <span className="wt-tl-time">{it.time}</span>
                      <span className="wt-tl-dot" aria-hidden />
                      <span className="wt-tl-main">
                        <span className="wt-tl-k">
                          {it.kind === 'record' ? (e ? <>기록 {KIND_ICON[e.kind](12)}</> : '기록') : `주장 · ${nameOf(it.who ?? 'ME')}`}
                        </span>
                        <span className="wt-tl-t">{it.kind === 'record' ? it.text : `“${it.text}”`}</span>
                        {e && <ReliabilityTag evidence={e} />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </>
        )}

        {tab === 'questions' && (
          <div className="wt-questions">
            {qs.length === 0 && <p className="wt-empty">{EMPTY.questions}</p>}
            {qs.length > 0 && (
              <p className="wt-q-count">
                {resolved.length}/{qs.length} 해결
              </p>
            )}
            {unresolved.length > 0 && <h3 className="wt-q-h">풀리지 않은 의문</h3>}
            {unresolved.map((q) => (
              <p key={q.id} className="wt-q wt-read">
                <span aria-hidden className="wt-q-mark">?</span> {q.text}
              </p>
            ))}
            {resolved.length > 0 && <h3 className="wt-q-h">풀린 의문</h3>}
            {resolved.map((q) => (
              <div key={q.id} className="wt-q wt-read is-resolved">
                <p className="wt-q-row">
                  <s>{q.text}</s> <span className="wt-q-ok">✓ 풀림</span>
                </p>
                {q.answer && <p className="wt-q-ans">→ {q.answer}</p>}
              </div>
            ))}
            <h3 className="wt-q-h wt-q-h--sec">정리된 것</h3>
            {sums.length === 0 && <p className="wt-empty">{EMPTY.summary}</p>}
            {sums.map((s) => (
              <p key={s.breakId} className="wt-q wt-read wt-sum" data-tier={s.tier}>
                {s.tier === 'star' ? <Star size={14} aria-label="결정적" /> : <Diamond size={14} aria-label="해소" />} {s.explain}
              </p>
            ))}
            <h3 className="wt-q-h wt-q-h--sec">수첩 정리 메모</h3>
            {(run.hintLog ?? []).length === 0 && <p className="wt-empty">{EMPTY.hintMemo}</p>}
            {(run.hintLog ?? []).map((h, i) => (
              <div key={i} className="wt-memo wt-read">
                <p>
                  <b>정리 {i + 1}</b>
                </p>
                {h.text.map((t) => (
                  <p key={t}>{t}</p>
                ))}
                {h.target && (
                  <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => onGoto(h.target!)}>
                    {h.target.kind === 'set' ? '그 증언으로' : h.target.kind === 'location' ? '그 장소로' : '최종 지목으로'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <EvidenceDetailSheet open={detail !== null} id={detail} run={run} onClose={() => setDetail(null)} />
      <HintSheet open={!!hintOpen} lines={hintOpen?.lines ?? []} target={hintOpen?.target} onClose={closeHint} onGoto={(t) => { closeHint(); onGoto(t); }} />
    </div>
  );
}

function HintSheet({ open, lines, target, onClose, onGoto }: { open: boolean; lines: Dialogue[]; target?: HintTarget; onClose: () => void; onGoto: (t: HintTarget) => void }) {
  const [done, setDone] = useState(false);
  const key = lines.map((l) => l.text).join('|');
  useEffect(() => setDone(false), [open, key]);
  const label = target?.kind === 'set' ? '그 증언으로' : target?.kind === 'location' ? '그 장소로' : target?.kind === 'accuse' ? '최종 지목으로' : null;
  return (
    <BottomSheet
      open={open}
      title="수첩 정리"
      onClose={onClose}
      height="confirm"
      className="wt-sheet--hint"
      footer={
        <div className="wt-actions">
          <button type="button" className="wt-btn wt-btn--secondary" onClick={onClose} data-autofocus={done ? '' : undefined} data-testid="hint-close">
            닫기
          </button>
          {label && target && (
            <button type="button" className="wt-btn wt-btn--primary" onClick={() => onGoto(target)} disabled={!done} data-testid="hint-goto">
              {label}
            </button>
          )}
        </div>
      }
    >
      <div className="wt-hintsheet">
        <p className="wt-hint-lock">
          <Lock size={14} aria-hidden /> 정답은 말하지 않아요. 어디를 짚을지만 정리했어요.
        </p>
        {open && <DialogueBox lines={lines} playKey={`hint:${key}`} onDone={() => setDone(true)} quiet />}
      </div>
    </BottomSheet>
  );
}

