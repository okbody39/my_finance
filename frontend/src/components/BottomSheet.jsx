import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// 모바일용 하단 시트: 배경 탭 / Esc / 닫기 버튼으로 닫힘
export default function BottomSheet({ open, title, onClose, children }) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onCloseRef.current();
        };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = prevOverflow;
            window.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    if (!open) return null;

    return createPortal(
        <div className="sheet-root">
            <div className="sheet-backdrop" onClick={onClose} />
            <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
                <div className="sheet-header">
                    <h2>{title}</h2>
                    <button type="button" className="icon-button" onClick={onClose} aria-label="닫기">
                        <X size={22} />
                    </button>
                </div>
                <div className="sheet-body">{children}</div>
            </div>
        </div>,
        document.body
    );
}
