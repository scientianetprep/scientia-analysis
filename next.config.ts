import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable Cache Components for Partial Pre-Rendering (PPR)
  // Allows "use cache" directive at function/component level
  cacheComponents: true,

  // Enable React Compiler for automatic memoization
  // Replaces manual useMemo/useCallback at compile time
  reactCompiler: true,

  experimental: {
    // Tree-shake heavy libraries by rewriting barrel imports to per-file imports
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "framer-motion",
      "recharts",
      "katex",
      "react-markdown",
      "rehype-katex",
      "remark-math",
      "@radix-ui/react-dialog",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
    ],
    // Turbopack file system caching for faster dev server restarts
    turbopackFileSystemCacheForDev: true,
  },

  // Mark server-only native deps as external so Turbopack doesn't try to
  // bundle them into Route Handlers. `sharp` has a native binary and is
  // required by next/image; `@supabase/ssr` re-exports cookies helpers
  // that are easier to leave as CommonJS externals.
  //
  // (Note: Next.js 16 no longer auto-runs ESLint during `next build`, so
  // the old `eslint.ignoreDuringBuilds` escape hatch is unnecessary and in
  // fact removed from the NextConfig type.)
  serverExternalPackages: ["sharp", "@supabase/ssr", "@supabase/supabase-js"],

  // Remote images used by the app (Supabase public bucket + any seeded
  // placeholders). Keeping this explicit avoids runtime image-loader
  // crashes on the first request.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
