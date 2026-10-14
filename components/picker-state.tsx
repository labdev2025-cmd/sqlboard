import { FieldDescription, FieldError } from "@/components/ui/field"
import { errorMessage } from "@/lib/api-client"

/** Explains an empty picker: the list failed to load, or there is nothing. */
export function PickerState({
  error,
  empty,
  emptyText,
}: {
  error: unknown
  empty: boolean | undefined
  emptyText: string
}) {
  if (error) return <FieldError>{errorMessage(error)}</FieldError>
  if (empty) return <FieldDescription>{emptyText}</FieldDescription>
  return null
}
