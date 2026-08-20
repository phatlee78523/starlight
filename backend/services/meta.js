/*
 * Gọi Meta Graph API (Facebook) — dùng cho đồng bộ fanpage + quảng cáo.
 * Token do người dùng tự cấp qua modal "⚙️ Kết nối Meta" trong app,
 * lưu ở json_store META_SETTINGS (và token riêng từng page ở bảng pages).
 */
const GRAPH_VERSION = process.env.META_API_VERSION || 'v21.0';
const GRAPH_URL = 'https://graph.facebook.com/' + GRAPH_VERSION;

async function graphGet(pathName, params, token) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${GRAPH_URL}/${pathName}?${qs.toString()}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const err = body.error || {};
    // code 190 = token hỏng/hết hạn — báo tiếng Việt cho dễ xử lý
    if (err.code === 190) throw new Error('Token Meta không hợp lệ hoặc đã hết hạn — vào ⚙️ Kết nối Meta dán token mới.');
    throw new Error('Meta trả lỗi: ' + (err.message || res.status));
  }
  return body;
}

// '2026-08-20T10:30:00+0000' -> ngày theo giờ VN 'YYYY-MM-DD'
function vnDateOf(isoTime) {
  const t = new Date(isoTime).getTime();
  if (isNaN(t)) return '';
  return new Date(t + 7 * 3600 * 1000).toISOString().split('T')[0];
}

function mapPostType(mediaType) {
  const m = String(mediaType || '').toLowerCase();
  if (m === 'photo') return 'Ảnh';
  if (m === 'album') return 'Album ảnh';
  if (m === 'video' || m === 'video_inline') return 'Video';
  if (m === 'link') return 'Link';
  return 'Khác';
}

// Kiểm tra token: trả về tên tài khoản / page sở hữu token
async function testToken(token) {
  const me = await graphGet('me', { fields: 'id,name' }, token);
  return me;
}

// Lấy bài viết gần đây của 1 page (kèm like/comment/share + reach nếu token có quyền)
async function fetchPagePosts(pageId, token, limit) {
  const fields = [
    'id', 'message', 'created_time', 'permalink_url',
    'shares', 'attachments{media_type}',
    'likes.summary(true).limit(0)', 'comments.summary(true).limit(0)',
    'insights.metric(post_impressions_unique)'
  ].join(',');
  const body = await graphGet(`${pageId}/published_posts`, { fields, limit: String(limit || 50) }, token);
  return (body.data || []).map(p => {
    let reach = 0;
    try { reach = p.insights.data[0].values[0].value || 0; } catch (e) { /* token thiếu read_insights */ }
    let mediaType = '';
    try { mediaType = p.attachments.data[0].media_type; } catch (e) { /* bài không có media */ }
    return {
      fbId: p.id,
      date: vnDateOf(p.created_time),
      content: (p.message || '').slice(0, 500) || '(Bài viết không có chữ)',
      type: mapPostType(mediaType),
      link: p.permalink_url || '',
      likes: (p.likes && p.likes.summary && p.likes.summary.total_count) || 0,
      comments: (p.comments && p.comments.summary && p.comments.summary.total_count) || 0,
      shares: (p.shares && p.shares.count) || 0,
      reach
    };
  });
}

// Lấy quảng cáo + số liệu trong tài khoản quảng cáo act_xxx
async function fetchAds(actId, token, limit) {
  const id = String(actId).replace(/^act_/, '');
  const fields = [
    'id', 'name', 'effective_status', 'created_time',
    'insights.date_preset(maximum){spend,reach,impressions,actions}'
  ].join(',');
  const body = await graphGet(`act_${id}/ads`, { fields, limit: String(limit || 50) }, token);

  const actOf = (actions, type) => {
    const a = (actions || []).find(x => x.action_type === type);
    return a ? Number(a.value) || 0 : 0;
  };
  const statusVi = s =>
    s === 'ACTIVE' ? 'Đang chạy' :
    (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') ? 'Tạm dừng' :
    (s === 'PENDING_REVIEW' || s === 'IN_PROCESS') ? 'Chờ duyệt' : 'Đã tắt';

  return (body.data || []).map(ad => {
    let ins = {};
    try { ins = ad.insights.data[0] || {}; } catch (e) { /* chưa có số liệu */ }
    return {
      fbId: ad.id,
      name: ad.name || ('Ad ' + ad.id),
      status: statusVi(ad.effective_status),
      start: vnDateOf(ad.created_time),
      spend: ins.spend || '0',
      reach: ins.reach || '0',
      impressions: ins.impressions || '0',
      views: String(actOf(ins.actions, 'video_view')),
      likes: String(actOf(ins.actions, 'post_reaction')),
      comments: String(actOf(ins.actions, 'comment')),
      shares: String(actOf(ins.actions, 'post')),
      link: 'https://www.facebook.com/adsmanager/manage/ads?act=' + id
    };
  });
}

module.exports = { testToken, fetchPagePosts, fetchAds, GRAPH_VERSION };
