"use client"

import * as React from "react"
import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { isNumericKind, type Cell, type ResultColumn } from "@/lib/data-types"
import { compareCells, formatCell, formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
})

type Row = { index: number; cells: Cell[] }
const helper = createColumnHelper<typeof features, Row>()

export type ResultTableProps = {
  columns: ResultColumn[]
  rows: Cell[][]
  pageSize?: number
  searchable?: boolean
  /** Accessible name of the table. */
  label: string
  /** Makes rows activatable (click / Enter); used by bindings. */
  onRowActivate?: (row: Cell[], index: number) => void
  selectedIndex?: number | null
  /** Visible column names (in order); default: all. */
  visibleColumns?: string[]
  className?: string
}

/**
 * Data Table for query results: typed formatting, sorting, pagination,
 * search and resizable columns (shadcn Table + TanStack Table v9).
 */
export function ResultTable({
  columns,
  rows,
  pageSize = 25,
  searchable = true,
  label,
  onRowActivate,
  selectedIndex,
  visibleColumns,
  className,
}: ResultTableProps) {
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize,
  })

  const shown = React.useMemo(() => {
    const indexes = columns.map((_, i) => i)
    if (!visibleColumns?.length) return indexes
    return visibleColumns
      .map((name) => columns.findIndex((c) => c.name === name))
      .filter((i) => i >= 0)
  }, [columns, visibleColumns])

  const data = React.useMemo<Row[]>(() => {
    const all = rows.map((cells, index) => ({ index, cells }))
    const term = search.trim().toLowerCase()
    if (!term) return all
    return all.filter((row) =>
      shown.some((i) =>
        formatCell(row.cells[i] ?? null, columns[i]!.kind)
          .toLowerCase()
          .includes(term)
      )
    )
  }, [rows, search, columns, shown])

  const tableColumns = React.useMemo(
    () =>
      helper.columns(
        shown.map((i) => {
          const column = columns[i]!
          return helper.accessor((row): Cell => row.cells[i] ?? null, {
            id: `c${i}`,
            header: column.name,
            size: isNumericKind(column.kind) ? 120 : 180,
            minSize: 60,
            sortFn: (a, b) =>
              compareCells(
                a.original.cells[i] ?? null,
                b.original.cells[i] ?? null,
                column.kind
              ),
            cell: ({ row }) => {
              const value = row.original.cells[i] ?? null
              return (
                <span
                  className={cn(
                    "block truncate",
                    value === null && "text-muted-foreground",
                    isNumericKind(column.kind) && "text-right tabular-nums"
                  )}
                  title={
                    value === null ? undefined : formatCell(value, column.kind)
                  }
                >
                  {formatCell(value, column.kind)}
                </span>
              )
            },
          })
        })
      ),
    [columns, shown]
  )

  const table = useTable({
    features,
    data,
    columns: tableColumns,
    columnResizeMode: "onChange",
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    state: { sorting, pagination },
  })

  const pageCount = Math.max(1, table.getPageCount())
  const totalWidth = table.getTotalSize()

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {searchable ? (
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={`Buscar em ${label}`}
            placeholder="Buscar nos resultados"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPagination((p) => ({ ...p, pageIndex: 0 }))
            }}
          />
        </InputGroup>
      ) : null}
      <div className="min-w-0 overflow-x-auto rounded-lg border">
        <Table
          aria-label={label}
          className="table-fixed"
          style={{ minWidth: totalWidth }}
        >
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const kind = columns[Number(header.column.id.slice(1))]?.kind
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: header.getSize() }}
                      className="relative px-1"
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full justify-start px-1.5",
                          kind && isNumericKind(kind) && "justify-end"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                        title={`Ordenar por ${String(header.column.columnDef.header)}`}
                      >
                        <span className="truncate">
                          <table.FlexRender header={header} />
                        </span>
                        {sorted === "asc" ? (
                          <ArrowUpIcon data-icon="inline-end" />
                        ) : sorted === "desc" ? (
                          <ArrowDownIcon data-icon="inline-end" />
                        ) : (
                          <ArrowUpDownIcon
                            data-icon="inline-end"
                            className="opacity-40"
                          />
                        )}
                      </Button>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionar coluna ${String(header.column.columnDef.header)}`}
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        onDoubleClick={() => header.column.resetSize()}
                        className={cn(
                          "absolute top-0 right-0 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-border",
                          header.column.getIsResizing() && "bg-primary"
                        )}
                      />
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const active = selectedIndex === row.original.index
                return (
                  <TableRow
                    key={row.id}
                    data-state={active ? "selected" : undefined}
                    tabIndex={onRowActivate ? 0 : undefined}
                    aria-selected={onRowActivate ? active : undefined}
                    className={cn(
                      onRowActivate &&
                        "cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                    )}
                    onClick={
                      onRowActivate
                        ? () =>
                            onRowActivate(
                              row.original.cells,
                              row.original.index
                            )
                        : undefined
                    }
                    onKeyDown={
                      onRowActivate
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              onRowActivate(
                                row.original.cells,
                                row.original.index
                              )
                            }
                          }
                        : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        style={{ width: cell.column.getSize() }}
                        className="px-2.5"
                      >
                        <table.FlexRender cell={cell} />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={Math.max(1, shown.length)}
                  className="h-20 text-center text-muted-foreground"
                >
                  {search
                    ? "Nenhuma linha corresponde à busca."
                    : "A consulta não retornou linhas."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {formatCount(data.length)} {data.length === 1 ? "linha" : "linhas"}
          {search ? ` (de ${formatCount(rows.length)})` : ""}
        </span>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Página anterior"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon />
            </Button>
            <span className="px-2 tabular-nums" aria-live="polite">
              {pagination.pageIndex + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próxima página"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
