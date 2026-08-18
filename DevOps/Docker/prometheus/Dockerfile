# Bake prometheus config for Railway private DNS.
# Build context: repository root
FROM prom/prometheus:v2.51.0
COPY DevOps/Docker/prometheus/prometheus.railway.yml /etc/prometheus/prometheus.yml
COPY DevOps/Docker/prometheus/alerts.yml /etc/prometheus/alerts.yml
CMD ["--config.file=/etc/prometheus/prometheus.yml", "--storage.tsdb.path=/prometheus", "--web.listen-address=0.0.0.0:9090"]
