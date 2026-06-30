export default function ListingDetailLoading() {
  return (
    <div className="min-h-dvh bg-white" aria-label="매물 상세 로딩 중" aria-busy="true">
      {/* 네비 스켈레톤 */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 h-12 bg-white border-b border-realestate-neutral-100 animate-pulse">
        <div className="w-8 h-8 rounded-full bg-realestate-neutral-200" />
        <div className="flex gap-2">
          <div className="w-8 h-8 rounded-full bg-realestate-neutral-200" />
          <div className="w-8 h-8 rounded-full bg-realestate-neutral-200" />
        </div>
      </div>

      {/* 갤러리 스켈레톤 */}
      <div className="w-full aspect-video bg-realestate-neutral-200 animate-pulse" />

      <div className="px-4 pt-4 space-y-4 animate-pulse">
        {/* 신뢰 배지 스켈레톤 */}
        <div className="flex items-center gap-3 p-4 rounded-lg bg-realestate-neutral-100">
          <div className="w-14 h-14 rounded-full bg-realestate-neutral-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-realestate-neutral-200 rounded w-1/3" />
            <div className="h-3 bg-realestate-neutral-200 rounded w-2/3" />
          </div>
        </div>

        {/* ScoreBreakdown 스켈레톤 */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-realestate-neutral-200 flex-shrink-0" />
              <div className="flex-1 h-2.5 rounded-full bg-realestate-neutral-200" />
              <div className="w-10 h-3 rounded bg-realestate-neutral-200" />
            </div>
          ))}
        </div>

        {/* 기본 정보 스켈레톤 */}
        <div className="border-t border-realestate-neutral-200 pt-4 space-y-2">
          <div className="h-5 bg-realestate-neutral-200 rounded w-3/4" />
          <div className="h-3 bg-realestate-neutral-100 rounded w-1/2" />
          <div className="h-6 bg-realestate-neutral-200 rounded w-1/3 mt-2" />
        </div>
      </div>

      {/* CTA 스켈레톤 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-realestate-neutral-200 px-4 py-3">
        <div className="w-full h-14 rounded-md bg-realestate-neutral-200 animate-pulse" />
      </div>
    </div>
  );
}
