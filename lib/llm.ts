import OpenAI from "openai";

const MODEL = process.env.OPENROUTER_MODEL || "deepseek/deepseek-v3.2";

let client: OpenAI | null = null;

export function getLlmClient(): OpenAI {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to your .env.local file (see .env.example)."
    );
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://providerplus.com.au",
        "X-Title": "Audit-Ready Gap Checker",
      },
    });
  }
  return client;
}

export async function callClaude(params: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const openrouter = getLlmClient();
  const response = await openrouter.chat.completions.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 8192,
    temperature: params.temperature ?? 0.2,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  const choice = response.choices[0];
  const text = choice?.message?.content;
  if (process.env.LLM_DEBUG) {
    console.error(
      `[llm debug] finish_reason=${choice?.finish_reason} textLength=${text?.length ?? 0} usage=${JSON.stringify(response.usage)}`
    );
  }
  if (!text) {
    throw new Error("The model returned no text content.");
  }
  return text;
}

/** Strips markdown code fences and surrounding prose so the remainder can be JSON.parsed. */
export function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}
