import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ko"],
  defaultLocale: "en",
  localePrefix: "as-needed", // en: prefix 없음, ko: /ko prefix
});

export type Locale = (typeof routing.locales)[number];
