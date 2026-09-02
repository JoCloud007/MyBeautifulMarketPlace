# CloudMarket IaaS — Makefile
# Simplifies build, deploy, and run workflows for both online (build)
# and air-gapped (deploy) environments.

.PHONY: clean build deploy run help

# Force bash — avoids POSIX/dash incompatibilities on Ubuntu
SHELL := /bin/bash

# Detect host architecture for platform-specific npm install
UNAME_M := $(shell uname -m)
ifeq ($(UNAME_M),arm64)
    NPM_PLATFORM_FLAGS := --arch=arm64 --platform=linux
else ifeq ($(UNAME_M),aarch64)
    NPM_PLATFORM_FLAGS := --arch=arm64 --platform=linux
else
    NPM_PLATFORM_FLAGS := --arch=x64 --platform=linux
endif

## Show available targets
help:
	@echo "CloudMarket IaaS — Available targets:"
	@echo ""
	@echo "  make clean   — Remove node_modules, dist, and Docker artifacts"
	@echo "  make build   — Generate Prisma binaries (requires internet)"
	@echo "  make deploy  — Build images for air-gapped deployment"
	@echo "  make run     — Start all containers"
	@echo ""
	@echo "Workflow:"
	@echo "  1. On a machine WITH internet:    make build"
	@echo "  2. Commit lib/prisma/ to git"
	@echo "  3. On the air-gapped target:      make deploy && make run"

## Clean everything — node_modules, dist, Docker containers.
## NOTE: Docker volumes (including postgres_data) are PRESERVED.
## Use `docker compose down -v` manually if you really want to wipe the DB.
clean:
	# Move-then-delete avoids "Directory not empty" when a process holds the dir open
	-mv node_modules node_modules.old.$$$$ 2>/dev/null && rm -rf node_modules.old.$$$$ 2>/dev/null || true
	-find apps -type d -name node_modules -exec sh -c 'mv "$$1" "$$1.old.$$$$"; rm -rf "$$1.old.$$$$"' _ {} \; 2>/dev/null || true
	-find packages -type d -name node_modules -exec sh -c 'mv "$$1" "$$1.old.$$$$"; rm -rf "$$1.old.$$$$"' _ {} \; 2>/dev/null || true
	rm -rf apps/web/dist packages/shared-types/dist 2>/dev/null || true
	docker compose down --rmi all 2>/dev/null || true

## Build — Generate Prisma engine binaries on a host with internet access.
## Run this ONCE on any machine that can reach binaries.prisma.sh.
## After this, commit lib/prisma/ to git.
build:
	npm install --legacy-peer-deps
	PRISMA_CLI_BINARY_TARGETS=darwin,debian-openssl-3.0.x,linux-arm64-openssl-3.0.x npx prisma generate --schema=apps/api/prisma/schema.prisma
	mkdir -p lib/prisma
	cp node_modules/.prisma/client/libquery_engine-*.node lib/prisma/
	cp node_modules/@prisma/engines/schema-engine-* lib/prisma/
	@echo ""
	@echo "✓ Prisma binaries generated in lib/prisma/"
	@echo "  Next step: git add lib/prisma/ && git commit"

## Deploy — Prepare for air-gapped deployment.
## Sources .source.prisma (offline env vars), installs platform-native
## dependencies, regenerates Prisma client from local binaries, and builds
## all Docker images.
deploy:
	. "$(shell pwd)/.source.prisma" && \
	rm -rf node_modules && npm install --force --legacy-peer-deps --no-package-lock $(NPM_PLATFORM_FLAGS) && \
	npm run build -w packages/shared-types && \
	npx prisma generate --schema=apps/api/prisma/schema.prisma && \
	npm run build -w apps/web && \
	docker compose build --no-cache
	@echo ""
	@echo "✓ Images built. Run 'make run' to start containers."

## Run — Start all containers (db, api, web).
## Recreates containers to ensure the latest built images are used.
run:
	docker compose up -d --force-recreate
	@echo ""
	@echo "✓ Containers started:"
	@echo "  Web:    http://localhost:5192"
	@echo "  API:    http://localhost:3001"
	@echo "  Health: http://localhost:3001/health"
