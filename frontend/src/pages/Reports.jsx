import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { reportsAPI } from '../services/api'
import { format } from 'date-fns'
import './Reports.css'

function Reports() {
    const [activeTab, setActiveTab] = useState('stock')
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState({
        from_date: format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd'),
        to_date: format(new Date(), 'yyyy-MM-dd'),
        as_of_date: format(new Date(), 'yyyy-MM-dd'),
        low_stock_only: false
    })

    const [data, setData] = useState(null)

    useEffect(() => {
        loadReport()
    }, [activeTab])

    const loadReport = async () => {
        setLoading(true)
        setData(null)
        try {
            let response;
            switch (activeTab) {
                case 'stock':
                    response = await reportsAPI.stock({ low_stock_only: filters.low_stock_only })
                    break;
                case 'sales':
                    response = await reportsAPI.salesByDate({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
                case 'trial':
                    response = await reportsAPI.trialBalance({ as_of_date: filters.as_of_date })
                    break;
                case 'pl':
                    response = await reportsAPI.profitLoss({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
                case 'bs':
                    response = await reportsAPI.balanceSheet({ as_of_date: filters.as_of_date })
                    break;
                case 'sales_product':
                    response = await reportsAPI.salesByProduct({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
                case 'sales_customer':
                    response = await reportsAPI.salesByCustomer({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
                case 'purchase_supplier':
                    response = await reportsAPI.purchaseBySupplier({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
                case 'expense_summary':
                    response = await reportsAPI.expenseSummary({ from_date: filters.from_date, to_date: filters.to_date })
                    break;
            }
            // Debug log for stock report response
            if (activeTab === 'stock') {
                console.log('Stock report API response:', response);
            }
            setData(response.data)
        } catch (error) {
            console.error('Failed to load report:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleFilterSubmit = (e) => {
        e.preventDefault()
        loadReport()
    }

    const renderStockReport = () => (
        <>
            {data?.summary && (
                <div className="stats-cards mb-6">
                    <div className="card stat-card">
                        <div className="stat-label">Total Inventory Value</div>
                        <div className="stat-value text-success">Rs. {data.summary.total_value.toLocaleString()}</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-label">Low Stock Items</div>
                        <div className="stat-value text-danger">{data.summary.low_stock_count}</div>
                    </div>
                    <div className="card stat-card">
                        <div className="stat-label">Total Products</div>
                        <div className="stat-value">{data.summary.total_items}</div>
                    </div>
                </div>
            )}

            <table className="table">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Product</th>
                        <th>Category</th>
                        <th className="text-right">Stock</th>
                        <th className="text-right">Value</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.items?.map((item) => (
                        <tr key={item.id} style={item.is_low_stock ? { backgroundColor: 'rgba(239, 68, 68, 0.05)' } : {}}>
                            <td className="font-mono text-muted">
                                {item.code}
                                {item.is_low_stock && <span className="ml-2 text-xs text-danger" title="Low Stock">⚠️</span>}
                            </td>
                            <td>{item.name}</td>
                            <td><span className="badge badge-secondary">{item.category || '-'}</span></td>
                            <td className={`text-right font-bold ${item.is_low_stock ? 'text-danger' : ''}`}>
                                {item.current_stock} {item.unit}
                            </td>
                            <td className="text-right">Rs. {item.stock_value.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </>
    )

    const renderSalesReport = () => (
        <table className="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th className="text-center">Invoices</th>
                    <th className="text-right">Total Sales</th>
                    <th className="text-right">Received</th>
                    <th className="text-right">Credit</th>
                </tr>
            </thead>
            <tbody>
                {data?.map((item, index) => (
                    <tr key={index}>
                        <td>{format(new Date(item.invoice_date), 'dd MMM yyyy')}</td>
                        <td className="text-center">{item.invoices}</td>
                        <td className="text-right text-success font-bold">Rs. {parseFloat(item.total).toLocaleString()}</td>
                        <td className="text-right">Rs. {parseFloat(item.received).toLocaleString()}</td>
                        <td className="text-right text-danger">Rs. {parseFloat(item.credit).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const renderTrialBalance = () => (
        <>
            <table className="table">
                <thead>
                    <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th>Group</th>
                        <th className="text-right">Debit</th>
                        <th className="text-right">Credit</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.accounts?.map((acc) => (
                        <tr key={acc.id}>
                            <td className="font-mono text-muted">{acc.code}</td>
                            <td>{acc.name}</td>
                            <td>{acc.group_name}</td>
                            <td className="text-right">{acc.debits > 0 ? `Rs. ${acc.debits.toLocaleString()}` : '-'}</td>
                            <td className="text-right">{acc.credits > 0 ? `Rs. ${acc.credits.toLocaleString()}` : '-'}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr className="font-bold bg-tertiary">
                        <td colSpan="3">Totals</td>
                        <td className="text-right text-primary">Rs. {data?.totals?.debits?.toLocaleString()}</td>
                        <td className="text-right text-primary">Rs. {data?.totals?.credits?.toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
            <div className={`balanced-badge ${data?.is_balanced ? 'success' : 'error'}`}>
                {data?.is_balanced ? '✅ Trial Balance is Balanced' : '❌ Trial Balance is NOT Balanced'}
            </div>
        </>
    )

    const renderProfitLoss = () => (
        <div className="financial-statement">
            <div className="statement-section">
                <h3>Income</h3>
                {data?.income?.map(acc => (
                    <div className="statement-row" key={acc.id}>
                        <span>{acc.name}</span>
                        <span>Rs. {acc.amount.toLocaleString()}</span>
                    </div>
                ))}
                <div className="statement-row subtotal">
                    <span>Total Income</span>
                    <span>Rs. {data?.total_income?.toLocaleString()}</span>
                </div>
            </div>

            <div className="statement-section">
                <h3>Operating Expenses</h3>
                {data?.expenses?.map(acc => (
                    <div className="statement-row" key={acc.id}>
                        <span>{acc.name}</span>
                        <span>Rs. {acc.amount.toLocaleString()}</span>
                    </div>
                ))}
                <div className="statement-row subtotal">
                    <span>Total Expenses</span>
                    <span>Rs. {data?.total_expenses?.toLocaleString()}</span>
                </div>
            </div>

            <div className="statement-row total">
                <span>Net Profit / (Loss)</span>
                <span className={data?.net_profit >= 0 ? 'text-success' : 'text-danger'}>
                    Rs. {data?.net_profit?.toLocaleString()}
                </span>
            </div>
        </div>
    )

    const renderBalanceSheet = () => (
        <div className="financial-statement grid-2">
            <div>
                <div className="statement-section">
                    <h3>Assets</h3>
                    {data?.assets?.map(acc => (
                        <div className="statement-row" key={acc.id}>
                            <span className={acc.group_name.includes('Fixed') ? 'font-bold' : ''}>
                                {acc.name} <small className="text-muted">({acc.group_name})</small>
                            </span>
                            <span>Rs. {acc.amount.toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="statement-row total">
                        <span>Total Assets</span>
                        <span>Rs. {data?.total_assets?.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div>
                <div className="statement-section">
                    <h3>Liabilities</h3>
                    {data?.liabilities?.map(acc => (
                        <div className="statement-row" key={acc.id}>
                            <span>{acc.name}</span>
                            <span>Rs. {acc.amount.toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="statement-row subtotal">
                        <span>Total Liabilities</span>
                        <span>Rs. {data?.total_liabilities?.toLocaleString()}</span>
                    </div>
                </div>

                <div className="statement-section">
                    <h3>Equity</h3>
                    {data?.equity?.map((acc, i) => (
                        <div className="statement-row" key={i}>
                            <span>{acc.name}</span>
                            <span>Rs. {acc.amount.toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="statement-row subtotal">
                        <span>Total Equity</span>
                        <span>Rs. {data?.total_equity?.toLocaleString()}</span>
                    </div>
                </div>

                <div className="statement-row total">
                    <span>Total Liabilities & Equity</span>
                    <span>Rs. {(data?.total_liabilities + data?.total_equity).toLocaleString()}</span>
                </div>
            </div>
        </div>
    )

    const renderSalesByProduct = () => (
        <table className="table">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Code</th>
                    <th>Category</th>
                    <th className="text-right">Qty Sold</th>
                    <th className="text-right">Revenue</th>
                </tr>
            </thead>
            <tbody>
                {data?.map((item, i) => (
                    <tr key={i}>
                        <td>{item.product_name}</td>
                        <td className="font-mono text-muted">{item.product_code}</td>
                        <td><span className="badge badge-secondary">{item.category}</span></td>
                        <td className="text-right">{item.total_quantity}</td>
                        <td className="text-right font-bold">Rs. {parseFloat(item.total_revenue).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const renderSalesByCustomer = () => (
        <table className="table">
            <thead>
                <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th className="text-center">Total Invoices</th>
                    <th className="text-right">Total Spent</th>
                    <th className="text-right">Balance Due</th>
                </tr>
            </thead>
            <tbody>
                {data?.map((item, i) => (
                    <tr key={i}>
                        <td>{item.customer_name}</td>
                        <td>{item.phone || '-'}</td>
                        <td className="text-center">{item.total_invoices}</td>
                        <td className="text-right font-bold text-success">Rs. {parseFloat(item.total_spent).toLocaleString()}</td>
                        <td className="text-right text-danger">Rs. {parseFloat(item.outstanding_balance).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const renderPurchaseBySupplier = () => (
        <table className="table">
            <thead>
                <tr>
                    <th>Supplier</th>
                    <th>Contact Person</th>
                    <th className="text-center">Total Bills</th>
                    <th className="text-right">Total Purchased</th>
                    <th className="text-right">Balance Payable</th>
                </tr>
            </thead>
            <tbody>
                {data?.map((item, i) => (
                    <tr key={i}>
                        <td>{item.supplier_name}</td>
                        <td>{item.contact_person || '-'}</td>
                        <td className="text-center">{item.total_bills}</td>
                        <td className="text-right font-bold">Rs. {parseFloat(item.total_purchased).toLocaleString()}</td>
                        <td className="text-right text-danger">Rs. {parseFloat(item.outstanding_balance).toLocaleString()}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    )

    const renderExpenseSummary = () => (
        <div style={{ maxWidth: '600px' }}>
            <table className="table">
                <thead>
                    <tr>
                        <th>Expense Category</th>
                        <th className="text-center">Transactions</th>
                        <th className="text-right">Total Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {data?.map((item, i) => (
                        <tr key={i}>
                            <td>{item.category}</td>
                            <td className="text-center">{item.count}</td>
                            <td className="text-right font-bold">Rs. {parseFloat(item.total_amount).toLocaleString()}</td>
                        </tr>
                    ))}
                    <tr className="bg-tertiary">
                        <td colSpan="2" className="text-right font-bold">Total Expenses</td>
                        <td className="text-right font-bold">
                            Rs. {data?.reduce((sum, item) => sum + parseFloat(item.total_amount), 0).toLocaleString()}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    )

    return (
        <div className="page-container">
            <header className="page-header">
                <h1 className="page-title">Reports</h1>
            </header>

            <div className="report-tabs">
                <button className={`report-tab ${activeTab === 'stock' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('stock')} aria-label="Stock Report">📦 Stock Report</button>
                <button className={`report-tab ${activeTab === 'sales' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('sales')} aria-label="Sales Summary">💰 Sales Summary</button>
                <button className={`report-tab ${activeTab === 'trial' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('trial')} aria-label="Trial Balance">⚖️ Trial Balance</button>
                <button className={`report-tab ${activeTab === 'pl' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('pl')} aria-label="Profit and Loss">📉 Profit & Loss</button>
                <button className={`report-tab ${activeTab === 'bs' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('bs')} aria-label="Balance Sheet">🏛️ Balance Sheet</button>
                <div style={{ width: '1px', background: 'var(--border-surface)', margin: '0 4px' }}></div>
                <button className={`report-tab ${activeTab === 'sales_product' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('sales_product')} aria-label="Sales by Product">📦 Products</button>
                <button className={`report-tab ${activeTab === 'sales_customer' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('sales_customer')} aria-label="Sales by Customer">👥 Customers</button>
                <button className={`report-tab ${activeTab === 'purchase_supplier' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('purchase_supplier')} aria-label="Purchases by Supplier">🚛 Suppliers</button>
                <button className={`report-tab ${activeTab === 'expense_summary' ? 'report-tab--active' : ''}`} onClick={() => setActiveTab('expense_summary')} aria-label="Expense Summary">💸 Expenses</button>
            </div>

            <form onSubmit={handleFilterSubmit} className="report-filters">
                {(activeTab === 'stock') && (
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={filters.low_stock_only}
                                onChange={(e) => setFilters({ ...filters, low_stock_only: e.target.checked })}
                            />
                            <span>Show Low Stock Only</span>
                        </label>
                    </div>
                )}
                {(activeTab === 'pl' || activeTab === 'sales' || activeTab === 'sales_product' || activeTab === 'sales_customer' || activeTab === 'purchase_supplier' || activeTab === 'expense_summary') && (
                    <>
                        <div className="form-group mb-0">
                            <label className="form-label text-xs">From Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={filters.from_date}
                                onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                            />
                        </div>
                        <div className="form-group mb-0">
                            <label className="form-label text-xs">To Date</label>
                            <input
                                type="date"
                                className="form-input"
                                value={filters.to_date}
                                onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                            />
                        </div>
                    </>
                )}
                {(activeTab === 'trial' || activeTab === 'bs') && (
                    <div className="form-group mb-0">
                        <label className="form-label text-xs">As of Date</label>
                        <input
                            type="date"
                            className="form-input"
                            value={filters.as_of_date}
                            onChange={(e) => setFilters({ ...filters, as_of_date: e.target.value })}
                        />
                    </div>
                )}
                <button type="submit" className="btn btn-secondary" style={{ marginTop: 'auto' }}>
                    Refresh Report
                </button>
            </form>

            <div className="card">
                {loading ? (
                    <div className="text-center p-6 text-muted">Loading report data...</div>
                ) : (
                    <>
                        {activeTab === 'stock' && renderStockReport()}
                        {activeTab === 'sales' && renderSalesReport()}
                        {activeTab === 'trial' && renderTrialBalance()}
                        {activeTab === 'pl' && renderProfitLoss()}
                        {activeTab === 'bs' && renderBalanceSheet()}
                        {activeTab === 'sales_product' && renderSalesByProduct()}
                        {activeTab === 'sales_customer' && renderSalesByCustomer()}
                        {activeTab === 'purchase_supplier' && renderPurchaseBySupplier()}
                        {activeTab === 'expense_summary' && renderExpenseSummary()}
                    </>
                )}
            </div>
        </div>
    )
}

export default Reports
