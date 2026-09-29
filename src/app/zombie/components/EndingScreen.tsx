'use client';

import { Check, Home, RotateCcw, Share2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COMPANIONS, ENDING_IDS, LOCATIONS, STAT_META } from '@/lib/zombie/contract';
import { NODES } from '@/lib/zombie/content';
import { formatClock, formatSurvived, survivorType, type ResolvedEnding, type RunState } from '@/lib/zombie/engine';
import type { StatKey } from '@/lib/zombie/types';
import type { FoundEndings } from '../lib/useZombieGame';
import { Dedication } from './Dedication';
import { EndingGallery, KIND_LABEL } from './EndingGallery';
import { SceneFrame } from './SceneFrame';

const SHARE_URL = 'https://project-orsrw.vercel.app/zombie';
const CAUSE: Record<string, string> = {
  hp: '몸이 먼저 버티지 못했다',
  mental: '마음이 먼저 무너졌다',
  infection: '열이 끝내 내리지 않았다',
};

export function EndingScreen({
  state,
  ending,
  found,
  onRestart,
  onTitle,
}: {
  state: RunState;
  ending: ResolvedEnding;
  found: FoundEndings;
  onRestart: () => void;
  onTitle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  /** 공유 API·클립보드가 모두 막힌 환경(카톡 인앱 브라우저 등)에서 직접 복사하도록 보여 줄 텍스트 */
  const [manual, setManual] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const type = survivorType(state);
  const lastNode = NODES[state.nodeId];
  const lastLoc = lastNode ? LOCATIONS[lastNode.location].name : '';
  const no = ENDING_IDS.indexOf(ending.id) + 1;
  const foundN = ENDING_IDS.filter((id) => found[id]).length;

  // 직전 결과 패널로의 부드러운 스크롤이 남아 있어도 확실히 맨 위에서 시작하도록 다음 프레임에 한 번 더
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    titleRef.current?.focus({ preventScroll: true });
    const id = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const share = async () => {
    const text =
      `[좀비 터지면] 나의 결말: ${ending.title} (${KIND_LABEL[ending.kind]})\n` +
      `생존 ${formatSurvived(state)} · ${type.title}\n` +
      `“${ending.epitaph}”\n너라면 어떻게 할 건데?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: '좀비 터지면', text, url: SHARE_URL });
        return;
      }
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${SHARE_URL}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setManual(`${text}\n${SHARE_URL}`);
    }
  };

  return (
    <main className="zb-ending" data-kind={ending.kind}>
      <div className="zb-ending-hero">
        <SceneFrame scene={ending.scene} label={`엔딩 장면 — ${ending.title}`}>
          <span className="zb-stamp" data-kind={ending.kind} aria-hidden>
            {KIND_LABEL[ending.kind]}
          </span>
        </SceneFrame>
      </div>

      <div className="zb-ending-body">
        <p className="zb-kicker">
          ENDING {String(no).padStart(2, '0')} / {ENDING_IDS.length} · {KIND_LABEL[ending.kind]}
        </p>
        <h1 className="zb-ending-title" ref={titleRef} tabIndex={-1}>
          {ending.title}
        </h1>
        {state.endingCause && state.endingCause !== 'story' && (
          <p className="zb-ending-cause">
            {formatClock(state.clock)} · {lastLoc} — {CAUSE[state.endingCause]}
          </p>
        )}
        <div className="zb-ending-text">
          {ending.body.map((p, i) => (
            <p key={i} style={{ ['--i' as string]: i }}>
              {p}
            </p>
          ))}
        </div>
        <blockquote className="zb-epitaph">“{ending.epitaph}”</blockquote>
      </div>

      <Dedication />

      <div className="zb-ending-body">
        <section className="zb-report" aria-label="생존 기록 보고서">
          <h2 className="zb-panel-h">생존 기록 보고서</h2>
          <dl>
            <div>
              <dt>생존 시간</dt>
              <dd>{formatSurvived(state)}</dd>
            </div>
            <div>
              <dt>마지막 기록</dt>
              <dd>
                {formatClock(state.clock)} · {lastLoc}
              </dd>
            </div>
            <div>
              <dt>선택</dt>
              <dd>{state.history.length}번</dd>
            </div>
            <div>
              <dt>끝까지 함께</dt>
              <dd>{state.companions.length ? state.companions.map((c) => COMPANIONS[c].name).join(', ') : '없음'}</dd>
            </div>
            {state.lost.length > 0 && (
              <div>
                <dt>잃은 사람들</dt>
                <dd>{state.lost.map((c) => COMPANIONS[c].name).join(', ')}</dd>
              </div>
            )}
            <div>
              <dt>최종 상태</dt>
              <dd className="zb-report-stats">
                {(['hp', 'supply', 'mental'] as StatKey[]).map((k) => (
                  <span key={k} data-stat={k}>
                    {STAT_META[k].label} {state.stats[k]}
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <div className="zb-type">
            <p className="zb-type-label">당신의 생존자 유형</p>
            <p className="zb-type-title">{type.title}</p>
            <p className="zb-type-line">{type.line}</p>
          </div>
        </section>

        <div className="zb-ending-actions">
          <button type="button" className="zb-btn zb-btn-primary" onClick={share}>
            {copied ? <Check aria-hidden /> : <Share2 aria-hidden />}
            {copied ? '복사됐어요' : '결과 공유하기'}
          </button>
          <button type="button" className="zb-btn" onClick={onRestart}>
            <RotateCcw aria-hidden />
            다시 살아남기
          </button>
          <button type="button" className="zb-btn zb-btn-ghost" onClick={onTitle}>
            <Home aria-hidden />
            처음으로
          </button>
        </div>
        <span role="status" className="zb-sr">
          {copied ? '결과를 복사했어요' : ''}
        </span>
        {manual && (
          <label className="zb-manual-share">
            <span>아래 내용을 길게 눌러 복사해 공유하세요</span>
            <textarea readOnly value={manual} rows={5} onFocus={(e) => e.currentTarget.select()} />
          </label>
        )}
        <p className="zb-fine">
          {foundN < ENDING_IDS.length
            ? `아직 ${ENDING_IDS.length - foundN}개의 결말이 남았다. 다른 선택을 해 보면?`
            : '모든 결말을 봤다. 진짜 생존 전문가.'}
        </p>

        <EndingGallery found={found} highlight={ending.id} />
      </div>
    </main>
  );
}
