import type { NextConfig } from "next";
import { existsSync, readFileSync } from "node:fs";

const rootEnv = new URL("../.env", import.meta.url);
if (!process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD && existsSync(rootEnv)) {
  const match = readFileSync(rootEnv, "utf8").match(/^NEXT_PUBLIC_DEMO_ADMIN_PASSWORD=(.*)$/m);
  if (match?.[1]) process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD = match[1].trim();
}

const nextConfig: NextConfig = { agentRules: false };

export default nextConfig;
