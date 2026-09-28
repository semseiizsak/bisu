import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  env: {
    // Vercel sets this automatically at build time; used client-side to detect
    // a stale PWA session and self-refresh (see AppUpdateWatcher).
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
  experimental: {
    // Client router cache: a tab you visited in the last 30s re-renders from
    // memory instead of waiting on a fresh server render. Anything that
    // changes what a tab shows (finishing a quiz, marking a day read) calls
    // revalidatePath so the cache is dropped right then.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
