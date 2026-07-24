# Multi-stage build: Vite SPA + nginx reverse proxy to api-gateway
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-fund --no-audit

COPY . .

ARG VITE_API_BASE_URL
# Required for Railway: public HTTPS URL of api-gateway (e.g. https://api-gateway-xxx.up.railway.app)
# Do NOT use /api — there is no Docker-internal nginx proxy on Railway.
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN test -n "$VITE_API_BASE_URL" || (echo "VITE_API_BASE_URL build-arg is required" && exit 1)
RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
