# CloudMarket IaaS

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.13-2D3748?logo=prisma)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

> Full-featured cloud infrastructure marketplace with a modern client interface, forecast dashboard, and administration panel.

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
  - [Prerequisites](#prerequisites)
  - [With Docker Compose + Makefile](#with-docker-compose--makefile-recommended)
  - [Environment Variables](#environment-variables)
  - [Services](#services)
  - [Available Makefile Targets](#available-makefile-targets)
- [Database Schema](#-database-schema)
- [API Reference](#-api-reference)
- [NPM Scripts](#-npm-scripts)
- [Seed Data](#-seed-data)
- [Design System](#-design-system)
- [Responsive](#-responsive)
- [Error Handling](#-error-handling)
- [Development](#-development)
- [Troubleshooting](#-troubleshooting)
- [Clean Up](#-clean-up)
- [License](#-license)

## ✨ Features

### 🛒 Marketplace
- IaaS product catalog with responsive grid and animations
- Dynamic filters by category, OS, flavor, and text search
- Detailed product pages: description, documentation, roadmap, dependencies
- Interactive SVG dependency graph

### 📊 Forecast Dashboard
- Real-time statistics with animated counters
- Request table with color-coded statuses (Pending / Approved / Rejected)
- Filter by status and search
- Create requests with cascading product → flavor selection
- Quick actions: approve, reject, delete

### 🛠️ Administration
- Dashboard with counters and recent activity
- Full CRUD for Products, Categories, Flavors, Dependencies, Forecasts, Users
- Responsive tables (cards on mobile, tables on desktop)
- Edit modals with validation

### 🎨 Design & UX
- Consistent dark theme (`slate-950`, accent `blue-500`)
- Scroll-triggered entry animations (IntersectionObserver)
- Smooth page transitions
- Toast notification system
- Error handling with Error Boundary and retry states
- `prefers-reduced-motion` support
- Custom scrollbar

## 🏗️ Architecture

```
cloudmarket/
├── docker-compose.yml           # Full stack (web + api + db)
├── package.json                 # Monorepo workspaces
├── README.md
├── apps/
│   ├── web/                     # Frontend React 18 + Vite
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn/ui (Button, Card, Badge, Input, Select, Tabs, Dialog, Skeleton, Textarea)
│   │   │   │   ├── Layout.tsx   # Sticky navbar + footer + mobile menu
│   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   ├── QueryError.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   └── PageTransition.tsx
│   │   │   ├── pages/
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── Marketplace.tsx
│   │   │   │   ├── ProductDetail.tsx
│   │   │   │   ├── Forecasts.tsx
│   │   │   │   ├── Admin.tsx
│   │   │   │   └── NotFound.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useApi.ts    # TanStack Query hooks + toast
│   │   │   │   ├── useScrollReveal.ts
│   │   │   │   └── useReducedMotion.ts
│   │   │   ├── stores/
│   │   │   │   ├── useAppStore.ts   # Zustand (marketplace filters)
│   │   │   │   └── useToastStore.ts # Notifications
│   │   │   ├── lib/
│   │   │   │   └── utils.ts     # cn() helper
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css        # Tailwind + custom animations
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── tailwind.config.js
│   └── api/                     # Backend Express + Prisma
│       ├── src/
│       │   ├── index.ts         # Entry point + error handler
│       │   └── routes/
│       │       ├── products.ts
│       │       ├── categories.ts
│       │       ├── flavors.ts
│       │       ├── dependencies.ts
│       │       ├── forecasts.ts
│       │       ├── users.ts
│       │       └── admin.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── seed.ts
│       └── package.json
└── packages/
    └── shared-types/
        └── src/
            └── index.ts         # Shared types + enums
```

## 🚀 Quick Start

### Prerequisites
- Docker Desktop / Docker Engine + Docker Compose v2
- Node.js 20+ (optional, for local development)

### With Docker Compose + Makefile (recommended)

The installation procedure is **the same for everyone** — whether you have internet access or are in an air-gapped environment. The Prisma engine binaries are already committed to `lib/prisma/`.

```bash
# 1. Clone the project
git clone <repo-url> cloudmarket && cd cloudmarket

# 2. Configure your environment
cp .env.example .env
# Edit .env and set your database credentials, port, etc.

# 3. Build Docker images
make deploy

# 4. Start all containers
make run

# 5. Initialize the database (first run only)
docker compose exec api npx prisma db push
docker compose exec api npx tsx prisma/seed.ts
```

---

#### Environment variables

Key variables in `.env` to review before running:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `cloudmarket` / `cloudmarket_secret` / `cloudmarket` | Database credentials |
| `DATABASE_URL` | `postgresql://...` | Connection string (must match credentials above) |
| `PORT` | `3001` | API port |
| `VITE_API_URL` | `http://localhost:3001` | Frontend API base URL |
| `PRISMA_CLI_BINARY_TARGETS` | `linux-arm64-openssl-3.0.x` | Prisma engine target platform (see `.env.example` for options) |
| `REPO_URL` | *(empty)* | Corporate Docker registry mirror (optional) |
| `API_IMAGE` / `API_TAG` | `node` / `20-bookworm` | API container base image (optional) |
| `WEB_IMAGE` / `WEB_TAG` | `node` / `20-alpine` | Web container base image (optional) |
| `COMPOSE_HTTP_PROXY` / `COMPOSE_HTTPS_PROXY` | *(empty)* | Docker Compose proxy settings (optional) |

> **Never commit `.env` — it is gitignored.**

---

#### Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5192 | React application |
| API | http://localhost:3001 | Express server |
| Health | http://localhost:3001/health | Health check |
| DB | localhost:5432 | PostgreSQL 16 |

---

#### Available Makefile targets

```bash
make help    # Show all targets and workflow
make clean   # Remove node_modules, dist, Docker containers (DB volume is preserved)
make deploy  # Build Docker images (offline-friendly, uses lib/prisma/ binaries)
make run     # Start all containers
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5192 | React application |
| API | http://localhost:3001 | Express server |
| Health | http://localhost:3001/health | Health check |
| DB | localhost:5432 | PostgreSQL 16 |

## 🗄️ Database Schema

```prisma
Category          ──< Product
Product           ──< Flavor
Product           ──< Dependency (self-relation)
Product           ──< Forecast
Flavor            ──< Forecast
User              (standalone)
```

### Models

| Entity | Key Fields | Relations |
|--------|-----------|-----------|
| **Category** | name, slug, icon, description | → products |
| **Product** | name, slug, description, os, documentation, roadmap, isActive | → category, flavors, dependencies, forecasts |
| **Flavor** | name, vcpu, ramGb, description | → product, forecasts |
| **Dependency** | type (REQUIRED/RECOMMENDED), description | → product, dependsOn |
| **Forecast** | requestedBy, requesterEmail, quantity, status, justification | → product, flavor |
| **User** | name, email, role (ADMIN/USER) | — |

### Enums
- `DependencyType`: `REQUIRED`, `RECOMMENDED`
- `ApprovalStatus`: `PENDING`, `APPROVED`, `REJECTED`
- `UserRole`: `ADMIN`, `USER`

## 🔌 API Reference

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check + timestamp |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List with filters (`category`, `os`, `search`) |
| GET | `/api/products/:slug` | Product detail |
| POST | `/api/products` | Create a product |
| PATCH | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create |
| PATCH | `/api/categories/:id` | Update |
| DELETE | `/api/categories/:id` | Delete |

### Flavors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flavors` | List (filter `productId`) |
| POST | `/api/flavors` | Create |
| PATCH | `/api/flavors/:id` | Update |
| DELETE | `/api/flavors/:id` | Delete |

### Dependencies
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dependencies` | List |
| POST | `/api/dependencies` | Create |
| PATCH | `/api/dependencies/:id` | Update |
| DELETE | `/api/dependencies/:id` | Delete |

### Forecasts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/forecasts` | List requests |
| GET | `/api/forecasts/stats` | Aggregated statistics |
| POST | `/api/forecasts` | Create a request |
| PATCH | `/api/forecasts/:id` | Approve/Reject/Update |
| DELETE | `/api/forecasts/:id` | Delete |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List |
| POST | `/api/users` | Create |
| PATCH | `/api/users/:id` | Update |
| DELETE | `/api/users/:id` | Delete |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/dashboard` | Counters + recent forecasts |
| GET | `/api/admin/products` | All products (admin) |
| GET | `/api/admin/forecasts` | All forecasts (admin) |
| GET | `/api/admin/categories` | All categories |
| GET | `/api/admin/flavors` | All flavors |
| GET | `/api/admin/dependencies` | All dependencies |
| GET | `/api/admin/users` | All users |

### Error Codes
| Code | Meaning |
|------|---------|
| 400 | Zod validation failed |
| 404 | Resource not found |
| 409 | Conflict (unique/foreign key constraint) |
| 500 | Internal error |

## 🧪 NPM Scripts

```bash
# Docker Compose (recommended)
npm run dev

# Local development (concurrently)
npm run dev:local

# Production build
npm run build

# Database
npm run db:push     # Push Prisma schema
npm run db:seed     # Seed data
npm run db:migrate  # Create/apply migration

# Lint
npm run lint
```

## 🌱 Seed Data

The seed automatically creates:

**Categories:** Compute, Data, Hypervisor, Citrix

**Products:**
| Product | Category | OS |
|---------|----------|-----|
| VM Debian 12 | Compute | Linux |
| VM Windows Server 2022 | Compute | Windows |
| VM RedHat Enterprise | Compute | Linux |
| Bare Metal HPC | Compute | Linux |
| Object Storage S3 | Data | — |
| NAS Enterprise | Data | — |
| VMware vSphere | Hypervisor | ESXi |
| Citrix VDI | Citrix | Windows |

**Flavors:** Small (2vCPU/4GB), Medium (4/8), Large (8/16), XL (16/32)

**Dependencies:**
- VM → VPC Network (REQUIRED)
- VM → Storage (RECOMMENDED)
- HPC → Object Storage (RECOMMENDED)

## 🎨 Design System

### Palette
| Token | Value | Usage |
|-------|--------|-------|
| Background | `slate-950` (#020617) | Main background |
| Surface | `slate-900` (#0f172a) | Cards, panels |
| Border | `slate-800` (#1e293b) | Borders |
| Primary | `blue-500` (#3b82f6) | Accent, links |
| Text Primary | `white` | Titles |
| Text Secondary | `slate-400` | Body |
| Text Muted | `slate-500` | Labels |

### shadcn/ui Components
- Button, Card, Badge, Input, Select, Tabs, Dialog, Skeleton, Textarea
- All customized for the dark theme

### Animations
| Name | Description |
|------|-------------|
| `fadeInUp` | Opacity 0→1 + translateY 24px→0 |
| `scaleIn` | Opacity 0→1 + scale 0.96→1 |
| `slideInRight` | For toasts |
| `countUp` | Numeric counter animation |
| Scroll Reveal | IntersectionObserver-based |

## 📱 Responsive

| Breakpoint | Layout |
|------------|--------|
| < 640px | Single column, cards instead of tables, hamburger menu |
| 640px+ | 2 columns, tables visible |
| 1024px+ | 3-4 columns, full layout |

## 🛡️ Error Handling

- **ErrorBoundary**: Catches React errors, displays fallback UI with retry
- **QueryError**: Reusable component for API errors with retry button
- **Toast notifications**: Visual feedback on mutation success/error
- **API interceptor**: Centralized HTTP error logging
- **Express error handler**: Prisma error handling (P2002, P2003, P2025)

## 🔧 Development

### Adding a Page
1. Create the component in `apps/web/src/pages/`
2. Add the route in `App.tsx`
3. Add the link in `Layout.tsx` if necessary

### Adding an API Entity
1. Update `schema.prisma`
2. Generate: `npm run db:generate -w apps/api`
3. Create routes in `apps/api/src/routes/`
4. Add hooks in `apps/web/src/hooks/useApi.ts`

### Conventions
- Strict TypeScript enabled
- Imports with `@/` alias (configured in vite.config.ts)
- Functional components with hooks
- TanStack Query for server state
- Zustand for client state

### Regenerating Prisma Engine Binaries

The engine binaries in `lib/prisma/` are pre-generated and committed to git. You only need to regenerate them if you:
- Upgrade the Prisma version
- Change the target platform (e.g. from Alpine to Debian)
- Add a new binary target to `schema.prisma`

Run this on a machine with internet access:

```bash
make build
```

> **Target platform:** The `PRISMA_CLI_BINARY_TARGETS` variable in your `.env` controls which engine is generated. Uncomment the line matching your container base image (default: `linux-arm64-openssl-3.0.x` for Alpine on ARM64).

This generates the engines and copies them to `lib/prisma/`. After that, commit the changes:

```bash
git add lib/prisma/
git commit -m "chore(prisma): regenerate engine binaries"
```

## 🐛 Troubleshooting

**The frontend cannot connect to the API**
- Check `VITE_API_URL` in `apps/web/.env` (default: `http://localhost:3001`)
- Make sure CORS is enabled on the API

**Prisma Client not generated**
```bash
cd apps/api && npx prisma generate
```

**The database does not start**
- Check that port 5432 is not already in use
- Remove the Docker volume: `docker compose down -v`

**Error "Cannot find module '@cloudmarket/shared-types'"**
```bash
npm run build -w packages/shared-types
```

**Build fails with "Cannot find module @rollup/rollup-linux-..." or esbuild binary error**

The container needs native binaries compiled for Linux, but `npm install` on the host installed them for your host OS (e.g. macOS). Re-run the platform-targeted install:

```bash
# Apple Silicon
npm install --cpu=arm64 --os=linux --libc=musl

# Intel/AMD
npm install --cpu=x64 --os=linux --libc=musl
```

Then rebuild: `docker compose build web`

**API fails with "You installed esbuild for another platform"**

The host `node_modules` is missing the Linux ARM64 esbuild binary. Add it as an optional dependency:

```bash
npm install --force @esbuild/linux-arm64
```

Then remove the API container (with its anonymous volume) and recreate:

```bash
docker compose rm -f -v api
docker compose up -d api
```

**API fails with "Cannot read properties of undefined (reading 'REQUIRED')"**

The Prisma Client was generated from an outdated schema. Regenerate on the host:

```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

Then rebuild and recreate the API container:

```bash
docker compose build api --no-cache
docker compose rm -f -v api
docker compose up -d api
```

**Preview / headless browser shows "Erreur de chargement" but Chrome works**

The frontend uses relative `/api/...` URLs that work with Vite's dev proxy but fail in production with `serve` (no proxy). The fix: rebuild the web image with absolute API URLs (`http://localhost:3001/api/...`) already applied in the source code. Just rebuild:

```bash
docker compose build web --no-cache
docker compose rm -f -v web
docker compose up -d web
```

**SPA routes (e.g., `/marketplace`) return 404 in production**

The static file server (`serve`) needs the `-s` flag to fallback to `index.html` for client-side routing. Already configured in the Dockerfile. If you see 404s on refresh, rebuild:

```bash
docker compose build web --no-cache
```

**Web container unreachable on port 5192**

`serve` may bind to IPv6 only (`::`) which Docker Desktop on macOS cannot forward. The Dockerfile uses `tcp://0.0.0.0:5192` for explicit IPv4 binding. Already fixed — just rebuild if needed.

### 🏢 Corporate Environment

**Custom Docker registry / air-gapped environment**

Both Dockerfiles support custom base images via `REPO_URL`, `API_IMAGE` / `WEB_IMAGE` and `API_TAG` / `WEB_TAG`:

```bash
# Set in .env
REPO_URL=registry.company.com
API_IMAGE=node
API_TAG=20-bookworm
WEB_IMAGE=node
WEB_TAG=20-alpine

# Then build normally
docker compose build
```

**Private npm registry (air-gapped environment)**

`npm install` runs on the host (not inside containers). If your company uses a private npm registry (e.g., Nexus, Artifactory, GitHub Packages), create a `.npmrc` at the project root:

```bash
# .npmrc — not versioned (in .gitignore)
registry=https://registry.company.com/
@mycompany:registry=https://registry.company.com/
//registry.company.com/:_authToken=YOUR_TOKEN
```

Then run `npm install` on the host before building Docker images.

**Prisma client generation**

The generated Prisma client (`node_modules/.prisma/client/`) is tracked in git and includes the Linux query engine binary. If you modify `schema.prisma`, regenerate on the host:

```bash
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

**Secrets (API keys, database passwords)**

Sensitive values should not be committed to git. Use Docker Compose secrets via a local `docker-compose.override.yml`:

```bash
# 1. Create the secrets directory (already gitignored)
mkdir .secrets

# 2. Write your secrets as files
echo 'my-db-password' > .secrets/db_password
echo 'my-api-key' > .secrets/api_key
```

```yaml
# docker-compose.override.yml — machine-specific, not versioned
version: "3.8"

secrets:
  db_password:
    file: .secrets/db_password
  api_key:
    file: .secrets/api_key

services:
  api:
    secrets:
      - db_password
      - api_key
```

Inside the container, secrets are available under `/run/secrets/`:

```ts
// apps/api/src/config.ts
const dbPassword = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
```

> The `.secrets/` directory is gitignored by default. Each developer creates their own local files.

**Prisma binary download blocked (`binaries.prisma.sh` unreachable)**

The API Dockerfile runs `npx prisma generate` during the build, which downloads the correct Linux engine binary directly into the container:

```bash
# Just build — Prisma is generated inside the container
docker compose build api
```

> The `binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]` setting in `schema.prisma` ensures the Linux binary is available. If your corporate proxy blocks `binaries.prisma.sh`, set `HTTP_PROXY` / `HTTPS_PROXY` in your `.env` so the container can reach it.

## 🧹 Clean Up

### Stop containers (preserve data)

```bash
docker compose down
```

Containers are stopped and removed. The PostgreSQL data volume (`postgres_data`) is preserved. Next `docker compose up` will reuse the existing database.

### Stop containers and remove ALL data

```bash
# ⚠️ DESTROYS DATABASE — use with caution
docker compose down -v
```

The `-v` flag removes all named volumes including `postgres_data`. You will lose all data and need to re-run `prisma db push` and `seed.ts` on next start.

### Rebuild a single service cleanly

When `node_modules` changes on the host (e.g., new dependency, native binary, Prisma regeneration), you must rebuild the image **and** remove the container so the new `node_modules` is copied in:

```bash
# Rebuild web from scratch
docker compose build web --no-cache
docker compose rm -f -v web
docker compose up -d web

# Rebuild API from scratch
docker compose build api --no-cache
docker compose rm -f -v api
docker compose up -d api
```

> `--no-cache` ensures Docker does not reuse an old image layer.  
> `rm -f -v` removes the container **and** its anonymous volumes (which could contain a stale `node_modules` that overrides the image).

### Start completely fresh (from a clean git clone)

```bash
# 1. Clone
git clone <repo-url> cloudmarket && cd cloudmarket

# 2. Install dependencies (host needs network)
npm install

# 3. Generate Prisma Client on host
npx prisma generate --schema=apps/api/prisma/schema.prisma

# 4. Install Linux-native binaries for the container
npm install --cpu=arm64 --os=linux --libc=musl

# 5. Build and start everything
docker compose up --build

# 6. Push schema and seed (in another terminal)
docker compose exec api npx prisma db push
docker compose exec api npx tsx prisma/seed.ts
```

### Verify all services are healthy

```bash
docker compose ps
```

All three services should show `healthy`:
- `cloudmarket-db` (postgres)
- `cloudmarket-api` (node)
- `cloudmarket-web` (node)

## 📄 License

MIT — Educational / demonstration project.
