# CloudMarket IaaS

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.13-2D3748?logo=prisma)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

> Full-featured cloud infrastructure marketplace with a modern client interface, forecast dashboard, and administration panel.

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

### With Docker Compose (recommended)

```bash
# Clone and enter the project
cd cloudmarket

# Launch the full stack
docker compose up --build

# In another terminal, seed the database
docker compose exec api npx tsx prisma/seed.ts
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5192 | React application |
| API | http://localhost:3001 | Express server |
| Health | http://localhost:3001/health | Health check |
| DB | localhost:5432 | PostgreSQL 16 |

### Local development (without Docker)

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL
docker run -d \
  --name cloudmarket-db \
  -e POSTGRES_USER=cloudmarket \
  -e POSTGRES_PASSWORD=cloudmarket_secret \
  -e POSTGRES_DB=cloudmarket \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Set up the database
cd apps/api
npx prisma db push
npx tsx prisma/seed.ts

# 4. Start the API (terminal 1)
npm run dev -w apps/api

# 5. Start the frontend (terminal 2)
npm run dev -w apps/web
```

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

## 📄 License

MIT — Educational / demonstration project.
