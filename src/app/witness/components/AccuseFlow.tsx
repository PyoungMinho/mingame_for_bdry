'use client';

/**
 * 최종 지목(W50~W53, 디자인 §5-14) — 범인 선택 · 수단/기회/동기 3칸 · 경고 · 확인 · 판정 연출.
 *  - 용의자 2×2 아래에 전체 폭 「또박이 · 증인」 행(D24). 또박이를 고르면 이스터에그(페널티 없음).
 *  - 같은 카드가 다른 칸에 있으면 옮긴다(D25). 빈 칸 오류는 텍스트 + 아이콘 + 칸 강조(색 단독 금지).
 *  - 판정 연출은 탭으로 진행한다(D26): 호명 → 칸마다 쾅 1000ms + 판정 대사 → 요약. 2회차부터 [전부 건너뛰기].
 *  - 범인이 틀리면 칸 판정 없이 호명 직후 오인 체포 엔딩으로 이어진다.
 */
import { Check, CircleAlert, DoorOpen, Flame, Hammer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CASE, getEvidence, verdictScript, type AccuseDraft, type Accusation, type Dialogue, type Slot, type SuspectId } from '@/lib/witness';
import { fxMs, T, VIB } from '../lib/fx';
import { nameOf, SUSPECT_IDS } from '../lib/format';
import { useWt } from '../lib/context';
import { GlassCrack } from '../art/fx';
import { ArtSlot } from './ArtSlot';
import { BottomSheet } from './BottomSheet';
import { DialogueBox } from './DialogueBox';
import { EvidenceCard, EvidenceRow } from './EvidenceCard';

const SLOT_META: Record<Slot, { name: string; ask: string; icon: React.ReactNode; call: string }> = {
  means: { name: '수단', ask: '무엇으로?', icon: <Hammer size={18} aria-hidden />, call: '수단!' },
  opportunity: { name: '기회', ask: '언제, 어떻게?', icon: <DoorOpen size={18} aria-hidden />, call: '기회!' },
  motive: { name: '동기', ask: '왜?', icon: <Flame size={18} aria-hidden />, call: '동기!' },
};
export const SLOT_ORDER: Slot[] = ['means', 'opportunity', 'motive'];
export const slotName = (s: Slot): string => SLOT_META[s].name;

const jobOf = (id: SuspectId): string => (CASE.profiles.find((p) => p.id === id)?.summary[0] ?? '').split('.')[0];

export function SuspectPick({ picked, onPick, onSubmit, forced }: { picked: SuspectId | 'AI' | null; onPick: (id: SuspectId | 'AI') => void; onSubmit: () => void; forced: boolean }) {
  return (
    <div className="wt-pick">
      <h2 className="wt-display wt-pick-h">범인은 누구인가?</h2>
      {forced && <p className="wt-pick-forced">시간이 다 됐다. 지금 가진 걸로 지목한다.</p>}
      {/* 라디오 5개(용의자 4 + 증인 또박이)가 한 그룹이다. 이름은 사람 이름만, 직업·역할은 설명으로 둔다(그림·이름표가 겹쳐 이름이 길어지지 않게) */}
      <div className="wt-pick-radios" role="radiogroup" aria-label="범인 후보">
        <div className="wt-pick-grid">
          {SUSPECT_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={picked === id} aria-label={nameOf(id)} aria-describedby={`wt-pick-job-${id}`} className="wt-pickcard" data-picked={picked === id ? '1' : undefined} data-dim={picked && picked !== id ? '1' : undefined} onClick={() => onPick(id)} data-testid={`pick-${id}`}>
              <span className="wt-pickcard-art" aria-hidden>
                <ArtSlot kind="portrait" who={id} title={nameOf(id)} decorative />
              </span>
              <span className="wt-nametag" data-spk={id} aria-hidden>
                <i className="wt-nametag-led" />
                <span>{nameOf(id)}</span>
              </span>
              <span id={`wt-pick-job-${id}`} className="wt-pickcard-job">
                {jobOf(id)}
              </span>
            </button>
          ))}
        </div>
        <button type="button" role="radio" aria-checked={picked === 'AI'} aria-label="또박이" aria-describedby="wt-pick-job-AI" className="wt-pickai" data-picked={picked === 'AI' ? '1' : undefined} onClick={() => onPick('AI')} data-testid="pick-AI">
          <span className="wt-pickai-art" aria-hidden>
            <ArtSlot kind="portrait" who="AI" crop="head" title="또박이" decorative />
          </span>
          <b aria-hidden>또박이</b>
          <span id="wt-pick-job-AI" className="wt-pickai-tag">
            증인
          </span>
        </button>
      </div>
      <div className="wt-pick-foot">
        <button type="button" className="wt-btn wt-btn--primary wt-btn--full" disabled={!picked} aria-disabled={!picked} onClick={onSubmit} data-testid="pick-submit">
          {picked ? '이 사람으로' : '범인을 고르세요'}
        </button>
      </div>
    </div>
  );
}

export function SlotBoard({ draft, error, onSlot, onClear, onChangeCulprit, onConfirm }: { draft: AccuseDraft; error: boolean; onSlot: (s: Slot) => void; onClear: (s: Slot) => void; onChangeCulprit: () => void; onConfirm: () => void }) {
  const filled = SLOT_ORDER.filter((s) => !!draft[s]).length;
  return (
    <div className="wt-slotboard">
      <p className="wt-sb-culprit">
        <span>범인: <b>{draft.culprit ? nameOf(draft.culprit) : ''}</b></span>
        <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={onChangeCulprit}>
          변경
        </button>
      </p>
      {SLOT_ORDER.map((s) => {
        const id = draft[s];
        const e = id ? getEvidence(id) : undefined;
        const missing = error && !id;
        return (
          <div key={s} className="wt-sbslot" data-filled={e ? '1' : undefined} data-error={missing ? '1' : undefined}>
            <button type="button" className="wt-sbslot-main" onClick={() => onSlot(s)} aria-label={`${SLOT_META[s].name} 칸, ${SLOT_META[s].ask}${e ? `, 지금 ${e.name}, 누르면 바꿔요` : ', 비어 있음, 증거를 고르세요'}`} data-testid={`slot-${s}`}>
              <span className="wt-sbslot-head">
                {SLOT_META[s].icon}
                <b>{SLOT_META[s].name}</b>
                <small>{SLOT_META[s].ask}</small>
              </span>
              {e ? <EvidenceRow evidence={e} /> : <span className="wt-sbslot-empty">+ 증거를 고른다</span>}
            </button>
            {e && (
              <button type="button" className="wt-iconbtn wt-sbslot-x" onClick={() => onClear(s)} aria-label={`${SLOT_META[s].name} 칸 비우기`}>
                <X size={16} aria-hidden />
              </button>
            )}
          </div>
        );
      })}
      {error && (
        <p className="wt-sb-error" role="alert">
          <CircleAlert size={16} aria-hidden /> 한 칸이 비었다
        </p>
      )}
      <div className="wt-pick-foot">
        <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onConfirm} aria-disabled={filled < 3} data-disabled={filled < 3 ? '1' : undefined} data-testid="slots-confirm">
          확인으로
        </button>
      </div>
    </div>
  );
}

export function WarnModal({ open, lines, onKeep, onGo }: { open: boolean; lines: Dialogue[]; onKeep: () => void; onGo: () => void }) {
  return (
    <BottomSheet open={open} title="한결의 한마디" onClose={onKeep} variant="modal" hideTitle noClose className="wt-sheet--warn">
      <div className="wt-warn">
        <span className="wt-warn-art">
          <ArtSlot kind="portrait" who="COP" face="sweat" crop="head" title="한결" />
        </span>
        <div className="wt-warn-lines">
          {lines.map((l) => (
            <p key={l.text}>{l.text}</p>
          ))}
        </div>
      </div>
      <div className="wt-actions wt-actions--opposed">
        <button type="button" className="wt-btn wt-btn--secondary" onClick={onGo} data-testid="warn-go">
          넘긴다
        </button>
        <button type="button" className="wt-btn wt-btn--primary" onClick={onKeep} data-autofocus="" data-testid="warn-keep">
          수사 계속
        </button>
      </div>
    </BottomSheet>
  );
}

export function ConfirmModal({ open, draft, onBack, onSubmit }: { open: boolean; draft: AccuseDraft; onBack: () => void; onSubmit: () => void }) {
  return (
    <BottomSheet open={open} title="이대로 강력팀에 넘긴다?" onClose={onBack} variant="modal" className="wt-sheet--confirm">
      <dl className="wt-confirm-sum">
        <div>
          <dt>범인</dt>
          <dd>{draft.culprit ? nameOf(draft.culprit) : ''}</dd>
        </div>
        {SLOT_ORDER.map((s) => (
          <div key={s}>
            <dt>{SLOT_META[s].name}</dt>
            <dd>{draft[s] ? getEvidence(draft[s]!)?.name : ''}</dd>
          </div>
        ))}
      </dl>
      <p className="wt-confirm-warn">제출하면 고칠 수 없다.</p>
      <div className="wt-actions wt-actions--opposed">
        <button type="button" className="wt-btn wt-btn--secondary" onClick={onBack} data-autofocus="" data-testid="confirm-back">
          돌아가서 고친다
        </button>
        <button type="button" className="wt-btn wt-btn--primary" onClick={onSubmit} data-testid="confirm-submit">
          이대로 넘긴다
        </button>
      </div>
    </BottomSheet>
  );
}

type VStage = { k: 'black' } | { k: 'call' } | { k: 'slam'; i: number } | { k: 'lines'; i: number } | { k: 'summary' };

/**
 * 최종 판정 연출. onFinish = 엔딩으로.
 * canSkip 은 제출 **전** 플레이 횟수로 정한다 — 제출하는 순간 엔진이 엔딩을 확정해 meta.plays 가 오르므로,
 * 여기서 meta 를 다시 읽으면 1회차에도 [전부 건너뛰기]가 보인다(디자인 D26: 2회차부터).
 */
export function VerdictStage({ acc, onFinish, canSkip: canSkipProp }: { acc: Accusation; onFinish: () => void; canSkip?: boolean }) {
  const { game, fx, vib } = useWt();
  const play = fx !== 'reduced' && !game.reducedMotion;
  const script = useMemo(() => verdictScript(acc), [acc]);
  const [stage, setStage] = useState<VStage>({ k: 'black' });
  const [okCount, setOkCount] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const canSkip = canSkipProp ?? game.meta.plays >= 1;

  useEffect(() => {
    if (stage.k === 'black') {
      const t = setTimeout(() => setStage({ k: 'call' }), fxMs(T.verdictBlack, fx));
      return () => clearTimeout(t);
    }
    if (stage.k === 'slam') {
      const step = script.steps[stage.i];
      const t = setTimeout(() => {
        setResults((r) => [...r, step.ok]);
        if (step.ok) setOkCount((n) => n + 1);
        vib(step.ok ? VIB.verdictOk : VIB.verdictNg);
        setStage({ k: 'lines', i: stage.i });
      }, fxMs(T.verdictSlot, fx));
      return () => clearTimeout(t);
    }
  }, [stage, script, fx, vib]);

  const faceFor = (n: number) => (n <= 0 ? 'normal' : n === 1 ? 'sweat' : n === 2 ? 'shock' : 'break');
  const cur = stage.k === 'slam' || stage.k === 'lines' ? script.steps[stage.i] : null;
  const curCard = cur ? getEvidence(cur.card) : undefined;
  const face = faceFor(okCount);
  const smirk = stage.k === 'lines' && cur && !cur.ok;

  const skipAll = () => {
    finishRef.current();
  };

  return (
    <div className="wt-verdict" data-stage={stage.k}>
      <div className="wt-verdict-stage">
        <div className="wt-verdict-portrait" data-smirk={smirk ? '1' : undefined} data-face={face}>
          {/* 안 통한 칸 = 비웃음 오버레이(§6-2 G). 그림의 smirk 는 평소·분노 표정에만 얹히므로, 무너지던 표정(sweat·shock)이어도 그 칸 동안은 'smirk' 로 바꿔 보여 준다 */}
          <ArtSlot kind="portrait" who={acc.culprit} face={smirk ? 'smirk' : face} smirk={!!smirk} title={nameOf(acc.culprit)} />
        </div>
        {stage.k === 'lines' && cur && (
          <div className="wt-verdict-hit" key={`hit-${stage.i}`} aria-hidden>
            {/* §6-2 G: 맞으면 흰 번쩍 1회(칸 간격 1000ms → 초당 1회 이하), 틀리면 레드 균열 */}
            {cur.ok ? <div className="wt-flash" /> : <GlassCrack cx={50} cy={70} tone="red" rays={9} seed={11 + stage.i * 7} play={play} />}
          </div>
        )}
        {cur && curCard && (
          <div className="wt-verdict-card" data-ok={stage.k === 'lines' ? (cur.ok ? '1' : '0') : undefined} data-slam={stage.k === 'slam' ? '1' : undefined}>
            <p className="wt-verdict-slotname wt-display">{SLOT_META[cur.slot].call}</p>
            <EvidenceCard evidence={curCard} size="L" />
            {stage.k === 'lines' && (
              <p className="wt-verdict-mark" data-ok={cur.ok ? '1' : '0'}>
                {cur.ok ? <Check size={20} aria-hidden /> : <X size={20} aria-hidden />} {cur.ok ? '통했다' : '안 통했다'}
              </p>
            )}
          </div>
        )}
        {stage.k === 'summary' && (
          <ul className="wt-verdict-sum" aria-label="판정 요약">
            {SLOT_ORDER.map((s, i) => (
              <li key={s} data-ok={results[i] ? '1' : '0'}>
                {results[i] ? <Check size={18} aria-hidden /> : <X size={18} aria-hidden />}
                <b>{SLOT_META[s].name}</b>
                <span>{results[i] ? '통했다' : '안 통했다'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="wt-verdict-panel">
        {canSkip && stage.k !== 'summary' && (
          <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm wt-verdict-skip" onClick={skipAll} data-testid="verdict-skip">
            전부 건너뛰기
          </button>
        )}
        {stage.k === 'call' && (
          <DialogueBox
            lines={[script.call]}
            playKey="verdict-call"
            onDone={() => (script.wrongArrest ? finishRef.current() : setStage({ k: 'slam', i: 0 }))}
          />
        )}
        {stage.k === 'lines' && cur && (
          <DialogueBox
            lines={cur.lines}
            playKey={`verdict-${stage.i}`}
            onDone={() => (stage.i >= script.steps.length - 1 ? setStage({ k: 'summary' }) : setStage({ k: 'slam', i: stage.i + 1 }))}
          />
        )}
        {stage.k === 'summary' && (
          <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={() => finishRef.current()} data-autofocus data-testid="verdict-finish">
            결과 보기 ▸
          </button>
        )}
      </div>
    </div>
  );
}
