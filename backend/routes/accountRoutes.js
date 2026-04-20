const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 1. 모든 계좌 조회
router.get('/', (req, res) => {
    try {
        const accounts = db.prepare('SELECT * FROM accounts ORDER BY purpose, bank_name').all();
        res.json(accounts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// 2. 새로운 계좌/카드 생성
router.post('/', (req, res) => {
    const { purpose, bank_name, account_number, password, include_in_stats } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO accounts (purpose, bank_name, account_number, password, balance, include_in_stats) VALUES (?, ?, ?, ?, 0, ?)');
        const statFlag = include_in_stats !== undefined ? (include_in_stats ? 1 : 0) : 1;
        const info = stmt.run(purpose, bank_name, account_number || '', password || '', statFlag);
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Account creation error:', error);
        res.status(500).json({ error: 'Failed to create account', details: error.message });
    }
});

// 3. 계좌 수정
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { purpose, bank_name, account_number, password, include_in_stats } = req.body;
    try {
        const statFlag = include_in_stats !== undefined ? (include_in_stats ? 1 : 0) : 1;
        const stmt = db.prepare(`
            UPDATE accounts 
            SET purpose = ?, bank_name = ?, account_number = ?, password = ?, balance = 0, include_in_stats = ?
            WHERE id = ?
        `);
        stmt.run(purpose, bank_name, account_number || '', password || '', statFlag, id);
        res.json({ success: true });
    } catch (error) {
        console.error('Account update error:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

// 4. 계좌 삭제
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

module.exports = router;
