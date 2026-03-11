import React, { useState, useEffect } from 'react';

export default function ExpenseManagement() {
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

    // 동적 카테고리 상태
    const [categories, setCategories] = useState([]);

    // 새 항목 입력 폼 상태
    const [newTx, setNewTx] = useState({
        date: new Date().toISOString().split('T')[0],
        store: '',
        expense: '',
        usage_category: '기타', // 분류: 쇼핑, 식비, 여가, 기타
        period: '실행', // 상태 (예정/실행)
        is_fixed: '변동', // 구분 (고정/변동)
        note: ''
    });

    const [editingTxId, setEditingTxId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // CSV 모달 관련 상태
    const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
    const [csvText, setCsvText] = useState('');
    const [csvFormat, setCsvFormat] = useState('date,store,expense,category'); // 기본 포맷 가이드



    const fetchTransactions = () => {
        fetch('/api/transactions')
            .then(res => res.json())
            .then(data => {
                // 특정 계좌 & 지출내역(수입 제외 혹은 지출 0 이상) 필터
                // 계좌 종속성 제거 (account_id가 null이거나 1 이상이라도 지출은 모두 표시)
                // 하지만 요구사항에 따라 다른 계좌 거래내역과 분리한다면 account_id === null 인 것만 불러오면 됩니다.
                // 일단 지출 전용으로 account_id 가 없는(또는 0인) 항목들 위주로 필터링합니다.
                let filtered = data.filter(t => !t.account_id && t.expense > 0);

                const startD = new Date(salaryYear, salaryMonth - 1, 20);
                const endD = new Date(salaryYear, salaryMonth, 19, 23, 59, 59);

                filtered = filtered.filter(t => {
                    const d = new Date(t.date);
                    return d >= startD && d <= endD;
                });

                filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
                setTransactions(filtered);
            })
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchTransactions();

        // 카테고리 불러오기
        fetch('/api/settings/categories?type=EXPENSE')
            .then(res => res.json())
            .then(data => setCategories(data))
            .catch(err => console.error(err));

        setEditingTxId(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [salaryYear, salaryMonth]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newTx.date) {
            alert("날짜를 입력해주세요.");
            return;
        }

        const parsedExpense = Number(String(newTx.expense).replace(/,/g, '')) || 0;
        if (parsedExpense <= 0) {
            alert("지출 금액을 입력해주세요.");
            return;
        }

        try {
            await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newTx,
                    income: 0,
                    expense: parsedExpense,
                    account_id: null,
                })
            });
            setNewTx(prev => ({ ...prev, store: '', expense: '', note: '', usage_category: '기타' }));
            fetchTransactions();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditClick = (tx) => {
        setEditingTxId(tx.id);
        setEditForm({
            date: tx.date.split(' ')[0],
            store: tx.store,
            expense: tx.expense > 0 ? new Intl.NumberFormat('ko-KR').format(tx.expense) : '',
            usage_category: tx.usage_category || '',
            period: tx.period || '실행',
            is_fixed: tx.is_fixed || '변동',
            note: tx.note || ''
        });
    };

    const handleEditSave = async (id) => {
        const parsedExpense = Number(String(editForm.expense).replace(/,/g, '')) || 0;
        try {
            await fetch(`/api/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    income: 0, // 지출 페이지이므로 수입은 0으로 고정
                    expense: parsedExpense
                })
            });
            setEditingTxId(null);
            fetchTransactions();
        } catch (e) {
            console.error(e);
            alert("수정 실패");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("정말 이 내역을 삭제하시겠습니까?")) return;
        try {
            await fetch(`/api/transactions/${id}`, {
                method: 'DELETE'
            });
            fetchTransactions();
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    const handleCsvSubmit = async () => {
        if (!csvText.trim()) return;

        const lines = csvText.split('\n').map(l => l.trim()).filter(l => l !== '');
        const bulkTxs = lines.map(line => {
            // 탭 또는 콤마 분리 (엑셀 붙여넣기 대응)
            const cols = line.includes('\t') ? line.split('\t') : line.split(',');
            const [date, store, expStr, category, isFixed, reqPeriod] = cols.map(c => c?.trim() || '');
            const parsedExpense = Number(expStr?.replace(/[^0-9]/g, '')) || 0;

            // 날짜 포맷 맞추기 (YYYY-MM-DD) - 예: 2026.03.01 -> 2026-03-01
            let formattedDate = date.replace(/\./g, '-');
            if (formattedDate.length === 8 && !formattedDate.includes('-')) {
                // 20260301 형태
                formattedDate = `${formattedDate.slice(0, 4)}-${formattedDate.slice(4, 6)}-${formattedDate.slice(6, 8)}`;
            }

            return {
                date: formattedDate || new Date().toISOString().split('T')[0],
                store: store || '미상',
                expense: parsedExpense,
                usage_category: category || '기타',
                is_fixed: isFixed || '변동',
                period: reqPeriod || '실행'
            };
        });

        try {
            const res = await fetch('/api/transactions/bulk-csv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: null,
                    transactions: bulkTxs
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`${data.count}건의 지출 내역이 성공적으로 등록되었습니다.`);
                setIsCsvModalOpen(false);
                setCsvText('');
                fetchTransactions();
            } else {
                alert("등록에 실패했습니다.");
            }
        } catch (e) {
            console.error(e);
            alert("처리 중 오류가 발생했습니다.");
        }
    };

    const getDayOfWeek = (dateString) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const d = new Date(dateString);
        if (isNaN(d)) return '';
        return days[d.getDay()];
    };

    const handleNumberChange = (e, field) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (!isNaN(rawValue)) {
            const formattedValue = rawValue === '' ? '' : new Intl.NumberFormat('ko-KR').format(rawValue);
            setNewTx({ ...newTx, [field]: formattedValue });
        }
    };

    const handleEditNumberChange = (e, field) => {
        const rawValue = e.target.value.replace(/,/g, '');
        if (!isNaN(rawValue)) {
            const formattedValue = rawValue === '' ? '' : new Intl.NumberFormat('ko-KR').format(rawValue);
            setEditForm({ ...editForm, [field]: formattedValue });
        }
    };



    // 지출 합계 계산
    const totalExpense = transactions.reduce((acc, t) => acc + (t.expense || 0), 0);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="text-gradient">지출 내역 관리</h1>
                    <p style={{ color: 'var(--text-muted)' }}>카드사용 내역 기반 지출 전용 관리 및 업로드</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
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
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>기준월</span>
                        <select value={salaryYear} onChange={e => setSalaryYear(Number(e.target.value))} style={selectStyle}>
                            {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}년</option>)}
                        </select>
                        <select value={salaryMonth} onChange={e => setSalaryMonth(Number(e.target.value))} style={selectStyle}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월분</option>)}
                        </select>
                    </div>
                </div>
            </div>


            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div className="glass-panel" style={{ flex: 1, borderTop: '4px solid #ef4444', padding: '16px 24px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>초기 지출 내역 합계</span>
                    <div style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444' }}>
                        {new Intl.NumberFormat('ko-KR').format(totalExpense)} <span style={{ fontSize: '1rem' }}>원</span>
                    </div>
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        className="btn btn-primary"
                        style={{ padding: '12px 24px', fontSize: '1rem', background: '#ec4899', color: 'white', border: 'none' }}
                        onClick={() => setIsCsvModalOpen(true)}
                    >
                        + CSV 텍스트 대량 쓰기 (붙여넣기)
                    </button>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', outline: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1100px' }}>
                    <thead style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <tr>
                            <th style={thStyle}>날짜</th>
                            <th style={{ ...thStyle, width: '50px', textAlign: 'center' }}>요일</th>
                            <th style={{ ...thStyle, width: '220px' }}>적요 (가맹점)</th>
                            <th style={{ ...thStyle, width: '100px', textAlign: 'center' }}>분류(카테고리)</th>
                            <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>상태</th>
                            <th style={{ ...thStyle, width: '90px', textAlign: 'center' }}>구분</th>
                            <th style={{ ...thStyle, textAlign: 'right', color: '#ef4444' }}>지출 금액</th>
                            <th style={thStyle}>비고</th>
                            <th style={{ ...thStyle, width: '120px', textAlign: 'center' }}>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(236, 72, 153, 0.1)' }}>
                            <td style={tdStyle}><input type="date" value={newTx.date} onChange={e => setNewTx({ ...newTx, date: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{getDayOfWeek(newTx.date)}</td>
                            <td style={tdStyle}><input type="text" placeholder="예: 스타벅스" value={newTx.store} onChange={e => setNewTx({ ...newTx, store: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}>
                                <select value={newTx.usage_category} onChange={e => setNewTx({ ...newTx, usage_category: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                    {categories.length === 0 && <option value="기타">기타</option>}
                                </select>
                            </td>
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
                                    value={newTx.expense}
                                    onChange={e => handleNumberChange(e, 'expense')}
                                    style={{ ...inputStyle, textAlign: 'right', color: '#ef4444', fontWeight: 'bold' }}
                                />
                            </td>
                            <td style={tdStyle}><input type="text" placeholder="입력" value={newTx.note} onChange={e => setNewTx({ ...newTx, note: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, paddingLeft: '8px', textAlign: 'center' }}>
                                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={handleAdd}>엔터(추가)</button>
                            </td>
                        </tr>

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
                                                <select value={editForm.usage_category} onChange={e => setEditForm({ ...editForm, usage_category: e.target.value })} style={{ ...inputStyle, padding: '8px 4px', textAlign: 'center' }}>
                                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    {categories.length === 0 && <option value="기타">기타</option>}
                                                </select>
                                            </td>
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
                                                    value={editForm.expense}
                                                    onChange={e => handleEditNumberChange(e, 'expense')}
                                                    style={{ ...inputStyle, textAlign: 'right', color: '#ef4444' }}
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
                                        <td style={{ ...tdStyle, textAlign: 'center', color: '#38bdf8' }}>{tx.usage_category}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', color: tx.period === '예정' ? '#fcd34d' : '#10b981' }}>{tx.period || '실행'}</td>
                                        <td style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>{tx.is_fixed}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
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
                        {transactions.filter(tx => tx.store.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>조건에 맞는 지출 내역이 없습니다.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* CSV 대량 업로드 모달 */}
            {
                isCsvModalOpen && (
                    <div style={modalOverlayStyle}>
                        <div className="glass-panel" style={modalContentStyle}>
                            <h2>카드 사용내역 엑셀/CSV 붙여넣기</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
                                엑셀에서 복사한 여러 줄의 데이터를 아래 양식 순서대로 텍스트 창에 직접 붙여넣으세요. (각 항목은 탭 또는 쉼표로 구분되어야 합니다)
                            </p>
                            <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
                                <div style={{ color: '#fcd34d', fontSize: '0.85rem', marginBottom: '8px' }}>👉 필수 열 순서 (띄어쓰기 또는 쉼표/탭 분리)</div>
                                <code style={{ color: '#38bdf8' }}>날짜(YYYY-MM-DD), 가맹점, 지출금액, [분류], [구분(고정/변동)], [상태(실행/예정)]</code>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '4px' }}>※ 괄호[ ]는 빈 값 또는 생략 시 기본값으로 처리됩니다. (기본값: 분류=기타, 구분=변동, 상태=실행)</div>
                            </div>

                            <textarea
                                style={{
                                    width: '100%',
                                    height: '200px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    color: 'white',
                                    padding: '12px',
                                    borderRadius: '8px',
                                    outline: 'none',
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    resize: 'vertical'
                                }}
                                placeholder={`복사한 데이터를 여기에 붙여넣으세요...\n예시:\n2026-03-01, 쿠팡, 54000, 쇼핑, 변동, 실행\n2026-03-02, 스타벅스, 4500, 외식`}
                                value={csvText}
                                onChange={(e) => setCsvText(e.target.value)}
                            />

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                                <button onClick={() => setIsCsvModalOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>취소</button>
                                <button onClick={handleCsvSubmit} style={{ background: '#ec4899', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>대량 변환 및 저장</button>
                            </div>
                        </div>
                    </div>
                )}
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

const modalOverlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)'
};

const modalContentStyle = {
    width: '100%',
    maxWidth: '600px',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
};
