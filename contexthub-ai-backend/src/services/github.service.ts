import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { prisma } from '../config/database.js';

const execFileAsync = promisify(execFile);

export const githubService = {
  async cloneRepository(repositoryUrl: string, projectId: string) {
    const clonePath = path.join(process.cwd(), 'tmp', 'repos', projectId);

    await prisma.embedding.deleteMany({ where: { projectId } });
    await prisma.relationship.deleteMany({ where: { projectId } });
    await prisma.repository.deleteMany({ where: { projectId } });
    await rm(clonePath, { recursive: true, force: true });

    await execFileAsync('git', ['clone', '--depth', '1', repositoryUrl, clonePath], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 10
    });

    const { stdout: branchStdout } = await execFileAsync('git', ['-C', clonePath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
      timeout: 10_000
    });

    const repository = await prisma.repository.create({
      data: {
        projectId,
        remoteUrl: repositoryUrl,
        defaultBranch: branchStdout.trim(),
        clonedPath: clonePath
      }
    });

    return {
      projectId,
      repositoryUrl,
      repositoryId: repository.id,
      clonePath,
      defaultBranch: repository.defaultBranch,
      status: 'completed' as const
    };
  },

  async handleWebhook(payload: unknown) {
    return {
      accepted: true,
      provider: 'github' as const,
      payload
    };
  }
};
