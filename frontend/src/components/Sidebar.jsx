import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Wallet, TrendingUp, Settings, Briefcase, CreditCard } from 'lucide-react';
import classNames from 'classnames';

// 사이드바 전용 스타일, 나중에 CSS Modules로 뺄 수도 있지만 index.css 연동을 위해 인라인/클래스 혼용
const Sidebar = () => {
    return (
        <aside style={{
            width: '260px',
            background: 'rgba(15, 17, 21, 0.8)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            padding: '32px 24px',
            display: 'flex',
            flexDirection: 'column',
            backdropFilter: 'blur(16px)'
        }}>
            <div style={{ marginBottom: '40px', paddingLeft: '12px' }}>
                <h1 style={{
                    fontSize: '1.75rem',
                    fontWeight: 800,
                    background: 'linear-gradient(90deg, #4f46e5, #38bdf8)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                }}>
                    월천 System
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
                    Passive Income Auto-Pilot
                </p>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="대시보드" />
                <NavItem to="/accounts" icon={<Wallet size={20} />} label="계좌 등록/관리" />
                <NavItem to="/transactions" icon={<TrendingUp size={20} />} label="입출금 내역" />
                <NavItem to="/expenses" icon={<CreditCard size={20} />} label="지출 내역" />
                <NavItem to="/investments" icon={<Briefcase size={20} />} label="투자 코어 자산" />
                <div style={{ flex: 1, minHeight: '40px' }} />
                <NavItem to="/settings" icon={<Settings size={20} />} label="시스템 설정" />
            </nav>
        </aside>
    );
};

const NavItem = ({ to, icon, label }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                classNames(
                    'nav-link',
                    isActive ? 'active' : ''
                )
            }
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                color: 'var(--text-muted)',
                textDecoration: 'none',
                fontWeight: 500,
                transition: 'all 0.2s',
            }}
        >
            {/* active state logic handled via external css or inline */}
            {icon}
            <span>{label}</span>
        </NavLink>
    );
};

export default Sidebar;
