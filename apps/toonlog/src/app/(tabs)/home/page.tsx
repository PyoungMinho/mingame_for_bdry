/**
 * S2 홈 대시보드 — 스트릭/QuotaChip + 최근 만화 3편 + FAB.
 * 탭바 있음. ux-spec §4 화면3 기반.
 * 서버 컴포넌트 (초기 데이터) + 클라이언트 최근 목록.
 */
import type { Metadata } from "next";
import { HomeDashboard } from "./_components/HomeDashboard";

export const metadata: Metadata = {
  title: "홈 · 툰일기",
};

export default function HomePage() {
  return <HomeDashboard />;
}
