import { Binary, Box, Code2, Database, GitPullRequest, Network, Package, Ticket } from 'lucide-react';
import type { ProjectContext } from '@/lib/api';

interface ContextDashboardProps {
  context: ProjectContext | null;
  isLoading?: boolean;
}

export const ContextDashboard = ({ context, isLoading = false }: ContextDashboardProps) => {
  const summary = context?.summary;
  const stats = [
    { label: 'Repositories', value: summary?.repositories ?? 0, icon: Code2 },
    { label: 'Files', value: summary?.files ?? 0, icon: Box },
    { label: 'Artifacts', value: summary?.artifacts ?? 0, icon: Binary },
    { label: 'APIs', value: summary?.apis ?? 0, icon: GitPullRequest },
    { label: 'Tables', value: summary?.databaseEntities ?? 0, icon: Database },
    { label: 'Dependencies', value: summary?.dependencies ?? 0, icon: Package },
    { label: 'Jira Issues', value: summary?.jiraTickets ?? 0, icon: Ticket },
    { label: 'Graph Edges', value: summary?.relationships ?? 0, icon: Network }
  ];

  return (
    <section id="context" className="scroll-mt-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Context Inventory</h2>
        <span className="text-sm text-muted-foreground">
          {isLoading ? 'Loading context' : context ? 'Live from indexed context' : 'Build context to populate'}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-background p-4">
            <div className="mb-4 flex items-center justify-between text-muted-foreground">
              <span className="text-sm">{stat.label}</span>
              <stat.icon className="h-4 w-4" />
            </div>
            <div className="text-2xl font-semibold">{stat.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
};
