import type { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';

interface JiraIssue {
  key: string;
  fields: {
    summary?: string;
    issuetype?: {
      name?: string;
    };
    status?: {
      name?: string;
    };
    description?: unknown;
  };
}

const ensureJiraConfig = () => {
  if (!env.JIRA_BASE_URL || !env.JIRA_EMAIL || !env.JIRA_API_TOKEN) {
    throw new Error('Jira project key was provided, but JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN are not configured.');
  }
};

const textFromJiraDescription = (description: unknown): string | undefined => {
  if (!description || typeof description !== 'object') {
    return undefined;
  }

  const content = (description as { content?: unknown[] }).content;

  if (!Array.isArray(content)) {
    return undefined;
  }

  return JSON.stringify(content);
};

export const jiraService = {
  async importIssues(projectId: string, projectKey: string) {
    ensureJiraConfig();

    const searchUrl = new URL('/rest/api/3/search/jql', env.JIRA_BASE_URL);
    searchUrl.searchParams.set('jql', `project = ${projectKey} ORDER BY updated DESC`);
    searchUrl.searchParams.set('maxResults', '100');
    searchUrl.searchParams.set('fields', 'summary,issuetype,status,description');

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Jira import failed with ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as { issues?: JiraIssue[] };
    const issues = payload.issues ?? [];

    for (const issue of issues) {
      const raw = issue as unknown as Prisma.InputJsonValue;

      await prisma.jiraTicket.upsert({
        where: {
          projectId_ticketKey: {
            projectId,
            ticketKey: issue.key
          }
        },
        update: {
          issueType: issue.fields.issuetype?.name ?? 'Unknown',
          title: issue.fields.summary ?? issue.key,
          status: issue.fields.status?.name,
          raw,
          businessRules: textFromJiraDescription(issue.fields.description)
        },
        create: {
          projectId,
          ticketKey: issue.key,
          issueType: issue.fields.issuetype?.name ?? 'Unknown',
          title: issue.fields.summary ?? issue.key,
          status: issue.fields.status?.name,
          raw,
          businessRules: textFromJiraDescription(issue.fields.description)
        }
      });
    }

    return {
      projectKey,
      imported: issues.length,
      status: 'completed' as const
    };
  },

  async testConnection() {
    try {
      ensureJiraConfig();
      const url = new URL('/rest/api/3/myself', env.JIRA_BASE_URL);
      const response = await fetch(url, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}`,
          Accept: 'application/json'
        }
      });
      if (!response.ok) {
        return { success: false, message: `Jira connection failed: ${response.statusText}` };
      }
      return { success: true, message: 'Connected to Jira successfully!' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Jira connection failed.' };
    }
  },

  async handleWebhook(payload: unknown) {
    return {
      accepted: true,
      provider: 'jira' as const,
      payload
    };
  }
};
