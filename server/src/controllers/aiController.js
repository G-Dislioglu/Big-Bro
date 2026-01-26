const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateIdea = async (req, res) => {
  try {
    const { text, provider } = req.body;
    console.log(`Generating idea using: ${provider || 'openai'}`);

    let jsonResult;

    // --- STRATEGIE: GOOGLE GEMINI ---
    if (provider === 'gemini' || provider === 'gemini-flash') {
        const modelName = provider === 'gemini-flash' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
        if (!process.env.GEMINI_API_KEY) throw new Error("Gemini Key missing");
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // KORREKTUR: Keine Backticks im String verwenden!
        const prompt = `Du bist ein Strategie-Experte. Erstelle eine detaillierte Strategie für: "${text}".
        Antworte NUR mit reinem JSON. Bitte keine Markdown-Formatierung nutzen.
        Format: { "title": "...", "description": "...", "type": "strategy", "tags": ["Gemini", "Strategy"], "metadata": { "position": { "x": 0, "y": 0 } } }`;
        
        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '');
        jsonResult = JSON.parse(cleanJson);
    } 
    
    // --- STRATEGIE: OPENAI / DEEPSEEK / GROK ---
    else {
        let apiKey = process.env.OPENAI_API_KEY;
        let baseURL = undefined; 
        let modelName = 'gpt-4o'; // Standard OpenAI

        if (provider === 'openai-reasoning') {
            apiKey = process.env.OPENAI_API_KEY;
            baseURL = undefined;
            modelName = 'o1';
        } else if (provider === 'deepseek') {
            apiKey = process.env.DEEPSEEK_API_KEY;
            baseURL = 'https://api.deepseek.com';
            modelName = 'deepseek-chat';
        } else if (provider === 'deepseek-reasoner') {
            apiKey = process.env.DEEPSEEK_API_KEY;
            baseURL = 'https://api.deepseek.com';
            modelName = 'deepseek-r1';
        } else if (provider === 'grok') {
            apiKey = process.env.GROK_API_KEY;
            baseURL = 'https://api.x.ai/v1'; 
            modelName = 'grok-beta';
        }

        if (!apiKey) throw new Error(`${provider || 'OpenAI'} Key missing`);

        const client = new OpenAI({ apiKey, baseURL });
        
        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "Du bist ein Experte. Antworte NUR mit validem JSON. Schema: { title, description, type, tags: [], metadata: {} }" },
                { role: "user", content: `Erstelle eine detaillierte Strategie für: ${text}` }
            ],
            model: modelName,
            response_format: { type: "json_object" }
        });

        jsonResult = JSON.parse(completion.choices[0].message.content);
        if (!jsonResult.tags) jsonResult.tags = [];
        jsonResult.tags.push(provider || 'openai');
    }

    res.json(jsonResult);

  } catch (error) {
    console.error('AI Error:', error);
    res.status(500).json({ 
        title: "AI Error", 
        description: error.message, 
        type: "error", 
        metadata: { position: { x: 0, y: 0 } } 
    });
  }
};

const runScoutSwarm = async (req, res) => {
  try {
    const { text } = req.body;
    console.log(`Running Scout Swarm for: ${text}`);

    const [cardA, cardB, cardC] = await Promise.all([
      // SCOUT A (Fakten) - Gemini
      (async () => {
        if (!process.env.GEMINI_API_KEY) throw new Error("Gemini Key missing");
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Du bist der Fakten-Scout. Liste technische Daten, Marktzahlen und Fakten zum Thema auf.
        Antworte NUR mit reinem JSON.
        Format: { "title": "Fakten: ${text.substring(0, 20)}", "description": "...", "type": "note", "tags": ["Scout", "Facts"], "metadata": { "position": { "x": 0, "y": 0 } } }`;
        const result = await model.generateContent(prompt);
        const textResponse = result.response.text();
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(cleanJson);
      })(),

      // SCOUT B (Kritik) - DeepSeek
      (async () => {
        if (!process.env.DEEPSEEK_API_KEY) throw new Error("DeepSeek Key missing");
        const client = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: 'https://api.deepseek.com' });
        const completion = await client.chat.completions.create({
          messages: [
            { role: "system", content: "Du bist der Risiko-Scout. Finde Sicherheitslücken, Denkfehler und Risiken. Antworte NUR mit validem JSON. Schema: { title, description, type, tags: [], metadata: {} }" },
            { role: "user", content: `Analysiere Risiken für: ${text}` }
          ],
          model: 'deepseek-r1',
          response_format: { type: "json_object" }
        });
        const jsonResult = JSON.parse(completion.choices[0].message.content);
        jsonResult.title = `Kritik: ${text.substring(0, 20)}`;
        jsonResult.type = "note";
        jsonResult.tags = jsonResult.tags || [];
        jsonResult.tags.push("Scout", "Risk");
        jsonResult.metadata = { position: { x: 0, y: 0 } };
        return jsonResult;
      })(),

      // SCOUT C (Struktur) - OpenAI
      (async () => {
        if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI Key missing");
        const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await client.chat.completions.create({
          messages: [
            { role: "system", content: "Du bist der Architekt. Erstelle eine saubere Gliederung und Schritte zur Umsetzung. Antworte NUR mit validem JSON. Schema: { title, description, type, tags: [], metadata: {} }" },
            { role: "user", content: `Erstelle Struktur für: ${text}` }
          ],
          model: 'o1',
          response_format: { type: "json_object" }
        });
        const jsonResult = JSON.parse(completion.choices[0].message.content);
        jsonResult.title = `Struktur: ${text.substring(0, 20)}`;
        jsonResult.type = "note";
        jsonResult.tags = jsonResult.tags || [];
        jsonResult.tags.push("Scout", "Structure");
        jsonResult.metadata = { position: { x: 0, y: 0 } };
        return jsonResult;
      })()
    ]);

    res.json([cardA, cardB, cardC]);

  } catch (error) {
    console.error('Scout Swarm Error:', error);
    res.status(500).json([{ 
        title: "Scout Swarm Error", 
        description: error.message, 
        type: "error", 
        tags: ["Scout", "Error"], 
        metadata: { position: { x: 0, y: 0 } } 
    }]);
  }
};

// WICHTIG: Expliziter Export
module.exports = { generateIdea, runScoutSwarm };
