'use client';

/**
 * 최종 지목(W50~W53) — 1단계 범인 선택 → 2단계 수단·기회·동기 3칸 → (경고) → 확인 → 판정 연출 → 엔딩.
 *  - 초안(범인·3칸)은 변경할 때마다 저장한다(새로고침해도 같은 단계에서 이어진다). 제출 후에는 고칠 수 없다.
 *  - 사이렌 뒤에도 똑같다 — 경고가 뜨고 [뒤로]로 허브에 돌아갈 수 있다(밸런스 R7. 옛 저장의 forced 는 무시).
 *  - 또박이를 고르면 이스터에그(페널티 없음) + 업적 토스트 후 다시 고른다.
 *  - 판정 연출 중에는 화면 전환을 잠근다(holdRoute) — 연출이 끝나야 엔딩으로 넘어간다.
 */
import { ChevronLeft, NotebookPen } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { accuseWarn, cancelAccuse, getEvidence, pickCulprit, setAccuseStage, setSlot, submitAccusation, type Accusation, type Dialogue, type Slot, type Step, type SuspectId } from '@/lib/witness';
import { ACHIEVEMENT_INFO } from '../lib/format';
import { TOAST } from '../lib/copy';
import { useWt } from '../lib/context';
import { ConfirmModal, SLOT_ORDER, SlotBoard, SuspectPick, VerdictStage, WarnModal, slotName } from '../components/AccuseFlow';
import { DialogueBox } from '../components/DialogueBox';
import { EvidenceSheet } from '../components/EvidenceSheet';
import { BottomSheet } from '../components/BottomSheet';
import { playSfx } from '../audio/useGameAudio';

export function AccuseScreen() {
  const { game, toast, openNotebook } = useWt();
  const run = game.run!;
  const draft = run.accuse ?? { stage: 'suspect' as const };
  const stage = draft.stage;
  const [picked, setPicked] = useState<SuspectId | 'AI' | null>(draft.culprit ?? null);
  const [egg, setEgg] = useState<Dialogue[] | null>(null);
  const [slotOpen, setSlotOpen] = useState<Slot | null>(null);
  const [warn, setWarn] = useState<Dialogue[] | null>(null);
  const [error, setError] = useState(false);
  const [verdict, setVerdict] = useState<Accusation | null>(null);
  /** 제출 직전의 2회차 여부 — 제출과 함께 meta.plays 가 오르므로 미리 잡아 둔다 */
  const [replay, setReplay] = useState(false);
  const releaseRef = useRef<(() => void) | null>(null);

  useEffect(
    () => () => {
      releaseRef.current?.();
      releaseRef.current = null;
    },
    [],
  );

  // 초안 방어: 지목 화면인데 초안이 없으면(비정상) 1단계로
  useEffect(() => {
    if (!run.accuse && run.phase !== 'ended') game.patch((r) => ({ ...r, accuse: { stage: 'suspect', forced: false } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = stage === 'suspect' ? 1 : 2;

  const submitPick = () => {
    if (!picked) return;
    const s = game.act((r) => pickCulprit(r, picked));
    if (s.error) return;
    const e = s.events.find((x) => x.t === 'easterEgg');
    if (e && e.t === 'easterEgg') {
      setEgg(e.lines);
      setPicked(null);
    }
  };

  const afterEgg = () => {
    setEgg(null);
    toast({ kind: 'star', text: TOAST.achievement(ACHIEVEMENT_INFO.arrestSpeaker.name), ms: 3200 });
  };

  const onSlotPick = (id: string) => {
    const slot = slotOpen;
    if (!slot) return;
    const s = game.act((r) => setSlot(r, slot, id)) as Step & { movedFrom?: Slot };
    if (s.movedFrom) toast({ kind: 'info', text: TOAST.moved(slotName(s.movedFrom)), ms: 1600 });
    setSlotOpen(null);
    setError(false);
  };

  const confirmSlots = () => {
    const d = game.getRun()?.accuse;
    if (!d || !SLOT_ORDER.every((s) => !!d[s])) {
      setError(true);
      return;
    }
    const w = accuseWarn(game.getRun()!);
    if (w && w.length) setWarn(w);
    else game.act((r) => setAccuseStage(r, 'confirm'));
  };

  const submit = () => {
    const d = game.getRun()?.accuse;
    if (!d?.culprit || !d.means || !d.opportunity || !d.motive) return;
    const acc: Accusation = { culprit: d.culprit, means: d.means, opportunity: d.opportunity, motive: d.motive };
    setReplay(game.meta.plays >= 1);
    releaseRef.current = game.holdRoute();
    const s = game.act((r) => submitAccusation(r, acc));
    if (s.error) {
      releaseRef.current?.();
      releaseRef.current = null;
      toast({ kind: 'warn', text: '지금은 제출할 수 없다' });
      return;
    }
    // 지목 확정 — 묵직한 타격(판정 결과와 무관한 같은 소리)
    playSfx('accuse');
    setVerdict(acc);
  };

  const usedIn: Record<string, string> = {};
  for (const s of SLOT_ORDER) if (draft[s] && s !== slotOpen) usedIn[draft[s]!] = slotName(s);

  if (verdict) {
    return (
      <div className="wt-screen wt-screen--accuse" data-stage="verdict">
        <VerdictStage
          acc={verdict}
          canSkip={replay}
          onFinish={() => {
            releaseRef.current?.();
            releaseRef.current = null;
          }}
        />
      </div>
    );
  }

  return (
    <div className="wt-screen wt-screen--accuse" data-stage={stage}>
      <header className="wt-accuse-head">
        <button
          type="button"
          className="wt-iconbtn"
          aria-label={stage === 'suspect' ? '지목 그만두고 돌아가기' : '범인 다시 고르기'}
          onClick={() => {
            if (stage === 'suspect') game.act((r) => cancelAccuse(r));
            else game.act((r) => setAccuseStage(r, 'suspect'));
          }}
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <span className="wt-accuse-step">최종 지목 {step}/3</span>
        <span className="wt-grow" />
        <button type="button" className="wt-iconbtn" aria-label="수첩" onClick={() => openNotebook()}>
          <NotebookPen size={20} aria-hidden />
        </button>
      </header>

      {stage === 'suspect' ? (
        <SuspectPick picked={picked} onPick={setPicked} onSubmit={submitPick} />
      ) : (
        <SlotBoard
          draft={draft}
          error={error}
          onSlot={setSlotOpen}
          onClear={(s) => game.act((r) => setSlot(r, s, null))}
          onChangeCulprit={() => game.act((r) => setAccuseStage(r, 'suspect'))}
          onConfirm={confirmSlots}
        />
      )}

      <EvidenceSheet open={slotOpen !== null} mode="slot" run={run} slotName={slotOpen ? slotName(slotOpen) : ''} usedIn={usedIn} onClose={() => setSlotOpen(null)} onPick={onSlotPick} />
      <WarnModal
        open={!!warn}
        lines={warn ?? []}
        onKeep={() => setWarn(null)}
        onGo={() => {
          setWarn(null);
          game.act((r) => setAccuseStage(r, 'confirm'));
        }}
      />
      <ConfirmModal open={stage === 'confirm'} draft={draft} onBack={() => game.act((r) => setAccuseStage(r, 'slots'))} onSubmit={submit} />
      <BottomSheet open={!!egg} title="한결과 또박이" onClose={afterEgg} height="confirm" hideTitle noClose dismissible={false} className="wt-sheet--egg">
        {egg && <DialogueBox lines={egg} playKey="egg" onDone={afterEgg} />}
      </BottomSheet>
      <p className="wt-sr">{getEvidence(draft.means ?? '')?.name}</p>
    </div>
  );
}
