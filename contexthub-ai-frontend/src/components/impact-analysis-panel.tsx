'use client';

import { AlertTriangle, LoaderCircle, SearchCode } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, type ImpactAnalysis } from '@/lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ImpactAnalysisPanelProps {
  projectId: string;
}

export const ImpactAnalysisPanel = ({ projectId }: ImpactAnalysisPanelProps) => {
  const [analysis, setAnalysis] = useState<ImpactAnalysis | null>(null);
  const [message, setMessage] = useState('Enter changed file paths to analyze impact.');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectId) {
      setMessage('Create a project and build context before impact analysis.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const changedFiles = String(formData.get('changedFiles') || '')
      .split(',')
      .map((file) => file.trim())
      .filter(Boolean);

    if (changedFiles.length === 0) {
      return;
    }

    setIsLoading(true);
    setMessage('Analyzing indexed relationships');

    try {
      const result = await api.analyzeImpact({ projectId, changedFiles });
      setAnalysis(result.data);
      setMessage('');
    } catch {
      setMessage('Unable to analyze impact.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="px-4 py-5 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="text-lg font-semibold">Change Impact Analysis</h2>
            <p className="text-sm text-muted-foreground">Trace file changes to APIs, data, tests, Jira, and risk.</p>
          </div>
          <AlertTriangle className="h-5 w-5 text-accent" />
        </div>
        <form onSubmit={submit} className="flex flex-col gap-2 border-b border-border p-4 md:flex-row">
          <Input name="changedFiles" placeholder="src/services/payment.service.ts, prisma/schema.prisma" />
          <Button type="submit" disabled={isLoading || !projectId}>
            {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SearchCode className="h-4 w-4" />}
            Analyze
          </Button>
        </form>
        <div className="p-4 text-sm">
          {message ? <div className="text-muted-foreground">{message}</div> : null}
          {analysis ? (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <div className="rounded-lg border border-border p-4">
                <div className="text-sm text-muted-foreground">Risk</div>
                <div className="mt-1 text-2xl font-semibold capitalize">{analysis.risk.level}</div>
                <div className="mt-2 text-muted-foreground">{analysis.risk.assessment}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <SummaryList title="Files" items={analysis.filesImpacted} />
                <SummaryList title="APIs" items={analysis.apisImpacted.map((item) => `${item.name} (${item.filePath})`)} />
                <SummaryList title="Tests" items={analysis.testsImpacted} />
                <SummaryList
                  title="Jira"
                  items={analysis.relatedJiraStories.map((ticket) => `${ticket.key}: ${ticket.title}`)}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
};

const SummaryList = ({ title, items }: { title: string; items: string[] }) => (
  <div className="rounded-lg border border-border p-4">
    <div className="mb-2 font-medium">{title}</div>
    <div className="space-y-1 text-muted-foreground">
      {items.length > 0 ? items.slice(0, 8).map((item) => <div key={item}>{item}</div>) : <div>None found</div>}
    </div>
  </div>
);
