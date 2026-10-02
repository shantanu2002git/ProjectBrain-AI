export type Persona = 'developer' | 'qa' | 'product' | 'sales';

export interface Project {
  id: string;
  name: string;
  githubRepositoryUrl: string | null;
  jiraProjectKey: string | null;
  createdAt: Date | string;
}

export interface FeatureDna {
  featureId: string;
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

export interface Citation {
  sourceType: 'file' | 'jira' | 'pull_request' | 'commit' | 'doc';
  sourceId: string;
  label: string;
}
