// api/ai-chatgpt.js  (ChatGPT / OpenAI version of the AI Designer)
// Server function behind the "AI Designer" box in design-studio.html.
// The studio sends  { idea, catalog }  and expects back a JSON design plan.
// The studio already checks every field it receives, so invalid ids are simply ignored.
//
// SETUP
//  1. Environment variable in Vercel:  OPENAI_API_KEY = your key  (same one ai-image.js uses).
//  2. Optional:  CHAT_MODEL = a model name from OpenAI's model list (default below).
//  3. Put this file at  api/ai-chatgpt.js  and deploy. In design-studio.html the "AI engine" dropdown calls this file when ChatGPT is chosen.
//
// If this fails or is slow, the studio automatically falls back to its built-in quick mode.

const MODEL = process.env.CHAT_MODEL || 'gpt-4o-mini';
const LIMIT_PER_HOUR = 20;
const hits = new Map();   // simple in-memory counter (resets when the server restarts)

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Server key missing' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= LIMIT_PER_HOUR) return res.status(429).json({ error: 'Too many requests, please try again later' });

  const body = req.body || {};
  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  if (idea.length < 3 || idea.length > 500) return res.status(400).json({ error: 'Please describe your idea in 3 to 500 characters' });
  const catalog = body.catalog && typeof body.catalog === 'object' ? body.catalog : {};

  const system =
    'You are the design assistant for a handmade resin art studio (coasters, frames, clocks, pooja thalis, pendants). ' +
    'The customer describes an idea. Reply with ONE JSON object only (no markdown, no extra text) with exactly these keys:\n' +
    '{\n' +
    '  "message": short friendly sentence (max 200 chars) describing the design you made,\n' +
    '  "shape": one id from catalog.shapes,\n' +
    '  "size": number of inches between 1 and ' + (catalog.maxSize || 24) + ' (steps of 0.5),\n' +
    '  "colors": up to 3 names from catalog.colors,\n' +
    '  "text": null OR {"content": text to write, "language": one of catalog.languages, "font": one of catalog.fonts, "color": "#rrggbb"},\n' +
    '  "stickers": up to 6 ids from catalog.stickers,\n' +
    '  "flowers": up to 4 ids from catalog.flowers,\n' +
    '  "materials": up to 3 ids from catalog.materials,\n' +
    '  "packing": one id from catalog.packing (use "standard" if unsure),\n' +
    '  "drawings": [] (optional, max 2: {"title": short, "svg": "<svg viewBox=\\"0 0 100 100\\" xmlns=\\"http://www.w3.org/2000/svg\\">...</svg>"} ' +
    'only simple shapes, no script, no images, no text, under 5000 characters, and only if the idea needs something the stickers cannot show)\n' +
    '}\n' +
    'Rules: use ONLY ids and names that appear in the catalog. Pick items that fit the idea, occasion and person. ' +
    'Do not add more items than needed. If the customer gives a name or words to write, put them in "text". ' +
    'Original designs only: no copyrighted characters, brand logos or real people.';

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 40000);
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: 'catalog = ' + JSON.stringify(catalog) + '\n\nCustomer idea: ' + idea }
        ]
      }),
      signal: ctl.signal
    });
    clearTimeout(to);
    if (!r.ok) return res.status(502).json({ error: 'AI request failed' });

    const data = await r.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) return res.status(502).json({ error: 'No reply' });

    let plan;
    try { plan = JSON.parse(text.replace(/```json|```/g, '').trim()); }
    catch (e) { return res.status(502).json({ error: 'Bad reply' }); }

    recent.push(now);
    hits.set(ip, recent);
    return res.status(200).json(plan);
  } catch (e) {
    return res.status(502).json({ error: 'AI request failed' });
  }
};

module.exports.config = { maxDuration: 60 };