# Resume to Webpage (prototype)

Simple project to upload a PDF resume, extract text, call a Gemini/LLM API to parse resume fields, and return JSON.

Setup
1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY` and `GEMINI_API_URL` if needed.
2. Run `npm install` at the repo root and inside `server` if using the `setup` script.
3. Start server: `npm run dev` (requires `nodemon`) or `npm start`.
4. Open `http://localhost:3000` and upload a PDF.

Notes
- The server expects `GEMINI_API_KEY` in environment variables for safety.
- The example uses a generic LLM endpoint; adjust `GEMINI_API_URL` to your provider's REST endpoint.
