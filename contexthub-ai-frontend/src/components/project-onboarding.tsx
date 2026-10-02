'use client';

import { CheckCircle2, Circle, LoaderCircle, Play, Plus, XCircle, Link2 } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { api, type ContextBuild } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

const initialBuild: ContextBuild = {
  projectId: '',
  status: 'idle',
  message: 'Ready',
  steps: []
};

interface ProjectOnboardingProps {
  onProjectSelected?: (projectId: string) => void;
  onContextBuilt?: (projectId: string) => void;
}

export const ProjectOnboarding = ({ onProjectSelected, onContextBuilt }: ProjectOnboardingProps) => {
  const [projectId, setProjectId] = useState('');
  const [status, setStatus] = useState('Ready');
  const [build, setBuild] = useState<ContextBuild>(initialBuild);
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [notification, setNotification] = useState('');
  const [isTestingJira, setIsTestingJira] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const testJiraConnection = async () => {
    setIsTestingJira(true);
    setJiraTestResult(null);
    try {
      const result = await api.testJiraConnection();
      setJiraTestResult(result.data);
    } catch {
      setJiraTestResult({ success: false, message: 'Network error or backend unreachable.' });
    } finally {
      setIsTestingJira(false);
    }
  };

  useEffect(() => {
    if (!projectId || !isPolling) {
      return;
    }

    const pollStatus = async () => {
      try {
        const result = await api.getBuildContextStatus(projectId);
        setBuild(result.data);
        setStatus(result.data.message);

        if (result.data.status === 'completed') {
          setIsPolling(false);
          setNotification('Context generation completed.');
          onContextBuilt?.(projectId);
        }

        if (result.data.status === 'failed') {
          setIsPolling(false);
          setNotification('Context generation failed.');
        }
      } catch {
        setIsPolling(false);
        setStatus('Unable to read context generation status');
      }
    };

    pollStatus();
    const intervalId = window.setInterval(pollStatus, 1200);

    return () => window.clearInterval(intervalId);
  }, [isPolling, projectId]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsCreating(true);
    setStatus('Creating project');
    setNotification('');

    try {
      const result = await api.createProject({
        name: String(formData.get('name')),
        githubRepositoryUrl: String(formData.get('githubRepositoryUrl') || '') || undefined,
        jiraProjectKey: String(formData.get('jiraProjectKey') || '') || undefined
      });

      setProjectId(result.data.id);
      onProjectSelected?.(result.data.id);
      setBuild(initialBuild);
      setStatus('Project created');
    } catch {
      setStatus('Project creation failed');
    } finally {
      setIsCreating(false);
    }
  };

  const buildContext = async () => {
    if (!projectId) return;
    setStatus('Building context');
    setNotification('');
    setIsPolling(true);

    try {
      const result = await api.buildContext(projectId);
      setBuild(result.data);
      setStatus(result.data.message);
    } catch {
      setIsPolling(false);
      setStatus('Context generation failed to start');
    }
  };

  const isGenerating = build.status === 'queued' || build.status === 'running' || isPolling;

  return (
    <section className="border-b border-border bg-background px-4 py-5 sm:px-6 lg:px-8">
      <form onSubmit={onSubmit} className="grid gap-3 lg:grid-cols-[1fr_1.2fr_0.7fr_auto_auto]">
        <Input name="name" placeholder="Project name" required />
        <Input name="githubRepositoryUrl" placeholder="GitHub repository URL" type="url" />
        <div className="flex gap-2">
          <Input name="jiraProjectKey" placeholder="Jira key" className="flex-1" />
          <Button type="button" variant="secondary" size="icon" onClick={testJiraConnection} disabled={isTestingJira} title="Test Jira Connection">
            {isTestingJira ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          </Button>
        </div>
        <Button type="submit" disabled={isCreating || isGenerating}>
          {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {isCreating ? 'Creating' : 'Create'}
        </Button>
        <Button type="button" variant="outline" onClick={buildContext} disabled={!projectId || isGenerating}>
          {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {isGenerating ? 'Generating' : 'Build Context'}
        </Button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>{status}</span>
        {notification ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-foreground">
            {build.status === 'failed' ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            {notification}
          </span>
        ) : null}
        {jiraTestResult ? (
          <span className={`inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 ${jiraTestResult.success ? 'text-green-600' : 'text-red-600'}`}>
            {jiraTestResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            {jiraTestResult.message}
          </span>
        ) : null}
      </div>
      {build.steps.length > 0 ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {build.steps.map((step) => (
            <div key={step.id} className="flex min-h-12 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              {step.status === 'running' ? (
                <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
              ) : step.status === 'completed' ? (
                <CheckCircle2 className="h-4 w-4 text-primary" />
              ) : step.status === 'failed' ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Circle className="h-4 w-4 text-muted-foreground" />
              )}
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};
