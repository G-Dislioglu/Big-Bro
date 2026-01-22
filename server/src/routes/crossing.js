const express = require('express');
const router = express.Router();
const { randomUUID } = require('crypto');
const requireAuth = require('../middleware/auth');
const requireDb = require('../middleware/requireDb');
const { db } = require('../db');

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function normalizeTag(tag) {
  return String(tag || '').trim().toLowerCase();
}

function mapIdeaLinkType(type) {
  if (type === 'variant_of') return 'refines';
  return type;
}

function modeToTemplateMode(mode) {
  if (mode === 'creative') return 'creative';
  if (mode === 'critical') return 'critical';
  return 'balanced';
}

function buildThesis({ mode, aTitle, bTitle, sharedTags }) {
  const tagsPart = sharedTags.length > 0 ? ` über gemeinsame Tags ${sharedTags.slice(0, 5).join(', ')}` : '';
  if (mode === 'creative') {
    return `Erkunde eine neue Verbindung zwischen "${aTitle}" und "${bTitle}"${tagsPart} und formuliere eine unerwartete Kombinationshypothese.`;
  }
  if (mode === 'critical') {
    return `Prüfe kritisch, ob "${aTitle}" und "${bTitle}"${tagsPart} Spannungen oder Widersprüche enthalten, und definiere klare Gegenbeweise.`;
  }
  return `Kombiniere "${aTitle}" mit "${bTitle}"${tagsPart} und leite daraus eine umsetzbare Kernaussage ab.`;
}

function buildSteps(mode) {
  if (mode === 'creative') {
    return [
      'Definiere den kleinsten gemeinsamen Nenner (Problem/Outcome).',
      'Liste 3 alternative Interpretationen pro Karte.',
      'Erzeuge 2 Kombinationsvarianten (A→B und B→A).',
      'Wähle eine Variante und formuliere eine testbare Hypothese.',
      'Plane einen 24h-MVP-Test mit klarer Metrik.'
    ];
  }
  if (mode === 'critical') {
    return [
      'Formuliere die These als falsifizierbare Aussage.',
      'Identifiziere 2-3 stärkste Gegenargumente.',
      'Definiere Daten/Belege, die die These widerlegen würden.',
      'Lege Kontroll- und Risikoindikatoren fest.',
      'Plane einen Test, der Widersprüche früh sichtbar macht.'
    ];
  }
  return [
    'Definiere Zielmetrik und Erfolgskriterium.',
    'Leite gemeinsame Begriffe/Tags in 1-2 Sätzen ab.',
    'Formuliere eine kombinierte Hypothese (was + warum).',
    'Plane einen kleinen Experiment-Schritt (MVP).',
    'Lege die nächsten 2 konkreten Aktionen fest.'
  ];
}

function buildRisks(mode) {
  const base = ['Unklare Zielmetrik', 'Zu viele Annahmen gleichzeitig', 'Datenqualität / Bias'];
  if (mode === 'creative') return [...base, 'Scope-Creep durch Ideenexplosion', 'Fehlende Validierung'];
  if (mode === 'critical') return [...base, 'Over-Optimierung auf Worst-Case', 'Handlungsblockade durch Analyse'];
  return [...base, 'Koordinationsaufwand unterschätzt', 'Unklare Ownership'];
}

function buildNextActions(mode) {
  if (mode === 'creative') {
    return ['Schreibe 3 Hypothesen-Varianten', 'Wähle 1 MVP-Test', 'Definiere Erfolgskriterium', 'Starte den Test'];
  }
  if (mode === 'critical') {
    return ['Liste Gegenbeweise', 'Definiere Stop-Kriterien', 'Plane Validierungstest', 'Review nach 48h'];
  }
  return ['Definiere Zielmetrik', 'Schreibe Hypothese', 'Plane MVP', 'Setze 2 ToDos'];
}

// POST /api/crossing - v0.2 deterministic heuristic (Idea Cards)
router.post('/', requireAuth, requireDb, async (req, res, next) => {
  try {
    const { cardIds = [], mode = 'balanced' } = req.body;
    const templateMode = modeToTemplateMode(mode);

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'validation_error', details: ['cardIds must be a non-empty array'] });
    }

    const cardsResult = await db.query(
      'SELECT id, title, body, tags, status, created_at, updated_at FROM idea_cards WHERE id = ANY($1)',
      [cardIds]
    );

    if (cardsResult.rows.length === 0) {
      return res.status(404).json({ ok: false, error: 'not_found' });
    }

    const cards = cardsResult.rows;

    const linksResult = await db.query(
      `SELECT id, source_id, target_id, type, note, created_at
       FROM idea_card_links
       WHERE source_id = ANY($1) AND target_id = ANY($1)`,
      [cardIds]
    );
    const links = linksResult.rows.map(l => ({ ...l, type: mapIdeaLinkType(l.type) }));

    // Tag overlap: +20 if any tag appears in at least 2 selected cards
    const tagCounts = new Map();
    for (const card of cards) {
      const tags = Array.isArray(card.tags) ? card.tags : [];
      for (const rawTag of tags) {
        const t = normalizeTag(rawTag);
        if (!t) continue;
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
    const sharedTags = Array.from(tagCounts.entries())
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t);

    let score = 0;
    if (sharedTags.length > 0) score += 20;

    // Link scoring
    for (const link of links) {
      if (link.type === 'supports') score += 10;
      else if (link.type === 'contradicts') score -= 15;
    }

    // Status bonus: +10 if none is archived-like
    const hasArchivedLike = cards.some(c => ['archived', 'killed'].includes(String(c.status || '').toLowerCase()));
    if (!hasArchivedLike) score += 10;

    // Text sanity: small bonus if average body length is reasonable
    const bodies = cards.map(c => String(c.body || ''));
    const avgLen = bodies.reduce((sum, b) => sum + b.length, 0) / Math.max(1, bodies.length);
    if (avgLen >= 40 && avgLen <= 2000) score += 5;

    score = clamp(score, 0, 100);

    const aTitle = String(cards[0]?.title || 'Card A');
    const bTitle = String(cards[1]?.title || cards[0]?.title || 'Card B');

    res.json({
      ok: true,
      score,
      thesis: buildThesis({ mode: templateMode, aTitle, bTitle, sharedTags }),
      steps: buildSteps(templateMode),
      risks: buildRisks(templateMode),
      next_actions: buildNextActions(templateMode)
    });
  } catch (error) {
    next(error);
  }
});

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
    
    const uniqueTags = Array.from(new Set(allTags));
    
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
