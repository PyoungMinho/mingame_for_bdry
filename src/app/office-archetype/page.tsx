"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ThemeToggle, TypeIcon } from "./_components";
import { useOaTheme } from "./lib/useOaTheme";
import { useSocialProofCount } from "./lib/useSocialProofCount";
import configData from "./data/config.json";
import typesData from "./data/types.json";
import type { OaConfig, TypesData } from "./lib/types";

const config = configData as OaConfig;
const types = (typesData as TypesData).types;

/**
 * 화면 1 — 랜딩/인트로 (design-final §1 화면1).
 * 목표: 3초 안에 "직장인용 · 10문항 · 1분 · 무료" 이해 + "MBTI 아님" 차별화 각인 + 시작 전환.
 * 인터랙션(테마 토글) 때문에 전체를 클라이언트 컴포넌트로 둔다 — 정적 JSON은 빌드타임 import라
 * 런타임 fetch/로딩 상태가 필요 없다(design-final §1-0).
 */
export default function OfficeArchetypeLandingPage() {
  const { theme, toggle } = useOaTheme();
  const count = useSocialProofCount(config.socialProof);

  const socialProofText =
    config.labels.socialProofTemplate?.replace("{count}", count.toLocaleString("ko-KR")) ??
    `지금까지 ${count.toLocaleString("ko-KR")}명 참여`;

  return (
    <div className="oa-container">
      <header className="oa-header">
        <span aria-hidden="true" />
        <ThemeToggle theme={theme} onToggle={toggle} />
      </header>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: 40 }}>
        {/* 8유형 아이콘 티저 그리드 — blur(6px) + opacity .5, 컬러/아이콘은 전부 types.json에서 주입 */}
        <div className="oa-teaser-grid" aria-hidden="true">
          {types.map((type) => (
            <div
              key={type.id}
              className="oa-teaser-grid-item"
              style={{ "--oa-type-tint": type.color.tint } as React.CSSProperties}
            >
              <TypeIcon icon={type.icon} size={22} color={type.color.solid} strokeWidth={2.5} />
            </div>
          ))}
        </div>

        <h1 className="oa-text-hero oa-rise oa-rise-1">{config.labels.heroLanding ?? config.title}</h1>
        <p className="oa-text-body-sm oa-rise oa-rise-1" style={{ marginTop: 8 }}>
          {config.labels.subLanding1 ?? "10문항 · 1분 · 100% 무료"}
        </p>

        <p className="oa-text-body oa-rise oa-rise-2" style={{ marginTop: 20 }}>
          {config.labels.subLanding2 ?? "MBTI 말고,"}
          <br />
          {config.labels.subLanding3 ?? "진짜 회사에서의 내 모습"}
        </p>

        <div className="oa-rise oa-rise-3" style={{ marginTop: 32 }}>
          <Link href="/office-archetype/test" className="oa-btn-primary">
            {config.labels.start}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <p className="oa-social-proof">{socialProofText}</p>
        </div>
      </main>
    </div>
  );
}
