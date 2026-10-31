import type {
  AuthUser,
  CreatePlanInput,
  CreateProductInput,
  CreateSubscriptionInput,
  CreateUserInput,
  LoginInput,
  PlanWithProduct,
  Product,
  RegisterInput,
  SubscriptionWithRelations,
  UpdatePlanInput,
  UpdateProductInput,
  UpdateSubscriptionInput,
  UpdateUserInput,
  User,
  OperationsSnapshot,
} from "@/types/api";

export interface ApiClient {
  auth: {
    login(input: LoginInput): Promise<AuthUser>;
    register(input: RegisterInput): Promise<AuthUser>;
    logout(): Promise<void>;
    me(): Promise<AuthUser | null>;
  };
  users: {
    list(): Promise<User[]>;
    create(input: CreateUserInput): Promise<User>;
    update(id: string, input: UpdateUserInput): Promise<User>;
    remove(id: string): Promise<void>;
  };
  products: {
    list(): Promise<Product[]>;
    create(input: CreateProductInput): Promise<Product>;
    update(id: string, input: UpdateProductInput): Promise<Product>;
    remove(id: string): Promise<void>;
  };
  plans: {
    list(): Promise<PlanWithProduct[]>;
    create(input: CreatePlanInput): Promise<PlanWithProduct>;
    update(id: string, input: UpdatePlanInput): Promise<PlanWithProduct>;
    remove(id: string): Promise<void>;
  };
  subscriptions: {
    list(): Promise<SubscriptionWithRelations[]>;
    get(id: string): Promise<SubscriptionWithRelations>;
    create(input: CreateSubscriptionInput): Promise<SubscriptionWithRelations>;
    update(
      id: string,
      input: UpdateSubscriptionInput,
    ): Promise<SubscriptionWithRelations>;
  };
  operations: {
    snapshot(): Promise<OperationsSnapshot>;
  };
}
