'use client';

/**
 * 엔딩 도감(W63) · 사건 파일(W64).
 *  - 도감: 엔딩 8 · 비밀 4 · 업적 6. 미해금은 실루엣 + 「???」. 오인 체포 칸은 지목한 인물 실루엣만(범인을 뺀 나머지로 런타임에 만든다).
 *    잠긴 칸에는 인물 이름을 쓰지 않는다(안 쓰면 누가 범인인지 소거로 드러난다).
 *  - 사건 파일: 완벽 해결 1회 또는 플레이 3회 뒤. 스포일러 경고(기본 포커스 [돌아간다]) → 진상 요약 + 모순별 해설.
 */
import { Check, Lock, TriangleAlert, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CASE, STAR_TOTAL, caseFileUnlocked, collectionSlots, type Id, type WitnessMeta } from '@/lib/witness';
import { caseFileSummary } from '../lib/casefile';
import { ACHIEVEMENT_INFO, ACHIEVEMENT_ORDER, SUSPECT_IDS, nameOf } from '../lib/format';
import { ENDING_SLOT_LABEL, REPLAY_TEXT } from '../lib/copy';
import { ArtSlot } from './ArtSlot';
import { BottomSheet } from './BottomSheet';

type Tab = 'endings' | 'secrets' | 'ach';

export function CollectionView({ open, meta, waitRewind = false, onClose, onCaseFile }: { open: boolean; meta: WitnessMeta; /** 되감기를 기다리는 판이 있다 — 사건 파일 잠금(A2) */ waitRewind?: boolean; onClose: () => void; onCaseFile: () => void }) {
  const [tab, setTab] = useState<Tab>('endings');
  useEffect(() => {
    if (open) setTab('endings');
  }, [open]);
  // 오인 체포 칸은 본 것부터 — 인물 순서대로 두면 본 칸의 위치로 범인이 소거된다
  const slots = collectionSlots(meta.endings);
  const gotE = slots.filter((s) => meta.endings.includes(s)).length;
  const gotS = SUSPECT_IDS.filter((s) => meta.secrets.includes(s)).length;
  const gotA = meta.achievements.length;
  const unlocked = caseFileUnlocked(meta) && !waitRewind;
  return (
    <BottomSheet open={open} title="엔딩 도감" onClose={onClose} height="full" className="wt-sheet--collection">
      <div role="tablist" aria-label="도감" className="wt-seg wt-seg--tabs">
        <button type="button" role="tab" aria-selected={tab === 'endings'} onClick={() => setTab('endings')}>
          엔딩 {gotE}/{slots.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'secrets'} onClick={() => setTab('secrets')}>
          비밀 {gotS}/{SUSPECT_IDS.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ach'} onClick={() => setTab('ach')}>
          업적 {gotA}/{ACHIEVEMENT_ORDER.length}
        </button>
      </div>
      {meta.bestGrade && <p className="wt-coll-best">최고 등급 <b>{meta.bestGrade}</b> · 플레이 {meta.plays}회</p>}
      {/* 처음부터 · 되감기 없이 푼 판의 최단 기록(행동 수) — 기억·되감기 판은 올라가지 않는다 */}
      {meta.best && (
        <p className="wt-coll-best" data-testid="coll-best">
          {REPLAY_TEXT.best(meta.best.used)}
        </p>
      )}

      {tab === 'endings' && (
        <ul className="wt-coll-grid" aria-label="엔딩">
          {slots.map((id) => {
            const got = meta.endings.includes(id);
            const t = CASE.endings[id]?.title;
            return (
              <li key={id} className="wt-coll-item" data-got={got ? '1' : undefined}>
                {got ? (
                  <span className="wt-coll-thumb" aria-hidden>
                    {/* 본 엔딩만 키아트 축소판(16:10). 못 본 칸은 실루엣 — 잠긴 칸엔 그림·이름을 그리지 않는다 */}
                    <ArtSlot kind="ending" ending={id} culprit={CASE.solution.culprit} />
                    <i>
                      <Check size={14} />
                    </i>
                  </span>
                ) : (
                  <span className="wt-coll-sil" aria-hidden>
                    <User size={20} />
                  </span>
                )}
                <b>{got ? t : '???'}</b>
                <small>{got ? (id.startsWith('wrong-') ? '오인 체포' : ENDING_SLOT_LABEL[id]) : id.startsWith('wrong-') ? '오인 체포' : '아직 못 봤다'}</small>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'secrets' && (
        <ul className="wt-coll-list" aria-label="비밀">
          {SUSPECT_IDS.map((id) => {
            const got = meta.secrets.includes(id);
            const p = CASE.profiles.find((x) => x.id === id);
            return (
              <li key={id} className="wt-coll-row" data-got={got ? '1' : undefined}>
                {got ? <Check size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
                <span>
                  <b>{got ? nameOf(id) : '???'}</b>
                  <small className="wt-read">{got ? p?.secretLine : '아직 풀리지 않은 비밀'}</small>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'ach' && (
        <ul className="wt-coll-list" aria-label="업적">
          {ACHIEVEMENT_ORDER.map((a) => {
            const got = meta.achievements.includes(a);
            return (
              <li key={a} className="wt-coll-row" data-got={got ? '1' : undefined}>
                {got ? <Check size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
                <span>
                  <b>{got ? ACHIEVEMENT_INFO[a].name : '???'}</b>
                  <small>{got ? ACHIEVEMENT_INFO[a].how : '아직 못 열었다'}</small>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="wt-coll-foot">
        <button type="button" className="wt-btn wt-btn--secondary wt-btn--full" onClick={onCaseFile} data-testid="coll-casefile">
          {unlocked ? (
            '사건 파일'
          ) : waitRewind && caseFileUnlocked(meta) ? (
            <>
              <Lock size={16} aria-hidden /> 사건 파일 · {REPLAY_TEXT.caseFileWait}
            </>
          ) : (
            <>
              <Lock size={16} aria-hidden /> 사건 파일 · 완벽 해결 1회 또는 플레이 3회 (현재 {Math.min(meta.plays, 3)}/3)
            </>
          )}
        </button>
      </div>
    </BottomSheet>
  );
}

export function CaseFileView({ open, meta, brokenIds, waitRewind = false, onClose }: { open: boolean; meta: WitnessMeta; brokenIds?: Id[]; /** 되감기를 기다리는 판 — 진상을 열지 않는다(A2) */ waitRewind?: boolean; onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (open) setOpened(false);
  }, [open]);
  const unlocked = caseFileUnlocked(meta) && !waitRewind;
  const breaks = CASE.sets.flatMap((s) => s.lines.flatMap((l) => l.breaks ?? []));
  return (
    <BottomSheet open={open} title="사건 파일" onClose={onClose} height="full" className="wt-sheet--casefile">
      {!unlocked ? (
        <div className="wt-casefile-lock">
          <Lock size={22} aria-hidden />
          <p>{waitRewind && caseFileUnlocked(meta) ? REPLAY_TEXT.caseFileWait : `완벽 해결 1회 또는 플레이 3회 뒤에 열려요. (현재 ${Math.min(meta.plays, 3)}/3)`}</p>
          <button type="button" className="wt-btn wt-btn--primary" onClick={onClose} data-autofocus="">
            돌아간다
          </button>
        </div>
      ) : !opened ? (
        <div className="wt-casefile-warn">
          <TriangleAlert size={22} aria-hidden />
          <h3>스포일러 경고</h3>
          <p>이 안에는 진상과 모든 모순의 해설이 있어요.</p>
          <div className="wt-actions wt-actions--opposed">
            <button type="button" className="wt-btn wt-btn--primary" onClick={onClose} data-autofocus="" data-testid="casefile-back">
              돌아간다
            </button>
            <button type="button" className="wt-btn wt-btn--secondary" onClick={() => setOpened(true)} data-testid="casefile-open">
              열어 본다
            </button>
          </div>
        </div>
      ) : (
        <div className="wt-casefile">
          <h3 className="wt-sec-h">진상</h3>
          <ol className="wt-casefile-truth wt-read">
            {caseFileSummary().map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ol>
          <h3 className="wt-sec-h">모순 해설 ({breaks.length}건 · 결정적 {STAR_TOTAL}건)</h3>
          <ul className="wt-casefile-list">
            {breaks.map((b) => {
              const mine = brokenIds ? brokenIds.includes(b.id) : undefined;
              return (
                <li key={b.id} data-mine={mine === undefined ? undefined : mine ? '1' : '0'}>
                  <span className="wt-casefile-mark" aria-hidden>
                    {mine ? <Check size={14} /> : b.tier === 'star' ? '★' : '◆'}
                  </span>
                  <span>
                    <small>{b.tier === 'star' ? '결정적' : '일반'}{mine === undefined ? '' : mine ? ' · 내가 깸' : ' · 못 깸'}</small>
                    {b.explain}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </BottomSheet>
  );
}
