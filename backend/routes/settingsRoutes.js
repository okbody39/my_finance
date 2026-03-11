const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 1. 특정 타입의 카테고리 목록 조회
router.get('/categories', (req, res) => {
    const { type } = req.query; // 'EXPENSE' or 'INVESTMENT'
    try {
        let query = 'SELECT * FROM categories WHERE is_active = 1';
        let params = [];
        if (type) {
            query += ' AND type = ?';
            params.push(type);
        }
        query += ' ORDER BY sort_order ASC, id ASC';

        const categories = db.prepare(query).all(...params);
        res.json(categories);
    } catch (err) {
        console.error("카테고리 조회 에러:", err);
        res.status(500).json({ error: '카테고리 목록 조회 실패' });
    }
});

// 2. 카테고리 추가
router.post('/categories', (req, res) => {
    const { type, name } = req.body;
    if (!type || !name) {
        return res.status(400).json({ error: '타입(type)과 이름(name)을 모두 입력해주세요.' });
    }

    try {
        const stmtMax = db.prepare('SELECT MAX(sort_order) as maxOrder FROM categories WHERE type = ?');
        const maxRes = stmtMax.get(type);
        const nextOrder = (maxRes.maxOrder || 0) + 1;

        const stmt = db.prepare('INSERT INTO categories (type, name, sort_order) VALUES (?, ?, ?)');
        const info = stmt.run(type, name, nextOrder);
        res.status(201).json({ id: info.lastInsertRowid, type, name, is_active: 1, sort_order: nextOrder });
    } catch (err) {
        console.error("카테고리 추가 에러:", err);
        res.status(500).json({ error: '카테고리 추가 실패' });
    }
});

// 카테고리 순서 일괄 변경
router.put('/categories/reorder', (req, res) => {
    // req.body = { items: [{id: 1, sort_order: 1}, {id: 2, sort_order: 2}, ...] }
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items 배열이 필요합니다.' });
    }

    try {
        const updateStmt = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?');
        const transaction = db.transaction((items) => {
            for (const item of items) {
                updateStmt.run(item.sort_order, item.id);
            }
        });
        transaction(items);
        res.json({ message: '순서가 성공적으로 변경되었습니다.' });
    } catch (err) {
        console.error("카테고리 순서 변경 에러:", err);
        res.status(500).json({ error: '순서 변경 실패' });
    }
});

// 3. 카테고리 수정 (이름 변경 또는 비활성화)
router.put('/categories/:id', (req, res) => {
    const { id } = req.params;
    const { name, is_active } = req.body;

    try {
        const current = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!current) {
            return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
        }

        const newName = name !== undefined ? name : current.name;
        const newIsActive = is_active !== undefined ? is_active : current.is_active;

        const stmt = db.prepare('UPDATE categories SET name = ?, is_active = ? WHERE id = ?');
        stmt.run(newName, newIsActive, id);

        res.json({ id: Number(id), type: current.type, name: newName, is_active: newIsActive });
    } catch (err) {
        console.error("카테고리 수정 에러:", err);
        res.status(500).json({ error: '카테고리 수정 실패' });
    }
});

// 4. 카테고리 삭제 (물리적 삭제)
router.delete('/categories/:id', (req, res) => {
    const { id } = req.params;

    try {
        // 관련된 트랜잭션이나 자산이 있는지 확인 (여기서는 단순히 삭제만 수행. 필요시 무결성 검사 추가 가능)
        // 일단은 삭제되더라도, 기존 트랜잭션의 텍스트 필드로 저장된 내용은 그대로 남으므로 큰 문제는 없습니다.
        const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
        const info = stmt.run(id);

        if (info.changes > 0) {
            res.json({ message: '카테고리가 삭제되었습니다.' });
        } else {
            res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
        }
    } catch (err) {
        console.error("카테고리 삭제 에러:", err);
        res.status(500).json({ error: '카테고리 삭제 실패' });
    }
});

module.exports = router;
