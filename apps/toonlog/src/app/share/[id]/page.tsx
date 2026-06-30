/**
 * S+ 공개 OG 수신자용 공유 페이지 — /share/:id.
 * ux-spec §7.2. 공개, 탭바 없음.
 * 수신자(미인증)가 볼 수 있는 만화 + 앱 CTA.
 */
import type { Metadata } from "next";
import { SharedDiaryView } from "./_components/SharedDiaryView";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "툰일기 만화 보기",
    openGraph: {
      images: [
        {
          url: `/diary/${id}/share/card?ratio=1:1`,
          width: 1080,
          height: 1080,
          alt: "AI 4컷 만화",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      images: [`/diary/${id}/share/card?ratio=16:9`],
    },
  };
}

export default async function SharePublicPage({ params }: Props) {
  const { id } = await params;
  return <SharedDiaryView diaryId={id} />;
}
