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
      payment_method TEXT,         -- 결제수단 (사용)
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
      type TEXT NOT NULL,          -- 'EXPENSE' or 'INVESTMENT' or 'PAYMENT_METHOD'
      name TEXT NOT NULL,          -- 카테고리명
      is_active BOOLEAN DEFAULT 1, -- 활성화 여부
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS custom_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      formula TEXT NOT NULL,
      layout_order INTEGER DEFAULT 0,
      goal_operator TEXT,
      goal_value TEXT
    );
  `;

  db.exec(initScript);

  try {
    db.exec("ALTER TABLE custom_cards ADD COLUMN goal_operator TEXT");
    db.exec("ALTER TABLE custom_cards ADD COLUMN goal_value TEXT");
    console.log("Migration: Added goal_operator and goal_value to custom_cards");
  } catch (err) {
    // Columns might already exist, safe to ignore
  }

  try {
    db.exec("ALTER TABLE transactions ADD COLUMN payment_method TEXT");
    console.log("Migration: Added payment_method to transactions");
  } catch (err) {
    // Column might already exist
  }

  try {
    db.exec("ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0");
    console.log("Migration: Added sort_order to categories");
  } catch (err) {
    // Column might already exist
  }

  console.log("Database tables initialized successfully.");

  // 초기 카테고리 데이터 세팅 (Seed)
  const stmtCheck = db.prepare('SELECT COUNT(*) as count FROM categories');
  const countRes = stmtCheck.get();
  const insertStmt = db.prepare('INSERT INTO categories (type, name, sort_order) VALUES (?, ?, ?)');

  if (countRes.count === 0) {
    const initialExpenseCategories = ["쇼핑", "식비", "여가", "기타"];
    const initialInvestmentCategories = ["예금", "적금", "주식", "펀드", "부동산", "코인", "기타"];

    const initCategories = db.transaction(() => {
      initialExpenseCategories.forEach((cat, idx) => insertStmt.run('EXPENSE', cat, idx + 1));
      initialInvestmentCategories.forEach((cat, idx) => insertStmt.run('INVESTMENT', cat, idx + 1));
    });

    initCategories();
    console.log("Initial categories seeded successfully.");
  }

  const paymentMethodCount = db.prepare("SELECT COUNT(*) as count FROM categories WHERE type = 'PAYMENT_METHOD'").get();
  if (paymentMethodCount.count === 0) {
    const initialPaymentMethods = ["토카", "토이", "우카"];
    const initPaymentMethods = db.transaction(() => {
      initialPaymentMethods.forEach((cat, idx) => insertStmt.run('PAYMENT_METHOD', cat, idx + 1));
    });

    initPaymentMethods();
    console.log("Initial payment methods seeded successfully.");
  }
}

initializeDatabase();

module.exports = db;
