ARG REPO_URL=""
ARG IMAGE=node
ARG TAG=20-bookworm
ARG FULL_IMAGE=${REPO_URL:+$REPO_URL/}${IMAGE}:${TAG}
FROM ${FULL_IMAGE} AS base

# Optional proxy configuration
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY=""
ARG NODE_TLS_REJECT_UNAUTHORIZED="1"

ENV HTTP_PROXY=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV NODE_TLS_REJECT_UNAUTHORIZED=${NODE_TLS_REJECT_UNAUTHORIZED}

# Configure npm proxy if set
RUN if [ -n "$HTTP_PROXY" ]; then npm config set proxy "$HTTP_PROXY"; fi
RUN if [ -n "$HTTPS_PROXY" ]; then npm config set https-proxy "$HTTPS_PROXY"; fi
RUN if [ "$NODE_TLS_REJECT_UNAUTHORIZED" = "0" ]; then npm config set strict-ssl false; fi

WORKDIR /app

# Copy full project including node_modules (installed on host before build)
COPY . .

# Rebuild native deps for container architecture
RUN npm rebuild esbuild

# Build shared types
RUN npm run build -w packages/shared-types

WORKDIR /app/apps/api

# Prisma offline/air-gap: point to pre-downloaded engine binaries.
# The binaries are copied at /app/lib/prisma via COPY . .
# We auto-detect container architecture to pick the correct engine.
ARG TARGETARCH
ENV PRISMA_GENERATE_SKIP_AUTOINSTALL=1
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN if [ "$TARGETARCH" = "arm64" ]; then \
      export PRISMA_CLI_BINARY_TARGETS="linux-arm64-openssl-3.0.x" && \
      export PRISMA_QUERY_ENGINE_LIBRARY="/app/lib/prisma/libquery_engine-linux-arm64-openssl-3.0.x.so.node" && \
      export PRISMA_SCHEMA_ENGINE_BINARY="/app/lib/prisma/schema-engine-linux-arm64-openssl-3.0.x"; \
    else \
      export PRISMA_CLI_BINARY_TARGETS="debian-openssl-3.0.x" && \
      export PRISMA_QUERY_ENGINE_LIBRARY="/app/lib/prisma/libquery_engine-debian-openssl-3.0.x.so.node" && \
      export PRISMA_SCHEMA_ENGINE_BINARY="/app/lib/prisma/schema-engine-debian-openssl-3.0.x"; \
    fi && \
    npx prisma generate

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/index.ts"]
