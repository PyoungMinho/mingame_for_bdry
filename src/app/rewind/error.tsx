'use client';

import { useEffect } from 'react';

/** /rewind 에러 경계 — 깨진 저장 등으로 화면이 죽으면 저장을 지우고 처음으로 */
export default function RewindError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const restart = () => {
    try {
      window.localStorage.removeItem('rw:run:v1');
    } catch {
      /* 무시 */
    }
    reset();
  };
  return (
    <main className="rw-title">
      <div className="rw-title-inner">
        <p className="rw-kicker">타임머신이 잠깐 고장 났다</p>
        <h1 className="rw-logo">
          인생 <em>2회차</em>
        </h1>
        <p className="rw-tagline">진행 중이던 기록을 읽지 못했다. 처음부터 다시 돌아가 보자.</p>
        <div className="rw-title-actions">
          <button type="button" className="rw-btn rw-btn-primary rw-btn-xl" onClick={restart}>
            2000년으로 다시 돌아가기
          </button>
        </div>
      </div>
    </main>
  );
}
