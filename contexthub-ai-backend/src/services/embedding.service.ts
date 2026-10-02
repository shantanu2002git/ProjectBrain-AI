import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { embeddingProvider, vectorLiteral } from '../providers/embedding.provider.js';

const maxChunkLength = 2500;
const maxChunksPerFile = 4;

const chunkContent = (content: string) => {
  const chunks: string[] = [];
  const normalized = content.replace(/\s+$/g, '');

  for (let index = 0; index < normalized.length && chunks.length < maxChunksPerFile; index += maxChunkLength) {
    const chunk = normalized.slice(index, index + maxChunkLength).trim();

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
};

interface StoredChunk {
  id: string;
  content: string;
}

const embedStoredChunks = async (chunks: StoredChunk[]) => {
  let vectorCount = 0;
  let skipped = false;

  if (!embeddingProvider.isAvailable()) {
    return { vectorCount, skipped };
  }

  for (let index = 0; index < chunks.length; index += env.OPENAI_EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(index, index + env.OPENAI_EMBEDDING_BATCH_SIZE);

    try {
      const vectors = await embeddingProvider.embedTexts(batch.map((chunk) => chunk.content));

      for (const [vectorIndex, vector] of vectors.entries()) {
        const chunk = batch[vectorIndex];

        if (!chunk || !vector) {
          continue;
        }

        await prisma.$executeRawUnsafe(
          'UPDATE embeddings SET embedding = $1::vector WHERE id = $2::uuid',
          vectorLiteral(vector),
          chunk.id
        );
        vectorCount += 1;
      }
    } catch (error) {
      skipped = true;
      console.warn('Embedding vector generation skipped for remaining chunks.', error);
      break;
    }
  }

  return { vectorCount, skipped };
};

export const embeddingService = {
  async generateEmbeddings(projectId: string) {
    await prisma.embedding.deleteMany({ where: { projectId } });

    const files = await prisma.file.findMany({
      where: {
        repository: {
          projectId
        }
      },
      include: {
        repository: true
      },
      orderBy: {
        path: 'asc'
      }
    });

    let chunkCount = 0;
    let vectorCount = 0;
    let vectorGenerationSkipped = false;
    const storedChunks: StoredChunk[] = [];

    for (const file of files) {
      if (!file.repository.clonedPath) {
        continue;
      }

      const filePath = path.join(file.repository.clonedPath, file.path);
      const content = await readFile(filePath, 'utf8');
      const chunks = chunkContent(content);

      if (chunks.length === 0) {
        continue;
      }

      for (const [index, chunk] of chunks.entries()) {
        const embedding = await prisma.embedding.create({
          data: {
            projectId,
            sourceType: 'file',
            sourceId: file.id,
            content: chunk,
            metadata: {
              filePath: file.path,
              language: file.language,
              chunkIndex: index,
              embeddingModel: embeddingProvider.isAvailable() ? 'openai' : null
            }
          }
        });

        storedChunks.push({
          id: embedding.id,
          content: chunk
        });
      }

      chunkCount += chunks.length;
    }

    const jiraTickets = await prisma.jiraTicket.findMany({
      where: { projectId }
    });

    for (const ticket of jiraTickets) {
      const content = [
        `Jira ${ticket.ticketKey}: ${ticket.title}`,
        `Type: ${ticket.issueType}`,
        ticket.status ? `Status: ${ticket.status}` : undefined,
        ticket.acceptanceCriteria ? `Acceptance Criteria: ${ticket.acceptanceCriteria}` : undefined,
        ticket.businessRules ? `Business Rules: ${ticket.businessRules}` : undefined
      ]
        .filter(Boolean)
        .join('\n');

      const chunks = chunkContent(content);

      if (chunks.length === 0) {
        continue;
      }

      for (const [index, chunk] of chunks.entries()) {
        const embedding = await prisma.embedding.create({
          data: {
            projectId,
            sourceType: 'jira',
            sourceId: ticket.id,
            content: chunk,
            metadata: {
              ticketKey: ticket.ticketKey,
              chunkIndex: index,
              embeddingModel: embeddingProvider.isAvailable() ? 'openai' : null
            }
          }
        });

        storedChunks.push({
          id: embedding.id,
          content: chunk
        });
      }

      chunkCount += chunks.length;
    }

    const vectorResult = await embedStoredChunks(storedChunks);
    vectorCount = vectorResult.vectorCount;
    vectorGenerationSkipped = vectorResult.skipped;

    return {
      projectId,
      chunks: chunkCount,
      vectors: vectorCount,
      vectorGenerationSkipped,
      status: 'completed' as const
    };
  }
};
