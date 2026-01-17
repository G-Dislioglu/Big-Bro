const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// GET /api/cards - List cards with filters
router.get('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { tag, type, status } = req.query;
    
    let query = 'SELECT id, title, type, content, tags, status, created_at, updated_at FROM cards WHERE 1=1';
    const params = [];
    let paramCount = 1;
    
    if (type) {
      query += ` AND type = $${paramCount++}`;
      params.push(type);
    }
    
    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }
    
    if (tag) {
      query += ` AND tags LIKE $${paramCount++}`;
      params.push(`%${tag}%`);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await db.query(query, params);
    res.json({ cards: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/cards - Create a new card
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { title, type = 'idea', content = '', tags = '', status = 'draft' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO cards (id, title, type, content, tags, status, created_at, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, title, type, content, tags, status, created_at, updated_at`,
      [id, title, type, content, tags, status]
    );
    
    res.status(201).json({ card: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/cards/:id - Update a card
router.patch('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, type, content, tags, status } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    
    if (type !== undefined) {
      updates.push(`type = $${paramCount++}`);
      values.push(type);
    }
    
    if (content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(content);
    }
    
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(tags);
    }
    
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(
      `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} 
       RETURNING id, title, type, content, tags, status, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({ card: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/cards/:id - Soft delete (archive) a card
router.delete('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE cards SET status = 'archived', updated_at = NOW() WHERE id = $1 
       RETURNING id, title, type, content, tags, status, created_at, updated_at`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Card not found' });
    }
    
    res.json({ card: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/cards/:id/links - Get all links for a card
router.get('/:id/links', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Get outgoing links
    const outgoingResult = await db.query(
      `SELECT cl.id, cl.from_card_id, cl.to_card_id, cl.link_type, cl.strength, cl.note, 
              cl.created_at, cl.updated_at, c.title as to_card_title, c.type as to_card_type
       FROM card_links cl
       JOIN cards c ON cl.to_card_id = c.id
       WHERE cl.from_card_id = $1
       ORDER BY cl.created_at DESC`,
      [id]
    );
    
    // Get incoming links
    const incomingResult = await db.query(
      `SELECT cl.id, cl.from_card_id, cl.to_card_id, cl.link_type, cl.strength, cl.note, 
              cl.created_at, cl.updated_at, c.title as from_card_title, c.type as from_card_type
       FROM card_links cl
       JOIN cards c ON cl.from_card_id = c.id
       WHERE cl.to_card_id = $1
       ORDER BY cl.created_at DESC`,
      [id]
    );
    
    res.json({ 
      outgoing: outgoingResult.rows,
      incoming: incomingResult.rows
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
