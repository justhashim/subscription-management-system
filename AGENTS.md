<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Commands

- Use pnpm 12.11.2; install dependencies from the repository root with `pnpm install`.
- Run the app with `pnpm --filter frontend dev`; run checks with `pnpm --filter frontend lint` and `pnpm --filter frontend build`. The standalone `pnpm --filter frontend exec tsc --noEmit` works after Next has generated `.next` types (via `dev` or `build`).
- Run the backend with `pnpm --filter backend dev`; verify it with `pnpm --filter backend typecheck` and `pnpm --filter backend build`.
- There is no test runner or test script configured; do not assume `pnpm test` exists.

## Structure and constraints

- `frontend/` is the Next.js 16 App Router workspace package. Its root page redirects to `/dashboard`; layouts and routes live under `frontend/app/`, with feature UI under `frontend/features/` and shared primitives under `frontend/components/`.
- `frontend/proxy.ts` is the Next.js 16 route guard (not `middleware.ts`). It checks the demo-readable `orbit_session` cookie and restricts `/users` to admins. Real authorization must be enforced by the backend.
- The frontend defaults to the localStorage mock adapter in `frontend/lib/mock/` via `NEXT_PUBLIC_USE_MOCKS`; the HTTP adapter and endpoint shapes live in `frontend/lib/api/`. Switch adapters in `frontend/.env.local`, not in page components.
- TanStack Query hooks in `frontend/lib/api/hooks.ts` are the only data-fetching layer pages should use. Mutations invalidate the relevant query keys.
- Auth and role gating live in `frontend/lib/auth/`; demo accounts are `admin@example.com` and `member@example.com`, both with password `password`.
- UI uses shadcn/ui (`radix-nova` style) with Tailwind 4. Add primitives from `frontend/` with `pnpm dlx shadcn@latest add <name>` and import `cn` from `@/lib/utils`.
- Forms use react-hook-form plus zod. Dialogs are mounted only while open so form defaults come from their props; do not restore reset-in-effect patterns.
- `cacheComponents` is enabled. Client hooks like `usePathname` must sit inside a Suspense boundary; the dashboard layout already provides one. Keep `searchParams` reads in server pages and pass values into client views.
- Do not add billing calculations, invoices, tax, or proration. Prices are display-only integer minor units; the billing engine owns the rest.
- API and permission expectations are documented in `docs/api-contract.md`.
- `backend/` is a standalone Fastify TypeScript service. Build output goes to `backend/dist/`; application construction lives in `backend/src/app.ts`, while `backend/src/server.ts` owns process startup.
- The `@/*` TypeScript alias resolves from the `frontend/` root. Keep generated `.next/`, `frontend/next-env.d.ts`, and environment files out of commits.
- Tailwind CSS 4 is wired through the Next Turbopack CSS loader in `frontend/next.config.ts`; use the filtered Next commands rather than assuming a separate Tailwind CLI step.
