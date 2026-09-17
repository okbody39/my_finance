import React, { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, TrendingUp, Settings, Briefcase, CreditCard, LogOut, X } from 'lucide-react';
import classNames from 'classnames';

// 데스크톱에서는 고정 사이드바, 1024px 이하에서는 왼쪽에서 열리는 서랍 메뉴 (스타일은 index.css의 .sidebar)
const Sidebar = ({ user, onLogout, isOpen, onClose, onNavigate }) => {
    const closeButtonRef = useRef(null);

    useEffect(() => {
        if (isOpen) closeButtonRef.current?.focus();
    }, [isOpen]);

    return (
        <aside id="app-sidebar" className={classNames('sidebar', { 'is-open': isOpen })} aria-label="메뉴">
            <div className="sidebar-brand">
                <div>
                    <h1 className="brand-wordmark">월천 System</h1>
                    <p className="sidebar-tagline">Passive Income Auto-Pilot</p>
                </div>
                <button type="button" ref={closeButtonRef} className="icon-button sidebar-close" onClick={onClose} aria-label="메뉴 닫기">
                    <X size={22} />
                </button>
            </div>

            <nav className="sidebar-nav">
                <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="대시보드" onNavigate={onNavigate} />
                <NavItem to="/accounts" icon={<Wallet size={20} />} label="계좌 등록/관리" onNavigate={onNavigate} />
                <NavItem to="/transactions" icon={<TrendingUp size={20} />} label="입출금 내역" onNavigate={onNavigate} />
                <NavItem to="/expenses" icon={<CreditCard size={20} />} label="지출 내역" onNavigate={onNavigate} />
                <NavItem to="/investments" icon={<Briefcase size={20} />} label="투자 코어 자산" onNavigate={onNavigate} />
                <div className="sidebar-nav-spacer" />
                <NavItem to="/settings" icon={<Settings size={20} />} label="시스템 설정" onNavigate={onNavigate} />
            </nav>

            <div className="sidebar-footer">
                {user && <p className="sidebar-user">{user.username} 계정으로 로그인됨</p>}
                <button type="button" className="sidebar-logout" onClick={onLogout}>
                    <LogOut size={20} />
                    <span>로그아웃</span>
                </button>
            </div>
        </aside>
    );
};

const NavItem = ({ to, icon, label, onNavigate }) => {
    return (
        <NavLink
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => classNames('nav-link', { active: isActive })}
        >
            {icon}
            <span>{label}</span>
        </NavLink>
    );
};

export default Sidebar;
