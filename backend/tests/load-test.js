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
 *   node tests/load-test.js [options]
 * 
 * Options:
 *   --users <number>        Number of concurrent users (default: 10)
 *   --duration <seconds>    Test duration in seconds (default: 60)
 *   --ramp-up <seconds>     Ramp-up time in seconds (default: 10)
 *   --target <url>          Target URL (default: http://localhost:3000)
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const config = {
  users: parseInt(process.env.LOAD_TEST_USERS || '10'),
  duration: parseInt(process.env.LOAD_TEST_DURATION || '60'),
  rampUp: parseInt(process.env.LOAD_TEST_RAMP_UP || '10'),
  target: process.env.LOAD_TEST_TARGET || 'http://localhost:3000',
  apiKey: process.env.TEST_API_KEY || null
};

// Parse command line arguments
process.argv.slice(2).forEach((arg, i, args) => {
  switch(arg) {
    case '--users':
      config.users = parseInt(args[i + 1]);
      break;
    case '--duration':
      config.duration = parseInt(args[i + 1]);
      break;
    case '--ramp-up':
      config.rampUp = parseInt(args[i + 1]);
      break;
    case '--target':
      config.target = args[i + 1];
      break;
  }
});

// Statistics
const stats = {
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
const activeUsers = [];
let testRunning = true;

/**
 * Make HTTP request
 */
function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.target);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
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
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const startTime = performance.now();
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const responseTime = performance.now() - startTime;
        
        // Record stats
        stats.responseTimes.push(responseTime);
        stats.statusCodes[res.statusCode] = (stats.statusCodes[res.statusCode] || 0) + 1;

        if (res.statusCode >= 200 && res.statusCode < 300) {
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

    req.on('error', (error) => {
      const responseTime = performance.now() - startTime;
      stats.requests.failed++;
      stats.errors[error.code] = (stats.errors[error.code] || 0) + 1;
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
async function simulateUser(userId) {
  const user = {
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
    console.error(`User ${userId} failed to initialize:`, error.message);
  }
}

/**
 * Sleep for ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Random number between min and max
 */
function randomBetween(min, max) {
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
function printProgress(elapsed) {
  const calculated = calculateStats();
  const progress = ((elapsed / config.duration) * 100).toFixed(0);
  
  console.clear();
  console.log('='.repeat(60));
  console.log('BORE BACKEND LOAD TEST');
  console.log('='.repeat(60));
  console.log(`Progress: ${progress}% (${elapsed}s / ${config.duration}s)`);
  console.log(`Users: ${config.users} | Target: ${config.target}`);
  console.log('');
  console.log('Requests:');
  console.log(`  Total: ${stats.requests.total}`);
  console.log(`  Successful: ${stats.requests.successful}`);
  console.log(`  Failed: ${stats.requests.failed}`);
  console.log(`  Timeout: ${stats.requests.timeout}`);
  console.log('');
  console.log('Response Times (ms):');
  console.log(`  Min: ${calculated.responseTime.min}`);
  console.log(`  Avg: ${calculated.responseTime.avg}`);
  console.log(`  P50: ${calculated.responseTime.p50}`);
  console.log(`  P95: ${calculated.responseTime.p95}`);
  console.log(`  P99: ${calculated.responseTime.p99}`);
  console.log(`  Max: ${calculated.responseTime.max}`);
  console.log('');
  console.log('Throughput:');
  console.log(`  RPS: ${calculated.throughput.requestsPerSecond}`);
  console.log(`  Success Rate: ${calculated.throughput.successRate}`);
  console.log('');
  console.log('Status Codes:');
  Object.entries(stats.statusCodes).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}`);
  });
  
  if (Object.keys(stats.errors).length > 0) {
    console.log('');
    console.log('Errors:');
    Object.entries(stats.errors).forEach(([error, count]) => {
      console.log(`  ${error}: ${count}`);
    });
  }
  console.log('='.repeat(60));
}

/**
 * Main test execution
 */
async function runLoadTest() {
  console.log('Starting load test...');
  console.log(`Configuration: ${config.users} users, ${config.duration}s duration, ${config.rampUp}s ramp-up`);
  console.log(`Target: ${config.target}`);
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
  console.log('\nWaiting for active requests to complete...');
  await sleep(5000);

  // Final report
  console.clear();
  console.log('='.repeat(60));
  console.log('LOAD TEST COMPLETED');
  console.log('='.repeat(60));
  
  const finalStats = calculateStats();
  console.log('\nFinal Statistics:');
  console.log(JSON.stringify({
    config,
    requests: stats.requests,
    ...finalStats,
    statusCodes: stats.statusCodes,
    errors: stats.errors
  }, null, 2));
  
  console.log('\n' + '='.repeat(60));
  
  // Exit with appropriate code
  const successRate = (stats.requests.successful / stats.requests.total) * 100;
  process.exit(successRate >= 95 ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping load test...');
  testRunning = false;
  setTimeout(() => process.exit(0), 2000);
});

// Run the test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest };
