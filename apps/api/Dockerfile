ARG BASE_IMAGE=node:20-bookworm
FROM ${BASE_IMAGE} AS base

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

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm install

# Copy source
COPY . .

# Use pre-generated Prisma client from host when available (e.g., behind
# corporate proxy), otherwise generate inside the container.
RUN if [ ! -d node_modules/.prisma/client ] || [ -n "$FORCE_PRISMA_REGENERATE" ]; then \
      rm -rf node_modules/.prisma node_modules/@prisma/client && \
      npx prisma generate --schema=apps/api/prisma/schema.prisma; \
    else \
      echo "Using pre-generated Prisma client from host"; \
    fi

# Build shared types
RUN npm run build -w packages/shared-types

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/index.ts"]
