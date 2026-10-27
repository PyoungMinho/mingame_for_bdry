// src/app/cloudcheck/download/route.ts — /cloudcheck/download: /cloudcheck와 같은 바이트 + Content-Disposition(오프라인판). 소유: 프론트팀장.
import { PAGE } from "../_generated/page";
import { downloadHeaders } from "../_serve/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = downloadHeaders(PAGE);

export function GET(): Response {
  return new Response(PAGE.html, { status: 200, headers: HEADERS });
}
