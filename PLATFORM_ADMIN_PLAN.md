# ZYNC ERP — Multi-Tenancy Platform Admin Plan

## Architecture Overview

ZYNC ERP uses **Option B: Single Database, Shared Schema with `tenant_id` columns** on every table. Each row belongs to exactly one tenant, identified by a UUID `tenant_id` foreign key referencing the `tenants` table.

### Why This Approach?
- **Simple ops**: One database to back up, monitor, and scale.
- **Cost-effective**: No per-tenant database provisioning.
- **Easy cross-tenant reporting**: Platform admin can query across tenants.
- **RLS safety net**: PostgreSQL Row-Level Security on 5 sensitive tables (sales, purchases, customers, suppliers, accounts) as a defense-in-depth layer.

---

## Tenant Lifecycle

### 1. Provisioning a New Tenant

```bash
curl -X POST http://localhost:3001/platform/tenants \
  -H "Content-Type: application/json" \
  -H "X-Platform-Secret: zync-platform-secret-2025" \
  -d '{
    "tenantName": "Acme Corp",
    "tenantSlug": "acme",
    "adminUsername": "admin",
    "adminPassword": "admin123",
    "adminEmail": "admin@acme.com",
    "adminFullName": "Acme Admin",
    "plan": "professional",
    "maxUsers": 10
  }'
```

**What gets created (in a single transaction):**
- `tenants` row (UUID, slug, plan, max_users)
- 10 account groups (Assets, Liabilities, Equity, Income, Expenses, etc.)
- 12 GL accounts (Cash, Bank, Inventory, Receivables, Payables, Sales Revenue, COGS, etc.)
- 8 units (Piece, Kg, Litre, Meter, Box, Dozen, Pair, Set)
- 8 sequences (invoice, purchase, quotation, journal, expense, customer, supplier, challan)
- 1 admin user (password hashed with bcrypt)
- 1 company_info skeleton row

### 2. Listing Tenants

```bash
curl http://localhost:3001/platform/tenants \
  -H "X-Platform-Secret: zync-platform-secret-2025"
```

### 3. Activating / Deactivating

```bash
curl -X PATCH http://localhost:3001/platform/tenants/{id}/deactivate \
  -H "X-Platform-Secret: zync-platform-secret-2025"
```

### 4. Tenant Stats

```bash
curl http://localhost:3001/platform/tenants/{id}/stats \
  -H "X-Platform-Secret: zync-platform-secret-2025"
```

Returns: user count, product count, customer count, supplier count, sales count, purchase count, total revenue.

---

## Data Isolation

### Application Layer (Primary)
- Every service constructor: `new XxxService(db, tenantId)`
- Every query: `.where('tenant_id', this.tenantId)`
- Every insert: `{ ..., tenant_id: this.tenantId }`
- Tenant middleware (`resolveTenant`) runs after `authenticate` on all `/api/*` routes except `/api/auth/login`

### Database Layer (Safety Net)
- **Row-Level Security** enabled on: `sales`, `purchases`, `customers`, `suppliers`, `accounts`
- Policies use `current_setting('app.tenant_id')` set by the tenant middleware per-connection
- Even if application code has a bug, PostgreSQL will not return rows from other tenants

### Authentication Flow
1. User POSTs `{ username, password, tenant: "slug" }` to `/api/auth/login`
2. Backend resolves tenant by slug (falls back to `DEFAULT_TENANT_SLUG`)
3. User lookup is scoped: `WHERE username = ? AND tenant_id = ?`
4. JWT payload includes `{ userId, role, tenantId }`
5. On subsequent requests, `authenticate` middleware extracts `tenantId` from JWT
6. `resolveTenant` middleware verifies tenant is still active/not expired
7. Sets `req.tenantId` for route handlers to pass to services

---

## Tables Modified

All 24 application tables have `tenant_id UUID NOT NULL REFERENCES tenants(id)`:

| Category | Tables |
|----------|--------|
| System | users, audit_logs, sequences |
| Reference | units, categories |
| Single-row | company_info |
| Accounting | account_groups, accounts, journals, ledger_entries |
| People | customers, suppliers |
| Inventory | products, stock_movements, stock_adjustments |
| Transactions | sales, sale_items, quotations, quotation_items, purchases, purchase_items, payments, expenses, expense_categories |

The `sequences` table PK changed from `(name)` to `(name, tenant_id)` so each tenant has independent numbering (SINV-000001, PUR-000001, etc.).

---

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `PLATFORM_ADMIN_SECRET` | Secret for `X-Platform-Secret` header on `/platform/*` routes | (required) |
| `DEFAULT_TENANT_SLUG` | Fallback tenant slug when login doesn't specify one | `default` |

---

## Migration

```bash
cd backend
npx knex migrate:latest
```

The migration (`20260303100000_add_multi_tenancy.js`):
1. Creates `tenants` table
2. Inserts a "Default Tenant" (slug: `default`, plan: `enterprise`)
3. Adds `tenant_id` to all 24 tables (nullable → backfill with default tenant → NOT NULL)
4. Creates indexes on `tenant_id` columns
5. Changes `sequences` PK to `(name, tenant_id)`
6. Removes the single-row trigger on `company_info`, adds `UNIQUE(tenant_id)`
7. Enables RLS on 5 tables with tenant isolation policies

**Fully reversible** with `npx knex migrate:rollback`.

---

## Future: Platform Admin Dashboard

### Phase 1 — API (Done)
- [x] Provision tenant
- [x] List tenants
- [x] Activate/deactivate
- [x] Tenant stats

### Phase 2 — Admin UI (Planned)
- [ ] `/platform/dashboard` — React page (separate from tenant UI)
- [ ] Tenant list with search, status badges, user counts
- [ ] "Create Tenant" form with validation
- [ ] Tenant detail view with stats charts
- [ ] Deactivate/reactivate toggle

### Phase 3 — Advanced (Planned)
- [ ] Tenant billing integration
- [ ] Data export per tenant
- [ ] Tenant-level configuration (logo, colors, invoice template)
- [ ] Cross-tenant analytics dashboard
- [ ] Automated tenant cleanup (expired plan → deactivate)
- [ ] Rate limiting per tenant
- [ ] Per-tenant feature flags

---

## Security Considerations

1. **Platform API** uses `X-Platform-Secret` header — NOT JWT. This is intentional for infrastructure-level operations.
2. **Tenant slug** must be lowercase alphanumeric + hyphens (validated on provisioning).
3. **JWT tokens** are tenant-scoped — a user from tenant A cannot access tenant B's data even with a valid token.
4. **RLS policies** provide database-level defense against application bugs.
5. **PLATFORM_ADMIN_SECRET** should be rotated regularly and stored securely (env vars / secrets manager).

---

## Testing Guide

### Prerequisites
```bash
cd backend
npx knex migrate:latest   # Ensure all migrations are applied
npm start                  # Start backend on port 3001
```

### Test 1: Login with Default Tenant
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","tenant":"default"}'
```
**Expected**: `{ success: true, data: { token: "...", user: {...}, tenant: { slug: "default", ... } } }`

### Test 2: Access Tenant-Scoped API
```bash
TOKEN="<paste token from login>"

# Products
curl -s http://localhost:3001/api/products -H "Authorization: Bearer $TOKEN"

# Customers
curl -s http://localhost:3001/api/customers -H "Authorization: Bearer $TOKEN"

# Accounts
curl -s http://localhost:3001/api/accounts -H "Authorization: Bearer $TOKEN"
```
**Expected**: All responses include `tenant_id` matching the default tenant UUID.

### Test 3: Provision a Second Tenant
```bash
curl -s -X POST http://localhost:3001/platform/ \
  -H "Content-Type: application/json" \
  -H "X-Platform-Secret: zync-platform-secret-2025" \
  -d '{
    "tenantName": "Acme Corp",
    "tenantSlug": "acme",
    "adminUsername": "admin",
    "adminPassword": "admin123",
    "adminEmail": "admin@acme.com",
    "adminFullName": "Acme Admin",
    "plan": "professional",
    "maxUsers": 10
  }'
```
**Expected**: Returns tenant ID, admin user details, and seed data summary.

### Test 4: Verify Tenant Isolation
```bash
# Login as Acme tenant
ACME_RESP=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","tenant":"acme"}')

ACME_TOKEN=$(echo $ACME_RESP | jq -r '.data.token')

# Acme should see ZERO products (freshly provisioned)
curl -s http://localhost:3001/api/products -H "Authorization: Bearer $ACME_TOKEN"
# Expected: { success: true, data: [], pagination: { total: 0 } }

# Default tenant should still see its 25 products
DEFAULT_RESP=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","tenant":"default"}')

DEFAULT_TOKEN=$(echo $DEFAULT_RESP | jq -r '.data.token')
curl -s http://localhost:3001/api/products -H "Authorization: Bearer $DEFAULT_TOKEN"
# Expected: { success: true, data: [...25 products...] }
```

### Test 5: Platform Tenant Management
```bash
# List all tenants
curl -s http://localhost:3001/platform/ \
  -H "X-Platform-Secret: zync-platform-secret-2025"

# Get stats for a tenant
curl -s http://localhost:3001/platform/<tenant-id>/stats \
  -H "X-Platform-Secret: zync-platform-secret-2025"

# Deactivate a tenant
curl -s -X PATCH http://localhost:3001/platform/<tenant-id>/deactivate \
  -H "X-Platform-Secret: zync-platform-secret-2025"

# Verify deactivated tenant cannot log in
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123","tenant":"acme"}'
# Expected: Error - tenant not found or inactive

# Reactivate
curl -s -X PATCH http://localhost:3001/platform/<tenant-id>/activate \
  -H "X-Platform-Secret: zync-platform-secret-2025"
```

### Test 6: Frontend Login
1. Start frontend: `cd frontend && npm run dev`
2. Navigate to `http://localhost:5174`
3. Enter Company Code: `default` (or leave blank for default)
4. Login with `admin` / `admin123`
5. Verify dashboard loads with all existing data
6. Create a product → verify it has the correct `tenant_id` in the database
