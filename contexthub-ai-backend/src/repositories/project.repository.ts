import type { Project } from '../types/domain.js';
import { prisma } from '../config/database.js';

export const projectRepository = {
  async list(): Promise<Project[]> {
    return prisma.project.findMany({
      orderBy: { createdAt: 'desc' }
    });
  },

  async create(input: {
    name: string;
    githubRepositoryUrl?: string;
    jiraProjectKey?: string;
  }): Promise<Project> {
    return prisma.project.create({
      data: input
    });
  },

  async findById(projectId: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id: projectId }
    });
  }
};
