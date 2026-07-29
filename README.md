# CloudMarket IaaS

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss)](https://tailwindcss.com)
[![Prisma](https://img.shields.io/badge/Prisma-5.13-2D3748?logo=prisma)](https://prisma.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](https://docker.com)

> Marketplace d'infrastructure cloud complète avec interface client moderne, dashboard de forecast et panneau d'administration.

## ✨ Fonctionnalités

### 🛒 Marketplace
- Catalogue de produits IaaS avec grille responsive et animations
- Filtres dynamiques par catégorie, OS, flavor et recherche textuelle
- Fiches produits détaillées : description, documentation, roadmap, dépendances
- Graphique de dépendances SVG interactif

### 📊 Forecast Dashboard
- Statistiques en temps réel avec compteurs animés
- Tableau des demandes avec statuts colorés (Pending / Approved / Rejected)
- Filtres par statut et recherche
- Création de demandes avec sélection cascade produit → flavor
- Actions rapides : approuver, rejeter, supprimer

### 🛠️ Administration
- Dashboard avec compteurs et activité récente
- CRUD complet pour Produits, Catégories, Flavors, Dépendances, Forecasts, Utilisateurs
- Tableaux responsive (cartes sur mobile, tables sur desktop)
- Modales d'édition avec validation

### 🎨 Design & UX
- Thème sombre cohérent (`slate-950`, accent `blue-500`)
- Animations d'entrée par scroll (IntersectionObserver)
- Transitions de page fluides
- Système de notifications toast
- Gestion des erreurs avec Error Boundary et états de retry
- Support `prefers-reduced-motion`
- Scrollbar personnalisée

## 🏗️ Architecture

```
cloudmarket/
├── docker-compose.yml           # Stack complète (web + api + db)
├── package.json                 # Workspaces monorepo
├── README.md
├── apps/
│   ├── web/                     # Frontend React 18 + Vite
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/          # shadcn/ui (Button, Card, Badge, Input, Select, Tabs, Dialog, Skeleton, Textarea)
│   │   │   │   ├── Layout.tsx   # Navbar sticky + footer + menu mobile
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
│   │   │   │   ├── useAppStore.ts   # Zustand (filtres marketplace)
│   │   │   │   └── useToastStore.ts # Notifications
│   │   │   ├── lib/
│   │   │   │   └── utils.ts     # cn() helper
│   │   │   ├── App.tsx
│   │   │   ├── main.tsx
│   │   │   └── index.css        # Tailwind + animations custom
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
            └── index.ts         # Types + enums partagés
```

## 🚀 Démarrage Rapide

### Prérequis
- Docker Desktop / Docker Engine + Docker Compose v2
- Node.js 20+ (optionnel, pour développement local)

### Avec Docker Compose (recommandé)

```bash
# Cloner et entrer dans le projet
cd cloudmarket

# Lancer l'ensemble de la stack
docker compose up --build

# Dans un autre terminal, seed la base de données
docker compose exec api npx tsx prisma/seed.ts
```

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5192 | Application React |
| API | http://localhost:3001 | Serveur Express |
| Health | http://localhost:3001/health | Health check |
| DB | localhost:5432 | PostgreSQL 16 |

### Développement local (sans Docker)

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer PostgreSQL
docker run -d \
  --name cloudmarket-db \
  -e POSTGRES_USER=cloudmarket \
  -e POSTGRES_PASSWORD=cloudmarket_secret \
  -e POSTGRES_DB=cloudmarket \
  -p 5432:5432 \
  postgres:16-alpine

# 3. Configurer la base de données
cd apps/api
npx prisma db push
npx tsx prisma/seed.ts

# 4. Démarrer l'API (terminal 1)
npm run dev -w apps/api

# 5. Démarrer le frontend (terminal 2)
npm run dev -w apps/web
```

## 🗄️ Schéma de Base de Données

```prisma
Category          ──< Product
Product           ──< Flavor
Product           ──< Dependency (self-relation)
Product           ──< Forecast
Flavor            ──< Forecast
User              (standalone)
```

### Modèles

| Entité | Champs clés | Relations |
|--------|------------|-----------|
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
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Health check + timestamp |

### Produits
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/products` | Liste avec filtres (`category`, `os`, `search`) |
| GET | `/api/products/:slug` | Détail d'un produit |
| POST | `/api/products` | Créer un produit |
| PATCH | `/api/products/:id` | Modifier un produit |
| DELETE | `/api/products/:id` | Supprimer un produit |

### Catégories
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/categories` | Liste des catégories |
| POST | `/api/categories` | Créer |
| PATCH | `/api/categories/:id` | Modifier |
| DELETE | `/api/categories/:id` | Supprimer |

### Flavors
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/flavors` | Liste (filtre `productId`) |
| POST | `/api/flavors` | Créer |
| PATCH | `/api/flavors/:id` | Modifier |
| DELETE | `/api/flavors/:id` | Supprimer |

### Dépendances
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/dependencies` | Liste |
| POST | `/api/dependencies` | Créer |
| PATCH | `/api/dependencies/:id` | Modifier |
| DELETE | `/api/dependencies/:id` | Supprimer |

### Forecasts
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/forecasts` | Liste des demandes |
| GET | `/api/forecasts/stats` | Statistiques agrégées |
| POST | `/api/forecasts` | Créer une demande |
| PATCH | `/api/forecasts/:id` | Approuver/Rejeter/Modifier |
| DELETE | `/api/forecasts/:id` | Supprimer |

### Utilisateurs
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/users` | Liste |
| POST | `/api/users` | Créer |
| PATCH | `/api/users/:id` | Modifier |
| DELETE | `/api/users/:id` | Supprimer |

### Admin
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/admin/dashboard` | Compteurs + forecasts récents |
| GET | `/api/admin/products` | Tous les produits (admin) |
| GET | `/api/admin/forecasts` | Tous les forecasts (admin) |
| GET | `/api/admin/categories` | Toutes les catégories |
| GET | `/api/admin/flavors` | Tous les flavors |
| GET | `/api/admin/dependencies` | Toutes les dépendances |
| GET | `/api/admin/users` | Tous les utilisateurs |

### Codes d'erreur
| Code | Signification |
|------|--------------|
| 400 | Validation Zod échouée |
| 404 | Ressource non trouvée |
| 409 | Conflit (contrainte unique/foreign key) |
| 500 | Erreur interne |

## 🧪 Scripts NPM

```bash
# Docker Compose (recommandé)
npm run dev

# Développement local (concurrently)
npm run dev:local

# Build production
npm run build

# Base de données
npm run db:push     # Pousser le schéma Prisma
npm run db:seed     # Seeder les données
npm run db:migrate  # Créer/appliquer une migration

# Lint
npm run lint
```

## 🌱 Seed Data

Le seed crée automatiquement :

**Catégories :** Compute, Data, Hypervisor, Citrix

**Produits :**
| Produit | Catégorie | OS |
|---------|-----------|-----|
| VM Debian 12 | Compute | Linux |
| VM Windows Server 2022 | Compute | Windows |
| VM RedHat Enterprise | Compute | Linux |
| Bare Metal HPC | Compute | Linux |
| Object Storage S3 | Data | — |
| NAS Enterprise | Data | — |
| VMware vSphere | Hypervisor | ESXi |
| Citrix VDI | Citrix | Windows |

**Flavors :** Small (2vCPU/4GB), Medium (4/8), Large (8/16), XL (16/32)

**Dépendances :**
- VM → Réseau VPC (REQUIRED)
- VM → Stockage (RECOMMENDED)
- HPC → Object Storage (RECOMMENDED)

## 🎨 Design System

### Palette
| Token | Valeur | Usage |
|-------|--------|-------|
| Background | `slate-950` (#020617) | Fond principal |
| Surface | `slate-900` (#0f172a) | Cartes, panels |
| Border | `slate-800` (#1e293b) | Bordures |
| Primary | `blue-500` (#3b82f6) | Accent, liens |
| Text Primary | `white` | Titres |
| Text Secondary | `slate-400` | Corps |
| Text Muted | `slate-500` | Labels |

### Composants shadcn/ui
- Button, Card, Badge, Input, Select, Tabs, Dialog, Skeleton, Textarea
- Tous personnalisés pour le thème sombre

### Animations
| Nom | Description |
|-----|-------------|
| `fadeInUp` | Opacité 0→1 + translateY 24px→0 |
| `scaleIn` | Opacité 0→1 + scale 0.96→1 |
| `slideInRight` | Pour les toasts |
| `countUp` | Animation de compteur numérique |
| Scroll Reveal | IntersectionObserver-based |

## 📱 Responsive

| Breakpoint | Layout |
|------------|--------|
| < 640px | Single column, cards au lieu de tables, menu hamburger |
| 640px+ | 2 colonnes, tables visibles |
| 1024px+ | 3-4 colonnes, layout complet |

## 🛡️ Gestion des Erreurs

- **ErrorBoundary** : Capture les erreurs React, affiche fallback UI avec retry
- **QueryError** : Composant réutilisable pour les erreurs API avec bouton retry
- **Toast notifications** : Feedback visuel sur succès/erreur des mutations
- **API interceptor** : Logging centralisé des erreurs HTTP
- **Error handler Express** : Gestion des erreurs Prisma (P2002, P2003, P2025)

## 🔧 Développement

### Ajouter une page
1. Créer le composant dans `apps/web/src/pages/`
2. Ajouter la route dans `App.tsx`
3. Ajouter le lien dans `Layout.tsx` si nécessaire

### Ajouter une entité API
1. Mettre à jour `schema.prisma`
2. Générer : `npm run db:generate -w apps/api`
3. Créer les routes dans `apps/api/src/routes/`
4. Ajouter les hooks dans `apps/web/src/hooks/useApi.ts`

### Conventions
- TypeScript strict activé
- Imports avec alias `@/` (configuré dans vite.config.ts)
- Composants fonctionnels avec hooks
- TanStack Query pour le server state
- Zustand pour le client state

## 🐛 Dépannage

**Le frontend ne se connecte pas à l'API**
- Vérifiez `VITE_API_URL` dans `apps/web/.env` (défaut: `http://localhost:3001`)
- Assurez-vous que les CORS sont activés sur l'API

**Prisma Client non généré**
```bash
cd apps/api && npx prisma generate
```

**La base de données ne démarre pas**
- Vérifiez que le port 5432 n'est pas déjà utilisé
- Supprimez le volume Docker : `docker compose down -v`

**Erreur "Cannot find module '@cloudmarket/shared-types'"**
```bash
npm run build -w packages/shared-types
```

## 📄 License

MIT — Projet éducatif / démonstration.
