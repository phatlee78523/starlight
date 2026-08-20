require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const apiRoutes = require('./routes/api');
const migrate = require('./migrate');
const automation = require('./services/automation');
const db = require('../db');

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Đảm bảo thư mục uploads tồn tại (Render tạo container mới mỗi lần deploy)
const uploadsDir = path.join(__dirname, '../frontend/uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

// Phục vụ frontend tĩnh
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api', apiRoutes);

// Fallback to index.html for SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  // Mở port trước rồi mới migrate — Render cần port lên sớm để health check
  migrate()
    .then(() => automation.runDaily())
    .catch(e => console.error('[migrate] lỗi:', e.message));
});

// 6h sáng VN mỗi ngày: việc cố định, nhắc CTKM, timeline trang trí, nhắc báo cáo ngày 28.
// (Có chạy bù trong api_bootstrap nếu server đang ngủ đúng 6h.)
cron.schedule('0 6 * * *', () => {
  automation.runDaily().catch(e => console.error('[automation]', e.message));
}, { timezone: 'Asia/Ho_Chi_Minh' });
