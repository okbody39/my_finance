require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/accounts', require('./routes/accountRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/investments', require('./routes/investmentRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));

// SMS Webhook 대체 (로컬 동기화 수동 트리거 버튼용)
app.post('/api/sync-sms', (req, res) => {
    const { syncWooriCardTransactions } = require('./services/smsSyncService');
    const result = syncWooriCardTransactions();
    res.json(result);
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '월천 (Wolcheon) API Server is running' });
});

// Serve static files from the frontend react app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// [신규 추가] 등록되지 않은 API 요청은 404 JSON 반환
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// (Express 최신 버전 호환을 위해 '*' 대신 정규식 /(.*)/ 사용)
// app.get(/(.*)/, (req, res) => {
//     res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
// });

app.use((req, res) => {
    // res.sendFile(path.join(clientBuildPath, 'index.html'));
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
