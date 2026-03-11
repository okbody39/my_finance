import React, { useState, useEffect } from 'react';

export default function TransactionManagement() {
    const [accounts, setAccounts] = useState([]);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [transactions, setTransactions] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');

    const today = new Date();
    let initYear = today.getFullYear();
    let initMonth = today.getMonth() + 1;
    if (today.getDate() < 20) {
        initMonth -= 1;
        if (initMonth === 0) {
            initMonth = 12;
            initYear -= 1;
        }
    }
    const [salaryYear, setSalaryYear] = useState(initYear);
    const [salaryMonth, setSalaryMonth] = useState(initMonth);

    // 새 항목 입력 폼 상태 (콤마 처리 위해 문자열 유지)
    const [newTx, setNewTx] = useState({
        date: new Date().toISOString().split('T')[0],
        store: '',
        income: '',
        expense: '',
        period: '예정', // 상태 (예정/실행)
        is_fixed: '고정',
        note: ''
    });

    // 수정 모드 상태
    const [editingTxId, setEditingTxId] = useState(null);
    const [editForm, setEditForm] = useState({});

    const fetchAccounts = () => {
        fetch('/api/accounts')
            .then(res => res.json())
            .then(data => {
                setAccounts(data);
                if (data && data.length > 0 && !selectedAccountId) {
                    // '월급'이라는 단어가 포함된 용도의 계좌 찾기
                    const salaryAcc = data.find(a => a.purpose && a.purpose.includes('월급'));
                    if (salaryAcc) {
                        setSelectedAccountId(String(salaryAcc.id));
                    }
                }
            })
            .catch(err => console.error(err));
    };

    const fetchTransactions = () => {
        if (!selectedAccountId) {
            setTransactions([]);
            return;
        }
        fetch('/api/transactions')
            .then(res => res.json())
            .then(data => {
                let filteredByAccount = data.filter(t => t.account_id === Number(selectedAccountId));

                // 급여 기준 월에 따른 필터링 (화면 출력용)
                const startD = new Date(salaryYear, salaryMonth - 1, 20);
                const endD = new Date(salaryYear, salaryMonth, 19, 23, 59, 59);

                const displayTransactions = filteredByAccount.filter(t => {
                    const d = new Date(t.date);
                    return d >= startD && d <= endD;
                });

                // 날짜 오름차순 정렬
                displayTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
                setTransactions(displayTransactions);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (selectedAccountId) {
            fetch('/api/transactions/auto-fill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: selectedAccountId, year: salaryYear, month: salaryMonth })
            }).then(() => {
                fetchTransactions();
            }).catch(console.error);
        } else {
            fetchTransactions();
        }
        setEditingTxId(null);
    }, [selectedAccountId, salaryYear, salaryMonth]);

    // 항목 추가
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newTx.date || !selectedAccountId) {
            alert("날짜를 입력하고 특정 계좌를 상단에서 선택해주세요.");
            return;
        }

        const parsedIncome = Number(String(newTx.income).replace(/,/g, '')) || 0;
        const parsedExpense = Number(String(newTx.expense).replace(/,/g, '')) || 0;

        try {
            await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    date: newTx.date,
                    store: newTx.store,
                    income: parsedIncome,
                    expense: parsedExpense,
                    period: newTx.period,
                    is_fixed: newTx.is_fixed,
                    note: newTx.note,
                    account_id: selectedAccountId,
                    usage_category: '',
                    bank_name: ''
                })
            });
            setNewTx(prev => ({ ...prev, store: '', income: '', expense: '', note: '' }));
            fetchTransactions();
            fetchAccounts();
        } catch (e) {
            console.error(e);
        }
    };

    // 항목 수정 폼 진입
    const handleEditClick = (tx) => {
        setEditingTxId(tx.id);
        setEditForm({
            date: tx.date.split(' ')[0], // T... 부분 제거
            store: tx.store,
            income: tx.income > 0 ? new Intl.NumberFormat('ko-KR').format(tx.income) : '',
            expense: tx.expense > 0 ? new Intl.NumberFormat('ko-KR').format(tx.expense) : '',
            period: tx.period || '실행',
            is_fixed: tx.is_fixed || '고정',
            note: tx.note || ''
        });
    };

    // 항목 수정 저장
    const handleEditSave = async (id) => {
        const parsedIncome = Number(String(editForm.income).replace(/,/g, '')) || 0;
        const parsedExpense = Number(String(editForm.expense).replace(/,/g, '')) || 0;

        try {
            await fetch(`/api/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    income: parsedIncome,
                    expense: parsedExpense
                })
            });
            setEditingTxId(null);
            fetchTransactions();
            fetchAccounts(); // 잔액 재계산을 위해 다시 불러옴
        } catch (e) {
            console.error(e);
            alert("수정 실패");
        }
    };

    // 항목 삭제
    const handleDelete = async (id) => {
        if (!window.confirm("정말 이 내역을 삭제하시겠습니까?")) return;
        try {
            await fetch(`/api/transactions/${id}`, {
                method: 'DELETE'
            });
            fetchTransactions();
            fetchAccounts();
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    // 요일 계산 헬퍼
    const getDayOfWeek = (dateString) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(dateString);
        if (isNaN(d)) return '';
        return days[d.getDay()];
    };

    // 콤마 입력 핸들러 (새 항목용)
    const handleNumberChange = (e, field) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (!isNaN(rawValue)) {
            const formattedValue = rawValue === '' ? '' : new Intl.NumberFormat('ko-KR').format(rawValue);
            setNewTx({ ...newTx, [field]: formattedValue });
        }
    };

    // 콤마 입력 핸들러 (수정용)
    const handleEditNumberChange = (e, field) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (!isNaN(rawValue)) {
            const formattedValue = rawValue === '' ? '' : new Intl.NumberFormat('ko-KR').format(rawValue);
            setEditForm({ ...editForm, [field]: formattedValue });
        }
    };

    // 선택된 계좌 정보
    const selectedAccountInfo = accounts.find(a => a.id === Number(selectedAccountId));

    // 잔액 계산 로직 (해당 월 기준 합산)
    let currentBalance = 0;
    let plannedBalance = 0;

    if (selectedAccountInfo) {
        // 화면에 표시된 내역(transactions) 기준 '실행' 내역 합산
        const executedTransactions = transactions.filter(t => t.period === '실행');
        const executedIncomeSum = executedTransactions.reduce((acc, t) => acc + (t.income || 0), 0);
        const executedExpenseSum = executedTransactions.reduce((acc, t) => acc + (t.expense || 0), 0);

        currentBalance = executedIncomeSum - executedExpenseSum;

        // 화면에 표시된 내역 기준 '예정' 내역 합산
        const plannedTxs = transactions.filter(t => t.period === '예정');
        const plannedIncomeSum = plannedTxs.reduce((acc, t) => acc + (t.income || 0), 0);
        const plannedExpenseSum = plannedTxs.reduce((acc, t) => acc + (t.expense || 0), 0);

        plannedBalance = currentBalance + plannedIncomeSum - plannedExpenseSum;
    }

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="text-gradient">입출금 내역</h1>
                    <p style={{ color: 'var(--text-muted)' }}>월천 시스템의 철저한 현금흐름 통제 센터입니다.</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    {selectedAccountId !== '' && (
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: '8px' }}>🔍</span>
                            <input
                                type="text"
                                placeholder="적요 검색..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '0.9rem', width: '150px' }}
                            />
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>기준월 (20일~19일)</span>
                        <select value={salaryYear} onChange={e => setSalaryYear(Number(e.target.value))} style={selectStyle}>
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}년</option>)}
                        </select>
                        <select value={salaryMonth} onChange={e => setSalaryMonth(Number(e.target.value))} style={selectStyle}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월분</option>)}
                        </select>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginRight: '12px' }}>조회 계좌 선택</span>
                        <select
                            value={selectedAccountId}
                            onChange={e => setSelectedAccountId(e.target.value)}
                            style={selectStyle}
                        >
                            <option value="">계좌를 선택하세요</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.purpose} ({acc.bank_name})</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* 상단 요약 (잔액) */}
            {selectedAccountInfo && (
                <div style={{ display: 'flex', gap: '24px' }}>
                    <div className="glass-panel" style={{ flex: 1, borderTop: '4px solid #38bdf8', padding: '16px 24px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>현재 잔액 (실행 합산)</span>
                        <div style={{ fontSize: '2rem', fontWeight: 700 }}>
                            {new Intl.NumberFormat('ko-KR').format(currentBalance)} <span style={{ fontSize: '1rem' }}>원</span>
                        </div>
                    </div>
                    <div className="glass-panel" style={{ flex: 1, borderTop: '4px solid #fcd34d', padding: '16px 24px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>예정 잔액 (실행 + 예정)</span>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: '#fcd34d' }}>
                            {new Intl.NumberFormat('ko-KR').format(plannedBalance)} <span style={{ fontSize: '1rem' }}>원</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 데이터 테이블 */}
            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', outline: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <tr>
                            <th style={thStyle}>날짜</th>
                            <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>요일</th>
                            <th style={{ ...thStyle, width: '180px' }}>적요 (가맹점)</th>
                            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>상태</th>
                            <th style={{ ...thStyle, width: '80px', textAlign: 'center' }}>구분</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>수입</th>
                            <th style={{ ...thStyle, textAlign: 'right', color: '#ef4444' }}>지출</th>
                            <th style={thStyle}>비고</th>
                            <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 새 항목 입력 Row (계좌가 선택되었을 때만 활성화) */}
                        {selectedAccountId !== '' ? (
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(79, 70, 229, 0.1)' }}>
                                <td style={tdStyle}><input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} style={inputStyle} /></td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>{getDayOfWeek(newTx.date)}</td>
                                <td style={tdStyle}><input type="text" placeholder="입력" value={newTx.store} onChange={e => setNewTx({ ...newTx, store: e.target.value })} style={inputStyle} /></td>
                                <td style={tdStyle}>
                                    <select value={newTx.period} onChange={e => setNewTx({ ...newTx, period: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                        <option>예정</option><option>실행</option>
                                    </select>
                                </td>
                                <td style={tdStyle}>
                                    <select value={newTx.is_fixed} onChange={e => setNewTx({ ...newTx, is_fixed: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                        <option>고정</option><option>변동</option>
                                    </select>
                                </td>
                                <td style={tdStyle}>
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={newTx.income}
                                        onChange={e => handleNumberChange(e, 'income')}
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                    />
                                </td>
                                <td style={tdStyle}>
                                    <input
                                        type="text"
                                        placeholder="0"
                                        value={newTx.expense}
                                        onChange={e => handleNumberChange(e, 'expense')}
                                        style={{ ...inputStyle, textAlign: 'right' }}
                                    />
                                </td>
                                <td style={tdStyle}><input type="text" placeholder="입력" value={newTx.note} onChange={e => setNewTx({ ...newTx, note: e.target.value })} style={inputStyle} /></td>
                                <td style={{ ...tdStyle, paddingLeft: '8px', textAlign: 'center' }}>
                                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={handleAdd}>엔터(추가)</button>
                                </td>
                            </tr>
                        ) : (
                            <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '12px', fontSize: '0.9rem', color: '#fcd34d' }}>
                                    ℹ️ 상단에서 <strong>특정 계좌를 선택</strong>해야 내역 입력을 시작할 수 있습니다.
                                </td>
                            </tr>
                        )}

                        {/* 리스트 출력 (검색어 필터 적용) */}
                        {transactions
                            .filter(tx => tx.store.toLowerCase().includes(searchTerm.toLowerCase()))
                            .map(tx => {
                                const isEditing = editingTxId === tx.id;

                                if (isEditing) {
                                    return (
                                        <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(56, 189, 248, 0.1)' }}>
                                            <td style={tdStyle}><input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} style={inputStyle} /></td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>{getDayOfWeek(editForm.date)}</td>
                                            <td style={tdStyle}><input type="text" value={editForm.store} onChange={e => setEditForm({ ...editForm, store: e.target.value })} style={inputStyle} /></td>
                                            <td style={tdStyle}>
                                                <select value={editForm.period} onChange={e => setEditForm({ ...editForm, period: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                                    <option>예정</option><option>실행</option>
                                                </select>
                                            </td>
                                            <td style={tdStyle}>
                                                <select value={editForm.is_fixed} onChange={e => setEditForm({ ...editForm, is_fixed: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                                    <option>고정</option><option>변동</option>
                                                </select>
                                            </td>
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={editForm.income}
                                                    onChange={e => handleEditNumberChange(e, 'income')}
                                                    style={{ ...inputStyle, textAlign: 'right' }}
                                                />
                                            </td>
                                            <td style={tdStyle}>
                                                <input
                                                    type="text"
                                                    value={editForm.expense}
                                                    onChange={e => handleEditNumberChange(e, 'expense')}
                                                    style={{ ...inputStyle, textAlign: 'right' }}
                                                />
                                            </td>
                                            <td style={tdStyle}><input type="text" value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} style={inputStyle} /></td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                    <button onClick={() => handleEditSave(tx.id)} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>저장</button>
                                                    <button onClick={() => setEditingTxId(null)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>취소</button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }

                                return (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={tdStyle}>{tx.date.split(' ')[0]}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{getDayOfWeek(tx.date)}</td>
                                        <td style={tdStyle}>{tx.store}</td>

                                        <td style={{ ...tdStyle, textAlign: 'center', color: tx.period === '예정' ? '#fcd34d' : '#10b981' }}>{tx.period || '실행'}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{tx.is_fixed}</td>

                                        <td style={{ ...tdStyle, textAlign: 'right', background: tx.income > 0 ? 'rgba(252, 211, 77, 0.1)' : 'transparent', color: tx.income > 0 ? '#fcd34d' : 'inherit', fontWeight: tx.income > 0 ? 600 : 'normal' }}>
                                            {tx.income > 0 ? new Intl.NumberFormat('ko-KR').format(tx.income) : ''}
                                        </td>

                                        <td style={{ ...tdStyle, textAlign: 'right', background: tx.expense > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent', color: tx.expense > 0 ? '#ef4444' : 'inherit', fontWeight: tx.expense > 0 ? 600 : 'normal' }}>
                                            {tx.expense > 0 ? new Intl.NumberFormat('ko-KR').format(tx.expense) : ''}
                                        </td>

                                        <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{tx.note}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                                <button onClick={() => handleEditClick(tx)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s' }}>수정</button>
                                                <button onClick={() => handleDelete(tx.id)} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', transition: '0.2s' }}>삭제</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        {selectedAccountId !== '' && transactions.filter(tx => tx.store.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>내역이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thStyle = {
    padding: '12px 8px',
    fontWeight: 500,
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    borderRight: '1px solid rgba(255,255,255,0.05)'
};

const tdStyle = {
    padding: '8px',
    fontSize: '0.9rem',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    verticalAlign: 'middle'
};

const inputStyle = {
    width: '100%',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    padding: '6px 8px',
    borderRadius: '4px',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: '0.9rem'
};

const selectStyle = {
    background: 'transparent',
    color: 'white',
    border: 'none',
    outline: 'none',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer'
};
