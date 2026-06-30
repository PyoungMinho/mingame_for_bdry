import type { Metadata } from "next";
import Link from "next/link";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const metadata: Metadata = {
  title: "Changelog — Tier.gg",
  description: "Recent updates to Tier.gg model rankings and data.",
};

const ENTRIES = [
  { date: "2026-05-26", text: "GPT-4o input price updated — $5.00 → $2.50 / 1M tokens", url: "https://openai.com/pricing" },
  { date: "2026-05-24", text: "Claude Opus 4.7 added to the database", url: "https://anthropic.com" },
  { date: "2026-05-23", text: "LMArena Elo scores updated (2026-05-23 snapshot)", url: "https://lmarena.ai" },
  { date: "2026-05-20", text: "Gemini 2.0 Pro context window expanded", url: "https://ai.google.dev" },
  { date: "2026-05-18", text: "Llama 3.3 70B HumanEval score updated via Artificial Analysis", url: "https://artificialanalysis.ai" },
];

export default async function ChangelogPage({ params }: PageProps) {
  const { locale } = await params;
  const isKo = locale === "ko";
  const home = locale === "en" ? "/" : `/${locale}`;
  return (
    <div className="mx-auto max-w-[800px] px-4 py-12">
      <h1 className="text-3xl font-bold">{isKo ? "변경 이력" : "Changelog"}</h1>
      <ul className="mt-6 divide-y divide-border" role="list">
        {ENTRIES.map((e) => (
          <li key={e.date + e.text} className="flex items-start justify-between gap-4 py-4">
            <div>
              <time dateTime={e.date} className="text-xs text-muted-foreground">{e.date}</time>
              <p className="text-sm">{e.text}</p>
            </div>
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 text-xs text-primary hover:underline">
              {isKo ? "출처" : "Source"} ↗
            </a>
          </li>
        ))}
      </ul>
      <Link href={home} className="mt-8 inline-block text-primary hover:underline">
        {isKo ? "← 홈으로" : "← Back to home"}
      </Link>
    </div>
  );
}
