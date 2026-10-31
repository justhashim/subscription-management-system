"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArrowUpRight,
  Boxes,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  usePlans,
  useProducts,
  useSubscriptions,
  useUpdateProduct,
} from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/error";
import type { Product } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ProductDialog } from "@/features/products/product-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const iconTones = [
  "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
  "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
  "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
];

export default function ProductsPage() {
  const { isAdmin } = useAuth();
  const productsQuery = useProducts();
  const plansQuery = usePlans();
  const subscriptionsQuery = useSubscriptions();
  const updateProduct = useUpdateProduct();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const products = productsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];

  const query = search.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "ALL" || product.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  async function toggleArchive(product: Product) {
    try {
      await updateProduct.mutateAsync({
        id: product.id,
        input: {
          status: product.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE",
        },
      });
      toast.success(
        product.status === "ACTIVE" ? "Product archived." : "Product restored.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The product could not be updated.",
      );
    }
  }

  if (productsQuery.isError || plansQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Products"
          description="Organize the products your customers subscribe to."
        />
        <ErrorState
          title="Products could not be loaded"
          onRetry={() => {
            void productsQuery.refetch();
            void plansQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Organize the products your customers subscribe to. Each product can hold multiple plans."
        actions={
          isAdmin ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setDialogOpen(true);
              }}
            >
              <Plus />
              New product
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search products…"
        />
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filteredProducts.length} of {products.length}
          </span>
        </div>
      </div>

      {productsQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="shadow-xs">
              <CardHeader>
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="mt-3 h-5 w-36" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title={products.length === 0 ? "No products yet" : "No matching products"}
          description={
            products.length === 0
              ? "Create your first product to start building a plan catalog."
              : "Try a different search or status filter."
          }
          action={
            products.length === 0 && isAdmin ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus />
                Create product
              </Button>
            ) : products.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product, index) => {
            const productPlans = plans.filter(
              (plan) => plan.productId === product.id,
            );
            const activeSubscriptions = subscriptions.filter(
              (subscription) =>
                subscription.product.id === product.id &&
                subscription.status === "ACTIVE",
            );
            const tone = iconTones[index % iconTones.length];

            return (
              <Card
                key={product.id}
                className={cn(
                  "group flex flex-col shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md",
                  product.status === "ARCHIVED" && "opacity-75",
                )}
              >
                <CardHeader className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-xl",
                        tone,
                      )}
                    >
                      <Boxes className="size-5" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={product.status} />
                      {isAdmin ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${product.name}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditingProduct(product);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil />
                              Edit product
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => void toggleArchive(product)}
                            >
                              {product.status === "ACTIVE" ? (
                                <>
                                  <Archive />
                                  Archive
                                </>
                              ) : (
                                <>
                                  <RotateCcw />
                                  Restore
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                  <div className="pt-1">
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2 leading-5">
                      {product.description}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 divide-x rounded-lg border bg-muted/30 py-2">
                    <div className="px-3">
                      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        Plans
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">
                        {productPlans.length}
                      </p>
                    </div>
                    <div className="px-3">
                      <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                        Active subs
                      </p>
                      <p className="mt-0.5 text-sm font-semibold">
                        {activeSubscriptions.length}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-between"
                    asChild
                  >
                    <Link href={`/plans?productId=${product.id}`}>
                      View plans
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dialogOpen ? (
        <ProductDialog
          key={editingProduct?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={editingProduct}
        />
      ) : null}
    </div>
  );
}
