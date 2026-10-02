import type { Request, Response } from 'express';
import { z } from 'zod';
import { projectRepository } from '../repositories/project.repository.js';
import { contextBuildService } from '../services/context-build.service.js';
import { jiraService } from '../services/jira.service.js';

const createProjectSchema = z.object({
  name: z.string().min(1),
  githubRepositoryUrl: z.string().url().optional(),
  jiraProjectKey: z.string().min(1).optional()
});

export const projectController = {
  async list(_req: Request, res: Response) {
    const projects = await projectRepository.list();
    res.json({ data: projects });
  },

  async create(req: Request, res: Response) {
    const input = createProjectSchema.parse(req.body);
    const project = await projectRepository.create(input);

    res.status(201).json({ data: project });
  },

  async buildContext(req: Request, res: Response) {
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const build = await contextBuildService.build(project);
    res.status(202).json({ data: build });
  },

  async getBuildContextStatus(req: Request, res: Response) {
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: contextBuildService.getStatus(project.id) });
  },

  async testJiraConnection(_req: Request, res: Response) {
    const result = await jiraService.testConnection();
    res.json({ data: result });
  }
};
