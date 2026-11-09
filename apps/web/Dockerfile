# Base image resolved through the optional corporate mirror (REPO_URL).
# Without REPO_URL the defaults below are used (node:20-alpine from Docker Hub).
ARG REPO_URL=""
ARG IMAGE=node
ARG TAG=20-alpine
ARG FULL_IMAGE=${REPO_URL:+$REPO_URL/}${IMAGE}:${TAG}
FROM ${FULL_IMAGE}

# Declared to match the compose build args so `docker compose build`
# does not warn about unused args (no network operation runs in this build).
ARG HTTP_PROXY=""
ARG HTTPS_PROXY=""
ARG NO_PROXY=""
ARG NODE_TLS_REJECT_UNAUTHORIZED="1"

WORKDIR /app/apps/web
COPY apps/web/dist ./dist
COPY apps/web/server.js .
EXPOSE 5192
CMD ["node", "server.js"]
