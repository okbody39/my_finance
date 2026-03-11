import React, { useState, useEffect } from 'react';

export default function AccountManagement() {
    const [accounts, setAccounts] = useState([]);
    const [newAcc, setNewAcc] = useState({ purpose: '', bank_name: '', account_number: '', password: '', balance: '', include_in_stats: true });

    // 수정 모드 상태
    const [editingAccId, setEditingAccId] = useState(null);
    const [editForm, setEditForm] = useState({});

    // 호버 상태 설정 (수정/삭제 텍스트 표시용)
    const [hoveredAccId, setHoveredAccId] = useState(null);

    const fetchAccounts = () => {
        fetch('/api/accounts')
            .then(res => res.json())
            .then(data => setAccounts(data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newAcc.purpose || !newAcc.bank_name) return;

        try {
            await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newAcc,
                    balance: Number(newAcc.balance) || 0,
                    include_in_stats: newAcc.include_in_stats ? 1 : 0
                })
            });
            setNewAcc({ purpose: '', bank_name: '', account_number: '', password: '', balance: '', include_in_stats: true });
            fetchAccounts();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditClick = (acc) => {
        setEditingAccId(acc.id);
        setEditForm({
            purpose: acc.purpose,
            bank_name: acc.bank_name,
            account_number: acc.account_number || '',
            password: acc.password || '',
            balance: acc.balance || 0,
            include_in_stats: acc.include_in_stats === 1 || acc.include_in_stats === true
        });
    };

    const handleEditSave = async (id) => {
        try {
            await fetch(`/api/accounts/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    balance: Number(editForm.balance) || 0,
                    include_in_stats: editForm.include_in_stats ? 1 : 0
                })
            });
            setEditingAccId(null);
            fetchAccounts();
        } catch (e) {
            console.error(e);
            alert("수정 실패");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("정말 이 계좌를 삭제하시겠습니까?")) return;
        try {
            await fetch(`/api/accounts/${id}`, {
                method: 'DELETE'
            });
            fetchAccounts();
        } catch (e) {
            console.error(e);
            alert("삭제 실패");
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h1 className="text-gradient">연동 계좌 관리</h1>
                <p style={{ color: 'var(--text-muted)' }}>수입과 지출이 일어나는 등록된 통장 목록을 관리합니다.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

                {/* 새 계좌 입력 폼 */}
                <div className="glass-panel">
                    <h3 style={{ marginBottom: '16px' }}>새로운 계좌 등록</h3>
                    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>용도</label>
                            <input type="text" style={inputStyle} value={newAcc.purpose} onChange={e => setNewAcc({ ...newAcc, purpose: e.target.value })} placeholder="예: 용돈 통장, 월급 통장" />
                        </div>
                        <div>
                            <label style={labelStyle}>은행</label>
                            <input type="text" style={inputStyle} value={newAcc.bank_name} onChange={e => setNewAcc({ ...newAcc, bank_name: e.target.value })} placeholder="예: 카뱅, 토스, 우리" />
                        </div>
                        <div>
                            <label style={labelStyle}>계좌번호</label>
                            <input type="text" style={inputStyle} value={newAcc.account_number} onChange={e => setNewAcc({ ...newAcc, account_number: e.target.value })} placeholder="계좌번호 입력" />
                        </div>
                        <div>
                            <label style={labelStyle}>비밀번호 (로컬저장)</label>
                            <input type="password" style={inputStyle} value={newAcc.password} onChange={e => setNewAcc({ ...newAcc, password: e.target.value })} placeholder="비밀번호" />
                        </div>
                        <div>
                            <label style={labelStyle}>초기 잔액 (원)</label>
                            <input type="number" style={inputStyle} value={newAcc.balance} onChange={e => setNewAcc({ ...newAcc, balance: e.target.value })} placeholder="현재 잔액" />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                type="checkbox"
                                id="includeStats"
                                checked={newAcc.include_in_stats}
                                onChange={e => setNewAcc({ ...newAcc, include_in_stats: e.target.checked })}
                                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <label htmlFor="includeStats" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', cursor: 'pointer' }}>대시보드 통계 및 요약에 포함</label>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>계좌 등록하기</button>
                    </form>
                </div>

                {/* 보유 계좌 리스트 */}
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ margin: 0 }}>등록된 통장 리스트</h3>
                    </div>
                    <div style={{ padding: '24px' }}>
                        {accounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>등록된 계좌가 없습니다.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                                {accounts.map(acc => {
                                    const isEditing = editingAccId === acc.id;

                                    if (isEditing) {
                                        return (
                                            <div key={acc.id} style={{ background: 'rgba(56, 189, 248, 0.1)', padding: '16px', borderRadius: '12px', border: '1px solid #38bdf8', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                <div>
                                                    <label style={labelStyle}>은행</label>
                                                    <input type="text" style={inputStyle} value={editForm.bank_name} onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>용도</label>
                                                    <input type="text" style={inputStyle} value={editForm.purpose} onChange={e => setEditForm({ ...editForm, purpose: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>계좌번호</label>
                                                    <input type="text" style={inputStyle} value={editForm.account_number} onChange={e => setEditForm({ ...editForm, account_number: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label style={labelStyle}>잔액</label>
                                                    <input type="number" style={inputStyle} value={editForm.balance} onChange={e => setEditForm({ ...editForm, balance: e.target.value })} />
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={editForm.include_in_stats}
                                                        onChange={e => setEditForm({ ...editForm, include_in_stats: e.target.checked })}
                                                    />
                                                    <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>통계에 포함</label>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <button onClick={() => handleEditSave(acc.id)} style={{ flex: 1, background: '#10b981', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>저장</button>
                                                    <button onClick={() => setEditingAccId(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}>취소</button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const isExcluded = acc.include_in_stats === 0;

                                    return (
                                        <div
                                            key={acc.id}
                                            onMouseEnter={() => setHoveredAccId(acc.id)}
                                            onMouseLeave={() => setHoveredAccId(null)}
                                            style={{ background: isExcluded ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)', opacity: isExcluded ? 0.6 : 1, padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 600 }}>{acc.bank_name}</span>
                                                    {isExcluded && <span style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px' }}>통계제외</span>}
                                                </div>
                                                <strong style={{ fontSize: '1rem' }}>{acc.purpose}</strong>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                                                {acc.account_number || '-'}
                                            </div>
                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', marginBottom: '16px' }}>
                                                {new Intl.NumberFormat('ko-KR').format(acc.balance)} 원
                                            </div>
                                            <div style={{
                                                display: 'flex',
                                                gap: '12px',
                                                justifyContent: 'flex-end',
                                                paddingTop: '12px',
                                                borderTop: '1px solid rgba(255,255,255,0.05)',
                                                opacity: hoveredAccId === acc.id ? 1 : 0,
                                                transition: 'opacity 0.2s',
                                                pointerEvents: hoveredAccId === acc.id ? 'auto' : 'none'
                                            }}>
                                                <span onClick={() => handleEditClick(acc)} style={{ color: '#38bdf8', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'underline' }}>수정</span>
                                                <span onClick={() => handleDelete(acc.id)} style={{ color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500, textDecoration: 'underline' }}>삭제</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const labelStyle = {
    display: 'block',
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    marginBottom: '4px'
};

const inputStyle = {
    width: '100%',
    background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    padding: '10px 12px',
    borderRadius: '8px',
    outline: 'none',
    fontFamily: 'inherit'
};
