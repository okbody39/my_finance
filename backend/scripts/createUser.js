// 사용자 생성 / 비밀번호 변경
// 사용법: printf '%s' '<비밀번호>' | node scripts/createUser.js <아이디>
// 비밀번호는 셸 히스토리와 저장소에 남지 않도록 표준입력으로만 받는다.
const { upsertUser } = require('../services/authService');

const username = (process.argv[2] || '').trim();
if (!username) {
    console.error("사용법: printf '%s' '<비밀번호>' | node scripts/createUser.js <아이디>");
    process.exit(1);
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', () => {
    const password = input.replace(/\r?\n$/, '');
    if (password.length < 8) {
        console.error('비밀번호는 8자 이상이어야 합니다.');
        process.exit(1);
    }
    const result = upsertUser(username, password);
    console.log(`사용자 '${username}' ${result === 'created' ? '생성' : '비밀번호 변경'} 완료`);
});
