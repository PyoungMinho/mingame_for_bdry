'use client';

/**
 * 보조 화면 — 사이렌(W12) · 수사 배제(W65) · 세로 안내(W72) · 비 오버레이.
 *  - 사이렌: 가장자리 레드/시안 바 교대(3사이클 후 레드 정적) + 「새벽 1시. 사이렌이 들린다.」. 자동 진행 없음 — [계속]을 기다린다(D29).
 *    '줄이기'에서는 상단 붉은 띠만 정적으로. 번쩍임 초당 3회 미만.
 *  - 수사 배제: 오답 연출이 끝난 뒤. [심문 직전으로 되감기](체크포인트가 있을 때만) + S 불가 고지.
 */
import { NotebookPen, RotateCcw, Siren } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CASE } from '@/lib/witness';
import { fxMs } from '../lib/fx';
import { useWt } from '../lib/context';
import { ArtSlot } from './ArtSlot';
import { DialogueBox } from './DialogueBox';

export function RainLayer() {
  return (
    <div className="wt-rain" aria-hidden>
      <i />
      <i />
    </div>
  );
}

export function OrientationGuard() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(orientation: landscape) and (max-height: 499px)');
    const f = () => setOn(mq.matches);
    f();
    mq.addEventListener?.('change', f);
    return () => mq.removeEventListener?.('change', f);
  }, []);
  if (!on) return null;
  return (
    <div className="wt-orient" role="alert">
      <p>세로로 돌려서 즐겨 주세요.</p>
    </div>
  );
}

export function SirenOverlay({ canAccuse, onContinue, onNotebook }: { canAccuse: boolean; onContinue: () => void; onNotebook: () => void }) {
  const { vib } = useWt();
  useEffect(() => {
    vib([200, 100, 200]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="wt-siren" role="alertdialog" aria-label="사이렌" aria-describedby="wt-siren-t">
      <div className="wt-siren-bar wt-siren-bar--l" aria-hidden />
      <div className="wt-siren-bar wt-siren-bar--r" aria-hidden />
      <div className="wt-siren-top" aria-hidden />
      <div className="wt-siren-body">
        <Siren size={36} aria-hidden />
        <p id="wt-siren-t" className="wt-display wt-siren-t">
          새벽 1시. 사이렌이 들린다.
        </p>
        <p className="wt-siren-sub">{canAccuse ? '시간이 다 됐다. 지금 가진 걸로 지목한다.' : '강력팀이 도착했다. 수사는 여기까지다.'}</p>
        <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onContinue} data-autofocus data-testid="siren-continue">
          {canAccuse ? '지목하러 간다' : '계속'}
        </button>
        <button type="button" className="wt-link" onClick={onNotebook}>
          <NotebookPen size={14} aria-hidden /> 마지막으로 수첩 보기
        </button>
      </div>
    </div>
  );
}

/** 대질 입장 컷(디자인 §5-9) — 대질 1 은 1초, 대질 2(클라이맥스)는 2초. '줄이기'에서는 슬라이드 없이 페이드 */
export function ConfrontEntry({ names, ms, onDone }: { names: string[]; ms: number; onDone: () => void }) {
  const { fx } = useWt();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current(), fxMs(ms, fx));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="wt-entry" role="status" aria-label={`대질. ${names.join(' 대 ')}`}>
      <span className="wt-entry-a" aria-hidden>{names[0]}</span>
      <b className="wt-display wt-entry-t" aria-hidden>대질</b>
      <span className="wt-entry-b" aria-hidden>{names[1]}</span>
    </div>
  );
}

export function ExcludedView({ canRewind, onRewind, onNewRun, onTitle }: { canRewind: boolean; onRewind: () => void; onNewRun: () => void; onTitle: () => void }) {
  const text = CASE.endings.excluded;
  const [done, setDone] = useState(!text || text.lines.length === 0);
  return (
    <section className="wt-ending wt-excluded" data-ending="excluded">
      <div className="wt-ending-art">
        <ArtSlot kind="ending" ending="excluded" />
      </div>
      <h1 className="wt-display wt-ending-title">{text?.title ?? '수첩 압수'}</h1>
      {!done && text && (
        <div className="wt-ending-text">
          <DialogueBox lines={text.lines} playKey="excluded" onDone={() => setDone(true)} readKey="ending-excluded" />
        </div>
      )}
      {done && (
        <div className="wt-ending-detail">
          {canRewind && (
            <>
              <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onRewind} data-autofocus data-testid="excluded-rewind">
                <RotateCcw size={18} aria-hidden /> 심문 직전으로 되감기
              </button>
              <p className="wt-excluded-note">신뢰는 최소 2칸으로 돌아와요. 이번 판은 S 등급을 받을 수 없어요.</p>
            </>
          )}
          <button type="button" className="wt-btn wt-btn--secondary wt-btn--full" onClick={onNewRun} data-testid="excluded-new">
            엔딩 도감에 기록하고 새 수사
          </button>
          <button type="button" className="wt-link" onClick={onTitle}>
            제목으로
          </button>
        </div>
      )}
    </section>
  );
}
