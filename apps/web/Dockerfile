ARG REPO_URL=""
ARG IMAGE=node
ARG TAG=20-alpine
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

# Build shared types
RUN npm run build -w packages/shared-types

# Build web app — run tsc from project root so node_modules is found
RUN npx tsc -p apps/web/tsconfig.json --noEmit && cd apps/web && npx vite build

WORKDIR /app/apps/web

EXPOSE 80

CMD ["npx", "serve", "dist", "-l", "80"]
