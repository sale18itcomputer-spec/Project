import * as React from "react"
import { SlidersHorizontal } from "lucide-react"

import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"
import { ColumnDef } from "./DataTable";

interface DataTableColumnToggleProps<TData> {
  allColumns: ColumnDef<TData>[];
  visibleColumns: Set<string>;
  onColumnToggle: (columnKey: string) => void;
  trigger?: React.ReactNode;
}

export function DataTableColumnToggle<TData>({
  allColumns,
  visibleColumns,
  onColumnToggle,
  trigger,
}: DataTableColumnToggleProps<TData>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ? trigger : (
          <Button variant="outline" size="sm" className="h-9 flex gap-1.5 px-3">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="hidden sm:inline">View</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[180px]">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {allColumns
          .filter(column => column.header && column.accessorKey)
          .map((column) => {
            const key = column.accessorKey as string;
            return (
              <DropdownMenuCheckboxItem
                key={key}
                className="capitalize"
                checked={visibleColumns.has(key)}
                onCheckedChange={() => onColumnToggle(key)}
                disabled={visibleColumns.size <= 1 && visibleColumns.has(key)}
              >
                <span className="truncate">{column.header}</span>
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}