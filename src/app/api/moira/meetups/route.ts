/**
 * POST /api/moira/meetups — 약속 생성 (호스트 출발지)
 *
 * ODSAY_API_KEY + KAKAO_REST_KEY 없으면 demo 모드로 동작.
 * demo: 좌표 변환 skip, mock.ts 기반 고정 응답.
 * live: 카카오 로컬 API로 주소→좌표 변환 후 DB 저장.
 *
 * 레이트리밋: IP 기준 10회/분, 50회/일 (src/lib/server/rate-limit.ts 재사용)
 */

import { type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { issueToken } from "@/lib/moira/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ── 모드 감지 ──────────────────────────────────────────────────────────────
function detectMode(): "live" | "demo" {
  return process.env.ODSAY_API_KEY && process.env.KAKAO_REST_KEY ? "live" : "demo";
}

// ── 레이트리밋 설정 ────────────────────────────────────────────────────────
const RL_PER_MIN = Number(process.env.MOIRA_RL_CREATE_PER_MIN ?? 10);
const RL_PER_DAY = 50;
const MINUTE_MS  = 60_000;
const DAY_MS     = 24 * 60 * 60 * 1000;

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return `moira:create:${first}`;
  }
  return `moira:create:${req.headers.get("x-real-ip")?.trim() ?? "unknown"}`;
}

// ── 입력 검증 스키마 ────────────────────────────────────────────────────────
const CreateMeetupSchema = z.object({
  hostName:   z.string().min(1).max(20),
  hostOrigin: z.string().min(2).max(100),
  ttlHours:   z.coerce.number().int().min(1).max(72).optional().default(48),
});

// ── 카카오 로컬 API (live 전용) ─────────────────────────────────────────────
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.KAKAO_REST_KEY;
  if (!key) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    if (!res.ok) return null;
    const json = (await res.json()) as { documents: Array<{ x: string; y: string }> };
    const doc = json.documents[0];
    if (!doc) return null;
    return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
  } catch {
    return null;
  }
}

// ── nanoid 간소 구현 (의존성 없이 URL-safe 10자) ───────────────────────────
// rejection sampling 으로 모듈로 편향 제거(코드리뷰 m-1): 256 % 62 = 8 이라
// 단순 `b % 62` 는 앞 8글자(A~H)가 ~25% 더 자주 등장한다. 62의 최대 배수
// (256 - 256%62 = 248) 이상 바이트는 버리고 다시 뽑아 균일 분포를 보장한다.
// 출력 계약은 그대로(URL-safe 영숫자 10자).
function nanoid10(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const len = chars.length; // 62
  const ceiling = 256 - (256 % len); // 248
  let out = "";
  while (out.length < 10) {
    for (const b of randomBytes(10 - out.length + 4)) {
      if (b >= ceiling) continue; // 편향 유발 구간 폐기
      out += chars[b % len];
      if (out.length === 10) break;
    }
  }
  return out;
}

// ── 핸들러 ────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 레이트리밋 (테스트 환경 건너뜀)
  if (process.env.NODE_ENV !== "test") {
    const key = clientKey(req);
    const perMin = rateLimit(`${key}:min`, { limit: RL_PER_MIN, windowMs: MINUTE_MS });
    const perDay = rateLimit(`${key}:day`, { limit: RL_PER_DAY, windowMs: DAY_MS });
    const blocked = !perMin.ok ? perMin : !perDay.ok ? perDay : null;
    if (blocked) {
      const retryAfterSec = Math.ceil(blocked.retryAfterMs / 1000);
      return Response.json(
        { success: false, error: { code: "E_RATE_LIMIT", message: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." } },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }
  }

  // JSON 파싱
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return Response.json(
      { success: false, error: { code: "E_BAD_JSON", message: "잘못된 요청 본문입니다." } },
      { status: 400 }
    );
  }

  // Zod 검증
  const parsed = CreateMeetupSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { success: false, error: { code: "E_VALIDATION", message: "입력값이 올바르지 않습니다.", fieldErrors: parsed.error.flatten().fieldErrors } },
      { status: 400 }
    );
  }

  const { hostName, hostOrigin, ttlHours } = parsed.data;
  const mode = detectMode();

  // meetupId 생성
  const meetupId = nanoid10();

  // 좌표 변환 (live만, demo는 null)
  const coords = mode === "live" ? await geocode(hostOrigin) : null;

  // 토큰 발급
  const hostToken   = issueToken("host",   meetupId);
  const inviteToken = issueToken("invite", meetupId);

  const baseUrl = process.env.NEXT_PUBLIC_MOIRA_BASE_URL ?? "https://moira.app";
  const inviteUrl = `${baseUrl}/j/${meetupId}?t=${inviteToken}`;

  // DB 저장 (TODO: Supabase/Postgres 클라이언트 연결 후 활성화)
  // await db.meetups.create({ id: meetupId, hostName, hostOrigin, lat: coords?.lat, lng: coords?.lng, ttlHours, hostTokenUid })
  // await db.members.create({ meetupId, name: hostName, origin: hostOrigin, isHost: true, lat: coords?.lat, lng: coords?.lng })

  // Redis TTL 초기화 (TODO: Upstash 연결 후 활성화)
  // await redis.set(`moira:ver:${meetupId}`, "0", { ex: ttlHours * 3600 })

  return Response.json(
    {
      success: true,
      data: {
        meetupId,
        hostToken,
        inviteUrl,
        inviteToken,
      },
      meta: { mode },
    },
    { status: 201 }
  );
}
