/*
 * Tự động hoá hằng ngày — port từ bản Apps Script v5.1:
 *  - Việc cố định mỗi sáng theo vai trò (thiết kế / content), trừ Chủ nhật
 *  - CTKM cố định trong tuần: ghi Daily focus + thông báo cả team
 *  - Đếm ngược 5 ngày trước Thứ 2 đầu tháng cho content chuẩn bị
 *  - Timeline trang trí ngày lễ: nhắc mốc thông báo rạp / setup / tháo dỡ + nhắc trước 30 ngày
 *  - Nhắc báo cáo tháng ngày 28
 *
 * Chạy theo 2 đường: cron 6h sáng VN, và chạy bù khi người đầu tiên
 * mở web trong ngày (Render free hay ngủ nên không thể chỉ trông vào cron).
 * Mọi việc/thông báo đã tạo được ghi nhớ trong json_store AUTO_EVENTS — không bao giờ tạo trùng.
 */
const pool = require('../../db');

function genId(prefix) { return prefix + Date.now() + Math.floor(Math.random() * 1000); }
function vnNow() { return new Date(Date.now() + 7 * 3600 * 1000); }
function vnToday() { return vnNow().toISOString().split('T')[0]; }
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().split('T')[0];
}
function dowOf(dateStr) { return new Date(dateStr + 'T00:00:00Z').getUTCDay(); } // 0=CN, 1=Thứ 2...
function diffDays(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000); }

async function getJson(key, defaultVal) {
  const [rows] = await pool.query('SELECT store_value FROM json_store WHERE store_key = ?', [key]);
  if (rows.length && rows[0].store_value != null) {
    const v = rows[0].store_value;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return defaultVal; } }
    return v;
  }
  return defaultVal;
}
async function saveJson(key, val) {
  await pool.query('INSERT INTO json_store (store_key, store_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)', [key, JSON.stringify(val)]);
}
async function notify(userId, type, title, body, goTo) {
  await pool.query('INSERT INTO notifications (id, userId, type, title, body, time, `goto`) VALUES (?,?,?,?,?,?,?)',
    [genId('N'), userId, type, title, body, new Date().toISOString(), goTo || '']);
}
async function addTask(userId, date, task, category, priority, note) {
  await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?,?,?,?,?,?,?,?)',
    [genId('T'), date, userId, task, category, priority, 'Chưa làm', note || '']);
}

/* ------------------- CẤU HÌNH (sửa thoải mái) ------------------- */
// Việc tự thêm vào đầu ngày theo vai trò. Note phải chứa "việc cố định" để frontend gắn nhãn 🔁.
const AUTO_TASKS = {
  designer: [{ task: 'Làm lịch chiếu phim cho 6 fanpage', category: 'Thiết kế', priority: 'Cao' }],
  content: [{ task: 'Cập nhật phim đang chiếu, sắp chiếu', category: 'Fanpage / Content', priority: 'Cao' }],
  admin: []
};

// CTKM cố định trong tuần (dow: 1 = Thứ 2 ... 6 = Thứ 7)
const PROMOS = [
  { dow: 1, firstOfMonth: true, key: 'combo50', name: 'Thứ 2 đầu tháng — Giảm 50% combo bắp nước' },
  { dow: 2, key: 'phimviet', name: 'Thứ 3 phim Việt — 45K/vé' },
  { dow: 4, key: 'baptangnuoc', name: 'Thứ 5 — Mua bắp tặng nước' },
  { dow: 5, key: 'kidsday', name: 'Thứ 6 — Family Kids Day: Star Kid 79K (1 vé + bắp + nước) · 119K (2 vé + bắp + nước)' }
];

// Ngày âm lịch đã quy đổi sẵn sang dương lịch (sửa tại đây nếu cần)
const LUNAR_TET = {
  2026: '2026-02-17', 2027: '2027-02-06', 2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03',
  2031: '2031-01-23', 2032: '2032-02-11', 2033: '2033-01-31', 2034: '2034-02-19', 2035: '2035-02-08'
};
const LUNAR_MIDAUTUMN = {
  2026: '2026-09-25', 2027: '2027-09-15', 2028: '2028-10-03', 2029: '2029-09-22', 2030: '2030-09-12',
  2031: '2031-10-01', 2032: '2032-09-19', 2033: '2033-09-08', 2034: '2034-09-27', 2035: '2035-09-16'
};

// Timeline trang trí: notify/setup âm = trước ngày lễ, remove dương = sau ngày lễ
const HOLIDAYS = [
  { key: 'quockhanh', name: 'Quốc khánh 2/9', md: '09-02', notify: -26, setup: -18, remove: 3, budget: '1.000.000 (Quy Nhơn 2.000.000)' },
  { key: 'trungthu', name: 'Trung thu', lunar: LUNAR_MIDAUTUMN, notify: -22, setup: -13, remove: 8, budget: '2.000.000 (Quy Nhơn 3.000.000)' },
  { key: 'halloween', name: 'Halloween 31/10', md: '10-31', notify: -18, setup: -11, remove: 3, budget: '1.000.000 (Quy Nhơn 2.000.000)' },
  { key: 'noel', name: 'Noel 25/12', md: '12-25', notify: -40, setup: -24, remove: 10, budget: 'Theo duyệt' },
  { key: 'tet', name: 'Tết Nguyên đán', lunar: LUNAR_TET, notify: -32, setup: -22, remove: 22, budget: '3.000.000' }
];

function holidayDate(h, year) {
  if (h.lunar) return h.lunar[year] || null;
  return year + '-' + h.md;
}
// Các dịp lễ của năm nay + năm sau (để cuối năm vẫn thấy Tết năm tới)
function holidayOccurrences() {
  const y = vnNow().getUTCFullYear();
  const out = [];
  for (const year of [y, y + 1]) {
    for (const h of HOLIDAYS) {
      const date = holidayDate(h, year);
      if (!date) continue;
      out.push({
        key: h.key + year, name: h.name, date, budget: h.budget,
        notify: addDays(date, h.notify), setup: addDays(date, h.setup), remove: addDays(date, h.remove)
      });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

function firstMondayOfMonth(monthStr) {
  let d = monthStr + '-01';
  while (dowOf(d) !== 1) d = addDays(d, 1);
  return d;
}

/* ------------------- Thẻ "Sắp tới" + timeline trên Dashboard ------------------- */
function upcomingItems(days) {
  const today = vnToday();
  const horizon = days || 45;
  const items = [];
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(today, i);
    const dow = dowOf(d);
    const dayNum = parseInt(d.split('-')[2], 10);
    for (const p of PROMOS) {
      if (p.dow !== dow) continue;
      if (p.firstOfMonth && dayNum > 7) continue;
      items.push({ date: d, title: p.name, note: '', kind: 'CTKM' });
    }
  }
  for (const h of holidayOccurrences()) {
    for (const [d, label] of [[h.notify, 'Gửi thông báo trang trí đến 6 rạp'], [h.setup, 'DEADLINE hoàn thành setup'], [h.date, 'Ngày lễ'], [h.remove, 'Tháo dỡ trang trí']]) {
      if (d >= today && diffDays(today, d) <= horizon) {
        items.push({ date: d, title: h.name + ' — ' + label, note: 'Ngân sách: ' + h.budget, kind: 'Trang trí' });
      }
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 20);
}
function timelineItems() {
  const today = vnToday();
  const seen = new Set();
  const items = [];
  for (const h of holidayOccurrences()) {
    const baseKey = h.key.replace(/\d{4}$/, '');
    if (seen.has(baseKey)) continue;
    if (h.remove < today) continue; // dịp đã qua hẳn -> lấy lần kế tiếp
    seen.add(baseKey);
    items.push({ name: h.name, notify: h.notify, setup: h.setup, remove: h.remove, budget: h.budget });
  }
  return items;
}

/* ------------------- Bộ máy chạy hằng ngày ------------------- */
async function runDaily(force) {
  const today = vnToday();
  const state = await getJson('AUTO_EVENTS', { lastRun: '', done: {} });
  if (!force && state.lastRun === today) return { ran: false };

  // Dọn key cũ hơn 60 ngày cho gọn store
  const cutoff = addDays(today, -60);
  for (const k of Object.keys(state.done)) {
    if ((state.done[k] || '') < cutoff) delete state.done[k];
  }
  const once = key => {
    if (state.done[key]) return false;
    state.done[key] = today;
    return true;
  };

  const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
  const admins = users.filter(u => u.role === 'admin');
  const designers = users.filter(u => u.isDesigner);
  const contents = users.filter(u => u.isContent);
  const dow = dowOf(today);
  const dayNum = parseInt(today.split('-')[2], 10);

  // 1. Việc cố định theo vai trò (trừ Chủ nhật)
  if (dow !== 0) {
    for (const [role, list] of [['designer', designers], ['content', contents], ['admin', admins]]) {
      for (const spec of AUTO_TASKS[role] || []) {
        for (const u of list) {
          if (once(`fixed|${role}|${u.id}|${today}`)) {
            await addTask(u.id, today, spec.task, spec.category, spec.priority, '🔁 việc cố định hằng ngày');
          }
        }
      }
    }
  }

  // 2. CTKM hôm nay: ghi Daily focus (nếu trống) + thông báo cả team
  const focusStore = await getJson('FOCUS', {});
  let focusChanged = false;
  for (const p of PROMOS) {
    if (p.dow !== dow) continue;
    if (p.firstOfMonth && dayNum > 7) continue;
    if (once(`promo|${p.key}|${today}`)) {
      for (const u of users) {
        const fk = `${today}_${u.id}`;
        if (!focusStore[fk]) { focusStore[fk] = p.name; focusChanged = true; }
        await notify(u.id, 'SYS', 'Hôm nay có CTKM cố định', p.name, 'today');
      }
    }
  }
  if (focusChanged) await saveJson('FOCUS', focusStore);

  // 3. Đếm ngược 5 ngày trước Thứ 2 đầu tháng cho content chuẩn bị
  for (const m of [today.substr(0, 7), addDays(today, 7).substr(0, 7)]) {
    const fm = firstMondayOfMonth(m);
    const left = diffDays(today, fm);
    if (left >= 1 && left <= 5) {
      if (once(`promoPrep|${fm}|${today}`)) {
        for (const u of contents) {
          await addTask(u.id, today, `Chuẩn bị content cho Thứ 2 đầu tháng (${fm}) — CTKM giảm 50% combo bắp nước`, 'Fanpage / Content', 'Cao', '');
          await notify(u.id, 'SYS', `Còn ${left} ngày tới Thứ 2 đầu tháng`, 'Chuẩn bị content CTKM giảm 50% combo bắp nước.', 'today');
        }
      }
    }
  }

  // 4. Timeline trang trí ngày lễ
  for (const h of holidayOccurrences()) {
    const milestones = [
      [h.notify, `Gửi thông báo trang trí ${h.name} đến 6 rạp`],
      [h.setup, `DEADLINE hoàn thành setup ${h.name} — nghiệm thu ảnh từ 6 rạp`],
      [h.remove, `Tháo dỡ trang trí ${h.name} tại 6 rạp`]
    ];
    for (const [d, taskName] of milestones) {
      if (d === today && once(`holi|${h.key}|${d}`)) {
        const targets = admins.concat(designers.filter(x => !admins.find(a => a.id === x.id)));
        for (const u of targets) {
          await addTask(u.id, today, taskName, 'POSM', 'Cao', '');
          await notify(u.id, 'SYS', h.name + ' — tới mốc trang trí', taskName + ` (ngân sách: ${h.budget})`, 'today');
        }
      }
    }
    if (diffDays(today, h.date) === 30 && once(`holi30|${h.key}`)) {
      for (const u of users) {
        await notify(u.id, 'SYS', `Còn 30 ngày tới ${h.name}`,
          `Thông báo rạp: ${h.notify} · Setup xong: ${h.setup} · Tháo dỡ: ${h.remove} · Ngân sách: ${h.budget}`, 'dash');
      }
    }
  }

  // 5. Ngày 28: nhắc báo cáo tháng
  if (dayNum === 28 && once(`report28|${today.substr(0, 7)}`)) {
    for (const u of users) {
      if (u.role === 'admin') {
        await notify(u.id, 'SYS', 'Hôm nay là ngày báo cáo tháng', 'Vào tab Báo cáo xem ai đã gửi — ai còn thiếu, và tổng hợp gửi Ban giám đốc.', 'rp');
      } else {
        await addTask(u.id, today, 'Chốt số liệu và gửi báo cáo tháng cho trưởng bộ phận', 'Báo cáo', 'Cao', '');
        await notify(u.id, 'SYS', 'Hôm nay là hạn báo cáo tháng', 'Vào tab Báo cáo → + Tạo báo cáo mới, điền số liệu rồi gửi trưởng bộ phận.', 'rp');
      }
    }
  }

  state.lastRun = today;
  await saveJson('AUTO_EVENTS', state);
  return { ran: true };
}

module.exports = { runDaily, upcomingItems, timelineItems, PROMOS, HOLIDAYS };
