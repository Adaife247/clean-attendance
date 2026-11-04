import { withSentryConfig } from "@sentry/nextjs/config";

// We use 'any' here because Next.js 16 removed 'eslint', 'typescript', and 'webpack' from the strict NextConfig type definition.
// This prevents the build from failing due to TypeScript property checks.
/* eslint-disable @typescript-eslint/no-explicit-any */
const nextConfig: any = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: __dirname,
  },
  webpack: (config: any) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
});