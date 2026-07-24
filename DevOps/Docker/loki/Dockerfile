# Bake loki config (no host bind mounts on Railway).
# Build context: repository root
FROM grafana/loki:2.9.6
COPY DevOps/Docker/loki/loki-config.yml /etc/loki/local-config.yaml
CMD ["-config.file=/etc/loki/local-config.yaml"]
