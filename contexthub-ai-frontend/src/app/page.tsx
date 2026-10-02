import { ContextWorkspace } from '@/components/context-workspace';
import { AppShell } from '@/components/layout/app-shell';

export default function Home() {
  return (
    <AppShell>
      <header className="border-b border-border px-4 py-5 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-semibold">Project Context</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect repositories and planning systems, then build the context layer for AI-backed software intelligence.
        </p>
      </header>
      <ContextWorkspace />
    </AppShell>
  );
}
