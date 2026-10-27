// src/app/cloudcheck/route.ts — /cloudcheck: 자체 완결 HTML 한 장 + 전용 헤더(방향서 §2-2). 소유: 프론트팀장.
// import는 _generated와 _serve뿐이다(UI 코드는 Next 번들 밖, First Load JS 0). page.tsx를 두지 않는다.
import { PAGE } from "./_generated/page";
import { pageHeaders } from "./_serve/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = pageHeaders(PAGE);

export function GET(): Response {
  return new Response(PAGE.html, { status: 200, headers: HEADERS });
}
