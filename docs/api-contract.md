# API Contract

Frontend integration contract for the Orbit subscription workspace. The frontend runs against a mock adapter by default; set `NEXT_PUBLIC_USE_MOCKS=false` and `NEXT_PUBLIC_API_URL` to use the Fastify service.

## Conventions

- Base URL: `http://localhost:3001`
- Requests and responses use JSON.
- Authentication uses an HTTP-only session cookie. The current frontend also stores a demo-readable cookie so `proxy.ts` can gate routes; replace this when the backend owns sessions.
- All requests include credentials.
- List endpoints return `{ "data": [...] }`. Single-resource endpoints return the resource directly.
- Errors use:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Email is already in use.",
    "details": {
      "email": "Already registered"
    }
  }
}
```

## Enums

| Type | Values |
| --- | --- |
| Role | `ADMIN`, `MEMBER` |
| User status | `ACTIVE`, `INVITED`, `SUSPENDED` |
| Product status | `ACTIVE`, `ARCHIVED` |
| Plan status | `ACTIVE`, `ARCHIVED` |
| Billing interval | `MONTHLY`, `YEARLY` |
| Subscription status | `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED` |
| Currency | `USD`, `EUR`, `GBP` |

Prices are integer minor units. The frontend only formats them; billing, tax, proration, and invoice calculations belong to the billing engine.

## Resources

### Auth

| Method | Path | Body | Response |
| --- | --- | --- | --- |
| POST | `/auth/login` | `{ email, password }` | `{ user }` and session cookie |
| POST | `/auth/register` | `{ name, email, password }` | `{ user }` and session cookie |
| POST | `/auth/logout` | — | `204` |
| GET | `/auth/me` | — | `{ user }` or `401` |

### Users

| Method | Path | Body |
| --- | --- | --- |
| GET | `/users` | — |
| POST | `/users` | `{ name, email, role, status }` |
| PATCH | `/users/:id` | Partial user fields |
| DELETE | `/users/:id` | — |

Delete should fail with `409` when the user still has subscriptions.

### Products

| Method | Path | Body |
| --- | --- | --- |
| GET | `/products` | — |
| POST | `/products` | `{ name, description, status }` |
| PATCH | `/products/:id` | Partial product fields |
| DELETE | `/products/:id` | — |

Products with plans should be archived rather than deleted.

### Plans

| Method | Path | Body |
| --- | --- | --- |
| GET | `/plans` | Optional `productId`, `status`, `interval` query parameters |
| POST | `/plans` | `{ productId, name, description, price, currency, interval, features, status }` |
| PATCH | `/plans/:id` | Partial plan fields |
| DELETE | `/plans/:id` | — |

Plans with subscriptions should be archived rather than deleted.

### Subscriptions

| Method | Path | Body |
| --- | --- | --- |
| GET | `/subscriptions` | Optional `userId`, `status` query parameters |
| GET | `/subscriptions/:id` | — |
| POST | `/subscriptions` | `{ userId, planId, status }` |
| PATCH | `/subscriptions/:id` | `{ status?, cancelAtPeriodEnd? }` |

The backend owns period dates, renewal state, and lifecycle transitions. `cancelAtPeriodEnd` schedules cancellation; access continues through `currentPeriodEnd`.

## Response Shapes

```ts
interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  createdAt: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

interface Plan {
  id: string;
  productId: string;
  name: string;
  description: string;
  price: number; // minor units
  currency: "USD" | "EUR" | "GBP";
  interval: "MONTHLY" | "YEARLY";
  features: string[];
  status: "ACTIVE" | "ARCHIVED";
  createdAt: string;
}

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}
```

Frontend list views expect plans with an embedded `product`, and subscriptions with embedded `user`, `plan`, and `product`. The backend can either embed those relations or the client adapter can join them.

## Permissions

- `ADMIN`: manage users, products, plans; view and manage all subscriptions.
- `MEMBER`: read the active catalog; view and cancel only their own subscriptions.
- The frontend hides unauthorized UI and redirects protected routes, but the backend must enforce authorization for every endpoint.

## Backend Integration Notes

- Add `@fastify/cors` with credentials enabled for the frontend origin.
- Return consistent error envelopes so the client can surface messages.
- Replace the demo cookie flow with a secure HTTP-only session cookie.
- Keep `GET /health` available for readiness checks.
