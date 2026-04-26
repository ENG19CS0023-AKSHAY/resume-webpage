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
// GEMINI_API_URL can be set to override provider endpoint. Default is empty so
// the code chooses the correct Google endpoint when a Google API key is used.
const GEMINI_API_URL = process.env.GEMINI_API_URL || '';

// Startup diagnostics (do not print the full key)
console.log('[STARTUP] GEMINI_API_KEY present:', GEMINI_API_KEY ? 'yes' : 'no');
if (GEMINI_API_KEY) {
  console.log('[STARTUP] Detected key prefix:', GEMINI_API_KEY.slice(0,4) + '...');
  console.log('[STARTUP] Provider selection:', GEMINI_API_KEY.startsWith('AIza') ? 'Google Gemini' : 'OpenAI-style or custom URL');
} else {
  console.log('[STARTUP] No GEMINI_API_KEY set. The server will not be able to call LLM APIs until this is configured.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'client')));

// Simple CORS middleware so the Vite dev server (different port) can call /upload
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With, X-goog-api-key, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/upload', upload.single('resume'), async (req, res) => {
  console.log('[UPLOAD] Received /upload request');
  if (req.file) console.log('[UPLOAD] file:', req.file.originalname, 'size:', req.file.size);
  else console.log('[UPLOAD] no file attached in request');
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text || '';

    // Build a prompt to extract resume fields
    const prompt = `Extract the following fields from this resume text and return JSON: name, email, phone, summary, skills (array), education (array of {degree, institution, startYear, endYear}), experience (array of {title, company, startDate, endDate, description}). Resume text:\n\n${text}`;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
    }

    // Call LLM endpoint. Support Google API keys (AIza...) using the Generative Language API
    let apiResponse;
    let llmText = '';

    if (GEMINI_API_KEY.startsWith('AIza')) {
      // Google API key: use header X-goog-api-key and the Gemini generateContent endpoint by default
      const googleUrl = GEMINI_API_URL && GEMINI_API_URL.length > 0
        ? GEMINI_API_URL
        : 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

      console.log('[LLM] Using Google Gemini endpoint:', googleUrl);

      const body = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      };

      try {
        apiResponse = await axios.post(googleUrl, body, {
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': GEMINI_API_KEY,
          },
        });
      } catch (e) {
        // If unauthorized, try fallback with ?key= query param (some projects accept this)
        if (e && e.response && e.response.status === 401) {
          console.warn('[LLM] Gemini returned 401; retrying with key in query param');
          const qpUrl = googleUrl.includes('?') ? `${googleUrl}&key=${encodeURIComponent(GEMINI_API_KEY)}` : `${googleUrl}?key=${encodeURIComponent(GEMINI_API_KEY)}`;
          apiResponse = await axios.post(qpUrl, body, {
            headers: { 'Content-Type': 'application/json' },
          });
        } else {
          throw e;
        }
      }

      console.log('[LLM] Gemini response status:', apiResponse.status);
      if (apiResponse.data) {
        const snippet = JSON.stringify(apiResponse.data).slice(0, 500);
        console.log('[LLM] Gemini response snippet:', snippet);
      }

      // Robust parsing of Gemini responses (different versions return different shapes)
      const data = apiResponse.data || {};
      // Try common fields: candidates -> content -> parts -> text
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        const parts = data.candidates[0].content || data.candidates[0].output || [];
        if (Array.isArray(parts)) {
          // parts may be an array of objects with 'text' or 'content'
          llmText = parts.map(p => (p.text || p.content || '')).join('\n').trim();
        } else if (typeof parts === 'string') {
          llmText = parts;
        }
      }

      // fallback: newer responses may have 'output' array at top-level
      if (!llmText && Array.isArray(data.output) && data.output.length > 0) {
        const out = data.output[0];
        const parts = out.content || out;
        if (Array.isArray(parts)) llmText = parts.map(p => p.text || p.content || '').join('\n').trim();
        else if (typeof parts === 'string') llmText = parts;
      }

      // final fallback: try to read first text from contents
      if (!llmText && Array.isArray(data.contents) && data.contents.length > 0) {
        const cparts = data.contents[0].parts || [];
        if (Array.isArray(cparts)) llmText = cparts.map(p => p.text || '').join('\n').trim();
      }

      if (!llmText) llmText = JSON.stringify(apiResponse.data);
    } else {
      // OpenAI-style endpoint (default)
      const url = GEMINI_API_URL || 'https://api.openai.com/v1/chat/completions';
      apiResponse = await axios.post(
        url,
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1500,
          temperature: 0.0,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${GEMINI_API_KEY}`,
          },
        }
      );

      console.log('[LLM] OpenAI-style response status:', apiResponse.status);
      if (apiResponse.data) {
        const snippet = JSON.stringify(apiResponse.data).slice(0, 500);
        console.log('[LLM] OpenAI-style response snippet:', snippet);
      }

      llmText = apiResponse.data.choices?.[0]?.message?.content || apiResponse.data.choices?.[0]?.text || '';
    }

    // Try to parse JSON from LLM output
    let parsed = null;
    try {
      parsed = JSON.parse(llmText);
    } catch (e) {
      // fallback: return raw text
      parsed = { raw: llmText };
    }

    res.json({ parsed, rawText: text });
  } catch (err) {
    console.error('[SERVER] Error while processing:', err?.message || err);
    // If axios error from provider, include status/data for easier debugging
    if (err && err.response) {
      console.error('[SERVER] Provider response status:', err.response.status);
      console.error('[SERVER] Provider response data:', JSON.stringify(err.response.data).slice(0, 2000));
      return res.status(500).json({
        error: 'Failed to process file',
        details: err.message,
        providerStatus: err.response.status,
        providerData: err.response.data
      });
    }

    res.status(500).json({ error: 'Failed to process file', details: err.message });
  } finally {
    // cleanup
    fs.unlink(filePath, () => {});
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
