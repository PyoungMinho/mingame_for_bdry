/**
 * S1 랜딩 페이지 — 공개, 풀와이드 마케팅.
 * 서버 컴포넌트. 소셜 로그인 CTA는 클라이언트 위임.
 */
import type { Metadata } from "next";
import { LandingHero } from "./_components/LandingHero";

export const metadata: Metadata = {
  title: "툰일기 — 내 이야기가 만화가 되는 곳",
  description:
    "일기 한 편을 AI가 4컷 만화로. 누구나 만화 작가가 될 수 있다. 화풍 4종, 나만의 아바타, SNS 공유.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-base)]">
      <LandingHero />
    </div>
  );
}
