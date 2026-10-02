import type { Prisma } from '@prisma/client';
import type { Persona } from '../types/domain.js';
import { prisma } from '../config/database.js';
import { aiService } from './ai.service.js';

const titleFromQuestion = (question: string) => {
  const title = question.replace(/\s+/g, ' ').trim();
  return title.length > 72 ? `${title.slice(0, 69)}...` : title || 'New conversation';
};

export const chatService = {
  async listSessions(projectId: string) {
    return prisma.chatSession.findMany({
      where: { projectId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  },

  async createSession(input: { projectId: string; persona: Persona; title?: string }) {
    return prisma.chatSession.create({
      data: {
        projectId: input.projectId,
        persona: input.persona,
        title: input.title?.trim() || 'New conversation'
      },
      include: {
        messages: true
      }
    });
  },

  async addMessage(input: { projectId: string; sessionId?: string; question: string; persona: Persona }) {
    const session = input.sessionId
      ? await prisma.chatSession.findFirst({
          where: {
            id: input.sessionId,
            projectId: input.projectId
          }
        })
      : await prisma.chatSession.create({
          data: {
            projectId: input.projectId,
            persona: input.persona,
            title: titleFromQuestion(input.question)
          }
        });

    if (!session) {
      return null;
    }

    const answer = await aiService.answerQuestion({
      projectId: input.projectId,
      question: input.question,
      persona: input.persona
    });

    await prisma.$transaction([
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          projectId: input.projectId,
          role: 'user',
          content: input.question,
          persona: input.persona
        }
      }),
      prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          projectId: input.projectId,
          role: 'assistant',
          content: answer.answer,
          persona: input.persona,
          citations: answer.citations as unknown as Prisma.InputJsonValue
        }
      }),
      prisma.chatSession.update({
        where: { id: session.id },
        data: {
          persona: input.persona,
          title: session.title === 'New conversation' ? titleFromQuestion(input.question) : session.title
        }
      })
    ]);

    return prisma.chatSession.findFirst({
      where: {
        id: session.id,
        projectId: input.projectId
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }
};
