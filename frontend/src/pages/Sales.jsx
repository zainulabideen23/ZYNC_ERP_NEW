import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { salesAPI } from '../services/api'
import { format } from 'date-fns'
import { generateInvoicePDF } from '../components/InvoicePDF'

function Sales() {
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => { loadData() }, [])

    const loadData = async () => {
        try {
            const response = await salesAPI.list({ limit: 100 })
            setSales(response.data)
        } catch (error) {
            console.error('Failed to load sales:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (value) => `Rs. ${Number(value).toLocaleString()}`

    const handlePrintInvoice = async (sale) => {
        try {
            // Fetch full sale details including items
            const response = await salesAPI.get(sale.id)
            const fullSaleData = response.data

            // Generate PDF with complete data
            generateInvoicePDF(fullSaleData)
        } catch (error) {
            console.error('Failed to generate PDF:', error)
            alert('Failed to generate invoice PDF. Please try again.')
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
                        <tr><th>Invoice #</th><th>Date</th><th>Customer</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Paid</th><th>Status</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        {sales.map((sale) => (
                            <tr key={sale.id}>
                                <td className="font-mono">{sale.invoice_number}</td>
                                <td>{format(new Date(sale.invoice_date), 'dd/MM/yyyy')}</td>
                                <td>{sale.customer_name || 'Walk-in'}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(sale.total_amount)}</td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(sale.paid_amount)}</td>
                                <td>
                                    <span className={`badge ${sale.payment_status === 'paid' ? 'badge-success' : sale.payment_status === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                                        {sale.payment_status}
                                    </span>
                                </td>
                                <td>
                                    <button
                                        className="btn btn-small"
                                        onClick={() => handlePrintInvoice(sale)}
                                        title="Download PDF"
                                        style={{
                                            padding: '4px 8px',
                                            fontSize: '11px',
                                            background: '#1e3c72',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        📄
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
