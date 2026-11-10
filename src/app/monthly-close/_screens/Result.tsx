'use client';

/** 결과 탭(R): 시말서 / 포상 품의서 / 공동 경위서 + 문서 작업 줄(v 저장·내용 복사·새 문서·피식·신고). */
import { useMemo, useState } from 'react';
import { COMMON_PACK, fileNameOf, formatHM, resultBody, shareText } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { FIRST_DOC_VERSION } from '@/lib/monthly-close/constants';
import type { EndedView, LaughLevel, ResultDocKind, LineId } from '@/lib/monthly-close/protocol';
import type { IndustryPack } from '@/lib/monthly-close/copy/schema';
import { hashSeed } from '@/lib/monthly-close/copy/pick';
import { outcomeOf } from '@/lib/monthly-close/client/viewModel';
import { placementCells } from '@/lib/monthly-close/coords';
import { ResultSheet } from '../_components/result/ResultSheet';
import { ResultDoc } from '../_components/result/ResultDoc';
import { DocActionBar } from '../_components/result/DocActionBar';
import { ReportPopover } from '../_components/result/ReportPopover';

export interface ResultViewProps {
  view: EndedView;
  pack: IndustryPack;
  now: number;
  filterLeft: string;
  filterRight: string;
  practice: boolean;
  onSave: () => void;
  onNew: () => void;
  /** 이 판의 피식 응답(판당 1회 — GameInner가 matchId로 들고 있다). null이면 아직 안 함 */
  laugh: LaughLevel | null;
  onFeedback: (laugh: LaughLevel) => void;
  onReport: (lineId: LineId) => void;
  onCopied: (kind: ResultDocKind, ok: boolean) => void;
  alarmFailed: boolean;
}

export function resultKind(view: EndedView): ResultDocKind {
  const o = outcomeOf(view);
  return o === 'win' ? 'award' : o === 'lose' ? 'reprimand' : 'joint';
}

export function ResultTab(p: ResultViewProps) {
  const { view, pack } = p;
  const kind = resultKind(view);
  const [reporting, setReporting] = useState(false);
  const [withName, setWithName] = useState(false);
  const fileName = fileNameOf(pack, FIRST_DOC_VERSION + view.room.matchSeq - 1);
  const requestedByMe = view.rematch.requested[view.me.seat];
  const peerGone = !view.opp.present;

  const { body, lineId, gist, mine, theirs } = useMemo(() => {
    const mineSunk = view.game.sunkByMe;
    const theirSunk = view.game.sunkByOpp;
    // 패자: 가장 먼저 종결된 내 항목 / 승자: 마지막에 종결시킨 상대 항목의 표 이름
    const pickSlot = kind === 'reprimand' ? theirSunk[0]?.slot : mineSunk[mineSunk.length - 1]?.slot;
    const slot = pickSlot ?? 'L4';
    const cells = kind === 'reprimand' ? (view.me.ships.find((s) => s.slot === slot) ? placementCells(view.me.ships.find((s) => s.slot === slot)!) : null) : null;
    const last = view.game.myShots[view.game.myShots.length - 1]?.cell ?? 'B7';
    const coord = kind === 'reprimand' ? (view.game.oppShots[view.game.oppShots.length - 1]?.cell ?? cells?.[0] ?? 'B7') : last;
    const line = resultBody(pack, kind, { R: view.result.round, 좌표: coord, 배: pack.ships[slot].table, n: FIRST_DOC_VERSION + view.room.matchSeq - 1, 'n+1': FIRST_DOC_VERSION + view.room.matchSeq }, hashSeed(view.game.matchId));
    return { body: line.text, lineId: line.id, gist: line.text, mine: mineSunk.length, theirs: theirSunk.length };
  }, [view, pack, kind]);

  const labelsTail = COMMON_PACK.resultDocs;
  const rows = [
    { label: UI.result.belong, value: withName ? `${view.me.nickname} / ${view.opp.nickname}` : view.me.nickname },
    { label: UI.result.when, value: formatHM(p.now) },
    { label: UI.result.gist, value: body, tall: true },
    { label: UI.result.reason, value: COMMON_PACK.endReasons[view.result.reason] },
    ...(kind === 'award' ? [{ label: ' ', value: labelsTail.tails.awardPrize }, { label: ' ', value: labelsTail.tails.awardRoute }] : []),
    ...(kind === 'joint' ? [{ label: ' ', value: labelsTail.tails.joint }] : []),
    { label: UI.result.sign, value: `${view.me.nickname} ${UI.result.sealMark}`, sign: true },
  ];
  const approvers = labelsTail.approvers;
  const approval =
    kind === 'joint'
      ? null
      : { labels: approvers, stamps: (kind === 'award' ? [approvers[0].slice(0, 1), approvers[1].slice(0, 1), UI.result.sealMark.slice(1, 2)] : ['', '', UI.result.sealMark.slice(1, 2)]) as [string, string, string] };

  const copy = async () => {
    const text = shareText({ docKind: kind, fileName, round: view.result.round, mine, theirs, body: gist });
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = false;
    }
    p.onCopied(kind, ok);
  };

  return (
    <ResultSheet
      label={labelsTail.tabs[kind]}
      filterLeft={p.filterLeft}
      filterRight={p.filterRight}
      doc={
        <ResultDoc
          kind={kind}
          title={labelsTail.titles[kind]}
          rows={rows}
          approval={approval}
          alarmFailLine={p.alarmFailed ? pack.result.alarmFail : undefined}
          footnote={labelsTail.tails.beta}
        />
      }
      actions={
        <DocActionBar
          saveLabel={requestedByMe ? UI.result.requested : UI.result.saveAs(FIRST_DOC_VERSION + view.room.matchSeq)}
          saveDisabled={requestedByMe || peerGone || p.practice}
          saveAside={peerGone ? UI.result.peerClosed : undefined}
          onSave={p.onSave}
          copyLabel={UI.result.copyText}
          onCopy={copy}
          newLabel={UI.result.newWithOther}
          onNew={p.onNew}
          laugh={{
            question: UI.result.laughQ,
            options: [
              { value: 'none', label: UI.result.laugh.none },
              { value: 'some', label: UI.result.laugh.some },
              { value: 'lol', label: UI.result.laugh.lol },
            ],
            value: p.laugh,
            disabled: p.laugh !== null,
            onChange: (v) => {
              if (p.laugh === null) p.onFeedback(v);
            },
          }}
          nameToggle={{ label: UI.result.nameToggle, checked: withName, onChange: setWithName }}
          reportLabel={UI.result.report}
          onReport={() => setReporting((r) => !r)}
          reportSlot={
            reporting ? (
              <ReportPopover
                title={UI.result.reportWhich}
                options={[
                  { value: 'memo', label: UI.result.reportKinds.memo },
                  { value: 'taunt', label: UI.result.reportKinds.taunt },
                  { value: 'doc', label: UI.result.reportKinds.doc },
                ]}
                sendLabel={UI.result.reportSend}
                cancelLabel={UI.confirm.cancel}
                onSend={() => {
                  setReporting(false);
                  p.onReport(lineId);
                }}
                onCancel={() => setReporting(false)}
              />
            ) : null
          }
        />
      }
    />
  );
}
