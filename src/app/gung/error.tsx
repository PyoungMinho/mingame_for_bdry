'use client';

/**
 * /gung 에러 경계 — rewind 선례. 저장이 깨져 화면이 죽으면 저장을 지우고 처음으로.
 * 사건 본문은 항상 code로 재계산하므로(저장엔 본문이 없다) 저장을 지워도 데이터 유실은 없다.
 */
import { useEffect } from 'react';
import { STORAGE_KEYS } from '@/lib/gung';

export default function GungError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const restart = () => {
    try {
      window.localStorage.removeItem(STORAGE_KEYS.game);
    } catch {
      /* 무시 */
    }
    reset();
  };

  return (
    <main className="gu-errorpage">
      <div className="gu-errorpage-inner">
        <p className="gu-display gu-errorpage-kicker">붓이 잠시 멈췄소</p>
        <h1 className="gu-display gu-errorpage-title">세자 독살 사건</h1>
        <p className="gu-errorpage-body">진행 중이던 기록을 읽지 못했소. 처음부터 다시 시작하시오.</p>
        <button type="button" className="gu-btn gu-btn--primary gu-btn--full gu-errorpage-btn" onClick={restart}>
          <span className="gu-btn-label">처음으로</span>
        </button>
      </div>
    </main>
  );
}
