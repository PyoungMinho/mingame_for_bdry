import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import FindWizard from "./FindWizard";

interface FindPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: FindPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "find" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
    alternates: {
      languages: { en: "/find", ko: "/ko/find" },
    },
  };
}

export default async function FindPage({ params }: FindPageProps) {
  const { locale } = await params;

  return <FindWizard locale={locale} />;
}
