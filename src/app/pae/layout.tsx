import "./pae.css";
import type { ReactNode } from "react";
import SuitDefs from "@/components/pae/SuitDefs";
import MemphisBg from "@/components/pae/MemphisBg";

export const metadata = {
  title: "오후의 패 — 점심 한 판",
  description: "가입 없이 5분, 동료들과 즐기는 빅2 타일 카드게임",
};

export default function PaeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pae-shell">
      <SuitDefs />
      <MemphisBg />
      {children}
    </div>
  );
}
