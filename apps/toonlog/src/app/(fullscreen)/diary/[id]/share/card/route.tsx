/**
 * 공유 카드 이미지 생성 Route Handler.
 * GET /diary/[id]/share/card?ratio=1:1&preview=1&download=1
 * Satori로 서버사이드 렌더 — api/ 밖, 프론트 소유.
 *
 * 비율별 좌표: design-final §7.1 확정본
 * 워터마크/AI고지: design-final §8 (법무 필수)
 *
 * 의존:
 *   - @vercel/og (Satori wrapper) — ImageResponse
 *   - 백엔드 /api/diary/:id 에서 Diary 데이터
 */
import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";
import type { ShareRatio, Diary } from "@/lib/contract";
import { AI_DISCLOSURE_TEXT, WATERMARK_CONFIG, PREVIEW_SIZE } from "@/lib/constants";

export const runtime = "edge";

const SIZES: Record<ShareRatio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
};

async function fetchDiary(id: string): Promise<Diary | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const res = await fetch(`${baseUrl}/api/diary/${id}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.ok ? (json.data as Diary) : null;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  const { searchParams } = req.nextUrl;

  const ratioParam = searchParams.get("ratio") ?? "1:1";
  const ratio: ShareRatio =
    ratioParam === "16:9" || ratioParam === "9:16" ? ratioParam : "1:1";
  const isPreview = searchParams.has("preview");
  const isDownload = searchParams.has("download");

  const diary = await fetchDiary(id);

  if (!diary || diary.panels.length === 0) {
    return NextResponse.json({ error: "diary not found" }, { status: 404 });
  }

  const { w: fullW, h: fullH } = SIZES[ratio];
  const tier = (diary as unknown as { tier?: string }).tier ?? "free";
  const wmConfig =
    WATERMARK_CONFIG[tier as keyof typeof WATERMARK_CONFIG] ??
    WATERMARK_CONFIG.free;

  // 미리보기: PREVIEW_SIZE로 다운스케일
  const scale = isPreview ? PREVIEW_SIZE / fullW : 1;
  const W = Math.round(fullW * scale);
  const H = Math.round(fullH * scale);

  const panels = diary.panels.slice(0, 4);

  // 1:1 2×2 레이아웃
  const render1x1 = () => {
    const pad = Math.round(48 * scale);
    const gutter = Math.round(12 * scale);
    const cellW = Math.round((W - pad * 2 - gutter) / 2);
    const cellH = Math.round((H - pad * 2 - gutter - 60 * scale) / 2);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          background: "#FAF7F2",
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: gutter,
            flex: 1,
          }}
        >
          {panels.map((p) => (
            <img
              key={p.index}
              src={p.previewUrl ?? p.imageUrl}
              alt={p.caption ?? `${p.index}컷`}
              width={cellW}
              height={cellH}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ))}
        </div>
        {/* AI 고지 — 법무 필수, 전 티어 */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 8,
            fontSize: Math.round(10 * scale),
            color: "#6C757D",
            opacity: 0.85,
          }}
        >
          {AI_DISCLOSURE_TEXT}
        </div>
        {/* 워터마크 — tier 분기 */}
        {wmConfig.show && (
          <div
            style={{
              position: "absolute",
              bottom: Math.round(60 * scale),
              right: pad,
              background: "#FFE066",
              opacity: wmConfig.opacity,
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: Math.round(12 * scale),
              fontWeight: 700,
              color: "#1A1A1A",
            }}
          >
            툰일기
          </div>
        )}
      </div>
    );
  };

  // 16:9 1×4 가로
  const render16x9 = () => {
    const pad = Math.round(40 * scale);
    const gutter = Math.round(8 * scale);
    const cellW = Math.round((W - pad * 2 - gutter * 3) / 4);
    const cellH = H - pad * 2 - Math.round(40 * scale);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          background: "#FAF7F2",
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", gap: gutter, flex: 1 }}>
          {panels.map((p) => (
            <img
              key={p.index}
              src={p.previewUrl ?? p.imageUrl}
              alt={p.caption ?? `${p.index}컷`}
              width={cellW}
              height={cellH}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 8,
            fontSize: Math.round(10 * scale),
            color: "#6C757D",
            opacity: 0.85,
          }}
        >
          {AI_DISCLOSURE_TEXT}
        </div>
      </div>
    );
  };

  // 9:16 1×4 세로 + 상단 텍스트
  const render9x16 = () => {
    const pad = Math.round(40 * scale);
    const gutter = Math.round(8 * scale);
    const headerH = Math.round(80 * scale);
    const footerH = Math.round(40 * scale);
    const cellH = Math.round((H - pad * 2 - headerH - footerH - gutter * 3) / 4);
    const cellW = W - pad * 2;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: H,
          background: "#FAF7F2",
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단 날짜 + 제목 */}
        <div
          style={{
            height: headerH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(18 * scale),
            fontWeight: 700,
            color: "#1A1A1A",
          }}
        >
          툰일기
        </div>
        {/* 4컷 세로 배열 */}
        <div style={{ display: "flex", flexDirection: "column", gap: gutter, flex: 1 }}>
          {panels.map((p) => (
            <img
              key={p.index}
              src={p.previewUrl ?? p.imageUrl}
              alt={p.caption ?? `${p.index}컷`}
              width={cellW}
              height={cellH}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ))}
        </div>
        <div
          style={{
            height: footerH,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(10 * scale),
            color: "#6C757D",
            opacity: 0.85,
          }}
        >
          {AI_DISCLOSURE_TEXT}
        </div>
      </div>
    );
  };

  const element =
    ratio === "16:9"
      ? render16x9()
      : ratio === "9:16"
      ? render9x16()
      : render1x1();

  const headers: Record<string, string> = {
    "Content-Type": "image/png",
  };
  if (isDownload) {
    headers["Content-Disposition"] =
      `attachment; filename="toonlog-${id}-${ratio.replace(":", "x")}.png"`;
  }

  return new ImageResponse(element, {
    width: W,
    height: H,
    headers,
  });
}
