const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// Debugging: Prüfen ob die Funktion existiert
if (!aiController.generateIdea) {
  console.error("CRITICAL ERROR: generateIdea export is missing!");
}

// Route definieren
router.post('/generate', aiController.generateIdea);

module.exports = router;
