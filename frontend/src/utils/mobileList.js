const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 거래 목록을 날짜(YYYY-MM-DD)별로 묶는다. 입력 순서를 유지한다.
export function groupByDate(transactions) {
    const groups = [];
    for (const tx of transactions) {
        const date = tx.date.split(' ')[0];
        const last = groups[groups.length - 1];
        if (last && last.date === date) last.items.push(tx);
        else groups.push({ date, items: [tx] });
    }
    return groups;
}

// '2026-08-20' -> '2026년 8월 20일 (목)'
export function formatDateHeading(dateString) {
    const [y, m, d] = dateString.split('-').map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return `${y}년 ${m}월 ${d}일 (${DAYS[day]})`;
}
