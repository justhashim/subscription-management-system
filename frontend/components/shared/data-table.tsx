import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface DataColumn<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataColumn<T>[];
  getRowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  data,
  columns,
  getRowKey,
  loading = false,
  skeletonRows = 5,
  emptyState,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (!loading && data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-xs",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "h-10 whitespace-nowrap text-xs font-medium tracking-wide text-muted-foreground uppercase",
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <TableRow key={`skeleton-${rowIndex}`}>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        <Skeleton className="h-5 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data.map((row) => (
                  <TableRow
                    key={getRowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "group",
                      onRowClick && "cursor-pointer hover:bg-muted/50",
                    )}
                  >
                    {columns.map((column) => (
                      <TableCell
                        key={column.id}
                        className={cn("py-3", column.className)}
                      >
                        {column.cell(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
