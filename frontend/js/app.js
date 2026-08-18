
/* ============================ HẠ TẦNG ============================ */
var ME=null, BOOT=null, POSM=null, CIN=0, DIRTY={}, DAY=[], WEEK=null, USERS=[];

function call(fn, args, txt) {
  return new Promise(function(res, rej) {
    if (txt) showLoad(txt);
    fetch('/api/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: args || [] })
    })
    .then(response => response.json())
    .then(r => {
      hideLoad();
      if (!r) { rej(new Error('Không nhận được phản hồi từ server.')); return; }
      if (r.ok === false) { rej(new Error(r.error || 'Lỗi không xác định')); return; }
      res(r.data !== undefined ? r.data : r);
    })
    .catch(e => {
      hideLoad();
      rej(new Error((e && e.message) ? e.message : 'Không gọi được server. Kiểm tra kết nối rồi thử lại.'));
    });
  });
}
function showLoad(t){document.getElementById('loadTxt').textContent=t||'Đang xử lý...';document.getElementById('load').classList.add('on');}
function hideLoad(){document.getElementById('load').classList.remove('on');}
function toast(msg,type){
  var d=document.createElement('div');
  d.className='toast'+(type?' '+type:'');
  d.textContent=msg;
  document.getElementById('toasts').appendChild(d);
  setTimeout(function(){d.style.opacity='0';d.style.transform='translateX(110%)';d.style.transition='.25s';
    setTimeout(function(){d.remove();},260);},type==='bad'?5200:3000);
}
function err(e){toast((e&&e.message)?e.message:String(e),'bad');}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function openModal(id){document.getElementById(id).classList.add('on');}
function closeModal(id){document.getElementById(id).classList.remove('on');}
function fill(sel,arr,val){
  var el=document.getElementById(sel); if(!el)return;
  el.innerHTML=arr.map(function(a){return '<option value="'+esc(a)+'">'+esc(a)+'</option>';}).join('');
  if(val) el.value=val;
}
function initials(n){
  var p=String(n||'?').trim().split(/\s+/);
  return (p.length>1?p[0][0]+p[p.length-1][0]:p[0].substr(0,2)).toUpperCase();
}
var AVC=['','blue','green','purple'];
function avClass(i){return AVC[i%AVC.length];}
function todayStr(){
  var d=new Date(); var m=d.getMonth()+1, dd=d.getDate();
  return d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
}
function monthStr(){return todayStr().substr(0,7);}

/* ============================ BOOT ============================ */
window.addEventListener('load',boot);
function boot(){
  call('api_bootstrap',[],'Đang kết nối hệ thống...').then(function(b){
    BOOT=b;
    document.getElementById('quickList').innerHTML=b.users.map(function(u,i){
      return '<button onclick="quick(\''+esc(u.name).replace(/'/g,"\\'")+'\')">'+
        '<div class="av '+avClass(i)+'">'+initials(u.name)+'</div>'+
        '<div><div class="qname">'+esc(u.name)+'</div>'+
        '<div class="qrole">'+esc(u.position||'')+(u.role==='admin'?' · Admin':'')+'</div></div></button>';
    }).join('');
    /* --- giữ đăng nhập khi tải lại trang --- */
    var savedId=null, saved=null;
    try{
      if(window.localStorage){
        savedId=localStorage.getItem('stl_uid');
        saved=localStorage.getItem('stl_user');
      }
    }catch(e){}
    if(saved){document.getElementById('lgName').value=saved;}
    if(savedId){
      var found=null;
      b.users.forEach(function(u){ if(u.id===savedId) found=u; });
      if(found){ ME=found; startApp(true); return; }
      /* nhân sự đã bị ẩn / xoá -> quay về màn hình đăng nhập */
      try{ localStorage.removeItem('stl_uid'); }catch(e){}
    }
  }).catch(function(e){
    err(e);
    document.getElementById('quickList').innerHTML=
      '<div class="note warn">Không kết nối được database.<br>Admin hãy mở Apps Script và chạy hàm <b>setupSystem()</b> một lần.</div>';
  });
}
function quick(n){document.getElementById('lgName').value=n;doLogin();}
function doLogin(){
  var n=document.getElementById('lgName').value.trim();
  var p=document.getElementById('lgPass') ? document.getElementById('lgPass').value.trim() : '';
  if(!n){toast('Vui lòng nhập tên của bạn.','bad');return;}
  if(!p){toast('Vui lòng nhập mật khẩu.','bad');return;}
  initAudio();
  call('api_login',[n, p],'Đang đăng nhập...').then(function(u){
    ME=u;
    try{
      if(window.localStorage){
        localStorage.setItem('stl_user',u.name);
        localStorage.setItem('stl_uid',u.id);
      }
    }catch(e){}
    startApp(false);
  }).catch(err);
}
function logout(){
  if(!confirm('Thoát khỏi tài khoản '+(ME?ME.name:'')+'?\n\n'+
              '(Chỉ tải lại trang thì bạn vẫn đăng nhập bình thường, không cần thoát.)')) return;
  try{
    if(window.localStorage){
      localStorage.removeItem('stl_user');
      localStorage.removeItem('stl_uid');
      localStorage.removeItem('stl_tab');
    }
  }catch(e){}
  location.reload();
}

function startApp(restored){
  document.getElementById('login').style.display='none';
  document.getElementById('app').style.display='flex';
  document.getElementById('meName').textContent=ME.name;
  document.getElementById('mePos').textContent=ME.position||'';
  document.getElementById('meAv').textContent=initials(ME.name);

  var isAdmin=ME.role==='admin';
  var canPosm=isAdmin||ME.isDesigner;
  var canAds=isAdmin||ME.isContent;      // admin luôn thấy mọi thứ của chuyên viên
  var GROUPS=[
    {g:'', items:[
      {id:'notif',  ic:'🔔', label:'Thông báo', hi:true, on:true}]},
    {g:'Công việc', items:[
      {id:'today',  ic:'📅', label:'Hôm nay', on:true},
      {id:'assign', ic:'🤝', label:'Giao việc', on:true},
      {id:'week',   ic:'🗓', label:'Memo Tuần', on:true},
      {id:'rp',     ic:'📊', label:'Báo cáo', on:true},
      {id:'proc',   ic:'📄', label:'Quy trình', on:true},
      {id:'dash',   ic:'📈', label:'Dashboard', on:true}]},
    {g:'Marketing', items:[
      {id:'movie',  ic:'🎬', label:'Lịch phim', on:true},
      {id:'fanpage',ic:'📘', label:'6 Fanpage', on:canAds},
      {id:'ads',    ic:'📣', label:'Quảng cáo Starlight', on:canAds},
      {id:'posm',   ic:'🖼️', label:'Checklist POSM', on:canPosm}]},
    {g:'Quản trị', items:[
      {id:'users',  ic:'👥', label:'Nhân sự', on:isAdmin},
      {id:'archive',ic:'🗂', label:'Tra cứu tháng', on:isAdmin},
      {id:'report', ic:'📤', label:'Xuất báo cáo', on:isAdmin}]}
  ];
  var navHtml='';
  GROUPS.forEach(function(gr){
    var vis=gr.items.filter(function(t){return t.on;});
    if(!vis.length) return;
    if(gr.g) navHtml+='<div class="grp">'+gr.g+'</div>';
    vis.forEach(function(t){
      navHtml+='<button id="nav-'+t.id+'" class="'+(t.hi?'hi':'')+'" onclick="go(\''+t.id+'\')">'+
        '<span class="ic">'+t.ic+'</span><span class="lb">'+t.label+'</span></button>';
    });
  });
  document.getElementById('nav').innerHTML=navHtml;

  ['nCat','bkCat','edCat'].forEach(function(s){fill(s,BOOT.categories,'Khác');});
  ['nPri','bkPri','edPri'].forEach(function(s){fill(s,BOOT.priorities,'Thường');});
  fill('edSt',BOOT.statuses);
  fill('paSt',[''].concat(BOOT.posmStatuses));

  document.getElementById('tDate').value=BOOT.today;
  document.getElementById('wDate').value=BOOT.today;
  document.getElementById('rMonth').value=BOOT.today.substr(0,7);
  if(BOOT.posmUrl) document.getElementById('posmLink').href=BOOT.posmUrl;

  /* --- phần mới --- */
  document.getElementById('agDate').value=BOOT.today;
  fill('agCat',BOOT.categories,'Khác');
  fill('agPri',BOOT.priorities,'Thường');
  fill('agTo',[]);
  document.getElementById('agTo').innerHTML=BOOT.users.filter(function(u){return u.id!==ME.id;})
    .map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.name)+' — '+esc(u.position||'')+'</option>';}).join('')
    || '<option value="">(chưa có nhân sự khác)</option>';
  fill('adPlat',BOOT.adPlatforms||['Facebook'],'Facebook');
  fill('adSt',BOOT.adStatuses||['Đang chạy'],'Đang chạy');
  var months=(BOOT.months&&BOOT.months.length)?BOOT.months:[BOOT.today.substr(0,7)];
  var mopt=months.map(function(m){
    var pp=m.split('-');
    return '<option value="'+m+'">Tháng '+parseInt(pp[1],10)+'/'+pp[0]+(m===BOOT.curMonth?' (đang chạy)':'')+'</option>';
  }).join('');
  document.getElementById('dMonth').innerHTML=mopt;
  document.getElementById('dMonth').value=BOOT.curMonth||months[0];
  document.getElementById('arMonth').innerHTML=mopt;
  document.getElementById('arMonth').value=months.length>1?months[1]:months[0];
  document.getElementById('dUser').innerHTML='<option value="">Cả team</option>'+
    BOOT.users.map(function(u){return '<option value="'+esc(u.id)+'">'+esc(u.short||u.name)+'</option>';}).join('');
  if(!isAdmin) document.getElementById('dUser').value=ME.id;

  /* chốt sổ đầu tháng chạy im lặng — không báo cho ai */
  var sb=document.getElementById('sndBtn');
  if(sb&&!SND){ sb.textContent='🔇'; sb.classList.add('off'); }
  if(BOOT.movies){ MOVIES=BOOT.movies; MV_VER=BOOT.movies.version||''; }
  var bb=document.getElementById('brandBox');
  if(bb) bb.title='Phiên bản backend đang chạy: '+(BOOT.version||'không rõ (bản cũ)');
  if(!BOOT.version){
    toast('Web đang chạy bản code cũ. Vào Apps Script → Deploy → Manage deployments → New version.','bad');
  }
  pulse(); ping();
  startPulseLoop(); startPingLoop();
  setTimeout(maybeReportPopup,1400);

  /* mở lại đúng tab đang xem trước khi tải lại trang */
  var lastTab=null;
  try{ if(window.localStorage) lastTab=localStorage.getItem('stl_tab'); }catch(e){}
  var okTab=false;
  if(lastTab && document.getElementById('nav-'+lastTab)) okTab=true;
  go(okTab?lastTab:'dash');

  if(restored){
    toast('Chào mừng trở lại, '+(ME.short||ME.name)+'!','ok');
  }else{
    setTimeout(function(){ showNowShowing(false); },700);
  }
}
function go(id){
  ['dash','today','week','assign','notif','movie','fanpage','ads','posm','archive','users','report','proc','rp'].forEach(function(p){
    var el=document.getElementById('p-'+p); if(el) el.classList.remove('on');
    var nb=document.getElementById('nav-'+p); if(nb) nb.classList.remove('on');
  });
  var pg=document.getElementById('p-'+id); if(pg) pg.classList.add('on');
  var nb2=document.getElementById('nav-'+id); if(nb2) nb2.classList.add('on');
  try{ if(window.localStorage) localStorage.setItem('stl_tab',id); }catch(e){}
  if(id==='dash')  { loadDash(); loadUpcoming(); }
  if(id==='today') loadDay();
  if(id==='week')  loadWeek();
  if(id==='assign')loadAssign();
  if(id==='notif') loadNotif();
  if(id==='movie') loadMovies();
  if(id==='fanpage')loadFp();
  if(id==='ads')   { loadAds(); renderRivalLinks(); }
  if(id==='proc')  loadProc();
  if(id==='rp')    loadReportTab();
  if(id==='posm')  { if(!POSM) loadPosm(); }
  if(id==='archive') loadArchive();
  if(id==='users') loadUsers();
  if(id==='report'){ loadMonthStats(); loadReports(); }
}

/* ============================ HÔM NAY ============================ */
function shiftDay(n){
  var el=document.getElementById('tDate');
  var d=new Date(el.value+'T00:00:00'); d.setDate(d.getDate()+n);
  var m=d.getMonth()+1, dd=d.getDate();
  el.value=d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
  loadDay();
}
function goToday(){document.getElementById('tDate').value=todayStr();loadDay();}

function loadDay(){
  var date=document.getElementById('tDate').value;
  if(!date){document.getElementById('tDate').value=todayStr();date=todayStr();}
  renderDayBar(date);
  call('api_getDay',[date,ME.id],'Đang tải công việc...').then(function(r){
    DAY=r.tasks;
    document.getElementById('tFocus').value=r.focus||'';
    LEAVE_NOW=r.leave||'';
    renderLeave();
    renderTasks();
  }).catch(err);
}
function renderTasks(){
  var box=document.getElementById('taskList');
  var done=DAY.filter(function(t){return t.status==='Hoàn thành';}).length;
  var doing=DAY.filter(function(t){return t.status==='Đang làm';}).length;
  var todo=DAY.length-done-doing;
  var pc=DAY.length?Math.round(done/DAY.length*100):0;
  var hi=DAY.filter(function(t){return t.priority==='Cao'&&t.status!=='Hoàn thành';}).length;

  chRing('tRing',pc,done,DAY.length);
  document.getElementById('dayStats').innerHTML=
    tile(DAY.length,'Tổng việc hôm nay','c-gold')+
    tile(done,'Đã hoàn thành','c-ok')+
    tile(doing+todo,'Còn phải làm',(doing+todo)?'c-warn':'c-ok')+
    tile(hi,'Ưu tiên CAO chưa xong',hi?'c-bad':'c-dim');

  if(!DAY.length){
    box.innerHTML='<div class="card"><div class="empty"><div class="big">📝</div>'+
      '<b>Chưa có công việc nào cho ngày này.</b><br>Nhập vào ô phía trên, hoặc bấm '+
      '<b>↩ Lấy việc chưa xong của hôm trước</b> để khỏi gõ lại.</div></div>';
    return;
  }

  var order={'Cao':0,'Thường':1,'Thấp':2};
  var sortFn=function(a,b){return (order[a.priority]||1)-(order[b.priority]||1);};
  var groups=[
    {key:'doing',label:'Đang làm',   list:DAY.filter(function(t){return t.status==='Đang làm';}).sort(sortFn)},
    {key:'todo', label:'Chưa làm',   list:DAY.filter(function(t){return t.status!=='Đang làm'&&t.status!=='Hoàn thành';}).sort(sortFn)},
    {key:'done', label:'Hoàn thành', list:DAY.filter(function(t){return t.status==='Hoàn thành';}).sort(sortFn)}
  ];
  box.innerHTML=groups.map(function(g){
    if(!g.list.length) return '';
    return '<div class="tgrp '+g.key+'"><div class="tgrp-h"><span class="dot"></span>'+
      '<span class="t">'+g.label+'</span><span class="n">'+g.list.length+'</span></div>'+
      '<div class="tasks">'+g.list.map(taskCard).join('')+'</div></div>';
  }).join('');
}
function taskCard(t){
  var st=t.status==='Hoàn thành'?'on':(t.status==='Đang làm'?'mid':'');
  var mark=t.status==='Hoàn thành'?'✓':(t.status==='Đang làm'?'●':'');
  var stc=t.status==='Hoàn thành'?'st-done':(t.status==='Đang làm'?'st-doing':'st-todo');
  var auto=String(t.note||'').indexOf('việc cố định')>=0;
  var asg=String(t.note||'').indexOf('giao]')>=0;
  var cls='task '+stc+(t.priority==='Cao'&&t.status!=='Hoàn thành'?' pri-hi':'')+
          (t.status==='Hoàn thành'?' done':'')+(auto?' auto':'')+(asg?' assigned':'');
  return '<div class="'+cls+'">'+
    '<div class="chk '+st+'" onclick="cycle(\''+t.id+'\')" title="Bấm để đổi trạng thái">'+mark+'</div>'+
    '<div class="task-body"><div class="task-txt">'+esc(t.task)+'</div>'+
    '<div class="task-meta">'+
      '<span class="tag '+stc+'">'+esc(t.status)+'</span>'+
      '<span class="tag cat">'+esc(t.category)+'</span>'+
      (t.priority==='Cao'?'<span class="tag hi">⚡ Ưu tiên cao</span>':'')+
      (t.priority==='Thấp'?'<span class="tag lo">Ưu tiên thấp</span>':'')+
      (auto?'<span class="tag">🔁 việc cố định hằng ngày</span>':'')+
      (asg?'<span class="tag gold">📌 '+esc(String(t.note).replace(/[\[\]]/g,''))+'</span>':
        (t.note&&!auto?'<span class="tag">'+esc(t.note)+'</span>':''))+
    '</div></div>'+
    '<div class="task-act">'+
      '<button class="iconbtn" onclick="openEdit(\''+t.id+'\')" title="Sửa">✎</button>'+
      '<button class="iconbtn del" onclick="delTask(\''+t.id+'\')" title="Xoá">🗑</button>'+
    '</div></div>';
}
function tile(v,l,c){
  return '<div class="stat"><div class="stat-v '+(c||'')+'">'+v+'</div><div class="stat-l">'+l+'</div></div>';
}
function addTask(){
  var v=document.getElementById('nTask').value.trim();
  if(!v){toast('Nhập nội dung công việc trước đã.','bad');return;}
  call('api_addTask',[{userId:ME.id,date:document.getElementById('tDate').value,task:v,
    category:document.getElementById('nCat').value,priority:document.getElementById('nPri').value}]).then(function(){
    document.getElementById('nTask').value='';
    toast('Đã thêm công việc.','ok');
    loadDay();
  }).catch(err);
}
function openBulk(){document.getElementById('bkText').value='';openModal('mdBulk');}
function addBulk(){
  var t=document.getElementById('bkText').value;
  if(!t.trim()){toast('Chưa có nội dung.','bad');return;}
  call('api_addTasksBulk',[{userId:ME.id,date:document.getElementById('tDate').value,text:t,
    category:document.getElementById('bkCat').value,priority:document.getElementById('bkPri').value}],'Đang thêm...').then(function(r){
    closeModal('mdBulk');toast('Đã thêm '+r.count+' công việc.','ok');loadDay();
  }).catch(err);
}
function carryOver(){
  call('api_carryOver',[{userId:ME.id,date:document.getElementById('tDate').value}],'Đang tìm việc tồn...').then(function(r){
    if(!r.count) toast('Không có việc chưa xong nào ở ngày '+r.from+'.');
    else {toast('Đã chuyển '+r.count+' việc từ '+r.from+'.','ok');loadDay();}
  }).catch(err);
}
function cycle(id){
  var t=null; for(var i=0;i<DAY.length;i++) if(DAY[i].id===id) t=DAY[i];
  if(!t)return;
  var next=t.status==='Chưa làm'?'Đang làm':(t.status==='Đang làm'?'Hoàn thành':'Chưa làm');
  var wasAssigned=String(t.note||'').indexOf('giao]')>=0;
  t.status=next; renderTasks();
  call('api_updateTask',[{id:id,status:next}]).then(function(){
    if(next==='Hoàn thành'&&wasAssigned)
      toast('Đã báo hoàn thành — người giao việc vừa nhận được thông báo.','ok');
    delete FRESH['asg']; delete FRESH['dash|'+monthStr()+'|']; 
    pulse();
  }).catch(function(e){err(e);loadDay();});
}
function openEdit(id){
  var t=null; for(var i=0;i<DAY.length;i++) if(DAY[i].id===id) t=DAY[i];
  if(!t)return;
  document.getElementById('edId').value=id;
  document.getElementById('edTask').value=t.task;
  document.getElementById('edCat').value=t.category||'Khác';
  document.getElementById('edPri').value=t.priority||'Thường';
  document.getElementById('edSt').value=t.status||'Chưa làm';
  document.getElementById('edNote').value=t.note||'';
  openModal('mdEdit');
}
function saveEdit(){
  var v=document.getElementById('edTask').value.trim();
  if(!v){toast('Nội dung không được để trống.','bad');return;}
  call('api_updateTask',[{id:document.getElementById('edId').value,task:v,
    category:document.getElementById('edCat').value,priority:document.getElementById('edPri').value,
    status:document.getElementById('edSt').value,note:document.getElementById('edNote').value}],'Đang lưu...').then(function(){
    closeModal('mdEdit');toast('Đã lưu.','ok');loadDay();
  }).catch(err);
}
function delTask(id){
  if(!confirm('Xoá công việc này?'))return;
  call('api_deleteTask',[id],'Đang xoá...').then(function(){toast('Đã xoá.','ok');loadDay();}).catch(err);
}
function saveFocus(){
  call('api_saveFocus',[{userId:ME.id,date:document.getElementById('tDate').value,
    focus:document.getElementById('tFocus').value}]).catch(err);
}

/* ============================ TUẦN ============================ */
function shiftWeek(n){
  var el=document.getElementById('wDate');
  var d=new Date(el.value+'T00:00:00'); d.setDate(d.getDate()+n);
  var m=d.getMonth()+1, dd=d.getDate();
  el.value=d.getFullYear()+'-'+(m<10?'0':'')+m+'-'+(dd<10?'0':'')+dd;
  loadWeek();
}
function loadWeek(){
  var d=document.getElementById('wDate').value||todayStr();
  document.getElementById('wDate').value=d;
  call('api_getWeekBoard',[d],'Đang tải bảng tuần...').then(function(w){
    WEEK=w;
    document.getElementById('wfLabel').textContent=w.weekLabel||'';
    document.getElementById('wMonthly').value=w.monthlyFocus||'';
    document.getElementById('wWeekly').value=w.weeklyFocus||'';
    renderWeek();
  }).catch(err);
}
function saveWFocus(){
  if(!WEEK)return;
  call('api_saveWeeklyFocus',[{keys:WEEK.keys,
    monthlyFocus:document.getElementById('wMonthly').value,
    weeklyFocus:document.getElementById('wWeekly').value}],'Đang lưu...').then(function(){
    toast('Đã lưu focus cho '+WEEK.weekLabel+'.','ok');
  }).catch(err);
}
function renderWeek(){
  var w=WEEK, h='';
  h+='<thead><tr><th style="width:90px">Date</th><th style="width:70px"></th>'+
     '<th style="width:105px">Name</th><th style="width:170px">Daily focus</th>'+
     '<th>Plan</th><th>Finish</th></tr></thead><tbody>';
  w.days.forEach(function(day,di){
    w.users.forEach(function(u,ui){
      var cell=(w.grid[day.date]&&w.grid[day.date][u.id])||{tasks:[],focus:''};
      var plan=cell.tasks.map(function(t){
        var cls=t.status==='Hoàn thành'?'d':(t.status==='Đang làm'?'g':'t');
        return '<li class="'+cls+'">'+esc(t.task)+(t.status!=='Hoàn thành'?' <span class="pill">'+esc(t.status)+'</span>':'')+'</li>';
      }).join('');
      var fin=cell.tasks.filter(function(t){return t.status==='Hoàn thành';})
        .map(function(t){return '<li class="d">'+esc(t.task)+'</li>';}).join('');
      var lv=(w.leaves&&w.leaves[day.date+'|'+u.id])||'';
      h+='<tr class="u'+(ui%6)+(di%2?' alt':'')+(ui===w.users.length-1?' dayend':'')+(lv?' lv':'')+'">';
      if(ui===0){
        h+='<td class="day" rowspan="'+w.users.length+'">'+day.dowEn+'<br><span class="hint">'+day.dowVi+'</span></td>';
        h+='<td class="day" rowspan="'+w.users.length+'">'+day.label+'</td>';
      }
      h+='<td><div class="uname"><span class="udot u'+(ui%6)+'"></span>'+esc(u.short)+'</div></td>';
      h+='<td>'+(lv?'<span class="lvtag">'+esc(lv)+'</span>':esc(cell.focus))+'</td>';
      h+='<td>'+(lv&&!plan?'<span class="hint">— nghỉ —</span>':
        (plan?'<ul class="mini">'+plan+'</ul>':'<span class="hint">—</span>'))+'</td>';
      h+='<td>'+(lv&&!fin?'<span class="hint">— nghỉ —</span>':
        (fin?'<ul class="mini">'+fin+'</ul>':'<span class="hint">—</span>'))+'</td>';
      h+='</tr>';
    });
  });
  h+='</tbody>';
  document.getElementById('weekTable').innerHTML=h;
  document.getElementById('weekLegend').innerHTML =
    w.users.map(function(u,i){return '<span class="it"><span class="udot u'+(i%6)+'"></span>'+esc(u.short)+'</span>';}).join('')
    + '<span class="it" style="color:var(--txt3)">· mỗi nhân sự một màu, ngày chẵn/lẻ đậm nhạt xen kẽ</span>';
}

/* ============================ POSM ============================ */
function loadPosm(force){
  call('api_getPosm',[],'Đang đọc file POSM từ Google Sheets...').then(function(p){
    POSM=p; DIRTY={}; CIN=0;
    document.getElementById('posmLink').href=p.url||'#';
    renderPosm(); markDirty();
    if(force) toast('Đã tải lại dữ liệu mới nhất.','ok');
  }).catch(err);
}
function renderPosm(){
  if(!POSM||!POSM.cinemas.length){
    document.getElementById('posmTable').innerHTML='';
    document.getElementById('cinTabs').innerHTML='<div class="note warn">Không đọc được sheet rạp nào trong file POSM.</div>';
    return;
  }
  var tAll=0,tAlert=0,tOld=0,tOk=0;
  POSM.cinemas.forEach(function(c){tAll+=c.total;tAlert+=c.alert;tOld+=c.oldFilm;tOk+=c.ok;});
  document.getElementById('posmStats').innerHTML=
    tile(tAll,'Tổng hạng mục','c-gold')+tile(tAlert,'Cũ / Rách — thay ngay','c-bad')+
    tile(tOld,'Phim cũ — cần đổi','c-warn')+tile(tOk,'OK - Tốt','c-ok');

  document.getElementById('cinTabs').innerHTML=POSM.cinemas.map(function(c,i){
    return '<button class="'+(i===CIN?'on':'')+'" onclick="pickCin('+i+')" '+
      'title="'+c.total+' hạng mục · '+c.alert+' cũ/rách">'+esc(c.name)+
      '<span class="badge '+(c.alert?'':'ok')+'">'+(c.alert?c.alert:'✓')+'</span></button>';
  }).join('');

  var c=POSM.cinemas[CIN];
  var h='<thead><tr><th style="width:44px">STT</th><th style="width:180px">Hạng mục</th>'+
    '<th style="width:120px">Kích thước</th><th style="width:52px">SL</th><th style="width:140px">Vị trí</th>'+
    '<th style="width:64px">Ảnh</th><th style="width:130px">Trạng thái</th><th>Ghi chú đề xuất</th></tr></thead><tbody>';
  if(!c.items.length) h+='<tr><td colspan="8"><div class="empty">Sheet này chưa có hạng mục nào.</div></td></tr>';
  c.items.forEach(function(it,ix){
    var k=c.sheetName+'|'+it.row;
    var scls=/^ok/i.test(it.status)?'s-ok':(/phim cũ/i.test(it.status)?'s-old':(it.status?'s-bad':''));
    var opts=[''].concat(BOOT.posmStatuses).map(function(s){
      return '<option value="'+esc(s)+'"'+(s===it.status?' selected':'')+'>'+(s||'— chưa cập nhật —')+'</option>';}).join('');
    h+='<tr class="posm-row">'+
      '<td>'+esc(it.stt)+'</td>'+
      '<td><b>'+esc(it.hangMuc)+'</b>'+(it.ghiChu?'<div class="hint">'+esc(it.ghiChu)+'</div>':'')+'</td>'+
      '<td class="hint">'+esc(it.kichThuoc)+'</td>'+
      '<td>'+esc(it.soLuong)+'</td>'+
      '<td><input class="cell" data-k="'+esc(k)+'" data-f="viTri" value="'+esc(it.viTri)+'" oninput="touch(this)"></td>'+
      '<td>'+(it.image
        ? '<img class="posm-thumb" src="'+esc(it.image)+'" data-i="'+ix+'" onclick="viewImgAt(this)" onerror="this.outerHTML=\'<div class=&quot;posm-noimg&quot;>🖼</div>\'">'
        : '<div class="posm-noimg" title="Chưa có ảnh">—</div>')+'</td>'+
      '<td><select class="st '+scls+'" data-k="'+esc(k)+'" data-f="status" onchange="touch(this);stColor(this)">'+opts+'</select></td>'+
      '<td><input class="cell" data-k="'+esc(k)+'" data-f="deXuat" value="'+esc(it.deXuat)+'" placeholder="Đề xuất thay thế..." oninput="touch(this)"></td>'+
    '</tr>';
  });
  h+='</tbody>';
  document.getElementById('posmTable').innerHTML=h;
}
function pickCin(i){
  var n=Object.keys(DIRTY).length;
  if(n && !confirm('Còn '+n+' dòng chưa lưu ở rạp này. Chuyển rạp sẽ mất các thay đổi đó. Vẫn chuyển?')) return;
  DIRTY={}; CIN=i; renderPosm(); markDirty();
  var sc=document.getElementById('posmScroll'); if(sc) sc.scrollTop=0;
}
function stColor(el){
  var dirty=el.classList.contains('dirty')?' dirty':'';
  el.className='st '+(/^ok/i.test(el.value)?'s-ok':(/phim cũ/i.test(el.value)?'s-old':(el.value?'s-bad':'')))+dirty;
}
function touch(el){
  var k=el.getAttribute('data-k'), f=el.getAttribute('data-f');
  var parts=k.split('|');
  if(!DIRTY[k]) DIRTY[k]={sheetName:parts[0],row:parseInt(parts[1],10)};
  DIRTY[k][f]=el.value;
  el.classList.add('dirty');
  markDirty();
}
function markDirty(){
  var n=Object.keys(DIRTY).length;
  document.getElementById('dirtyInfo').textContent=n?(n+' dòng đang chờ lưu'):'Chưa có thay đổi';
  document.getElementById('btnSavePosm').disabled=!n;
}
function savePosm(){
  var changes=Object.keys(DIRTY).map(function(k){return DIRTY[k];});
  if(!changes.length)return;
  call('api_savePosm',[{userId:ME.id,changes:changes}],'Đang ghi vào Google Sheets...').then(function(r){
    toast('Đã đồng bộ '+r.count+' dòng vào file POSM của các rạp.','ok');
    loadPosm();
  }).catch(err);
}
function viewImgAt(el){
  var it=POSM.cinemas[CIN].items[parseInt(el.getAttribute('data-i'),10)];
  if(!it)return;
  document.getElementById('miImg').src=it.image;
  document.getElementById('miTitle').textContent=(it.hangMuc||'Hình ảnh POSM')+' — '+POSM.cinemas[CIN].name;
  openModal('mdImg');
}
function openAddPosm(){
  if(!POSM||!POSM.cinemas.length)return;
  document.getElementById('paCin').innerHTML='Thêm vào rạp: <b>'+esc(POSM.cinemas[CIN].name)+'</b>';
  ['paItem','paSize','paQty','paLoc','paNote','paImg'].forEach(function(i){document.getElementById(i).value='';});
  openModal('mdPosmAdd');
}
function savePosmAdd(){
  var it=document.getElementById('paItem').value.trim();
  if(!it){toast('Nhập tên hạng mục.','bad');return;}
  call('api_addPosmItem',[{sheetName:POSM.cinemas[CIN].sheetName,hangMuc:it,
    kichThuoc:document.getElementById('paSize').value,soLuong:document.getElementById('paQty').value,
    viTri:document.getElementById('paLoc').value,ghiChu:document.getElementById('paNote').value,
    status:document.getElementById('paSt').value,image:document.getElementById('paImg').value}],'Đang thêm...').then(function(){
    closeModal('mdPosmAdd');toast('Đã thêm hạng mục vào file.','ok');loadPosm();
  }).catch(err);
}

/* ============================ NHÂN SỰ ============================ */
function loadUsers(){
  call('api_listUsers',[ME.id],'Đang tải danh sách...').then(function(list){
    USERS=list;
    document.getElementById('userList').innerHTML=list.map(function(u,i){
      return '<div class="u-item '+(u.active?'':'off')+'">'+
        '<div class="av '+avClass(i)+'">'+initials(u.name)+'</div>'+
        '<div class="u-info"><div><b>'+esc(u.name)+'</b>'+
          (u.role==='admin'?' <span class="tag" style="color:var(--gold);border-color:var(--gold)">ADMIN</span>':'')+
          (u.isDesigner?' <span class="tag cat">THIẾT KẾ</span>':'')+
          (u.isContent?' <span class="tag gold">CONTENT</span>':'')+
          (u.active?'':' <span class="tag lo">ĐÃ ẨN</span>')+'</div>'+
        '<div class="hint">'+esc(u.position||'—')+' · tên ngắn: '+esc(u.short)+'</div></div>'+
        '<button class="iconbtn" onclick="openEditUser('+i+')" title="Sửa">✎</button>'+
        (u.active
          ? (u.id===ME.id?'<span class="hint">(bạn)</span>'
             :'<button class="btn btn-line btn-sm" onclick="rmUser('+i+')">Ẩn</button>')
          : '<button class="btn btn-ok btn-sm" onclick="reUser('+i+')">Khôi phục</button>')+
      '</div>';
    }).join('')||'<div class="empty">Chưa có nhân sự.</div>';
  }).catch(err);
}
function openAddUser(){
  document.getElementById('muTitle').textContent='Thêm nhân sự';
  document.getElementById('muId').value='';
  ['muName','muShort','muPos','muPass'].forEach(function(i){document.getElementById(i).value='';});
  document.getElementById('muRole').value='member';
  document.getElementById('muDes').value='no';
  document.getElementById('muCon').value='no';
  openModal('mdUser');
}
function openEditUser(i){
  var u=USERS[i]; if(!u)return;
  document.getElementById('muTitle').textContent='Sửa nhân sự';
  document.getElementById('muId').value=u.id;
  document.getElementById('muName').value=u.name;
  document.getElementById('muShort').value=u.short||'';
  document.getElementById('muPos').value=u.position||'';
  document.getElementById('muPass').value='';
  document.getElementById('muRole').value=u.role;
  document.getElementById('muDes').value=u.isDesigner?'yes':'no';
  document.getElementById('muCon').value=u.isContent?'yes':'no';
  openModal('mdUser');
}
function saveUser(){
  var name=document.getElementById('muName').value.trim();
  if(!name){toast('Nhập họ tên.','bad');return;}
  var p={actorId:ME.id,name:name,short:document.getElementById('muShort').value.trim(),
    position:document.getElementById('muPos').value.trim(),role:document.getElementById('muRole').value,
    isDesigner:document.getElementById('muDes').value==='yes',
    isContent:document.getElementById('muCon').value==='yes'};
  var pass=document.getElementById('muPass').value.trim();
  if(pass) p.password = pass;
  var id=document.getElementById('muId').value;
  var fn=id?'api_updateUser':'api_addUser';
  if(id) p.id=id;
  call(fn,[p],'Đang lưu...').then(function(){
    closeModal('mdUser');toast('Đã lưu nhân sự.','ok');loadUsers();
    call('api_bootstrap',[]).then(function(b){BOOT=b;});
  }).catch(err);
}
function rmUser(i){
  var u=USERS[i]; if(!u)return;
  if(!confirm('Ẩn nhân sự "'+u.name+'" khỏi hệ thống?\n\nDữ liệu công việc cũ vẫn được giữ lại để báo cáo.'))return;
  call('api_removeUser',[{actorId:ME.id,id:u.id}],'Đang xử lý...').then(function(){
    toast('Đã ẩn nhân sự.','ok');loadUsers();
    call('api_bootstrap',[]).then(function(b){BOOT=b;});
  }).catch(err);
}
function reUser(i){
  var u=USERS[i]; if(!u)return;
  call('api_restoreUser',[{actorId:ME.id,id:u.id}],'Đang khôi phục...').then(function(){
    toast('Đã khôi phục.','ok');loadUsers();
    call('api_bootstrap',[]).then(function(b){BOOT=b;});
  }).catch(err);
}

/* ============================ BÁO CÁO ============================ */
function loadMonthStats(){
  var m=document.getElementById('rMonth').value||monthStr();
  call('api_getStats',[m]).then(function(s){
    var ids=Object.keys(s.byUser);
    var h='<div class="grid g4" style="margin-bottom:14px">'+tile(s.total,'Tổng việc tháng '+m,'c-gold')+'</div>';
    h+='<div class="wrap-x"><table><thead><tr><th>Nhân sự</th><th>Tổng</th><th>Hoàn thành</th>'+
       '<th>Đang làm</th><th>Chưa làm</th><th>Tiến độ</th></tr></thead><tbody>';
    ids.forEach(function(id){
      var b=s.byUser[id];
      var pc=b.total?Math.round(b.done/b.total*100):0;
      h+='<tr><td><b>'+esc(b.name)+'</b></td><td>'+b.total+'</td><td class="c-ok">'+b.done+
         '</td><td class="c-warn">'+b.doing+'</td><td class="c-dim">'+b.todo+'</td>'+
         '<td class="'+(pc>=80?'c-ok':(pc>=50?'c-warn':'c-bad'))+'"><b>'+pc+'%</b></td></tr>';
    });
    h+='</tbody></table></div>';
    document.getElementById('monthStats').innerHTML=h;
  }).catch(err);
}
function exportMonth(){
  var m=document.getElementById('rMonth').value;
  if(!m){toast('Chọn tháng cần xuất.','bad');return;}
  call('api_exportMonth',[m,ME.id],'Đang tạo file Excel... (có thể mất 20-40 giây)').then(function(r){
    document.getElementById('exportResult').innerHTML=
      '<div class="note" style="background:rgba(46,204,113,.09);border-color:rgba(46,204,113,.3);color:#bff0d3">'+
      '<b>✓ Đã xuất xong:</b> '+esc(r.fileName)+'<br>'+
      r.weeks+' sheet tuần + 1 sheet phân tích · '+r.taskCount+' công việc<br><br>'+
      '<a class="btn btn-gold btn-sm" href="'+r.downloadUrl+'" target="_blank">⬇ Tải file về máy</a> &nbsp; '+
      '<a class="btn btn-line btn-sm" href="'+r.viewUrl+'" target="_blank">Mở trong Drive ↗</a></div>';
    toast('Xuất báo cáo thành công!','ok');
    loadReports(); loadMonthStats();
  }).catch(err);
}
function loadReports(){
  call('api_listReports',[ME.id]).then(function(list){
    if(!list.length){document.getElementById('reportList').innerHTML='<div class="hint">Chưa có báo cáo nào.</div>';return;}
    document.getElementById('reportList').innerHTML=list.map(function(f){
      return '<div class="u-item"><div class="av">📄</div><div class="u-info">'+
        '<div><b>'+esc(f.name)+'</b></div><div class="hint">'+esc(f.created)+' · '+esc(f.size)+'</div></div>'+
        '<a class="btn btn-line btn-sm" href="'+f.downloadUrl+'" target="_blank">⬇ Tải</a>'+
        '<a class="btn btn-line btn-sm" href="'+f.url+'" target="_blank">Mở ↗</a></div>';
    }).join('');
  }).catch(err);
}
document.addEventListener('DOMContentLoaded',function(){
  var rm=document.getElementById('rMonth');
  if(rm) rm.addEventListener('change',loadMonthStats);
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') document.querySelectorAll('.modal.on').forEach(function(m){m.classList.remove('on');});
});

/* ============================================================================
   BIỂU ĐỒ SVG - tự vẽ, không phụ thuộc thư viện ngoài
   Bảng màu đã kiểm tra độ phân biệt cho người mù màu trên nền trắng
   ========================================================================== */
var PAL=['#f26f21','#2a78d6','#1baf7a','#4a3aa7','#e87ba4','#eda100'];
var C_OK='#0f7b52', C_WARN='#b06a00', C_BAD='#c8382b', C_INFO='#2a78d6', C_DIM='#9aa2af';
var HEAT=['#fdf0e6','#fbdcc6','#f8c19b','#f4a06b','#ee7f3e','#d9611c','#a94812'];

function nf(n){ n=Number(n)||0; return n.toLocaleString('vi-VN'); }
function sv(w,h,inner){
  return '<svg viewBox="0 0 '+w+' '+h+'" role="img">'+inner+'</svg>';
}
function tipFor(box){
  var t=box.querySelector('.tip');
  if(!t){ t=document.createElement('div'); t.className='tip'; box.appendChild(t); }
  return t;
}
function bindTip(box,sel){
  var tip=tipFor(box);
  Array.prototype.forEach.call(box.querySelectorAll(sel),function(el){
    el.addEventListener('mousemove',function(ev){
      var r=box.getBoundingClientRect();
      tip.innerHTML=el.getAttribute('data-tip')||'';
      tip.classList.add('on');
      var x=ev.clientX-r.left+12, y=ev.clientY-r.top-10;
      if(x>r.width-150) x=r.width-150;
      tip.style.left=x+'px'; tip.style.top=y+'px';
    });
    el.addEventListener('mouseleave',function(){tip.classList.remove('on');});
  });
}
function legend(id,items){
  var el=document.getElementById(id); if(!el)return;
  el.innerHTML=items.map(function(i){
    return '<span class="it"><span class="sw" style="background:'+i.color+'"></span>'+esc(i.label)+'</span>';
  }).join('');
}
function noData(id,msg){
  var el=document.getElementById(id);
  if(el) el.innerHTML='<div class="empty" style="padding:26px"><div class="big">📊</div>'+(msg||'Chưa có dữ liệu')+'</div>';
}

/* --- biểu đồ đường: nhiều chuỗi --- */
function chLine(id,labels,series,opt){
  var box=document.getElementById(id); if(!box)return;
  if(!labels.length){noData(id);return;}
  opt=opt||{};
  var W=opt.w||620,H=opt.h||250,L=42,R=14,T=14,B=34;
  var pw=W-L-R, ph=H-T-B;
  var max=1; series.forEach(function(s){s.data.forEach(function(v){if(v>max)max=v;});});
  max=Math.ceil(max*1.15)||1;
  var g='',i,j;
  var ticks=4;
  for(i=0;i<=ticks;i++){
    var v=Math.round(max/ticks*i), y=T+ph-ph*(v/max);
    g+='<line class="gridline" x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'"/>'+
       '<text class="axtx" x="'+(L-7)+'" y="'+(y+3.5)+'" text-anchor="end">'+v+'</text>';
  }
  var X=function(k){ return labels.length===1?L+pw/2:L+pw*(k/(labels.length-1)); };
  var Y=function(v){ return T+ph-ph*((v||0)/max); };
  var step=Math.ceil(labels.length/12);
  for(i=0;i<labels.length;i++){
    if(i%step===0) g+='<text class="axtx" x="'+X(i)+'" y="'+(H-12)+'" text-anchor="middle">'+esc(labels[i])+'</text>';
  }
  series.forEach(function(s){
    var d='';
    for(j=0;j<s.data.length;j++){ d+=(j?' L':'M')+X(j)+' '+Y(s.data[j]); }
    if(s.fill){
      g+='<path d="'+d+' L'+X(s.data.length-1)+' '+(T+ph)+' L'+X(0)+' '+(T+ph)+' Z" fill="'+s.color+'" opacity=".10"/>';
    }
    g+='<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
  });
  // điểm + vùng hover theo cột
  for(i=0;i<labels.length;i++){
    var rows=series.map(function(s){
      return '<span style="color:'+s.color+'">●</span> '+esc(s.name)+': <b>'+nf(s.data[i])+'</b>';
    }).join('<br>');
    if(opt.extra&&opt.extra[i]) rows+='<br>'+opt.extra[i];
    g+='<rect x="'+(X(i)-pw/(labels.length*2)-1)+'" y="'+T+'" width="'+(pw/labels.length+2)+'" height="'+ph+
       '" fill="transparent" style="cursor:crosshair" data-tip="<b>'+esc(labels[i])+'</b><br>'+rows.replace(/"/g,'&quot;')+'"/>';
    series.forEach(function(s){
      if(labels.length<=20) g+='<circle cx="'+X(i)+'" cy="'+Y(s.data[i])+'" r="3.2" fill="#fff" stroke="'+s.color+'" stroke-width="2"/>';
    });
  }
  g+='<line class="axis" x1="'+L+'" y1="'+(T+ph)+'" x2="'+(W-R)+'" y2="'+(T+ph)+'"/>';
  box.innerHTML=sv(W,H,g);
  bindTip(box,'rect[data-tip]');
}

/* --- cột ngang, có phần hoàn thành --- */
function chBarH(id,items,opt){
  var box=document.getElementById(id); if(!box)return;
  if(!items.length){noData(id);return;}
  opt=opt||{};
  var W=opt.w||620, rowH=34, T=8, L=opt.l||96, R=54;
  var H=T+items.length*rowH+6, pw=W-L-R;
  var max=1; items.forEach(function(it){ if(it.total>max)max=it.total; });
  var g='';
  items.forEach(function(it,i){
    var y=T+i*rowH, bh=17;
    var wTotal=Math.max(2,pw*(it.total/max));
    var wDone=opt.solid?wTotal:Math.max(0,pw*((it.done||0)/max));
    g+='<text class="axtx" x="'+(L-9)+'" y="'+(y+bh/2+4)+'" text-anchor="end" style="font-weight:700;fill:#4b5563">'+esc(it.label)+'</text>';
    g+='<rect x="'+L+'" y="'+y+'" width="'+wTotal+'" height="'+bh+'" rx="4" fill="'+it.color+'" opacity=".28"/>';
    if(wDone>1) g+='<rect x="'+L+'" y="'+y+'" width="'+wDone+'" height="'+bh+'" rx="4" fill="'+it.color+'"/>';
    g+='<text class="vltx" x="'+(L+wTotal+8)+'" y="'+(y+bh/2+4)+'">'+nf(it.total)+'</text>';
    var tipTx=opt.solid
      ? ('<b>'+esc(it.label)+'</b><br>'+nf(it.total)+' '+(opt.unit||'')+(it.sub?'<br>'+esc(it.sub):''))
      : ('<b>'+esc(it.label)+'</b><br>Tổng: '+nf(it.total)+'<br>Hoàn thành: '+nf(it.done||0)+
         ' ('+(it.total?Math.round((it.done||0)/it.total*100):0)+'%)');
    g+='<rect x="'+L+'" y="'+(y-3)+'" width="'+pw+'" height="'+(bh+6)+'" fill="transparent" data-tip="'+tipTx+'"/>';
  });
  box.innerHTML=sv(W,H,g);
  bindTip(box,'rect[data-tip]');
}

/* --- cột dọc --- */
function chBarV(id,items,color,opt){
  var box=document.getElementById(id); if(!box)return;
  if(!items.length){noData(id);return;}
  opt=opt||{};
  var W=opt.w||620,H=opt.h||250,L=40,R=12,T=16,B=52;
  var pw=W-L-R, ph=H-T-B;
  var max=1; items.forEach(function(it){if(it.value>max)max=it.value;});
  max=Math.ceil(max*1.15)||1;
  var g='',i;
  for(i=0;i<=4;i++){
    var v=Math.round(max/4*i), y=T+ph-ph*(v/max);
    g+='<line class="gridline" x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'"/>'+
       '<text class="axtx" x="'+(L-7)+'" y="'+(y+3.5)+'" text-anchor="end">'+v+'</text>';
  }
  var slot=pw/items.length, bw=Math.min(46,slot-8);
  items.forEach(function(it,k){
    var x=L+slot*k+(slot-bw)/2;
    var h=Math.max(2,ph*(it.value/max)), y=T+ph-h;
    g+='<rect class="bar" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" rx="4" fill="'+(it.color||color||PAL[0])+'" '+
       'data-tip="<b>'+esc(it.label)+'</b><br>'+nf(it.value)+' '+(opt.unit||'việc')+'"/>';
    g+='<text class="vltx" x="'+(x+bw/2)+'" y="'+(y-5)+'" text-anchor="middle">'+nf(it.value)+'</text>';
    var lb=String(it.label); if(lb.length>13) lb=lb.substr(0,12)+'…';
    g+='<text class="axtx" x="'+(x+bw/2)+'" y="'+(T+ph+15)+'" text-anchor="middle" transform="rotate(-20 '+
       (x+bw/2)+' '+(T+ph+15)+')">'+esc(lb)+'</text>';
  });
  g+='<line class="axis" x1="'+L+'" y1="'+(T+ph)+'" x2="'+(W-R)+'" y2="'+(T+ph)+'"/>';
  box.innerHTML=sv(W,H,g);
  bindTip(box,'rect[data-tip]');
}

/* --- vòng tròn --- */
function chDonut(id,items,centerLabel){
  var box=document.getElementById(id); if(!box)return;
  var tot=0; items.forEach(function(i){tot+=i.value;});
  if(!tot){noData(id);return;}
  var W=620,H=230,cx=150,cy=H/2,r=78,ir=50;
  var a=-Math.PI/2,g='';
  items.forEach(function(it){
    if(!it.value)return;
    var frac=it.value/tot, a2=a+frac*Math.PI*2;
    var big=frac>.5?1:0;
    var x1=cx+r*Math.cos(a), y1=cy+r*Math.sin(a), x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2);
    var x3=cx+ir*Math.cos(a2), y3=cy+ir*Math.sin(a2), x4=cx+ir*Math.cos(a), y4=cy+ir*Math.sin(a);
    g+='<path d="M'+x1+' '+y1+' A'+r+' '+r+' 0 '+big+' 1 '+x2+' '+y2+' L'+x3+' '+y3+' A'+ir+' '+ir+' 0 '+big+' 0 '+x4+' '+y4+' Z" '+
       'fill="'+it.color+'" stroke="#fff" stroke-width="2" data-tip="<b>'+esc(it.label)+'</b><br>'+nf(it.value)+
       ' · '+Math.round(frac*100)+'%"/>';
    a=a2;
  });
  g+='<text x="'+cx+'" y="'+(cy-2)+'" text-anchor="middle" style="font-size:26px;font-weight:800;fill:#1b1d21">'+nf(tot)+'</text>';
  g+='<text x="'+cx+'" y="'+(cy+17)+'" text-anchor="middle" class="axtx">'+esc(centerLabel||'tổng')+'</text>';
  // nhãn trực tiếp bên phải
  var ly=cy-items.length*13+8;
  items.forEach(function(it){
    if(!it.value)return;
    g+='<rect x="290" y="'+(ly-9)+'" width="11" height="11" rx="3" fill="'+it.color+'"/>';
    g+='<text x="309" y="'+ly+'" style="font-size:12.5px;fill:#4b5563">'+esc(it.label)+
       ' — <tspan style="font-weight:700;fill:#1b1d21">'+nf(it.value)+'</tspan> ('+Math.round(it.value/tot*100)+'%)</text>';
    ly+=24;
  });
  box.innerHTML=sv(W,H,g);
  bindTip(box,'path[data-tip]');
}

/* --- bản đồ nhiệt --- */
function chHeat(id,rows,cols,vals){
  var box=document.getElementById(id); if(!box)return;
  if(!rows.length||!cols.length){noData(id);return;}
  var L=92,T=22,cell=Math.max(13,Math.min(26,(620-L-10)/cols.length)),gap=2.5;
  var W=620,H=T+rows.length*(cell+gap)+18;
  var max=1; vals.forEach(function(r){r.forEach(function(v){if(v>max)max=v;});});
  var g='',i,j;
  for(j=0;j<cols.length;j++){
    if(j%Math.ceil(cols.length/16)===0)
      g+='<text class="axtx" x="'+(L+j*(cell+gap)+cell/2)+'" y="'+(T-7)+'" text-anchor="middle">'+esc(cols[j])+'</text>';
  }
  for(i=0;i<rows.length;i++){
    g+='<text class="axtx" x="'+(L-9)+'" y="'+(T+i*(cell+gap)+cell/2+3.5)+'" text-anchor="end" style="font-weight:700;fill:#4b5563">'+esc(rows[i])+'</text>';
    for(j=0;j<cols.length;j++){
      var v=(vals[i]&&vals[i][j])||0;
      var k=v===0?0:Math.min(HEAT.length-1,1+Math.floor((v/max)*(HEAT.length-2)));
      g+='<rect class="hcell" x="'+(L+j*(cell+gap))+'" y="'+(T+i*(cell+gap))+'" width="'+cell+'" height="'+cell+
         '" rx="3" fill="'+(v===0?'#f4f6f8':HEAT[k])+'" data-tip="<b>'+esc(rows[i])+'</b> · '+esc(cols[j])+'<br>'+v+' việc"/>';
    }
  }
  box.innerHTML=sv(W,H,g);
  bindTip(box,'rect[data-tip]');
}

/* ============================================================================
   DASHBOARD
   ========================================================================== */
/* Nhớ dữ liệu vừa tải để chuyển tab qua lại không phải gọi server lại từ đầu */
var FRESH={};
function isFresh(key,ms){
  var t=FRESH[key];
  return t && (Date.now()-t) < (ms||90000);
}
function markFresh(key){ FRESH[key]=Date.now(); }
var DASH=null;
function loadDash(force){
  var m=document.getElementById('dMonth').value||monthStr();
  var u=document.getElementById('dUser').value||'';
  var key='dash|'+m+'|'+u;
  if(!force && DASH && isFresh(key)){ renderDash(); return; }
  call('api_dashboard',[{month:m,userId:u}],DASH?'':'Đang tổng hợp dữ liệu...').then(function(d){
    markFresh(key);
    DASH=d; renderDash();
    if(force) toast('Đã cập nhật dashboard.','ok');
  }).catch(err);
}
function renderDash(){
  var d=DASH,k=d.kpi;
  var diff=k.total-k.prevTotal;
  var dTx=k.prevTotal? (diff>=0?'▲ +':'▼ ')+nf(Math.abs(diff))+' việc so với tháng trước':'chưa có dữ liệu tháng trước';
  document.getElementById('dashHero').innerHTML=
    '<div class="hero"><div class="hero-v c-gold">'+nf(k.total)+'</div>'+
    '<div class="hero-l">công việc trong <b>'+esc(d.monthLabel)+'</b>'+
    (d.scopeName?' · phạm vi: <b>'+esc(d.scopeName)+'</b>':'')+
    '<div class="stat-d '+(diff>=0?'up':'down')+'">'+dTx+'</div></div></div>'+
    '<div style="margin-top:12px"><div class="pbar'+(k.rate>=80?' ok':'')+'"><i style="width:'+k.rate+'%"></i></div>'+
    '<div class="hint" style="margin-top:6px">Tỉ lệ hoàn thành <b>'+k.rate+'%</b> — '+nf(k.done)+'/'+nf(k.total)+' việc'+
    (k.prevRate?' (tháng trước '+k.prevRate+'%)':'')+'</div></div>';

  document.getElementById('dashKpi').innerHTML=
    tile(nf(k.done),'Hoàn thành','c-ok')+
    tile(nf(k.doing),'Đang làm','c-warn')+
    tile(nf(k.todo),'Chưa làm','c-bad')+
    tile(k.avgPerDay,'TB việc / ngày làm việc','c-info')+
    tile(nf(k.pendingAsg),'Việc giao chờ phản hồi',k.pendingAsg?'c-warn':'c-dim')+
    tile(nf(k.posmAlert),'POSM cần thay ngay',k.posmAlert?'c-bad':'c-ok')+
    tile(nf(k.adsLive),'Quảng cáo đang chạy','c-gold')+
    tile(nf(k.activeDays),'Số ngày có phát sinh việc','c-dim');

  chLine('chDaily',d.daily.map(function(x){return x.label;}),[
    {name:'Việc trong ngày',color:PAL[1],data:d.daily.map(function(x){return x.created;}),fill:true},
    {name:'Đã hoàn thành',color:C_OK,data:d.daily.map(function(x){return x.done;})}
  ]);
  legend('lgDaily',[{label:'Việc trong ngày',color:PAL[1]},{label:'Đã hoàn thành',color:C_OK}]);

  chBarH('chUser',d.users.map(function(u,i){
    return {label:u.short,total:u.total,done:u.done,color:PAL[i%PAL.length]};
  }));
  legend('lgUser',[{label:'Đậm = đã hoàn thành',color:PAL[0]},{label:'Nhạt = tổng khối lượng',color:'#f9c9a8'}]);

  chDonut('chStatus',[
    {label:'Hoàn thành',value:k.done,color:C_OK},
    {label:'Đang làm',value:k.doing,color:C_WARN},
    {label:'Chưa làm',value:k.todo,color:C_BAD}
  ],'việc');
  legend('lgStatus',[]);

  chBarV('chCat',d.cats.map(function(c,i){return {label:c.name,value:c.total,color:PAL[i%PAL.length]};}));
  chBarV('chWeek',d.weeks.map(function(w){return {label:w.label,value:w.total,color:PAL[0]};}));

  document.getElementById('dashInsights').innerHTML=d.insights.length?d.insights.map(function(i){
    var ic=i.level==='good'?'✅':(i.level==='warn'?'⚠️':(i.level==='bad'?'🚨':'💡'));
    return '<div class="ins '+i.level+'"><div class="ic">'+ic+'</div><div><b>'+esc(i.title)+'</b>'+
      '<div class="tx">'+esc(i.text)+'</div></div></div>';
  }).join(''):'<div class="hint">Chưa đủ dữ liệu để phân tích.</div>';

  var h='<div class="wrap-x"><table class="data"><thead><tr><th>Nhân sự</th><th class="num">Tổng</th>'+
    '<th class="num">Hoàn thành</th><th class="num">Đang làm</th><th class="num">Chưa làm</th><th class="num">Tỉ lệ</th>'+
    '<th>Nhóm việc nhiều nhất</th></tr></thead><tbody>';
  d.users.forEach(function(u){
    h+='<tr><td><b>'+esc(u.short)+'</b></td><td class="num">'+nf(u.total)+'</td><td class="num">'+nf(u.done)+
      '</td><td class="num">'+nf(u.doing)+'</td><td class="num">'+nf(u.todo)+'</td><td class="num">'+u.rate+
      '%</td><td>'+esc(u.topCat||'—')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  if(d.pending&&d.pending.length){
    h+='<div class="card-t" style="margin:16px 0 9px">Việc còn tồn cần xử lý ('+d.pending.length+')</div>'+
       '<div class="wrap-x"><table class="data"><thead><tr><th>Ngày</th><th>Nhân sự</th><th>Công việc</th>'+
       '<th>Nhóm</th><th>Trạng thái</th></tr></thead><tbody>';
    d.pending.forEach(function(p){
      h+='<tr><td>'+esc(p.date)+'</td><td>'+esc(p.user)+'</td><td>'+esc(p.task)+'</td><td>'+esc(p.cat)+
         '</td><td><span class="tag '+(p.status==='Đang làm'?'st-doing':'st-todo')+'">'+esc(p.status)+'</span></td></tr>';
    });
    h+='</tbody></table></div>';
  }
  document.getElementById('tvDash').innerHTML=h;
}
function toggleTbl(id){document.getElementById(id).classList.toggle('on');}

/* ============================================================================
   GIAO VIỆC
   ========================================================================== */
function sendAssign(){
  var tx=document.getElementById('agTask').value.trim();
  if(!tx){toast('Nhập nội dung công việc trước đã.','bad');return;}
  var to=document.getElementById('agTo').value;
  if(!to){toast('Chọn người nhận việc.','bad');return;}
  call('api_assign',[{fromId:ME.id,toId:to,task:tx,date:document.getElementById('agDate').value,
    category:document.getElementById('agCat').value,priority:document.getElementById('agPri').value,
    note:document.getElementById('agNote').value}],'Đang giao việc...').then(function(){
    document.getElementById('agTask').value=''; document.getElementById('agNote').value='';
    toast('Đã giao việc và gửi thông báo.','ok'); loadAssign(true);
  }).catch(err);
}
var ASG=null;
function loadAssign(force){
  if(!force && ASG && isFresh('asg',30000)){ return; }
  call('api_assignments',[ME.id]).then(function(r){
    markFresh('asg');
    ASG=r;
    var pend=r.incoming.filter(function(a){return a.status==='Chờ phản hồi';}).length;
    document.getElementById('agInCount').textContent=pend;
    setAssignBadge(pend);
    document.getElementById('agIn').innerHTML=r.incoming.length?r.incoming.map(function(a){return asgCard(a,true);}).join('')
      :'<div class="empty"><div class="big">📭</div>Chưa có ai giao việc cho bạn.</div>';
    document.getElementById('agOut').innerHTML=r.outgoing.length?r.outgoing.map(function(a){return asgCard(a,false);}).join('')
      :'<div class="empty"><div class="big">📤</div>Bạn chưa giao việc cho ai.</div>';
  }).catch(err);
}
function asgCls(s){return s==='Chờ phản hồi'?'pending':(s==='Đã nhận'?'accepted':
  (s==='Kiến nghị'?'objected':(s==='Hoàn thành'?'done':'')));}
function asgCard(a,incoming){
  var stTag=a.status==='Hoàn thành'?'st-done':(a.status==='Đã nhận'?'cat':(a.status==='Kiến nghị'?'hi':'st-doing'));
  var h='<div class="asg '+asgCls(a.status)+'">'+
    '<div class="asg-h"><span class="tag '+stTag+'">'+
      (a.status==='Hoàn thành'?'✅ ':'')+esc(a.status)+'</span>'+
    '<span class="who">'+(incoming?'từ '+esc(a.fromName):'→ '+esc(a.toName))+'</span>'+
    '<div class="spacer"></div><span class="asg-m">'+esc(a.date)+'</span></div>'+
    '<div class="asg-tx">'+esc(a.task)+'</div>'+
    '<div class="asg-m" style="margin-top:4px">'+esc(a.category)+' · ưu tiên '+esc(a.priority)+
      (a.note?' · '+esc(a.note):'')+'</div>';
  if(a.response) h+='<div class="note '+(a.status==='Kiến nghị'?'warn':'ok')+'" style="margin:9px 0 0">'+
    '<b>'+(a.status==='Kiến nghị'?'Kiến nghị':'Phản hồi')+':</b> '+esc(a.response)+'</div>';
  if(incoming&&a.status==='Chờ phản hồi'){
    h+='<div class="asg-act"><button class="btn btn-ok btn-sm" onclick="doAccept(\''+a.id+'\')">✓ Chấp nhận — thêm vào tasklist</button>'+
       '<button class="btn btn-line btn-sm" onclick="openObject(\''+a.id+'\')">✋ Kiến nghị</button></div>';
  }
  return h+'</div>';
}
function doAccept(id){
  call('api_respondAssignment',[{id:id,userId:ME.id,action:'accept'}],'Đang xử lý...').then(function(){
    toast('Đã nhận việc — đã thêm vào tasklist của bạn.','ok');
    loadAssign(true); pulse();
  }).catch(err);
}
var OBJ_ID=null;
function openObject(id){
  OBJ_ID=id;
  var a=null; ASG.incoming.forEach(function(x){if(x.id===id)a=x;});
  document.getElementById('asgWhat').innerHTML='<b>Việc:</b> '+esc(a?a.task:'')+'<br><b>Người giao:</b> '+esc(a?a.fromName:'');
  document.getElementById('asgMsg').value='';
  openModal('mdAsg');
}
function doObject(){
  var m=document.getElementById('asgMsg').value.trim();
  if(!m){toast('Hãy ghi rõ kiến nghị của bạn.','bad');return;}
  call('api_respondAssignment',[{id:OBJ_ID,userId:ME.id,action:'object',message:m}],'Đang gửi...').then(function(){
    closeModal('mdAsg'); toast('Đã gửi kiến nghị cho người giao việc.','ok'); loadAssign(true);
  }).catch(err);
}

/* ============================================================================
   THÔNG BÁO
   ========================================================================== */
var NOTIF=[], NOTIF_TIMER=null;
function pollNotif(){
  if(!ME)return;
  call('api_unread',[ME.id]).then(function(r){
    var b=document.getElementById('bellDot');
    var nv=document.getElementById('nav-notif');
    if(r.count>0){ b.textContent=r.count>99?'99+':r.count; b.classList.add('on'); }
    else b.classList.remove('on');
    if(nv) nv.innerHTML='<span class="ic">🔔</span><span class="lb">Thông báo</span>'+
      (r.count>0?'<span class="nvdot">'+r.count+'</span>':'');
    var prev=window.__prevUnread;
    if(window.__notifReady && prev!==undefined && r.count>prev){
      ting();
      toast('🔔 '+(r.latestTitle||'Bạn có thông báo mới'),'ok');
    }
    window.__prevUnread=r.count;
    window.__notifReady=true;
  }).catch(function(){});
}
function loadNotif(force){
  if(!force && NOTIF && NOTIF.length && isFresh('notif',20000)){ return; }
  call('api_notifications',[ME.id]).then(function(list){
    markFresh('notif');
    NOTIF=list;
    document.getElementById('nfList').innerHTML=list.length?list.map(function(n){
      var cls=n.type==='ASSIGN'?'asg':(n.type==='ACCEPT'?'ok':(n.type==='OBJECT'?'bad':
        (n.type==='DONE'?'done':'sys')));
      var ic=n.type==='ASSIGN'?'📌':(n.type==='ACCEPT'?'🤝':(n.type==='OBJECT'?'✋':
        (n.type==='DONE'?'✅':(n.type==='MOVIE'?'🎬':(n.type==='STATUS'?'💬':'📢')))));
      return '<div class="nf '+(n.read?'':'un')+'" onclick="openNotif(\''+n.id+'\',\''+esc(n.goto||'')+'\')">'+
        '<div class="nf-ic '+cls+'">'+ic+'</div>'+
        '<div class="nf-b"><div class="nf-t"><b>'+esc(n.title)+'</b><br>'+esc(n.body)+'</div>'+
        '<div class="nf-time">'+esc(n.time)+'</div></div><div class="nf-dot"></div></div>';
    }).join(''):'<div class="empty"><div class="big">🔔</div>Chưa có thông báo nào.</div>';
    if(force) toast('Đã tải lại thông báo.','ok');
  }).catch(err);
}
function openNotif(id,gotoTab){
  call('api_markRead',[{id:id,userId:ME.id}]).then(function(){
    delete FRESH['notif']; pulse();
    if(gotoTab) go(gotoTab); else loadNotif(true);
  }).catch(err);
}
function readAllNotif(){
  call('api_markRead',[{all:true,userId:ME.id}],'Đang xử lý...').then(function(){
    loadNotif(true); pulse(); toast('Đã đánh dấu đã đọc tất cả.','ok');
  }).catch(err);
}
function clearNotif(){
  if(!confirm('Xoá toàn bộ thông báo của bạn? Việc này không khôi phục lại được.')) return;
  call('api_clearNotifications',[ME.id],'Đang xoá...').then(function(r){
    toast('Đã xoá '+r.count+' thông báo.','ok');
    window.__prevUnread=0;
    loadNotif(true); pulse();
  }).catch(err);
}
function goNotif(){go('notif');}

/* ============================================================================
   QUẢNG CÁO STARLIGHT
   ========================================================================== */
var ADS=null;
function loadAds(force){
  if(!force && ADS && isFresh('ads')){ renderAds(); return; }
  call('api_getAds',[],ADS?'':'Đang tải quảng cáo...').then(function(r){
    markFresh('ads');
    ADS=r; renderAds(); if(force)toast('Đã tải lại.','ok');
  }).catch(err);
}
function renderAds(){
  var r=ADS, list=r.ads;
  document.getElementById('adNote').innerHTML = r.meta.connected
    ? '<div class="note ok">Đã kết nối Meta — số liệu tự động cập nhật khi bấm <b>Đồng bộ từ Meta</b>. '+
      'Lần đồng bộ gần nhất: <b>'+esc(r.meta.lastSync||'chưa có')+'</b></div>'
    : '<div class="note warn">Chưa kết nối Meta. Vẫn dùng được bình thường bằng cách nhập tay số liệu từ '+
      '<a href="https://www.facebook.com/ads/library/" target="_blank">Meta Ad Library</a> hoặc Trình quản lý quảng cáo. '+
      'Muốn tự động thì bấm <b>⚙️ Kết nối Meta</b>.</div>';
  var live=list.filter(function(a){return a.status==='Đang chạy';});
  var sum=function(k){var s=0;list.forEach(function(a){s+=Number(a[k])||0;});return s;};
  document.getElementById('adKpi').innerHTML=
    tile(nf(live.length),'Đang chạy','c-ok')+tile(nf(list.length-live.length),'Đã tắt','c-dim')+
    tile(nf(sum('likes')),'Tổng like','c-gold')+tile(nf(sum('views')),'Tổng lượt xem','c-info')+
    tile(nf(sum('reach')),'Tổng reach','c-info')+tile(nf(sum('impressions')),'Impressions','c-dim')+
    tile(nf(sum('comments')),'Comment','c-warn')+tile(nf(sum('spend')),'Đã chi (VNĐ)','c-bad');
  chBarV('chAdEng',list.slice(0,10).map(function(a,i){
    return {label:a.name,value:(Number(a.likes)||0)+(Number(a.comments)||0)+(Number(a.shares)||0),color:PAL[i%PAL.length]};
  }));
  chDonut('chAdSt',[{label:'Đang chạy',value:live.length,color:C_OK},
    {label:'Đã tắt',value:list.length-live.length,color:C_DIM}],'quảng cáo');
  document.getElementById('adList').innerHTML=list.length?list.map(function(a){
    var on=a.status==='Đang chạy';
    return '<div class="adcard '+(on?'':'off')+'">'+
      '<div class="ad-h"><span class="dot '+(on?'live':'stop')+'"></span>'+
      '<div class="ad-n" title="'+esc(a.name)+'">'+esc(a.name)+'</div>'+
      '<button class="iconbtn" onclick="openAd(\''+a.id+'\')" title="Sửa">✎</button></div>'+
      '<div class="hint">'+esc(a.platform)+' · '+esc(a.start||'?')+(a.end?' → '+esc(a.end):'')+
      (a.source==='API'?' · <span class="tag st-done">tự động</span>':'')+'</div>'+
      '<div class="ad-m">'+
        '<div><div class="v">'+nf(a.likes)+'</div><div class="l">Like</div></div>'+
        '<div><div class="v">'+nf(a.views)+'</div><div class="l">Xem</div></div>'+
        '<div><div class="v">'+nf(a.reach)+'</div><div class="l">Reach</div></div>'+
        '<div><div class="v">'+nf(a.comments)+'</div><div class="l">Cmt</div></div>'+
      '</div>'+
      (a.note?'<div class="hint" style="margin-top:8px">'+esc(a.note)+'</div>':'')+
      (a.link?'<div style="margin-top:8px"><a class="btn btn-line btn-sm" href="'+esc(a.link)+'" target="_blank">Xem trên Meta ↗</a></div>':'')+
      '</div>';
  }).join(''):'<div class="empty"><div class="big">📣</div>Chưa có quảng cáo nào. Bấm <b>+ Thêm quảng cáo</b> hoặc đồng bộ từ Meta.</div>';
}
var AD_ID='';
function openAd(id){
  AD_ID=id||'';
  var a=null; if(ADS) ADS.ads.forEach(function(x){if(x.id===id)a=x;});
  document.getElementById('adTitle').textContent=a?'Sửa quảng cáo':'Thêm quảng cáo';
  document.getElementById('adDel').style.display=a?'inline-flex':'none';
  var set=function(el,v){document.getElementById(el).value=v||'';};
  set('adName',a?a.name:''); set('adStart',a?a.start:todayStr()); set('adEnd',a?a.end:'');
  set('adSpend',a?a.spend:''); set('adReach',a?a.reach:''); set('adImp',a?a.impressions:'');
  set('adView',a?a.views:''); set('adLike',a?a.likes:''); set('adCmt',a?a.comments:'');
  set('adShare',a?a.shares:''); set('adLink',a?a.link:''); set('adNoteTx',a?a.note:'');
  document.getElementById('adPlat').value=a?a.platform:'Facebook';
  document.getElementById('adSt').value=a?a.status:'Đang chạy';
  openModal('mdAd');
}
function saveAd(){
  var v=function(id){return document.getElementById(id).value;};
  if(!v('adName').trim()){toast('Nhập tên quảng cáo.','bad');return;}
  call('api_saveAd',[{id:AD_ID,userId:ME.id,name:v('adName'),platform:v('adPlat'),status:v('adSt'),
    start:v('adStart'),end:v('adEnd'),spend:v('adSpend'),reach:v('adReach'),impressions:v('adImp'),
    views:v('adView'),likes:v('adLike'),comments:v('adCmt'),shares:v('adShare'),link:v('adLink'),
    note:v('adNoteTx')}],'Đang lưu...').then(function(){
    closeModal('mdAd'); toast('Đã lưu quảng cáo.','ok'); loadAds(true);
  }).catch(err);
}
function delAd(){
  if(!AD_ID)return;
  call('api_deleteAd',[{id:AD_ID,userId:ME.id}],'Đang xoá...').then(function(){
    closeModal('mdAd'); toast('Đã xoá.','ok'); loadAds(true);
  }).catch(err);
}
function syncAds(){
  call('api_syncAdsFromMeta',[ME.id],'Đang gọi Meta Marketing API...').then(function(r){
    toast(r.message,r.count?'ok':'bad'); loadAds(true);
  }).catch(err);
}
function openMeta(){
  call('api_getMetaSettings',[ME.id]).then(function(s){
    document.getElementById('mtToken').value=s.tokenMasked||'';
    document.getElementById('mtAct').value=s.actId||'';
    document.getElementById('mtPage').value=s.pageId||'';
    openModal('mdMeta');
  }).catch(err);
}
function saveMeta(){
  call('api_saveMetaSettings',[{userId:ME.id,token:document.getElementById('mtToken').value,
    actId:document.getElementById('mtAct').value,pageId:document.getElementById('mtPage').value}],'Đang lưu...').then(function(){
    closeModal('mdMeta'); toast('Đã lưu cấu hình Meta.','ok'); loadAds(true);
  }).catch(err);
}
function testMeta(){
  call('api_testMeta',[ME.id],'Đang kiểm tra...').then(function(r){
    toast(r.message,r.ok?'ok':'bad');
  }).catch(err);
}

/* ============================================================================
   RADAR ĐỐI THỦ
   ========================================================================== */
var RIVAL=null;
function loadRival(force){
  if(!force && RIVAL && isFresh('rival')){ renderRival(); return; }
  call('api_getRivals',[],RIVAL?'':'Đang tải dữ liệu đối thủ...').then(function(r){
    markFresh('rival');
    RIVAL=r; renderRival(); if(force)toast('Đã tải lại.','ok');
  }).catch(err);
}
function renderRival(){
  var r=RIVAL;
  document.getElementById('rvNote').innerHTML=
    '<div class="note">Bấm vào tên thương hiệu để <b>mở thẳng Meta Ad Library</b> đã lọc sẵn theo Việt Nam — '+
    'thấy quảng cáo nào đáng chú ý thì bấm <b>+ Ghi nhận quảng cáo</b> để lưu lại, hệ thống tự vẽ biểu đồ so sánh theo thời gian.'+
    (r.apiNote?'<br><span style="font-size:12px">'+esc(r.apiNote)+'</span>':'')+'</div>';
  document.getElementById('rvBrands').innerHTML=r.brands.map(function(b){
    return '<a class="brandchip" href="'+esc(b.url)+'" target="_blank" title="Mở Ad Library của '+esc(b.name)+'">'+
      '<b>'+esc(b.name)+'</b><span class="badge '+(b.running?'':'dim')+'">'+b.logged+'</span></a>';
  }).join('')+'<button class="brandchip" onclick="openRival(\'\')">+ Ghi nhận</button>';
  var tot=r.items.length, run=r.items.filter(function(i){return i.running==='Còn chạy';}).length;
  var sum=function(k){var s=0;r.items.forEach(function(i){s+=Number(i[k])||0;});return s;};
  document.getElementById('rvKpi').innerHTML=
    tile(nf(tot),'Quảng cáo đã ghi nhận','c-gold')+tile(nf(run),'Đang còn chạy','c-ok')+
    tile(nf(r.brands.length),'Thương hiệu theo dõi','c-info')+tile(nf(sum('likes')),'Tổng like của đối thủ','c-warn');
  chBarV('chRvBrand',r.byBrand.map(function(b,i){return {label:b.brand,value:b.running,color:PAL[i%PAL.length]};}));
  chBarV('chRvFmt',r.byFormat.map(function(f,i){return {label:f.format,value:f.count,color:PAL[(i+1)%PAL.length]};}));
  var h='<thead><tr><th>Ngày ghi nhận</th><th>Thương hiệu</th><th>Nội dung</th><th>Định dạng</th>'+
    '<th>Bắt đầu</th><th class="num">Like</th><th class="num">Xem</th><th>Trạng thái</th><th>Nhận xét</th><th></th></tr></thead><tbody>';
  if(!r.items.length){
    h+='<tr><td colspan="10"><div class="empty"><div class="big">🕵️</div>Chưa ghi nhận quảng cáo nào của đối thủ.</div></td></tr>';
  } else r.items.forEach(function(i){
    h+='<tr><td>'+esc(i.snapshot)+'</td><td><b>'+esc(i.brand)+'</b></td><td>'+esc(i.text)+'</td><td>'+esc(i.format)+
      '</td><td>'+esc(i.start||'—')+'</td><td class="num">'+nf(i.likes)+'</td><td class="num">'+nf(i.views)+
      '</td><td><span class="tag '+(i.running==='Còn chạy'?'st-done':'st-todo')+'">'+esc(i.running)+'</span></td>'+
      '<td>'+esc(i.insight||'—')+'</td><td>'+
      (i.link?'<a class="btn btn-line btn-sm" href="'+esc(i.link)+'" target="_blank">↗</a> ':'')+
      '<button class="iconbtn" onclick="openRival(\''+i.id+'\')">✎</button></td></tr>';
  });
  document.getElementById('rvTable').innerHTML=h+'</tbody>';
}
var RV_ID='';
function openRival(id){
  RV_ID=id||'';
  var it=null; if(RIVAL) RIVAL.items.forEach(function(x){if(x.id===id)it=x;});
  document.getElementById('rvTitle').textContent=it?'Sửa ghi nhận':'Ghi nhận quảng cáo đối thủ';
  document.getElementById('rvDel').style.display=it?'inline-flex':'none';
  fill('rvBrand',RIVAL.brands.map(function(b){return b.name;}).concat(['Khác']),it?it.brand:'');
  fill('rvFmt',['Ảnh đơn','Carousel','Video','Reels','Story','Collection','Khác'],it?it.format:'');
  fill('rvRun',['Còn chạy','Đã tắt'],it?it.running:'');
  document.getElementById('rvText').value=it?it.text:'';
  document.getElementById('rvStart').value=it?it.start:'';
  document.getElementById('rvLike').value=it?it.likes:'';
  document.getElementById('rvView').value=it?it.views:'';
  document.getElementById('rvLink').value=it?it.link:'';
  document.getElementById('rvIns').value=it?it.insight:'';
  openModal('mdRival');
}
function saveRival(){
  var v=function(id){return document.getElementById(id).value;};
  if(!v('rvText').trim()){toast('Nhập nội dung quảng cáo.','bad');return;}
  call('api_saveRival',[{id:RV_ID,userId:ME.id,brand:v('rvBrand'),format:v('rvFmt'),running:v('rvRun'),
    text:v('rvText'),start:v('rvStart'),likes:v('rvLike'),views:v('rvView'),link:v('rvLink'),
    insight:v('rvIns')}],'Đang lưu...').then(function(){
    closeModal('mdRival'); toast('Đã lưu ghi nhận.','ok'); loadRival(true);
  }).catch(err);
}
function delRival(){
  if(!RV_ID)return;
  call('api_deleteRival',[{id:RV_ID,userId:ME.id}],'Đang xoá...').then(function(){
    closeModal('mdRival'); toast('Đã xoá.','ok'); loadRival(true);
  }).catch(err);
}

/* ============================================================================
   TRA CỨU THÁNG CŨ
   ========================================================================== */
function loadArchive(){
  var m=document.getElementById('arMonth').value;
  if(!m){document.getElementById('arBody').innerHTML='<div class="hint">Chọn tháng để xem.</div>';return;}
  call('api_getArchive',[m,ME.id],'Đang tra cứu kho lưu trữ...').then(function(a){
    var k=a.kpi;
    var h='<div class="hero"><div class="hero-v c-gold">'+nf(k.total)+'</div><div class="hero-l">công việc trong <b>'+
      esc(a.monthLabel)+'</b><div class="stat-d">'+(a.archived?'đã chốt sổ ngày '+esc(a.archivedAt):'tháng đang chạy')+'</div></div></div>';
    h+='<div class="grid g4" style="margin:14px 0">'+
      tile(nf(k.done),'Hoàn thành','c-ok')+tile(nf(k.doing),'Đang làm','c-warn')+
      tile(nf(k.todo),'Chưa làm','c-bad')+tile(k.rate+'%','Tỉ lệ hoàn thành',k.rate>=80?'c-ok':'c-warn')+'</div>';
    if(a.reportUrl) h+='<div class="note ok">File Excel chốt sổ tháng này: '+
      '<a href="'+esc(a.reportUrl)+'" target="_blank"><b>mở trên Drive ↗</b></a></div>';
    h+='<div class="grid g2" style="margin-bottom:14px">'+
      '<div class="chartbox"><div class="ch-h"><div class="ch-t">Khối lượng theo nhân sự</div></div>'+
      '<div class="ch-body" id="chArUser"></div></div>'+
      '<div class="chartbox"><div class="ch-h"><div class="ch-t">Khối lượng theo nhóm công việc</div></div>'+
      '<div class="ch-body" id="chArCat"></div></div></div>';
    h+='<div class="hint" style="margin-bottom:8px">Danh sách chi tiết '+a.tasks.length+' công việc (cuộn trong khung):</div>'+
      '<div class="wrap-x" style="max-height:58vh;overflow:auto"><table class="data"><thead><tr><th>Ngày</th><th>Nhân sự</th><th>Công việc</th>'+
      '<th>Nhóm</th><th>Trạng thái</th></tr></thead><tbody>';
    a.tasks.forEach(function(t){
      h+='<tr><td>'+esc(t.date)+'</td><td>'+esc(t.user)+'</td><td>'+esc(t.task)+'</td><td>'+esc(t.cat)+
        '</td><td><span class="tag '+(t.status==='Hoàn thành'?'st-done':(t.status==='Đang làm'?'st-doing':'st-todo'))+
        '">'+esc(t.status)+'</span></td></tr>';
    });
    if(!a.tasks.length) h+='<tr><td colspan="5"><div class="empty"><div class="big">🗂</div>Tháng này không có dữ liệu.</div></td></tr>';
    h+='</tbody></table></div>';
    document.getElementById('arBody').innerHTML=h;
    chBarH('chArUser',a.users.map(function(u,i){return {label:u.short,total:u.total,done:u.done,color:PAL[i%PAL.length]};}));
    chBarV('chArCat',a.cats.map(function(c,i){return {label:c.name,value:c.total,color:PAL[i%PAL.length]};}));
  }).catch(err);
}


/* ============================================================================
   v3 — ÂM THANH THÔNG BÁO
   ========================================================================== */
var SND=true, AC=null;
try{ if(window.localStorage && localStorage.getItem('stl_snd')==='0') SND=false; }catch(e){}
function initAudio(){
  try{
    if(!AC){ var C=window.AudioContext||window.webkitAudioContext; if(C) AC=new C(); }
    if(AC && AC.state==='suspended') AC.resume();
  }catch(e){}
}
/** tiếng "ting" nhẹ 2 nốt (E6 → A6), không giật mình */
function ting(){
  if(!SND) return;
  initAudio(); if(!AC) return;
  try{
    var t=AC.currentTime;
    [[1318.5,0,0.16],[1760,0.085,0.12]].forEach(function(p){
      var o=AC.createOscillator(), g=AC.createGain();
      o.type='sine'; o.frequency.value=p[0];
      g.gain.setValueAtTime(0.0001,t+p[1]);
      g.gain.linearRampToValueAtTime(p[2],t+p[1]+0.012);
      g.gain.exponentialRampToValueAtTime(0.0008,t+p[1]+0.6);
      o.connect(g); g.connect(AC.destination);
      o.start(t+p[1]); o.stop(t+p[1]+0.65);
    });
  }catch(e){}
}
function toggleSnd(){
  SND=!SND;
  var b=document.getElementById('sndBtn');
  b.textContent=SND?'🔊':'🔇';
  if(SND) b.classList.remove('off'); else b.classList.add('off');
  b.title=SND?'Âm thanh thông báo: ĐANG BẬT':'Âm thanh thông báo: ĐANG TẮT';
  try{ if(window.localStorage) localStorage.setItem('stl_snd',SND?'1':'0'); }catch(e){}
  if(SND){ ting(); toast('Đã bật âm thanh thông báo.','ok'); }
  else toast('Đã tắt âm thanh thông báo.');
}

/* ============================================================================
   v3 — VÒNG TIẾN ĐỘ + THANH NGÀY CỦA TAB HÔM NAY
   ========================================================================== */
function chRing(id,pct,done,total){
  var box=document.getElementById(id); if(!box)return;
  var r=44, c=2*Math.PI*r, off=c*(1-Math.max(0,Math.min(100,pct))/100);
  var col=pct>=80?'#0f7b52':(pct>=50?'#f26f21':'#c8382b');
  box.innerHTML='<svg viewBox="0 0 112 112">'+
    '<circle cx="56" cy="56" r="'+r+'" fill="none" stroke="#eef1f5" stroke-width="11"/>'+
    '<circle cx="56" cy="56" r="'+r+'" fill="none" stroke="'+col+'" stroke-width="11" stroke-linecap="round" '+
      'stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+off.toFixed(1)+'" transform="rotate(-90 56 56)"/>'+
    '<text x="56" y="52" text-anchor="middle" style="font-size:23px;font-weight:800;fill:'+col+'">'+pct+'%</text>'+
    '<text x="56" y="70" text-anchor="middle" style="font-size:11px;fill:#8b93a1">'+done+'/'+total+' việc</text>'+
    '</svg>';
}
var DOW_VI=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
function renderDayBar(date){
  var d=new Date(date+'T00:00:00');
  document.getElementById('tDayNum').textContent=d.getDate();
  document.getElementById('tDayTop').textContent=DOW_VI[d.getDay()]+', '+d.getDate()+' tháng '+(d.getMonth()+1)+' '+d.getFullYear();
  var extra=date===todayStr()?'':'  ·  đang xem lại ngày khác';
  document.getElementById('tGreet').textContent=greetLine()+extra;
}

/* ============================================================================
   v3 — QUẢN TRỊ 6 FANPAGE
   ========================================================================== */
var FP=null, FP_RANGE='7d';
function fpSetRange(r,btn){
  FP_RANGE=r;
  Array.prototype.forEach.call(document.querySelectorAll('#fpRange button'),function(b){b.classList.remove('on');});
  if(btn) btn.classList.add('on');
  loadFp();
}
function loadFp(force){
  var pg=document.getElementById('fpPage').value||'';
  var key='fp|'+FP_RANGE+'|'+pg;
  if(!force && FP && isFresh(key)){ renderFp(); return; }
  call('api_getFanpages',[{range:FP_RANGE,page:pg}],FP?'':'Đang tổng hợp fanpage...').then(function(r){
    markFresh(key);
    FP=r; renderFp(); if(force) toast('Đã cập nhật.','ok');
  }).catch(err);
}
function renderFp(){
  var r=FP, k=r.kpi;
  var sel=document.getElementById('fpPage');
  if(sel.options.length<=1||sel.getAttribute('data-n')!=String(r.pages.length)){
    var cur=sel.value;
    sel.innerHTML='<option value="">Tất cả 6 fanpage</option>'+
      r.pages.map(function(p){return '<option value="'+esc(p.name)+'">'+esc(p.cinema||p.name)+'</option>';}).join('');
    sel.setAttribute('data-n',String(r.pages.length));
    if(cur) sel.value=cur;
  }
  document.getElementById('fpNote').innerHTML = r.meta.connected
    ? '<div class="note ok">Đã có token Meta. Bấm <b>🔄 Đồng bộ từ Facebook</b> để tự lấy bài viết + tương tác 30 ngày gần nhất '+
      '(cần nhập Page ID từng rạp ở <b>⚙️ Cấu hình fanpage</b>). Lần đồng bộ gần nhất: <b>'+esc(r.meta.lastSync||'chưa có')+'</b></div>'
    : '<div class="note warn">Chưa kết nối Meta — vẫn dùng bình thường bằng cách bấm <b>+ Thêm bài viết</b> và nhập số liệu '+
      'từ Meta Business Suite (mất ~2 phút/ngày cho 6 page). Muốn tự động thì vào tab <b>Quảng cáo Starlight → ⚙️ Kết nối Meta</b> '+
      'rồi nhập Page ID ở <b>⚙️ Cấu hình fanpage</b>.</div>';

  document.getElementById('fpToday').innerHTML=r.todayStatus.map(function(s){
    return '<div class="pgchip '+(s.posted?'ok':'no')+'">'+(s.posted?'✅':'⛔')+' '+esc(s.cinema||s.page)+
      '<span class="n">'+(s.posted?s.count+' bài':'chưa đăng')+'</span></div>';
  }).join('');

  document.getElementById('fpKpi').innerHTML=
    tile(nf(k.posts),'Bài viết '+r.rangeLabel,'c-gold')+
    tile(nf(k.eng),'Tổng tương tác','c-info')+
    tile(nf(k.avg),'TB tương tác / bài','c-ok')+
    tile(nf(k.reach),'Tổng reach','c-dim')+
    tile(nf(k.likes),'Like','c-gold')+tile(nf(k.comments),'Comment','c-warn')+
    tile(nf(k.shares),'Share','c-info')+
    tile(k.pagesNotPosted+'/'+k.pageCount,'Fanpage chưa đăng hôm nay',k.pagesNotPosted?'c-bad':'c-ok');

  var bp=k.bestPost;
  document.getElementById('fpChamp').innerHTML = bp
    ? '<div class="champ"><div class="medal">🏆</div><div style="flex:1;min-width:0">'+
      '<div class="hint" style="text-transform:uppercase;letter-spacing:.6px;font-weight:800;color:var(--gold-dim)">'+
      'Bài viết tương tác cao nhất '+esc(r.rangeLabel)+'</div>'+
      '<div class="ct">'+esc(bp.content)+'</div>'+
      '<div class="hint">'+esc(bp.page)+' · '+esc(bp.type)+' · đăng '+esc(bp.date)+
      (bp.link?' · <a href="'+esc(bp.link)+'" target="_blank">mở bài viết ↗</a>':'')+'</div>'+
      '<div class="cm"><div>Tương tác<b>'+nf(bp.eng)+'</b></div><div>Like<b>'+nf(bp.likes)+'</b></div>'+
      '<div>Comment<b>'+nf(bp.comments)+'</b></div><div>Share<b>'+nf(bp.shares)+'</b></div>'+
      '<div>Reach<b>'+nf(bp.reach)+'</b></div></div></div></div>'
    : '';

  chBarH('chFpPage',r.byPage.map(function(p,i){
    return {label:p.cinema||p.page,total:p.eng,color:PAL[i%PAL.length],
      sub:p.posts+' bài · TB '+nf(p.avg)+'/bài · reach '+nf(p.reach)};
  }),{solid:true,unit:'tương tác',l:120});
  chBarV('chFpType',r.byType.map(function(t,i){return {label:t.type,value:t.avg,color:PAL[i%PAL.length]};}),
    null,{unit:'tương tác/bài'});
  chLine('chFpDaily',r.daily.map(function(d){return d.label;}),[
    {name:'Tương tác',color:PAL[0],data:r.daily.map(function(d){return d.eng;}),fill:true}
  ],{w:1120,h:250,extra:r.daily.map(function(d){return '📝 '+d.posts+' bài đăng';})});
  legend('lgFpDaily',[]);

  var row=function(p,i,rank){
    return '<div class="pitem'+(rank&&i===0?' top1':'')+'" onclick="openPost(\''+p.id+'\')">'+
      '<div class="rk">'+(rank?(i+1):'·')+'</div>'+
      '<div class="pb"><div class="pt">'+esc(p.content)+'</div>'+
      '<div class="pm">'+esc(p.page)+' · '+esc(p.type)+' · '+esc(p.date)+
      ' · 👍 '+nf(p.likes)+' 💬 '+nf(p.comments)+' 🔁 '+nf(p.shares)+'</div></div>'+
      '<div class="pe"><b>'+nf(p.eng)+'</b><span>tương tác</span></div></div>';
  };
  document.getElementById('fpTop').innerHTML=r.top.length?r.top.map(function(p,i){return row(p,i,true);}).join('')
    :'<div class="empty"><div class="big">📘</div>Chưa có bài viết nào trong kỳ này.</div>';
  document.getElementById('fpWeak').innerHTML=r.weak.length?r.weak.map(function(p,i){return row(p,i,false);}).join('')
    :'<div class="hint">Chưa đủ dữ liệu để so sánh.</div>';

  document.getElementById('fpInsights').innerHTML=r.insights.map(function(i){
    var ic=i.level==='good'?'✅':(i.level==='warn'?'⚠️':(i.level==='bad'?'🚨':'💡'));
    return '<div class="ins '+i.level+'"><div class="ic">'+ic+'</div><div><b>'+esc(i.title)+'</b>'+
      '<div class="tx">'+esc(i.text)+'</div></div></div>';
  }).join('');

  var h='<thead><tr><th>Ngày</th><th>Fanpage</th><th>Nội dung</th><th>Định dạng</th>'+
    '<th class="num">Reach</th><th class="num">Like</th><th class="num">Cmt</th><th class="num">Share</th>'+
    '<th class="num">Tương tác</th><th></th></tr></thead><tbody>';
  if(!r.posts.length) h+='<tr><td colspan="10"><div class="empty"><div class="big">📝</div>Chưa có bài viết nào được ghi nhận.</div></td></tr>';
  else r.posts.slice().sort(function(a,b){return String(b.date).localeCompare(String(a.date));}).forEach(function(p){
    h+='<tr><td>'+esc(p.date)+'</td><td><b>'+esc(p.page)+'</b></td><td>'+esc(p.content)+'</td>'+
      '<td>'+esc(p.type)+'</td><td class="num">'+nf(p.reach)+'</td><td class="num">'+nf(p.likes)+
      '</td><td class="num">'+nf(p.comments)+'</td><td class="num">'+nf(p.shares)+
      '</td><td class="num"><b>'+nf(p.eng)+'</b></td><td>'+
      (p.link?'<a class="btn btn-line btn-sm" href="'+esc(p.link)+'" target="_blank">↗</a> ':'')+
      '<button class="iconbtn" onclick="openPost(\''+p.id+'\')">✎</button></td></tr>';
  });
  document.getElementById('fpTable').innerHTML=h+'</tbody>';
}
var PO_ID='';
function openPost(id){
  if(!FP){toast('Đang tải dữ liệu, thử lại sau 1 giây.','bad');return;}
  PO_ID=id||'';
  var p=null; FP.posts.forEach(function(x){if(x.id===id)p=x;});
  if(!p) FP.top.concat(FP.weak).forEach(function(x){if(x.id===id)p=x;});
  document.getElementById('poTitle').textContent=p?'Sửa bài viết':'Thêm bài viết';
  document.getElementById('poDel').style.display=p?'inline-flex':'none';
  fill('poPage',FP.pages.map(function(x){return x.name;}),p?p.page:'');
  fill('poType',FP.postTypes,p?p.type:'Ảnh');
  document.getElementById('poDate').value=p?p.date:todayStr();
  document.getElementById('poContent').value=p?p.content:'';
  document.getElementById('poReach').value=p?p.reach:'';
  document.getElementById('poLike').value=p?p.likes:'';
  document.getElementById('poCmt').value=p?p.comments:'';
  document.getElementById('poShare').value=p?p.shares:'';
  document.getElementById('poLink').value=p?p.link:'';
  openModal('mdPost');
}
function savePost(){
  var v=function(id){return document.getElementById(id).value;};
  if(!v('poContent').trim()){toast('Nhập nội dung bài viết.','bad');return;}
  call('api_savePost',[{id:PO_ID,userId:ME.id,page:v('poPage'),date:v('poDate'),type:v('poType'),
    content:v('poContent'),reach:v('poReach'),likes:v('poLike'),comments:v('poCmt'),shares:v('poShare'),
    link:v('poLink')}],'Đang lưu...').then(function(){
    closeModal('mdPost'); toast('Đã lưu bài viết.','ok'); loadFp(true);
  }).catch(err);
}
function delPost(){
  if(!PO_ID)return;
  call('api_deletePost',[{id:PO_ID,userId:ME.id}],'Đang xoá...').then(function(){
    closeModal('mdPost'); toast('Đã xoá.','ok'); loadFp(true);
  }).catch(err);
}
function openPages(){
  if(!FP)return;
  document.getElementById('pgList').innerHTML=FP.pages.map(function(p,i){
    return '<div class="pgrow"><div class="pn">'+esc(p.cinema||p.name)+'</div>'+
      '<input class="cell" id="pgN'+i+'" value="'+esc(p.name)+'" placeholder="Tên fanpage" style="flex:1.4">'+
      '<input class="cell" id="pgI'+i+'" value="'+esc(p.pageId||'')+'" placeholder="Page ID" style="flex:1">'+
      '<input class="cell" id="pgT'+i+'" placeholder="'+(p.hasToken?'(đã có token)':'Token riêng (nếu có)')+'" style="flex:1.2">'+
      '<input type="hidden" id="pgD'+i+'" value="'+esc(p.id)+'"></div>';
  }).join('');
  openModal('mdPages');
}
function savePages(){
  var n=FP.pages.length, done=0, errFlag=false;
  for(var i=0;i<n;i++){
    (function(i){
      call('api_saveFanpage',[{id:document.getElementById('pgD'+i).value,userId:ME.id,
        name:document.getElementById('pgN'+i).value,pageId:document.getElementById('pgI'+i).value,
        token:document.getElementById('pgT'+i).value}]).then(function(){
        done++; if(done===n&&!errFlag){closeModal('mdPages');toast('Đã lưu cấu hình fanpage.','ok');loadFp(true);}
      }).catch(function(e){errFlag=true;err(e);});
    })(i);
  }
}
function syncFp(){
  call('api_syncFanpages',[ME.id],'Đang gọi Facebook Graph API...').then(function(r){
    toast(r.message,r.count?'ok':'bad'); loadFp(true);
  }).catch(err);
}


/* ============================================================================
   v4 — CÂU CHÀO NGẪU NHIÊN
   ========================================================================== */
var QUOTES=[
 '"Việc hôm nay chớ để ngày mai." — tục ngữ Việt Nam',
 '"Có công mài sắt, có ngày nên kim." — tục ngữ Việt Nam',
 '"Đi một ngày đàng, học một sàng khôn." — tục ngữ Việt Nam',
 '"Muốn đi nhanh thì đi một mình, muốn đi xa thì đi cùng nhau." — ngạn ngữ châu Phi',
 '"Không có việc gì khó, chỉ sợ lòng không bền." — Hồ Chí Minh',
 '"Kỷ luật là cầu nối giữa mục tiêu và thành tựu." — Jim Rohn',
 '"Cách duy nhất để làm việc lớn là yêu việc mình làm." — Steve Jobs',
 '"Hoàn thành tốt hơn hoàn hảo." — Sheryl Sandberg',
 '"Bạn không cần phải giỏi để bắt đầu, nhưng phải bắt đầu thì mới giỏi được." — Zig Ziglar',
 '"Chất lượng không phải là hành động, đó là thói quen." — Aristotle',
 '"Thành công là tổng của những nỗ lực nhỏ lặp lại mỗi ngày." — Robert Collier',
 '"Sự tập trung là thứ tài nguyên khan hiếm nhất." — Cal Newport',
 '"Điều quan trọng không phải là bận rộn, mà là bận vì cái gì." — Henry David Thoreau',
 '"Kế hoạch dở vẫn hơn không có kế hoạch." — ngạn ngữ',
 '"Một giờ chuẩn bị tiết kiệm mười giờ sửa sai." — Dale Carnegie',
 '"Người thắng cuộc là người làm thêm một bước khi ai cũng dừng lại." — Roger Staubach',
 '"Đừng đếm số ngày, hãy làm cho mỗi ngày đáng được đếm." — Muhammad Ali',
 '"Nếu bạn muốn thay đổi kết quả, hãy đổi cách làm chứ đừng đổi lời than." — khuyết danh',
 '"Ý tưởng chỉ đáng giá khi được thực thi." — Steve Jobs',
 '"Sáng tạo là trí thông minh khi nó đang chơi đùa." — Albert Einstein',
 '"Chi tiết nhỏ làm nên sự khác biệt lớn." — khuyết danh',
 '"Người dùng không quan tâm bạn vất vả thế nào, họ chỉ thấy kết quả." — khuyết danh',
 '"Marketing giỏi làm cho công ty trông thông minh, marketing xuất sắc làm cho khách hàng thấy mình thông minh." — Joe Chernov',
 '"Nội dung hay là cuộc trò chuyện chứ không phải bài diễn văn." — Ann Handley',
 '"Đừng bán sản phẩm, hãy kể câu chuyện." — Seth Godin',
 '"Thương hiệu là những gì người ta nói về bạn khi bạn không có mặt." — Jeff Bezos',
 '"Nếu không đo được thì không cải thiện được." — Peter Drucker',
 '"Làm đúng việc quan trọng hơn làm việc thật nhanh." — Peter Drucker',
 '"Đơn giản là đỉnh cao của tinh tế." — Leonardo da Vinci',
 '"Bắt đầu từ nơi bạn đang đứng, dùng thứ bạn đang có, làm điều bạn có thể." — Arthur Ashe',
 '"Áp lực tạo ra kim cương." — Thomas Carlyle',
 '"Thất bại là gia vị làm cho thành công thêm ngọt." — Truman Capote',
 '"Cứ đi rồi sẽ đến." — Lỗ Tấn',
 '"Nước chảy đá mòn." — tục ngữ Việt Nam',
 '"Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao." — ca dao Việt Nam',
 '"Học ăn, học nói, học gói, học mở." — tục ngữ Việt Nam',
 '"Chậm mà chắc còn hơn nhanh mà hỏng." — tục ngữ Việt Nam',
 '"Muốn lành nghề, chớ nề học hỏi." — tục ngữ Việt Nam',
 '"Sự khác biệt giữa người bình thường và người phi thường nằm ở chữ thêm một chút." — Jimmy Johnson',
 '"Hãy làm hôm nay điều người khác không làm, để ngày mai có được điều người khác không có." — Jerry Rice',
 '"Cơ hội thường được ngụy trang thành công việc vất vả." — Thomas Edison',
 '"Thiên tài là 1% cảm hứng và 99% mồ hôi." — Thomas Edison',
 '"Điều tuyệt vời nhất về ngày mai là hôm nay mình có thể chuẩn bị cho nó." — khuyết danh',
 '"Nếu bạn thấy việc dễ, nghĩa là bạn đang giỏi lên." — khuyết danh',
 '"Đừng so sánh chương 1 của bạn với chương 20 của người khác." — khuyết danh',
 '"Người chuyên nghiệp là người vẫn làm tốt kể cả khi không có hứng." — khuyết danh',
 '"Rõ ràng là một dạng tử tế." — Brené Brown',
 '"Giao tiếp tốt cũng quan trọng như cà phê đen — và cũng giúp tỉnh táo y như vậy." — khuyết danh',
 '"Hãy tử tế, vì ai cũng đang chiến đấu một trận chiến bạn không biết." — Plato',
 '"Kiên nhẫn là sức mạnh, im lặng đúng lúc là trí tuệ." — ngạn ngữ',
 '"Thời gian là thứ duy nhất không mua lại được — hãy tiêu nó cho việc xứng đáng." — khuyết danh',
 '"Mỗi bài đăng hôm nay là một viên gạch cho thương hiệu ngày mai." — khuyết danh',
 '"Deadline là nguồn cảm hứng đáng tin cậy nhất của nhân loại." — khuyết danh',
 '"Bạn không thể quay ngược thời gian, nhưng có thể bắt đầu lại từ bây giờ." — C.S. Lewis',
 '"Không ai nhớ bạn đã làm nhanh thế nào, người ta chỉ nhớ bạn làm tốt ra sao." — khuyết danh',
 '"Việc nhỏ làm chỉn chu sẽ dẫn tới việc lớn được giao." — khuyết danh',
 '"Sự chuẩn bị là chìa khoá của tự tin." — Arthur Ashe',
 '"Ngày hôm nay là học trò của ngày hôm qua." — Publilius Syrus',
 '"Nếu mọi thứ đều quan trọng thì chẳng có gì quan trọng." — Patrick Lencioni',
 '"Cứ làm tốt phần của mình, phần còn lại vũ trụ lo." — khuyết danh',
 '"Thái độ quyết định độ cao." — Zig Ziglar',
 '"Người lạc quan thấy cơ hội trong khó khăn." — Winston Churchill',
 '"Hãy làm việc chăm chỉ trong im lặng, để thành công lên tiếng thay bạn." — Frank Ocean',
 '"Một ngày không cười là một ngày lãng phí." — Charlie Chaplin',
 '"Sự nghiệp được xây bằng những buổi sáng bình thường." — khuyết danh',
 '"Nếu bạn mệt, hãy học cách nghỉ chứ đừng bỏ cuộc." — Banksy',
 '"Không phải lúc nào cũng thắng, nhưng lúc nào cũng học được." — John C. Maxwell',
 '"Điều bạn làm hôm nay có thể cải thiện mọi ngày mai của bạn." — Ralph Marston',
 '"Rạp sáng đèn được là nhờ những việc nhỏ chạy đúng giờ." — khuyết danh',
 '"Khán giả không nhớ quảng cáo, họ nhớ cảm xúc." — khuyết danh',
 '"Làm marketing là gieo hạt: hôm nay gieo, mai mới hái." — khuyết danh'
];
function greetLine(){
  var h=new Date().getHours();
  var g=h<11?'Chào buổi sáng':(h<14?'Chào buổi trưa':(h<18?'Chào buổi chiều':'Chào buổi tối'));
  var name=ME?(ME.short||ME.name):'';
  if(Math.random()<0.34)
    return g+', '+name+' — hãy nhớ ghi tasklist trong ngày hôm nay nếu không sẽ bị QC gõ đầu :))';
  var last=-1;
  try{ last=parseInt(localStorage.getItem('stl_q')||'-1',10); }catch(e){}
  var i=Math.floor(Math.random()*QUOTES.length);
  if(i===last) i=(i+1+Math.floor(Math.random()*3))%QUOTES.length;
  try{ if(window.localStorage) localStorage.setItem('stl_q',String(i)); }catch(e){}
  return g+', '+name+' — '+QUOTES[i];
}

/* ============================================================================
   v4 — NGHỈ PHÉP
   ========================================================================== */
var LEAVE_NOW='';
function renderLeave(){
  var box=document.getElementById('leaveBar'); if(!box)return;
  var types=(BOOT&&BOOT.leaveTypes)||['Nghỉ phép cả ngày','Nghỉ buổi sáng','Nghỉ buổi chiều'];
  var ic={'Nghỉ phép cả ngày':'🌴','Nghỉ buổi sáng':'🌅','Nghỉ buổi chiều':'🌇'};
  box.innerHTML='<span class="hint" style="margin-right:4px">Báo nghỉ:</span>'+
    types.map(function(t){
      return '<button class="chip '+(LEAVE_NOW===t?'on':'')+'" onclick="setLeave(\''+esc(t)+'\')">'+
        (ic[t]||'🏖')+' '+esc(t)+'</button>';
    }).join('')+
    (LEAVE_NOW?'<button class="chip" onclick="setLeave(\'\')">✕ Huỷ báo nghỉ</button>':'');
  var b=document.getElementById('leaveBanner');
  if(b) b.innerHTML=LEAVE_NOW
    ? '<div class="note warn" style="margin:0 0 14px"><b>'+esc(LEAVE_NOW)+'</b> — ngày này đã được đánh dấu nghỉ, '+
      'cả team nhìn thấy ô xám trong <b>Tuần của team</b> và bạn không bị tính thiếu memo.</div>'
    : '';
}
function setLeave(t){
  if(t&&LEAVE_NOW===t) t='';
  call('api_setLeave',[{userId:ME.id,date:document.getElementById('tDate').value,type:t}],'Đang cập nhật...')
    .then(function(r){
      LEAVE_NOW=r.type||'';
      renderLeave();
      toast(LEAVE_NOW?('Đã báo '+LEAVE_NOW.toLowerCase()+'.'):'Đã huỷ báo nghỉ.','ok');
    }).catch(err);
}

/* ============================================================================
   v4 — PHIM ĐANG CHIẾU / SẮP CHIẾU
   ========================================================================== */
var MOVIES=null, MV_VER='', PENDING_POSTER=null;
function loadMovies(force){
  if(!force && MOVIES && MOVIES.movies && isFresh('movies')){ renderMovies(); return; }
  call('api_getMovies',[],force?'Đang tải lịch phim...':'').then(function(r){
    markFresh('movies');
    MOVIES=r; MV_VER=r.version||''; renderMovies();
    if(force) toast('Đã cập nhật lịch phim.','ok');
  }).catch(err);
}
function movieCard(m,editable){
  var cls=m.status==='Đang chiếu'?'now':(m.status==='Sắp chiếu'?'soon':'off');
  return '<div class="mv '+cls+'">'+
    '<div class="mv-p">'+(m.poster
      ? '<img src="'+esc(m.poster)+'" alt="'+esc(m.title)+'" loading="lazy" onerror="this.style.display=\'none\'">'
      : '<div class="mv-np">🎬</div>')+
    '<span class="mv-st">'+esc(m.status)+'</span></div>'+
    '<div class="mv-b"><div class="mv-t">'+esc(m.title)+'</div>'+
    '<div class="mv-m">'+[m.genre,m.duration,m.format,m.rating].filter(Boolean).map(esc).join(' · ')+'</div>'+
    '<div class="mv-d">'+(m.status==='Sắp chiếu'?'Khởi chiếu: ':'Từ ')+esc(m.release||'—')+
      (m.end?' → '+esc(m.end):'')+'</div>'+
    (m.note?'<div class="mv-n">'+esc(m.note)+'</div>':'')+
    (editable?'<div style="margin-top:8px"><button class="btn btn-line btn-sm" onclick="openMovie(\''+m.id+'\')">✎ Sửa</button></div>':'')+
    '</div></div>';
}
function renderMovies(){
  if(!MOVIES)return;
  var canEdit=ME&&(ME.role==='admin'||ME.isContent);
  var now=MOVIES.movies.filter(function(m){return m.status==='Đang chiếu';});
  var soon=MOVIES.movies.filter(function(m){return m.status==='Sắp chiếu';});
  var off=MOVIES.movies.filter(function(m){return m.status==='Ngừng chiếu';});
  var box=document.getElementById('mvBody'); if(!box)return;
  var sec=function(title,list,ic){
    if(!list.length) return '';
    return '<div class="card-h" style="margin-top:6px"><div class="card-t"><span class="ico">'+ic+'</span>'+title+
      ' <span class="badge ok">'+list.length+'</span></div></div><div class="mv-grid">'+
      list.map(function(m){return movieCard(m,canEdit);}).join('')+'</div>';
  };
  box.innerHTML=(MOVIES.movies.length
    ? sec('ĐANG CHIẾU',now,'🎬')+sec('SẮP CHIẾU',soon,'🍿')+sec('NGỪNG CHIẾU',off,'📁')
    : '<div class="empty"><div class="big">🎬</div>Chưa có phim nào. '+
      (canEdit?'Bấm <b>+ Thêm phim</b> để cập nhật.':'Chờ chuyên viên Content cập nhật.')+'</div>');
  var meta=document.getElementById('mvMeta');
  if(meta) meta.innerHTML=MOVIES.updatedAt
    ? 'Cập nhật gần nhất: <b>'+esc(MOVIES.updatedAt)+'</b>'+(MOVIES.updatedBy?' bởi '+esc(MOVIES.updatedBy):'')
    : '';
  var add=document.getElementById('mvAdd'); if(add) add.style.display=canEdit?'inline-flex':'none';
}
var MV_ID='';
function openMovie(id){
  MV_ID=id||''; PENDING_POSTER=null;
  var m=null; if(MOVIES) MOVIES.movies.forEach(function(x){if(x.id===id)m=x;});
  document.getElementById('mvTitle').textContent=m?'Sửa phim':'Thêm phim';
  document.getElementById('mvDel').style.display=m?'inline-flex':'none';
  fill('mvSt',(BOOT&&BOOT.movieStatuses)||['Đang chiếu','Sắp chiếu','Ngừng chiếu'],m?m.status:'Đang chiếu');
  var v=function(id,val){document.getElementById(id).value=val||'';};
  v('mvName',m?m.title:''); v('mvRel',m?m.release:''); v('mvEnd',m?m.end:'');
  v('mvGenre',m?m.genre:''); v('mvDur',m?m.duration:''); v('mvFmt',m?m.format:'');
  v('mvRate',m?m.rating:''); v('mvNote',m?m.note:'');
  document.getElementById('mvPrev').innerHTML=(m&&m.poster)
    ? '<img src="'+esc(m.poster)+'">' : '<div class="mv-np">🎬</div>';
  document.getElementById('mvFile').value='';
  openModal('mdMovie');
}
function pickPoster(input){
  var f=input.files&&input.files[0]; if(!f)return;
  if(f.size>8*1024*1024){toast('Ảnh quá lớn (>8MB), chọn ảnh nhẹ hơn.','bad');return;}
  var rd=new FileReader();
  rd.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var W=520, sc=Math.min(1,W/img.width);
      var c=document.createElement('canvas');
      c.width=Math.round(img.width*sc); c.height=Math.round(img.height*sc);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      var data=c.toDataURL('image/jpeg',0.82);
      document.getElementById('mvPrev').innerHTML='<img src="'+data+'">';
      showLoad('Đang tải poster lên Drive...');
      call('api_uploadPoster',[{userId:ME.id,data:data,name:'poster'}]).then(function(r){
        PENDING_POSTER=r; toast('Đã tải poster lên.','ok');
      }).catch(err);
    };
    img.src=e.target.result;
  };
  rd.readAsDataURL(f);
}
function saveMovie(){
  var v=function(id){return document.getElementById(id).value;};
  if(!v('mvName').trim()){toast('Nhập tên phim.','bad');return;}
  var p={id:MV_ID,userId:ME.id,title:v('mvName'),status:v('mvSt'),release:v('mvRel'),end:v('mvEnd'),
    genre:v('mvGenre'),duration:v('mvDur'),format:v('mvFmt'),rating:v('mvRate'),note:v('mvNote')};
  if(PENDING_POSTER){p.posterId=PENDING_POSTER.id;p.poster=PENDING_POSTER.url;}
  call('api_saveMovie',[p],'Đang lưu...').then(function(){
    closeModal('mdMovie'); toast('Đã lưu phim — cả team sẽ thấy ngay.','ok'); loadMovies(true);
  }).catch(err);
}
function delMovie(){
  if(!MV_ID)return;
  call('api_deleteMovie',[{id:MV_ID,userId:ME.id}],'Đang xoá...').then(function(){
    closeModal('mdMovie'); toast('Đã xoá.','ok'); loadMovies(true);
  }).catch(err);
}
/* popup lịch phim khi đăng nhập / khi bấm nút 🎬 */
function showNowShowing(force){
  var data=MOVIES||(BOOT&&BOOT.movies);
  if(!data||!data.movies||!data.movies.length){ if(force) go('movie'); return; }
  if(!force){
    try{ if(localStorage.getItem('stl_mv_day')===todayStr()) return; }catch(e){}
  }
  var now=data.movies.filter(function(m){return m.status==='Đang chiếu';});
  var soon=data.movies.filter(function(m){return m.status==='Sắp chiếu';});
  var mini=function(m){
    return '<div class="mv2">'+(m.poster?'<img src="'+esc(m.poster)+'">':'<div class="mv-np">🎬</div>')+
      '<div class="mv2-t">'+esc(m.title)+'</div>'+
      '<div class="mv2-d">'+esc(m.release||'')+'</div></div>';
  };
  document.getElementById('nsBody').innerHTML=
    '<div class="ns-h">🎬 ĐANG CHIẾU <span class="badge ok">'+now.length+'</span></div>'+
    (now.length?'<div class="mv2-grid">'+now.map(mini).join('')+'</div>':'<div class="hint">Chưa cập nhật.</div>')+
    '<div class="ns-h" style="margin-top:16px">🍿 SẮP CHIẾU <span class="badge">'+soon.length+'</span></div>'+
    (soon.length?'<div class="mv2-grid">'+soon.map(mini).join('')+'</div>':'<div class="hint">Chưa cập nhật.</div>')+
    (data.updatedAt?'<div class="hint" style="margin-top:14px">Cập nhật gần nhất: '+esc(data.updatedAt)+
      (data.updatedBy?' bởi '+esc(data.updatedBy):'')+'</div>':'');
  openModal('mdNS');
}
function closeNS(dontShow){
  if(dontShow){ try{ if(window.localStorage) localStorage.setItem('stl_mv_day',todayStr()); }catch(e){} }
  closeModal('mdNS');
}

/* ============================================================================
   v4 — TRẠNG THÁI ONLINE (cột phải)
   ========================================================================== */
var PULSE_TIMER=null, LAST_ACT=Date.now(), PULSE_BUSY=false;

/* Nhịp kiểm tra thông báo:
   - đang dùng máy          -> 12 giây (nghe ting gần như tức thì)
   - mở web nhưng bỏ đó >5' -> 60 giây
   - chuyển sang tab khác   -> tạm dừng, quay lại là kiểm tra ngay  */
function pulseDelay(){
  if(document.hidden) return 0;
  return (Date.now()-LAST_ACT < 5*60*1000) ? 40000 : 90000;   // pulse lo trạng thái, ping lo thông báo
}
function startPulseLoop(){
  if(PULSE_TIMER) clearTimeout(PULSE_TIMER);
  var d=pulseDelay();
  if(!d){ PULSE_TIMER=setTimeout(startPulseLoop,20000); return; }   // đang ẩn: chờ rồi kiểm tra lại
  PULSE_TIMER=setTimeout(function(){ pulse(); startPulseLoop(); },d);
}
(function(){
  ['mousedown','keydown','touchstart','wheel'].forEach(function(ev){
    document.addEventListener(ev,function(){LAST_ACT=Date.now();},{passive:true});
  });
  document.addEventListener('visibilitychange',function(){
    if(!document.hidden){ LAST_ACT=Date.now(); ping(); pulse(); startPulseLoop(); startPingLoop(); }
  });
  window.addEventListener('focus',function(){ LAST_ACT=Date.now(); ping(); });
})();
function toggleSide(){
  var el=document.getElementById('side');
  if(window.innerWidth<=1280) el.classList.toggle('on');
  else el.classList.toggle('hide');
}
function pulse(){
  if(!ME||PULSE_BUSY)return;
  PULSE_BUSY=true;
  call('api_pulse',[{userId:ME.id}]).then(function(r){
    PULSE_BUSY=false;
    /* --- chuông do api_ping lo (nhanh hơn), ở đây chỉ đồng bộ lại con số --- */
    var c=r.unread?r.unread.count:0;
    setBell(c);
    setAssignBadge(r.assignPending||0);
    window.__prevUnread=c; window.__notifReady=true;

    /* --- lịch phim đổi --- */
    if(MV_VER && r.movieVer && r.movieVer!==MV_VER){ MV_VER=r.movieVer; loadMovies(true); }
    else if(!MV_VER) MV_VER=r.movieVer||'';

    renderPresence(r.presence||[]);
  }).catch(function(){PULSE_BUSY=false;});
}
function setAssignBadge(n){
  var el=document.getElementById('nav-assign');
  if(!el)return;
  el.innerHTML='<span class="ic">🤝</span><span class="lb">Giao việc</span>'+
    (n>0?'<span class="nvdot plus">+'+n+'</span>':'');
}
function renderPresence(list){
  var box=document.getElementById('sideList'); if(!box)return;
  var on=list.filter(function(u){return u.online;}).length;
  var h=document.getElementById('sideCount');
  if(h) h.textContent=on+'/'+list.length+' đang online';
  box.innerHTML=list.map(function(u,i){
    var act=u.leave
      ? '<span class="pr-leave">🌴 '+esc(u.leave)+'</span>'
      : (u.doing
          ? '<span class="pr-doing">▶ '+esc(u.doing)+'</span>'+(u.doingMore?' <span class="hint">+'+u.doingMore+'</span>':'')
          : '<span class="hint">chưa bắt đầu việc nào</span>');
    return '<div class="pr'+(u.online?' on':'')+'">'+
      '<div class="av '+avClass(i)+'">'+initials(u.name)+'<span class="pr-dot"></span></div>'+
      '<div class="pr-b"><div class="pr-n">'+esc(u.short)+
        '<span class="hint" style="font-weight:400"> · '+(u.online?'online':esc(u.lastSeen))+'</span></div>'+
      '<div class="pr-a">'+act+'</div>'+
      '<div class="hint">'+u.done+'/'+u.total+' việc hôm nay</div>'+
      (u.note?'<div class="pr-note">💬 '+esc(u.note)+'<span class="hint"> · '+esc(u.noteAt)+'</span></div>':'')+
      '</div></div>';
  }).join('')||'<div class="hint">Chưa có ai online.</div>';
}
function postStatus(){
  var el=document.getElementById('myStatus');
  var t=el.value.trim();
  if(!t){toast('Nhập trạng thái / ghi chú muốn báo cho cả team.','bad');return;}
  call('api_setStatus',[{userId:ME.id,text:t}],'Đang gửi...').then(function(){
    el.value=''; toast('Đã báo cho cả team.','ok'); delete FRESH['notif']; pulse();
  }).catch(err);
}
function clearStatus(){
  call('api_setStatus',[{userId:ME.id,text:''}]).then(function(){toast('Đã xoá trạng thái.');pulse();}).catch(err);
}

/* ============================================================================
   v4 — SẮP TỚI + TIMELINE TRANG TRÍ (trên Dashboard)
   ========================================================================== */
function loadUpcoming(){
  if(isFresh('extras',10*60*1000)) return;
  call('api_dashExtras',[]).then(function(x){
    markFresh('extras');
    var r=x.upcoming;
    var box=document.getElementById('upList'); if(!box)return;
    box.innerHTML=r.items.length?r.items.map(function(i){
      var d=new Date(i.date+'T00:00:00');
      var days=Math.round((d-new Date(r.today+'T00:00:00'))/86400000);
      var cls=i.kind==='CTKM'?'ctkm':'deco';
      return '<div class="up '+cls+'"><div class="up-d"><b>'+d.getDate()+'/'+(d.getMonth()+1)+'</b>'+
        '<span>'+(days<0?'đã qua':(days===0?'hôm nay':(days===1?'ngày mai':'còn '+days+' ngày')))+'</span></div>'+
        '<div class="up-b"><div class="up-t">'+esc(i.title)+'</div>'+
        '<div class="hint">'+esc(i.note||'')+'</div></div>'+
        '<span class="tag '+(i.kind==='CTKM'?'gold':'cat')+'">'+esc(i.kind)+'</span></div>';
    }).join(''):'<div class="hint">Không có mốc nào trong 45 ngày tới.</div>';

    var r2=x.timeline, today=r.today||todayStr();
    var soonKey='', soonDate='9999-99-99';
    r2.items.forEach(function(h){
      [h.notify,h.setup,h.remove].forEach(function(d){
        if(d>=today && d<soonDate){ soonDate=d; soonKey=h.name; }
      });
    });
    var box2=document.getElementById('holiTable');
    if(box2) box2.innerHTML='<thead><tr><th>Dịp lễ</th><th>Thông báo đến rạp</th><th>Hoàn thành setup</th>'+
      '<th>Tháo dỡ</th><th>Ngân sách</th></tr></thead><tbody>'+
      r2.items.map(function(h){
        var hot=(h.name===soonKey);
        var days=hot?Math.round((new Date(soonDate+'T00:00:00')-new Date(today+'T00:00:00'))/86400000):0;
        var mark=function(d){ return (hot&&d===soonDate)?('<b>'+esc(d)+'</b>'+
          '<span class="soon-tag">'+(days===0?'HÔM NAY':'còn '+days+' ngày')+'</span>'):esc(d); };
        return '<tr class="'+(hot?'soon':'')+'"><td><b>'+esc(h.name)+'</b></td><td>'+mark(h.notify)+
          '</td><td>'+mark(h.setup)+'</td><td>'+mark(h.remove)+'</td><td>'+esc(h.budget)+'</td></tr>';
      }).join('')+'</tbody>';
  }).catch(function(){});
}
function __unusedHoliTable(){
  call('api_holidayTimeline',[]).then(function(r){
    var box=document.getElementById('holiTable'); if(!box)return;
    box.innerHTML='<thead><tr><th>Dịp lễ</th><th>Thông báo đến rạp</th><th>Hoàn thành setup</th>'+
      '<th>Tháo dỡ</th><th>Ngân sách</th></tr></thead><tbody>'+
      r.items.map(function(h){
        return '<tr><td><b>'+esc(h.name)+'</b></td><td>'+esc(h.notify)+'</td><td>'+esc(h.setup)+
          '</td><td>'+esc(h.remove)+'</td><td>'+esc(h.budget)+'</td></tr>';
      }).join('')+'</tbody>';
  }).catch(function(){});
}


/* ============================================================================
   v6 — PING SIÊU NHẸ (thông báo gần như tức thì)
   ========================================================================== */
var PING_TIMER=null, PING_VER='', PING_BUSY=false;
function pingDelay(){
  if(document.hidden) return 0;
  return (Date.now()-LAST_ACT < 5*60*1000) ? 8000 : 45000;
}
function startPingLoop(){
  if(PING_TIMER) clearTimeout(PING_TIMER);
  var d=pingDelay();
  if(!d){ PING_TIMER=setTimeout(startPingLoop,15000); return; }
  PING_TIMER=setTimeout(function(){ ping(); startPingLoop(); },d);
}
function ping(){
  if(!ME||PING_BUSY)return;
  PING_BUSY=true;
  call('api_ping',[ME.id,PING_VER]).then(function(r){
    PING_BUSY=false;
    if(!r||!r.changed){ if(r&&r.v) PING_VER=r.v; return; }
    var first=(PING_VER==='');
    PING_VER=r.v;
    var c=r.count||0;
    setBell(c);
    if(!first && c>(window.__prevUnread||0)){
      if(r.type==='ASSIGN') tingAssign(); else ting();
      toast('🔔 '+(r.title||'Bạn có thông báo mới'),'ok');
      delete FRESH['notif']; delete FRESH['asg'];
      if(document.getElementById('p-notif').classList.contains('on')) loadNotif(true);
      if(document.getElementById('p-assign').classList.contains('on')) loadAssign(true);
    }
    window.__prevUnread=c;
  }).catch(function(){PING_BUSY=false;});
}
function setBell(c){
  var b=document.getElementById('bellDot');
  var nv=document.getElementById('nav-notif');
  if(!b)return;
  if(c>0){ b.textContent=c>99?'99+':c; b.classList.add('on'); } else b.classList.remove('on');
  if(nv) nv.innerHTML='<span class="ic">🔔</span><span class="lb">Thông báo</span>'+
    (c>0?'<span class="nvdot">'+c+'</span>':'');
}
/** tiếng ting ting ting cho việc được giao */
function tingAssign(){
  if(!SND) return; initAudio(); if(!AC) return;
  try{
    var t=AC.currentTime;
    [[1318.5,0],[1568,0.13],[1975.5,0.26]].forEach(function(p){
      var o=AC.createOscillator(), g=AC.createGain();
      o.type='sine'; o.frequency.value=p[0];
      g.gain.setValueAtTime(0.0001,t+p[1]);
      g.gain.linearRampToValueAtTime(0.18,t+p[1]+0.012);
      g.gain.exponentialRampToValueAtTime(0.0008,t+p[1]+0.42);
      o.connect(g); g.connect(AC.destination);
      o.start(t+p[1]); o.stop(t+p[1]+0.5);
    });
  }catch(e){}
}

/* ============================================================================
   v6 — QUY TRÌNH
   ========================================================================== */
var PROC=null, PROC_FILE=null, QT_ID='';
function loadProc(force){
  if(!force && PROC && isFresh('proc',120000)){ renderProc(); return; }
  call('api_getProcedures',[],PROC?'':'Đang tải quy trình...').then(function(r){
    markFresh('proc'); PROC=r;
    var sel=document.getElementById('procCat');
    if(sel && sel.options.length<2){
      sel.innerHTML='<option value="">Tất cả nhóm</option>'+
        r.categories.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
    }
    renderProc(); if(force) toast('Đã tải lại.','ok');
  }).catch(err);
}
function renderProc(){
  if(!PROC)return;
  var isAdmin=ME&&ME.role==='admin';
  var add=document.getElementById('procAdd'); if(add) add.style.display=isAdmin?'inline-flex':'none';
  var cat=document.getElementById('procCat').value||'';
  var list=PROC.items.filter(function(i){return !cat||i.category===cat;});
  document.getElementById('procList').innerHTML=list.length?list.map(function(i){
    var st=i.status==='Đã ban hành'?'st-done':(i.status==='Bản nháp'?'st-doing':'st-todo');
    return '<div class="proc'+(i.status==='Hết hiệu lực'?' old':'')+'">'+
      '<div class="proc-ic">📄</div>'+
      '<div class="proc-b" onclick="viewProc(\''+i.id+'\')">'+
        '<div class="proc-t">'+esc(i.title)+'</div>'+
        '<div class="proc-m">'+(i.code?'<b>'+esc(i.code)+'</b> · ':'')+esc(i.category)+
        ' · phiên bản '+esc(i.version)+' · ban hành '+esc(i.issued||'—')+
        (i.by?' · '+esc(i.by):'')+'</div>'+
        (i.note?'<div class="hint">'+esc(i.note)+'</div>':'')+
      '</div>'+
      '<span class="tag '+st+'">'+esc(i.status)+'</span>'+
      '<div class="proc-a">'+
        (i.viewUrl?'<button class="btn btn-line btn-sm" onclick="viewProc(\''+i.id+'\')">👁 Xem</button>':'')+
        (i.downloadUrl?'<a class="btn btn-line btn-sm" href="'+esc(i.downloadUrl)+'" target="_blank">⬇</a>':'')+
        (isAdmin?'<button class="iconbtn" onclick="openProc(\''+i.id+'\')">✎</button>':'')+
      '</div></div>';
  }).join(''):'<div class="empty"><div class="big">📄</div>Chưa có quy trình nào'+
    (isAdmin?'. Bấm <b>+ Tải quy trình lên</b>.':'.')+'</div>';
}
function viewProc(id){
  var it=null; PROC.items.forEach(function(x){if(x.id===id)it=x;});
  if(!it||!it.viewUrl){toast('Quy trình này chưa có file PDF.','bad');return;}
  document.getElementById('pdfTitle').textContent=it.title;
  document.getElementById('pdfFrame').src=it.viewUrl;
  document.getElementById('pdfDown').href=it.downloadUrl||'#';
  document.getElementById('pdfOpen').href=(it.viewUrl||'').replace('/preview','/view');
  openModal('mdPdf');
}
function openProc(id){
  QT_ID=id||''; PROC_FILE=null;
  var it=null; if(PROC) PROC.items.forEach(function(x){if(x.id===id)it=x;});
  document.getElementById('qtTitle').textContent=it?'Sửa quy trình':'Tải quy trình lên';
  document.getElementById('qtDel').style.display=it?'inline-flex':'none';
  fill('qtCat',PROC.categories,it?it.category:'');
  fill('qtSt',PROC.statuses,it?it.status:'Đã ban hành');
  var v=function(id,val){document.getElementById(id).value=val||'';};
  v('qtName',it?it.title:''); v('qtCode',it?it.code:''); v('qtVer',it?it.version:'1.0');
  v('qtDate',it?it.issued:todayStr()); v('qtNote',it?it.note:'');
  document.getElementById('qtFile').value='';
  document.getElementById('qtFileInfo').innerHTML=it&&it.fileId
    ? 'Đang dùng file đã tải lên trước đó. Chọn file mới nếu muốn thay.'
    : 'Chọn file PDF (tối đa ~10MB). File lưu trong thư mục Drive của bộ phận.';
  openModal('mdProc');
}
function pickProcFile(input){
  var f=input.files&&input.files[0]; if(!f)return;
  if(f.size>10*1024*1024){toast('File quá lớn (>10MB).','bad');input.value='';return;}
  var rd=new FileReader();
  document.getElementById('qtFileInfo').textContent='Đang tải "'+f.name+'" lên Drive...';
  rd.onload=function(e){
    call('api_uploadProcFile',[{userId:ME.id,data:e.target.result,name:f.name}],'Đang tải file lên...').then(function(r){
      PROC_FILE=r;
      document.getElementById('qtFileInfo').innerHTML='✅ Đã tải lên: <b>'+esc(f.name)+'</b> ('+esc(r.size)+')';
      toast('Đã tải file lên Drive.','ok');
    }).catch(function(e2){ err(e2); document.getElementById('qtFileInfo').textContent='Tải lên thất bại, thử lại.'; });
  };
  rd.readAsDataURL(f);
}
function saveProc(){
  var v=function(id){return document.getElementById(id).value;};
  if(!v('qtName').trim()){toast('Nhập tên quy trình.','bad');return;}
  if(!QT_ID && !PROC_FILE){toast('Chọn file PDF trước đã.','bad');return;}
  var p={id:QT_ID,userId:ME.id,title:v('qtName'),code:v('qtCode'),category:v('qtCat'),
    version:v('qtVer'),status:v('qtSt'),issued:v('qtDate'),note:v('qtNote')};
  if(PROC_FILE){p.fileId=PROC_FILE.id;p.viewUrl=PROC_FILE.viewUrl;p.downloadUrl=PROC_FILE.downloadUrl;}
  call('api_saveProcedure',[p],'Đang lưu...').then(function(){
    closeModal('mdProc'); toast('Đã lưu quy trình.','ok'); loadProc(true);
  }).catch(err);
}
function delProc(){
  if(!QT_ID)return;
  if(!confirm('Xoá quy trình này khỏi danh sách? (file trên Drive vẫn còn)')) return;
  call('api_deleteProcedure',[{id:QT_ID,userId:ME.id}],'Đang xoá...').then(function(){
    closeModal('mdProc'); toast('Đã xoá.','ok'); loadProc(true);
  }).catch(err);
}

/* ============================================================================
   v6 — BÁO CÁO THÁNG
   ========================================================================== */
var RP=null, RP_ALL=null, RP_ID='', RP_EDIT=null;
function loadReportTab(force){
  if(ME.role==='admin'){ loadAllReports(force); }
  loadMyReports(force);
}
function loadMyReports(force){
  if(!force && RP && isFresh('rp',60000)){ renderMyReports(); return; }
  call('api_myReports',[ME.id],RP?'':'Đang tải báo cáo...').then(function(r){
    markFresh('rp'); RP=r; renderMyReports();
  }).catch(err);
}
function rpStatusTag(st){
  var c=st==='Đã nhận'?'st-done':(st==='Đã gửi'?'cat':'st-todo');
  var ic=st==='Đã nhận'?'✅ ':(st==='Đã gửi'?'📨 ':'✏️ ');
  return '<span class="tag '+c+'">'+ic+esc(st)+'</span>';
}
function renderMyReports(){
  if(!RP)return;
  document.getElementById('rpNote').innerHTML=
    '<div class="note">Mẫu báo cáo của bạn: <b>'+esc(RP.template.title)+'</b>. '+
    'Điền số liệu → <b>Lưu nháp</b> để làm tiếp sau, hoặc <b>Gửi cho trưởng bộ phận</b> khi đã xong. '+
    'Hạn báo cáo hằng tháng là <b>ngày 28</b>.</div>';
  document.getElementById('rpList').innerHTML=RP.reports.length?RP.reports.map(function(r){
    return '<div class="rp-item">'+
      '<div class="rp-m"><b>'+esc(monthVi(r.month))+'</b>'+
      (r.from?'<span class="hint"> · dữ liệu '+esc(r.from)+' → '+esc(r.to)+'</span>':'')+'</div>'+
      '<div class="spacer"></div>'+rpStatusTag(r.status)+
      '<div class="rp-a">'+
        '<button class="btn btn-line btn-sm" onclick="openReport(\''+r.id+'\')">'+
          (r.status==='Đã nhận'?'👁 Xem':'✎ Mở')+'</button>'+
        (r.status==='Nháp'?'<button class="btn btn-gold btn-sm" onclick="sendReport(\''+r.id+'\')">📨 Gửi</button>':'')+
        (r.status!=='Đã nhận'?'<button class="iconbtn del" onclick="delReportById(\''+r.id+'\')">🗑</button>':'')+
      '</div></div>';
  }).join(''):'<div class="empty"><div class="big">📊</div>Chưa có báo cáo nào. Bấm <b>+ Tạo báo cáo mới</b>.</div>';
}
function monthVi(m){
  var p=String(m).split('-');
  return 'Tháng '+parseInt(p[1],10)+'/'+p[0];
}
function newReport(){ openReport(''); }
function openReport(id){
  RP_ID=id||'';
  var r=null; if(RP) RP.reports.forEach(function(x){if(x.id===id)r=x;});
  RP_EDIT=r;
  document.getElementById('rpMine').style.display='none';
  document.getElementById('rpAdmin').style.display='none';
  document.getElementById('rpView').style.display='none';
  document.getElementById('rpForm').style.display='block';
  document.getElementById('rpFormTitle').textContent=RP.template.title+(r?' — '+monthVi(r.month):' (mới)');
  document.getElementById('rpDel').style.display=r?'inline-flex':'none';
  var m=r?r.month:RP.curMonth;
  document.getElementById('rpMonth').value=m;
  var p=m.split('-');
  var last=new Date(parseInt(p[0],10),parseInt(p[1],10),0).getDate();
  document.getElementById('rpFrom').value=r&&r.from?r.from:(m+'-01');
  document.getElementById('rpTo').value=r&&r.to?r.to:(m+'-'+last);
  buildReportForm(RP.template,(r&&r.data)||{});
  updRange();
  ['rpFrom','rpTo'].forEach(function(id){document.getElementById(id).onchange=updRange;});
}
function updRange(){
  var f=document.getElementById('rpFrom').value, t=document.getElementById('rpTo').value;
  var vi=function(d){var x=String(d).split('-');return x[2]+'/'+x[1]+'/'+x[0];};
  document.getElementById('rpRange').innerHTML= (f&&t)
    ? '<b>Dữ liệu được lấy từ '+vi(f)+' đến '+vi(t)+'</b>' : 'Chọn khoảng ngày lấy dữ liệu.';
}
function numIn(id,val,ph){
  return '<input class="cell num" id="'+id+'" value="'+(val===undefined||val===null?'':esc(val))+
    '" placeholder="'+(ph||'0')+'" oninput="rpTotals()">';
}
function buildReportForm(tpl,data){
  var h='';
  if(tpl.type==='content'){
    h+='<div class="card-t" style="font-size:13px;margin:6px 0 8px">SỐ LIỆU 6 FANPAGE</div>'+
       '<div class="wrap-x"><table class="data"><thead><tr><th>Fanpage</th>'+
       tpl.pageFields.map(function(f){return '<th class="num">'+esc(f.label)+'</th>';}).join('')+
       '</tr></thead><tbody>';
    tpl.pages.forEach(function(pg){
      h+='<tr><td><b>'+esc(pg.name)+'</b></td>'+
        tpl.pageFields.map(function(f){
          var v=(data.pages&&data.pages[pg.key]&&data.pages[pg.key][f.key]);
          return '<td>'+numIn('rp_'+pg.key+'_'+f.key,v)+'</td>';
        }).join('')+'</tr>';
    });
    h+='</tbody></table></div>'+
       '<div class="rp-total" id="rpTotal"></div>'+
       '<div class="card-t" style="font-size:13px;margin:16px 0 8px">SỐ LIỆU TIKTOK</div>'+
       '<div class="grid g4">'+
       tpl.tiktokFields.map(function(f){
         var v=(data.tiktok&&data.tiktok[f.key]);
         return '<div class="field" style="margin:0"><label>'+esc(f.label)+'</label>'+numIn('rp_tt_'+f.key,v)+'</div>';
       }).join('')+'</div>';
  } else {
    tpl.groups.forEach(function(g){
      h+='<div class="card-t" style="font-size:13px;margin:14px 0 8px">'+esc(g.label)+
         (g.unit?' <span class="hint">('+esc(g.unit)+')</span>':'')+'</div><div class="grid g4">'+
         g.fields.map(function(f){
           var v=(data[g.key]&&data[g.key][f.key]);
           return '<div class="field" style="margin:0"><label>'+esc(f.label)+'</label>'+
             numIn('rp_'+g.key+'_'+f.key,v)+'</div>';
         }).join('')+'</div>';
    });
  }
  h+='<div class="divider"></div>';
  tpl.texts.forEach(function(t){
    h+='<div class="field"><label>'+esc(t.label)+'</label>'+
      '<textarea id="rp_tx_'+t.key+'" rows="3">'+esc((data.texts&&data.texts[t.key])||'')+'</textarea></div>';
  });
  document.getElementById('rpFields').innerHTML=h;
  rpTotals();
}
function rpTotals(){
  var box=document.getElementById('rpTotal'); if(!box||!RP||RP.template.type!=='content')return;
  var tot=0, fol=0, views=0, eng=0;
  RP.template.pages.forEach(function(pg){
    var g=function(k){var el=document.getElementById('rp_'+pg.key+'_'+k);
      return el?(Number(String(el.value).replace(/[^\d.-]/g,''))||0):0;};
    tot+=g('spend'); fol+=g('follower'); views+=g('views'); eng+=g('eng');
  });
  var tt=document.getElementById('rp_tt_spend');
  if(tt) tot+=Number(String(tt.value).replace(/[^\d.-]/g,''))||0;
  box.innerHTML='<b>Tự động cộng:</b> Tổng follower <b>'+nf(fol)+'</b> · Tổng views <b>'+nf(views)+
    '</b> · Tổng tương tác <b>'+nf(eng)+'</b> · <span class="c-gold">Tổng tiền quảng cáo các page + TikTok: <b>'+
    nf(tot)+' đ</b></span>';
}
function collectReport(){
  var tpl=RP.template, data={texts:{}};
  if(tpl.type==='content'){
    data.pages={}; data.tiktok={};
    tpl.pages.forEach(function(pg){
      data.pages[pg.key]={};
      tpl.pageFields.forEach(function(f){
        data.pages[pg.key][f.key]=document.getElementById('rp_'+pg.key+'_'+f.key).value;
      });
    });
    tpl.tiktokFields.forEach(function(f){
      data.tiktok[f.key]=document.getElementById('rp_tt_'+f.key).value;
    });
  } else {
    tpl.groups.forEach(function(g){
      data[g.key]={};
      g.fields.forEach(function(f){ data[g.key][f.key]=document.getElementById('rp_'+g.key+'_'+f.key).value; });
    });
  }
  tpl.texts.forEach(function(t){ data.texts[t.key]=document.getElementById('rp_tx_'+t.key).value; });
  return data;
}
function saveReport(send){
  var p={id:RP_ID,userId:ME.id,type:RP.template.type,month:document.getElementById('rpMonth').value,
    from:document.getElementById('rpFrom').value,to:document.getElementById('rpTo').value,
    data:collectReport(),status:'Nháp'};
  call('api_saveReport',[p],'Đang lưu...').then(function(r){
    RP_ID=r.id; delete FRESH['rp'];
    if(send){ sendReport(r.id,true); }
    else { toast('Đã lưu nháp.','ok'); loadMyReports(true); }
  }).catch(err);
}
function sendReport(id,keepOpen){
  if(!confirm('Gửi báo cáo này cho trưởng bộ phận?')) return;
  call('api_submitReport',[{id:id,userId:ME.id}],'Đang gửi...').then(function(){
    toast('Đã gửi báo cáo cho trưởng bộ phận.','ok');
    delete FRESH['rp']; loadMyReports(true);
    if(!keepOpen) return; closeReport();
  }).catch(err);
}
function delReport(){ if(RP_ID) delReportById(RP_ID,true); }
function delReportById(id,close){
  if(!confirm('Xoá báo cáo này?')) return;
  call('api_deleteReport',[{id:id,userId:ME.id}],'Đang xoá...').then(function(){
    toast('Đã xoá báo cáo.','ok'); delete FRESH['rp']; loadMyReports(true);
    if(close) closeReport();
  }).catch(err);
}
function closeReport(){
  document.getElementById('rpForm').style.display='none';
  document.getElementById('rpMine').style.display='block';
  if(ME.role==='admin') document.getElementById('rpAdmin').style.display='block';
}
/* ---- trưởng bộ phận ---- */
function loadAllReports(force){
  if(!force && RP_ALL && isFresh('rpall',60000)){ renderAllReports(); return; }
  call('api_allReports',[ME.id]).then(function(r){
    markFresh('rpall'); RP_ALL=r; renderAllReports();
  }).catch(function(){});
}
function renderAllReports(){
  if(!RP_ALL)return;
  document.getElementById('rpAdmin').style.display='block';
  var miss=RP_ALL.missing;
  document.getElementById('rpMissing').innerHTML= miss.length
    ? '<div class="note warn"><b>Chưa gửi báo cáo '+esc(monthVi(RP_ALL.curMonth))+':</b> '+
      miss.map(function(u){return esc(u.short);}).join(' · ')+
      '. Nhắc trực tiếp hoặc dùng tab Giao việc.</div>'
    : '<div class="note ok">Tất cả nhân sự đã gửi báo cáo '+esc(monthVi(RP_ALL.curMonth))+'.</div>';
  document.getElementById('rpAll').innerHTML=RP_ALL.reports.length?RP_ALL.reports.map(function(r){
    return '<div class="rp-item'+(r.status==='Đã gửi'?' new':'')+'">'+
      '<div class="rp-m"><b>'+esc(r.userName)+'</b> — '+esc(monthVi(r.month))+
      ' <span class="hint">('+(r.type==='design'?'Thiết kế':'Content / Fanpage')+
      (r.from?' · dữ liệu '+esc(r.from)+' → '+esc(r.to):'')+')</span></div>'+
      '<div class="spacer"></div>'+rpStatusTag(r.status)+
      '<div class="rp-a"><button class="btn btn-line btn-sm" onclick="viewReport(\''+r.id+'\')">👁 Xem</button>'+
      (r.status==='Đã gửi'?'<button class="btn btn-ok btn-sm" onclick="receiveReport(\''+r.id+'\')">✓ Đã nhận</button>':'')+
      '</div></div>';
  }).join(''):'<div class="empty"><div class="big">📥</div>Chưa có báo cáo nào được gửi.</div>';
}
function findReport(id){
  var r=null;
  if(RP_ALL) RP_ALL.reports.forEach(function(x){if(x.id===id)r=x;});
  if(!r&&RP) RP.reports.forEach(function(x){if(x.id===id)r=x;});
  return r;
}
function viewReport(id){
  var r=findReport(id); if(!r)return;
  var tpl=(RP_ALL&&RP_ALL.templates)?RP_ALL.templates[r.type]:RP.template;
  document.getElementById('rpMine').style.display='none';
  document.getElementById('rpAdmin').style.display='none';
  document.getElementById('rpForm').style.display='none';
  document.getElementById('rpView').style.display='block';
  document.getElementById('rpViewTitle').textContent=tpl.title+' — '+r.userName+' — '+monthVi(r.month);
  var h='<div class="note"><b>Dữ liệu được lấy từ '+esc(r.from||'?')+' đến '+esc(r.to||'?')+'</b> · '+
    'trạng thái: '+esc(r.status)+(r.sentAt?' · gửi lúc '+esc(r.sentAt):'')+'</div>';
  var d=r.data||{};
  if(r.type==='content'){
    h+='<div class="wrap-x"><table class="data"><thead><tr><th>Fanpage</th>'+
      tpl.pageFields.map(function(f){return '<th class="num">'+esc(f.label)+'</th>';}).join('')+'</tr></thead><tbody>';
    tpl.pages.forEach(function(pg){
      h+='<tr><td><b>'+esc(pg.name)+'</b></td>'+tpl.pageFields.map(function(f){
        return '<td class="num">'+esc(((d.pages||{})[pg.key]||{})[f.key]||'—')+'</td>';}).join('')+'</tr>';
    });
    h+='</tbody></table></div><div class="card-t" style="font-size:13px;margin:14px 0 8px">TIKTOK</div>'+
      '<div class="grid g4">'+tpl.tiktokFields.map(function(f){
        return '<div class="stat"><div class="stat-v" style="font-size:19px">'+
          esc((d.tiktok||{})[f.key]||'—')+'</div><div class="stat-l">'+esc(f.label)+'</div></div>';}).join('')+'</div>';
  } else {
    tpl.groups.forEach(function(g){
      h+='<div class="card-t" style="font-size:13px;margin:14px 0 8px">'+esc(g.label)+'</div><div class="grid g4">'+
        g.fields.map(function(f){
          return '<div class="stat"><div class="stat-v" style="font-size:19px">'+
            esc((d[g.key]||{})[f.key]||'—')+'</div><div class="stat-l">'+esc(f.label)+'</div></div>';
        }).join('')+'</div>';
    });
  }
  h+='<div class="divider"></div>';
  tpl.texts.forEach(function(t){
    h+='<div class="field"><label>'+esc(t.label)+'</label><div class="rp-tx">'+
      esc((d.texts||{})[t.key]||'—').replace(/\n/g,'<br>')+'</div></div>';
  });
  if(r.adminNote) h+='<div class="note ok"><b>Nhận xét của trưởng bộ phận:</b> '+esc(r.adminNote)+'</div>';
  if(ME.role==='admin'&&r.status==='Đã gửi'){
    h+='<div class="divider"></div><div class="field"><label>Nhận xét khi nhận báo cáo (không bắt buộc)</label>'+
      '<textarea id="rpAdNote" rows="2" placeholder="VD: số liệu ổn, tháng sau bổ sung thêm phần Reels"></textarea></div>'+
      '<button class="btn btn-ok" onclick="receiveReport(\''+r.id+'\',true)">✓ Xác nhận đã nhận báo cáo</button>';
  }
  document.getElementById('rpViewBody').innerHTML=h;
}
function closeReportView(){
  document.getElementById('rpView').style.display='none';
  document.getElementById('rpMine').style.display='block';
  if(ME.role==='admin') document.getElementById('rpAdmin').style.display='block';
}
function receiveReport(id,withNote){
  var note='';
  if(withNote){ var el=document.getElementById('rpAdNote'); note=el?el.value:''; }
  call('api_receiveReport',[{id:id,userId:ME.id,note:note}],'Đang xác nhận...').then(function(){
    toast('Đã xác nhận nhận báo cáo.','ok');
    delete FRESH['rpall']; delete FRESH['rp'];
    closeReportView(); loadAllReports(true);
  }).catch(err);
}

/* ============================================================================
   v6 — NHẮC BÁO CÁO NGÀY 28
   ========================================================================== */
function maybeReportPopup(){
  if(!BOOT||BOOT.dayOfMonth!==28) return;
  /* đợi popup lịch phim đóng lại rồi mới hiện, tránh chồng 2 popup */
  var ns=document.getElementById('mdNS');
  if(ns&&ns.classList.contains('on')){ setTimeout(maybeReportPopup,1200); return; }
  try{ if(localStorage.getItem('stl_rp28')===todayStr()) return; }catch(e){}
  var isAdmin=ME.role==='admin';
  document.getElementById('rp28Body').innerHTML= isAdmin
    ? '<div class="note warn" style="margin-bottom:12px"><b>Hôm nay là ngày báo cáo tháng của bộ phận.</b></div>'+
      '<b>Việc của trưởng bộ phận hôm nay:</b><ul class="mini" style="margin-top:8px">'+
      '<li class="t">Nhắc từng vị trí chốt số liệu và gửi báo cáo trước cuối ngày</li>'+
      '<li class="t">Content / Fanpage: số liệu 6 fanpage + TikTok, tiền quảng cáo, nhận xét &amp; đề xuất</li>'+
      '<li class="t">Thiết kế: khối lượng ấn phẩm, tình trạng POSM 6 rạp, tiến độ bàn giao</li>'+
      '<li class="t">Vào tab <b>Báo cáo</b> để xem ai đã gửi — ai còn thiếu</li>'+
      '<li class="t">Tổng hợp lại thành báo cáo tháng gửi Ban giám đốc</li></ul>'
    : '<div class="note warn" style="margin-bottom:12px"><b>Hôm nay là hạn báo cáo tháng.</b></div>'+
      'Bạn cần chốt toàn bộ số liệu trong tháng ở vị trí của mình và gửi cho trưởng bộ phận:'+
      '<ul class="mini" style="margin-top:8px">'+
      '<li class="t">Vào tab <b>Báo cáo</b> → <b>+ Tạo báo cáo mới</b></li>'+
      '<li class="t">Điền đầy đủ các ô số liệu (có sẵn khung mẫu)</li>'+
      '<li class="t">Ghi phần nhận xét và đề xuất cho tháng mới</li>'+
      '<li class="t">Bấm <b>📨 Gửi cho trưởng bộ phận</b></li></ul>';
  try{ if(window.localStorage) localStorage.setItem('stl_rp28',todayStr()); }catch(e){}
  openModal('mdRp28');
}

/* ============================================================================
   v6 — LINK TRA KHẢO ĐỐI THỦ (thay cho tab Radar)
   ========================================================================== */
var RIVAL_LINKS=[
 {name:'CGV Cinemas',q:'CGV Cinemas'},{name:'Galaxy Cinema',q:'Galaxy Cinema'},
 {name:'Lotte Cinema',q:'Lotte Cinema'},{name:'Beta Cinemas',q:'Beta Cinemas'},
 {name:'Cinestar',q:'Cinestar'},{name:'Mega GS',q:'Mega GS Cinemas'},{name:'DCINE',q:'DCINE'}];
function rivalLinkUrl(q){
  return 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&q='+
    encodeURIComponent(q)+'&search_type=keyword_unordered&media_type=all';
}
function renderRivalLinks(){
  var box=document.getElementById('rivalLinks'); if(!box)return;
  box.innerHTML='<div class="rvl"><span class="rvl-t">🕵️ Tra khảo quảng cáo đối thủ trên Meta Ad Library:</span>'+
    RIVAL_LINKS.map(function(b){
      return '<a class="brandchip" href="'+rivalLinkUrl(b.q)+'" target="_blank">'+esc(b.name)+' ↗</a>';
    }).join('')+
    '<a class="brandchip" href="https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN" target="_blank">Mở Ad Library ↗</a></div>';
}

