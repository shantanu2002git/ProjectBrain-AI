import { prisma } from '../config/database.js';

const artifactKinds = ['class', 'function', 'api', 'import', 'dependency', 'database_entity'] as const;

export const contextReadService = {
  async getProjectContext(projectId: string) {
    const [repositories, files, jiraTickets, relationships, embeddings, artifacts] = await Promise.all([
      prisma.repository.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.file.findMany({
        where: { repository: { projectId } },
        orderBy: { path: 'asc' },
        take: 100
      }),
      prisma.jiraTicket.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.relationship.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 250
      }),
      prisma.embedding.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 50
      }),
      prisma.artifact.findMany({
        where: { file: { repository: { projectId } } },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
        take: 250
      })
    ]);

    const artifactCounts = Object.fromEntries(
      await Promise.all(
        artifactKinds.map(async (kind) => [
          kind,
          await prisma.artifact.count({
            where: {
              kind,
              file: {
                repository: {
                  projectId
                }
              }
            }
          })
        ])
      )
    ) as Record<(typeof artifactKinds)[number], number>;

    const fileNodes = files.slice(0, 30).map((file, index) => ({
      id: file.id,
      label: file.path,
      type: 'file',
      position: {
        x: 320,
        y: index * 80
      }
    }));

    const artifactNodes = artifacts.slice(0, 30).map((artifact, index) => ({
      id: artifact.id,
      label: `${artifact.kind}: ${artifact.name}`,
      type: artifact.kind,
      position: {
        x: 0,
        y: index * 80
      }
    }));

    const graphEdges = relationships.slice(0, 60).map((relationship) => ({
      id: relationship.id,
      source: relationship.sourceId,
      target: relationship.targetId,
      label: relationship.relationshipType
    }));

    return {
      summary: {
        repositories: repositories.length,
        files: await prisma.file.count({ where: { repository: { projectId } } }),
        artifacts: await prisma.artifact.count({ where: { file: { repository: { projectId } } } }),
        jiraTickets: await prisma.jiraTicket.count({ where: { projectId } }),
        relationships: await prisma.relationship.count({ where: { projectId } }),
        embeddingChunks: await prisma.embedding.count({ where: { projectId } }),
        apis: artifactCounts.api,
        databaseEntities: artifactCounts.database_entity,
        dependencies: artifactCounts.dependency,
        functions: artifactCounts.function,
        classes: artifactCounts.class
      },
      repositories,
      files,
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        name: artifact.name,
        filePath: artifact.file.path,
        startLine: artifact.startLine,
        endLine: artifact.endLine,
        metadata: artifact.metadata
      })),
      jiraTickets,
      embeddings: embeddings.map((embedding) => ({
        id: embedding.id,
        sourceType: embedding.sourceType,
        sourceId: embedding.sourceId,
        preview: embedding.content.slice(0, 240),
        metadata: embedding.metadata
      })),
      graph: {
        nodes: [...artifactNodes, ...fileNodes],
        edges: graphEdges
      }
    };
  },

  async getArtifacts(projectId: string) {
    return prisma.artifact.findMany({
      where: { file: { repository: { projectId } } },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
      take: 500
    });
  },

  async getFiles(projectId: string) {
    return prisma.file.findMany({
      where: { repository: { projectId } },
      orderBy: { path: 'asc' },
      take: 500
    });
  },

  async getGraph(projectId: string) {
    const context = await this.getProjectContext(projectId);
    return context.graph;
  }
};
