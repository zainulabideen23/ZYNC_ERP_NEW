# Deployment Guide (GitHub Student Developer Pack)

This guide is for deploying ZYNC ERP with a typical Student Pack setup.

## 1. Recommended Architecture

Use this split deployment:
- Backend API (Node/Express): one cloud app service
- Database: managed PostgreSQL
- Frontend (Vite static build): static host/CDN

If your current Student Pack includes DigitalOcean credit, this is the smoothest path:
- DigitalOcean App Platform for backend
- DigitalOcean Managed PostgreSQL for database
- DigitalOcean App Platform static site (or any static host)

If your offers are different, use equivalent services from your available credits.

## 2. Pre-Deploy Checklist

From your project root:
1. Run backend lint/tests
2. Run frontend lint/tests/build
3. Confirm migrations are up to date

Commands:
- npm run lint --prefix backend
- npm test --prefix backend -- --runInBand --silent
- npm run lint --prefix frontend
- npm test --prefix frontend -- --run
- npm run build --prefix frontend

## 3. Backend Deployment (Node App)

Deploy folder: backend

Build command:
- npm install

Run command:
- npm start

### Required Backend Environment Variables

Use values from backend/.env.example and set production-safe secrets.

Minimum required values:
- NODE_ENV=production
- PORT=3001
- DB_HOST
- DB_PORT
- DB_NAME
- DB_USER
- DB_PASSWORD
- DB_SSL=true
- DB_SSL_REJECT_UNAUTHORIZED=true
- JWT_SECRET
- PLATFORM_ADMIN_SECRET
- PLATFORM_JWT_SECRET
- ALLOWED_ORIGINS=https://your-frontend-domain.com
- TRUST_PROXY=1
- API_RATE_LIMIT_MAX=300
- LOGIN_RATE_LIMIT_MAX=10

Important:
- Use different strong values for JWT_SECRET and PLATFORM_JWT_SECRET.
- ALLOWED_ORIGINS must include your frontend production URL.
- Keep PLATFORM_ADMIN_SECRET private.

### Apply Migrations in Production

Run once after first deploy and on schema updates:
- npm run migrate

Optional initial data (only if needed):
- npm run seed

## 4. Frontend Deployment (Static)

Deploy folder: frontend

Build command:
- npm install && npm run build

Publish directory:
- dist

### Required Frontend Environment Variables

Use values from frontend/.env.example.

Set these in your frontend host:
- VITE_API_URL=https://your-backend-domain.com/api
- VITE_PLATFORM_API_URL=https://your-backend-domain.com/platform
- VITE_PLATFORM_SECRET=<same value as backend PLATFORM_ADMIN_SECRET>

Why this matters:
- The app has two API clients: one for /api and one for /platform.
- In production, frontend and backend are often on different domains.

## 5. CORS and Domain Wiring

Backend CORS is controlled by ALLOWED_ORIGINS.

Set ALLOWED_ORIGINS to your deployed frontend URL(s), comma-separated if needed.

Example:
- ALLOWED_ORIGINS=https://erp.example.com,https://www.erp.example.com

## 6. Health Check and Smoke Test

After deployment:
1. Open backend health endpoint:
   - https://your-backend-domain.com/api/health
2. Open frontend URL and test login
3. Test one create flow each:
   - Product create
   - Sale create
   - Purchase create
4. Test platform login and tenant listing

## 7. Suggested CI Gate (Optional)

Use GitHub Actions before deploy:
- Backend lint + tests
- Frontend lint + tests + build

Deploy only when checks pass on main branch.

## 8. Common Issues

Issue: Frontend loads but API calls fail
- Check VITE_API_URL and VITE_PLATFORM_API_URL values.
- Confirm backend URL is reachable publicly.

Issue: CORS error
- Check ALLOWED_ORIGINS includes exact frontend domain.
- Do not include trailing slash in origin values.

Issue: Platform login fails but normal login works
- Check VITE_PLATFORM_SECRET matches backend PLATFORM_ADMIN_SECRET.
- Check VITE_PLATFORM_API_URL points to backend /platform path.

Issue: Database connection fails in production
- Ensure DB_SSL is true for managed PostgreSQL.
- Verify DB host, user, password, and network allowlist settings.
