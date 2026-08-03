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
      // We do our own retry-once-with-a-correction-prompt in lib/analyse.ts.
      // The SDK's default retries (on 429/5xx) would silently stack on top of
      // that and can multiply an already-slow call's latency.
      maxRetries: 0,
      // Fail fast rather than let one hung connection eat the whole request budget.
      timeout: 45_000,
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
  /** Ask OpenRouter to enforce JSON output where the model supports it (DeepSeek does). */
  jsonMode?: boolean;
}): Promise<string> {
  const openrouter = getLlmClient();
  const startedAt = Date.now();

  // Route to the fastest available backend for this model rather than the
  // cheapest — our bottleneck is output-token throughput, not price.
  // Measured locally: cut the slowest batch call from ~39s to ~13s with no
  // quality difference. Opt-out via env var if ever needed.
  const sortByThroughput = process.env.OPENROUTER_SORT_THROUGHPUT !== "0";
  const providerOptions: Record<string, unknown> = {};
  if (sortByThroughput) {
    providerOptions.sort = "throughput";
  }
  if (params.jsonMode) {
    // Not every backend behind this model supports response_format (some of
    // DeepSeek v3.2's OpenRouter providers don't). Without this, throughput
    // sorting can route to a fast-but-incompatible provider and every
    // request fails — this was a real, 100%-reproducible production bug.
    // require_parameters tells OpenRouter to only route to providers that
    // support every parameter in the request.
    providerOptions.require_parameters = true;
  }

  const response = await openrouter.chat.completions.create({
    model: MODEL,
    max_tokens: params.maxTokens ?? 8192,
    temperature: params.temperature ?? 0.2,
    ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(Object.keys(providerOptions).length > 0
      ? ({ provider: providerOptions } as Record<string, unknown>)
      : {}),
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
  });

  const choice = response.choices[0];
  const text = choice?.message?.content;
  if (process.env.LLM_DEBUG) {
    const elapsedMs = Date.now() - startedAt;
    console.error(
      `[llm debug] elapsedMs=${elapsedMs} finish_reason=${choice?.finish_reason} textLength=${text?.length ?? 0} usage=${JSON.stringify(response.usage)}`
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
