/**
 * S5 4컷 결과 확인 페이지.
 * ux-spec §4 화면5 + design-final §7.2(뷰어=항상 2×2).
 * 서버 컴포넌트로 초기 데이터 패칭 + 클라이언트 액션.
 */
import type { Metadata } from "next";
import { DiaryViewer } from "./_components/DiaryViewer";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `만화 결과 · 툰일기`,
    openGraph: {
      images: [`/share/${id}/opengraph-image`],
    },
  };
}

export default async function DiaryResultPage({ params }: Props) {
  const { id } = await params;
  return <DiaryViewer diaryId={id} />;
}
