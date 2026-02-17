const { AppError } = require('../middleware/errorHandler');

class ReportService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Get dashboard summary stats
     */
    async getDashboardStats() {
        const today = new Date().toISOString().split('T')[0];

        // Current month boundaries
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

        // 1. Today's Sales
        const todaySales = await this.db('sales')
            .where('sale_date', today)
            .where('is_deleted', false)
            .select(
                this.db.raw('COUNT(*) as count'),
                this.db.raw('COALESCE(SUM(total_amount), 0) as total'),
                this.db.raw('COALESCE(SUM(amount_paid), 0) as received')
            )
            .first();

        // 2. Low Stock Count
        const lowStock = await this.db('products')
            .where('is_deleted', false)
            .where('track_stock', true)
            .whereRaw('current_stock <= min_stock_level')
            .count('* as count')
            .first();

        // 3. Receivables & Payables
        const receivables = await this.db('customers')
            .where('is_deleted', false)
            .select(this.db.raw('COALESCE(SUM(current_balance), 0) as total'))
            .first();

        const payables = await this.db('suppliers')
            .where('is_deleted', false)
            .select(this.db.raw('COALESCE(SUM(current_balance), 0) as total'))
            .first();

        // 4. Sales Trend (Last 7 Days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const startDate = sevenDaysAgo.toISOString().split('T')[0];

        const salesTrend = await this.db('sales')
            .where('sale_date', '>=', startDate)
            .where('is_deleted', false)
            .select('sale_date', this.db.raw('SUM(total_amount) as total'))
            .groupBy('sale_date')
            .orderBy('sale_date', 'asc');

        const trend = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const found = salesTrend.find(s => {
                const sDate = s.sale_date instanceof Date ? s.sale_date.toISOString().split('T')[0] : s.sale_date;
                return sDate === dateStr;
            });
            trend.push({ date: dateStr, amount: found ? parseFloat(found.total) : 0 });
        }

        // 5. Recent Activity
        const recentSales = await this.db('sales as s')
            .leftJoin('customers as c', 's.customer_id', 'c.id')
            .select('s.id', 's.invoice_number as ref', 'c.name as party_name', 's.total_amount as amount', 's.created_at', this.db.raw("'sale' as type"))
            .where('s.is_deleted', false)
            .orderBy('s.created_at', 'desc')
            .limit(5);

        const recentPurchases = await this.db('purchases as p')
            .leftJoin('suppliers as s_supp', 'p.supplier_id', 's_supp.id')
            .select('p.id', 'p.bill_number as ref', 's_supp.name as party_name', 'p.total_amount as amount', 'p.created_at', this.db.raw("'purchase' as type"))
            .where('p.is_deleted', false)
            .orderBy('p.created_at', 'desc')
            .limit(5);

        const recentActivity = [...recentSales, ...recentPurchases]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 8);

        // ── NEW: 6. Purchase Trend (Last 7 Days) ──
        const purchaseTrend = await this.db('purchases')
            .where('purchase_date', '>=', startDate)
            .where('is_deleted', false)
            .select('purchase_date', this.db.raw('SUM(total_amount) as total'))
            .groupBy('purchase_date')
            .orderBy('purchase_date', 'asc');

        const purchTrend = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const found = purchaseTrend.find(p => {
                const pDate = p.purchase_date instanceof Date ? p.purchase_date.toISOString().split('T')[0] : p.purchase_date;
                return pDate === dateStr;
            });
            purchTrend.push({ date: dateStr, amount: found ? parseFloat(found.total) : 0 });
        }

        // ── NEW: 7. Month Profit (current month P&L) ──
        let monthProfit = { total_income: 0, total_expenses: 0, net_profit: 0 };
        try {
            const pl = await this.getProfitAndLoss(monthStart, today);
            monthProfit = { total_income: pl.total_income, total_expenses: pl.total_expenses, net_profit: pl.net_profit };
        } catch (e) { /* ignore if no data */ }

        // ── NEW: 8. Last month sales total (for comparison %) ──
        const lastMonthSalesRow = await this.db('sales')
            .where('sale_date', '>=', lastMonthStart)
            .where('sale_date', '<=', lastMonthEnd)
            .where('is_deleted', false)
            .select(this.db.raw('COALESCE(SUM(total_amount), 0) as total'))
            .first();

        // Current month sales total
        const thisMonthSalesRow = await this.db('sales')
            .where('sale_date', '>=', monthStart)
            .where('is_deleted', false)
            .select(this.db.raw('COALESCE(SUM(total_amount), 0) as total'))
            .first();

        // ── NEW: 9. Top 5 Selling Products (this month) ──
        const topProducts = await this.db('sale_items as si')
            .join('sales as s', 'si.sale_id', 's.id')
            .join('products as p', 'si.product_id', 'p.id')
            .where('s.is_deleted', false)
            .where('s.sale_date', '>=', monthStart)
            .select(
                'p.name',
                this.db.raw('SUM(si.quantity) as qty_sold'),
                this.db.raw('SUM(si.line_total) as revenue')
            )
            .groupBy('p.id', 'p.name')
            .orderBy('qty_sold', 'desc')
            .limit(5);

        // ── NEW: 10. Expense Breakdown (this month by category) ──
        const expenseBreakdown = await this.db('expenses as e')
            .leftJoin('expense_categories as ec', 'e.category_id', 'ec.id')
            .where('e.is_deleted', false)
            .where('e.expense_date', '>=', monthStart)
            .select(
                this.db.raw("COALESCE(ec.name, 'Other') as category"),
                this.db.raw('SUM(e.amount) as total')
            )
            .groupBy('ec.id', 'ec.name')
            .orderBy('total', 'desc');

        // ── NEW: 11. Stock Health (counts by status) ──
        const allProducts = await this.db('products')
            .where('is_deleted', false)
            .where('track_stock', true)
            .select('current_stock', 'min_stock_level');

        let stockHealthy = 0, stockLow = 0, stockOut = 0;
        allProducts.forEach(p => {
            const stock = parseFloat(p.current_stock);
            if (stock <= 0) stockOut++;
            else if (stock <= p.min_stock_level) stockLow++;
            else stockHealthy++;
        });

        // ── NEW: 12. Pending Actions ──
        const overdueInvoices = await this.db('sales')
            .where('is_deleted', false)
            .where('amount_due', '>', 0)
            .where('status', '!=', 'completed')
            .count('* as count')
            .first();

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
            purchase_trend: purchTrend,
            recent_activity: recentActivity,
            month_profit: monthProfit,
            this_month_sales: parseFloat(thisMonthSalesRow.total),
            last_month_sales: parseFloat(lastMonthSalesRow.total),
            top_products: topProducts.map(p => ({ name: p.name, qty_sold: parseInt(p.qty_sold), revenue: parseFloat(p.revenue) })),
            expense_breakdown: expenseBreakdown.map(e => ({ category: e.category, total: parseFloat(e.total) })),
            stock_health: { healthy: stockHealthy, low: stockLow, out: stockOut, total: allProducts.length },
            pending_actions: {
                overdue_invoices: parseInt(overdueInvoices.count),
                low_stock: parseInt(lowStock.count)
            }
        };
    }

    /**
     * Get stock report
     */
    async getStockReport(params) {
        const { category_id, company_id, low_stock_only } = params;

        let query = this.db('products as p')
            .leftJoin('categories as c', 'p.category_id', 'c.id')
            .leftJoin('units as u', 'p.unit_id', 'u.id')
            .select(
                'p.id', 'p.code', 'p.name', 'p.retail_price', 'p.cost_price', 'p.min_stock_level', 'p.current_stock',
                'c.name as category', 'u.abbreviation as unit'
            )
            .where('p.is_deleted', false);

        if (category_id) query = query.where('p.category_id', category_id);
        // products table does not have a company_id column in this schema
        // if (company_id) query = query.where('p.company_id', company_id);
        if (low_stock_only === 'true') query = query.whereRaw('p.current_stock <= p.min_stock_level');

        const items = await query.orderBy('p.name');

        let totalValue = 0;
        let lowStockCount = 0;

        const processedItems = items.map(item => {
            const stock = parseFloat(item.current_stock);
            const cost = parseFloat(item.cost_price) || 0;
            const value = stock * cost;
            const isLow = stock <= item.min_stock_level;

            totalValue += value;
            if (isLow) lowStockCount++;

            return {
                ...item,
                stock_value: value,
                is_low_stock: isLow
            };
        });

        return {
            summary: {
                total_items: items.length,
                total_value: totalValue,
                low_stock_count: lowStockCount
            },
            items: processedItems
        };
    }

    /**
     * Profit and Loss Report
     */
    async getProfitAndLoss(startDate, endDate) {
        const query = this.db('ledger_entries as le')
            .join('journals as j', 'le.journal_id', 'j.id')
            .join('accounts as a', 'le.account_id', 'a.id')
            .join('account_groups as g', 'a.group_id', 'g.id')
            .whereIn('a.account_type', ['income', 'expense'])
            .select(
                'a.id', 'a.code', 'a.name', 'a.account_type', 'g.name as group_name',
                this.db.raw('SUM(CASE WHEN le.entry_type = \'credit\' THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.entry_type = \'debit\' THEN le.amount ELSE 0 END) as net_credit')
            )
            .groupBy('a.id', 'a.code', 'a.name', 'a.account_type', 'g.name');

        if (startDate) query.where('j.journal_date', '>=', startDate);
        if (endDate) query.where('j.journal_date', '<=', endDate);

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
                report.income.push({ ...row, amount });
                report.total_income += amount;
            } else {
                const expenseAmount = Math.abs(amount);
                report.expenses.push({ ...row, amount: expenseAmount });
                report.total_expenses += expenseAmount;
            }
        });

        report.net_profit = report.total_income - report.total_expenses;
        return report;
    }
}

module.exports = ReportService;

