const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// GET /api/tasks - Get all tasks
router.get('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, title, status, created_at, updated_at FROM tasks ORDER BY created_at DESC'
    );
    res.json({ tasks: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/tasks - Create a new task
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { title, status = 'todo' } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const id = randomUUID();
    const result = await db.query(
      `INSERT INTO tasks (id, title, status, created_at, updated_at) 
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, title, status, created_at, updated_at`,
      [id, title, status]
    );
    
    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/tasks - Update a task
router.patch('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { id, title, status } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Task ID is required' });
    }
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
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
      `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING id, title, status, created_at, updated_at`,
      values
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json({ task: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
