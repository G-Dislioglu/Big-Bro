const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');

router.get('/whoami', requireAuth, (req, res) => {
  res.json({ 
    role: 'admin'
  });
});

module.exports = router;
