# Bake otel-collector config (no host bind mounts on Railway).
# Build context: repository root
FROM otel/opentelemetry-collector-contrib:0.96.0
COPY DevOps/Docker/otel/otel-collector-config.railway.yml /etc/otel-collector-config.yml
CMD ["--config=/etc/otel-collector-config.yml"]
