import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockOn, setCapsLockOn] = useState(false);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username.trim() || !password) {
            setError('아이디와 비밀번호를 입력해주세요.');
            return;
        }

        setIsSubmitting(true);
        setError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || '로그인에 실패했습니다.');
                setPassword('');
                return;
            }
            onLogin(data.user);
        } catch (err) {
            console.error(err);
            setError('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePasswordKey = (e) => setCapsLockOn(e.getModifierState('CapsLock'));

    return (
        <div className="login-page">
            <div className="login-shell">
                <div className="login-brand">
                    <h1 className="login-wordmark">월천 System</h1>
                    <p className="login-tagline">Passive Income Auto-Pilot</p>
                </div>

                <form className="login-card" onSubmit={handleSubmit} noValidate>
                    <h2 className="login-title">로그인</h2>

                    <div className="login-field">
                        <label htmlFor="login-username">아이디</label>
                        <input
                            id="login-username"
                            type="text"
                            className="login-input"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            autoComplete="username"
                            autoCapitalize="none"
                            spellCheck={false}
                            autoFocus
                        />
                    </div>

                    <div className="login-field">
                        <label htmlFor="login-password">비밀번호</label>
                        <div className="login-password">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                className="login-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={handlePasswordKey}
                                onKeyUp={handlePasswordKey}
                                autoComplete="current-password"
                                aria-describedby={capsLockOn ? 'login-capslock' : undefined}
                            />
                            <button
                                type="button"
                                className="login-reveal"
                                onClick={() => setShowPassword(v => !v)}
                                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                                aria-pressed={showPassword}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {capsLockOn && <p id="login-capslock" className="login-hint">Caps Lock이 켜져 있습니다.</p>}
                    </div>

                    {error && <p className="login-error" role="alert">{error}</p>}

                    <button type="submit" className="btn btn-primary login-submit" disabled={isSubmitting}>
                        {isSubmitting ? '로그인 중…' : '로그인'}
                    </button>
                </form>
            </div>
        </div>
    );
}
