-- Brightloop subscription operations schema.
-- Monetary values are integer minor units (paise/cents); rates are basis points.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (name IN ('admin', 'staff', 'customer')),
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (length(trim(full_name)) > 0),
  email text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));

CREATE TABLE IF NOT EXISTS auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'local',
  password_hash text,
  reset_token_hash text,
  reset_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  legal_name text,
  customer_type text NOT NULL DEFAULT 'individual' CHECK (customer_type IN ('individual', 'business')),
  email text NOT NULL,
  phone text,
  tax_id text,
  billing_address_line1 text,
  billing_address_line2 text,
  city text,
  state text,
  postal_code text,
  country text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'prospect')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_name_idx ON customers (customer_name);

CREATE TABLE IF NOT EXISTS customer_users (
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  membership_role text NOT NULL CHECK (membership_role IN ('owner', 'manager', 'member')),
  is_primary boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_id, user_id)
);
CREATE INDEX IF NOT EXISTS customer_users_user_idx ON customer_users (user_id);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  product_type text NOT NULL CHECK (product_type IN ('service', 'goods')),
  sales_price bigint NOT NULL DEFAULT 0 CHECK (sales_price >= 0),
  cost_price bigint NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  variants jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  billing_interval text NOT NULL CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  price bigint NOT NULL DEFAULT 0 CHECK (price >= 0),
  currency varchar(3) NOT NULL DEFAULT 'INR',
  minimum_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_quantity > 0),
  included_products jsonb NOT NULL DEFAULT '[]'::jsonb,
  available_from date,
  available_until date,
  auto_close boolean NOT NULL DEFAULT false,
  allow_early_close boolean NOT NULL DEFAULT true,
  allow_pause boolean NOT NULL DEFAULT true,
  allow_renewal boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_until IS NULL OR available_from IS NULL OR available_until >= available_from)
);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  created_by uuid NOT NULL REFERENCES users(id),
  template_name text NOT NULL,
  title text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal bigint NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount bigint NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  valid_until date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  quotation_id uuid REFERENCES quotations(id),
  plan_id uuid NOT NULL REFERENCES plans(id),
  created_by uuid NOT NULL REFERENCES users(id),
  start_date date NOT NULL,
  end_date date,
  next_billing_date date,
  billing_interval text NOT NULL CHECK (billing_interval IN ('daily', 'weekly', 'monthly', 'yearly')),
  plan_price bigint NOT NULL DEFAULT 0 CHECK (plan_price >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed')),
  auto_renew boolean NOT NULL DEFAULT true,
  paused_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS subscriptions_due_idx ON subscriptions (status, next_billing_date);
CREATE INDEX IF NOT EXISTS subscriptions_customer_idx ON subscriptions (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS subscription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL,
  variant_name text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_number text NOT NULL UNIQUE,
  billing_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('processing', 'completed', 'partially_failed', 'failed')),
  total_subscriptions integer NOT NULL DEFAULT 0,
  invoices_created integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS billing_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_run_id uuid NOT NULL REFERENCES billing_runs(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions(id),
  period_index integer NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  invoice_id uuid,
  failure_reason text,
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS billing_run_items_run_idx ON billing_run_items (billing_run_id);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  subscription_id uuid REFERENCES subscriptions(id),
  billing_run_id uuid REFERENCES billing_runs(id),
  period_index integer,
  billing_period_start date,
  billing_period_end date,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'void')),
  subtotal bigint NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  total_amount bigint NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  notes text,
  issued_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_amount <= subtotal)
);
CREATE INDEX IF NOT EXISTS invoices_customer_idx ON invoices (customer_id, created_at DESC);
DO $$
BEGIN
  ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_subscription_id_period_index_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS invoices_recurring_period_idx
  ON invoices (subscription_id, period_index)
  WHERE subscription_id IS NOT NULL AND period_index IS NOT NULL AND status <> 'void';

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  description text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate integer NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 10000),
  tax_amount bigint NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total bigint NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount bigint NOT NULL CHECK (amount > 0),
  method text NOT NULL CHECK (method IN ('upi', 'card', 'cash', 'bank_transfer', 'cheque', 'online')),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  note text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  amount bigint NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('fixed', 'percentage')),
  discount_value bigint NOT NULL CHECK (discount_value > 0),
  minimum_purchase bigint NOT NULL DEFAULT 0 CHECK (minimum_purchase >= 0),
  minimum_quantity integer NOT NULL DEFAULT 1 CHECK (minimum_quantity > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (discount_type <> 'percentage' OR discount_value <= 10000)
);

CREATE TABLE IF NOT EXISTS discount_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_id uuid NOT NULL REFERENCES discounts(id),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  discount_amount bigint NOT NULL CHECK (discount_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (discount_id, invoice_id)
);
