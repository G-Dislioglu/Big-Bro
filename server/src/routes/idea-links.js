const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

const VALID_LINK_TYPES = ['supports', 'contradicts', 'depends_on', 'variant_of'];

function validateLink(data) {
  const errors = [];
  
  if (!data.source_id) {
    errors.push('source_id is required');
  }
  
  if (!data.target_id) {
    errors.push('target_id is required');
  }
  
  if (data.source_id && data.target_id && data.source_id === data.target_id) {
    errors.push('source_id and target_id must be different');
  }
  
  if (!data.type || !VALID_LINK_TYPES.includes(data.type)) {
    errors.push(`type must be one of: ${VALID_LINK_TYPES.join(', ')}`);
  }
  
  if (data.weight !== undefined) {
    const val = parseInt(data.weight, 10);
    if (isNaN(val) || val < 0 || val > 100) {
      errors.push('weight must be an integer between 0 and 100');
    }
  }
  
  return errors;
}

// GET /api/links/by-card/:id - Get all links for a card (source OR target)
router.get('/by-card/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT * FROM idea_card_links 
       WHERE source_id = $1 OR target_id = $1 
       ORDER BY created_at DESC`,
      [id]
    );
    
    res.json({ ok: true, items: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/links - Create a new link
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { source_id, target_id, type, weight = 50, note = '' } = req.body;
    
    const errors = validateLink({ source_id, target_id, type, weight });
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: errors });
    }
    
    const result = await db.query(
      `INSERT INTO idea_card_links (source_id, target_id, type, weight, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [source_id, target_id, type, parseInt(weight, 10), note]
    );
    
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (error) {
    // Handle unique constraint violation (duplicate link)
    if (error.code === '23505') {
      return res.status(409).json({ ok: false, error: 'duplicate_link' });
    }
    // Handle foreign key constraint (invalid card IDs)
    if (error.code === '23503') {
      return res.status(400).json({ ok: false, error: 'validation_error', details: ['Invalid card ID: one or both cards do not exist'] });
    }
    next(error);
  }
});

// DELETE /api/links/:id - Delete a link
router.delete('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM idea_card_links WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
