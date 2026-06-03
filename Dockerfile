# Stage 1: compile TypeScript
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.mcp.json ./
RUN npm ci
COPY src/mcp.ts ./src/
RUN npx tsc --project tsconfig.mcp.json || true

# Stage 2: production image (plain node, no ts-node)
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist-mcp ./dist-mcp
EXPOSE 8080
CMD ["node", "dist-mcp/mcp.js"]
