# SiteCraft AI deployment

Prepared for the existing Next.js frontend, Node backend and Neon database. Keep the existing authentication providers and application UI.

## Verified targets

- GitHub: `rishabh-rb/sitecraft-ai`, production branch `main`.
- Vercel team: `rishabhs-projects-69a44c5c` (`team_xUuqQLmv9nKj3NyvntQahIrP`), Hobby plan. Project `prj_FDlTQj5shomsZXL9DylGT63Cvvx0`; frontend address `https://sitecraft-ai-rishabh-rb.vercel.app`. Source upload is used while Vercel's GitHub connection is unavailable. Git pushes do not yet deploy the frontend automatically.
- Render: `Rbdigital's workspace` (`tea-d1itkl15pdvs73cd71e0`), explicitly selected by the user. Existing unrelated services are outside this deployment.
- Neon project: `sitecraft-ai` (`proud-meadow-17593219`). Branch `primary` (`br-morning-star-aunx8mpm`), database `neondb`, has the current OTP and search-history tables. Its `ep-delicate-glade-auafsxla` endpoint is read-write. The older `production` branch lacks these tables, and the `sitecraft` databases on both branches are empty.
- The locally configured `ep-polished-firefly-auoskien` endpoint is **read-only**. Do not reuse it as the production writer connection.

## Free backend service

| Setting | Value |
| --- | --- |
| Name | `sitecraft-ai-backend` |
| Repository | `https://github.com/rishabh-rb/sitecraft-ai` |
| Branch | `main` after the deployment changes are tested and merged |
| Root | Repository root |
| Runtime | Node 22 |
| Region | Virginia, near the current Neon US East database |
| Instances | One; generation-job polling currently uses an in-process map |
| Compute | Free plan, one instance; no paid plan authorized |
| Build | `npm ci --include=dev && npm run prisma:generate && npm run build:ml && npm run build:backend` |
| Start | `npm --workspace backend start` |
| Health | Default TCP liveness; inspect `/api/health` separately for actual database readiness |

The server honors the platform's `PORT` and binds to `0.0.0.0` in production. Development retains the existing `BACKEND_PORT` fallback and default host behavior.

Service `srv-dc3a8pqjnfac73a66kl0` is at `https://sitecraft-ai-backend.onrender.com` in the confirmed workspace. Free instances can sleep when idle, so the first request may be slow. In-process generation jobs do not survive a restart.

The existing Gmail OTP implementation needs outbound SMTP, which Render free web services block. The user deferred the proposed free Brevo HTTPS transport. Email OTP delivery and password-reset email remain pending; do not claim they are working in production. The existing login UI is preserved. Google OAuth and password login use the existing authentication flow.

## Environment variables

Keep secret values in the hosts' environment settings. Never commit `.env`, `.vercel` environment files, database connection strings, API keys or provider tokens.

### Vercel

- `AUTH_SECRET`: same value used by this deployment's backend.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: existing Google web application OAuth client.
- `NEXT_PUBLIC_BACKEND_URL`: actual HTTPS Render service origin.
- `NEXTAUTH_URL`, `NEXT_PUBLIC_SITE_URL`: actual stable HTTPS frontend origin.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: widget authorized for the frontend hostname.

Set the root directory to `frontend` and include source files outside the root directory so the `ml` workspace can build. `frontend/vercel.json` supplies the install and build commands. Use Node 22.x for parity with local validation.

### Render

- `NODE_ENV=production`, `NODE_VERSION=22`, `DATABASE_TRANSPORT=auto`.
- `DATABASE_URL`: writable connection to the verified Neon branch/database; never use Firefly's read-only endpoint.
- `AUTH_SECRET`: identical to the frontend secret.
- `FRONTEND_ORIGIN`: exact frontend HTTPS origin, without a trailing slash. For multiple domains use the comma-separated `FRONTEND_ORIGINS` instead.
- `TURNSTILE_SECRET_KEY`. Gmail SMTP credentials are not deployed to the free service; configure an HTTPS email provider when email delivery is resumed.
- `ADMIN_EMAILS`, `ADMIN_PASSWORD`: intended production admin bootstrap configuration.
- Existing active AI-provider variables, model selection and optional Unsplash/deployment credentials as required by enabled features. These belong on the backend.

## Database release procedure

First inspect the current branch's `_prisma_migrations` and compare its tables/columns with the repository. Do not reset or drop the existing database. Prefer `prisma migrate deploy` against the verified direct read-write connection. If the local network blocks port 5432, use Neon HTTPS to apply the reviewed migration and its matching SHA-256 history entry in one transaction, then verify the schema and history. Never mark a migration applied without executing or verifying its complete SQL.

The existing `20261117160000_align_runtime_schema` migration adds missing authentication/admin fields and aligns enum/default definitions without deleting records. Prisma Client must be generated before backend typechecking after a clean dependency install.

On 25 November 2026 the alignment migration was applied through Neon HTTPS because the local network blocked PostgreSQL TCP. Its history checksum is `96714ef243d8ed7cfe1ea6419b16d6867506170100cea0c1efffc957a7d1ae64`. Verification preserved all 4 existing users, 7 projects and 4 websites and confirmed the authentication columns and audit table. Existing ordinary accounts have no migrated password hashes; use their existing Google login or configure email reset later. A missing hash for the configured admin is bootstrapped using the existing admin password with the application's scrypt format.

The health route returning HTTP 200 only proves that the handler responded. Before release it must report `database: connected` and `storage: postgresql`. Local file fallback is unsuitable for persistent production data on an ephemeral host.

## Authentication settings after URLs are assigned

In the existing Google Cloud Web application client, add the frontend origin as an authorized JavaScript origin and `FRONTEND_ORIGIN/api/auth/callback/google` as the authorized redirect URI. Keep the existing localhost callback for development. The callback runs on Vercel; the Node backend handles user persistence and the application access token.

In Cloudflare Turnstile, authorize the exact frontend hostname without a URL scheme, path or port. Enter credentials directly in the relevant provider settings when a manual account step is required.

## Release verification

1. Vercel build and backend build succeed for the reviewed commit.
2. Backend `/api/health` reports PostgreSQL connected.
3. Frontend `/api/auth/providers` and `/api/auth/session` return JSON.
4. Google sign-in returns to the frontend dashboard and creates/loads the correct database user.
5. Password login, OTP sending/verification, admin authorization and logout work.
6. A generated project survives logout/login and appears in the correct user's account and admin tables.
7. Export, revision and enabled publishing integrations work with actual production credentials.

The visitor counter currently uses per-process memory, so a global count across Vercel instances needs shared storage. Browser visual drafts and notes remain browser-local as documented in the UI upgrade.

## Validation and remaining setup

- Next.js and its ESLint configuration are updated to 16.4.6; existing React 18 and NextAuth 4 login methods are retained.
- Production frontend/backend builds, frontend lint and all 45 backend tests passed locally after Prisma Client generation. The production dependency audit has no critical findings; 8 high findings remain, including dependencies requiring separate major-version work. Do not run an automatic forced auth migration.
- Google OAuth callback and Turnstile hostname must be allowed in their provider consoles before interactive sign-in is considered verified.
- Email OTP and password-reset delivery are deferred at the user's request. No email-provider account or paid hosting was created.
