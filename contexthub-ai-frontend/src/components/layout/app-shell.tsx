import { GitBranch, MessageSquareText, Network, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

const navItems = [
  { label: 'Context', href: '#context', icon: GitBranch },
  { label: 'Architecture', href: '#architecture', icon: Network },
  { label: 'Feature DNA', href: '#feature-dna', icon: ShieldCheck },
  { label: 'AI Chat', href: '#ai-chat', icon: MessageSquareText }
];

export const AppShell = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-muted/35 p-4 lg:block">
      <div className="mb-8">
        <div className="text-lg font-semibold">ContextHub AI</div>
        <div className="text-sm text-muted-foreground">Software intelligence workspace</div>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm hover:bg-background"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
    <main className="lg:pl-64">{children}</main>
  </div>
);
