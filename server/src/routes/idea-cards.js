const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// Validation helpers
const VALID_LAYERS = ['Rational', 'Spekulativ', 'Meta'];
const VALID_STATUSES = ['draft', 'active', 'archived', 'tested', 'validated', 'killed'];

function validateCard(data, isPartial = false) {
  const errors = [];
  
  if (!isPartial || data.title !== undefined) {
    if (!data.title || data.title.trim().length < 3) {
      errors.push('title must be at least 3 characters');
    }
  }
  
  if (!isPartial || data.layer !== undefined) {
    if (data.layer && !VALID_LAYERS.includes(data.layer)) {
      errors.push(`layer must be one of: ${VALID_LAYERS.join(', ')}`);
    }
  }
  
  if (!isPartial || data.status !== undefined) {
    if (data.status && !VALID_STATUSES.includes(data.status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }
  
  if (!isPartial || data.value_pct !== undefined) {
    if (data.value_pct !== undefined) {
      const val = parseInt(data.value_pct, 10);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push('value_pct must be an integer between 0 and 100');
      }
    }
  }
  
  if (!isPartial || data.tags !== undefined) {
    if (data.tags !== undefined) {
      if (!Array.isArray(data.tags)) {
        errors.push('tags must be an array');
      } else {
        if (data.tags.length > 25) {
          errors.push('maximum 25 tags allowed');
        }
        for (const tag of data.tags) {
          if (typeof tag !== 'string') {
            errors.push('each tag must be a string');
            break;
          }
          if (tag.trim().length > 32) {
            errors.push('each tag must be max 32 characters');
            break;
          }
        }
      }
    }
  }
  
  return errors;
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(t => (typeof t === 'string' ? t.trim() : ''))
    .filter(t => t.length > 0)
    .slice(0, 25);
}

// GET /api/idea-cards - List cards with filters
router.get('/', requireDb, async (req, res, next) => {
  try {
    const { q, tag, status, layer } = req.query;
    let limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    let offset = parseInt(req.query.offset, 10) || 0;
    
    let query = 'SELECT * FROM idea_cards WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) FROM idea_cards WHERE 1=1';
    const params = [];
    const countParams = [];
    let paramCount = 1;
    
    if (q) {
      const searchParam = `%${q}%`;
      query += ` AND (title ILIKE $${paramCount} OR body ILIKE $${paramCount})`;
      countQuery += ` AND (title ILIKE $${paramCount} OR body ILIKE $${paramCount})`;
      params.push(searchParam);
      countParams.push(searchParam);
      paramCount++;
    }
    
    if (tag) {
      query += ` AND $${paramCount} = ANY(tags)`;
      countQuery += ` AND $${paramCount} = ANY(tags)`;
      params.push(tag);
      countParams.push(tag);
      paramCount++;
    }
    
    if (status) {
      query += ` AND status = $${paramCount}`;
      countQuery += ` AND status = $${paramCount}`;
      params.push(status);
      countParams.push(status);
      paramCount++;
    }
    
    if (layer) {
      query += ` AND layer = $${paramCount}`;
      countQuery += ` AND layer = $${paramCount}`;
      params.push(layer);
      countParams.push(layer);
      paramCount++;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);
    
    const [result, countResult] = await Promise.all([
      db.query(query, params),
      db.query(countQuery, countParams)
    ]);
    
    res.json({ 
      ok: true, 
      items: result.rows,
      total: parseInt(countResult.rows[0].count, 10)
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/idea-cards - Create a new card
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { 
      title, 
      body = '', 
      tags = [], 
      layer = 'Rational', 
      value_pct = 50, 
      status = 'draft',
      risk_notes = '',
      next_steps = ''
    } = req.body;
    
    const errors = validateCard({ title, layer, status, value_pct, tags });
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: errors });
    }
    
    const cleanedTags = cleanTags(tags);
    
    const result = await db.query(
      `INSERT INTO idea_cards (title, body, tags, layer, value_pct, status, risk_notes, next_steps)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title.trim(), body, cleanedTags, layer, parseInt(value_pct, 10), status, risk_notes, next_steps]
    );
    
    res.status(201).json({ ok: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/idea-cards/:id - Get a single card
router.get('/:id', requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('SELECT * FROM idea_cards WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    
    res.json({ ok: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/idea-cards/:id - Partial update
router.patch('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, body, tags, layer, value_pct, status, risk_notes, next_steps } = req.body;
    
    const errors = validateCard({ title, layer, status, value_pct, tags }, true);
    if (errors.length > 0) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: errors });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title.trim());
    }
    if (body !== undefined) {
      updates.push(`body = $${paramCount++}`);
      values.push(body);
    }
    if (tags !== undefined) {
      updates.push(`tags = $${paramCount++}`);
      values.push(cleanTags(tags));
    }
    if (layer !== undefined) {
      updates.push(`layer = $${paramCount++}`);
      values.push(layer);
    }
    if (value_pct !== undefined) {
      updates.push(`value_pct = $${paramCount++}`);
      values.push(parseInt(value_pct, 10));
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (risk_notes !== undefined) {
      updates.push(`risk_notes = $${paramCount++}`);
      values.push(risk_notes);
    }
    if (next_steps !== undefined) {
      updates.push(`next_steps = $${paramCount++}`);
      values.push(next_steps);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: ['No fields to update'] });
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(id);
    
    const result = await db.query(
      `UPDATE idea_cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    
    res.json({ ok: true, item: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/idea-cards/:id - Hard delete (cascades to links)
router.delete('/:id', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query('DELETE FROM idea_cards WHERE id = $1 RETURNING id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
