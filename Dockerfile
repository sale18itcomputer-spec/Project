FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm install ts-node typescript

COPY tsconfig.json ./
COPY src/mcp.ts ./src/

EXPOSE 8080
ENV PORT=8080

CMD ["npx", "ts-node", "--transpile-only", "src/mcp.ts"]
