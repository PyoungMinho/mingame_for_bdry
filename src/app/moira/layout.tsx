import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "모이라 — 공평한 중간지점 약속" },
  description:
    "친구·동료와 만날 때 모두에게 공평한 중간 지점을 추천하고, 카톡으로 무가입 투표해 약속을 확정하세요.",
  openGraph: {
    title: "모이라 — 모두에게 공평한 중간 지점",
    description: "최적 중간역 + 멤버별 이동시간 공평성 한눈에. 카톡으로 무가입 투표하고 약속 확정.",
    type: "website",
    locale: "ko_KR",
  },
};

export default function MoiraLayout({ children }: { children: React.ReactNode }) {
  return children;
}
