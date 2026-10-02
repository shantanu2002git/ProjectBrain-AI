import { prisma } from '../config/database.js';

export interface FeatureDnaView {
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

const unique = (items: Array<string | null | undefined>) => [...new Set(items.filter(Boolean) as string[])];

const riskScoreFor = (input: { apis: string[]; databaseTables: string[]; dependencies: string[]; jiraIssues: string[] }) =>
  Math.min(100, input.apis.length * 8 + input.databaseTables.length * 10 + input.dependencies.length * 3 + input.jiraIssues.length * 5);

export const featureDnaService = {
  async getProjectFeatureDna(projectId: string): Promise<FeatureDnaView[]> {
    const [project, artifacts, jiraTickets, pullRequests] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.artifact.findMany({
        where: { file: { repository: { projectId } } },
        include: { file: true },
        take: 500
      }),
      prisma.jiraTicket.findMany({
        where: { projectId },
        take: 100
      }),
      prisma.pullRequest.findMany({
        where: { repository: { projectId } },
        take: 100
      })
    ]);

    const apis = unique(artifacts.filter((artifact) => artifact.kind === 'api').map((artifact) => artifact.name));
    const databaseTables = unique(
      artifacts.filter((artifact) => artifact.kind === 'database_entity').map((artifact) => artifact.name)
    );
    const dependencies = unique(
      artifacts.filter((artifact) => artifact.kind === 'dependency').map((artifact) => artifact.name)
    );
    const codeFiles = unique(artifacts.map((artifact) => artifact.file.path)).slice(0, 10);

    if (jiraTickets.length === 0) {
      return [
        {
          featureId: projectId,
          name: project?.name ?? 'Codebase Overview',
          businessSummary: 'No Jira issues are linked yet, so this Feature DNA is inferred from repository implementation evidence.',
          technicalSummary: `Indexed ${codeFiles.length} representative files with ${apis.length} APIs, ${databaseTables.length} data entities, and ${dependencies.length} dependencies.`,
          businessRules: [],
          apis,
          databaseTables,
          dependencies,
          relatedJiraIssues: [],
          relatedPullRequests: pullRequests.map((pullRequest) => pullRequest.title),
          owners: [],
          qaScenarios:
            apis.length > 0
              ? apis.map((api) => `Verify API behavior for ${api} with success, validation, and error-path coverage.`)
              : ['Add Jira acceptance criteria or tests to generate focused QA scenarios.'],
          riskScore: riskScoreFor({ apis, databaseTables, dependencies, jiraIssues: [] }),
          recentChanges: codeFiles
        }
      ];
    }

    return jiraTickets.slice(0, 12).map((ticket) => {
      const text = [ticket.title, ticket.businessRules, ticket.acceptanceCriteria].filter(Boolean).join(' ').toLowerCase();
      const matchingApis = apis.filter((api) => text.includes(api.toLowerCase()) || api.toLowerCase().includes(ticket.title.toLowerCase()));
      const matchingTables = databaseTables.filter((table) => text.includes(table.toLowerCase()));
      const selectedApis = matchingApis.length > 0 ? matchingApis : apis.slice(0, 5);
      const selectedTables = matchingTables.length > 0 ? matchingTables : databaseTables.slice(0, 5);

      return {
        featureId: ticket.id,
        name: ticket.title,
        businessSummary: `${ticket.issueType} ${ticket.ticketKey}${ticket.status ? ` is currently ${ticket.status}` : ''}.`,
        technicalSummary: `Related implementation evidence includes ${selectedApis.length} APIs, ${selectedTables.length} data entities, and ${dependencies.slice(0, 8).length} dependencies.`,
        businessRules: unique([ticket.businessRules, ticket.acceptanceCriteria]),
        apis: selectedApis,
        databaseTables: selectedTables,
        dependencies: dependencies.slice(0, 8),
        relatedJiraIssues: [ticket.ticketKey],
        relatedPullRequests: pullRequests.map((pullRequest) => pullRequest.title).slice(0, 8),
        owners: [],
        qaScenarios: [
          `Validate acceptance criteria for ${ticket.ticketKey}.`,
          ...selectedApis.slice(0, 3).map((api) => `Regression test API ${api}.`),
          ...selectedTables.slice(0, 2).map((table) => `Verify data persistence and migration impact for ${table}.`)
        ],
        riskScore: riskScoreFor({
          apis: selectedApis,
          databaseTables: selectedTables,
          dependencies: dependencies.slice(0, 8),
          jiraIssues: [ticket.ticketKey]
        }),
        recentChanges: codeFiles
      };
    });
  }
};
