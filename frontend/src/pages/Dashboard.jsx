import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { evaluate } from 'mathjs';
import { Plus, Settings } from 'lucide-react';
import { SortableCustomCard } from '../components/SortableCustomCard';

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
    const [excludeRealEstate, setExcludeRealEstate] = useState(false);

    // Custom Cards state
    const [customCards, setCustomCards] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState(null);
    const [cardForm, setCardForm] = useState({ title: '', formula: '', goalOperator: '', goalValue: '' });

    const [customStockPrices, setCustomStockPrices] = useState({});
    const [customEmaPrices, setCustomEmaPrices] = useState({});

    // For goal notifications
    const notifiedCardsRef = useRef(new Set());

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    useEffect(() => {
        // Request notification permission if needed
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        const fetchData = () => {
            fetch(`/api/dashboard/summary?year=${selectedYear}`)
                .then(res => res.json())
                .then(data => setSummary(data))
                .catch(err => console.error('Failed to fetch summary:', err));

            fetch(`/api/dashboard/market`)
                .then(res => res.json())
                .then(data => setMarketData(data))
                .catch(err => console.error('Failed to fetch market data:', err));

            fetch(`/api/dashboard/custom-cards`)
                .then(res => res.json())
                .then(data => setCustomCards(data))
                .catch(err => console.error('Failed to fetch custom cards:', err));
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Auto update every 1 minute
        return () => clearInterval(interval);
    }, [selectedYear]);

    useEffect(() => {
        const fetchStocksAndEma = async () => {
            const stockRegex = /(?:KOSPI|stock)\(["']([^"']+)["']\)/g;
            const emaRegex = /ema\(["']([^"']+)["'],\s*(\d+)\)/g;

            const uniqueStocks = new Set();
            const uniqueEmas = new Set();

            for (const card of customCards) {
                const combinedFormula = card.formula + " " + (card.goal_value || "");

                let stockMatch;
                while ((stockMatch = stockRegex.exec(combinedFormula)) !== null) {
                    uniqueStocks.add(stockMatch[1]);
                }

                let emaMatch;
                while ((emaMatch = emaRegex.exec(combinedFormula)) !== null) {
                    uniqueEmas.add(`${emaMatch[1]}_${emaMatch[2]}`);
                }
            }

            const newStocks = {};
            const newEmas = {};

            await Promise.all([
                ...Array.from(uniqueStocks).map(async (symbol) => {
                    try {
                        const res = await fetch(`/api/dashboard/stock/${symbol}`);
                        const data = await res.json();
                        newStocks[symbol] = data.price || 0;
                    } catch {
                        newStocks[symbol] = 0;
                    }
                }),
                ...Array.from(uniqueEmas).map(async (cacheKey) => {
                    try {
                        const [symbol, period] = cacheKey.split('_');
                        const res = await fetch(`/api/dashboard/stock/${symbol}/ema/${period}`);
                        const data = await res.json();
                        newEmas[cacheKey] = data.ema || 0;
                    } catch {
                        newEmas[cacheKey] = 0;
                    }
                })
            ]);

            setCustomStockPrices(prev => {
                const updated = { ...prev };
                let changed = false;
                for (const key in newStocks) {
                    if (updated[key] !== newStocks[key]) {
                        updated[key] = newStocks[key];
                        changed = true;
                    }
                }
                return changed ? updated : prev;
            });

            setCustomEmaPrices(prev => {
                const updated = { ...prev };
                let changed = false;
                for (const key in newEmas) {
                    if (updated[key] !== newEmas[key]) {
                        updated[key] = newEmas[key];
                        changed = true;
                    }
                }
                return changed ? updated : prev;
            });
        };

        fetchStocksAndEma();

        // Also setup interval to re-fetch stocks and EMAs every minute
        const interval = setInterval(fetchStocksAndEma, 60000);
        return () => clearInterval(interval);
    }, [customCards]);

    const formatCurrency = (val) => new Intl.NumberFormat('ko-KR').format(val) + '원';
    const formatCurrencyThousands = (val) => new Intl.NumberFormat('ko-KR').format(Math.floor((val || 0) / 1000)) + '천원';

    const assetDataRaw = [
        { name: '현금 및 연동계좌', value: summary.totalCash || 0 },
        ...(summary.investmentDetails || [])
    ].filter(item => item.value > 0);
    const assetData = excludeRealEstate 
        ? assetDataRaw.filter(item => !item.name.includes('부동산')) 
        : assetDataRaw;
    const totalAssetValue = assetData.reduce((sum, item) => sum + item.value, 0);

    const rawExpenseData = expenseChartPeriod === 'yearly'
        ? (summary.expenseDetails || [])
        : (summary.monthlyExpenseDetails || []);
    const expenseData = rawExpenseData.filter(item => item.value > 0);
    const totalExpenseCategoryValue = expenseData.reduce((sum, item) => sum + item.value, 0);

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

    const evaluateFormula = (formula) => {
        try {
            const context = {
                NetWorth: summary.netWorth || 0,
                TotalCash: summary.totalCash || 0,
                TotalInvestments: summary.totalInvestments || 0,
                Income: summary.cumulativeIncome || 0,
                Expense: summary.cumulativeExpense || 0,
                Investment: summary.cumulativeInvestment || 0,
            };
            marketData.forEach(m => {
                if (m.name && m.price) {
                    if (m.symbol === '^GSPC') context.S_P500 = m.price;
                    else if (m.symbol === '^KS11') context.KOSPI = m.price;
                    else if (m.symbol === 'KRW=X') context.USD_KRW = m.price;
                    else if (m.symbol === 'GC=F') context.Gold = m.price;
                    else {
                        const cleanName = m.name.replace(/[^a-zA-Z0-9]/g, '_');
                        context[cleanName] = m.price;
                    }
                }
            });

            context.daysSince = (dateStr) => {
                const target = new Date(dateStr);
                const diffTime = Math.abs(new Date() - target);
                return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            };
            context.daySince = context.daysSince;

            context.monthsSince = (dateStr) => {
                const target = new Date(dateStr);
                const now = new Date();
                const diffMonths = (now.getFullYear() - target.getFullYear()) * 12 + (now.getMonth() - target.getMonth());
                // Handle partial months dynamically using decimals
                const diffDays = now.getDate() - target.getDate();
                return diffMonths + (diffDays / 30);
            };
            context.monthSince = context.monthsSince;

            context.KOSPI = (code) => {
                return customStockPrices[code] || 0;
            };
            context.stock = context.KOSPI;

            context.ema = (code, period) => {
                return customEmaPrices[`${code}_${period}`] || 0;
            };

            const result = evaluate(formula, context);
            if (typeof result === 'number') {
                if (result > 10000 || result < -10000) {
                    return Math.floor(result); // Number 반환
                }
                return Number.isInteger(result) ? result : parseFloat(result.toFixed(2));
            }
            return result;
        } catch {
            return '수식 오류';
        }
    };

    useEffect(() => {
        if (!customCards || customCards.length === 0) return;

        customCards.forEach(card => {
            if (!card.goal_operator || card.goal_value === null || card.goal_value === undefined) {
                notifiedCardsRef.current.delete(card.id);
                return;
            }

            const evaluatedValue = evaluateFormula(card.formula);
            const evaluatedGoalValue = isNaN(Number(card.goal_value)) ? evaluateFormula(card.goal_value) : Number(card.goal_value);

            let isGoalMet = false;
            if (typeof evaluatedValue === 'number' && typeof evaluatedGoalValue === 'number' && !isNaN(evaluatedValue) && !isNaN(evaluatedGoalValue)) {
                if (card.goal_operator === '>') isGoalMet = evaluatedValue > evaluatedGoalValue;
                else if (card.goal_operator === '<') isGoalMet = evaluatedValue < evaluatedGoalValue;
                else if (card.goal_operator === '=') isGoalMet = evaluatedValue === evaluatedGoalValue;
            }

            if (isGoalMet) {
                if (!notifiedCardsRef.current.has(card.id)) {
                    notifiedCardsRef.current.add(card.id);
                    const nf = new Intl.NumberFormat('ko-KR');

                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(`🎯 목표 달성: ${card.title}`, {
                            body: `현재값: ${nf.format(evaluatedValue)}\n목표: ${card.goal_operator} ${nf.format(evaluatedGoalValue)}`
                        });
                    }
                }
            } else {
                notifiedCardsRef.current.delete(card.id);
            }
        });
    }, [customCards, customStockPrices, customEmaPrices]);

    const handleAddOrEditCard = async () => {
        if (!cardForm.title || !cardForm.formula) return;
        try {
            const payload = {
                title: cardForm.title,
                formula: cardForm.formula,
                goal_operator: cardForm.goalOperator || null,
                goal_value: cardForm.goalValue !== '' && cardForm.goalValue !== null ? String(cardForm.goalValue) : null
            };

            if (editingCard) {
                const updatedCards = customCards.map(c =>
                    c.id === editingCard.id ? { ...c, ...payload } : c
                );
                await fetch('/api/dashboard/custom-cards', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cards: updatedCards })
                });
                setCustomCards(updatedCards);
            } else {
                const res = await fetch('/api/dashboard/custom-cards', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    const newCard = await res.json();
                    setCustomCards([...customCards, newCard]);
                }
            }
            setIsModalOpen(false);
            setEditingCard(null);
            setCardForm({ title: '', formula: '', goalOperator: '', goalValue: '' });
        } catch (error) {
            console.error('Failed to save custom card', error);
        }
    };

    const handleDeleteCard = async (id) => {
        if (!confirm('카드를 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/dashboard/custom-cards/${id}`, { method: 'DELETE' });
            setCustomCards(customCards.filter(c => c.id !== id));
        } catch (error) {
            console.error('Failed to delete custom card', error);
        }
    };

    const handleDragEnd = async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = customCards.findIndex((x) => x.id.toString() === active.id);
        const newIndex = customCards.findIndex((x) => x.id.toString() === over.id);

        const newOrder = arrayMove(customCards, oldIndex, newIndex).map((card, index) => ({
            ...card,
            layout_order: index
        }));
        setCustomCards(newOrder);

        try {
            await fetch('/api/dashboard/custom-cards', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cards: newOrder })
            });
        } catch (err) {
            console.error('Failed to update order', err);
        }
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

            {/* Custom Cards Section */}
            {customCards && customCards.length > 0 && (
                <div style={{ padding: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#f8fafc' }}>
                            내 커스텀 지표
                        </h3>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => setIsEditMode(!isEditMode)}
                                style={{
                                    background: isEditMode ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255,255,255,0.1)',
                                    border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', color: isEditMode ? '#38bdf8' : '#fff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem'
                                }}
                            >
                                <Settings size={16} />
                                {isEditMode ? '수정 완료' : '카드 관리'}
                            </button>
                            <button
                                onClick={() => {
                                    setEditingCard(null);
                                    setCardForm({ title: '', formula: '', goalOperator: '', goalValue: '' });
                                    setIsModalOpen(true);
                                }}
                                style={{
                                    background: '#38bdf8', color: '#0f1115', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600
                                }}
                            >
                                <Plus size={16} /> 새 카드 추가
                            </button>
                        </div>
                    </div>

                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={customCards.map(c => c.id.toString())} strategy={rectSortingStrategy}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                                {customCards.map(card => (
                                    <div key={card.id}>
                                        <SortableCustomCard
                                            id={card.id}
                                            title={card.title}
                                            formula={card.formula}
                                            evaluatedValue={evaluateFormula(card.formula)}
                                            goalOperator={card.goal_operator}
                                            rawGoalValue={card.goal_value}
                                            evaluatedGoalValue={card.goal_value !== null && card.goal_value !== undefined ? (isNaN(Number(card.goal_value)) ? evaluateFormula(card.goal_value) : Number(card.goal_value)) : null}
                                            isEditingMode={isEditMode}
                                            onEdit={(c) => {
                                                setEditingCard(c);
                                                setCardForm({ title: c.title, formula: c.formula, goalOperator: c.goalOperator || '', goalValue: c.goalValue !== null ? c.goalValue : '' });
                                                setIsModalOpen(true);
                                            }}
                                            onDelete={handleDeleteCard}
                                        />
                                    </div>
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>
            )}

            {(!customCards || customCards.length === 0) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-40px', marginBottom: '40px' }}>
                    <button
                        onClick={() => {
                            setEditingCard(null);
                            setCardForm({ title: '', formula: '', goalOperator: '', goalValue: '' });
                            setIsModalOpen(true);
                        }}
                        style={{
                            background: '#38bdf8', color: '#0f1115', border: 'none', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', fontWeight: 600
                        }}
                    >
                        <Plus size={16} /> 첫 커스텀 카드 추가
                    </button>
                </div>
            )}

            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>

                <div className="glass-panel" style={{ borderLeft: '4px solid #4f46e5' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>총 순자산 (Net Worth)</h3>
                    <div style={{ fontSize: '2.2rem', fontWeight: 700, margin: '8px 0' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>자산 포트폴리오 비중</h3>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={excludeRealEstate} 
                                onChange={(e) => setExcludeRealEstate(e.target.checked)} 
                            />
                            부동산 제외
                        </label>
                    </div>
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>차트 총액: </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc' }}>{formatCurrency(totalAssetValue)}</span>
                    </div>
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
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>차트 총액: </span>
                        <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ef4444' }}>{formatCurrency(totalExpenseCategoryValue)}</span>
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

            {/* Custom Card Modal */}
            {isModalOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-panel" style={{ width: '400px', padding: '24px', position: 'relative', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px' }}>
                        <h2 style={{ margin: '0 0 16px', fontSize: '1.25rem' }}>{editingCard ? '커스텀 지표 수정' : '새 커스텀 지표 작성'}</h2>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>카드 제목</label>
                            <input
                                type="text"
                                value={cardForm.title}
                                onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                                placeholder="예: 목표 달성률"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
                                계산식 (예: <span style={{ color: '#38bdf8' }}>USD_KRW * 100</span>)
                            </label>
                            <textarea
                                value={cardForm.formula}
                                onChange={(e) => setCardForm({ ...cardForm, formula: e.target.value })}
                                placeholder="사용 가능 변수: NetWorth, TotalCash, Income, Expense, Investment, S_P500, KOSPI, USD_KRW, Gold, daysSince('2024-01-01')"
                                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none', height: '100px', resize: 'vertical' }}
                            />
                        </div>

                        <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>목표 조건</label>
                                <select
                                    value={cardForm.goalOperator}
                                    onChange={(e) => setCardForm({ ...cardForm, goalOperator: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                                >
                                    <option value="">없음</option>
                                    <option value=">">결과가 큼 {'>'}</option>
                                    <option value="<">결과가 작음 {'<'}</option>
                                    <option value="=">결과가 같음 {'='}</option>
                                </select>
                            </div>
                            <div style={{ flex: 2 }}>
                                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>기준 값 (수식 가능)</label>
                                <input
                                    type="text"
                                    value={cardForm.goalValue}
                                    onChange={(e) => setCardForm({ ...cardForm, goalValue: e.target.value })}
                                    placeholder="예: 228000 또는 ema('005930', 120)"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: '#fff', outline: 'none' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setEditingCard(null);
                                    setCardForm({ title: '', formula: '', goalOperator: '', goalValue: '' });
                                }}
                                style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}
                            >취소</button>
                            <button
                                onClick={handleAddOrEditCard}
                                style={{ padding: '8px 16px', background: '#38bdf8', border: 'none', color: '#0f1115', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}
                            >저장</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

        </div>
    );
}
