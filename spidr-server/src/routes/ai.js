const express = require('express');
const authMW  = require('../middleware/auth');

const router = express.Router();

/**
 * POST /ai/invoke
 * Proxies LLM calls server-side so API keys stay secret.
 * Supports: OpenAI (OPENAI_API_KEY) or Anthropic (ANTHROPIC_API_KEY).
 * Falls back to a helpful stub if neither key is set.
 */
router.post('/invoke', authMW, async (req, res) => {
  try {
    const { prompt, response_json_schema } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    const openaiKey    = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    // ── No key configured — return a helpful stub ──────────────────────────
    if (!openaiKey && !anthropicKey) {
      // Return a usable stub JSON when schema is expected so UI doesn't crash
      let stubResult = 'Spidr AI is not yet configured. Ask your admin to set OPENAI_API_KEY or ANTHROPIC_API_KEY in the server .env file.';
      if (response_json_schema) {
        stubResult = buildStub(response_json_schema);
      }
      return res.json({ result: stubResult });
    }

    // Resolve fetch (Node 18+ has it built-in; older needs node-fetch)
    const fetchFn = global.fetch ?? (await import('node-fetch').catch(() => null))?.default;
    if (!fetchFn) return res.status(500).json({ error: 'fetch not available on this Node version' });

    let text = '';

    // ── OpenAI ──────────────────────────────────────────────────────────────
    if (openaiKey) {
      let userContent = prompt;
      if (response_json_schema) {
        userContent += `\n\nRespond ONLY with valid JSON matching this schema, no markdown fences:\n${JSON.stringify(response_json_schema)}`;
      }

      const oaiRes = await fetchFn('https://api.openai.com/v1/chat/completions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model:       'gpt-4o-mini',
          messages:    [{ role: 'user', content: userContent }],
          temperature: 0.7,
          max_tokens:  1500,
        }),
      });

      const data = await oaiRes.json();
      if (!oaiRes.ok) throw new Error(data.error?.message || 'OpenAI error');
      text = data.choices?.[0]?.message?.content || '';
    }

    // ── Anthropic (Claude) — used if no OpenAI key ─────────────────────────
    else if (anthropicKey) {
      let userContent = prompt;
      if (response_json_schema) {
        userContent += `\n\nRespond ONLY with valid JSON matching this schema, no markdown fences:\n${JSON.stringify(response_json_schema)}`;
      }

      const anthRes = await fetchFn('https://api.anthropic.com/v1/messages', {
        method:  'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-3-haiku-20240307',
          max_tokens: 1500,
          messages:   [{ role: 'user', content: userContent }],
        }),
      });

      const data = await anthRes.json();
      if (!anthRes.ok) throw new Error(data.error?.message || 'Anthropic error');
      text = data.content?.[0]?.text || '';
    }

    // ── Parse JSON if schema was requested ─────────────────────────────────
    let result = text;
    if (response_json_schema && text) {
      try {
        result = JSON.parse(text.replace(/```json\n?|```\n?/g, '').trim());
      } catch {
        // Return raw text if JSON parse fails — better than crashing
        result = text;
      }
    }

    res.json({ result });
  } catch (err) {
    console.error('AI route error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Stub generator — builds a minimal valid object from a JSON schema ────────
function buildStub(schema) {
  if (!schema || schema.type !== 'object') return {};
  const obj = {};
  for (const [key, val] of Object.entries(schema.properties || {})) {
    if (val.type === 'string')  obj[key] = `[AI not configured: ${key}]`;
    else if (val.type === 'number') obj[key] = 0;
    else if (val.type === 'boolean') obj[key] = true;
    else if (val.type === 'array')  obj[key] = [];
    else if (val.type === 'object') obj[key] = buildStub(val);
  }
  return obj;
}

module.exports = router;
