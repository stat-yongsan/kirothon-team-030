import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Vercel 공개 시연판: 런타임에 읽는 결과 스냅샷을 서버 함수 번들에 넣는다(경로가 환경변수라 자동 추적되지 않음)
  outputFileTracingIncludes: {
    "/*": ["./demo-data/**/*"],
    "/**": ["./demo-data/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
