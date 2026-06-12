import type { NextConfig } from "next";
import { execSync } from "child_process";

function getGitSha(): string {
  // Prefer env var set by Vercel at build time
  const vercelSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  if (vercelSha) return vercelSha;
  // Fall back to reading from git directly (works in both local and Vercel builds)
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim()
      .slice(0, 7);
  } catch {
    return "dev";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString().split('T')[0],
    NEXT_PUBLIC_GIT_SHA: getGitSha(),
  },
};

export default nextConfig;
