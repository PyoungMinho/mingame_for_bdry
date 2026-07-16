import Link from 'next/link';

/**
 * 동네고수 스코프 404 (archive/[gameNo]의 notFound() 등이 여기로 떨어진다).
 * 스코프 not-found가 없으면 루트 기본 404(루트 layout, .dn-shell 미적용)로 빠져 톤이 깨진다 —
 * dongne/layout.tsx 안에서 렌더되도록 세그먼트 전용 404를 둔다.
 */
export default function DongneNotFound() {
  return (
    <main className="dn-container dn-prelaunch">
      <h1 className="dn-text-h1">찾을 수 없는 페이지예요</h1>
      <p className="dn-text-body">주소가 바뀌었거나 아직 공개되지 않은 회차일 수 있어요.</p>
      <Link href="/dongne" className="dn-btn-primary" style={{ maxWidth: 240 }}>
        오늘 문제 풀러 가기 →
      </Link>
      <Link href="/dongne/archive" className="dn-link">
        아카이브 보기
      </Link>
    </main>
  );
}
