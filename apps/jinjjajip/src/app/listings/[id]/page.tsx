import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Share2, Heart } from "lucide-react";
import { getListingById } from "@/lib/data/listings";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { ScoreBreakdown } from "@/components/trust/ScoreBreakdown";
import { ReportButton } from "./ReportButton";
import { formatDepositRent } from "@/lib/utils";

interface ListingDetailPageProps {
  params: { id: string };
}

export default async function ListingDetailPage({ params }: ListingDetailPageProps) {
  const listing = await getListingById(params.id);

  if (!listing) {
    notFound();
  }

  const isReported = listing.status === "reported";
  const isTakenDown = listing.status === "taken_down";

  if (isTakenDown) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-4 text-center bg-realestate-neutral-50">
        <p className="text-2xl font-serif font-bold text-realestate-neutral-900 mb-2">
          이 매물은 더 이상 없습니다
        </p>
        <p className="text-realestate-neutral-500 mb-6">
          거래 완료됐거나 허위매물로 내려갔을 수 있어요
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-realestate-brand-primary text-white rounded-md text-sm font-medium"
        >
          다른 매물 보기
        </Link>
      </div>
    );
  }

  const priceLabel = formatDepositRent(listing.deposit, listing.monthlyRent);
  const buildingLabel =
    listing.buildingType === "oneroom" ? "원룸" : "오피스텔";
  const regionLabel = listing.region === "gwanak" ? "관악구" : "마포구";

  return (
    <div className="min-h-dvh bg-white pb-24">
      {/* 신고됨 배너 */}
      {isReported && (
        <div
          role="alert"
          className="bg-realestate-amber-warn-bg border-b border-realestate-amber-warn-border px-4 py-3 text-sm text-realestate-amber-warn"
        >
          신고 검토 중입니다. 검토 기간 동안 문의가 제한됩니다.
        </div>
      )}

      {/* 오버레이 네비 */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 h-12 bg-white/90 backdrop-blur-sm border-b border-realestate-neutral-100">
        <Link
          href="/"
          aria-label="뒤로 가기"
          className="w-10 h-10 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
        >
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="공유하기"
            className="w-10 h-10 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
          >
            <Share2 size={20} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            aria-label="저장하기"
            className="w-10 h-10 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
          >
            <Heart size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 사진 갤러리 (블러 통과본만) */}
      {listing.photoUrls.length > 0 ? (
        <div
          className={`relative w-full aspect-video bg-realestate-neutral-100 ${isReported ? "opacity-50" : ""}`}
        >
          <Image
            src={listing.photoUrls[0]}
            alt={`${listing.title} 대표 사진`}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
          {listing.photoUrls.length > 1 && (
            <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
              1/{listing.photoUrls.length}
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-video bg-realestate-neutral-100 flex items-center justify-center">
          <span className="text-sm text-realestate-neutral-500">사진 없음</span>
        </div>
      )}

      <div className="px-4 pt-4 space-y-section-gap">
        {/* 신뢰 스코어 패널 */}
        <section aria-label="신뢰 스코어">
          <TrustScoreBadge
            grade={listing.trust.badgeAchieved}
            score={listing.trust.score}
            scoreIsLowerBound={listing.trust.isLowerBound}
            maxPossibleScore={listing.trust.maxPossible}
            naturalLabel={listing.naturalLabel}
            showDonut
            showScore
            variant="featured"
          />
        </section>

        {/* 점수 세부 분해 */}
        <section aria-label="항목별 신뢰 점수">
          <ScoreBreakdown items={listing.trust.breakdown} variant="detail" grade={listing.trust.badgeAchieved} />
        </section>

        {/* 매물 기본 정보 */}
        <section aria-label="매물 기본 정보" className="border-t border-realestate-neutral-200 pt-4">
          <h1 className="text-h2 font-serif text-realestate-neutral-900 mb-1">
            {listing.title}
          </h1>
          <p className="text-sm text-realestate-neutral-500 mb-3">
            {regionLabel} · {listing.address}
          </p>
          <p className="text-price font-serif font-bold text-realestate-neutral-900 mb-4 tabular-nums">
            {priceLabel}
          </p>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <div>
              <dt className="text-realestate-neutral-500">유형</dt>
              <dd className="font-medium text-realestate-neutral-900">{buildingLabel}</dd>
            </div>
            {listing.areaM2 && (
              <div>
                <dt className="text-realestate-neutral-500">면적</dt>
                <dd className="font-medium text-realestate-neutral-900">
                  {listing.areaM2}m²
                </dd>
              </div>
            )}
            {listing.floor && (
              <div>
                <dt className="text-realestate-neutral-500">층</dt>
                <dd className="font-medium text-realestate-neutral-900">{listing.floor}</dd>
              </div>
            )}
            {listing.agent && (
              <div>
                <dt className="text-realestate-neutral-500">중개사</dt>
                <dd className="font-medium text-realestate-neutral-900">
                  {listing.agent.name}
                  {listing.agent.verified && (
                    <span className="ml-1 text-xs text-green-600">(인증)</span>
                  )}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {listing.description && (
          <section aria-label="세입자 한마디" className="border-t border-realestate-neutral-200 pt-4">
            <h2 className="text-sm font-semibold text-realestate-neutral-700 mb-2">
              세입자 한마디
            </h2>
            <p className="text-sm text-realestate-neutral-700 leading-relaxed">
              {listing.description}
            </p>
          </section>
        )}

        {/* 신고하기 */}
        <div className="border-t border-realestate-neutral-200 pt-4 pb-2">
          <ReportButton
            listingId={listing.id}
            listingTitle={listing.title}
          />
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-realestate-neutral-200 px-4 py-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={isReported}
          aria-disabled={isReported}
          className="w-full h-14 bg-realestate-brand-primary text-white rounded-md text-base font-semibold disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
        >
          {isReported ? "신고 검토 중 — 문의 제한" : "문의하기"}
        </button>
      </div>
    </div>
  );
}
