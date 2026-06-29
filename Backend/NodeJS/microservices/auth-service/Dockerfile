FROM node:20-alpine AS builder

WORKDIR /build

COPY Backend/NodeJS/libs/telemetry ./Backend/NodeJS/libs/telemetry
RUN cd Backend/NodeJS/libs/telemetry && npm install --omit=dev
COPY Backend/NodeJS/microservices/auth-service/package*.json ./Backend/NodeJS/microservices/auth-service/
RUN cd Backend/NodeJS/microservices/auth-service && npm install

COPY Messaging/Kafka/kafka-config ./Messaging/Kafka/kafka-config
COPY Integrations/WhatsApp/client ./Integrations/WhatsApp/client
COPY Backend/NodeJS/microservices/auth-service ./Backend/NodeJS/microservices/auth-service

WORKDIR /build/Backend/NodeJS/microservices/auth-service
RUN cp ../../../../Integrations/WhatsApp/client/whatsapp.service.ts src/auth/services/whatsapp.service.ts
RUN mkdir -p src/kafka-shared && cp -R ../../../../Messaging/Kafka/kafka-config/shared/*.ts src/kafka-shared/
RUN npm run build
RUN test -f dist/main.js && test -f dist/kafka-shared/kafka-client.module.js

FROM node:20-alpine AS production

RUN apk add --no-cache wget netcat-openbsd

WORKDIR /usr/src/app

COPY Backend/NodeJS/microservices/auth-service/package*.json ./
COPY --from=builder /build/Backend/NodeJS/libs/telemetry ./telemetry-pkg
COPY --from=builder /build/Backend/NodeJS/microservices/auth-service/node_modules ./node_modules
RUN rm -rf ./node_modules/@medicare/telemetry && cp -a ./telemetry-pkg ./node_modules/@medicare/telemetry
COPY --from=builder /build/Backend/NodeJS/microservices/auth-service/dist ./dist
COPY Messaging/Kafka/scripts/wait-for-kafka-broker.sh /usr/local/bin/wait-for-kafka-broker.sh
RUN chmod +x /usr/local/bin/wait-for-kafka-broker.sh

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=8 \
  CMD wget -qO- http://localhost:3001/health/ready || exit 1

ENTRYPOINT ["/usr/local/bin/wait-for-kafka-broker.sh"]
CMD ["node", "dist/main"]
