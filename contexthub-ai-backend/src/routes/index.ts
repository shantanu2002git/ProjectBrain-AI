import { Router } from 'express';
import { chatController } from '../controllers/chat.controller.js';
import { contextController } from '../controllers/context.controller.js';
import { featureDnaController } from '../controllers/feature-dna.controller.js';
import { impactAnalysisController } from '../controllers/impact-analysis.controller.js';
import { projectController } from '../controllers/project.controller.js';
import { webhookController } from '../controllers/webhook.controller.js';

export const apiRouter = Router();

apiRouter.get('/projects', projectController.list);
apiRouter.post('/projects', projectController.create);
apiRouter.get('/jira/test-connection', projectController.testJiraConnection);
apiRouter.post('/projects/:projectId/build-context', projectController.buildContext);
apiRouter.get('/projects/:projectId/build-context/status', projectController.getBuildContextStatus);
apiRouter.get('/projects/:projectId/context', contextController.getContext);
apiRouter.get('/projects/:projectId/context/artifacts', contextController.getArtifacts);
apiRouter.get('/projects/:projectId/context/files', contextController.getFiles);
apiRouter.get('/projects/:projectId/context/graph', contextController.getGraph);
apiRouter.get('/projects/:projectId/feature-dna', featureDnaController.list);
apiRouter.get('/projects/:projectId/chat-sessions', chatController.listSessions);
apiRouter.post('/projects/:projectId/chat-sessions', chatController.createSession);
apiRouter.post('/projects/:projectId/chat-messages', chatController.addMessage);
apiRouter.post('/chat', chatController.ask);
apiRouter.post('/impact-analysis', impactAnalysisController.analyze);
apiRouter.post('/webhooks/github', webhookController.github);
apiRouter.post('/webhooks/jira', webhookController.jira);
