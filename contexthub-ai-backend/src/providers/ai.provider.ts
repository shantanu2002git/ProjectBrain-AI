import { env } from '../config/env.js';
import type { Citation, Persona } from '../types/domain.js';

export interface GenerateAnswerInput {
  persona: Persona;
  question: string;
  context: string;
  citations: Citation[];
}

export interface AiProvider {
  generateAnswer(input: GenerateAnswerInput): Promise<{ answer: string; citations: Citation[] }>;
}

let chatRateLimitedUntil = 0;

const personaInstruction: Record<Persona, string> = {
  developer: 'Focus on implementation, files, APIs, dependencies, and technical tradeoffs.',
  qa: 'Focus on test cases, acceptance criteria, edge cases, and regression risk.',
  product: 'Focus on feature behavior, business rules, user impact, and release risk.',
  sales: 'Focus on plain-language value, limitations, and customer-facing explanation.'
};

const localAnswer = (input: GenerateAnswerInput) => {
  if (input.citations.length === 0) {
    return `I could not find indexed evidence for this question yet. Build context for the relevant repository and Jira project, then ask again.`;
  }

  const evidenceLines = input.context
    .split('\n')
    .filter((line) => line.startsWith('Artifact') || line.startsWith('File:') || line.startsWith('Jira '))
    .slice(0, 12);

  return [
    `${personaInstruction[input.persona]}`,
    '',
    `Question: ${input.question}`,
    '',
    'Evidence-backed answer:',
    evidenceLines.length > 0
      ? evidenceLines.map((line) => `- ${line}`).join('\n')
      : '- Relevant context was found, but it is mostly source chunks. Review the citations below.',
    '',
    'Citations:',
    input.citations.map((citation, index) => `${index + 1}. ${citation.label}`).join('\n')
  ].join('\n');
};

const openAiAnswer = async (input: GenerateAnswerInput) => {
  if (!env.OPENAI_API_KEY) {
    console.warn('OPENAI_API_KEY is not set. Falling back to local search.');
    return localAnswer(input);
  }
  
  if (Date.now() < chatRateLimitedUntil) return localAnswer(input);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: [
            'You answer questions about an indexed software project.',
            personaInstruction[input.persona],
            'Use only the supplied context. If context is insufficient, say so.',
            'Keep citations by referring to the provided evidence labels.'
          ].join('\n')
        },
        {
          role: 'user',
          content: [`Question: ${input.question}`, '', 'Indexed context:', input.context].join('\n')
        }
      ]
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'));
      chatRateLimitedUntil = Date.now() + (Number.isFinite(retryAfter) ? retryAfter * 1000 : 60_000);
    }
    throw new Error(`OpenAI request failed with ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content ?? localAnswer(input);
};

const geminiAnswer = async (input: GenerateAnswerInput) => {
  if (!env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Falling back to local search.');
    return localAnswer(input);
  }

  if (Date.now() < chatRateLimitedUntil) return localAnswer(input);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: [
              'You answer questions about an indexed software project.',
              personaInstruction[input.persona],
              'Use only the supplied context. If context is insufficient, say so.',
              'Keep citations by referring to the provided evidence labels.'
            ].join('\n')
          }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: [`Question: ${input.question}`, '', 'Indexed context:', input.context].join('\n') }]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    })
  });

  if (!response.ok) {
    if (response.status === 429) {
      chatRateLimitedUntil = Date.now() + 60_000;
    }
    throw new Error(`Gemini request failed with ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return payload.candidates?.[0]?.content?.parts?.[0]?.text ?? localAnswer(input);
};

export const aiProvider: AiProvider = {
  async generateAnswer(input) {
    try {
      let answer = '';
      
      switch (env.AI_PROVIDER) {
        case 'gemini':
          answer = await geminiAnswer(input);
          break;
        case 'openai':
          answer = await openAiAnswer(input);
          break;
        case 'claude':
        case 'bedrock':
        case 'ollama':
          console.warn(`${env.AI_PROVIDER} integration pending. Falling back to local.`);
          answer = localAnswer(input);
          break;
        default:
          answer = localAnswer(input);
          break;
      }

      return {
        answer,
        citations: input.citations
      };
    } catch (error) {
      console.warn(`${env.AI_PROVIDER} chat failed, returning local evidence-backed answer.`, error);
      return {
        answer: localAnswer(input),
        citations: input.citations
      };
    }
  }
};
