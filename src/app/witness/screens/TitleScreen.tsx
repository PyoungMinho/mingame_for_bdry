'use client';

/**
 * 타이틀(W01, 디자인 §5-4) — 이어하기(앰버 주 버튼) · 새 수사 · 엔딩 도감 · 설정. 칩 「혼자서」「약 25분」「가입 없음」.
 * 하이드레이션: 서버 렌더는 스켈레톤(워드마크 + 버튼 자리 + 이어하기 자리 56px 점선 박스). 저장은 마운트 뒤 effect 에서 읽고 이어하기 카드를 채운다.
 * 1인용 게임이다 — 방 코드·초대·계정·서버가 없다는 사실을 칩과 설정 하단 문구로 못 박는다.
 */
import { Settings } from 'lucide-react';
import { useState } from 'react';
import { clock, endingSlots, evidenceCount } from '@/lib/witness';
import { NOTICE, TITLE_TEXT } from '../lib/copy';
import { fmtSavedAt, runSummary } from '../lib/format';
import { useWt } from '../lib/context';
import { ArtSlot } from '../components/ArtSlot';
import { ConfirmSheet } from '../components/BottomSheet';

function Wordmark() {
  return (
    <div className="wt-wordmark">
      <span className="wt-kicker wt-display">{TITLE_TEXT.kicker}</span>
      <h1 className="wt-title wt-display">
        {TITLE_TEXT.wordA}
        <span className="wt-title-ai">{TITLE_TEXT.wordB}</span>
      </h1>
      <ul className="wt-chips3" aria-label="게임 특징">
        {TITLE_TEXT.chips.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
    </div>
  );
}

/** 서버·첫 렌더 — 저장을 읽지 않는다 */
export function TitleSkeleton() {
  return (
    <main className="wt-screen wt-title-screen" aria-busy="true">
      <div className="wt-title-art" aria-hidden>
        <ArtSlot kind="cut" art="tower" />
      </div>
      <Wordmark />
      <div className="wt-title-actions">
        <div className="wt-resume-slot" aria-hidden />
        <div className="wt-btn wt-btn--primary wt-btn--full wt-skel" aria-hidden />
      </div>
    </main>
  );
}

export function TitleScreen() {
  const { game, openSettings, openCollection } = useWt();
  const run = game.run;
  const canResume = !!run && (run.phase !== 'ended' || run.result?.ending === 'excluded');
  const [confirmNew, setConfirmNew] = useState(false);
  const got = endingSlots().filter((e) => game.meta.endings.includes(e)).length;

  const start = () => {
    if (canResume) setConfirmNew(true);
    else game.startNew();
  };

  return (
    <main className="wt-screen wt-title-screen">
      <div className="wt-title-art" aria-hidden>
        <ArtSlot kind="cut" art="tower" />
      </div>
      <button type="button" className="wt-iconbtn wt-title-gear" onClick={openSettings} aria-label="설정">
        <Settings size={22} aria-hidden />
      </button>

      {!game.persistent && <p className="wt-banner">{NOTICE.noStorage}</p>}
      {game.notice && (
        <p className="wt-banner" role="status">
          {NOTICE[game.notice]}{' '}
          <button type="button" className="wt-link" onClick={game.dismissNotice}>
            닫기
          </button>
        </p>
      )}

      <Wordmark />

      <div className="wt-title-actions">
        {canResume && run ? (
          // 이름은 '이어하기'만, 요약·저장 시각은 설명으로(이름이 길면 이름으로 못 찾는다)
          <button type="button" className="wt-btn wt-btn--primary wt-btn--full wt-resume" onClick={game.resume} data-testid="title-resume" aria-label="이어하기" aria-describedby="wt-resume-desc">
            <span className="wt-resume-t" aria-hidden>
              이어하기
            </span>
            <span id="wt-resume-desc" className="wt-resume-desc">
              <span className="wt-resume-s">{runSummary(run, clock(run), evidenceCount(run))}</span>
              {game.savedAt && <span className="wt-resume-s">{fmtSavedAt(game.savedAt)}</span>}
            </span>
          </button>
        ) : (
          <p className="wt-title-hook">
            {TITLE_TEXT.hook.map((l) => (
              <span key={l}>{l}</span>
            ))}
          </p>
        )}
        <button type="button" className={`wt-btn wt-btn--full ${canResume ? 'wt-btn--secondary' : 'wt-btn--primary'}`} onClick={start} data-testid="title-new">
          새 수사
        </button>
        <div className="wt-title-row">
          <button type="button" className="wt-btn wt-btn--secondary" onClick={openCollection} data-testid="title-collection">
            엔딩 도감 {got}/8
          </button>
          <button type="button" className="wt-btn wt-btn--secondary" onClick={openSettings} data-testid="title-settings">
            설정
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={confirmNew}
        title="새 수사를 시작할까요?"
        confirmLabel="새로 시작"
        cancelLabel="취소"
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          game.startNew();
        }}
      >
        <p>지금 수사 기록이 지워져요. (엔딩 도감·업적은 그대로예요)</p>
      </ConfirmSheet>
    </main>
  );
}
