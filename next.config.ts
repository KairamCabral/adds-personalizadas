import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Versão exibida no rodapé: prefixo "MAJOR.MINOR" do package.json
// + patch = nº total de commits do git no momento do build.
// No Vercel a env VERCEL_GIT_COMMIT_SHA é exposta mas git rev-list funciona porque o repo é clonado.
function computeAppVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync("./package.json", "utf-8")) as {
      version?: string;
    };
    const parts = (pkg.version ?? "1.0.0").split(".");
    const base = `${parts[0] ?? "1"}.${parts[1] ?? "0"}`;
    let patch = parts[2] ?? "0";
    try {
      patch = execSync("git rev-list --count HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      // sem git disponível — mantém patch do package.json
    }
    return `${base}.${patch}`;
  } catch {
    return "1.0.0";
  }
}

const APP_VERSION = computeAppVersion();

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: APP_VERSION,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "recharts",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
    ],
  },

  // ═══ HEADERS HTTP ═══
  async headers() {
    return [
      // CORS — APIs consumidas pelo app mobile (representantes)
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
      // Segurança — todas as rotas
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
