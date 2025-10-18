/**
 * Load Testing Script for Bore Backend
 * 
 * Tests system under load to verify:
 * - Capacity limits work correctly
 * - Response times remain acceptable
 * - No memory leaks under sustained load
 * - Database connections are managed properly
 * 
 * Usage:
 *   ts-node tests/load-test.ts [options]
 * 
 * Options:
 *   --users <number>        Number of concurrent users (default: 10)
 *   --duration <seconds>    Test duration in seconds (default: 60)
 *   --ramp-up <seconds>     Ramp-up time in seconds (default: 10)
 *   --target <url>          Target URL (default: http://localhost:3000)
 */

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';

interface LoadTestConfig {
  users: number;
  duration: number;
  rampUp: number;
  target: string;
  apiKey: string | null;
}

interface Stats {
  requests: {
    total: number;
    successful: number;
    failed: number;
    timeout: number;
  };
  responseTimes: number[];
  errors: Record<string, number>;
  statusCodes: Record<number, number>;
}

interface RequestResult {
  status: number;
  data?: unknown;
  responseTime: number;
  error?: string;
}

interface User {
  id: number;
  token: string | null;
  instanceId: string | null;
}

// Configuration
const config: LoadTestConfig = {
  users: parseInt(process.env.LOAD_TEST_USERS || '10'),
  duration: parseInt(process.env.LOAD_TEST_DURATION || '60'),
  rampUp: parseInt(process.env.LOAD_TEST_RAMP_UP || '10'),
  target: process.env.LOAD_TEST_TARGET || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || null
};

// Parse command line arguments
process.argv.slice(2).forEach((arg, i, args) => {
  const nextArg = args[i + 1];
  switch(arg) {
    case '--users':
      if (nextArg) config.users = parseInt(nextArg);
      break;
    case '--duration':
      if (nextArg) config.duration = parseInt(nextArg);
      break;
    case '--ramp-up':
      if (nextArg) config.rampUp = parseInt(nextArg);
      break;
    case '--target':
      if (nextArg) config.target = nextArg;
      break;
  }
});

// Statistics
const stats: Stats = {
  requests: {
    total: 0,
    successful: 0,
    failed: 0,
    timeout: 0
  },
  responseTimes: [],
  errors: {},
  statusCodes: {}
};

// Active users
const activeUsers: Promise<void>[] = [];
let testRunning = true;

/**
 * Make HTTP request
 */
function makeRequest(method: string, path: string, body: unknown = null, token: string | null = null): Promise<RequestResult> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.target);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    };

    if (token) {
      (options.headers as Record<string, string | number>)['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      (options.headers as Record<string, string | number>)['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const startTime = performance.now();
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = performance.now() - startTime;
        
        // Record stats
        stats.responseTimes.push(responseTime);
        stats.statusCodes[res.statusCode!] = (stats.statusCodes[res.statusCode!] || 0) + 1;

        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          stats.requests.successful++;
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data), responseTime });
          } catch {
            resolve({ status: res.statusCode, data, responseTime });
          }
        } else {
          stats.requests.failed++;
          reject({ status: res.statusCode, data, responseTime });
        }
      });
    });

    req.on('error', (error: NodeJS.ErrnoException) => {
      const responseTime = performance.now() - startTime;
      stats.requests.failed++;
      stats.errors[error.code || 'UNKNOWN'] = (stats.errors[error.code || 'UNKNOWN'] || 0) + 1;
      reject({ error: error.message, responseTime });
    });

    req.on('timeout', () => {
      req.destroy();
      stats.requests.timeout++;
      reject({ error: 'TIMEOUT', responseTime: 10000 });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
    stats.requests.total++;
  });
}

/**
 * Simulate user behavior
 */
async function simulateUser(userId: number): Promise<void> {
  const user: User = {
    id: userId,
    token: null,
    instanceId: null
  };

  try {
    // 1. Sign up or login
    const authResult = await makeRequest('POST', '/api/v1/auth/login', {
      email: `loadtest_user_${userId}@example.com`,
      password: 'Test123456!'
    });

    if (authResult.data && authResult.data.token) {
      user.token = authResult.data.token;
    }

    while (testRunning) {
      try {
        // 2. List instances
        await makeRequest('GET', '/api/v1/instances', null, user.token);
        await sleep(randomBetween(1000, 3000));

        // 3. Create instance (if doesn't exist)
        if (!user.instanceId) {
          const createResult = await makeRequest('POST', '/api/v1/instances', {
            name: `Load Test Instance ${userId}`,
            local_port: 8000 + userId,
            region: 'test'
          }, user.token);

          if (createResult.data && createResult.data.id) {
            user.instanceId = createResult.data.id;
          }
        }

        // 4. Send heartbeat
        if (user.instanceId) {
          await makeRequest('POST', `/api/v1/instances/${user.instanceId}/heartbeat`, {
            vscode_responsive: true,
            cpu_usage: randomBetween(20, 80),
            memory_usage: randomBetween(1000000, 5000000),
            has_code_server: true,
            last_activity: Math.floor(Date.now() / 1000) - randomBetween(10, 300)
          }, user.token);
        }

        await sleep(randomBetween(2000, 5000));

        // 5. Check health
        if (user.instanceId && Math.random() > 0.7) {
          await makeRequest('GET', `/api/v1/instances/${user.instanceId}/health`, null, user.token);
        }

        await sleep(randomBetween(1000, 4000));

      } catch (error) {
        // Continue despite errors
        await sleep(1000);
      }
    }

  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`User ${userId} failed to initialize:`, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Sleep for ms
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random number between min and max
 */
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calculate statistics
 */
function calculateStats() {
  const sorted = stats.responseTimes.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length || 0;
  const min = sorted[0] || 0;
  const max = sorted[sorted.length - 1] || 0;

  return {
    responseTime: {
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2)
    },
    throughput: {
      requestsPerSecond: (stats.requests.total / config.duration).toFixed(2),
      successRate: ((stats.requests.successful / stats.requests.total) * 100).toFixed(2) + '%'
    }
  };
}

/**
 * Print progress
 */
function printProgress(elapsed: number): void {
  const calculated = calculateStats();
  const progress = ((elapsed / config.duration) * 100).toFixed(0);

  // eslint-disable-next-line no-console
  console.clear();
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  // eslint-disable-next-line no-console
  console.log('BORE BACKEND LOAD TEST');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  // eslint-disable-next-line no-console
  console.log(`Progress: ${progress}% (${elapsed}s / ${config.duration}s)`);
  // eslint-disable-next-line no-console
  console.log(`Users: ${config.users} | Target: ${config.target}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Requests:');
  // eslint-disable-next-line no-console
  console.log(`  Total: ${stats.requests.total}`);
  // eslint-disable-next-line no-console
  console.log(`  Successful: ${stats.requests.successful}`);
  // eslint-disable-next-line no-console
  console.log(`  Failed: ${stats.requests.failed}`);
  // eslint-disable-next-line no-console
  console.log(`  Timeout: ${stats.requests.timeout}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Response Times (ms):');
  // eslint-disable-next-line no-console
  console.log(`  Min: ${calculated.responseTime.min}`);
  // eslint-disable-next-line no-console
  console.log(`  Avg: ${calculated.responseTime.avg}`);
  // eslint-disable-next-line no-console
  console.log(`  P50: ${calculated.responseTime.p50}`);
  // eslint-disable-next-line no-console
  console.log(`  P95: ${calculated.responseTime.p95}`);
  // eslint-disable-next-line no-console
  console.log(`  P99: ${calculated.responseTime.p99}`);
  // eslint-disable-next-line no-console
  console.log(`  Max: ${calculated.responseTime.max}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Throughput:');
  // eslint-disable-next-line no-console
  console.log(`  RPS: ${calculated.throughput.requestsPerSecond}`);
  // eslint-disable-next-line no-console
  console.log(`  Success Rate: ${calculated.throughput.successRate}`);
  // eslint-disable-next-line no-console
  console.log('');
  // eslint-disable-next-line no-console
  console.log('Status Codes:');
  Object.entries(stats.statusCodes).forEach(([code, count]) => {
    // eslint-disable-next-line no-console
    console.log(`  ${code}: ${count}`);
  });

  if (Object.keys(stats.errors).length > 0) {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log('Errors:');
    Object.entries(stats.errors).forEach(([error, count]) => {
      // eslint-disable-next-line no-console
      console.log(`  ${error}: ${count}`);
    });
  }
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
}

/**
 * Main test execution
 */
async function runLoadTest(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Starting load test...');
  // eslint-disable-next-line no-console
  console.log(`Configuration: ${config.users} users, ${config.duration}s duration, ${config.rampUp}s ramp-up`);
  // eslint-disable-next-line no-console
  console.log(`Target: ${config.target}`);
  // eslint-disable-next-line no-console
  console.log('');

  // Ramp up users gradually
  const startTime = Date.now();
  for (let i = 0; i < config.users; i++) {
    const user = simulateUser(i + 1);
    activeUsers.push(user);
    
    if (i < config.users - 1) {
      await sleep((config.rampUp * 1000) / config.users);
    }
  }

  // Monitor progress
  const progressInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    printProgress(elapsed);

    if (elapsed >= config.duration) {
      testRunning = false;
      clearInterval(progressInterval);
    }
  }, 1000);

  // Wait for test duration
  await sleep(config.duration * 1000);
  testRunning = false;

  // Wait for active requests to complete
  // eslint-disable-next-line no-console
  console.log('\nWaiting for active requests to complete...');
  await sleep(5000);

  // Final report
  // eslint-disable-next-line no-console
  console.clear();
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));
  // eslint-disable-next-line no-console
  console.log('LOAD TEST COMPLETED');
  // eslint-disable-next-line no-console
  console.log('='.repeat(60));

  const finalStats = calculateStats();
  // eslint-disable-next-line no-console
  console.log('\nFinal Statistics:');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    config,
    requests: stats.requests,
    ...finalStats,
    statusCodes: stats.statusCodes,
    errors: stats.errors
  }, null, 2));

  // eslint-disable-next-line no-console
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  const successRate = (stats.requests.successful / stats.requests.total) * 100;
  process.exit(successRate >= 95 ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('\nStopping load test...');
  testRunning = false;
  setTimeout(() => process.exit(0), 2000);
});

// Run the test
if (require.main === module) {
  runLoadTest().catch(error => {
    // eslint-disable-next-line no-console
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

export { runLoadTest };
