export const AUTH_EXPIRED_EVENT = 'auth:expired';

// 세션 만료 등으로 API가 401을 반환하면 이벤트를 발생시켜 App이 로그인 화면으로 전환하게 한다.
// 각 페이지가 fetch를 직접 호출하므로 전역 fetch를 한 번 감싼다.
export function installAuthExpiredHandler() {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const res = await originalFetch(input, init);
        const url = input instanceof Request ? input.url : String(input);
        if (res.status === 401 && !url.includes('/api/auth/')) {
            window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
        }
        return res;
    };
}
