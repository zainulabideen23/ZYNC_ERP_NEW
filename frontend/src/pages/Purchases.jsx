import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { purchasesAPI } from '../services/api'
import { format } from 'date-fns'
import { useDataSync, DataSyncEvents } from '../utils/dataSync'

function Purchases() {
    const navigate = useNavigate()
    const [purchases, setPurchases] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedPurchase, setSelectedPurchase] = useState(null)
    const [showModal, setShowModal] = useState(false)
    const [returnItems, setReturnItems] = useState([])

    useEffect(() => { loadData() }, [])
    
    // Subscribe to data sync events to refresh list when purchases change
    useDataSync(DataSyncEvents.PURCHASE_CREATED, () => {
        loadData()
    })

    const loadData = async () => {
        try {
            const response = await purchasesAPI.list({ limit: 100 })
            setPurchases(response.data || [])
        } catch (error) {
            console.error('Failed to load purchases:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleViewPurchase = async (purchase) => {
        try {
            const res = await purchasesAPI.get(purchase.id)
            setSelectedPurchase(res.data)
            setReturnItems(res.data.items.map(item => ({
                product_id: item.product_id,
                name: item.product_name,
                quantity: 0,
                max_quantity: item.quantity,
                unit_cost: item.unit_cost
            })))
            setShowModal(true)
        } catch (error) {
            console.error('Failed to load purchase details:', error)
        }
    }

    const handleReturn = async () => {
        const itemsToReturn = returnItems.filter(item => item.quantity > 0)
        if (itemsToReturn.length === 0) {
            return
        }

        try {
            await purchasesAPI.createReturn({
                original_purchase_id: selectedPurchase.id,
                items: itemsToReturn,
                return_date: new Date().toISOString().split('T')[0],
                notes: `Return for ${selectedPurchase.bill_number}`
            })
            setShowModal(false)
            loadData()
        } catch (error) {
            console.error(error.message)
        }
    }

    if (loading) return <div className="page-container">Loading...</div>

    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Purchases</h1>
                <button className="btn btn-primary" onClick={() => navigate('/purchases/new')}>+ New Purchase</button>
            </div>
            <div className="card">
                <table className="table">
                    <thead>
                        <tr><th>Bill #</th><th>Date</th><th>Supplier</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Paid</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        {purchases.map((p) => (
                            <tr key={p.id}>
                                <td className="font-mono">{p.bill_number}</td>
                                <td>{format(new Date(p.purchase_date), 'dd/MM/yyyy')}</td>
                                <td>{p.supplier_name || '-'}</td>
                                <td style={{ textAlign: 'right' }}>Rs. {Number(p.total_amount).toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>Rs. {Number(p.amount_paid).toLocaleString()}</td>
                                <td><span className={`badge ${p.status === 'paid' ? 'badge-success' : p.status === 'returned' ? 'badge-danger' : 'badge-warning'}`}>{p.status === 'paid' ? 'PAID' : p.status.toUpperCase()}</span></td>
                                <td>
                                    <button className="btn btn-ghost btn-sm" onClick={() => handleViewPurchase(p)}>View & Return</button>
                                </td>
                            </tr>
                        ))}
                        {purchases.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center' }}>No purchases yet</td></tr>}
                    </tbody>
                </table>
            </div>

            {showModal && selectedPurchase && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h2>Purchase Details - {selectedPurchase.bill_number}</h2>
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>✕</button>
                        </div>

                        <div className="grid grid-2 mb-6 text-sm">
                            <div><strong>Supplier:</strong> {selectedPurchase.supplier_name}</div>
                            <div><strong>Date:</strong> {format(new Date(selectedPurchase.bill_date), 'dd MMM yyyy')}</div>
                            <div><strong>Total:</strong> Rs. {Number(selectedPurchase.total_amount).toLocaleString()}</div>
                            <div><strong>Paid:</strong> Rs. {Number(selectedPurchase.paid_amount).toLocaleString()}</div>
                        </div>

                        <h3>Items to Return</h3>
                        <table className="table mb-6">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th style={{ width: '100px' }}>Purchased</th>
                                    <th style={{ width: '120px' }}>Return Qty</th>
                                    <th style={{ textAlign: 'right' }}>Unit Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {returnItems.map((item, idx) => (
                                    <tr key={item.product_id}>
                                        <td>{item.name}</td>
                                        <td>{item.max_quantity}</td>
                                        <td>
                                            <input
                                                type="number"
                                                className="form-input"
                                                min="0"
                                                max={item.max_quantity}
                                                value={item.quantity}
                                                onChange={(e) => {
                                                    const newItems = [...returnItems];
                                                    newItems[idx].quantity = Math.min(item.max_quantity, Math.max(0, parseFloat(e.target.value) || 0));
                                                    setReturnItems(newItems);
                                                }}
                                            />
                                        </td>
                                        <td style={{ textAlign: 'right' }}>Rs. {Number(item.unit_cost).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex gap-4">
                            <button className="btn btn-danger" onClick={handleReturn} disabled={!returnItems.some(i => i.quantity > 0)}>
                                Process Return (Debit Note)
                            </button>
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal { background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; width: 90%; max-width: 800px; }
            `}</style>
        </div>
    )
}
export default Purchases
