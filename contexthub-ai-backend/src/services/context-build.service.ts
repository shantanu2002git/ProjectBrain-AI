import { embeddingService } from './embedding.service.js';
import { githubService } from './github.service.js';
import { graphService } from './graph.service.js';
import { jiraService } from './jira.service.js';
import { parserService } from './parser.service.js';
import type { Project } from '../types/domain.js';

type ContextBuildStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

interface ContextBuildStep {
  id: string;
  label: string;
  status: Exclude<ContextBuildStatus, 'idle'>;
  detail?: string;
}

interface ContextBuild {
  projectId: string;
  status: ContextBuildStatus;
  message: string;
  startedAt?: string;
  completedAt?: string;
  steps: ContextBuildStep[];
}

const buildStatuses = new Map<string, ContextBuild>();

const createSteps = (project: Project): ContextBuildStep[] => {
  const steps: ContextBuildStep[] = [];

  if (project.githubRepositoryUrl) {
    steps.push({ id: 'clone-repository', label: 'Clone repository', status: 'queued' });
    steps.push({ id: 'parse-repository', label: 'Parse source code', status: 'queued' });
  }

  if (project.jiraProjectKey) {
    steps.push({ id: 'import-jira', label: 'Import Jira issues', status: 'queued' });
  }

  steps.push({ id: 'build-graph', label: 'Build knowledge graph', status: 'queued' });
  steps.push({ id: 'generate-embeddings', label: 'Generate embeddings', status: 'queued' });

  return steps;
};

const updateBuild = (projectId: string, update: Partial<ContextBuild>) => {
  const current = buildStatuses.get(projectId);

  if (!current) {
    return;
  }

  buildStatuses.set(projectId, {
    ...current,
    ...update
  });
};

const updateStep = (
  projectId: string,
  stepId: string,
  status: Exclude<ContextBuildStatus, 'idle'>,
  detail?: string
) => {
  const current = buildStatuses.get(projectId);

  if (!current) {
    return;
  }

  updateBuild(projectId, {
    steps: current.steps.map((step) => (step.id === stepId ? { ...step, status, detail } : step))
  });
};

const summarizeStepResult = (result: unknown) => {
  if (!result || typeof result !== 'object') {
    return undefined;
  }

  return JSON.stringify(result);
};

const runStep = async (projectId: string, stepId: string, label: string, runner: () => Promise<unknown>) => {
  updateBuild(projectId, {
    status: 'running',
    message: `Running ${label}.`
  });
  updateStep(projectId, stepId, 'running');

  const result = await runner();

  updateStep(projectId, stepId, 'completed', summarizeStepResult(result));
};

const runBuildJob = async (project: Project) => {
  try {
    if (project.githubRepositoryUrl) {
      await runStep(project.id, 'clone-repository', 'Clone repository', () =>
        githubService.cloneRepository(project.githubRepositoryUrl as string, project.id)
      );
      await runStep(project.id, 'parse-repository', 'Parse source code', () => parserService.parseRepository(project.id));
    }

    if (project.jiraProjectKey) {
      await runStep(project.id, 'import-jira', 'Import Jira issues', () =>
        jiraService.importIssues(project.id, project.jiraProjectKey as string)
      );
    }

    await runStep(project.id, 'build-graph', 'Build knowledge graph', () => graphService.buildKnowledgeGraph(project.id));
    await runStep(project.id, 'generate-embeddings', 'Generate embeddings', () =>
      embeddingService.generateEmbeddings(project.id)
    );

    updateBuild(project.id, {
      status: 'completed',
      message: 'Context generation completed.',
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Context generation failed.';
    const current = buildStatuses.get(project.id);
    const runningStep = current?.steps.find((step) => step.status === 'running');

    if (runningStep) {
      updateStep(project.id, runningStep.id, 'failed', message);
    }

    updateBuild(project.id, {
      status: 'failed',
      message,
      completedAt: new Date().toISOString()
    });
  }
};

export const contextBuildService = {
  async build(project: Project) {
    const build: ContextBuild = {
      projectId: project.id,
      status: 'queued',
      message: 'Context generation has been queued.',
      startedAt: new Date().toISOString(),
      steps: createSteps(project)
    };

    buildStatuses.set(project.id, build);
    void runBuildJob(project);

    return build;
  },

  getStatus(projectId: string): ContextBuild {
    return {
      projectId,
      status: 'idle',
      message: 'No context generation has been started for this project.',
      steps: [],
      ...buildStatuses.get(projectId)
    };
  }
};
