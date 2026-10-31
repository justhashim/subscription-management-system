"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/error";
import { useCreateSubscription } from "@/lib/api/hooks";
import type { PlanWithProduct, User } from "@/types/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormError } from "@/components/shared/form-field";
import { formatPrice } from "@/lib/format";

const subscriptionSchema = z.object({
  userId: z.string().min(1, "Select a customer."),
  planId: z.string().min(1, "Select a plan."),
  status: z.enum(["TRIALING", "ACTIVE"]),
});

type SubscriptionValues = z.infer<typeof subscriptionSchema>;

export function SubscriptionDialog({
  open,
  onOpenChange,
  users,
  plans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  plans: PlanWithProduct[];
}) {
  const createSubscription = useCreateSubscription();
  const [formError, setFormError] = useState<string>();
  const defaults: SubscriptionValues = {
    userId: users[0]?.id ?? "",
    planId: plans[0]?.id ?? "",
    status: "ACTIVE",
  };
  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: defaults,
  });

  async function onSubmit(values: SubscriptionValues) {
    setFormError(undefined);

    try {
      await createSubscription.mutateAsync(values);
      toast.success("Subscription created.");
      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "The subscription could not be created.",
      );
    }
  }

  const availableUsers = users.filter((user) => user.status === "ACTIVE");
  const availablePlans = plans.filter(
    (plan) => plan.status === "ACTIVE" && plan.product.status === "ACTIVE",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New subscription</DialogTitle>
          <DialogDescription>
            Attach an active plan to a customer. Period dates are managed by the
            subscription service.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormError message={formError} />

          <Field label="Customer" error={errors.userId?.message}>
            <Controller
              control={control}
              name="userId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} · {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Plan" error={errors.planId?.message}>
            <Controller
              control={control}
              name="planId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.product.name} · {plan.name} ·{" "}
                        {formatPrice(plan.price, plan.currency, plan.interval)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Initial status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="TRIALING">Trialing</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {availableUsers.length === 0 || availablePlans.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              You need at least one active customer and one active plan before
              creating a subscription.
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                availableUsers.length === 0 ||
                availablePlans.length === 0
              }
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Create subscription
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
