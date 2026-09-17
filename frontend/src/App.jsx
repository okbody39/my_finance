import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/AccountManagement';
import TransactionManagement from './pages/TransactionManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import InvestmentManagement from './pages/InvestmentManagement';
import SystemSettings from './pages/SystemSettings';
import Login from './pages/Login';
import { AUTH_EXPIRED_EVENT } from './utils/auth';

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
      <div className="app-container">
        <Sidebar user={auth.user} onLogout={handleLogout} />
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
    </Router>
  );
}

export default App;
