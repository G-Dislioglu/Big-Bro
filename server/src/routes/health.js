const express = require('express');
const router = express.Router();
const config = require('../config');
const { db } = require('../db');

router.get('/', async (req, res) => {
  let dbStatus = { configured: config.isDbConfigured };
  
  if (db) {
    try {
      await db.query('SELECT 1');
      dbStatus.ok = true;
    } catch (error) {
      dbStatus.ok = false;
      dbStatus.error = error.message;
    }
  }
  
  res.json({ 
    ok: true,
    service: 'big-bro',
    version: '0.2.0',
    time: new Date().toISOString(),
    db: dbStatus
  });
});

module.exports = router;
