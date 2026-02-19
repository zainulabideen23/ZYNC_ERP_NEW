import React from 'react';

const SalesStats = ({ aggregates }) => {
    if (!aggregates) return null;

    const fCr = (val) => `Rs. ${Number(val).toLocaleString()}`;
    const avg = aggregates.count > 0 ? aggregates.total_sales / aggregates.count : 0;

    return (
        <div className="grid grid-4 gap-4" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="stat-card purple">
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value">{fCr(aggregates.total_sales)}</div>
                <div className="stat-change text-muted">{aggregates.count} Sales</div>
            </div>
            <div className="stat-card green">
                <div className="stat-label">Received</div>
                <div className="stat-value">{fCr(aggregates.total_paid)}</div>
                <div className="stat-change positive">
                    {aggregates.total_sales > 0 ? Math.round((aggregates.total_paid / aggregates.total_sales) * 100) : 0}% Collected
                </div>
            </div>
            <div className="stat-card red">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{fCr(aggregates.total_due)}</div>
                <div className="stat-change negative">
                    {aggregates.total_sales > 0 ? Math.round((aggregates.total_due / aggregates.total_sales) * 100) : 0}% Outstanding
                </div>
            </div>
            <div className="stat-card" style={{ borderLeftColor: 'var(--color-accent)' }}>
                <div className="stat-label">Avg. Sale Value</div>
                <div className="stat-value">{fCr(avg)}</div>
                <div className="stat-change text-muted">Per Invoice</div>
            </div>
        </div>
    );
};

export default SalesStats;
