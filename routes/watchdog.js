const express = require('express');
const router = express.Router();

router.get("/watchdog", (req, res) => {
  res.json({"ok": true});
});

module.exports = router; 