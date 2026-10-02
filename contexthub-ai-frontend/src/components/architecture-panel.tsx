'use client';

import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from 'reactflow';
import type { ProjectContext } from '@/lib/api';
import 'reactflow/dist/style.css';

interface ArchitecturePanelProps {
  context: ProjectContext | null;
}

const emptyNodes: Node[] = [
  { id: 'empty', position: { x: 0, y: 0 }, data: { label: 'Build context to render the knowledge graph' } }
];

export const ArchitecturePanel = ({ context }: ArchitecturePanelProps) => {
  const nodes: Node[] =
    context && context.graph.nodes.length > 0
      ? context.graph.nodes.map((node) => ({
          id: node.id,
          position: node.position,
          data: { label: node.label },
          type: 'default'
        }))
      : emptyNodes;

  const edges: Edge[] =
    context?.graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label
    })) ?? [];

  return (
    <section id="architecture" className="scroll-mt-4 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Knowledge Graph</h2>
        <span className="text-sm text-muted-foreground">{edges.length} relationships</span>
      </div>
      <div className="h-[420px] rounded-lg border border-border">
        <ReactFlow nodes={nodes} edges={edges} fitView>
          <Background />
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </section>
  );
};
