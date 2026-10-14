import { cookies } from "next/headers"

import { AppSidebar } from "@/components/app-shell/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { requireUser } from "@/server/auth/session"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const cookieStore = await cookies()
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false"

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo
      </a>
      <AppSidebar
        user={{ name: user.name, email: user.email, role: user.role }}
      />
      <SidebarInset id="conteudo" tabIndex={-1} className="min-w-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}
