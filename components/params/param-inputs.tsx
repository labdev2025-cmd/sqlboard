"use client"

import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import { ptBR } from "react-day-picker/locale"

import { SimpleSelect } from "@/components/simple-select"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate } from "@/lib/format"
import type {
  ParamDefinition,
  ParamOption,
  RawParamValue,
} from "@/lib/sql-params/types"
import { cn } from "@/lib/utils"

export function paramLabel(param: ParamDefinition) {
  return param.label?.trim() || param.name
}

function toDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [y, m, d] = value.split("-").map(Number)
  return new Date(y!, m! - 1, d!)
}

function fromDate(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function DateInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const date = toDate(value)
  return (
    <div className="flex gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              variant="outline"
              data-empty={!date}
              aria-invalid={invalid || undefined}
              className="min-w-0 flex-1 justify-between font-normal data-[empty=true]:text-muted-foreground"
            />
          }
        >
          {date ? formatDate(value) : "dd/mm/aaaa"}
          <CalendarIcon data-icon="inline-end" />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            onSelect={(next) => {
              onChange(next ? fromDate(next) : "")
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>
      {value ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Limpar data"
          onClick={() => onChange("")}
        >
          <XIcon />
        </Button>
      ) : null}
    </div>
  )
}

function MultiInput({
  id,
  options,
  value,
  onChange,
}: {
  id: string
  options: ParamOption[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const anchor = useComboboxAnchor()
  const labels = new Map(options.map((o) => [o.value, o.label ?? o.value]))
  return (
    <Combobox
      multiple
      autoHighlight
      items={options.map((o) => o.value)}
      value={value}
      onValueChange={(next) => onChange((next as string[]) ?? [])}
      itemToStringLabel={(item: string) => labels.get(item) ?? item}
    >
      <ComboboxChips ref={anchor} className="w-full">
        <ComboboxValue>
          {(values: string[]) => (
            <React.Fragment>
              {values.map((item) => (
                <ComboboxChip key={item}>
                  {labels.get(item) ?? item}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                id={id}
                placeholder={values.length ? "" : "Escolha"}
              />
            </React.Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Nenhuma opção.</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {labels.get(item) ?? item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** Free-text entry for `multi` without options: comma-separated values. */
function splitList(text: string) {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
}

/** One typed input for a query parameter. */
export function ParamInput({
  param,
  value,
  onChange,
  options,
  error,
  idPrefix = "param",
}: {
  param: ParamDefinition
  value: RawParamValue
  onChange: (value: RawParamValue) => void
  /** Options loaded from another query (overrides fixed options). */
  options?: ParamOption[]
  error?: string
  idPrefix?: string
}) {
  const id = `${idPrefix}-${param.name}`
  const text = Array.isArray(value)
    ? value.join(", ")
    : value == null
      ? ""
      : String(value)
  const opts = options ?? param.options ?? []
  const invalid = Boolean(error)

  let control: React.ReactNode
  switch (param.type) {
    case "date":
      control = (
        <DateInput id={id} value={text} onChange={onChange} invalid={invalid} />
      )
      break
    case "datetime":
      // Native picker: clearly better on phones for date + time (UI.md §1.4).
      control = (
        <Input
          id={id}
          type="datetime-local"
          value={text.replace(" ", "T").slice(0, 16)}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
        />
      )
      break
    case "integer":
    case "number":
      control = (
        <Input
          id={id}
          inputMode={param.type === "integer" ? "numeric" : "decimal"}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
      )
      break
    case "boolean":
      control = (
        <SimpleSelect
          id={id}
          items={[
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={
            text === ""
              ? null
              : text === "true" || text === "sim"
                ? "true"
                : "false"
          }
          onValueChange={onChange}
          placeholder="Qualquer"
          invalid={invalid}
        />
      )
      break
    case "list":
      control = opts.length ? (
        <SimpleSelect
          id={id}
          items={opts.map((o) => ({
            value: o.value,
            label: o.label ?? o.value,
          }))}
          value={text || null}
          onValueChange={onChange}
          placeholder="Escolha"
          invalid={invalid}
        />
      ) : (
        <Input
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
        />
      )
      break
    case "multi":
      control = opts.length ? (
        <MultiInput
          id={id}
          options={opts}
          value={Array.isArray(value) ? value.map(String) : splitList(text)}
          onChange={onChange}
        />
      ) : (
        <Input
          id={id}
          value={text}
          placeholder="valor1, valor2"
          onChange={(e) => onChange(splitList(e.target.value))}
          aria-invalid={invalid || undefined}
        />
      )
      break
    default:
      control = (
        <Input
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
      )
  }

  return (
    <Field data-invalid={invalid || undefined} className="min-w-0">
      <FieldLabel htmlFor={id}>
        {paramLabel(param)}
        {param.required ? (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        ) : null}
        {param.required ? <span className="sr-only">(obrigatório)</span> : null}
      </FieldLabel>
      {control}
      {param.type === "multi" && !opts.length ? (
        <FieldDescription>Separe os valores por vírgula.</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}

/** Grid of parameter inputs. */
export function ParamsForm({
  params,
  values,
  onChange,
  optionsFor,
  className,
  idPrefix,
}: {
  params: ParamDefinition[]
  values: Record<string, RawParamValue>
  onChange: (name: string, value: RawParamValue) => void
  optionsFor?: (param: ParamDefinition) => ParamOption[] | undefined
  className?: string
  idPrefix?: string
}) {
  if (!params.length) return null
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {params.map((param) => (
        <ParamInput
          key={param.name}
          param={param}
          value={values[param.name]}
          onChange={(value) => onChange(param.name, value)}
          options={optionsFor?.(param)}
          idPrefix={idPrefix}
        />
      ))}
    </div>
  )
}
