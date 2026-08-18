require('dotenv').config();
const mysql = require('mysql2/promise');

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined
  });

  try {
    const dbName = process.env.DB_NAME || 'starlight';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await connection.query(`USE \`${dbName}\``);

    console.log('Database connected & created if not exists.');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(10) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        position VARCHAR(255),
        password VARCHAR(255) DEFAULT '123456',
        isDesigner BOOLEAN DEFAULT FALSE,
        isContent BOOLEAN DEFAULT FALSE,
        active BOOLEAN DEFAULT TRUE
      )
    `);

    try {
      await connection.query(`ALTER TABLE users ADD COLUMN password VARCHAR(255) DEFAULT '123456'`);
      console.log('Added password column to users table.');
    } catch(e) {
      // Bỏ qua nếu cột đã tồn tại
    }

    const users = [
      ['U1', 'Phạm Nhật Đan', 'Nhật Đan', 'admin', 'Trưởng bộ phận Truyền thông & Marketing', false, true],
      ['U2', 'Đoàn Ngọc Dung', 'Ngọc Dung', 'member', 'Chuyên viên Content / Fanpage', false, true],
      ['U3', 'Nguyễn Phú Thái', 'Thái', 'member', 'Chuyên viên Thiết kế', true, false],
      ['U4', 'Nhân sự 4', 'NS4', 'member', 'Chuyên viên', false, false],
      ['U5', 'Nhân sự 5', 'NS5', 'member', 'Chuyên viên', false, false],
      ['U6', 'Nhân sự 6', 'NS6', 'member', 'Chuyên viên', false, false],
      ['U7', 'Nhân sự 7', 'NS7', 'member', 'Chuyên viên', false, false]
    ];

    for (const u of users) {
      await connection.query(`
        INSERT INTO users (id, name, short, role, position, isDesigner, isContent) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name), 
          short = VALUES(short), 
          role = VALUES(role), 
          position = VALUES(position), 
          isDesigner = VALUES(isDesigner), 
          isContent = VALUES(isContent)
      `, u);
    }
    console.log('Users seeded.');

    // Khởi tạo các bảng khác
    const tables = [
      `CREATE TABLE IF NOT EXISTS tasks (
        id VARCHAR(50) PRIMARY KEY,
        date DATE,
        userId VARCHAR(10),
        task TEXT,
        category VARCHAR(100),
        priority VARCHAR(50),
        status VARCHAR(50),
        note TEXT,
        FOREIGN KEY (userId) REFERENCES users(id)
      )`,
      `CREATE TABLE IF NOT EXISTS reports (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(10),
        group_name VARCHAR(100),
        note TEXT,
        status VARCHAR(50) DEFAULT 'Nháp',
        managerNote TEXT,
        receivedAt VARCHAR(50),
        receivedBy VARCHAR(10),
        sentAt VARCHAR(50)
      )`,
      `CREATE TABLE IF NOT EXISTS ads (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(10),
        name VARCHAR(255),
        platform VARCHAR(50),
        status VARCHAR(50),
        start VARCHAR(20),
        end VARCHAR(20),
        spend VARCHAR(50),
        reach VARCHAR(50),
        impressions VARCHAR(50),
        views VARCHAR(50),
        likes VARCHAR(50),
        comments VARCHAR(50),
        shares VARCHAR(50),
        link TEXT,
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(10),
        fanpage VARCHAR(255),
        date VARCHAR(20),
        content TEXT,
        type VARCHAR(50),
        reach VARCHAR(50),
        interact VARCHAR(50),
        link TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS movies (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        type VARCHAR(50),
        premiere VARCHAR(20),
        end VARCHAR(20),
        status VARCHAR(50),
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS pages (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255),
        followers VARCHAR(50),
        status VARCHAR(50),
        link TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS procedures (
        id VARCHAR(50) PRIMARY KEY,
        category VARCHAR(100),
        title VARCHAR(255),
        link TEXT,
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS assignments (
        id VARCHAR(50) PRIMARY KEY,
        fromId VARCHAR(10),
        toId VARCHAR(10),
        task TEXT,
        date VARCHAR(20),
        category VARCHAR(100),
        priority VARCHAR(50),
        status VARCHAR(50),
        response TEXT,
        createdAt VARCHAR(50),
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(10) DEFAULT 'ALL',
        type VARCHAR(50),
        title VARCHAR(255),
        body TEXT,
        is_read BOOLEAN DEFAULT FALSE,
        time VARCHAR(50)
      )`,
      `CREATE TABLE IF NOT EXISTS presentations (
        id VARCHAR(50) PRIMARY KEY,
        title VARCHAR(255),
        link TEXT,
        date VARCHAR(20),
        byId VARCHAR(10)
      )`,
      `CREATE TABLE IF NOT EXISTS rivals (
        id VARCHAR(50) PRIMARY KEY,
        userId VARCHAR(10),
        rivalName VARCHAR(255),
        page VARCHAR(255),
        date VARCHAR(20),
        followers VARCHAR(50),
        interactions VARCHAR(50),
        posts VARCHAR(50),
        note TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS json_store (
        store_key VARCHAR(50) PRIMARY KEY,
        store_value JSON
      )`
    ];

    for (const t of tables) {
      await connection.query(t);
    }

    const defaultPOSM = {
      cinemas: [
        { name: "BUÔN MA THUỘT", sheetName: "BUÔN MA THUỘT", total: 0, alert: 0, oldFilm: 0, ok: 0, items: [] }
      ]
    };
    const defaultLeaves = {};

    await connection.query(`
      INSERT INTO json_store (store_key, store_value) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)
    `, ['POSM', JSON.stringify(defaultPOSM)]);

    await connection.query(`
      INSERT INTO json_store (store_key, store_value) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)
    `, ['LEAVES', JSON.stringify(defaultLeaves)]);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await connection.end();
  }
}

seed();
