import { prisma } from '../config/database.js';

const testPathPattern = /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[tj]sx?$/i;

const normalize = (value: string) => value.toLowerCase();

const intersects = (left: string, right: string) => {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
};

export const impactAnalysisService = {
  async analyze(input: { projectId: string; changedFiles: string[] }) {
    const files = await prisma.file.findMany({
      where: {
        repository: {
          projectId: input.projectId
        }
      },
      include: {
        artifacts: true
      }
    });

    const directlyImpactedFiles = files.filter((file) =>
      input.changedFiles.some((changedFile) => intersects(file.path, changedFile))
    );

    const impactedArtifacts = directlyImpactedFiles.flatMap((file) =>
      file.artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        name: artifact.name,
        filePath: file.path,
        startLine: artifact.startLine
      }))
    );

    const impactedApis = impactedArtifacts.filter((artifact) => artifact.kind === 'api');
    const impactedDatabaseEntities = impactedArtifacts.filter((artifact) => artifact.kind === 'database_entity');
    const impactedDependencies = impactedArtifacts.filter((artifact) => artifact.kind === 'dependency');
    const testsImpacted = files
      .filter((file) => testPathPattern.test(file.path))
      .filter((file) =>
        directlyImpactedFiles.some((impactedFile) => {
          const impactedStem = impactedFile.path.split('/').pop()?.split('.')[0] ?? impactedFile.path;
          return normalize(file.path).includes(normalize(impactedStem));
        })
      )
      .map((file) => file.path);

    const jiraTickets = await prisma.jiraTicket.findMany({
      where: {
        projectId: input.projectId
      },
      take: 100
    });

    const artifactNames = impactedArtifacts.map((artifact) => artifact.name);
    const relatedJiraStories = jiraTickets.filter((ticket) => {
      const text = [ticket.ticketKey, ticket.title, ticket.acceptanceCriteria, ticket.businessRules].filter(Boolean).join(' ');
      return artifactNames.some((name) => normalize(text).includes(normalize(name)));
    });

    const riskScore =
      directlyImpactedFiles.length * 1 +
      impactedApis.length * 3 +
      impactedDatabaseEntities.length * 3 +
      impactedDependencies.length * 2 +
      relatedJiraStories.length * 2 -
      testsImpacted.length;

    const riskLevel = riskScore >= 10 ? 'high' : riskScore >= 4 ? 'medium' : 'low';

    return {
      projectId: input.projectId,
      filesImpacted: directlyImpactedFiles.map((file) => file.path),
      apisImpacted: impactedApis,
      databaseEntitiesImpacted: impactedDatabaseEntities,
      dependenciesImpacted: impactedDependencies,
      testsImpacted,
      relatedJiraStories: relatedJiraStories.map((ticket) => ({
        key: ticket.ticketKey,
        title: ticket.title,
        status: ticket.status
      })),
      risk: {
        level: riskLevel,
        score: Math.max(0, riskScore),
        assessment:
          riskLevel === 'high'
            ? 'High risk: changed files touch APIs, data entities, dependencies, or Jira-linked behavior with limited test coverage evidence.'
            : riskLevel === 'medium'
              ? 'Medium risk: changed files touch meaningful implementation artifacts. Review related APIs and tests before release.'
              : 'Low risk: limited connected impact found in the indexed context.'
      },
      evidence: impactedArtifacts.slice(0, 25)
    };
  }
};
