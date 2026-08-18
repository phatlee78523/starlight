const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

router.post('/:method', async (req, res) => {
  const methodName = req.params.method;
  const args = req.body.args || [];

  if (typeof apiController[methodName] === 'function') {
    try {
      const data = await apiController[methodName](...args);
      res.json({ ok: true, data: data });
    } catch (error) {
      console.error(`Error in ${methodName}:`, error);
      res.json({ ok: false, error: error.message });
    }
  } else {
    res.json({ ok: false, error: `Method ${methodName} not found` });
  }
});

module.exports = router;
