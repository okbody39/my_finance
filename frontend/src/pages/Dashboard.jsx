import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function Dashboard() {
    const currentRealYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentRealYear);
    const [summary, setSummary] = useState({
        netWorth: 0,
        totalCash: 0,
        totalInvestments: 0,
        cumulativeIncome: 0,
        cumulativeExpense: 0,
        cumulativeInvestment: 0,
        monthlyStats: [],
        investmentDetails: [],
        expenseDetails: [],
        monthlyExpenseDetails: [],
        currentSalaryYear: currentRealYear,
        currentSalaryMonth: 1
    });
    const [marketData, setMarketData] = useState([]);
    const [expenseChartPeriod, setExpenseChartPeriod] = useState('yearly');

    useEffect(() => {
        fetch(`/api/dashboard/summary?year=${selectedYear}`)
            .then(res => res.json())
            .then(data => setSummary(data))
            .catch(err => console.error('Failed to fetch summary:', err));

        fetch(`/api/dashboard/market`)
            .then(res => res.json())
            .then(data => setMarketData(data))
            .catch(err => console.error('Failed to fetch market data:', err));
    }, [selectedYear]);

    const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val) + '원';
    const formatCurrencyThousands = (val) => new Intl.NumberFormat('ko-KR').format(Math.floor((val || 0) / 1000)) + '천원';

    const assetData = [
        { name: '현금 및 연동계좌', value: summary.totalCash || 0 },
        ...(summary.investmentDetails || [])
    ].filter(item => item.value > 0);

    const rawExpenseData = expenseChartPeriod === 'yearly' 
        ? (summary.expenseDetails || []) 
        : (summary.monthlyExpenseDetails || []);
    const expenseData = rawExpenseData.filter(item => item.value > 0);

    const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
    const EXPENSE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6'];

    const cashflowData = summary.monthlyStats && summary.monthlyStats.length > 0
        ? summary.monthlyStats.map(m => ({
            name: `${m.month}월`,
            수입: m.income,
            지출: m.expense,
            투자: m.investment || 0
        }))
        : [];

    const isCurrentYear = selectedYear === summary.currentSalaryYear;
    const currentMonthData = summary.monthlyStats && summary.monthlyStats[summary.currentSalaryMonth - 1]
        ? summary.monthlyStats[summary.currentSalaryMonth - 1]
        : { income: 0, expense: 0, investment: 0 };

    const displayThisMonthIncome = isCurrentYear ? currentMonthData.income : 0;
    const displayThisMonthExpense = isCurrentYear ? currentMonthData.expense : 0;
    const displayThisMonthInvestment = isCurrentYear ? currentMonthData.investment : 0;

    const selectStyle = {
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#38bdf8',
        padding: '8px 16px',
        borderRadius: '8px',
        outline: 'none',
        fontFamily: 'inherit',
        fontSize: '1rem',
        cursor: 'pointer',
        fontWeight: 'bold'
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="text-gradient">성과 측정 (대시보드)</h1>
                    <p style={{ color: 'var(--text-muted)' }}>가만히 있어도 자동으로 늘어나는 수익금 모니터링</p>
                </div>
                <div>
                    <select
                        style={selectStyle}
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                    >
                        {Array.from({ length: 5 }, (_, i) => currentRealYear - 2 + i).map(y => (
                            <option key={y} value={y}>{y}년도 성과</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Market Data Cards */}
            {marketData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    {marketData.map((data, idx) => (
                        <div key={idx} className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>{data.name}</div>
                            {data.error ? (
                                <div style={{ color: '#ef4444', marginTop: '4px', fontSize: '0.85rem' }}>데이터 없음</div>
                            ) : (
                                <>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '4px', color: '#f8fafc' }}>
                                        {data.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {data.currency}
                                    </div>
                                    <div style={{
                                        color: data.change >= 0 ? '#10b981' : '#ef4444',
                                        fontSize: '0.85rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        marginTop: '4px',
                                        fontWeight: 500
                                    }}>
                                        {data.change >= 0 ? '▲' : '▼'} {Math.abs(data.change).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({Math.abs(data.changePercent).toFixed(2)}%)
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>

                <div className="glass-panel" style={{ borderLeft: '4px solid #4f46e5' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>총 순자산 (Net Worth)</h3>
                    <div style={{ fontSize: '2.5rem', fontWeight: 700, margin: '8px 0' }}>
                        {formatCurrencyThousands(summary.netWorth)}
                    </div>
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid #10b981' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>누적 수익금 (Income)</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
                        {formatCurrencyThousands(summary.cumulativeIncome)}
                    </div>
                    {isCurrentYear && <div style={{ color: '#10b981', fontSize: '0.85rem' }}>이번 달 수익금: {formatCurrencyThousands(displayThisMonthIncome)}</div>}
                    {!isCurrentYear && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>선택 연도 총 수익금</div>}
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid #38bdf8' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>누적 투자 (Investment)</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
                        {formatCurrencyThousands(summary.cumulativeInvestment)}
                    </div>
                    {isCurrentYear && <div style={{ color: '#38bdf8', fontSize: '0.85rem' }}>이번 달 투자: {formatCurrencyThousands(displayThisMonthInvestment)}</div>}
                    {!isCurrentYear && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>선택 연도 총 투자금</div>}
                </div>

                <div className="glass-panel" style={{ borderLeft: '4px solid #ef4444' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>누적 지출 (Expense)</h3>
                    <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0' }}>
                        {formatCurrencyThousands(summary.cumulativeExpense)}
                    </div>
                    {isCurrentYear && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>이번 달 지출: {formatCurrencyThousands(displayThisMonthExpense)}</div>}
                    {!isCurrentYear && <div style={{ color: '#64748b', fontSize: '0.85rem' }}>선택 연도 총 지출</div>}
                </div>

            </div>

            {/* 연간 월별 성과 (전체 폭 차지) */}
            <div className="glass-panel">
                <h3 style={{ marginBottom: '16px' }}>{selectedYear}년 연간 월별 성과</h3>
                <div style={{ height: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cashflowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => (val / 10000) + '만'} />
                            <RechartsTooltip
                                cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                                contentStyle={{ backgroundColor: 'rgba(15,17,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                labelStyle={{ color: '#94a3b8', fontWeight: 500, paddingBottom: '4px' }}
                            />
                            <Bar dataKey="수입" fill="#10b981" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="투자" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={15} />
                            <Bar dataKey="지출" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={15} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Lower Section (Pie Charts) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div className="glass-panel">
                    <h3 style={{ marginBottom: '16px' }}>자산 포트폴리오 비중</h3>
                    <div style={{ height: '300px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                    label={({ name }) => name}
                                    labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                                >
                                    {assetData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(val) => formatCurrency(val)}
                                    contentStyle={{ backgroundColor: 'rgba(15,17,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                    labelStyle={{ color: '#94a3b8', fontWeight: 500, paddingBottom: '4px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="glass-panel">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>
                            {expenseChartPeriod === 'yearly' ? `${selectedYear}년 ` : '당월 '} 
                            지출 분류별 비중
                        </h3>
                        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '4px' }}>
                            <button
                                onClick={() => setExpenseChartPeriod('yearly')}
                                style={{
                                    background: expenseChartPeriod === 'yearly' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: expenseChartPeriod === 'yearly' ? '#fff' : 'var(--text-muted)',
                                    border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: expenseChartPeriod === 'yearly' ? 600 : 400
                                }}
                            >년 누적</button>
                            <button
                                onClick={() => setExpenseChartPeriod('monthly')}
                                style={{
                                    background: expenseChartPeriod === 'monthly' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: expenseChartPeriod === 'monthly' ? '#fff' : 'var(--text-muted)',
                                    border: 'none', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: expenseChartPeriod === 'monthly' ? 600 : 400
                                }}
                            >당월</button>
                        </div>
                    </div>
                    {expenseData.length === 0 ? (
                        <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                            지출 내역 데이터가 없습니다.
                        </div>
                    ) : (
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={expenseData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={110}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        label={({ name }) => name}
                                        labelLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                                    >
                                        {expenseData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={EXPENSE_COLORS[index % EXPENSE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip
                                        formatter={(val) => formatCurrency(val)}
                                        contentStyle={{ backgroundColor: 'rgba(15,17,21,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                        itemStyle={{ color: '#f8fafc', fontWeight: 600 }}
                                        labelStyle={{ color: '#94a3b8', fontWeight: 500, paddingBottom: '4px' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
