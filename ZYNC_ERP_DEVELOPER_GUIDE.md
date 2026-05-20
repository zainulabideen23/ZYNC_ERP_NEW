# ZYNC ERP — Complete Developer Guide

**Version:** 1.0  
**Last Updated:** March 2026  
**Stack:** React 18 + Vite | Node.js + Express | PostgreSQL + Knex.js

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Frontend Pages](#5-frontend-pages)
6. [Frontend Components](#6-frontend-components)
7. [State Management](#7-state-management)
8. [Frontend Services & API](#8-frontend-services--api)
9. [Frontend Utilities](#9-frontend-utilities)
10. [CSS & Styling](#10-css--styling)
11. [Backend Architecture](#11-backend-architecture)
12. [Database Migrations](#12-database-migrations)
13. [Database Schema](#13-database-schema)
14. [Database Seeds](#14-database-seeds)
15. [Backend Middleware](#15-backend-middleware)
16. [Backend Routes](#16-backend-routes)
17. [Backend Services](#17-backend-services)
18. [Key Business Logic](#18-key-business-logic)
19. [System Constants](#19-system-constants)
20. [Authentication & Security](#20-authentication--security)
21. [Multi-Tenant Architecture](#21-multi-tenant-architecture)
22. [Platform Admin System](#22-platform-admin-system)
23. [Testing](#23-testing)
24. [Scripts](#24-scripts)
25. [Development Setup](#25-development-setup)
26. [Code Conventions](#26-code-conventions)
27. [Common Patterns](#27-common-patterns)

---

## 1. Project Overview

**ZYNC ERP** is a modern, multi-tenant Enterprise Resource Planning system designed for retail and wholesale businesses in Pakistan. It integrates:

- **Point of Sale (POS)** — Fast checkout with barcode scanning, cart management
- **Inventory Management** — Real-time stock tracking, FIFO cost calculation, low stock alerts
- **Purchase Management** — Supplier orders, receiving, returns
- **Accounting** — Double-entry bookkeeping, trial balance, P&L, balance sheet
- **Customer Relationship Management** — Customer accounts, credit limits, receivables
- **Supplier Management** — Payables tracking
- **Expense Tracking** — Categorized operational expenses
- **Quotations** — Convert to sales
- **Platform Administration** — Multi-tenant SaaS management with impersonation

### Key Characteristics

- **Multi-tenant SaaS** — Single PostgreSQL database serves multiple tenant organizations
- **Double-entry accounting** — Every financial transaction creates balanced journal entries
- **FIFO inventory costing** — First-In-First-Out for COGS and stock valuation
- **Role-based access control** — Admin, Manager, Cashier roles
- **Setup wizard onboarding** — 4-step guided setup for new tenants
- **Audit logging** — Comprehensive activity tracking
- **Soft deletes** — No permanent data deletion

---

## 2. Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework |
| Vite | 6.x | Build tool & dev server |
| React Router | 7.x | Client-side routing (HashRouter) |
| Axios | 1.x | HTTP client |
| Zustand | 5.x | State management |
| date-fns | 4.x | Date formatting |
| react-hot-toast | 2.x | Toast notifications |
| lucide-react | 0.x | Icon library |
| Tailwind CSS | 4.x | Utility CSS (via CDN) |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20.x | JavaScript runtime |
| Express | 4.x | Web framework |
| Knex.js | 3.x | SQL query builder & migrations |
| PostgreSQL | 13+ | Relational database |
| jsonwebtoken | 9.x | JWT authentication |
| bcryptjs | 2.x | Password hashing |
| cors | 2.x | CORS middleware |
| dotenv | 16.x | Environment variables |
| express-validator | 7.x | Input validation |

---

## 3. Directory Structure

```
ZYNC_ERP_NEW/
├── package.json              # Root workspace config
├── opencode.json             # AI tool config
├── .gitignore
├── README.md
├── PLATFORM_ADMIN_GUIDE.md
├── PLATFORM_ADMIN_PLAN.md
├── ZYNC_ERP_DEVELOPER_GUIDE.md   # This file
│
├── backend/
│   ├── package.json
│   ├── knexfile.js               # Knex configuration
│   ├── .env.example              # Environment template
│   ├── .env                       # Local env (gitignored)
│   │
│   ├── src/
│   │   ├── index.js               # Express app entry point
│   │   │
│   │   ├── config/
│   │   │   └── database.js        # Knex instance & connection
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verification & authorize()
│   │   │   ├── tenant.js          # Tenant resolution & RLS
│   │   │   ├── platformAuth.js    # Platform admin authentication
│   │   │   └── errorHandler.js    # Global error handler
│   │   │
│   │   ├── routes/
│   │   │   ├── account.routes.js
│   │   │   ├── auditlog.routes.js
│   │   │   ├── auth.routes.js
│   │   │   ├── backup.routes.js
│   │   │   ├── brand.routes.js
│   │   │   ├── category.routes.js
│   │   │   ├── customer.routes.js
│   │   │   ├── dashboard.routes.js
│   │   │   ├── expense.routes.js
│   │   │   ├── journal.routes.js
│   │   │   ├── onboarding.routes.js
│   │   │   ├── platform.auth.routes.js
│   │   │   ├── product.routes.js
│   │   │   ├── purchase.routes.js
│   │   │   ├── quotation.routes.js
│   │   │   ├── report.routes.js
│   │   │   ├── sale.routes.js
│   │   │   ├── settings.routes.js
│   │   │   ├── stock.routes.js
│   │   │   ├── supplier.routes.js
│   │   │   ├── tenants.routes.js
│   │   │   ├── unit.routes.js
│   │   │   └── user.routes.js
│   │   │
│   │   ├── services/
│   │   │   ├── account.service.js
│   │   │   ├── audit.service.js
│   │   │   ├── backup.service.js
│   │   │   ├── customer.service.js
│   │   │   ├── expense.service.js
│   │   │   ├── ledger.service.js
│   │   │   ├── product.service.js
│   │   │   ├── purchase.service.js
│   │   │   ├── quotation.service.js
│   │   │   ├── report.service.js
│   │   │   ├── sale.service.js
│   │   │   ├── sequence.service.js
│   │   │   ├── stock.service.js
│   │   │   ├── supplier.service.js
│   │   │   └── tenantProvisioning.service.js
│   │   │
│   │   ├── utils/
│   │   │   ├── audit.js           # Audit log helper
│   │   │   ├── logger.js          # Logging utility
│   │   │   ├── tenantQuery.js     # Tenant-scoped queries
│   │   │   └── accountResolver.js # GL account resolution
│   │   │
│   │   ├── validators/
│   │   │   └── phone.validator.js # Pakistani phone validation
│   │   │
│   │   └── constants/
│   │       └── accounts.js        # GL account codes & names
│   │
│   ├── database/
│   │   ├── migrations/             # 33 migration files
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
│   │   │   ├── 20260206100000_drop_purchases_check1.js
│   │   │   ├── 20260302100000_fix_account_groups.js
│   │   │   ├── 20260302100001_fix_accounts.js
│   │   │   ├── 20260302100002_add_ledger_safeguards.js
│   │   │   ├── 20260303100000_add_multi_tenancy.js
│   │   │   ├── 20260304100000_add_platform_admins.js
│   │   │   ├── 20260304200000_remove_viewer_role.js
│   │   │   ├── 20260304200001_add_phone_format_constraints.js
│   │   │   ├── 20260304200002_fix_sequences_table.js
│   │   │   ├── 20260304200003_extend_audit_action_enum.js
│   │   │   ├── 20260304200004_make_audit_user_id_nullable.js
│   │   │   ├── 20260305100000_add_onboarding_and_company_info.js
│   │   │   ├── 20260305110000_create_brands_table.js
│   │   │   ├── 20260306100000_separate_company_info.js
│   │   │   ├── 20260306200000_layer2_reference_data.js
│   │   │   ├── 20260307100000_fix_units_unique_constraints.js
│   │   │   ├── 20260315000001_layer3_missing_accounts.js
│   │   │   └── 20260315000002_add_bank_transfer_enum.js
│   │   │
│   │   └── seeds/
│   │       └── 001_seed_data.js   # Default data seeder
│   │
│   ├── scripts/                    # 20+ utility scripts
│   │   ├── seed_database.js
│   │   ├── seed_categories.js
│   │   ├── show_database.js
│   │   ├── verify_endpoints.js
│   │   └── ...
│   │
│   └── tests/                      # 7 test files
│       ├── auth.test.js
│       ├── sales.test.js
│       ├── purchasing.test.js
│       ├── inventory.test.js
│       ├── financials.test.js
│       ├── layer2.test.js
│       └── security.test.js
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env
    │
    └── src/
        ├── main.jsx                # React entry point
        ├── App.jsx                 # Router & layout wrapper
        ├── tokens.css              # Design tokens (CSS variables)
        ├── index.css               # Global styles + Tailwind
        │
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx
        │   ├── Products.jsx
        │   ├── Customers.jsx
        │   ├── Suppliers.jsx
        │   ├── Sales.jsx
        │   ├── NewSale.jsx         # POS interface
        │   ├── Purchases.jsx
        │   ├── NewPurchase.jsx
        │   ├── Quotations.jsx
        │   ├── Expenses.jsx
        │   ├── Accounts.jsx
        │   ├── Journals.jsx
        │   ├── LedgerView.jsx
        │   ├── Reports.jsx
        │   ├── Units.jsx
        │   ├── StockAdjustment.jsx
        │   ├── Settings.jsx
        │   ├── Users.jsx
        │   ├── AuditLogs.jsx
        │   ├── CustomerPayment.jsx
        │   ├── SupplierPayment.jsx
        │   │
        │   ├── platform/           # Platform admin pages
        │   │   ├── PlatformLogin.jsx
        │   │   ├── PlatformDashboard.jsx
        │   │   ├── ClientsList.jsx
        │   │   ├── ClientDetail.jsx
        │   │   └── NewClient.jsx
        │   │
        │   ├── setup/              # Onboarding wizard
        │   │   ├── SetupWizard.jsx
        │   │   └── steps/
        │   │       ├── Step1Company.jsx
        │   │       ├── Step2Categories.jsx
        │   │       ├── Step3Brands.jsx
        │   │       ├── Step4Units.jsx
        │   │       └── Step5OpeningBalances.jsx
        │   │
        │   ├── Dashboard.css
        │   ├── Login.css
        │   └── Reports.css
        │
        ├── components/
        │   ├── Layout.jsx         # Main app shell
        │   ├── Layout.css
        │   │
        │   ├── pos/                # Point of Sale components
        │   │   ├── CartSidebar.jsx
        │   │   ├── ProductCard.jsx
        │   │   ├── BarcodeInput.jsx
        │   │   ├── CustomerSelector.jsx
        │   │   ├── POSControls.jsx
        │   │   ├── QuickAmountButtons.jsx
        │   │   └── pos.css
        │   │
        │   ├── ui/                 # Reusable UI primitives
        │   │   ├── Button.jsx
        │   │   ├── Input.jsx
        │   │   ├── Badge.jsx
        │   │   ├── Table.jsx
        │   │   ├── StatCard.jsx
        │   │   ├── EmptyState.jsx
        │   │   └── FilterBar.jsx
        │   │
        │   ├── platform/          # Platform admin components
        │   │   └── PlatformLayout.jsx
        │   │
        │   ├── CategorySelector.jsx
        │   ├── UnitSelector.jsx
        │   ├── ImpersonationBanner.jsx
        │   ├── InvoicePDF.jsx
        │   ├── SaleDetailModal.jsx
        │   ├── SalesStats.jsx
        │   ├── SalesFilters.jsx
        │   └── BankTransferModal.jsx
        │
        ├── store/                  # Zustand state stores
        │   ├── auth.store.js
        │   ├── cart.store.js
        │   └── platform.auth.store.js
        │
        ├── services/               # API clients
        │   ├── api.js
        │   └── platform.api.js
        │
        └── utils/                 # Helper functions
            ├── permissions.js
            ├── phoneFormat.js
            ├── dataSync.js
            └── activityFormatter.js
```

---

## 4. Frontend Architecture

### 4.1 Entry Points

**`main.jsx`** — React app bootstrap
- Imports `main.jsx` from `src/` directory
- Renders `App` into `#root` div
- No providers (auth state loaded in `App.jsx`)

**`App.jsx`** — Router & Auth Bootstrap
- Uses `HashRouter` (important: all routes are hash-based)
- Wraps routes in `<Layout>` component
- Shows loading spinner while auth state initializes from localStorage
- Redirects unauthenticated users to `/login`
- Handles both tenant and platform routes

```jsx
// Route structure
/                    → Dashboard (protected)
/products            → Products page (protected)
/sales               → Sales list (protected)
/new-sale            → POS interface (protected)
/purchases           → Purchases (protected)
/new-purchase        → New purchase (protected)
/accounts            → Chart of accounts (protected)
/journals            → Journal entries (protected)
/reports             → All reports (protected)
/settings            → Company settings (protected)
/users               → User management (protected)
/audit-logs          → Audit logs (protected)
/setup               → Onboarding wizard (if not onboarded)
/customer-payment    → Customer payment (protected)
/supplier-payment    → Supplier payment (protected)

# Platform admin routes
/platform            → Platform dashboard (protected)
/platform/clients    → Client list (protected)
/platform/clients/new → New client (protected)
/platform/clients/:id → Client detail (protected)
```

### 4.2 Design System (`tokens.css`)

The frontend uses a CSS variable-based design system defined in `tokens.css`:

```css
/* Colors - Dark theme by default */
--color-bg: #0f172a;
--color-surface: #1e293b;
--color-panel-3: #334155;
--color-text: #e2e8f0;
--color-muted: #94a3b8;
--color-hint: #64748b;
--color-border: #334155;

/* Brand Colors */
--color-primary: #3b82f6;     /* Blue */
--color-accent: #6366f1;       /* Indigo */
--color-success: #22c55e;      /* Green */
--color-warning: #f59e0b;      /* Amber */
--color-danger: #ef4444;       /* Red */

/* Dim variants (for backgrounds) */
--blue-dim: rgba(59, 130, 246, 0.15);
--green-dim: rgba(34, 197, 94, 0.15);
--red-dim: rgba(239, 68, 68, 0.15);
--purple-dim: rgba(168, 85, 247, 0.15);
--amber-dim: rgba(245, 158, 11, 0.15);

/* Typography */
--font-sans: system-ui, -apple-system, sans-serif;
--font-mono: ui-monospace, monospace;

/* Spacing (8px grid) */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */

/* Border Radius */
--radius-xs: 4px;
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-xl: 16px;

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
--shadow-md: 0 4px 6px rgba(0,0,0,0.4);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.5);
```

### 4.3 Routing

The app uses **hash-based routing** via `HashRouter`. This is important because:
- No server-side configuration needed
- Routes work on any static file server
- All routes prefixed with `#` (e.g., `http://localhost:5173/#/sales`)

### 4.4 Theme Support

The Dashboard page implements a light/dark theme toggle:
- Theme preference stored in `localStorage` key: `zync-theme`
- Applied via `document.documentElement.setAttribute('data-theme', theme)`
- Components reference CSS variables which change based on theme

---

## 5. Frontend Pages

### 5.1 Authentication Pages

**`Login.jsx`** — Tenant User Login
- Fields: Company Code, Username, Password
- Company code maps to `tenant.slug` for multi-tenancy
- On success: stores JWT + user + tenant in Zustand store, navigates to `/`
- Default credentials: `admin` / `admin123` (seeded)

**`platform/PlatformLogin.jsx`** — Platform Admin Login
- Separate authentication flow for SaaS operators
- Uses `X-Platform-Secret` header + platform JWT
- Different store: `platform.auth.store.js`

### 5.2 Dashboard

**`Dashboard.jsx`** (802 lines) — Main Dashboard
- **Features:**
  - KPI cards: Today's Sales, Cash Received, Net Profit, Receivables, Payables
  - Animated counters for numbers
  - Sales/Purchase trend chart (dual bar chart, last 7 days)
  - Recent activity feed with icons per action type
  - Top selling products with progress bars
  - Expense breakdown donut chart
  - Inventory health gauge (good/low/out)
  - Notification bell with dropdown (low stock, overdue invoices)
  - Search bar (redirects to sales with search param)
  - Theme toggle (dark/light)
  - Incomplete setup banner (shown to admins)
  - Auto-refresh every 60 seconds

### 5.3 Point of Sale

**`NewSale.jsx`** — POS Interface
- Full-screen cart-based checkout
- Product grid with category filtering
- Barcode input support
- Quick amount buttons (Rs. 50, 100, 500, 1000, 2000)
- Customer selection with credit balance display
- Cart sidebar with:
  - Item quantity adjustment
  - Line item discounts
  - Global discount (amount or %)
  - Tax calculation
  - Payment method selection (Cash, Card, Bank Transfer, Credit)
  - Amount paid input with change/return calculation
- Quotation loading (convert quote to sale)
- Credit limit enforcement
- Overpayment handling (return to customer)

### 5.4 Sales & Purchases

**`Sales.jsx`** — Sales List
- Filterable table of all sales
- Columns: Invoice #, Date, Customer, Items, Total, Paid, Balance, Status
- Status badges: Pending, Completed, Partial
- Quick view modal with sale details
- Payment recording button
- Print/download invoice option
- Filter by date range, status, search

**`Purchases.jsx`** — Purchase List
- Similar to Sales but for supplier purchases
- Bill number, supplier, total, paid, balance, status
- Return creation (partial or full return)

**`NewPurchase.jsx`** — New Purchase Entry
- Supplier selection
- Product search/select
- Quantity and unit cost entry
- Auto-calculate totals
- Create purchase record with journal entries

### 5.5 Master Data

**`Products.jsx`** (710 lines) — Product Management
- List/Form toggle view
- Product form with sections:
  - Basic Info: name, SKU, barcode, category, brand, unit, description, status
  - Pricing: cost price, retail price, wholesale price, tax rate, profit margin calculation
  - Physical: dimensions, weight
  - Inventory: opening stock, min stock level, reorder quantity
- Real-time profit margin calculation
- SKU auto-uppercase
- Opening stock only on creation (not on edit)
- Soft delete support

**`Customers.jsx`** — Customer Management
- Add/edit customers with: name, phone, email, address, CNIC
- Credit limit per customer
- Outstanding balance display
- Contact person and company fields
- View customer ledger
- Record payments

**`Suppliers.jsx`** — Supplier Management
- Similar to customers
- Contact person, company fields
- Outstanding payable tracking

**`Units.jsx`** — Unit of Measure
- CRUD for units (e.g., Pcs, Kg, Box, Dozen)
- Abbreviation field
- Helps maintain product measurement consistency

### 5.6 Financial Pages

**`Accounts.jsx`** — Chart of Accounts
- Displays accounts grouped by account groups
- Each group shows: code, name, opening balance, current balance
- "View Ledger" link to account detail

**`Journals.jsx`** — Journal Entry List
- All journal entries in the system
- Filterable by date, search
- View journal details with all debit/credit lines

**`LedgerView.jsx`** — Account Ledger View
- Transaction history for a specific account
- Running balance column
- Date-wise transactions
- Opening balance display

**`Expenses.jsx`** — Expense Recording
- Record expenses with category and amount
- Auto-creates journal entries
- Category-based expense tracking

**`Reports.jsx`** (476 lines) — All Reports
Tabs:
- **Stock Report** — Current inventory valuation, low stock items
- **Sales Summary** — Daily/periodic sales totals
- **Trial Balance** — All accounts with debit/credit totals, balance check
- **Profit & Loss** — Income vs Expenses statement
- **Balance Sheet** — Assets, Liabilities, Equity
- **Sales by Product** — Revenue breakdown per product
- **Sales by Customer** — Customer spending analysis
- **Purchase by Supplier** — Supplier spending
- **Expense Summary** — Expenses by category

**`CustomerPayment.jsx`** — Record Customer Payment
- Select customer, enter amount
- Creates journal entry (Debit Cash/Bank, Credit Customer Receivable)

**`SupplierPayment.jsx`** — Record Supplier Payment
- Select supplier, enter amount
- Creates journal entry (Debit Supplier Payable, Credit Cash/Bank)

### 5.7 Operations

**`StockAdjustment.jsx`** — Inventory Adjustments
- Increase/decrease stock for any product
- Adjustment reasons (damaged, found, correction, etc.)
- Creates journal entries for stock write-offs

**`AuditLogs.jsx`** — Activity Log Viewer
- Filterable log of all system actions
- Shows: user, action, table, timestamp, IP
- Activity description and amount

### 5.8 Settings & Admin

**`Settings.jsx`** — Company Configuration
- Company info: name, NTN, STRN, phone, email, website, address
- Bank details: bank name, account number, IBAN, branch code
- Financial year settings
- Default tax rate
- All settings saved via API

**`Users.jsx`** — User Management
- Create/edit users with roles
- Roles: admin, manager, cashier
- Last login tracking
- Password reset

### 5.9 Platform Admin Pages

**`platform/PlatformDashboard.jsx`** — SaaS Operator Dashboard
- Total clients, active clients, expired clients
- Trial balance overview
- Revenue metrics
- Recent registrations

**`platform/ClientsList.jsx`** (408 lines) — Client Management
- Table of all tenant organizations
- Columns: name, plan, status, expires, users, products, created
- Status: Active, Inactive, Expired, Expiring (with color coding)
- Plan badges: Basic, Professional, Enterprise
- Search and filter by status
- Toggle active/inactive
- Create new client
- View client details

**`platform/NewClient.jsx`** — Create New Tenant
- Form: company name, slug, admin email/username/password
- Plan selection, expiry date
- Creates tenant + admin user + database schema

**`platform/ClientDetail.jsx`** — View/Edit Tenant
- Tenant info, subscription details
- User impersonation button
- View tenant-specific data

### 5.10 Setup Wizard

**`SetupWizard.jsx`** — Onboarding Flow
- 5-step wizard with step indicator
- Blocked browser back button (prevents accidental exit)
- Step progress saved to server
- URL sync: `/setup?step=2`

**Steps:**
1. `Step1Company.jsx` (339 lines) — Company details
   - Company name, NTN, STRN
   - Phone, email, website
   - City, address
   - Financial year (start/end month)
   - Bank details (expandable)

2. `Step2Categories.jsx` — Product categories
   - Quick-add category interface
   - Pre-populated suggestions

3. `Step3Brands.jsx` — Product brands
   - Brand name input

4. `Step4Units.jsx` — Units of measure
   - Unit name + abbreviation

5. `Step5OpeningBalances.jsx` — Opening balances + completion
  - Optional opening balances for key accounts
  - "Save and finish" or "Skip and finish"
  - Completes onboarding and redirects to dashboard

---

## 6. Frontend Components

### 6.1 Layout

**`Layout.jsx`** — Main Application Shell
- **Sidebar Navigation:**
  - Dashboard
  - Point of Sale (with keyboard shortcut hint)
  - Sales (with count badge)
  - Purchases
  - Products (with low stock indicator)
  - Customers
  - Suppliers
  - Quotations
  - Accounts
  - Journals
  - Reports
  - Settings (admin/manager only)
  - Users (admin only)
  - Audit Logs (admin/manager only)
  - Inventory submenu: Units, Stock Adjustments

- **Features:**
  - Role-based menu visibility
  - Collapsible sidebar
  - Top bar with search, notifications, user menu
  - Impersonation banner when active
  - Handles tenant context from auth store

**`ImpersonationBanner.jsx`** — Platform Admin Impersonation
- Shows when platform admin is impersonating a tenant
- Displays: impersonated tenant name, "Exit Impersonation" button
- Stops impersonation and returns to platform

### 6.2 POS Components

**`CartSidebar.jsx`** — Shopping Cart
- Cart items list with quantity controls
- Remove item button
- Subtotal, discount, tax, total calculation
- Customer display (with change customer button)
- Payment section: amount paid input, payment method
- Balance/return display
- Submit sale button

**`ProductCard.jsx`** — Product Grid Item
- Product image placeholder (emoji)
- Name and SKU
- Price display
- Stock indicator (green/yellow/red based on level)
- Click to add to cart
- Visual feedback on add

**`BarcodeInput.jsx`** — Barcode Scanner Input
- Auto-focused input field
- Searches products by barcode
- Adds product to cart on match
- Shows product name feedback
- Clears after add

**`CustomerSelector.jsx`** — Customer Selection
- Searchable customer dropdown
- Shows customer name + outstanding balance
- "No customer" option for walk-in sales
- Quick add customer capability

**`POSControls.jsx`** — Quick Actions
- Clear cart button
- Hold/recall sale
- Apply global discount toggle
- Tax toggle
- Payment method shortcuts

**`QuickAmountButtons.jsx`** — Preset Amount Buttons
- Common amounts: Rs. 50, 100, 200, 500, 1000, 2000, 5000
- Custom amount input
- Click to set as paid amount

### 6.3 UI Components

**`Button.jsx`** — Reusable Button
- Variants: primary, secondary, danger, ghost
- Sizes: sm, md, lg
- Loading state with spinner
- Icon support

**`Input.jsx`** — Form Input
- Label support
- Error state
- Prefix/suffix support
- Icon support

**`Badge.jsx`** — Status Badge
- Variants: success, danger, warning, secondary, primary
- Used for status indicators throughout

**`Table.jsx`** — Data Table
- Sortable columns
- Empty state
- Loading skeleton
- Export capability

**`StatCard.jsx`** — Metric Display Card
- Label and value display
- Icon and color options
- Trend indicator

**`EmptyState.jsx`** — Empty Data State
- Icon, title, description
- Optional action button

**`FilterBar.jsx`** — Filter Controls
- Search input
- Date range
- Status dropdown
- Apply/clear buttons

### 6.4 Shared Components

**`CategorySelector.jsx`** — Category Dropdown
- Select with option to create new
- Inline category creation
- Validates selection

**`UnitSelector.jsx`** — Unit Dropdown
- Select with inline unit creation
- Shows abbreviation

**`SaleDetailModal.jsx`** — Sale Details Popup
- Full sale information display
- Item list with pricing
- Payment breakdown
- Print invoice button

**`InvoicePDF.jsx`** — Invoice Generation
- Generates printable invoice layout
- Company header
- Customer and sale details
- Line items table
- Totals and payment info

**`SalesStats.jsx`** — Sales Metrics
- Total sales, average order value
- Comparison with previous period

**`SalesFilters.jsx`** — Sales Filter UI
- Date range, status, customer filters
- Applied filters display

**`BankTransferModal.jsx`** — Bank Payment Recording
- Record bank transfer details
- Reference number input

---

## 7. State Management

### 7.1 Auth Store (`auth.store.js`)

```javascript
// State shape
{
  user: null,           // { id, username, role, tenant_id }
  token: null,          // JWT string
  tenant: null,         // { id, name, slug, is_onboarded, onboarding_step }
  isLoading: true       // Initial auth state loading
}

// Computed (getters)
isAuthenticated  // !!token
isAdmin          // role === 'admin'
isManager        // role === 'manager'
isCashier        // role === 'cashier'
isOnboarded      // tenant?.is_onboarded

// Actions
login(user, token, tenant)      // Set auth state, persist to localStorage
logout()                         // Clear state, redirect to login
updateOnboardingStep(step)       // Update tenant onboarding progress
markOnboarded()                  // Set is_onboarded = true

// Persistence
Persisted to localStorage key: 'zync-auth'
Token and user data survive page reload
```

### 7.2 Cart Store (`cart.store.js`)

```javascript
// State
{
  items: [],              // Cart line items
  customerId: null,       // Selected customer ID
  customerName: null,     // Display name
  notes: '',              // Sale notes
  globalDiscount: 0,      // Discount amount
  globalDiscountType: 'amount',  // 'amount' or 'percent'
  taxRate: 0,             // Tax percentage
  paymentMethod: 'cash',  // cash, card, bank, credit
  paidAmount: 0,          // Amount tendered
  quotationId: null       // If loaded from quotation
}

// Computed (getters)
getSubtotal()            // Sum of (unit_price * quantity)
getDiscountAmount()      // Apply global discount
getTaxAmount()           // (subtotal - discount) * taxRate
getTotal()               // subtotal - discount + tax
getBalance()             // total - paidAmount
getReturnToCustomer()    // max(0, balance * -1)

// Actions
addItem(product, stockProducts)        // Add or increment quantity
updateQuantity(productId, qty, maxStock) // Update with stock validation
removeItem(productId)                    // Remove from cart
setCustomer(id, name)                   // Select customer
setGlobalDiscount(amount, type)         // Set discount
setTaxRate(rate)                        // Set tax %
setPaymentMethod(method)               // Set payment type
setPaidAmount(amount)                   // Set tendered amount
loadFromQuotation(quotation)            // Populate cart from quote
clearCart()                             // Reset cart
getSaleData()                           // Generate API payload

// Persistence
Persisted to localStorage key: 'zync-cart'
Items, customer, discount, tax, paymentMethod survive reload
paidAmount is NOT persisted (resets on reload)
```

### 7.3 Platform Auth Store (`platform.auth.store.js`)

```javascript
// State shape
{
  admin: null,        // Platform admin user
  token: null,        // Platform JWT
  isLoading: true
}

// Computed
isAuthenticated  // !!token

// Actions
login(admin, token)   // Set platform auth state
logout()              // Clear state
```

---

## 8. Frontend Services & API

### 8.1 Tenant API (`api.js`)

All API calls include JWT token in Authorization header:
```
Authorization: Bearer <token>
```

```javascript
// API namespaces (each returns promise from axios)
authAPI
  .login({ username, password, tenant })           // POST /api/auth/login
  .me()                                              // GET /api/auth/me

dashboardAPI
  .stats()                                           // GET /api/dashboard/stats
  .recentActivity()                                  // GET /api/dashboard/recent-activity

productsAPI
  .list({ search, limit })                           // GET /api/products
  .get(id)                                           // GET /api/products/:id
  .create(data)                                      // POST /api/products
  .update(id, data)                                  // PUT /api/products/:id
  .delete(id)                                        // DELETE /api/products/:id

categoriesAPI
  .list()                                            // GET /api/categories
  .create(data)                                      // POST /api/categories
  .update(id, data)                                  // PUT /api/categories/:id
  .delete(id)                                        // DELETE /api/categories/:id

brandsAPI
  .list()                                            // GET /api/brands
  .create(data)                                      // POST /api/brands
  .update(id, data)                                  // PUT /api/brands/:id
  .delete(id)                                        // DELETE /api/brands/:id

unitsAPI
  .list()                                            // GET /api/units
  .create(data)                                      // POST /api/units
  .update(id, data)                                  // PUT /api/units/:id
  .delete(id)                                        // DELETE /api/units/:id

customersAPI
  .list({ search })                                 // GET /api/customers
  .get(id)                                           // GET /api/customers/:id
  .create(data)                                      // POST /api/customers
  .update(id, data)                                  // PUT /api/customers/:id
  .delete(id)                                        // DELETE /api/customers/:id
  .getLedger(id)                                     // GET /api/customers/:id/ledger
  .recordPayment(id, data)                          // POST /api/customers/:id/payment

suppliersAPI
  .list({ search })                                 // GET /api/suppliers
  .get(id)                                           // GET /api/suppliers/:id
  .create(data)                                      // POST /api/suppliers
  .update(id, data)                                  // PUT /api/suppliers/:id
  .delete(id)                                        // DELETE /api/suppliers/:id
  .getLedger(id)                                     // GET /api/suppliers/:id/ledger
  .recordPayment(id, data)                          // POST /api/suppliers/:id/payment

salesAPI
  .list({ search, status, from_date, to_date, limit }) // GET /api/sales
  .get(id)                                           // GET /api/sales/:id
  .create(data)                                      // POST /api/sales
  .recordPayment(id, data)                          // POST /api/sales/:id/payment

purchasesAPI
  .list({ search, status, from_date, to_date, limit }) // GET /api/purchases
  .get(id)                                           // GET /api/purchases/:id
  .create(data)                                      // POST /api/purchases
  .createReturn(id, data)                           // POST /api/purchases/:id/return

quotationsAPI
  .list({ search })                                 // GET /api/quotations
  .get(id)                                           // GET /api/quotations/:id
  .create(data)                                      // POST /api/quotations
  .update(id, data)                                  // PUT /api/quotations/:id
  .delete(id)                                        // DELETE /api/quotations/:id
  .convertToSale(id, data)                          // POST /api/quotations/:id/convert

expensesAPI
  .list({ search, category, from_date, to_date })    // GET /api/expenses
  .get(id)                                           // GET /api/expenses/:id
  .create(data)                                      // POST /api/expenses
  .update(id, data)                                  // PUT /api/expenses/:id
  .delete(id)                                        // DELETE /api/expenses/:id
  .categories()                                      // GET /api/expenses/categories

accountsAPI
  .list()                                            // GET /api/accounts (grouped)
  .getGroups()                                       // GET /api/account-groups
  .get(id)                                           // GET /api/accounts/:id
  .create(data)                                      // POST /api/accounts
  .update(id, data)                                  // PUT /api/accounts/:id

journalsAPI
  .list({ from_date, to_date, search })              // GET /api/journals
  .get(id)                                           // GET /api/journals/:id
  .create(data)                                      // POST /api/journals

stockAPI
  .adjustments({ type, from_date, to_date })         // GET /api/stock/adjustments
  .createAdjustment(data)                           // POST /api/stock/adjustments
  .movements(productId)                              // GET /api/stock/movements/:productId

reportsAPI
  .dashboard()                                       // GET /api/reports/dashboard
  .stock({ low_stock_only })                         // GET /api/reports/stock
  .salesByDate({ from_date, to_date })               // GET /api/reports/sales-by-date
  .salesByProduct({ from_date, to_date })            // GET /api/reports/sales-by-product
  .salesByCustomer({ from_date, to_date })           // GET /api/reports/sales-by-customer
  .purchaseBySupplier({ from_date, to_date })      // GET /api/reports/purchase-by-supplier
  .trialBalance({ as_of_date })                     // GET /api/reports/trial-balance
  .profitLoss({ from_date, to_date })                // GET /api/reports/profit-loss
  .balanceSheet({ as_of_date })                     // GET /api/reports/balance-sheet
  .expenseSummary({ from_date, to_date })            // GET /api/reports/expense-summary

settingsAPI
  .get()                                             // GET /api/settings
  .update(data)                                      // PUT /api/settings
  .getCompanyInfo()                                  // GET /api/settings/company-info
  .updateCompanyInfo(data)                          // PUT /api/settings/company-info

usersAPI
  .list()                                            // GET /api/users
  .get(id)                                           // GET /api/users/:id
  .create(data)                                      // POST /api/users
  .update(id, data)                                  // PUT /api/users/:id
  .changePassword(id, data)                         // PUT /api/users/:id/password
  .delete(id)                                        // DELETE /api/users/:id

auditlogAPI
  .list({ search, action, table_name, from_date, to_date, limit }) // GET /api/audit-logs

onboardingAPI
  .status()                                          // GET /api/onboarding/status
  .updateStep(step)                                  // PUT /api/onboarding/step
  .complete()                                        // POST /api/onboarding/complete

backupAPI
  .create()                                          // POST /api/backup
  .list()                                            // GET /api/backup
  .download(filename)                                // GET /api/backup/download/:filename
  .restore(filename)                                 // POST /api/backup/restore/:filename
```

### 8.2 Platform API (`platform.api.js`)

```javascript
// Base URL: /api/platform
// Headers: Authorization: Bearer <platform_token>

platformAuthAPI
  .login({ email, password })                        // POST /api/platform/auth/login
  .me()                                              // GET /api/platform/auth/me

platformTenantsAPI
  .list()                                            // GET /api/platform/tenants
  .get(id)                                           // GET /api/platform/tenants/:id
  .create(data)                                      // POST /api/platform/tenants
  .update(id, data)                                  // PUT /api/platform/tenants/:id
  .activate(id)                                      // POST /api/platform/tenants/:id/activate
  .deactivate(id)                                    // POST /api/platform/tenants/:id/deactivate
  .impersonate(id)                                   // POST /api/platform/tenants/:id/impersonate
  .impersonatedToken(token)                          // POST /api/platform/impersonate/verify

platformStatsAPI
  .dashboard()                                       // GET /api/platform/dashboard
```

---

## 9. Frontend Utilities

### 9.1 Permissions (`permissions.js`)

Role-based permission checking for UI elements:

```javascript
// Roles hierarchy
ADMIN > MANAGER > CASHIER

// Permission definitions
const PERMISSIONS = {
  'products.view_cost_price': ['admin', 'manager'],
  'products.edit': ['admin', 'manager'],
  'products.delete': ['admin'],
  'reports.view': ['admin', 'manager', 'cashier'],
  'sales.credit': ['admin', 'manager'],
  'expenses.create': ['admin', 'manager'],
  // ... more permissions
}

// Usage
can(userRole, 'products.edit')  // Returns boolean
can('admin', 'products.delete') // true
can('cashier', 'products.delete') // false
```

### 9.2 Phone Formatting (`phoneFormat.js`)

Pakistani phone number validation and formatting:

```javascript
formatPhone(phone)        // Format: 0300-1234567
validatePhone(phone)      // Returns boolean (valid +92 format)
normalizePhone(phone)     // Remove formatting chars
```

### 9.3 Data Sync (`dataSync.js`)

Cross-component event system using Zustand:

```javascript
// Event types
const DataSyncEvents = {
  SALE_CREATED: 'SALE_CREATED',
  SALE_UPDATED: 'SALE_UPDATED',
  PURCHASE_CREATED: 'PURCHASE_CREATED',
  PURCHASE_UPDATED: 'PURCHASE_UPDATED',
}

// Hook usage
useDataSync(DataSyncEvents.SALE_CREATED, () => {
  // Refresh data when sale is created
  loadSales()
})

// Trigger from anywhere
dataSync.trigger(DataSyncEvents.SALE_CREATED)
```

### 9.4 Activity Formatter (`activityFormatter.js`)

Formats audit log entries for display:

```javascript
formatActivity(log)          // Returns { text, amount, amountType }
getActionColor(action)       // Returns Tailwind color class
timeAgo(timestamp)           // Returns "5 minutes ago"
formatIP(ip)                 // Format IP address
```

---

## 10. CSS & Styling

### 10.1 Global Styles (`index.css`)

- Tailwind CSS import (v4 via CDN)
- Global reset and base styles
- Custom scrollbar styling
- Focus visible styles
- Utility classes for common patterns
- Table styles
- Form element styles
- Animation keyframes

### 10.2 Page-Specific Styles

| File | Purpose |
|------|---------|
| `Dashboard.css` | Dashboard layout, KPI cards, charts, activity feed |
| `Login.css` | Login page centering, card styling |
| `Reports.css` | Tab styling, financial statement formatting |
| `Layout.css` | Sidebar, header, navigation styles |
| `pos.css` | POS grid layout, cart sidebar, product cards |

### 10.3 Design Tokens

All styling uses CSS variables from `tokens.css` for consistency:
- Color values via `--color-*`
- Spacing via `--space-*`
- Border radius via `--radius-*`
- Shadows via `--shadow-*`

---

## 11. Backend Architecture

### 11.1 Application Entry (`index.js`)

```javascript
// Express app setup
// Middleware stack (order matters!):
1. cors()                    // Enable CORS
2. express.json()            // Parse JSON bodies
3. requestLogger             // HTTP request logging
4. [Tenant routes]           // Public tenant info routes (no auth)
5. [Platform routes]         // Platform admin routes
6. [Auth routes]             // Login/logout (no auth)
7. [Protected routes]        // All other routes (require JWT)
   └── auth middleware       // JWT verification
   └── tenant middleware     // Set PostgreSQL session vars
   └── authorize middleware  // Role checking
8. errorHandler              // Global error catching

// Port
Default: 3001
Proxies from frontend vite config on port 5173
```

### 11.2 Database Configuration (`database.js`)

```javascript
// Single Knex instance
// Connection pool settings
// Tenant-aware connection handling
```

### 11.3 Knex Configuration (`knexfile.js`)

```javascript
// Environment: development, staging, production
// Each environment has:
//   - host, port, database, user, password
//   - migrations directory
//   - seeds directory
```

---

## 12. Database Migrations

The database has evolved through 33 migrations from January to March 2026:

### Migration Timeline

| Date | File | Purpose |
|------|------|---------|
| 2026-01-18 | `20260118000000` | Initial schema: users, products, categories, units, customers, suppliers, accounts, sales, purchases, expenses, journals, audit_logs, sequences |
| 2026-01-18 | `20260118000001` | Purchase status enum (pending, completed, cancelled) |
| 2026-01-18 | `20260118000002` | Sale status enum (pending, completed, partial) |
| 2026-01-26 | `20260126115121` | Product table updates |
| 2026-01-27 | `20260127103945` | Professional schema v1: full schema overhaul |
| 2026-01-27 | `20260127111356` | Sequences table for auto-numbering |
| 2026-01-27 | `20260127111659` | Account codes on groups |
| 2026-01-27 | `20260127113203` | CNIC and company fields on people |
| 2026-01-27 | `20260127113313` | Missing columns (opening_balance, is_deleted) |
| 2026-01-27 | `20260127113653` | Fix sales date check constraint |
| 2026-01-27 | `20260127113826` | Drop redundant triggers |
| 2026-01-27 | `20260127114531` | Last login tracking on users |
| 2026-01-27 | `20260127115901` | Restore expenses and categories |
| 2026-01-30 | `20260130100000` | Fix sales overpayment |
| 2026-01-30 | `20260130120000` | Drop sales check constraint |
| 2026-02-06 | `20260206100000` | Drop purchases check constraint |
| 2026-03-02 | `20260302100000` | Fix account groups |
| 2026-03-02 | `20260302100001` | Fix accounts table |
| 2026-03-02 | `20260302100002` | Add ledger safeguards |
| 2026-03-03 | `20260303100000` | Multi-tenancy: tenant_id everywhere |
| 2026-03-04 | `20260304100000` | Platform admins table |
| 2026-03-04 | `20260304200000` | Remove viewer role |
| 2026-03-04 | `20260304200001` | Phone format constraints |
| 2026-03-04 | `20260304200002` | Fix sequences table |
| 2026-03-04 | `20260304200003` | Extend audit action enum |
| 2026-03-04 | `20260304200004` | Make audit user_id nullable |
| 2026-03-05 | `20260305100000` | Onboarding and company_info tables |
| 2026-03-05 | `20260305110000` | Brands table |
| 2026-03-06 | `20260306100000` | Separate company_info from tenants |
| 2026-03-06 | `20260306200000` | Layer 2 reference data |
| 2026-03-07 | `20260307100000` | Fix units unique constraints |
| 2026-03-15 | `20260315000001` | Layer 3 missing accounts |
| 2026-03-15 | `20260315000002` | Add bank_transfer payment enum |

---

## 13. Database Schema

### Core Tables

#### `tenants`
Primary organization/company record.
```sql
id                  -- UUID, PK
name                -- Company name
slug                -- URL-safe identifier (unique)
is_active           -- Boolean
is_onboarded        -- Boolean
onboarding_step    -- Integer
expires_at          -- Timestamp (subscription expiry)
created_at
updated_at
```

#### `users`
Tenant users with role-based access.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants (indexed)
username            -- Unique within tenant
password_hash       -- BCrypt hash
role                -- Enum: 'admin', 'manager', 'cashier'
email
last_login_at
is_deleted          -- Boolean (soft delete)
created_at
updated_at
```

#### `platform_admins`
SaaS operator accounts (separate from tenant users).
```sql
id                  -- UUID, PK
email               -- Unique
password_hash       -- BCrypt
name
created_at
```

#### `products`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
name
code                -- SKU (unique within tenant)
barcode
description
category_id         -- FK → categories
brand_id            -- FK → brands
unit_id             -- FK → units
cost_price
retail_price
wholesale_price
tax_rate
current_stock       -- Denormalized for performance
min_stock_level
reorder_quantity
track_stock         -- Boolean
is_active           -- Boolean
is_deleted          -- Boolean
created_at
updated_at
```

#### `categories`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
name
parent_id           -- FK → categories (self-reference for hierarchy)
created_at
```

#### `brands`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
name
created_at
```

#### `units`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
name
abbreviation        -- e.g., "pcs", "kg"
created_at
```

#### `customers`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
account_id          -- FK → accounts (auto-provisioned receivable)
name
phone
email
address
cnic
contact_person
company_name
credit_limit
balance             -- Denormalized (outstanding receivable)
is_deleted          -- Boolean
created_at
updated_at
```

#### `suppliers`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
account_id          -- FK → accounts (auto-provisioned payable)
name
phone
email
address
contact_person
company_name
balance             -- Denormalized (outstanding payable)
is_deleted          -- Boolean
created_at
updated_at
```

#### `sales`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
sale_number         -- Auto-generated: SINV-000001
customer_id         -- FK → customers (nullable)
sale_date           -- Date
subtotal
discount_amount
discount_percentage
tax_amount
total_amount
amount_paid
payment_method      -- Enum: 'cash', 'card', 'bank', 'credit', 'bank_transfer'
return_to_customer  -- Overpayment returned as cash
status              -- Enum: 'pending', 'completed', 'partial'
due_date
notes
is_return           -- Boolean
original_sale_id    -- FK → sales (for returns)
created_by          -- FK → users
created_at
```

#### `sale_items`
```sql
id                  -- UUID, PK
sale_id             -- FK → sales
product_id          -- FK → products
quantity
unit_price
line_discount       -- Per-line discount amount
tax_percent
tax_amount
total               -- (quantity * unit_price) - discount + tax
```

#### `purchases`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
purchase_number     -- Auto-generated: PUR-000001
supplier_id         -- FK → suppliers
purchase_date
subtotal
discount_amount
tax_amount
total_amount
amount_paid
payment_method
status              -- Enum: 'pending', 'completed', 'partial'
notes
is_return           -- Boolean
original_purchase_id-- FK → purchases
created_by          -- FK → users
created_at
```

#### `purchase_items`
```sql
id                  -- UUID, PK
purchase_id         -- FK → purchases
product_id          -- FK → products
quantity
unit_cost
total
```

#### `stock_movements`
FIFO tracking for each stock transaction.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
product_id          -- FK → products
reference_type      -- Enum: 'purchase', 'sale', 'adjustment', 'purchase_return', 'sale_return'
reference_id        -- UUID (sale_id, purchase_id, adjustment_id)
quantity            -- Positive = stock in, Negative = stock out
remaining_qty       -- For FIFO: qty still available from this batch
unit_cost           -- Cost at time of purchase
created_at
```

#### `account_groups`
GL account categories.
```sql
id                  -- UUID, PK
name                -- e.g., "Cash & Banks", "Sales"
code                -- e.g., "1", "4"
account_type        -- Enum: 'asset', 'liability', 'equity', 'income', 'expense'
nature              -- Enum: 'debit', 'credit'
```

#### `accounts`
Chart of accounts.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
group_id            -- FK → account_groups
code                -- e.g., "1001", "4001"
name                -- e.g., "Cash in Hand"
opening_balance     -- Initial balance
is_system           -- Boolean (system-created vs user-created)
created_at
```

#### `journals`
Journal entries (immutable).
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
journal_number      -- Auto-generated: JV-000001
journal_date
description
reference_type      -- Enum: 'sale', 'purchase', 'expense', 'payment', 'adjustment'
reference_id        -- UUID
created_by          -- FK → users
created_at
```

#### `journal_lines`
```sql
id                  -- UUID, PK
journal_id          -- FK → journals
account_id          -- FK → accounts
debit
credit
created_at
```

#### `ledger_entries`
Denormalized running balance per account (updated via triggers).
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
account_id          -- FK → accounts
journal_id          -- FK → journals
debit
credit
running_balance     -- Computed cumulative balance
entry_date
reference_type
reference_id
created_at
```

#### `expenses`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
expense_number      -- Auto-generated
expense_date
category            -- e.g., "Rent", "Utilities"
amount
payment_method
notes
created_by          -- FK → users
created_at
```

#### `quotations`
Draft sales proposals.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
quotation_number    -- Auto-generated
customer_id         -- FK → customers
quotation_date
valid_until
subtotal
discount_amount
discount_percentage
tax_rate
total_amount
status              -- Enum: 'draft', 'sent', 'accepted', 'rejected'
notes
created_by          -- FK → users
created_at
```

#### `quotation_items`
```sql
id                  -- UUID, PK
quotation_id        -- FK → quotations
product_id          -- FK → products
quantity
unit_price
discount_percent
discount_amount
tax_percent
total
```

#### `stock_adjustments`
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
adjustment_number   -- Auto-generated
adjustment_date
reason              -- e.g., 'damaged', 'found', 'correction'
notes
created_by          -- FK → users
created_at
```

#### `stock_adjustment_items`
```sql
id                  -- UUID, PK
adjustment_id       -- FK → stock_adjustments
product_id          -- FK → products
adjustment_quantity -- Positive = add, Negative = remove
current_cost
total_value
```

#### `sequences`
Auto-increment tracking per document type.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
prefix              -- e.g., 'SINV', 'PUR'
last_number         -- Last used number
created_at
updated_at
```

#### `settings`
Tenant configuration.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants (unique)
key                 -- Setting name
value               -- Setting value (JSON)
```

#### `company_info`
Separate from tenant for cleaner separation.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants (unique)
name
ntn_number
strn_number
phone
email
website
address
city
financial_year_start -- Month number (1-12)
financial_year_end   -- Month number (1-12)
default_tax_rate
bank_name
bank_account_number
bank_iban
bank_branch_code
```

#### `audit_logs`
Fire-and-forget activity logging.
```sql
id                  -- UUID, PK
tenant_id           -- FK → tenants
user_id             -- FK → users (nullable for system actions)
action              -- Enum: 'login', 'login_failed', 'create', 'update', 'delete', 'approve', 'reject'
table_name          -- Affected table
record_id           -- Affected record ID
old_values          -- JSON
new_values          -- JSON
ip_address
user_agent
created_at
```

#### `backups`
Backup metadata.
```sql
id                  -- UUID, PK
filename
size_bytes
status              -- Enum: 'pending', 'completed', 'failed'
created_at
```

---

## 14. Database Seeds

### `001_seed_data.js`

Creates default data for new tenants:

**Default Users:**
| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | admin |

**Default Units:**
- Piece (pcs)
- Kilogram (kg)
- Gram (g)
- Liter (L)
- Meter (m)
- Box
- Dozen

**Default Categories:**
- Electronics
- Groceries
- Clothing
- Stationery
- Furniture

**Chart of Accounts:**

| Code | Name | Type | Nature |
|------|------|------|--------|
| 1001 | Cash in Hand | Asset | Debit |
| 1002 | Bank Account | Asset | Debit |
| 2001 | Accounts Payable | Liability | Credit |
| 2002 | Accounts Receivable | Asset | Debit |
| 3001 | Owner Capital | Equity | Credit |
| 4001 | Sales Revenue | Income | Credit |
| 4002 | Sales Returns | Income | Debit |
| 5001 | Cost of Goods Sold | Expense | Debit |
| 5002 | Purchases | Expense | Debit |
| 5003 | Purchase Returns | Expense | Credit |
| 6001 | Rent Expense | Expense | Debit |
| 6002 | Utilities Expense | Expense | Debit |
| 6003 | Salaries Expense | Expense | Debit |
| 6004 | Miscellaneous Expense | Expense | Debit |

---

## 15. Backend Middleware

### 15.1 `auth.js` — JWT Authentication

```javascript
// JWT payload structure
{
  userId: uuid,
  tenantId: uuid,
  role: 'admin' | 'manager' | 'cashier',
  iat: timestamp,
  exp: timestamp  // 7 days expiry
}

// Middleware usage
authMiddleware     // Verify JWT, set req.user
authorize(...roles) // Role checking wrapper
```

### 15.2 `tenant.js` — Tenant Resolution

```javascript
// Sets PostgreSQL session variables for RLS
SET app.current_tenant = tenantId

// All queries automatically filter by tenant_id
// Requires auth middleware to run first
```

### 15.3 `platformAuth.js` — Platform Admin Auth

```javascript
// Platform secret header verification
X-Platform-Secret: <configured_secret>

// Platform JWT with separate payload
{
  platformAdminId: uuid,
  email: string,
  iat: timestamp,
  exp: timestamp
}

// Also handles tenant impersonation
X-Tenant-Id: <impersonated_tenant_id>
X-Impersonation-Token: <special_token>
```

### 15.4 `errorHandler.js` — Global Error Handler

```javascript
// Catches all unhandled errors
// Maps PostgreSQL errors to user-friendly messages
// Maps JWT errors appropriately
// Never exposes stack traces in production
// Logs full error details server-side
```

---

## 16. Backend Routes

### 16.1 Route Summary

| Route File | Base Path | Key Endpoints |
|------------|-----------|---------------|
| `auth.routes.js` | `/api/auth` | login, me, logout |
| `account.routes.js` | `/api/accounts` | list, get, create, update, getGroups |
| `auditlog.routes.js` | `/api/audit-logs` | list |
| `backup.routes.js` | `/api/backup` | create, list, download, restore |
| `brand.routes.js` | `/api/brands` | CRUD |
| `category.routes.js` | `/api/categories` | CRUD |
| `customer.routes.js` | `/api/customers` | CRUD, ledger, payment |
| `dashboard.routes.js` | `/api/dashboard` | stats, recentActivity |
| `expense.routes.js` | `/api/expenses` | CRUD, categories |
| `journal.routes.js` | `/api/journals` | list, get, create |
| `onboarding.routes.js` | `/api/onboarding` | status, updateStep, complete |
| `platform.auth.routes.js` | `/api/platform/auth` | login, me |
| `product.routes.js` | `/api/products` | CRUD, search, stock |
| `purchase.routes.js` | `/api/purchases` | CRUD, return |
| `quotation.routes.js` | `/api/quotations` | CRUD, convert |
| `report.routes.js` | `/api/reports` | dashboard, stock, sales*, trial, pl, bs, expense* |
| `sale.routes.js` | `/api/sales` | CRUD, payment |
| `settings.routes.js` | `/api/settings` | get, update, company-info |
| `stock.routes.js` | `/api/stock` | adjustments, movements |
| `supplier.routes.js` | `/api/suppliers` | CRUD, ledger, payment |
| `tenants.routes.js` | `/api/tenants` | register, getInfo, completeOnboarding |
| `unit.routes.js` | `/api/units` | CRUD |
| `user.routes.js` | `/api/users` | CRUD, changePassword |

### 16.2 Key Endpoint Patterns

**Creating a Sale (POST /api/sales):**
```javascript
// Request
{
  customer_id: uuid | null,
  sale_date: ISO string,
  items: [{
    product_id: uuid,
    quantity: number,
    unit_price: number,
    line_discount: number,
    tax_rate: number
  }],
  discount_amount: number,
  discount_percentage: number,
  tax_amount: number,
  amount_paid: number,
  payment_method: 'cash' | 'card' | 'bank' | 'credit' | 'bank_transfer',
  notes: string
}

// Response
{
  id: uuid,
  sale_number: 'SINV-000001',
  total_amount: number,
  status: 'pending' | 'completed',
  // Also returns created journal entries
}
```

**Recording Payment (POST /api/sales/:id/payment):**
```javascript
{
  amount: number,
  payment_method: string,
  payment_date: string,
  notes: string
}
```

---

## 17. Backend Services

### 17.1 Service Summary

| Service | Responsibility |
|---------|---------------|
| `account.service.js` | Chart of accounts CRUD, trial balance calculation |
| `audit.service.js` | Fire-and-forget audit logging |
| `backup.service.js` | pg_dump/restore integration |
| `customer.service.js` | Customer CRUD, auto GL provisioning, ledger |
| `expense.service.js` | Expense CRUD, journal entry creation |
| `ledger.service.js` | Journal entry creation, running balance updates, immutability |
| `product.service.js` | Product CRUD, stock calculations |
| `purchase.service.js` | Purchase lifecycle, FIFO stock IN, returns |
| `quotation.service.js` | Quote lifecycle, conversion to sale |
| `report.service.js` | All reporting queries |
| `sale.service.js` | Sale lifecycle, FIFO stock OUT, credit enforcement |
| `sequence.service.js` | Auto-numbering with concurrency locks |
| `stock.service.js` | FIFO consumption, adjustments, movements |
| `supplier.service.js` | Supplier CRUD, auto payable provisioning |
| `tenantProvisioning.service.js` | New tenant database setup |

### 17.2 Core Services Deep Dive

#### Ledger Service (`ledger.service.js`)

The most critical service for double-entry accounting:

```javascript
// Create journal entry (transactional)
createJournal({
  journal_date,
  description,
  reference_type,
  reference_id,
  lines: [
    { account_id, debit, credit },
    // ... balanced lines (debits === credits)
  ]
})
// Also updates ledger_entries with running balance
// Throws if debits !== credits

// Get account balance
getAccountBalance(accountId, asOfDate)

// Get ledger entries
getLedgerEntries(accountId, fromDate, toDate)
```

#### Stock Service (`stock.service.js`)

FIFO inventory management:

```javascript
// Consume stock for sale (FIFO)
consumeStockFifo(saleItems, tenantId, saleId)
// - Gets purchase batches ordered by date (oldest first)
// - Consumes from each batch proportionally
// - Updates remaining_qty on stock_movements
// - Returns total cost for journal entry

// Add stock from purchase
addStockFifo(purchaseItems, tenantId, purchaseId)
// - Creates new stock_movement records
// - Updates product.current_stock

// Adjust stock
adjustStock(productId, quantity, reason, tenantId, userId)
// - Creates adjustment record
// - Creates stock_movement
// - Updates current_stock
// - Creates journal if write-off
```

#### Sale Service (`sale.service.js`)

Sale processing with FIFO and credit control:

```javascript
// Create sale
createSale(saleData, userId, tenantId)
// 1. Validate stock availability
// 2. Check customer credit limit (if applicable)
// 3. Generate sequence number
// 4. Consume FIFO stock
// 5. Create journal entries (Sale Revenue, COGS, Tax, Customer Receivable)
// 6. Handle overpayment (return_to_customer)
// 7. Update customer balance
// 8. Create sale record

// Record payment
recordPayment(saleId, paymentData, userId, tenantId)
// - Update sale amount_paid
// - Update sale status
// - Update customer balance
// - Create journal (Cash/Bank DR, Customer AR CR)
```

#### Purchase Service (`purchase.service.js`)

Supplier purchase processing:

```javascript
// Create purchase
createPurchase(purchaseData, userId, tenantId)
// 1. Generate sequence number
// 2. Add stock via FIFO
// 3. Create journal (Inventory, Tax, Supplier Payable)
// 4. Update supplier balance
// 5. Create purchase record

// Create return
createReturn(purchaseId, returnData, userId, tenantId)
// - Reverse stock (restore to batches if possible)
// - Create journal entries
// - Update supplier balance
```

#### Sequence Service (`sequence.service.js`)

Concurrency-safe auto-numbering:

```javascript
// Get next sequence (with FOR UPDATE lock)
getNextSequence(prefix, tenantId)
// 1. BEGIN TRANSACTION
// 2. SELECT ... FOR UPDATE on sequence row
// 3. Increment last_number
// 4. COMMIT
// 5. Return formatted: "PREFIX-000001"

// Format: Left-padded with zeros, max 6 digits
// e.g., SINV-000001, PUR-000042, JV-001000
```

#### Customer Service (`customer.service.js`)

Customer management with auto GL provisioning:

```javascript
// Create customer
createCustomer(data, tenantId)
// 1. Create customer record
// 2. Auto-create AR account: "Accounts Receivable - [Customer Name]"
// 3. Link customer.account_id to new account

// Record payment
recordPayment(customerId, paymentData, userId, tenantId)
// 1. Validate amount
// 2. Create journal (Cash/Bank DR, Customer AR CR)
// 3. Update customer.balance (reduce receivable)
// 4. Update ledger entries

// Get ledger
getCustomerLedger(customerId, tenantId)
// - All transactions for customer's AR account
```

#### Supplier Service (`supplier.service.js`)

Similar to customer service but for payables:

```javascript
// Create supplier
// 1. Create supplier record
// 2. Auto-create AP account: "Accounts Payable - [Supplier Name]"
// 3. Link supplier.account_id

// Record payment
// - Journal: Supplier AP DR, Cash/Bank CR
// - Update supplier.balance
```

#### Report Service (`report.service.js`)

All analytical queries:

```javascript
// Dashboard stats
getDashboardStats(tenantId)
// - today's_sales, today_received, month_profit
// - outstanding_receivables, outstanding_payables
// - pending_actions (low_stock, overdue_invoices)
// - sales_trend (7 days), purchase_trend
// - top_products, expense_breakdown, stock_health

// Trial balance
getTrialBalance(asOfDate, tenantId)
// - Sum all accounts with debit/credit columns
// - Calculate totals
// - is_balanced check (total debits === total credits)

// Profit & Loss
getProfitLoss(fromDate, toDate, tenantId)
// - Income accounts total
// - Expense accounts total
// - net_profit = income - expenses

// Balance Sheet
getBalanceSheet(asOfDate, tenantId)
// - Assets
// - Liabilities
// - Equity (including net profit/loss)

// Sales by date/product/customer
// Purchase by supplier
// Expense summary
// Stock report
```

#### Audit Service (`audit.service.js`)

Fire-and-forget logging:

```javascript
// Log async (non-blocking)
logAudit({
  tenantId,
  userId,         // Can be null for system actions
  action,         // 'create', 'update', 'delete', 'login', etc.
  tableName,
  recordId,
  oldValues,      // For updates/deletes
  newValues,      // For creates/updates
  ipAddress,
  userAgent
})
// Called with await in routes but implemented as fire-and-forget
// Catches own errors (never throws)
```

#### Backup Service (`backup.service.js`)

Database backup management:

```javascript
// Create backup
createBackup(tenantId)
// - Runs pg_dump for tenant schema
// - Stores in backups directory
// - Records metadata

// List backups
listBackups(tenantId)

// Download backup
downloadBackup(filename, tenantId)

// Restore backup
restoreBackup(filename, tenantId)
// - Drops current schema
// - Restores from backup
```

#### Tenant Provisioning Service (`tenantProvisioning.service.js`)

New tenant onboarding:

```javascript
// Provision new tenant
provisionTenant({
  name,
  slug,
  adminEmail,
  adminUsername,
  adminPassword,
  plan,
  expiresAt
})
// 1. Create tenant record
// 2. Run all migrations for tenant
// 3. Create admin user
// 4. Seed default data (categories, units, accounts)
// 5. Create company_info record
// 6. Return tenant credentials
```

---

## 18. Key Business Logic

### 18.1 Double-Entry Accounting Rules

Every financial transaction must balance (Total Debits === Total Credits):

| Transaction | Debit | Credit |
|-------------|-------|--------|
| Sale on Credit | Accounts Receivable (Asset) | Sales Revenue (Income) |
| Sale Cost of Goods | Cost of Goods Sold (Expense) | Inventory (Asset) |
| Sale Payment Received | Cash/Bank (Asset) | Accounts Receivable (Asset) |
| Purchase on Credit | Inventory (Asset) | Accounts Payable (Liability) |
| Purchase Payment | Accounts Payable (Liability) | Cash/Bank (Asset) |
| Record Expense | Expense Account (Expense) | Cash/Bank (Asset) |

**Account Nature:**
- **Assets & Expenses** — Increase with Debit, decrease with Credit
- **Liabilities, Equity & Income** — Increase with Credit, decrease with Debit

### 18.2 FIFO Inventory Algorithm

When a product is sold, stock is consumed from the oldest purchase batches first:

```javascript
// consumeStockFifo pseudocode
function consumeStockFifo(saleItems, tenantId, referenceId) {
  for (item of saleItems) {
    remainingQty = item.quantity
    totalCost = 0
    
    // Get purchase batches ordered by date
    batches = getStockBatches(item.product_id, tenantId)
    
    for (batch of batches) {
      if (remainingQty <= 0) break
      
      if (batch.remaining_qty >= remainingQty) {
        // Take all from this batch
        totalCost += remainingQty * batch.unit_cost
        batch.remaining_qty -= remainingQty
        remainingQty = 0
      } else {
        // Consume entire batch
        totalCost += batch.remaining_qty * batch.unit_cost
        remainingQty -= batch.remaining_qty
        batch.remaining_qty = 0
      }
      
      updateBatch(batch)
    }
    
    // Create journal for COGS
    createJournal({
      lines: [
        { account: 'COGS', debit: totalCost },
        { account: 'Inventory', credit: totalCost }
      ]
    })
  }
}
```

### 18.3 Credit Limit Enforcement

When creating a sale for a customer:

```javascript
// Check before allowing sale
newBalance = customer.balance + sale.total_amount - sale.amount_paid
if (newBalance > customer.credit_limit) {
  throw new Error('Credit limit exceeded')
}
```

### 18.4 Overpayment Handling

If customer pays more than the invoice total:

```javascript
if (sale.amount_paid > sale.total_amount) {
  sale.return_to_customer = sale.amount_paid - sale.total_amount
  // Cash is physically returned to customer
  // This is tracked but no journal entry needed (already received)
}
```

### 18.5 Ledger Immutability

PostgreSQL triggers prevent UPDATE/DELETE on `ledger_entries` and `journal_lines`:

```sql
-- Trigger prevents modification
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_ledger_update
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();
```

### 18.6 Soft Delete Pattern

Products, customers, and suppliers use `is_deleted` flag:

```javascript
// Deleting (soft)
async delete(id) {
  await db('products').where({ id }).update({ is_deleted: true })
  // Records remain in DB but hidden from queries
}

// Querying (filter out deleted)
async list() {
  return db('products').where({ is_deleted: false })
}
```

---

## 19. System Constants

### 19.1 GL Account Codes (`accounts.js`)

```javascript
const ACCOUNTS = {
  // Asset Accounts (1xxx)
  CASH_IN_HAND: { code: '1001', name: 'Cash in Hand' },
  BANK_ACCOUNT: { code: '1002', name: 'Bank Account' },
  ACCOUNTS_RECEIVABLE: { code: '1003', name: 'Accounts Receivable' },
  INVENTORY: { code: '1004', name: 'Inventory' },
  
  // Liability Accounts (2xxx)
  ACCOUNTS_PAYABLE: { code: '2001', name: 'Accounts Payable' },
  
  // Equity Accounts (3xxx)
  OWNER_CAPITAL: { code: '3001', name: 'Owner Capital' },
  
  // Income Accounts (4xxx)
  SALES_REVENUE: { code: '4001', name: 'Sales Revenue' },
  SALES_RETURN: { code: '4002', name: 'Sales Returns' },
  
  // Cost of Sales (5xxx)
  COGS: { code: '5001', name: 'Cost of Goods Sold' },
  PURCHASES: { code: '5002', name: 'Purchases' },
  PURCHASE_RETURNS: { code: '5003', name: 'Purchase Returns' },
  
  // Expense Accounts (6xxx)
  RENT_EXPENSE: { code: '6001', name: 'Rent Expense' },
  UTILITIES_EXPENSE: { code: '6002', name: 'Utilities Expense' },
  SALARIES_EXPENSE: { code: '6003', name: 'Salaries Expense' },
  MISC_EXPENSE: { code: '6004', name: 'Miscellaneous Expense' },
}
```

### 19.2 Sequence Prefixes

| Prefix | Document Type | Example |
|--------|--------------|---------|
| SINV | Sales Invoice | SINV-000001 |
| PUR | Purchase | PUR-000001 |
| JV | Journal Entry | JV-000001 |
| QUO | Quotation | QUO-000001 |
| PAY | Payment | PAY-000001 |
| ADJ | Stock Adjustment | ADJ-000001 |
| EXP | Expense | EXP-000001 |

### 19.3 Phone Number Format

Pakistani mobile numbers: +92 followed by 10 digits

```javascript
// Valid formats
+92 300 1234567
+92-300-1234567
03001234567

// Validation regex
/^(\+92|0)?[0-9]{10}$/

// Stored format: 923001234567 (no dashes, + prefix)
```

### 19.4 Payment Methods

```javascript
const PAYMENT_METHODS = {
  CASH: 'cash',
  CARD: 'card',                    // Credit/Debit card
  BANK: 'bank',                    // Bank transfer (cash deposit)
  BANK_TRANSFER: 'bank_transfer',  // Online transfer (new)
  CREDIT: 'credit'                 // On account
}
```

---

## 20. Authentication & Security

### 20.1 Tenant User Authentication

```
1. User submits: username, password, tenant (slug)
2. Server looks up tenant by slug
3. Server verifies user exists in tenant
4. Server validates password (bcrypt)
5. Server generates JWT with { userId, tenantId, role }
6. Server returns { user, token, tenant }
7. Client stores in Zustand (persisted to localStorage)
8. All subsequent requests include Authorization: Bearer <token>
```

**JWT Token:**
- Expiry: 7 days
- Contains: userId, tenantId, role
- Verified by auth middleware on every protected route

### 20.2 Platform Admin Authentication

```
1. Admin submits: email, password
2. Server verifies X-Platform-Secret header
3. Server validates admin credentials
4. Server generates platform JWT
5. Platform admin can then:
   - View/manage all tenants
   - Impersonate tenant users
   - Create new tenants
```

### 20.3 Impersonation Flow

```
1. Platform admin selects tenant to impersonate
2. Platform calls POST /api/platform/tenants/:id/impersonate
3. Server generates impersonation token with:
   - impersonating: true
   - originalAdmin: platformAdminId
   - targetTenant: tenantId
   - targetUser: null (or specific user)
4. Platform admin receives impersonation token
5. Frontend sets impersonation mode with:
   - Custom header: X-Impersonation-Token
   - Impersonated tenant context
6. All actions logged with original admin info
```

### 20.4 Role-Based Access Control

| Feature | Admin | Manager | Cashier |
|---------|-------|---------|---------|
| Dashboard | ✓ | ✓ | ✓ |
| POS / Sales | ✓ | ✓ | ✓ |
| View Cost Price | ✓ | ✓ | ✗ |
| View Reports | ✓ | ✓ | ✓ |
| Create Expenses | ✓ | ✓ | ✗ |
| Credit Sales | ✓ | ✓ | ✗ |
| Manage Users | ✓ | ✗ | ✗ |
| System Settings | ✓ | ✗ | ✗ |
| Delete Records | ✓ | ✗ | ✗ |

### 20.5 Password Hashing

- Algorithm: bcrypt with 10 salt rounds
- Never stored in plain text
- Compared using bcrypt.compare()

---

## 21. Multi-Tenant Architecture

### 21.1 Tenant Isolation Strategy

**Database:** Single PostgreSQL database
**Isolation:** Row-Level Security (RLS) via PostgreSQL session variables

```sql
-- Set tenant context
SET app.current_tenant = 'tenant-uuid-here';

-- RLS policy example
CREATE POLICY tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### 21.2 Tenant Resolution Flow

```
Request → Auth Middleware → Extract tenantId from JWT → 
Tenant Middleware → SET app.current_tenant → Route Handler
```

### 21.3 Tenant Scoping in Knex

All queries automatically scoped:

```javascript
// Instead of:
db('products').where({ tenant_id, ... })

// Use helper:
db.withTenant(tenantId)('products').where({ ... })
// or rely on automatic scoping via middleware
```

### 21.4 Tenant Creation

1. Create tenant record in `tenants` table
2. Run all migrations for new tenant (future: separate schemas)
3. Create admin user
4. Seed default chart of accounts
5. Seed default categories and units

---

## 22. Platform Admin System

### 22.1 Platform vs Tenant Distinction

| Aspect | Platform Admin | Tenant User |
|--------|---------------|-------------|
| Auth | X-Platform-Secret + platform JWT | Tenant JWT |
| Manages | All tenants | Own tenant only |
| Access | /api/platform/* | /api/* |
| Role | Platform operator | admin/manager/cashier |

### 22.2 Platform Dashboard Metrics

- Total clients (active, inactive, expired)
- Monthly revenue from subscriptions
- Recent registrations
- Trial balance by plan

### 22.3 Tenant Lifecycle

1. **Trial** — Created but not active
2. **Active** — Subscribed, can use system
3. **Expiring** — Within 30 days of expiry
4. **Expired** — Past expiry date, access may be limited

### 22.4 Impersonation Security

- Impersonation tokens have separate expiry
- All actions during impersonation logged
- Impersonation banner shown in UI
- Original admin identity preserved in audit logs

---

## 23. Testing

### 23.1 Test Files

| File | Coverage |
|------|----------|
| `auth.test.js` | Login, logout, JWT validation |
| `sales.test.js` | Sale creation, payments, returns |
| `purchasing.test.js` | Purchase lifecycle, returns |
| `inventory.test.js` | Stock movements, FIFO, adjustments |
| `financials.test.js` | Journal entries, trial balance, P&L |
| `layer2.test.js` | Secondary features (reports, settings) |
| `security.test.js` | Authorization, SQL injection, XSS |

### 23.2 Test Patterns

```javascript
describe('Sales API', () => {
  let authToken;
  let tenantId;
  
  before(async () => {
    // Setup: create tenant, get auth token
  });
  
  it('should create a sale with valid items', async () => {
    const res = await request(app)
      .post('/api/sales')
      .set('Authorization', `Bearer ${authToken}`)
      .send(saleData);
    
    assert.equal(res.status, 201);
    assert.ok(res.body.sale_number);
  });
});
```

### 23.3 Running Tests

```bash
cd backend
npm test
```

---

## 24. Scripts

### 24.1 Database Scripts

| Script | Purpose |
|--------|---------|
| `seed_database.js` | Run all seeds |
| `seed_categories.js` | Seed product categories |
| `show_database.js` | Display database structure |
| `verify_endpoints.js` | Test all API endpoints |

### 24.2 Maintenance Scripts

20+ utility scripts for:
- Database cleanup
- Data migration
- Report generation
- Backup verification
- Performance analysis

### 24.3 Running Scripts

```bash
cd backend
node scripts/<script-name>.js
```

---

## 25. Development Setup

### 25.1 Prerequisites

- Node.js 20.x
- PostgreSQL 13+
- npm or yarn

### 25.2 Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your database credentials

# Run migrations
npx knex migrate:latest

# Seed database
npx knex seed:run

# Start dev server
npm run dev
```

### 25.3 Frontend Setup

```bash
cd frontend
npm install

# Create .env file if needed
# VITE_API_URL=http://localhost:3001/api

# Start dev server
npm run dev
```

### 25.4 Environment Variables

**Backend (.env):**
```env
PORT=3001
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=zync_erp
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
PLATFORM_SECRET=your_platform_secret_key
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3001/api
```

### 25.5 Default Credentials

After seeding:
- **Username:** admin
- **Password:** admin123
- **Company Code:** default (or as configured)

---

## 26. Code Conventions

### 26.1 Backend Conventions

**File Naming:**
- Route files: `*.routes.js`
- Service files: `*.service.js`
- Middleware files: `*.js` in middleware folder
- Utils: `*.js` in utils folder

**Async/Await:**
- Always use async/await over .then() chains
- Wrap in try/catch for error handling

**Database Queries:**
- Use Knex query builder
- Always include tenant_id filter
- Use transactions for multi-step operations

**Error Handling:**
- Throw descriptive errors
- Use custom error classes if needed
- Let errorHandler middleware catch

### 26.2 Frontend Conventions

**File Naming:**
- Pages: `PascalCase.jsx` (e.g., `SalesReport.jsx`)
- Components: `PascalCase.jsx`
- Hooks/Utils: `camelCase.js`
- Stores: `*.store.js`

**State Management:**
- Local state for component-specific data
- Zustand stores for shared state
- API calls in services, not components

**Styling:**
- Use CSS variables from tokens.css
- Inline styles for dynamic values
- CSS files for page/component-specific styles
- Tailwind utilities for rapid prototyping

### 26.3 Git Conventions

**Commits:**
- `feat: add user management`
- `fix: resolve sale payment bug`
- `docs: update API documentation`
- `refactor: simplify stock calculation`

---

## 27. Common Patterns

### 27.1 Adding a New CRUD Resource

**Backend:**
1. Add migration for new table
2. Create service with standard CRUD methods
3. Create route with endpoints
4. Add to index.js router
5. Add to seed if default data needed

**Frontend:**
1. Create API namespace in api.js
2. Create page component
3. Add route to App.jsx
4. Add to navigation in Layout.jsx
5. Add permissions if RBAC needed

### 27.2 Adding a New Report

**Backend:**
1. Add method to report.service.js
2. Add route in report.routes.js
3. Test with sample data

**Frontend:**
1. Add API method to reportsAPI
2. Add tab to Reports.jsx
3. Add render method for new report type
4. Add filters if needed

### 27.3 Adding a New Account Type

**Backend:**
1. Add to ACCOUNTS constants
2. Create migration to add account group
3. Create seed update for existing tenants
4. Use accountResolver utility when needed

### 27.4 Debugging Stock Issues

```sql
-- Check stock movements for a product
SELECT * FROM stock_movements
WHERE product_id = 'uuid'
ORDER BY created_at;

-- Check current stock calculation
SELECT 
  p.name,
  p.current_stock,
  (SELECT SUM(quantity) FROM stock_movements WHERE product_id = p.id) as total_in
FROM products p
WHERE p.id = 'uuid';
```

### 27.5 Debugging Journal Imbalance

```sql
-- Find unbalanced journals
SELECT 
  j.id,
  j.journal_number,
  SUM(jl.debit) as total_debit,
  SUM(jl.credit) as total_credit
FROM journals j
JOIN journal_lines jl ON j.id = jl.journal_id
GROUP BY j.id, j.journal_number
HAVING SUM(jl.debit) != SUM(jl.credit);
```

---

## Quick Reference Card

### API Base URLs
- Tenant API: `http://localhost:3001/api`
- Platform API: `http://localhost:3001/api/platform`

### Key Headers
```
Authorization: Bearer <tenant_jwt>
X-Platform-Secret: <platform_secret>
X-Tenant-Id: <impersonated_tenant_id>
X-Impersonation-Token: <impersonation_token>
```

### Important Database Tables
- `tenants` — Organization records
- `users` — Tenant users
- `products` — Product catalog
- `sales` / `sale_items` — Sales transactions
- `purchases` / `purchase_items` — Purchase transactions
- `stock_movements` — FIFO tracking
- `accounts` / `account_groups` — Chart of accounts
- `journals` / `journal_lines` / `ledger_entries` — Accounting
- `customers` / `suppliers` — Business partners

### Sequence Prefixes
- SINV-xxx — Sales Invoice
- PUR-xxx — Purchase
- JV-xxx — Journal Entry
- QUO-xxx — Quotation

### Roles
- `admin` — Full access
- `manager` — Operational access, no user management
- `cashier` — POS and basic reports only

### Default Login
- URL: `/login`
- Username: `admin`
- Password: `admin123`
- Company Code: `default`

---

**End of Developer Guide**
