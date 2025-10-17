# Bore Kubernetes Deployment Guide

Complete Kubernetes deployment solution for Bore with production-ready manifests, monitoring, and multi-environment support.

## 🎯 Overview

This Kubernetes deployment provides:

- **Multi-Environment Support**: Development and production configurations
- **High Availability**: Load balancing, auto-scaling, and fault tolerance
- **Observability**: Prometheus metrics, Grafana dashboards, and logging
- **Security**: Network policies, RBAC, and secrets management
- **Backup Automation**: Automated database and Redis backups
- **CI/CD Ready**: GitOps-friendly with Kustomize

## 📁 Directory Structure

```
k8s/
├── base/                           # Base Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── postgres.yaml
│   ├── redis.yaml
│   ├── backend.yaml
│   ├── bore-server.yaml
│   ├── monitoring.yaml
│   ├── ingress.yaml
│   └── kustomization.yaml
├── overlays/                       # Environment-specific configurations
│   ├── development/               # Development environment
│   │   ├── kustomization.yaml
│   │   ├── backend-replica-patch.yaml
│   │   ├── resource-limits-patch.yaml
│   │   └── development-services.yaml
│   └── production/                # Production environment
│       ├── kustomization.yaml
│       ├── backend-replica-patch.yaml
│       ├── resource-limits-patch.yaml
│       ├── security-patch.yaml
│       ├── backup-patch.yaml
│       ├── production-network-policies.yaml
│       └── production-priority-classes.yaml
├── deploy.sh                      # Deployment script
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

1. **Kubernetes Cluster** (v1.20+)
2. **kubectl** configured for cluster access
3. **kustomize** installed
4. **Docker** registry access
5. **Ingress Controller** (nginx recommended)

### 1. Development Deployment

```bash
# Deploy development environment
./k8s/deploy.sh deploy -e development

# Check status
./k8s/deploy.sh status -e development

# View access information
./k8s/deploy.sh access -e development
```

### 2. Production Deployment

```bash
# Deploy production environment
./k8s/deploy.sh deploy -e production --push-images

# Check status
./k8s/deploy.sh status -e production
```

### 3. Cleanup

```bash
# Clean development environment
./k8s/deploy.sh cleanup -e development --force-cleanup

# Clean production (requires confirmation)
./k8s/deploy.sh cleanup -e production
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `development` |
| `NAMESPACE` | Kubernetes namespace | `bore-system` |
| `DOCKER_REGISTRY` | Docker registry URL | `localhost:5000` |
| `VERSION` | Image version | `latest` |
| `SKIP_BUILD` | Skip Docker build | `false` |
| `PUSH_IMAGES` | Push images to registry | `false` |
| `DRY_RUN` | Dry run mode | `false` |
| `DEPLOYMENT_TIMEOUT` | Deployment timeout (seconds) | `300` |

### Secrets Configuration

Update `k8s/base/secret.yaml` with your actual secrets:

```yaml
data:
  JWT_SECRET: your-actual-jwt-secret-base64
  INTERNAL_API_KEY: your-actual-api-key-base64
  DB_PASSWORD: your-actual-db-password-base64
  REDIS_PASSWORD: your-actual-redis-password-base64
  GRAFANA_PASSWORD: your-actual-grafana-password-base64
```

### Generate Base64 Secrets

```bash
# Generate base64 encoded secrets
echo -n "your-jwt-secret" | base64
echo -n "your-api-key" | base64
echo -n "your-db-password" | base64
echo -n "your-redis-password" | base64
echo -n "your-grafana-password" | base64
```

## 🏗️ Architecture

### Components

1. **Backend API** (`bore-backend`)
   - REST API server
   - 2-3 replicas
   - Metrics and health checks

2. **Tunnel Server** (`bore-server`)
   - TCP tunnel server
   - 3-5 replicas with HPA
   - LoadBalancer service

3. **PostgreSQL** (`postgres`)
   - Primary database
   - Persistent storage
   - Automated backups

4. **Redis** (`redis`)
   - Caching and session storage
   - Persistent storage
   - Automated backups

5. **Monitoring Stack**
   - **Prometheus**: Metrics collection
   - **Grafana**: Visualization dashboards
   - **AlertManager**: Alert management

### Resource Allocation

| Component | CPU (requests) | Memory (requests) | CPU (limits) | Memory (limits) |
|-----------|----------------|-------------------|-------------|----------------|
| Backend | 500m | 256Mi | 2000m | 2Gi |
| Bore Server | 200m | 128Mi | 1000m | 1Gi |
| PostgreSQL | 500m | 1Gi | 2000m | 4Gi |
| Redis | 250m | 512Mi | 1000m | 2Gi |
| Prometheus | 1000m | 2Gi | 4000m | 8Gi |
| Grafana | 250m | 512Mi | 1000m | 2Gi |

## 🔧 Customization

### Adding New Environments

1. Create new overlay directory:
```bash
mkdir k8s/overlays/staging
```

2. Create `kustomization.yaml`:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

namespace: bore-staging

patchesStrategicMerge:
  - staging-config.yaml
```

3. Add environment-specific patches

### Scaling Applications

Modify replica counts in environment overlays:

**Development** (`k8s/overlays/development/kustomization.yaml`):
```yaml
replicas:
  - name: bore-backend
    count: 1
  - name: bore-server
    count: 1
```

**Production** (`k8s/overlays/production/kustomization.yaml`):
```yaml
replicas:
  - name: bore-backend
    count: 3
  - name: bore-server
    count: 5
```

### Customizing Resources

Update resource limits in patch files:

```yaml
# k8s/overlays/production/resource-limits-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bore-backend
spec:
  template:
    spec:
      containers:
      - name: backend
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
```

## 🔒 Security

### Network Policies

Production environment includes comprehensive network policies:

- **Default Deny**: All traffic blocked by default
- **Internal Communication**: Allow intra-namespace traffic
- **External Access**: Allow specific ingress patterns
- **Egress Rules**: Allow DNS, HTTPS, and external dependencies

### RBAC

Service accounts and roles configured for:

- **Prometheus**: Cluster-wide metrics collection
- **Grafana**: Dashboard management
- **Applications**: Minimal required permissions

### Pod Security

- Non-root containers
- Read-only filesystems where possible
- Security contexts enforced
- Resource limits enforced

## 📊 Monitoring

### Prometheus Metrics

Access Prometheus at:
- **Development**: LoadBalancer IP
- **Production**: Ingress hostname

### Grafana Dashboards

Pre-configured dashboards include:
- **Bore Overview**: System health and tunnel statistics
- **Performance**: Response times and throughput
- **Infrastructure**: Resource utilization

Access Grafana with credentials from secrets.

### Alerts

Configured alerts for:
- Service downtime
- High error rates
- Resource exhaustion
- Performance degradation

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3

      - name: Deploy to production
        run: |
          ./k8s/deploy.sh deploy -e production --push-images
        env:
          DOCKER_REGISTRY: ${{ secrets.DOCKER_REGISTRY }}
          VERSION: ${{ github.sha }}
```

### GitOps with ArgoCD

```yaml
# argocd-application.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: bore-production
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/bore
    targetRevision: main
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: bore-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

## 🛠️ Troubleshooting

### Common Issues

#### **Pods Not Starting**

```bash
# Check pod status
kubectl get pods -n bore-system

# Describe pod
kubectl describe pod <pod-name> -n bore-system

# Check logs
kubectl logs <pod-name> -n bore-system -f
```

#### **Service Not Accessible**

```bash
# Check service endpoints
kubectl get endpoints -n bore-system

# Check service configuration
kubectl describe service <service-name> -n bore-system

# Port-forward for debugging
kubectl port-forward service/<service-name> <local-port>:<service-port> -n bore-system
```

#### **Persistent Volume Issues**

```bash
# Check PVC status
kubectl get pvc -n bore-system

# Check PV status
kubectl get pv

# Describe PVC
kubectl describe pvc <pvc-name> -n bore-system
```

#### **Ingress Not Working**

```bash
# Check ingress status
kubectl get ingress -n bore-system

# Describe ingress
kubectl describe ingress <ingress-name> -n bore-system

# Check ingress controller logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller
```

### Debug Commands

```bash
# Get all resources
kubectl get all -n bore-system

# Check events
kubectl get events -n bore-system --sort-by=.metadata.creationTimestamp

# Exec into container
kubectl exec -it deployment/bore-backend -n bore-system -- /bin/bash

# Check resource usage
kubectl top pods -n bore-system
```

## 📚 Advanced Configuration

### Horizontal Pod Autoscaling

Production includes HPA for bore-server:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bore-server-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bore-server
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Database Optimization

PostgreSQL configuration for production:

```yaml
env:
- name: POSTGRES_SHARED_PRELOAD_LIBRARIES
  value: "pg_stat_statements"
- name: POSTGRES_MAX_CONNECTIONS
  value: "200"
- name: POSTGRES_SHARED_BUFFERS
  value: "256MB"
- name: POSTGRES_EFFECTIVE_CACHE_SIZE
  value: "1GB"
```

### Redis Configuration

Redis optimization for production:

```yaml
env:
- name: REDIS_MAXMEMORY
  value: "1gb"
- name: REDIS_MAXMEMORY_POLICY
  value: "allkeys-lru"
- name: REDIS_SAVE_INTERVAL
  value: "900 1 300 10 60 10000"
```

## 📋 Maintenance

### Rolling Updates

```bash
# Update image version
./k8s/deploy.sh deploy -e production -v v0.6.1

# Monitor rollout
kubectl rollout status deployment/bore-backend -n bore-prod

# Check rollout history
kubectl rollout history deployment/bore-backend -n bore-prod

# Rollback if needed
kubectl rollout undo deployment/bore-backend -n bore-prod
```

### Backup Management

```bash
# Manual backup trigger
kubectl create job --from=cronjob/postgres-backup manual-backup -n bore-prod

# Check backup status
kubectl get jobs -n bore-prod

# Restore from backup (manual process)
kubectl exec -it deployment/postgres -n bore-prod -- psql -U postgres -d bore_db < backup.sql
```

### Monitoring Maintenance

```bash
# Scale monitoring stack
kubectl scale deployment prometheus --replicas=2 -n bore-prod

# Restart monitoring
kubectl rollout restart deployment/grafana -n bore-prod

# Check metrics targets
kubectl port-forward service/prometheus-service 9090:9090 -n bore-prod
# Access http://localhost:9090/targets
```

---

## 📞 Support

For Kubernetes deployment issues:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Review pod logs and events
3. Consult the main [README.md](README.md)
4. Open an issue on GitHub with k8s details

Happy containerizing! 🚀✨