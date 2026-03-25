const fetch = require('node-fetch');

async function testEMA(symbol, period) {
    try {
        const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=2y`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        
        const closePrices = data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
        
        if (closePrices.length < period) {
            console.log("Not enough data points");
            return;
        }

        // Calculate EMA
        const k = 2 / (period + 1);
        let ema = closePrices[0]; // Start with SMA or first price. First price is common.
        
        // Better: Start with SMA of first 'period' days
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += closePrices[i];
        }
        ema = sum / period;

        for (let i = period; i < closePrices.length; i++) {
            ema = (closePrices[i] * k) + (ema * (1 - k));
        }

        console.log(`EMA ${period} for ${symbol} is ${ema}`);
    } catch (e) {
        console.error(e);
    }
}

testEMA('005930.KS', 120);
testEMA('005930.KS', 60);
testEMA('005930.KS', 5);
