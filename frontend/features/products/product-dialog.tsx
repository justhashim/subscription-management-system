"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/error";
import { useCreateProduct, useUpdateProduct } from "@/lib/api/hooks";
import type { Product } from "@/types/api";
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

const productSchema = z.object({
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
  status: z.enum(["ACTIVE", "ARCHIVED"]),
});

type ProductValues = z.infer<typeof productSchema>;

const defaults: ProductValues = {
  name: "",
  description: "",
  status: "ACTIVE",
};

export function ProductDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product | null;
}) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description,
          status: product.status,
        }
      : defaults,
  });

  async function onSubmit(values: ProductValues) {
    setFormError(undefined);

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, input: values });
        toast.success("Product updated.");
      } else {
        await createProduct.mutateAsync(values);
        toast.success("Product created.");
      }

      onOpenChange(false);
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "The product could not be saved.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Products group the plans customers can subscribe to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormError message={formError} />

          <Field
            label="Product name"
            htmlFor="product-name"
            error={errors.name?.message}
          >
            <Input
              id="product-name"
              placeholder="Atlas Analytics"
              {...register("name")}
            />
          </Field>

          <Field
            label="Description"
            htmlFor="product-description"
            error={errors.description?.message}
          >
            <Textarea
              id="product-description"
              placeholder="What does this product help customers do?"
              rows={3}
              {...register("description")}
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
              {product ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
