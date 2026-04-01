import React, { useState, useEffect, useRef } from 'react';

const CategoryList = ({ title, data, type, newValue, setNewValue, onAdd, onDelete, onReorder }) => {
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    const handleSort = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        if (dragItem.current === dragOverItem.current) {
            dragItem.current = null;
            dragOverItem.current = null;
            return;
        }

        let _data = [...data];
        const draggedItemContent = _data.splice(dragItem.current, 1)[0];
        _data.splice(dragOverItem.current, 0, draggedItemContent);

        dragItem.current = null;
        dragOverItem.current = null;

        // DB 저장을 위해 필요한 정보 (새로운 배열 전체의 id와 순서) 전달
        onReorder(type, _data);
    };

    return (
        <div style={{ flex: 1, minWidth: '300px' }} className="glass-panel">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '16px', color: '#38bdf8' }}>{title} 관리</h2>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                <input
                    type="text"
                    value={newValue}
                    onChange={e => setNewValue(e.target.value)}
                    placeholder="새 카테고리 이름..."
                    style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'white',
                        padding: '10px 16px',
                        borderRadius: '8px',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={() => onAdd(type, newValue, setNewValue)}
                    style={{ background: '#ec4899', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                    추가
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.map((cat, index) => (
                    <div
                        key={cat.id}
                        draggable
                        onDragStart={(e) => { dragItem.current = index; }}
                        onDragEnter={(e) => { dragOverItem.current = index; e.preventDefault(); }}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDragEnd={handleSort}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '12px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.05)',
                            cursor: 'grab'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.3)', cursor: 'grab' }}>☰</span>
                            <span style={{ fontSize: '1rem', fontWeight: 500 }}>{cat.name}</span>
                        </div>
                        <button
                            onClick={() => onDelete(cat.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem' }}
                        >
                            삭제
                        </button>
                    </div>
                ))}
            </div>
            <p style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>항목을 드래그 앤 드롭하여 순서를 변경할 수 있습니다.</p>
        </div>
    );
};

export default function SystemSettings() {
    const [expenseCategories, setExpenseCategories] = useState([]);
    const [investmentCategories, setInvestmentCategories] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);

    const [newExpenseCat, setNewExpenseCat] = useState('');
    const [newInvestmentCat, setNewInvestmentCat] = useState('');
    const [newPaymentMethod, setNewPaymentMethod] = useState('');

    const fetchCategories = async () => {
        try {
            const expRes = await fetch('/api/settings/categories?type=EXPENSE');
            const expData = await expRes.json();
            setExpenseCategories(expData);

            const invRes = await fetch('/api/settings/categories?type=INVESTMENT');
            const invData = await invRes.json();
            setInvestmentCategories(invData);

            const payRes = await fetch('/api/settings/categories?type=PAYMENT_METHOD');
            const payData = await payRes.json();
            setPaymentMethods(payData);
        } catch (error) {
            console.error("카테고리 불러오기 실패:", error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    const handleAddCategory = async (type, name, setter) => {
        if (!name.trim()) return;
        try {
            const res = await fetch('/api/settings/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, name: name.trim() })
            });
            if (res.ok) {
                setter('');
                fetchCategories();
            } else {
                alert("카테고리 추가에 실패했습니다.");
            }
        } catch (e) {
            console.error(e);
            alert("오류가 발생했습니다.");
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("정말 이 카테고리를 삭제하시겠습니까? (기존 내역의 텍스트는 유지됩니다)")) return;
        try {
            const res = await fetch(`/api/settings/categories/${id}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                fetchCategories();
            } else {
                alert("삭제에 실패했습니다.");
            }
        } catch (e) {
            console.error(e);
            alert("오류가 발생했습니다.");
        }
    };

    const handleReorderCategory = async (type, newItems) => {
        // Optimistic UI Update
        if (type === 'EXPENSE') setExpenseCategories(newItems);
        else if (type === 'INVESTMENT') setInvestmentCategories(newItems);
        else if (type === 'PAYMENT_METHOD') setPaymentMethods(newItems);

        // Prepare items array for backend (id, new sort_order)
        const payload = newItems.map((item, index) => ({
            id: item.id,
            sort_order: index + 1 // 1-based index
        }));

        try {
            const res = await fetch('/api/settings/categories/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: payload })
            });
            if (!res.ok) {
                alert("순서 저장에 실패했습니다.");
                fetchCategories(); // Revert back to original DB state on failure
            }
        } catch (e) {
            console.error(e);
            alert("순서 저장 중 오류가 발생했습니다.");
            fetchCategories();
        }
    };

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
                <h1 className="text-gradient">시스템 설정</h1>
                <p style={{ color: 'var(--text-muted)' }}>앱에서 공통으로 사용되는 분류 항목 코드를 관리합니다.</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
                <CategoryList
                    title="지출 내역 분류"
                    data={expenseCategories}
                    type="EXPENSE"
                    newValue={newExpenseCat}
                    setNewValue={setNewExpenseCat}
                    onAdd={handleAddCategory}
                    onDelete={handleDeleteCategory}
                    onReorder={handleReorderCategory}
                />
                <CategoryList
                    title="투자 코어 자산 분류"
                    data={investmentCategories}
                    type="INVESTMENT"
                    newValue={newInvestmentCat}
                    setNewValue={setNewInvestmentCat}
                    onAdd={handleAddCategory}
                    onDelete={handleDeleteCategory}
                    onReorder={handleReorderCategory}
                />
                <CategoryList
                    title="결제수단 (사용) 분류"
                    data={paymentMethods}
                    type="PAYMENT_METHOD"
                    newValue={newPaymentMethod}
                    setNewValue={setNewPaymentMethod}
                    onAdd={handleAddCategory}
                    onDelete={handleDeleteCategory}
                    onReorder={handleReorderCategory}
                />
            </div>
        </div>
    );
}
