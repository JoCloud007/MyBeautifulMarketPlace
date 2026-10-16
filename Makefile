# CloudMarket IaaS — Makefile
# Simplifies build, deploy, and run workflows for both online (build)
# and air-gapped (deploy) environments.

.PHONY: clean build deploy run help backfill-variants restart-api seed-incremental update fix-client-db fix-client-db-profiles fix-client-db-variant-os fix-client-db-transition-kind

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
	@echo "  make run     — Start all containers (fresh dist)"
	@echo "  make update  — Post-git-pull: backup + db push + recreate + seed"
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
	@echo ""
	@echo "==> Packing native bundler binaries into lib/native/ (commit them)"
	mkdir -p lib/native && rm -f lib/native/*.tgz
	ESBUILD_VERSION=$$(node -p "require('./node_modules/esbuild/package.json').version") && \
	for plat in linux-arm64 linux-x64 darwin-arm64 darwin-x64; do \
		npm pack @esbuild/$$plat@$$ESBUILD_VERSION --pack-destination lib/native >/dev/null 2>&1 || echo "  (warn) @esbuild/$$plat@$$ESBUILD_VERSION non packé"; \
	done && \
	ROLLUP_VERSION=$$(node -p "require('./node_modules/rollup/package.json').version") && \
	for plat in rollup-linux-arm64-gnu rollup-linux-x64-gnu rollup-darwin-arm64 rollup-darwin-x64; do \
		npm pack @rollup/$$plat@$$ROLLUP_VERSION --pack-destination lib/native >/dev/null 2>&1 || echo "  (warn) @rollup/$$plat@$$ROLLUP_VERSION non packé"; \
	done && \
	ls -la lib/native/
	@echo ""
	@echo "✓ Native tarballs in lib/native/ — commit them: git add lib/native/ && git commit"
	@echo "  (the air-gapped mirror may not serve these packages; deploy will"
	@echo "   extract the committed tarballs instead of hitting the registry)"

## Deploy — Prepare for air-gapped deployment.
## Sources .source.prisma (offline env vars), installs platform-native
## dependencies, regenerates Prisma client from local binaries, and builds
## all Docker images.
deploy:
	@echo "==> git $$(git rev-parse --short HEAD) / npm $$(npm -v) — expect overrides esbuild 0.28.1 / rollup 4.62.3 (>= commit d6a0b377)"
	exec > >(tee deploy.log) 2>&1; \
	. "$(shell pwd)/.source.prisma" && \
	for i in 1 2 3 4 5; do rm -rf node_modules 2>/dev/null && break || sleep 2; done; \
	if [ -d node_modules ]; then echo "ERROR: cannot remove node_modules (a process keeps recreating files — close editors/language servers and retry)"; exit 1; fi && \
	for ws in apps/web apps/api packages/shared-types; do \
		for i in 1 2 3; do rm -rf $$ws/node_modules 2>/dev/null && break || sleep 2; done; \
		if [ -d $$ws/node_modules ]; then echo "ERROR: cannot remove $$ws/node_modules"; exit 1; fi; \
	done && \
	echo "ETAPE 1/10 OK — node_modules (root + workspaces) removed" && \
	echo "ETAPE 2/10 — staging native bundler binaries" && \
	ESBUILD_PIN=$$(node -p "require('./package.json').overrides.esbuild") && \
	ROLLUP_PIN=$$(node -p "require('./package.json').overrides.rollup") && \
	echo "    pinned versions (package.json overrides): esbuild $$ESBUILD_PIN / rollup $$ROLLUP_PIN" && \
	rm -rf .native-cache && mkdir -p .native-cache && \
	for plat in linux-arm64 linux-x64 darwin-arm64 darwin-x64; do \
		tgz=$$(ls lib/native/esbuild-$$plat-*.tgz 2>/dev/null | head -1 || true); \
		if [ -n "$$tgz" ]; then cp "$$tgz" .native-cache/; \
		else npm pack @esbuild/$$plat@$$ESBUILD_PIN --pack-destination .native-cache >/dev/null 2>&1 || { echo "ERROR: cannot obtain esbuild-$$plat@$$ESBUILD_PIN tarball. Run 'make build' on a connected machine and commit lib/native/."; exit 1; }; fi; \
	done && \
	for spec in rollup-linux-arm64-gnu rollup-linux-x64-gnu rollup-darwin-arm64 rollup-darwin-x64; do \
		tgz=$$(ls lib/native/rollup-$$spec-*.tgz 2>/dev/null | head -1 || true); \
		if [ -n "$$tgz" ]; then cp "$$tgz" .native-cache/; \
		else npm pack @rollup/$$spec@$$ROLLUP_PIN --pack-destination .native-cache >/dev/null 2>&1 || { echo "ERROR: cannot obtain rollup-$$spec@$$ROLLUP_PIN tarball. Run 'make build' on a connected machine and commit lib/native/."; exit 1; }; fi; \
	done && \
	ls .native-cache/ && \
	echo "ETAPE 3/10 OK — natives staged" && \
	npm install --force --legacy-peer-deps --no-package-lock --omit=optional $(NPM_PLATFORM_FLAGS) && \
	echo "ETAPE 4/10 OK — npm install" && \
	for ws in apps/web apps/api packages/shared-types; do \
		rm -rf $$ws/node_modules/esbuild $$ws/node_modules/@esbuild $$ws/node_modules/rollup $$ws/node_modules/@rollup 2>/dev/null; \
	done && \
	for d in $$(find node_modules -mindepth 3 -type d \( -name esbuild -o -name rollup -o -name "@esbuild" -o -name "@rollup" \) -prune 2>/dev/null); do rm -rf "$$d"; done; \
	ESBUILD_VERSION=$$(node -p "require('./node_modules/esbuild/package.json').version") && \
	ROLLUP_VERSION=$$(node -p "require('./node_modules/rollup/package.json').version") && \
	if [ "$$ESBUILD_VERSION" != "$$ESBUILD_PIN" ] || [ "$$ROLLUP_VERSION" != "$$ROLLUP_PIN" ]; then echo "ERROR: npm resolved esbuild $$ESBUILD_VERSION / rollup $$ROLLUP_VERSION but the pinned versions are $$ESBUILD_PIN / $$ROLLUP_PIN — the package.json overrides were not applied (stale checkout?). Run 'git log -1' and re-pull."; exit 1; fi && \
	VITE_ESBUILD=$$(node -e "const path=require('path');const p=require.resolve('esbuild/package.json',{paths:[path.dirname(require.resolve('vite/package.json'))]});console.log(require(p).version)") && \
	echo "==> vite resolves esbuild $$VITE_ESBUILD (must equal $$ESBUILD_PIN)" && \
	if [ "$$VITE_ESBUILD" != "$$ESBUILD_PIN" ]; then echo "ERROR: vite resolves esbuild $$VITE_ESBUILD but the pinned version is $$ESBUILD_PIN — a nested esbuild copy survives; rm -rf node_modules apps/web/node_modules then 'make deploy' again."; exit 1; fi && \
	echo "==> Installed esbuild $$ESBUILD_VERSION / rollup $$ROLLUP_VERSION — extracting staged natives" && \
	for plat in linux-arm64 linux-x64 darwin-arm64 darwin-x64; do \
		tgz=$$(ls .native-cache/esbuild-$$plat-*.tgz | head -1); \
		tgzname=$$(basename "$$tgz"); \
		if [ "$$tgzname" != "esbuild-$$plat-$$ESBUILD_VERSION.tgz" ]; then echo "ERROR: staged esbuild-$$plat tarball version does not match installed esbuild $$ESBUILD_VERSION ($$tgzname). Re-run 'make build' on a connected machine and commit lib/native/."; exit 1; fi; \
		mkdir -p node_modules/@esbuild/$$plat && tar -xzf "$$tgz" -C node_modules/@esbuild/$$plat --strip-components=1; \
	done && \
	for spec in rollup-linux-arm64-gnu rollup-linux-x64-gnu rollup-darwin-arm64 rollup-darwin-x64; do \
		tgz=$$(ls .native-cache/rollup-$$spec-*.tgz | head -1); \
		tgzname=$$(basename "$$tgz"); \
		if [ "$$tgzname" != "rollup-$$spec-$$ROLLUP_VERSION.tgz" ]; then echo "ERROR: staged rollup-$$spec tarball version does not match installed rollup $$ROLLUP_VERSION ($$tgzname). Re-run 'make build' on a connected machine and commit lib/native/."; exit 1; fi; \
		mkdir -p node_modules/@rollup/$$spec && tar -xzf "$$tgz" -C node_modules/@rollup/$$spec --strip-components=1; \
	done && \
	rm -rf .native-cache && \
	echo "ETAPE 5/10 OK — natives extracted" && \
	npm run build -w packages/shared-types && \
	echo "ETAPE 6/10 OK — shared-types built" && \
	npx prisma generate --schema=apps/api/prisma/schema.prisma && \
	echo "ETAPE 7/10 OK — prisma generated" && \
	(cd apps/web && npx tsc --noEmit > /tmp/vite-tsc-out.txt 2>&1) && echo "ETAPE 8/10 OK — web type-check" || { echo "ETAPE 8/10 FAIL — tsc errors below"; head -15 /tmp/vite-tsc-out.txt; exit 1; } && \
	(cd apps/web && npx vite build > /tmp/vite-build-out.txt 2>&1) && echo "ETAPE 9/10 OK — web built" || { echo "ETAPE 9/10 FAIL — vite build. Context: $$(uname -m) / node $$(node -v) / npm $$(npm -v)"; tail -25 /tmp/vite-build-out.txt; echo "ETAPE 9/10 FAIL — end of error"; exit 1; } && \
	echo "ETAPE 10/10 — docker compose build (final, can take minutes)" && \
	docker compose build --no-cache && \
	echo "ETAPE 10/10 OK — images built"
	@echo ""
	@echo "✓ Images built. Run 'make run' to start containers."

## Check natives — diagnose esbuild/rollup service failures in 2 seconds.
## Runs on the deployment host after make deploy: verifies the esbuild and
## rollup JS packages agree with their native binaries (the "Host version
## does not match binary" / "The service was stopped" class of failures).
check-natives:
	@echo "==> arch: $$(uname -m) / node $$(node -v) / npm $$(npm -v)"
	@node -p "'==> esbuild JS: ' + require('./node_modules/esbuild/package.json').version"
	@node -p "'==> rollup JS:  ' + require('./node_modules/rollup/package.json').version"
	@echo "==> esbuild binary: $$(./node_modules/.bin/esbuild --version 2>&1)"
	@echo "==> rollup native:  $$(node -e "console.log(require('rollup/dist/native.js') ? 'loads' : 'loaded')" 2>&1 | tail -1)"
	@node -e "const fs=require('fs');const d='node_modules/@esbuild/darwin-'+process.arch;console.log('==> installed @esbuild variants: '+fs.readdirSync('node_modules/@esbuild').join(', '));console.log('==> expected for this host: @esbuild/darwin-'+process.arch);if(fs.existsSync(d+'/bin/esbuild')){const st=fs.statSync(d+'/bin/esbuild');console.log('==> binary executable: '+(st.mode&0o111?'yes':'NO — run: chmod +x '+d+'/bin/esbuild'))}else{console.log('==> MISSING: '+d+'/bin/esbuild')}"

## Test vite — reproduce the web build's esbuild service usage and print a
## one-word verdict per probe (read them aloud, nothing needs to be sent).
## Probe 1: direct binary (bypasses every JS wrapper). Probe 2: the esbuild
## API exactly as vite uses it (service spawn + TS transform, the very step
## that loads vite.config.ts). Probe 3: rollup native load (next bundler
## stage). Probe 4: the actual web build, verbose on failure.
test-vite:
	@echo "==> macOS $$(sw_vers -productVersion 2>/dev/null) / $$(uname -m) / node $$(node -v)"
	@echo "PROBE 1 (direct binary): $$(./node_modules/@esbuild/darwin-$$(uname -m | sed 's/arm64/arm64/;s/x86_64/x64/')/bin/esbuild --version 2>&1 | tail -1)"
	@node -e "require('./node_modules/esbuild/lib/main.js').transform('const a: number = 1', { loader: 'ts' }).then(() => { console.log('PROBE 2 (esbuild service + TS): OK'); process.exit(0) }).catch(e => { console.log('PROBE 2 (esbuild service + TS): FAIL — ' + String(e.message).split('\n')[0]); process.exit(1) })"
	@node -e "try { require('rollup/dist/native.js'); console.log('PROBE 3 (rollup native): OK') } catch (e) { console.log('PROBE 3 (rollup native): FAIL — ' + String(e.message).split('\n')[0]); process.exit(1) }"
	@(cd apps/web && npx vite build > /tmp/vite-build-out.txt 2>&1) && echo "PROBE 4 (web build): OK" || { echo "PROBE 4 (web build): FAIL — last lines:"; tail -15 /tmp/vite-build-out.txt; }

## Run — Start all containers (db, api, web).
## Recreates containers to ensure the latest built images are used.
## --renew-anon-volumes is REQUIRED: the api container mounts an anonymous
## volume on /app/apps/api/dist, and without this flag the OLD compiled dist
## survives recreation (symptom: runtime errors from stale pre-refactor code).
run:
	docker compose up -d --force-recreate --renew-anon-volumes
	@echo ""
	@echo "✓ Containers started:"
	@echo "  Web:    http://localhost:5192"
	@echo "  API:    http://localhost:3001"
	@echo "  Health: http://localhost:3001/health"

## Backfill — Populate ProductVariant lifecycle dates from OsVersion.
## Fixes "No roadmap data available" when variants lack releaseDate.
## Idempotent: safe to run multiple times.
backfill-variants:
	@docker compose exec -T db \
		psql -U cloudmarket -d cloudmarket -c \
		"UPDATE \"ProductVariant\" pv SET \"releaseDate\" = ov.\"releaseDate\", \"normalSupportEnd\" = ov.\"normalSupportEnd\", \"extendedSupportEnd\" = ov.\"extendedSupportEnd\", \"eolDate\" = ov.\"eolDate\", phase = ov.phase FROM \"OsVersion\" ov WHERE pv.\"osVersionId\" = ov.id;"
	@echo ""
	@echo "✓ ProductVariant lifecycle dates backfilled from OsVersion"
	@echo "  Restart the API to clear caches: make restart-api"

## Restart API container (useful after DB changes).
restart-api:
	docker compose restart api
	@echo ""
	@echo "✓ API restarted"

## Update — Standard post-git-pull procedure for an existing deployment.
## make deploy + make run do NOT touch the database schema, and make run
## alone leaves a stale dist. This target runs the full client-confirmed
## runbook: backup, schema push, recreate, incremental seed.
## Safe on a database with existing data: no destructive flags, no deletes.
update:
	@echo "==> 1/6 Backing up database to backup_`date +%F_%H%M`.sql"
	@docker compose exec -T db pg_dump -U cloudmarket -d cloudmarket > backup_`date +%F_%H%M`.sql
	@echo "==> 2/6 Recreating containers with fresh code and dist"
	docker compose up -d --force-recreate --renew-anon-volumes api web
	@echo "==> 3/6 Pre-converting enum columns db push cannot alter (idempotent, lossless)"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610151000_resiliency_enum_to_text/migration.sql
	@echo "==> 4/6 Pushing Prisma schema (non-destructive db push, from the fresh image)"
	. "$(shell pwd)/.source.prisma" && docker compose exec -T api npx prisma db push
	@echo "==> 5/6 Running incremental seed"
	$(MAKE) seed-incremental
	@echo "==> 6/6 Classifying PRODUCT/OS transitions (idempotent backfill)"
	@docker compose exec -T api npx tsx prisma/backfill-transition-kind.ts
	@echo ""
	@echo "✓ Deployment updated — schema, dist, seed and transition backfill are current"

## Fix client DB — applies the missing flavor-fields schema (one shot).
## For databases provisioned by db push (no _prisma_migrations table),
## where `prisma migrate deploy` fails with P3005. Non-destructive:
## adds nullable columns + FlavorFieldDefinition table only, then
## backfills attribute definitions. Idempotent: safe to re-run.
fix-client-db:
	@echo "==> 1/3 Backing up database"
	@docker compose exec -T db pg_dump -U cloudmarket -d cloudmarket > backup_flavor_fix_`date +%F_%H%M`.sql
	@echo "==> 2/3 Applying flavor-fields schema patch"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610121700_add_flavor_fields/migration.sql
	@echo "==> 3/3 Seeding flavor field definitions + backfilling attributes"
	@docker compose exec -T api npx tsx prisma/migrate-flavor-fields.ts
	@echo ""
	@echo "✓ Done. Restart API to clear caches: make restart-api"

## Fix client DB (flavor profiles) — applies the Profile × Size grid schema.
## Adds FlavorProfile table + nullable Flavor.profileId/sizeLabel/sizeRank.
## For databases provisioned by db push (no _prisma_migrations table).
## Non-destructive: nullable columns + new table only, then backfills the
## default profile rows. Idempotent: safe to re-run (IF NOT EXISTS / DO $$ FK).
fix-client-db-profiles:
	@echo "==> 1/3 Backing up database"
	@docker compose exec -T db pg_dump -U cloudmarket -d cloudmarket > backup_flavor_profiles_`date +%F_%H%M`.sql
	@echo "==> 2/3 Applying flavor-profile schema patch"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610151200_add_flavor_profile/migration.sql
	@echo "==> 3/3 Backfilling flavor profiles"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610151200_add_flavor_profile/backfill.sql
	@echo ""
	@echo "✓ Done. Restart API to clear caches: make restart-api"

## Fix client DB (transition kind) — applies the PRODUCT/OS transition schema.
## Adds enum TransitionKind + nullable Transition.kind / fromOsVersionId /
## toOsVersionId, then classifies existing transitions (OS upgrade rows get
## kind=OS with their OsVersion FKs). For databases provisioned by db push
## (no _prisma_migrations table), where `prisma db push` fails with P3005.
## Non-destructive and idempotent: safe to re-run.
fix-client-db-transition-kind:
	@echo "==> 1/3 Backing up database"
	@docker compose exec -T db pg_dump -U cloudmarket -d cloudmarket > backup_transition_kind_`date +%F_%H%M`.sql
	@echo "==> 2/3 Applying transition-kind schema patch"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610161900_add_transition_kind/migration.sql
	@echo "==> 3/3 Backfilling transition kinds (idempotent)"
	@docker compose exec -T api npx tsx prisma/backfill-transition-kind.ts
	@echo ""
	@echo "✓ Done. Restart API to clear caches: make restart-api"

## Fix client DB — makes ProductVariant optional relation columns nullable.
## For databases provisioned by an older `db push` where osId/osVersionId/
## continuityLevelId/productVersionId are still NOT NULL: clearing the OS of
## a storage variant then fails with "Null constraint violation (osId)".
## Non-destructive: constraint relaxation only, no data touched. Idempotent.
fix-client-db-variant-os:
	@echo "==> 1/2 Backing up database"
	@docker compose exec -T db pg_dump -U cloudmarket -d cloudmarket > backup_variant_os_`date +%F_%H%M`.sql
	@echo "==> 2/2 Making ProductVariant optional columns nullable"
	@docker compose exec -T db psql -U cloudmarket -d cloudmarket -v ON_ERROR_STOP=1 \
		< apps/api/prisma/migrations/202610161800_variant_optional_columns/migration.sql
	@echo ""
	@echo "✓ Done. Restart API to clear caches: make restart-api"

## Incremental seed — adds new objects without wiping existing data.
## Safe to run on a database that already contains production data.
## Run after schema changes or when new seed data is added.
seed-incremental:
	@docker compose exec -T api npx tsx prisma/seed-incremental.ts
	@echo ""
	@echo "✓ Incremental seed completed"
	@echo "  Restart the API to clear caches: make restart-api"
