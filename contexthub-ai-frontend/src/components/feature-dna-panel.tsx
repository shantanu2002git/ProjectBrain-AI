'use client';

import { useState } from 'react';
import type { FeatureDna, ProjectContext } from '@/lib/api';

interface FeatureDnaPanelProps {
  context: ProjectContext | null;
  features: FeatureDna[];
}

export const FeatureDnaPanel = ({ context, features }: FeatureDnaPanelProps) => {
  const [selectedFeatureId, setSelectedFeatureId] = useState('');
  const selected = features.find((feature) => feature.featureId === selectedFeatureId) ?? features[0];
  const artifacts = context?.artifacts ?? [];
  const codeArtifacts = artifacts.filter((artifact) => ['class', 'function'].includes(artifact.kind)).slice(0, 12);

  return (
    <section id="feature-dna" className="scroll-mt-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-border p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{selected?.name ?? 'Feature DNA'}</h2>
            <span className="rounded-md border border-border px-2 py-1 text-sm">Risk {selected?.riskScore ?? 0}</span>
          </div>
          {features.length > 1 ? (
            <div className="mb-4 flex flex-wrap gap-2">
              {features.slice(0, 8).map((feature) => (
                <button
                  key={feature.featureId}
                  className={`rounded-md border border-border px-2 py-1 text-sm ${
                    selected?.featureId === feature.featureId ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}
                  type="button"
                  onClick={() => setSelectedFeatureId(feature.featureId)}
                >
                  {feature.name}
                </button>
              ))}
            </div>
          ) : null}
          {selected ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium">Business Summary</h3>
                <p className="text-sm text-muted-foreground">{selected.businessSummary}</p>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">Technical Summary</h3>
                <p className="text-sm text-muted-foreground">{selected.technicalSummary}</p>
              </div>
              <ListBlock title="Business Rules" items={selected.businessRules} />
              <ListBlock title="QA Scenarios" items={selected.qaScenarios} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Build context to generate Feature DNA.</p>
          )}
        </div>
        <div className="space-y-4">
          <div className="rounded-lg border border-border p-5">
            <h3 className="mb-3 text-sm font-medium">Evidence Map</h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>APIs: {selected?.apis.length ? selected.apis.join(', ') : 'None linked'}</div>
              <div>Data: {selected?.databaseTables.length ? selected.databaseTables.join(', ') : 'None linked'}</div>
              <div>Dependencies: {selected?.dependencies.length ? selected.dependencies.join(', ') : 'None linked'}</div>
              <div>Jira: {selected?.relatedJiraIssues.length ? selected.relatedJiraIssues.join(', ') : 'None linked'}</div>
            </div>
          </div>
          <div className="rounded-lg border border-border p-5">
            <h3 className="mb-3 text-sm font-medium">Extracted Code</h3>
            <div className="max-h-64 space-y-2 overflow-auto text-sm text-muted-foreground">
              {codeArtifacts.length > 0 ? (
                codeArtifacts.map((artifact) => (
                  <div key={artifact.id}>
                    {artifact.kind}: <span className="text-foreground">{artifact.name}</span> in {artifact.filePath}
                  </div>
                ))
              ) : (
                <div>No classes or functions extracted yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ListBlock = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <h3 className="mb-2 text-sm font-medium">{title}</h3>
    <div className="space-y-1 text-sm text-muted-foreground">
      {items.length > 0 ? items.slice(0, 6).map((item) => <div key={item}>{item}</div>) : <div>None generated yet.</div>}
    </div>
  </div>
);
