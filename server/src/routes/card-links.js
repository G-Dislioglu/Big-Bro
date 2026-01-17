const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// POST /api/card-links - Create a new card link
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { from_card_id, to_card_id, link_type = 'related', strength = 3, note = '' } = req.body;
    
    if (!from_card_id || !to_card_id) {
      return res.status(400).json({ error: 'from_card_id and to_card_id are required' });
    }
    
    // Validate strength
    if (strength < 1 || strength > 5) {
      return res.status(400).json({ error: 'Strength must be between 1 and 5' });
    }
    
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO card_links (id, from_card_id, to_card_id, link_type, strength, note, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, from_card_id, to_card_id, link_type, strength, note, created_at, updated_at`,
      [id, from_card_id, to_card_id, link_type, strength, note]
    );
    
    res.status(201).json({ link: result.rows[0] });
  } catch (error) {
    // Handle foreign key constraint errors
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid card ID: one or both cards do not exist' });
    }
    next(error);
  }
});

// PATCH /api/card-links/:id - Update a card link
router.patch('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { link_type, strength, note, to_card_id } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (link_type !== undefined) {
      updates.push(`link_type = $${paramCount++}`);
      values.push(link_type);
    }
    
    if (strength !== undefined) {
      if (strength < 1 || strength > 5) {
        return res.status(400).json({ error: 'Strength must be between 1 and 5' });
      }
      updates.push(`strength = $${paramCount++}`);
      values.push(strength);
    }
    
    if (note !== undefined) {
      updates.push(`note = $${paramCount++}`);
      values.push(note);
    }
    
    if (to_card_id !== undefined) {
      updates.push(`to_card_id = $${paramCount++}`);
      values.push(to_card_id);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(
      `UPDATE card_links SET ${updates.join(', ')} WHERE id = $${paramCount} 
       RETURNING id, from_card_id, to_card_id, link_type, strength, note, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card link not found' });
    }
    
    res.json({ link: result.rows[0] });
  } catch (error) {
    // Handle foreign key constraint errors
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Invalid card ID: card does not exist' });
    }
    next(error);
  }
});

// DELETE /api/card-links/:id - Delete a card link (hard delete)
router.delete('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `DELETE FROM card_links WHERE id = $1 
       RETURNING id, from_card_id, to_card_id, link_type, strength, note`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card link not found' });
    }
    
    res.json({ link: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
