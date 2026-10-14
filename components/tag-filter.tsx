"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

/** Single-choice tag filter; clicking the active tag clears it. */
export function TagFilter({
  tags,
  value,
  onChange,
}: {
  tags: string[]
  value: string | null
  onChange: (tag: string | null) => void
}) {
  if (!tags.length) return null
  return (
    <ToggleGroup
      value={value ? [value] : []}
      onValueChange={(next) => onChange((next as string[])[0] ?? null)}
      variant="outline"
      size="sm"
      className="flex-wrap"
      aria-label="Filtrar por tag"
    >
      {tags.map((tag) => (
        <ToggleGroupItem key={tag} value={tag}>
          #{tag}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
