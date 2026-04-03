# Platform Admin Panel — Access Guide

## Quick Start

### Access URLs
- **Platform Admin Panel**: `http://localhost:5173/#/platform/login`
- **Tenant ERP App**: `http://localhost:5173/#/login`

### Default Credentials

| Role | Email / Username | Password |
|------|-----------------|----------|
| Platform Admin | `admin@zyncerp.com` | `platform_admin_123` |
| Tenant Admin | `admin` | `admin123` |

---

## Architecture

### Two-Layer Authentication
All platform routes require **two** credentials:

1. **X-Platform-Secret** — Static shared secret sent with every request (configured in frontend `.env` and backend `.env`)
2. **Platform JWT** — Obtained by logging in via `/platform/auth/login`, signed with `PLATFORM_JWT_SECRET` (separate from tenant `JWT_SECRET`)

### Routes Structure

```
/platform/auth/login          POST   — Login (needs only X-Platform-Secret)
/platform/auth/me             GET    — Current admin profile
/platform/auth/change-password POST  — Change password

/platform/dashboard           GET    — Cross-tenant overview stats
/platform/tenants             GET    — List all tenants
/platform/tenants             POST   — Provision new tenant
/platform/tenants/:id         GET    — Full tenant details + stats
/platform/tenants/:id         PATCH  — Edit tenant (name, plan, max_users, expires_at)
/platform/tenants/:id/activate    PATCH  — Activate tenant
/platform/tenants/:id/deactivate  PATCH  — Deactivate tenant
/platform/tenants/:id/stats       GET    — Usage stats for one tenant
/platform/tenants/:id/impersonate POST   — Get impersonation token
```

---

## Impersonation Flow

1. Platform admin clicks **Impersonate** on a client detail page
2. A warning dialog explains the consequences:
   - A new tab will open with the client's ERP view
   - All actions are logged in `impersonation_logs` table
   - The session expires in 2 hours
   - An orange banner indicates impersonation mode
3. On confirmation, the backend generates a special JWT:
   - Signed with `JWT_SECRET` (tenant app's secret, so tenant middleware can verify it)
   - Contains `type: 'impersonation'`, `tenantId`, `userId`, `impersonatedBy` (admin email)
   - Short expiry (2 hours by default)
4. Frontend opens a new tab to `/#/impersonate?token=<jwt>`
5. The `ImpersonationHandler` component stores the token in tenant auth store
6. The `ImpersonationBanner` component detects `type === 'impersonation'` in the JWT and shows an orange fixed banner
7. Clicking **Exit** clears the session and closes the tab

---

## Adding Platform Admins

### Via SQL

```sql
-- Generate a bcrypt hash for the password first (e.g., using Node.js):
-- const bcrypt = require('bcrypt');
-- const hash = await bcrypt.hash('your_password', 12);

INSERT INTO platform_admins (id, email, password_hash, full_name, is_active)
VALUES (
    gen_random_uuid(),
    'newadmin@zyncerp.com',
    '$2b$12$...your_bcrypt_hash_here...',
    'New Admin',
    true
);
```

### Via Node.js Script

```javascript
const bcrypt = require('bcrypt');
const db = require('./src/config/database');

async function addAdmin(email, password, fullName) {
    const hash = await bcrypt.hash(password, 12);
    await db('platform_admins').insert({
        id: db.raw('gen_random_uuid()'),
        email,
        password_hash: hash,
        full_name: fullName,
        is_active: true,
    });
    console.log(`Admin ${email} created successfully`);
    process.exit(0);
}

addAdmin('newadmin@zyncerp.com', 'secure_password_here', 'New Admin');
```

---

## Database Tables

### platform_admins

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| email | VARCHAR(255) UNIQUE | Admin login email |
| password_hash | TEXT | bcrypt hash |
| full_name | VARCHAR(255) | Display name |
| is_active | BOOLEAN | Account status |
| last_login | TIMESTAMP | Last login time |
| created_at | TIMESTAMP | Created time |
| updated_at | TIMESTAMP | Updated time |

### impersonation_logs

| Column | Type | Description |
|--------|------|-------------|
| id | UUID (PK) | Primary key |
| platform_admin_id | UUID (FK) | Admin who initiated |
| tenant_id | UUID (FK) | Target tenant |
| target_user_id | UUID | User being impersonated |
| started_at | TIMESTAMP | Session start |
| token_expires_at | TIMESTAMP | Token expiration |
| ip_address | INET | Admin's IP address |
| user_agent | TEXT | Browser user agent |

---

## Environment Variables

### Backend (.env)

```env
PLATFORM_ADMIN_SECRET=zync-platform-secret-2025          # X-Platform-Secret header value
PLATFORM_JWT_SECRET=zync-platform-jwt-secret-v1-change-in-production  # JWT signing secret
PLATFORM_JWT_EXPIRES_IN=8h                                # Platform JWT expiry
IMPERSONATION_JWT_EXPIRES_IN=2h                           # Impersonation token expiry
```

### Frontend (.env)

```env
VITE_PLATFORM_SECRET=zync-platform-secret-2025            # Must match backend PLATFORM_ADMIN_SECRET
```

---

## Security Considerations

- **Change all secrets** in production — the defaults are for development only
- Platform JWT uses a **separate signing secret** from tenant JWT
- Impersonation tokens are intentionally signed with the **tenant JWT secret** so tenant middleware can verify them
- Rate limiting: 5 login attempts per 15 minutes per IP
- All impersonation sessions are logged with IP, user agent, and timestamps
- Platform admin accounts can be deactivated to revoke access
