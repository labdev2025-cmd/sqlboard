import { LockIcon, type LucideIcon } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? (
          <EmptyDescription>{description}</EmptyDescription>
        ) : null}
      </EmptyHeader>
      {children ? <EmptyContent>{children}</EmptyContent> : null}
    </Empty>
  )
}

/** Rendered by pages when the server denies access (no data is loaded). */
export function ForbiddenState({
  description = "Seu papel não permite acessar esta área. Fale com um administrador se precisar de acesso.",
}: {
  description?: string
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <EmptyState
        icon={LockIcon}
        title="Acesso negado"
        description={description}
      />
    </div>
  )
}
