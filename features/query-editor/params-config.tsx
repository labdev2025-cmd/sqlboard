"use client"

import * as React from "react"
import { SlidersHorizontalIcon } from "lucide-react"

import { SimpleSelect } from "@/components/simple-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { optionsToText, textToOptions } from "@/lib/sql-params/options"
import {
  PARAM_TYPE_LABELS,
  PARAM_TYPES,
  type ParamDefinition,
} from "@/lib/sql-params/types"

/** Edits type, label, required flag, default and fixed options of each parameter. */
export function ParamsConfig({
  params,
  onChange,
}: {
  params: ParamDefinition[]
  onChange: (params: ParamDefinition[]) => void
}) {
  const update = (index: number, patch: Partial<ParamDefinition>) =>
    onChange(params.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" disabled={!params.length} />
        }
      >
        <SlidersHorizontalIcon data-icon="inline-start" />
        Parâmetros
        {params.length ? (
          <Badge variant="secondary">{params.length}</Badge>
        ) : null}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar parâmetros</DialogTitle>
          <DialogDescription>
            Detectados automaticamente na query. O tipo define o campo exibido e
            a validação; o valor sempre vai separado do SQL.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-6">
          {params.map((param, index) => (
            <FieldSet key={param.name}>
              <FieldLegend className="font-mono">:{param.name}</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor={`cfg-label-${param.name}`}>
                    Rótulo
                  </FieldLabel>
                  <Input
                    id={`cfg-label-${param.name}`}
                    value={param.label ?? ""}
                    placeholder={param.name}
                    onChange={(e) =>
                      update(index, { label: e.target.value || undefined })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`cfg-type-${param.name}`}>
                    Tipo
                  </FieldLabel>
                  <SimpleSelect
                    id={`cfg-type-${param.name}`}
                    items={PARAM_TYPES.map((t) => ({
                      value: t,
                      label: PARAM_TYPE_LABELS[t],
                    }))}
                    value={param.type}
                    onValueChange={(type) => update(index, { type })}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor={`cfg-default-${param.name}`}>
                    Valor padrão
                  </FieldLabel>
                  <Input
                    id={`cfg-default-${param.name}`}
                    value={
                      Array.isArray(param.default)
                        ? param.default.join(", ")
                        : (param.default ?? "")
                    }
                    onChange={(e) =>
                      update(index, {
                        default:
                          param.type === "multi"
                            ? e.target.value
                                .split(",")
                                .map((v) => v.trim())
                                .filter(Boolean)
                            : e.target.value || null,
                      })
                    }
                  />
                  <FieldDescription>
                    {param.type === "date"
                      ? "Formato AAAA-MM-DD."
                      : "Usado ao abrir a tela."}
                  </FieldDescription>
                </Field>
                <Field orientation="horizontal" className="self-center">
                  <Switch
                    id={`cfg-required-${param.name}`}
                    checked={param.required}
                    onCheckedChange={(required) => update(index, { required })}
                  />
                  <FieldLabel
                    htmlFor={`cfg-required-${param.name}`}
                    className="font-normal"
                  >
                    Obrigatório
                  </FieldLabel>
                </Field>
                {param.type === "list" || param.type === "multi" ? (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor={`cfg-options-${param.name}`}>
                      Opções fixas
                    </FieldLabel>
                    <Textarea
                      id={`cfg-options-${param.name}`}
                      rows={4}
                      className="font-mono"
                      value={optionsToText(param.options)}
                      onChange={(e) =>
                        update(index, {
                          options: textToOptions(e.target.value),
                        })
                      }
                      placeholder={"CE|Ceará\nSP|São Paulo"}
                    />
                    <FieldDescription>
                      Uma por linha, no formato <code>valor|rótulo</code>. Nas
                      telas, as opções também podem vir de outra query.
                    </FieldDescription>
                  </Field>
                ) : null}
              </FieldGroup>
            </FieldSet>
          ))}
        </div>
        <DialogFooter>
          <DialogClose render={<Button />}>Concluir</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
