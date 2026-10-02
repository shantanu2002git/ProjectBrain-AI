import { randomUUID } from 'node:crypto';
import { prisma } from '../config/database.js';

export const graphService = {
  async buildKnowledgeGraph(projectId: string) {
    await prisma.relationship.deleteMany({ where: { projectId } });

    const artifacts = await prisma.artifact.findMany({
      where: {
        file: {
          repository: {
            projectId
          }
        }
      },
      include: {
        file: true
      }
    });

    if (artifacts.length > 0) {
      await prisma.relationship.createMany({
        data: artifacts.map((artifact) => ({
          id: randomUUID(),
          projectId,
          sourceType: 'artifact',
          sourceId: artifact.id,
          targetType: 'file',
          targetId: artifact.fileId,
          relationshipType: 'DEFINED_IN',
          confidence: 1,
          metadata: {
            artifactKind: artifact.kind,
            artifactName: artifact.name,
            filePath: artifact.file.path
          }
        }))
      });
    }

    const relationships = await prisma.relationship.count({
      where: { projectId }
    });

    return {
      projectId,
      nodes: artifacts.length,
      relationships,
      status: 'completed' as const
    };
  }
};
