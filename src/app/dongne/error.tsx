'use client';

/**
 * 동네고수 라우트 세그먼트 에러 바운더리.
 *
 * 게임 본체(page.tsx)는 실루엣 fetch·클립보드·localStorage 등 실패 경로를 전부 try/catch로
 * 무해화하지만, 손상된 localStorage 상태나 예기치 못한 렌더 예외까지 화이트스크린으로 흘리지
 * 않도록 마지막 방어선을 둔다. dongne/layout.tsx(.dn-shell) 안에서 렌더되므로 스코프 토큰이
 * 그대로 적용된다(공유 파일 무수정 · blast radius 0).
 */
export default function DongneError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="dn-container dn-prelaunch">
      <h1 className="dn-text-h1">문제가 생겼어요</h1>
      <p className="dn-text-body">잠시 후 다시 시도해 주세요. 기록은 이 기기에 안전하게 남아 있어요.</p>
      <button type="button" className="dn-btn-primary" style={{ maxWidth: 240 }} onClick={reset}>
        다시 시도
      </button>
      <a href="/dongne" className="dn-link">
        오늘 문제 풀러 가기 →
      </a>
    </main>
  );
}
