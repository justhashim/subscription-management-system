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
  getRowLabel?: (row: T) => string;
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
  getRowLabel,
  className,
}: DataTableProps<T>) {
  if (!loading && data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      className={cn(
        "overflow-hidden border border-foreground/80 bg-card",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
              <TableRow className="border-b-2 border-foreground/80 bg-muted/50 hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "h-10 whitespace-nowrap font-mono text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase",
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
                    onKeyDown={
                      onRowClick
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={
                      onRowClick
                        ? (getRowLabel?.(row) ?? "Open row")
                        : undefined
                    }
                    className={cn(
                        "group border-b border-border/80 last:border-b-0",
                        onRowClick && "cursor-pointer hover:bg-primary/5",
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
