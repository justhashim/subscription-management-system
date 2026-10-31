"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Boxes,
  CreditCard,
  Layers,
  Plus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  usePlans,
  useProducts,
  useSubscriptions,
  useUsers,
} from "@/lib/api/hooks";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { DataTable, type DataColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCurrency,
  formatDate,
  getInitials,
  titleCase,
} from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { SubscriptionWithRelations } from "@/types/api";

const statusOrder = ["ACTIVE", "TRIALING", "PAST_DUE", "CANCELED"] as const;

const statusBarColors: Record<string, string> = {
  ACTIVE: "bg-emerald-500",
  TRIALING: "bg-sky-500",
  PAST_DUE: "bg-amber-500",
  CANCELED: "bg-rose-400",
};

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const usersQuery = useUsers();
  const productsQuery = useProducts();
  const plansQuery = usePlans();
  const subscriptionsQuery = useSubscriptions();

  const isLoading =
    usersQuery.isLoading ||
    productsQuery.isLoading ||
    plansQuery.isLoading ||
    subscriptionsQuery.isLoading;
  const hasError =
    usersQuery.isError ||
    productsQuery.isError ||
    plansQuery.isError ||
    subscriptionsQuery.isError;

  const users = usersQuery.data ?? [];
  const products = productsQuery.data ?? [];
  const plans = plansQuery.data ?? [];
  const subscriptions = subscriptionsQuery.data ?? [];

  const visibleSubscriptions = isAdmin
    ? subscriptions
    : subscriptions.filter((item) => item.userId === user?.id);

  const activeSubscriptions = visibleSubscriptions.filter(
    (item) => item.status === "ACTIVE",
  );
  const recentSubscriptions = visibleSubscriptions.slice(0, 6);
  const statusCounts = statusOrder.map((status) => ({
    status,
    count: visibleSubscriptions.filter((item) => item.status === status).length,
  }));

  const columns: DataColumn<SubscriptionWithRelations>[] = [
    {
      id: "customer",
      header: "Customer",
      cell: (subscription) => (
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
    },
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
      cell: (subscription) => <StatusBadge status={subscription.status} />,
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
      header: "Renews",
      cell: (subscription) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(subscription.currentPeriodEnd)}
        </span>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
  ];

  if (hasError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Overview"
          description="A live snapshot of your subscription workspace."
        />
        <ErrorState
          title="The workspace could not be loaded"
          description="Check that the data source is available, then try again."
          onRetry={() => {
            void usersQuery.refetch();
            void productsQuery.refetch();
            void plansQuery.refetch();
            void subscriptionsQuery.refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <PageHeader
        title={`Welcome back, ${user?.name.split(" ")[0] ?? "there"}`}
        description="Here is what is happening across your subscription workspace."
        actions={
          <>
            <Badge
              variant="outline"
              className="hidden border-border bg-card text-muted-foreground sm:inline-flex"
            >
              {isAdmin ? "Workspace admin" : "Member view"}
            </Badge>
            {isAdmin ? (
              <Button asChild size="sm">
                <Link href="/subscriptions?create=true">
                  <Plus />
                  New subscription
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="shadow-xs">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-4 h-7 w-16" />
                <Skeleton className="mt-3 h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={isAdmin ? "Users" : "Your subscriptions"}
            value={isAdmin ? users.length : visibleSubscriptions.length}
            hint={
              isAdmin
                ? `${users.filter((item) => item.status === "ACTIVE").length} active accounts`
                : `${activeSubscriptions.length} currently active`
            }
            icon={isAdmin ? Users : CreditCard}
            tone="indigo"
          />
          <StatCard
            label="Active subscriptions"
            value={activeSubscriptions.length}
            hint={`${visibleSubscriptions.filter((item) => item.status === "TRIALING").length} trials in progress`}
            icon={CreditCard}
            tone="emerald"
          />
          <StatCard
            label="Products"
            value={products.filter((item) => item.status === "ACTIVE").length}
            hint={`${products.filter((item) => item.status === "ARCHIVED").length} archived`}
            icon={Boxes}
            tone="sky"
          />
          <StatCard
            label="Plans"
            value={plans.filter((item) => item.status === "ACTIVE").length}
            hint={`Across ${products.length} products`}
            icon={Layers}
            tone="amber"
          />
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-start justify-between gap-4 border-b">
            <div>
              <CardTitle className="text-base">
                {isAdmin ? "Recent subscriptions" : "Your subscriptions"}
              </CardTitle>
              <CardDescription>
                {isAdmin
                  ? "The latest customer subscriptions across every product."
                  : "Plans attached to your account and their renewal dates."}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/subscriptions">
                View all
                <ArrowUpRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-5">
            <DataTable
              data={recentSubscriptions}
              columns={isAdmin ? columns : columns.filter((column) => column.id !== "customer")}
              getRowKey={(subscription) => subscription.id}
              loading={isLoading}
              skeletonRows={4}
              onRowClick={(subscription) =>
                router.push(`/subscriptions/${subscription.id}`)
              }
              getRowLabel={(subscription) =>
                `Open ${subscription.user.name}'s ${subscription.plan.name} subscription`
              }
              className="border-0 shadow-none"
              emptyState={
                <EmptyState
                  icon={CreditCard}
                  title="No subscriptions yet"
                  description={
                    isAdmin
                      ? "Create the first subscription to see lifecycle activity here."
                      : "You do not have a subscription yet. Browse the catalog to see available plans."
                  }
                  action={
                    <Button asChild size="sm">
                      <Link href={isAdmin ? "/subscriptions" : "/plans"}>
                        {isAdmin ? "Create subscription" : "Browse plans"}
                      </Link>
                    </Button>
                  }
                />
              }
            />
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Status breakdown</CardTitle>
              <CardDescription>
                Lifecycle distribution for{" "}
                {isAdmin ? "all subscriptions" : "your subscriptions"}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {statusCounts.map((item) => {
                const percentage =
                  visibleSubscriptions.length === 0
                    ? 0
                    : Math.round(
                        (item.count / visibleSubscriptions.length) * 100,
                      );

                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{titleCase(item.status)}</span>
                      <span className="text-muted-foreground">
                        {item.count} · {percentage}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${statusBarColors[item.status]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-indigo-100 bg-gradient-to-br from-indigo-50 via-background to-violet-50 shadow-xs dark:border-indigo-500/20 dark:from-indigo-500/10 dark:via-card dark:to-violet-500/5">
            <CardHeader>
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Jump into the work your team does most often."
                  : "Explore the catalog and manage your own plan."}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {isAdmin ? (
                <>
                  <QuickAction
                    href="/products"
                    icon={Boxes}
                    label="Add a product"
                    description="Create a new catalog entry"
                  />
                  <QuickAction
                    href="/plans"
                    icon={Layers}
                    label="Configure a plan"
                    description="Attach pricing and features"
                  />
                  <QuickAction
                    href="/users"
                    icon={Users}
                    label="Invite a teammate"
                    description="Manage workspace access"
                  />
                </>
              ) : (
                <>
                  <QuickAction
                    href="/plans"
                    icon={Layers}
                    label="Browse plans"
                    description="See what is available"
                  />
                  <QuickAction
                    href="/subscriptions"
                    icon={CreditCard}
                    label="Manage subscription"
                    description="Review status and renewal"
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-border/70 bg-background/70 p-2.5 transition-colors hover:border-primary/25 hover:bg-background"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
