import type { Request, Response } from 'express';
import { githubService } from '../services/github.service.js';
import { jiraService } from '../services/jira.service.js';

export const webhookController = {
  async github(req: Request, res: Response) {
    const result = await githubService.handleWebhook(req.body);
    res.status(202).json({ data: result });
  },

  async jira(req: Request, res: Response) {
    const result = await jiraService.handleWebhook(req.body);
    res.status(202).json({ data: result });
  }
};
