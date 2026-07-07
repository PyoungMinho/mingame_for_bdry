import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ResultView from "./ResultView";
import { findTypeBySlug } from "../../lib/score";
import configData from "../../data/config.json";
import typesData from "../../data/types.json";
import type { OaConfig, TypesData } from "../../lib/types";

const config = configData as OaConfig;
const types = (typesData as TypesData).types;

interface PageParams {
  params: { typeSlug: string };
}

/** 8유형 전량 정적 생성 (design-final D5, §7-1 체크리스트). */
export function generateStaticParams() {
  return types.map((type) => ({ typeSlug: type.id }));
}

/** 유형별 OG/twitter 메타 (design-final §7-2) — og/[typeSlug] route handler가 실제 이미지를 생성. */
export function generateMetadata({ params }: PageParams): Metadata {
  const type = findTypeBySlug(params.typeSlug, types);
  if (!type) return {};

  const title = `${type.name} 〈${type.alias}〉 | ${config.title}`;
  const description = type.tagline;
  const ogImageUrl = `/office-archetype/og/${type.id}`;

  return {
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ko_KR",
      images: [{ url: ogImageUrl, width: 1200, height: 1200 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function OfficeArchetypeResultPage({ params }: PageParams) {
  const type = findTypeBySlug(params.typeSlug, types);
  if (!type) notFound();

  return <ResultView type={type} />;
}
