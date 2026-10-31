"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth/auth-provider";
import { ApiError } from "@/lib/api/error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/shared/form-field";
import { Logo } from "@/components/layout/logo";

const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(60, "Name is too long."),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(6, "Password must be at least 6 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: createAccount } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterValues) {
    setFormError(undefined);

    try {
      await createAccount({
        name: values.name,
        email: values.email,
        password: values.password,
      });
      toast.success("Your workspace account is ready.");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to create your account. Please try again.",
      );
    }
  }

  return (
    <div className="space-y-8">
      <div className="lg:hidden">
        <Logo />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Get started
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Create your Orbit account
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          New accounts join as members. An admin can upgrade your access later.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormError message={formError} />

        <Field label="Full name" htmlFor="name" error={errors.name?.message}>
          <Input
            id="name"
            autoComplete="name"
            placeholder="Jordan Lee"
            className="h-10"
            {...register("name")}
          />
        </Field>

        <Field
          label="Work email"
          htmlFor="email"
          error={errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            className="h-10"
            {...register("email")}
          />
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint="At least 6 characters."
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              className="h-10 pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </Field>

        <Field
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Repeat your password"
            className="h-10"
            {...register("confirmPassword")}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
