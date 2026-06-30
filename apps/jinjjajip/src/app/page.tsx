"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Bell, ShieldCheck, Camera } from "lucide-react";
import { useListingsQuery } from "@/lib/api/listings";
import { ListingCard } from "@/components/listing/ListingCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { cn } from "@/lib/utils";
import type { ListingSearchQuery } from "@/lib/types/domain";

type Region = "gwanak" | "mapo";
type BuildingType = "oneroom" | "officetel";

const REGION_LABELS: Record<Region, string> = {
  gwanak: "관악구",
  mapo: "마포구",
};

const BUILDING_LABELS: Record<BuildingType, string> = {
  oneroom: "원룸",
  officetel: "오피스텔",
};

function ListingSkeleton() {
  return (
    <div
      className="bg-white rounded-lg border border-realestate-neutral-200 shadow-card-trust p-card-pad animate-pulse"
      aria-hidden="true"
    >
      <div className="aspect-video rounded-md bg-realestate-neutral-200 mb-3" />
      <div className="h-4 bg-realestate-neutral-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-realestate-neutral-100 rounded w-1/2 mb-3" />
      <div className="h-5 bg-realestate-neutral-200 rounded w-1/3" />
    </div>
  );
}

export default function SearchHomePage() {
  const [region, setRegion] = useState<Region | undefined>(undefined);
  const [buildingType, setBuildingType] = useState<BuildingType | undefined>(undefined);

  const query: ListingSearchQuery = {
    sort: "trust",
    ...(region && { region }),
    ...(buildingType && { buildingType }),
  };

  const { data, isLoading, isError, isPaused, isSuccess, refetch } = useListingsQuery(query);

  const handleRegionToggle = useCallback(
    (r: Region) => setRegion((prev) => (prev === r ? undefined : r)),
    [],
  );

  const handleBuildingToggle = useCallback(
    (b: BuildingType) => setBuildingType((prev) => (prev === b ? undefined : b)),
    [],
  );

  const handleClearFilter = useCallback(() => {
    setRegion(undefined);
    setBuildingType(undefined);
  }, []);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const hasFilter = region !== undefined || buildingType !== undefined;

  return (
    <div className="min-h-dvh bg-realestate-neutral-50 pb-20">
      {/* 상단 헤더 */}
      <header className="sticky top-0 z-40 bg-realestate-neutral-50/90 backdrop-blur-sm border-b border-realestate-neutral-200/60 h-14 flex items-center px-5 justify-between">
        <Link
          href="/"
          aria-label="진짜집 홈"
          className="text-2xl font-serif font-bold text-realestate-brand-primary tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary rounded"
        >
          진짜집
        </Link>
        <button
          type="button"
          aria-label="알림"
          className="w-10 h-10 flex items-center justify-center rounded-full text-realestate-neutral-700 hover:bg-realestate-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
        >
          <Bell size={20} strokeWidth={1.5} />
        </button>
      </header>

      {/* 에디토리얼 히어로 */}
      <div className="px-5 pt-7 pb-5">
        <p className="text-[11px] tracking-[0.22em] uppercase text-realestate-brand-sub font-semibold mb-2">
          Tenant-Verified
        </p>
        <h1 className="text-h2 font-serif text-realestate-neutral-900 leading-[1.2]">
          검증된 매물만
          <br />
          골라보세요
        </h1>
        <p className="mt-2.5 text-body-s text-realestate-neutral-500">
          세입자가 직접 찍어 검증한 사진. 신뢰 점수로 한눈에.
        </p>
      </div>

      {/* 지역·유형 필터 (단일 행 가로 스크롤) */}
      <section aria-label="지역 및 매물 유형 필터" className="pb-3">
        <div className="flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["gwanak", "mapo"] as Region[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => handleRegionToggle(r)}
              aria-pressed={region === r}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                region === r
                  ? "bg-realestate-brand-primary text-white font-medium"
                  : "bg-white text-realestate-neutral-600 border border-realestate-neutral-200 hover:border-realestate-neutral-300",
              )}
            >
              {REGION_LABELS[r]}
            </button>
          ))}
          <span className="shrink-0 w-px h-4 bg-realestate-neutral-200 mx-0.5" aria-hidden="true" />
          {(["oneroom", "officetel"] as BuildingType[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => handleBuildingToggle(b)}
              aria-pressed={buildingType === b}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm transition-colors whitespace-nowrap",
                buildingType === b
                  ? "bg-realestate-brand-primary text-white font-medium"
                  : "bg-white text-realestate-neutral-600 border border-realestate-neutral-200 hover:border-realestate-neutral-300",
              )}
            >
              {BUILDING_LABELS[b]}
            </button>
          ))}
        </div>
      </section>

      {/* 등급 범례 + 카운트 */}
      <div className="px-5 pt-1 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3 text-trust-desc text-realestate-neutral-500">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck size={13} strokeWidth={2} className="text-realestate-trust-gold" aria-hidden="true" />
            실거주 인증
          </span>
          <span className="inline-flex items-center gap-1">
            <Camera size={13} strokeWidth={2} className="text-realestate-trust-silver" aria-hidden="true" />
            현장 인증
          </span>
        </div>
        {isSuccess && (
          <span className="text-trust-desc text-realestate-neutral-700 tabular-nums" aria-live="polite">
            {total.toLocaleString("ko-KR")}개 · 신뢰순
          </span>
        )}
      </div>

      {/* 매물 목록 */}
      <main className="px-4 pt-2">
        {isLoading && (
          <ul aria-label="매물 목록 로딩 중" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i}>
                <ListingSkeleton />
              </li>
            ))}
          </ul>
        )}

        {(isError || (isPaused && !data)) && (
          <ErrorState
            message="잠시 연결이 끊겼습니다"
            onRetry={() => refetch()}
          />
        )}

        {isSuccess && items.length === 0 && (
          <EmptyState
            message={
              hasFilter
                ? "조건에 맞는 매물이 없어요"
                : "현재 관악구·마포구에서 서비스 중입니다"
            }
            description={
              hasFilter
                ? "필터를 조정해보세요"
                : undefined
            }
            action={
              hasFilter ? (
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="px-4 py-2 text-sm font-medium text-realestate-brand-primary border border-realestate-brand-primary rounded-md"
                >
                  필터 초기화
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRegion("gwanak")}
                    className="px-4 py-2 text-sm font-medium text-realestate-brand-primary border border-realestate-brand-primary rounded-md"
                  >
                    관악구 보기
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegion("mapo")}
                    className="px-4 py-2 text-sm font-medium text-realestate-brand-primary border border-realestate-brand-primary rounded-md"
                  >
                    마포구 보기
                  </button>
                </div>
              )
            }
          />
        )}

        {isSuccess && items.length > 0 && (
          <ul
            aria-label="매물 목록"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {items.map((listing) => (
              <li key={listing.id}>
                <Link href={`/listings/${listing.id}`} tabIndex={-1} aria-hidden="true">
                  <ListingCard
                    id={listing.id}
                    title={listing.title}
                    address={listing.address}
                    deposit={listing.deposit}
                    monthlyRent={listing.monthlyRent}
                    trustScore={listing.trustScore}
                    trustGrade={listing.trustGrade}
                    naturalLabel={listing.naturalLabel}
                    thumbnailUrl={listing.thumbnailUrl}
                    scoreBreakdown={listing.scoreBreakdown}
                    status={listing.status}
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
