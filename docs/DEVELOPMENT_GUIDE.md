
```path/to/bore/docs/DEVELOPMENT_GUIDE.md
# 🛠️ Bore Development Guide

**Complete guide for developers contributing to the Bore project**

---

## 📋 Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Coding Standards](#coding-standards)
6. [Testing](#testing)
7. [Database Management](#database-management)
8. [API Development](#api-development)
9. [Security Best Practices](#security-best-practices)
10. [Performance Optimization](#performance-optimization)
11. [Debugging](#debugging)
12. [Deployment](#deployment)

---

## 🚀 Development Setup

### Prerequisites

**Required:**
- **Rust** (latest stable): [Install Rust](https://rustup.rs/)
- **Node.js** 18+ and npm: [Install Node.js](https://nodejs.org/)
- **PostgreSQL** 14+: [Install PostgreSQL](https://www.postgresql.org/download/)
- **Redis** 7+: [Install Redis](https://redis.io/download/)
- **Git**: [Install Git](https://git-scm.com/downloads)

**Optional:**
- **Docker** and Docker Compose
- **code-server** (for GUI development)

### System Dependencies (Linux)

```bash
# Debian/Ubuntu
sudo apt install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  libpq-dev \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install -y \
  gcc \
  gcc-c++ \
  pkg-config \
  openssl-devel \
  postgresql-devel \
  webkit2gtk3-devel \
  gtk3-devel \
  libappindicator-gtk3 \
  librsvg2-devel
```

### Quick Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd bore

# 2. Install Rust dependencies
cargo build

# 3. Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials
npm run migrate
npm start

# 4. Run tests (in separate terminal)
cd ..
cargo test
```

### Environment Variables

Create `.env` file in `backend/`:

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/bore
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
API_KEY_SECRET=your-api-key-secret

# Server
PORT=8080
HOST=localhost

# Development
NODE_ENV=development
LOG_LEVEL=debug
```

---

## 📁 Project Structure

```
bore/
├── backend/                 # Node.js/Express API server
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/         # Database models
│   │   ├── routes/         # API routes
│   │   └── utils/          # Utility functions
│   ├── tests/              # Backend tests
│   └── package.json
├── bore-client/            # CLI client (Rust)
├── bore-server/            # TCP server (Rust)
├── bore-gui/               # Desktop app (Tauri + React)
├── bore-shared/            # Shared libraries
│   └── src/
│       ├── protocol/       # Communication protocol
│       ├── auth/          # Authentication utilities
│       └── crypto/        # Cryptographic functions
├── src/                   # Legacy CLI (deprecated)
├── tests/                 # Integration tests
├── docs/                  # Documentation
├── assessment_archive/    # Project assessments
└── scripts/               # Utility scripts
```

---

## 🏗️ Architecture Overview

### Component Communication

```
┌─────────────┐    TCP     ┌─────────────┐    HTTP     ┌─────────────┐
│   Client    │◀──────────▶│   Server    │◀──────────▶│   Backend   │
│   (Rust)    │            │   (Rust)    │            │(TypeScript) │
└─────────────┘            └─────────────┘            └─────────────┘
      │                          │
      ▼                          ▼
┌─────────────┐            ┌─────────────┐
│ Local Port  │            │    Redis    │
│   Service   │            │  (Session)  │
└─────────────┘            └─────────────┘
```

### Authentication Flow

1. **HMAC Challenge-Response** (Legacy)
   - Client sends HMAC challenge
   - Server validates and responds

2. **API Key Authentication** (Primary)
   - Backend generates API key (sk_*)
   - Client uses key for authentication

3. **Tunnel Token Authentication** (Enhanced)
   - Backend issues tunnel token (tk_*)
   - Time-limited, specific to tunnel

---

## 🔄 Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# ...

# Run tests
cargo test
cd backend && npm test

# Run linting
cargo clippy
cargo fmt --check
cd backend && npm run lint

# Commit changes
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### 2. Code Quality Checks

```bash
# Rust
cargo clippy -- -D warnings
cargo fmt
cargo audit

# TypeScript
cd backend
npm run lint
npm run type-check
npm audit
```

### 3. Testing

```bash
# All tests
cargo test

# Specific component
cargo test --package bore-client
cargo test --package bore-server

# Integration tests
cargo test --test integration_test

# Backend tests
cd backend
npm test
```

---

## 📝 Coding Standards

### Rust Standards

```rust
// Use descriptive variable names
let client_connection_timeout = Duration::from_secs(30);

// Error handling with Result
use anyhow::Result;

fn connect_to_server() -> Result<TcpStream> {
    let stream = TcpStream::connect("localhost:8080")?;
    Ok(stream)
}

// Use proper logging
use log::{info, warn, error};

info!("Client connected from {}", addr);
warn!("Connection timeout after 30 seconds");
error!("Failed to parse authentication token: {}", error);
```

### TypeScript Standards

```typescript
// Use strict types
interface User {
    id: string;
    email: string;
    apiKey: string;
    createdAt: Date;
}

// Proper error handling
try {
    const result = await authService.validateToken(token);
    return result;
} catch (error) {
    logger.error('Token validation failed', error);
    throw new AuthenticationError('Invalid token');
}

// Use async/await
async function createTunnel(config: TunnelConfig): Promise<Tunnel> {
    const tunnel = await tunnelService.create(config);
    return tunnel;
}
```

### Documentation Standards

```rust
/// Represents a TCP tunnel connection
/// 
/// # Fields
/// 
/// * `id` - Unique identifier for the tunnel
/// * `local_port` - Local port to forward
/// * `remote_port` - Remote port to expose
/// 
/// # Examples
/// 
/// ```
/// let tunnel = Tunnel::new(3000, 8080);
/// ```
pub struct Tunnel {
    pub id: String,
    pub local_port: u16,
    pub remote_port: u16,
}
```

---

## 🧪 Testing

### Unit Tests (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tunnel_creation() {
        let tunnel = Tunnel::new(3000, 8080);
        assert_eq!(tunnel.local_port, 3000);
        assert_eq!(tunnel.remote_port, 8080);
    }

    #[tokio::test]
    async fn test_async_connection() {
        let result = connect_to_server().await;
        assert!(result.is_ok());
    }
}
```

### Integration Tests

```rust
// tests/integration_test.rs
use bore_shared::protocol::*;

#[tokio::test]
async fn test_client_server_communication() {
    let server = TestServer::new().await;
    let client = TestClient::new(server.addr()).await;
    
    // Test authentication flow
    let auth_result = client.authenticate().await;
    assert!(auth_result.is_ok());
    
    // Test tunnel creation
    let tunnel = client.create_tunnel(3000).await;
    assert!(tunnel.is_ok());
}
```

### Backend Tests (TypeScript)

```typescript
// tests/auth.test.ts
import { authService } from '../src/services/auth';

describe('Authentication Service', () => {
  test('should validate API key', async () => {
    const result = await authService.validateApiKey('sk_test_key');
    expect(result.valid).toBe(true);
  });

  test('should reject invalid key', async () => {
    const result = await authService.validateApiKey('invalid');
    expect(result.valid).toBe(false);
  });
});
```

### Mock Testing

For CI-friendly tests without external dependencies:

```rust
// tests/mock_backend_test.rs
use bore_shared::test_helpers::*;

#[tokio::test]
async fn test_with_mock_backend() {
    let mock_server = MockBackend::new().await;
    let client = TestClient::new(mock_server.addr()).await;
    
    // Test against mock server
    let result = client.authenticate().await;
    assert!(result.is_ok());
}
```

---

## 🗄️ Database Management

### Migrations

```bash
# Create new migration
cd backend
npm run migration:create -- add_new_table

# Run migrations
npm run migrate

# Rollback migration
npm run migrate:rollback
```

### Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tunnels table
CREATE TABLE tunnels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    local_port INTEGER NOT NULL,
    remote_port INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Database Queries

```typescript
// Type-safe queries with PostgreSQL
import { Pool } from 'pg';

interface User {
  id: string;
  email: string;
  passwordHash: string;
}

class UserRepository {
  constructor(private pool: Pool) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      [email]
    );
    
    return result.rows[0] || null;
  }

  async create(user: Omit<User, 'id'>): Promise<User> {
    const result = await this.pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [user.email, user.passwordHash]
    );
    
    return result.rows[0];
  }
}
```

---

## 🔌 API Development

### REST API Structure

```typescript
// routes/auth.ts
import { Router } from 'express';
import { authController } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const router = Router();

// Register user
router.post('/register', 
  rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 5 }),
  authController.register
);

// Login
router.post('/login',
  rateLimitMiddleware({ windowMs: 15 * 60 * 1000, max: 10 }),
  authController.login
);

// Generate API key
router.post('/api-keys',
  authMiddleware,
  authController.generateApiKey
);

export default router;
```

### Controller Example

```typescript
// controllers/auth.ts
import { Request, Response } from 'express';
import { authService } from '../services/auth';
import { logger } from '../utils/logger';

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }
      
      // Create user
      const user = await authService.createUser(email, password);
      
      logger.info('User registered', { userId: user.id });
      res.status(201).json({ id: user.id, email: user.email });
    } catch (error) {
      logger.error('Registration failed', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
};
```

### OpenAPI Documentation

```yaml
# openapi.yaml
openapi: 3.0.0
info:
  title: Bore API
  version: 1.0.0
  description: TCP tunnel service API

paths:
  /auth/register:
    post:
      summary: Register new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
      responses:
        201:
          description: User created successfully
        400:
          description: Invalid input
```

---

## 🔒 Security Best Practices

### Authentication

```rust
// Secure password hashing
use bcrypt::{hash, DEFAULT_COST};

pub fn hash_password(password: &str) -> Result<String> {
    let hashed = hash(password, DEFAULT_COST)?;
    Ok(hashed)
}

// JWT token generation
use jsonwebtoken::{encode, Header, EncodingKey};

pub fn generate_jwt(user_id: &str, secret: &str) -> Result<String> {
    let claims = Claims {
        sub: user_id.to_string(),
        exp: Utc::now() + Duration::hours(24),
    };
    
    let token = encode(&Header::default(), &claims, &EncodingKey::from_secret(secret.as_ref()))?;
    Ok(token)
}
```

### Input Validation

```typescript
// Validate API key format
export function validateApiKey(key: string): boolean {
  // API keys should start with 'sk_' and be 32 characters long
  return /^sk_[a-zA-Z0-9]{29}$/.test(key);
}

// Validate tunnel configuration
export function validateTunnelConfig(config: TunnelConfig): ValidationResult {
  const errors: string[] = [];
  
  if (config.localPort < 1 || config.localPort > 65535) {
    errors.push('Local port must be between 1 and 65535');
  }
  
  if (config.remotePort < 1 || config.remotePort > 65535) {
    errors.push('Remote port must be between 1 and 65535');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
```

### Rate Limiting

```typescript
// Express rate limiting middleware
import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 requests per windowMs
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiKeyRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // limit each IP to 100 requests per windowMs
  keyGenerator: (req) => req.headers['x-api-key'] as string || req.ip,
});
```

---

## ⚡ Performance Optimization

### Connection Pooling

```rust
// PostgreSQL connection pool
use sqlx::postgres::PgPoolOptions;

pub async fn create_db_pool(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .min_connections(5)
        .connect(database_url)
        .await?;
    
    Ok(pool)
}
```

### Caching

```typescript
// Redis caching
import Redis from 'ioredis';

class CacheService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    await this.redis.setex(key, ttl, JSON.stringify(value));
  }

  async invalidate(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
```

### Async Processing

```rust
// Use tokio for concurrent operations
use tokio::task::JoinSet;

pub async fn process_connections(connections: Vec<TcpStream>) -> Result<()> {
    let mut set = JoinSet::new();
    
    for stream in connections {
        set.spawn(async move {
            handle_connection(stream).await
        });
    }
    
    while let Some(result) = set.join_next().await {
        result??; // Handle join errors
    }
    
    Ok(())
}
```

---

## 🐛 Debugging

### Logging Setup

```rust
// Rust logging setup
use log::{info, warn, error, debug};
use env_logger::Env;

fn init_logging() {
    env_logger::Builder::from_env(Env::default().default_filter_or("info"))
        .init();
}

// Structured logging
info!("Client connected", {
    "client_id": client_id,
    "remote_addr": addr,
    "timestamp": chrono::Utc::now()
});
```

```typescript
// TypeScript logging
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Usage
logger.info('User authenticated', { 
  userId: user.id, 
  apiKey: apiKey.substring(0, 8) + '...' 
});
```

### Debug Mode

```bash
# Enable debug logging
RUST_LOG=debug cargo run

# TypeScript debug mode
DEBUG=bore:* npm start
```

---

## 🚀 Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM rust:1.70 as builder

WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/bore-server /usr/local/bin/
EXPOSE 8080
CMD ["bore-server"]
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bore-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bore-server
  template:
    metadata:
      labels:
        app: bore-server
    spec:
      containers:
      - name: bore-server
        image: bore/server:latest
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: bore-secrets
              key: database-url
```

### Environment-Specific Config

```typescript
// config/index.ts
export const config = {
  development: {
    database: { url: process.env.DATABASE_URL },
    redis: { url: process.env.REDIS_URL },
    jwt: { secret: process.env.JWT_SECRET },
    logLevel: 'debug'
  },
  production: {
    database: { 
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    },
    redis: { url: process.env.REDIS_URL },
    jwt: { secret: process.env.JWT_SECRET },
    logLevel: 'info'
  }
};

export const env = config[process.env.NODE_ENV || 'development'];
```

---

## 📚 Resources

### Documentation
- [Rust Book](https://doc.rust-lang.org/book/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

### Tools
- **IDE**: VS Code with Rust and TypeScript extensions
- **Database**: pgAdmin, DBeaver
- **API Testing**: Postman, Insomnia
- **Monitoring**: Prometheus, Grafana

### Scripts
- `security-audit.sh` - Run security vulnerability scans
- `verify-workflows.sh` - Validate CI/CD workflows
- `cargo build` - Build Rust components
- `npm run dev` - Start backend in development mode

---

## 🤝 Contributing Guidelines

1. **Code Style**: Follow Rust and TypeScript conventions
2. **Testing**: Write tests for new features
3. **Documentation**: Update relevant docs
4. **Commits**: Use conventional commit messages
5. **PRs**: Provide clear descriptions and test plans

### Commit Message Format

```
type(scope): description

feat(auth): add API key authentication
fix(server): handle connection timeout gracefully
docs(readme): update installation instructions
test(integration): add mock backend tests
```

---

*Last updated: October 17, 2025*