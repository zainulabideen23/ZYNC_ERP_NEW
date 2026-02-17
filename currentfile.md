# ZYNC ERP — Complete Project Documentation

## 1. Project Overview

ZYNC ERP is a modern, web-based Enterprise Resource Planning system designed for retail and wholesale businesses. It integrates Sales (POS), Inventory Management, Purchasing, Accounting, and Reporting into a single interface.

- **Version**: 1.0.0
- **License**: MIT
- **Default Credentials**: `admin / admin123`, `cashier / cashier123`, `manager / manager123`
- **Access URL**: `http://localhost:5173`

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)               │
│  Port 5173 | HashRouter | Zustand State | Axios API      │
├─────────────────────────────────────────────────────────┤
│                         ↕ HTTP (REST)                    │
├─────────────────────────────────────────────────────────┤
│                    BACKEND (Express.js)                   │
│  Port 3001 | JWT Auth | RBAC | Helmet | Morgan           │
│  17 Route Modules → 14 Service Classes                   │
├─────────────────────────────────────────────────────────┤
│                         ↕ Knex.js ORM                    │
├─────────────────────────────────────────────────────────┤
│                    DATABASE (PostgreSQL)                  │
│  24 Tables | 17 Enums | UUID PKs | Soft Deletes          │
└─────────────────────────────────────────────────────────┘
```

**Request Flow**: Browser → Vite Dev Proxy (`/api` → `localhost:3001`) → Express Middleware (Helmet → CORS → JSON parser → Morgan logger) → Route → `authenticate` middleware → Controller → Service → Knex → PostgreSQL → Response

---

## 3. Tech Stack

### 3.1 Backend Dependencies
| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server framework |
| knex | ^3.1.0 | SQL query builder / ORM |
| pg | ^8.11.3 | PostgreSQL driver |
| bcrypt | ^5.1.1 | Password hashing |
| jsonwebtoken | ^9.0.2 | JWT token generation/verification |
| helmet | ^7.1.0 | Security headers |
| cors | ^2.8.5 | Cross-Origin Resource Sharing |
| morgan | ^1.10.0 | HTTP request logging |
| winston | ^3.11.0 | Application logging (file + console) |
| dotenv | ^16.3.1 | Environment variable loading |
| express-validator | ^7.0.1 | Request validation |
| uuid | ^9.0.1 | UUID generation |
| nodemon | ^3.0.2 | Dev: auto-restart on file changes |
| jest | ^29.7.0 | Dev: testing framework |
| supertest | ^7.2.2 | Dev: HTTP assertion testing |

### 3.2 Frontend Dependencies
| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI library |
| react-dom | ^18.2.0 | React DOM renderer |
| react-router-dom | ^6.21.0 | Client-side routing (HashRouter) |
| zustand | ^4.4.7 | Lightweight state management |
| axios | ^1.6.2 | HTTP client with interceptors |
| date-fns | ^3.0.6 | Date formatting/manipulation |
| react-hot-toast | ^2.4.1 | Toast notifications |
| lucide-react | ^0.563.0 | Icon library |
| html2pdf.js | ^0.14.0 | HTML-to-PDF invoice generation |
| @tanstack/react-table | ^8.11.2 | Headless table utilities |
| vite | ^5.0.8 | Build tool / dev server |
| @vitejs/plugin-react | ^4.2.1 | React plugin for Vite |

### 3.3 NPM Scripts
**Backend**: `npm run dev` (nodemon), `npm start` (node), `npm run migrate`, `npm run seed`, `npm test`
**Frontend**: `npm run dev` (vite), `npm run build`, `npm run preview`

---

## 4. Project Structure

```
ZYNC-ERP/
├── README.md                          # Project overview, setup instructions
├── USER_MANUAL.md                     # End-user guide (5 sections)
├── currentfile.md                     # This documentation file
│
├── backend/
│   ├── package.json                   # Backend deps & scripts
│   ├── knexfile.js                    # Knex config (dev + production)
│   ├── logs/                          # Winston log output
│   │   ├── combined.log
│   │   ├── error.log
│   │   └── debug.log
│   │
│   ├── database/
│   │   ├── migrations/                # 17 migration files
│   │   │   ├── 20260118000000_create_initial_schema.js
│   │   │   ├── 20260118000001_add_purchase_status.js
│   │   │   ├── 20260118000002_add_sale_status.js
│   │   │   ├── 20260126115121_update_products_table.js
│   │   │   ├── 20260127103945_professional_schema_v1.js
│   │   │   ├── 20260127111356_add_sequences_table.js
│   │   │   ├── 20260127111659_add_code_to_account_groups.js
│   │   │   ├── 20260127113203_add_cnic_and_company_to_people.js
│   │   │   ├── 20260127113313_add_missing_columns_v1.js
│   │   │   ├── 20260127113653_fix_sales_date_check.js
│   │   │   ├── 20260127113826_drop_redundant_triggers.js
│   │   │   ├── 20260127114531_add_last_login_to_users.js
│   │   │   ├── 20260127115901_restore_expenses_and_categories.js
│   │   │   ├── 20260130100000_fix_sales_overpayment.js
│   │   │   ├── 20260130120000_drop_sales_check1.js
│   │   │   └── 20260206100000_drop_purchases_check1.js
│   │   └── seeds/
│   │       └── 001_seed_data.js       # Default data seeder
│   │
│   ├── scripts/                       # 20 utility scripts
│   │   ├── add_missing_sequences.js
│   │   ├── backup_data.js
│   │   ├── check_sequence_exact.js
│   │   ├── check_sequences.js
│   │   ├── cleanup_transactions.js
│   │   ├── clear_data.js
│   │   ├── debug_columns.js
│   │   ├── fake_migrations.js
│   │   ├── fix_invoice_sequence.js
│   │   ├── insert_sequences.js
│   │   ├── migrate_to_new_schema.js
│   │   ├── perf_test.js
│   │   ├── reset_password.js
│   │   ├── seed_categories.js
│   │   ├── seed_database.js
│   │   ├── seed_dummy_products.js
│   │   ├── show_database.js
│   │   ├── sync_all_sequences.js
│   │   ├── sync_sequences.js
│   │   ├── verify_endpoints.js
│   │   ├── verify_ledger.js
│   │   └── verify_schema.js
│   │
│   └── src/
│       ├── index.js                   # Express entry point (108 lines)
│       ├── config/
│       │   └── database.js            # Knex instance creator (12 lines)
│       ├── middleware/
│       │   ├── auth.js                # JWT auth + RBAC (57 lines)
│       │   └── errorHandler.js        # Global error handler (69 lines)
│       ├── utils/
│       │   └── logger.js              # Winston logger config (34 lines)
│       ├── routes/                    # 17 route files
│       │   ├── auth.routes.js
│       │   ├── product.routes.js
│       │   ├── customer.routes.js
│       │   ├── supplier.routes.js
│       │   ├── category.routes.js
│       │   ├── company.routes.js
│       │   ├── sale.routes.js
│       │   ├── purchase.routes.js
│       │   ├── account.routes.js
│       │   ├── report.routes.js
│       │   ├── expense.routes.js
│       │   ├── journal.routes.js
│       │   ├── user.routes.js
│       │   ├── backup.routes.js
│       │   ├── stock.routes.js
│       │   ├── quotation.routes.js
│       │   └── unit.routes.js
│       └── services/                  # 14 service files
│           ├── auth.service.js
│           ├── product.service.js
│           ├── customer.service.js
│           ├── supplier.service.js
│           ├── sale.service.js
│           ├── purchase.service.js
│           ├── expense.service.js
│           ├── journal.service.js
│           ├── quotation.service.js
│           ├── account.service.js
│           ├── report.service.js
│           ├── stock.service.js
│           ├── ledger.service.js
│           └── backup.service.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js                 # Vite config with /api proxy
    ├── index.html                     # SPA entry with CSP header
    └── src/
        ├── main.jsx                   # ReactDOM root (HashRouter + Toaster)
        ├── App.jsx                    # Route definitions (78 lines)
        ├── index.css                  # Global design system (550 lines)
        ├── store/
        │   ├── auth.store.js          # Auth state (42 lines)
        │   └── cart.store.js          # POS cart state (236 lines)
        ├── utils/
        │   └── dataSync.js            # Pub/Sub event system (69 lines)
        ├── services/
        │   └── api.js                 # Axios instance + 14 API modules (182 lines)
        ├── components/
        │   ├── Layout.jsx             # Sidebar + main content (92 lines)
        │   ├── Layout.css             # Sidebar styling (129 lines)
        │   ├── InvoicePDF.jsx         # PDF invoice generator (285 lines)
        │   └── pos/                   # POS component library
        │       ├── index.js           # Barrel export
        │       ├── pos.css            # POS styling (1442 lines)
        │       ├── ProductCard.jsx    # Product grid card (123 lines)
        │       ├── CartSidebar.jsx    # Cart drawer/panel (373 lines)
        │       ├── CustomerSelector.jsx # Customer dropdown (159 lines)
        │       ├── BarcodeInput.jsx   # Barcode scanner (120 lines)
        │       ├── POSControls.jsx    # Qty stepper + payment + tabs (153 lines)
        │       └── QuickAmountButtons.jsx # Quick cash amounts (44 lines)
        └── pages/                     # 18 page components
            ├── Dashboard.jsx + .css
            ├── Login.jsx + .css
            ├── Sales.jsx
            ├── NewSale.jsx
            ├── Purchases.jsx
            ├── NewPurchase.jsx
            ├── Products.jsx
            ├── Customers.jsx
            ├── Suppliers.jsx
            ├── Expenses.jsx + .css
            ├── Journals.jsx
            ├── Quotations.jsx
            ├── Accounts.jsx
            ├── LedgerView.jsx
            ├── StockAdjustment.jsx
            ├── Reports.jsx + .css
            ├── Settings.jsx
            └── Users.jsx
```

---

## 5. Environment Configuration

### 5.1 Backend `.env` File
```env
PORT=3001
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=your_postgres_user
DB_PASSWORD=your_postgres_password
DB_NAME=zync_erp
JWT_SECRET=your_super_secret_jwt_key
LOG_LEVEL=info
```

### 5.2 Frontend Environment
- `VITE_API_URL` — Base API URL (defaults to same origin via Vite proxy)

### 5.3 Vite Config (`vite.config.js`)
- **Dev Server**: Port 5173
- **API Proxy**: `/api` → `http://localhost:3001` (avoids CORS in development)
- **Path Alias**: `@` → `./src`
- **Build Output**: `dist/` with source maps enabled

### 5.4 Knex Config (`knexfile.js`)
- **Development**: Connects to local PostgreSQL using env vars
- **Production**: Same structure, uses production env vars
- **Migrations Directory**: `database/migrations`
- **Seeds Directory**: `database/seeds`

---

## 6. Database Schema

### 6.1 PostgreSQL Enums (17 Total)
| Enum Name | Values |
|---|---|
| user_role | admin, manager, cashier, viewer |
| account_type | asset, liability, income, expense, capital |
| payment_method | cash, bank_transfer, credit, cheque, mixed |
| payment_status | pending, partial, paid, overpaid |
| sale_status | completed, returned, cancelled |
| purchase_status | received, partial, cancelled |
| quotation_status | draft, sent, accepted, rejected, expired, converted |
| movement_type | IN, OUT |
| reference_type | purchase, sale, adjustment, opening, return |
| stock_movement_type | purchase, sale, return, adjustment, opening |
| journal_entry_type | debit, credit |
| expense_status | pending, approved, paid |
| audit_action | create, update, delete |
| discount_type | percentage, fixed |
| tax_type | inclusive, exclusive |
| adjustment_reason | damage, shrinkage, correction, count, expired, other |
| ledger_entry_type | debit, credit |

### 6.2 Tables (24 Total)

#### Core Identity Tables
| Table | Key Columns | Notes |
|---|---|---|
| `users` | id (UUID PK), username, password_hash, full_name, email, phone, role (user_role enum), is_active, last_login_at | Soft delete via is_active |
| `settings` | id (UUID PK), key (unique), value, type, description | Key-value config store |
| `sequences` | id (UUID PK), name (unique), prefix, current_value, pad_length, reset_yearly | Auto-numbering system |

#### Product & Inventory Tables
| Table | Key Columns | Notes |
|---|---|---|
| `categories` | id, name, description, is_deleted | Product categories |
| `companies` | id, name, description, is_deleted | Brands/manufacturers |
| `units` | id, name, abbreviation, is_deleted | Units of measure (pcs, kg, etc.) |
| `products` | id, code (unique), barcode (unique), name, description, category_id (FK), company_id (FK), unit_id (FK), retail_price, wholesale_price, cost_price, min_stock_level, track_stock, is_active, is_deleted | Core product catalog |
| `stock_movements` | id, product_id (FK), movement_type (IN/OUT), reference_type, reference_id, quantity, unit_cost, remaining_qty, notes | FIFO inventory tracking |

#### People Tables
| Table | Key Columns | Notes |
|---|---|---|
| `customers` | id, code, name, phone_number, phone_alt, email, cnic, company_name, address_line1, city, credit_limit, opening_balance, current_balance, account_id (FK), is_active, is_deleted | Customer master |
| `suppliers` | id, code, name, phone_number, email, cnic, company_name, address_line1, city, contact_person, opening_balance, current_balance, account_id (FK), is_active, is_deleted | Supplier master |

#### Transaction Tables
| Table | Key Columns | Notes |
|---|---|---|
| `sales` | id, invoice_number (unique), customer_id (FK), sale_date, subtotal, discount_amount, discount_percentage, tax_amount, total_amount, amount_paid, payment_method, payment_status, status, notes, quotation_id, created_by (FK), is_deleted | Sales header |
| `sale_items` | id, sale_id (FK), product_id (FK), quantity, unit_price, line_discount, tax_rate, tax_amount, total | Sale line items |
| `purchases` | id, purchase_number (unique), supplier_id (FK), purchase_date, subtotal, discount_amount, tax_amount, total_amount, amount_paid, payment_method, payment_status, status, notes, created_by (FK), is_deleted | Purchase header |
| `purchase_items` | id, purchase_id (FK), product_id (FK), quantity, unit_cost, total | Purchase line items |
| `quotations` | id, quotation_number (unique), customer_id (FK), quotation_date, valid_until, subtotal, discount_amount, discount_type, tax_rate, tax_amount, total_amount, status, notes, created_by (FK), is_deleted | Quotation header |
| `quotation_items` | id, quotation_id (FK), product_id (FK), quantity, unit_price, discount_percent, discount_amount, tax_percent, total | Quotation line items |
| `payments` | id, payment_type, reference_id, amount, payment_method, payment_date, notes, received_by (FK) | Payment records |

#### Accounting Tables
| Table | Key Columns | Notes |
|---|---|---|
| `account_groups` | id, name, type (account_type enum), code, sequence, is_system | Chart of Accounts grouping |
| `accounts` | id, code (unique), name, group_id (FK), account_type, is_bank_account, bank_name, is_system, is_active, opening_balance, current_balance | General Ledger accounts |
| `ledger_entries` | id, account_id (FK), entry_date, entry_type (debit/credit), amount, balance_after, reference_type, reference_id, description | Double-entry journal lines |
| `journals` | id, journal_number (unique), journal_date, reference_type, reference_id, description, total_amount, created_by (FK), is_deleted | Manual journal entries |
| `journal_entries` | id, journal_id (FK), account_id (FK), entry_type (debit/credit), amount, description | Journal line items |

#### Expense Tables
| Table | Key Columns | Notes |
|---|---|---|
| `expense_categories` | id, name, account_id (FK), is_deleted | Expense category master |
| `expenses` | id, expense_number (unique), category_id (FK), amount, expense_date, description, payment_method, account_id (FK), notes, created_by (FK), is_deleted | Expense records |

#### Audit Table
| Table | Key Columns | Notes |
|---|---|---|
| `audit_logs` | id, user_id (FK), action, table_name, record_id, old_values (JSONB), new_values (JSONB) | Change tracking |

### 6.3 Key Design Decisions
- **All PKs are UUIDs** — Generated via `uuid_generate_v4()`
- **Soft Deletes** — Most tables use `is_deleted` boolean (default false)
- **Timestamps** — All tables have `created_at` and `updated_at` (auto-managed)
- **Indexes** — On all foreign keys, unique constraints on codes/numbers
- **Financial Precision** — All monetary columns use `decimal(15,2)`

---

## 7. Seed Data (001_seed_data.js)

The seed file initializes the database with default master data:

| Category | Count | Details |
|---|---|---|
| Users | 3 | admin/admin123, cashier/cashier123, manager/manager123 |
| Account Groups | 10 | Bank Accounts, Cash, Inventory, Receivables, Payables, Bank Loans, Sales Revenue, COGS, Operating Expenses, Owner Capital |
| GL Accounts | 12 | Cash in Hand (1001), Bank Account (1002), Inventory (1004), Customer Receivables (1201), Supplier Payables (2001), Sales Income (4001), Sales Discount (4002), COGS (5001), Salaries (6001), Rent (6002), Marketing (6003), Owner Capital (3001) |
| Units | 8 | Piece, Kilogram, Liter, Box, Pack, Dozen, Meter, Square Meter |
| Categories | 5 | Electronics, Clothing, Groceries, Home & Garden, Sports & Outdoors |
| Companies | 3 | Generic Brand, Premium Brand, Budget Brand |
| Products | 5 | USB Cable, Wireless Mouse, T-Shirt, Rice (1kg), Coffee (500g) — with opening stock movements |
| Customers | 3 | Ahmed Khan (Karachi), Fatima Ali (Lahore), Muhammad Hassan (Islamabad) |
| Suppliers | 3 | Tech Imports Ltd, Fashion Wholesale Co, Agricultural Exports |
| Expense Categories | 6 | Salaries, Rent, Utilities, Marketing, Transportation, Office Supplies |
| Sequences | 8 | invoice (INV-), purchase (PUR-), journal (JRN-), quotation (QT-), expense (EXP-), challan (CH-), supplier (SUP-), customer (CUST-) |
| Settings | 10 | company_name, phone, email, tax_id, financial_year_start, default_tax_rate, currency_symbol (Rs.), currency_code (PKR), decimal_places, enable_discounts |

---

## 8. Backend — Middleware & Security

### 8.1 Authentication Middleware (`auth.js`)
- **`authenticate`**: Extracts JWT from `Authorization: Bearer <token>` header, verifies with `JWT_SECRET`, looks up user in database, checks `is_active` flag, attaches `req.user = { id, username, role, fullName }` to the request.
- **`authorize(...allowedRoles)`**: Factory that returns middleware checking `req.user.role` against allowed roles. Returns 403 if unauthorized.

### 8.2 Error Handler (`errorHandler.js`)
- **`AppError`** class: Custom operational error with `statusCode` and `isOperational` flag.
- **Global errorHandler**: Maps PostgreSQL error codes to user-friendly messages:
  - `23505` (unique_violation) → 409 "A record with this value already exists"
  - `23503` (foreign_key_violation) → 409 "Cannot delete, referenced elsewhere"
  - JWT errors (`JsonWebTokenError`, `TokenExpiredError`) → 401
- Prevents stack trace leaking in production.

### 8.3 Logger (`logger.js`)
- **Winston** with colorized console output + two file transports:
  - `logs/error.log` — error level only
  - `logs/combined.log` — all levels
- Format: `YYYY-MM-DD HH:mm:ss [LEVEL]: message`
- Captures stack traces for error objects.

### 8.4 CORS Configuration
- Allowed origins: `http://localhost:5173`, `http://localhost:3000`
- Credentials: enabled

### 8.5 Content Security Policy (CSP)
Set in `index.html`: `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' http://localhost:*;`

---

## 9. Backend — API Routes (17 Modules)

### 9.1 Route Registration (in `index.js`)
```
/api/auth         → auth.routes.js
/api/products     → product.routes.js
/api/customers    → customer.routes.js
/api/suppliers    → supplier.routes.js
/api/categories   → category.routes.js
/api/companies    → company.routes.js
/api/sales        → sale.routes.js
/api/purchases    → purchase.routes.js
/api/accounts     → account.routes.js
/api/reports      → report.routes.js
/api/expenses     → expense.routes.js
/api/journals     → journal.routes.js
/api/users        → user.routes.js
/api/backup       → backup.routes.js
/api/stock        → stock.routes.js
/api/quotations   → quotation.routes.js
/api/units        → unit.routes.js
/api/health       → Health check endpoint (inline)
```

### 9.2 Detailed API Endpoints

#### Auth (`/api/auth`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | /login | No | — | Login with username/password, returns JWT + user info |
| POST | /register | Yes | admin | Create new user account |
| GET | /me | Yes | all | Get current user profile |

#### Products (`/api/products`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List products (search, category, company filters, pagination) |
| GET | /all | Yes | all | All active products (no pagination, for dropdowns/POS) |
| GET | /:id | Yes | all | Get product by ID with stock info |
| POST | / | Yes | admin, manager | Create product |
| PUT | /:id | Yes | admin, manager | Update product |
| DELETE | /:id | Yes | admin | Soft delete product |

#### Customers (`/api/customers`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List customers (search, pagination) |
| GET | /all | Yes | all | All active customers (no pagination) |
| GET | /:id | Yes | all | Get customer with ledger and sales history |
| POST | / | Yes | admin, manager, cashier | Create customer + generate receivable account |
| PUT | /:id | Yes | admin, manager | Update customer |
| DELETE | /:id | Yes | admin | Soft delete customer |

#### Suppliers (`/api/suppliers`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List suppliers (search, pagination) |
| GET | /all | Yes | all | All active suppliers |
| GET | /:id | Yes | all | Get supplier with purchase history |
| POST | / | Yes | admin, manager | Create supplier + generate payable account |
| PUT | /:id | Yes | admin, manager | Update supplier |
| DELETE | /:id | Yes | admin | Soft delete supplier |

#### Sales (`/api/sales`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List sales (date range, customer, status filters) |
| GET | /:id | Yes | all | Get sale with items, customer, creator details |
| POST | / | Yes | admin, manager, cashier | Create sale (generates ledger + stock movements) |
| POST | /:id/return | Yes | admin, manager | Return a sale (reverse ledger + stock) |

#### Purchases (`/api/purchases`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List purchases (date range, supplier, status filters) |
| GET | /:id | Yes | all | Get purchase with items and supplier details |
| POST | / | Yes | admin, manager | Create purchase (generates ledger + stock IN movements) |

#### Expenses (`/api/expenses`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List expenses (date range, category filters) |
| GET | /categories | Yes | all | List expense categories |
| GET | /:id | Yes | all | Get expense details |
| POST | / | Yes | admin, manager | Create expense + generate ledger entries |
| DELETE | /:id | Yes | admin | Soft delete expense |

#### Quotations (`/api/quotations`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List quotations (date range, customer, status) |
| GET | /:id | Yes | all | Get quotation with items |
| POST | / | Yes | admin, manager, cashier | Create quotation |
| PUT | /:id/status | Yes | admin, manager | Update quotation status |
| POST | /:id/convert | Yes | admin, manager, cashier | Convert quotation to sale |

#### Accounts (`/api/accounts`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List accounts with groups |
| GET | /groups | Yes | all | List account groups |
| GET | /:id | Yes | all | Get account details |
| GET | /:id/ledger | Yes | all | Get account ledger entries (date range filter) |
| POST | / | Yes | admin | Create new account |

#### Journals (`/api/journals`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | all | List journal entries (date range, type filters) |
| GET | /:id | Yes | all | Get journal with entries (debit/credit lines) |
| POST | / | Yes | admin, manager | Create manual journal entry |

#### Reports (`/api/reports`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /dashboard | Yes | all | Dashboard statistics (today's sales, totals, recent activity) |
| GET | /stock | Yes | all | Stock report (current levels, values, low stock) |
| GET | /profit-loss | Yes | admin, manager | P&L statement (date range) |
| GET | /trial-balance | Yes | admin, manager | Trial balance report |
| GET | /balance-sheet | Yes | admin, manager | Balance sheet report |
| GET | /sales | Yes | all | Sales report (date range, grouping) |
| GET | /purchases | Yes | all | Purchases report (date range) |
| GET | /expenses | Yes | all | Expenses report (date range, by category) |

#### Stock (`/api/stock`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | /movements | Yes | all | List stock movements (product, type filters) |
| GET | /levels | Yes | all | Current stock levels for all products |
| POST | /adjust | Yes | admin, manager | Create stock adjustment (IN/OUT with reason) |

#### Users (`/api/users`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | / | Yes | admin | List all users |
| GET | /:id | Yes | admin | Get user details |
| POST | / | Yes | admin | Create user |
| PUT | /:id | Yes | admin | Update user |
| PUT | /:id/password | Yes | admin | Reset user password |
| DELETE | /:id | Yes | admin | Deactivate user |

#### Backup (`/api/backup`)
| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | /export | Yes | admin | Export database to JSON |
| POST | /import | Yes | admin | Import database from JSON |

#### Categories, Companies, Units
- Standard CRUD: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`
- All require authentication; create/update/delete restricted to admin, manager

---

## 10. Backend — Services (14 Modules)

### 10.1 Auth Service (`auth.service.js`)
- **login()**: Validates credentials, checks `is_active`, generates JWT (24h expiry), updates `last_login_at`.
- **register()**: Hashes password with bcrypt (10 rounds), creates user record.

### 10.2 Sale Service (`sale.service.js`)
**Core workflow in `create()`:**
1. Generates invoice number via `sequences` table (e.g., `INV-00045`)
2. Validates all items have sufficient stock
3. Creates sale header with payment calculation
4. Creates sale_items with line-level discounts and tax
5. For each item: creates stock OUT movement (FIFO depletion)
6. Records ledger entries via LedgerService:
   - DEBIT: Cash/Bank + Customer Receivables (if partial)
   - CREDIT: Sales Revenue
   - DEBIT: COGS / CREDIT: Inventory (for each item's FIFO cost)
7. If customer exists, updates customer balance

**Return workflow**: Reverses all ledger entries and creates stock IN movements.

### 10.3 Purchase Service (`purchase.service.js`)
**Core workflow in `create()`:**
1. Generates purchase number (PUR-XXXXX)
2. Creates purchase header and items
3. For each item: creates stock IN movement with unit cost
4. Records ledger entries:
   - DEBIT: Inventory
   - CREDIT: Cash/Bank + Supplier Payables
5. Updates supplier balance

### 10.4 LedgerService (`ledger.service.js`)
**The accounting engine** — implements full double-entry bookkeeping:
- **`recordEntry(trx, accountId, entryType, amount, referenceType, referenceId, description, date)`**: Creates a ledger entry and updates the account's `current_balance` atomically.
- **`recordSale(trx, saleData)`**: Posts sale-related entries (Cash/Bank Dr, Sales Cr, COGS Dr, Inventory Cr).
- **`recordPurchase(trx, purchaseData)`**: Posts purchase entries (Inventory Dr, Cash/Bank Cr).
- **`recordExpense(trx, expenseData)`**: Posts expense entries (Expense Account Dr, Cash/Bank Cr).
- **`reverseSale(trx, saleData)`**: Reverses all entries for a sale return.
- All operations use Knex transactions for atomicity.

### 10.5 Stock Service (`stock.service.js`)
**FIFO Inventory Management:**
- **`adjustStock(data)`**: Creates IN or OUT stock movements with reason tracking (damage, shrinkage, correction, count, expired, other).
- **Stock OUT (sale/adjustment)**: Depletes oldest stock first (FIFO) by iterating `stock_movements` ordered by `created_at ASC` where `remaining_qty > 0`.
- **Stock IN (purchase/adjustment/return)**: Creates new movement with full `remaining_qty`.
- **Cost Calculation**: FIFO cost is retrieved from the actual purchase lot being depleted.

### 10.6 Expense Service (`expense.service.js`)
- Generates expense number (EXP-XXXXX)
- Creates expense record linked to category
- Posts ledger entries: DEBIT expense category account, CREDIT cash/bank account

### 10.7 Quotation Service (`quotation.service.js`)
- Generates quotation number (QT-XXXXX) with retry loop for duplicate handling
- Creates quotation with line items (unit price, discount percent, tax percent)
- Status management: draft → sent → accepted/rejected/expired
- **Convert to Sale**: Loads quotation data and creates a sale via SaleService

### 10.8 Journal Service (`journal.service.js`)
- Creates manual journal entries with balanced debit/credit lines
- Validates total debits = total credits before posting
- Each line creates a ledger entry via LedgerService

### 10.9 Report Service (`report.service.js`)
- **Dashboard**: Today's sales (count + total), total customers, total products, recent sales, low stock alerts
- **Stock Report**: Product-level stock with current quantity, value, and status
- **P&L**: Revenue minus COGS minus Expenses for date range
- **Trial Balance**: All accounts with debit/credit totals
- **Balance Sheet**: Assets, Liabilities, Capital with totals

### 10.10 Other Services
- **Product Service**: CRUD with stock level calculations, search, filtering
- **Customer Service**: CRUD with auto-generated receivable accounts, balance tracking
- **Supplier Service**: CRUD with auto-generated payable accounts
- **Account Service**: Chart of accounts management, ledger querying
- **Backup Service**: Full database export/import as JSON

---

## 11. Frontend — Architecture

### 11.1 Entry Point (`main.jsx`)
```jsx
<React.StrictMode>
    <HashRouter>
        <App />
        <Toaster position="top-right" duration={3000}
            style={{ background: '#1f2937', color: '#f9fafb' }} />
    </HashRouter>
</React.StrictMode>
```
- Uses **HashRouter** (hash-based URLs for Electron compatibility)
- Global **Toaster** for notifications (dark theme)

### 11.2 Routing (`App.jsx` — 78 lines)
All routes wrapped in `<Layout>` component (except Login):

| Route | Component | Protection |
|---|---|---|
| `/login` | Login | Public |
| `/` | Dashboard | Protected |
| `/sales` | Sales | Protected |
| `/sales/new` | NewSale | Protected |
| `/purchases` | Purchases | Protected |
| `/purchases/new` | NewPurchase | Protected |
| `/products` | Products | Protected |
| `/customers` | Customers | Protected |
| `/suppliers` | Suppliers | Protected |
| `/expenses` | Expenses | Protected |
| `/journals` | Journals | Protected |
| `/quotations` | Quotations | Protected |
| `/accounts` | Accounts | Protected |
| `/accounts/:id/ledger` | LedgerView | Protected |
| `/stock/adjust` | StockAdjustment | Protected |
| `/reports` | Reports | Protected |
| `/settings` | Settings | Protected |
| `/users` | Users | Protected |

**ProtectedRoute**: Checks `auth.store.isAuthenticated`; redirects to `/login` if false.

### 11.3 State Management

#### Auth Store (`auth.store.js` — Zustand, persisted)
```
State: { user, token, isAuthenticated }
Actions: login(userData, token), logout(), getToken(), hasRole(role)
Storage: localStorage key 'auth-storage'
```

#### Cart Store (`cart.store.js` — Zustand, persisted, 236 lines)
Full POS cart state with rich actions:
```
State: {
  items[], customer, globalDiscount, taxRate, paymentMethod,
  paidAmount, notes
}
Actions:
  addItem(product)          — Add or increment item
  removeItem(productId)     — Remove item from cart
  updateQuantity(id, qty)   — Set item quantity
  updateItemPrice(id, price) — Override item price
  updateItemDiscount(id, disc) — Set per-item discount
  setCustomer(customer)     — Set sale customer
  setGlobalDiscount(amount) — Set global discount
  setTaxRate(rate)          — Set tax rate
  setPaymentMethod(method)  — cash/bank_transfer/credit
  setPaidAmount(amount)     — Set amount paid
  setNotes(text)            — Set sale notes
  getSaleData()             — Compile cart into sale API payload
  loadFromQuotation(quot)   — Load quotation into cart
  clearCart()               — Reset all state
Computed (via get):
  subtotal, discountAmount, afterDiscount, taxAmount, total,
  changeAmount, itemCount
Storage: localStorage key 'cart-storage'
```

### 11.4 API Service Layer (`api.js` — 182 lines)
**Axios Instance Configuration:**
- Base URL: `/api` (proxied by Vite)
- Request interceptor: Injects `Authorization: Bearer <token>` from auth store
- Response interceptor: On 401, triggers `logout()` and redirects to `/login`

**14 API Modules:**

| Module | Key Methods |
|---|---|
| `authAPI` | login, register, getProfile |
| `productsAPI` | getAll, getAllNoPagination, get, create, update, delete |
| `customersAPI` | getAll, getAllNoPagination, get, create, update, delete |
| `suppliersAPI` | getAll, getAllNoPagination, get, create, update, delete |
| `salesAPI` | getAll, get, create, return |
| `purchasesAPI` | getAll, get, create |
| `categoriesAPI` | getAll, create, update, delete |
| `companiesAPI` | getAll, create, update, delete |
| `unitsAPI` | getAll |
| `accountsAPI` | getAll, getGroups, get, getLedger, create |
| `reportsAPI` | dashboard, stock, profitLoss, trialBalance, balanceSheet, sales, purchases, expenses |
| `expensesAPI` | getAll, getCategories, get, create, delete |
| `journalsAPI` | getAll, get, create |
| `quotationsAPI` | getAll, get, create, updateStatus, convert |
| `stockAPI` | getMovements, getLevels, adjust |
| `usersAPI` | getAll, get, create, update, resetPassword, delete |
| `backupAPI` | export, import |
| `settingsAPI` | getAll, update |

### 11.5 Data Synchronization (`dataSync.js` — Pub/Sub)
Custom event bus for cross-component communication:
```
Events: SALE_CREATED, PURCHASE_CREATED, PRODUCT_UPDATED,
        CUSTOMER_UPDATED, EXPENSE_CREATED, STOCK_ADJUSTED,
        JOURNAL_CREATED, QUOTATION_CREATED, QUOTATION_CONVERTED,
        SETTINGS_UPDATED
Methods: subscribe(event, callback), publish(event, data),
         unsubscribe(event, callback)
```
Components subscribe on mount and unsubscribe on unmount to auto-refresh data.

---

## 12. Frontend — Pages (18 Total)

### 12.1 Login Page (`Login.jsx` + `Login.css`)
- Centered card with gradient background
- Username + password fields
- Calls `authAPI.login()`, stores result in auth store
- Redirects to Dashboard on success
- Gradient logo: blue → purple

### 12.2 Dashboard (`Dashboard.jsx` + `Dashboard.css` — 350+ lines)
- **4 stat cards**: Today's Sales, Total Customers, Total Products, Total Revenue (with gradient icon backgrounds: blue, green, orange, purple)
- **Bar chart**: Last 7 days sales visualization (CSS-only, no chart library)
- **Activity feed**: Recent sales and purchases with timestamps
- **Quick actions**: 4-button grid linking to New Sale, New Purchase, Products, Reports
- Subscribes to `dataSync` for real-time updates

### 12.3 NewSale / POS Page (`NewSale.jsx` — 400+ lines)
The most complex page — a full Point of Sale terminal:
- **Left panel**: Product grid with search, category tabs, barcode input
- **Right panel**: Cart sidebar (drawer on <1440px, docked on ≥1440px)
- **Product interaction**: Click to add, flash animation, in-cart pill badge
- **Cart features**: Quantity stepper, per-item price/discount editing, delete on qty=0
- **Payment**: Method toggle (cash/bank/credit), paid amount input, quick amount buttons, change calculation
- **Customer**: Searchable dropdown with keyboard navigation
- **Checkout**: Validates stock, calls `salesAPI.create()`, publishes `SALE_CREATED`
- **Keyboard shortcuts**: `Ctrl+B` (barcode), `Escape` (close cart)
- **Invoice**: After sale, option to generate PDF via InvoicePDF component

### 12.4 Sales List (`Sales.jsx`)
- Table with invoice number, customer, date, total, payment status, actions
- Date range filtering
- Status badges: completed (green), returned (red), cancelled (grey)
- View details modal with sale items
- Return sale functionality
- PDF invoice download per sale

### 12.5 NewPurchase (`NewPurchase.jsx`)
- Supplier selection dropdown
- Dynamic item rows: product picker, quantity, unit cost, line total
- Add/remove item rows
- Payment method and amount
- Purchase number auto-generated
- Creates purchase with stock IN + ledger entries

### 12.6 Purchases List (`Purchases.jsx`)
- Filterable table by date range, supplier, status
- View purchase details modal
- Payment status tracking

### 12.7 Products (`Products.jsx`)
- Searchable, filterable product table (by category, company)
- Add/Edit product modal with all fields (code, barcode, name, prices, category, company, unit, min stock)
- Stock level display with color-coded badges
- Soft delete with confirmation

### 12.8 Customers (`Customers.jsx`)
- Table with search, pagination
- Add/Edit modal (name, phone, email, CNIC, company, address, city, credit limit, opening balance)
- View customer details with balance and sales history
- Auto-generates customer code (CUST-XXXXX)

### 12.9 Suppliers (`Suppliers.jsx`)
- Similar to Customers page
- Add/Edit modal with supplier-specific fields (contact person, company)
- Auto-generates supplier code (SUP-XXXXX)

### 12.10 Expenses (`Expenses.jsx` + `Expenses.css` — 350+ lines)
- **Stats cards**: Total expenses, count, average (with gradient accents and hover animations)
- Date range filtering
- Expenses table with category, amount, date, payment method
- Add expense modal with category dropdown, amount, date, description, payment method
- Expense categories from API

### 12.11 Quotations (`Quotations.jsx`)
- Quotation list with status management
- Status flow: Draft → Sent → Accepted/Rejected/Expired → Converted
- View quotation details
- **Convert to Sale**: One-click conversion loads quotation into POS cart
- Status badge colors per state

### 12.12 Journals (`Journals.jsx`)
- Journal entry list with date range filtering
- View journal details modal showing debit/credit lines
- Create journal entry modal:
  - Dynamic rows for debit/credit entries
  - Account selector per row
  - Auto-validates total debits = total credits
  - Description and date fields

### 12.13 Accounts / Chart of Accounts (`Accounts.jsx`)
- Grouped by account type (Asset, Liability, Income, Expense, Capital)
- Shows account groups with nested accounts
- Account balance display
- Click account to navigate to ledger view
- Add new account modal

### 12.14 Ledger View (`LedgerView.jsx`)
- Full ledger for a specific account
- Date range filtering
- Shows: date, description, reference, debit, credit, running balance
- Opening and closing balance display

### 12.15 Stock Adjustment (`StockAdjustment.jsx`)
- Product selector dropdown
- Current stock display
- Adjustment type: IN or OUT
- Quantity and reason (damage, shrinkage, correction, count, expired, other)
- Notes field
- Creates stock movement via API

### 12.16 Reports (`Reports.jsx` + `Reports.css`)
**Tabbed report interface with 8 report types:**
1. **Dashboard**: Summary statistics
2. **Stock Report**: Current levels, values, low stock alerts
3. **Profit & Loss**: Revenue - COGS - Expenses with date range
4. **Trial Balance**: All accounts with debit/credit totals, balanced check
5. **Balance Sheet**: Assets = Liabilities + Capital
6. **Sales Report**: Sales data by date range
7. **Purchases Report**: Purchase data by date range
8. **Expenses Report**: Expense data by category

Financial statements use specialized CSS: `.statement-row`, `.statement-section`, `.balanced-badge`

### 12.17 Settings (`Settings.jsx`)
- Key-value settings editor
- Fields: Company Name, Phone, Email, Tax ID, Financial Year Start, Default Tax Rate, Currency Symbol, Currency Code, Decimal Places, Enable Discounts
- Save updates to API

### 12.18 Users (`Users.jsx`)
- User management table (admin only)
- Add/Edit user modal: username, full name, email, phone, role (dropdown), is_active
- Password reset functionality
- Role assignment: admin, manager, cashier, viewer

---

## 13. Frontend — Components

### 13.1 Layout Component (`Layout.jsx` + `Layout.css`)
- **Fixed sidebar** (240px wide) with:
  - Gradient logo ("ZYNC" with blue→purple gradient)
  - Navigation links with emoji icons and active state highlighting
  - "New Sale" quick action button
  - User info (name + role) and logout button
- **Main content area**: `margin-left: 240px`, renders `<Outlet />`
- **Responsive**: Sidebar slides off-screen on mobile (<768px)

**Navigation Items:**
Dashboard, Products, Customers, Suppliers, Sales, New Sale, Purchases, New Purchase, Quotations, Expenses, Journals, Accounts, Stock Adjust, Reports, Settings, Users

### 13.2 POS Component Library

#### ProductCard (`ProductCard.jsx` — 123 lines)
- Memoized with `React.memo` and custom equality check
- **Visual states**: Default (dark card), In-cart (green tint + pill badge), Low stock (amber strip), Out of stock (red strip + dimmed)
- **Status strip**: 6px left border via `::before` pseudo-element
- **In-cart pill**: Shows cart icon + quantity, solid green with shadow
- **Just-added animation**: Scale + blue flash (400ms)
- **Layout**: Card header (name + stock badge), product code, card footer (price + in-cart pill)

#### CartSidebar (`CartSidebar.jsx` — 373 lines)
- **Drawer mode** (<1440px): Slides in from right with backdrop blur overlay
- **Docked mode** (≥1440px): Fixed panel, no overlay
- **3 regions**: Fixed header, scrollable items list, fixed footer
- **Cart items**: QuantityStepper, inline price editing, per-item discount, delete button, FIFO cost display
- **Footer section**: Global discount input, tax display, payment method toggle, paid amount + quick amount buttons, change calculation, complete sale button
- **Keyboard**: Escape to close

#### CustomerSelector (`CustomerSelector.jsx` — 159 lines)
- Searchable dropdown with debounced input
- Keyboard navigation (↑↓ arrows, Enter to select, Escape to close)
- Shows customer name, phone, balance
- "Walk-in Customer" option (no customer selected)
- Clear button to deselect

#### BarcodeInput (`BarcodeInput.jsx` — 120 lines)
- **Scanner detection**: Listens for fast keypress sequences (>3 chars in <100ms) ending with Enter
- **Manual entry**: Toggle form with `Ctrl+B` shortcut
- Matches by `product.barcode` or `product.code`
- Returns matched product or null (parent handles not-found)

#### POSControls (`POSControls.jsx` — 153 lines)
Three sub-components:
- **QuantityStepper**: ±buttons + editable number input, min/max clamping, blur validation
- **PaymentToggle**: Segmented button group (💵 Cash, 🏦 Bank, 💳 Credit)
- **CategoryTabs**: Horizontal scrollable pill tabs with "All" default

#### QuickAmountButtons (`QuickAmountButtons.jsx` — 44 lines)
- Generates smart cash suggestions: exact amount, rounded to 50, 100, 500, 1000
- Deduplicates and caps at 4 buttons
- "Exact" label on first button
- Selected state with green border

### 13.3 InvoicePDF (`InvoicePDF.jsx` — 285 lines)
- **`generateInvoicePDF(saleData, companyName)`**: Builds HTML template with company header, customer details, item table, totals, payment info, and footer
- Uses `html2pdf.js` to convert HTML → PDF blob → triggers download
- **`InvoicePDFButton`**: React component wrapping the function with loading state

---

## 14. Frontend — Design System (`index.css` — 550 lines)

### 14.1 CSS Variables (Design Tokens)
```css
/* Dark Theme Colors */
--color-bg-primary: #0f172a;      /* Main background */
--color-bg-secondary: #1e293b;    /* Cards, sidebar */
--color-bg-tertiary: #334155;     /* Table headers, hover */
--color-bg-hover: #475569;        /* Active hover state */
--color-text-primary: #f8fafc;    /* Main text */
--color-text-secondary: #94a3b8;  /* Muted text */
--color-text-muted: #64748b;      /* Disabled text */
--color-accent: #3b82f6;          /* Primary actions (blue) */
--color-success: #22c55e;         /* Success states (green) */
--color-warning: #f59e0b;         /* Warning states (amber) */
--color-danger: #ef4444;          /* Error states (red) */
--color-info: #06b6d4;            /* Info states (cyan) */
--font-sans: 'Inter', system-ui;  /* Primary font */
--font-mono: 'JetBrains Mono';    /* Code/numbers font */
```

### 14.2 Component Styles
- **Buttons**: `.btn-primary` (blue), `.btn-secondary` (grey), `.btn-success` (green), `.btn-danger` (red), `.btn-ghost` (transparent)
- **Forms**: `.form-group`, `.form-label`, `.form-input`, `.form-select`, `.form-textarea` with focus ring
- **Cards**: `.card` with border, radius-lg, padding
- **Tables**: `.table` with hover rows, uppercase headers
- **Badges**: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-ghost-*`
- **Stats**: `.stat-card`, `.stat-value`, `.stat-label`, `.stat-change`
- **Grid**: `.grid-2`, `.grid-3`, `.grid-4` with responsive breakpoints
- **Neon Effects**: `.neon-success`, `.neon-danger`, `.neon-warning` (glow shadows)

### 14.3 POS Styles (`pos.css` — 1442 lines)
Comprehensive styling for the POS interface:
- **Design tokens**: State colors (neutral, selected, in-cart, low-stock, out-stock, flash)
- **Product cards**: Dark cards (#1e293b) with 6px status strips, hover elevation, selection border, in-cart gradient tint, just-added flash animation
- **Cart sidebar**: 460px drawer with slide animation, backdrop blur, 3-region flex layout
- **Cart items**: Selection states, inline editing, swipe-to-delete, item total display
- **Responsive**: Cart docks at ≥1440px, drawer mode below

---

## 15. Authentication & Authorization Flow

### 15.1 Login Flow
1. User submits username + password → `POST /api/auth/login`
2. Backend: Validates credentials, checks `is_active`, generates JWT (24h TTL)
3. Frontend: Stores `{ user, token }` in Zustand auth store (persisted to localStorage)
4. Axios interceptor automatically attaches `Authorization: Bearer <token>` to all requests
5. On token expiry/401: Interceptor calls `logout()`, redirects to `/login`

### 15.2 Role-Based Access Control
| Role | Permissions |
|---|---|
| **admin** | Full access: all CRUD, user management, reports, settings, backup |
| **manager** | Create/edit sales, purchases, expenses, products, customers, suppliers, quotations, journals; access reports |
| **cashier** | Create sales, create quotations, view products/customers |
| **viewer** | Read-only access to all data |

### 15.3 Password Security
- Hashed with bcrypt (10 salt rounds)
- No plaintext storage
- Admin can reset any user's password

---

## 16. Double-Entry Accounting Engine

### 16.1 Account Types
| Type | Normal Balance | Examples |
|---|---|---|
| Asset | Debit | Cash, Bank, Inventory, Receivables |
| Liability | Credit | Payables, Bank Loans |
| Capital | Credit | Owner Capital |
| Income | Credit | Sales Revenue |
| Expense | Debit | COGS, Salaries, Rent |

### 16.2 Ledger Entry Examples

**Sale (Cash, Rs. 1,000):**
| Account | Debit | Credit |
|---|---|---|
| Cash in Hand | 1,000 | — |
| Sales Revenue | — | 1,000 |
| COGS | 600 | — |
| Inventory | — | 600 |

**Purchase (Bank Transfer, Rs. 5,000):**
| Account | Debit | Credit |
|---|---|---|
| Inventory | 5,000 | — |
| Bank Account | — | 5,000 |

**Expense (Cash, Rs. 500):**
| Account | Debit | Credit |
|---|---|---|
| Expense Account | 500 | — |
| Cash in Hand | — | 500 |

### 16.3 Balance Tracking
- Each ledger entry updates the account's `current_balance` atomically
- `balance_after` recorded per entry for running balance display
- Trial balance validates total debits = total credits

---

## 17. FIFO Inventory System

### 17.1 Stock Movement Types
| Type | Direction | Trigger |
|---|---|---|
| Purchase | IN | New purchase created |
| Opening | IN | Seed data / initial stock |
| Return | IN | Sale return |
| Adjustment (IN) | IN | Manual stock adjustment |
| Sale | OUT | Sale completed |
| Adjustment (OUT) | OUT | Manual stock adjustment (damage, etc.) |

### 17.2 FIFO Depletion Algorithm
When stock goes OUT (sale or adjustment):
1. Query `stock_movements` WHERE `product_id = X` AND `movement_type = 'IN'` AND `remaining_qty > 0` ORDER BY `created_at ASC`
2. Iterate through oldest lots first
3. Deduct from `remaining_qty` of each lot until total quantity fulfilled
4. Calculate COGS based on actual `unit_cost` of each depleted lot
5. This ensures First-In, First-Out costing

### 17.3 Current Stock Calculation
`Current Stock = SUM(remaining_qty) WHERE movement_type = 'IN' AND remaining_qty > 0`

---

## 18. Auto-Numbering System (Sequences)

The `sequences` table provides configurable auto-incrementing document numbers:

| Sequence | Prefix | Example | Used By |
|---|---|---|---|
| invoice | INV- | INV-00001 | Sales |
| purchase | PUR- | PUR-00001 | Purchases |
| journal | JRN- | JRN-00001 | Journals |
| quotation | QT- | QT-00001 | Quotations |
| expense | EXP- | EXP-00001 | Expenses |
| challan | CH- | CH-00001 | Delivery challans |
| supplier | SUP- | SUP-00001 | Supplier codes |
| customer | CUST- | CUST-00001 | Customer codes |

**Generation Logic**: Read `current_value` → increment → pad with zeros (`pad_length`) → prepend `prefix` → save new value. Uses database transactions to prevent duplicates.

---

## 19. Utility Scripts (20 Total)

| Script | Purpose |
|---|---|
| `backup_data.js` | Export database tables to JSON file |
| `clear_data.js` | Truncate all transaction data (keep master data) |
| `reset_password.js` | Reset a user's password via CLI |
| `seed_database.js` | Run the seed data script |
| `seed_categories.js` | Seed product categories |
| `seed_dummy_products.js` | Generate dummy products for testing |
| `show_database.js` | Display database tables and counts |
| `verify_schema.js` | Verify all tables and columns exist |
| `verify_endpoints.js` | Test all API endpoints |
| `verify_ledger.js` | Validate ledger balance integrity |
| `sync_sequences.js` | Sync sequence counters with actual data |
| `sync_all_sequences.js` | Sync all sequence types |
| `add_missing_sequences.js` | Add any missing sequence records |
| `check_sequences.js` | Display current sequence values |
| `check_sequence_exact.js` | Check specific sequence value |
| `insert_sequences.js` | Insert sequence records manually |
| `fix_invoice_sequence.js` | Fix invoice sequence counter |
| `fake_migrations.js` | Mark migrations as run without executing |
| `migrate_to_new_schema.js` | Migrate data to new schema format |
| `debug_columns.js` | Debug column definitions |
| `cleanup_transactions.js` | Clean up orphaned transaction data |
| `perf_test.js` | Performance testing script |

---

## 20. Known Issues & Bug Fixes

### 20.1 Resolved: Journals Detail Modal TypeError
**Problem**: Clicking "View" on a journal entry crashed with `TypeError: Cannot read property 'toUpperCase' of undefined` on line 237 of `Journals.jsx`.
**Root Cause**: The modal template used `viewingJournal.journal_type` and `viewingJournal.narration`, but the API returns `reference_type` and `description`.
**Fix**: Updated field names:
```diff
- <div><strong>Source:</strong> {viewingJournal.journal_type.toUpperCase()}</div>
+ <div><strong>Source:</strong> {viewingJournal.reference_type?.toUpperCase()}</div>
- <div><strong>Narration:</strong> {viewingJournal.narration}</div>
+ <div><strong>Narration:</strong> {viewingJournal.description || viewingJournal.narration}</div>
```

---

## 21. Feature Status Summary

| Feature | Status | Notes |
|---|---|---|
| JWT Authentication | ✅ Complete | Login, register, token refresh |
| Role-Based Access | ✅ Complete | 4 roles with route-level guards |
| Product Management | ✅ Complete | Full CRUD with categories, companies, units |
| Customer Management | ✅ Complete | CRUD with auto-generated accounts |
| Supplier Management | ✅ Complete | CRUD with auto-generated accounts |
| Point of Sale (POS) | ✅ Complete | Full-featured with barcode, cart, payments |
| Sales Management | ✅ Complete | Create, list, view, return |
| Purchase Management | ✅ Complete | Create, list, view |
| Quotation Management | ✅ Complete | CRUD + convert to sale |
| Expense Tracking | ✅ Complete | Create, list with categories |
| Journal Entries | ✅ Complete | Manual double-entry journals |
| Chart of Accounts | ✅ Complete | Grouped accounts with ledger view |
| Double-Entry Accounting | ✅ Complete | Full ledger with atomic transactions |
| FIFO Inventory | ✅ Complete | Stock movements with cost tracking |
| Stock Adjustments | ✅ Complete | IN/OUT with reason tracking |
| Financial Reports | ✅ Complete | P&L, Trial Balance, Balance Sheet |
| Dashboard | ✅ Complete | Stats, charts, activity feed |
| Invoice PDF | ✅ Complete | HTML-to-PDF generation |
| Auto-Numbering | ✅ Complete | 8 configurable sequences |
| User Management | ✅ Complete | Admin-only CRUD |
| Settings | ✅ Complete | Key-value configuration |
| Backup/Restore | ✅ Complete | JSON export/import |
| Data Sync | ✅ Complete | Pub/sub event system |
| Barcode Scanner | ✅ Complete | Hardware scanner + manual entry |
| Responsive Design | ⚠️ Partial | POS adapts at 1440px; other pages have basic mobile support |
| Audit Logging | ⚠️ Schema Only | Table exists but not populated by services |
| Multi-Company | ❌ Not Started | Schema supports but not implemented |
| Email Notifications | ❌ Not Started | Not implemented |
| File Attachments | ❌ Not Started | Not implemented |

---

*Document generated by comprehensive codebase analysis. All 80+ source files were reviewed.*
