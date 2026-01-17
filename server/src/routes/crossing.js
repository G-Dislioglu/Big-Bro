const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

// POST /api/crossing/run - Run crossing heuristic
router.post('/run', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { seedCardIds = [], goal = '', mode = 'bridge' } = req.body;
    
    if (!Array.isArray(seedCardIds) || seedCardIds.length === 0) {
      return res.status(400).json({ error: 'seedCardIds must be a non-empty array' });
    }
    
    // Validate mode
    const validModes = ['bridge', 'critique', 'combine'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: 'mode must be one of: bridge, critique, combine' });
    }
    
    // Get seed cards
    const seedCardsResult = await db.query(
      'SELECT id, title, type, content, tags, status FROM cards WHERE id = ANY($1)',
      [seedCardIds]
    );
    
    if (seedCardsResult.rows.length === 0) {
      return res.status(404).json({ error: 'No valid seed cards found' });
    }
    
    const seedCards = seedCardsResult.rows;
    
    // Collect all tags from seed cards
    const allTags = seedCards
      .map(card => card.tags || '')
      .join(',')
      .split(',')
      .map(tag => tag.trim().toLowerCase())
      .filter(tag => tag.length > 0);
    
    const uniqueTags = [...new Set(allTags)];
    
    // Collect all types from seed cards
    const seedTypes = [...new Set(seedCards.map(card => card.type))];
    
    // Find candidate cards (active, not in seed, tag overlap or different type)
    let candidateQuery = `
      SELECT id, title, type, content, tags, status 
      FROM cards 
      WHERE status = 'active' 
        AND id != ALL($1)
    `;
    const candidateParams = [seedCardIds];
    
    const candidatesResult = await db.query(candidateQuery, candidateParams);
    const candidates = candidatesResult.rows;
    
    // Score candidates based on heuristics
    const scoredCandidates = candidates.map(card => {
      let score = 0;
      const cardTags = (card.tags || '')
        .split(',')
        .map(tag => tag.trim().toLowerCase())
        .filter(tag => tag.length > 0);
      
      // Tag overlap score (each matching tag +1)
      const tagOverlap = cardTags.filter(tag => uniqueTags.includes(tag)).length;
      score += tagOverlap;
      
      // Type diversity bonus (different type from all seed cards +2)
      if (!seedTypes.includes(card.type)) {
        score += 2;
      }
      
      // Mode-specific scoring
      if (mode === 'bridge' && card.type === 'bridge') {
        score += 3; // Prefer bridge cards in bridge mode
      } else if (mode === 'critique' && card.type === 'critique') {
        score += 3; // Prefer critique cards in critique mode
      } else if (mode === 'combine' && tagOverlap > 0) {
        score += 2; // Prefer cards with tag overlap in combine mode
      }
      
      return { card, score };
    });
    
    // Sort by score and take top 5
    const suggestedCards = scoredCandidates
      .filter(sc => sc.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(sc => ({
        ...sc.card,
        score: sc.score,
        reason: generateReason(sc.card, seedCards, mode, sc.score)
      }));
    
    // Generate suggested links between seed cards and suggested cards
    const suggestedLinks = [];
    for (const seedCard of seedCards) {
      for (const suggestedCard of suggestedCards) {
        const linkType = determineLinkType(mode, seedCard, suggestedCard.card);
        const strength = Math.min(5, Math.max(1, Math.ceil(suggestedCard.score / 2)));
        
        suggestedLinks.push({
          from_card_id: seedCard.id,
          to_card_id: suggestedCard.id,
          link_type: linkType,
          strength: strength,
          note: `Suggested by ${mode} mode`
        });
      }
    }
    
    // Limit suggested links to top 10
    const limitedLinks = suggestedLinks.slice(0, 10);
    
    res.json({ 
      suggestedCards,
      suggestedLinks: limitedLinks,
      mode,
      seedCardIds,
      goal
    });
  } catch (error) {
    next(error);
  }
});

// Helper function to generate reason for suggestion
function generateReason(card, seedCards, mode, score) {
  const reasons = [];
  
  if (mode === 'bridge') {
    if (card.type === 'bridge') {
      reasons.push('Bridge card type');
    }
    reasons.push('Can connect ideas');
  } else if (mode === 'critique') {
    if (card.type === 'critique') {
      reasons.push('Critique card type');
    }
    reasons.push('Can provide alternative perspective');
  } else if (mode === 'combine') {
    reasons.push('Potential for combination');
  }
  
  const cardTags = (card.tags || '').split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (cardTags.length > 0) {
    reasons.push(`Shares tags: ${cardTags.slice(0, 3).join(', ')}`);
  }
  
  return reasons.join('; ') || 'Related content';
}

// Helper function to determine link type based on mode
function determineLinkType(mode, fromCard, toCard) {
  if (mode === 'bridge') {
    return 'bridges';
  } else if (mode === 'critique') {
    return 'contradicts';
  } else if (mode === 'combine') {
    return 'supports';
  }
  return 'related';
}

module.exports = router;
