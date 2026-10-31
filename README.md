# Subscription Management System

A subscription operations workspace built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui, backed by a Fastify service in progress.

## Development

Install from the repository root:

```bash
pnpm install
pnpm --filter frontend dev
```

Open http://localhost:3000. The Fastify backend listens on http://localhost:3001 by default.

Run the backend with:

```bash
pnpm --filter backend dev
```

Check `http://localhost:3001/health` for the service health response.

## Frontend

The frontend currently runs against a seeded, localStorage-backed mock adapter. It includes:

- Login and registration with demo admin/member roles
- Role-aware dashboard and navigation
- User management for admins
- Product and plan catalog management
- Subscription list, creation, cancellation, resume, and detail timeline
- Loading, empty, error, and responsive states
- Light/dark themes

Demo credentials:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@example.com` | `password` |
| Member | `member@example.com` | `password` |

To connect the Fastify backend, copy `frontend/.env.example` to `frontend/.env.local` and set:

```bash
NEXT_PUBLIC_USE_MOCKS=false
NEXT_PUBLIC_API_URL=http://localhost:3001
```

The API contract and role expectations live in [`docs/api-contract.md`](docs/api-contract.md).

## Verification

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
pnpm --filter backend typecheck
pnpm --filter backend build
```

After the first frontend build or dev run, standalone typechecking is available with `pnpm --filter frontend exec tsc --noEmit`.
