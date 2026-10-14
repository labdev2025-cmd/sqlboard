import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

/** Top bar of every signed-in page: menu trigger, title and page actions. */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-2 border-b bg-background/95 px-4 py-2 backdrop-blur supports-backdrop-filter:bg-background/80",
        className
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-base font-semibold">{title}</h1>
        {description ? (
          <p className="truncate text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}

/** Main content area with consistent padding. */
export function PageBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-w-0 flex-1 flex-col gap-4 p-4 md:p-6", className)}
      {...props}
    />
  )
}
