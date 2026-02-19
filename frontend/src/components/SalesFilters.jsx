import React from 'react';

const SalesFilters = ({ filters, onChange, onClear }) => {
    return (
        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="grid grid-4 gap-4" style={{ alignItems: 'end' }}>
                {/* 1. Search */}
                <div className="form-group mb-0">
                    <label className="form-label">Search</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Invoice # or Customer"
                        value={filters.search || ''}
                        onChange={(e) => onChange('search', e.target.value)}
                    />
                </div>

                {/* 2. Status */}
                <div className="form-group mb-0">
                    <label className="form-label">Status</label>
                    <select
                        className="form-select"
                        value={filters.status || ''}
                        onChange={(e) => onChange('status', e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="completed">Paid</option>
                        <option value="confirmed">Confirmed (Unpaid)</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>

                {/* 3. Date From */}
                <div className="form-group mb-0">
                    <label className="form-label">From Date</label>
                    <input
                        type="date"
                        className="form-input"
                        value={filters.from_date || ''}
                        onChange={(e) => onChange('from_date', e.target.value)}
                    />
                </div>

                {/* 4. Date To */}
                <div className="form-group mb-0">
                    <label className="form-label">To Date</label>
                    <div className="flex gap-2">
                        <input
                            type="date"
                            className="form-input"
                            value={filters.to_date || ''}
                            onChange={(e) => onChange('to_date', e.target.value)}
                        />
                        <button
                            className="btn btn-secondary"
                            onClick={onClear}
                            title="Clear Filters"
                            style={{ minWidth: '44px', padding: 0 }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesFilters;
