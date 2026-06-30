import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Data Sources — Tier.gg",
  description: "Where Tier.gg's benchmark and pricing data comes from.",
};

const SOURCES = [
  { name: "LMArena", url: "https://lmarena.ai", desc: "Human preference Elo scores" },
  { name: "Artificial Analysis", url: "https://artificialanalysis.ai", desc: "Speed, latency, and throughput" },
  { name: "HumanEval", url: "https://github.com/openai/human-eval", desc: "Coding benchmark" },
  { name: "GPQA", url: "https://github.com/idavidrein/gpqa", desc: "Graduate-level reasoning" },
  { name: "MMLU", url: "https://github.com/hendrycks/test", desc: "General knowledge" },
  { name: "Provider pricing pages", url: "https://openai.com/pricing", desc: "Official token pricing" },
];

export default async function SourcesPage({ params }: PageProps) {
  const { locale } = await params;
  const isKo = locale === "ko";
  const home = locale === "en" ? "/" : `/${locale}`;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-bold">{isKo ? "데이터 출처" : "Data Sources"}</h1>
      <p className="mt-4 text-muted-foreground">
        {isKo ? "벤치마크와 가격 데이터는 다음 공개 출처를 기반으로 합니다." : "Benchmark and pricing data is based on the following public sources."}
      </p>
      <ul className="mt-6 space-y-4">
        {SOURCES.map((s) => (
          <li key={s.name} className="rounded-lg border border-border bg-card p-4">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
              {s.name} ↗
            </a>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </li>
        ))}
      </ul>
      <Link href={home} className="mt-8 inline-block text-primary hover:underline">
        {isKo ? "← 홈으로" : "← Back to home"}
      </Link>
    </div>
  );
}
