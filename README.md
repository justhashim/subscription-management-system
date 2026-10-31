# Subscription Management System

## Development

Install from the repository root:

```bash
pnpm install
pnpm --filter frontend dev
```

Open http://localhost:3000. The Next.js frontend lives in `frontend/`; `backend/` is reserved for backend implementation.

Run frontend verification:

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
```

After the first build or dev run, standalone typechecking is also available with `pnpm --filter frontend exec tsc --noEmit`.
