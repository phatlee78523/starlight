const pool = require('../../db');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

const UPLOADS_DIR = path.join(__dirname, '../../frontend/uploads');

// Generate an ID
function genId(prefix) { return prefix + Date.now() + Math.floor(Math.random() * 1000); }

/* ------------------------- Giờ Việt Nam ------------------------- */
// Server (Render) chạy UTC; mọi khái niệm "hôm nay" phải theo giờ VN (+7)
function vnNow() { return new Date(Date.now() + 7 * 3600 * 1000); }
function vnToday() { return vnNow().toISOString().split('T')[0]; }
function vnMonth() { return vnToday().substr(0, 7); }
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = n => (n < 10 ? '0' : '') + n;
  return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ' ' + d.getUTCDate() + '/' + (d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
}
function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return String(iso);
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 90) return 'Vừa xong';
  if (s < 3600) return Math.round(s / 60) + ' phút trước';
  if (s < 86400) return Math.round(s / 3600) + ' giờ trước';
  if (s < 7 * 86400) return Math.round(s / 86400) + ' ngày trước';
  return fmtDateTime(iso);
}
function num(v) { return Number(String(v == null ? '' : v).replace(/[^\d.-]/g, '')) || 0; }

/* ------------------------- JSON store ------------------------- */
async function getJson(key, defaultVal) {
  const [rows] = await pool.query('SELECT store_value FROM json_store WHERE store_key = ?', [key]);
  if (rows.length > 0 && rows[0].store_value != null) {
    const v = rows[0].store_value;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return defaultVal; } }
    return v;
  }
  return defaultVal;
}
async function saveJson(key, val) {
  await pool.query('INSERT INTO json_store (store_key, store_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)', [key, JSON.stringify(val)]);
}

/* ------------------------- Thông báo ------------------------- */
async function notify(userId, type, title, body, goTo) {
  await pool.query('INSERT INTO notifications (id, userId, type, title, body, time, `goto`) VALUES (?,?,?,?,?,?,?)',
    [genId('N'), userId, type, title, body, new Date().toISOString(), goTo || '']);
}

/* ------------------------- Presence ------------------------- */
// PRESENCE trong json_store: { [userId]: {note, noteAt, lastSeen} }
async function getPresence() {
  let p = await getJson('PRESENCE', {});
  if (Array.isArray(p)) { // dữ liệu kiểu cũ là mảng -> chuyển sang map
    const m = {};
    p.forEach(x => { if (x && x.id) m[x.id] = { note: x.note || '', noteAt: x.noteAt || '', lastSeen: 0 }; });
    p = m;
  }
  return p;
}
async function touchPresence(userId) {
  if (!userId) return;
  const p = await getPresence();
  if (!p[userId]) p[userId] = { note: '', noteAt: '', lastSeen: 0 };
  p[userId].lastSeen = Date.now();
  await saveJson('PRESENCE', p);
}

/* ------------------------- Phim: version để client tự refresh ------------------------- */
async function bumpMovieMeta(byName) {
  const meta = { version: 'mv' + Date.now(), updatedAt: fmtDateTime(new Date().toISOString()), updatedBy: byName || '' };
  await saveJson('MOVIE_META', meta);
  return meta;
}
function movieOut(m) {
  return {
    id: m.id,
    title: m.title || m.name || '',
    release: m.releaseDate || m.premiere || '',
    end: m.end || '',
    status: m.status || '',
    genre: m.genre || '',
    duration: m.duration || '',
    format: m.format || '',
    rating: m.rating || '',
    poster: m.poster || '',
    note: m.note || ''
  };
}
const MOVIE_STATUSES = ['Đang chiếu', 'Sắp chiếu', 'Ngừng chiếu'];

/* ------------------------- Mẫu báo cáo tháng ------------------------- */
const REPORT_TEXTS = [
  { key: 'review', label: 'Nhận xét / đánh giá trong tháng' },
  { key: 'plan', label: 'Đề xuất & kế hoạch tháng sau' }
];
function contentTemplate(pages) {
  const tplPages = (pages && pages.length)
    ? pages.map(p => ({ key: p.id, name: p.cinema || p.name }))
    : [{ key: 'total', name: 'Tổng 6 fanpage' }];
  return {
    type: 'content', title: 'Báo cáo Content / Fanpage',
    pages: tplPages,
    pageFields: [
      { key: 'posts', label: 'Bài đăng' },
      { key: 'follower', label: 'Follower tăng' },
      { key: 'reach', label: 'Reach' },
      { key: 'views', label: 'Lượt xem' },
      { key: 'eng', label: 'Tương tác' },
      { key: 'spend', label: 'Tiền QC (đ)' }
    ],
    tiktokFields: [
      { key: 'videos', label: 'Số video' },
      { key: 'follower', label: 'Follower tăng' },
      { key: 'views', label: 'Lượt xem' },
      { key: 'eng', label: 'Tương tác' },
      { key: 'spend', label: 'Tiền QC (đ)' }
    ],
    texts: REPORT_TEXTS, groups: []
  };
}
const DESIGN_TEMPLATE = {
  type: 'design', title: 'Báo cáo Thiết kế',
  groups: [
    {
      key: 'design', label: 'Khối lượng thiết kế', unit: 'ấn phẩm',
      fields: [
        { key: 'social', label: 'Ấn phẩm social' },
        { key: 'posm', label: 'Ấn phẩm POSM / in ấn' },
        { key: 'video', label: 'Video / Motion' },
        { key: 'other', label: 'Khác' }
      ]
    },
    {
      key: 'posm', label: 'Tình trạng POSM các rạp',
      fields: [
        { key: 'ok', label: 'OK - Tốt' },
        { key: 'old', label: 'Phim cũ' },
        { key: 'bad', label: 'Cũ / Rách' },
        { key: 'replaced', label: 'Đã thay trong tháng' }
      ]
    }
  ],
  texts: REPORT_TEXTS, pages: [], pageFields: [], tiktokFields: []
};
function parseReportRow(r) {
  let data = {};
  if (r.data) { try { data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; } catch (e) { data = {}; } }
  return {
    id: r.id, userId: r.userId, month: r.month || '', from: r.from_date || '', to: r.to_date || '',
    type: r.type || 'content', status: r.status || 'Nháp', data: data,
    sentAt: r.sentAt ? fmtDateTime(r.sentAt) : '', adminNote: r.adminNote || ''
  };
}

/* ------------------------- Fanpage helpers ------------------------- */
const POST_TYPES = ['Ảnh', 'Album ảnh', 'Video', 'Reels', 'Story', 'Link', 'Minigame', 'Khác'];
function postOut(p) {
  const likes = num(p.likes), comments = num(p.comments), shares = num(p.shares);
  const eng = (likes + comments + shares) || num(p.interact);
  return {
    id: p.id, userId: p.userId, page: p.fanpage || '', date: p.date || '', content: p.content || '',
    type: p.type || '', reach: num(p.reach), likes, comments, shares, link: p.link || '', eng
  };
}
function rangeInfo(range) {
  const today = vnToday();
  const d = new Date(today + 'T00:00:00Z');
  let from, label;
  if (range === 'week') {
    const dow = d.getUTCDay() || 7;
    const mon = new Date(d); mon.setUTCDate(d.getUTCDate() - dow + 1);
    from = mon.toISOString().split('T')[0]; label = 'tuần này';
  } else if (range === '30d') {
    const x = new Date(d); x.setUTCDate(d.getUTCDate() - 29);
    from = x.toISOString().split('T')[0]; label = '30 ngày qua';
  } else if (range === 'month') {
    from = today.substr(0, 7) + '-01'; label = 'tháng này';
  } else { // '7d'
    const x = new Date(d); x.setUTCDate(d.getUTCDate() - 6);
    from = x.toISOString().split('T')[0]; label = '7 ngày qua';
  }
  return { from, to: today, label };
}

/* ------------------------- Đối thủ ------------------------- */
const RIVAL_BRANDS = ['CGV Cinemas', 'Galaxy Cinema', 'Lotte Cinema', 'Beta Cinemas', 'Cinestar', 'Mega GS', 'DCINE'];
function adLibraryUrl(q) {
  return 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&q=' +
    encodeURIComponent(q) + '&search_type=keyword_unordered&media_type=all';
}

/* ------------------------- Upload ------------------------- */
function humanSize(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}
function saveBase64File(base64Data, prefix) {
  if (!base64Data) return { url: '' };
  try {
    const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return { url: '' };

    const ext = (matches[1].split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '');
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `${prefix}_${Date.now()}.${ext}`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    const url = `/uploads/${filename}`;
    return { url, id: filename, viewUrl: url, downloadUrl: url, size: humanSize(buffer.length) };
  } catch (e) {
    console.error('Upload error', e);
    return { url: '' };
  }
}

module.exports = {
  api_bootstrap: async function () {
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const categories = ['Fanpage / Content', 'Thiết kế', 'Ads', 'TikTok', 'Biên tập', 'POSM', 'KOL / KOC', 'Sự kiện', 'Đề xuất / Giấy tờ', 'Báo cáo', 'Khác'];

    const formattedUsers = users.map(u => ({
      ...u,
      isDesigner: !!u.isDesigner,
      isContent: !!u.isContent,
      active: !!u.active
    }));

    const [movies] = await pool.query('SELECT * FROM movies');
    const movieMeta = await getJson('MOVIE_META', { version: '1', updatedAt: '', updatedBy: '' });

    // Danh sách tháng: các tháng có dữ liệu + tháng hiện tại (giờ VN)
    const [mRows] = await pool.query("SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') AS m FROM tasks WHERE date IS NOT NULL");
    const monthSet = new Set(mRows.map(r => r.m).filter(Boolean));
    monthSet.add(vnMonth());
    const months = Array.from(monthSet).sort().reverse();

    return {
      users: formattedUsers,
      categories,
      statuses: ['Chưa làm', 'Đang làm', 'Hoàn thành'],
      priorities: ['Cao', 'Thường', 'Thấp'],
      posmStatuses: ['OK - Tốt', 'Phim Cũ', 'Cũ / Rách'],
      today: vnToday(),
      hasPosm: true, posmUrl: '#', dbUrl: '#',
      months,
      curMonth: vnMonth(), rollover: null,
      adPlatforms: ['Facebook', 'Instagram', 'TikTok', 'Google', 'Khác'],
      adStatuses: ['Đang chạy', 'Đã tắt', 'Tạm dừng', 'Chờ duyệt'],
      leaveTypes: ['Nghỉ phép cả ngày', 'Nghỉ buổi sáng', 'Nghỉ buổi chiều'],
      movieStatuses: MOVIE_STATUSES,
      version: 'v6.2 (MySQL)', dayOfMonth: vnNow().getUTCDate(),
      movies: {
        movies: movies.map(movieOut), statuses: MOVIE_STATUSES,
        version: movieMeta.version, updatedAt: movieMeta.updatedAt, updatedBy: movieMeta.updatedBy
      }
    };
  },

  api_login: async function (n, p) {
    const name = String(n || '').trim().toLowerCase();
    // Ưu tiên khớp đúng họ tên; gõ thiếu thì chỉ chấp nhận khi duy nhất 1 người khớp
    let [users] = await pool.query('SELECT * FROM users WHERE active = TRUE AND LOWER(name) = ?', [name]);
    if (users.length === 0) {
      [users] = await pool.query('SELECT * FROM users WHERE active = TRUE AND LOWER(name) LIKE ?', [`%${name}%`]);
    }
    if (users.length === 0) throw new Error('Không tìm thấy nhân sự');
    if (users.length > 1) throw new Error('Có nhiều nhân sự trùng tên — hãy nhập đầy đủ họ tên');
    const u = users[0];
    if (u.password !== p) throw new Error('Mật khẩu không chính xác');
    delete u.password;
    await touchPresence(u.id);
    return { ...u, isDesigner: !!u.isDesigner, isContent: !!u.isContent, active: !!u.active };
  },

  api_getDay: async function (date, uid) {
    const d = date || vnToday();
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date = ? AND userId = ? AND status != "Đã xóa"', [d, uid]);

    const focusStore = await getJson('FOCUS', {});
    const leaveStore = await getJson('LEAVES', {});

    return {
      tasks: tasks,
      focus: focusStore[`${d}_${uid}`] || '',
      leave: leaveStore[`${d}|${uid}`] || '',
      leaveTypes: ['Nghỉ phép cả ngày', 'Nghỉ buổi sáng', 'Nghỉ buổi chiều']
    };
  },

  api_addTask: async function (p) {
    const id = genId('T');
    await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, p.date, p.userId, p.task, p.category, p.priority, 'Chưa làm', '']);
    return { id };
  },

  api_updateTask: async function (p) {
    await pool.query('UPDATE tasks SET task = COALESCE(?, task), category = COALESCE(?, category), priority = COALESCE(?, priority), status = COALESCE(?, status), note = COALESCE(?, note) WHERE id = ?',
      [p.task, p.category, p.priority, p.status, p.note, p.id]);

    // Việc được giao mà hoàn thành -> cập nhật assignment + báo người giao
    if (p.status === 'Hoàn thành') {
      const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [p.id]);
      const t = rows[0];
      if (t && t.assignmentId) {
        const [asgs] = await pool.query('SELECT * FROM assignments WHERE id = ?', [t.assignmentId]);
        if (asgs.length) {
          const a = asgs[0];
          await pool.query('UPDATE assignments SET status = "Hoàn thành" WHERE id = ?', [a.id]);
          const [us] = await pool.query('SELECT name, short FROM users WHERE id = ?', [t.userId]);
          const who = us.length ? (us[0].short || us[0].name) : '';
          await notify(a.fromId, 'DONE', `${who} đã hoàn thành việc bạn giao`, a.task, 'assign');
        }
      }
    }
    return { ok: true };
  },

  api_deleteTask: async function (id) {
    await pool.query('UPDATE tasks SET status = "Đã xóa" WHERE id = ?', [id]);
    return { ok: true };
  },

  api_addTasksBulk: async function (p) {
    const lines = p.text.split('\n').map(l => l.trim().replace(/^[-•]/, '').trim()).filter(l => l);
    for (const line of lines) {
      const id = genId('T');
      await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, p.date, p.userId, line, p.category, p.priority, 'Chưa làm', '']);
    }
    return { count: lines.length };
  },

  api_carryOver: async function (p) {
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE userId = ? AND date < ? AND status != "Hoàn thành" AND status != "Đã xóa" ORDER BY date DESC', [p.userId, p.date]);
    if (tasks.length === 0) return { count: 0, from: 'hôm trước' };

    const fromDate = tasks[0].date;
    const [unfTasks] = await pool.query('SELECT * FROM tasks WHERE userId = ? AND date = ? AND status != "Hoàn thành" AND status != "Đã xóa"', [p.userId, fromDate]);

    for (const t of unfTasks) {
      const id = genId('T');
      await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note, assignmentId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, p.date, p.userId, t.task, t.category, t.priority, t.status, t.note, t.assignmentId]);
      await pool.query('UPDATE tasks SET status = "Hoàn thành", note = "Đã chuyển sang ngày mới" WHERE id = ?', [t.id]);
    }
    return { count: unfTasks.length, from: fromDate };
  },

  api_saveFocus: async function (p) {
    const focusStore = await getJson('FOCUS', {});
    focusStore[`${p.date}_${p.userId}`] = p.focus;
    await saveJson('FOCUS', focusStore);
    return { ok: true };
  },

  api_getWeekBoard: async function (dateStr) {
    const base = new Date((dateStr || vnToday()) + 'T00:00:00Z');
    const dow = base.getUTCDay() || 7;
    const monday = new Date(base); monday.setUTCDate(base.getUTCDate() - dow + 1);

    const days = [];
    for (let i = 0; i < 6; i++) {
      const cd = new Date(monday);
      cd.setUTCDate(monday.getUTCDate() + i);
      const ds = cd.toISOString().split('T')[0];
      days.push({
        date: ds,
        dowEn: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][cd.getUTCDay()],
        dowVi: ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][cd.getUTCDay()],
        label: cd.getUTCDate() + '-' + (cd.getUTCMonth() + 1)
      });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date >= ? AND date <= ? AND status != "Đã xóa"', [days[0].date, days[5].date]);

    const focusStore = await getJson('FOCUS', {});
    const leavesStore = await getJson('LEAVES', {});
    const weeklyFocus = await getJson('WEEKLY_FOCUS', { monthlyFocus: '', weeklyFocus: '' });

    const grid = {};
    days.forEach(d => {
      grid[d.date] = {};
      users.forEach(u => {
        grid[d.date][u.id] = {
          focus: focusStore[`${d.date}_${u.id}`] || '',
          tasks: tasks.filter(t => t.userId === u.id && t.date === d.date).map(t => ({
            id: t.id, task: t.task, status: t.status
          }))
        };
      });
    });

    const week = Math.ceil(parseInt(days[0].date.split('-')[2], 10) / 7);
    return {
      monday: days[0].date,
      keys: [{ month: days[0].date.substr(0, 7), week }],
      weekLabel: 'Tuần ' + days[0].label + ' → ' + days[5].label,
      leaves: leavesStore,
      monthlyFocus: weeklyFocus.monthlyFocus,
      weeklyFocus: weeklyFocus.weeklyFocus,
      days, users, grid
    };
  },

  api_saveWeeklyFocus: async function (p) {
    const weeklyFocus = await getJson('WEEKLY_FOCUS', { monthlyFocus: '', weeklyFocus: '' });
    weeklyFocus.monthlyFocus = p.monthlyFocus;
    weeklyFocus.weeklyFocus = p.weeklyFocus;
    await saveJson('WEEKLY_FOCUS', weeklyFocus);
    return { ok: true };
  },

  api_dashboard: async function (p) {
    const month = (p && p.month) || vnMonth();
    const uid = (p && p.userId) || '';
    const [allUsers] = await pool.query('SELECT * FROM users WHERE active = TRUE');

    let sql = 'SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa"';
    const params = [`${month}%`];
    if (uid) { sql += ' AND userId = ?'; params.push(uid); }
    const [tasks] = await pool.query(sql, params);

    // Tháng trước để so sánh
    const [y, m] = month.split('-').map(Number);
    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    let sqlPrev = 'SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa"';
    const paramsPrev = [`${prevMonth}%`];
    if (uid) { sqlPrev += ' AND userId = ?'; paramsPrev.push(uid); }
    const [prevTasks] = await pool.query(sqlPrev, paramsPrev);

    const done = tasks.filter(t => t.status === 'Hoàn thành').length;
    const doing = tasks.filter(t => t.status === 'Đang làm').length;
    const todo = tasks.length - done - doing;
    const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    const prevDone = prevTasks.filter(t => t.status === 'Hoàn thành').length;
    const prevRate = prevTasks.length ? Math.round((prevDone / prevTasks.length) * 100) : 0;

    // Chuỗi theo ngày (đến hôm nay nếu là tháng hiện tại)
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const isCur = month === vnMonth();
    const upto = isCur ? Math.min(lastDay, vnNow().getUTCDate()) : lastDay;
    const daily = [];
    for (let d = 1; d <= upto; d++) {
      const ds = `${month}-${String(d).padStart(2, '0')}`;
      const dayTasks = tasks.filter(t => t.date === ds);
      daily.push({ label: d + '/' + m, created: dayTasks.length, done: dayTasks.filter(t => t.status === 'Hoàn thành').length });
    }

    // Theo nhóm việc
    const catMap = {};
    tasks.forEach(t => { const c = t.category || 'Khác'; catMap[c] = (catMap[c] || 0) + 1; });
    const cats = Object.keys(catMap).map(name => ({ name, total: catMap[name] })).sort((a, b) => b.total - a.total);

    // Theo tuần trong tháng
    const weekMap = {};
    tasks.forEach(t => {
      const d = parseInt(String(t.date).split('-')[2], 10) || 1;
      const w = Math.min(5, Math.ceil(d / 7));
      weekMap[w] = (weekMap[w] || 0) + 1;
    });
    const weeks = Object.keys(weekMap).sort().map(w => ({ label: 'Tuần ' + w, total: weekMap[w] }));

    // Theo nhân sự
    const scopeUsers = uid ? allUsers.filter(u => u.id === uid) : allUsers;
    const users = scopeUsers.map(u => {
      const ts = tasks.filter(t => t.userId === u.id);
      const ud = ts.filter(t => t.status === 'Hoàn thành').length;
      const ug = ts.filter(t => t.status === 'Đang làm').length;
      const cm = {};
      ts.forEach(t => { const c = t.category || 'Khác'; cm[c] = (cm[c] || 0) + 1; });
      const topCat = Object.keys(cm).sort((a, b) => cm[b] - cm[a])[0] || '';
      return {
        id: u.id, short: u.short || u.name, total: ts.length, done: ud, doing: ug,
        todo: ts.length - ud - ug, rate: ts.length ? Math.round(ud / ts.length * 100) : 0, topCat
      };
    }).sort((a, b) => b.total - a.total);

    const activeDays = new Set(tasks.map(t => t.date)).size;
    const avgPerDay = activeDays ? Math.round(tasks.length / activeDays * 10) / 10 : 0;

    const [pendAsg] = await pool.query('SELECT COUNT(*) AS c FROM assignments WHERE status = "Chờ phản hồi"');
    const posm = await getJson('POSM', { cinemas: [] });
    let posmAlert = 0, posmTotal = 0;
    (posm.cinemas || []).forEach(c => { posmAlert += Number(c.alert) || 0; posmTotal += Number(c.total) || 0; });
    const [adsRows] = await pool.query('SELECT status FROM ads');
    const adsLive = adsRows.filter(a => a.status === 'Đang chạy').length;

    const userById = {};
    allUsers.forEach(u => { userById[u.id] = u.short || u.name; });
    const pending = tasks.filter(t => t.status !== 'Hoàn thành')
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))
      .slice(0, 50)
      .map(t => ({ date: t.date, user: userById[t.userId] || t.userId, task: t.task, cat: t.category, status: t.status }));

    const insights = [];
    if (tasks.length) {
      if (rate >= 80) insights.push({ level: 'good', title: 'Tiến độ tốt', text: `Đã hoàn thành ${rate}% khối lượng tháng này — giữ nhịp nhé!` });
      else if (rate < 50) insights.push({ level: 'warn', title: 'Tiến độ đang chậm', text: `Mới hoàn thành ${rate}% — còn ${tasks.length - done} việc chưa xong.` });
      if (users.length > 1 && users[0].total) insights.push({ level: 'info', title: 'Khối lượng lớn nhất', text: `${users[0].short} đang gánh nhiều việc nhất (${users[0].total} việc).` });
      if (cats.length) insights.push({ level: 'info', title: 'Nhóm việc nhiều nhất', text: `"${cats[0].name}" chiếm ${cats[0].total} việc trong tháng.` });
      const hiPend = tasks.filter(t => t.priority === 'Cao' && t.status !== 'Hoàn thành').length;
      if (hiPend) insights.push({ level: 'bad', title: 'Việc ưu tiên cao còn tồn', text: `Có ${hiPend} việc ưu tiên CAO chưa hoàn thành — xử lý sớm.` });
    }

    return {
      month, monthLabel: 'Tháng ' + m + '/' + y,
      scopeName: uid ? (allUsers.find(u => u.id === uid) || {}).name || '' : '',
      kpi: {
        total: tasks.length, done, doing, todo, rate,
        prevTotal: prevTasks.length, prevRate, activeDays, avgPerDay,
        pendingAsg: pendAsg[0].c, posmAlert, posmTotal, adsLive, adsAll: adsRows.length
      },
      daily, users, cats, weeks,
      heat: { rows: [], cols: [], v: [] }, pending, insights
    };
  },

  api_assignments: async function (uid) {
    const [incoming] = await pool.query(
      `SELECT a.*, uf.name AS fromName, ut.name AS toName FROM assignments a
       LEFT JOIN users uf ON a.fromId = uf.id LEFT JOIN users ut ON a.toId = ut.id
       WHERE a.toId = ? ORDER BY a.createdAt DESC`, [uid]);
    const [outgoing] = await pool.query(
      `SELECT a.*, uf.name AS fromName, ut.name AS toName FROM assignments a
       LEFT JOIN users uf ON a.fromId = uf.id LEFT JOIN users ut ON a.toId = ut.id
       WHERE a.fromId = ? ORDER BY a.createdAt DESC`, [uid]);
    return { incoming, outgoing };
  },
  api_assign: async function (p) {
    const id = genId('A');
    await pool.query('INSERT INTO assignments (id, fromId, toId, task, date, category, priority, status, response, createdAt, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id, p.fromId, p.toId, p.task, p.date, p.category, p.priority, 'Chờ phản hồi', '', new Date().toISOString(), p.note || '']);
    const [us] = await pool.query('SELECT name, short FROM users WHERE id = ?', [p.fromId]);
    const who = us.length ? (us[0].short || us[0].name) : '';
    await notify(p.toId, 'ASSIGN', `${who} giao việc cho bạn`, p.task, 'assign');
    return { ok: true };
  },
  api_respondAssignment: async function (p) {
    const [asgs] = await pool.query('SELECT * FROM assignments WHERE id = ?', [p.id]);
    if (!asgs.length) throw new Error('Không tìm thấy việc được giao');
    const a = asgs[0];
    const [us] = await pool.query('SELECT name, short FROM users WHERE id = ?', [a.toId]);
    const who = us.length ? (us[0].short || us[0].name) : '';

    if (p.action === 'accept') {
      await pool.query('UPDATE assignments SET status = "Đã nhận" WHERE id = ?', [p.id]);
      // Thêm thẳng vào tasklist người nhận đúng như lời hứa trên nút bấm
      const [uf] = await pool.query('SELECT name, short FROM users WHERE id = ?', [a.fromId]);
      const fromShort = uf.length ? (uf[0].short || uf[0].name) : '';
      await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note, assignmentId) VALUES (?,?,?,?,?,?,?,?,?)',
        [genId('T'), a.date || vnToday(), a.toId, a.task, a.category || 'Khác', a.priority || 'Thường', 'Chưa làm', `[${fromShort} giao]`, a.id]);
      await notify(a.fromId, 'ACCEPT', `${who} đã nhận việc`, a.task, 'assign');
    } else if (p.action === 'object') {
      await pool.query('UPDATE assignments SET status = "Kiến nghị", response = ? WHERE id = ?', [p.message, p.id]);
      await notify(a.fromId, 'OBJECT', `${who} kiến nghị về việc bạn giao`, p.message || a.task, 'assign');
    }
    return { ok: true };
  },

  api_notifications: async function (uid) {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE userId = ? OR userId = "ALL" ORDER BY time DESC LIMIT 100', [uid]);
    return rows.map(n => ({
      id: n.id, type: n.type, title: n.title, body: n.body,
      read: !!n.is_read, goto: n.goto || '', time: timeAgo(n.time)
    }));
  },
  api_unread: async function (uid) {
    const [u] = await pool.query(
      'SELECT * FROM notifications WHERE is_read = FALSE AND (userId = ? OR userId = "ALL") ORDER BY time DESC', [uid]);
    return { count: u.length, latest: u.length ? u[0].id : '', latestTitle: u.length ? u[0].title : '' };
  },
  api_markRead: async function (p) {
    if (p.all) await pool.query('UPDATE notifications SET is_read = TRUE WHERE userId = ? OR userId = "ALL"', [p.userId]);
    else await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [p.id]);
    return { ok: true };
  },
  api_clearNotifications: async function (uid) {
    const [r] = await pool.query('DELETE FROM notifications WHERE userId = ?', [uid]);
    return { ok: true, count: r.affectedRows || 0 };
  },

  api_getAds: async function () {
    const [ads] = await pool.query('SELECT * FROM ads');
    const settings = await getJson('META_SETTINGS', { token: '', actId: '', pageId: '' });
    return { ads, meta: { connected: !!settings.token, lastSync: settings.lastSync || '' } };
  },
  api_saveAd: async function (p) {
    if (p.id) {
      await pool.query('UPDATE ads SET userId=?, name=?, platform=?, status=?, `start`=?, `end`=?, spend=?, reach=?, impressions=?, views=?, likes=?, comments=?, shares=?, link=?, note=? WHERE id=?',
        [p.userId, p.name, p.platform, p.status, p.start, p.end, p.spend, p.reach, p.impressions, p.views, p.likes, p.comments, p.shares, p.link, p.note, p.id]);
    } else {
      await pool.query('INSERT INTO ads (id, userId, name, platform, status, `start`, `end`, spend, reach, impressions, views, likes, comments, shares, link, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [genId('AD'), p.userId, p.name, p.platform, p.status, p.start, p.end, p.spend, p.reach, p.impressions, p.views, p.likes, p.comments, p.shares, p.link, p.note]);
    }
    return { ok: true };
  },
  api_deleteAd: async function (p) {
    await pool.query('DELETE FROM ads WHERE id=?', [p.id]);
    return { ok: true };
  },

  api_getMovies: async function () {
    const [movies] = await pool.query('SELECT * FROM movies');
    const meta = await getJson('MOVIE_META', { version: '1', updatedAt: '', updatedBy: '' });
    return {
      movies: movies.map(movieOut), statuses: MOVIE_STATUSES,
      version: meta.version, updatedAt: meta.updatedAt, updatedBy: meta.updatedBy
    };
  },
  api_saveMovie: async function (p) {
    if (p.id) {
      await pool.query('UPDATE movies SET `title`=?, `releaseDate`=?, `end`=?, `status`=?, `genre`=?, `duration`=?, `format`=?, `rating`=?, `poster`=COALESCE(?, `poster`), `note`=?, `name`=? WHERE id=?',
        [p.title, p.release, p.end, p.status, p.genre, p.duration, p.format, p.rating, p.poster, p.note, p.title, p.id]);
    } else {
      await pool.query('INSERT INTO movies (id, `title`, `releaseDate`, `end`, `status`, `genre`, `duration`, `format`, `rating`, `poster`, `note`, `name`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [genId('MV'), p.title, p.release, p.end, p.status, p.genre, p.duration, p.format, p.rating, p.poster || '', p.note, p.title]);
    }
    let byName = '';
    if (p.userId) {
      const [us] = await pool.query('SELECT name, short FROM users WHERE id = ?', [p.userId]);
      byName = us.length ? (us[0].short || us[0].name) : '';
    }
    await bumpMovieMeta(byName);
    return { ok: true };
  },
  api_deleteMovie: async function (p) {
    await pool.query('DELETE FROM movies WHERE id=?', [p.id]);
    await bumpMovieMeta('');
    return { ok: true };
  },

  api_getFanpages: async function (p) {
    const range = (p && p.range) || '7d';
    const pageFilter = (p && p.page) || '';
    const { from, to, label } = rangeInfo(range);
    const today = vnToday();

    const [pagesRaw] = await pool.query('SELECT * FROM pages');
    const pages = pagesRaw.map(x => ({
      id: x.id, name: x.name, cinema: x.cinema || '', pageId: x.pageId || '',
      hasToken: !!x.token, followers: x.followers || '', link: x.link || ''
    }));

    const [postsRaw] = await pool.query('SELECT * FROM posts');
    let posts = postsRaw.map(postOut).filter(x => x.date >= from && x.date <= to);
    if (pageFilter) posts = posts.filter(x => x.page === pageFilter);

    const sum = k => posts.reduce((s, x) => s + (Number(x[k]) || 0), 0);
    const eng = sum('eng');
    const pageNames = pages.length ? pages.map(x => x.name) : Array.from(new Set(postsRaw.map(x => x.fanpage).filter(Boolean)));

    const todayPosts = postsRaw.map(postOut).filter(x => x.date === today);
    const todayStatus = pageNames.map(name => {
      const c = todayPosts.filter(x => x.page === name).length;
      const pg = pages.find(x => x.name === name);
      return { page: name, cinema: pg ? pg.cinema : '', posted: c > 0, count: c };
    });

    const byPage = pageNames.map(name => {
      const ps = posts.filter(x => x.page === name);
      const e = ps.reduce((s, x) => s + x.eng, 0);
      const pg = pages.find(x => x.name === name);
      return {
        page: name, cinema: pg ? pg.cinema : '', posts: ps.length, eng: e,
        avg: ps.length ? Math.round(e / ps.length) : 0,
        reach: ps.reduce((s, x) => s + x.reach, 0)
      };
    }).sort((a, b) => b.eng - a.eng);

    const typeMap = {};
    posts.forEach(x => {
      const t = x.type || 'Khác';
      if (!typeMap[t]) typeMap[t] = { count: 0, eng: 0 };
      typeMap[t].count++; typeMap[t].eng += x.eng;
    });
    const byType = Object.keys(typeMap).map(t => ({
      type: t, count: typeMap[t].count, avg: Math.round(typeMap[t].eng / typeMap[t].count)
    })).sort((a, b) => b.avg - a.avg);

    // Chuỗi ngày trong khoảng đang xem (giới hạn 31 điểm)
    const daily = [];
    const start = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    for (let d = new Date(start); d <= end && daily.length < 31; d.setUTCDate(d.getUTCDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      const ps = posts.filter(x => x.date === ds);
      daily.push({ label: d.getUTCDate() + '/' + (d.getUTCMonth() + 1), posts: ps.length, eng: ps.reduce((s, x) => s + x.eng, 0) });
    }

    const sorted = posts.slice().sort((a, b) => b.eng - a.eng);
    const top = sorted.slice(0, 5);
    const weak = sorted.length >= 6 ? sorted.slice(-3).reverse() : [];
    const pagesNotPosted = todayStatus.filter(s => !s.posted).length;

    const insights = [];
    if (posts.length) {
      if (byPage.length > 1) insights.push({ level: 'good', title: 'Fanpage dẫn đầu', text: `${byPage[0].cinema || byPage[0].page} có tương tác cao nhất ${label} (${byPage[0].eng}).` });
      if (byType.length) insights.push({ level: 'info', title: 'Định dạng hiệu quả', text: `Dạng "${byType[0].type}" đạt trung bình ${byType[0].avg} tương tác/bài — nên làm thêm.` });
      if (pagesNotPosted > 0) insights.push({ level: 'warn', title: 'Fanpage chưa đăng hôm nay', text: `${pagesNotPosted} fanpage chưa có bài hôm nay — đừng để trống nhịp đăng.` });
    }

    const settings = await getJson('META_SETTINGS', { token: '' });
    return {
      range, rangeLabel: label, pages, posts,
      top, weak, byPage, byType, daily, todayStatus,
      kpi: {
        posts: posts.length, eng, avg: posts.length ? Math.round(eng / posts.length) : 0,
        reach: sum('reach'), likes: sum('likes'), comments: sum('comments'), shares: sum('shares'),
        pageCount: pageNames.length, pagesNotPosted, bestPost: top[0] || null
      },
      insights, postTypes: POST_TYPES,
      meta: { connected: !!settings.token, lastSync: settings.lastSync || '' }
    };
  },
  api_savePost: async function (p) {
    if (p.id) {
      await pool.query('UPDATE posts SET userId=?, fanpage=?, date=?, content=?, type=?, reach=?, likes=?, comments=?, shares=?, link=? WHERE id=?',
        [p.userId, p.page, p.date, p.content, p.type, p.reach, p.likes, p.comments, p.shares, p.link, p.id]);
    } else {
      await pool.query('INSERT INTO posts (id, userId, fanpage, date, content, type, reach, likes, comments, shares, link) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [genId('PO'), p.userId, p.page, p.date, p.content, p.type, p.reach, p.likes, p.comments, p.shares, p.link]);
    }
    return { ok: true };
  },
  api_deletePost: async function (p) {
    await pool.query('DELETE FROM posts WHERE id=?', [p.id]);
    return { ok: true };
  },
  api_saveFanpage: async function (p) {
    if (p.id) {
      // token chỉ ghi đè khi người dùng nhập mới
      await pool.query('UPDATE pages SET name=?, pageId=?, token=COALESCE(NULLIF(?, ""), token) WHERE id=?',
        [p.name, p.pageId, p.token, p.id]);
    } else {
      await pool.query('INSERT INTO pages (id, name, pageId, token) VALUES (?,?,?,?)',
        [genId('PG'), p.name, p.pageId, p.token || '']);
    }
    return { ok: true };
  },
  api_syncFanpages: async function () {
    return { count: 0, message: 'Chưa kết nối Meta — bản này nhập số liệu tay, vẫn đầy đủ báo cáo.' };
  },
  api_syncAdsFromMeta: async function () {
    return { count: 0, message: 'Chưa kết nối Meta — bản này nhập số liệu tay, vẫn đầy đủ báo cáo.' };
  },
  api_getMetaSettings: async function () {
    const s = await getJson('META_SETTINGS', { token: '', actId: '', pageId: '' });
    return {
      tokenMasked: s.token ? s.token.slice(0, 6) + '••••••••' : '',
      actId: s.actId || '', pageId: s.pageId || ''
    };
  },
  api_saveMetaSettings: async function (p) {
    const s = await getJson('META_SETTINGS', { token: '', actId: '', pageId: '' });
    if (p.token && p.token.indexOf('••') === -1) s.token = p.token;
    s.actId = p.actId || '';
    s.pageId = p.pageId || '';
    await saveJson('META_SETTINGS', s);
    return { ok: true };
  },
  api_testMeta: async function () {
    return { ok: false, message: 'Bản MySQL chưa gọi trực tiếp Meta API — số liệu nhập tay vẫn hoạt động đầy đủ.' };
  },

  api_pulse: async function (p) {
    const uid = p && p.userId;
    await touchPresence(uid);

    const today = vnToday();
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date = ? AND status != "Đã xóa"', [today]);
    const leaves = await getJson('LEAVES', {});
    const pres = await getPresence();
    const now = Date.now();

    const presence = users.map(u => {
      const ts = tasks.filter(t => t.userId === u.id);
      const doingList = ts.filter(t => t.status === 'Đang làm');
      const pr = pres[u.id] || {};
      const online = pr.lastSeen && (now - pr.lastSeen) < 2 * 60 * 1000;
      return {
        id: u.id, name: u.name, short: u.short || u.name,
        online: !!online,
        lastSeen: pr.lastSeen ? timeAgo(new Date(pr.lastSeen).toISOString()) : 'chưa vào',
        leave: leaves[`${today}|${u.id}`] || '',
        doing: doingList.length ? doingList[0].task : '',
        doingMore: Math.max(0, doingList.length - 1),
        done: ts.filter(t => t.status === 'Hoàn thành').length,
        total: ts.length,
        note: pr.note || '', noteAt: pr.noteAt ? timeAgo(pr.noteAt) : ''
      };
    });

    const [un] = await pool.query('SELECT COUNT(*) AS c FROM notifications WHERE is_read = FALSE AND (userId = ? OR userId = "ALL")', [uid]);
    const [pendAsg] = await pool.query('SELECT COUNT(*) AS c FROM assignments WHERE toId = ? AND status = "Chờ phản hồi"', [uid]);
    const movieMeta = await getJson('MOVIE_META', { version: '1' });

    return {
      unread: { count: un[0].c },
      assignPending: pendAsg[0].c,
      movieVer: movieMeta.version,
      presence
    };
  },
  api_ping: async function (uid, ver) {
    await touchPresence(uid);
    const [u] = await pool.query(
      'SELECT * FROM notifications WHERE is_read = FALSE AND (userId = ? OR userId = "ALL") ORDER BY time DESC', [uid]);
    const latest = u[0];
    const v = u.length + '|' + (latest ? latest.id : '');
    return {
      changed: v !== ver, count: u.length, v,
      title: latest ? latest.title : '', type: latest ? latest.type : ''
    };
  },
  api_setStatus: async function (p) {
    const pres = await getPresence();
    if (!pres[p.userId]) pres[p.userId] = { note: '', noteAt: '', lastSeen: Date.now() };
    pres[p.userId].note = p.text || '';
    pres[p.userId].noteAt = p.text ? new Date().toISOString() : '';
    await saveJson('PRESENCE', pres);
    return { ok: true };
  },
  api_setLeave: async function (p) {
    const leaves = await getJson('LEAVES', {});
    if (p.type) leaves[`${p.date}|${p.userId}`] = p.type;
    else delete leaves[`${p.date}|${p.userId}`];
    await saveJson('LEAVES', leaves);
    return { type: p.type || '' };
  },

  api_getPosm: async function () {
    const posm = await getJson('POSM', { cinemas: [{ name: 'BUÔN MA THUỘT', sheetName: 'BUÔN MA THUỘT', total: 0, alert: 0, oldFilm: 0, ok: 0, items: [] }] });
    return posm;
  },
  api_addPosmItem: async function (p) {
    const posm = await getJson('POSM', { cinemas: [] });
    const cin = posm.cinemas.find(c => c.sheetName === p.sheetName);
    if (cin) {
      cin.items.push({ stt: cin.items.length + 1, row: cin.items.length + 6, ...p });
      recountPosm(cin);
      await saveJson('POSM', posm);
    }
    return { ok: true };
  },
  api_savePosm: async function (p) {
    const posm = await getJson('POSM', { cinemas: [] });
    p.changes.forEach(ch => {
      const cin = posm.cinemas.find(c => c.sheetName === ch.sheetName);
      if (cin) {
        const it = cin.items.find(x => x.row === ch.row);
        if (it) Object.assign(it, ch);
        recountPosm(cin);
      }
    });
    await saveJson('POSM', posm);
    return { ok: true, count: p.changes.length };
  },

  /* ------------------------- Báo cáo tháng ------------------------- */
  api_myReports: async function (uid) {
    const [us] = await pool.query('SELECT * FROM users WHERE id = ?', [uid]);
    const u = us[0] || {};
    const [pages] = await pool.query('SELECT * FROM pages');
    const template = (u.isDesigner && !u.isContent) ? DESIGN_TEMPLATE : contentTemplate(pages);
    // Bỏ qua các dòng rác do bản backend cũ tạo ra (không lưu được tháng/số liệu)
    const [rows] = await pool.query('SELECT * FROM reports WHERE userId = ? AND `month` IS NOT NULL ORDER BY `month` DESC', [uid]);
    return { reports: rows.map(parseReportRow), template, curMonth: vnMonth() };
  },
  api_saveReport: async function (p) {
    let id = p.id;
    const data = JSON.stringify(p.data || {});
    if (id) {
      await pool.query('UPDATE reports SET `month`=?, from_date=?, to_date=?, `type`=?, `data`=? WHERE id=?',
        [p.month, p.from, p.to, p.type, data, id]);
    } else {
      id = genId('RP');
      await pool.query('INSERT INTO reports (id, userId, `month`, from_date, to_date, `type`, `data`, status) VALUES (?,?,?,?,?,?,?,?)',
        [id, p.userId, p.month, p.from, p.to, p.type, data, 'Nháp']);
    }
    return { id };
  },
  api_submitReport: async function (p) {
    await pool.query('UPDATE reports SET status="Đã gửi", sentAt=? WHERE id=?', [new Date().toISOString(), p.id]);
    // Báo cho các admin biết có báo cáo mới
    const [rows] = await pool.query('SELECT r.*, u.name AS userName FROM reports r LEFT JOIN users u ON r.userId = u.id WHERE r.id = ?', [p.id]);
    if (rows.length) {
      const [admins] = await pool.query('SELECT id FROM users WHERE role = "admin" AND active = TRUE');
      for (const ad of admins) {
        if (ad.id !== rows[0].userId) await notify(ad.id, 'SYS', `${rows[0].userName} vừa gửi báo cáo tháng`, 'Vào tab Báo cáo để xem và xác nhận.', 'rp');
      }
    }
    return { ok: true };
  },
  api_deleteReport: async function (p) {
    await pool.query('DELETE FROM reports WHERE id=?', [p.id]);
    return { ok: true };
  },
  api_allReports: async function () {
    const [rows] = await pool.query('SELECT r.*, u.name AS userName FROM reports r LEFT JOIN users u ON r.userId = u.id WHERE r.`month` IS NOT NULL ORDER BY r.`month` DESC');
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE AND role != "admin"');
    const [pages] = await pool.query('SELECT * FROM pages');
    const curMonth = vnMonth();
    const sentThisMonth = new Set(rows.filter(r => r.month === curMonth && (r.status === 'Đã gửi' || r.status === 'Đã nhận')).map(r => r.userId));
    const missing = users.filter(u => !sentThisMonth.has(u.id)).map(u => ({ id: u.id, short: u.short || u.name }));
    return {
      curMonth, missing,
      reports: rows.map(r => ({ ...parseReportRow(r), userName: r.userName || r.userId })),
      templates: { content: contentTemplate(pages), design: DESIGN_TEMPLATE }
    };
  },
  api_receiveReport: async function (p) {
    await pool.query('UPDATE reports SET status="Đã nhận", adminNote=?, managerNote=?, receivedAt=?, receivedBy=? WHERE id=?',
      [p.note, p.note, new Date().toISOString(), p.userId, p.id]);
    const [rows] = await pool.query('SELECT * FROM reports WHERE id = ?', [p.id]);
    if (rows.length) {
      await notify(rows[0].userId, 'SYS', 'Trưởng bộ phận đã nhận báo cáo của bạn',
        (p.note ? 'Nhận xét: ' + p.note : 'Báo cáo tháng ' + (rows[0].month || '') + ' đã được xác nhận.'), 'rp');
    }
    return { ok: true };
  },

  /* ------------------------- Xuất Excel + danh sách file ------------------------- */
  api_exportMonth: async function (month, uid) {
    const [tasks] = await pool.query(
      'SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa" ORDER BY date, userId', [`${month}%`]);
    const [users] = await pool.query('SELECT * FROM users');
    const nameOf = {};
    users.forEach(u => { nameOf[u.id] = u.short || u.name; });

    const wb = new ExcelJS.Workbook();
    const header = ['Ngày', 'Nhân sự', 'Công việc', 'Nhóm', 'Ưu tiên', 'Trạng thái', 'Ghi chú'];
    const headerStyle = ws => {
      const r = ws.getRow(1);
      r.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF26F21' } };
      ws.columns = [{ width: 12 }, { width: 16 }, { width: 55 }, { width: 18 }, { width: 10 }, { width: 12 }, { width: 30 }];
    };

    // Nhóm theo tuần trong tháng
    const byWeek = {};
    tasks.forEach(t => {
      const d = parseInt(String(t.date).split('-')[2], 10) || 1;
      const w = Math.min(5, Math.ceil(d / 7));
      (byWeek[w] = byWeek[w] || []).push(t);
    });
    const weekNums = Object.keys(byWeek).sort();
    weekNums.forEach(w => {
      const ws = wb.addWorksheet('Tuần ' + w);
      ws.addRow(header); headerStyle(ws);
      byWeek[w].forEach(t => {
        ws.addRow([t.date, nameOf[t.userId] || t.userId, t.task, t.category, t.priority, t.status, t.note || '']);
      });
    });

    // Sheet phân tích
    const ws = wb.addWorksheet('Phân tích');
    ws.addRow(['Nhân sự', 'Tổng việc', 'Hoàn thành', 'Đang làm', 'Chưa làm', 'Tỉ lệ %']); headerStyle(ws);
    users.filter(u => u.active).forEach(u => {
      const ts = tasks.filter(t => t.userId === u.id);
      if (!ts.length) return;
      const done = ts.filter(t => t.status === 'Hoàn thành').length;
      const doing = ts.filter(t => t.status === 'Đang làm').length;
      ws.addRow([u.short || u.name, ts.length, done, doing, ts.length - done - doing, ts.length ? Math.round(done / ts.length * 100) : 0]);
    });
    ws.addRow([]);
    ws.addRow(['Nhóm việc', 'Số việc']);
    const catMap = {};
    tasks.forEach(t => { const c = t.category || 'Khác'; catMap[c] = (catMap[c] || 0) + 1; });
    Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).forEach(c => ws.addRow([c, catMap[c]]));

    const fileName = `Starlight_BaoCao_${month}_${Date.now()}.xlsx`;
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    await wb.xlsx.writeFile(path.join(UPLOADS_DIR, fileName));
    const url = '/uploads/' + fileName;
    return { fileName, weeks: weekNums.length, taskCount: tasks.length, downloadUrl: url, viewUrl: url };
  },
  api_listReports: async function () {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    const files = fs.readdirSync(UPLOADS_DIR)
      .filter(f => f.endsWith('.xlsx'))
      .map(f => {
        const st = fs.statSync(path.join(UPLOADS_DIR, f));
        return {
          name: f, created: fmtDateTime(st.mtime.toISOString()), size: humanSize(st.size),
          downloadUrl: '/uploads/' + f, url: '/uploads/' + f, mtime: st.mtimeMs
        };
      })
      .sort((a, b) => b.mtime - a.mtime);
    return files;
  },

  api_dashExtras: async function () {
    return { upcoming: { items: [], today: vnToday() }, timeline: { items: [] } };
  },
  api_listUsers: async function () { const [users] = await pool.query('SELECT * FROM users'); return users.map(u => ({ ...u, active: !!u.active })); },

  /* ------------------------- Quy trình ------------------------- */
  api_getProcedures: async function () {
    const [items] = await pool.query('SELECT * FROM procedures');
    return {
      items: items.map(i => ({
        id: i.id, category: i.category || 'Khác', title: i.title, note: i.note || '',
        code: i.code || '', version: i.version || '1.0', status: i.status || 'Đã ban hành',
        issued: i.issued || '', by: i.byName || '', fileId: i.fileId || '',
        viewUrl: i.viewUrl || i.link || '', downloadUrl: i.downloadUrl || i.link || ''
      })),
      categories: ['Vận hành', 'Marketing / Content', 'Thiết kế', 'Sự kiện', 'Nhân sự', 'Khác'],
      statuses: ['Đã ban hành', 'Bản nháp', 'Hết hiệu lực']
    };
  },
  api_saveProcedure: async function (p) {
    let byName = '';
    if (p.userId) {
      const [us] = await pool.query('SELECT name, short FROM users WHERE id = ?', [p.userId]);
      byName = us.length ? (us[0].short || us[0].name) : '';
    }
    if (p.id) {
      await pool.query('UPDATE procedures SET category=?, title=?, note=?, `code`=?, `version`=?, `status`=?, issued=?, fileId=COALESCE(?, fileId), viewUrl=COALESCE(?, viewUrl), downloadUrl=COALESCE(?, downloadUrl) WHERE id=?',
        [p.category, p.title, p.note, p.code, p.version, p.status, p.issued, p.fileId, p.viewUrl, p.downloadUrl, p.id]);
    } else {
      await pool.query('INSERT INTO procedures (id, category, title, note, `code`, `version`, `status`, issued, byName, fileId, viewUrl, downloadUrl) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [genId('QT'), p.category, p.title, p.note, p.code, p.version, p.status, p.issued, byName, p.fileId, p.viewUrl, p.downloadUrl]);
    }
    return { ok: true };
  },
  api_deleteProcedure: async function (p) {
    await pool.query('DELETE FROM procedures WHERE id=?', [p.id]);
    return { ok: true };
  },

  /* ------------------------- Radar đối thủ ------------------------- */
  api_getRivals: async function () {
    const [rows] = await pool.query('SELECT * FROM rivals ORDER BY snapshot DESC');
    const items = rows.map(r => ({
      id: r.id, userId: r.userId, brand: r.brand || r.rivalName || '', format: r.format || '',
      running: r.running || '', text: r.text || r.note || '', start: r.start || '',
      likes: num(r.likes), views: num(r.views), link: r.link || '', insight: r.insight || '',
      snapshot: r.snapshot || r.date || ''
    }));
    const brandNames = Array.from(new Set(RIVAL_BRANDS.concat(items.map(i => i.brand).filter(Boolean))));
    const brands = brandNames.map(name => ({
      name, url: adLibraryUrl(name),
      logged: items.filter(i => i.brand === name).length,
      running: items.filter(i => i.brand === name && i.running === 'Còn chạy').length
    }));
    const byBrand = brands.filter(b => b.logged > 0).map(b => ({ brand: b.name, running: b.running, total: b.logged }));
    const fmtMap = {};
    items.forEach(i => { const f = i.format || 'Khác'; fmtMap[f] = (fmtMap[f] || 0) + 1; });
    const byFormat = Object.keys(fmtMap).map(f => ({ format: f, count: fmtMap[f] }));
    return { items, brands, byBrand, byFormat, apiNote: '' };
  },
  api_saveRival: async function (p) {
    if (p.id) {
      await pool.query('UPDATE rivals SET userId=?, `brand`=?, `format`=?, `running`=?, `text`=?, `start`=?, `likes`=?, `views`=?, `link`=?, `insight`=? WHERE id=?',
        [p.userId, p.brand, p.format, p.running, p.text, p.start, p.likes, p.views, p.link, p.insight, p.id]);
    } else {
      await pool.query('INSERT INTO rivals (id, userId, `brand`, `format`, `running`, `text`, `start`, `likes`, `views`, `link`, `insight`, `snapshot`) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
        [genId('RV'), p.userId, p.brand, p.format, p.running, p.text, p.start, p.likes, p.views, p.link, p.insight, vnToday()]);
    }
    return { ok: true };
  },
  api_deleteRival: async function (p) {
    await pool.query('DELETE FROM rivals WHERE id=?', [p.id]);
    return { ok: true };
  },

  /* ------------------------- Tra cứu tháng cũ ------------------------- */
  api_getArchive: async function (month, uid) {
    const m = month || vnMonth();
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa" ORDER BY date', [`${m}%`]);
    const [users] = await pool.query('SELECT * FROM users');
    const nameOf = {};
    users.forEach(u => { nameOf[u.id] = u.short || u.name; });

    const done = tasks.filter(t => t.status === 'Hoàn thành').length;
    const doing = tasks.filter(t => t.status === 'Đang làm').length;

    const uMap = {};
    tasks.forEach(t => {
      if (!uMap[t.userId]) uMap[t.userId] = { short: nameOf[t.userId] || t.userId, total: 0, done: 0 };
      uMap[t.userId].total++;
      if (t.status === 'Hoàn thành') uMap[t.userId].done++;
    });
    const catMap = {};
    tasks.forEach(t => { const c = t.category || 'Khác'; catMap[c] = (catMap[c] || 0) + 1; });

    // File Excel đã xuất cho tháng này (nếu có)
    let reportUrl = '';
    try {
      const f = fs.readdirSync(UPLOADS_DIR).filter(x => x.startsWith(`Starlight_BaoCao_${m}_`)).sort().pop();
      if (f) reportUrl = '/uploads/' + f;
    } catch (e) { /* thư mục chưa tồn tại */ }

    const [yy, mm] = m.split('-').map(Number);
    return {
      month: m, monthLabel: 'Tháng ' + mm + '/' + yy,
      archived: m < vnMonth(), archivedAt: '', reportUrl,
      kpi: {
        total: tasks.length, done, doing, todo: tasks.length - done - doing,
        rate: tasks.length ? Math.round(done / tasks.length * 100) : 0
      },
      tasks: tasks.map(t => ({ date: t.date, user: nameOf[t.userId] || t.userId, task: t.task, cat: t.category, status: t.status })),
      users: Object.values(uMap).sort((a, b) => b.total - a.total),
      cats: Object.keys(catMap).map(name => ({ name, total: catMap[name] })).sort((a, b) => b.total - a.total)
    };
  },

  api_getStats: async function (month) {
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa"', [`${month}%`]);

    const stats = { total: tasks.length, byUser: {} };
    users.forEach(u => {
      stats.byUser[u.id] = { name: u.short || u.name, total: 0, done: 0, doing: 0, todo: 0 };
    });

    tasks.forEach(t => {
      const u = stats.byUser[t.userId];
      if (u) {
        u.total++;
        if (t.status === 'Hoàn thành') u.done++;
        else if (t.status === 'Đang làm') u.doing++;
        else u.todo++;
      }
    });
    return stats;
  },

  /* ------------------------- Nhân sự ------------------------- */
  api_addUser: async function (p) {
    let id;
    // id ngắn (cột VARCHAR(10)) — thử tối đa 10 lần tránh trùng
    for (let i = 0; i < 10; i++) {
      id = 'U' + Math.floor(Math.random() * 1000000);
      const [dup] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
      if (!dup.length) break;
    }
    const pass = p.password || '123456';
    await pool.query('INSERT INTO users (id, name, short, role, position, password, isDesigner, isContent, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
      [id, p.name, p.short, p.role, p.position, pass, !!p.isDesigner, !!p.isContent]);
    return { ok: true, id };
  },
  api_updateUser: async function (p) {
    if (p.password) {
      await pool.query('UPDATE users SET name=?, short=?, role=?, position=?, password=?, isDesigner=?, isContent=? WHERE id=?',
        [p.name, p.short, p.role, p.position, p.password, !!p.isDesigner, !!p.isContent, p.id]);
    } else {
      await pool.query('UPDATE users SET name=?, short=?, role=?, position=?, isDesigner=?, isContent=? WHERE id=?',
        [p.name, p.short, p.role, p.position, !!p.isDesigner, !!p.isContent, p.id]);
    }
    return { ok: true };
  },
  api_removeUser: async function (p) {
    await pool.query('UPDATE users SET active = FALSE WHERE id=?', [p.id]);
    return { ok: true };
  },
  api_restoreUser: async function (p) {
    await pool.query('UPDATE users SET active = TRUE WHERE id=?', [p.id]);
    return { ok: true };
  },

  api_holidayTimeline: async function () { return { items: [] }; },
  api_uploadPoster: async function (p) { return saveBase64File(p.data, 'poster'); },
  api_uploadProcFile: async function (p) { return saveBase64File(p.data, 'proc'); },
  api_uploadLeaveFile: async function (p) { return saveBase64File(p.data, 'leave'); }
};

// Đếm lại tổng / cảnh báo của một rạp POSM sau khi sửa items
function recountPosm(cin) {
  cin.total = cin.items.length;
  cin.alert = cin.items.filter(i => /cũ \/ rách/i.test(i.status || '')).length;
  cin.oldFilm = cin.items.filter(i => /phim cũ/i.test(i.status || '')).length;
  cin.ok = cin.items.filter(i => /^ok/i.test(i.status || '')).length;
}
