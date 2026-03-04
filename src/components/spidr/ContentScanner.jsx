import { base44 } from '@/api/base44Client';

/**
 * Scans an uploaded image/video URL for inappropriate content using AI.
 * Returns { safe: boolean, category?: string }
 */
export async function scanContent(fileUrl) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a strict content moderation AI. Analyze this image and determine if it contains ANY of the following prohibited content:
- Nudity or pornographic content
- Sexually suggestive or explicit content
- Graphic violence or gore
- Self-harm or suicide imagery
- Drug use imagery
- Hate symbols or extremist content
- Child exploitation (any kind)

Respond with a JSON object. Be STRICT - if in doubt, flag it.`,
    file_urls: [fileUrl],
    response_json_schema: {
      type: "object",
      properties: {
        safe: { type: "boolean", description: "true if the content is safe, false if prohibited" },
        category: { type: "string", description: "If unsafe, the category: 'nsfw', 'violence', 'hate', 'drugs', 'self_harm', 'child_safety'. If safe, 'none'" },
        confidence: { type: "number", description: "Confidence score 0-100" }
      },
      required: ["safe", "category", "confidence"]
    }
  });

  return result;
}

/**
 * Scans a text prompt for attempts to generate inappropriate content.
 * Returns { safe: boolean, category?: string }
 */
export async function scanPrompt(text) {
  const result = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a strict content moderation AI. Analyze this text prompt and determine if the user is trying to request or generate prohibited content:
- Nudity, porn, or sexually explicit content
- Graphic violence or gore
- Self-harm or suicide content
- Drug manufacturing/use instructions
- Hate speech or extremist content
- Child exploitation (any kind)

The text to analyze: "${text}"

Respond with a JSON object. Be STRICT.`,
    response_json_schema: {
      type: "object",
      properties: {
        safe: { type: "boolean" },
        category: { type: "string", description: "If unsafe: 'nsfw', 'violence', 'hate', 'drugs', 'self_harm', 'child_safety'. If safe: 'none'" }
      },
      required: ["safe", "category"]
    }
  });

  return result;
}