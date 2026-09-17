import { useCallback, useSyncExternalStore } from 'react';

// index.css의 브레이크포인트와 맞춰야 한다
export const MOBILE_QUERY = '(max-width: 768px)';
export const LIST_LAYOUT_QUERY = '(max-width: 900px)'; // 표 대신 목록 + 입력 시트
export const COMPACT_NAV_QUERY = '(max-width: 1024px)';

export function useMediaQuery(query) {
    const subscribe = useCallback((onChange) => {
        const mql = window.matchMedia(query);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
export const useIsListLayout = () => useMediaQuery(LIST_LAYOUT_QUERY);
