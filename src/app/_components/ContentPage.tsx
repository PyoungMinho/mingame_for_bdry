// REDLINE: 타인 비교/외모 점수 UI 금지
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 정적 콘텐츠 페이지 공통 셸 — 소개/가이드/FAQ 공용.
 * privacy·terms와 동일한 브랜드(모눈종이 배경·∑ 로고·세리프 제목)로 일관성 유지.
 * 내부 링크가 풍부해야 크롤러가 사이트 구조를 이해한다(AdSense 심사·SEO에 유리).
 */

const FOOTER_LINKS = [
  { href: "/study", label: "학생 자습" },
  { href: "/exam", label: "강사용" },
  { href: "/about", label: "소개" },
  { href: "/guide", label: "가이드" },
  { href: "/faq", label: "FAQ" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
];

export function ContentPage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="graph-paper min-h-screen font-sans text-slate-800">
      <header className="border-b border-slate-200/80 bg-[#FAFAF7]/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="flex cursor-pointer items-center gap-2">
            <span className="font-serif text-2xl leading-none text-indigo-600">∑</span>
            <span className="text-lg font-bold tracking-tight text-slate-900">문제팩토리</span>
          </Link>
          <Link
            href="/study"
            className="inline-flex h-9 cursor-pointer items-center rounded-lg bg-indigo-600 px-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-indigo-700"
          >
            무료로 문제 풀기
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 md:py-16">
        <div className="mb-10">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            {title}
          </h1>
          {subtitle && <p className="mt-3 text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </main>

      <footer className="border-t border-slate-200 px-5 py-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex cursor-pointer items-center gap-2">
            <span className="font-serif text-xl leading-none text-indigo-600">∑</span>
            <span className="font-bold text-slate-900">문제팩토리</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {FOOTER_LINKS.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="cursor-pointer text-slate-500 transition-colors duration-200 hover:text-slate-900"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-xs text-slate-400">
          © 2026 문제팩토리 · 무료 자습은 광고로 운영됩니다
        </p>
      </footer>
    </div>
  );
}

/** 제목 + 본문 블록 (소개·가이드용) */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-8 first:border-0 first:pt-0">
      <h2 className="mb-3 font-serif text-xl font-bold text-slate-900 md:text-2xl">{title}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

/** 질문 + 답변 블록 (FAQ용) — 질문을 h2로 두어 검색·접근성에 유리 */
export function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <section className="border-t border-slate-200 pt-8 first:border-0 first:pt-0">
      <h2 className="mb-2 font-serif text-lg font-bold text-slate-900 md:text-xl">Q. {q}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
