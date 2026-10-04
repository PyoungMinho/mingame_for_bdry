'use client';

/**
 * 살펴보기(개인) — 원고 7판 10-1 「살펴보기는 각자」. 각자 폰(플레이어 조사 화면 · 방장 단서함 '지금 고르기' 시트)에서 쓴다.
 *
 *  - 그 조사의 이동 장소 그림 + 물건 이름표(핫스팟). 물건을 고르고 「살펴보기」를 눌러야 1회가 쓰인다(취중 오탭 방지 2탭).
 *    한 번 본 건 되돌릴 수 없다(되돌리기 없음). 라운드당 횟수·같은 물건 두 번 금지·장소 확정 뒤 마감은 엔진(game 'examine')이 막는다.
 *  - 본 관찰은 「내가 본 관찰」 카드 — **탭해 보기 + 자동 가림**(짧은 한 줄이라 꾹 누르기 대신, 10초 뒤 저절로 가려진다).
 *    방금 살펴본 물건은 바로 열린다. 가려진 동안엔 관찰 글이 DOM 에 없다. 탭 전환·시트·화면 꺼짐에 즉시 가려진다(useHoldReveal).
 *  - **역할 무관**: 사건·조사·이 폰의 살펴본 기록만 받는다(인원·자리·역할 없음) — 같은 기록이면 어느 역할이든 같은 화면.
 *  - 공용 화면(방장 무대·큰 화면)엔 이 컴포넌트를 쓰지 않는다(SceneMove).
 */
import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  examineLeft,
  examineObjects,
  examinedIn,
  GUIDE,
  guideText,
  observationsIn,
  sceneStop,
  type ExamineLog,
  type GungCase,
  type ObservationView,
  type RoundNo,
} from '@/lib/gung';
import { GuButton } from '../components';
import { sceneArt, SceneFallbackArt } from '../components/scenes';
import { useHoldReveal } from '../lib/useHoldReveal';

/** 관찰 카드 탭 열림 시간 — 짧은 한 줄(최대 두 줄)이라 15초 대신 10초 */
export const OBS_OPEN_MS = 10_000;

const SPEAKER_RE = /^([가-힣 ]{1,6}):\s*(.+)$/;

/** 「의관: …」 꼴이면 말한 이를 굵게 */
function LineText({ text }: { text: string }) {
  const m = SPEAKER_RE.exec(text);
  if (!m) return <>{text}</>;
  return (
    <>
      <b className="gu-scene-who">{m[1]}</b> {m[2]}
    </>
  );
}

// ─────────────────────────────── 내가 본 관찰 카드 ───────────────────────────────

function ObservationCard({ obs, sealEpoch, openSignal }: { obs: ObservationView; sealEpoch: unknown; openSignal: number }) {
  const reveal = useHoldReveal('tap', `${String(sealEpoch)}-ob-${obs.round}-${obs.objectId}`, { tapMs: OBS_OPEN_MS });
  const { show } = reveal;
  // 방금 살펴봤거나 그림에서 이 물건을 다시 눌렀을 때 — 바로 연다(10초 뒤 저절로 가려진다)
  useEffect(() => {
    if (openSignal > 0) show();
    // show 는 open 에 따라 새로 만들어진다 — 신호가 바뀔 때만 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);
  const secs = reveal.tapRemainingMs !== undefined ? Math.ceil(reveal.tapRemainingMs / 1000) : null;
  const multi = obs.lines.length > 1;
  return (
    <div
      {...reveal.pressBind}
      role="button"
      tabIndex={0}
      className="gu-obs"
      data-obj={obs.objectId}
      data-open={reveal.open || undefined}
      aria-pressed={reveal.open}
      aria-label={`${guideText.obsWhere(obs.round, obs.placeName)} · ${obs.name} — ${reveal.open ? '다시 탭하면 가려져요' : GUIDE.obsSealed}`}
    >
      <p className="gu-obs-head">
        <span className="gu-obs-where">{guideText.obsWhere(obs.round, obs.placeName)}</span>
        <b className="gu-obs-name">{obs.name}</b>
      </p>
      {reveal.open ? (
        <>
          <ul className="gu-obs-lines">
            {obs.lines.map((l) => (
              <li key={l.fromRound} className="gu-obs-line">
                {multi && <span className="gu-obs-line-round">조사 {l.fromRound}</span>}
                <p className="gu-obs-line-text">
                  <LineText text={l.text} />
                </p>
              </li>
            ))}
          </ul>
          <p className="gu-obs-foot">
            {GUIDE.obsShowNote}
            {secs !== null && <span className="gu-obs-secs"> · {secs}초 뒤 가려져요</span>}
          </p>
        </>
      ) : (
        <p className="gu-obs-sealed">✋ {GUIDE.obsSealed}</p>
      )}
    </div>
  );
}

/**
 * 내가 본 관찰 목록 — 조사 화면(장소를 고른 뒤)·단서함·살펴보기 패널이 같이 쓴다. 비어 있으면 아무것도 그리지 않는다.
 * open = { id: 물건 id, n: 신호 } — n 이 바뀌면 그 카드를 연다(방금 살펴본 것).
 */
export function ObservationList({
  observations,
  sealEpoch,
  heading = GUIDE.obsHead,
  open,
  className,
}: {
  observations: ObservationView[];
  sealEpoch: unknown;
  heading?: string;
  open?: { id: string; n: number } | null;
  className?: string;
}) {
  if (!observations.length) return null;
  return (
    <section className={['gu-obslist', className ?? ''].filter(Boolean).join(' ')} aria-label={heading}>
      <p className="gu-obslist-head">{heading}</p>
      {observations.map((o) => (
        <ObservationCard key={`${o.round}-${o.objectId}`} obs={o} sealEpoch={sealEpoch} openSignal={open && open.id === o.objectId ? open.n : 0} />
      ))}
    </section>
  );
}

// ─────────────────────────────── 살펴보기 패널 ───────────────────────────────

export interface ExaminePanelProps {
  c: GungCase;
  round: RoundNo;
  /** 이 폰의 살펴본 기록(GameState.examined) */
  log: ExamineLog | undefined;
  /** 이 조사의 장소를 확정했다 — 남은 살펴보기 마감 */
  closed: boolean;
  onExamine: (objectId: string) => void;
  sealEpoch: unknown;
  /** 그림 SVG id 범위 — 한 화면에 그림이 둘이면 서로 다른 값 */
  idScope: string;
  className?: string;
}

export function ExaminePanel({ c, round, log, closed, onExamine, sealEpoch, idScope, className }: ExaminePanelProps) {
  const stop = sceneStop(c, round);
  const objects = useMemo(() => examineObjects(c, round), [c, round]);
  const done = examinedIn(log, round);
  const left = closed ? 0 : examineLeft(c, log, round);
  const observations = observationsIn(c, log, round);
  const [selected, setSelected] = useState<string | null>(null);
  const [openSig, setOpenSig] = useState<{ id: string; n: number } | null>(null);
  const seq = useRef(0);
  const ArtComp = (stop && sceneArt(stop.art)?.Art) || SceneFallbackArt;
  const art = stop ? sceneArt(stop.art) : null;
  const artNode = useMemo(() => <ArtComp round={round} idScope={idScope} />, [ArtComp, round, idScope]);

  if (!stop || !objects.length) return null;

  const openCard = (id: string) => {
    seq.current += 1;
    setOpenSig({ id, n: seq.current });
  };
  const pick = (id: string) => {
    if (done.includes(id)) {
      setSelected(null);
      openCard(id);
      return;
    }
    if (left <= 0) return;
    setSelected((cur) => (cur === id ? null : id));
  };
  const chosen = selected && !done.includes(selected) && left > 0 ? objects.find((o) => o.id === selected) ?? null : null;
  const examine = () => {
    if (!chosen) return;
    onExamine(chosen.id);
    setSelected(null);
    openCard(chosen.id);
  };

  return (
    <section
      className={['gu-examine', className ?? ''].filter(Boolean).join(' ')}
      aria-label={`${GUIDE.examineHead} · ${stop.placeName}`}
      data-round={round}
      data-left={left}
    >
      <div className="gu-examine-head">
        <p className="gu-examine-title">
          <span className="gu-examine-kicker">
            조사 <span className="gu-num">{round}</span> · {GUIDE.examineHead}
          </span>
          <span className="gu-examine-place gu-display">{stop.placeName}</span>
        </p>
        <p className="gu-examine-left" aria-live="polite" data-spent={left === 0 || undefined}>
          {closed ? GUIDE.examineClosed : left > 0 ? guideText.examineLeft(left, stop.examine) : `0/${stop.examine}번 남음`}
        </p>
      </div>
      <div className="gu-scene-canvas" data-place={stop.placeId}>
        {artNode}
        {objects.map((o) => {
          const [x, y] = art?.anchors[o.id] ?? o.pos;
          const seen = done.includes(o.id);
          const locked = !seen && (left <= 0 || closed);
          const label = art?.labels[o.id] ?? o.name;
          return (
            <button
              key={o.id}
              type="button"
              className="gu-scene-spot"
              style={{ left: `${x}%`, top: `${y}%`, '--x': x, '--y': y } as CSSProperties}
              data-obj={o.id}
              data-seen={seen ? '' : undefined}
              data-locked={locked ? '' : undefined}
              aria-pressed={o.id === selected}
              aria-disabled={locked || undefined}
              aria-label={[o.name, seen ? '살펴본 물건' : '', locked ? '살펴볼 수 없음' : ''].filter(Boolean).join(', ')}
              onClick={() => pick(o.id)}
            >
              <span className="gu-scene-tag">
                <span className="gu-scene-tag-label">{label}</span>
                {seen && (
                  <span className="gu-scene-tag-seen" aria-hidden>
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="gu-examine-act" aria-live="polite">
        {chosen ? (
          <>
            <p className="gu-examine-chosen">
              <b className="gu-examine-chosen-name">{chosen.name}</b>
              <span className="gu-examine-once">{GUIDE.examineOnce}</span>
            </p>
            <GuButton variant="secondary" fullWidth onClick={examine}>
              {guideText.examineButton(left)}
            </GuButton>
          </>
        ) : (
          <p className="gu-examine-hint">{closed ? GUIDE.examineClosed : left > 0 ? GUIDE.examineHint : GUIDE.examineSpent}</p>
        )}
      </div>
      <ObservationList observations={observations} sealEpoch={sealEpoch} heading={`${GUIDE.obsHead} · 조사 ${round}`} open={openSig} />
    </section>
  );
}
