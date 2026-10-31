# Brightloop Subscriptions — Subscription Management System

**Brightloop Subscriptions** is a full-stack subscription operations platform for managing products, plans, quotations, subscriptions, recurring billing, invoices, discounts, payments, and revenue reporting.

Built for the **Odoo Hackathon 2026**, the system follows an Odoo-style business workflow while keeping the core business rules enforced in the backend and database.

## Features

### Authentication & Role Management

- Customer registration and login
- Unique email validation
- Strong password validation
- Password reset through Mailpit or console
- Role-based access control
- Admin, Staff, and Customer roles
- Customers can access only their own subscriptions and invoices
- Server-side authorization for protected operations

### Product & Plan Management

- Product catalog
- Product types: Service and Goods
- Sales and cost prices
- Product notes
- Product attributes and variants
- Variant-specific additional pricing
- Recurring plans
- Daily, weekly, monthly, and yearly billing periods
- Minimum quantity requirements
- Plan availability dates
- Configurable pause, close, auto-close, and renewal behaviour

### Quotations & Subscriptions

- Quotation templates
- Product and plan lines
- Quote validity period
- Automatic subscription numbering
- Subscription lifecycle management

```text
DRAFT
  ↓ send
QUOTATION
  ↓ confirm
CONFIRMED
  ↓ activate
ACTIVE ⇄ PAUSED
  ↓
CLOSED
```

Every subscription status transition is validated on the server and recorded in the subscription history.

### Recurring Billing

- One-click billing run
- Automatic invoice generation
- Catch-up billing for missed periods
- Idempotent billing
- Database-level protection against duplicate invoices
- Automatic tax calculation
- Automatic discount application
- Invoice numbering by financial year
- Billing run history

The database uses a unique constraint on:

```text
(subscriptionId, periodStart)
```

to prevent the same subscription period from being billed twice.

### Discounts

Supports:

- Percentage discounts
- Fixed-value discounts
- Minimum purchase requirements
- Minimum quantity requirements
- Start and end dates
- Usage limits
- Product-level discounts
- Subscription-level discounts
- Automatic application
- Discount usage tracking

Only the best applicable discount is applied at each supported level; discounts are not stacked at the same level.

### Invoices & Payments

- Draft, Confirmed, Paid, and Cancelled invoices
- Invoice line items
- Tax snapshots
- Discount tracking
- Payment recording
- Partial payments
- Automatic `PAID` status when the invoice is fully paid
- Overdue invoice filtering
- Print-friendly invoices
- Payment methods including UPI, card, cash, bank transfer, cheque, and online payment

### Customer Portal

Customers can:

- View their subscriptions
- Accept quotations
- Pause and resume subscriptions
- Close subscriptions
- Renew subscriptions
- Enable or disable eligible add-ons
- View invoices
- Make simulated payments

Customers are restricted to their own records at the API level.

### Finance Dashboard

The dashboard provides:

- Active subscriptions
- MRR
- ARR
- Revenue collected
- Outstanding amounts
- Overdue invoices
- Ageing information
- Date filters
- Plan filters
- Customer filters
- Links from summary figures to detailed lists

The system is designed to support **5,000 subscriptions and approximately 30,000 invoices**, with a target of keeping pages under two seconds.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| UI | Ant Design 6 |
| Routing | React Router |
| HTTP Client | Axios |
| Date Handling | Day.js |
| Backend | Node.js + Express |
| Validation | Zod |
| Authentication | JWT + HTTP-only cookies |
| Password Hashing | bcryptjs |
| ORM | Prisma 6 |
| Database | PostgreSQL 16 |
| Database Runtime | Docker |
| Email | Mailpit |
| Scheduling | node-cron |
| Testing | Node.js built-in test runner |

The architecture follows the planned stack from the hackathon specification.

---

## Architecture

```text
┌──────────────────────────────────────────────┐
│                 React Client                 │
│             Vite + Ant Design                │
│                                              │
│  Dashboard │ Catalog │ Subscriptions │       │
│  Invoices  │ Payments │ Billing │ Portal     │
└──────────────────────┬───────────────────────┘
                       │
                       │ REST API
                       ▼
┌──────────────────────────────────────────────┐
│              Express Backend                 │
│                                              │
│ Auth │ Users │ Customers │ Products │ Plans  │
│ Taxes │ Discounts │ Templates │ Subscriptions│
│ Invoices │ Payments │ Billing │ Reports      │
└──────────────────────┬───────────────────────┘
                       │
                       │ Prisma 6
                       ▼
┌──────────────────────────────────────────────┐
│             PostgreSQL 16                   │
│                                              │
│ Users │ Customers │ Products │ Plans         │
│ Subscriptions │ Invoices │ Payments          │
│ Discounts │ Billing Runs │ Events │ etc.     │
└──────────────────────────────────────────────┘

                       │
                       ▼
                 ┌───────────┐
                 │  Mailpit  │
                 │ :8025     │
                 └───────────┘
```

Backend modules follow a consistent:

```text
Routes → Controller → Service → Prisma
```

structure, with Zod schemas handling endpoint validation.

---

## Project Structure

```text
brightloop-subscriptions/
│
├── docker-compose.yml
├── README.md
│
├── docs/
│   ├── erd.png
│   └── screenshots/
│
├── server/
│   ├── .env.example
│   │
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   ├── seed-bulk.js
│   │   └── migrations/
│   │
│   └── src/
│       ├── index.js
│       ├── app.js
│       │
│       ├── middleware/
│       │   ├── auth.js
│       │   ├── validate.js
│       │   ├── timing.js
│       │   └── errorHandler.js
│       │
│       ├── lib/
│       │   ├── prisma.js
│       │   ├── pricing.js
│       │   ├── pricing.test.js
│       │   ├── dates.js
│       │   ├── numbering.js
│       │   ├── mailer.js
│       │   └── httpError.js
│       │
│       ├── jobs/
│       │   └── daily.js
│       │
│       └── modules/
│           ├── auth/
│           ├── users/
│           ├── customers/
│           ├── products/
│           ├── attributes/
│           ├── plans/
│           ├── taxes/
│           ├── paymentTerms/
│           ├── discounts/
│           ├── templates/
│           ├── subscriptions/
│           ├── invoices/
│           ├── payments/
│           ├── billing/
│           ├── reports/
│           └── portal/
│
└── client/
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── theme.js
        │
        ├── api/
        │   └── client.js
        │
        ├── auth/
        │   ├── AuthContext.jsx
        │   └── RequireRole.jsx
        │
        ├── layouts/
        │   ├── AppLayout.jsx
        │   ├── PortalLayout.jsx
        │   └── AuthLayout.jsx
        │
        ├── components/
        │   ├── DataTable
        │   ├── StatusTag
        │   ├── StatusBar
        │   ├── Money
        │   ├── PageHeader
        │   ├── PasswordChecklist
        │   └── ConfirmButton
        │
        └── pages/
            ├── auth/
            ├── dashboard/
            ├── subscriptions/
            ├── templates/
            ├── invoices/
            ├── payments/
            ├── customers/
            ├── catalog/
            ├── config/
            ├── users/
            ├── billing/
            └── portal/
```

---

## Requirements

Make sure the following are installed:

- Node.js 20+
- npm
- Docker
- Docker Compose
- Git

Prisma 6 should be used explicitly rather than the latest Prisma release candidate, as the hackathon plan validates the schema against Prisma 6.19.

---

## Running Locally

### 1. Clone the repository

```bash
git clone https://github.com/justhashim/subscription-management-system.git
cd subscription-management-system
```

### 2. Start PostgreSQL and Mailpit

```bash
docker compose up -d
```

This starts:

```text
PostgreSQL → localhost:5432
Mailpit    → localhost:8025
SMTP       → localhost:1025
```

Mailpit provides a local inbox for password-reset and notification emails.

### 3. Configure the backend

```bash
cd server
cp .env.example .env
```

Example configuration:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/brightloop"
JWT_SECRET="change-me-to-a-long-random-string"
CLIENT_URL="http://localhost:5173"
PORT=4000

MAIL_MODE="smtp"
SMTP_HOST="localhost"
SMTP_PORT=1025

DEMO_MODE=true
BUSINESS_UTC_OFFSET_MIN=330
```

These environment settings are based on the hackathon build configuration.

### 4. Install backend dependencies

```bash
npm install
```

### 5. Run database migrations

```bash
npx prisma migrate dev
```

### 6. Seed the database

For the base demo dataset:

```bash
npm run seed
```

For the full performance dataset:

```bash
npm run seed:bulk
```

The bulk dataset is intended to provide approximately:

```text
2,000 customers
5,000 subscriptions
~30,000 invoices
```

The seed also includes demo products, plans, taxes, discounts, and quotation templates.

### 7. Start the backend

```bash
npm run dev
```

The API runs on:

```text
http://localhost:4000
```

### 8. Start the frontend

Open another terminal:

```bash
cd client
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

The Vite development server proxies `/api` requests to the Express backend.

---

## Demo Credentials

| Role | Email | Password |
|---|---|---|
| Admin | `admin@brightloop.test` | `Admin@1234` |
| Staff | `staff@brightloop.test` | `Staff@1234` |
| Customer | `customer@brightloop.test` | `Customer@123` |

These are the seeded demo accounts specified in the build plan.

---

## Database

The application uses **PostgreSQL 16** with **Prisma 6**.

The data model covers:

- Users
- Password reset tokens
- Customers
- Products
- Attributes
- Attribute values
- Product variants
- Plans
- Taxes
- Payment terms
- Discounts
- Discount-product relationships
- Quotation templates
- Quotation template lines
- Subscriptions
- Subscription lines
- Subscription discounts
- Subscription events
- Invoices
- Invoice lines
- Payments
- Billing runs
- Sequences

The schema contains the constraints and indexes required for subscription lifecycle management, billing, payments, and performance.

### ER Diagram

![Entity Relationship Diagram](docs/erd.png)

---

## Design Decisions

### 1. Plan Pricing

A plan represents a recurring price and billing period for a primary product.

The subscription's first line is the plan line:

```text
unit price = plan price + variant extras
```

Additional lines represent add-ons.

### 2. Variant Pricing

Variant pricing is calculated as:

```text
variant price = base product price + attribute extra prices
```

For example:

```text
Brightloop CRM       ₹1,000
Brand: Odoo          +₹560
──────────────────────────
Variant price        ₹1,560
```

### 3. Billing

Subscriptions are billed in advance.

The first billing period starts on the subscription start date.

Billing periods use a fixed billing anchor to avoid month-end drift.

### 4. Taxes

Tax is taken from the product when configured; otherwise the default tax is used.

The tax rate is snapshotted onto invoice lines so future tax-rate changes do not alter historical invoices.

### 5. Discounts

Discounts are evaluated using:

- Discount type
- Minimum quantity
- Minimum purchase amount
- Start/end dates
- Usage limits
- Product scope
- Subscription scope

Tax is calculated after discounts.

### 6. Payments

Payments must:

- Be greater than zero
- Not exceed the outstanding balance
- Belong to a confirmed invoice

When the total amount has been paid, the invoice automatically becomes `PAID`.

### 7. Invoice Locking

Confirmed invoices cannot be edited directly.

The workflow is:

```text
Confirmed
   ↓
Cancel
   ↓
Reset to Draft
   ↓
Edit
   ↓
Confirm
```

### 8. Money

Money is stored using:

```text
Decimal(12,2)
```

Financial calculations use whole paise rather than JavaScript floating-point arithmetic.

### 9. Invoice Numbering

Invoices and subscriptions use financial-year numbering:

```text
SUB/26-27/000001
INV/26-27/000001
```

The financial year follows the April–March cycle.

---

## Subscription Lifecycle

```text
                         ┌───────────┐
                         │   DRAFT   │
                         └─────┬─────┘
                               │ send
                               ▼
                         ┌───────────┐
                         │ QUOTATION │
                         └─────┬─────┘
                               │ confirm
                               ▼
                         ┌───────────┐
                         │ CONFIRMED │
                         └─────┬─────┘
                               │ activate
                               ▼
                     ┌───────────────────┐
                     │       ACTIVE      │
                     └───────┬─────┬─────┘
                             │     │
                           pause  close
                             │     │
                             ▼     ▼
                       ┌────────┐ ┌────────┐
                       │ PAUSED │ │ CLOSED │
                       └───┬────┘ └────────┘
                           │ resume
                           └──────► ACTIVE
```

Every transition is checked against the server-side state machine, role permissions, and plan capabilities. Each transition also creates a `SubscriptionEvent` for the History tab.

---

## Performance

The application is designed around a bulk dataset rather than static mock data.

Performance measures include:

- Database indexes
- Server-side pagination
- Database-side aggregation
- Parallel count and page queries
- Selective list queries
- Debounced search
- API response-time headers
- Bulk seeded data

Target:

```text
API response: < 500 ms
Page response: < 2 seconds
Dataset: 5,000 subscriptions / ~30,000 invoices
```

The response time is exposed in the application UI to demonstrate the performance requirement.

---

## Testing & Verification

### Pricing engine tests

From the `server` directory:

```bash
npm test
```

### Prisma validation

```bash
npx prisma validate
```

### Database migrations

```bash
npx prisma migrate dev
```

### Prisma Studio

```bash
npx prisma studio
```

Prisma Studio can be used to inspect the database and generate/verify the ERD during development.

---

## Hackathon Demo Flow

The recommended demonstration follows the complete business flow:

1. Register a new customer
2. Demonstrate duplicate-email validation
3. Demonstrate password validation
4. Reset the password through Mailpit
5. Log in as Admin
6. Create a Staff user
7. Log in as Staff and demonstrate restricted access
8. Create a product and Odoo variant
9. Create a recurring plan
10. Create a quotation from a template
11. Accept the quotation from the Customer portal
12. Activate the subscription
13. Create a discount
14. Run the billing process
15. Run billing again to demonstrate idempotency
16. Open and confirm the generated invoice
17. Register a partial payment
18. Complete the payment and demonstrate automatic `PAID`
19. Open the Finance Dashboard
20. Demonstrate MRR/ARR, outstanding and overdue figures
21. Demonstrate customer isolation
22. Pause/resume the subscription
23. Switch an add-on off and demonstrate that it is not billed

This follows the planned six-minute demo flow and covers the major judging requirements.

---

## Security & Access Control

Authorization is enforced on the backend rather than relying only on frontend navigation.

### Admin

Full access to system configuration and management.

### Staff

Operational access to:

- Customers
- Subscriptions
- Quotations
- Invoices
- Payments
- Billing
- Reports

Restricted from administrative configuration such as user management and discount creation.

### Customer

Can access only their own:

- Profile
- Subscriptions
- Invoices
- Payments

Role permissions are enforced through the API.

---



The hackathon plan explicitly requires contributions from all team members to be visible in Git history.

---

## Project Goals

The system is designed to demonstrate:

- End-to-end subscription management
- Server-side business rules
- Role-based authorization
- Recurring billing
- Idempotent invoice generation
- Discount management
- Payment tracking
- Customer self-service
- Financial reporting
- Scalable database querying
- Odoo-style business workflows

The emphasis is on a complete, working business flow rather than isolated UI screens.

---

## Submission Checklist

Before submission, verify:

- [ ] Fresh clone works using only this README
- [ ] `.env.example` is present
- [ ] No `.env` or `node_modules` is committed
- [ ] Database migrations work on an empty database
- [ ] Base seed works
- [ ] Bulk seed works
- [ ] All demo accounts work
- [ ] Dashboard works
- [ ] Subscription lifecycle works
- [ ] Billing run works
- [ ] Duplicate billing is prevented
- [ ] Discounts work
- [ ] Payments work
- [ ] Customer portal works
- [ ] Customer data isolation works
- [ ] `docs/erd.png` is present
- [ ] Screenshots are present in `docs/screenshots/`
- [ ] All team members have visible Git commits
- [ ] Demo video is added if required
- [ ] Repository visibility follows the hackathon instructions

The build plan specifically calls for screenshots covering the dashboard, subscription form, invoice, portal, and billing run, alongside the ERD.

---

## License

This project was developed as a hackathon submission for the Odoo Hackathon 2026.
