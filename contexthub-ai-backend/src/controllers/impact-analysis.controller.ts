import type { Request, Response } from 'express';
import { z } from 'zod';
import { impactAnalysisService } from '../services/impact-analysis.service.js';

const impactSchema = z.object({
  projectId: z.string().min(1),
  changedFiles: z.array(z.string()).min(1)
});

export const impactAnalysisController = {
  async analyze(req: Request, res: Response) {
    const input = impactSchema.parse(req.body);

    res.json({ data: await impactAnalysisService.analyze(input) });
  }
};
