<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Install with `npm ci` at the repo root, then `npm ci --prefix mcp-server`. The app requires Node `>=20`. This environment uses the image Node (22) and npm 10; both satisfy `package.json`.
- `npm run dev` serves the app on port 3000 (hostname `0.0.0.0` by default). Lint, typecheck, test, and production build are `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`. The MCP package typechecks with `npm run typecheck --prefix mcp-server` and is not started on boot.
- The Cloud Agent install script writes `.env.local` only when that file is absent, using the same placeholder Supabase and Meta values as `.github/workflows/ci.yml` (`https://ci.example.supabase.co`, a 64-zero `ENCRYPTION_KEY`, `META_APP_SECRET=ci-dummy-meta-secret`). Those values are enough to boot the UI and run lint, typecheck, tests, and `npm run build`. A real Supabase project (see `.env.local.example`) is required before sign-in, signup, or any CRM read/write can succeed. Do not overwrite an existing `.env.local`.
- Unauthenticated visits to `/` and `/dashboard` redirect to `/login`. `GET /api/v1/me` without an API key returns 401. Signup rejects mismatched or short passwords in the browser before calling Supabase.
