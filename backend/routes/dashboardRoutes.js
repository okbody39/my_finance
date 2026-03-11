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
        // 5분(300000ms) 데이터 캐싱
        if (marketCache.data && now - marketCache.lastFetched < 300000) {
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

module.exports = router;
