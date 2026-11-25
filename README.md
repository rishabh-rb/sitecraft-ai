# SiteCraft AI — Autonomous Prompt-to-Website Generation Agent

### Presentation frontend upgrade

Run `npm run dev` and visit `/`, `/templates`, `/showcase`, or the public `/playground`. Existing login methods, admin authorization, AI providers and database storage are preserved.

The landing page includes an explicitly labeled local template demo. The studio supports section selection, copy/layout/image edits, brand controls, logo palette extraction, undo/redo, version comparison, source checks, guided onboarding, keyboard shortcuts and saved panel sizes. The gallery uses actual saved HTML previews and account statistics, refreshing every 30 seconds while visible.

Visual drafts, notes, favorites, display-name overrides and up to 15 history snapshots are stored in this browser. They are not synchronized to the backend. AI generation/revisions use the existing server API and saved AI version; a new AI result enters local history. Duplicate creates a server brief with a browser-only preview copy. Export important drafts before clearing browser storage.

HTML and ZIP exports include the current browser draft. Generated React source remains the last AI source; local DOM edits do not rewrite those components. A template without React source exports a clearly labeled React iframe preview component. PDF reports use Print / Save as PDF. Quality scores are static source estimates, not Lighthouse measurements or WCAG certification.

Sharing creates compressed read-only snapshot links, with real QR codes when the link fits. Template snapshots reuse fingerprinted bundled template content; an incompatible template update may require a fresh link. Larger custom snapshots can exceed QR or messaging-app URL limits; publish or export instead. Localhost links only work on this computer. Social PNG downloads are manual attachments; snapshots use generic SiteCraft Open Graph metadata. Demo collaborators are explicitly simulated. Brand URL imports require HTTPS and the target site's CORS permission; logo uploads work locally.

Publish uses the last AI version stored on the server through the existing Vercel/Netlify API. To publish local visual edits, download HTML/ZIP and deploy it manually. Existing credentials and database availability still govern those services. Nothing is automatically published by this upgrade.

Validate with `npm run check:ui`, `npm --workspace frontend run typecheck`, `npm run lint` and `npm --workspace frontend run build`.

**Revert this UI upgrade:** stop the dev server, run `npm run ui:revert`, then `npm run dev:clean`. The backup is in `.sitecraft-backups/`; `.env`, backend/ML source and stored data are excluded. Restore saves the current UI before restoring the previous files. Preview the restoration with `node scripts/restore-ui.mjs` (without `--apply`). Keep the backup folder until you accept the design.

> Production-quality, full-stack autonomous web application generation system powered by a multi-agent AI architecture, Next.js App Router, Tailwind CSS, TypeScript, and PostgreSQL with Prisma ORM.

---

## 1. Project Overview

**SiteCraft AI** converts natural-language prompts (e.g., *"Create a modern restaurant website with dark tones, hero section, seasonal specials, customer testimonials, reservation contact form, and mobile responsive layout"*) into complete, interactive, componentized, editable, and downloadable web applications.

The platform provides a live sandboxed preview with responsive device viewports, conversational editing for iterative refinement, syntax-highlighted code explorer, one-click ZIP export, and cloud deployment adapters.

---

## 2. Problem Statement

Building production-ready websites traditionally requires assembling design systems, writing copywriting, finding contextual visual assets, configuring build tools, writing responsive React components, validating accessibility, and preparing deployment pipelines. 

Existing generative tools often produce isolated code snippets or non-interactive mockups rather than a coherent, multi-file project with real component hierarchy and accessible markup.

---

## 3. Solution

SiteCraft AI solves this through an autonomous **Multi-Agent Orchestration Pipeline**:
1. **Planner Agent**: Analyzes prompt intent, extracts site structure, page routes, and themes.
2. **Content Agent**: Generates tailored copy, headlines, value propositions, and FAQs.
3. **UI Designer Agent**: Assembles design tokens, component hierarchy, and responsive rules.
4. **Image Agent**: Sources high-resolution contextual imagery via Unsplash API with curated fallbacks.
5. **Code Generation Agent**: Compiles modular React TypeScript components and Tailwind CSS styles.
6. **QA Agent**: Audits generated markup for responsive viewports, syntax, ARIA landmarks, and SEO.
7. **Orchestrator**: Coordinates execution, error recovery, and automated QA retries (up to 3 attempts).

---

## 4. Key Features

- **Autonomous Generation**: Natural language prompt to full multi-page/multi-section website.
- **Sandboxed Live Preview**: Isolated iframe rendering with Desktop, Tablet, and Mobile preview modes.
- **Conversational Refinement**: Make targeted modifications (*"Make the hero navy blue"*, *"Add pricing table"*) without resetting site state.
- **Multi-File Code Explorer**: Browse generated `src/App.tsx`, `components/Hero.tsx`, `components/Navbar.tsx`, `styles.css`, `package.json`, and `README.md`.
- **One-Click ZIP Export**: Download complete project ready for `npm install && npm run dev`.
- **Cloud Deployment Integration**: Built-in Vercel and Netlify deployment adapters with clear configuration errors.
- **Resilient Dual Storage**: PostgreSQL with Prisma ORM and automatic fallback to persistent JSON storage during database maintenance.
- **Authentication & Security**: Protected dashboard, role-based access control, server-side secret isolation, and sanitization.

---

## 5. Architecture & Multi-Agent Flow

```
                  ┌────────────────────────────────────────┐
                  │          User Natural Language         │
                  │             Website Prompt             │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │         1. Planner Agent (AI)          │
                  │    Extracts Site Plan & Color Tokens   │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │         2. Content Agent (AI)          │
                  │      Generates Headlines & Copy        │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       3. UI Designer Agent (AI)        │
                  │    Defines Hierarchy & Layout Rules    │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │         4. Image Agent (AI)            │
                  │   Unsplash API & Visual Asset Match    │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │       5. Code Generation Agent         │
                  │   Compiles React Components & Styles   │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
                  ┌────────────────────────────────────────┐
                  │          6. QA Review Agent            │
                  │   Audits Viewport, ARIA & Syntax       │
                  └───────────────────┬────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │ Passed?                 │
                       No│                         │Yes
                         ▼                         ▼
                  ┌──────────────┐          ┌──────────────┐
                  │ Auto-Retry   │          │ Live Sandbox │
                  │ (Max 3 Runs) │          │   Preview    │
                  └──────────────┘          └──────────────┘
```

---

## 6. Technology Stack

### Frontend
- **Framework**: Next.js 16 (App Router)
- **UI & Components**: React 18, Tailwind CSS, Lucide React, Framer Motion
- **Auth**: NextAuth / Auth.js with JWT session strategy
- **Client**: TypeScript, Native Fetch API

### Backend & AI Engine
- **Runtime**: Node.js, Next.js Server Actions / API Routes, Microservice backend
- **Database & ORM**: PostgreSQL, Prisma ORM
- **AI Abstraction**: Configurable OpenRouter/Gemini/OpenAI/Bynara providers with deterministic local recovery
- **Packaging**: JSZip for export archives
- **Validation**: Zod schema enforcement

---

## 7. Folder Structure

```
sitecraft-ai/
├── app/                              # Next.js App Router
│   ├── (auth)/                       # Authentication routes
│   │   ├── login/page.tsx            # Login screen
│   │   └── register/page.tsx         # User registration
│   ├── dashboard/                    # Main user workspace
│   │   ├── page.tsx                  # Dashboard overview & brief creator
│   │   ├── projects/page.tsx         # Projects list & management
│   │   └── settings/page.tsx         # API & environment status matrix
│   ├── builder/                      # 3-Panel Builder Interface
│   │   └── [projectId]/
│   │       ├── page.tsx              # Live builder canvas & panels
│   │       └── loading.tsx           # Skeleton loading state
│   ├── api/                          # NextAuth and backend API endpoints
│   ├── page.tsx                      # SaaS landing page
│   └── globals.css                   # Global Tailwind styles
│
├── components/                       # Reusable React components
│   ├── ui/                           # Primitive UI buttons, inputs
│   └── builder/                      # Builder panels
│       ├── PromptInput.tsx           # Brief submission & examples
│       ├── ChatPanel.tsx             # Conversational edits & history
│       ├── PreviewPanel.tsx          # Sandboxed iframe preview
│       ├── CodePanel.tsx             # Code viewer with syntax copy
│       ├── FileExplorer.tsx          # Multi-file hierarchy tree
│       ├── DevicePreview.tsx         # Viewport toggle (Desktop/Tablet/Mobile)
│       └── GenerationProgress.tsx    # Multi-agent inspection timeline
│
├── backend/                          # Backend server & orchestrator
│   ├── src/
│   │   ├── server.ts                 # REST API server & routing
│   │   ├── store.ts                  # Resilient database & store adapter
│   │   ├── orchestrator.ts           # 6-Agent pipeline execution & retry
│   │   ├── deployment/               # Cloud deployment adapters
│   │   │   ├── vercel.ts             # Vercel REST deployment client
│   │   │   └── netlify.ts            # Netlify deployment client
│   │   └── validators.ts             # Zod input schemas
│   └── prisma/
│       ├── schema.prisma             # PostgreSQL schema definitions
│       └── seed.ts                   # Development seed script
│
├── ml/                               # AI Provider abstraction & Agents
│   ├── src/
│   │   ├── provider.ts               # Gemini/OpenAI/Bynara provider
│   │   ├── generator.ts              # HTML renderer & React file generator
│   │   ├── image-agent.ts            # Unsplash API integration
│   │   ├── prompts.ts                # Structured agent prompt templates
│   │   ├── local-fallback.ts         # Resilient offline generator
│   │   └── types.ts                  # Core schemas & TypeScript interfaces
│
├── .env.example                      # Documented environment template
├── package.json                      # Workspace scripts & dependencies
└── tsconfig.json                     # TypeScript compiler configuration
```

---

## 8. Environment Variables

Create a `.env` file in the root directory based on `.env.example`:

```bash
# Server Runtime
NODE_ENV=development
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_TURNSTILE_SITE_KEY="your-cloudflare-turnstile-site-key"
BACKEND_PORT=4000
FRONTEND_ORIGIN=http://localhost:3000

# 1. Database (PostgreSQL + Prisma)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/sitecraft"

# 2. Authentication (Auth.js / NextAuth)
AUTH_SECRET="your-random-32-character-secret"
NEXTAUTH_URL=http://localhost:3000
ADMIN_EMAILS=admin@sitecraft.ai
ADMIN_PASSWORD="set-a-strong-bootstrap-password"

# Cloudflare Turnstile (required for email/password sign-in and email OTP requests)
TURNSTILE_SECRET_KEY="your-cloudflare-turnstile-secret-key"

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# 3. AI Providers
# Primary AI Provider: OpenRouter (Gemini/OpenAI-compatible models)
AI_PROVIDER=openrouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# Optional direct Gemini provider / fallback.
OPENROUTER_MODEL=openrouter/free
OPENROUTER_MAX_TOKENS=8192
AI_MAX_TOKENS=8192
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_KEYS=
AI_MODEL=gemini-3.6-flash

# Fallback AI Provider: OpenAI API (Optional)
OPENAI_API_KEY=

# Alternative Provider: Bynara (Optional)
BYNARA_ENABLED=false
BYNARA_API_KEY=

# 4. Optional Integrations
# Unsplash API for photography
UNSPLASH_ACCESS_KEY=your-unsplash-access-key

# Vercel Cloud Deployment
VERCEL_TOKEN=your-vercel-token

# Netlify Static Deployment (Optional)
NETLIFY_AUTH_TOKEN=your-netlify-token
NETLIFY_SITE_ID=your-netlify-site-id
```

---

## 9. API Setup

### AI Provider Setup
Set `AI_PROVIDER` to `openrouter`, `gemini`, or `openai`, then provide the matching API key. If no hosted provider is available, SiteCraft AI uses deterministic local generation so the demo remains usable.

Generation uses stage-specific output budgets (planner 2048, content 3072, UI 1536, code 8192, QA 1024), bounded by `AI_MAX_TOKENS` and the additional `OPENROUTER_MAX_TOKENS` ceiling for OpenRouter. A truncated response is regenerated once with compact-output instructions and a larger allowance where the configured ceiling permits. Incomplete JSON is never used as a finished website. Code requests have a 40-second timeout, smaller stages 20 seconds, and all hosted calls share a 90-second generation budget before local fallback. These are request budgets, not a promised total generation time.

Credentials rejected with 401/403 are skipped for five minutes within the running backend, including across new projects. Replacing the rejected API key allows it to be tried immediately. A Bynara 401 still requires an active, authorized `BYNARA_API_KEY`; retries cannot repair an invalid account credential. Set `BYNARA_ENABLED=false` to disable that optional fallback without deleting its key. Set it to `true` after supplying an authorized key. Rebuild the ML workspace and restart the backend after changing provider code or environment settings (`npm run dev` does both when started).

For direct Gemini access, navigate to [Google AI Studio](https://aistudio.google.com/), click **Create API Key**, and set `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, and `AI_MODEL` in `.env`.

### Unsplash API (Optional Photography)
1. Register at [Unsplash Developers](https://unsplash.com/developers).
2. Create an application and copy your **Access Key**.
3. Set `UNSPLASH_ACCESS_KEY` in `.env`.

### Vercel Deployment Token (Optional One-Click Deploy)
1. Go to your [Vercel Account Settings > Tokens](https://vercel.com/account/tokens).
2. Create a token with deploy permissions.
3. Set `VERCEL_TOKEN` in `.env`.

### Netlify Deployment (Optional One-Click Deploy)
1. Create or select a Netlify site and copy its site ID.
2. Create a Netlify personal access token.
3. Set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` in `.env`.

---

## 10. Database Setup

1. Configure your PostgreSQL database URL in `.env`:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/sitecraft"
   DATABASE_TRANSPORT=auto
   ```
   With `auto`, Neon hosts use encrypted WebSockets on port 443 through the matching Prisma Neon adapter. Other PostgreSQL hosts use TCP. Use Node.js 22 or later for its built-in WebSocket support. Set `DATABASE_TRANSPORT=tcp` to explicitly use TCP. Keep the full connection string and password server-side.
2. Validate and apply Prisma migrations:
   ```bash
   npm run prisma:validate
   npm --workspace backend exec -- prisma migrate status --schema prisma/schema.prisma
   npm --workspace backend exec -- prisma migrate deploy --schema prisma/schema.prisma
   ```
3. (Optional) Run seed script:
   ```bash
   npx tsx backend/prisma/seed.ts
   ```

Run `npm run db:check` after configuring the URL. It checks connectivity, authentication and the session's read-only setting without modifying records or printing credentials. A rejected password requires a fresh connection string from Neon → Connect; a longer timeout cannot fix it. Prisma migration commands still use their normal PostgreSQL connection and require network access to that endpoint; the runtime adapter does not change the CLI transport.

Health checks share one pending probe and cache results for 30 seconds. The application keeps using a confirmed healthy database until a real probe or operation fails. Connection failures use the persistent local store for supported user workflows; the admin database explorer continues to require actual PostgreSQL records and reports unavailability honestly.

### Recovering frontend 404 and auth JSON errors

`/api/auth/session` must return JSON. If it returns an HTML 404 page, NextAuth reports `Unexpected token '<'`; fixing route serving resolves that parse error. After stopping the current dev server with Ctrl+C, run:

```bash
npm run dev:clean
```

This clears only `frontend/.next/dev` and starts both workspaces. It refuses to clear output for a running server and keeps production builds and stored data. Persistent Turbopack caching is disabled for development to avoid restoring stale route state. In another terminal, run `npm run check:routes` to verify `/`, `/login`, `/api/auth/session` and `/api/auth/providers` return the expected HTML or JSON with status 200.

---

## 11. Authentication Setup

- **Demo Credentials**:
  - Seeded demo user: `demo@sitecraft.local` (the seeded local user is intended for development data inspection).
  - For a presentation without authentication setup, open the public interactive demo at `/demo`.
- **Google OAuth**: Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to enable single sign-on.

---

## 12. Local Development

Install dependencies and start the full-stack development environment:

```bash
# 1. Install all workspace dependencies
npm install

# 2. Start frontend and backend concurrently
npm run dev

# Or to run the production servers:
npm run build
npm start
```

Access the web interface at **`http://localhost:3000`**, public interactive demo at **`http://localhost:3000/demo`**, and backend API at **`http://localhost:4000`**.

---

## 13. AI Generation Workflow

1. **Dashboard Brief Submission**: Enter project title and descriptive prompt.
2. **Planner Agent**: Analyzes requirements into structured JSON (pages, color palette, theme, typography).
3. **Content Agent**: Generates hero text, feature highlights, customer testimonials, and FAQs.
4. **UI Designer Agent**: Sets container dimensions, spacing tokens, and responsive layout rules.
5. **Image Agent**: Fetches contextual imagery matching site theme.
6. **Code Agent**: Builds modular React components and compiles live preview HTML.
7. **QA Agent**: Verifies semantic landmarks and viewport meta tags.
8. **Live Canvas**: Instant sandboxed preview with responsive viewport switcher.

---

## 14. Deployment

Deploy the generated website directly to Vercel via the Builder top bar or download the ZIP:

```bash
# Deploying exported ZIP manually
unzip generated-site.zip
cd generated-site
npm install
npm run dev
```

---

## 15. Testing

SiteCraft AI includes automated test suites covering agents, prompt validation, error handling, and deployment:

```bash
# Run all unit and integration tests
npm test

# Run TypeScript typechecks
npm run typecheck

# Validate Prisma schema
npm run prisma:validate

# Build full production bundles
npm run build
```

---

## 16. Future Improvements

- **Phase 2 Backend Code Generation**: Autonomous generation of Next.js server actions, Prisma database models, and API endpoints from natural-language prompts.
- **Custom Domain Automation**: DNS verification and automatic SSL certificate issuance.
- **Figma Design Import/Export**: Bi-directional token synchronizer with Figma components.
- **Full-Page Screenshot QA**: Automated visual regression testing using headless browser snapshots.

## Google OAuth + Email OTP authentication

The login flow is implemented with NextAuth on the frontend and the backend's Prisma store:

1. Google OAuth completes without creating a NextAuth session.
2. The backend generates a cryptographically secure six-digit code, stores only its SHA-256 hash, and sends the code through Gmail SMTP.
3. The user enters the code at `/verify-otp`; the OTP credentials provider verifies it and then creates the normal NextAuth JWT session.

### Environment variables

Copy `.env.example` to `.env` and set these values:

```dotenv
AUTH_SECRET="a-long-random-production-secret"
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-oauth-client-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-client-secret"
GMAIL_USER="your-gmail-address@gmail.com"
GMAIL_APP_PASSWORD="your-16-character-google-app-password"
```

In Google Cloud Console, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI. Use `localhost` for local development; Google rejects plain HTTP callbacks that use private LAN IP addresses such as `172.16.x.x`. For production, use the HTTPS URL instead. Enable two-step verification on the Gmail account, then create a Google App Password; do not put the normal Gmail password in `.env`. Keep `.env` out of source control.

After adding the dependencies, apply the database migration and regenerate Prisma:

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy --schema backend/prisma/schema.prisma
```

If PostgreSQL is unavailable, the existing local JSON fallback can run the flow for development, but production should use PostgreSQL so OTP challenges survive restarts and concurrent requests safely.
