import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import AccountManagement from './pages/AccountManagement';
import TransactionManagement from './pages/TransactionManagement';
import ExpenseManagement from './pages/ExpenseManagement';
import InvestmentManagement from './pages/InvestmentManagement';
import SystemSettings from './pages/SystemSettings';

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar />
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
