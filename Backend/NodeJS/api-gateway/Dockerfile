# Build stage
FROM node:18-alpine AS builder

WORKDIR /build

COPY libs/telemetry ./libs/telemetry
RUN cd libs/telemetry && npm install --omit=dev
COPY api-gateway/package*.json ./api-gateway/
COPY api-gateway/nest-cli.json ./api-gateway/
COPY api-gateway/tsconfig*.json ./api-gateway/

WORKDIR /build/api-gateway
RUN npm install

COPY api-gateway/src ./src
RUN npm run build

# Production stage
FROM node:18-alpine

RUN apk add --no-cache wget

WORKDIR /app

COPY api-gateway/package*.json ./
COPY --from=builder /build/libs/telemetry ./telemetry-pkg
COPY --from=builder /build/api-gateway/node_modules ./node_modules
RUN rm -rf ./node_modules/@medicare/telemetry && cp -a ./telemetry-pkg ./node_modules/@medicare/telemetry
COPY --from=builder /build/api-gateway/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
