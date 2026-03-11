const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 1. 모든 입출금 내역 조회
router.get('/', (req, res) => {
    try {
        const transactions = db.prepare(`
      SELECT t.*, a.purpose as account_name, a.bank_name 
      FROM transactions t 
      LEFT JOIN accounts a ON t.account_id = a.id
      ORDER BY t.date DESC
    `).all();
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// 1.5 자동 생성 (Auto-fill) 엔드포인트
router.post('/auto-fill', (req, res) => {
    const { account_id, year, month } = req.body;
    if (!account_id || !year || !month) return res.json({ success: false });

    try {
        for (let offset = 0; offset <= 2; offset++) {
            let targetM = month + offset;
            let targetY = year;
            while (targetM > 12) {
                targetM -= 12;
                targetY += 1;
            }

            let startD = `${targetY}-${String(targetM).padStart(2, '0')}-20`;
            let endM = targetM + 1;
            let endY = targetY;
            if (endM > 12) { endM -= 12; endY += 1; }
            let endD = `${endY}-${String(endM).padStart(2, '0')}-19`;

            const existing = db.prepare(`SELECT count(*) as cnt FROM transactions WHERE account_id = ? AND is_fixed = '고정' AND date >= ? AND date <= ?`).get(account_id, startD, endD);

            if (existing.cnt === 0) {
                const lastTx = db.prepare(`SELECT date FROM transactions WHERE account_id = ? AND is_fixed = '고정' AND date < ? ORDER BY date DESC LIMIT 1`).get(account_id, startD);

                if (lastTx) {
                    const d = new Date(lastTx.date);
                    let lY = d.getFullYear();
                    let lM = d.getMonth() + 1;
                    if (d.getDate() < 20) {
                        lM -= 1;
                        if (lM === 0) { lM = 12; lY -= 1; }
                    }

                    let lStart = `${lY}-${String(lM).padStart(2, '0')}-20`;
                    let lEndM = lM + 1;
                    let lEndY = lY;
                    if (lEndM > 12) { lEndM -= 12; lEndY += 1; }
                    let lEnd = `${lEndY}-${String(lEndM).padStart(2, '0')}-19`;

                    const sourceTxs = db.prepare(`SELECT * FROM transactions WHERE account_id = ? AND is_fixed = '고정' AND date >= ? AND date <= ?`).all(account_id, lStart, lEnd);

                    for (let tx of sourceTxs) {
                        let diffMonths = (targetY * 12 + targetM) - (lY * 12 + lM);
                        let sourceDate = new Date(tx.date);
                        sourceDate.setMonth(sourceDate.getMonth() + diffMonths);
                        let newDateStr = sourceDate.toISOString().split('T')[0];

                        db.prepare(`
                            INSERT INTO transactions (date, store, account_id, income, expense, note, period, is_fixed, usage_category, is_auto_synced) 
                            VALUES (?, ?, ?, ?, ?, ?, '예정', '고정', ?, 0)
                        `).run(newDateStr, tx.store, account_id, tx.income, tx.expense, tx.note, tx.usage_category);
                    }
                }
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error auto-filling transactions:', error);
        res.status(500).json({ error: 'Failed to auto-fill transactions' });
    }
});

// 2. 새로운 입출금 내역 추가 (수동 입력)
router.post('/', (req, res) => {
    const { date, store, account_id, income, expense, note, period, is_fixed, usage_category } = req.body;
    try {
        const stmt = db.prepare(`
      INSERT INTO transactions (date, store, account_id, income, expense, note, period, is_fixed, usage_category, is_auto_synced) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `);

        // Convert to integers/null safely
        const inc = income ? parseInt(income, 10) : 0;
        const exp = expense ? parseInt(expense, 10) : 0;
        const accId = account_id ? parseInt(account_id, 10) : null;
        const txPeriod = period || '실행';

        const info = stmt.run(date, store || '', accId, inc, exp, note || '', txPeriod, is_fixed || '', usage_category || '');

        // 계좌 잔액 업데이트 ('실행' 상태일 때만)
        if (accId && txPeriod === '실행') {
            if (exp > 0) {
                db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(exp, accId);
            }
            if (inc > 0) {
                db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(inc, accId);
            }
        }

        res.json({ success: true, id: info.lastInsertRowid });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ error: 'Failed to add transaction' });
    }
});

// 3. 입출금 내역 수정
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const { date, store, income, expense, note, period, is_fixed, usage_category } = req.body;

    try {
        // 기존 내역 조회
        const oldTx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!oldTx) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        const newInc = income ? parseInt(income, 10) : 0;
        const newExp = expense ? parseInt(expense, 10) : 0;
        const txPeriod = period || '실행';

        // 1) 기존 내역이 '실행' 상태였다면 계좌 잔액에서 롤백
        if (oldTx.account_id && oldTx.period === '실행') {
            if (oldTx.expense > 0) {
                db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(oldTx.expense, oldTx.account_id);
            }
            if (oldTx.income > 0) {
                db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(oldTx.income, oldTx.account_id);
            }
        }

        // 2) 트랜잭션 업데이트
        const updateStmt = db.prepare(`
            UPDATE transactions 
            SET date = ?, store = ?, income = ?, expense = ?, note = ?, period = ?, is_fixed = ?, usage_category = ?
            WHERE id = ?
        `);
        updateStmt.run(date, store || '', newInc, newExp, note || '', txPeriod, is_fixed || '', usage_category || '', id);

        // 3) 새로운 내역이 '실행' 상태라면 계좌 잔액에 다시 반영
        if (oldTx.account_id && txPeriod === '실행') {
            if (newExp > 0) {
                db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(newExp, oldTx.account_id);
            }
            if (newInc > 0) {
                db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(newInc, oldTx.account_id);
            }
        }

        res.json({ success: true, message: 'Transaction updated' });
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ error: 'Failed to update transaction' });
    }
});

// 4. 입출금 내역 삭제
router.delete('/:id', (req, res) => {
    const { id } = req.params;
    try {
        // 삭제 전 잔액 롤백 시도 ('실행' 상태였을 경우에만)
        const tx = db.prepare('SELECT income, expense, account_id, period FROM transactions WHERE id = ?').get(id);
        if (tx && tx.account_id && tx.period === '실행') {
            if (tx.expense > 0) {
                db.prepare('UPDATE accounts SET balance = balance + ? WHERE id = ?').run(tx.expense, tx.account_id);
            }
            if (tx.income > 0) {
                db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(tx.income, tx.account_id);
            }
        }

        const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
        stmt.run(id);
        res.json({ success: true, message: 'Transaction deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete transaction' });
    }
});

// 5. 대량의 지출 내역 CSV 추가
router.post('/bulk-csv', (req, res) => {
    const { account_id, transactions } = req.body;
    if (!Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const accId = account_id ? parseInt(account_id, 10) : null;

    try {
        const stmt = db.prepare(`
            INSERT INTO transactions (date, store, account_id, income, expense, note, period, is_fixed, usage_category, is_auto_synced) 
            VALUES (?, ?, ?, 0, ?, '', ?, ?, ?, 0)
        `);

        const insertMany = db.transaction((txs) => {
            let totalExpense = 0;
            for (const tx of txs) {
                const exp = parseInt(tx.expense, 10) || 0;
                stmt.run(
                    tx.date,
                    tx.store || '',
                    accId,
                    exp,
                    tx.period || '실행',
                    tx.is_fixed || '변동',
                    tx.usage_category || '기타'
                );

                if (tx.period === '실행' && exp > 0) {
                    totalExpense += exp;
                }
            }
            return totalExpense;
        });

        const totalExpense = insertMany(transactions);

        if (accId && totalExpense > 0) {
            db.prepare('UPDATE accounts SET balance = balance - ? WHERE id = ?').run(totalExpense, accId);
        }

        res.json({ success: true, count: transactions.length });
    } catch (error) {
        console.error('Error bulk inserting transactions:', error);
        res.status(500).json({ error: 'Failed to bulk insert transactions' });
    }
});

module.exports = router;
