const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function generateIdea(text, provider) {
  const systemPrompt = `You are an AI assistant that generates structured idea cards from user input text. Return only valid JSON with the following structure: { "title": "string", "description": "string", "tags": ["array", "of", "strings"], "type": "string", "metadata": {} }. Do not include any other text or explanation.`;

  switch (provider) {
    case 'openai':
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
      });
      return JSON.parse(response.choices[0].message.content.trim());

    case 'deepseek':
      const deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
      });
      const dsResponse = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
      });
      return JSON.parse(dsResponse.choices[0].message.content.trim());

    case 'grok':
      const grok = new OpenAI({
        apiKey: process.env.GROK_API_KEY,
        baseURL: 'https://api.x.ai/v1'
      });
      const grokResponse = await grok.chat.completions.create({
        model: 'grok-beta',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
      });
      return JSON.parse(grokResponse.choices[0].message.content.trim());

    case 'gemini':
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const result = await model.generateContent(systemPrompt + '\n\nUser input: ' + text);
      const textResponse = result.response.text();
      // Gemini might include markdown, strip it
      const jsonText = textResponse.replace(/```json\n?/, '').replace(/```\n?/, '').trim();
      return JSON.parse(jsonText);

    default:
      throw new Error('Unsupported provider');
  }
}

module.exports = { generateIdea };
