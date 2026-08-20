require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'starlight',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Trả DATE về dạng chuỗi 'YYYY-MM-DD' — tránh lệch ngày khi server
  // và database khác múi giờ (Date -> toISOString từng làm lệch 1 ngày)
  dateStrings: true,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
});

// Frontend thường bỏ trống field không dùng -> undefined.
// mysql2 không nhận bind undefined nên quy về null cho mọi query.
const rawQuery = pool.query.bind(pool);
pool.query = function (sql, params) {
  if (Array.isArray(params)) {
    params = params.map(v => (v === undefined ? null : v));
  }
  return rawQuery(sql, params);
};

module.exports = pool;
