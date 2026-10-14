import type { Metadata, Viewport } from "next"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"

import "./globals.css"
import { AppProviders } from "@/components/providers/app-providers"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: { default: "sqlboard", template: "%s · sqlboard" },
  description:
    "Ferramentas internas e painéis a partir de queries SQL, com shadcn/ui.",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        GeistSans.variable,
        GeistMono.variable,
        "font-sans"
      )}
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
