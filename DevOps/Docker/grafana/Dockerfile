# Bake grafana provisioning for Railway.
# Build context: repository root
FROM grafana/grafana:10.4.0
COPY DevOps/Docker/grafana/datasources.railway.yml /etc/grafana/provisioning/datasources/datasources.yml
COPY DevOps/Docker/grafana/dashboards.yml /etc/grafana/provisioning/dashboards/dashboards.yml
COPY DevOps/Docker/grafana/dashboards /etc/grafana/dashboards
