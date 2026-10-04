'use client';

/**
 * /witness 에러 경계(W00) — 한결: 「앗, 문제가 생겼어요.」 [이어서 하기](마지막 저장에서) [제목으로].
 * 저장은 건드리지 않는다(사건 본문은 코드에서 다시 만들어지므로 저장에는 진행 상태뿐). 저장이 깨져서 죽는 경우는 엔진 loadRun 이
 * 읽을 때 검증해 폐기하므로 여기까지 오지 않는다. 같은 오류가 반복되면 [제목으로]가 안전한 길이다.
 */
import { useEffect } from 'react';

const AUTO_RESUME_KEY = 'wt:autoresume';

export default function WitnessError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const resume = () => {
    try {
      window.sessionStorage.setItem(AUTO_RESUME_KEY, '1');
    } catch {
      /* 무시 */
    }
    reset();
  };
  const toTitle = () => {
    try {
      window.sessionStorage.removeItem(AUTO_RESUME_KEY);
    } catch {
      /* 무시 */
    }
    reset();
  };

  return (
    <div className="wt-shell" data-text="m" data-speed="normal" data-fx="reduced">
      <main className="wt-screen wt-errorpage" role="alert">
        <p className="wt-display wt-errorpage-kicker">한결</p>
        <h1 className="wt-display wt-errorpage-title">앗, 문제가 생겼어요.</h1>
        <p className="wt-errorpage-body">진행 중이던 수사는 이 기기에 저장돼 있어요.</p>
        <div className="wt-errorpage-actions">
          <button type="button" className="wt-btn wt-btn--primary wt-btn--full" onClick={resume}>
            이어서 하기
          </button>
          <button type="button" className="wt-btn wt-btn--secondary wt-btn--full" onClick={toTitle}>
            제목으로
          </button>
        </div>
      </main>
    </div>
  );
}
