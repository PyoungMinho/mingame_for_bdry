// REDLINE: 타인 비교/외모 점수 UI 금지
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      service: "munje-factory",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      ts: new Date().toISOString(),
    },
    { status: 200 }
  );
}
