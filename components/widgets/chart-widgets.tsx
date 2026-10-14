"use client"

import * as React from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell as PieCell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { isTemporalKind, type Cell } from "@/lib/data-types"
import { formatCell, toNumber } from "@/lib/format"

import { columnIndex, type Dataset } from "./dataset"

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

type Series = { key: string; label: string; index: number }

function seriesOf(dataset: Dataset, names: string[]): Series[] {
  return names
    .map((name, i) => ({
      key: `s${i}`,
      label: name,
      index: columnIndex(dataset, name),
    }))
    .filter((s) => s.index >= 0)
}

function chartConfig(series: Series[]): ChartConfig {
  return Object.fromEntries(
    series.map((s, i) => [
      s.key,
      { label: s.label, color: PALETTE[i % PALETTE.length] },
    ])
  )
}

function buildRows(dataset: Dataset, xName: string, series: Series[]) {
  const xi = columnIndex(dataset, xName)
  const kind = dataset.columns[xi]?.kind ?? "text"
  return dataset.rows.map((row, rowIndex) => ({
    __row: rowIndex,
    x:
      xi >= 0
        ? formatCell(row[xi] ?? null, isTemporalKind(kind) ? kind : "text")
        : String(rowIndex + 1),
    ...Object.fromEntries(
      series.map((s) => [s.key, toNumber(row[s.index] ?? null)])
    ),
  }))
}

export function MissingConfig({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
      {children}
    </p>
  )
}

type ClickHandler = (row: Cell[], index: number) => void

export function CartesianChartWidget({
  kind,
  dataset,
  x,
  y,
  stacked,
  horizontal,
  label,
  onSelect,
}: {
  kind: "bar" | "line" | "area"
  dataset: Dataset
  x: string
  y: string[]
  stacked?: boolean
  horizontal?: boolean
  label: string
  onSelect?: ClickHandler
}) {
  const series = seriesOf(dataset, y)
  if (!x || !series.length) {
    return (
      <MissingConfig>
        Escolha o eixo X e pelo menos uma coluna de valores.
      </MissingConfig>
    )
  }
  const data = buildRows(dataset, x, series)
  const config = chartConfig(series)
  const click = onSelect
    ? (entry: { __row?: number } | undefined) => {
        if (entry && typeof entry.__row === "number")
          onSelect(dataset.rows[entry.__row]!, entry.__row)
      }
    : undefined
  const common = {
    accessibilityLayer: true,
    data,
    margin: { left: 4, right: 12, top: 8, bottom: 4 },
  }
  const axisX = (
    <XAxis
      dataKey="x"
      tickLine={false}
      axisLine={false}
      tickMargin={8}
      minTickGap={16}
    />
  )
  const axisY = (
    <YAxis
      tickLine={false}
      axisLine={false}
      width={48}
      tickFormatter={(v) =>
        Number(v).toLocaleString("pt-BR", { notation: "compact" })
      }
    />
  )

  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-full w-full"
      aria-label={label}
      role="img"
    >
      {kind === "bar" ? (
        <BarChart {...common} layout={horizontal ? "vertical" : "horizontal"}>
          <CartesianGrid vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis
                dataKey="x"
                type="category"
                tickLine={false}
                axisLine={false}
                width={96}
              />
            </>
          ) : (
            <>
              {axisX}
              {axisY}
            </>
          )}
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              fill={`var(--color-${s.key})`}
              radius={4}
              stackId={stacked ? "a" : undefined}
              onClick={click as never}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          ))}
        </BarChart>
      ) : kind === "line" ? (
        <LineChart
          {...common}
          onClick={
            click
              ? (state) =>
                  click(
                    (
                      state as {
                        activePayload?: { payload: { __row: number } }[]
                      }
                    )?.activePayload?.[0]?.payload
                  )
              : undefined
          }
        >
          <CartesianGrid vertical={false} />
          {axisX}
          {axisY}
          <ChartTooltip content={<ChartTooltipContent />} />
          {series.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              type="monotone"
              stroke={`var(--color-${s.key})`}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      ) : (
        <AreaChart {...common}>
          <CartesianGrid vertical={false} />
          {axisX}
          {axisY}
          <ChartTooltip content={<ChartTooltipContent indicator="dot" />} />
          {series.length > 1 ? (
            <ChartLegend content={<ChartLegendContent />} />
          ) : null}
          {series.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              type="monotone"
              fill={`var(--color-${s.key})`}
              fillOpacity={0.35}
              stroke={`var(--color-${s.key})`}
              stackId={stacked ? "a" : undefined}
            />
          ))}
        </AreaChart>
      )}
    </ChartContainer>
  )
}

export function PieChartWidget({
  dataset,
  labelColumn,
  valueColumn,
  donut,
  label,
  onSelect,
}: {
  dataset: Dataset
  labelColumn: string
  valueColumn: string
  donut: boolean
  label: string
  onSelect?: ClickHandler
}) {
  const li = columnIndex(dataset, labelColumn)
  const vi = columnIndex(dataset, valueColumn)
  if (li < 0 || vi < 0)
    return (
      <MissingConfig>Escolha a coluna da fatia e a do valor.</MissingConfig>
    )
  const data = dataset.rows.map((row, index) => ({
    key: `p${index}`,
    name: formatCell(row[li] ?? null, "text"),
    value: toNumber(row[vi] ?? null) ?? 0,
    __row: index,
  }))
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [
      d.key,
      { label: d.name, color: PALETTE[i % PALETTE.length] },
    ])
  )
  return (
    <ChartContainer
      config={config}
      className="aspect-auto h-full w-full"
      aria-label={label}
      role="img"
    >
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent nameKey="key" hideLabel />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          innerRadius={donut ? "55%" : 0}
          outerRadius="85%"
          onClick={
            onSelect
              ? (entry: { payload?: { __row: number } }) => {
                  const index = entry?.payload?.__row
                  if (typeof index === "number")
                    onSelect(dataset.rows[index]!, index)
                }
              : undefined
          }
        >
          {data.map((d) => (
            <PieCell
              key={d.key}
              fill={`var(--color-${d.key})`}
              className={onSelect ? "cursor-pointer" : undefined}
            />
          ))}
        </Pie>
        <ChartLegend
          content={<ChartLegendContent nameKey="key" className="flex-wrap" />}
        />
      </PieChart>
    </ChartContainer>
  )
}
