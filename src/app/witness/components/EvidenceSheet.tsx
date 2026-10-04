'use client';

/**
 * 증거 고르기 시트(디자인 §5-10) — 78dvh. 상단 대상 줄 고정, 탭(증거·인물) + 정렬, 3열 카드 격자, 푸터(선택 요약 + 슬롯 A·B + 버튼).
 *  - present 모드: 카드 탭 → 슬롯 A. B 는 [하나 더 겹치기]/슬롯 B 탭으로 무장한 뒤의 다음 탭. 둘 다 찼을 때 새 카드는 B 교체(D17).
 *  - slot 모드(최종 지목): 헤더 「{칸}에 낼 증거」, 인물 탭 비활성, 한 장 탭하면 바로 칸에 들어간다. 다른 칸 카드는 옮긴다(D25).
 *  - 관련도 정렬·강조는 하지 않는다(정답을 알려 준다). 기본 정렬은 최근 획득순.
 *  - 제시 버튼은 첫 탭 직후 비활성(중복 제출 방지). 직전(반쯤 맞음) 선택은 UI 상태로 유지하고 슬롯 B 를 1회 깜빡인다.
 */
import { ArrowUpDown, Info, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getEvidence, holdings, profiles, type CardId, type Id, type RunCore } from '@/lib/witness';
import { sourceText } from '../lib/format';
import { useWt } from '../lib/context';
import { ArtSlot } from './ArtSlot';
import { BottomSheet } from './BottomSheet';
import { EvidenceCard, KIND_ICON, KIND_LABEL, ProfileTile, ReliabilityTag, SORT_LABEL, sortEvidence, sortProfiles, type EvidenceSort } from './EvidenceCard';
import { evNo } from '../lib/format';

const TIP_IDS = ['sheetTip1', 'sheetTip2', 'sheetTip3'];

export interface EvidenceSheetProps {
  open: boolean;
  mode: 'present' | 'slot';
  run: RunCore;
  /** present: 대상 줄 */
  target?: { index: number; total: number; text: string };
  /** slot: 칸 이름(수단·기회·동기) */
  slotName?: string;
  /** slot: 이미 다른 칸에 들어간 카드 id → 칸 이름 */
  usedIn?: Record<Id, string>;
  /** present: 처음 선택(직전 반쯤 맞음) */
  initial?: CardId[];
  onClose: () => void;
  onSubmit?: (cards: CardId[]) => void;
  onPick?: (id: Id) => void;
}

export function EvidenceSheet({ open, mode, run, target, slotName, usedIn, initial, onClose, onSubmit, onPick }: EvidenceSheetProps) {
  const { game } = useWt();
  const [tab, setTab] = useState<'evidence' | 'people'>('evidence');
  const [sort, setSort] = useState<EvidenceSort>('recent');
  const [sel, setSel] = useState<CardId[]>([]);
  const [armed, setArmed] = useState(false);
  const [flashB, setFlashB] = useState(false);
  const [focusCard, setFocusCard] = useState<CardId | null>(null);
  const [detail, setDetail] = useState<CardId | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [tip, setTip] = useState(false);

  // 열릴 때마다 초기화(직전 선택은 initial 로)
  useEffect(() => {
    if (!open) return;
    setTab('evidence');
    setSel(initial && initial.length ? [...initial] : []);
    setArmed(false);
    setFocusCard(initial && initial.length ? initial[initial.length - 1] : null);
    setDetail(null);
    setSubmitted(false);
    if (initial && initial.length === 1) {
      setFlashB(true);
      const t = setTimeout(() => setFlashB(false), 900);
      return () => clearTimeout(t);
    }
    // 처음 3번 열 때 하단 안내
    if (mode === 'present') {
      const seenN = TIP_IDS.filter((id) => game.meta.coach.includes(id)).length;
      if (seenN < 3) {
        setTip(true);
        game.markCoach(TIP_IDS[seenN]);
      } else setTip(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ev = useMemo(() => sortEvidence(holdings(run), sort), [run, sort]);
  const pf = useMemo(() => sortProfiles(profiles(run)), [run]);
  const pickedNames = sel.map((id) => getEvidence(id)?.name ?? pf.find((p) => p.id === id)?.name ?? id);

  const tapCard = (id: CardId) => {
    setFocusCard(id);
    if (mode === 'slot') {
      onPick?.(id);
      return;
    }
    if (sel.includes(id)) {
      setSel((cur) => cur.filter((x) => x !== id));
      setArmed(false);
      return;
    }
    if (sel.length === 0) setSel([id]);
    else if (armed && sel.length === 1) {
      setSel([sel[0], id]);
      setArmed(false);
    } else if (sel.length === 1) setSel([id]);
    else {
      setSel([sel[0], id]);
      setFlashB(true);
      setTimeout(() => setFlashB(false), 700);
    }
  };

  const submit = () => {
    if (submitted || sel.length === 0) return;
    setSubmitted(true);
    onSubmit?.(sel);
  };

  const focusEv = focusCard ? getEvidence(focusCard) : undefined;
  const focusPf = focusCard ? pf.find((p) => p.id === focusCard) : undefined;
  const summaryText = focusEv ? `${focusEv.name} — ${focusEv.summary}` : focusPf ? `${focusPf.name} — ${focusPf.summary[0]}` : '';
  const title = mode === 'slot' ? `${slotName ?? ''} 칸에 낼 증거` : '무엇을 내밀까?';

  const slotCard = (i: 0 | 1) => {
    const id = sel[i];
    const e = id ? getEvidence(id) : undefined;
    const name = e?.name ?? pf.find((p) => p.id === id)?.name;
    const label = i === 0 ? 'A' : 'B';
    if (!id) {
      const canArm = i === 1 && sel.length === 1;
      return (
        <button type="button" className={['wt-slot', 'is-empty', flashB && i === 1 ? 'is-flash' : '', armed && i === 1 ? 'is-armed' : ''].filter(Boolean).join(' ')} onClick={() => canArm && setArmed(true)} aria-label={`슬롯 ${label}, 비어 있음${canArm ? ', 누르면 한 장 더 고를 수 있어요' : ''}`} disabled={!canArm}>
          <span className="wt-slot-l">{label}</span>
          <span>{i === 1 ? '+ 비어 있음' : '카드를 고르세요'}</span>
        </button>
      );
    }
    return (
      <span className={['wt-slot', flashB && i === 1 ? 'is-flash' : ''].filter(Boolean).join(' ')}>
        <span className="wt-slot-l">{label}</span>
        <span className="wt-slot-name">{name}</span>
        <button
          type="button"
          className="wt-slot-x"
          aria-label={`${name} 빼기`}
          onClick={() => {
            setSel((cur) => cur.filter((x) => x !== id));
            setArmed(false);
          }}
        >
          <X size={14} aria-hidden />
        </button>
      </span>
    );
  };

  return (
    <>
      <BottomSheet
        open={open}
        title={title}
        onClose={onClose}
        height="evidence"
        footer={
          mode === 'present' ? (
            <div className="wt-evfooter">
              {focusCard && summaryText && (
                <p className="wt-evsummary">
                  <span>선택: {summaryText}</span>
                  <button type="button" className="wt-iconbtn wt-iconbtn--sm" aria-label="자세히 보기" onClick={() => setDetail(focusCard)}>
                    <Info size={16} aria-hidden />
                  </button>
                </p>
              )}
              <div className="wt-slots">
                {slotCard(0)}
                {slotCard(1)}
              </div>
              {tip && sel.length < 2 && <p className="wt-evtip">두 장을 겹쳐 낼 수도 있다. 하나 고르면 [하나 더 겹치기]가 켜져요.</p>}
              <div className="wt-actions">
                {sel.length === 2 ? (
                  <>
                    <button type="button" className="wt-btn wt-btn--secondary" onClick={onClose}>
                      닫기
                    </button>
                    <button type="button" className="wt-btn wt-btn--primary" onClick={submit} disabled={submitted}>
                      함께 제시
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="wt-btn wt-btn--secondary" onClick={() => setArmed(true)} disabled={sel.length !== 1} aria-label="하나 더 겹치기">
                      <Plus size={16} aria-hidden /> 하나 더 겹치기
                    </button>
                    <button type="button" className="wt-btn wt-btn--primary" onClick={submit} disabled={sel.length !== 1 || submitted} aria-disabled={sel.length !== 1 || submitted}>
                      {sel.length === 0 ? '카드를 고르세요' : '이걸로!'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : undefined
        }
      >
        {mode === 'present' && target && (
          <p className="wt-evtarget">
            <span className="wt-evtarget-k">이 줄에 낸다 ▸ {target.index + 1}/{target.total}</span>
            <span className="wt-evtarget-t">「{target.text}」</span>
          </p>
        )}
        <div className="wt-evtabs">
          <div role="tablist" aria-label="카드 종류" className="wt-seg">
            <button type="button" role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>
              증거 {ev.length}
            </button>
            <button type="button" role="tab" aria-selected={tab === 'people'} onClick={() => mode === 'present' && setTab('people')} disabled={mode === 'slot'} aria-disabled={mode === 'slot'}>
              인물 {pf.length}
            </button>
          </div>
          {tab === 'evidence' && (
            <button
              type="button"
              className="wt-sortbtn"
              onClick={() => setSort((s) => (s === 'recent' ? 'time' : s === 'time' ? 'kind' : 'recent'))}
              aria-label={`정렬: ${SORT_LABEL[sort]}. 누르면 바뀌어요`}
            >
              <ArrowUpDown size={14} aria-hidden /> {SORT_LABEL[sort]}
            </button>
          )}
        </div>
        {mode === 'slot' && <p className="wt-evnote">인물 프로필은 칸에 넣을 수 없다.</p>}
        <div className="wt-cardgrid" role={mode === 'present' ? 'group' : undefined} aria-label={mode === 'present' ? '내밀 카드 (최대 2장)' : '증거 목록'}>
          {tab === 'evidence'
            ? ev.map((e) => {
                const i = sel.indexOf(e.id);
                const used = mode === 'slot' ? usedIn?.[e.id] : undefined;
                return (
                  <EvidenceCard
                    key={e.id}
                    evidence={e}
                    size="S"
                    asCheckbox={mode === 'present'}
                    selected={mode === 'present' ? i >= 0 : undefined}
                    slot={i >= 0 ? (i === 0 ? 'A' : 'B') : undefined}
                    badge={used ? `${used} 칸에 있음` : undefined}
                    onClick={() => tapCard(e.id)}
                    onInfo={() => setDetail(e.id)}
                    onLongPress={() => setDetail(e.id)}
                  />
                );
              })
            : pf.map((p) => {
                const i = sel.indexOf(p.id);
                return <ProfileTile key={p.id} profile={p} asCheckbox selected={i >= 0} slot={i >= 0 ? (i === 0 ? 'A' : 'B') : undefined} onClick={() => tapCard(p.id)} />;
              })}
          {tab === 'evidence' && ev.length === 0 && <p className="wt-empty">아직 수첩이 비었다. 현장부터 보자.</p>}
        </div>
      </BottomSheet>
      <EvidenceDetailSheet open={open && detail !== null} id={detail} run={run} onClose={() => setDetail(null)} />
    </>
  );
}

/** 증거·인물 상세(W41, 읽기 전용) — L 카드 + 상세 + 출처 + 시각 + 태그. 갱신본은 「갱신 전 보기」 */
export function EvidenceDetailSheet({ open, id, run, onClose }: { open: boolean; id: CardId | null; run: RunCore; onClose: () => void }) {
  const [before, setBefore] = useState(false);
  useEffect(() => setBefore(false), [id]);
  const e = id ? getEvidence(id) : undefined;
  const p = id && !e ? profiles(run).find((x) => x.id === id) : undefined;
  const shown = before && e?.upgradeOf ? getEvidence(e.upgradeOf) : e;
  return (
    <BottomSheet open={open && (!!e || !!p)} title={shown?.name ?? p?.name ?? '상세'} onClose={onClose} height="tall">
      {shown && (
        <div className="wt-detail">
          <EvidenceCard evidence={shown} size="L" />
          <div className="wt-detail-body">
            <p className="wt-detail-kind">
              {KIND_ICON[shown.kind](14)} {KIND_LABEL[shown.kind]} · {evNo(shown.id)}
              {shown.time ? ` · ${shown.time}` : ''}
            </p>
            {shown.detail.map((d) => (
              <p key={d} className="wt-detail-line">
                {d}
              </p>
            ))}
            <p className="wt-detail-src">출처 ▸ {sourceText(shown)}</p>
            <ReliabilityTag evidence={shown} />
            {shown.reliability === 'raw' && <p className="wt-detail-note">기록 그대로. 진위는 확인되지 않았다.</p>}
            {e?.upgradeOf && (
              <button type="button" className="wt-btn wt-btn--ghost" onClick={() => setBefore((v) => !v)}>
                {before ? '갱신 후 보기' : '갱신 전 보기'}
              </button>
            )}
          </div>
        </div>
      )}
      {p && (
        <div className="wt-detail">
          <ArtSlot kind="portrait" who={p.id === 'VICTIM' ? 'VICTIM' : p.id} title={p.name} className="wt-detail-portrait" />
          <ProfileTile profile={p} detail />
        </div>
      )}
    </BottomSheet>
  );
}
