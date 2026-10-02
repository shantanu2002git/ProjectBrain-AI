import { aiProvider } from '../providers/ai.provider.js';
import { retrievalService } from './retrieval.service.js';
import type { Persona } from '../types/domain.js';

export const aiService = {
  async answerQuestion(input: { projectId: string; question: string; persona: Persona }) {
    const retrieved = await retrievalService.buildContext(input.projectId, input.question);

    return aiProvider.generateAnswer({
      persona: input.persona,
      question: input.question,
      context: retrieved.context,
      citations: retrieved.citations
    });
  }
};
