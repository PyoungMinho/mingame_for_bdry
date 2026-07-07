/**
 * POST /api/moira/compute — 무상태 실시간 공평 계산 (DB 불필요)
 *
 * body: { members: [{ id?, name, avatar?, address?, lat?, lng? }] } (2~8명)
 * live 모드(ODSAY_API_KEY + KAKAO_REST_KEY): 지오코딩 + ODsay 실경로 계산 → scenario 반환.
 * demo 모드(키 없음) 또는 계산 실패: { mode:"demo"|"error" } → 프론트가 시드(buildScenario)로 폴백.
 *
 * 레이트리밋: IP 기준 20회/분 (src/lib/server/rate-limit.ts 재사용, ODsay 호출 폭주 방지).
 */

import { type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { computeScenario, type ComputeMember } from "@/lib/moira/server/compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RL_PER_MIN = Number(process.env.MOIRA_RL_COMPUTE_PER_MIN ?? 20);
const MINUTE_MS = 60_000;

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
  return `moira:compute:${ip}`;
}

const MemberSchema = z
  .object({
    id: z.string().min(1).max(40).optional(),
    name: z.string().min(1).max(20),
    avatar: z.string().max(20).optional(),
    address: z.string().min(2).max(100).optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  })
  .refine((m) => !!m.address || (m.lat !== undefined && m.lng !== undefined), {
    message: "각 멤버는 address 또는 lat/lng 가 필요합니다.",
  });

const ComputeSchema = z.object({
  members: z.array(MemberSchema).min(2).max(8),
});

const AVATARS = ["#6366F1", "#0EA5E9", "#14B8A6", "#A855F7", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981"];

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "test") {
    const rl = rateLimit(clientKey(req), { limit: RL_PER_MIN, windowMs: MINUTE_MS });
    if (!rl.ok) {
      return Response.json(
        { success: false, error: { code: "E_RATE_LIMIT", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
      );
    }
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json({ success: false, error: { code: "E_BAD_JSON", message: "잘못된 요청 본문입니다." } }, { status: 400 });
  }

  const parsed = ComputeSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "E_VALIDATION", message: "입력값이 올바르지 않습니다.", fieldErrors: parsed.error.flatten().fieldErrors } },
      { status: 400 },
    );
  }

  const members: ComputeMember[] = parsed.data.members.map((m, i) => ({
    id: m.id ?? (i === 0 ? "me" : `m${i}`),
    name: m.name,
    avatar: m.avatar ?? AVATARS[i % AVATARS.length],
    address: m.address,
    latLng: m.lat !== undefined && m.lng !== undefined ? { lat: m.lat, lng: m.lng } : undefined,
  }));

  const outcome = await computeScenario(members);

  if (outcome.mode === "live") {
    return Response.json({ success: true, data: { mode: "live", scenario: outcome.scenario }, meta: { mode: "live" as const } });
  }
  // demo/error → 프론트가 시드로 폴백하도록 신호만 전달(200, 실패 아님)
  return Response.json({
    success: true,
    data: { mode: outcome.mode, scenario: null, ...(outcome.mode === "error" ? { message: outcome.message } : {}) },
    meta: { mode: outcome.mode },
  });
}
