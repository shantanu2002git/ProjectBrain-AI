import type { Request, Response } from 'express';
import { projectRepository } from '../repositories/project.repository.js';
import { featureDnaService } from '../services/feature-dna.service.js';

export const featureDnaController = {
  async list(req: Request, res: Response) {
    const project = await projectRepository.findById(req.params.projectId);

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.json({ data: await featureDnaService.getProjectFeatureDna(project.id) });
  }
};
