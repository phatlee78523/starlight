const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// Loại bỏ đệ quy mọi field nhạy cảm trước khi trả về client.
// Nhiều query dùng SELECT * nên cột password lọt vào response;
// chặn tập trung ở đây để không sót chỗ nào.
const SECRET_FIELDS = ['password', 'token'];

function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date || Buffer.isBuffer(value)) return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SECRET_FIELDS.includes(k)) continue;
    out[k] = stripSecrets(v);
  }
  return out;
}

router.post('/:method', async (req, res) => {
  const methodName = req.params.method;
  const args = req.body.args || [];

  // Chỉ cho gọi các hàm api_* khai báo tường minh, tránh gọi trúng
  // hàm kế thừa từ Object.prototype (constructor, toString, ...)
  const isCallable = methodName.startsWith('api_')
    && Object.prototype.hasOwnProperty.call(apiController, methodName)
    && typeof apiController[methodName] === 'function';

  if (isCallable) {
    try {
      const data = await apiController[methodName](...args);
      res.json({ ok: true, data: stripSecrets(data) });
    } catch (error) {
      console.error(`Error in ${methodName}:`, error);
      res.json({ ok: false, error: error.message });
    }
  } else {
    res.json({ ok: false, error: `Method ${methodName} not found` });
  }
});

module.exports = router;
