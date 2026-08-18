const pool = require('../../db');

// Generate an ID
function genId(prefix) { return prefix + Date.now() + Math.floor(Math.random()*1000); }

// Helper for JSON store
async function getJson(key, defaultVal) {
    const [rows] = await pool.query('SELECT store_value FROM json_store WHERE store_key = ?', [key]);
    if (rows.length > 0) return rows[0].store_value;
    return defaultVal;
}
async function saveJson(key, val) {
    await pool.query('INSERT INTO json_store (store_key, store_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE store_value = VALUES(store_value)', [key, JSON.stringify(val)]);
}

module.exports = {
  api_bootstrap: async function() {
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const categories = ['Fanpage / Content','Thiết kế','Ads','TikTok','Biên tập','POSM','KOL / KOC','Sự kiện','Đề xuất / Giấy tờ','Báo cáo','Khác'];
    const statuses = ['Chưa làm','Đang làm','Hoàn thành'];
    
    // Convert isDesigner/isContent to boolean
    const formattedUsers = users.map(u => ({
      ...u,
      isDesigner: !!u.isDesigner,
      isContent: !!u.isContent,
      active: !!u.active
    }));

    const [movies] = await pool.query('SELECT * FROM movies');

    return {
      users: formattedUsers,
      categories,
      statuses,
      priorities: ['Cao','Thường','Thấp'],
      posmStatuses: ['OK - Tốt','Phim Cũ','Cũ / Rách'],
      today: new Date().toISOString().split('T')[0],
      hasPosm: true, posmUrl: '#', dbUrl: '#',
      months: ['2026-08','2026-07','2026-06'],
      curMonth: '2026-08', rollover: null,
      adPlatforms: ['Facebook','Instagram','TikTok','Google','Khác'],
      adStatuses: ['Đang chạy','Đã tắt','Tạm dừng','Chờ duyệt'],
      leaveTypes: ['Nghỉ phép cả ngày','Nghỉ buổi sáng','Nghỉ buổi chiều'],
      movieStatuses: ['Đang chiếu','Sắp chiếu','Ngừng chiếu'],
      version: 'v6.1 (MySQL 100%)', dayOfMonth: new Date().getDate(),
      movies: { movies: movies, statuses: ['Đang chiếu','Sắp chiếu','Ngừng chiếu'], version: '1', updatedAt: '', updatedBy: '' }
    };
  },

  api_login: async function(n, p) {
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE AND LOWER(name) LIKE ?', [`%${n.toLowerCase()}%`]);
    if (users.length === 0) throw new Error('Không tìm thấy nhân sự');
    const u = users[0];
    if (u.password !== p) throw new Error('Mật khẩu không chính xác');
    delete u.password;
    return { ...u, isDesigner: !!u.isDesigner, isContent: !!u.isContent, active: !!u.active };
  },

  api_getDay: async function(date, uid) {
    const d = date || new Date().toISOString().split('T')[0];
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date = ? AND userId = ? AND status != "Đã xóa"', [d, uid]);
    
    const focusStore = await getJson('FOCUS', {});
    const leaveStore = await getJson('LEAVES', {});

    return {
      tasks: tasks,
      focus: focusStore[`${d}_${uid}`] || '',
      leave: leaveStore[`${d}|${uid}`] || '',
      leaveTypes: ['Nghỉ phép cả ngày','Nghỉ buổi sáng','Nghỉ buổi chiều']
    };
  },

  api_addTask: async function(p) {
    const id = genId('T');
    await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, p.date, p.userId, p.task, p.category, p.priority, 'Chưa làm', '']);
    return {id};
  },

  api_updateTask: async function(p) {
    await pool.query(`UPDATE tasks SET task = COALESCE(?, task), category = COALESCE(?, category), priority = COALESCE(?, priority), status = COALESCE(?, status), note = COALESCE(?, note) WHERE id = ?`, 
        [p.task, p.category, p.priority, p.status, p.note, p.id]);
    return {ok: true};
  },

  api_deleteTask: async function(id) {
    await pool.query('UPDATE tasks SET status = "Đã xóa" WHERE id = ?', [id]);
    return {ok: true};
  },

  api_addTasksBulk: async function(p) {
    const lines = p.text.split('\n').map(l => l.trim().replace(/^[-•]/, '').trim()).filter(l => l);
    for (const line of lines) {
      const id = genId('T');
      await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, p.date, p.userId, line, p.category, p.priority, 'Chưa làm', '']);
    }
    return {count: lines.length};
  },

  api_carryOver: async function(p) {
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE userId = ? AND date < ? AND status != "Hoàn thành" AND status != "Đã xóa" ORDER BY date DESC', [p.userId, p.date]);
    if (tasks.length === 0) return {count: 0};
    
    const fromDate = tasks[0].date;
    const [unfTasks] = await pool.query('SELECT * FROM tasks WHERE userId = ? AND date = ? AND status != "Hoàn thành" AND status != "Đã xóa"', [p.userId, fromDate]);
    
    for (const t of unfTasks) {
      const id = genId('T');
      await pool.query('INSERT INTO tasks (id, date, userId, task, category, priority, status, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, p.date, p.userId, t.task, t.category, t.priority, t.status, t.note]);
      await pool.query('UPDATE tasks SET status = "Hoàn thành", note = "Đã chuyển sang ngày mới" WHERE id = ?', [t.id]);
    }
    return {count: unfTasks.length, from: fromDate.toISOString().split('T')[0]};
  },

  api_saveFocus: async function(p) {
    const focusStore = await getJson('FOCUS', {});
    focusStore[`${p.date}_${p.userId}`] = p.focus;
    await saveJson('FOCUS', focusStore);
    return {ok: true};
  },

  api_getWeekBoard: async function(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6:1);
    const monday = new Date(d.setDate(diff));
    
    const days = [];
    for(let i=0; i<6; i++) {
        const cd = new Date(monday);
        cd.setDate(monday.getDate() + i);
        const ds = cd.toISOString().split('T')[0];
        days.push({
            date: ds,
            dowEn: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][cd.getDay()],
            dowVi: ['CN','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'][cd.getDay()],
            label: cd.getDate() + '-' + (cd.getMonth()+1)
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
                tasks: tasks.filter(t => t.userId === u.id && t.date.toISOString().split('T')[0] === d.date).map(t => ({
                    id: t.id, task: t.task, status: t.status
                }))
            };
        });
    });

    return {
        monday: days[0].date, keys: [{month: '2026-08', week: 3}], weekLabel: 'Tuần này',
        leaves: leavesStore,
        monthlyFocus: weeklyFocus.monthlyFocus,
        weeklyFocus: weeklyFocus.weeklyFocus,
        days: days, users: users, grid: grid
    };
  },

  api_saveWeeklyFocus: async function(p) {
    const weeklyFocus = await getJson('WEEKLY_FOCUS', { monthlyFocus: '', weeklyFocus: '' });
    weeklyFocus.monthlyFocus = p.monthlyFocus;
    weeklyFocus.weeklyFocus = p.weeklyFocus;
    await saveJson('WEEKLY_FOCUS', weeklyFocus);
    return {ok: true};
  },

  api_dashboard: async function(p) {
    const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
    const [tasks] = await pool.query('SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa"', [`${p.month}%`]);
    const done = tasks.filter(t => t.status === 'Hoàn thành').length;
    const doing = tasks.filter(t => t.status === 'Đang làm').length;
    const todo = tasks.length - done - doing;
    const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
    
    return {
        month: p.month, monthLabel: 'Tháng ' + p.month,
        scopeName: p.userId ? users.find(u => u.id === p.userId)?.name : '',
        kpi: {total: tasks.length, done, doing, todo, rate, prevTotal: 0, prevRate: 0, activeDays: 0, avgPerDay: 0, pendingAsg: 0, posmAlert: 0, posmTotal: 0, adsLive: 0, adsAll: 0},
        daily: [], users: users.map(u => ({id: u.id, short: u.short, total: tasks.filter(t => t.userId === u.id).length, done: tasks.filter(t => t.userId === u.id && t.status === 'Hoàn thành').length, doing: 0, todo: 0, rate: 0, topCat: ''})),
        cats: [], weeks: [], heat: {rows: [], cols: [], v: []}, pending: [], insights: []
    };
  },

  api_assignments: async function(uid) {
    const [incoming] = await pool.query('SELECT * FROM assignments WHERE toId = ?', [uid]);
    const [outgoing] = await pool.query('SELECT * FROM assignments WHERE fromId = ?', [uid]);
    return { incoming, outgoing };
  },
  api_assign: async function(p) {
    const id = genId('A');
    await pool.query('INSERT INTO assignments (id, fromId, toId, task, date, category, priority, status, response, createdAt, note) VALUES (?,?,?,?,?,?,?,?,?,?,?)', 
        [id, p.fromId, p.toId, p.task, p.date, p.category, p.priority, 'Chờ phản hồi', '', new Date().toISOString(), p.note || '']);
    const nid = genId('N');
    await pool.query('INSERT INTO notifications (id, userId, type, title, body, time) VALUES (?,?,?,?,?,?)',
        [nid, p.toId, 'ASSIGN', 'Bạn có việc mới', p.task, 'Vừa xong']);
    return {ok: true};
  },
  api_respondAssignment: async function(p) {
    if(p.action === 'accept') {
        await pool.query('UPDATE assignments SET status = "Đã nhận" WHERE id = ?', [p.id]);
    } else if(p.action === 'object') {
        await pool.query('UPDATE assignments SET status = "Kiến nghị", response = ? WHERE id = ?', [p.message, p.id]);
    }
    return {ok: true};
  },
  api_notifications: async function() { 
      const [rows] = await pool.query('SELECT * FROM notifications ORDER BY time DESC');
      return rows;
  },
  api_unread: async function() { 
      const [u] = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE');
      return { count: u.length, latest: u.length ? u[0].id : '', latestTitle: u.length ? u[0].title : '' };
  },
  api_markRead: async function(p) {
      if(p.all) await pool.query('UPDATE notifications SET is_read = TRUE');
      else await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [p.id]);
      return {ok: true};
  },
  api_clearNotifications: async function() { 
      await pool.query('DELETE FROM notifications'); 
      return {ok: true}; 
  },
  
  api_getAds: async function() { 
      const [ads] = await pool.query('SELECT * FROM ads'); 
      return { ads: ads, meta: {connected: false} }; 
  },
  api_saveAd: async function(p) {
      if(p.id) {
          await pool.query('UPDATE ads SET userId=?, name=?, platform=?, status=?, start=?, end=?, spend=?, reach=?, impressions=?, views=?, likes=?, comments=?, shares=?, link=?, note=? WHERE id=?',
              [p.userId, p.name, p.platform, p.status, p.start, p.end, p.spend, p.reach, p.impressions, p.views, p.likes, p.comments, p.shares, p.link, p.note, p.id]);
      } else {
          await pool.query('INSERT INTO ads (id, userId, name, platform, status, start, end, spend, reach, impressions, views, likes, comments, shares, link, note) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              [genId('AD'), p.userId, p.name, p.platform, p.status, p.start, p.end, p.spend, p.reach, p.impressions, p.views, p.likes, p.comments, p.shares, p.link, p.note]);
      }
      return {ok: true};
  },
  api_deleteAd: async function(p) { 
      await pool.query('DELETE FROM ads WHERE id=?', [p.id]); 
      return {ok: true}; 
  },
  
  api_getMovies: async function() { 
      const [movies] = await pool.query('SELECT * FROM movies');
      return { movies: movies, statuses: ['Đang chiếu','Sắp chiếu','Ngừng chiếu'] }; 
  },
  api_saveMovie: async function(p) {
      if(p.id) {
          await pool.query('UPDATE movies SET name=?, type=?, premiere=?, end=?, status=?, note=? WHERE id=?', 
              [p.name, p.type, p.premiere, p.end, p.status, p.note, p.id]);
      } else {
          await pool.query('INSERT INTO movies (id, name, type, premiere, end, status, note) VALUES (?,?,?,?,?,?,?)', 
              [genId('MV'), p.name, p.type, p.premiere, p.end, p.status, p.note]);
      }
      return {ok: true};
  },
  api_deleteMovie: async function(p) { 
      await pool.query('DELETE FROM movies WHERE id=?', [p.id]); 
      return {ok: true}; 
  },
  
  api_getFanpages: async function(p) {
      const [pages] = await pool.query('SELECT * FROM pages');
      const [posts] = await pool.query('SELECT * FROM posts');
      return { range: '7d', rangeLabel: '7 ngày', pages: pages, posts: posts, top: [], weak: [], byPage: [], byType: [], daily: [], todayStatus: [], kpi: {}, insights: [], meta: {} };
  },
  api_savePost: async function(p) {
      if(p.id) {
          await pool.query('UPDATE posts SET userId=?, fanpage=?, date=?, content=?, type=?, reach=?, interact=?, link=? WHERE id=?',
              [p.userId, p.fanpage, p.date, p.content, p.type, p.reach, p.interact, p.link, p.id]);
      } else {
          await pool.query('INSERT INTO posts (id, userId, fanpage, date, content, type, reach, interact, link) VALUES (?,?,?,?,?,?,?,?,?)',
              [genId('PO'), p.userId, p.fanpage, p.date, p.content, p.type, p.reach, p.interact, p.link]);
      }
      return {ok: true};
  },
  api_deletePost: async function(p) { 
      await pool.query('DELETE FROM posts WHERE id=?', [p.id]); 
      return {ok: true}; 
  },
  
  api_pulse: async function() {
      const [u] = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE');
      const presStore = await getJson('PRESENCE', []);
      return { unread: { count: u.length }, presence: presStore };
  },
  api_ping: async function() {
      const [u] = await pool.query('SELECT * FROM notifications WHERE is_read = FALSE');
      return { changed: u.length > 0, count: u.length, v: 'v2' };
  },
  api_setStatus: async function(p) {
      const presStore = await getJson('PRESENCE', []);
      let pr = presStore.find(x => x.id === p.userId);
      if(pr) { pr.note = p.text; pr.noteAt = new Date().toISOString(); }
      else { presStore.push({id: p.userId, note: p.text, noteAt: new Date().toISOString()}); }
      await saveJson('PRESENCE', presStore);
      return {ok: true};
  },
  api_setLeave: async function(p) {
      const leaves = await getJson('LEAVES', {});
      if(p.type) leaves[`${p.date}|${p.userId}`] = p.type;
      else delete leaves[`${p.date}|${p.userId}`];
      await saveJson('LEAVES', leaves);
      return {type: p.type || ''};
  },
  
  api_getPosm: async function() {
      const posm = await getJson('POSM', {cinemas: [{ name: 'BUÔN MA THUỘT', sheetName: 'BUÔN MA THUỘT', total: 0, alert: 0, oldFilm: 0, ok: 0, items: [] }]});
      return posm;
  },
  api_addPosmItem: async function(p) {
      const posm = await getJson('POSM', {cinemas: []});
      const cin = posm.cinemas.find(c => c.sheetName === p.sheetName);
      if(cin) {
          cin.items.push({ stt: cin.items.length + 1, row: cin.items.length + 6, ...p });
          cin.total++;
          await saveJson('POSM', posm);
      }
      return {ok: true};
  },
  api_savePosm: async function(p) {
      const posm = await getJson('POSM', {cinemas: []});
      p.changes.forEach(ch => {
          const cin = posm.cinemas.find(c => c.sheetName === ch.sheetName);
          if(cin) {
              const it = cin.items.find(x => x.row === ch.row);
              if(it) Object.assign(it, ch);
          }
      });
      await saveJson('POSM', posm);
      return {ok: true};
  },
  
  api_myReports: async function(uid) {
      const [reports] = await pool.query('SELECT * FROM reports WHERE userId = ?', [uid]);
      return { reports: reports, template: { type: 'content', title: 'Báo cáo', groups: [], texts: [], pages: [], pageFields: [], tiktokFields: [] } };
  },
  api_saveReport: async function(p) {
      let id = p.id;
      if(id) { 
          await pool.query('UPDATE reports SET group_name=?, note=? WHERE id=?', [p.group, p.note, id]);
      } else { 
          id = genId('RP'); 
          await pool.query('INSERT INTO reports (id, userId, group_name, note) VALUES (?,?,?,?)', [id, p.userId, p.group, p.note]);
      }
      return { id: id };
  },
  api_submitReport: async function(p) {
      await pool.query('UPDATE reports SET status="Đã gửi", sentAt=? WHERE id=?', [new Date().toISOString(), p.id]);
      return {ok: true};
  },
  api_deleteReport: async function(p) { 
      await pool.query('DELETE FROM reports WHERE id=?', [p.id]);
      return {ok: true}; 
  },
  
  api_dashExtras: async function() { return { upcoming: { items: [] }, timeline: { items: [] } }; },
  api_listUsers: async function() { const [users] = await pool.query('SELECT * FROM users'); return users.map(u => ({...u, active: !!u.active})); },
  
  api_getProcedures: async function() { 
      const [items] = await pool.query('SELECT * FROM procedures');
      return { items: items, categories: ['Khác'] }; 
  },
  api_saveProcedure: async function(p) {
      if(p.id) { 
          await pool.query('UPDATE procedures SET category=?, title=?, link=?, note=? WHERE id=?', [p.category, p.title, p.link, p.note, p.id]);
      } else { 
          await pool.query('INSERT INTO procedures (id, category, title, link, note) VALUES (?,?,?,?,?)', [genId('QT'), p.category, p.title, p.link, p.note]);
      }
      return {ok: true};
  },
  api_deleteProcedure: async function(p) { 
      await pool.query('DELETE FROM procedures WHERE id=?', [p.id]);
      return {ok: true}; 
  },
  
  api_getRivals: async function() { 
      const [rivals] = await pool.query('SELECT * FROM rivals');
      return rivals; 
  },
  api_saveRival: async function(p) {
    if(p.id) { 
        await pool.query('UPDATE rivals SET userId=?, rivalName=?, page=?, date=?, followers=?, interactions=?, posts=?, note=? WHERE id=?', 
            [p.userId, p.rivalName, p.page, p.date, p.followers, p.interactions, p.posts, p.note, p.id]);
    } else { 
        await pool.query('INSERT INTO rivals (id, userId, rivalName, page, date, followers, interactions, posts, note) VALUES (?,?,?,?,?,?,?,?,?)',
            [genId('RV'), p.userId, p.rivalName, p.page, p.date, p.followers, p.interactions, p.posts, p.note]);
    }
    return {ok: true};
  },
  api_deleteRival: async function(p) { 
      await pool.query('DELETE FROM rivals WHERE id=?', [p.id]);
      return {ok: true}; 
  },
  api_getArchive: async function() { 
      const [tasks] = await pool.query('SELECT * FROM tasks WHERE status = "Đã xóa" ORDER BY date DESC LIMIT 50');
      return { tasks: tasks }; 
  },
  api_saveFanpage: async function(p) {
      if(p.id) {
          await pool.query('UPDATE pages SET name=?, followers=?, status=?, link=? WHERE id=?', [p.name, p.followers, p.status, p.link, p.id]);
      } else {
          await pool.query('INSERT INTO pages (id, name, followers, status, link) VALUES (?,?,?,?,?)', [genId('PG'), p.name, p.followers, p.status, p.link]);
      }
      return {ok: true};
  },
  api_syncFanpages: async function() { return {ok: true}; },
  api_syncAdsFromMeta: async function() { return {ok: true}; },
  api_getMetaSettings: async function() { 
      const settings = await getJson('META_SETTINGS', {token:'', act:'', page:''});
      return settings;
  },
  api_saveMetaSettings: async function(p) {
      await saveJson('META_SETTINGS', {token: p.token, act: p.act, page: p.page});
      return {ok: true};
  },
  api_testMeta: async function() { return {ok: true}; },
  api_holidayTimeline: async function() { return { items: [] }; },
  api_allReports: async function() { 
      const [reports] = await pool.query('SELECT * FROM reports');
      return reports; 
  },
  api_receiveReport: async function(p) { 
      await pool.query('UPDATE reports SET status="Đã duyệt", managerNote=?, receivedAt=?, receivedBy=? WHERE id=?', 
          [p.note, new Date().toISOString(), p.userId, p.id]);
      return {ok: true}; 
  },
  api_listReports: async function() { 
      const [reports] = await pool.query('SELECT * FROM reports');
      return reports; 
  },
  api_getStats: async function(month) { 
      const [users] = await pool.query('SELECT * FROM users WHERE active = TRUE');
      const [tasks] = await pool.query('SELECT * FROM tasks WHERE date LIKE ? AND status != "Đã xóa"', [`${month}%`]);
      
      const stats = { total: tasks.length, byUser: {} };
      users.forEach(u => {
          stats.byUser[u.id] = { name: u.short || u.name, total: 0, done: 0, doing: 0, todo: 0 };
      });
      
      tasks.forEach(t => {
          const u = stats.byUser[t.userId];
          if(u) {
              u.total++;
              if(t.status === 'Hoàn thành') u.done++;
              else if(t.status === 'Đang làm') u.doing++;
              else u.todo++;
          }
      });
      return stats;
  },
  api_addUser: async function(p) { 
      const id = 'U' + Math.floor(Math.random() * 1000000); // Max 7 chars
      const pass = p.password || '123456';
      await pool.query('INSERT INTO users (id, name, short, role, position, password, isDesigner, isContent, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
          [id, p.name, p.short, p.role, p.position, pass, p.isDesigner, p.isContent]);
      return {ok: true}; 
  },
  api_updateUser: async function(p) { 
      if (p.password) {
          await pool.query('UPDATE users SET name=?, short=?, role=?, position=?, password=?, isDesigner=?, isContent=? WHERE id=?',
              [p.name, p.short, p.role, p.position, p.password, p.isDesigner, p.isContent, p.id]);
      } else {
          await pool.query('UPDATE users SET name=?, short=?, role=?, position=?, isDesigner=?, isContent=? WHERE id=?',
              [p.name, p.short, p.role, p.position, p.isDesigner, p.isContent, p.id]);
      }
      return {ok: true}; 
  },
  api_removeUser: async function(p) { 
      await pool.query('UPDATE users SET active = FALSE WHERE id=?', [p.id]);
      return {ok: true}; 
  },
  api_restoreUser: async function(p) { 
      await pool.query('UPDATE users SET active = TRUE WHERE id=?', [p.id]);
      return {ok: true}; 
  },
  api_uploadPoster: async function(p) { return saveBase64File(p.data, 'poster'); },
  api_uploadProcFile: async function(p) { return saveBase64File(p.data, 'proc'); },
  api_uploadLeaveFile: async function(p) { return saveBase64File(p.data, 'leave'); }
};

function saveBase64File(base64Data, prefix) {
    if (!base64Data) return { url: '' };
    try {
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return { url: '' };
        
        const ext = matches[1].split('/')[1] || 'png';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `${prefix}_${Date.now()}.${ext}`;
        const filepath = require('path').join(__dirname, '../../frontend/uploads', filename);
        
        require('fs').writeFileSync(filepath, buffer);
        return { url: `/uploads/${filename}` };
    } catch(e) {
        console.error('Upload error', e);
        return { url: '' };
    }
}
