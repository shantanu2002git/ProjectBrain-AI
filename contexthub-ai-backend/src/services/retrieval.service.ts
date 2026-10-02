import { prisma } from '../config/database.js';
import { embeddingProvider, vectorLiteral } from '../providers/embedding.provider.js';
import type { Citation } from '../types/domain.js';

interface RetrievedBlock {
  text: string;
  citation: Citation;
  score: number;
}

interface VectorSearchRow {
  id: string;
  sourceId: string;
  sourceType: string;
  content: string;
  metadata: unknown;
  similarity: number;
}

interface VectorCountRow {
  count: bigint;
}

const stopWords = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'if',
  'in',
  'on',
  'of',
  'to',
  'for',
  'with',
  'what',
  'how',
  'does',
  'do',
  'is',
  'are',
  'change',
  'work',
  'works'
]);

const termsFrom = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9_./-]+/g)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !stopWords.has(term));

const scoreText = (text: string, terms: string[]) => {
  const lower = text.toLowerCase();
  return terms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0);
};

const topBlocks = (blocks: RetrievedBlock[], limit = 10) => {
  const matches = blocks
    .filter((block) => block.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  if (matches.length > 0) {
    return matches;
  }

  return blocks.slice(0, limit);
};

const vectorSearch = async (projectId: string, question: string, limit = 10): Promise<RetrievedBlock[]> => {
  if (!embeddingProvider.isAvailable()) {
    return [];
  }

  try {
    const [vectorCountRow] = await prisma.$queryRawUnsafe<VectorCountRow[]>(
      'SELECT COUNT(*)::bigint AS count FROM embeddings WHERE project_id = $1::uuid AND embedding IS NOT NULL',
      projectId
    );
    const vectorCount = Number(vectorCountRow?.count ?? 0);

    if (vectorCount === 0) {
      return [];
    }

    const questionEmbedding = await embeddingProvider.embedText(question, { maxRetries: 0 });

    if (!questionEmbedding) {
      return [];
    }

    const rows = await prisma.$queryRawUnsafe<VectorSearchRow[]>(
      `SELECT
        id,
        source_id AS "sourceId",
        source_type AS "sourceType",
        content,
        metadata,
        1 - (embedding <=> $1::vector) AS similarity
      FROM embeddings
      WHERE project_id = $2::uuid
        AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3`,
      vectorLiteral(questionEmbedding),
      projectId,
      limit
    );

    return rows.map((row) => {
      const metadata = row.metadata as { filePath?: string; chunkIndex?: number } | null;
      const label = `${metadata?.filePath ?? row.sourceType}${metadata?.chunkIndex !== undefined ? ` chunk ${metadata.chunkIndex}` : ''}`;

      return {
        text: [`Vector match`, `File: ${metadata?.filePath ?? row.sourceType}`, `Similarity: ${row.similarity.toFixed(3)}`, row.content]
          .filter(Boolean)
          .join('\n'),
        score: row.similarity,
        citation: {
          sourceType: 'file',
          sourceId: row.sourceId,
          label
        }
      };
    });
  } catch (error) {
    console.warn('Vector retrieval failed, falling back to lexical retrieval.', error);
    return [];
  }
};

export const retrievalService = {
  async buildContext(projectId: string, question: string): Promise<{ context: string; citations: Citation[] }> {
    const terms = termsFrom(question);
    const vectorBlocks = await vectorSearch(projectId, question);

    const [artifacts, jiraTickets, embeddings] = await Promise.all([
      prisma.artifact.findMany({
        where: { file: { repository: { projectId } } },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
        take: 500
      }),
      prisma.jiraTicket.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 100
      }),
      prisma.embedding.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 300
      })
    ]);

    const artifactBlocks: RetrievedBlock[] = artifacts.map((artifact) => {
      const text = [
        `Artifact ${artifact.kind}: ${artifact.name}`,
        `File: ${artifact.file.path}`,
        artifact.startLine ? `Line: ${artifact.startLine}` : undefined,
        `Metadata: ${JSON.stringify(artifact.metadata)}`
      ]
        .filter(Boolean)
        .join('\n');

      return {
        text,
        score: scoreText(text, terms),
        citation: {
          sourceType: 'file',
          sourceId: artifact.fileId,
          label: `${artifact.file.path}${artifact.startLine ? `:${artifact.startLine}` : ''}`
        }
      };
    });

    const jiraBlocks: RetrievedBlock[] = jiraTickets.map((ticket) => {
      const text = [
        `Jira ${ticket.ticketKey}: ${ticket.title}`,
        `Type: ${ticket.issueType}`,
        ticket.status ? `Status: ${ticket.status}` : undefined,
        ticket.acceptanceCriteria ? `Acceptance Criteria: ${ticket.acceptanceCriteria}` : undefined,
        ticket.businessRules ? `Business Rules: ${ticket.businessRules}` : undefined
      ]
        .filter(Boolean)
        .join('\n');

      return {
        text,
        score: scoreText(text, terms),
        citation: {
          sourceType: 'jira',
          sourceId: ticket.id,
          label: ticket.ticketKey
        }
      };
    });

    const embeddingBlocks: RetrievedBlock[] = embeddings.map((embedding) => {
      const metadata = embedding.metadata as { filePath?: string; chunkIndex?: number } | null;
      const text = [`Context chunk`, metadata?.filePath ? `File: ${metadata.filePath}` : undefined, embedding.content]
        .filter(Boolean)
        .join('\n');

      return {
        text,
        score: scoreText(text, terms),
        citation: {
          sourceType: 'file',
          sourceId: embedding.sourceId,
          label: `${metadata?.filePath ?? embedding.sourceType}${metadata?.chunkIndex !== undefined ? ` chunk ${metadata.chunkIndex}` : ''}`
        }
      };
    });

    const lexicalBlocks = topBlocks([...artifactBlocks, ...jiraBlocks, ...(vectorBlocks.length === 0 ? embeddingBlocks : [])]);
    const selected = [...vectorBlocks, ...lexicalBlocks].slice(0, 15);

    if (selected.length === 0) {
      return {
        context: 'No indexed context was found for this project.',
        citations: []
      };
    }

    return {
      context: selected.map((block, index) => `Evidence ${index + 1}\n${block.text}`).join('\n\n---\n\n'),
      citations: selected.map((block) => block.citation)
    };
  }
};
