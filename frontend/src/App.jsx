import React, { useEffect, useRef, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/AccountManagement';
import TransactionManagement from './pages/TransactionManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import InvestmentManagement from './pages/InvestmentManagement';
import SystemSettings from './pages/SystemSettings';
import Login from './pages/Login';
import { AUTH_EXPIRED_EVENT } from './utils/auth';
import { COMPACT_NAV_QUERY, useMediaQuery } from './hooks/useMediaQuery';

function AppLayout({ user, onLogout }) {
  const [isNavOpen, setIsNavOpen] = useState(false);
  const isCompactNav = useMediaQuery(COMPACT_NAV_QUERY);
  const menuButtonRef = useRef(null);
  const navOpen = isCompactNav && isNavOpen;

  const closeNav = () => {
    setIsNavOpen(false);
    menuButtonRef.current?.focus();
  };

  // 서랍 메뉴가 열려 있는 동안 배경 스크롤 잠금 + Esc로 닫기
  useEffect(() => {
    if (!navOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setIsNavOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [navOpen]);

  return (
    <div className="app-container">
      <header className="mobile-topbar">
        <button
          type="button"
          ref={menuButtonRef}
          className="icon-button"
          onClick={() => setIsNavOpen(true)}
          aria-label="메뉴 열기"
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
        >
          <Menu size={24} />
        </button>
        <span className="brand-wordmark">월천 System</span>
      </header>

      <div className={`nav-backdrop${navOpen ? ' is-open' : ''}`} onClick={closeNav} />
      <Sidebar
        user={user}
        onLogout={onLogout}
        isOpen={navOpen}
        onClose={closeNav}
        onNavigate={() => setIsNavOpen(false)}
      />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<AccountManagement />} />
          <Route path="/transactions" element={<TransactionManagement />} />
          <Route path="/expenses" element={<ExpenseManagement />} />
          <Route path="/investments" element={<InvestmentManagement />} />
          <Route path="/settings" element={<SystemSettings />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  // checking: 세션 확인 중 / anonymous: 로그인 필요 / authenticated: 로그인됨
  const [auth, setAuth] = useState({ status: 'checking', user: null });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setAuth(data ? { status: 'authenticated', user: data.user } : { status: 'anonymous', user: null }))
      .catch(() => setAuth({ status: 'anonymous', user: null }));

    const handleExpired = () => setAuth({ status: 'anonymous', user: null });
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
    setAuth({ status: 'anonymous', user: null });
  };

  if (auth.status === 'checking') return null;
  if (auth.status === 'anonymous') {
    return <Login onLogin={user => setAuth({ status: 'authenticated', user })} />;
  }

  return (
    <Router>
      <AppLayout user={auth.user} onLogout={handleLogout} />
    </Router>
  );
}

export default App;
