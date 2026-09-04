import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // No `images.remotePatterns`: every photograph is vendored into public/img/
  // by `npm run vendor:images`, so nothing is fetched from a third-party host
  // at runtime and the app renders fully offline.
};

export default config;
