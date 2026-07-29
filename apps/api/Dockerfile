FROM node:20-bullseye AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm install

# Copy source
COPY . .

# Force clean Prisma generation (avoid cached engines from different base images)
RUN rm -rf node_modules/.prisma node_modules/@prisma/client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build shared types
RUN npm run build -w packages/shared-types

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["npx", "tsx", "watch", "src/index.ts"]
