import { entities, auth, integrations } from '@/api/apiClient';

/**
 * Content moderation helpers.
 *
 * Important behavior change: we now **fail open** when the LLM isn't available
 * or can't actually see the content. The previous implementation called
 * InvokeLLM with file_urls (which the server doesn't pass to the LLM), so the
 * model was asked to judge content it couldn't see. With a strict "if in
 * doubt, flag it" prompt, it would flag everything — meaning *every* GIF
 * upload showed "content blocked" even when totally harmless.
 *
 * The right call here: only block when we get a confident unsafe verdict.
 * Stub responses, errors, and missing keys all let the upload through.
 * The Hive's report/flag system handles the long-tail moderation.
 */

const SAFE = { safe: true, category: 'none', confidence: 0 };

function looksLikeStub(result) {
  if (!result) return true;
  // The server's buildStub() returns strings like "[AI not configured: category]"
  if (typeof result.category === 'string' && result.category.startsWith('[AI not configured')) return true;
  return false;
}

export async function scanContent(fileUrl) {
  try {
    const result = await integrations.Core.InvokeLLM({
      prompt: `You are a content moderation classifier. The user is uploading an asset to a social platform.

Asset URL: ${fileUrl}

Only flag it if you have STRONG, CONCRETE evidence of one of these categories:
- "nsfw": nudity, pornography, sexually explicit
- "violence": gore, graphic violence, weapons aimed at people
- "hate": hate symbols, slurs, extremist content
- "child_safety": any content involving minors in inappropriate contexts
- "self_harm": suicide imagery or instructions
- "drugs": hard drug use imagery

If you have any doubt at all, the content is safe. Most uploads are memes,
reaction GIFs, anime art, gaming screenshots, or pet photos — those are all
fine. Do NOT block based on filename, URL pattern, or vague suspicions.`,
      response_json_schema: {
        type: 'object',
        properties: {
          safe: { type: 'boolean' },
          category: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['safe', 'category', 'confidence'],
      },
    });

    // No LLM configured → buildStub returned a placeholder. Fail open.
    if (looksLikeStub(result)) return SAFE;

    // Only block on confident verdicts. A confidence < 70 is a guess, not evidence.
    if (result.safe === false && (result.confidence || 0) >= 70 && result.category && result.category !== 'none') {
      return { safe: false, category: result.category, confidence: result.confidence };
    }
    return SAFE;
  } catch (err) {
    // Network failure, parse error, anything — fail open so uploads work.
    console.warn('scanContent failed open:', err?.message);
    return SAFE;
  }
}

export async function scanPrompt(text) {
  try {
    const result = await integrations.Core.InvokeLLM({
      prompt: `You are a content moderation classifier. The user typed this into a generative AI prompt on a social platform:

"${text}"

Only flag it if the user is CLEARLY trying to generate one of these:
- "nsfw": nudity or pornographic content
- "violence": gore or graphic violence
- "hate": hate symbols, slurs, extremist content
- "child_safety": content involving minors in inappropriate contexts
- "self_harm": suicide encouragement or method details
- "drugs": instructions to make or use hard drugs

Normal creative prompts (anime, fantasy, sci-fi, abstract art, portraits,
animals, landscapes, vehicles, etc.) are all fine. Do NOT block based on
single suggestive words — context matters.`,
      response_json_schema: {
        type: 'object',
        properties: {
          safe: { type: 'boolean' },
          category: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['safe', 'category'],
      },
    });

    if (looksLikeStub(result)) return SAFE;

    if (result.safe === false && (result.confidence || 100) >= 70 && result.category && result.category !== 'none') {
      return { safe: false, category: result.category };
    }
    return SAFE;
  } catch (err) {
    console.warn('scanPrompt failed open:', err?.message);
    return SAFE;
  }
}
