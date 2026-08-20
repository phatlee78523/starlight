/*
 * Migration nhẹ chạy mỗi lần server khởi động (idempotent).
 * Chỉ ADD COLUMN / tạo bảng nếu thiếu — không đụng dữ liệu cũ,
 * nên chạy an toàn trên cả database production lẫn database test.
 */
const pool = require('../db');

const STATEMENTS = [
  // Lịch phim: frontend dùng title/releaseDate/genre/duration/format/rating/poster
  'ALTER TABLE movies ADD COLUMN `title` VARCHAR(255)',
  'ALTER TABLE movies ADD COLUMN `releaseDate` VARCHAR(20)',
  'ALTER TABLE movies ADD COLUMN `genre` VARCHAR(100)',
  'ALTER TABLE movies ADD COLUMN `duration` VARCHAR(50)',
  'ALTER TABLE movies ADD COLUMN `format` VARCHAR(50)',
  'ALTER TABLE movies ADD COLUMN `rating` VARCHAR(20)',
  'ALTER TABLE movies ADD COLUMN `poster` TEXT',
  'UPDATE movies SET `title` = `name` WHERE `title` IS NULL AND `name` IS NOT NULL',
  'UPDATE movies SET `releaseDate` = `premiere` WHERE `releaseDate` IS NULL AND `premiere` IS NOT NULL',

  // Bài viết fanpage: tách like/comment/share thay vì 1 cột interact gộp
  'ALTER TABLE posts ADD COLUMN `likes` VARCHAR(50)',
  'ALTER TABLE posts ADD COLUMN `comments` VARCHAR(50)',
  'ALTER TABLE posts ADD COLUMN `shares` VARCHAR(50)',

  // Radar đối thủ: schema cũ (rivalName/followers...) không khớp form ghi nhận quảng cáo
  'ALTER TABLE rivals ADD COLUMN `brand` VARCHAR(255)',
  'ALTER TABLE rivals ADD COLUMN `format` VARCHAR(50)',
  'ALTER TABLE rivals ADD COLUMN `running` VARCHAR(20)',
  'ALTER TABLE rivals ADD COLUMN `text` TEXT',
  'ALTER TABLE rivals ADD COLUMN `start` VARCHAR(20)',
  'ALTER TABLE rivals ADD COLUMN `likes` VARCHAR(50)',
  'ALTER TABLE rivals ADD COLUMN `views` VARCHAR(50)',
  'ALTER TABLE rivals ADD COLUMN `link` TEXT',
  'ALTER TABLE rivals ADD COLUMN `insight` TEXT',
  'ALTER TABLE rivals ADD COLUMN `snapshot` VARCHAR(20)',

  // Báo cáo tháng: cần lưu tháng, khoảng ngày, loại mẫu và toàn bộ số liệu
  'ALTER TABLE reports ADD COLUMN `month` VARCHAR(7)',
  'ALTER TABLE reports ADD COLUMN `from_date` VARCHAR(20)',
  'ALTER TABLE reports ADD COLUMN `to_date` VARCHAR(20)',
  'ALTER TABLE reports ADD COLUMN `type` VARCHAR(20)',
  'ALTER TABLE reports ADD COLUMN `data` TEXT',
  'ALTER TABLE reports ADD COLUMN `adminNote` TEXT',

  // Quy trình: mã hiệu, phiên bản, trạng thái, file PDF đính kèm
  'ALTER TABLE procedures ADD COLUMN `code` VARCHAR(50)',
  'ALTER TABLE procedures ADD COLUMN `version` VARCHAR(20)',
  'ALTER TABLE procedures ADD COLUMN `status` VARCHAR(50)',
  'ALTER TABLE procedures ADD COLUMN `issued` VARCHAR(20)',
  'ALTER TABLE procedures ADD COLUMN `byName` VARCHAR(100)',
  'ALTER TABLE procedures ADD COLUMN `fileId` VARCHAR(255)',
  'ALTER TABLE procedures ADD COLUMN `viewUrl` TEXT',
  'ALTER TABLE procedures ADD COLUMN `downloadUrl` TEXT',

  // Fanpage: tên rạp, Page ID và token riêng cho từng page
  'ALTER TABLE pages ADD COLUMN `cinema` VARCHAR(255)',
  'ALTER TABLE pages ADD COLUMN `pageId` VARCHAR(100)',
  'ALTER TABLE pages ADD COLUMN `token` TEXT',

  // Việc sinh ra từ tab Giao việc: nhớ assignment gốc để khi hoàn thành
  // thì tự cập nhật trạng thái + báo cho người giao
  'ALTER TABLE tasks ADD COLUMN `assignmentId` VARCHAR(50)',

  // Thông báo: bấm vào nhảy thẳng tới tab liên quan
  'ALTER TABLE notifications ADD COLUMN `goto` VARCHAR(20)'
];

const IGNORABLE = /duplicate column|already exists/i;

async function migrate() {
  for (const sql of STATEMENTS) {
    try {
      await pool.query(sql);
    } catch (e) {
      if (!IGNORABLE.test(e.message)) {
        console.error('[migrate] bỏ qua:', sql.slice(0, 60), '->', e.message);
      }
    }
  }
  console.log('[migrate] schema OK');
}

module.exports = migrate;
