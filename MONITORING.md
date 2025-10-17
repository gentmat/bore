# Bore Monitoring & Observability

Complete monitoring solution for Bore with Prometheus and Grafana dashboards.

## 🎯 Overview

Bore includes a comprehensive monitoring stack that provides real-time insights into:

- **System Performance**: API response times, throughput, and error rates
- **Tunnel Statistics**: Active connections, connection lifecycle, and health status
- **Instance Management**: Status distribution, capacity utilization, and availability
- **Resource Metrics**: Memory usage, CPU consumption, and network activity

## 📊 Monitoring Components

### 1. **Prometheus Metrics**
- **Location**: `backend/metrics.ts`
- **Endpoint**: `http://localhost:3000/metrics`
- **Scrape Interval**: 15 seconds

#### Available Metrics

| Metric Name | Type | Description |
|-------------|------|-------------|
| `bore_tunnel_connections_total` | Counter | Total tunnel connections established |
| `bore_tunnel_disconnections_total` | Counter | Total tunnel disconnections |
| `bore_heartbeats_total` | Counter | Total heartbeats received |
| `bore_api_requests_total` | Counter | Total API requests processed |
| `bore_sse_connections_total` | Counter | Total SSE connections |
| `bore_active_tunnels` | Gauge | Currently active tunnels |
| `bore_active_instances` | Gauge | Currently active instances |
| `bore_active_sse_connections` | Gauge | Active SSE connections |
| `bore_instances_by_status` | Gauge | Instance count by status (online, offline, etc.) |
| `bore_api_response_time_seconds` | Histogram | API response time percentiles |
| `bore_heartbeat_response_time_seconds` | Histogram | Heartbeat response time percentiles |

### 2. **Grafana Dashboards**

#### 📈 **Bore Overview Dashboard**
- **UID**: `bore-overview`
- **Purpose**: High-level system overview
- **Panels**:
  - Instance status distribution (pie chart)
  - Active instances counter
  - Tunnels & connections timeline
  - Request rate trends

#### ⚡ **Bore Performance Dashboard**
- **UID**: `bore-performance`
- **Purpose**: Performance monitoring and optimization
- **Panels**:
  - API response time percentiles (P50, P90, P99)
  - Heartbeat response time percentiles
  - P95 response time indicators
  - Performance thresholds and alerts

#### 🔧 **Bore System Dashboard**
- **UID**: `bore-system`
- **Purpose**: System health and capacity monitoring
- **Panels**:
  - Current connections counter
  - Total connections/all-time metrics
  - Connection activity trends
  - Instance health distribution

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
cd backend
./scripts/setup-monitoring.sh
```

This script:
- ✅ Creates necessary directories
- ✅ Configures Prometheus and Grafana
- ✅ Starts monitoring services
- ✅ Validates service health
- ✅ Displays access credentials

### Option 2: Manual Setup

```bash
# 1. Set up environment
cd backend
cp .env.example .env
echo "COMPOSE_PROFILES=monitoring" >> .env

# 2. Start monitoring stack
docker-compose --profile monitoring up -d

# 3. Verify services
curl http://localhost:3000/health
curl http://localhost:9090/-/healthy
curl http://localhost:3001/api/health
```

## 🔗 Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Bore Backend** | http://localhost:3000 | - |
| **Prometheus** | http://localhost:9090 | - |
| **Grafana** | http://localhost:3001 | admin / `${GRAFANA_PASSWORD}` |
| **API Docs** | http://localhost:3000/docs | - |

## 📊 Grafana Dashboard Navigation

1. **Login to Grafana**: http://localhost:3001
   - Username: `admin`
   - Password: Set in `.env` (`GRAFANA_PASSWORD`)

2. **Navigate to Dashboards**:
   - Click "Dashboards" in the left menu
   - Select from available Bore dashboards

3. **Key Features**:
   - **Real-time Updates**: Dashboards refresh every 15 seconds
   - **Interactive Charts**: Click and drag to zoom into time ranges
   - **Export Options**: Export panels as images or data as JSON
   - **Alerting**: Configure alerts based on threshold conditions

## 🔧 Configuration

### Environment Variables

```bash
# Monitoring Stack
COMPOSE_PROFILES=monitoring          # Enable monitoring services
GRAFANA_PASSWORD=admin123           # Grafana admin password

# Backend Metrics
METRICS_ENABLED=true                # Enable metrics collection
METRICS_PATH=/metrics              # Metrics endpoint path
```

### Prometheus Configuration

Configuration file: `backend/prometheus.yml`

```yaml
global:
  scrape_interval: 15s              # How often to scrape targets
  evaluation_interval: 15s          # How often to evaluate rules

scrape_configs:
  - job_name: 'bore-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Grafana Provisioning

- **Datasources**: `backend/grafana/provisioning/datasources/prometheus.yml`
- **Dashboards**: `backend/grafana/provisioning/dashboards/dashboard.yml`
- **Dashboard JSON**: `backend/grafana/dashboards/`

## 📈 Custom Metrics

### Adding New Metrics

1. **Update metrics.ts**:
```typescript
// Add new metric to Metrics interface
interface Metrics {
  newCustomMetric: number;
  // ... existing metrics
}

// Add increment function
function incrementCustomMetric(value: number = 1): void {
  metrics.newCustomMetric += value;
}

// Add to Prometheus output
function generatePrometheusMetrics(): string {
  // ... existing metrics
  lines.push(`bore_custom_metric ${metrics.newCustomMetric}`);
  return lines.join('\n') + '\n';
}
```

2. **Use in Application**:
```typescript
import { incrementCustomMetric } from './metrics';

// Track custom events
incrementCustomMetric();
```

3. **Update Grafana Dashboard**:
   - Add new panel using the metric `bore_custom_metric`
   - Export updated dashboard JSON

## 🚨 Alerting

### Setting Up Alerts

1. **Create Alert Rules** (optional):
```yaml
# prometheus-rules.yml
groups:
  - name: bore-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(bore_api_requests_total{status=~"5.."}[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
```

2. **Configure Alertmanager**:
```yaml
# alertmanager.yml
route:
  receiver: 'web.hook'
receivers:
  - name: 'web.hook'
    webhook_configs:
      - url: 'http://your-webhook-url'
```

### Alert Conditions

| Alert | Condition | Threshold | Duration |
|-------|-----------|-----------|----------|
| High Response Time | `bore_api_response_time_seconds{quantile="0.95"}` | > 500ms | 5 min |
| Connection Failures | `rate(bore_tunnel_disconnections_total[5m])` | > 10/min | 2 min |
| No Heartbeats | `increase(bore_heartbeats_total[5m])` | = 0 | 1 min |
| High Memory Usage | `process_resident_memory_bytes` | > 1GB | 5 min |

## 🔍 Troubleshooting

### Common Issues

#### **Metrics Not Appearing**
```bash
# Check if metrics endpoint is accessible
curl http://localhost:3000/metrics

# Verify Prometheus configuration
docker-compose logs prometheus

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets
```

#### **Grafana Dashboards Missing**
```bash
# Check Grafana provisioning logs
docker-compose logs grafana

# Verify dashboard files exist
ls -la grafana/dashboards/

# Restart Grafana to reload dashboards
docker-compose restart grafana
```

#### **Services Not Starting**
```bash
# Check Docker Compose configuration
docker-compose config

# View service logs
docker-compose logs -f

# Check port conflicts
netstat -tulpn | grep -E ':(3000|3001|9090)'
```

### Health Checks

```bash
# Backend health
curl -f http://localhost:3000/health || echo "Backend unhealthy"

# Prometheus health
curl -f http://localhost:9090/-/healthy || echo "Prometheus unhealthy"

# Grafana health
curl -f http://localhost:3001/api/health || echo "Grafana unhealthy"

# Metrics availability
curl -f http://localhost:3000/metrics | head -20 || echo "Metrics unavailable"
```

## 📚 Advanced Usage

### Custom Grafana Panels

Create custom visualizations using PromQL queries:

```promql
# Connection success rate
rate(bore_tunnel_connections_total[5m]) /
(rate(bore_tunnel_connections_total[5m]) + rate(bore_tunnel_disconnections_total[5m])) * 100

# Average response time over time
rate(bore_api_response_time_seconds_sum[5m]) /
rate(bore_api_response_time_seconds_count[5m])

# Instance availability
sum(bore_instances_by_status{status=~"online|active"}) /
sum(bore_instances_by_status) * 100
```

### Performance Optimization

1. **Reduce Scrape Interval** for high-frequency metrics
2. **Use Recording Rules** for complex queries
3. **Implement Metric Retention Policies**
4. **Configure Remote Storage** for long-term data

### Integration with External Tools

- **Alertmanager**: Route alerts to Slack, PagerDuty, etc.
- **Prometheus exporters**: Add system metrics (node_exporter, redis_exporter)
- **Log aggregation**: Integrate with ELK stack or Loki
- **APM tools**: Add distributed tracing with Jaeger or Zipkin

## 🔄 Maintenance

### Regular Tasks

```bash
# Update monitoring stack
docker-compose pull prometheus grafana
docker-compose up -d

# Backup Grafana dashboards
docker exec bore-grafana grafana-cli admin export-dashboard --output=backup.json

# Clean up old metrics (adjust retention)
# Add to prometheus.yml: --storage.tsdb.retention.time=30d

# Monitor disk usage
docker exec bore-prometheus du -sh /prometheus
```

### Security Considerations

- Change default passwords in production
- Use HTTPS for all services
- Implement authentication for Prometheus
- Restrict network access with firewall rules
- Regular security updates for Docker images

---

## 📞 Support

For monitoring-related issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review service logs: `docker-compose logs -f`
3. Consult the main [README.md](README.md) for general support
4. Open an issue on GitHub with monitoring details

Happy monitoring! 📊✨