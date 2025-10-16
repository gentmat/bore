# Development Guide

Complete guide for developers contributing to the Bore project. Covers setup, architecture, coding standards, and contribution workflow.

## 📋 Table of Contents

1. [Development Setup](#development-setup)
2. [Project Structure](#project-structure)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [Testing](#testing)
6. [Coding Standards](#coding-standards)
7. [Database Migrations](#database-migrations)
8. [API Development](#api-development)
9. [Contributing](#contributing)

---

## Development Setup

### Prerequisites

**Required:**
- **Rust** (latest stable): [Install Rust](https://rustup.rs/)
- **Node.js** 18+ and npm: [Install Node.js](https://nodejs.org/)
- **PostgreSQL** 14+: [Install PostgreSQL](https://www.postgresql.org/download/)
- **Redis** 7+: [Install Redis](https://redis.io/download/)
- **Git**: [Install Git](https://git-scm.com/downloads)

**Optional:**
- **Docker** and Docker Compose (for containerized development)
- **code-server** (for bore-gui development)

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
  pkg-config \
  openssl-devel \
  postgresql-devel \
  webkit2gtk3-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel

# Arch Linux
sudo pacman -S \
  base-devel \
  openssl \
  postgresql-libs \
  webkit2gtk \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

### Initial Setup

**1. Clone the Repository:**
```bash
git clone https://github.com/yourusername/bore.git
cd bore
```

**2. Setup PostgreSQL:**
```bash
# Create database and user
sudo -u postgres psql
CREATE DATABASE bore_dev;
CREATE USER bore_dev WITH PASSWORD 'dev_password';
GRANT ALL PRIVILEGES ON DATABASE bore_dev TO bore_dev;
\c bore_dev
GRANT ALL ON SCHEMA public TO bore_dev;
\q
```

**3. Setup Redis:**
```bash
# Start Redis server
redis-server

# Or with custom config
redis-server /path/to/redis.conf
```

**4. Setup Backend:**
```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Edit .env for development
nano .env
# Set:
#   NODE_ENV=development
#   DB_HOST=localhost
#   DB_NAME=bore_dev
#   DB_USER=bore_dev
#   DB_PASSWORD=dev_password
#   REDIS_ENABLED=true
#   ENABLE_MASTER_TUNNEL=true

# Run migrations
npm run migrate:up

# Start development server
npm run dev
```

**5. Build Rust Components:**
```bash
cd ..

# Build all Rust projects
cargo build --workspace

# Install locally for testing
cargo install --path bore-client
cargo install --path bore-server

# Verify installation
bore --version
bore-server --version
```

**6. Setup bore-gui (Optional):**
```bash
cd bore-gui

# Install dependencies
npm install

# Start development mode
npm run tauri dev
```

---

## Project Structure

```
bore/
├── backend/                    # TypeScript/Node.js backend API
│   ├── src/                   # (In migration) Source files
│   ├── middleware/            # Express middleware
│   ├── migrations/            # Database migrations
│   ├── tests/                 # Backend tests
│   ├── docs/                  # API documentation
│   ├── server.js              # Main entry point
│   ├── database.js            # Database connection
│   ├── package.json
│   └── tsconfig.json
│
├── bore-client/               # Rust tunnel client
│   ├── src/
│   │   ├── main.rs           # CLI entry point
│   │   ├── client.rs         # Tunnel client logic
│   │   ├── auth.rs           # Authentication
│   │   └── api_client.rs     # Backend API client
│   └── Cargo.toml
│
├── bore-server/               # Rust tunnel server
│   ├── src/
│   │   ├── main.rs           # Server entry point
│   │   ├── server.rs         # TCP server logic
│   │   └── backend.rs        # Backend integration
│   └── Cargo.toml
│
├── bore-shared/               # Shared Rust code
│   ├── src/
│   │   ├── lib.rs
│   │   ├── protocol.rs       # Wire protocol
│   │   └── auth.rs           # Auth utilities
│   └── Cargo.toml
│
├── bore-gui/                  # Tauri desktop application
│   ├── src/                  # React frontend
│   │   ├── components/       # React components
│   │   ├── App.tsx          # Main app
│   │   └── main.tsx
│   ├── src-tauri/           # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs      # Tauri setup
│   │   │   └── commands.rs  # Backend commands
│   │   └── Cargo.toml
│   └── package.json
│
├── tests/                    # Integration tests
│   ├── e2e_test.rs
│   └── auth_test.rs
│
├── Cargo.toml               # Workspace configuration
├── README.md
├── DEPLOYMENT.md
└── DEVELOPMENT.md
```

---

## Architecture Overview

### Component Interaction

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌──────────────┐        ┌──────────────┐              │
│  │  bore-client │        │   bore-gui   │              │
│  │    (CLI)     │        │  (Desktop)   │              │
│  └──────┬───────┘        └──────┬───────┘              │
└─────────┼────────────────────────┼──────────────────────┘
          │                        │
          │ TCP Tunnel             │ REST API
          │                        │
          ▼                        ▼
┌─────────────────────────────────────────────────────────┐
│                    Server Layer                          │
│  ┌──────────────┐        ┌──────────────┐              │
│  │ bore-server  │◄───────┤   Backend    │              │
│  │   (Rust)     │ Mgmt   │ (TypeScript) │              │
│  └──────────────┘        └───┬──────────┘              │
└─────────────────────────────┼───────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │  PostgreSQL  │    │    Redis     │    │ Monitoring   │
  │  (Database)  │    │  (Cache)     │    │ (Metrics)    │
  └──────────────┘    └──────────────┘    └──────────────┘
```

### Key Components

**1. bore-client (Rust)**
- Command-line interface for users
- Establishes TCP tunnels to bore-servers
- Handles authentication with JWT tokens
- Manages local port forwarding

**2. bore-server (Rust)**
- TCP server accepting tunnel connections
- Port allocation and management
- Integrates with backend for auth and metrics
- High-performance async I/O with Tokio

**3. Backend (TypeScript/Node.js)**
- Central coordinator and API
- User authentication and authorization
- Instance lifecycle management
- Multi-server orchestration
- Capacity management and load balancing

**4. bore-gui (Tauri + React)**
- Cross-platform desktop application
- User-friendly interface for tunnel management
- Manages bore-client processes
- Real-time status updates

---

## Development Workflow

### Git Workflow

We follow a **feature branch** workflow:

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "Add feature X"

# Push to remote
git push origin feature/my-feature

# Create Pull Request on GitHub
```

### Commit Message Format

Use conventional commits:

```
type(scope): subject

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(backend): add capacity management endpoint
fix(client): handle connection timeout gracefully
docs(readme): update installation instructions
refactor(server): improve error handling
```

### Code Review Process

1. Create Pull Request with clear description
2. Ensure all tests pass
3. Address reviewer feedback
4. Maintain clean commit history
5. Squash commits before merge

---

## Testing

### Backend Tests

```bash
cd backend

# Run all tests
npm test

# Run specific test file
npm test -- tests/auth.test.js

# Run with coverage
npm run test:coverage

# Run integration tests
npm run test:integration

# Run load tests
node tests/load-test.js --users 50 --duration 30
```

**Writing Tests:**
```javascript
// tests/example.test.js
const request = require('supertest');
const app = require('../server');

describe('API Endpoint', () => {
  it('should return 200 OK', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'healthy');
  });
});
```

### Rust Tests

```bash
# Run all Rust tests
cargo test --workspace

# Run specific package tests
cargo test -p bore-client

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_authentication
```

**Writing Tests:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_connection() {
        let client = Client::new("localhost", 7835);
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_async_operation() {
        let result = async_function().await;
        assert!(result.is_ok());
    }
}
```

### GUI Tests

```bash
cd bore-gui

# Run frontend tests
npm test

# Run Tauri tests
cargo test --manifest-path src-tauri/Cargo.toml
```

---

## Coding Standards

### TypeScript/JavaScript (Backend)

**Code Style:**
- Use ESLint and Prettier
- 2 spaces indentation
- Semicolons required
- Single quotes for strings

```javascript
// Good
const userName = 'john_doe';
const fetchData = async () => {
  const response = await api.get('/data');
  return response.data;
};

// Bad
var userName = "john_doe"
const fetchData = async () => 
{
    const response = await api.get('/data')
    return response.data
}
```

**Async/Await:**
```javascript
// Good
async function createUser(data) {
  try {
    const user = await db.users.create(data);
    return user;
  } catch (error) {
    logger.error('Failed to create user', error);
    throw error;
  }
}

// Avoid
function createUser(data) {
  return db.users.create(data).then(user => {
    return user;
  }).catch(error => {
    logger.error('Failed to create user', error);
    throw error;
  });
}
```

### Rust

**Code Style:**
- Use `rustfmt` and `clippy`
- 4 spaces indentation
- Follow Rust naming conventions

```rust
// Good
pub struct TunnelConfig {
    pub local_port: u16,
    pub server_host: String,
}

impl TunnelConfig {
    pub fn new(local_port: u16, server_host: String) -> Self {
        Self {
            local_port,
            server_host,
        }
    }
}

// Use clippy for linting
// cargo clippy -- -D warnings
```

**Error Handling:**
```rust
// Good - use Result and ?
fn connect_to_server(host: &str) -> Result<Connection, Error> {
    let socket = TcpStream::connect(host)?;
    let connection = Connection::new(socket)?;
    Ok(connection)
}

// Good - custom errors
#[derive(Debug)]
pub enum TunnelError {
    ConnectionFailed(String),
    AuthenticationFailed,
    Timeout,
}
```

---

## Database Migrations

### Creating Migrations

```bash
cd backend

# Create new migration
npm run migrate:create add-feature-name

# This creates: migrations/TIMESTAMP_add-feature-name.js
```

### Migration Structure

```javascript
// migrations/TIMESTAMP_example.js

exports.up = (pgm) => {
  // Forward migration
  pgm.createTable('examples', {
    id: 'id',
    name: { type: 'varchar(100)', notNull: true },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp')
    }
  });

  pgm.createIndex('examples', 'name');
};

exports.down = (pgm) => {
  // Rollback migration
  pgm.dropTable('examples');
};
```

### Running Migrations

```bash
# Apply migrations
npm run migrate:up

# Rollback last migration
npm run migrate:down

# Check migration status
npm run migrate
```

---

## API Development

### Adding New Endpoints

**1. Define Route:**
```javascript
// routes/features.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res) => {
  try {
    const features = await db.query('SELECT * FROM features');
    res.json({ features: features.rows });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
```

**2. Register Route:**
```javascript
// server.js
const featuresRoutes = require('./routes/features');
app.use('/api/v1/features', featuresRoutes);
```

**3. Document API:**
Update `backend/docs/openapi.yaml`:
```yaml
paths:
  /api/v1/features:
    get:
      summary: List features
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  features:
                    type: array
```

### Middleware Development

```javascript
// middleware/example.js
module.exports = (req, res, next) => {
  // Middleware logic
  console.log(`${req.method} ${req.path}`);
  next();
};
```

---

## Contributing

### Before Submitting PR

**Checklist:**
- [ ] Code follows project style guidelines
- [ ] All tests pass (`npm test` and `cargo test`)
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] Commit messages follow convention
- [ ] No console.log statements in production code
- [ ] No commented-out code

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Screenshots (if applicable)

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Follows coding standards
```

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and discuss ideas
- **Discord**: Join our developer community (link)
- **Email**: dev@yourdomain.com

---

## Useful Commands

### Backend
```bash
npm run dev              # Start development server
npm test                 # Run tests
npm run migrate:up       # Apply migrations
npm run lint             # Run ESLint
npm run format           # Format with Prettier
```

### Rust
```bash
cargo build              # Build project
cargo test               # Run tests
cargo clippy             # Run linter
cargo fmt                # Format code
cargo run -- --help      # Run with args
```

### Docker
```bash
docker-compose up -d     # Start services
docker-compose logs -f   # View logs
docker-compose down      # Stop services
docker-compose ps        # List containers
```

---

## Resources

**Documentation:**
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Tokio Documentation](https://tokio.rs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [Tauri Documentation](https://tauri.app/v1/guides/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

**Tools:**
- [Postman](https://www.postman.com/) - API testing
- [pgAdmin](https://www.pgadmin.org/) - PostgreSQL GUI
- [Redis Commander](http://joeferner.github.io/redis-commander/) - Redis GUI

---

Happy coding! 🚀

**Questions?** Open an issue or join our community discussions.
