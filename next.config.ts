import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
<<<<<<< HEAD
  reactStrictMode: true,
=======
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.ARUK_CORS_ORIGIN || "http://localhost:3000" },
          { key: "Vary", value: "Origin" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
<<<<<<< HEAD
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Agent-Id, X-Aruk-Pass, X-Aruk-Actor, X-Aruk-Role" },
=======
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Agent-Id" },
>>>>>>> 193e563eec90177528092e21ed6ea88aad226193
          { key: "X-Powered-By", value: "Aruk" },
        ],
      },
    ];
  },
};

export default nextConfig;