import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  // Native database drivers stay out of the server bundle.
  serverExternalPackages: [
    "pg",
    "pg-cursor",
    "better-sqlite3",
    "pdfkit",
    "nodemailer",
    "mysql2",
    "mssql",
    "exceljs",
  ],
  // Local data (SQLite demos, mail outbox) must never ship in the build.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "./.data/**/*"],
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ]
  },
}

export default nextConfig
