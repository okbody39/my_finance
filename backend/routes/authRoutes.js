const express = require('express');
const router = express.Router();
const auth = require('../services/authService');

// 로그인 실패 제한: 같은 IP에서 15분 내 10회 실패 시 잠금
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // ip -> { count, firstAt }

function isLocked(ip) {
    const entry = loginFailures.get(ip);
    if (!entry) return false;
    if (Date.now() - entry.firstAt > FAILURE_WINDOW_MS) {
        loginFailures.delete(ip);
        return false;
    }
    return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
    const entry = loginFailures.get(ip);
    if (!entry || Date.now() - entry.firstAt > FAILURE_WINDOW_MS) {
        loginFailures.set(ip, { count: 1, firstAt: Date.now() });
    } else {
        entry.count += 1;
    }
}

function cookieOptions(req) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return { httpOnly: true, sameSite: 'lax', secure: isHttps, path: '/' };
}

// 1. 로그인
router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) {
        return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    }
    if (isLocked(req.ip)) {
        return res.status(429).json({ error: '로그인 실패가 많아 잠시 잠겼습니다. 15분 후 다시 시도해주세요.' });
    }

    try {
        const user = auth.authenticate(String(username).trim(), String(password));
        if (!user) {
            recordFailure(req.ip);
            return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }

        loginFailures.delete(req.ip);
        const token = auth.createSession(user.id);
        res.cookie(auth.SESSION_COOKIE, token, { ...cookieOptions(req), maxAge: auth.SESSION_TTL_MS });
        res.json({ user });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).json({ error: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// 2. 로그아웃
router.post('/logout', (req, res) => {
    auth.deleteSession(auth.getSessionToken(req));
    res.clearCookie(auth.SESSION_COOKIE, cookieOptions(req));
    res.json({ success: true });
});

// 3. 현재 로그인 사용자
router.get('/me', (req, res) => {
    const user = auth.getSessionUser(auth.getSessionToken(req));
    if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    res.json({ user });
});

module.exports = router;
