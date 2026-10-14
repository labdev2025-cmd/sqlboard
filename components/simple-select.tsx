"use client"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectOption<V extends string = string> = {
  value: V
  label: string
}

/**
 * Single-value Select with a flat option list. Thin composition wrapper over
 * the shadcn Select (Base UI) so screens don't repeat the item boilerplate.
 */
export function SimpleSelect<V extends string = string>({
  id,
  items,
  value,
  onValueChange,
  placeholder = "Selecione",
  disabled,
  className,
  size,
  invalid,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: {
  id?: string
  items: SelectOption<V>[]
  value: V | null
  onValueChange: (value: V) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  size?: "sm" | "default"
  invalid?: boolean
  "aria-label"?: string
  "aria-labelledby"?: string
}) {
  const withPlaceholder = [{ value: null, label: placeholder }, ...items] as {
    value: V | null
    label: string
  }[]
  return (
    <Select
      items={withPlaceholder}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as V)
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        size={size}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-invalid={invalid || undefined}
        className={cn("w-full min-w-0", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
