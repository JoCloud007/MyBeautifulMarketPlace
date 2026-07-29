FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/shared-types/package*.json ./packages/shared-types/

RUN npm install

# Copy source
COPY . .

# Build shared types
RUN npm run build -w packages/shared-types

WORKDIR /app/apps/web

EXPOSE 5173

CMD ["npm", "run", "dev"]
