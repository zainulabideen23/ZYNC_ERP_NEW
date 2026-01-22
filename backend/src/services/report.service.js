const LedgerService = require('./ledger.service');

class ReportService {
    constructor(db) {
        this.db = db;
        this.ledgerService = new LedgerService(db);
    }

    async getDashboardStats() {
        const today = new Date().toISOString().split('T')[0];

        // Today's sales
        const todaySales = await this.db('sales')
            .where('invoice_date', today)
            .where('status', 'completed')
            .select(
                this.db.raw('COUNT(*) as count'),
                this.db.raw('COALESCE(SUM(total_amount), 0) as total'),
                this.db.raw('COALESCE(SUM(paid_amount), 0) as received')
            )
            .first();

        // Low stock items
        const lowStock = await this.db('products as p')
            .leftJoin(
                this.db('stock_movements').groupBy('product_id').select('product_id', this.db.raw('SUM(quantity) as current_stock')).as('sm'),
                'p.id', 'sm.product_id'
            )
            .where('p.is_active', true)
            .where('p.track_stock', true)
            .whereRaw('COALESCE(sm.current_stock, 0) <= p.min_stock_level')
            .count('* as count')
            .first();

        // Outstanding receivables
        const receivables = await this.db('sales')
            .where('status', 'completed')
            .where('balance_amount', '>', 0)
            .select(this.db.raw('COALESCE(SUM(balance_amount), 0) as total'))
            .first();

        // Outstanding payables
        const payables = await this.db('purchases')
            .where('status', 'completed')
            .where('balance_amount', '>', 0)
            .select(this.db.raw('COALESCE(SUM(balance_amount), 0) as total'))
            .first();

        // Sales Trend (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const startDate = sevenDaysAgo.toISOString().split('T')[0];

        const salesTrend = await this.db('sales')
            .where('invoice_date', '>=', startDate)
            .where('status', 'completed')
            .select('invoice_date', this.db.raw('SUM(total_amount) as total'))
            .groupBy('invoice_date')
            .orderBy('invoice_date', 'asc');

        // Fill in missing days with 0
        const trend = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const found = salesTrend.find(s => {
                // Handle date object or string depending on driver
                const sDate = s.invoice_date instanceof Date ? s.invoice_date.toISOString().split('T')[0] : s.invoice_date;
                return sDate === dateStr;
            });
            trend.push({ date: dateStr, amount: found ? parseFloat(found.total) : 0 });
        }

        // Recent Transactions (Combined Sales & Purchases)
        const recentSales = await this.db('sales')
            .select('id', 'invoice_number as ref', 'customer_id as party_id', 'total_amount as amount', 'created_at', this.db.raw("'sale' as type"))
            .orderBy('created_at', 'desc')
            .limit(5);

        const recentPurchases = await this.db('purchases')
            .select('id', 'bill_number as ref', 'supplier_id as party_id', 'total_amount as amount', 'created_at', this.db.raw("'purchase' as type"))
            .orderBy('created_at', 'desc')
            .limit(5);

        // Combine and sort
        const recentActivity = [...recentSales, ...recentPurchases]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 5);

        // Enhance with Party Names
        for (const act of recentActivity) {
            if (act.type === 'sale') {
                const party = await this.db('customers').where('id', act.party_id).select('name').first();
                act.party_name = party?.name || 'Walk-in Customer';
            } else {
                const party = await this.db('suppliers').where('id', act.party_id).select('name').first();
                act.party_name = party?.name || 'Unknown Supplier';
            }
        }

        return {
            today_sales: {
                invoices: parseInt(todaySales.count),
                total: parseFloat(todaySales.total),
                received: parseFloat(todaySales.received)
            },
            low_stock_count: parseInt(lowStock.count),
            outstanding_receivables: parseFloat(receivables.total),
            outstanding_payables: parseFloat(payables.total),
            sales_trend: trend,
            recent_activity: recentActivity
        };
    }

    async getStockReport(filters) {
        const { category_id, company_id, low_stock_only } = filters;

        let query = this.db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('companies as co', 'p.company_id', 'co.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .leftJoin(
                this.db('stock_movements').groupBy('product_id').select('product_id', this.db.raw('SUM(quantity) as current_stock')).as('sm'),
                'p.id', 'sm.product_id'
            )
            .select(
                'p.id', 'p.code', 'p.name', 'p.retail_price', 'p.cost_price', 'p.min_stock_level',
                'c.name as category', 'co.name as company', 'u.abbreviation as unit',
                this.db.raw('COALESCE(sm.current_stock, 0) as current_stock')
            )
            .where('p.is_active', true)
            .where('p.track_stock', true);

        if (category_id) query = query.where('p.category_id', category_id);
        if (company_id) query = query.where('p.company_id', company_id);
        if (low_stock_only === 'true') {
            query = query.whereRaw('COALESCE(sm.current_stock, 0) <= p.min_stock_level');
        }

        const rawItems = await query.orderBy('p.name');

        // Process items to calculate value and statuses
        let totalValue = 0;
        let lowStockCount = 0;

        const items = rawItems.map(item => {
            const stock = parseFloat(item.current_stock);
            const cost = parseFloat(item.cost_price) || 0;
            const value = stock * cost;
            const isLowStock = stock <= item.min_stock_level;

            if (stock > 0) totalValue += value;
            if (isLowStock) lowStockCount++;

            return {
                ...item,
                current_stock: stock,
                stock_value: value,
                is_low_stock: isLowStock
            };
        });

        return {
            summary: {
                total_items: items.length,
                total_value: totalValue,
                low_stock_count: lowStockCount
            },
            items
        };
    }

    async getTrialBalance(asOfDate) {
        let query = this.db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .select(
                'a.id', 'a.code', 'a.name', 'a.account_type', 'g.name as group_name',
                this.db.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as debits'),
                this.db.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as credits')
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'g.name');

        if (asOfDate) {
            query = query.where('le.entry_date', '<=', asOfDate);
        }

        const accounts = await query.orderBy('a.code');

        const totals = accounts.reduce((acc, row) => {
            acc.debits += parseFloat(row.debits);
            acc.credits += parseFloat(row.credits);
            return acc;
        }, { debits: 0, credits: 0 });

        return {
            accounts: accounts.map(acc => ({
                ...acc,
                net_balance: parseFloat(acc.debits) - parseFloat(acc.credits), // Asset/Exp: +ve, Liab/Inc: -ve (conceptually)
                debits: parseFloat(acc.debits),
                credits: parseFloat(acc.credits)
            })),
            totals,
            is_balanced: Math.abs(totals.debits - totals.credits) < 0.01
        };
    }

    async getProfitAndLoss(startDate, endDate) {
        // P&L = Income - Expenses
        // Income = Accounts of type 'income' (Revenue)
        // Expenses = Accounts of type 'expense' (COGS, Operating Expenses)

        const query = this.db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .whereIn('a.account_type', ['income', 'expense'])
            .select(
                'a.id', 'a.code', 'a.name', 'a.account_type', 'g.name as group_name',
                this.db.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as net_credit')
                // Income: Credit normal (Positive net_credit)
                // Expense: Debit normal (Negative net_credit)
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'g.name');

        if (startDate) query.where('le.entry_date', '>=', startDate);
        if (endDate) query.where('le.entry_date', '<=', endDate);

        const results = await query.orderBy('a.code');

        const report = {
            income: [],
            expenses: [],
            total_income: 0,
            total_expenses: 0,
            net_profit: 0
        };

        results.forEach(row => {
            const amount = parseFloat(row.net_credit);
            if (row.account_type === 'income') {
                report.income.push({ ...row, amount: amount }); // Credit Balance is positive for income
                report.total_income += amount;
            } else {
                // For expenses, net_credit is usually negative (more debits). 
                // We want to show expense as a positive number for the report.
                report.expenses.push({ ...row, amount: Math.abs(amount) });
                report.total_expenses += Math.abs(amount);
            }
        });

        report.net_profit = report.total_income - report.total_expenses;
        return report;
    }

    async getBalanceSheet(asOfDate) {
        // Assets = Liabilities + Equity
        // Equity = Capital + Net Profit (Retained Earnings)

        // 1. Get Balances for Asset, Liability, Capital
        const query = this.db('ledger_entries as le')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .whereIn('a.account_type', ['asset', 'liability', 'capital'])
            .select(
                'a.id', 'a.code', 'a.name', 'a.account_type', 'g.name as group_name',
                this.db.raw('SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) as net_debit')
                // Asset: Debit normal (+ve)
                // Liability/Capital: Credit normal (-ve)
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'g.name');

        if (asOfDate) query.where('le.entry_date', '<=', asOfDate);

        const results = await query.orderBy('a.code');

        // 2. Calculate Net Profit (Retained Earnings) up to asOfDate
        // Note: For Balance Sheet, we need cumulative Net Profit since beginning of time
        const plReport = await this.getProfitAndLoss(null, asOfDate);
        const retainedEarnings = plReport.net_profit;

        const report = {
            assets: [],
            liabilities: [],
            equity: [],
            total_assets: 0,
            total_liabilities: 0,
            total_equity: 0
        };

        results.forEach(row => {
            const amount = parseFloat(row.net_debit);
            if (row.account_type === 'asset') {
                report.assets.push({ ...row, amount: amount });
                report.total_assets += amount;
            } else if (row.account_type === 'liability') {
                report.liabilities.push({ ...row, amount: Math.abs(amount) }); // Show as positive
                report.total_liabilities += Math.abs(amount);
            } else if (row.account_type === 'capital') {
                report.equity.push({ ...row, amount: Math.abs(amount) }); // Show as positive
                report.total_equity += Math.abs(amount);
            }
        });

        // Add Retained Earnings to Equity
        report.equity.push({
            name: 'Retained Earnings (Net Profit)',
            group_name: 'Equity',
            amount: retainedEarnings
        });
        report.total_equity += retainedEarnings;

        return {
            ...report,
            check: {
                assets: report.total_assets,
                liabilities_plus_equity: report.total_liabilities + report.total_equity,
                diff: report.total_assets - (report.total_liabilities + report.total_equity)
            }
        };
    }
    async getSalesByProduct({ startDate, endDate, limit = 20 }) {
        let query = this.db('sale_items as si')
            .join('sales as s', 'si.sale_id', 's.id')
            .join('products as p', 'si.product_id', 'p.id')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .select(
                'p.name as product_name',
                'p.code as product_code',
                'c.name as category',
                this.db.raw('SUM(si.quantity) as total_quantity'),
                this.db.raw('SUM(si.line_total) as total_revenue'),
                this.db.raw('COUNT(DISTINCT s.id) as transaction_count')
            )
            .where('s.status', 'completed')
            .groupBy('p.id', 'p.name', 'p.code', 'c.name')
            .orderBy('total_revenue', 'desc');

        if (startDate) query.where('s.invoice_date', '>=', startDate);
        if (endDate) query.where('s.invoice_date', '<=', endDate);
        if (limit) query.limit(limit);

        return await query;
    }

    async getSalesByCustomer({ startDate, endDate, limit = 20 }) {
        let query = this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .select(
                this.db.raw("COALESCE(c.name, 'Walk-in Customer') as customer_name"),
                'c.phone',
                this.db.raw('COUNT(s.id) as total_invoices'),
                this.db.raw('SUM(s.total_amount) as total_spent'),
                this.db.raw('SUM(s.balance_amount) as outstanding_balance')
            )
            .where('s.status', 'completed')
            .groupBy('c.id', 'c.name', 'c.phone')
            .orderBy('total_spent', 'desc');

        if (startDate) query.where('s.invoice_date', '>=', startDate);
        if (endDate) query.where('s.invoice_date', '<=', endDate);
        if (limit) query.limit(limit);

        return await query;
    }

    async getPurchaseBySupplier({ startDate, endDate }) {
        let query = this.db('purchases as p')
            .leftJoin('suppliers as s', 'p.supplier_id', 's.id')
            .select(
                's.name as supplier_name',
                's.contact_person',
                this.db.raw('COUNT(p.id) as total_bills'),
                this.db.raw('SUM(p.total_amount) as total_purchased'),
                this.db.raw('SUM(p.balance_amount) as outstanding_balance')
            )
            .where('p.status', 'completed')
            .groupBy('s.id', 's.name', 's.contact_person')
            .orderBy('total_purchased', 'desc');

        if (startDate) query.where('p.bill_date', '>=', startDate);
        if (endDate) query.where('p.bill_date', '<=', endDate);

        return await query;
    }

    async getExpenseSummary({ startDate, endDate }) {
        let query = this.db('expenses as e')
            .leftJoin('expense_categories as c', 'e.category_id', 'c.id')
            .select(
                'c.name as category',
                this.db.raw('COUNT(e.id) as count'),
                this.db.raw('SUM(e.amount) as total_amount')
            )
            .groupBy('c.id', 'c.name')
            .orderBy('total_amount', 'desc');

        if (startDate) query.where('e.expense_date', '>=', startDate);
        if (endDate) query.where('e.expense_date', '<=', endDate);

        return await query;
    }
}

module.exports = ReportService;
