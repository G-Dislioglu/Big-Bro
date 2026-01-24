const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const generateIdea = async (req, res) => {
  try {
    const { text, provider } = req.body;
    console.log(`Generating idea using: ${provider || 'openai'}`);

    let jsonResult;

    // --- STRATEGIE: GOOGLE GEMINI ---
    if (provider === 'gemini') {
        if (!process.env.GEMINI_API_KEY) throw new Error("Gemini Key missing");
        
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        
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
        let modelName = 'gpt-4o'; 

        if (provider === 'deepseek') {
            apiKey = process.env.DEEPSEEK_API_KEY;
            baseURL = 'https://api.deepseek.com';
            modelName = 'deepseek-chat';
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

module.exports = { generateIdea };
