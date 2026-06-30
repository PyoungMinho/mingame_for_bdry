/**
 * S6 말풍선 에디터 — P1.
 * ux-spec §6 + design-final §5.1(react-konva, 48px 핸들).
 * react-konva는 SSR 불가 → dynamic import ssr:false.
 * 기본형 구현: 말풍선 추가/이동/텍스트 편집 (제스처 7종은 P1 완성 시).
 */
import type { Metadata } from "next";
import { BalloonEditor } from "./_components/BalloonEditor";

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "말풍선 편집 · 툰일기",
};

export default async function EditPage({ params }: Props) {
  const { id } = await params;
  return <BalloonEditor diaryId={id} />;
}
