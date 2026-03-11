const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 1. 모든 투자 자산 조회
router.get('/', (req, res) => {
    try {
        const investments = db.prepare('SELECT * FROM investments ORDER BY type, name').all();
        res.json(investments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch investments' });
    }
});

// 2. 새로운 투자 자산 생성
router.post('/', (req, res) => {
    const { name, type, current_value, target_value, description } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO investments (name, type, current_value, target_value, description) VALUES (?, ?, ?, ?, ?)');
        const info = stmt.run(name, type, current_value || 0, target_value || 0, description || '');
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create investment' });
    }
});

// 3. 투자 자산 가치 업데이트 (현재가 갱신 등)
router.patch('/:id/value', (req, res) => {
    const { id } = req.params;
    const { current_value } = req.body;
    try {
        db.prepare('UPDATE investments SET current_value = ? WHERE id = ?').run(current_value, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update investment value' });
    }
});

// 4. 투자 자산 전체 수정
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { name, type, current_value, target_value } = req.body;
    try {
        db.prepare('UPDATE investments SET name = ?, type = ?, current_value = ?, target_value = ? WHERE id = ?')
            .run(name, type, current_value || 0, target_value || 0, id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update investment' });
    }
});

// 5. 투자 자산 삭제
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('DELETE FROM investments WHERE id = ?').run(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete investment' });
    }
});

module.exports = router;
