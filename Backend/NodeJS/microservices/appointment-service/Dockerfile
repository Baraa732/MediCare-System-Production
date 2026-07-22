FROM node:20-alpine AS builder

WORKDIR /build

RUN npm config set fetch-retries 5 && npm config set fetch-retry-mintimeout 20000 && npm config set fetch-retry-maxtimeout 120000
COPY Backend/NodeJS/libs/telemetry ./Backend/NodeJS/libs/telemetry
RUN cd Backend/NodeJS/libs/telemetry && npm install --omit=dev
COPY Backend/NodeJS/microservices/appointment-service/package*.json ./Backend/NodeJS/microservices/appointment-service/
RUN cd Backend/NodeJS/microservices/appointment-service && npm install

COPY Messaging/Kafka/kafka-config ./Messaging/Kafka/kafka-config
COPY Backend/NodeJS/microservices/appointment-service ./Backend/NodeJS/microservices/appointment-service

WORKDIR /build/Backend/NodeJS/microservices/appointment-service
RUN mkdir -p src/kafka-shared/topics && cp -R ../../../../Messaging/Kafka/kafka-config/shared/*.ts src/kafka-shared/
RUN cp ../../../../Messaging/Kafka/kafka-config/topics/topics.config.ts src/kafka-shared/topics/topics.config.ts
RUN npm run build
RUN test -f dist/main.js && test -f dist/appointment/controllers/appointment.controller.js

FROM node:20-alpine AS production

RUN apk add --no-cache wget netcat-openbsd

WORKDIR /usr/src/app

COPY Backend/NodeJS/microservices/appointment-service/package*.json ./
COPY --from=builder /build/Backend/NodeJS/libs/telemetry ./telemetry-pkg
COPY --from=builder /build/Backend/NodeJS/microservices/appointment-service/node_modules ./node_modules
RUN rm -rf ./node_modules/@medicare/telemetry && cp -a ./telemetry-pkg ./node_modules/@medicare/telemetry
COPY --from=builder /build/Backend/NodeJS/microservices/appointment-service/dist ./dist
COPY Messaging/Kafka/scripts/wait-for-kafka-broker.sh /usr/local/bin/wait-for-kafka-broker.sh
RUN chmod +x /usr/local/bin/wait-for-kafka-broker.sh

EXPOSE 3007

HEALTHCHECK --interval=15s --timeout=10s --start-period=90s --retries=8 \
  CMD wget -qO- http://localhost:3007/health/ready || exit 1

ENTRYPOINT ["/usr/local/bin/wait-for-kafka-broker.sh"]
CMD ["node", "dist/main"]
