import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { salesAPI } from '../services/api';
import { format } from 'date-fns';
import { DataSyncEvents, emit } from '../utils/dataSync';
import './SaleDetailModal.css';

const PAYMENT_METHOD_OPTIONS = [
    { value: 'cash', label: 'Cash' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'credit', label: 'Credit Adjustment' },
];

const RETURN_BLOCKED_STATUSES = ['cancelled', 'returned'];

const STATUS_STYLES = {
    completed: { className: 'badge-success', label: 'PAID' },
    confirmed: { className: 'badge-warning', label: 'CONFIRMED' },
    returned: { className: 'badge-returned', label: 'RETURNED' },
    draft: { className: 'badge-draft', label: 'DRAFT' },
    cancelled: { className: 'badge-danger', label: 'CANCELLED' },
};

const SaleDetailModal = ({ saleId, onClose, onPrint, onReturned }) => {
    const [sale, setSale] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);
    const [returnSubmitting, setReturnSubmitting] = useState(false);
    const [returnQuantities, setReturnQuantities] = useState({});
    const [refundMethod, setRefundMethod] = useState('cash');
    const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [returnNotes, setReturnNotes] = useState('');
    const [showExcessModal, setShowExcessModal] = useState(false);
    const [returnImpact, setReturnImpact] = useState(null);
    const [selectedReturnItems, setSelectedReturnItems] = useState([]);
    const [pendingReturnPayload, setPendingReturnPayload] = useState(null);

    useEffect(() => {
        if (saleId) {
            loadDetails();
        }
    }, [saleId]);

    const resetReturnForm = (saleDetails) => {
        const quantities = {};
        (saleDetails?.items || []).forEach((item) => {
            quantities[item.id] = '';
        });

        setReturnQuantities(quantities);
        setRefundMethod(saleDetails?.payment_method || 'cash');
        setReturnDate(new Date().toISOString().slice(0, 10));
        setReturnNotes('');
        setIsReturnFormOpen(false);
        setReturnSubmitting(false);
        setShowExcessModal(false);
        setReturnImpact(null);
        setSelectedReturnItems([]);
        setPendingReturnPayload(null);
    };

    const loadDetails = async () => {
        setLoading(true);
        try {
            const res = await salesAPI.get(saleId);
            const saleDetails = res.data;
            setSale(saleDetails);
            resetReturnForm(saleDetails);
        } catch (err) {
            console.error('Failed to load sale details:', err);
            toast.error(err.message || 'Failed to load sale details');
        } finally {
            setLoading(false);
        }
    };

    const handleReturnQtyChange = (item, rawValue) => {
        const value = String(rawValue || '').trim();
        if (value === '') {
            setReturnQuantities((prev) => ({ ...prev, [item.id]: '' }));
            return;
        }

        if (!/^\d*\.?\d*$/.test(value)) return;

        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed < 0) return;

        const returnableQty = Number(item.returnable_quantity ?? item.quantity ?? 0);
        const bounded = Math.min(parsed, returnableQty);
        setReturnQuantities((prev) => ({ ...prev, [item.id]: String(bounded) }));
    };

    const selectedReturnLines = useMemo(() => {
        if (!sale?.items?.length) return [];

        return sale.items
            .map((item) => {
                const requestedQty = Number(returnQuantities[item.id] || 0);
                const unitPrice = Number(item.unit_price || 0);
                return {
                    item,
                    requestedQty,
                    soldQty: Number(item.returnable_quantity ?? item.quantity ?? 0),
                    lineTotal: requestedQty * unitPrice,
                };
            })
            .filter((line) => line.requestedQty > 0);
    }, [sale, returnQuantities]);

    const returnTotal = useMemo(
        () => selectedReturnLines.reduce((sum, line) => sum + Number(line.lineTotal || 0), 0),
        [selectedReturnLines]
    );

    const selectedReturnUnits = useMemo(
        () => selectedReturnLines.reduce((sum, line) => sum + Number(line.requestedQty || 0), 0),
        [selectedReturnLines]
    );

    const fillAllReturnQuantities = () => {
        if (!sale?.items?.length) return;
        const filled = {};
        sale.items.forEach((item) => {
            filled[item.id] = String(Number(item.returnable_quantity ?? item.quantity ?? 0));
        });
        setReturnQuantities(filled);
    };

    const clearReturnQuantities = () => {
        if (!sale?.items?.length) return;
        const cleared = {};
        sale.items.forEach((item) => {
            cleared[item.id] = '';
        });
        setReturnQuantities(cleared);
    };

    const buildReturnPayload = () => ({
        items: selectedReturnLines.map((line) => ({
            sale_item_id: line.item.id,
            product_id: line.item.product_id,
            quantity: line.requestedQty,
        })),
        return_date: returnDate || undefined,
        refund_method: refundMethod,
        notes: returnNotes.trim() || undefined,
    });

    const processReturn = async (payload, applyToPrevious = false, impactSnapshot = null) => {
        setReturnSubmitting(true);
        try {
            const response = await salesAPI.createReturn(sale.id, {
                ...payload,
                applyToPrevious,
            });

            const breakdown = response.data?.return_breakdown;
            if (breakdown) {
                toast.success(
                    `Return processed. Previous: ${fCr(breakdown.applied_to_previous || 0)} | ` +
                    `Cash refund: ${fCr(breakdown.cash_refund || 0)}`,
                    { duration: 6500 }
                );
            } else {
                toast.success(`Return processed: ${response.data?.return_number || 'success'}`);
            }

            emit(DataSyncEvents.SALE_UPDATED, {
                saleId: sale.id,
                saleReturn: response.data,
                returnImpact: impactSnapshot,
            });
            emit(DataSyncEvents.PRODUCT_UPDATED, {
                source: 'sale:return',
                saleId: sale.id,
            });
            emit(DataSyncEvents.DASHBOARD_REFRESH, {
                source: 'sale:return',
            });

            await loadDetails();
            if (typeof onReturned === 'function') {
                onReturned(response.data);
            }
        } catch (error) {
            toast.error(error.message || 'Failed to process return');
            console.error('Failed to process sale return:', error);
        } finally {
            setReturnSubmitting(false);
            setShowExcessModal(false);
            setPendingReturnPayload(null);
            setReturnImpact(null);
            setSelectedReturnItems([]);
        }
    };

    const submitReturn = async () => {
        if (!sale) return;

        if (selectedReturnLines.length === 0) {
            toast.error('Select at least one item and enter return quantity');
            return;
        }

        for (const line of selectedReturnLines) {
            if (line.requestedQty > line.soldQty) {
                toast.error(`Return quantity for ${line.item.product_name} exceeds available quantity`);
                return;
            }
        }

        const payload = buildReturnPayload();
        setSelectedReturnItems(payload.items);

        try {

            const preview = await salesAPI.returnPreview(sale.id, {
                items: payload.items,
            });

            const impactData = preview.data || {
                returnAmount: returnTotal,
                previousLedgerBalance: 0,
                applyToPreviousAmount: 0,
                cashRefundIfApplied: returnTotal,
                cashRefundIfNotApplied: returnTotal,
                needsChoice: true,
            };

            setReturnImpact(impactData);
            setPendingReturnPayload(payload);
            setShowExcessModal(true);
        } catch (error) {
            toast.error(error.message || 'Failed to preview return impact');
            console.error('Failed to preview return impact:', error);
        }
    };

    const handleExcessDecision = async (applyToPrevious) => {
        if (!pendingReturnPayload) return;
        await processReturn(pendingReturnPayload, applyToPrevious, returnImpact);
    };

    if (!saleId) return null;

    const fCr = (val) => `Rs. ${Number(val).toLocaleString()}`;
    const saleStatus = String(sale?.status || '').toLowerCase();
    const isReturnBlocked = RETURN_BLOCKED_STATUSES.includes(saleStatus);
    const statusStyle = STATUS_STYLES[saleStatus] || { className: 'badge-draft', label: (sale?.status || 'N/A').toUpperCase() };
    const impactReturnAmount = Number(returnImpact?.returnAmount || returnTotal || 0);
    const impactPreviousLedgerBalance = Number(returnImpact?.previousLedgerBalance || 0);
    const impactApplyToPrevious = Number(
        returnImpact?.applyToPreviousAmount
        ?? Math.min(impactReturnAmount, impactPreviousLedgerBalance)
    );
    const impactRefundIfApplied = Number(
        returnImpact?.cashRefundIfApplied
        ?? Math.max(impactReturnAmount - impactApplyToPrevious, 0)
    );
    const impactRefundIfNotApplied = Number(returnImpact?.cashRefundIfNotApplied ?? impactReturnAmount);
    const impactPreviewAfter = Math.max(impactPreviousLedgerBalance - impactApplyToPrevious, 0);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content sale-detail-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Sale Details</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-muted">Loading sale details...</div>
                ) : sale ? (
                    <>
                        <div className="modal-body sale-detail-body">
                        <div className="grid grid-2 gap-4 mb-4 sale-detail-top-grid">
                            <div className="p-4 sale-detail-card" style={{ background: 'var(--color-panel-2)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Invoice Info</div>
                                <div className="font-mono text-lg font-bold text-accent">{sale.invoice_number}</div>
                                <div className="text-sm">{format(new Date(sale.sale_date), 'dd MMM yyyy, hh:mm a')}</div>
                                <div className="mt-2 sale-detail-chip-row">
                                    <span className={`badge ${statusStyle.className}`}>
                                        {statusStyle.label}
                                    </span>
                                    <span className="sale-detail-due-chip">
                                        Due: {Number(sale.amount_due || 0) > 0 ? fCr(sale.amount_due) : 'None'}
                                    </span>
                                </div>
                            </div>
                            <div className="p-4 sale-detail-card" style={{ background: 'var(--color-panel-2)', borderRadius: 'var(--radius-sm)' }}>
                                <div className="text-xs text-muted">Customer</div>
                                <div className="font-bold text-lg">{sale.customer_name || 'Walk-in Customer'}</div>
                                {sale.customer_phone && <div className="text-sm text-muted">Phone: {sale.customer_phone}</div>}
                                <div className="text-xs text-muted mt-2">Created by: {sale.created_by_name || 'System'}</div>
                            </div>
                        </div>

                        <div className="table-container mb-4 sale-detail-table" style={{ border: '1px solid var(--border-surface)', borderRadius: 'var(--radius-sm)' }}>
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
                                    {(sale.items || []).length > 0 ? (
                                        (sale.items || []).map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <div className="font-500">{item.product_name}</div>
                                                </td>
                                                <td className="text-center">{item.quantity}</td>
                                                <td className="text-right">{fCr(item.unit_price)}</td>
                                                <td className="text-right font-bold">{fCr(item.line_total || item.quantity * item.unit_price)}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={4} className="sale-detail-empty-row">No item lines found for this invoice.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-start sale-detail-financial-grid">
                            <div className="text-sm text-muted sale-detail-notes-block">
                                <div className="font-bold mb-1">Notes:</div>
                                <p>{sale.notes || 'No notes added.'}</p>
                            </div>
                            <div className="card p-4 sale-detail-total-card" style={{ background: 'var(--color-panel-2)' }}>
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

                        <div className="sale-detail-return-section">
                            <div className="sale-detail-return-header">
                                <div>
                                    <div className="sale-detail-return-title">Sales Return</div>
                                    <div className="sale-detail-return-subtitle">
                                        Return specific items from this invoice.
                                    </div>
                                </div>
                                <div className="sale-detail-return-header-actions">
                                    {!isReturnBlocked && isReturnFormOpen && (
                                        <>
                                            <button className="btn btn-ghost" type="button" onClick={fillAllReturnQuantities}>Fill All</button>
                                            <button className="btn btn-ghost" type="button" onClick={clearReturnQuantities}>Clear</button>
                                        </>
                                    )}
                                    {isReturnBlocked ? (
                                        <span className="sale-detail-locked-chip">Returns Locked</span>
                                    ) : (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setIsReturnFormOpen((prev) => !prev)}
                                            disabled={returnSubmitting}
                                        >
                                            {isReturnFormOpen ? 'Hide Return Form' : 'Process Return'}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!isReturnBlocked && (
                                <div className="sale-detail-return-stats">
                                    <span className="sale-detail-stat-pill">Selected Items: {selectedReturnLines.length}</span>
                                    <span className="sale-detail-stat-pill">Units: {selectedReturnUnits}</span>
                                    <span className="sale-detail-stat-pill is-accent">Total: {fCr(returnTotal)}</span>
                                </div>
                            )}

                            {isReturnBlocked && (
                                <div className="sale-detail-return-blocked">
                                    Returns are blocked for invoices with status: {sale.status}.
                                </div>
                            )}

                            {isReturnFormOpen && !isReturnBlocked && (
                                <>
                                    <div className="table-container sale-detail-return-table">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>Item</th>
                                                    <th className="text-center">Returnable Qty</th>
                                                    <th className="text-center">Return Qty</th>
                                                    <th className="text-right">Return Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(sale.items || []).map((item) => {
                                                    const qty = Number(returnQuantities[item.id] || 0);
                                                    const lineTotal = qty * Number(item.unit_price || 0);
                                                    return (
                                                        <tr key={`return-line-${item.id}`}>
                                                            <td>{item.product_name}</td>
                                                            <td className="text-center">{Number(item.returnable_quantity ?? item.quantity ?? 0)}</td>
                                                            <td className="text-center">
                                                                <div className="sale-detail-return-input-wrap">
                                                                    <input
                                                                        type="text"
                                                                        inputMode="decimal"
                                                                        value={returnQuantities[item.id] || ''}
                                                                        onChange={(e) => handleReturnQtyChange(item, e.target.value)}
                                                                        placeholder="0"
                                                                        className="sale-detail-return-input"
                                                                    />
                                                                    <small className="sale-detail-return-max">Max {Number(item.returnable_quantity ?? item.quantity ?? 0)}</small>
                                                                </div>
                                                            </td>
                                                            <td className="text-right">{qty > 0 ? fCr(lineTotal) : '—'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="sale-detail-return-controls">
                                        <div>
                                            <label className="sale-detail-field-label">Return Date</label>
                                            <input
                                                type="date"
                                                value={returnDate}
                                                onChange={(e) => setReturnDate(e.target.value)}
                                                className="sale-detail-control"
                                            />
                                        </div>

                                        <div>
                                            <label className="sale-detail-field-label">Refund Method</label>
                                            <select
                                                value={refundMethod}
                                                onChange={(e) => setRefundMethod(e.target.value)}
                                                className="sale-detail-control"
                                            >
                                                {PAYMENT_METHOD_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="sale-detail-return-total-card">
                                            <div className="sale-detail-return-total-label">Return Total</div>
                                            <div className="sale-detail-return-total-value">{fCr(returnTotal)}</div>
                                        </div>
                                    </div>

                                    <div className="sale-detail-return-notes-wrap">
                                        <label className="sale-detail-field-label">Notes</label>
                                        <textarea
                                            value={returnNotes}
                                            onChange={(e) => setReturnNotes(e.target.value)}
                                            rows={2}
                                            placeholder="Optional return notes"
                                            className="sale-detail-control sale-detail-notes"
                                        />
                                    </div>

                                    <div className="sale-detail-return-actions">
                                        <button
                                            className="btn btn-secondary"
                                            type="button"
                                            onClick={() => resetReturnForm(sale)}
                                            disabled={returnSubmitting}
                                        >
                                            Reset
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            onClick={submitReturn}
                                            disabled={returnSubmitting || selectedReturnLines.length === 0}
                                        >
                                            {returnSubmitting ? 'Processing Return...' : 'Submit Return'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {showExcessModal && (
                            <div className="sale-detail-excess-overlay" role="dialog" aria-modal="true" aria-label="Return allocation">
                                <div className="sale-detail-excess-modal">
                                    <div className="sale-detail-excess-header">
                                        <h4>Return Allocation</h4>
                                        <p>Compare this return with the customer&apos;s previous ledger balance.</p>
                                    </div>

                                    <div className="sale-detail-excess-summary-grid">
                                        <div className="sale-detail-excess-card">
                                            <span>Return Amount</span>
                                            <strong>{fCr(impactReturnAmount)}</strong>
                                        </div>
                                        <div className="sale-detail-excess-card">
                                            <span>Previous Ledger Balance</span>
                                            <strong>{fCr(impactPreviousLedgerBalance)}</strong>
                                        </div>
                                        <div className="sale-detail-excess-card is-highlight">
                                            <span>Apply To Previous (Yes)</span>
                                            <strong>{fCr(impactApplyToPrevious)}</strong>
                                        </div>
                                        <div className="sale-detail-excess-card">
                                            <span>Cash Refund (No)</span>
                                            <strong>{fCr(impactRefundIfNotApplied)}</strong>
                                        </div>
                                    </div>

                                    <div className="sale-detail-excess-question-box">
                                        <div className="sale-detail-excess-question-title">
                                            Apply return amount to previous balance?
                                        </div>
                                        <div className="sale-detail-excess-question-preview">
                                            {fCr(impactPreviousLedgerBalance)} - {fCr(impactApplyToPrevious)} = {fCr(impactPreviewAfter)}
                                        </div>
                                        <small>
                                            If you choose Yes: {fCr(impactApplyToPrevious)} will reduce the previous ledger balance
                                            {impactRefundIfApplied > 0 ? ` and ${fCr(impactRefundIfApplied)} will be refunded in cash.` : '.'}
                                        </small>
                                    </div>

                                    <div className="sale-detail-excess-actions">
                                        <button
                                            className="btn btn-secondary"
                                            type="button"
                                            onClick={() => handleExcessDecision(false)}
                                            disabled={returnSubmitting}
                                            autoFocus
                                        >
                                            {returnSubmitting ? 'Processing...' : 'No - Refund Cash'}
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            type="button"
                                            onClick={() => handleExcessDecision(true)}
                                            disabled={returnSubmitting}
                                        >
                                            {returnSubmitting ? 'Processing...' : 'Yes - Pay Previous'}
                                        </button>
                                    </div>

                                    <div className="sale-detail-excess-meta">
                                        Selected return lines: {selectedReturnItems.length}
                                    </div>
                                </div>
                            </div>
                        )}
                        </div>

                        <div className="modal-actions sale-detail-modal-actions">
                            <button className="btn btn-secondary" onClick={onClose}>Close</button>
                            <button className="btn btn-primary" onClick={() => onPrint(sale)}>
                                Print Invoice
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="p-6 text-center text-danger">Failed to load sale.</div>
                )}
            </div>
        </div>
    );
};

export default SaleDetailModal;
