const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// GET /api/settings - Get all settings
router.get('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const result = await db.query('SELECT key, value, updated_at FROM settings ORDER BY key');
    res.json({ settings: result.rows });
  } catch (error) {
    next(error);
  }
});

// PUT /api/settings - Update a setting
router.put('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { key, value } = req.body;
    
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const result = await db.query(
      `INSERT INTO settings (key, value, updated_at) 
       VALUES ($1, $2, NOW()) 
       ON CONFLICT (key) 
       DO UPDATE SET value = $2, updated_at = NOW()
       RETURNING key, value, updated_at`,
      [key, value]
    );
    
    res.json({ setting: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
