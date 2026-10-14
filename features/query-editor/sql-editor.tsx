"use client"

import * as React from "react"
import {
  MSSQL,
  MySQL,
  PostgreSQL,
  SQLite,
  sql,
  type SQLNamespace,
} from "@codemirror/lang-sql"
import { Prec } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import CodeMirror from "@uiw/react-codemirror"
import { useTheme } from "next-themes"

import type { SchemaInfo } from "@/lib/data-types"
import type { SqlDialect } from "@/lib/sql-params"
import { cn } from "@/lib/utils"

const DIALECTS = {
  postgres: PostgreSQL,
  mysql: MySQL,
  sqlite: SQLite,
  mssql: MSSQL,
  oracle: PostgreSQL,
} as const

/** Builds the autocomplete namespace ("schema.table" → columns) from introspection. */
export function schemaNamespace(
  schema?: SchemaInfo | null
): SQLNamespace | undefined {
  if (!schema) return undefined
  const namespace: Record<string, string[]> = {}
  for (const table of schema.tables) {
    namespace[`${table.schema}.${table.name}`] = table.columns.map(
      (c) => c.name
    )
  }
  return namespace
}

export type SqlEditorHandle = {
  insert: (text: string) => void
  /** Replaces the whole text as one editor change (Ctrl+Z undoes it). */
  replace: (text: string) => boolean
  focus: () => void
}

/**
 * CodeMirror 6 SQL editor with dialect highlighting, schema autocomplete,
 * Ctrl/Cmd+Enter to run and the app theme. Tab moves focus (no keyboard trap).
 */
export const SqlEditor = React.forwardRef<
  SqlEditorHandle,
  {
    value: string
    onChange: (value: string) => void
    dialect?: SqlDialect
    schema?: SchemaInfo | null
    onRun?: () => void
    label?: string
    minHeight?: string
    className?: string
    readOnly?: boolean
  }
>(function SqlEditor(
  {
    value,
    onChange,
    dialect = "postgres",
    schema,
    onRun,
    label = "Editor SQL",
    minHeight = "220px",
    className,
    readOnly,
  },
  ref
) {
  const { resolvedTheme } = useTheme()
  const viewRef = React.useRef<EditorView | null>(null)
  const runRef = React.useRef(onRun)
  React.useEffect(() => {
    runRef.current = onRun
  }, [onRun])

  React.useImperativeHandle(ref, () => ({
    insert(text) {
      const view = viewRef.current
      if (!view) return
      const { from, to } = view.state.selection.main
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      })
      view.focus()
    },
    replace(text) {
      const view = viewRef.current
      if (!view) return false
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text },
        selection: { anchor: text.length },
      })
      return true
    },
    focus() {
      viewRef.current?.focus()
    },
  }))

  const extensions = React.useMemo(
    () => [
      sql({
        dialect: DIALECTS[dialect],
        schema: schemaNamespace(schema),
        upperCaseKeywords: false,
      }),
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              runRef.current?.()
              return true
            },
          },
        ])
      ),
      EditorView.contentAttributes.of({ "aria-label": label }),
      EditorView.lineWrapping,
    ],
    [dialect, schema, label]
  )

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-background text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        className
      )}
    >
      <CodeMirror
        value={value}
        onChange={onChange}
        extensions={extensions}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        minHeight={minHeight}
        indentWithTab={false}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !readOnly,
        }}
        onCreateEditor={(view) => {
          viewRef.current = view
        }}
      />
    </div>
  )
})
