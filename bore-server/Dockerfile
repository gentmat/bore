# Multi-stage build for bore-server
FROM rust:1.75-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./
COPY bore-shared ../bore-shared/

# Copy source code
COPY . .

# Build release binary
RUN cargo build --release --bin bore

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1001 bore

# Copy binary from builder
COPY --from=builder /app/target/release/bore /usr/local/bin/bore

# Set user
USER bore

# Expose port
EXPOSE 7835

# Health check (ping the server)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bore --help || exit 1

# Run server
CMD ["bore", "server"]
