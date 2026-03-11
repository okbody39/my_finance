const Database = require('better-sqlite3');
const db = new Database('./backend/database.sqlite');
console.log(db.prepare("SELECT * FROM investments WHERE name = 'Test Asset'").all());
