"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  Trash2Icon,
} from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  IDENTIFIER,
  type AppDocument,
  type GridPosition,
  type Widget,
} from "@/lib/app-schema"
import { validateBindings } from "@/lib/bindings"
import { COLUMN_KIND_LABELS, type ResultColumn } from "@/lib/data-types"
import { propFields, WIDGET_INFO, type FieldMeta } from "@/lib/widgets/registry"

const NONE = "__none__"

function ColumnsPicker({
  id,
  columns,
  value,
  onChange,
}: {
  id: string
  columns: ResultColumn[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  if (!columns.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Execute a query para ver as colunas.
      </p>
    )
  }
  return (
    <div
      className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border p-2"
      id={id}
    >
      {columns.map((column) => {
        const checkboxId = `${id}-${column.name}`
        return (
          <Field key={column.name} orientation="horizontal" className="gap-2">
            <Checkbox
              id={checkboxId}
              checked={value.includes(column.name)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...value, column.name]
                    : value.filter((v) => v !== column.name)
                )
              }
            />
            <FieldLabel htmlFor={checkboxId} className="min-w-0 font-normal">
              <span className="truncate font-mono text-xs">{column.name}</span>
              <Badge variant="outline">{COLUMN_KIND_LABELS[column.kind]}</Badge>
            </FieldLabel>
          </Field>
        )
      })}
    </div>
  )
}

function PropControl({
  id,
  meta,
  value,
  onChange,
  columns,
  queries,
  pages,
  variables,
}: {
  id: string
  meta: FieldMeta
  value: unknown
  onChange: (value: unknown) => void
  columns: ResultColumn[]
  queries: string[]
  pages: { id: string; name: string }[]
  variables: string[]
}) {
  switch (meta.control) {
    case "boolean":
      return (
        <Field orientation="horizontal">
          <Switch id={id} checked={Boolean(value)} onCheckedChange={onChange} />
          <FieldLabel htmlFor={id} className="font-normal">
            {meta.label}
          </FieldLabel>
        </Field>
      )
    case "number":
      return (
        <Input
          id={id}
          inputMode="numeric"
          value={String(value ?? "")}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, ""))
            if (Number.isFinite(n) && n > 0) onChange(n)
          }}
        />
      )
    case "textarea":
    case "markdown":
      return (
        <Textarea
          id={id}
          rows={meta.control === "markdown" ? 6 : 4}
          className={
            meta.control === "textarea" ? "font-mono text-xs" : undefined
          }
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case "select":
      return (
        <SimpleSelect
          id={id}
          items={meta.options ?? []}
          value={String(value ?? "")}
          onValueChange={onChange}
        />
      )
    case "column":
      return (
        <SimpleSelect
          id={id}
          items={[
            { value: NONE, label: "(nenhuma)" },
            ...columns.map((c) => ({
              value: c.name,
              label: `${c.name} · ${COLUMN_KIND_LABELS[c.kind]}`,
            })),
          ]}
          value={value ? String(value) : NONE}
          onValueChange={(next) => onChange(next === NONE ? "" : next)}
        />
      )
    case "columns":
      return (
        <ColumnsPicker
          id={id}
          columns={columns}
          value={(value as string[]) ?? []}
          onChange={onChange}
        />
      )
    case "query":
      return (
        <SimpleSelect
          id={id}
          items={[
            { value: NONE, label: "(nenhuma)" },
            ...queries.map((q) => ({ value: q, label: q })),
          ]}
          value={value ? String(value) : NONE}
          onValueChange={(next) => onChange(next === NONE ? "" : next)}
        />
      )
    case "page":
      return (
        <SimpleSelect
          id={id}
          items={[
            { value: NONE, label: "(nenhuma)" },
            ...pages.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={value ? String(value) : NONE}
          onValueChange={(next) => onChange(next === NONE ? "" : next)}
        />
      )
    case "variable":
      return (
        <div className="flex flex-col gap-1.5">
          <Input
            id={id}
            className="font-mono"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value.trim())}
            aria-invalid={!IDENTIFIER.test(String(value ?? "")) || undefined}
            spellCheck={false}
          />
          {variables.length ? (
            <ToggleGroup
              value={variables.includes(String(value)) ? [String(value)] : []}
              onValueChange={(next) => {
                const picked = (next as string[])[0]
                if (picked) onChange(picked)
              }}
              variant="outline"
              size="sm"
              className="flex-wrap"
              aria-label="Parâmetros das queries"
            >
              {variables.map((v) => (
                <ToggleGroupItem key={v} value={v} className="font-mono">
                  :{v}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          ) : null}
        </div>
      )
    default:
      return (
        <Input
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      )
  }
}

const GRID_FIELDS: { key: keyof GridPosition; label: string }[] = [
  { key: "x", label: "Coluna (x)" },
  { key: "y", label: "Linha (y)" },
  { key: "w", label: "Largura (w)" },
  { key: "h", label: "Altura (h)" },
]

export function PropertiesPanel({
  widget,
  doc,
  columnsOf,
  onProps,
  onBindings,
  onGrid,
  onRename,
  onRemove,
}: {
  widget: Widget
  doc: AppDocument
  columnsOf: (queryName: string) => ResultColumn[]
  onProps: (props: Record<string, unknown>) => void
  onBindings: (bindings: Record<string, string>) => void
  onGrid: (grid: GridPosition) => void
  onRename: (id: string) => string | null
  onRemove: () => void
}) {
  const info = WIDGET_INFO[widget.type]
  const [idDraft, setIdDraft] = React.useState(widget.id)
  const [idError, setIdError] = React.useState<string | null>(null)

  const dataBinding = widget.bindings.data ?? ""
  const dataQuery =
    /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\.data\s*\}\}$/.exec(dataBinding)?.[1] ??
    ""
  const props = widget.props as Record<string, unknown>
  const columns = columnsOf(dataQuery)
  const optionColumns =
    typeof props.optionsQuery === "string" ? columnsOf(props.optionsQuery) : []
  const queries = doc.queries.map((q) => q.name)
  const variables = [
    ...new Set(doc.queries.flatMap((q) => q.params.map((p) => p.name))),
  ]
  const bindingErrors = validateBindings(dataBinding)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{info.label}</Badge>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto text-destructive"
          onClick={onRemove}
        >
          <Trash2Icon data-icon="inline-start" />
          Remover
        </Button>
      </div>
      <FieldGroup>
        <Field data-invalid={idError ? true : undefined}>
          <FieldLabel htmlFor="prop-id">Id (usado em bindings)</FieldLabel>
          <Input
            id="prop-id"
            className="font-mono"
            value={idDraft}
            spellCheck={false}
            aria-invalid={idError ? true : undefined}
            onChange={(e) => setIdDraft(e.target.value)}
            onBlur={() => {
              if (idDraft !== widget.id) setIdError(onRename(idDraft))
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIdError(onRename(idDraft))
            }}
          />
          {idError ? <FieldError>{idError}</FieldError> : null}
        </Field>

        {info.usesData ? (
          <>
            <Field>
              <FieldLabel htmlFor="prop-data">Fonte de dados</FieldLabel>
              <SimpleSelect
                id="prop-data"
                items={[
                  { value: NONE, label: "(nenhuma)" },
                  ...queries.map((q) => ({ value: q, label: q })),
                ]}
                value={dataQuery || NONE}
                onValueChange={(next) =>
                  onBindings({
                    ...widget.bindings,
                    data: next === NONE ? "" : `{{${next}.data}}`,
                  })
                }
              />
            </Field>
            <Field data-invalid={bindingErrors.length ? true : undefined}>
              <FieldLabel htmlFor="prop-data-binding">
                Binding dos dados
              </FieldLabel>
              <Input
                id="prop-data-binding"
                className="font-mono text-xs"
                value={dataBinding}
                spellCheck={false}
                onChange={(e) =>
                  onBindings({ ...widget.bindings, data: e.target.value })
                }
              />
              <FieldDescription>
                Ex.: <code>{"{{vendas.data}}"}</code>. Só caminhos (sem código).
              </FieldDescription>
              {bindingErrors.length ? (
                <FieldError>{bindingErrors[0]}</FieldError>
              ) : null}
            </Field>
          </>
        ) : null}

        {propFields(widget.type).map(({ key, meta }) => {
          const id = `prop-${key}`
          const control = (
            <PropControl
              id={id}
              meta={meta}
              value={props[key]}
              onChange={(value) => onProps({ ...props, [key]: value })}
              columns={key === "optionsColumn" ? optionColumns : columns}
              queries={queries}
              pages={doc.pages}
              variables={variables}
            />
          )
          if (meta.control === "boolean")
            return <React.Fragment key={key}>{control}</React.Fragment>
          return (
            <Field key={key}>
              <FieldLabel htmlFor={id}>{meta.label}</FieldLabel>
              {control}
              {meta.description ? (
                <FieldDescription>{meta.description}</FieldDescription>
              ) : null}
              {meta.bindable ? (
                <FieldDescription>
                  Aceita valores das queries:{" "}
                  <code>{"{{query.data[0].coluna}}"}</code>.
                </FieldDescription>
              ) : null}
            </Field>
          )
        })}
      </FieldGroup>

      <Separator />
      <FieldSet>
        <FieldLegend variant="label">
          Posição e tamanho (grade de 12 colunas)
        </FieldLegend>
        <div className="grid grid-cols-2 gap-2">
          {GRID_FIELDS.map(({ key, label }) => (
            <Field key={key}>
              <FieldLabel htmlFor={`grid-${key}`} className="text-xs">
                {label}
              </FieldLabel>
              <Input
                id={`grid-${key}`}
                inputMode="numeric"
                value={String(widget.grid[key])}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""))
                  if (Number.isFinite(n)) onGrid({ ...widget.grid, [key]: n })
                }}
              />
            </Field>
          ))}
        </div>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Mover componente"
        >
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Mover para a esquerda"
            onClick={() => onGrid({ ...widget.grid, x: widget.grid.x - 1 })}
          >
            <ArrowLeftIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Mover para cima"
            onClick={() =>
              onGrid({ ...widget.grid, y: Math.max(0, widget.grid.y - 1) })
            }
          >
            <ArrowUpIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Mover para baixo"
            onClick={() => onGrid({ ...widget.grid, y: widget.grid.y + 1 })}
          >
            <ArrowDownIcon />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Mover para a direita"
            onClick={() => onGrid({ ...widget.grid, x: widget.grid.x + 1 })}
          >
            <ArrowRightIcon />
          </Button>
        </div>
        <FieldDescription>
          No componente selecionado: setas movem, Shift+setas redimensionam,
          Delete remove.
        </FieldDescription>
      </FieldSet>
    </div>
  )
}
