# Subscription Management System

## Development

Install from the repository root:

```bash
pnpm install
pnpm --filter frontend dev
```

Open http://localhost:3000. The Next.js frontend lives in `frontend/`; the Fastify backend listens on http://localhost:3001 by default.

Run the backend with:

```bash
pnpm --filter backend dev
```

Check `http://localhost:3001/health` for the service health response.

Run frontend verification:

```bash
pnpm --filter frontend lint
pnpm --filter frontend build
```

After the first build or dev run, standalone typechecking is also available with `pnpm --filter frontend exec tsc --noEmit`.
