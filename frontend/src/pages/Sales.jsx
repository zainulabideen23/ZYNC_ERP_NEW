import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { salesAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'

function Sales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    // Subscribe to data sync events to refresh list when sales change
    useDataSync(DataSyncEvents.SALE_CREATED, () => {
        loadData()
    })

    const loadData = async () => {
        try {
            const response = await salesAPI.list({ limit: 100 })
            setSales(response.data || [])
        } catch (error) {
            console.error('Failed to load sales:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    // Direct print using hidden iframe (no new window)
    const handlePrintInvoice = async (sale) => {
        try {
            const response = await salesAPI.get(sale.id)
            const data = response.data

            // Create professional printable invoice HTML
            const printContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Invoice-${data.invoice_number}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif; 
                            padding: 40px; 
                            max-width: 800px; 
                            margin: 0 auto; 
                            color: #1a1a2e;
                            line-height: 1.5;
                        }
                        
                        /* Header Section */
                        .invoice-header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            margin-bottom: 40px;
                            padding-bottom: 25px;
                            border-bottom: 3px solid #2563eb;
                        }
                        .company-info h1 { 
                            font-size: 32px; 
                            font-weight: 700; 
                            color: #2563eb;
                            letter-spacing: -0.5px;
                        }
                        .company-info p { 
                            color: #64748b; 
                            font-size: 13px;
                            margin-top: 4px;
                        }
                        .invoice-title {
                            text-align: right;
                        }
                        .invoice-title h2 {
                            font-size: 28px;
                            font-weight: 300;
                            color: #64748b;
                            text-transform: uppercase;
                            letter-spacing: 3px;
                        }
                        .invoice-title .invoice-number {
                            font-size: 18px;
                            font-weight: 600;
                            color: #1a1a2e;
                            margin-top: 5px;
                        }
                        
                        /* Billing Section */
                        .billing-section {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 35px;
                            gap: 40px;
                        }
                        .billing-box {
                            flex: 1;
                            padding: 20px;
                            background: #f8fafc;
                            border-radius: 8px;
                            border-left: 4px solid #2563eb;
                        }
                        .billing-box h3 {
                            font-size: 11px;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                            color: #64748b;
                            margin-bottom: 10px;
                            font-weight: 600;
                        }
                        .billing-box p {
                            font-size: 15px;
                            color: #1a1a2e;
                        }
                        .billing-box .highlight {
                            font-weight: 600;
                            font-size: 16px;
                        }
                        
                        /* Table */
                        table { 
                            width: 100%; 
                            border-collapse: collapse; 
                            margin-bottom: 30px;
                        }
                        thead tr {
                            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                        }
                        th { 
                            padding: 14px 16px; 
                            text-align: left; 
                            font-weight: 600;
                            color: #ffffff;
                            font-size: 12px;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        td { 
                            padding: 16px; 
                            border-bottom: 1px solid #e2e8f0;
                            font-size: 14px;
                        }
                        tbody tr:hover { background: #f8fafc; }
                        tbody tr:last-child td { border-bottom: 2px solid #e2e8f0; }
                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .item-name { font-weight: 500; }
                        
                        /* Totals Section */
                        .totals-wrapper {
                            display: flex;
                            justify-content: flex-end;
                        }
                        .totals {
                            width: 320px;
                            background: #f8fafc;
                            border-radius: 8px;
                            padding: 20px;
                        }
                        .totals .row { 
                            display: flex; 
                            justify-content: space-between; 
                            padding: 10px 0;
                            font-size: 14px;
                        }
                        .totals .row span:first-child { color: #64748b; }
                        .totals .row span:last-child { font-weight: 500; }
                        .totals .row.subtotal { border-bottom: 1px dashed #cbd5e1; }
                        .totals .row.total { 
                            font-size: 20px; 
                            font-weight: 700; 
                            color: #1a1a2e;
                            border-top: 2px solid #2563eb;
                            margin-top: 10px;
                            padding-top: 15px;
                        }
                        .totals .row.total span:first-child { color: #1a1a2e; }
                        .totals .row.paid { color: #16a34a; }
                        .totals .row.paid span { color: #16a34a !important; font-weight: 600; }
                        .totals .row.due { color: #dc2626; }
                        .totals .row.due span { color: #dc2626 !important; font-weight: 600; }
                        .totals .row.change { color: #2563eb; }
                        .totals .row.change span { color: #2563eb !important; }
                        
                        /* Status Badge */
                        .status-badge {
                            display: inline-block;
                            padding: 6px 16px;
                            border-radius: 20px;
                            font-size: 12px;
                            font-weight: 600;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        }
                        .status-paid { background: #dcfce7; color: #16a34a; }
                        .status-partial { background: #fef3c7; color: #d97706; }
                        .status-unpaid { background: #fee2e2; color: #dc2626; }
                        
                        /* Footer */
                        .footer {
                            margin-top: 50px;
                            padding-top: 25px;
                            border-top: 1px solid #e2e8f0;
                            text-align: center;
                        }
                        .footer .thanks {
                            font-size: 18px;
                            color: #2563eb;
                            font-weight: 500;
                            margin-bottom: 8px;
                        }
                        .footer .meta {
                            font-size: 11px;
                            color: #94a3b8;
                        }
                        
                        /* Print Styles */
                        @media print { 
                            body { padding: 20px; }
                            .billing-box { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            thead tr { background: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            th { color: #ffffff !important; }
                            .totals { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .status-badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    </style>
                </head>
                <body>
                    <div class="invoice-header">
                        <div class="company-info">
                            <h1>ZYNC</h1>
                            <p>Enterprise Resource Planning</p>
                        </div>
                        <div class="invoice-title">
                            <h2>Invoice</h2>
                            <div class="invoice-number">${data.invoice_number}</div>
                        </div>
                    </div>
                    
                    <div class="billing-section">
                        <div class="billing-box">
                            <h3>Bill To</h3>
                            <p class="highlight">${data.customer_name || 'Walk-in Customer'}</p>
                        </div>
                        <div class="billing-box">
                            <h3>Invoice Date</h3>
                            <p class="highlight">${format(new Date(data.sale_date), 'MMMM dd, yyyy')}</p>
                            <p style="margin-top: 5px; font-size: 13px; color: #64748b;">${format(new Date(data.sale_date), 'hh:mm a')}</p>
                        </div>
                        <div class="billing-box">
                            <h3>Status</h3>
                            <span class="status-badge ${Number(data.amount_due) === 0 ? 'status-paid' : Number(data.amount_paid) > 0 ? 'status-partial' : 'status-unpaid'}">
                                ${Number(data.amount_due) === 0 ? 'Paid' : Number(data.amount_paid) > 0 ? 'Partial' : 'Unpaid'}
                            </span>
                        </div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50px;">#</th>
                                <th>Description</th>
                                <th class="text-center" style="width: 80px;">Qty</th>
                                <th class="text-right" style="width: 120px;">Unit Price</th>
                                <th class="text-right" style="width: 130px;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(data.items || []).map((item, i) => `
                                <tr>
                                    <td class="text-center">${i + 1}</td>
                                    <td class="item-name">${item.product_name || item.name}</td>
                                    <td class="text-center">${item.quantity}</td>
                                    <td class="text-right">Rs. ${Number(item.unit_price).toLocaleString()}</td>
                                    <td class="text-right"><strong>Rs. ${Number(item.line_total || item.quantity * item.unit_price).toLocaleString()}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="totals-wrapper">
                        <div class="totals">
                            <div class="row subtotal"><span>Subtotal</span><span>Rs. ${Number(data.subtotal).toLocaleString()}</span></div>
                            ${Number(data.discount_amount) > 0 ? `<div class="row"><span>Discount</span><span>- Rs. ${Number(data.discount_amount).toLocaleString()}</span></div>` : ''}
                            ${Number(data.tax_amount) > 0 ? `<div class="row"><span>Tax</span><span>+ Rs. ${Number(data.tax_amount).toLocaleString()}</span></div>` : ''}
                            <div class="row total"><span>Total</span><span>Rs. ${Number(data.total_amount).toLocaleString()}</span></div>
                            <div class="row paid"><span>Amount Paid</span><span>Rs. ${Number(data.amount_paid).toLocaleString()}</span></div>
                            ${Number(data.return_to_customer) > 0 ? `<div class="row change"><span>Change Given</span><span>Rs. ${Number(data.return_to_customer).toLocaleString()}</span></div>` : ''}
                            ${Number(data.amount_due) > 0 ? `<div class="row due"><span>Balance Due</span><span>Rs. ${Number(data.amount_due).toLocaleString()}</span></div>` : ''}
                        </div>
                    </div>
                    
                    <div class="footer">
                        <p class="thanks">Thank you for your business!</p>
                        <p class="meta">Invoice generated on ${format(new Date(), 'MMMM dd, yyyy')} at ${format(new Date(), 'hh:mm a')}</p>
                    </div>
                </body>
                </html>
            `

            // Use hidden iframe for direct printing (no new window)
            let printFrame = document.getElementById('print-frame')
            if (!printFrame) {
                printFrame = document.createElement('iframe')
                printFrame.id = 'print-frame'
                printFrame.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;border:none;'
                document.body.appendChild(printFrame)
            }

            const frameDoc = printFrame.contentWindow || printFrame.contentDocument
            const doc = frameDoc.document || frameDoc
            doc.open()
            doc.write(printContent)
            doc.close()

            // Wait for content to load then print
            printFrame.onload = () => {
                frameDoc.focus()
                frameDoc.print()
            }

        } catch (error) {
            console.error('Failed to print invoice:', error)
            alert('Failed to print invoice. Please try again.')
        }
    }

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Sales</h1>
                <div className="flex gap-2">
                    <button className="btn btn-secondary" onClick={() => window.open('/#/pos', '_blank', 'width=1200,height=800')}>
                        🖥️ Launch POS
                    </button>
                    <Link to="/sales/new" className="btn btn-primary">+ New Sale</Link>
                </div>
            </div>
            <div className="card">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th style={{ textAlign: 'right' }}>Total</th>
                            <th style={{ textAlign: 'right' }}>Paid</th>
                            <th style={{ textAlign: 'right' }}>Due/Return</th>
                            <th>Status</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sales.map((sale) => (
                            <tr key={sale.id}>
                                <td className="font-mono">{sale.invoice_number}</td>
                                <td>{format(new Date(sale.sale_date), 'dd/MM/yyyy')}</td>
                                <td>{sale.customer_name || 'Walk-in'}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(sale.total_amount)}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(sale.amount_paid)}</td>
                                <td style={{ textAlign: 'right' }}>
                                    {parseFloat(sale.return_to_customer) > 0 ? (
                                        <span className="text-success" title="Return to Customer">
                                            ↩ {formatCurrency(sale.return_to_customer)}
                                        </span>
                                    ) : parseFloat(sale.amount_due) > 0 ? (
                                        <span className="text-warning" title="Amount Due">
                                            {formatCurrency(sale.amount_due)}
                                        </span>
                                    ) : (
                                        <span className="text-muted">-</span>
                                    )}
                                </td>
                                <td>
                                    <span className={`badge ${sale.status === 'completed' ? 'badge-success neon-success' : sale.status === 'confirmed' ? 'badge-warning' : 'badge-danger'}`}>
                                        {sale.status === 'completed' ? 'PAID' : sale.status.toUpperCase()}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => handlePrintInvoice(sale)}
                                        aria-label={`Print invoice ${sale.invoice_number}`}
                                    >
                                        🖨️ Print
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
export default Sales
