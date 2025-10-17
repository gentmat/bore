# Fix: Missing public/ directory in Docker build

## Problem
The backend Docker container was failing with:
```
ENOENT: no such file or directory, stat '/app/dist/public/signup.html'
```

## Root Cause
The Dockerfile was building TypeScript and copying the `docs/` directory to `dist/`, but was not copying the `public/` directory. At runtime, `server.ts` serves static files from `dist/public/` (line 83) and serves HTML pages from `dist/public/*.html` (lines 312-329).

## Solution
Added `RUN cp -r public dist/` to the Dockerfile after the build step, ensuring all HTML, CSS, and JS files are available at runtime.

## Files Changed
- `backend/Dockerfile` - Added public directory copy
- `Makefile` - Updated `docker-up` to always rebuild with `--build` flag

## Testing
Run `make docker-up` and verify:
- Health check passes: `curl http://localhost:3000/health`
- Signup page loads: `curl http://localhost:3000/signup`
- All HTML pages accessible: `/login`, `/signup`, `/dashboard`, `/claim-trial`, `/viewer`

## CI/CD Impact
GitHub Actions workflows (`docker-publish.yml`, `docker.yml`) will automatically use the updated Dockerfile on the next run.
