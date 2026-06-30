import { ImageResponse } from "@vercel/og";
import type { NextRequest } from "next/server";
import { mockModels } from "@/lib/data/mock-models";

export const runtime = "edge";

// 폰트는 빌드 시 ArrayBuffer로 임베드 (Next.js 15 edge runtime 지원)
// 실제 운영 시 Inter Bold + Regular 폰트 파일을 /public/fonts/ 에 배치
async function loadFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "home";
  const slug = searchParams.get("slug");
  const slugA = searchParams.get("a");
  const slugB = searchParams.get("b");
  const stack = searchParams.get("stack");
  const metric = searchParams.get("metric");

  // 1200×630 공통 스타일 (다크 베이스 + 그린 액센트)
  const bgColor = "#0d1117";
  const accentColor = "#22c55e";
  const textColor = "#f0f6fc";
  const mutedColor = "#8b949e";
  const cardBg = "#161b22";
  const borderColor = "#30363d";

  // 공통 레이아웃 wrapper
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "1200px",
        height: "630px",
        backgroundColor: bgColor,
        padding: "60px",
        fontFamily: "Inter, sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 배경 그라디언트 장식 */}
      <div
        style={{
          position: "absolute",
          top: "-100px",
          right: "-100px",
          width: "400px",
          height: "400px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}20, transparent 70%)`,
        }}
      />
      {/* 로고 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: "40px",
        }}
      >
        <span style={{ fontSize: "28px", fontWeight: 800, color: textColor }}>
          Tier
        </span>
        <span style={{ fontSize: "28px", fontWeight: 800, color: accentColor }}>
          .gg
        </span>
      </div>

      {children}

      {/* 하단 URL */}
      <div
        style={{
          position: "absolute",
          bottom: "40px",
          right: "60px",
          fontSize: "16px",
          color: mutedColor,
        }}
      >
        tier.gg
      </div>
    </div>
  );

  // type=model — 단일 모델 OG
  if (type === "model" && slug) {
    const model = mockModels.find((m) => m.slug === slug);
    if (!model) {
      return new ImageResponse(
        (
          <Wrapper>
            <div style={{ fontSize: "40px", fontWeight: 700, color: textColor }}>
              AI Model Not Found
            </div>
          </Wrapper>
        ),
        { width: 1200, height: 630 }
      );
    }

    return new ImageResponse(
      (
        <Wrapper>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "18px", color: mutedColor }}>{model.providerSlug}</div>
            <div
              style={{
                fontSize: "56px",
                fontWeight: 800,
                color: textColor,
                lineHeight: 1.1,
              }}
            >
              {model.name}
            </div>
          </div>

          {/* 스펙 카드 그리드 */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              marginTop: "40px",
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "Input", value: model.attrs.priceInput != null ? `$${model.attrs.priceInput}/1M` : "N/A" },
              { label: "Output", value: model.attrs.priceOutput != null ? `$${model.attrs.priceOutput}/1M` : "N/A" },
              { label: "Context", value: model.attrs.contextWindow ? `${model.attrs.contextWindow}K` : "N/A" },
              ...(model.scores.mmlu != null
                ? [{ label: "MMLU", value: String(model.scores.mmlu) }]
                : []),
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  backgroundColor: cardBg,
                  border: `1px solid ${borderColor}`,
                  borderRadius: "12px",
                  padding: "20px 28px",
                }}
              >
                <span style={{ fontSize: "14px", color: mutedColor }}>{item.label}</span>
                <span style={{ fontSize: "28px", fontWeight: 700, color: accentColor }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "auto", fontSize: "18px", color: mutedColor }}>
            Compare AI models at tier.gg
          </div>
        </Wrapper>
      ),
      { width: 1200, height: 630 }
    );
  }

  // type=compare — 비교 OG
  if (type === "compare" && slugA && slugB) {
    const modelA = mockModels.find((m) => m.slug === slugA);
    const modelB = mockModels.find((m) => m.slug === slugB);
    const nameA = modelA?.name ?? slugA;
    const nameB = modelB?.name ?? slugB;

    return new ImageResponse(
      (
        <Wrapper>
          <div
            style={{
              fontSize: "20px",
              color: mutedColor,
              marginBottom: "16px",
            }}
          >
            Side-by-Side Comparison
          </div>

          {/* 모델명 vs 레이아웃 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "32px",
              flex: 1,
            }}
          >
            {/* 모델 A */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: "16px",
                padding: "32px",
              }}
            >
              <span style={{ fontSize: "14px", color: mutedColor }}>
                {modelA?.providerSlug ?? ""}
              </span>
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: textColor,
                  marginTop: "8px",
                  lineHeight: 1.1,
                }}
              >
                {nameA}
              </span>
              {modelA?.attrs.priceInput != null && (
                <span style={{ fontSize: "18px", color: accentColor, marginTop: "12px" }}>
                  ${modelA.attrs.priceInput}/1M input
                </span>
              )}
            </div>

            {/* VS */}
            <div
              style={{
                fontSize: "32px",
                fontWeight: 800,
                color: accentColor,
                flexShrink: 0,
              }}
            >
              VS
            </div>

            {/* 모델 B */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: "16px",
                padding: "32px",
              }}
            >
              <span style={{ fontSize: "14px", color: mutedColor }}>
                {modelB?.providerSlug ?? ""}
              </span>
              <span
                style={{
                  fontSize: "36px",
                  fontWeight: 800,
                  color: textColor,
                  marginTop: "8px",
                  lineHeight: 1.1,
                }}
              >
                {nameB}
              </span>
              {modelB?.attrs.priceInput != null && (
                <span style={{ fontSize: "18px", color: accentColor, marginTop: "12px" }}>
                  ${modelB.attrs.priceInput}/1M input
                </span>
              )}
            </div>
          </div>

          <div style={{ marginTop: "24px", fontSize: "16px", color: mutedColor }}>
            Full comparison at tier.gg
          </div>
        </Wrapper>
      ),
      { width: 1200, height: 630 }
    );
  }

  // type=find — 위저드 결과 OG
  if (type === "find" && stack) {
    return new ImageResponse(
      (
        <Wrapper>
          <div style={{ fontSize: "20px", color: mutedColor, marginBottom: "16px" }}>
            AI Model Recommendation
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.2,
            }}
          >
            Best AI for
          </div>
          <div
            style={{
              fontSize: "48px",
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1.2,
              marginBottom: "32px",
            }}
          >
            {decodeURIComponent(stack)}
          </div>
          <div style={{ fontSize: "18px", color: mutedColor }}>
            Find your perfect AI model at tier.gg/find
          </div>
        </Wrapper>
      ),
      { width: 1200, height: 630 }
    );
  }

  // default — 홈 OG
  return new ImageResponse(
    (
      <Wrapper>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "24px", color: accentColor, fontWeight: 600 }}>
            AI Model Rankings & Comparisons
          </div>
          <div
            style={{
              fontSize: "60px",
              fontWeight: 800,
              color: textColor,
              lineHeight: 1.1,
            }}
          >
            Find the right AI model — instantly.
          </div>
          <div style={{ fontSize: "22px", color: mutedColor, marginTop: "8px" }}>
            Compare LLMs by performance, pricing, and benchmarks.
          </div>
        </div>
      </Wrapper>
    ),
    { width: 1200, height: 630 }
  );
}
