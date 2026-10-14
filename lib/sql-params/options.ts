import type { ParamOption } from "./types"

/** "valor|rótulo" lines ⇄ option objects (fixed options of list/multi). */
export function optionsToText(options?: ParamOption[]) {
  return (options ?? [])
    .map((o) =>
      o.label && o.label !== o.value ? `${o.value}|${o.label}` : o.value
    )
    .join("\n")
}

export function textToOptions(text: string): ParamOption[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [value, ...rest] = line.split("|")
      const label = rest.join("|").trim()
      return label ? { value: value!.trim(), label } : { value: value!.trim() }
    })
}
