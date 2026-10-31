"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./index";
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
};

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: api.users.list });
}

export function useProducts() {
  return useQuery({
    queryKey: queryKeys.products,
    queryFn: api.products.list,
  });
}

export function usePlans() {
  return useQuery({ queryKey: queryKeys.plans, queryFn: api.plans.list });
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: api.subscriptions.list,
  });
}

export function useSubscription(id: string) {
  return useQuery({
    queryKey: queryKeys.subscription(id),
    queryFn: () => api.subscriptions.get(id),
    enabled: Boolean(id),
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
