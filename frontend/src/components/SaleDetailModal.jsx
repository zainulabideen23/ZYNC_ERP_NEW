import React, { useEffect, useState } from 'react';
import { salesAPI } from '../services/api';
import { format } from 'date-fns';

const SaleDetailModal = ({ saleId, onClose, onPrint }) => {
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (saleId) {
            loadDetails();
        }
    }, [saleId]);

    const loadDetails = async () => {
        setLoading(true);
        try {
            const res = await salesAPI.get(saleId);
            setSale(res.data);
        } catch (err) {
            console.error("Failed to load sale details:", err);
        } finally {
            setLoading(false);
        }
    };

    if (!saleId) return null;

    // Helper to format currency
    const fCr = (val) => `Rs. ${Number(val).toLocaleString()}`;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <div className="modal-header">
                    <h3>Sale Details</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-muted">Loading sale details...</div>
                ) : sale ? (
                    <div className="modal-body">
                        {/* Header Info */}
                        <div className="grid grid-2 gap-4 mb-4">
                            <div className="p-4" style={{ background: 'var(--color-panel-2)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Invoice Info</div>
                                <div className="font-mono text-lg font-bold text-accent">{sale.invoice_number}</div>
                                <div className="text-sm">{format(new Date(sale.sale_date), 'dd MMM yyyy, hh:mm a')}</div>
                                <div className="mt-2">
                                    <span className={`badge ${sale.status === 'completed' ? 'badge-success' : sale.status === 'confirmed' ? 'badge-warning' : 'badge-danger'}`}>
                                        {sale.status === 'completed' ? 'PAID' : sale.status.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4" style={{ background: 'var(--color-panel-2)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Customer</div>
                                <div className="font-bold text-lg">{sale.customer_name || 'Walk-in Customer'}</div>
                                {sale.customer_phone && <div className="text-sm text-muted">📞 {sale.customer_phone}</div>}
                                <div className="text-xs text-muted mt-2">Created by: {sale.created_by_name || 'System'}</div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="table-container mb-4" style={{ border: '1px solid var(--border-surface)', borderRadius: 'var(--radius-sm)' }}>
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Item</th>
                                        <th className="text-center">Qty</th>
                                        <th className="text-right">Price</th>
                                        <th className="text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(sale.items || []).map((item, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className="font-500">{item.product_name}</div>
                                                {/* <div className="text-xs text-muted">SKU: {item.sku}</div> */}
                                            </td>
                                            <td className="text-center">{item.quantity}</td>
                                            <td className="text-right">{fCr(item.unit_price)}</td>
                                            <td className="text-right font-bold">{fCr(item.line_total || item.quantity * item.unit_price)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Financials */}
                        <div className="flex justify-between items-start">
                            <div className="text-sm text-muted" style={{ maxWidth: '50%' }}>
                                <div className="font-bold mb-1">Notes:</div>
                                <p>{sale.notes || 'No notes added.'}</p>
                            </div>
                            <div className="card p-4" style={{ minWidth: '250px', background: 'var(--color-panel-2)' }}>
                                <div className="flex justify-between mb-1 text-sm">
                                    <span className="text-muted">Subtotal</span>
                                    <span>{fCr(sale.subtotal)}</span>
                                </div>
                                {Number(sale.discount_amount) > 0 && (
                                    <div className="flex justify-between mb-1 text-sm text-success">
                                        <span>Discount</span>
                                        <span>- {fCr(sale.discount_amount)}</span>
                                    </div>
                                )}
                                {Number(sale.tax_amount) > 0 && (
                                    <div className="flex justify-between mb-1 text-sm">
                                        <span>Tax</span>
                                        <span>+ {fCr(sale.tax_amount)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between mt-2 pt-2 border-t border-surface font-bold text-lg">
                                    <span>Total</span>
                                    <span>{fCr(sale.total_amount)}</span>
                                </div>
                                <div className="flex justify-between mt-1 text-sm">
                                    <span className="text-muted">Paid</span>
                                    <span className="text-success">{fCr(sale.amount_paid)}</span>
                                </div>
                                {Number(sale.amount_due) > 0 && (
                                    <div className="flex justify-between mt-1 text-sm font-bold text-danger">
                                        <span>Due</span>
                                        <span>{fCr(sale.amount_due)}</span>
                                    </div>
                                )}
                                {Number(sale.return_to_customer) > 0 && (
                                    <div className="flex justify-between mt-1 text-sm text-accent">
                                        <span>Change</span>
                                        <span>{fCr(sale.return_to_customer)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={onClose}>Close</button>
                            <button className="btn btn-primary" onClick={() => onPrint(sale)}>
                                🖨️ Print Invoice
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 text-center text-danger">Failed to load sale.</div>
                )}
            </div>
        </div>
    );
};

export default SaleDetailModal;
