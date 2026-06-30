/**
 * POST /api/payments/webhook
 * Toss Payments 웹훅 수신.
 * 구독 갱신/실패/취소 이벤트 처리.
 * 인증 없음 (Toss 서버 → 우리 서버 직접 호출).
 * 보안: Toss 시크릿 서명 검증.
 */
import { NextRequest, NextResponse } from "next/server";
import { paymentWebhookBodySchema } from "@/lib/validation/schemas";

/** DB설계자 의존 — @/lib/db */
import { cancelSubscription, expireSubscriptions } from "@/lib/db";

/** Toss 웹훅 시크릿 서명 검증 */
async function verifyTossWebhook(req: NextRequest, rawBody: string): Promise<boolean> {
  // Toss는 Authorization: Basic {base64(secret:)} 헤더를 웹훅 요청에 포함
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!process.env.TOSS_SECRET_KEY) {
    // 개발 환경 stub — 검증 통과
    console.warn("[Webhook] TOSS_SECRET_KEY 없음 → 서명 검증 skip");
    return true;
  }

  const base64Key = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
  const expected = `Basic ${base64Key}`;

  // 타이밍 어택 방어용 상수시간 비교
  if (authHeader.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < authHeader.length; i++) {
    diff |= authHeader.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;

  void rawBody; // 실제 구현 시 HMAC 서명 검증에 사용
}

export async function POST(req: NextRequest) {
  // ── 서명 검증 ──
  const rawBody = await req.text();
  const isValid = await verifyTossWebhook(req, rawBody);

  if (!isValid) {
    console.warn("[Webhook] 서명 검증 실패");
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "서명 검증 실패" } },
      { status: 401 }
    );
  }

  // ── 본문 파싱 ──
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "잘못된 JSON 형식" } },
      { status: 400 }
    );
  }

  const parsed = paymentWebhookBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: { code: "VALIDATION_ERROR", message: "필드 오류" } },
      { status: 400 }
    );
  }

  const { eventType, data } = parsed.data;

  console.info(`[Webhook] 이벤트 수신: ${eventType}`, data);

  // ── 이벤트 처리 ──
  try {
    switch (eventType) {
      case "PAYMENT_STATUS_CHANGED": {
        // 결제 취소 — subscriptionId가 data에 포함된 경우 처리
        if (
          (data.status === "CANCELED" || data.status === "PARTIAL_CANCELED") &&
          typeof data.orderId === "string"
        ) {
          // cancelSubscription(subscriptionId) — orderId 기반 조회는 DB설계자 보강 필요
          // 현재는 로깅만 (W4 통합 시 보완)
          console.info(`[Webhook] 결제 취소 감지: orderId=${data.orderId}`);
        }
        break;
      }

      case "BILLING_KEY_DELETED": {
        // 구독 자동결제 키 삭제 → 만료된 구독 일괄 정리
        await expireSubscriptions();
        break;
      }

      default:
        // 미처리 이벤트는 로깅 후 200 응답 (Toss 재전송 방지)
        console.info(`[Webhook] 처리하지 않는 이벤트 타입: ${eventType}`);
    }

    // Toss는 200 응답 받지 못하면 최대 5회 재전송
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Webhook] 처리 중 오류", err);
    // 500 반환 시 Toss가 재전송 — 멱등성 처리 중요
    return NextResponse.json(
      { ok: false, error: { code: "INTERNAL_ERROR", message: "처리 중 오류" } },
      { status: 500 }
    );
  }
}
