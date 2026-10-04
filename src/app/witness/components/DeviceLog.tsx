'use client';

/**
 * 기기 로그 시트(W21, 디자인 §5-7) + 증거 획득 카드(W22).
 *  - 로그 시트는 열리는 순간 증거를 획득·저장한 상태다(D11). 푸터는 [확인] 하나. 모든 행을 같은 스타일로 그린다(D12 강조 금지).
 *  - 스킨 3종은 색만 바뀐다(hub 시안 / panel 회청 / terminal 초록).
 */
import { Cpu } from 'lucide-react';
import { useEffect } from 'react';
import type { Evidence, Hotspot } from '@/lib/witness';
import { logSkinOf, splitLogRow } from '../lib/artMap';
import { sourceText, evNo } from '../lib/format';
import { useWt } from '../lib/context';
import { BottomSheet } from './BottomSheet';
import { EvidenceCard, KIND_ICON, KIND_LABEL, ReliabilityTag } from './EvidenceCard';

export function DeviceLogSheet({ open, hotspot, evidence, onClose }: { open: boolean; hotspot: Hotspot | null; evidence: Evidence | null; onClose: () => void }) {
  if (!hotspot || !evidence) return null;
  const skin = logSkinOf(hotspot.id);
  const rows = [evidence.summary, ...evidence.detail].map(splitLogRow);
  return (
    <BottomSheet
      open={open}
      title={hotspot.label}
      onClose={onClose}
      className="wt-sheet--log"
      headerExtra={
        <span className="wt-online">
          <i aria-hidden /> online
        </span>
      }
      footer={
        <div className="wt-actions">
          <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onClose} data-autofocus="">
            확인
          </button>
        </div>
      }
    >
      <div className="wt-logscreen" data-skin={skin}>
        <p className="wt-logscreen-head">
          <Cpu size={14} aria-hidden /> {hotspot.label} · {evNo(evidence.id)}
        </p>
        <ol className="wt-logrows" data-notime={rows.some((r) => r.time) ? undefined : '1'}>
          {rows.map((r, i) => (
            <li key={i} className="wt-logrow">
              {rows.some((x) => x.time) && <span className="wt-logtime">{r.time ?? ''}</span>}
              <span className="wt-logmsg">{r.msg}</span>
            </li>
          ))}
        </ol>
        {skin === 'terminal' && <span className="wt-cursor" aria-hidden />}
        {evidence.reliability === 'raw' && (
          <p className="wt-logtag">
            <ReliabilityTag evidence={evidence} /> <span>진위는 확인되지 않았다.</span>
          </p>
        )}
        {evidence.reliability === 'forged' && (
          <p className="wt-logtag">
            <ReliabilityTag evidence={evidence} />
          </p>
        )}
      </div>
      <p className="wt-logsave">수첩에 기록됐다 · {evidence.name}</p>
    </BottomSheet>
  );
}

/** 증거 획득 카드 — 탭 아무 곳 = 확인. 획득은 카드가 뜨기 전에 이미 저장됐다 */
export function EvidenceAcquireCard({ open, evidence, count, total, onClose }: { open: boolean; evidence: Evidence | null; count: number; total: number; onClose: () => void }) {
  const { game } = useWt();
  const noteSeen = game.meta.coach.includes('timelineNote');
  useEffect(() => {
    if (open && evidence?.time && !noteSeen) game.markCoach('timelineNote');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, evidence?.id]);
  if (!evidence) return null;
  return (
    <BottomSheet open={open} title="증거 획득" onClose={onClose} variant="modal" hideTitle noClose className="wt-sheet--acquire">
      <div className="wt-acquire" onClick={onClose} role="group" aria-label={`증거 획득 ${count}/${total}, ${evidence.name}`}>
        <span className="wt-acquire-top">
          <span className="wt-card-new">NEW</span>
          <span>증거 획득 {count}/{total}</span>
        </span>
        <span className="wt-acquire-card">
          <EvidenceCard evidence={evidence} size="L" isNew />
        </span>
        <span className="wt-acquire-name">
          {KIND_ICON[evidence.kind](18)} {evidence.name} <small>{KIND_LABEL[evidence.kind]}</small>
        </span>
        {evidence.detail.map((d) => (
          <span key={d} className="wt-acquire-line">
            {d}
          </span>
        ))}
        <span className="wt-acquire-src">출처 ▸ {sourceText(evidence)}</span>
        {evidence.time && !noteSeen && <span className="wt-acquire-note">수첩 › 타임라인에 올랐다</span>}
        <button
          type="button"
          className="wt-btn wt-btn--primary wt-btn--full wt-acquire-ok"
          data-autofocus=""
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          확인
        </button>
      </div>
    </BottomSheet>
  );
}
