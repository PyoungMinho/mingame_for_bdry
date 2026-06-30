import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // 아래 패턴에 해당하는 경로에만 미들웨어 적용
  // _next/static, _next/image, favicon 등 정적 자산 제외
  // /admin은 i18n 제외 (영문 단일 운영)
  matcher: ["/((?!api|admin|_next|_vercel|.*\\..*).*)"],
};
