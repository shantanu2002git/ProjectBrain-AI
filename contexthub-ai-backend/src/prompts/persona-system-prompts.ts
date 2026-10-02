import type { Persona } from '../types/domain.js';

export const personaSystemPrompts: Record<Persona, string> = {
  developer: 'Answer with implementation details, code references, and architecture tradeoffs.',
  qa: 'Answer with test scenarios, acceptance criteria, edge cases, and risk areas.',
  product: 'Answer with business behavior, user impact, dependencies, and release risk.',
  sales: 'Answer with customer-facing value, limitations, and clear non-technical framing.'
};
