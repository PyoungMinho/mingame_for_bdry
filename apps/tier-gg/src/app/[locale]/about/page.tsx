import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "About — Tier.gg",
  description: "About Tier.gg — AI model rankings and comparison platform.",
};

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const isKo = locale === "ko";
  const home = locale === "en" ? "/" : `/${locale}`;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-bold">{isKo ? "Tier.gg 소개" : "About Tier.gg"}</h1>
      <p className="mt-6 text-muted-foreground">
        {isKo
          ? "Tier.gg는 AI 모델의 성능, 가격, 활용 분야를 한곳에서 비교하는 랭킹 플랫폼입니다."
          : "Tier.gg is a ranking platform that compares AI model performance, pricing, and use cases in one place."}
      </p>
      <p className="mt-4 text-muted-foreground">
        {isKo
          ? "데이터는 공개 벤치마크(LMArena, HumanEval, GPQA, MMLU 등)와 각 제공자의 공식 가격을 기준으로 합니다."
          : "Data is sourced from public benchmarks (LMArena, HumanEval, GPQA, MMLU) and official provider pricing."}
      </p>
      <Link href={home} className="mt-8 inline-block text-primary hover:underline">
        {isKo ? "← 홈으로" : "← Back to home"}
      </Link>
    </div>
  );
}
