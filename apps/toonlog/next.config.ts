import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // react-konva는 node 'canvas' 모듈을 참조하므로 서버 번들에서 제외한다.
  // Stage/Layer 등 konva 컴포넌트는 클라이언트에서 dynamic import(ssr:false)로 로드할 것.
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
  images: {
    // Vertex AI / GCS / Supabase Storage 등 이미지 호스트는 백엔드 확정 후 추가
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "storage.googleapis.com" },
    ],
  },
};

export default nextConfig;
