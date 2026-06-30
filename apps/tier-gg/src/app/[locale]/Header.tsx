"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";

interface HeaderProps {
  locale: string;
}

export default function Header({ locale }: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [isDark, setIsDark] = useState(false);

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  const navLinks = [
    { href: localePath("/models"), label: t("models") },
    { href: localePath("/find"), label: t("find") },
    { href: localePath("/leaderboard/overall"), label: t("leaderboard") },
  ];

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (searchValue.trim()) {
        router.push(
          `${localePath("/models")}?q=${encodeURIComponent(searchValue.trim())}`
        );
      }
    },
    [searchValue, router, locale]
  );

  const toggleTheme = useCallback(() => {
    const html = document.documentElement;
    const next = !html.classList.contains("dark");
    html.classList.toggle("dark", next);
    localStorage.setItem("tier-gg-theme", next ? "dark" : "light");
    setIsDark(next);
  }, []);

  const switchLocale = locale === "en" ? "/ko" + pathname : pathname.replace(/^\/ko/, "") || "/";

  return (
    <header className="sticky top-0 z-50 h-[60px] border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-4 px-4">
        {/* 로고 */}
        <Link
          href={localePath("/")}
          className="flex-shrink-0 text-xl font-bold tracking-tight text-foreground hover:text-primary"
          aria-label="Tier.gg — Home"
        >
          Tier<span className="text-primary">.gg</span>
        </Link>

        {/* 검색창 */}
        <form
          onSubmit={handleSearch}
          className="relative flex flex-1 max-w-md"
          role="search"
        >
          <label htmlFor="global-search" className="sr-only">
            {t("searchPlaceholder")}
          </label>
          <input
            id="global-search"
            type="search"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            autoComplete="off"
          />
          <button
            type="submit"
            className="sr-only"
            aria-label="Search"
          >
            Search
          </button>
        </form>

        {/* 내비게이션 링크 */}
        <nav aria-label="Primary navigation">
          <ul className="hidden items-center gap-1 md:flex" role="list">
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="rounded px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-current={pathname === href ? "page" : undefined}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-shrink-0 items-center gap-2">
          {/* 언어 토글 */}
          <Link
            href={switchLocale}
            className="rounded border border-input px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t("switchLanguage")}
          >
            {locale === "en" ? "KO" : "EN"}
          </Link>

          {/* 다크모드 토글 */}
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded border border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={t("toggleTheme")}
            type="button"
          >
            <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
