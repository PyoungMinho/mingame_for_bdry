/**
 * POST /api/payments/confirm
 * Toss Payments 결제 승인.
 * 프론트에서 paymentKey/orderId/amount를 받아 Toss 서버로 최종 승인 요청.
 * 성공 시 구독/크레딧 반영.
 * 인증 필수.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError } from "@/server/auth/session";
import { paymentConfirmBodySchema } from "@/lib/validation/schemas";

/** DB설계자 의존 — @/lib/db */
import { upsertSubscription, addCredits, type SubscriptionInput } from "@/lib/db";

const TOSS_CONFIRM_URL = "https://api.tosspayments.com/v1/payments/confirm";

/** orderId 형식: toonlog_{userId}_{type}_{timestamp} */
type OrderType = "subscription_basic" | "subscription_pro" | "credit_1" | "credit_5" | "credit_12";

function parseOrderId(orderId: string): { userId: string; type: OrderType } | null {
  const parts = orderId.split("_");
  if (parts.length < 4 || parts[0] !== "toonlog") return null;
  const userId = parts[1];
  const type = parts.slice(2, -1).join("_") as OrderType;
  return { userId, type };
}

const CREDIT_PACK_MAP: Record<string, number> = {
  credit_1: 1,
  credit_5: 5,
  credit_12: 12,
};

export async function POST(req: NextRequest) {
  // ── 인증 ──
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const { user } = auth;

  // ── 입력 검증 ──
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_JSON", message: "요청 본문이 올바른 JSON이 아닙니다." },
      },
      { status: 400 }
    );
  }

  const parsed = paymentConfirmBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        },
      },
      { status: 400 }
    );
  }

  const { paymentKey, orderId, amount } = parsed.data;

  // ── orderId 파싱 ──
  const orderInfo = parseOrderId(orderId);
  if (!orderInfo || orderInfo.userId !== user.id) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "INVALID_ORDER", message: "유효하지 않은 주문 ID입니다." },
      },
      { status: 400 }
    );
  }

  // ── Toss 결제 승인 API 호출 ──
  if (!process.env.TOSS_SECRET_KEY) {
    console.warn("[Payment] TOSS_SECRET_KEY 없음 → stub 처리");
    // 개발 환경 stub
    await applyPaymentEffect(user.id, orderInfo.type);
    return NextResponse.json({
      ok: true,
      data: { message: "결제가 완료되었습니다. (stub)", orderId, amount },
    });
  }

  const base64Key = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");

  const tossRes = await fetch(TOSS_CONFIRM_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${base64Key}`,
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossRes.ok) {
    const errData = await tossRes.json().catch(() => ({}));
    console.error("[Payment] Toss 승인 실패", errData);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "PAYMENT_FAILED",
          message: errData.message ?? "결제 승인에 실패했습니다.",
        },
      },
      { status: 400 }
    );
  }

  const tossData = await tossRes.json();

  // ── 구독/크레딧 반영 ──
  await applyPaymentEffect(user.id, orderInfo.type);

  return NextResponse.json({
    ok: true,
    data: {
      message: "결제가 완료되었습니다.",
      orderId: tossData.orderId,
      amount: tossData.totalAmount,
    },
  });

  async function applyPaymentEffect(userId: string, type: OrderType) {
    if (type === "subscription_basic" || type === "subscription_pro") {
      const tier = type === "subscription_basic" ? "basic" : "pro";
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      // SubscriptionInput: { userId, tier, period, tossBillingKey?, startsAt?, expiresAt? }
      const input: SubscriptionInput = {
        userId,
        tier,
        period: "monthly",
        expiresAt,
      };
      await upsertSubscription(input);
    } else if (type in CREDIT_PACK_MAP) {
      await addCredits(userId, CREDIT_PACK_MAP[type], "purchase");
    }
  }
}
