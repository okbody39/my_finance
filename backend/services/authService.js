const crypto = require('crypto');
const db = require('../db/database');

const SESSION_COOKIE = 'wolcheon_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30일

// 비밀번호 해시: scrypt + 사용자별 랜덤 salt ("salt:hash" hex 문자열로 저장)
function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
    const [saltHex, hashHex] = (stored || '').split(':');
    if (!saltHex || !hashHex) return false;
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

// 아이디/비밀번호 확인 후 사용자 반환 (실패 시 null)
function authenticate(username, password) {
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return { id: user.id, username: user.username };
}

// 세션 생성: 원문 토큰은 쿠키로만 내려주고 DB에는 해시만 저장
function createSession(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(sha256(token), userId, Date.now() + SESSION_TTL_MS);
    return token;
}

function getSessionUser(token) {
    if (!token) return null;
    const row = db.prepare(`
        SELECT u.id, u.username, s.expires_at
        FROM sessions s JOIN users u ON s.user_id = u.id
        WHERE s.token_hash = ?
    `).get(sha256(token));
    if (!row || row.expires_at < Date.now()) return null;
    return { id: row.id, username: row.username };
}

function deleteSession(token) {
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

// 아이디가 없으면 생성, 있으면 비밀번호 변경 (기존 세션은 모두 로그아웃)
function upsertUser(username, password) {
    const passwordHash = hashPassword(password);
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, existing.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
        return 'updated';
    }
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
    return 'created';
}

function getSessionToken(req) {
    const cookies = (req.headers.cookie || '').split(';');
    for (const cookie of cookies) {
        const [name, ...rest] = cookie.trim().split('=');
        if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
    }
    return null;
}

// /api 요청 보호 미들웨어 (로그인하지 않았으면 401)
function requireAuth(req, res, next) {
    const user = getSessionUser(getSessionToken(req));
    if (!user) return res.status(401).json({ error: '로그인이 필요합니다.' });
    req.user = user;
    next();
}

module.exports = {
    SESSION_COOKIE,
    SESSION_TTL_MS,
    authenticate,
    createSession,
    getSessionUser,
    deleteSession,
    upsertUser,
    getSessionToken,
    requireAuth,
};
