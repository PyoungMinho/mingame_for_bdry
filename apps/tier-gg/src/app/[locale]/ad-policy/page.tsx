import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Ad Policy — Tier.gg",
  description: "Tier.gg advertising and sponsorship policy.",
};

export default async function AdPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  const isKo = locale === "ko";
  const home = locale === "en" ? "/" : `/${locale}`;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-bold">{isKo ? "광고 정책" : "Ad Policy"}</h1>
      <p className="mt-6 text-muted-foreground">
        {isKo
          ? "Tier.gg는 일부 영역에 광고를 표시할 수 있습니다. 광고는 모델 순위·점수에 영향을 주지 않습니다."
          : "Tier.gg may display ads in designated slots. Ads do not influence model rankings or scores."}
      </p>
      <ul className="mt-6 list-disc space-y-2 pl-6 text-sm text-muted-foreground">
        <li>{isKo ? "광고는 항상 'Sponsored' 라벨로 표기됩니다." : "Ads are always labeled as 'Sponsored'."}</li>
        <li>{isKo ? "벤치마크 점수는 광고주 영향을 받지 않습니다." : "Benchmark scores are not affected by advertisers."}</li>
        <li>{isKo ? "광고 문의: hello@tier.gg" : "Ad inquiries: hello@tier.gg"}</li>
      </ul>
      <Link href={home} className="mt-8 inline-block text-primary hover:underline">
        {isKo ? "← 홈으로" : "← Back to home"}
      </Link>
    </div>
  );
}
