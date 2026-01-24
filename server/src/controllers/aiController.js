const OpenAI = require('openai');

// Controller Funktion
const generateIdea = async (req, res) => {
  try {
    const { text, provider } = req.body;
    console.log(`Generating idea with provider: ${provider}`);

    // Mock-Response für den Test (damit der Server nicht crasht, bis API Keys da sind)
    const mockResponse = {
      title: "AI Idea: " + (text ? text.substring(0, 20) : "New Idea"),
      description: text || "No description provided",
      type: "text-note",
      tags: ["ai-generated", provider || "openai"],
      metadata: { position: { x: 0, y: 0 } }
    };

    res.json(mockResponse);
  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ error: 'AI generation failed' });
  }
};

// WICHTIG: Expliziter Export
module.exports = { generateIdea };
