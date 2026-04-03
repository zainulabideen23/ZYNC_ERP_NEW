import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { transfersAPI } from '../services/api'
import { format } from 'date-fns'

function BankTransferModal({ isOpen, onClose, onSuccess }) {
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        from_account_code: '1001',
        to_account_code: '1002',
        amount: '',
        notes: '',
        transfer_date: format(new Date(), 'yyyy-MM-dd')
    })

    if (!isOpen) return null

    const handleSubmit = async (e) => {
        e.preventDefault()
        
        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            toast.error('Please enter a valid amount')
            return
        }

        if (formData.from_account_code === formData.to_account_code) {
            toast.error('Source and destination accounts must be different')
            return
        }

        setSubmitting(true)
        try {
            await transfersAPI.bank({
                from_account_code: formData.from_account_code,
                to_account_code: formData.to_account_code,
                amount: parseFloat(formData.amount),
                notes: formData.notes,
                transfer_date: formData.transfer_date
            })
            toast.success('Transfer recorded successfully')
            
            // Reset form and close
            setFormData({
                from_account_code: '1001',
                to_account_code: '1002',
                amount: '',
                notes: '',
                transfer_date: format(new Date(), 'yyyy-MM-dd')
            })
            
            if (onSuccess) onSuccess()
            onClose()
        } catch (error) {
            toast.error(error.message)
        } finally {
            setSubmitting(false)
        }
    }

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    return (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content">
                <div className="modal-header">
                    <h2>Bank Transfer</h2>
                    <button className="btn-close" onClick={onClose}>&times;</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Transfer Type</label>
                        <div className="transfer-type-toggle">
                            <button
                                type="button"
                                className={`toggle-btn ${formData.from_account_code === '1001' ? 'active' : ''}`}
                                onClick={() => setFormData({
                                    ...formData,
                                    from_account_code: '1001',
                                    to_account_code: '1002'
                                })}
                            >
                                Cash to Bank
                            </button>
                            <button
                                type="button"
                                className={`toggle-btn ${formData.from_account_code === '1002' ? 'active' : ''}`}
                                onClick={() => setFormData({
                                    ...formData,
                                    from_account_code: '1002',
                                    to_account_code: '1001'
                                })}
                            >
                                Bank to Cash
                            </button>
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">From Account</label>
                            <select
                                className="form-control"
                                value={formData.from_account_code}
                                onChange={(e) => setFormData({ ...formData, from_account_code: e.target.value })}
                            >
                                <option value="1001">Cash in Hand (1001)</option>
                                <option value="1002">Bank Account (1002)</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">To Account</label>
                            <select
                                className="form-control"
                                value={formData.to_account_code}
                                onChange={(e) => setFormData({ ...formData, to_account_code: e.target.value })}
                            >
                                <option value="1001">Cash in Hand (1001)</option>
                                <option value="1002">Bank Account (1002)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Amount (Rs.) *</label>
                        <input
                            type="number"
                            className="form-control"
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Date</label>
                        <input
                            type="date"
                            className="form-control"
                            value={formData.transfer_date}
                            onChange={(e) => setFormData({ ...formData, transfer_date: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notes (Optional)</label>
                        <textarea
                            className="form-control"
                            rows="2"
                            placeholder="Add any notes about this transfer..."
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            {submitting ? 'Processing...' : 'Record Transfer'}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                }
                .modal-content {
                    background: var(--color-bg-secondary, #1e293b);
                    border-radius: 12px;
                    padding: 24px;
                    width: 100%;
                    max-width: 480px;
                    border: 1px solid var(--color-border, #334155);
                }
                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                }
                .modal-header h2 {
                    margin: 0;
                    font-size: 20px;
                    font-weight: 600;
                }
                .btn-close {
                    background: none;
                    border: none;
                    color: var(--color-text-secondary, #94a3b8);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                }
                .btn-close:hover {
                    color: var(--color-text-primary, #f1f5f9);
                }
                .transfer-type-toggle {
                    display: flex;
                    gap: 8px;
                }
                .toggle-btn {
                    flex: 1;
                    padding: 10px 16px;
                    background: var(--color-bg-tertiary, #0f172a);
                    border: 1px solid var(--color-border, #334155);
                    border-radius: 8px;
                    color: var(--color-text-secondary, #94a3b8);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .toggle-btn.active {
                    background: var(--color-primary, #3b82f6);
                    border-color: var(--color-primary, #3b82f6);
                    color: white;
                }
                .toggle-btn:hover:not(.active) {
                    border-color: var(--color-primary, #3b82f6);
                }
                .form-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    margin-top: 24px;
                }
            `}</style>
        </div>
    )
}

export default BankTransferModal
