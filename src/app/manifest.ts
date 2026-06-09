// REDLINE: 타인 비교/외모 점수 UI 금지
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "문제팩토리 — 무료 수능형 문제 풀이",
    short_name: "문제팩토리",
    description: "공부할 주제만 입력하면 수능 출제유형 그대로 문제를 만들어 즉시 채점·해설까지. 무료.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAFAF7",
    theme_color: "#4F46E5",
    orientation: "portrait",
    scope: "/",
    lang: "ko",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any", purpose: "any" },
    ],
  };
}
