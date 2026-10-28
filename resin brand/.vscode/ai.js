// api/ai-image.js
// Server function that paints a picture for the "AI picture" box in design-studio.html.
// Written for Vercel (put this file at  api/ai-image.js  in your project).
//
// Claude (the AI behind ai-design.js) cannot paint pictures, so this file uses an image model
// from OpenAI instead. You need a separate key for it.
//
// SETUP
//  1. Create an API key at https://platform.openai.com (billed per picture; check their pricing page).
//  2. In your hosting dashboard add an Environment Variable:  OPENAI_API_KEY = your key.
//     NEVER paste the key into design-studio.html: anyone could read it there.
//  3. Deploy. The studio calls  /api/ai-image  on the same website.
//
// MODEL: defaults to OpenAI's newest image model. To change it without editing code, add an
// Environment Variable  IMAGE_MODEL  with one of:
//   gpt-image-2.5-sunburst   (default, newest)
//   gpt-image-2.5-flare      (newest, sibling model)
//   gpt-image-2              (older; transparent background is still "preview")
//   gpt-image-1.5 / gpt-image-1 / gpt-image-1-mini   (older / cheaper)
//
// COST CONTROL: each picture costs money, so there is a small per-visitor limit below.
// You can also change QUALITY to a cheaper setting ('low').
// Pictures take 20-40 seconds. If your host cuts requests short, raise its function time limit.

const MODEL = process.env.IMAGE_MODEL || 'gpt-image-2.5-sunburst';
const QUALITY = 'medium';       // 'low' is cheaper, 'high' looks best
const LIMIT_PER_HOUR = 5;
const hits = new Map();         // simple in-memory counter (resets when the server restarts)

const STYLES = {
  cartoon: 'cute flat cartoon sticker style, bold clean outlines, bright cheerful colours',
  watercolor: 'soft watercolour illustration, gentle gradients',
  realistic: 'realistic, detailed, polished illustration',
  mandala: 'intricate mandala / ornamental style, symmetrical, fine detail',
  line: 'minimal single-colour line art',
  gold: 'elegant gold foil ornamental style'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Server key missing' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= LIMIT_PER_HOUR) return res.status(429).json({ error: 'Too many pictures, please try again later' });

  const body = req.body || {};
  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  if (idea.length < 3 || idea.length > 300) return res.status(400).json({ error: 'Please describe the picture in 3 to 300 characters' });
  const style = STYLES[body.style] || STYLES.cartoon;

  const prompt =
    'A single decorative design element for handmade resin art, centred, ' +
    'no frame, no border, no text or letters, no watermark. ' +
    'Subject: ' + idea + '. Style: ' + style + '. ' +
    'Original artwork only: no copyrighted cartoon characters, no brand logos, no real people.';

  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 55000);
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        n: 1,
        size: '1024x1024',
        quality: QUALITY,
        background: 'transparent',
        output_format: 'png'
      }),
      signal: ctl.signal
    });
    clearTimeout(to);
    if (!r.ok) {
      // e.g. blocked by the image provider's safety rules, or this key has no access to the model yet
      let detail = '';
      try { detail = (await r.json()).error.message; } catch (e) {}
      console.error('OpenAI image error', r.status, detail);   // visible in your Vercel function logs
      return res.status(r.status === 400 ? 400 : 502).json({ error: 'The picture could not be created. Try describing it differently.' });
    }
    const data = await r.json();
    const b64 = data.data && data.data[0] && data.data[0].b64_json;
    if (!b64) return res.status(502).json({ error: 'No picture returned' });
    recent.push(now);           // only count successful pictures
    hits.set(ip, recent);
    return res.status(200).json({ image: 'data:image/png;base64,' + b64 });
  } catch (e) {
    return res.status(502).json({ error: 'Picture request failed' });
  }
};

module.exports.config = { maxDuration: 60 };