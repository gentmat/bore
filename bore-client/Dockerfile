# Multi-stage build for bore-client
FROM rust:1.82-slim AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy workspace files
COPY Cargo.toml Cargo.lock ./

# Copy all workspace members
COPY bore-shared ./bore-shared/
COPY bore-client ./bore-client/

# Build bore-client from workspace root
RUN cargo build --release -p bore-client --bin bore

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 bore

# Copy binary from builder
COPY --from=builder /app/target/release/bore /usr/local/bin/bore-client

# Set user
USER bore

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bore-client --help || exit 1

# Set entrypoint
ENTRYPOINT ["bore-client"]
```

Now let me update the GitHub workflow to use the dedicated client Dockerfile:
