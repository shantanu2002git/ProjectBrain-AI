import type { Request, Response } from 'express';
import { z } from 'zod';
import { projectRepository } from '../repositories/project.repository.js';
import { chatService } from '../services/chat.service.js';

const personaSchema = z.enum(['developer', 'qa', 'product', 'sales']);

const createSessionSchema = z.object({
  title: z.string().min(1).optional(),
  persona: personaSchema.default('developer')
});

const messageSchema = z.object({
  sessionId: z.string().uuid().optional(),
  question: z.string().min(1),
  persona: personaSchema.default('developer')
});

const legacyChatSchema = messageSchema.extend({
  projectId: z.string().uuid()
});

export const chatController = {
  async listSessions(req: Request, res: Response) {
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await chatService.listSessions(project.id) });
  },

  async createSession(req: Request, res: Response) {
    const input = createSessionSchema.parse(req.body);
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const session = await chatService.createSession({
      projectId: project.id,
      persona: input.persona,
      title: input.title
    });

    res.status(201).json({ data: session });
  },

  async addMessage(req: Request, res: Response) {
    const input = messageSchema.parse(req.body);
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const session = await chatService.addMessage({
      projectId: project.id,
      sessionId: input.sessionId,
      question: input.question,
      persona: input.persona
    });

    if (!session) {
      res.status(404).json({ error: 'Chat session not found' });
      return;
    }

    res.status(201).json({ data: session });
  },

  async ask(req: Request, res: Response) {
    const input = legacyChatSchema.parse(req.body);
    const project = await projectRepository.findById(input.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const session = await chatService.addMessage({
      projectId: project.id,
      sessionId: input.sessionId,
      question: input.question,
      persona: input.persona
    });

    const assistantMessage = [...(session?.messages ?? [])].reverse().find((message) => message.role === 'assistant');

    res.json({
      data: {
        answer: assistantMessage?.content ?? '',
        citations: assistantMessage?.citations ?? [],
        session
      }
    });
  }
};
