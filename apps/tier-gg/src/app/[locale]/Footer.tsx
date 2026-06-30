import Link from "next/link";
import { getTranslations } from "next-intl/server";

interface FooterProps {
  locale: string;
}

export default async function Footer({ locale }: FooterProps) {
  const t = await getTranslations({ locale, namespace: "footer" });

  const localePath = (path: string) =>
    locale === "en" ? path : `/${locale}${path}`;

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-[1200px] px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 링크 모음 */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground" role="list">
              <li>
                <Link
                  href={localePath("/about")}
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("about")}
                </Link>
              </li>
              <li>
                <Link
                  href={localePath("/sources")}
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("dataSources")}
                </Link>
              </li>
              <li>
                <Link
                  href={localePath("/changelog")}
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("changelog")}
                </Link>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("admin")}
                </Link>
              </li>
              <li>
                <Link
                  href={localePath("/ad-policy")}
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("adPolicy")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/tier-gg/data"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t("githubPR")} ↗
                </a>
              </li>
            </ul>
          </nav>

          {/* 카피라이트 */}
          <p className="text-xs text-muted-foreground">{t("copyright")}</p>
        </div>

        {/* 면책 고지 */}
        <p className="mt-4 text-xs text-muted-foreground/70">
          {t("disclaimer")}
        </p>
      </div>
    </footer>
  );
}
