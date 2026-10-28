import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: process.env.ARUK_CORS_ORIGIN || "http://localhost:3000" },
          { key: "Vary", value: "Origin" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Agent-Id, X-Aruk-Pass, X-Aruk-Actor, X-Aruk-Role" },
          { key: "X-Powered-By", value: "Aruk" },
        ],
      },
    ];
  },
};

export default nextConfig;