'use client';

/**
 * 엔딩(W60, 디자인 §5-15) — 키아트 → 제목 → 본문(≤10줄, 탭 진행) → 마지막 줄 뒤에 등급 도장(그림 밖, 제목 아래 오른쪽)·통계·놓친 것·업적·버튼이 120ms 간격으로 나타남.
 * 통계는 「강력팀 도착 n0분 전 해결」로 번역한다. 놓친 것은 실루엣 + missHint(최대 3), 못 깬 ★ 는 개수만(누구의 어느 증언인지 비공개).
 * 공유(W62)는 스포일러 없는 텍스트 카드: 범인·증거·트릭 어휘가 문구·URL 어디에도 없다(share.ts 가 보장).
 */
import { Copy, Lock, RotateCcw, Share2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CASE, EVIDENCE_TOTAL, STAR_TOTAL, copyText, share, sharePayload, timePhrase } from '@/lib/witness';
import { ACHIEVEMENT_INFO, fmtPlayTime, type EndingData } from '../lib/format';
import { TOAST } from '../lib/copy';
import { useWt } from '../lib/context';
import { GradeStamp as ArtGradeStamp } from '../art/fx';
import { ArtSlot } from './ArtSlot';
import { BottomSheet } from './BottomSheet';
import { DialogueBox } from './DialogueBox';
import { playSfx } from '../audio/useGameAudio';

/** 등급 도장 — 링·글자는 그림 모듈(art/fx GradeStamp: S 골드 톱니 · A 시안 이중 · B 앰버 · C 점선), 칭호는 HTML(줄바꿈·스크린 리더) */
export function GradeStamp({ grade, title }: { grade: EndingData['grade']; title: string }) {
  const { fx, game } = useWt();
  // 도장이 찍히는 순간(등급과 무관한 같은 소리)
  useEffect(() => playSfx('stamp'), []);
  return (
    <div className="wt-grade" data-grade={grade}>
      <span className="wt-grade-ring" aria-hidden>
        <ArtGradeStamp grade={grade} play={fx !== 'reduced' && !game.reducedMotion} />
      </span>
      <span className="wt-grade-title">
        <span className="wt-sr">{grade}등급, </span>
        {title}
      </span>
    </div>
  );
}

export interface EndingViewProps {
  data: EndingData;
  caseFile: { unlocked: boolean; plays: number };
  onShare: () => void;
  onAgain: () => void;
  onCollection: () => void;
  onCaseFile: () => void;
  onTitle: () => void;
}

export function EndingView({ data, caseFile, onShare, onAgain, onCollection, onCaseFile, onTitle }: EndingViewProps) {
  const text = CASE.endings[data.ending];
  const [phase, setPhase] = useState<'text' | 'detail'>(text && text.lines.length ? 'text' : 'detail');
  const solved = data.ending === 'perfect' || data.ending === 'hidden';
  const tp = timePhrase({ ending: data.ending, actionsLeft: data.actionsLeft });
  const missed = data.missed.slice(0, 3);
  const moreMissed = data.missed.length - missed.length;
  const stats: { k: string; v: string }[] = [
    { k: '결정적 모순', v: `${data.stars}/${STAR_TOTAL}` },
    { k: '증거', v: `${data.evidence}/${EVIDENCE_TOTAL}` },
    { k: '틀린 제시', v: `${data.wrong}` },
    { k: '도착', v: tp ?? '—' },
    { k: '플레이 시간', v: fmtPlayTime(data.playMs) },
    { k: '수첩 정리', v: `${data.hints}회` },
  ];

  return (
    <section className="wt-ending" data-ending={data.ending} data-solved={solved ? '1' : undefined}>
      <div className="wt-ending-art">
        <ArtSlot kind="ending" ending={data.ending} culprit={CASE.solution.culprit} />
      </div>
      <h1 className="wt-display wt-ending-title">{text?.title ?? data.title}</h1>

      {phase === 'text' && text && (
        <div className="wt-ending-text">
          <DialogueBox lines={text.lines} playKey={`ending:${data.ending}`} onDone={() => setPhase('detail')} readKey={`ending-${data.ending}`} />
          <button type="button" className="wt-btn wt-btn--ghost wt-btn--sm" onClick={() => setPhase('detail')}>
            결과 바로 보기
          </button>
        </div>
      )}

      {phase === 'detail' && (
        <div className="wt-ending-detail">
          {/* 등급 도장은 그림 밖(제목 아래 오른쪽)에 둔다 — 그림 위에 얹으면 핵심 그림(한결·07:00 알람)을 가린다 */}
          <div className="wt-ending-stamp">
            <GradeStamp grade={data.grade} title={data.title} />
          </div>
          <dl className="wt-stats">
            {stats.map((s, i) => (
              <div key={s.k} style={{ animationDelay: `${i * 120}ms` }}>
                <dt>{s.k}</dt>
                <dd>{s.v}</dd>
              </div>
            ))}
          </dl>

          <div className="wt-missed">
            <h2 className="wt-sec-h">놓친 것</h2>
            {missed.length === 0 ? (
              <p className="wt-read">놓친 증거가 없다.</p>
            ) : (
              <>
                <p className="wt-missed-n">놓친 증거 {data.missed.length}개</p>
                <ul className="wt-missed-list">
                  {missed.map((m) => (
                    <li key={m.id}>
                      <span className="wt-card wt-card--S wt-card--silhouette" aria-hidden>
                        <span>?</span>
                      </span>
                      <span className="wt-read">{m.missHint}</span>
                    </li>
                  ))}
                </ul>
                {moreMissed > 0 && <p className="wt-missed-more">그 밖에 {moreMissed}개</p>}
              </>
            )}
            {data.unbrokenStars > 0 && <p className="wt-missed-n">깨지 못한 결정적 모순 {data.unbrokenStars}개</p>}
          </div>

          {data.achievements.length > 0 && (
            <div className="wt-ach">
              <h2 className="wt-sec-h">업적</h2>
              <p className="wt-ach-list">
                {data.achievements.map((a) => (
                  <span key={a} className="wt-chip wt-chip--star">
                    {ACHIEVEMENT_INFO[a].name}
                  </span>
                ))}
              </p>
            </div>
          )}

          {data.hiddenTeaser && <p className="wt-teaser">AI가 아직 하지 않은 말이 하나 있다.</p>}

          <div className="wt-ending-actions">
            <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={onShare} data-testid="ending-share">
              <Share2 size={18} aria-hidden /> 공유
            </button>
            <div className="wt-ending-row">
              <button type="button" className="wt-btn wt-btn--secondary" onClick={onAgain} data-testid="ending-again">
                <RotateCcw size={16} aria-hidden /> 다시 수사
              </button>
              <button type="button" className="wt-btn wt-btn--secondary" onClick={onCollection} data-testid="ending-collection">
                엔딩 도감
              </button>
            </div>
            <button type="button" className="wt-btn wt-btn--secondary wt-btn--full" onClick={onCaseFile} data-testid="ending-casefile">
              {caseFile.unlocked ? (
                '사건 파일'
              ) : (
                <>
                  <Lock size={16} aria-hidden /> 사건 파일 · 완벽 해결 1회 또는 플레이 3회 (현재 {Math.min(caseFile.plays, 3)}/3)
                </>
              )}
            </button>
            <button type="button" className="wt-link" onClick={onTitle}>
              제목으로
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** 공유 시트(W62) — Web Share 지원 시 [공유하기], 아니면 [문구 복사]가 주 버튼. 복사 거부 시 선택 가능한 텍스트 박스 */
export function ShareSheet({ open, data, plays, onClose }: { open: boolean; data: EndingData; plays: number; onClose: () => void }) {
  const { toast } = useWt();
  const [manual, setManual] = useState(false);
  const payload = useMemo(
    () => sharePayload({ result: { ending: data.ending, grade: data.grade, title: data.title, stars: data.stars, evidence: data.evidence, actionsLeft: data.actionsLeft }, plays }),
    [data, plays],
  );
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  useEffect(() => {
    if (open) setManual(false);
  }, [open]);

  const doCopy = async () => {
    const ok = await copyText(payload.copyText);
    if (ok) toast({ kind: 'ok', text: TOAST.copied, ms: 1600 });
    else {
      setManual(true);
      toast({ kind: 'warn', text: TOAST.copyFailed, ms: 3200 });
    }
  };
  // 공유 버튼 핸들러에서 await 없이 바로 호출(사용자 제스처 안)
  const doShare = () => {
    void share(payload).then((o) => {
      if (o === 'copied') toast({ kind: 'ok', text: TOAST.copied, ms: 1600 });
      else if (o === 'failed') {
        setManual(true);
        toast({ kind: 'warn', text: TOAST.copyFailed, ms: 3200 });
      }
    });
  };

  const lines = payload.copyText.split('\n');
  return (
    <BottomSheet open={open} title="공유" onClose={onClose} height="auto" className="wt-sheet--share">
      <p className="wt-share-safe">
        <TriangleAlert size={14} aria-hidden /> 스포일러 없음: 범인·증거 내용은 담기지 않아요
      </p>
      <div className="wt-sharecard" aria-label="공유 문구 미리보기">
        {lines.map((l, i) => (
          <p key={i} data-url={i === lines.length - 1 ? '1' : undefined}>
            {l.replace('https://', '')}
          </p>
        ))}
      </div>
      {manual && <textarea className="wt-sharebox" readOnly value={payload.copyText} rows={6} onFocus={(e) => e.currentTarget.select()} aria-label="공유 문구(직접 복사)" />}
      <div className="wt-actions">
        {canShare ? (
          <>
            <button type="button" className="wt-btn wt-btn--primary" onClick={doShare} data-testid="share-native">
              <Share2 size={18} aria-hidden /> 공유하기
            </button>
            <button type="button" className="wt-btn wt-btn--secondary" onClick={doCopy} data-testid="share-copy">
              <Copy size={16} aria-hidden /> 문구 복사
            </button>
          </>
        ) : (
          <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={doCopy} data-testid="share-copy">
            <Copy size={16} aria-hidden /> 문구 복사
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

