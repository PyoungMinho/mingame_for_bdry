// REDLINE: 타인 비교/외모 점수 UI 금지
// 인증 레이아웃 — 로그인 / 온보딩 화면 공통 구조

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-surface-bg">
      {/* 로고 영역 */}
      <div className="flex items-center justify-center pt-16 pb-8 shrink-0">
        <div className="flex flex-col items-center gap-2">
          {/* 로고 플레이스홀더 — 컴포넌트개발자 자산으로 교체 예정 */}
          <div
            className="w-12 h-12 rounded-xl bg-primary-800 flex items-center justify-center"
            aria-label="오름 로고"
          >
            <span className="text-white font-bold text-lg" aria-hidden="true">
              O
            </span>
          </div>
          <span className="text-h3 font-bold text-primary-800">오름</span>
          <span className="text-body-s text-gray-500">매일 나아가는 나</span>
        </div>
      </div>

      {/* 콘텐츠 */}
      <main className="flex-1 px-5 pb-8">{children}</main>
    </div>
  );
}
