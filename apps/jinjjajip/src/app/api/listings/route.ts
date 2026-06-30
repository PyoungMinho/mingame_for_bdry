/**
 * GET /api/listings
 * 매물 리스트 (신뢰순 정렬, 커서 페이지네이션).
 * getListings() RSC 레이어를 재사용 → 서버 정렬 보장.
 */

import { NextRequest, NextResponse } from "next/server";
import { getListings } from "@/lib/data/listings";
import { listingSearchQuerySchema } from "@/lib/validation";
import type { ListingSearchQuery } from "@/lib/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const raw = {
    region: searchParams.get("region") ?? undefined,
    buildingType: searchParams.get("buildingType") ?? undefined,
    minGrade: searchParams.get("minGrade") ?? undefined,
    depositMax: searchParams.get("depositMax") ?? undefined,
    rentMax: searchParams.get("rentMax") ?? undefined,
    sort: searchParams.get("sort") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  };

  const parsed = listingSearchQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message: "쿼리 파라미터가 올바르지 않습니다.", details: parsed.error.flatten() },
        meta: null,
      },
      { status: 400 }
    );
  }

  try {
    const result = await getListings(parsed.data as ListingSearchQuery);
    return NextResponse.json({
      success: true,
      data: result,
      error: null,
      meta: { cursor: result.nextCursor ?? null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "내부 서버 오류";
    return NextResponse.json(
      { success: false, data: null, error: { code: "INTERNAL_ERROR", message }, meta: null },
      { status: 500 }
    );
  }
}
