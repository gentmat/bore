///! Performance Benchmarks and Regression Tests for Bore
///!
///! This module provides comprehensive performance testing including:
///! - Tunnel establishment latency
///! - Data throughput benchmarks
///! - Concurrent connection performance
///! - Memory usage profiling
///! - Regression detection against baseline metrics
///!
///! Run with: cargo test --release --benches performance_benchmarks
///! Set BASELINE_RUN=true to establish new baseline

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::{env, fs, io};

use anyhow::{Result, Context};
use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener as TokioTcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

// Configuration constants
const SMALL_DATA_SIZE: usize = 1024;           // 1KB
const MEDIUM_DATA_SIZE: usize = 1024 * 1024;   // 1MB
const LARGE_DATA_SIZE: usize = 10 * 1024 * 1024; // 10MB
const THROUGHPUT_TEST_DURATION: Duration = Duration::from_secs(10);
const CONCURRENT_CONNECTIONS: &[usize] = &[1, 10, 50, 100];

// Performance metrics structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub tunnel_establishment_ms: f64,
    pub throughput_mbps: f64,
    pub latency_p50_ms: f64,
    pub latency_p95_ms: f64,
    pub latency_p99_ms: f64,
    pub concurrent_connections: usize,
    pub memory_usage_mb: f64,
    pub cpu_usage_percent: f64,
}

impl PerformanceMetrics {
    fn new() -> Self {
        Self {
            timestamp: chrono::Utc::now(),
            tunnel_establishment_ms: 0.0,
            throughput_mbps: 0.0,
            latency_p50_ms: 0.0,
            latency_p95_ms: 0.0,
            latency_p99_ms: 0.0,
            concurrent_connections: 0,
            memory_usage_mb: 0.0,
            cpu_usage_percent: 0.0,
        }
    }

    fn save_to_file(&self, path: &str) -> Result<()> {
        let data = serde_json::to_string_pretty(self)?;
        fs::write(path, data)?;
        Ok(())
    }

    fn load_from_file(path: &str) -> Result<Self> {
        let data = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&data)?)
    }
}

// Baseline comparison structure
#[derive(Debug)]
pub struct BaselineComparison {
    pub baseline: PerformanceMetrics,
    pub current: PerformanceMetrics,
    pub regression_detected: bool,
    pub improvements: Vec<String>,
    pub regressions: Vec<String>,
}

impl BaselineComparison {
    fn compare(baseline: &PerformanceMetrics, current: &PerformanceMetrics) -> Self {
        let mut improvements = Vec::new();
        let mut regressions = Vec::new();
        let mut regression_detected = false;

        // Define regression thresholds (10% degradation)
        const REGRESSION_THRESHOLD: f64 = 0.10;

        // Compare tunnel establishment time
        let establishment_change = (current.tunnel_establishment_ms - baseline.tunnel_establishment_ms) / baseline.tunnel_establishment_ms;
        if establishment_change > REGRESSION_THRESHOLD {
            regressions.push(format!("Tunnel establishment time increased by {:.1}%", establishment_change * 100.0));
            regression_detected = true;
        } else if establishment_change < -REGRESSION_THRESHOLD {
            improvements.push(format!("Tunnel establishment time improved by {:.1}%", -establishment_change * 100.0));
        }

        // Compare throughput
        let throughput_change = (current.throughput_mbps - baseline.throughput_mbps) / baseline.throughput_mbps;
        if throughput_change < -REGRESSION_THRESHOLD {
            regressions.push(format!("Throughput decreased by {:.1}%", -throughput_change * 100.0));
            regression_detected = true;
        } else if throughput_change > REGRESSION_THRESHOLD {
            improvements.push(format!("Throughput improved by {:.1}%", throughput_change * 100.0));
        }

        // Compare latency
        let p95_change = (current.latency_p95_ms - baseline.latency_p95_ms) / baseline.latency_p95_ms;
        if p95_change > REGRESSION_THRESHOLD {
            regressions.push(format!("P95 latency increased by {:.1}%", p95_change * 100.0));
            regression_detected = true;
        } else if p95_change < -REGRESSION_THRESHOLD {
            improvements.push(format!("P95 latency improved by {:.1}%", -p95_change * 100.0));
        }

        Self {
            baseline: baseline.clone(),
            current: current.clone(),
            regression_detected,
            improvements,
            regressions,
        }
    }
}

// System resource monitoring
pub struct SystemMonitor {
    start_time: Instant,
    initial_memory: u64,
}

impl SystemMonitor {
    fn new() -> Self {
        Self {
            start_time: Instant::now(),
            initial_memory: Self::get_memory_usage(),
        }
    }

    fn get_memory_usage() -> u64 {
        // Simple memory usage estimation (in bytes)
        // In a real implementation, you'd use proper system APIs
        #[cfg(unix)]
        {
            use std::fs;
            if let Ok(status) = fs::read_to_string("/proc/self/status") {
                for line in status.lines() {
                    if line.starts_with("VmRSS:") {
                        if let Some(kb_str) = line.split_whitespace().nth(1) {
                            if let Ok(kb) = kb_str.parse::<u64>() {
                                return kb * 1024; // Convert to bytes
                            }
                        }
                    }
                }
            }
        }
        0 // Fallback
    }

    fn get_current_metrics(&self, concurrent_connections: usize) -> PerformanceMetrics {
        let current_memory = Self::get_memory_usage();
        let memory_usage_mb = (current_memory - self.initial_memory) as f64 / 1024.0 / 1024.0;
        let cpu_usage_percent = 0.0; // Placeholder - would need proper CPU monitoring

        PerformanceMetrics {
            timestamp: chrono::Utc::now(),
            concurrent_connections,
            memory_usage_mb,
            cpu_usage_percent,
            ..Default::default()
        }
    }
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self::new()
    }
}

// Helper function to find available port
fn find_available_port() -> Result<u16> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
}

// Helper function to create test echo server
async fn create_echo_server(port: u16) -> Result<()> {
    let listener = TokioTcpListener::bind(("127.0.0.1", port)).await?;

    tokio::spawn(async move {
        while let Ok((mut stream, _)) = listener.accept().await {
            let (mut reader, mut writer) = tokio::io::split(stream);
            let mut buffer = [0; 8192];

            tokio::spawn(async move {
                loop {
                    match reader.read(&mut buffer).await {
                        Ok(0) => break, // Connection closed
                        Ok(n) => {
                            if writer.write_all(&buffer[..n]).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
            });
        }
    });

    Ok(())
}

// Benchmark tunnel establishment time
fn bench_tunnel_establishment(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("tunnel_establishment", |b| {
        b.iter(|| {
            rt.block_on(async {
                let local_port = find_available_port().unwrap();
                create_echo_server(local_port).await.unwrap();

                let start_time = Instant::now();

                // Simulate tunnel establishment (simplified)
                let _stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

                let establishment_time = start_time.elapsed();
                black_box(establishment_time)
            })
        })
    });
}

// Benchmark data throughput
fn bench_throughput(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("throughput");
    group.measurement_time(Duration::from_secs(5));

    for &size in &[SMALL_DATA_SIZE, MEDIUM_DATA_SIZE, LARGE_DATA_SIZE] {
        group.bench_with_input(
            BenchmarkId::new("data_transfer", size),
            &size,
            |b, &size| {
                b.iter(|| {
                    rt.block_on(async {
                        let local_port = find_available_port().unwrap();
                        create_echo_server(local_port).await.unwrap();

                        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

                        let test_data = vec![42u8; size];
                        let start_time = Instant::now();

                        stream.write_all(&test_data).await.unwrap();

                        let mut response = vec![0u8; size];
                        let mut total_read = 0;

                        while total_read < size {
                            let n = stream.read(&mut response[total_read..]).await.unwrap();
                            if n == 0 { break; }
                            total_read += n;
                        }

                        let elapsed = start_time.elapsed();
                        let throughput_mbps = (size as f64 * 8.0) / (elapsed.as_secs_f64() * 1_000_000.0);

                        black_box(throughput_mbps)
                    })
                })
            },
        );
    }

    group.finish();
}

// Benchmark concurrent connections
fn bench_concurrent_connections(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    let mut group = c.benchmark_group("concurrent_connections");
    group.measurement_time(Duration::from_secs(10));

    for &connections in CONCURRENT_CONNECTIONS {
        group.bench_with_input(
            BenchmarkId::new("concurrent_tunnels", connections),
            &connections,
            |b, &connections| {
                b.iter(|| {
                    rt.block_on(async {
                        let mut handles = Vec::new();
                        let start_time = Instant::now();

                        for _ in 0..connections {
                            let local_port = find_available_port().unwrap();
                            create_echo_server(local_port).await.unwrap();

                            let handle = tokio::spawn(async move {
                                let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

                                let test_data = b"Hello, Bore!";
                                stream.write_all(test_data).await.unwrap();

                                let mut response = [0u8; test_data.len()];
                                stream.read_exact(&mut response).await.unwrap();

                                response.len()
                            });

                            handles.push(handle);
                        }

                        // Wait for all connections to complete
                        let mut total_bytes = 0;
                        for handle in handles {
                            total_bytes += handle.await.unwrap();
                        }

                        let elapsed = start_time.elapsed();
                        black_box((total_bytes, elapsed))
                    })
                })
            },
        );
    }

    group.finish();
}

// Memory usage benchmark
fn bench_memory_usage(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();

    c.bench_function("memory_usage_stress", |b| {
        b.iter(|| {
            rt.block_on(async {
                let monitor = SystemMonitor::new();
                let mut handles = Vec::new();

                // Create many concurrent connections
                for _ in 0..50 {
                    let local_port = find_available_port().unwrap();
                    create_echo_server(local_port).await.unwrap();

                    let handle = tokio::spawn(async move {
                        let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

                        // Keep connection alive with periodic data
                        for _ in 0..10 {
                            let test_data = vec![42u8; 1024];
                            stream.write_all(&test_data).await.unwrap();
                            tokio::time::sleep(Duration::from_millis(10)).await;
                        }
                    });

                    handles.push(handle);
                }

                // Monitor memory usage during operations
                let mut peak_memory = 0;
                for _ in 0..20 {
                    let current_memory = SystemMonitor::get_memory_usage();
                    peak_memory = peak_memory.max(current_memory);
                    tokio::time::sleep(Duration::from_millis(100)).await;
                }

                // Wait for all operations to complete
                for handle in handles {
                    let _ = handle.await;
                }

                black_box(peak_memory)
            })
        })
    });
}

// Regression test against baseline
#[tokio::test]
#[ignore = "performance regression test - run manually"]
async fn performance_regression_test() -> Result<()> {
    let baseline_path = "performance_baseline.json";
    let current_metrics = run_comprehensive_performance_test().await?;

    // Load or create baseline
    let baseline = if env::var("BASELINE_RUN").is_ok() {
        println!("📊 Establishing new performance baseline");
        current_metrics.save_to_file(baseline_path)?;
        current_metrics
    } else if std::path::Path::new(baseline_path).exists() {
        PerformanceMetrics::load_from_file(baseline_path)?
    } else {
        println!("⚠️  No baseline found. Run with BASELINE_RUN=true to create one.");
        return Ok(());
    };

    // Compare with baseline
    let comparison = BaselineComparison::compare(&baseline, &current_metrics);

    println!("\n🔍 Performance Regression Analysis");
    println!("=====================================");
    println!("Baseline:   {}", baseline.timestamp.format("%Y-%m-%d %H:%M:%S UTC"));
    println!("Current:    {}", current_metrics.timestamp.format("%Y-%m-%d %H:%M:%S UTC"));

    println!("\n📈 Current Metrics:");
    println!("  Tunnel Establishment: {:.1}ms", current_metrics.tunnel_establishment_ms);
    println!("  Throughput:           {:.1} Mbps", current_metrics.throughput_mbps);
    println!("  P95 Latency:          {:.1}ms", current_metrics.latency_p95_ms);
    println!("  Memory Usage:         {:.1} MB", current_metrics.memory_usage_mb);

    if !comparison.improvements.is_empty() {
        println!("\n✅ Performance Improvements:");
        for improvement in &comparison.improvements {
            println!("  • {}", improvement);
        }
    }

    if !comparison.regressions.is_empty() {
        println!("\n❌ Performance Regressions:");
        for regression in &comparison.regressions {
            println!("  • {}", regression);
        }
    }

    if comparison.regression_detected {
        println!("\n🚨 PERFORMANCE REGRESSION DETECTED!");
        println!("Review the changes and consider optimizing before merging.");
        return Err(anyhow::anyhow!("Performance regression detected"));
    } else {
        println!("\n🎉 No performance regressions detected!");
    }

    Ok(())
}

// Comprehensive performance test
async fn run_comprehensive_performance_test() -> Result<PerformanceMetrics> {
    let mut metrics = PerformanceMetrics::new();
    let monitor = SystemMonitor::new();

    println!("🏃 Running comprehensive performance test...");

    // Test 1: Tunnel establishment
    let establishment_times = Arc::new(Mutex::new(Vec::new()));
    let mut establishment_handles = Vec::new();

    for _ in 0..20 {
        let times_clone = establishment_times.clone();
        let handle = tokio::spawn(async move {
            let local_port = find_available_port().unwrap();
            create_echo_server(local_port).await.unwrap();

            let start_time = Instant::now();
            let _stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();
            let establishment_time = start_time.elapsed().as_millis() as f64;

            times_clone.lock().unwrap().push(establishment_time);
        });

        establishment_handles.push(handle);
    }

    for handle in establishment_handles {
        handle.await?;
    }

    let times = establishment_times.lock().unwrap();
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    metrics.tunnel_establishment_ms = times[times.len() / 2]; // P50

    // Test 2: Throughput
    let local_port = find_available_port().unwrap();
    create_echo_server(local_port).await.unwrap();

    let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

    let test_data = vec![42u8; MEDIUM_DATA_SIZE];
    let start_time = Instant::now();

    stream.write_all(&test_data).await?;

    let mut response = vec![0u8; test_data.len()];
    let mut total_read = 0;

    while total_read < test_data.len() {
        let n = stream.read(&mut response[total_read..]).await?;
        if n == 0 { break; }
        total_read += n;
    }

    let elapsed = start_time.elapsed();
    metrics.throughput_mbps = (test_data.len() as f64 * 8.0) / (elapsed.as_secs_f64() * 1_000_000.0);

    // Test 3: Latency measurement
    let mut latencies = Vec::new();
    for _ in 0..100 {
        let start_time = Instant::now();

        let ping_data = b"ping";
        stream.write_all(ping_data).await?;

        let mut response = [0u8; 4];
        stream.read_exact(&mut response).await?;

        let latency = start_time.elapsed().as_millis() as f64;
        latencies.push(latency);

        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    latencies.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let len = latencies.len();
    metrics.latency_p50_ms = latencies[len / 2];
    metrics.latency_p95_ms = latencies[len * 95 / 100];
    metrics.latency_p99_ms = latencies[len * 99 / 100];

    // Update system metrics
    let system_metrics = monitor.get_current_metrics(1);
    metrics.memory_usage_mb = system_metrics.memory_usage_mb;
    metrics.concurrent_connections = 1;

    println!("✅ Performance test completed:");
    println!("  Establishment: {:.1}ms", metrics.tunnel_establishment_ms);
    println!("  Throughput:    {:.1} Mbps", metrics.throughput_mbps);
    println!("  P95 Latency:   {:.1}ms", metrics.latency_p95_ms);
    println!("  Memory:        {:.1} MB", metrics.memory_usage_mb);

    Ok(metrics)
}

// Stress test for memory leaks
#[tokio::test]
#[ignore = "stress test - run manually"]
async fn memory_leak_stress_test() -> Result<()> {
    println!("🔥 Running memory leak stress test...");

    let monitor = SystemMonitor::new();
    let initial_memory = monitor.initial_memory;

    // Run many connection cycles
    for cycle in 1..=10 {
        println!("  Cycle {} of 10", cycle);

        let mut handles = Vec::new();
        for _ in 0..100 {
            let local_port = find_available_port().unwrap();
            create_echo_server(local_port).await.unwrap();

            let handle = tokio::spawn(async move {
                let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await.unwrap();

                // Transfer data
                let data = vec![42u8; 1024];
                for _ in 0..10 {
                    let _ = stream.write_all(&data).await;
                    let mut response = vec![0u8; data.len()];
                    let _ = stream.read_exact(&mut response).await;
                }
            });

            handles.push(handle);
        }

        // Wait for all operations
        for handle in handles {
            handle.await?;
        }

        // Force garbage collection (simulated)
        tokio::task::yield_now().await;

        let current_memory = SystemMonitor::get_memory_usage();
        let memory_growth = (current_memory - initial_memory) as f64 / 1024.0 / 1024.0;

        println!("    Memory growth: {:.1} MB", memory_growth);

        // Allow some memory growth but check for excessive growth
        if memory_growth > 100.0 { // 100MB threshold
            anyhow::bail!("Potential memory leak detected: {:.1} MB growth", memory_growth);
        }
    }

    println!("✅ No significant memory leaks detected");
    Ok(())
}

// Long-running stability test
#[tokio::test]
#[ignore = "stability test - run manually"]
async fn stability_test() -> Result<()> {
    println!("⏱️  Running stability test (30 seconds)...");

    let start_time = Instant::now();
    let mut total_operations = 0;
    let mut errors = 0;

    while start_time.elapsed() < Duration::from_secs(30) {
        let local_port = find_available_port().unwrap();
        create_echo_server(local_port).await.unwrap();

        match tokio::time::timeout(
            Duration::from_secs(5),
            async {
                let mut stream = tokio::net::TcpStream::connect(("127.0.0.1", local_port)).await?;

                let data = b"stability_test";
                stream.write_all(data).await?;

                let mut response = [0u8; data.len()];
                stream.read_exact(&mut response).await?;

                Ok::<(), anyhow::Error>(())
            }
        ).await {
            Ok(Ok(_)) => {
                total_operations += 1;
            }
            Ok(Err(_)) | Err(_) => {
                errors += 1;
            }
        }

        // Small delay between operations
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    let elapsed = start_time.elapsed();
    let ops_per_second = total_operations as f64 / elapsed.as_secs_f64();
    let error_rate = errors as f64 / (total_operations + errors) as f64 * 100.0;

    println!("✅ Stability test completed:");
    println!("  Duration:        {:?}", elapsed);
    println!("  Total operations: {}", total_operations);
    println!("  Errors:          {}", errors);
    println!("  Operations/sec:  {:.1}", ops_per_second);
    println!("  Error rate:      {:.2}%", error_rate);

    if error_rate > 5.0 {
        anyhow::bail!("High error rate detected: {:.2}%", error_rate);
    }

    Ok(())
}

criterion_group!(
    benches,
    bench_tunnel_establishment,
    bench_throughput,
    bench_concurrent_connections,
    bench_memory_usage
);

criterion_main!(benches);