# ZYNC ERP: User Manual

Welcome to the ZYNC ERP system. This guide covers the basic workflows for managing your business.

## 1. Getting Started
- **Access**: Open the application in your browser at `http://localhost:5173`.
- **Default Credentials**:
  - Admin: `admin` / `admin123`
  - Cashier: `cashier` / `cashier123`
  - Manager: `manager` / `manager123`

## 2. Inventory Management
- **Products**: View, add, and edit items in the **Products** section.
- **Stock Adjustments**: Use **Stock Adjust** to correct inventory for damages, shrinkage, or manual count corrections.
- **Reports**: Check the **Reports** section for "Low Stock" alerts and complete "Stock Valuation" reports.

## 3. Sales & Quotations
- **New Sale**: Use the **New Sale** button on the Dashboard or Sidebar. Supports both cash and credit sales (for registered customers).
- **Quotations**: Create a quotation for a customer first. Once they accept, click **Convert to Sale** inside the quotation details to automatically generate an invoice.
- **Sales Return**: Found in the **Sales** list. Generate a Credit Note to restock returned items.

## 4. Accounting (Double-Entry)
- **Chart of Accounts**: Managed automatically. You can view balances in **Accounts**.
- **Journals**: For manual adjustments (e.g., initial capital or asset depreciation), use the **Journals** module. Entries must be balanced (Debits = Credits).
- **Ledgers**: Deep-dive into any account's history using the "Ledger" view in the **Accounts** or **Customers/Suppliers** lists.

## 5. Maintenance
- **Backups**: Go to **Settings > Database Backups**. We recommend creating a backup daily or before large imports.
- **Users**: Admin users can manage system access and reset passwords in the **Users** section.

---
*Developed for ZYNC ERP v1.0*
