"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarClockIcon,
  DatabaseIcon,
  DatabaseZapIcon,
  FileCode2Icon,
  HouseIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SquarePenIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Role } from "@/lib/auth/roles"

import { NavUser } from "./nav-user"

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  roles?: Role[]
}

const MAIN_NAV: NavItem[] = [
  { title: "Início", href: "/", icon: HouseIcon },
  { title: "Telas", href: "/apps", icon: LayoutDashboardIcon },
  {
    title: "Queries",
    href: "/queries",
    icon: FileCode2Icon,
    roles: ["admin", "editor"],
  },
  {
    title: "Conexões",
    href: "/connections",
    icon: DatabaseIcon,
    roles: ["admin", "editor"],
  },
  {
    title: "Agendamentos",
    href: "/schedules",
    icon: CalendarClockIcon,
    roles: ["admin", "editor"],
  },
  {
    title: "Ações de escrita",
    href: "/actions",
    icon: SquarePenIcon,
    roles: ["admin", "editor"],
  },
]

const ADMIN_NAV: NavItem[] = [
  {
    title: "Usuários",
    href: "/admin/users",
    icon: UsersIcon,
    roles: ["admin"],
  },
  {
    title: "Auditoria",
    href: "/admin/audit",
    icon: ScrollTextIcon,
    roles: ["admin"],
  },
]

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name: string; email: string; role: Role }
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(user.role))

  const renderItems = (items: NavItem[]) =>
    visible(items).map((item) => (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          isActive={isActive(pathname, item.href)}
          tooltip={item.title}
          render={
            <Link href={item.href} onClick={() => setOpenMobile(false)} />
          }
        >
          <item.icon />
          <span>{item.title}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ))

  const adminItems = visible(ADMIN_NAV)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <DatabaseZapIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">sqlboard</span>
                <span className="truncate text-xs text-muted-foreground">
                  SQL → telas
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(MAIN_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {adminItems.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(ADMIN_NAV)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
