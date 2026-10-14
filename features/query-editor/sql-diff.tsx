"use client"

import * as React from "react"
import { sql } from "@codemirror/lang-sql"
import { MergeView } from "@codemirror/merge"
import { EditorState } from "@codemirror/state"
import { EditorView } from "@codemirror/view"
import { useTheme } from "next-themes"

const darkTheme = EditorView.theme(
  {
    "&": { backgroundColor: "transparent", color: "var(--foreground)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "var(--muted-foreground)",
    },
  },
  { dark: true }
)

/** Read-only side-by-side diff (original × improved) with @codemirror/merge. */
export function SqlDiff({
  original,
  improved,
}: {
  original: string
  improved: string
}) {
  const parent = React.useRef<HTMLDivElement>(null)
  const { resolvedTheme } = useTheme()

  React.useEffect(() => {
    if (!parent.current) return
    const extensions = [
      sql(),
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      ...(resolvedTheme === "dark" ? [darkTheme] : []),
    ]
    const view = new MergeView({
      a: {
        doc: original,
        extensions: [
          ...extensions,
          EditorView.contentAttributes.of({ "aria-label": "Query original" }),
        ],
      },
      b: {
        doc: improved,
        extensions: [
          ...extensions,
          EditorView.contentAttributes.of({ "aria-label": "Query melhorada" }),
        ],
      },
      parent: parent.current,
      collapseUnchanged: { margin: 3, minSize: 6 },
    })
    return () => view.destroy()
  }, [original, improved, resolvedTheme])

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-2 text-xs text-muted-foreground">
        <span>Original</span>
        <span>Melhorada</span>
      </div>
      <div
        ref={parent}
        className="max-h-80 overflow-auto rounded-lg border text-xs"
      />
    </div>
  )
}
