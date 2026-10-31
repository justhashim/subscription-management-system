"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/error";
import { useCreatePlan, useUpdatePlan } from "@/lib/api/hooks";
import type { PlanWithProduct, Product } from "@/types/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const planSchema = z.object({
  productId: z.string().min(1, "Select a product."),
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(80, "Name is too long."),
  description: z
    .string()
    .trim()
    .min(10, "Add a short description of at least 10 characters.")
    .max(240, "Description is too long."),
  price: z.number().min(0, "Price cannot be negative."),
  currency: z.enum(["USD", "EUR", "GBP"]),
  interval: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  features: z.string().max(1000, "Features are too long."),
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

type PlanValues = z.infer<typeof planSchema>;

export function PlanDialog({
  open,
  onOpenChange,
  plan,
  products,
  defaultProductId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: PlanWithProduct | null;
  products: Product[];
  defaultProductId?: string;
}) {
  const createPlan = useCreatePlan();
  const updatePlan = useUpdatePlan();
  const [formError, setFormError] = useState<string>();
  const defaults: PlanValues = {
    productId: defaultProductId ?? products[0]?.id ?? "",
    name: "",
    description: "",
    price: 0,
    currency: "USD",
    interval: "MONTHLY",
    features: "",
    status: "ACTIVE",
  };
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PlanValues>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          productId: plan.productId,
          name: plan.name,
          description: plan.description,
          price: plan.price / 100,
          currency: plan.currency,
          interval: plan.interval,
          features: plan.features.join("\n"),
          status: plan.status,
        }
      : defaults,
  });

  async function onSubmit(values: PlanValues) {
    setFormError(undefined);

    const input = {
      productId: values.productId,
      name: values.name,
      description: values.description,
      price: Math.round(values.price * 100),
      currency: values.currency,
      interval: values.interval,
      features: values.features
        .split(/[\n,]/)
        .map((feature) => feature.trim())
        .filter(Boolean),
      status: values.status,
    };

    try {
      if (plan) {
        await updatePlan.mutateAsync({ id: plan.id, input });
        toast.success("Plan updated.");
      } else {
        await createPlan.mutateAsync(input);
        toast.success("Plan created.");
      }

      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "The plan could not be saved.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            Define the catalog entry customers subscribe to. Pricing is stored
            as a display value; billing calculations live in the billing
            service.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormError message={formError} />

          <Field label="Product" error={errors.productId?.message}>
            <Controller
              control={control}
              name="productId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Plan name"
              htmlFor="plan-name"
              error={errors.name?.message}
            >
              <Input
                id="plan-name"
                placeholder="Scale"
                {...register("name")}
              />
            </Field>

            <Field label="Status" error={errors.status?.message}>
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
                      <SelectItem value="ARCHIVED">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field
            label="Description"
            htmlFor="plan-description"
            error={errors.description?.message}
          >
            <Textarea
              id="plan-description"
              placeholder="Who is this plan for?"
              rows={2}
              {...register("description")}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Price"
              htmlFor="plan-price"
              error={errors.price?.message}
              hint="Major units"
            >
              <Input
                id="plan-price"
                type="number"
                min="0"
                step="0.01"
                {...register("price", { valueAsNumber: true })}
              />
            </Field>

            <Field label="Currency" error={errors.currency?.message}>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <Field label="Billing interval" error={errors.interval?.message}>
              <Controller
                control={control}
                name="interval"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAILY">Daily</SelectItem>
                      <SelectItem value="WEEKLY">Weekly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="YEARLY">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>

          <Field
            label="Features"
            htmlFor="plan-features"
            error={errors.features?.message}
            hint="One feature per line, or separate with commas."
          >
            <Textarea
              id="plan-features"
              placeholder={"Unlimited seats\nPriority support\nCustom dashboards"}
              rows={4}
              {...register("features")}
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              {plan ? "Save changes" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
