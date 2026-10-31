"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./index";
import { useAuth } from "@/lib/auth/auth-provider";
import type {
  CreatePlanInput,
  CreateProductInput,
  CreateSubscriptionInput,
  CreateUserInput,
  UpdatePlanInput,
  UpdateProductInput,
  UpdateSubscriptionInput,
  UpdateUserInput,
} from "@/types/api";

export const queryKeys = {
  users: ["users"] as const,
  products: ["products"] as const,
  plans: ["plans"] as const,
  subscriptions: ["subscriptions"] as const,
  subscription: (id: string) => ["subscriptions", id] as const,
  operations: ["operations"] as const,
};

/**
 * Data returned by the API is identity-dependent. Keeping the identity in
 * each read query key prevents a customer who signs out and another user who
 * signs in on the same tab from seeing the previous user's cached response.
 * The unscoped keys above are intentionally kept as invalidation prefixes for
 * mutations.
 */
function userQueryKey(key: readonly string[], userId?: string, role?: string) {
  return [...key, "identity", userId ?? "anonymous", role ?? "anonymous"];
}

function useIdentity() {
  const { user, loading } = useAuth();
  return { user, loading, enabled: !loading && Boolean(user) };
}

export function useUsers() {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.users, user?.id, user?.role),
    queryFn: api.users.list,
    enabled,
  });
}

export function useOperationsSnapshot() {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.operations, user?.id, user?.role),
    queryFn: api.operations.snapshot,
    enabled,
  });
}

export function useProducts() {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.products, user?.id, user?.role),
    queryFn: api.products.list,
    enabled,
  });
}

export function usePlans() {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.plans, user?.id, user?.role),
    queryFn: api.plans.list,
    enabled,
  });
}

export function useSubscriptions() {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.subscriptions, user?.id, user?.role),
    queryFn: api.subscriptions.list,
    enabled,
  });
}

export function useSubscription(id: string) {
  const { user, enabled } = useIdentity();
  return useQuery({
    queryKey: userQueryKey(queryKeys.subscription(id), user?.id, user?.role),
    queryFn: () => api.subscriptions.get(id),
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUserInput) => api.users.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) =>
      api.users.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.users.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProductInput) => api.products.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) =>
      api.products.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products });
      queryClient.invalidateQueries({ queryKey: queryKeys.plans });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.products.remove(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlanInput) => api.plans.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePlanInput }) =>
      api.plans.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.plans.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.plans }),
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSubscriptionInput) =>
      api.subscriptions.create(input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions }),
  });
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: UpdateSubscriptionInput;
    }) => api.subscriptions.update(id, input),
    onSuccess: (subscription) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions });
      queryClient.invalidateQueries({
        queryKey: queryKeys.subscription(subscription.id),
      });
    },
  });
}
