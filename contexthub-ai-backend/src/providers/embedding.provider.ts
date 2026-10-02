import { env } from '../config/env.js';

interface OpenAiEmbeddingResponse {
  data?: Array<{
    index: number;
    embedding: number[];
  }>;
}

let rateLimitedUntil = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const retryAfterMs = (response: Response, attempt: number) => {
  const retryAfter = response.headers.get('retry-after');

  if (retryAfter) {
    const seconds = Number(retryAfter);

    if (Number.isFinite(seconds)) {
      return seconds * 1000;
    }
  }

  return Math.min(30_000, 1000 * 2 ** attempt);
};

export const vectorLiteral = (embedding: number[]) => {
  if (embedding.length === 0 || embedding.some((value) => !Number.isFinite(value))) {
    throw new Error('Invalid embedding vector.');
  }

  return `[${embedding.join(',')}]`;
};

export const embeddingProvider = {
  isConfigured() {
    return Boolean(env.OPENAI_API_KEY);
  },

  isAvailable() {
    return this.isConfigured() && Date.now() >= rateLimitedUntil;
  },

  async embedTexts(texts: string[], options?: { maxRetries?: number }): Promise<number[][]> {
    if (!this.isAvailable()) {
      return [];
    }

    if (texts.length === 0) {
      return [];
    }

    const maxRetries = options?.maxRetries ?? env.OPENAI_EMBEDDING_MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: env.OPENAI_EMBEDDING_MODEL,
          input: texts
        })
      });

      if (response.ok) {
        const payload = (await response.json()) as OpenAiEmbeddingResponse;

        return (payload.data ?? [])
          .sort((left, right) => left.index - right.index)
          .map((item) => item.embedding);
      }

      if (response.status === 429) {
        rateLimitedUntil = Date.now() + retryAfterMs(response, attempt);
      }

      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        await sleep(retryAfterMs(response, attempt));
        continue;
      }

      throw new Error(`OpenAI embeddings request failed with ${response.status} ${response.statusText}`);
    }

    return [];
  },

  async embedText(text: string, options?: { maxRetries?: number }): Promise<number[] | null> {
    const [embedding] = await this.embedTexts([text], options);
    return embedding ?? null;
  }
};
