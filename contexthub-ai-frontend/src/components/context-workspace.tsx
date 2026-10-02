'use client';

import { useEffect, useState } from 'react';
import { api, type FeatureDna, type Project, type ProjectContext } from '@/lib/api';
import { AiChatPanel } from './ai-chat-panel';
import { ArchitecturePanel } from './architecture-panel';
import { ContextDashboard } from './context-dashboard';
import { FeatureDnaPanel } from './feature-dna-panel';
import { ImpactAnalysisPanel } from './impact-analysis-panel';
import { ProjectOnboarding } from './project-onboarding';

export const ContextWorkspace = () => {
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [features, setFeatures] = useState<FeatureDna[]>([]);
  const [isContextLoading, setIsContextLoading] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      const result = await api.listProjects();
      setProjects(result.data);

      if (result.data.length > 0) {
        const latestProject = result.data[0];
        setProjectId(latestProject.id);
        await loadContext(latestProject.id);
      }
    };

    loadProjects().catch(() => undefined);
  }, []);

  const loadContext = async (nextProjectId: string) => {
    setIsContextLoading(true);

    try {
      const [contextResult, featureResult] = await Promise.all([
        api.getProjectContext(nextProjectId),
        api.getFeatureDna(nextProjectId)
      ]);
      setContext(contextResult.data);
      setFeatures(featureResult.data);
    } finally {
      setIsContextLoading(false);
    }
  };

  const selectProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setContext(null);
    setFeatures([]);
    api.listProjects().then((result) => setProjects(result.data)).catch(() => undefined);
  };

  return (
    <>
      {projects.length > 0 ? (
        <section className="border-b border-border px-4 py-3 sm:px-6 lg:px-8">
          <label className="flex flex-col gap-2 text-sm md:w-96">
            <span className="text-muted-foreground">Active project</span>
            <select
              className="h-9 rounded-md border border-border bg-background px-3"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                void loadContext(event.target.value);
              }}
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}
      <ProjectOnboarding onProjectSelected={selectProject} onContextBuilt={loadContext} />
      <ContextDashboard context={context} isLoading={isContextLoading} />
      <ArchitecturePanel context={context} />
      <FeatureDnaPanel context={context} features={features} />
      <AiChatPanel projectId={projectId} />
      <ImpactAnalysisPanel projectId={projectId} />
      {projectId ? (
        <div className="px-4 pb-6 text-xs text-muted-foreground sm:px-6 lg:px-8">Active project: {projectId}</div>
      ) : null}
    </>
  );
};
