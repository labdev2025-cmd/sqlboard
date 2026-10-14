import { Skeleton } from "@/components/ui/skeleton"

/** Shown while a page of the app shell loads on the server. */
export default function AppLoading() {
  return (
    <div
      className="flex flex-col gap-4 p-4 md:p-6"
      aria-busy="true"
      aria-label="Carregando"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}
