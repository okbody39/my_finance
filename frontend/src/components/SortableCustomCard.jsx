import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Edit2, Trash2 } from 'lucide-react';

export function SortableCustomCard({ id, title, formula, evaluatedValue, goalOperator, rawGoalValue, evaluatedGoalValue, isEditingMode, onEdit, onDelete }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id.toString() });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative',
        zIndex: isDragging ? 2 : 1,
    };

    // 목표 달성 여부 체크
    let isGoalMet = false;
    if (goalOperator && evaluatedGoalValue !== null && evaluatedGoalValue !== undefined && typeof evaluatedValue === 'number' && !isNaN(evaluatedValue)) {
        if (goalOperator === '>') isGoalMet = evaluatedValue > evaluatedGoalValue;
        else if (goalOperator === '<') isGoalMet = evaluatedValue < evaluatedGoalValue;
        else if (goalOperator === '=') isGoalMet = evaluatedValue === evaluatedGoalValue;
    }

    const cardBgClass = isGoalMet ? "glass-panel hover-card goal-met-glow" : "glass-panel hover-card";
    const highlightStyle = isGoalMet ? { borderColor: '#10b981', boxShadow: '0 0 15px rgba(16, 185, 129, 0.2)' } : { border: '1px solid rgba(255,255,255,0.05)' };

    return (
        <div ref={setNodeRef} style={{ ...style, padding: '16px', display: 'flex', flexDirection: 'column', ...highlightStyle }} className={cardBgClass}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 500, margin: 0 }}>
                    {title}
                </h3>
                {isEditingMode && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button onClick={() => onEdit({id, title, formula, goalOperator, goalValue: rawGoalValue})} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }} title="수정">
                            <Edit2 size={16} />
                        </button>
                        <button onClick={() => onDelete(id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }} title="삭제">
                            <Trash2 size={16} />
                        </button>
                        <div {...attributes} {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', color: '#64748b' }}>
                            <GripVertical size={20} />
                        </div>
                    </div>
                )}
            </div>
            
            <div style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0', color: evaluatedValue === '수식 오류' ? '#ef4444' : '#f8fafc' }}>
                {typeof evaluatedValue === 'number' ? new Intl.NumberFormat('ko-KR').format(evaluatedValue) : evaluatedValue}
            </div>
            
            {goalOperator && evaluatedGoalValue !== null && evaluatedGoalValue !== undefined && (
                <div style={{ color: isGoalMet ? '#10b981' : '#64748b', fontSize: '0.85rem', marginTop: 'auto', fontWeight: 500 }}>
                    목표: {goalOperator} {typeof evaluatedGoalValue === 'number' ? new Intl.NumberFormat('ko-KR').format(evaluatedGoalValue) : evaluatedGoalValue}
                    {rawGoalValue !== evaluatedGoalValue.toString() && <span style={{fontSize: '0.75rem', marginLeft: '4px'}}>({rawGoalValue})</span>}
                </div>
            )}
            
            {isEditingMode && (
                <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: (goalOperator && evaluatedGoalValue !== null && evaluatedGoalValue !== undefined) ? '8px' : 'auto', wordBreak: 'break-all' }}>
                    수식: {formula}
                </div>
            )}
        </div>
    );
}
