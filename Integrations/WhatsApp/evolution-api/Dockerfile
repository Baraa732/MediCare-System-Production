# Railway-compatible Evolution API image with MediCare manager shell baked in.
# Build context: repository root
FROM evoapicloud/evolution-api:v2.3.7

# Evolution v2.3.7 bundles baileys 7.0.0-rc.9. WhatsApp now rejects its
# one-to-one messages with protocol error 463 because it lacks tc/cs-token
# support. Pin the upstream-compatible release that contains that support.
RUN npm install baileys@7.0.0-rc13 --no-save --omit=dev \
    && node -e "const v=require('./node_modules/baileys/package.json').version; if(v!=='7.0.0-rc13') throw new Error('Unexpected Baileys '+v)"

COPY Integrations/WhatsApp/evolution-api/manager/index.html /evolution/manager/dist/index.html

# Railway injects PORT and healthchecks that port. Evolution reads SERVER_PORT.
ENV SERVER_PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "export SERVER_PORT=${PORT:-${SERVER_PORT:-8080}}; exec node dist/main"]
