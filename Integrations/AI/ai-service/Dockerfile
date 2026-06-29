FROM node:20-alpine AS builder

WORKDIR /build

COPY Integrations/AI/ai-service/package*.json ./Integrations/AI/ai-service/
RUN cd Integrations/AI/ai-service && npm install

COPY Integrations/AI/prompts ./Integrations/AI/prompts
COPY Integrations/AI/ai-service ./Integrations/AI/ai-service

WORKDIR /build/Integrations/AI/ai-service
RUN npm run build
RUN test -f dist/main.js

FROM node:20-alpine AS production

RUN apk add --no-cache wget

WORKDIR /usr/src/app

COPY Integrations/AI/ai-service/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /build/Integrations/AI/ai-service/dist ./dist
COPY Integrations/AI/prompts ./prompts

EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=8 \
  CMD wget -qO- http://localhost:3005/health/ready || exit 1

CMD ["node", "dist/main"]
