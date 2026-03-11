import React, { useState, useEffect } from 'react';

export default function InvestmentManagement() {
    const [investments, setInvestments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [newInv, setNewInv] = useState({ name: '', type: '주식', current_value: '', target_value: '' });

    // 수정 모드 상태 관리
    const [editingInvId, setEditingInvId] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', type: '주식', current_value: '', target_value: '' });
    const [hoveredInvId, setHoveredInvId] = useState(null);

    const fetchInvestments = () => {
        fetch('/api/investments')
            .then(res => res.json())
            .then(data => setInvestments(data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        fetchInvestments();
        fetch('/api/settings/categories?type=INVESTMENT')
            .then(res => res.json())
            .then(data => setCategories(data))
            .catch(err => console.error(err));
    }, []);

    // 쉼표 추가 유틸 (입력창용)
    const formatNumberInput = (value) => {
        if (!value) return '';
        const numOnly = value.toString().replace(/[^0-9]/g, '');
        return Number(numOnly).toLocaleString('ko-KR');
    };

    // 쉼표 제거 유틸 (저장용)
    const parseNumberInput = (value) => {
        if (!value) return 0;
        return Number(value.toString().replace(/,/g, ''));
    };

    const handleNewChange = (field, value) => {
        if (field === 'current_value' || field === 'target_value') {
            setNewInv({ ...newInv, [field]: formatNumberInput(value) });
        } else {
            setNewInv({ ...newInv, [field]: value });
        }
    };

    const handleEditChange = (field, value) => {
        if (field === 'current_value' || field === 'target_value') {
            setEditForm({ ...editForm, [field]: formatNumberInput(value) });
        } else {
            setEditForm({ ...editForm, [field]: value });
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newInv.name || !newInv.current_value) return;

        try {
            await fetch('/api/investments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...newInv,
                    current_value: parseNumberInput(newInv.current_value),
                    target_value: parseNumberInput(newInv.target_value)
                })
            });
            setNewInv({ name: '', type: '주식', current_value: '', target_value: '' });
            fetchInvestments();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditStart = (inv) => {
        setEditingInvId(inv.id);
        setEditForm({
            name: inv.name,
            type: inv.type,
            current_value: formatNumberInput(inv.current_value),
            target_value: inv.target_value ? formatNumberInput(inv.target_value) : ''
        });
    };

    const handleEditSave = async (id) => {
        if (!editForm.name || !editForm.current_value) return;

        try {
            await fetch(`/api/investments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...editForm,
                    current_value: parseNumberInput(editForm.current_value),
                    target_value: parseNumberInput(editForm.target_value)
                })
            });
            setEditingInvId(null);
            fetchInvestments();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('정말 이 자산을 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/investments/${id}`, {
                method: 'DELETE'
            });
            fetchInvestments();
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h1 className="text-gradient">투자 코어 자산 (Investments)</h1>
                <p style={{ color: 'var(--text-muted)' }}>배당과 시세차익을 가져다주는 핵심 경제적 자유 자산들입니다.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                {/* 새 자산 입력 폼 */}
                <div className="glass-panel" style={{ alignSelf: 'start' }}>
                    <h3 style={{ marginBottom: '16px' }}>새로운 자산 추가</h3>
                    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>자산명</label>
                            <input type="text" style={inputStyle} value={newInv.name} onChange={e => handleNewChange('name', e.target.value)} placeholder="예: 삼성전자우, 부동산..." />
                        </div>
                        <div>
                            <label style={labelStyle}>분류</label>
                            <select style={inputStyle} value={newInv.type} onChange={e => handleNewChange('type', e.target.value)}>
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                {categories.length === 0 && <option value="주식">주식</option>}
                            </select>
                        </div>
                        <div>
                            <label style={labelStyle}>현재 가치 (원)</label>
                            <input type="text" style={inputStyle} value={newInv.current_value} onChange={e => handleNewChange('current_value', e.target.value)} placeholder="총액 기준 (예: 1,000,000)" />
                        </div>
                        <div>
                            <label style={labelStyle}>목표 가치 (원)</label>
                            <input type="text" style={inputStyle} value={newInv.target_value} onChange={e => handleNewChange('target_value', e.target.value)} placeholder="목표 달성치 (예: 5,000,000)" />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>자산 등재하기</button>
                    </form>
                </div>

                {/* 보유 자산 리스트 */}
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <h3 style={{ margin: 0 }}>코어 자산 현황</h3>
                    </div>
                    <div style={{ padding: '0 24px 24px 24px' }}>
                        {investments.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>등재된 코어 자산이 없습니다.</div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
                                {investments.map(inv => {
                                    const progress = inv.target_value ? Math.min(100, (inv.current_value / inv.target_value) * 100) : 0;
                                    const isEditing = editingInvId === inv.id;
                                    const isHovered = hoveredInvId === inv.id;

                                    if (isEditing) {
                                        return (
                                            <div key={inv.id} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', border: '1px solid #38bdf8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                <input type="text" style={inputStyle} value={editForm.name} onChange={e => handleEditChange('name', e.target.value)} placeholder="자산명" />
                                                <select style={inputStyle} value={editForm.type} onChange={e => handleEditChange('type', e.target.value)}>
                                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                                    {categories.length === 0 && <option value="주식">주식</option>}
                                                </select>
                                                <input type="text" style={inputStyle} value={editForm.current_value} onChange={e => handleEditChange('current_value', e.target.value)} placeholder="현재 가치" />
                                                <input type="text" style={inputStyle} value={editForm.target_value} onChange={e => handleEditChange('target_value', e.target.value)} placeholder="목표 가치" />

                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <button onClick={() => handleEditSave(inv.id)} style={{ flex: 1, padding: '6px', background: '#38bdf8', color: '#0f1115', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>저장</button>
                                                    <button onClick={() => setEditingInvId(null)} style={{ flex: 1, padding: '6px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>취소</button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={inv.id}
                                            onMouseEnter={() => setHoveredInvId(inv.id)}
                                            onMouseLeave={() => setHoveredInvId(null)}
                                            style={{ background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ color: '#a78bfa', fontSize: '0.85rem', fontWeight: 600 }}>{inv.type}</span>
                                                {isHovered && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <span onClick={() => handleEditStart(inv)} style={{ fontSize: '0.75rem', color: '#38bdf8', cursor: 'pointer' }}>수정</span>
                                                        <span onClick={() => handleDelete(inv.id)} style={{ fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer' }}>삭제</span>
                                                    </div>
                                                )}
                                            </div>
                                            <strong style={{ fontSize: '1.1rem' }}>{inv.name}</strong>

                                            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#10b981', margin: '4px 0' }}>
                                                {new Intl.NumberFormat('ko-KR').format(inv.current_value)} 원
                                            </div>

                                            {/* 목표 프로그레스 바 */}
                                            {inv.target_value > 0 && (
                                                <div style={{ marginTop: 'auto' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                        <span>달성 {progress.toFixed(1)}%</span>
                                                        <span>{new Intl.NumberFormat('ko-KR').format(inv.target_value)} 원</span>
                                                    </div>
                                                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #38bdf8)' }} />
                                                    </div>
                                                </div>
                                            )}
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
