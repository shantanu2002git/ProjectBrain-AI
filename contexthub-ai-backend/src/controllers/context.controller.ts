import type { Request, Response } from 'express';
import { projectRepository } from '../repositories/project.repository.js';
import { contextReadService } from '../services/context-read.service.js';

const ensureProject = async (projectId: string, res: Response) => {
  const project = await projectRepository.findById(projectId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  return project;
};

export const contextController = {
  async getContext(req: Request, res: Response) {
    const project = await ensureProject(req.params.projectId, res);

    if (!project) {
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await contextReadService.getProjectContext(project.id) });
  },

  async getArtifacts(req: Request, res: Response) {
    const project = await ensureProject(req.params.projectId, res);

    if (!project) {
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await contextReadService.getArtifacts(project.id) });
  },

  async getFiles(req: Request, res: Response) {
    const project = await ensureProject(req.params.projectId, res);

    if (!project) {
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await contextReadService.getFiles(project.id) });
  },

  async getGraph(req: Request, res: Response) {
    const project = await ensureProject(req.params.projectId, res);

    if (!project) {
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await contextReadService.getGraph(project.id) });
  }
};
