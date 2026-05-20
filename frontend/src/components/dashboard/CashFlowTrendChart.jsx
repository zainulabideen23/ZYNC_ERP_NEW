import { useMemo, useState } from 'react'
import {
    ResponsiveContainer,
    ComposedChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    Area,
    Line
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Download, Minus } from 'lucide-react'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import './CashFlowTrendChart.css'

const RANGE_OPTIONS = [
    { key: '7d', label: '7D', days: 7 },
    { key: '30d', label: '30D', days: 30 },
    { key: '90d', label: '90D', days: 90 }
]

const currency = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0
})

function parseDateValue(value) {
    if (!value) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value
    }

    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number)
        return new Date(year, month - 1, day)
    }

    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
}

function normalizeTrend(series = []) {
    return series
        .map((point) => {
            const parsedDate = parseDateValue(point?.date || point?.day || point?.label)
            if (!parsedDate) return null

            const amount = Number(point?.amount ?? point?.total ?? point?.value ?? 0)
            return {
                date: parsedDate,
                dateKey: format(parsedDate, 'yyyy-MM-dd'),
                amount: Number.isFinite(amount) ? amount : 0
            }
        })
        .filter(Boolean)
}

function buildDateRange(referenceDate, days) {
    const start = subDays(referenceDate, days - 1)
    return eachDayOfInterval({ start, end: referenceDate })
}

function formatTick(dateKey, days) {
    const date = parseDateValue(dateKey)
    if (!date) return dateKey

    if (days <= 7) return format(date, 'EEE')
    if (days <= 30) return format(date, 'd MMM')
    return format(date, 'd MMM')
}

function getXAxisInterval(days) {
    if (days <= 7) return 0
    if (days <= 30) return 4
    return 12
}

function findLatestDate(seriesA, seriesB) {
    const allDates = [...seriesA, ...seriesB].map((item) => item.date)
    if (allDates.length === 0) return new Date()

    return allDates.reduce((latest, current) => (current > latest ? current : latest), allDates[0])
}

function ChartTooltip({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null

    const inflow = Number(payload.find((entry) => entry.dataKey === 'inflow')?.value || 0)
    const outflow = Number(payload.find((entry) => entry.dataKey === 'outflow')?.value || 0)
    const net = inflow - outflow
    const parsedLabelDate = parseDateValue(label)

    return (
        <div className="cashflow-tooltip">
            <div className="cashflow-tooltip-date">{parsedLabelDate ? format(parsedLabelDate, 'dd MMM yyyy') : String(label || '-')}</div>
            <div className="cashflow-tooltip-row">
                <span className="cashflow-pill sales" />
                <span>Inflow</span>
                <strong>{currency.format(inflow)}</strong>
            </div>
            <div className="cashflow-tooltip-row">
                <span className="cashflow-pill expense" />
                <span>Outflow</span>
                <strong>{currency.format(outflow)}</strong>
            </div>
            <div className="cashflow-tooltip-net">
                <span>Net</span>
                <strong className={net >= 0 ? 'positive' : 'negative'}>{currency.format(net)}</strong>
            </div>
        </div>
    )
}

export default function CashFlowTrendChart({ salesTrend = [], expenseTrend = [] }) {
    const [selectedRange, setSelectedRange] = useState('7d')

    const normalizedSales = useMemo(() => normalizeTrend(salesTrend), [salesTrend])
    const normalizedExpense = useMemo(() => normalizeTrend(expenseTrend), [expenseTrend])

    const hasData = normalizedSales.length > 0 || normalizedExpense.length > 0

    const selectedDays = useMemo(() => {
        const option = RANGE_OPTIONS.find((item) => item.key === selectedRange)
        return option ? option.days : 7
    }, [selectedRange])

    const chartData = useMemo(() => {
        const referenceDate = findLatestDate(normalizedSales, normalizedExpense)
        const days = buildDateRange(referenceDate, selectedDays)

        const salesMap = new Map(normalizedSales.map((item) => [item.dateKey, item.amount]))
        const expenseMap = new Map(normalizedExpense.map((item) => [item.dateKey, item.amount]))

        return days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const inflow = Number(salesMap.get(dateKey) || 0)
            const outflow = Number(expenseMap.get(dateKey) || 0)
            return {
                dateKey,
                inflow,
                outflow,
                net: inflow - outflow
            }
        })
    }, [normalizedSales, normalizedExpense, selectedDays])

    const totals = useMemo(() => {
        return chartData.reduce(
            (acc, item) => {
                acc.inflow += item.inflow
                acc.outflow += item.outflow
                acc.net += item.net
                return acc
            },
            { inflow: 0, outflow: 0, net: 0 }
        )
    }, [chartData])

    const trendInfo = useMemo(() => {
        if (chartData.length < 2) return { direction: 'flat', text: 'Stable' }

        const first = chartData[0].net
        const last = chartData[chartData.length - 1].net

        if (last > first) return { direction: 'up', text: 'Net improving' }
        if (last < first) return { direction: 'down', text: 'Net cooling' }
        return { direction: 'flat', text: 'Stable' }
    }, [chartData])

    const handleExport = () => {
        if (!chartData.length) return

        const rows = [
            ['Date', 'Inflow', 'Outflow', 'Net'],
            ...chartData.map((item) => [item.dateKey, item.inflow, item.outflow, item.net])
        ]

        const csv = rows.map((row) => row.join(',')).join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `cash-flow-${selectedRange}-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(url)
    }

    return (
        <div className="chart-card cashflow-card">
            <div className="cashflow-header-row">
                <h3 className="chart-title">Cash Flow Trend</h3>
                <div className="cashflow-controls">
                    <div className="time-range-selector" role="tablist" aria-label="Cash flow range selector">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                className={`time-range-btn ${selectedRange === option.key ? 'active' : ''}`}
                                onClick={() => setSelectedRange(option.key)}
                                type="button"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="cashflow-export-btn"
                        onClick={handleExport}
                        aria-label="Export cash flow CSV"
                    >
                        <Download size={14} />
                        Export
                    </button>
                </div>
            </div>

            <div className="cashflow-insights">
                <div className="cashflow-insight-item">
                    <span className="cashflow-insight-label">Total Inflow</span>
                    <strong className="cashflow-insight-value positive">{currency.format(totals.inflow)}</strong>
                </div>
                <div className="cashflow-insight-item">
                    <span className="cashflow-insight-label">Total Outflow</span>
                    <strong className="cashflow-insight-value negative">{currency.format(totals.outflow)}</strong>
                </div>
                <div className="cashflow-insight-item">
                    <span className="cashflow-insight-label">Net Flow</span>
                    <strong className={`cashflow-insight-value ${totals.net >= 0 ? 'positive' : 'negative'}`}>
                        {currency.format(totals.net)}
                    </strong>
                    <span className={`cashflow-trend-indicator ${trendInfo.direction}`}>
                        {trendInfo.direction === 'up' && <ArrowUpRight size={13} />}
                        {trendInfo.direction === 'down' && <ArrowDownRight size={13} />}
                        {trendInfo.direction === 'flat' && <Minus size={13} />}
                        {trendInfo.text}
                    </span>
                </div>
            </div>

            <div className="cashflow-legend">
                <span className="legend-pill"><span className="cashflow-pill sales" />Sales Inflow</span>
                <span className="legend-pill"><span className="cashflow-pill expense" />Expense Outflow</span>
            </div>

            {!hasData ? (
                <div className="chart-empty cashflow-empty">
                    <p>No cash movement data available yet</p>
                    <span>Data will appear once sales or purchases are posted.</span>
                </div>
            ) : (
                <div className="cashflow-chart-wrap">
                    <ResponsiveContainer width="100%" height={320}>
                        <ComposedChart data={chartData} margin={{ top: 16, right: 14, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="cashflowSalesFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.38} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                                </linearGradient>
                                <linearGradient id="cashflowExpenseFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02} />
                                </linearGradient>
                            </defs>

                            <CartesianGrid strokeDasharray="4 4" stroke="rgba(148,163,184,0.26)" vertical={false} />
                            <XAxis
                                dataKey="dateKey"
                                tickFormatter={(value) => formatTick(value, selectedDays)}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                interval={getXAxisInterval(selectedDays)}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={(value) => currency.format(value)}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                                width={90}
                            />
                            <Tooltip content={<ChartTooltip />} />

                            <Area
                                type="monotone"
                                dataKey="inflow"
                                stroke="none"
                                fill="url(#cashflowSalesFill)"
                                isAnimationActive
                                animationDuration={450}
                            />
                            <Area
                                type="monotone"
                                dataKey="outflow"
                                stroke="none"
                                fill="url(#cashflowExpenseFill)"
                                isAnimationActive
                                animationDuration={450}
                            />

                            <Line
                                type="monotone"
                                dataKey="inflow"
                                stroke="#60a5fa"
                                strokeWidth={2.6}
                                dot={false}
                                activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
                                isAnimationActive
                                animationDuration={550}
                            />
                            <Line
                                type="monotone"
                                dataKey="outflow"
                                stroke="#f87171"
                                strokeWidth={2.4}
                                dot={false}
                                activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2 }}
                                isAnimationActive
                                animationDuration={550}
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
