# GitHub Workflows Consolidation

## Summary
Consolidated **11 workflow files** into **1 essential CI workflow** to streamline continuous integration.

## New Structure

### **ci.yml** - Main CI Workflow (Consolidated)
This single workflow now includes all essential checks:

#### Jobs:
1. **Rust Build & Test**
   - Format checking (rustfmt)
   - Linting (clippy)
   - Building all features
   - Running unit tests
   - Security audit (cargo-audit)

2. **Backend Tests**
   - Node.js setup with PostgreSQL & Redis services
   - ESLint
   - TypeScript type checking
   - Build verification
   - Database migrations
   - Unit & integration tests
   - npm security audit

3. **GUI Tests**
   - Unit tests with coverage
   - E2E tests with Playwright
   - Test artifact uploads on failure

4. **Integration Tests**
   - Full stack integration
   - Rust components build (bore-server, bore-client)
   - Backend server startup
   - End-to-end integration testing

5. **Docker Build Test**
   - Docker build validation (runs only on main branch pushes)

### Deployment Workflows (Kept Separate)
These are for release management, not CI:
- **docker-publish.yml** - Publishes Docker images to GitHub Container Registry
- **mean_bean_ci.yml** - Cross-platform CI for releases
- **mean_bean_deploy.yml** - Cross-platform deployment builds

## Removed Workflows (7 files)
- ❌ **backend-ci.yml** → Merged into `ci.yml` backend job
- ❌ **code-quality.yml** → Merged into `ci.yml` rust & backend jobs
- ❌ **docker.yml** → Duplicate, kept `docker-publish.yml`
- ❌ **gui-tests.yml** → Merged into `ci.yml` gui job
- ❌ **integration-tests.yml** → Merged into `ci.yml` integration job
- ❌ **integration.yml** → Merged into `ci.yml` integration job
- ❌ **security-audit.yml** → Merged into `ci.yml` rust & backend jobs

## Benefits
✅ **Single source of truth** for CI checks  
✅ **Faster PR reviews** - one workflow status to check  
✅ **Easier maintenance** - all CI logic in one place  
✅ **Parallel execution** - jobs run concurrently  
✅ **Reduced redundancy** - no duplicate service definitions  
✅ **Better caching** - consolidated cargo and npm caches
