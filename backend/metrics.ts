/**
 * Prometheus metrics collection for Grafana
 * Exposes metrics in Prometheus text format
 */

import { Request, Response, NextFunction } from 'express';

interface InstancesByStatus {
  online: number;
  active: number;
  offline: number;
  degraded: number;
  idle: number;
  starting: number;
  error: number;
  inactive: number;
}

interface Metrics {
  // Counters
  tunnelConnectionsTotal: number;
  tunnelDisconnectionsTotal: number;
  heartbeatsTotal: number;
  sseConnectionsTotal: number;
  apiRequestsTotal: number;
  
  // Gauges
  activeTunnels: number;
  activeInstances: number;
  activeSseConnections: number;
  instancesByStatus: InstancesByStatus;
  
  // Histograms (simplified - just track values)
  heartbeatResponseTimes: number[];
  apiResponseTimes: number[];
}

interface Instance {
  status?: string;
  tunnel_connected?: boolean;
}

// Metric storage
const metrics: Metrics = {
  // Counters
  tunnelConnectionsTotal: 0,
  tunnelDisconnectionsTotal: 0,
  heartbeatsTotal: 0,
  sseConnectionsTotal: 0,
  apiRequestsTotal: 0,
  
  // Gauges
  activeTunnels: 0,
  activeInstances: 0,
  activeSseConnections: 0,
  instancesByStatus: {
    online: 0,
    active: 0,
    offline: 0,
    degraded: 0,
    idle: 0,
    starting: 0,
    error: 0,
    inactive: 0,
  },
  
  // Histograms (simplified - just track values)
  heartbeatResponseTimes: [],
  apiResponseTimes: [],
};

// Reset histograms periodically to prevent memory growth
setInterval(() => {
  if (metrics.heartbeatResponseTimes.length > 1000) {
    metrics.heartbeatResponseTimes = metrics.heartbeatResponseTimes.slice(-100);
  }
  if (metrics.apiResponseTimes.length > 1000) {
    metrics.apiResponseTimes = metrics.apiResponseTimes.slice(-100);
  }
}, 60000); // Every minute

/**
 * Increment a counter metric
 */
function incrementCounter(metricName: keyof Metrics, value: number = 1): void {
  if (metrics[metricName] !== undefined && typeof metrics[metricName] === 'number') {
    (metrics[metricName] as number) += value;
  }
}

/**
 * Set a gauge metric
 */
function setGauge(metricName: keyof Metrics, value: number): void {
  if (metrics[metricName] !== undefined) {
    metrics[metricName] = value as any;
  }
}

/**
 * Record histogram value
 */
function recordHistogram(metricName: keyof Metrics, value: number): void {
  const metric = metrics[metricName];
  if (metric && Array.isArray(metric)) {
    metric.push(value);
  }
}

/**
 * Update instance status counts
 */
function updateInstanceStatusCounts(instances: Instance[]): void {
  // Reset counts
  Object.keys(metrics.instancesByStatus).forEach((status) => {
    metrics.instancesByStatus[status as keyof InstancesByStatus] = 0;
  });
  
  // Count instances by status
  instances.forEach((instance) => {
    const status = (instance.status || 'inactive') as keyof InstancesByStatus;
    if (metrics.instancesByStatus[status] !== undefined) {
      metrics.instancesByStatus[status]++;
    }
  });
  
  metrics.activeInstances = instances.length;
  metrics.activeTunnels = instances.filter((i) => i.tunnel_connected).length;
}

/**
 * Calculate percentile from histogram
 */
function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}

/**
 * Generate Prometheus metrics in text format
 */
function generatePrometheusMetrics(): string {
  const lines: string[] = [];
  
  // HELP and TYPE definitions
  lines.push('# HELP bore_tunnel_connections_total Total number of tunnel connections');
  lines.push('# TYPE bore_tunnel_connections_total counter');
  lines.push(`bore_tunnel_connections_total ${metrics.tunnelConnectionsTotal}`);
  
  lines.push('# HELP bore_tunnel_disconnections_total Total number of tunnel disconnections');
  lines.push('# TYPE bore_tunnel_disconnections_total counter');
  lines.push(`bore_tunnel_disconnections_total ${metrics.tunnelDisconnectionsTotal}`);
  
  lines.push('# HELP bore_heartbeats_total Total number of heartbeats received');
  lines.push('# TYPE bore_heartbeats_total counter');
  lines.push(`bore_heartbeats_total ${metrics.heartbeatsTotal}`);
  
  lines.push('# HELP bore_sse_connections_total Total number of SSE connections');
  lines.push('# TYPE bore_sse_connections_total counter');
  lines.push(`bore_sse_connections_total ${metrics.sseConnectionsTotal}`);
  
  lines.push('# HELP bore_api_requests_total Total number of API requests');
  lines.push('# TYPE bore_api_requests_total counter');
  lines.push(`bore_api_requests_total ${metrics.apiRequestsTotal}`);
  
  lines.push('# HELP bore_active_tunnels Number of currently active tunnels');
  lines.push('# TYPE bore_active_tunnels gauge');
  lines.push(`bore_active_tunnels ${metrics.activeTunnels}`);
  
  lines.push('# HELP bore_active_instances Number of currently active instances');
  lines.push('# TYPE bore_active_instances gauge');
  lines.push(`bore_active_instances ${metrics.activeInstances}`);
  
  lines.push('# HELP bore_active_sse_connections Number of active SSE connections');
  lines.push('# TYPE bore_active_sse_connections gauge');
  lines.push(`bore_active_sse_connections ${metrics.activeSseConnections}`);
  
  lines.push('# HELP bore_instances_by_status Number of instances by status');
  lines.push('# TYPE bore_instances_by_status gauge');
  Object.entries(metrics.instancesByStatus).forEach(([status, count]) => {
    lines.push(`bore_instances_by_status{status="${status}"} ${count}`);
  });
  
  // Heartbeat response time histogram
  if (metrics.heartbeatResponseTimes.length > 0) {
    lines.push('# HELP bore_heartbeat_response_time_seconds Heartbeat response time');
    lines.push('# TYPE bore_heartbeat_response_time_seconds summary');
    lines.push(`bore_heartbeat_response_time_seconds{quantile="0.5"} ${calculatePercentile(metrics.heartbeatResponseTimes, 50) / 1000}`);
    lines.push(`bore_heartbeat_response_time_seconds{quantile="0.9"} ${calculatePercentile(metrics.heartbeatResponseTimes, 90) / 1000}`);
    lines.push(`bore_heartbeat_response_time_seconds{quantile="0.99"} ${calculatePercentile(metrics.heartbeatResponseTimes, 99) / 1000}`);
    lines.push(`bore_heartbeat_response_time_seconds_sum ${metrics.heartbeatResponseTimes.reduce((a, b) => a + b, 0) / 1000}`);
    lines.push(`bore_heartbeat_response_time_seconds_count ${metrics.heartbeatResponseTimes.length}`);
  }
  
  // API response time histogram
  if (metrics.apiResponseTimes.length > 0) {
    lines.push('# HELP bore_api_response_time_seconds API response time');
    lines.push('# TYPE bore_api_response_time_seconds summary');
    lines.push(`bore_api_response_time_seconds{quantile="0.5"} ${calculatePercentile(metrics.apiResponseTimes, 50) / 1000}`);
    lines.push(`bore_api_response_time_seconds{quantile="0.9"} ${calculatePercentile(metrics.apiResponseTimes, 90) / 1000}`);
    lines.push(`bore_api_response_time_seconds{quantile="0.99"} ${calculatePercentile(metrics.apiResponseTimes, 99) / 1000}`);
    lines.push(`bore_api_response_time_seconds_sum ${metrics.apiResponseTimes.reduce((a, b) => a + b, 0) / 1000}`);
    lines.push(`bore_api_response_time_seconds_count ${metrics.apiResponseTimes.length}`);
  }
  
  return lines.join('\n') + '\n';
}

/**
 * Middleware to track API request metrics
 */
function metricsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    incrementCounter('apiRequestsTotal');
    recordHistogram('apiResponseTimes', duration);
  });
  
  next();
}

export {
  metrics,
  incrementCounter,
  setGauge,
  recordHistogram,
  updateInstanceStatusCounts,
  generatePrometheusMetrics,
  metricsMiddleware,
};
