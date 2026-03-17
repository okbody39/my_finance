const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.resolve(__dirname, 'wolcheon.db');
const db = new Database(dbPath, { verbose: console.log });

// 테이블 초기화 함수
function initializeDatabase() {
  const initScript = `
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purpose TEXT NOT NULL,       -- 용도 (예: 용돈, 월급 등)
      bank_name TEXT NOT NULL,     -- 은행 (예: 카뱅, 신한 등)
      account_number TEXT,         -- 계좌번호
      password TEXT,               -- 비번
      balance INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,          -- 날짜 (YYYY-MM-DD 형식 권장)
      store TEXT,                  -- 적요 (가맹점, 내용)
      account_id INTEGER,          -- 구분 (어느 계좌인지)
      income INTEGER DEFAULT 0,    -- 수입
      expense INTEGER DEFAULT 0,   -- 지출
      note TEXT,                   -- 비고
      period INTEGER,              -- 시기 (0, 1, 2 등)
      is_fixed TEXT,               -- 구분2 (고정, 변동 등)
      usage_category TEXT,         -- 용도
      is_auto_synced BOOLEAN DEFAULT 0,
      raw_sms TEXT,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- '부동산', '주식', '연금', 'ISA', '코인' 등
      current_value INTEGER DEFAULT 0,
      target_value INTEGER DEFAULT 0,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS scheduled_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day_of_month INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      category TEXT,
      description TEXT,
      account_id INTEGER,
      FOREIGN KEY (account_id) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,          -- 'EXPENSE' or 'INVESTMENT'
      name TEXT NOT NULL,          -- 카테고리명
      is_active BOOLEAN DEFAULT 1  -- 활성화 여부
    );

    CREATE TABLE IF NOT EXISTS custom_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      formula TEXT NOT NULL,
      layout_order INTEGER DEFAULT 0
    );
  `;

  db.exec(initScript);
  console.log("Database tables initialized successfully.");

  // 초기 카테고리 데이터 세팅 (Seed)
  const stmtCheck = db.prepare('SELECT COUNT(*) as count FROM categories');
  const countRes = stmtCheck.get();

  if (countRes.count === 0) {
    const insertStmt = db.prepare('INSERT INTO categories (type, name) VALUES (?, ?)');
    const initialExpenseCategories = ["쇼핑", "식비", "여가", "기타"];
    const initialInvestmentCategories = ["예금", "적금", "주식", "펀드", "부동산", "코인", "기타"];

    const initCategories = db.transaction(() => {
      for (const cat of initialExpenseCategories) {
        insertStmt.run('EXPENSE', cat);
      }
      for (const cat of initialInvestmentCategories) {
        insertStmt.run('INVESTMENT', cat);
      }
    });

    initCategories();
    console.log("Initial categories seeded successfully.");
  }
}

initializeDatabase();

module.exports = db;
