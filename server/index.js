const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const axios = require('axios');
require('dotenv').config();

const app = express();
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = process.env.GEMINI_API_URL || '';

console.log('[STARTUP] GEMINI_API_KEY present:', GEMINI_API_KEY ? 'yes' : 'no');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-goog-api-key, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/upload', upload.single('resume'), async (req, res) => {
  console.log('[UPLOAD] Received /upload request');
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text || '';

    if (!text.trim()) {
      return res.status(400).json({ error: 'Could not extract any text from the provided PDF.' });
    }

    const prompt = `Extract the following fields from this resume text and return structured JSON match the exact schema requested:
    {
      "name": "string",
      "email": "string",
      "phone": "string",
      "summary": "string",
      "skills": ["string"],
      "education": [{"degree": "string", "institution": "string", "startYear": "string", "endYear": "string"}],
      "experience": [{"title": "string", "company": "string", "startDate": "string", "endDate": "string", "description": "string"}]
    }
    
    Resume text:\n\n${text}`;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    let llmText = '';

    if (GEMINI_API_KEY.startsWith('AIza')) {
      // Reverted back to your original, proven working model endpoint string
      const googleUrl = GEMINI_API_URL && GEMINI_API_URL.length > 0
        ? GEMINI_API_URL
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

      console.log('[LLM] Calling Google Gemini endpoint:', googleUrl);

      const body = {
        contents: [{ parts: [{ text: prompt }] }],
        // Keeping this! It tells Gemini to explicitly format the response as pure JSON
        generationConfig: {
          responseMimeType: "application/json"
        }
      };

      let apiResponse = await axios.post(googleUrl, body, {
        headers: {
          'Content-Type': 'application/json',
          'X-goog-api-key': GEMINI_API_KEY,
        },
      });

      // Safely extract the inner text string
      if (apiResponse.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        llmText = apiResponse.data.candidates[0].content.parts[0].text.trim();
      } else {
        throw new Error('Unexpected Gemini API response token structure');
      }

    } else {
      // OpenAI-style endpoint configuration
      const url = GEMINI_API_URL || 'https://api.openai.com/v1/chat/completions';
      console.log('[LLM] Calling OpenAI-style API...');
      
      const apiResponse = await axios.post(
        url,
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: "json_object" }, // Enforce JSON mode
          max_tokens: 2000,
          temperature: 0.0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GEMINI_API_KEY}`,
          },
        }
      );

      llmText = apiResponse.data.choices?.[0]?.message?.content || '';
    }

    // Clean up markdown code blocks if the fallback API injected them
    if (llmText.startsWith('```json')) {
      llmText = llmText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (llmText.startsWith('```')) {
      llmText = llmText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Safe, reliable JSON parse execution
    const parsed = JSON.parse(llmText);
    res.json({ parsed, rawText: text });

  } catch (err) {
    console.error('[SERVER] Error while processing:', err?.message || err);
    
    if (err && err.response) {
      return res.status(500).json({
        error: 'LLM Provider failed to process data',
        details: err.message,
        providerStatus: err.response.status,
        providerData: err.response.data
      });
    }

    res.status(500).json({ error: 'Failed to process file', details: err.message });
  } finally {
    // Guaranteed local clean-up of temporary files
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error('[SERVER] Failed to delete temp file:', err);
      });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));