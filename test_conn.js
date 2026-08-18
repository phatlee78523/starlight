const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function test() {
  const opts = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  };
  
  console.log('Connecting to:', opts.host, 'port:', opts.port, 'user:', opts.user, 'pass:', opts.password);
  
  try {
    const conn = await mysql.createConnection(opts);
    console.log('✅ Connected!');
    const [rows] = await conn.query('SELECT 1 as test');
    console.log('Query result:', rows);
    await conn.end();
  } catch(e) {
    console.error('❌ Failed:', e.code, e.message);
  }
}

test();
