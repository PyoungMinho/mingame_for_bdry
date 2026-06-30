/**
 * GET /api/v1/search
 * 모델명 prefix 매칭 검색
 * Rate limit: 30 req/min (운영 시 미들웨어 추가 예정)
 *
 * Query:
 *   q     — 검색어 (최소 1자, 최대 100자)
 *   limit — 반환 수 (기본 10, 최대 20)
 */
import { NextRequest } from "next/server";
import { isMockMode, supabaseAdmin } from "@/lib/supabase/server";
import { SearchQuerySchema } from "@/lib/api/schemas";
import { ok, Errors } from "@/lib/api/response";
import { mockModels } from "@/lib/data/mock-models";
import { adaptModelToSummary } from "@/lib/api/mock-adapter";

export const runtime = "nodejs";

const RATE_LIMIT = { limit: 30, windowSec: 60 };

type SearchRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "review" | "published";
  summary: string | null;
  providers: { id: string; slug: string; name: string } | null;
};

export async function GET(req: NextRequest) {
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());

  const parsed = SearchQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return Errors.validationError(parsed.error.issues[0].message);
  }

  const { q, limit } = parsed.data;

  try {
    let results: {
      id: string;
      slug: string;
      name: string;
      status: string;
      summary: string | null;
      provider: SearchRow["providers"] | null;
    }[] = [];

    if (isMockMode()) {
      const lower = q.toLowerCase();
      results = mockModels
        .filter(
          (m) => m.status === "published" && m.name.toLowerCase().includes(lower)
        )
        .slice(0, limit)
        .map((m) => {
          const summary = adaptModelToSummary(m);
          return {
            id: summary.id,
            slug: summary.slug,
            name: summary.name,
            status: summary.status,
            summary: summary.summary,
            provider: summary.provider
              ? {
                  id: summary.provider.id,
                  slug: summary.provider.slug,
                  name: summary.provider.name,
                }
              : null,
          };
        });
    } else {
      const { data, error } = await supabaseAdmin
        .from("entities")
        .select(
          `
          id, slug, name, status, summary,
          providers ( id, slug, name )
        `
        )
        .or(`name.ilike.${q}%,name.ilike.%${q}%`)
        .eq("status", "published")
        .order("name", { ascending: true })
        .limit(limit);

      if (error) throw new Error(error.message);

      const rows = (data ?? []) as unknown as SearchRow[];
      results = rows.map((e) => ({
        id: e.id,
        slug: e.slug,
        name: e.name,
        status: e.status,
        summary: e.summary,
        provider: e.providers,
      }));
    }

    return ok(results, {
      total: results.length,
      rateLimit: {
        limit: RATE_LIMIT.limit,
        remaining: RATE_LIMIT.limit,
        reset: new Date(
          Date.now() + RATE_LIMIT.windowSec * 1000
        ).toISOString(),
      },
    });
  } catch {
    return Errors.internalError();
  }
}
