const express = require('express');
const router = express.Router();
const { requireAuth, requireDb } = require('../middleware/auth');
const { generateIdea } = require('../controllers/aiController');

router.post('/generate', requireAuth, requireDb, async (req, res) => {
  const { text, provider, mode } = req.body;
  if (!text || !provider) {
    return res.status(400).json({ error: 'text and provider required' });
  }
  try {
    const result = await generateIdea(text, provider);
    res.json(result);
  } catch (err) {
    console.error('AI generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
