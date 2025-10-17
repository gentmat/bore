# Multi-stage build for bore-server
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
COPY bore-server ./bore-server/
COPY bore-client ./bore-client/

# Build bore-server from workspace root
RUN cargo build --release -p bore-server --bin bore-server

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
COPY --from=builder /app/target/release/bore-server /usr/local/bin/bore-server

# Set user
USER bore

# Expose port
EXPOSE 7835

# Health check (ping the server)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bore-server --help || exit 1

# Run server
CMD ["bore-server"]
