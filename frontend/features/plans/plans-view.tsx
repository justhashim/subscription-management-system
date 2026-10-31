"use client";

import { useState } from "react";
import {
  Archive,
  Layers,
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
  useUpdatePlan,
} from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/error";
import type { PlanWithProduct } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { PlanDialog } from "@/features/plans/plan-dialog";
import { Button } from "@/components/ui/button";
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
import { formatPrice } from "@/lib/format";

export function PlansView({
  initialProductId,
}: {
  initialProductId?: string;
}) {
  const { isAdmin } = useAuth();
  const plansQuery = usePlans();
  const productsQuery = useProducts();
  const subscriptionsQuery = useSubscriptions();
  const updatePlan = useUpdatePlan();
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState(
    initialProductId ?? "ALL",
  );
  const [intervalFilter, setIntervalFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanWithProduct | null>(null);

  const plans = plansQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];

  const query = search.trim().toLowerCase();
  const filteredPlans = plans.filter((plan) => {
    const matchesQuery =
      !query ||
      plan.name.toLowerCase().includes(query) ||
      plan.product.name.toLowerCase().includes(query) ||
      plan.description.toLowerCase().includes(query);
    const matchesProduct =
      productFilter === "ALL" || plan.productId === productFilter;
    const matchesInterval =
      intervalFilter === "ALL" || plan.interval === intervalFilter;
    const matchesStatus =
      statusFilter === "ALL" || plan.status === statusFilter;

    return matchesQuery && matchesProduct && matchesInterval && matchesStatus;
  });

  async function toggleArchive(plan: PlanWithProduct) {
    try {
      await updatePlan.mutateAsync({
        id: plan.id,
        input: { status: plan.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" },
      });
      toast.success(
        plan.status === "ACTIVE" ? "Plan archived." : "Plan restored.",
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The plan could not be updated.",
      );
    }
  }

  if (plansQuery.isError || productsQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Plans"
          description="Configure the plans customers can subscribe to."
        />
        <ErrorState
          title="Plans could not be loaded"
          onRetry={() => {
            void plansQuery.refetch();
            void productsQuery.refetch();
          }}
        />
      </div>
    );
  }

  const columns: DataColumn<PlanWithProduct>[] = [
    {
      id: "plan",
      header: "Plan",
      cell: (plan) => (
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{plan.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {plan.description}
          </p>
        </div>
      ),
    },
    {
      id: "product",
      header: "Product",
      cell: (plan) => (
        <span className="text-sm text-muted-foreground">
          {plan.product.name}
        </span>
      ),
    },
    {
      id: "price",
      header: "Price",
      cell: (plan) => (
        <span className="text-sm font-medium tabular-nums">
          {formatPrice(plan.price, plan.currency, plan.interval)}
        </span>
      ),
    },
    {
      id: "features",
      header: "Features",
      cell: (plan) => (
        <span className="text-sm text-muted-foreground">
          {plan.features.length}
        </span>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      id: "subs",
      header: "Subs",
      cell: (plan) => (
        <span className="text-sm text-muted-foreground">
          {
            subscriptions.filter(
              (subscription) =>
                subscription.planId === plan.id &&
                subscription.status === "ACTIVE",
            ).length
          }
        </span>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      id: "status",
      header: "Status",
      cell: (plan) => <StatusBadge status={plan.status} />,
    },
    ...(isAdmin
      ? [
          {
            id: "actions",
            header: "",
            headerClassName: "w-12",
            className: "w-12",
            cell: (plan: PlanWithProduct) => (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${plan.name}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem
                    onClick={() => {
                      setEditingPlan(plan);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                    Edit plan
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void toggleArchive(plan)}>
                    {plan.status === "ACTIVE" ? (
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
            ),
          } satisfies DataColumn<PlanWithProduct>,
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Configure the plans customers can subscribe to. Pricing is display-only in this workspace."
        actions={
          isAdmin ? (
            <Button
              size="sm"
              disabled={products.length === 0}
              onClick={() => {
                setEditingPlan(null);
                setDialogOpen(true);
              }}
            >
              <Plus />
              New plan
            </Button>
          ) : null
        }
      />

      {isAdmin && products.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          Create a product before adding plans to the catalog.
        </div>
      ) : null}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search plans or products…"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All products</SelectItem>
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={intervalFilter} onValueChange={setIntervalFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All intervals</SelectItem>
              <SelectItem value="MONTHLY">Monthly</SelectItem>
              <SelectItem value="YEARLY">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {filteredPlans.length} of {plans.length}
          </span>
        </div>
      </div>

      <DataTable
        data={filteredPlans}
        columns={columns}
        getRowKey={(plan) => plan.id}
        loading={plansQuery.isLoading}
        emptyState={
          <EmptyState
            icon={Layers}
            title={plans.length === 0 ? "No plans yet" : "No matching plans"}
            description={
              plans.length === 0
                ? "Add a plan to a product to make it available for subscriptions."
                : "Try adjusting the search or filters."
            }
            action={
              plans.length === 0 && isAdmin && products.length > 0 ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus />
                  Create plan
                </Button>
              ) : plans.length > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setProductFilter("ALL");
                    setIntervalFilter("ALL");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        }
      />

      {dialogOpen ? (
        <PlanDialog
          key={editingPlan?.id ?? `new-${productFilter}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          plan={editingPlan}
          products={products}
          defaultProductId={
            productFilter === "ALL" ? undefined : productFilter
          }
        />
      ) : null}
    </div>
  );
}
