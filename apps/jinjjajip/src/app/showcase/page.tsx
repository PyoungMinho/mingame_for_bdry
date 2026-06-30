/**
 * [임시] 디자인 쇼케이스 — 에디토리얼 럭셔리 리스킨 비주얼 확인용.
 * 실데이터(Supabase) 없이 신뢰 컴포넌트를 목 데이터로 렌더한다.
 * ⚠️ 비주얼 확인 후 삭제 예정. 프로덕션 라우트 아님.
 */

import { ListingCard } from "@/components/listing/ListingCard";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { ScoreBreakdown } from "@/components/trust/ScoreBreakdown";
import { TrustDonut } from "@/components/trust/TrustDonut";
import type { ScoreBreakdownItem } from "@/lib/types/domain";

const U1 = "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=640&q=80";
const U2 = "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=640&q=80";
const U3 = "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=640&q=80";

const goldBreakdown: ScoreBreakdownItem[] = [
  { key: "photo", earned: 35, max: 35, status: "verified" },
  { key: "exif", earned: 18, max: 20, status: "verified" },
  { key: "community", earned: 18, max: 20, status: "verified" },
  { key: "owner", earned: 12, max: 15, status: "verified" },
  { key: "transaction", earned: 8, max: 10, status: "verified" },
]; // 91 → gold

const silverBreakdown: ScoreBreakdownItem[] = [
  { key: "photo", earned: 28, max: 35, status: "verified" },
  { key: "exif", earned: 14, max: 20, status: "verified" },
  { key: "community", earned: 12, max: 20, status: "verified" },
  { key: "owner", earned: null, max: 15, status: "pending" },
  { key: "transaction", earned: 8, max: 10, status: "verified" },
]; // 62 → silver, owner pending

const unverifiedBreakdown: ScoreBreakdownItem[] = [
  { key: "photo", earned: 20, max: 35, status: "verified" },
  { key: "exif", earned: null, max: 20, status: "pending" },
  { key: "community", earned: 12, max: 20, status: "verified" },
  { key: "owner", earned: null, max: 15, status: "pending" },
  { key: "transaction", earned: 8, max: 10, status: "verified" },
]; // 40 → unverified

const processingBreakdown: ScoreBreakdownItem[] = [
  { key: "photo", earned: null, max: 35, status: "processing" },
  { key: "exif", earned: null, max: 20, status: "processing" },
  { key: "community", earned: 16, max: 20, status: "verified" },
  { key: "owner", earned: 12, max: 15, status: "verified" },
  { key: "transaction", earned: 8, max: 10, status: "verified" },
];

const listings = [
  {
    id: "d1",
    title: "관악구 봉천동 신축 분리형 원룸",
    address: "서울 관악구 봉천동",
    deposit: 1000,
    monthlyRent: 55,
    trustScore: 91,
    trustGrade: "gold" as const,
    naturalLabel: "실거주 세입자가 직접 찍은 사진이 검증됐어요",
    thumbnailUrl: U1,
    scoreBreakdown: goldBreakdown,
    status: "verified" as const,
  },
  {
    id: "d2",
    title: "마포구 망원동 투룸 오피스텔",
    address: "서울 마포구 망원동",
    deposit: 2000,
    monthlyRent: 80,
    trustScore: 62,
    trustGrade: "silver" as const,
    naturalLabel: "현장에서 촬영한 사진이 있어요",
    thumbnailUrl: U2,
    scoreBreakdown: silverBreakdown,
    status: "verified" as const,
  },
  {
    id: "d3",
    title: "관악구 신림동 반지하 원룸",
    address: "서울 관악구 신림동",
    deposit: 500,
    monthlyRent: 45,
    trustScore: 40,
    trustGrade: "unverified" as const,
    naturalLabel: "아직 현장 검증이 되지 않은 매물이에요",
    thumbnailUrl: null,
    scoreBreakdown: unverifiedBreakdown,
    status: "pending" as const,
  },
  {
    id: "d4",
    title: "마포구 합정동 복층 오피스텔",
    address: "서울 마포구 합정동",
    deposit: 3000,
    monthlyRent: 95,
    trustScore: 85,
    trustGrade: "gold" as const,
    naturalLabel: "사진 분석이 진행 중이에요",
    thumbnailUrl: U3,
    scoreBreakdown: processingBreakdown,
    status: "processing" as const,
  },
];

function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-h3 font-serif text-realestate-neutral-900">{children}</h2>
      {sub && <p className="text-body-s text-realestate-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ShowcasePage() {
  return (
    <div className="min-h-dvh bg-realestate-neutral-50 pb-16">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-realestate-neutral-200 px-5 h-14 flex items-center justify-between">
        <span className="text-xl font-serif font-bold text-realestate-brand-primary tracking-tight">
          진짜집
        </span>
        <span className="text-body-s text-realestate-neutral-500">디자인 쇼케이스</span>
      </header>

      <div className="px-5 py-8 max-w-md mx-auto space-y-12">
        {/* 0. 타이포 헤드라인 */}
        <section>
          <p className="text-body-s text-realestate-brand-sub font-medium mb-2 tracking-wide">
            EDITORIAL LUXURY · HAHMLET + PRETENDARD
          </p>
          <h1 className="text-h1 font-serif text-realestate-neutral-900 leading-tight">
            허위매물 없는
            <br />
            진짜 매물만.
          </h1>
          <p className="text-body-m text-realestate-neutral-700 mt-3 leading-relaxed">
            세입자가 직접 찍어 검증한 사진. 신뢰 점수로 한눈에.
          </p>
        </section>

        {/* 1. 신뢰 배지 featured + 도넛 */}
        <section>
          <SectionTitle sub="등급별 배지 · 도넛 차트 · 색+형태 이중코드">
            신뢰 배지
          </SectionTitle>
          <div className="space-y-3">
            <TrustScoreBadge grade="gold" score={91} variant="featured" showDonut showScore />
            <TrustScoreBadge grade="silver" score={62} variant="featured" showDonut showScore />
            <TrustScoreBadge grade="unverified" score={40} variant="featured" showDonut showScore />
          </div>
          <div className="flex items-center gap-6 mt-6 justify-center">
            <div className="flex flex-col items-center gap-1">
              <TrustDonut score={91} grade="gold" size="medium" showScore />
              <span className="text-trust-desc text-realestate-neutral-500">Gold</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrustDonut score={62} grade="silver" size="medium" showScore />
              <span className="text-trust-desc text-realestate-neutral-500">Silver</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <TrustDonut score={40} grade="unverified" size="medium" showScore />
              <span className="text-trust-desc text-realestate-neutral-500">미인증</span>
            </div>
          </div>
        </section>

        {/* 2. 매물 카드 피드 */}
        <section>
          <SectionTitle sub="신뢰 배지가 가격보다 시각 우선 · 미인증=점선+앰버">
            매물 카드
          </SectionTitle>
          <ul className="grid gap-4">
            {listings.map((l) => (
              <li key={l.id}>
                <ListingCard
                  id={l.id}
                  title={l.title}
                  address={l.address}
                  deposit={l.deposit}
                  monthlyRent={l.monthlyRent}
                  trustScore={l.trustScore}
                  trustGrade={l.trustGrade}
                  naturalLabel={l.naturalLabel}
                  thumbnailUrl={l.thumbnailUrl}
                  scoreBreakdown={l.scoreBreakdown}
                  status={l.status}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* 3. 상세 점수 분해 */}
        <section>
          <SectionTitle sub="5대 항목 · pending은 0점 아님(검증 대기)">
            항목별 신뢰 점수 (상세)
          </SectionTitle>
          <div className="bg-white rounded-lg border border-realestate-neutral-200 shadow-card-trust p-5">
            <ScoreBreakdown items={silverBreakdown} variant="detail" grade="silver" />
          </div>
        </section>
      </div>
    </div>
  );
}
