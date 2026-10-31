"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  useSubscription,
  useUpdateSubscription,
} from "@/lib/api/hooks";
import { ApiError } from "@/lib/api/error";
import type { SubscriptionWithRelations } from "@/types/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatDate,
  formatDateTime,
  formatPrice,
  getInitials,
} from "@/lib/format";
import { useState } from "react";

export function SubscriptionDetailView({ id }: { id: string }) {
  const { user, isAdmin } = useAuth();
  const subscriptionQuery = useSubscription(id);
  const updateSubscription = useUpdateSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);

  const subscription = subscriptionQuery.data;

  if (subscriptionQuery.isLoading) {
    return <SubscriptionDetailSkeleton />;
  }

  if (subscriptionQuery.isError || !subscription) {
    return (
      <div className="space-y-6">
        <BackLink />
        <ErrorState
          title="Subscription not found"
          description="This subscription may have been removed or the link is no longer valid."
          onRetry={() => void subscriptionQuery.refetch()}
        />
      </div>
    );
  }

  const isOwner = subscription.userId === user?.id;
  const canManage = isAdmin || isOwner;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          icon={ShieldAlert}
          title="You cannot view this subscription"
          description="Members can only view subscriptions attached to their own account."
        />
      </div>
    );
  }

  const canCancel =
    subscription.status !== "CANCELED" && subscription.status !== "EXPIRED";

  async function resume() {
    try {
      await updateSubscription.mutateAsync({
        id: subscription!.id,
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

  async function cancel() {
    try {
      await updateSubscription.mutateAsync({
        id: subscription!.id,
        input: { cancelAtPeriodEnd: true },
      });
      toast.success("Subscription will cancel at the end of its period.");
      setCancelOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "The subscription could not be updated.",
      );
    }
  }

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={subscription.plan.name}
        description={`${subscription.product.name} · Subscribed by ${subscription.user.name}`}
        actions={
          <>
            <StatusBadge status={subscription.status} />
            {canManage && canCancel ? (
              subscription.cancelAtPeriodEnd ? (
                <Button size="sm" variant="outline" onClick={() => void resume()}>
                  <RotateCcw />
                  Resume renewal
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle />
                  Cancel at period end
                </Button>
              )
            ) : null}
          </>
        }
      />

      {subscription.cancelAtPeriodEnd && canCancel ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          This subscription will end on{" "}
          {formatDate(subscription.currentPeriodEnd)}. Renewal can be resumed
          before that date.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Plan details</CardTitle>
              <CardDescription>
                The catalog entry attached to this subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">{subscription.plan.name}</p>
                  <p className="max-w-lg text-sm leading-6 text-muted-foreground">
                    {subscription.plan.description}
                  </p>
                </div>
                <div className="shrink-0 rounded-xl border bg-muted/30 px-4 py-3 text-right">
                  <p className="text-lg font-semibold">
                    {formatPrice(
                      subscription.plan.price,
                      subscription.plan.currency,
                      subscription.plan.interval,
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {subscription.plan.interval === "MONTHLY"
                      ? "Billed monthly"
                      : "Billed yearly"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Included features
                </p>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {subscription.plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <Check className="size-2.5" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Lifecycle</CardTitle>
              <CardDescription>
                Key dates derived from the subscription period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LifecycleTimeline subscription={subscription} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Customer</CardTitle>
              <CardDescription>
                The account attached to this subscription.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
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
              <Separator className="my-4" />
              <dl className="space-y-2.5 text-sm">
                <DetailRow label="Role" value={subscription.user.role} />
                <DetailRow label="Account status" value={subscription.user.status} />
                <DetailRow
                  label="Customer since"
                  value={formatDate(subscription.user.createdAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-base">Billing period</CardTitle>
              <CardDescription>
                Current access window for this subscription.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <CalendarDays className="size-3.5 text-primary" />
                  {formatDate(subscription.currentPeriodStart)}
                  <span className="text-muted-foreground">→</span>
                  {formatDate(subscription.currentPeriodEnd)}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {subscription.cancelAtPeriodEnd
                    ? "Access ends at the close of this period."
                    : "Renews automatically at the close of this period."}
                </p>
              </div>

              <dl className="space-y-2.5 text-sm">
                <DetailRow
                  label="Created"
                  value={formatDate(subscription.createdAt)}
                />
                <DetailRow
                  label="Subscription ID"
                  value={subscription.id}
                />
                <DetailRow
                  label="Plan price"
                  value={formatPrice(
                    subscription.plan.price,
                    subscription.plan.currency,
                    subscription.plan.interval,
                  )}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this subscription?"
        description={`Access to ${subscription.plan.name} will continue until ${formatDate(subscription.currentPeriodEnd)}. You can resume renewal before then.`}
        confirmLabel="Cancel at period end"
        onConfirm={() => void cancel()}
        pending={updateSubscription.isPending}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Button variant="ghost" size="sm" className="-ml-2" asChild>
      <Link href="/subscriptions">
        <ArrowLeft />
        All subscriptions
      </Link>
    </Button>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] truncate text-right font-medium">{value}</dd>
    </div>
  );
}

function LifecycleTimeline({
  subscription,
}: {
  subscription: SubscriptionWithRelations;
}) {
  const events = [
    {
      icon: Sparkles,
      title: "Subscription created",
      description: "The customer was attached to this plan.",
      date: subscription.createdAt,
      tone: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300",
    },
    {
      icon: Clock3,
      title: "Current period started",
      description: "Access began for the current billing period.",
      date: subscription.currentPeriodStart,
      tone: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300",
    },
    {
      icon: subscription.cancelAtPeriodEnd ? XCircle : RotateCcw,
      title: subscription.cancelAtPeriodEnd
        ? "Scheduled cancellation"
        : "Next renewal",
      description: subscription.cancelAtPeriodEnd
        ? "Access ends when the current period closes."
        : "The subscription renews automatically.",
      date: subscription.currentPeriodEnd,
      tone: subscription.cancelAtPeriodEnd
        ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300",
    },
  ];

  return (
    <ol className="relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-border">
      {events.map((event) => (
        <li key={event.title} className="relative flex gap-3.5">
          <span
            className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${event.tone}`}
          >
            <event.icon className="size-4" />
          </span>
          <div className="min-w-0 pt-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <p className="text-sm font-medium">{event.title}</p>
              <span className="text-[11px] text-muted-foreground">
                {formatDateTime(event.date)}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              {event.description}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function SubscriptionDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-32" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
