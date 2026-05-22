import { useState } from 'react'
import { Scale, Ruler, FolderTree, Building2 } from 'lucide-react'
import UnitsTab from './reference/UnitsTab'
import CategoriesTab from './reference/CategoriesTab'
import BrandsTab from './reference/BrandsTab'

const TABS = [
    { key: 'units', label: 'Units', icon: Ruler },
    { key: 'categories', label: 'Categories', icon: FolderTree },
    { key: 'brands', label: 'Brands', icon: Building2 },
]

function ReferenceData() {
    const [activeTab, setActiveTab] = useState('units')

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', background: 'var(--color-bg)', minHeight: '100vh' }}>
            {/* Page Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.12)', border: '1px solid rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Scale size={20} color="#8b5cf6" />
                </div>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.01em' }}>Reference Data</h1>
                    <p style={{ fontSize: '13px', color: 'var(--color-hint)', marginTop: '2px' }}>Manage units, categories, and brands</p>
                </div>
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--color-panel-2)', borderRadius: '10px', padding: '4px', border: '1px solid var(--border-surface)' }}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                            padding: '10px 16px', borderRadius: '8px', border: 'none', fontSize: '13px', fontWeight: 600,
                            background: activeTab === tab.key ? 'var(--color-panel)' : 'transparent',
                            color: activeTab === tab.key ? 'var(--color-text)' : 'var(--color-muted)',
                            cursor: 'pointer', transition: 'all 0.15s',
                            boxShadow: activeTab === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        }}
                    >
                        <tab.icon size={15} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'units' && <UnitsTab />}
            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'brands' && <BrandsTab />}
        </div>
    )
}

export default ReferenceData
