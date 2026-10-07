const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export interface CreateProjectInput {
  name: string;
  githubRepositoryUrl?: string;
  jiraProjectKey?: string;
}

export interface Project {
  id: string;
  name: string;
  githubRepositoryUrl: string | null;
  jiraProjectKey: string | null;
  createdAt: string;
}

export type ContextBuildStatus = 'idle' | 'queued' | 'running' | 'completed' | 'failed';

export interface ContextBuildStep {
  id: string;
  label: string;
  status: Exclude<ContextBuildStatus, 'idle'>;
}

export interface ContextBuild {
  projectId: string;
  status: ContextBuildStatus;
  message: string;
  startedAt?: string;
  completedAt?: string;
  steps: ContextBuildStep[];
}

export interface ProjectContext {
  summary: {
    repositories: number;
    files: number;
    artifacts: number;
    jiraTickets: number;
    relationships: number;
    embeddingChunks: number;
    apis: number;
    databaseEntities: number;
    dependencies: number;
    functions: number;
    classes: number;
  };
  repositories: Array<{
    id: string;
    remoteUrl: string;
    defaultBranch: string | null;
    clonedPath: string | null;
  }>;
  files: Array<{
    id: string;
    path: string;
    language: string | null;
    contentHash: string | null;
  }>;
  artifacts: Array<{
    id: string;
    kind: string;
    name: string;
    filePath: string;
    startLine: number | null;
    endLine: number | null;
    metadata: unknown;
  }>;
  jiraTickets: Array<{
    id: string;
    ticketKey: string;
    issueType: string;
    title: string;
    status: string | null;
  }>;
  embeddings: Array<{
    id: string;
    sourceType: string;
    sourceId: string;
    preview: string;
    metadata: unknown;
  }>;
  graph: {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      position: {
        x: number;
        y: number;
      };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label: string;
    }>;
  };
}

export interface ChatAnswer {
  answer: string;
  citations: Array<{
    sourceType: string;
    sourceId: string;
    label: string;
  }>;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  projectId: string;
  role: 'user' | 'assistant';
  content: string;
  persona: string | null;
  citations: ChatAnswer['citations'];
  createdAt: string;
}

export interface ChatSession {
  id: string;
  projectId: string;
  title: string;
  persona: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ImpactAnalysis {
  projectId: string;
  filesImpacted: string[];
  apisImpacted: Array<{
    id: string;
    kind: string;
    name: string;
    filePath: string;
    startLine: number | null;
  }>;
  databaseEntitiesImpacted: Array<{
    id: string;
    kind: string;
    name: string;
    filePath: string;
    startLine: number | null;
  }>;
  dependenciesImpacted: Array<{
    id: string;
    kind: string;
    name: string;
    filePath: string;
    startLine: number | null;
  }>;
  testsImpacted: string[];
  relatedJiraStories: Array<{
    key: string;
    title: string;
    status: string | null;
  }>;
  risk: {
    level: 'low' | 'medium' | 'high';
    score: number;
    assessment: string;
  };
  evidence: Array<{
    id: string;
    kind: string;
    name: string;
    filePath: string;
    startLine: number | null;
  }>;
}

export interface FeatureDna {
  featureId: string;
  name: string;
  businessSummary: string;
  technicalSummary: string;
  businessRules: string[];
  apis: string[];
  databaseTables: string[];
  dependencies: string[];
  relatedJiraIssues: string[];
  relatedPullRequests: string[];
  owners: string[];
  qaScenarios: string[];
  riskScore: number;
  recentChanges: string[];
}

export const api = {
  async listProjects(): Promise<{ data: Project[] }> {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to list projects');
    }

    return response.json();
  },

  async createProject(input: CreateProjectInput) {
    const response = await fetch(`${API_BASE_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    return response.json();
  },

  async buildContext(projectId: string) {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/build-context`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error('Failed to build context');
    }

    return response.json();
  },

  async getBuildContextStatus(projectId: string): Promise<{ data: ContextBuild }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/build-context/status`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get context build status');
    }

    return response.json();
  },

  async getProjectContext(projectId: string): Promise<{ data: ProjectContext }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/context`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get project context');
    }

    return response.json();
  },

  async ask(input: { projectId: string; question: string; persona: string }): Promise<{ data: ChatAnswer }> {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Failed to ask question');
    }

    return response.json();
  },

  async listChatSessions(projectId: string): Promise<{ data: ChatSession[] }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chat-sessions`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to list chat sessions');
    }

    return response.json();
  },

  async createChatSession(projectId: string, input: { title?: string; persona: string }): Promise<{ data: ChatSession }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chat-sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Failed to create chat session');
    }

    return response.json();
  },

  async addChatMessage(
    projectId: string,
    input: { sessionId?: string; question: string; persona: string }
  ): Promise<{ data: ChatSession }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/chat-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Failed to add chat message');
    }

    return response.json();
  },

  async analyzeImpact(input: { projectId: string; changedFiles: string[] }): Promise<{ data: ImpactAnalysis }> {
    const response = await fetch(`${API_BASE_URL}/api/impact-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error('Failed to analyze impact');
    }

    return response.json();
  },

  async getFeatureDna(projectId: string): Promise<{ data: FeatureDna[] }> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/feature-dna`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-store'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get Feature DNA');
    }

    return response.json();
  },

  async testJiraConnection(): Promise<{ data: { success: boolean; message: string } }> {
    const response = await fetch(`${API_BASE_URL}/api/jira/test-connection`);
    if (!response.ok) {
      throw new Error('Failed to test Jira connection');
    }
    return response.json();
  }
};
