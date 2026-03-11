const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const wolcheonDb = require('../db/database'); // 우리 월천 시스템 메인 DB

// Mac iMessage 로컬 DB 경로
const macChatDbPath = path.join(os.homedir(), 'Library/Messages/chat.db');

/**
 * 우리카드 결제 내역을 Mac 로컬 iMessage DB에서 추출하고
 * 월천 시스템의 DB(transactions)에 동기화합니다.
 */
function syncWooriCardTransactions() {
    console.log('--- SMS 동기화: 우리카드 스캔 시작 ---');
    let chatDb;

    try {
        chatDb = new Database(macChatDbPath, { readonly: true, fileMustExist: true });
    } catch (error) {
        console.error('❌ Mac Messages DB 접근 실패: 터미널의 [전체 디스크 접근 권한]을 확인해주세요.', error.message);
        return { success: false, message: 'Mac Messages DB 접근 권한이 없습니다.' };
    }

    // 사용자가 제공한 쿼리 로직
    const query = `
      SELECT
          datetime(message.date / 1000000000 + 978307200, 'unixepoch', 'localtime') as receive_time,
          handle.id as phone_number,
          message.text,
          message.attributedBody
      FROM message
               LEFT JOIN handle ON message.handle_id = handle.ROWID
      WHERE handle.id LIKE '%1588%9955%'
         OR message.text LIKE '%우리(%승인%'
         OR CAST(message.attributedBody AS TEXT) LIKE '%우리(%승인%'
      ORDER BY message.date DESC
          LIMIT 200;
  `;

    const rows = chatDb.prepare(query).all();
    const results = [];
    let addedCount = 0;

    rows.forEach(row => {
        let content = row.text;

        // 바이너리 데이터 복원
        if (!content && row.attributedBody) {
            const rawString = row.attributedBody.toString('utf8');
            content = rawString.replace(/[\x00-\x1F\x7F]/g, '\n').replace(/\n+/g, '\n');
        }

        if (content && content.includes('우리(') && content.includes('승인')) {
            // 결제 금액 추출
            const amountMatch = content.match(/([0-9,]+)원/);
            const amount = amountMatch ? parseInt(amountMatch[1].replace(/,/g, ''), 10) : 0;

            // 가맹점 추출
            const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let store = '가맹점 정보 없음';

            for (let i = 0; i < lines.length; i++) {
                // '02/18 16:37' 날짜 형식 다음 줄이 가맹점명
                if (lines[i].match(/\d{2}\/\d{2}\s\d{2}:\d{2}/)) {
                    if (lines[i + 1]) {
                        store = lines[i + 1];
                    }
                    break;
                }
            }

            // 텍스트 클리닝 (특수 문자 등 제거)
            store = store.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim();
            const rawText = content.replace(/\n/g, ' ');

            // 이미 추가된 문자열인지 중복 체크
            const checkExist = wolcheonDb.prepare('SELECT id FROM transactions WHERE raw_sms = ?').get(rawText);

            if (!checkExist && amount > 0) {
                // 새 트랜잭션으로 저장 (지출로 처리)
                const insertStmt = wolcheonDb.prepare(`
          INSERT INTO transactions (date, amount, type, store, is_auto_synced, raw_sms) 
          VALUES (?, ?, '지출', ?, 1, ?)
        `);

                insertStmt.run(row.receive_time, amount, store, rawText);
                addedCount++;

                results.push({
                    receiveTime: row.receive_time,
                    amount: amount,
                    store: store,
                    rawText: rawText
                });
            }
        }
    });

    chatDb.close();

    console.log(`=== 동기화 완료: 총 ${results.length}건 확인, 신규 ${addedCount}건 추가됨 ===`);

    return {
        success: true,
        parsedCount: results.length,
        addedCount: addedCount
    };
}

module.exports = {
    syncWooriCardTransactions
};
