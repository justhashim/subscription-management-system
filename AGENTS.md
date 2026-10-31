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

- `frontend/` is the Next.js 16 App Router workspace package. Its entrypoint is `frontend/app/page.tsx`, with layout/metadata in `frontend/app/layout.tsx` and styles in `frontend/app/globals.css`.
- `backend/` is a standalone Fastify TypeScript service. Build output goes to `backend/dist/`; application construction lives in `backend/src/app.ts`, while `backend/src/server.ts` owns process startup.
- The `@/*` TypeScript alias resolves from the `frontend/` root. Keep generated `.next/`, `frontend/next-env.d.ts`, and environment files out of commits.
- Tailwind CSS 4 is wired through the Next Turbopack CSS loader in `frontend/next.config.ts`; use the filtered Next commands rather than assuming a separate Tailwind CLI step.
