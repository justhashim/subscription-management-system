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

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    setFormError(undefined);

    try {
      await login(values);
      toast.success("Welcome back to Orbit.");
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    }
  }

  async function signInAsDemo(role: "admin" | "member") {
    const email = `${role}@example.com`;
    setValue("email", email, { shouldValidate: true });
    setValue("password", "password", { shouldValidate: true });
    await onSubmit({ email, password: "password" });
  }

  return (
    <div className="space-y-8">
      <div className="lg:hidden">
        <Logo />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          Welcome back
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Sign in to your workspace
        </h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Use your account or jump into a demo role below.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void signInAsDemo("admin")}
          disabled={isSubmitting}
          className="rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
        >
          <span className="text-[11px] font-semibold text-primary">Admin</span>
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            Full catalog, users, and subscriptions
          </span>
        </button>
        <button
          type="button"
          onClick={() => void signInAsDemo("member")}
          disabled={isSubmitting}
          className="rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-accent/40 disabled:opacity-60"
        >
          <span className="text-[11px] font-semibold text-primary">Member</span>
          <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
            Read-only catalog, own subscriptions
          </span>
        </button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormError message={formError} />

        <Field
          label="Email address"
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
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
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

        <Button
          type="submit"
          size="lg"
          className="h-10 w-full"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        New to Orbit?{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
