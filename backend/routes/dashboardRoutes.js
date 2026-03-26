const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 1. 통합 대시보드 통계 조회 (자산 현황 및 현금흐름)
router.get('/summary', (req, res) => {
    try {
        const targetYear = req.query.year || new Date().getFullYear();

        // 1-1. 현금성 자산 (통장 잔액 합산)
        const cashResult = db.prepare("SELECT SUM(balance) as total_cash FROM accounts WHERE include_in_stats = 1").get();

        // 1-2. 투자 자산 (투자 가치 합산)
        const investResult = db.prepare("SELECT SUM(current_value) as total_invest FROM investments").get();
        const investmentDetails = db.prepare("SELECT type as name, SUM(current_value) as value FROM investments GROUP BY type").all();

        // 1-3. 연간 월별 데이터 집계
        const monthlyQuery = `
            SELECT 
                CAST(CASE WHEN strftime('%d', t.date) < '20' THEN strftime('%m', date(t.date, '-1 month')) ELSE strftime('%m', t.date) END AS INTEGER) as month,
                SUM(t.income) as income,
                SUM(CASE WHEN t.store LIKE '투자%' THEN 0 ELSE t.expense END) as expense,
                SUM(CASE WHEN t.store LIKE '투자%' THEN t.expense ELSE 0 END) as investment
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE (a.include_in_stats = 1 OR t.account_id IS NULL)
              AND t.period = '실행'
              AND CASE WHEN strftime('%d', t.date) < '20' THEN strftime('%Y', date(t.date, '-1 month')) ELSE strftime('%Y', t.date) END = ?
            GROUP BY month
            ORDER BY month ASC
        `;

        const monthlyStatsRaw = db.prepare(monthlyQuery).all(String(targetYear));

        const monthlyStats = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            income: 0,
            expense: 0,
            investment: 0
        }));

        let cumulativeIncome = 0;
        let cumulativeExpense = 0;
        let cumulativeInvestment = 0;

        monthlyStatsRaw.forEach(stat => {
            const mIndex = stat.month - 1;
            if (monthlyStats[mIndex]) {
                monthlyStats[mIndex].income = stat.income || 0;
                monthlyStats[mIndex].expense = stat.expense || 0;
                monthlyStats[mIndex].investment = stat.investment || 0;
                cumulativeIncome += (stat.income || 0);
                cumulativeExpense += (stat.expense || 0);
                cumulativeInvestment += (stat.investment || 0);
            }
        });

        const today = new Date();
        let salaryYear = today.getFullYear();
        let salaryMonth = today.getMonth() + 1;
        if (today.getDate() < 20) {
            salaryMonth -= 1;
            if (salaryMonth === 0) {
                salaryMonth = 12;
                salaryYear -= 1;
            }
        }

        // 1-4. 지출 분류 통계 (파이 차트 용 - 해당 년도 기준)
        const expenseCategoryQuery = `
            SELECT 
                usage_category as name,
                SUM(t.expense) as value
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE (a.include_in_stats = 1 OR t.account_id IS NULL)
              AND t.period = '실행'
              AND t.expense > 0
              AND t.usage_category IS NOT NULL
              AND t.usage_category != ''
              AND CASE WHEN strftime('%d', t.date) < '20' THEN strftime('%Y', date(t.date, '-1 month')) ELSE strftime('%Y', t.date) END = ?
            GROUP BY usage_category
            ORDER BY value DESC
        `;
        const expenseDetails = db.prepare(expenseCategoryQuery).all(String(targetYear));

        // 1-5. 지출 분류 통계 (당월 기준)
        const targetYearMonth = `${salaryYear}-${String(salaryMonth).padStart(2, '0')}`;
        const monthlyExpenseCategoryQuery = `
            SELECT 
                usage_category as name,
                SUM(t.expense) as value
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.id
            WHERE (a.include_in_stats = 1 OR t.account_id IS NULL)
              AND t.period = '실행'
              AND t.expense > 0
              AND t.usage_category IS NOT NULL
              AND t.usage_category != ''
              AND CASE WHEN strftime('%d', t.date) < '20' THEN strftime('%Y-%m', date(t.date, '-1 month')) ELSE strftime('%Y-%m', t.date) END = ?
            GROUP BY usage_category
            ORDER BY value DESC
        `;
        const monthlyExpenseDetails = db.prepare(monthlyExpenseCategoryQuery).all(targetYearMonth);

        res.json({
            netWorth: (cashResult.total_cash || 0) + (investResult.total_invest || 0),
            totalCash: cashResult.total_cash || 0,
            totalInvestments: investResult.total_invest || 0,
            cumulativeIncome,
            cumulativeExpense,
            cumulativeInvestment,
            monthlyStats,
            investmentDetails,
            expenseDetails,
            monthlyExpenseDetails,
            currentSalaryYear: salaryYear,
            currentSalaryMonth: salaryMonth
        });
    } catch (error) {
        console.error('Error dashboard summary:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard summary' });
    }
});

// 2. 시장 주요 지수/지표 (S&P500, KOSPI, USD/KRW, Gold) 조회
let marketCache = { data: null, lastFetched: 0 };
router.get('/market', async (req, res) => {
    try {
        const now = Date.now();
        // 1분(60000ms) 데이터 캐싱
        if (marketCache.data && now - marketCache.lastFetched < 60000) {
            return res.json(marketCache.data);
        }

        const symbols = ['^GSPC', '^KS11', 'KRW=X', 'GC=F'];
        const results = await Promise.all(symbols.map(async (symbol) => {
            try {
                // Node 18+ 에 내장된 fetch 사용
                const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const data = await response.json();
                
                const result = data.chart.result[0];
                const meta = result.meta;
                
                const currentPrice = meta.regularMarketPrice;
                const previousClose = meta.chartPreviousClose;
                
                let changePercent = 0;
                let changeAmount = 0;
                if (currentPrice && previousClose) {
                    changeAmount = currentPrice - previousClose;
                    changePercent = (changeAmount / previousClose) * 100;
                }

                let name = symbol;
                if (symbol === '^GSPC') name = 'S&P 500';
                else if (symbol === '^KS11') name = 'KOSPI';
                else if (symbol === 'KRW=X') name = 'USD/KRW';
                else if (symbol === 'GC=F') name = 'Gold (Ounce)';

                return {
                    symbol,
                    name,
                    price: currentPrice,
                    change: changeAmount,
                    changePercent: changePercent,
                    currency: meta.currency
                };
            } catch (err) {
                console.error(`[Market Data] Error fetching ${symbol}:`, err.message);
                
                let name = symbol;
                if (symbol === '^GSPC') name = 'S&P 500';
                else if (symbol === '^KS11') name = 'KOSPI';
                else if (symbol === 'KRW=X') name = 'USD/KRW';
                else if (symbol === 'GC=F') name = 'Gold (Ounce)';

                return { symbol, name, error: true };
            }
        }));

        marketCache = { data: results, lastFetched: now };
        res.json(results);
    } catch (error) {
        console.error('Error fetching market data:', error);
        res.status(500).json({ error: 'Failed to fetch market data' });
    }
});

// 2-1. 특정 종목 주가 동적 조회 (KOSPI 등)
let customStockCache = {};
router.get('/stock/:symbol', async (req, res) => {
    try {
        let symbol = req.params.symbol;
        if (!symbol.includes('.')) {
            symbol = `${symbol}.KS`; 
        }

        const now = Date.now();
        if (customStockCache[symbol] && now - customStockCache[symbol].lastFetched < 60000) {
            return res.json(customStockCache[symbol].data);
        }

        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const result = data.chart.result[0];
        const currentPrice = result.meta.regularMarketPrice;

        const responseData = { symbol, price: currentPrice };
        customStockCache[symbol] = { data: responseData, lastFetched: now };
        
        res.json(responseData);
    } catch (error) {
        console.error(`[Stock Data] Error fetching ${req.params.symbol}:`, error.message);
        res.status(500).json({ error: 'Failed to fetch stock data' });
    }
});

// 2-2. 특종 종목 주가 EMA (지수이동평균) 계산 조회
let customEmaCache = {};
router.get('/stock/:symbol/ema/:period', async (req, res) => {
    try {
        let symbol = req.params.symbol;
        if (!symbol.includes('.')) {
            symbol = `${symbol}.KS`; 
        }
        const period = parseInt(req.params.period, 10);
        if (isNaN(period) || period <= 0) {
            return res.status(400).json({ error: 'Invalid period' });
        }

        const cacheKey = `${symbol}_${period}`;
        const now = Date.now();
        if (customEmaCache[cacheKey] && now - customEmaCache[cacheKey].lastFetched < 60000) {
            return res.json(customEmaCache[cacheKey].data);
        }

        // 2 years range to have enough data for EMA calculation
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const result = data.chart.result[0];
        const closePrices = result.indicators.quote[0].close.filter(p => p !== null && !isNaN(p));

        if (closePrices.length < period) {
            return res.status(400).json({ error: 'Not enough data points to calculate EMA' });
        }

        const k = 2 / (period + 1);
        
        // Initial SMA as the first EMA value
        let sum = 0;
        for (let i = 0; i < period; i++) sum += closePrices[i];
        let ema = sum / period;

        // Calculate EMA for the rest of the days
        for (let i = period; i < closePrices.length; i++) {
            ema = (closePrices[i] * k) + (ema * (1 - k));
        }

        const responseData = { symbol, period, ema };
        customEmaCache[cacheKey] = { data: responseData, lastFetched: now };
        
        res.json(responseData);
    } catch (error) {
        console.error(`[Stock EMA Data] Error fetching ${req.params.symbol}:`, error.message);
        res.status(500).json({ error: 'Failed to calculate EMA data' });
    }
});

// 3. 커스텀 카드 목록 조회
router.get('/custom-cards', (req, res) => {
    try {
        const sortedCards = db.prepare('SELECT * FROM custom_cards ORDER BY layout_order ASC').all();
        res.json(sortedCards);
    } catch (error) {
        console.error('Error fetching custom cards:', error);
        res.status(500).json({ error: 'Failed to fetch custom cards' });
    }
});

// 4. 커스텀 카드 생성
router.post('/custom-cards', (req, res) => {
    const { title, formula, goal_operator, goal_value } = req.body;
    
    if (!title || !formula) {
        return res.status(400).json({ error: 'Title and formula are required' });
    }
    
    try {
        const maxOrderResult = db.prepare('SELECT MAX(layout_order) as maxOrder FROM custom_cards').get();
        const nextOrder = (maxOrderResult.maxOrder || 0) + 1;
        
        const stmt = db.prepare('INSERT INTO custom_cards (title, formula, layout_order, goal_operator, goal_value) VALUES (?, ?, ?, ?, ?)');
        const result = stmt.run(title, formula, nextOrder, goal_operator || null, goal_value !== undefined && goal_value !== '' ? String(goal_value) : null);
        
        res.status(201).json({ 
            id: result.lastInsertRowid,
            title,
            formula,
            layout_order: nextOrder,
            goal_operator: goal_operator || null,
            goal_value: goal_value !== undefined && goal_value !== '' ? String(goal_value) : null
        });
    } catch (error) {
        console.error('Error creating custom card:', error);
        res.status(500).json({ error: 'Failed to create custom card' });
    }
});

// 5. 커스텀 카드 위치 및 정보 수정 (Bulk & 개별)
router.put('/custom-cards', (req, res) => {
    const { cards } = req.body; // 배열 형태로 id, title, formula, layout_order 전달
    
    if (!Array.isArray(cards)) {
        return res.status(400).json({ error: 'Payload must contain a "cards" array' });
    }
    
    try {
        const updateStmt = db.prepare('UPDATE custom_cards SET title = COALESCE(?, title), formula = COALESCE(?, formula), layout_order = COALESCE(?, layout_order), goal_operator = COALESCE(?, goal_operator), goal_value = COALESCE(?, goal_value) WHERE id = ?');
        
        const updateAll = db.transaction((cardList) => {
            for (const card of cardList) {
                updateStmt.run(card.title, card.formula, card.layout_order, card.goal_operator, card.goal_value, card.id);
            }
        });
        
        updateAll(cards);
        res.json({ success: true, message: 'Custom cards updated successfully' });
    } catch (error) {
        console.error('Error updating custom cards:', error);
        res.status(500).json({ error: 'Failed to update custom cards' });
    }
});

// 6. 커스텀 카드 삭제
router.delete('/custom-cards/:id', (req, res) => {
    const cardId = req.params.id;
    try {
        db.prepare('DELETE FROM custom_cards WHERE id = ?').run(cardId);
        res.json({ success: true, message: 'Custom card deleted successfully' });
    } catch (error) {
        console.error('Error deleting custom card:', error);
        res.status(500).json({ error: 'Failed to delete custom card' });
    }
});

module.exports = router;
