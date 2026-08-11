# CloudMarket IaaS — Makefile
# Simplifies build, deploy, and run workflows for both online (build)
# and air-gapped (deploy) environments.

.PHONY: clean build deploy run help

# Detect OS for platform-specific npm install
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    NPM_PLATFORM_FLAGS := --cpu=arm64 --os=linux --libc=musl
else
    NPM_PLATFORM_FLAGS := --cpu=x64 --os=linux --libc=musl
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
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/web/dist packages/shared-types/dist
	docker compose down
	docker system prune -f

## Build — Generate Prisma engine binaries on a host with internet access.
## Run this ONCE on any machine that can reach binaries.prisma.sh.
## After this, commit lib/prisma/ to git.
build:
	npm install
	PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x npx prisma generate --schema=apps/api/prisma/schema.prisma
	PRISMA_CLI_BINARY_TARGETS=linux-arm64-openssl-3.0.x npx prisma generate --schema=apps/api/prisma/schema.prisma
	PRISMA_CLI_BINARY_TARGETS=darwin npx prisma generate --schema=apps/api/prisma/schema.prisma
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
	. .source.prisma && \
	npm install && \
	npm install $(NPM_PLATFORM_FLAGS) && \
	npx prisma generate --schema=apps/api/prisma/schema.prisma && \
	docker compose build --no-cache
	@echo ""
	@echo "✓ Images built. Run 'make run' to start containers."

## Run — Start all containers (db, api, web)
run:
	docker compose up -d
	@echo ""
	@echo "✓ Containers started:"
	@echo "  Web:    http://localhost:5192"
	@echo "  API:    http://localhost:3001"
	@echo "  Health: http://localhost:3001/health"
