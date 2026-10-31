"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  CreditCard,
  MoreHorizontal,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  usePlans,
  useSubscriptions,
  useUpdateSubscription,
  useUsers,
} from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/error";
import type { SubscriptionWithRelations } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SubscriptionDialog } from "@/features/subscriptions/subscription-dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { formatCurrency, formatDate, getInitials } from "@/lib/format";

export function SubscriptionsView({
  initialCreate = false,
}: {
  initialCreate?: boolean;
}) {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const subscriptionsQuery = useSubscriptions();
  const usersQuery = useUsers();
  const plansQuery = usePlans();
  const updateSubscription = useUpdateSubscription();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(initialCreate && isAdmin);
  const [canceling, setCanceling] =
    useState<SubscriptionWithRelations | null>(null);

  const subscriptions = subscriptionsQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const plans = plansQuery.data ?? [];

  const scopedSubscriptions = isAdmin
    ? subscriptions
    : subscriptions.filter((item) => item.userId === user?.id);
  const query = search.trim().toLowerCase();
  const visibleSubscriptions = scopedSubscriptions.filter((subscription) => {
    const matchesQuery =
      !query ||
      subscription.user.name.toLowerCase().includes(query) ||
      subscription.user.email.toLowerCase().includes(query) ||
      subscription.plan.name.toLowerCase().includes(query) ||
      subscription.product.name.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "ALL" || subscription.status === statusFilter;

    return matchesQuery && matchesStatus;
  });

  async function resumeSubscription(subscription: SubscriptionWithRelations) {
    try {
      await updateSubscription.mutateAsync({
        id: subscription.id,
        input: { cancelAtPeriodEnd: false },
      });
      toast.success("Subscription renewal resumed.");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The subscription could not be updated.",
      );
    }
  }

  async function cancelSubscription() {
    if (!canceling) {
      return;
    }

    try {
      await updateSubscription.mutateAsync({
        id: canceling.id,
        input: { cancelAtPeriodEnd: true },
      });
      toast.success("Subscription will cancel at the end of its period.");
      setCanceling(null);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The subscription could not be updated.",
      );
    }
  }

  if (subscriptionsQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Subscriptions"
          description="Track customer subscription lifecycle and renewal status."
        />
        <ErrorState
          title="Subscriptions could not be loaded"
          onRetry={() => void subscriptionsQuery.refetch()}
        />
      </div>
    );
  }

  const columns: DataColumn<SubscriptionWithRelations>[] = [
    ...(isAdmin
      ? [
          {
            id: "customer",
            header: "Customer",
            cell: (subscription: SubscriptionWithRelations) => (
              <div className="flex items-center gap-2.5">
                <Avatar className="size-7">
                  <AvatarFallback className="bg-muted text-[10px] font-medium">
                    {getInitials(subscription.user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {subscription.user.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {subscription.user.email}
                  </p>
                </div>
              </div>
            ),
          } satisfies DataColumn<SubscriptionWithRelations>,
        ]
      : []),
    {
      id: "plan",
      header: "Plan",
      cell: (subscription) => (
        <div>
          <p className="text-sm font-medium">{subscription.plan.name}</p>
          <p className="text-xs text-muted-foreground">
            {subscription.product.name}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (subscription) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge status={subscription.status} />
          {subscription.cancelAtPeriodEnd ? (
            <span className="text-[10px] text-amber-600 dark:text-amber-300">
              Cancels at period end
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "price",
      header: "Price",
      cell: (subscription) => (
        <span className="text-sm tabular-nums">
          {subscription.plan.price === 0
            ? "Free"
            : formatCurrency(
                subscription.plan.price,
                subscription.plan.currency,
              )}
        </span>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      id: "period",
      header: "Current period",
      cell: (subscription) => (
        <div className="text-xs text-muted-foreground">
          <p>{formatDate(subscription.currentPeriodStart)}</p>
          <p>to {formatDate(subscription.currentPeriodEnd)}</p>
        </div>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      id: "actions",
      header: "",
      headerClassName: "w-12",
      className: "w-12",
      cell: (subscription) => {
        const canManage =
          isAdmin || subscription.userId === user?.id;
        const canCancel =
          canManage &&
          subscription.status !== "CANCELED" &&
          subscription.status !== "EXPIRED";

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${subscription.plan.name}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onClick={() =>
                  router.push(`/subscriptions/${subscription.id}`)
                }
              >
                View details
              </DropdownMenuItem>
              {canCancel ? (
                <>
                  <DropdownMenuSeparator />
                  {subscription.cancelAtPeriodEnd ? (
                    <DropdownMenuItem
                      onClick={() => void resumeSubscription(subscription)}
                    >
                      <RotateCcw />
                      Resume renewal
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setCanceling(subscription)}
                    >
                      <XCircle />
                      Cancel at period end
                    </DropdownMenuItem>
                  )}
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const summaries = [
    {
      label: "Active",
      value: scopedSubscriptions.filter((item) => item.status === "ACTIVE")
        .length,
      tone: "text-emerald-600 dark:text-emerald-300",
    },
    {
      label: "Trialing",
      value: scopedSubscriptions.filter((item) => item.status === "TRIALING")
        .length,
      tone: "text-sky-600 dark:text-sky-300",
    },
    {
      label: "Past due",
      value: scopedSubscriptions.filter((item) => item.status === "PAST_DUE")
        .length,
      tone: "text-amber-600 dark:text-amber-300",
    },
    {
      label: "Canceling",
      value: scopedSubscriptions.filter((item) => item.cancelAtPeriodEnd).length,
      tone: "text-rose-600 dark:text-rose-300",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description={
          isAdmin
            ? "Track every customer subscription, its current period, and its renewal status."
            : "Review the plans attached to your account and manage renewals."
        }
        actions={
          isAdmin ? (
            <Button
              size="sm"
              disabled={users.length === 0 || plans.length === 0}
              onClick={() => setDialogOpen(true)}
            >
              <Plus />
              New subscription
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaries.map((summary) => (
          <div
            key={summary.label}
            className="rounded-xl border bg-card px-4 py-3 shadow-xs"
          >
            <p className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {summary.label}
            </p>
            <p className={`mt-1 text-xl font-semibold ${summary.tone}`}>
              {summary.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={
            isAdmin ? "Search customer or plan…" : "Search your plans…"
          }
        />
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="TRIALING">Trialing</SelectItem>
              <SelectItem value="PAST_DUE">Past due</SelectItem>
              <SelectItem value="CANCELED">Canceled</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            {visibleSubscriptions.length} of {scopedSubscriptions.length}
          </span>
        </div>
      </div>

      <DataTable
        data={visibleSubscriptions}
        columns={columns}
        getRowKey={(subscription) => subscription.id}
        loading={subscriptionsQuery.isLoading}
        onRowClick={(subscription) =>
          router.push(`/subscriptions/${subscription.id}`)
        }
        emptyState={
          <EmptyState
            icon={CreditCard}
            title={
              scopedSubscriptions.length === 0
                ? "No subscriptions yet"
                : "No matching subscriptions"
            }
            description={
              scopedSubscriptions.length === 0
                ? isAdmin
                  ? "Create the first subscription to start tracking lifecycle status."
                  : "You do not have a subscription yet. Browse available plans to get started."
                : "Try adjusting your search or status filter."
            }
            action={
              scopedSubscriptions.length === 0 && isAdmin ? (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus />
                  New subscription
                </Button>
              ) : scopedSubscriptions.length > 0 ? (
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
        }
      />

      {dialogOpen && isAdmin ? (
        <SubscriptionDialog
          key={`${users.length}-${plans.length}`}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          users={users}
          plans={plans}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(canceling)}
        onOpenChange={(open) => {
          if (!open) {
            setCanceling(null);
          }
        }}
        title="Cancel this subscription?"
        description={
          canceling
            ? `${canceling.user.name} will keep access to ${canceling.plan.name} until ${formatDate(canceling.currentPeriodEnd)}. You can resume renewal before then.`
            : ""
        }
        confirmLabel="Cancel at period end"
        onConfirm={() => void cancelSubscription()}
        pending={updateSubscription.isPending}
      />

      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <CalendarClock className="size-3.5" />
        Renewal dates and lifecycle transitions are display-only in this demo and
        will come from the subscription service.
      </div>
    </div>
  );
}
