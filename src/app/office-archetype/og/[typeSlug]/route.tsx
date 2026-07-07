import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { OgIcon } from "../ogIcons";
import { findMatchType, findTypeBySlug } from "../../lib/score";
import configData from "../../data/config.json";
import typesData from "../../data/types.json";
import type { OaConfig, TypesData } from "../../lib/types";

export const runtime = "edge";

const config = configData as OaConfig;
const types = (typesData as TypesData).types;

/**
 * 공유 카드 OG 이미지 (design-final §5, D4: next/og ImageResponse route handler 단일 채택).
 * `?ratio=1x1`(기본, 1200x1200) | `?ratio=9x16`(1080x1920, 인스타 스토리).
 *
 * ⚠️ 폰트 리스크(R6 인접): design-final §5는 Paperlogy 폰트 파일을 `public/fonts/`에
 * 로컬 포함해 ImageResponse `fonts` 옵션으로 주입하라고 명시하지만, 이 저장소에는 아직
 * 해당 폰트 파일 자산이 없다(oa.css의 Paperlogy CDN @import도 현재 404 — 별도 자산 작업 필요).
 * 폰트 자산이 준비되기 전까지는 satori/edge 기본 sans-serif로 폴백 렌더링한다.
 * 자산이 추가되면 이 파일의 `fonts` 옵션만 채우면 된다(레이아웃 변경 불필요).
 */
export function GET(request: NextRequest, { params }: { params: { typeSlug: string } }) {
  const type = findTypeBySlug(params.typeSlug, types);
  if (!type) {
    return new Response("Not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const ratio = searchParams.get("ratio") === "9x16" ? "9x16" : "1x1";
  const matchType = findMatchType(type, types);
  // 실제 배포 도메인(CLAUDE.md 배포 모델): project-orsrw.vercel.app/office-archetype
  const watermark = "project-orsrw.vercel.app/office-archetype";

  if (ratio === "9x16") {
    return new ImageResponse(
      (
        <StoryCard type={type} matchType={matchType} watermark={watermark} title={config.title} />
      ),
      { width: 1080, height: 1920 },
    );
  }

  return new ImageResponse(
    (
      <SquareCard type={type} matchType={matchType} watermark={watermark} />
    ),
    { width: 1200, height: 1200 },
  );
}

function SquareCard({
  type,
  matchType,
  watermark,
}: {
  type: NonNullable<ReturnType<typeof findTypeBySlug>>;
  matchType: ReturnType<typeof findMatchType>;
  watermark: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: type.color.tint,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* 우상단 장식 원 (§5-1) */}
      <div
        style={{
          position: "absolute",
          top: -140,
          right: -140,
          width: 420,
          height: 420,
          borderRadius: 9999,
          background: type.color.solid,
          opacity: 0.15,
          display: "flex",
        }}
      />

      {/* 워드마크 (§5-1: 80,72) */}
      <div
        style={{
          position: "absolute",
          top: 72,
          left: 80,
          fontSize: 20,
          fontWeight: 800,
          letterSpacing: 2,
          color: type.color.deep,
          display: "flex",
        }}
      >
        OFFICE ARCHETYPE
      </div>

      {/* 아이콘 배지 (§5-1: center,y260,⌀200) */}
      <div
        style={{
          marginTop: 260,
          width: 200,
          height: 200,
          borderRadius: 9999,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <OgIcon icon={type.icon} size={120} color={type.color.solid} strokeWidth={2.25} />
      </div>

      {/* 유형명 (§5-1: 72px/800) */}
      <div
        style={{
          marginTop: 40,
          fontSize: 72,
          fontWeight: 800,
          color: "#1C2333",
          display: "flex",
        }}
      >
        {type.name}
      </div>

      {/* 태그라인 (§5-1: 32px, 최대2줄, 중앙) */}
      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          color: "#4B5468",
          textAlign: "center",
          width: 900,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {type.tagline}
      </div>

      {/* 상성 배지 (§5-1) */}
      {matchType ? (
        <div
          style={{
            marginTop: 48,
            width: 720,
            minHeight: 100,
            borderRadius: 24,
            background: "rgba(255,255,255,0.9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 700,
            color: "#1C2333",
            padding: "0 32px",
          }}
        >
          {`찰떡궁합: ${matchType.name}`}
        </div>
      ) : null}

      {/* CTA 바 (§5-1: 0,1080,1200,120) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 1200,
          height: 120,
          background: "#2B3556",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 26,
          fontWeight: 700,
          color: "#FFFFFF",
        }}
      >
        {`나도 테스트하기 → ${watermark}`}
      </div>
    </div>
  );
}

function StoryCard({
  type,
  matchType,
  watermark,
  title,
}: {
  type: NonNullable<ReturnType<typeof findTypeBySlug>>;
  matchType: ReturnType<typeof findMatchType>;
  watermark: string;
  title: string;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: type.color.tint,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {/* 상단 세이프존(0~250) 비움 — 워드마크는 260부터 */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 90,
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
          color: type.color.deep,
          display: "flex",
        }}
      >
        OFFICE ARCHETYPE
      </div>

      <div
        style={{
          marginTop: 460,
          width: 260,
          height: 260,
          borderRadius: 9999,
          background: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <OgIcon icon={type.icon} size={160} color={type.color.solid} strokeWidth={2.25} />
      </div>

      <div
        style={{
          marginTop: 70,
          fontSize: 88,
          fontWeight: 800,
          color: "#1C2333",
          display: "flex",
        }}
      >
        {type.name}
      </div>

      <div
        style={{
          marginTop: 32,
          fontSize: 36,
          color: "#4B5468",
          textAlign: "center",
          width: 820,
          display: "flex",
          justifyContent: "center",
        }}
      >
        {type.tagline}
      </div>

      {matchType ? (
        <div
          style={{
            marginTop: 60,
            width: 880,
            minHeight: 260,
            borderRadius: 24,
            background: "#FFFFFF",
            boxShadow: "0 10px 24px rgba(28,35,51,0.16)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
          }}
        >
          <div style={{ fontSize: 26, fontWeight: 700, color: "#8A93A6", display: "flex" }}>
            찰떡궁합
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: 36,
              fontWeight: 800,
              color: "#1C2333",
              display: "flex",
            }}
          >
            {matchType.name}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 24,
              color: "#4B5468",
              textAlign: "center",
              display: "flex",
            }}
          >
            {type.matchBestReason}
          </div>
        </div>
      ) : null}

      <div
        style={{
          marginTop: 60,
          fontSize: 40,
          fontWeight: 700,
          color: "#2B3556",
          display: "flex",
        }}
      >
        나도 내 유형 확인하기 →
      </div>

      {/* 하단 세이프존(1640~1920) 위 워터마크 */}
      <div
        style={{
          position: "absolute",
          bottom: 300,
          fontSize: 20,
          color: "#8A93A6",
          display: "flex",
        }}
      >
        {`${title} · ${watermark}`}
      </div>
    </div>
  );
}
